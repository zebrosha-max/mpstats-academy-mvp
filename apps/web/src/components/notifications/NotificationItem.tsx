'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format-time';
import type { NotificationPayload } from '@mpstats/shared';

export interface NotificationItemData {
  id: string;
  type: string;
  payload: any; // Prisma Json — runtime narrow через discriminant
  ctaUrl: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onClick?: () => void;
}

/** Маленькая иконка-индикатор по типу уведомления (D-01) */
function TypeIcon({ type }: { type: string }) {
  // Простой emoji-style для Phase 51; иконки/цвета можно сделать в Phase 52 при ADMIN_COMMENT_REPLY accent
  const map: Record<string, string> = {
    COMMENT_REPLY: '💬',
    ADMIN_COMMENT_REPLY: '👨‍🏫',
    CONTENT_UPDATE: '📚',
    PROGRESS_NUDGE: '📍',
    INACTIVITY_RETURN: '👋',
    WEEKLY_DIGEST: '📰',
    BROADCAST: '📣',
  };
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-mp-gray-100 flex items-center justify-center text-base">
      {map[type] ?? '🔔'}
    </div>
  );
}

function deriveTitleAndPreview(payload: NotificationPayload | any): { title: string; preview: string } {
  // Discriminant runtime narrow
  switch (payload?.type) {
    case 'COMMENT_REPLY':
    case 'ADMIN_COMMENT_REPLY':
      return {
        title: `${payload.replyAuthorName ?? 'Пользователь'} ответил на твой комментарий`,
        preview: payload.preview ?? '',
      };
    case 'CONTENT_UPDATE':
      return {
        title: `Новые уроки в курсе «${payload.courseTitle ?? ''}»`,
        preview: `Добавлено уроков: ${payload.lessonIds?.length ?? 0}`,
      };
    case 'PROGRESS_NUDGE':
      return {
        title: 'Продолжишь?',
        preview: payload.lessonTitle ?? '',
      };
    case 'INACTIVITY_RETURN':
      return {
        title: 'Давно тебя не было',
        preview: `${payload.daysSinceLastActive ?? 0} дней без визита — расскажем что нового`,
      };
    case 'WEEKLY_DIGEST':
      return {
        title: 'Твой недельный дайджест',
        preview: `Новых уроков: ${payload.newLessonsCount ?? 0}, активность: ${payload.activityCount ?? 0}`,
      };
    case 'BROADCAST':
      return {
        title: payload.title ?? 'Анонс',
        preview: payload.body ?? '',
      };
    default:
      return { title: 'Уведомление', preview: '' };
  }
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const isUnread = notification.readAt === null;
  const created = new Date(notification.createdAt);
  const { title, preview } = deriveTitleAndPreview(notification.payload);

  const inner = (
    <div
      className={cn(
        'flex gap-3 p-3 transition-colors hover:bg-mp-gray-50',
        isUnread && 'bg-mp-blue-50', // D-03 unread accent
      )}
    >
      <TypeIcon type={notification.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mp-gray-900 truncate">{title}</p>
        {preview && (
          <p className="text-xs text-mp-gray-500 line-clamp-2 mt-0.5">{preview}</p>
        )}
        <span className="text-xs text-mp-gray-400 mt-1 block">
          {formatRelativeTime(created)}
        </span>
      </div>
    </div>
  );

  if (notification.ctaUrl) {
    return (
      <Link href={notification.ctaUrl} onClick={onClick} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="w-full text-left">
      {inner}
    </button>
  );
}
