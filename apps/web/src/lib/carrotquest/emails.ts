import { cq } from './client';
import { prisma } from '@mpstats/db/client';

/**
 * Email helper functions for transactional notifications via Carrot Quest.
 *
 * Each function checks the `email_notifications_enabled` feature flag,
 * then fires a CQ event (fire-and-forget). Errors are logged, never thrown.
 */

// --- Feature flag cache (avoid DB query on every email) ---

let cachedEnabled: boolean | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function isEmailEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedEnabled !== null && now < cacheExpiry) {
    return cachedEnabled;
  }

  try {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: 'email_notifications_enabled' },
    });
    cachedEnabled = flag?.enabled ?? false;
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedEnabled;
  } catch (error) {
    console.error('[Email] Failed to check feature flag:', error);
    return false;
  }
}

// --- Email functions ---

export async function sendPaymentSuccessEmail(
  userId: string,
  data: { amount: number; courseName?: string; periodEnd: Date },
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    await cq.trackEvent(userId, 'Payment Success', {
      amount: data.amount,
      course_name: data.courseName ?? '',
      period_end: data.periodEnd.toISOString(),
    });

    console.log(`[Email] Payment success event sent for user ${userId}`);
  } catch (error) {
    console.error('[Email] sendPaymentSuccessEmail error:', error);
  }
}

export async function sendPaymentFailedEmail(
  userId: string,
  data: { courseName?: string },
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    await cq.trackEvent(userId, 'Payment Failed', {
      course_name: data.courseName ?? '',
    });

    console.log(`[Email] Payment failed event sent for user ${userId}`);
  } catch (error) {
    console.error('[Email] sendPaymentFailedEmail error:', error);
  }
}

export async function sendCancellationEmail(
  userId: string,
  data: { courseName?: string; accessUntil: Date },
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    await cq.trackEvent(userId, 'Subscription Cancelled', {
      course_name: data.courseName ?? '',
      access_until: data.accessUntil.toISOString(),
    });

    console.log(`[Email] Cancellation event sent for user ${userId}`);
  } catch (error) {
    console.error('[Email] sendCancellationEmail error:', error);
  }
}

export async function sendWelcomeEmail(
  userId: string,
  data: { name: string; email: string },
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    await cq.trackEvent(userId, 'User Registered', {
      name: data.name,
      email: data.email,
    });

    console.log(`[Email] Welcome event sent for user ${userId}`);
  } catch (error) {
    console.error('[Email] sendWelcomeEmail error:', error);
  }
}

