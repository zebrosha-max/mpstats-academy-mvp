/**
 * Sliding window rate limiter middleware for tRPC
 *
 * Stores request timestamps per user+namespace in globalThis
 * for HMR persistence (same pattern as diagnostic.ts sessions).
 */

import { TRPCError } from '@trpc/server';
import { experimental_standaloneMiddleware } from '@trpc/server';
import type { Context } from '../trpc';

// Rate limit store: namespace:userId -> timestamp[]
const STORE_KEY = '__rateLimitStore';

function getStore(): Map<string, number[]> {
  if (!(globalThis as any)[STORE_KEY]) {
    (globalThis as any)[STORE_KEY] = new Map<string, number[]>();
  }
  return (globalThis as any)[STORE_KEY];
}

/**
 * Create a rate limit middleware for tRPC procedures
 *
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @param namespace - Namespace to separate different rate limits (e.g., 'ai', 'chat')
 */
export function createRateLimitMiddleware(
  maxRequests: number,
  windowMs: number,
  namespace: string
) {
  return experimental_standaloneMiddleware<{ ctx: Context }>().create(
    async ({ ctx, next }) => {
      const userId = ctx.user?.id;
      if (!userId) {
        // Should not happen if used after protectedProcedure, but guard anyway
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const store = getStore();
      const key = `${namespace}:${userId}`;
      const now = Date.now();

      // Get existing timestamps, filter expired ones
      const timestamps = (store.get(key) || []).filter(
        (ts) => now - ts < windowMs
      );

      if (timestamps.length >= maxRequests) {
        // Calculate retry time based on oldest timestamp in window
        const oldestInWindow = timestamps[0]!;
        const retryAfterMs = oldestInWindow + windowMs - now;
        const retryAfterMin = Math.ceil(retryAfterMs / 60000);

        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: JSON.stringify({ retryAfterMs, retryAfterMin }),
        });
      }

      // Record this request
      timestamps.push(now);
      store.set(key, timestamps);

      return next({ ctx });
    }
  );
}
