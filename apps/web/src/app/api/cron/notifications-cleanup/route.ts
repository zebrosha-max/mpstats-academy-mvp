import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';

export const dynamic = 'force-dynamic';

/**
 * Cron: Cleanup Notification rows per retention policy (Phase 51 req 11).
 *
 * Strategy:
 *  - Delete rows older than RETENTION_DAYS (90 days)
 *  - Hard cap PER_USER_CAP (500) rows per user — keep top N by createdAt DESC, delete rest
 *
 * Auth: CRON_SECRET Bearer header (401 if missing/wrong).
 * Schedule: GitHub Action 00:00 UTC daily (03:00 МСК).
 * Sentry checkin slug: 'notifications-cleanup', margin 180 min.
 *
 * GitHub Actions schedules drift 60-100min under load — wide margin avoids false alerts
 * (recurring lesson MAAL-PLATFORM-1).
 */

const RETENTION_DAYS = 90;
const PER_USER_CAP = 500;

async function handle(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn(
    {
      monitorSlug: 'notifications-cleanup',
      status: 'in_progress',
    },
    {
      schedule: { type: 'crontab', value: '0 0 * * *' }, // 00:00 UTC = 03:00 МСК
      checkinMargin: 180,
      maxRuntime: 30,
      timezone: 'UTC',
    },
  );

  try {
    // 1) Delete rows older than RETENTION_DAYS days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const oldDeleted = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    // 2) Hard cap PER_USER_CAP rows per user — delete extras (raw SQL для эффективности).
    //    Prisma не поддерживает window functions через query API; raw SQL необходим.
    //    Table name "Notification" — Postgres case-sensitive, обязательно в кавычках.
    //    PER_USER_CAP — number, безопасно биндится через Prisma template literal.
    const overflowDeleted: number = await prisma.$executeRaw`
      DELETE FROM "Notification"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) AS rn
          FROM "Notification"
        ) ranked
        WHERE rn > ${PER_USER_CAP}
      )
    `;

    console.log(
      `[notifications-cleanup] retention=${oldDeleted.count} overflow=${overflowDeleted}`,
    );

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'notifications-cleanup',
      status: 'ok',
    });

    return NextResponse.json({
      ok: true,
      cleaned: { retention: oldDeleted.count, overflow: overflowDeleted },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: 'cron', stage: 'notifications-cleanup' },
    });
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'notifications-cleanup',
      status: 'error',
    });
    console.error('[notifications-cleanup] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
