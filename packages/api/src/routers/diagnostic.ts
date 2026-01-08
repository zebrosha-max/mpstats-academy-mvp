import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { MOCK_QUESTIONS, getBalancedQuestions } from '../mocks/questions';
import { MOCK_SKILL_PROFILE } from '../mocks/dashboard';
import { MOCK_LESSONS } from '../mocks/courses';
import type { DiagnosticResult, DiagnosticSessionState, SkillProfile, SkillGap, SkillCategory } from '@mpstats/shared';

// Calculate skill gaps from actual skill profile
const TARGET_SCORE = 70;

// Get lessons by skill category
function getLessonsByCategory(category: SkillCategory): string[] {
  return MOCK_LESSONS
    .filter((lesson) => lesson.skillCategory === category)
    .sort((a, b) => a.order - b.order)
    .map((lesson) => lesson.id);
}

// Get recommended lessons from gaps (top lessons from categories with gaps > 0)
function getRecommendedLessonsFromGaps(gaps: SkillGap[], maxLessons: number = 5): string[] {
  return gaps
    .filter((g) => g.gap > 0)
    .flatMap((g) => g.recommendedLessons.slice(0, 2)) // Take 2 lessons per weak category
    .slice(0, maxLessons);
}

function calculateSkillGaps(skillProfile: SkillProfile): SkillGap[] {
  const categories: Array<{ key: keyof SkillProfile; category: SkillCategory; label: string }> = [
    { key: 'analytics', category: 'ANALYTICS', label: 'Аналитика' },
    { key: 'marketing', category: 'MARKETING', label: 'Маркетинг' },
    { key: 'content', category: 'CONTENT', label: 'Контент' },
    { key: 'operations', category: 'OPERATIONS', label: 'Операции' },
    { key: 'finance', category: 'FINANCE', label: 'Финансы' },
  ];

  const gaps: SkillGap[] = categories.map(({ key, category, label }) => {
    const currentScore = skillProfile[key];
    const gap = Math.max(0, TARGET_SCORE - currentScore);
    const priority: 'HIGH' | 'MEDIUM' | 'LOW' = gap >= 20 ? 'HIGH' : gap >= 10 ? 'MEDIUM' : 'LOW';

    return {
      category,
      label,
      currentScore,
      targetScore: TARGET_SCORE,
      gap,
      priority,
      recommendedLessons: getLessonsByCategory(category),
    };
  });

  // Sort by gap descending (highest priority first)
  return gaps.sort((a, b) => b.gap - a.gap);
}

// In-memory session storage for mock (will be replaced with DB in Sprint 3)
// Using globalThis to persist across hot reloads in Next.js dev mode
type MockSession = {
  userId: string;
  questions: typeof MOCK_QUESTIONS;
  currentIndex: number;
  answers: Array<{ questionId: string; selectedIndex: number; isCorrect: boolean }>;
  startedAt: Date;
};

type CompletedSession = {
  id: string;
  userId: string;
  status: 'COMPLETED';
  startedAt: Date;
  completedAt: Date;
  score: number;
  skillProfile: SkillProfile;
};

type MockStorage = {
  mockSessions: Map<string, MockSession>;
  completedSessions: CompletedSession[];
  latestSkillProfiles: Map<string, SkillProfile>; // userId -> SkillProfile
};

const globalForMock = globalThis as unknown as { mockStorage: MockStorage };
globalForMock.mockStorage = globalForMock.mockStorage || {
  mockSessions: new Map<string, MockSession>(),
  completedSessions: [],
  latestSkillProfiles: new Map<string, SkillProfile>(),
};
const { mockSessions, completedSessions } = globalForMock.mockStorage;

// Export for use in profile router (now requires userId)
export const getLatestSkillProfile = (userId: string): SkillProfile | null =>
  globalForMock.mockStorage.latestSkillProfiles.get(userId) || null;
export const getCompletedSessions = (userId: string): CompletedSession[] =>
  globalForMock.mockStorage.completedSessions.filter(s => s.userId === userId);

