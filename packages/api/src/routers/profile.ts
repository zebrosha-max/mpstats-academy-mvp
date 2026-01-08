import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { getMockDashboardData, MOCK_USER_STATS, MOCK_RECENT_ACTIVITY } from '../mocks/dashboard';
import { getLatestSkillProfile } from './diagnostic';
import type { DashboardData, SkillProfile, UserStats } from '@mpstats/shared';

export const profileRouter = router({
  // Get current user profile
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      const profile = await ctx.prisma.userProfile.findUnique({
        where: { id: ctx.user.id },
        include: { skillProfile: true },
      });

      if (profile) {
        return profile;
      }
    } catch {
      // DB not available, return mock
    }

    // Return profile with real skill data for this user (no fake data)
    const latestProfile = getLatestSkillProfile(ctx.user.id);
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.email?.split('@')[0] || 'Пользователь',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      skillProfile: latestProfile, // null if no diagnostic completed
    };
  }),

  // Get dashboard data
  getDashboard: protectedProcedure.query(async ({ ctx }): Promise<DashboardData> => {
    // Use real skill profile from last diagnostic if available for this user
    const realSkillProfile = getLatestSkillProfile(ctx.user.id);
    return getMockDashboardData(ctx.user.id, realSkillProfile);
  }),

  // Get skill profile for current user
  getSkillProfile: protectedProcedure.query(async ({ ctx }): Promise<SkillProfile | null> => {
    // First check for real session data for this user
    const latestProfile = getLatestSkillProfile(ctx.user.id);
    if (latestProfile) {
      return latestProfile;
    }

    // Then try DB
    try {
      const profile = await ctx.prisma.skillProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (profile) {
        return {
          analytics: profile.analytics,
          marketing: profile.marketing,
          content: profile.content,
          operations: profile.operations,
          finance: profile.finance,
        };
      }
    } catch {
      // DB not available
    }

    // No data available - return null (not mock data)
    return null;
  }),

  // Get user stats
  getStats: protectedProcedure.query(async (): Promise<UserStats> => {
    // TODO: Calculate from real data in Sprint 4
    return MOCK_USER_STATS;
  }),

  // Get recent activity
  getRecentActivity: protectedProcedure.query(async () => {
    // TODO: Fetch from real data in Sprint 4
    return MOCK_RECENT_ACTIVITY;
  }),

  // Update profile
  update: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        avatarUrl: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const profile = await ctx.prisma.userProfile.update({
          where: { id: ctx.user.id },
          data: input,
        });
        return profile;
      } catch {
        // Return mock on error
        return {
          id: ctx.user.id,
          name: input.name || 'Пользователь',
          avatarUrl: input.avatarUrl || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
    }),

  // Update notification settings (mock)
  updateSettings: protectedProcedure
    .input(
      z.object({
        emailNotifications: z.boolean().optional(),
        weeklyDigest: z.boolean().optional(),
        newLessonAlerts: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Mock - just return the settings
      return {
        emailNotifications: input.emailNotifications ?? true,
        weeklyDigest: input.weeklyDigest ?? true,
        newLessonAlerts: input.newLessonAlerts ?? false,
      };
    }),
});
