/**
 * AI Question Generator for Diagnostic Sessions
 *
 * Generates multiple-choice diagnostic questions from RAG content chunks via LLM.
 * Uses per-category parallel generation with independent fallback:
 *   Primary model -> Fallback model -> Mock questions (provided by caller)
 */

import type { DiagnosticQuestion, SkillCategory } from '@mpstats/shared';
import { openrouter, MODELS } from './openrouter';
import { supabase } from './retrieval';
import {
  generatedQuestionsArraySchema,
  questionJsonSchema,
  type GeneratedQuestion,
} from './question-schema';

// ============== CONSTANTS ==============

/**
 * Maps each SkillCategory to the course prefixes in content_chunk.lesson_id.
 * FINANCE has no courses — always falls back to mock questions.
 */
export const CATEGORY_TO_COURSES: Record<SkillCategory, string[]> = {
  ANALYTICS: ['01_analytics'],
  MARKETING: ['02_ads', '05_ozon'],
  CONTENT: ['03_ai'],
  OPERATIONS: ['04_workshops', '06_express'],
  FINANCE: [],
};

const QUESTIONS_PER_CATEGORY = 3;
const CHUNKS_TO_FETCH = 15; // fetch more, sample fewer
const CHUNKS_TO_USE = 5;
const LLM_TIMEOUT_MS = 8000;

// ============== TYPES ==============

/** Callback that provides mock questions when LLM generation fails */
export type MockQuestionsFn = (
  category: SkillCategory,
  count: number
) => DiagnosticQuestion[];

// ============== TYPES ==============

/** Options for customizing question generation scope and volume */
export interface GenerateOptions {
  categories?: SkillCategory[];
  questionsPerCategory?: number;
}

// ============== MAIN ENTRY POINT ==============

/**
 * Generate diagnostic questions using LLM + RAG chunks.
 *
 * For each category, attempts LLM generation with model fallback chain.
 * If all models fail for a category, uses `fallbackFn` to get mock questions.
 *
 * @param fallbackFn - Provides mock questions for categories where LLM fails
 * @param options - Optional: limit to specific categories or change count per category
 * @returns Shuffled DiagnosticQuestion objects
 */
export async function generateDiagnosticQuestions(
  fallbackFn: MockQuestionsFn,
  options?: GenerateOptions,
): Promise<DiagnosticQuestion[]> {
  const categories: SkillCategory[] = options?.categories ?? [
    'ANALYTICS',
    'MARKETING',
    'CONTENT',
    'OPERATIONS',
    'FINANCE',
  ];
  const perCategory = options?.questionsPerCategory ?? QUESTIONS_PER_CATEGORY;

  // Generate questions per category in parallel
  const results = await Promise.allSettled(
    categories.map((category) =>
      generateQuestionsForCategory(category, perCategory)
    )
  );

  const allQuestions: DiagnosticQuestion[] = [];

  for (let i = 0; i < categories.length; i++) {
    const result = results[i];
    const category = categories[i];

    if (result.status === 'fulfilled' && result.value.length === perCategory) {
      allQuestions.push(...result.value);
    } else {
      // Fallback to mock questions for this category
      console.warn(
        `[question-generator] LLM failed for ${category}, using mock fallback.`,
        result.status === 'rejected' ? result.reason : 'Wrong count'
      );
      allQuestions.push(...fallbackFn(category, perCategory));
    }
  }

  // Shuffle final array to mix categories
  return shuffleArray(allQuestions);
}

// ============== PER-CATEGORY GENERATION ==============

/**
 * Generate questions for a single category using LLM with model fallback.
 *
 * @throws Error if all models fail (caller substitutes mock)
 */
async function generateQuestionsForCategory(
  category: SkillCategory,
  count: number
): Promise<DiagnosticQuestion[]> {
  const coursePrefixes = CATEGORY_TO_COURSES[category];

  // FINANCE has no courses — throw immediately to trigger mock fallback
  if (coursePrefixes.length === 0) {
    throw new Error(`No course data for category ${category}`);
  }

  // Fetch random chunks for this category
  const chunks = await fetchRandomChunks(coursePrefixes, CHUNKS_TO_FETCH);

  if (chunks.length === 0) {
    throw new Error(`No chunks found for category ${category}`);
  }

  // Randomly sample chunks to use as context
  const sampledChunks = shuffleArray(chunks).slice(0, CHUNKS_TO_USE);
  const context = sampledChunks
    .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
    .join('\n\n');

  // Try primary model, then fallback
  const models = [MODELS.chat, MODELS.fallback];

  for (const model of models) {
    try {
      const questions = await callLLM(model, category, count, context);
      return questions.map((q, i) =>
        toDiagnosticQuestion(q, category, i)
      );
    } catch (err) {
      console.warn(
        `[question-generator] Model ${model} failed for ${category}:`,
        err instanceof Error ? err.message : err
      );
      // Continue to next model
    }
  }

  throw new Error(`All models failed for category ${category}`);
}

