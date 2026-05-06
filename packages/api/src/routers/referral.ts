import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc';
import { prisma } from '@mpstats/db/client';
import { Prisma } from '@mpstats/db';
import { ReferralStatus } from '@mpstats/db';
import {
  activatePackage,
  PackageActivationError,
} from '../services/referral/activation';
import { isValidRefCodeShape } from '../services/referral/attribution';

export const referralRouter = router({
  getMyState: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [profile, totalReferred, totalConverted, pendingPackages, usedPackages] =
      await Promise.all([
        prisma.userProfile.findUnique({
          where: { id: userId },
          select: { referralCode: true },
        }),
        prisma.referral.count({ where: { referrerUserId: userId } }),
        prisma.referral.count({
          where: { referrerUserId: userId, status: 'CONVERTED' },
        }),
        prisma.referralBonusPackage.findMany({
          where: { ownerUserId: userId, status: 'PENDING' },
          orderBy: { issuedAt: 'desc' },
          select: { id: true, days: true, issuedAt: true, status: true, usedAt: true },
        }),
        prisma.referralBonusPackage.findMany({
          where: { ownerUserId: userId, status: 'USED' },
          orderBy: { usedAt: 'desc' },
          take: 10,
          select: { id: true, days: true, issuedAt: true, status: true, usedAt: true },
        }),
      ]);

    return {
      referralCode: profile?.referralCode ?? null,
      totalReferred,
      totalConverted,
      pendingPackages,
      usedPackages,
    };
  }),

  // PUBLIC — used by /register page where user is not yet authenticated.
  validateCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      if (!isValidRefCodeShape(input.code)) {
        return { valid: false, referrerName: null };
      }
      const referrer = await prisma.userProfile.findUnique({
        where: { referralCode: input.code },
        select: { id: true, name: true },
      });
      if (!referrer) {
        return { valid: false, referrerName: null };
      }
      return { valid: true, referrerName: referrer.name };
    }),

  /**
   * Phase 53B: list referrals for admin moderation UI.
   * Default sort: createdAt DESC. Default filter: PENDING_REVIEW.
   * Search matches referrer or referred user name/email (case-insensitive contains).
   */
  adminList: adminProcedure
    .input(
      z.object({
        status: z.nativeEnum(ReferralStatus).nullable().optional(),
        search: z.string().trim().min(1).max(100).optional(),
        take: z.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const where: Prisma.ReferralWhereInput = {};
      if (input.status !== null && input.status !== undefined) {
        where.status = input.status;
      }
      if (input.search) {
        const q = input.search;
        where.OR = [
          { referrer: { name: { contains: q, mode: 'insensitive' } } },
          { referred: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }
      const rows = await prisma.referral.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: input.take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        include: {
          referrer: { select: { id: true, name: true } },
          referred: { select: { id: true, name: true } },
          bonusPackage: { select: { id: true, status: true, days: true } },
          reviewedBy: { select: { id: true, name: true } },
        },
      });
      const hasMore = rows.length > input.take;
      const items = hasMore ? rows.slice(0, -1) : rows;
      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      };
    }),

  /**
   * Aggregate count by status — for filter chip badges.
   */
  adminStatusCounts: adminProcedure.query(async () => {
    const groups = await prisma.referral.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Record<
      ReferralStatus,
      number
    >;
  }),

  activatePackage: protectedProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await activatePackage(input.packageId, ctx.user.id);
        return { ok: true };
      } catch (err) {
        if (err instanceof PackageActivationError) {
          const map: Record<string, 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'> = {
            NOT_FOUND: 'NOT_FOUND',
            NOT_OWNER: 'FORBIDDEN',
            NOT_PENDING: 'BAD_REQUEST',
          };
          throw new TRPCError({
            code: map[err.code] ?? 'BAD_REQUEST',
            message: err.message,
          });
        }
        throw err;
      }
    }),
});