export const diagnosticRouter = router({
  // Get current session or null
  getCurrentSession: protectedProcedure.query(async ({ ctx }) => {
    // Check in-memory first (mock)
    const mockSession = Array.from(mockSessions.entries()).find(
      ([_, session]) => session.currentIndex < session.questions.length
    );

    if (mockSession) {
      const [sessionId, session] = mockSession;
      return {
        id: sessionId,
        status: 'IN_PROGRESS' as const,
        currentQuestion: session.currentIndex,
        startedAt: session.startedAt,
      };
    }

    // Fallback to DB
    return ctx.prisma.diagnosticSession.findFirst({
      where: { userId: ctx.user.id, status: 'IN_PROGRESS' },
      include: { answers: true },
    });
  }),

  // Start new diagnostic session
  startSession: protectedProcedure.mutation(async ({ ctx }) => {
    // Generate balanced questions (3 per category = 15 total)
    const questions = getBalancedQuestions(15);
    const sessionId = `mock-session-${ctx.user.id}-${Date.now()}`;

    mockSessions.set(sessionId, {
      userId: ctx.user.id,
      questions,
      currentIndex: 0,
      answers: [],
      startedAt: new Date(),
    });

    return {
      id: sessionId,
      status: 'IN_PROGRESS' as const,
      totalQuestions: questions.length,
      currentQuestion: 0,
    };
  }),

  // Get current session state with question
  getSessionState: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }): Promise<DiagnosticSessionState> => {
      const session = mockSessions.get(input.sessionId);

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

      const isComplete = session.currentIndex >= session.questions.length;
      const currentQuestion = isComplete ? null : session.questions[session.currentIndex];

      // Don't expose correctIndex to client
      const safeQuestion = currentQuestion
        ? {
            ...currentQuestion,
            correctIndex: -1, // Hide correct answer
            explanation: '', // Hide explanation until answered
          }
        : null;

      return {
        sessionId: input.sessionId,
        currentQuestionIndex: session.currentIndex,
        totalQuestions: session.questions.length,
        answeredQuestions: session.answers.map((a) => ({
          questionId: a.questionId,
          answer: session.questions.find((q) => q.id === a.questionId)?.options[a.selectedIndex] || '',
          isCorrect: a.isCorrect,
          difficulty: session.questions.find((q) => q.id === a.questionId)?.difficulty || 'MEDIUM',
          skillCategory: session.questions.find((q) => q.id === a.questionId)?.skillCategory || 'ANALYTICS',
        })),
        currentQuestion: safeQuestion,
        isComplete,
      };
    }),

  // Submit answer
  submitAnswer: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        questionId: z.string(),
        selectedIndex: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const session = mockSessions.get(input.sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      const question = session.questions.find((q) => q.id === input.questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      const isCorrect = input.selectedIndex === question.correctIndex;

      session.answers.push({
        questionId: input.questionId,
        selectedIndex: input.selectedIndex,
        isCorrect,
      });

      session.currentIndex++;

      const isComplete = session.currentIndex >= session.questions.length;

      return {
        isCorrect,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        isComplete,
        nextQuestionIndex: isComplete ? null : session.currentIndex,
      };
    }),

  // Get session results
  getResults: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }): Promise<DiagnosticResult | null> => {
      const session = mockSessions.get(input.sessionId);

      if (session) {
        // Calculate results from mock session
        const correctAnswers = session.answers.filter((a) => a.isCorrect).length;
        const accuracy = Math.round((correctAnswers / session.questions.length) * 100);

        // Calculate skill profile based on answers
        const categoryScores: Record<string, { correct: number; total: number }> = {};
        session.answers.forEach((answer, idx) => {
          const question = session.questions[idx];
          if (!categoryScores[question.skillCategory]) {
            categoryScores[question.skillCategory] = { correct: 0, total: 0 };
          }
          categoryScores[question.skillCategory].total++;
          if (answer.isCorrect) {
            categoryScores[question.skillCategory].correct++;
          }
        });

        const skillProfile = {
          analytics: categoryScores['ANALYTICS']
            ? Math.round((categoryScores['ANALYTICS'].correct / categoryScores['ANALYTICS'].total) * 100)
            : 50,
          marketing: categoryScores['MARKETING']
            ? Math.round((categoryScores['MARKETING'].correct / categoryScores['MARKETING'].total) * 100)
            : 50,
          content: categoryScores['CONTENT']
            ? Math.round((categoryScores['CONTENT'].correct / categoryScores['CONTENT'].total) * 100)
            : 50,
          operations: categoryScores['OPERATIONS']
            ? Math.round((categoryScores['OPERATIONS'].correct / categoryScores['OPERATIONS'].total) * 100)
            : 50,
          finance: categoryScores['FINANCE']
            ? Math.round((categoryScores['FINANCE'].correct / categoryScores['FINANCE'].total) * 100)
            : 50,
        };

        const gaps = calculateSkillGaps(skillProfile);
        const recommendedPath = getRecommendedLessonsFromGaps(gaps, 5);

        const completedAt = new Date();

        // Save to completed sessions (only if not already saved)
        const alreadySaved = completedSessions.some((s) => s.id === input.sessionId);
        if (!alreadySaved) {
          completedSessions.unshift({
            id: input.sessionId,
            userId: session.userId,
            status: 'COMPLETED',
            startedAt: session.startedAt,
            completedAt,
            score: accuracy,
            skillProfile,
          });
          // Update latest skill profile for this user
          globalForMock.mockStorage.latestSkillProfiles.set(session.userId, skillProfile);
        }

        return {
          sessionId: input.sessionId,
          completedAt,
          totalQuestions: session.questions.length,
          correctAnswers,
          accuracy,
          skillProfile,
          gaps,
          recommendedPath,
        };
      }

      // Check completed sessions
      const completedSession = completedSessions.find((s) => s.id === input.sessionId);
      if (completedSession) {
        const gaps = calculateSkillGaps(completedSession.skillProfile);
        return {
          sessionId: input.sessionId,
          completedAt: completedSession.completedAt,
          totalQuestions: 15, // Standard test length
          correctAnswers: Math.round((completedSession.score / 100) * 15),
          accuracy: completedSession.score,
          skillProfile: completedSession.skillProfile,
          gaps,
          recommendedPath: getRecommendedLessonsFromGaps(gaps, 5),
        };
      }

      // Fallback to mock data for demo
      const fallbackGaps = calculateSkillGaps(MOCK_SKILL_PROFILE);
      return {
        sessionId: input.sessionId,
        completedAt: new Date(),
        totalQuestions: 15,
        correctAnswers: 10,
        accuracy: 67,
        skillProfile: MOCK_SKILL_PROFILE,
        gaps: fallbackGaps,
        recommendedPath: getRecommendedLessonsFromGaps(fallbackGaps, 5),
      };
    }),

  // Get diagnostic history for current user
  getHistory: protectedProcedure.query(async ({ ctx }) => {
    // Return only real completed sessions for this user (no fake data)
    return completedSessions
      .filter((s) => s.userId === ctx.user.id)
      .map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        score: s.score,
      }));
  }),
});
