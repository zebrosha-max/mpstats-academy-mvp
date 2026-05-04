import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { prisma } from '@mpstats/db/client';
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
