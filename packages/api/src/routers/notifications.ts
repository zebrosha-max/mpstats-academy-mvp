/**
 * Notifications Router — In-app notification center (Phase 51).
 *
 * Procedures (all protectedProcedure):
 * - list: Paginated notifications (cursor 20/page, filter all|unread)
 * - unreadCount: Lightweight COUNT for badge polling (uses lastNotificationsSeenAt)
 * - markRead: Mark single notification as read (ownership check)
 * - markAllRead: Mark all current user's notifications as read
 * - markSeen: Set UserProfile.lastNotificationsSeenAt = NOW (D-07 hybrid mark-as-read)
 * - getPreferences: Return all 7 NotificationType prefs with defaults if row missing
 * - updatePreference: Upsert (userId, type) with inApp/email patch
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { handleDatabaseError } from '../utils/db-errors';
import {
  ALL_NOTIFICATION_TYPES,
  DEFAULT_IN_APP_PREFS,
  type NotificationTypeName,
} from '@mpstats/shared';

const NOTIFICATIONS_PER_PAGE = 20;

const NotificationTypeEnum = z.enum(
  ALL_NOTIFICATION_TYPES as unknown as [NotificationTypeName, ...NotificationTypeName[]],
);

export const notificationsRouter = router({
  // ─── LIST ─────────────────────────────────────────────────────────────
  list: protectedProcedure
    .input(
      z.object({
        filter: z.enum(['all', 'unread']).default('all'),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { filter, cursor } = input;
        const where = {
          userId: ctx.user.id,
          ...(filter === 'unread' ? { readAt: null } : {}),
        };

        const [totalCount, items] = await Promise.all([
          ctx.prisma.notification.count({ where }),
          ctx.prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: NOTIFICATIONS_PER_PAGE,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          }),
        ]);

        const nextCursor =
          items.length === NOTIFICATIONS_PER_PAGE
            ? items[items.length - 1].id
            : null;

        return { items, nextCursor, totalCount };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // ─── UNREAD COUNT (badge polling, lightweight) ────────────────────────
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    try {
      const profile = await ctx.prisma.userProfile.findUnique({
        where: { id: ctx.user.id },
        select: { lastNotificationsSeenAt: true },
      });
      const seenAt = profile?.lastNotificationsSeenAt;

      const count = await ctx.prisma.notification.count({
        where: {
          userId: ctx.user.id,
          readAt: null,
          ...(seenAt ? { createdAt: { gt: seenAt } } : {}),
        },
      });
      return { count };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // ─── MARK READ (single, with ownership check) ─────────────────────────
  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const notif = await ctx.prisma.notification.findUnique({
          where: { id: input.notificationId },
          select: { userId: true, readAt: true },
        });

        if (!notif) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Notification not found',
          });
        }
        if (notif.userId !== ctx.user.id) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: "Cannot mark others' notifications as read",
          });
        }
        if (notif.readAt) return { alreadyRead: true };

        await ctx.prisma.notification.update({
          where: { id: input.notificationId },
          data: { readAt: new Date() },
        });
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),

  // ─── MARK ALL READ (current user's unread notifications) ──────────────
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const result = await ctx.prisma.notification.updateMany({
        where: { userId: ctx.user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return { count: result.count };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // ─── MARK SEEN (D-07: clears badge counter when dropdown opens) ───────
  markSeen: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.prisma.userProfile.update({
        where: { id: ctx.user.id },
        data: { lastNotificationsSeenAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // ─── GET PREFERENCES (returns all 7 types with defaults) ──────────────
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    try {
      const existing = await ctx.prisma.notificationPreference.findMany({
        where: { userId: ctx.user.id },
      });
      const map = new Map(existing.map((p) => [p.type, p]));

      return ALL_NOTIFICATION_TYPES.map((type) => {
        const found = map.get(type);
        if (found) return found;
        return {
          userId: ctx.user.id,
          type,
          inApp: DEFAULT_IN_APP_PREFS[type] ?? true,
          email: false,
        };
      });
    } catch (error) {
      handleDatabaseError(error);
    }
  }),

  // ─── UPDATE PREFERENCE (upsert by composite (userId, type)) ───────────
  updatePreference: protectedProcedure
    .input(
      z.object({
        type: NotificationTypeEnum,
        inApp: z.boolean().optional(),
        email: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { type, inApp, email } = input;

        // Resolve current values via existing or defaults to populate upsert
        const existing = await ctx.prisma.notificationPreference.findUnique({
          where: { userId_type: { userId: ctx.user.id, type } },
        });

        const nextInApp =
          inApp ?? existing?.inApp ?? (DEFAULT_IN_APP_PREFS[type] ?? true);
        const nextEmail = email ?? existing?.email ?? false;

        const upserted = await ctx.prisma.notificationPreference.upsert({
          where: { userId_type: { userId: ctx.user.id, type } },
          create: {
            userId: ctx.user.id,
            type,
            inApp: nextInApp,
            email: nextEmail,
          },
          update: {
            ...(inApp !== undefined ? { inApp } : {}),
            ...(email !== undefined ? { email } : {}),
          },
        });

        return upserted;
      } catch (error) {
        handleDatabaseError(error);
      }
    }),
});
