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

      return courses.map((course) => {
        const lessonsWithVideo = course.lessons.filter((l) => l.videoId != null);
        const watchedPercentSum = lessonsWithVideo.reduce((sum, l) => {
          const percent = l.progress[0]?.watchedPercent || 0;
          return sum + percent;
        }, 0);
        const progressPercent = lessonsWithVideo.length > 0
          ? Math.round(watchedPercentSum / lessonsWithVideo.length)
          : 0;

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
        progressPercent,
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
      });
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

        const lessonsWithVideo = course.lessons.filter((l) => l.videoId != null);
        const watchedPercentSum = lessonsWithVideo.reduce((sum, l) => {
          const percent = l.progress[0]?.watchedPercent || 0;
          return sum + percent;
        }, 0);
        const progressPercent = lessonsWithVideo.length > 0
          ? Math.round(watchedPercentSum / lessonsWithVideo.length)
          : 0;

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
          progressPercent,
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

  // Get recommended learning path (generated on diagnostic completion)
  getRecommendedPath: protectedProcedure.query(async ({ ctx }) => {
    try {
      const path = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        select: { lessons: true, generatedAt: true },
      });

      if (!path || !Array.isArray(path.lessons) || path.lessons.length === 0) {
        return null;
      }

      // Fetch full lesson data for recommended IDs with progress
      const recommendedIds = path.lessons as string[];
      const lessons = await ctx.prisma.lesson.findMany({
        where: { id: { in: recommendedIds } },
        include: {
          progress: {
            where: { path: { userId: ctx.user.id } },
          },
          course: { select: { title: true } },
        },
        orderBy: { order: 'asc' },
      });

      // Preserve the recommended order (by weakness priority)
      const lessonMap = new Map(lessons.map((l) => [l.id, l]));
      const orderedLessons = recommendedIds
        .map((id) => lessonMap.get(id))
        .filter(Boolean)
        .map((l) => ({
          id: l!.id,
          courseId: l!.courseId,
          courseName: l!.course.title,
          title: l!.title,
          description: l!.description,
          videoUrl: l!.videoUrl || '',
          videoId: l!.videoId,
          duration: l!.duration || 0,
          order: l!.order,
          skillCategory: l!.skillCategory,
          skillLevel: l!.skillLevel,
          status: (l!.progress[0]?.status || 'NOT_STARTED') as string,
          watchedPercent: l!.progress[0]?.watchedPercent || 0,
        }));

      const completedCount = orderedLessons.filter((l) => l.status === 'COMPLETED').length;

      return {
        generatedAt: path.generatedAt,
        lessons: orderedLessons,
        totalLessons: orderedLessons.length,
        completedLessons: completedCount,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // Get lesson details with progress (single DB query via course relation)
  getLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: input.lessonId },
          include: {
            course: {
              include: {
                lessons: {
                  orderBy: { order: 'asc' },
                  select: { id: true, title: true, order: true },
                },
              },
            },
            progress: {
              where: { path: { userId: ctx.user.id } },
            },
          },
        });

        if (!lesson) return null;

        const courseLessons = lesson.course.lessons;
        const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id);

        const nextLessonNav =
          currentIndex < courseLessons.length - 1
            ? { id: courseLessons[currentIndex + 1].id, title: courseLessons[currentIndex + 1].title }
            : null;

        const prevLessonNav =
          currentIndex > 0
            ? { id: courseLessons[currentIndex - 1].id, title: courseLessons[currentIndex - 1].title }
            : null;

        return {
          lesson: {
            id: lesson.id,
            courseId: lesson.courseId,
            title: lesson.title,
            description: lesson.description,
            videoUrl: lesson.videoUrl || '',
            videoId: lesson.videoId,
            duration: lesson.duration || 0,
            order: lesson.order,
            skillCategory: lesson.skillCategory,
            skillLevel: lesson.skillLevel,
            status: lesson.progress[0]?.status || 'NOT_STARTED',
            watchedPercent: lesson.progress[0]?.watchedPercent || 0,
          } satisfies LessonWithProgress,
          course: { id: lesson.course.id, title: lesson.course.title, slug: lesson.course.slug },
          nextLesson: nextLessonNav,
          prevLesson: prevLessonNav,
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

  // Get watch progress for a lesson (used to resume video)
  getWatchProgress: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const path = await ctx.prisma.learningPath.findUnique({
          where: { userId: ctx.user.id },
        });

        if (!path) return null;

        const progress = await ctx.prisma.lessonProgress.findUnique({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          select: {
            lastPosition: true,
            watchedPercent: true,
            status: true,
          },
        });

        return progress ?? null;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Save watch progress from video playback (auto-fires during watching)
  saveWatchProgress: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        position: z.number().min(0),
        duration: z.number().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Ignore saves where position < 5 seconds (prevents noise from page loads)
        if (input.position < 5) {
          return { lessonId: input.lessonId, status: 'NOT_STARTED' as const, watchedPercent: 0, lastPosition: 0 };
        }

        const watchedPercent = Math.min(100, Math.max(0, Math.round((input.position / input.duration) * 100)));

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

        const status = watchedPercent >= 90 ? 'COMPLETED' : 'IN_PROGRESS';
        const completedAt = status === 'COMPLETED' ? new Date() : undefined;

        const progress = await ctx.prisma.lessonProgress.upsert({
          where: {
            pathId_lessonId: {
              pathId: path.id,
              lessonId: input.lessonId,
            },
          },
          update: {
            lastPosition: Math.round(input.position),
            watchedPercent,
            videoDuration: Math.round(input.duration),
            status,
            ...(completedAt ? { completedAt } : {}),
          },
          create: {
            pathId: path.id,
            lessonId: input.lessonId,
            lastPosition: Math.round(input.position),
            watchedPercent,
            videoDuration: Math.round(input.duration),
            status,
            completedAt: completedAt ?? null,
          },
        });

        return {
          lessonId: input.lessonId,
          status: progress.status,
          watchedPercent: progress.watchedPercent,
          lastPosition: progress.lastPosition,
        };
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
