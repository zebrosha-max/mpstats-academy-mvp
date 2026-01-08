/**
 * LLM Generation service
 *
 * Handles AI text generation for:
 * - Lesson summaries (RAG-enhanced)
 * - Chat responses with citations
 */

import { openrouter, MODELS, MODEL_CONFIG } from './openrouter';
import { searchChunks, getChunksForLesson, formatTimecode } from './retrieval';

// Types
export interface GenerationResult {
  content: string;
  sources: SourceCitation[];
  model: string;
}

export interface SourceCitation {
  id: string;
  lesson_id: string;
  content: string;
  timecode_start: number;
  timecode_end: number;
  timecodeFormatted: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Generate a summary for a lesson using all its chunks
 *
 * @param lessonId - Lesson ID (e.g., "01_analytics_m01_start_001")
 * @returns Summary with source citations
 */
export async function generateLessonSummary(
  lessonId: string
): Promise<GenerationResult> {
  // 1. Get all chunks for this lesson
  const chunks = await getChunksForLesson(lessonId);

  if (chunks.length === 0) {
    return {
      content: 'Контент для этого урока пока не загружен.',
      sources: [],
      model: MODELS.chat,
    };
  }

  // 2. Build context from chunks
  const context = chunks
    .map(
      (chunk, i) =>
        `[${i + 1}] (${formatTimecode(chunk.timecode_start)} - ${formatTimecode(chunk.timecode_end)})\n${chunk.content}`
    )
    .join('\n\n');

  // 3. Generate summary
  const systemPrompt = `Ты — AI-ассистент образовательной платформы MPSTATS Academy для селлеров маркетплейсов.

Твоя задача: создать структурированное резюме урока на основе транскрипта.

Формат ответа:
## Ключевые темы
- [тема 1]
- [тема 2]
...

## Основные идеи
1. [идея с ссылкой на источник [1]]
2. [идея с ссылкой на источник [2]]
...

## Практические выводы
- [что можно применить]
- [конкретные действия]

Правила:
- Используй ссылки [1], [2] и т.д. для цитирования источников
- Пиши на русском языке
- Будь конкретным и практичным
- Фокусируйся на actionable инсайтах для селлеров`;

  const response = await openrouter.chat.completions.create({
    model: MODELS.chat,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Создай резюме урока на основе следующего транскрипта:\n\n${context}`,
      },
    ],
    max_tokens: MODEL_CONFIG.maxTokens,
    temperature: MODEL_CONFIG.ragTemperature,
  });

  const content = response.choices[0]?.message?.content || 'Ошибка генерации.';

  // 4. Build source citations
  const sources: SourceCitation[] = chunks.map((chunk) => ({
    id: chunk.id,
    lesson_id: chunk.lesson_id,
    content: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    timecode_start: chunk.timecode_start,
    timecode_end: chunk.timecode_end,
    timecodeFormatted: `${formatTimecode(chunk.timecode_start)} - ${formatTimecode(chunk.timecode_end)}`,
  }));

  return {
    content,
    sources,
    model: MODELS.chat,
  };
}

/**
 * Generate a chat response using RAG
 *
 * @param lessonId - Lesson ID to search within
 * @param message - User's question
 * @param history - Previous chat messages
 * @returns AI response with citations
 */
export async function generateChatResponse(
  lessonId: string,
  message: string,
  history: ChatMessage[] = []
): Promise<GenerationResult> {
  // 1. Search for relevant chunks (threshold lowered to 0.3 for better recall)
  console.log('[Chat] Searching chunks for:', { lessonId, message: message.substring(0, 50) });
  const relevantChunks = await searchChunks({
    query: message,
    lessonId,
    limit: 5,
    threshold: 0.3,
  });
  console.log('[Chat] Found chunks:', relevantChunks.length);

  // 2. Build context with citations
  let context = '';
  if (relevantChunks.length > 0) {
    context = relevantChunks
      .map(
        (chunk, i) =>
          `[${i + 1}] (${formatTimecode(chunk.timecode_start)} - ${formatTimecode(chunk.timecode_end)}, relevance: ${(chunk.similarity * 100).toFixed(0)}%)\n${chunk.content}`
      )
      .join('\n\n');
  }

  // 3. Build system prompt
  const systemPrompt = `Ты — AI-ассистент образовательной платформы MPSTATS Academy для селлеров маркетплейсов.

Твоя задача: отвечать на вопросы по уроку, используя предоставленный контекст.

${context ? `Контекст из урока:\n${context}` : 'Контекст не найден.'}

Правила:
- Отвечай ТОЛЬКО на основе предоставленного контекста
- Если ответа нет в контексте, честно скажи об этом
- Используй ссылки [1], [2] и т.д. для цитирования источников
- Пиши на русском языке
- Будь конкретным и полезным
- Если вопрос не связан с уроком, вежливо перенаправь к теме урока`;

  // 4. Build messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10), // Keep last 10 messages for context
    { role: 'user', content: message },
  ];

  // 5. Generate response
  const response = await openrouter.chat.completions.create({
    model: MODELS.chat,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: MODEL_CONFIG.maxTokens,
    temperature: MODEL_CONFIG.ragTemperature,
  });

  const content =
    response.choices[0]?.message?.content ||
    'Извините, не удалось сгенерировать ответ. Попробуйте переформулировать вопрос.';

  // 6. Build source citations
  const sources: SourceCitation[] = relevantChunks.map((chunk) => ({
    id: chunk.id,
    lesson_id: chunk.lesson_id,
    content: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? '...' : ''),
    timecode_start: chunk.timecode_start,
    timecode_end: chunk.timecode_end,
    timecodeFormatted: `${formatTimecode(chunk.timecode_start)} - ${formatTimecode(chunk.timecode_end)}`,
  }));

  return {
    content,
    sources,
    model: MODELS.chat,
  };
}
