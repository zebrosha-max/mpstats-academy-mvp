import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { getBalancedQuestions, getMockQuestionsForCategory } from '../mocks/questions';
import { generateDiagnosticQuestions } from '@mpstats/ai';
import { ensureUserProfile } from '../utils/ensure-user-profile';
import { handleDatabaseError } from '../utils/db-errors';
import type { PrismaClient } from '@mpstats/db';
import type {
  DiagnosticResult,
  DiagnosticSessionState,
  SkillProfile,
  SkillGap,
  SkillCategory,
  DiagnosticQuestion,
} from '@mpstats/shared';

// ============== CONSTANTS ==============

const TARGET_SCORE = 70;
const QUESTIONS_PER_SESSION = 15;

// ============== IN-FLIGHT SESSION QUESTIONS ==============
// Only active (IN_PROGRESS) sessions store their question set in memory.
// This is acceptable because active sessions are short-lived (minutes).
// All COMPLETED data is persisted in DB via Prisma.

type ActiveSessionData = {
  questions: DiagnosticQuestion[];
};

const activeSessionQuestions =
  ((globalThis as any).__activeSessionQuestions as Map<string, ActiveSessionData>) ||
  new Map<string, ActiveSessionData>();
(globalThis as any).__activeSessionQuestions = activeSessionQuestions;

// ============== RATE LIMITER ==============
// Simple sliding window rate limiter for question generation (50 req/hour per user)

const generationRateLimits =
  ((globalThis as any).__generationRateLimits as Map<string, number[]>) ||
  new Map<string, number[]>();
(globalThis as any).__generationRateLimits = generationRateLimits;

function checkRateLimit(userId: string, maxRequests: number = 50, windowMs: number = 3600000): boolean {
  const now = Date.now();
  const timestamps = generationRateLimits.get(userId) || [];
  const recent = timestamps.filter(t => now - t < windowMs);
  if (recent.length >= maxRequests) return false;
  recent.push(now);
  generationRateLimits.set(userId, recent);
  return true;
}

// ============== HELPER FUNCTIONS ==============

/**
 * Get lesson IDs by skill category from DB.
 */
