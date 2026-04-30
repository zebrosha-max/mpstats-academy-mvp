/**
 * Notification payload types — discriminated union per NotificationType.
 *
 * Stored as Prisma `Json` in Notification.payload column.
 * Runtime validation via Zod schemas (see apps/web/src/lib/notifications/notify.ts, planned wave 02).
 *
 * Phase 51 — Notification Center Foundation.
 */

export type NotificationPayload =
  | {
      type: 'COMMENT_REPLY';
      commentId: string;
      lessonId: string;
      lessonTitle: string;
      replyAuthorName: string;
      preview: string;
      actorUserId: string; // for anti-self-notify check (DC-08)
    }
  | {
      type: 'ADMIN_COMMENT_REPLY';
      commentId: string;
      lessonId: string;
      lessonTitle: string;
      replyAuthorName: string;
      preview: string;
      actorUserId: string;
    }
  | {
      type: 'CONTENT_UPDATE';
      courseId: string;
      courseTitle: string;
      lessonIds: string[];
    }
  | {
      type: 'PROGRESS_NUDGE';
      lessonId: string;
      lessonTitle: string;
    }
  | {
      type: 'INACTIVITY_RETURN';
      daysSinceLastActive: number;
    }
  | {
      type: 'WEEKLY_DIGEST';
      newLessonsCount: number;
      activityCount: number;
    }
  | {
      type: 'BROADCAST';
      title: string;
      body: string;
      ctaText?: string;
    };

/**
 * All NotificationType values in SPEC-locked order (D-10).
 * Mirrors enum in packages/db/prisma/schema.prisma.
 */
export const ALL_NOTIFICATION_TYPES = [
  'COMMENT_REPLY',
  'ADMIN_COMMENT_REPLY',
  'CONTENT_UPDATE',
  'PROGRESS_NUDGE',
  'INACTIVITY_RETURN',
  'WEEKLY_DIGEST',
  'BROADCAST',
] as const;

export type NotificationTypeName = (typeof ALL_NOTIFICATION_TYPES)[number];

/**
 * Russian labels for /profile/notifications descriptions (D-16).
 * Tone: «ты» + дружелюбный (D-14).
 */
export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<NotificationTypeName, string> = {
  COMMENT_REPLY: 'Ответы на твои комментарии в уроках',
  ADMIN_COMMENT_REPLY: 'Ответы методологов на твои вопросы',
  CONTENT_UPDATE: 'Новые уроки и материалы в твоих курсах',
  PROGRESS_NUDGE: 'Напоминания о незавершённых уроках',
  INACTIVITY_RETURN: 'Если давно не заходил — расскажем что нового',
  WEEKLY_DIGEST: 'Дайджест по пятницам — новинки и активность',
  BROADCAST: 'Анонсы курсов и важные новости платформы',
};

/**
 * Default in-app preference per type (SPEC req 2 + D-15):
 * - WEEKLY_DIGEST = false (opt-in)
 * - All others = true
 *
 * Used by `notifications.getPreferences` to fill missing rows
 * (NotificationPreference is sparse — rows created on first toggle).
 */
export const DEFAULT_IN_APP_PREFS: Record<NotificationTypeName, boolean> = {
  COMMENT_REPLY: true,
  ADMIN_COMMENT_REPLY: true,
  CONTENT_UPDATE: true,
  PROGRESS_NUDGE: true,
  INACTIVITY_RETURN: true,
  WEEKLY_DIGEST: false,
  BROADCAST: true,
};
