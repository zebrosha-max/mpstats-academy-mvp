import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { User } from '@supabase/supabase-js';
import { prisma, type PrismaClient } from '@mpstats/db';
import { createRateLimitMiddleware } from './middleware/rate-limit';

export interface Context {
  prisma: PrismaClient;
  user: User | null;
}

export const createTRPCContext = (user: User | null): Context => {
  return {
    prisma,
    user,
  };
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// Admin procedure — requires isAdmin=true in UserProfile
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const profile = await ctx.prisma.userProfile.findUnique({
    where: { id: ctx.user.id },
    select: { isAdmin: true },
  });

  if (!profile || profile.isAdmin !== true) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }

  return next({ ctx });
});

// AI procedures with rate limiting (built on top of protectedProcedure)
export const aiProcedure = protectedProcedure.use(
  createRateLimitMiddleware(50, 3600000, 'ai') // 50 req/hour
);

export const chatProcedure = protectedProcedure.use(
  createRateLimitMiddleware(20, 3600000, 'chat') // 20 req/hour
);