// ============== LLM CALL ==============

/**
 * Call LLM to generate questions with structured output.
 */
async function callLLM(
  model: string,
  category: SkillCategory,
  count: number,
  context: string
): Promise<GeneratedQuestion[]> {
  const systemPrompt = buildSystemPrompt(category, count);

  const response = await openrouter.chat.completions.create(
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Контекст из учебных материалов:\n\n${context}\n\nСгенерируй ${count} вопросов на основе этого контекста.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
      response_format: {
        type: 'json_schema' as const,
        json_schema: {
          name: 'diagnostic_questions',
          strict: true,
          schema: questionJsonSchema,
        },
      },
    },
    { timeout: LLM_TIMEOUT_MS }
  );

  const rawContent = response.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty LLM response');
  }

  // Strip markdown code fences if present
  const jsonString = stripCodeFences(rawContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error(`Invalid JSON from LLM: ${jsonString.slice(0, 200)}`);
  }

  // Validate with Zod
  const validation = generatedQuestionsArraySchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `Zod validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`
    );
  }

  return validation.data.questions;
}

// ============== HELPERS ==============

/**
 * Build system prompt for question generation.
 */
function buildSystemPrompt(category: SkillCategory, count: number): string {
  return `Ты — AI-генератор тестовых вопросов для образовательной платформы MPSTATS Academy (маркетплейсы Ozon, Wildberries).

Твоя задача: создать ${count} вопросов с множественным выбором по категории "${category}" на основе предоставленного контекста из учебных материалов.

Требования к вопросам:
- 70% практических кейсов (ситуации, расчёты, решения), 30% теория/понятия/метрики
- Каждый вопрос имеет РОВНО 4 варианта ответа
- Только 1 правильный ответ (correctIndex: 0-3)
- Explanation объясняет почему правильный ответ верен
- Микс сложности: EASY, MEDIUM, HARD
- Язык: русский
- Вопросы должны быть релевантны контексту, но не дословно цитировать его
- Каждый вопрос должен быть уникальным и проверять разные аспекты темы

ЗАПРЕЩЕНО генерировать вопросы:
- Про мнения, советы или рекомендации конкретных преподавателей/спикеров ("Что рекомендует руководитель академии?")
- Про доступ к инструментам, VPN, регистрацию в сервисах ("Как получить доступ к нейросетям в России?")
- Про организационные вопросы обучения ("Как записаться на курс?", "Где найти материалы?")
- Не относящиеся к практическим навыкам работы на маркетплейсах

Каждый вопрос должен проверять КОНКРЕТНЫЙ НАВЫК или ЗНАНИЕ, применимое в работе селлера на маркетплейсах.

Формат ответа: JSON объект с полем "questions" — массив объектов.
Каждый объект: { question, options (array of 4 strings), correctIndex (0-3), explanation, difficulty ("EASY"|"MEDIUM"|"HARD") }`;
}

/**
 * Fetch random chunks from content_chunk table for given course prefixes.
 */
async function fetchRandomChunks(
  coursePrefixes: string[],
  limit: number
): Promise<Array<{ id: string; content: string; lesson_id: string }>> {
  // Build OR filter for multiple prefixes
  const orFilter = coursePrefixes
    .map((prefix) => `lesson_id.like.${prefix}%`)
    .join(',');

  const { data, error } = await supabase
    .from('content_chunk')
    .select('id, content, lesson_id')
    .or(orFilter)
    .limit(limit);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Convert a GeneratedQuestion to DiagnosticQuestion format.
 * Shuffles options and recalculates correctIndex to avoid LLM index bias.
 */
function toDiagnosticQuestion(
  q: GeneratedQuestion,
  category: SkillCategory,
  index: number
): DiagnosticQuestion {
  // Remember the correct answer text before shuffling
  const correctAnswer = q.options[q.correctIndex];

  // Create shuffled options
  const shuffledOptions = shuffleArray([...q.options]);

  // Find new index of correct answer
  const newCorrectIndex = shuffledOptions.indexOf(correctAnswer);

  return {
    id: `q-${category.toLowerCase()}-${Date.now()}-${index}`,
    question: q.question,
    options: shuffledOptions,
    correctIndex: newCorrectIndex,
    explanation: q.explanation,
    difficulty: q.difficulty,
    skillCategory: category,
  };
}

/**
 * Strip markdown code fences from LLM response if present.
 */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  // Match ```json ... ``` or ``` ... ```
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
