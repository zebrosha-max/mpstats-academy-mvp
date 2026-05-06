/**
 * Notification service — centralized notify() for all in-app + CQ events.
 *
 * Phase 51: COMMENT_REPLY is the only live trigger.
 * Phases 52-54 add ADMIN_COMMENT_REPLY, CONTENT_UPDATE, retention types, BROADCAST.
 *
 * Behavior:
 * 1. Anti-self-notify: if payload.actorUserId === userId → return early (no row, no event).
 *    Only applies to COMMENT_REPLY / ADMIN_COMMENT_REPLY (broadcast types have no actor).
 * 2. Check NotificationPreference.inApp; default = DEFAULT_IN_APP_PREFS[type] if no row.
 * 3. If inApp enabled → create Notification row.
 * 4. Always fire CQ event `pa_notif_<type_lowercase>` (CQ rule decides email delivery).
 * 5. Errors are captured via Sentry but never thrown (fire-and-forget).
 *
 * Location rationale (D-01): apps/web (NOT packages/api/services) — workspace dep
 * direction is apps/web → packages, never reverse. cq client lives in apps/web.
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import {
  DEFAULT_IN_APP_PREFS,
  type NotificationPayload,
  type NotificationTypeName,
} from '@mpstats/shared';
import { cq } from '@/lib/carrotquest/client';
import type { CQEventName } from '@/lib/carrotquest/types';

function reportNotifyError(stage: string, userId: string, error: unknown): void {
  console.error(`[Notify] ${stage} error for ${userId}:`, error);
  Sentry.captureException(error, {
    tags: { area: 'notifications', stage },
    extra: { userId },
  });
}

function eventNameFor(type: NotificationTypeName): CQEventName {
  return `pa_notif_${type.toLowerCase()}` as CQEventName;
}

/**
 * Build flat `pa_notif_*` props for CQ lead before trackEvent.
 * CQ email templates render placeholders from lead-level props (Phase 33 gotcha).
 *
 * Common props:
 *   pa_notif_type, pa_notif_preview, pa_notif_cta_url
 * Per-type extras allow templates to render lesson title, course title, item lists, etc.
 */
export function buildCqProps(
  type: NotificationTypeName,
  payload: NotificationPayload,
  ctaUrl: string | null,
): Record<string, string | number | null> {
  const base: Record<string, string | number | null> = {
    pa_notif_type: type,
    pa_notif_cta_url: ctaUrl ?? null,
  };
  if ('preview' in payload && typeof payload.preview === 'string') {
    base.pa_notif_preview = payload.preview;
  }

  switch (payload.type) {
    case 'COMMENT_REPLY':
    case 'ADMIN_COMMENT_REPLY':
      return {
        ...base,
        pa_notif_lesson_title: payload.lessonTitle,
        pa_notif_author_name: payload.replyAuthorName,
      };
    case 'CONTENT_UPDATE': {
      const lessons = payload.items.filter((i) => i.kind === 'lesson').length;
      const materials = payload.items.length - lessons;
      const itemsText =
        lessons > 0 && materials > 0
          ? `${lessons} ${pluralize(lessons, ['урок', 'урока', 'уроков'])} и ${materials} ${pluralize(materials, ['материал', 'материала', 'материалов'])}`
          : lessons > 0
            ? `${lessons} ${pluralize(lessons, ['урок', 'урока', 'уроков'])}`
            : `${materials} ${pluralize(materials, ['материал', 'материала', 'материалов'])}`;
      return {
        ...base,
        pa_notif_course_title: payload.courseTitle,
        pa_notif_items_count: payload.items.length,
        pa_notif_items_text: itemsText,
      };
    }
    case 'PROGRESS_NUDGE':
      return { ...base, pa_notif_lesson_title: payload.lessonTitle };
    case 'INACTIVITY_RETURN':
      return { ...base, pa_notif_days_inactive: payload.daysSinceLastActive };
    case 'WEEKLY_DIGEST':
      return {
        ...base,
        pa_notif_new_lessons_count: payload.newLessonsCount,
        pa_notif_activity_count: payload.activityCount,
      };
    case 'BROADCAST':
      return {
        ...base,
        pa_notif_title: payload.title,
        pa_notif_body: payload.body,
        pa_notif_cta_text: payload.ctaText ?? null,
      };
    default:
      return base;
  }
}

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export interface NotifyOpts {
  ctaUrl?: string;
  broadcastId?: string;
}

