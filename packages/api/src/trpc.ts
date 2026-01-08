import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { User } from '@supabase/supabase-js';
import { prisma, type PrismaClient } from '@mpstats/db';

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
