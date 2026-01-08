import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import {
  MOCK_COURSES,
  MOCK_LESSONS,
  getMockCoursesWithProgress,
  getMockLessonWithProgress,
  getNextLesson,
} from '../mocks/courses';
import type { CourseWithProgress, LessonWithProgress } from '@mpstats/shared';

// In-memory progress storage for mock
const mockProgress = new Map<string, Map<string, { watchedPercent: number; completedAt: Date | null }>>();

export const learningRouter = router({
  // Get all courses with progress
  getCourses: protectedProcedure.query(async ({ ctx }): Promise<CourseWithProgress[]> => {
    return getMockCoursesWithProgress(ctx.user.id);
  }),

  // Get single course with lessons
  getCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }): Promise<CourseWithProgress | null> => {
      const courses = getMockCoursesWithProgress(ctx.user.id);
      return courses.find((c) => c.id === input.courseId) || null;
    }),

  // Get personalized learning path
  getPath: protectedProcedure.query(async ({ ctx }) => {
    // Return ALL lessons with progress
    const allLessons = MOCK_LESSONS
      .map((l) => getMockLessonWithProgress(l.id, ctx.user.id))
      .filter((l): l is LessonWithProgress => l !== null);

    return {
      id: 'mock-path-1',
      userId: ctx.user.id,
      generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lessons: allLessons,
      totalLessons: allLessons.length,
      completedLessons: allLessons.filter((l) => l.status === 'COMPLETED').length,
    };
  }),

  // Get lesson details with progress
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      const lesson = getMockLessonWithProgress(input.lessonId, ctx.user.id);

      if (!lesson) {
        return null;
      }

      // Find course
      const course = MOCK_COURSES.find((c) => c.id === lesson.courseId);

      // Find next lesson in course
      const courseLessons = MOCK_LESSONS.filter((l) => l.courseId === lesson.courseId).sort(
        (a, b) => a.order - b.order
      );
      const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id);
      const nextLessonInCourse =
        currentIndex < courseLessons.length - 1
          ? getMockLessonWithProgress(courseLessons[currentIndex + 1].id, ctx.user.id)
          : null;

      // Find previous lesson
      const prevLessonInCourse =
        currentIndex > 0
          ? getMockLessonWithProgress(courseLessons[currentIndex - 1].id, ctx.user.id)
          : null;

      return {
        lesson,
        course,
        nextLesson: nextLessonInCourse,
        prevLesson: prevLessonInCourse,
        totalLessonsInCourse: courseLessons.length,
        currentLessonNumber: currentIndex + 1,
      };
    }),

  // Get next recommended lesson
  getNextLesson: protectedProcedure.query(async ({ ctx }) => {
    return getNextLesson(ctx.user.id);
  }),

  // Update lesson progress
  updateProgress: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        watchedPercent: z.number().min(0).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Store in mock progress
      if (!mockProgress.has(ctx.user.id)) {
        mockProgress.set(ctx.user.id, new Map());
      }

      const userProgress = mockProgress.get(ctx.user.id)!;
      const status = input.watchedPercent >= 90 ? 'COMPLETED' : 'IN_PROGRESS';
      const completedAt = status === 'COMPLETED' ? new Date() : null;

      userProgress.set(input.lessonId, {
        watchedPercent: input.watchedPercent,
        completedAt,
      });

      return {
        lessonId: input.lessonId,
        status,
        watchedPercent: input.watchedPercent,
        completedAt,
      };
    }),

  // Mark lesson as completed
  completeLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!mockProgress.has(ctx.user.id)) {
        mockProgress.set(ctx.user.id, new Map());
      }

      const userProgress = mockProgress.get(ctx.user.id)!;
      userProgress.set(input.lessonId, {
        watchedPercent: 100,
        completedAt: new Date(),
      });

      return {
        lessonId: input.lessonId,
        status: 'COMPLETED' as const,
        watchedPercent: 100,
        completedAt: new Date(),
      };
    }),

  // Get lesson summary (mock - will be AI-generated in Sprint 3)
  getLessonSummary: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ input }) => {
      const lesson = MOCK_LESSONS.find((l) => l.id === input.lessonId);

      if (!lesson) {
        return null;
      }

      // Mock summary based on lesson
      const summaries: Record<string, string> = {
        'lesson-1-1': `## Ключевые тезисы

1. **Аналитика — основа успеха** на маркетплейсах. Без данных вы принимаете решения вслепую.

2. **Главные метрики селлера:**
   - Оборачиваемость товара
   - Маржинальность
   - Доля рынка в категории
   - CTR и конверсия карточки

3. **MPSTATS** позволяет отслеживать не только свои показатели, но и анализировать конкурентов.

### Практические выводы
- Начните с ABC-анализа своего ассортимента
- Настройте трекинг 5-10 ключевых конкурентов
- Проверяйте динамику позиций еженедельно`,

        'lesson-2-1': `## Ключевые тезисы

1. **Типы рекламы на WB:**
   - Автоматическая кампания (максимальный охват)
   - Поиск + Каталог (целевой трафик)
   - Карточка товара (ретаргетинг)

2. **Минимальный бюджет** для старта — 500 рублей.

3. **Главная метрика** — ДРР (Доля Рекламных Расходов). Целевой показатель: 5-15%.

### Практические выводы
- Начинайте с автоматической кампании для теста
- Следите за ДРР ежедневно
- Отключайте неэффективные ключи через 3 дня`,
      };

      return {
        lessonId: input.lessonId,
        summary: summaries[input.lessonId] || `## Краткое содержание\n\nУрок "${lesson.title}" содержит практические рекомендации по теме ${lesson.skillCategory.toLowerCase()}.`,
        generatedAt: new Date(),
      };
    }),
});
