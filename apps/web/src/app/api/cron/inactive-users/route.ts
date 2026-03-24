import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@mpstats/db/client';
import { sendInactiveEmail } from '@/lib/carrotquest/emails';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint: send inactivity notifications for users inactive 7/14/30 days.
 * Uses 24h sliding windows per threshold for idempotency — no extra DB table needed.
 * Protected by CRON_SECRET Bearer token.
 */

// Thresholds in days — each checked independently
const THRESHOLDS = [
  { days: 7 as const, windowStart: 7, windowEnd: 8 },
  { days: 14 as const, windowStart: 14, windowEnd: 15 },
  { days: 30 as const, windowStart: 30, windowEnd: 31 },
];

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const results: Record<string, number> = {};

    for (const threshold of THRESHOLDS) {
      // Window: users whose lastActiveAt is between (now - windowEnd days) and (now - windowStart days)
      // This 24h window ensures each user gets exactly one notification per threshold
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() - threshold.windowEnd);
      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() - threshold.windowStart);

      const inactiveUsers = await prisma.userProfile.findMany({
        where: {
          lastActiveAt: {
            gte: windowStart,
            lt: windowEnd,
          },
          isActive: true,
        },
        select: { id: true },
      });

      let sent = 0;
      for (const user of inactiveUsers) {
        await sendInactiveEmail(user.id, threshold.days);
        sent++;
      }

      results[`inactive_${threshold.days}`] = sent;
    }

    console.log(`[Cron] inactive-users:`, results);
    return NextResponse.json({ ok: true, ...results });
  } catch (error) {
    console.error('[Cron] inactive-users error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
