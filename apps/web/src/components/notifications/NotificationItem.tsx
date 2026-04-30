'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils/format-time';
import type { NotificationPayload } from '@mpstats/shared';
import { reachGoal } from '@/lib/analytics/metrika';
import { METRIKA_GOALS } from '@/lib/analytics/constants';

function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form: string;
  if (mod10 === 1 && mod100 !== 11) form = forms[0];
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];
  else form = forms[2];
  return `${n} ${form}`;
}

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
  const map: Record<string, string> = {
    COMMENT_REPLY: '💬',
    ADMIN_COMMENT_REPLY: '👨‍🏫',
    CONTENT_UPDATE: '📚',
    PROGRESS_NUDGE: '📍',
    INACTIVITY_RETURN: '👋',
    WEEKLY_DIGEST: '📰',
    BROADCAST: '📣',
  };
  const isAdminReply = type === 'ADMIN_COMMENT_REPLY';
  return (
    <div
      className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base',
        isAdminReply ? 'bg-mp-blue-100 text-mp-blue-700' : 'bg-mp-gray-100',
      )}
    >
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
    case 'CONTENT_UPDATE': {
      const items: Array<any> = payload.items ?? [];
      const lessons = items.filter((i: any) => i.kind === 'lesson');
      const materials = items.filter((i: any) => i.kind === 'material');
      const total = items.length;
      const courseTitle = payload.courseTitle ?? '';
      if (total === 1) {
        const it = items[0];
        if (it.kind === 'lesson') {
          return {
            title: `Новый урок: «${it.title}»`,
            preview: `В курсе «${courseTitle}»`,
          };
        }
        return {
          title: `Новый материал к уроку «${it.lessonTitle}»`,
          preview: it.title,
        };
      }
      const parts: string[] = [];
      if (lessons.length) parts.push(pluralize(lessons.length, ['урок', 'урока', 'уроков']));
      if (materials.length)
        parts.push(pluralize(materials.length, ['материал', 'материала', 'материалов']));
      return {
        title: `Добавлено ${parts.join(' и ')} в курсе «${courseTitle}»`,
        preview: '',
      };
    }
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
  const isAdminReply = notification.type === 'ADMIN_COMMENT_REPLY';

  const handleClick = () => {
    try {
      const payload = notification.payload as any;
      if (notification.type === 'ADMIN_COMMENT_REPLY') {
        reachGoal(METRIKA_GOALS.NOTIF_ADMIN_REPLY_OPEN, {
          commentId: payload?.commentId,
        });
      } else if (notification.type === 'CONTENT_UPDATE') {
        reachGoal(METRIKA_GOALS.NOTIF_CONTENT_UPDATE_OPEN, {
          courseId: payload?.courseId,
          itemsCount: payload?.items?.length ?? 0,
        });
      }
    } catch {
      // metrika must never break navigation
    }
    onClick?.();
  };

  const inner = (
    <div
      className={cn(
        'flex gap-3 p-3 transition-colors hover:bg-mp-gray-50',
        isUnread && 'bg-mp-blue-50', // D-03 unread accent
        isAdminReply && 'border-l-4 border-mp-blue-500 pl-3',
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
      <Link href={notification.ctaUrl} onClick={handleClick} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={handleClick} className="w-full text-left">
      {inner}
    </button>
  );
}
