/**
 * Typed database error handling with Supabase 521 (paused) detection.
 *
 * Wraps Prisma/Supabase errors into TRPCError with descriptive messages.
 * No mock fallback — errors are surfaced to the client per user decision.
 */

import { TRPCError } from '@trpc/server';
import { Prisma } from '@mpstats/db';

/**
 * Handle a database error by throwing a typed TRPCError.
 * Distinguishes Supabase 521 (free tier paused) from generic DB errors.
 */
export function handleDatabaseError(error: unknown): never {
  // Supabase free tier paused (521)
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Error && error.message.includes('521'))
  ) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'DATABASE_UNAVAILABLE',
      cause: error,
    });
  }

  // Known Prisma errors (constraint violation, not found, etc.)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `DATABASE_ERROR: ${prismaError.code}`,
      cause: error,
    });
  }

  // Unknown error
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected database error',
    cause: error,
  });
}

/**
 * Check if an error message indicates database is unavailable (Supabase paused).
 */
export function isDatabaseUnavailable(errorMessage: string): boolean {
  return errorMessage === 'DATABASE_UNAVAILABLE';
}

/**
 * Check if an error indicates Supabase free tier is paused.
 */
export function isSupabasePaused(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('521') || error.message.includes('Web server is down'))
  );
}
