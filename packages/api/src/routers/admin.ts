/**
 * Admin Router — Superuser-only procedures for MPSTATS Academy admin panel.
 *
 * All procedures use adminProcedure (requires isAdmin=true).
 * Endpoints: getDashboardStats, getUsers, toggleUserField, getCourses, updateLessonOrder,
 *   moveCourseToPosition, updateCourseTitle, updateLessonTitle
 */

import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { handleDatabaseError } from '../utils/db-errors';
import { refreshBankForCategory } from '../utils/question-bank';
import { createClient } from '@supabase/supabase-js';
import type { SkillCategory } from '@mpstats/shared';

// Lazy-initialized Supabase admin client (service role) for email lookups
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured — email search unavailable');
    }
    supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabaseAdmin;
}

export const adminRouter = router({
  /**
   * Dashboard stats: total users, completed diagnostics, total lessons, recent registrations (7d).
   */
  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [totalUsers, totalDiagnostics, totalLessons, recentRegistrations] =
        await Promise.all([
          ctx.prisma.userProfile.count(),
          ctx.prisma.diagnosticSession.count({ where: { status: 'COMPLETED' } }),
          ctx.prisma.lesson.count(),
          ctx.prisma.userProfile.count({
            where: { createdAt: { gte: sevenDaysAgo } },
          }),
        ]);

      return { totalUsers, totalDiagnostics, totalLessons, recentRegistrations };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Recent activity: last registrations and completed diagnostics (last 7 days).
   */
  getRecentActivity: adminProcedure.query(async ({ ctx }) => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const [recentUsers, recentDiagnostics] = await Promise.all([
        ctx.prisma.userProfile.findMany({
          where: { createdAt: { gte: sevenDaysAgo } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, name: true, createdAt: true },
        }),
        ctx.prisma.diagnosticSession.findMany({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: sevenDaysAgo },
          },
          orderBy: { completedAt: 'desc' },
          take: 10,
          include: {
            user: { select: { name: true } },
          },
        }),
      ]);

      // Merge and sort by date
      const events = [
        ...recentUsers.map((u) => ({
          type: 'registration' as const,
          userName: u.name || 'Unknown',
          date: u.createdAt,
        })),
        ...recentDiagnostics.map((d) => ({
          type: 'diagnostic' as const,
          userName: d.user.name || 'Unknown',
          date: d.completedAt || d.startedAt,
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

      return events;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Analytics: user growth and diagnostic activity grouped by day for a given period.
   */
  getAnalytics: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(90).default(7) }))
    .query(async ({ ctx, input }) => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.days);

        // Generate date range
        const dates: string[] = [];
        for (let i = 0; i < input.days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - input.days + i + 1);
          dates.push(d.toISOString().split('T')[0]);
        }

        // Query registrations
        const users = await ctx.prisma.userProfile.findMany({
          where: { createdAt: { gte: startDate } },
          select: { createdAt: true },
        });

        // Query completed diagnostics
        const diagnostics = await ctx.prisma.diagnosticSession.findMany({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: startDate },
          },
          select: { completedAt: true },
        });

        // Group by date
        const userGrowthMap = new Map<string, number>();
        const activityMap = new Map<string, number>();
        dates.forEach((d) => {
          userGrowthMap.set(d, 0);
          activityMap.set(d, 0);
        });

        users.forEach((u) => {
          const key = u.createdAt.toISOString().split('T')[0];
          if (userGrowthMap.has(key)) {
            userGrowthMap.set(key, (userGrowthMap.get(key) || 0) + 1);
          }
        });

        diagnostics.forEach((d) => {
          if (d.completedAt) {
            const key = d.completedAt.toISOString().split('T')[0];
            if (activityMap.has(key)) {
              activityMap.set(key, (activityMap.get(key) || 0) + 1);
            }
          }
        });

        const userGrowth = dates.map((date) => ({ date, count: userGrowthMap.get(date) || 0 }));
        const activity = dates.map((date) => ({ date, count: activityMap.get(date) || 0 }));

        return { userGrowth, activity };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Paginated user list with search by name AND email.
   * Email search uses Supabase Admin API (auth.admin.listUsers) since emails
   * live in auth.users, not in UserProfile.
   */
  getUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { search, page, limit } = input;
        const skip = (page - 1) * limit;

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let where: any = {};

        if (search && search.trim().length > 0) {
          const term = search.trim();

          // 1. Search auth.users by email via Supabase Admin API
          let matchedAuthUserIds: string[] = [];
          try {
            const admin = getSupabaseAdmin();
            const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
            if (data?.users) {
              matchedAuthUserIds = data.users
                .filter((u) => u.email?.toLowerCase().includes(term.toLowerCase()))
                .map((u) => u.id);
            }
          } catch {
            // Service role key missing or API error — fall back to name-only search
          }

          // 2. Combine name search OR matched auth user IDs
          const conditions = [
            { name: { contains: term, mode: 'insensitive' as const } },
          ];
          if (matchedAuthUserIds.length > 0) {
            conditions.push({ id: { in: matchedAuthUserIds } } as any);
          }
          where = { OR: conditions };
        }

        const [users, totalCount] = await Promise.all([
          ctx.prisma.userProfile.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              _count: { select: { diagnosticSessions: true } },
            },
          }),
          ctx.prisma.userProfile.count({ where }),
        ]);

        // Fetch emails from Supabase auth.users for display
        let emailMap = new Map<string, string>();
        try {
          const admin = getSupabaseAdmin();
          const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
          if (data?.users) {
            data.users.forEach((u) => {
              if (u.email) emailMap.set(u.id, u.email);
            });
          }
        } catch {
          // Service role key missing — emails won't be shown
        }

        const usersWithEmail = users.map((u) => ({
          ...u,
          email: emailMap.get(u.id) || null,
        }));

        return {
          users: usersWithEmail,
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Toggle a boolean field on UserProfile.
   * Currently supports: isAdmin.
   * TODO: Add isActive support when field is used in access control.
   */
  toggleUserField: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        field: z.enum(['isAdmin', 'isActive']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { userId, field } = input;

        const profile = await ctx.prisma.userProfile.findUnique({
          where: { id: userId },
          select: { [field]: true },
        });

        if (!profile) {
          throw new Error(`User ${userId} not found`);
        }

        const currentValue = (profile as unknown as Record<string, boolean>)[field];

        const updated = await ctx.prisma.userProfile.update({
          where: { id: userId },
          data: { [field]: !currentValue },
        });

        return updated;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * List all courses with lesson count and content chunk count.
   */
  getCourses: adminProcedure.query(async ({ ctx }) => {
    try {
      const courses = await ctx.prisma.course.findMany({
        orderBy: { order: 'asc' },
        include: {
          _count: { select: { lessons: true } },
        },
      });

      // Get content chunk counts per course (via lesson_id prefix matching)
      const coursesWithChunks = await Promise.all(
        courses.map(async (course) => {
          const chunkCount = await ctx.prisma.contentChunk.count({
            where: { lessonId: { startsWith: course.id } },
          });
          return {
            ...course,
            chunkCount,
          };
        }),
      );

      return coursesWithChunks;
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Get lessons for a specific course (used by CourseManager accordion).
   */
  getCourseLessons: adminProcedure
    .input(z.object({ courseId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const lessons = await ctx.prisma.lesson.findMany({
          where: { courseId: input.courseId },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            skillCategory: true,
            videoId: true,
            duration: true,
          },
        });
        return lessons;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Move a lesson to a specific position within its course.
   * Shifts all lessons between old and new positions accordingly.
   */
  moveLessonToPosition: adminProcedure
    .input(
      z.object({
        lessonId: z.string(),
        targetPosition: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const lesson = await ctx.prisma.lesson.findUnique({
          where: { id: input.lessonId },
          select: { id: true, courseId: true, order: true },
        });
        if (!lesson) throw new Error('Lesson not found');

        const oldPos = lesson.order;
        const newPos = input.targetPosition;
        if (oldPos === newPos) return lesson;

        // Get all lessons in the course sorted by order
        const allLessons = await ctx.prisma.lesson.findMany({
          where: { courseId: lesson.courseId },
          orderBy: { order: 'asc' },
          select: { id: true, order: true },
        });

        // Clamp target to valid range
        const maxPos = allLessons.length;
        const clampedNew = Math.min(Math.max(newPos, 1), maxPos);

        // Shift lessons between old and new positions
        if (oldPos < clampedNew) {
          // Moving down: shift lessons in (oldPos, clampedNew] up by 1
          await ctx.prisma.lesson.updateMany({
            where: {
              courseId: lesson.courseId,
              order: { gt: oldPos, lte: clampedNew },
            },
            data: { order: { decrement: 1 } },
          });
        } else {
          // Moving up: shift lessons in [clampedNew, oldPos) down by 1
          await ctx.prisma.lesson.updateMany({
            where: {
              courseId: lesson.courseId,
              order: { gte: clampedNew, lt: oldPos },
            },
            data: { order: { increment: 1 } },
          });
        }

        // Place the lesson at target position
        const updated = await ctx.prisma.lesson.update({
          where: { id: input.lessonId },
          data: { order: clampedNew },
        });

        return updated;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Move a course to a specific position among all courses.
   * Shifts all courses between old and new positions accordingly.
   */
  moveCourseToPosition: adminProcedure
    .input(
      z.object({
        courseId: z.string(),
        targetPosition: z.number().int().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId },
          select: { id: true, order: true },
        });
        if (!course) throw new Error('Course not found');

        const oldPos = course.order;
        const newPos = input.targetPosition;
        if (oldPos === newPos) return course;

        // Get all courses sorted by order
        const allCourses = await ctx.prisma.course.findMany({
          orderBy: { order: 'asc' },
          select: { id: true, order: true },
        });

        // Clamp target to valid range
        const maxPos = allCourses.length;
        const clampedNew = Math.min(Math.max(newPos, 1), maxPos);

        // Shift courses between old and new positions
        if (oldPos < clampedNew) {
          // Moving down: shift courses in (oldPos, clampedNew] up by 1
          await ctx.prisma.course.updateMany({
            where: {
              order: { gt: oldPos, lte: clampedNew },
            },
            data: { order: { decrement: 1 } },
          });
        } else {
          // Moving up: shift courses in [clampedNew, oldPos) down by 1
          await ctx.prisma.course.updateMany({
            where: {
              order: { gte: clampedNew, lt: oldPos },
            },
            data: { order: { increment: 1 } },
          });
        }

        // Place the course at target position
        const updated = await ctx.prisma.course.update({
          where: { id: input.courseId },
          data: { order: clampedNew },
        });

        return updated;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Update a course title.
   */
  updateCourseTitle: adminProcedure
    .input(
      z.object({
        courseId: z.string(),
        title: z.string().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await ctx.prisma.course.update({
          where: { id: input.courseId },
          data: { title: input.title },
        });
        return updated;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Update a lesson title.
   */
  updateLessonTitle: adminProcedure
    .input(
      z.object({
        lessonId: z.string(),
        title: z.string().min(1).max(300),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await ctx.prisma.lesson.update({
          where: { id: input.lessonId },
          data: { title: input.title },
        });
        return updated;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Watch engagement stats: avg watch %, total sessions, completion rate,
   * per-course breakdown, and top 5 active users.
   */
  getWatchStats: adminProcedure.query(async ({ ctx }) => {
    try {
      // All lesson progress records with any watch activity
      const allProgress = await ctx.prisma.lessonProgress.findMany({
        where: { watchedPercent: { gt: 0 } },
        include: {
          lesson: {
            include: { course: { select: { id: true, title: true } } },
          },
          path: { select: { userId: true } },
        },
      });

      // KPI: avg watch percent
      const avgWatchPercent = allProgress.length > 0
        ? Math.round(allProgress.reduce((sum, p) => sum + p.watchedPercent, 0) / allProgress.length)
        : 0;

      // KPI: total watch sessions
      const totalWatchSessions = allProgress.length;

      // KPI: completion rate (started -> completed)
      const completedCount = allProgress.filter((p) => p.status === 'COMPLETED').length;
      const completionRate = totalWatchSessions > 0
        ? Math.round((completedCount / totalWatchSessions) * 100)
        : 0;

      // Per-course engagement
      const courseMap = new Map<string, {
        courseId: string;
        courseTitle: string;
        totalPercent: number;
        startedCount: number;
        completedCount: number;
      }>();

      for (const p of allProgress) {
        const courseId = p.lesson.course.id;
        const courseTitle = p.lesson.course.title;
        const existing = courseMap.get(courseId) || {
          courseId,
          courseTitle,
          totalPercent: 0,
          startedCount: 0,
          completedCount: 0,
        };
        existing.totalPercent += p.watchedPercent;
        existing.startedCount += 1;
        if (p.status === 'COMPLETED') existing.completedCount += 1;
        courseMap.set(courseId, existing);
      }

      const courseEngagement = Array.from(courseMap.values()).map((c) => ({
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        avgPercent: Math.round(c.totalPercent / c.startedCount),
        startedCount: c.startedCount,
        completedCount: c.completedCount,
      }));

      // Top 5 active users
      const userMap = new Map<string, { userId: string; lessonsWatched: number; totalPercent: number }>();
      for (const p of allProgress) {
        const userId = p.path.userId;
        const existing = userMap.get(userId) || { userId, lessonsWatched: 0, totalPercent: 0 };
        existing.lessonsWatched += 1;
        existing.totalPercent += p.watchedPercent;
        userMap.set(userId, existing);
      }

      const topUserIds = Array.from(userMap.values())
        .sort((a, b) => b.lessonsWatched - a.lessonsWatched)
        .slice(0, 5);

      // Fetch user names
      const userProfiles = topUserIds.length > 0
        ? await ctx.prisma.userProfile.findMany({
            where: { id: { in: topUserIds.map((u) => u.userId) } },
            select: { id: true, name: true },
          })
        : [];

      const nameMap = new Map(userProfiles.map((u) => [u.id, u.name]));

      const topActiveUsers = topUserIds.map((u) => ({
        userId: u.userId,
        name: nameMap.get(u.userId) || 'Unknown',
        lessonsWatched: u.lessonsWatched,
        avgPercent: Math.round(u.totalPercent / u.lessonsWatched),
      }));

      return {
        avgWatchPercent,
        totalWatchSessions,
        completionRate,
        courseEngagement,
        topActiveUsers,
      };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  /**
   * Update lesson display order.
   */
  updateLessonOrder: adminProcedure
    .input(
      z.object({
        lessonId: z.string(),
        newOrder: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await ctx.prisma.lesson.update({
          where: { id: input.lessonId },
          data: { order: input.newOrder },
        });
        return updated;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  /**
   * Force-refresh the AI question bank for all categories.
   * Generates ~30 questions per category via LLM + RAG, stores in DB with 7-day TTL.
   */
  refreshQuestionBank: adminProcedure.mutation(async ({ ctx }) => {
    const categories: SkillCategory[] = [
      'ANALYTICS',
      'MARKETING',
      'CONTENT',
      'OPERATIONS',
      'FINANCE',
    ];
    const results: Record<string, { success: boolean; count: number }> = {};

    for (const category of categories) {
      try {
        await refreshBankForCategory(ctx.prisma, category);
        const bank = await ctx.prisma.questionBank.findUnique({
          where: { skillCategory: category },
        });
        const count = bank ? (bank.questions as any[]).length : 0;
        results[category] = { success: true, count };
      } catch (err) {
        console.error(`[refreshQuestionBank] Failed for ${category}:`, err);
        results[category] = { success: false, count: 0 };
      }
    }

    return results;
  }),
});
