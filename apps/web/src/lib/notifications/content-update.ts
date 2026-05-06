/**
 * notifyContentUpdate — orchestrates targeting + grouping + per-user CQ event.
 *
 * Flow:
 *  1. Resolve targets via findUsersForCourseUpdate(courseId).
 *  2. For each target: check NotificationPreference (skip if inApp=false).
 *  3. mergeOrCreateContentUpdate(userId, courseId, items).
 *  4. Fire CQ event pa_notif_content_update.
 *
 * Failures isolated per user (one user's CQ failure does not abort the loop).
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { DEFAULT_IN_APP_PREFS } from '@mpstats/shared';
import { cq } from '@/lib/carrotquest/client';
import { findUsersForCourseUpdate } from './targeting';
import { mergeOrCreateContentUpdate, resolveCtaUrl, type ContentUpdateItem } from './grouping';
import { buildCqProps } from './notify';

export interface NotifyContentUpdateArgs {
  courseId: string;
  items: ContentUpdateItem[];
}

export async function notifyContentUpdate(
  args: NotifyContentUpdateArgs,
): Promise<{ delivered: number }> {
  let delivered = 0;
  try {
    if (args.items.length === 0) return { delivered: 0 };
    const userIds = await findUsersForCourseUpdate(args.courseId);
    if (userIds.length === 0) return { delivered: 0 };

    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, type: 'CONTENT_UPDATE' },
    });
    const prefByUser = new Map(prefs.map((p) => [p.userId, p.inApp]));

    for (const userId of userIds) {
      const inApp = prefByUser.has(userId)
        ? prefByUser.get(userId)!
        : DEFAULT_IN_APP_PREFS.CONTENT_UPDATE;
      if (!inApp) continue;
      let finalPayload: Awaited<ReturnType<typeof mergeOrCreateContentUpdate>> = null;
      try {
        finalPayload = await mergeOrCreateContentUpdate(userId, args.courseId, args.items);
        delivered += 1;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { area: 'notifications', stage: 'content-update.merge' },
          extra: { userId, courseId: args.courseId },
        });
      }
      try {
        if (finalPayload) {
          await cq.setUserProps(
            userId,
            buildCqProps('CONTENT_UPDATE', finalPayload, resolveCtaUrl(args.courseId, finalPayload.items)),
          );
        }
        await cq.trackEvent(userId, 'pa_notif_content_update');
      } catch (err) {
        Sentry.captureException(err, {
          tags: { area: 'notifications', stage: 'content-update.cq' },
          extra: { userId },
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'notifications', stage: 'content-update.outer' },
      extra: { courseId: args.courseId },
    });
  }
  return { delivered };
}