export async function notify(
  userId: string,
  type: NotificationTypeName,
  payload: NotificationPayload,
  opts: NotifyOpts = {},
): Promise<void> {
  try {
    // 1) Anti-self-notify (DC-08): не уведомлять автора об ответе на свой коммент.
    // 'actorUserId' in payload type-narrows к COMMENT_REPLY / ADMIN_COMMENT_REPLY.
    // Для broadcast/system типов (CONTENT_UPDATE, INACTIVITY_RETURN, WEEKLY_DIGEST,
    // PROGRESS_NUDGE, BROADCAST) поля нет → check вернёт false → не сработает.
    if ('actorUserId' in payload && payload.actorUserId === userId) {
      return;
    }

    // 2) Check preference (default fallback if row absent)
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    const inAppEnabled = pref ? pref.inApp : (DEFAULT_IN_APP_PREFS[type] ?? true);

    // 3) Create Notification row if in-app enabled
    if (inAppEnabled) {
      await prisma.notification.create({
        data: {
          userId,
          type,
          payload: payload as unknown as object, // Prisma Json
          ctaUrl: opts.ctaUrl ?? null,
          broadcastId: opts.broadcastId ?? null,
        },
      });
    }

    // 4) Always fire CQ event (CQ rule decides email delivery).
    // Wrapped в inner try/catch: если CQ упал, DB row уже создан — не ронять caller.
    try {
      // setUserProps for lead-level fields used by CQ email templates
      // (CQ rules read from lead, NOT event params — Phase 33 gotcha).
      await cq.setUserProps(userId, buildCqProps(type, payload, opts.ctaUrl ?? null));
      await cq.trackEvent(userId, eventNameFor(type));
    } catch (cqError) {
      reportNotifyError('cq', userId, cqError);
      // продолжаем — DB row уже создан, не ронять caller
    }
  } catch (error) {
    reportNotifyError('notify', userId, error);
    // Fire-and-forget: caller (route handler) НЕ должен падать
  }
}

/**
 * Bulk variant for retention/broadcast (Phase 53/54).
 * Uses createMany for performance; fires CQ events sequentially (rate-limit aware).
 *
 * NOTE: notifyMany does NOT apply anti-self-notify check (broadcast types have
 * no actorUserId). For COMMENT_REPLY-style triggers, call notify() per user.
 */
export async function notifyMany(
  userIds: string[],
  type: NotificationTypeName,
  buildPayload: (userId: string) => NotificationPayload,
  opts: NotifyOpts = {},
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const rows = userIds.map((userId) => ({
      userId,
      type,
      payload: buildPayload(userId) as unknown as object,
      ctaUrl: opts.ctaUrl ?? null,
      broadcastId: opts.broadcastId ?? null,
    }));
    await prisma.notification.createMany({ data: rows });
  } catch (error) {
    reportNotifyError('notifyMany.createMany', 'bulk', error);
  }

  // CQ events sequentially (CQ rate-limit ~50 events/sec per memory).
  // Каждый wrapped в свой try/catch — один failure не ломает остальные.
  for (const userId of userIds) {
    try {
      const payload = buildPayload(userId);
      await cq.setUserProps(userId, buildCqProps(type, payload, opts.ctaUrl ?? null));
      await cq.trackEvent(userId, eventNameFor(type));
    } catch (error) {
      reportNotifyError('notifyMany.cq', userId, error);
    }
  }
}

/**
 * Helper для COMMENT_REPLY триггера. Resolve parent comment + lesson title,
 * затем зовёт notify().
 *
 * Usage (called from /api/notifications/notify-reply route handler в плане 04):
 *   await notifyCommentReply({ replyCommentId, actorUserId: ctx.user.id });
 *
 * Two layers of anti-self-notify:
 * 1. Здесь: parent.userId === actorUserId → early return
 * 2. notify() ниже: payload.actorUserId === userId → early return (defense in depth)
 */
export interface NotifyCommentReplyArgs {
  replyCommentId: string;
  actorUserId: string;
}

export async function notifyCommentReply(args: NotifyCommentReplyArgs): Promise<void> {
  try {
    const reply = await prisma.lessonComment.findUnique({
      where: { id: args.replyCommentId },
      select: {
        id: true,
        content: true,
        parentId: true,
        lessonId: true,
        user: { select: { name: true } },
      },
    });
    if (!reply || !reply.parentId) return; // not a reply or comment gone

    const parent = await prisma.lessonComment.findUnique({
      where: { id: reply.parentId },
      select: { id: true, userId: true },
    });
    if (!parent) return; // parent deleted

    // Anti-self-notify additional guard (notify() also checks via payload.actorUserId)
    if (parent.userId === args.actorUserId) return;

    // Phase 52 D2: detect reply author's role to choose ADMIN_COMMENT_REPLY
    // vs COMMENT_REPLY (supersede — only one notification kind, never both).
    const actor = await prisma.userProfile.findUnique({
      where: { id: args.actorUserId },
      select: { role: true },
    });
    const isAdminAuthor = actor?.role === 'ADMIN' || actor?.role === 'SUPERADMIN';
    const notificationType: NotificationTypeName = isAdminAuthor
      ? 'ADMIN_COMMENT_REPLY'
      : 'COMMENT_REPLY';

    const lesson = await prisma.lesson.findUnique({
      where: { id: reply.lessonId },
      select: { title: true },
    });
    const lessonTitle = lesson?.title ?? 'Урок';

    const replyAuthorName = reply.user?.name ?? 'Пользователь';
    const preview = reply.content.slice(0, 120);

    await notify(
      parent.userId,
      notificationType,
      {
        type: notificationType,
        commentId: reply.id,
        lessonId: reply.lessonId,
        lessonTitle,
        replyAuthorName,
        preview,
        actorUserId: args.actorUserId,
      },
      {
        ctaUrl: `/learn/${reply.lessonId}#comment-${reply.id}`,
      },
    );
  } catch (error) {
    reportNotifyError('notifyCommentReply', args.actorUserId, error);
  }
}
