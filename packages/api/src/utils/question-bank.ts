/**
 * Question Bank Utilities
 *
 * Manages cached AI-generated diagnostic questions in DB with TTL-based refresh.
 * Provides instant question retrieval for diagnostic sessions and admin refresh.
 */

import type { PrismaClient } from '@mpstats/db';
import type { DiagnosticQuestion, SkillCategory } from '@mpstats/shared';
import { generateDiagnosticQuestions } from '@mpstats/ai';
import { getMockQuestionsForCategory } from '../mocks/questions';

// ============== CONSTANTS ==============

export const BANK_TTL_DAYS = 7;
export const QUESTIONS_PER_BANK_CATEGORY = 10;

const ALL_CATEGORIES: SkillCategory[] = [
  'ANALYTICS',
  'MARKETING',
  'CONTENT',
  'OPERATIONS',
  'FINANCE',
];

// ============== HELPERS ==============

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

// ============== CORE FUNCTIONS ==============

/**
 * Refresh the question bank for a single category.
 * Generates QUESTIONS_PER_BANK_CATEGORY questions via AI and upserts to DB.
 */
export async function refreshBankForCategory(
  prisma: PrismaClient,
  category: SkillCategory,
): Promise<void> {
  const questions = await generateDiagnosticQuestions(
    (cat, count) => getMockQuestionsForCategory(cat, count),
    { categories: [category], questionsPerCategory: QUESTIONS_PER_BANK_CATEGORY },
  );

  // Only save AI-generated questions to bank (those with source tracing)
  // Mock fallback questions pollute the bank and break the "Errors" section
  const aiQuestions = questions.filter(q => q.sourceChunkIds && q.sourceChunkIds.length > 0);
  if (aiQuestions.length === 0) {
    console.warn(`[QuestionBank] No AI questions generated for ${category}, skipping bank save`);
    return;
  }

  console.log(`[QuestionBank] Saving ${aiQuestions.length} AI questions for ${category} (filtered ${questions.length - aiQuestions.length} mock)`);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BANK_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.questionBank.upsert({
    where: { skillCategory: category },
    update: {
      questions: aiQuestions as any,
      generatedAt: now,
      expiresAt,
    },
    create: {
      skillCategory: category,
      questions: aiQuestions as any,
      generatedAt: now,
      expiresAt,
    },
  });
}

/**
 * Get questions from the cached bank, falling back to mock.
 * If bank is stale or missing, triggers async non-blocking refresh.
 *
 * @param prisma - Prisma client
 * @param count - Total number of questions needed (distributed across categories)
 * @returns Shuffled array of DiagnosticQuestion
 */
export async function getQuestionsFromBank(
  prisma: PrismaClient,
  count: number,
): Promise<DiagnosticQuestion[]> {
  const perCategory = Math.ceil(count / ALL_CATEGORIES.length);
  const allQuestions: DiagnosticQuestion[] = [];
  const staleCategories: SkillCategory[] = [];

  for (const category of ALL_CATEGORIES) {
    const bank = await prisma.questionBank.findUnique({
      where: { skillCategory: category },
    });

    let categoryQuestions: DiagnosticQuestion[] = [];

    if (bank && new Date(bank.expiresAt) > new Date()) {
      // Bank is fresh — sample random questions from it
      const bankQuestions = bank.questions as unknown as DiagnosticQuestion[];
      categoryQuestions = shuffleArray(bankQuestions).slice(0, perCategory);
    }

    // If not enough questions from bank, supplement with fallback mock pool
    if (categoryQuestions.length < perCategory) {
      const needed = perCategory - categoryQuestions.length;
      const mockFallback = getMockQuestionsForCategory(category, needed);
      categoryQuestions.push(...mockFallback);
    }

    allQuestions.push(...categoryQuestions.slice(0, perCategory));

    // Collect stale categories for sequential background refresh
    if (!bank || new Date(bank.expiresAt) <= new Date()) {
      staleCategories.push(category);
    }
  }

  // Trigger sequential non-blocking refresh (not parallel — avoids Supabase connection exhaustion)
  if (staleCategories.length > 0) {
    (async () => {
      for (const cat of staleCategories) {
        try {
          await refreshBankForCategory(prisma, cat);
          console.log(`[QuestionBank] Refreshed ${cat}`);
        } catch (err) {
          console.error(`[QuestionBank] Failed to refresh ${cat}:`, err instanceof Error ? err.message : err);
        }
      }
    })();
  }

  return shuffleArray(allQuestions);
}
