import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { sendSubscriptionExpiringEmail } from '@/lib/carrotquest/emails';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint: check for ACTIVE subscriptions expiring in 2-3 days.
 * Uses a 24h window (2d..3d from now) for idempotency — safe to run multiple times per day.
 * Protected by CRON_SECRET Bearer token.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // NOTE: GitHub Actions scheduled workflows drift 60-100+ minutes from their
  // nominal time under load. The 180-minute margin absorbs that drift so
  // Sentry only alerts on real failures (captureCheckIn with status='error')
  // rather than on every scheduling delay.
  const checkInId = Sentry.captureCheckIn(
    {
      monitorSlug: 'check-subscriptions',
      status: 'in_progress',
    },
    {
      schedule: { type: 'crontab', value: '0 9 * * *' },
      checkinMargin: 180,
      maxRuntime: 60,
      timezone: 'Europe/Moscow',
    },
  );

  try {
    const now = new Date();
    const twoDaysFromNow = new Date(now);
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Find ACTIVE subscriptions expiring within the 24h window (2d..3d from now)
    const expiring = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: twoDaysFromNow,
          lt: threeDaysFromNow,
        },
      },
      include: { plan: true },
    });

    let sent = 0;
    for (const sub of expiring) {
      await sendSubscriptionExpiringEmail(sub.userId, {
        courseName: sub.plan.name,
        periodEnd: sub.currentPeriodEnd,
      });
      sent++;
    }

    console.log(`[Cron] check-subscriptions: ${sent}/${expiring.length} expiring notifications sent`);

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'check-subscriptions',
      status: 'ok',
    });

    return NextResponse.json({ ok: true, checked: expiring.length, sent });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'check-subscriptions',
      status: 'error',
    });
    console.error('[Cron] check-subscriptions error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
