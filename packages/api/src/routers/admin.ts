/**
 * Admin Router — Superuser-only procedures for MPSTATS Academy admin panel.
 *
 * All procedures use adminProcedure (requires isAdmin=true).
 * Endpoints: getDashboardStats, getUsers, toggleUserField, getCourses, updateLessonOrder
 */

import { z } from 'zod';
import { router, adminProcedure } from '../trpc';
import { handleDatabaseError } from '../utils/db-errors';
import { createClient } from '@supabase/supabase-js';

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

        return {
          users,
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
});