async function getLessonsByCategory(
  prisma: PrismaClient,
  category: SkillCategory,
): Promise<string[]> {
  const lessons = await prisma.lesson.findMany({
    where: { skillCategory: category },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  return lessons.map((l) => l.id);
}

/**
 * Calculate skill gaps from a skill profile.
 * Async because getLessonsByCategory queries DB.
 */
async function calculateSkillGaps(
  prisma: PrismaClient,
  skillProfile: SkillProfile,
): Promise<SkillGap[]> {
  const categories: Array<{ key: keyof SkillProfile; category: SkillCategory; label: string }> = [
    { key: 'analytics', category: 'ANALYTICS', label: 'Аналитика' },
    { key: 'marketing', category: 'MARKETING', label: 'Маркетинг' },
    { key: 'content', category: 'CONTENT', label: 'Контент' },
    { key: 'operations', category: 'OPERATIONS', label: 'Операции' },
    { key: 'finance', category: 'FINANCE', label: 'Финансы' },
  ];

  const gaps: SkillGap[] = await Promise.all(
    categories.map(async ({ key, category, label }) => {
      const currentScore = skillProfile[key];
      const gap = Math.max(0, TARGET_SCORE - currentScore);
      const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
        gap >= 20 ? 'HIGH' : gap >= 10 ? 'MEDIUM' : 'LOW';

      return {
        category,
        label,
        currentScore,
        targetScore: TARGET_SCORE,
        gap,
        priority,
        recommendedLessons: await getLessonsByCategory(prisma, category),
      };
    }),
  );

  // Sort by gap descending (highest priority first)
  return gaps.sort((a, b) => b.gap - a.gap);
}

/**
 * Get recommended lessons from skill gaps (top lessons from weak categories).
 */
function getRecommendedLessonsFromGaps(gaps: SkillGap[], maxLessons: number = 5): string[] {
  return gaps
    .filter((g) => g.gap > 0)
    .flatMap((g) => g.recommendedLessons.slice(0, 2))
    .slice(0, maxLessons);
}

/**
 * Calculate skill profile scores from diagnostic answers.
 */
function calculateSkillProfileFromAnswers(
  answers: Array<{ skillCategory: SkillCategory; isCorrect: boolean }>,
): SkillProfile {
  const categoryScores: Record<string, { correct: number; total: number }> = {};

  for (const answer of answers) {
    if (!categoryScores[answer.skillCategory]) {
      categoryScores[answer.skillCategory] = { correct: 0, total: 0 };
    }
    categoryScores[answer.skillCategory].total++;
    if (answer.isCorrect) {
      categoryScores[answer.skillCategory].correct++;
    }
  }

  return {
    analytics: categoryScores['ANALYTICS']
      ? Math.round((categoryScores['ANALYTICS'].correct / categoryScores['ANALYTICS'].total) * 100)
      : 0,
    marketing: categoryScores['MARKETING']
      ? Math.round((categoryScores['MARKETING'].correct / categoryScores['MARKETING'].total) * 100)
      : 0,
    content: categoryScores['CONTENT']
      ? Math.round((categoryScores['CONTENT'].correct / categoryScores['CONTENT'].total) * 100)
      : 0,
    operations: categoryScores['OPERATIONS']
      ? Math.round(
          (categoryScores['OPERATIONS'].correct / categoryScores['OPERATIONS'].total) * 100,
        )
      : 0,
    finance: categoryScores['FINANCE']
      ? Math.round((categoryScores['FINANCE'].correct / categoryScores['FINANCE'].total) * 100)
      : 0,
  };
}

// ============== EXPORTED FUNCTIONS (used by profile router) ==============

/**
 * Get the latest skill profile for a user from DB.
 */
export async function getLatestSkillProfile(
  prisma: PrismaClient,
  userId: string,
): Promise<SkillProfile | null> {
  const profile = await prisma.skillProfile.findUnique({ where: { userId } });
  if (!profile) return null;
  return {
    analytics: profile.analytics,
    marketing: profile.marketing,
    content: profile.content,
    operations: profile.operations,
    finance: profile.finance,
  };
}

/**
 * Get all completed diagnostic sessions for a user from DB.
 */
export async function getCompletedSessions(prisma: PrismaClient, userId: string) {
  return prisma.diagnosticSession.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });
}

// ============== ROUTER ==============

