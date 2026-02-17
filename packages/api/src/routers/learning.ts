import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { ensureUserProfile } from '../utils/ensure-user-profile';
import { handleDatabaseError } from '../utils/db-errors';
import type { CourseWithProgress, LessonWithProgress } from '@mpstats/shared';

export const learningRouter = router({
  // Get all courses with progress
  getCourses: protectedProcedure.query(async ({ ctx }): Promise<CourseWithProgress[]> => {
    try {
      const courses = await ctx.prisma.course.findMany({
        include: {
          lessons: {
            orderBy: { order: 'asc' },
            include: {
              progress: {
                where: { path: { userId: ctx.user.id } },
              },
            },
          },
        },
        orderBy: { order: 'asc' },
      });

      return courses.map((course) => ({
        id: course.id,
        title: course.title,
        description: course.description,
        slug: course.slug,
        imageUrl: course.imageUrl,
        duration: course.duration,
        order: course.order,
        totalLessons: course.lessons.length,
        completedLessons: course.lessons.filter((l) =>
          l.progress.some((p) => p.status === 'COMPLETED')
        ).length,
        progressPercent:
          course.lessons.length > 0
            ? Math.round(
                (course.lessons.filter((l) =>
                  l.progress.some((p) => p.status === 'COMPLETED')
                ).length /
                  course.lessons.length) *
                  100
              )
            : 0,
        lessons: course.lessons.map((l) => ({
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl || '',
          videoId: l.videoId,
          duration: l.duration || 0,
          order: l.order,
          skillCategory: l.skillCategory,
          skillLevel: l.skillLevel,
          status: l.progress[0]?.status || 'NOT_STARTED',
          watchedPercent: l.progress[0]?.watchedPercent || 0,
        })),
      }));
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get single course with lessons
  getCourse: protectedProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }): Promise<CourseWithProgress | null> => {
      try {
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                progress: {
                  where: { path: { userId: ctx.user.id } },
                },
              },
            },
          },
        });

        if (!course) return null;

        return {
          id: course.id,
          title: course.title,
          description: course.description,
          slug: course.slug,
          imageUrl: course.imageUrl,
          duration: course.duration,
          order: course.order,
          totalLessons: course.lessons.length,
          completedLessons: course.lessons.filter((l) =>
            l.progress.some((p) => p.status === 'COMPLETED')
          ).length,
          progressPercent:
            course.lessons.length > 0
              ? Math.round(
                  (course.lessons.filter((l) =>
                    l.progress.some((p) => p.status === 'COMPLETED')
                  ).length /
                    course.lessons.length) *
                    100
                )
              : 0,
          lessons: course.lessons.map((l) => ({
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl || '',
            videoId: l.videoId,
            duration: l.duration || 0,
            order: l.order,
            skillCategory: l.skillCategory,
            skillLevel: l.skillLevel,
            status: l.progress[0]?.status || 'NOT_STARTED',
            watchedPercent: l.progress[0]?.watchedPercent || 0,
          })),
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Get personalized learning path
  getPath: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get user's learning path if it exists
      const path = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        include: {
          progress: {
            include: { lesson: true },
            orderBy: { lesson: { order: 'asc' } },
          },
        },
      });

      // If no path exists, return all lessons with no progress
      if (!path) {
        const allLessons = await ctx.prisma.lesson.findMany({
          orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
        });

        const lessons: LessonWithProgress[] = allLessons.map((l) => ({
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl || '',
          videoId: l.videoId,
          duration: l.duration || 0,
          order: l.order,
          skillCategory: l.skillCategory,
          skillLevel: l.skillLevel,
          status: 'NOT_STARTED' as const,
          watchedPercent: 0,
        }));

        return {
          id: null,
          userId: ctx.user.id,
          generatedAt: new Date(),
          lessons,
          totalLessons: lessons.length,
          completedLessons: 0,
        };
      }

      // Build lesson list from progress records
      const progressMap = new Map(
        path.progress.map((p) => [p.lessonId, p])
      );

      // Get ALL lessons (path may not have progress for all)
      const allLessons = await ctx.prisma.lesson.findMany({
        orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
      });

      const lessons: LessonWithProgress[] = allLessons.map((l) => {
        const progress = progressMap.get(l.id);
        return {
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl || '',
          videoId: l.videoId,
          duration: l.duration || 0,
          order: l.order,
          skillCategory: l.skillCategory,
          skillLevel: l.skillLevel,
          status: progress?.status || 'NOT_STARTED',
          watchedPercent: progress?.watchedPercent || 0,
        };
      });

      return {
        id: path.id,
        userId: ctx.user.id,
        generatedAt: path.generatedAt,
        lessons,
        totalLessons: lessons.length,
        completedLessons: lessons.filter((l) => l.status === 'COMPLETED').length,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get lesson details with progress
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: input.lessonId },
          include: {
            course: true,
            progress: {
              where: { path: { userId: ctx.user.id } },
            },
          },
        });

        if (!lesson) return null;

        // Get all lessons in this course for next/prev navigation
        const courseLessons = await ctx.prisma.lesson.findMany({
          where: { courseId: lesson.courseId },
          orderBy: { order: 'asc' },
          include: {
            progress: {
              where: { path: { userId: ctx.user.id } },
            },
          },
        });

        const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id);

        type LessonWithProgressData = {
          id: string;
          courseId: string;
          title: string;
          description: string | null;
          videoUrl: string | null;
          videoId: string | null;
          duration: number | null;
          order: number;
          skillCategory: typeof lesson.skillCategory;
          skillLevel: typeof lesson.skillLevel;
          progress: typeof lesson.progress;
        };

        const mapToLessonWithProgress = (l: LessonWithProgressData): LessonWithProgress => ({
          id: l.id,
          courseId: l.courseId,
          title: l.title,
          description: l.description,
          videoUrl: l.videoUrl || '',
          videoId: l.videoId,
          duration: l.duration || 0,
          order: l.order,
          skillCategory: l.skillCategory,
          skillLevel: l.skillLevel,
          status: l.progress[0]?.status || 'NOT_STARTED',
          watchedPercent: l.progress[0]?.watchedPercent || 0,
        });

        const nextLessonData =
          currentIndex < courseLessons.length - 1
            ? mapToLessonWithProgress(courseLessons[currentIndex + 1])
            : null;

        const prevLessonData =
          currentIndex > 0
            ? mapToLessonWithProgress(courseLessons[currentIndex - 1])
            : null;

        return {
          lesson: mapToLessonWithProgress(lesson),
          course: lesson.course,
          nextLesson: nextLessonData,
          prevLesson: prevLessonData,
          totalLessonsInCourse: courseLessons.length,
          currentLessonNumber: currentIndex + 1,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Get next recommended lesson
  getNextLesson: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Find user's learning path
      const path = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        include: {
          progress: {
            include: { lesson: true },
          },
        },
      });

      if (path) {
        // Find first IN_PROGRESS lesson
        const inProgress = path.progress.find((p) => p.status === 'IN_PROGRESS');
        if (inProgress) {
          const l = inProgress.lesson;
          return {
            id: l.id,
            courseId: l.courseId,
            title: l.title,
            description: l.description,
            videoUrl: l.videoUrl || '',
            videoId: l.videoId,
            duration: l.duration || 0,
            order: l.order,
            skillCategory: l.skillCategory,
            skillLevel: l.skillLevel,
            status: 'IN_PROGRESS' as const,
            watchedPercent: inProgress.watchedPercent,
          } satisfies LessonWithProgress;
        }

        // Find first NOT_STARTED lesson (not in progress records)
        const completedOrInProgress = new Set(path.progress.map((p) => p.lessonId));
        const nextLesson = await ctx.prisma.lesson.findFirst({
          where: { id: { notIn: Array.from(completedOrInProgress) } },
          orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
        });

        if (nextLesson) {
          return {
            id: nextLesson.id,
            courseId: nextLesson.courseId,
            title: nextLesson.title,
            description: nextLesson.description,
            videoUrl: nextLesson.videoUrl || '',
            videoId: nextLesson.videoId,
            duration: nextLesson.duration || 0,
            order: nextLesson.order,
            skillCategory: nextLesson.skillCategory,
            skillLevel: nextLesson.skillLevel,
            status: 'NOT_STARTED' as const,
            watchedPercent: 0,
          } satisfies LessonWithProgress;
        }
      }

      // No path — suggest first lesson of first course
      const firstLesson = await ctx.prisma.lesson.findFirst({
        orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
      });

      if (!firstLesson) return null;

      return {
        id: firstLesson.id,
        courseId: firstLesson.courseId,
        title: firstLesson.title,
        description: firstLesson.description,
        videoUrl: firstLesson.videoUrl || '',
        videoId: firstLesson.videoId,
        duration: firstLesson.duration || 0,
        order: firstLesson.order,
        skillCategory: firstLesson.skillCategory,
        skillLevel: firstLesson.skillLevel,
        status: 'NOT_STARTED' as const,
        watchedPercent: 0,
      } satisfies LessonWithProgress;
    } catch (error) {
      handleDatabaseError(error);
    }
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
      try {
        // Ensure user profile exists
        await ensureUserProfile(ctx.prisma, ctx.user);

        // Auto-create LearningPath if not exists
        const path = await ctx.prisma.learningPath.upsert({
          where: { userId: ctx.user.id },
          update: {},
          create: {
            userId: ctx.user.id,
            lessons: [],
          },
        });

        const status = input.watchedPercent >= 90 ? 'COMPLETED' : 'IN_PROGRESS';
        const completedAt = status === 'COMPLETED' ? new Date() : null;

        const progress = await ctx.prisma.lessonProgress.upsert({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          update: {
            watchedPercent: input.watchedPercent,
            status,
            completedAt,
          },
          create: {
            pathId: path.id,
            lessonId: input.lessonId,
            watchedPercent: input.watchedPercent,
            status,
            completedAt,
          },
        });

        return {
          lessonId: input.lessonId,
          status: progress.status,
          watchedPercent: progress.watchedPercent,
          completedAt: progress.completedAt,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Mark lesson as completed
  completeLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Ensure user profile exists
        await ensureUserProfile(ctx.prisma, ctx.user);

        // Auto-create LearningPath if not exists
        const path = await ctx.prisma.learningPath.upsert({
          where: { userId: ctx.user.id },
          update: {},
          create: {
            userId: ctx.user.id,
            lessons: [],
          },
        });

        const progress = await ctx.prisma.lessonProgress.upsert({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          update: {
            watchedPercent: 100,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
          create: {
            pathId: path.id,
            lessonId: input.lessonId,
            watchedPercent: 100,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        return {
          lessonId: input.lessonId,
          status: progress.status as 'COMPLETED',
          watchedPercent: 100,
          completedAt: progress.completedAt,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),
});
