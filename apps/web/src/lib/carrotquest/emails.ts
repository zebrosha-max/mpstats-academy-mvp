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

    await cq.trackEvent(userId, 'pa_payment_success', {
      pa_amount: data.amount,
      pa_course_name: data.courseName ?? '',
      pa_period_end: data.periodEnd.toISOString(),
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

    await cq.trackEvent(userId, 'pa_payment_failed', {
      pa_course_name: data.courseName ?? '',
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

    await cq.trackEvent(userId, 'pa_subscription_cancelled', {
      pa_course_name: data.courseName ?? '',
      pa_access_until: data.accessUntil.toISOString(),
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

    // Set user identity in CQ so they're searchable by email/name
    await cq.setUserProps(userId, {
      '$email': data.email,
      '$name': data.name,
    });

    await cq.trackEvent(userId, 'pa_registration_completed', {
      pa_name: data.name,
      email: data.email,
    });

    console.log(`[Email] Welcome event + props sent for user ${userId}`);
  } catch (error) {
    console.error('[Email] sendWelcomeEmail error:', error);
  }
}

export async function sendSubscriptionExpiringEmail(
  userId: string,
  data: { courseName?: string; periodEnd: Date },
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    await cq.trackEvent(userId, 'pa_subscription_expiring', {
      pa_course_name: data.courseName ?? '',
      pa_period_end: data.periodEnd.toISOString(),
    });

    console.log(`[Email] Subscription expiring event sent for user ${userId}`);
  } catch (error) {
    console.error('[Email] sendSubscriptionExpiringEmail error:', error);
  }
}

export async function sendInactiveEmail(
  userId: string,
  days: 7 | 14 | 30,
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    const eventMap = { 7: 'pa_inactive_7', 14: 'pa_inactive_14', 30: 'pa_inactive_30' } as const;
    await cq.trackEvent(userId, eventMap[days], {});

    console.log(`[Email] Inactive ${days}d event sent for user ${userId}`);
  } catch (error) {
    console.error(`[Email] sendInactiveEmail(${days}d) error:`, error);
  }
}