export const diagnosticRouter = router({
  // Get current in-progress session or null
  getCurrentSession: protectedProcedure.query(async ({ ctx }) => {
    try {
      const session = await ctx.prisma.diagnosticSession.findFirst({
        where: { userId: ctx.user.id, status: 'IN_PROGRESS' },
      });

      if (!session) return null;

      // Check if we have the questions in memory
      const sessionData = activeSessionQuestions.get(session.id);
      if (!sessionData) {
        // Server restarted during active session — mark as ABANDONED
        await ctx.prisma.diagnosticSession.update({
          where: { id: session.id },
          data: { status: 'ABANDONED' },
        });
        return null;
      }

      return {
        id: session.id,
        status: session.status,
        currentQuestion: session.currentQuestion,
        startedAt: session.startedAt,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Start new diagnostic session
  startSession: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Ensure user profile exists
      await ensureUserProfile(ctx.prisma, ctx.user);

      // Abandon any existing IN_PROGRESS sessions for this user
      await ctx.prisma.diagnosticSession.updateMany({
        where: { userId: ctx.user.id, status: 'IN_PROGRESS' },
        data: { status: 'ABANDONED' },
      });

      // Note: stale entries in activeSessionQuestions are harmless
      // and will be cleaned up when their sessions are accessed next

      // Rate limit check before any LLM call
      if (!checkRateLimit(ctx.user.id)) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Слишком много запросов на диагностику. Попробуйте через час.',
        });
      }

      // Generate questions with AI, fallback to mock
      let questions: DiagnosticQuestion[];
      try {
        questions = await generateDiagnosticQuestions(
          (category, count) => getMockQuestionsForCategory(category, count)
        );
      } catch (error) {
        // Complete fallback: if generateDiagnosticQuestions itself throws,
        // use fully mock-based questions
        console.error('AI question generation failed completely, using mock:', error);
        questions = getBalancedQuestions(QUESTIONS_PER_SESSION);
      }

      // Create session in DB
      const session = await ctx.prisma.diagnosticSession.create({
        data: {
          userId: ctx.user.id,
          status: 'IN_PROGRESS',
          currentQuestion: 0,
        },
      });

      // Store questions in memory for this active session
      activeSessionQuestions.set(session.id, { questions });

      return {
        id: session.id,
        status: 'IN_PROGRESS' as const,
        totalQuestions: questions.length,
        currentQuestion: 0,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get current session state with question
  getSessionState: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }): Promise<DiagnosticSessionState> => {
      try {
        const session = await ctx.prisma.diagnosticSession.findUnique({
          where: { id: input.sessionId },
          include: { answers: true },
        });

        if (!session) {
          return {
            sessionId: input.sessionId,
            currentQuestionIndex: 0,
            totalQuestions: 0,
            answeredQuestions: [],
            currentQuestion: null,
            isComplete: true,
          };
        }

        // If session is COMPLETED or ABANDONED, return final state
        if (session.status !== 'IN_PROGRESS') {
          return {
            sessionId: input.sessionId,
            currentQuestionIndex: session.currentQuestion,
            totalQuestions: session.answers.length,
            answeredQuestions: session.answers.map((a) => ({
              questionId: a.questionId,
              answer: a.answer,
              isCorrect: a.isCorrect,
              difficulty: a.difficulty as any,
              skillCategory: a.skillCategory as any,
            })),
            currentQuestion: null,
            isComplete: true,
          };
        }

        // In-progress session — need questions from memory
        const sessionData = activeSessionQuestions.get(input.sessionId);
        if (!sessionData) {
          // Server restarted — mark as ABANDONED
          await ctx.prisma.diagnosticSession.update({
            where: { id: input.sessionId },
            data: { status: 'ABANDONED' },
          });
          return {
            sessionId: input.sessionId,
            currentQuestionIndex: 0,
            totalQuestions: 0,
            answeredQuestions: [],
            currentQuestion: null,
            isComplete: true,
          };
        }

        const isComplete = session.currentQuestion >= sessionData.questions.length;
        const currentQuestion = isComplete
          ? null
          : sessionData.questions[session.currentQuestion];

        // Don't expose correctIndex to client
        const safeQuestion = currentQuestion
          ? {
              ...currentQuestion,
              correctIndex: -1,
              explanation: '',
            }
          : null;

        return {
          sessionId: input.sessionId,
          currentQuestionIndex: session.currentQuestion,
          totalQuestions: sessionData.questions.length,
          answeredQuestions: session.answers.map((a) => ({
            questionId: a.questionId,
            answer: a.answer,
            isCorrect: a.isCorrect,
            difficulty: a.difficulty as any,
            skillCategory: a.skillCategory as any,
          })),
          currentQuestion: safeQuestion,
          isComplete,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Submit answer
  submitAnswer: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        questionId: z.string(),
        selectedIndex: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get questions from memory
        const sessionData = activeSessionQuestions.get(input.sessionId);
        if (!sessionData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Session not found or expired. Please start a new diagnostic.',
          });
        }

        // Find the question
        const question = sessionData.questions.find((q) => q.id === input.questionId);
        if (!question) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Question not found in session.',
          });
        }

        const isCorrect = input.selectedIndex === question.correctIndex;
        const selectedAnswer = question.options[input.selectedIndex] || '';

        // Save answer to DB
        await ctx.prisma.diagnosticAnswer.create({
          data: {
            sessionId: input.sessionId,
            questionId: input.questionId,
            answer: selectedAnswer,
            isCorrect,
            difficulty: question.difficulty,
            skillCategory: question.skillCategory,
          },
        });

        // Increment currentQuestion in DB
        const updatedSession = await ctx.prisma.diagnosticSession.update({
          where: { id: input.sessionId },
          data: { currentQuestion: { increment: 1 } },
        });

        // Check completion
        const isComplete = updatedSession.currentQuestion >= sessionData.questions.length;

        if (isComplete) {
          // Fetch all answers for this session
          const allAnswers = await ctx.prisma.diagnosticAnswer.findMany({
            where: { sessionId: input.sessionId },
          });

          // Calculate skill profile
          const skillProfile = calculateSkillProfileFromAnswers(
            allAnswers.map((a) => ({
              skillCategory: a.skillCategory as SkillCategory,
              isCorrect: a.isCorrect,
            })),
          );

          // Upsert SkillProfile in DB
          await ctx.prisma.skillProfile.upsert({
            where: { userId: ctx.user.id },
            update: {
              analytics: skillProfile.analytics,
              marketing: skillProfile.marketing,
              content: skillProfile.content,
              operations: skillProfile.operations,
              finance: skillProfile.finance,
            },
            create: {
              userId: ctx.user.id,
              analytics: skillProfile.analytics,
              marketing: skillProfile.marketing,
              content: skillProfile.content,
              operations: skillProfile.operations,
              finance: skillProfile.finance,
            },
          });

          // Update session status to COMPLETED
          await ctx.prisma.diagnosticSession.update({
            where: { id: input.sessionId },
            data: { status: 'COMPLETED', completedAt: new Date() },
          });

          // Clean up in-memory question data
          activeSessionQuestions.delete(input.sessionId);
        }

        return {
          isCorrect,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
          isComplete,
          nextQuestionIndex: isComplete ? null : updatedSession.currentQuestion,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),

  // Get session results
  getResults: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }): Promise<DiagnosticResult | null> => {
      try {
        const session = await ctx.prisma.diagnosticSession.findUnique({
          where: { id: input.sessionId },
          include: { answers: true },
        });

        if (!session || session.status !== 'COMPLETED') {
          return null;
        }

        const correctAnswers = session.answers.filter((a) => a.isCorrect).length;
        const accuracy = Math.round((correctAnswers / session.answers.length) * 100);

        // Read skill profile from DB (already saved on completion)
        const skillProfile = await getLatestSkillProfile(ctx.prisma, session.userId);
        if (!skillProfile) {
          // Recalculate if somehow missing
          const calculated = calculateSkillProfileFromAnswers(
            session.answers.map((a) => ({
              skillCategory: a.skillCategory as SkillCategory,
              isCorrect: a.isCorrect,
            })),
          );
          const gaps = await calculateSkillGaps(ctx.prisma, calculated);
          return {
            sessionId: input.sessionId,
            completedAt: session.completedAt || new Date(),
            totalQuestions: session.answers.length,
            correctAnswers,
            accuracy,
            skillProfile: calculated,
            gaps,
            recommendedPath: getRecommendedLessonsFromGaps(gaps, 5),
          };
        }

        const gaps = await calculateSkillGaps(ctx.prisma, skillProfile);
        return {
          sessionId: input.sessionId,
          completedAt: session.completedAt || new Date(),
          totalQuestions: session.answers.length,
          correctAnswers,
          accuracy,
          skillProfile,
          gaps,
          recommendedPath: getRecommendedLessonsFromGaps(gaps, 5),
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Get diagnostic history for current user
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      const sessions = await ctx.prisma.diagnosticSession.findMany({
        where: { userId: ctx.user.id, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        include: { answers: true },
      });

      return sessions.map((s) => {
        const correctAnswers = s.answers.filter((a) => a.isCorrect).length;
        const score = s.answers.length > 0 ? Math.round((correctAnswers / s.answers.length) * 100) : 0;
        return {
          id: s.id,
          status: s.status,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          score,
        };
      });
    } catch (error) {
      handleDatabaseError(error);
    }
  }),
});
