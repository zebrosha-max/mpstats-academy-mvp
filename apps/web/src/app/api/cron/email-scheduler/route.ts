import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@mpstats/db/client';
import { cq } from '@/lib/carrotquest/client';

export const dynamic = 'force-dynamic';

/**
 * Scheduled email processing endpoint.
 * Called daily by GitHub Actions cron.
 *
 * Handles:
 * 1. Subscription expiry reminders (CANCELLED subs expiring in 3 days)
 * 2. Inactivity chain (7/14/30 days without lesson activity)
 *
 * Protected by CRON_SECRET Bearer token.
 * Deduplication relies on CQ triggered message "send once" setting.
 */
export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check feature flag
  try {
    const flag = await prisma.featureFlag.findUnique({
      where: { key: 'email_notifications_enabled' },
    });
    if (!flag?.enabled) {
      return NextResponse.json({ skipped: true, reason: 'Feature flag disabled' });
    }
  } catch (error) {
    console.error('[EmailScheduler] Feature flag check failed:', error);
    return NextResponse.json({ skipped: true, reason: 'Feature flag check error' });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://platform.mpstats.academy';
  const results = { expiring: 0, inactive_7d: 0, inactive_14d: 0, inactive_30d: 0 };

  // --- 1. Expiry reminders (CANCELLED subscriptions expiring in 3 days) ---
  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const startOfTargetDay = new Date(threeDaysFromNow);
    startOfTargetDay.setHours(0, 0, 0, 0);

    const endOfTargetDay = new Date(threeDaysFromNow);
    endOfTargetDay.setHours(23, 59, 59, 999);

    const expiringSubs = await prisma.subscription.findMany({
      where: {
        status: 'CANCELLED',
        currentPeriodEnd: {
          gte: startOfTargetDay,
          lte: endOfTargetDay,
        },
      },
      include: {
        user: true,
        plan: true,
        course: true,
      },
    });

    for (const sub of expiringSubs) {
      try {
        await cq.trackEvent(sub.userId, '$subscription_expiring', {
          name: sub.user.name || '',
          course_name: sub.course?.title || sub.plan.name,
          access_until: sub.currentPeriodEnd.toISOString(),
          renew_url: `${siteUrl}/pricing`,
        });
        results.expiring++;
      } catch (error) {
        console.error(`[EmailScheduler] Expiry event failed for sub ${sub.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[EmailScheduler] Expiry query failed:', error);
  }

  // --- 2. Inactivity chain (7/14/30 days without lesson activity) ---
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all users with their latest lesson activity
    const usersWithActivity = await prisma.$queryRaw<
      Array<{ id: string; name: string | null; last_activity: Date | null }>
    >`
      SELECT u.id, u.name, MAX(lp."updatedAt") as last_activity
      FROM "UserProfile" u
      LEFT JOIN "LearningPath" lpath ON lpath."userId" = u.id
      LEFT JOIN "LessonProgress" lp ON lp."pathId" = lpath.id
      WHERE u."isActive" = true
      GROUP BY u.id
      HAVING MAX(lp."updatedAt") IS NOT NULL
    `;

    for (const user of usersWithActivity) {
      if (!user.last_activity) continue;

      const lastActivity = new Date(user.last_activity);
      let event: '$inactive_7d' | '$inactive_14d' | '$inactive_30d' | null = null;

      // Check thresholds (most severe first, but only send the matching tier)
      if (lastActivity < thirtyDaysAgo) {
        event = '$inactive_30d';
      } else if (lastActivity < fourteenDaysAgo) {
        event = '$inactive_14d';
      } else if (lastActivity < sevenDaysAgo) {
        event = '$inactive_7d';
      }

      if (event) {
        try {
          await cq.trackEvent(user.id, event, {
            name: user.name || '',
            last_activity: lastActivity.toISOString(),
            return_url: `${siteUrl}/learn`,
          });

          if (event === '$inactive_7d') results.inactive_7d++;
          else if (event === '$inactive_14d') results.inactive_14d++;
          else if (event === '$inactive_30d') results.inactive_30d++;
        } catch (error) {
          console.error(`[EmailScheduler] Inactivity event failed for user ${user.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[EmailScheduler] Inactivity query failed:', error);
  }

  console.log('[EmailScheduler] Run complete:', results);
  return NextResponse.json(results);
}
