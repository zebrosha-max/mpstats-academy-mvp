'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { NotificationItem } from './NotificationItem';

/** Phase 51 — NotificationBell:
 * - badge с unread count (hidden если 0, '99+' если > 99)
 * - polling 60с через refetchInterval, pause при document.hidden (DC-02)
 * - открытие dropdown триггерит markSeen (D-07)
 * - dropdown: 10 последних, группировка «Новые / Раньше» (D-02), footer с двумя CTA
 *
 * NOTE: markAllRead помечает ВСЕ unread юзера, не только видимые в dropdown —
 * intentional, соответствует SPEC acceptance criterion req 8.
 */

const POLL_INTERVAL_MS = 60_000;
const DROPDOWN_LIMIT = 10;

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  // Page Visibility API — pause polling when tab hidden (DC-02)
  useEffect(() => {
    const handler = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const { data: countData } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: docHidden ? false : POLL_INTERVAL_MS,
  });
  const count = countData?.count ?? 0;
  const badgeText = count > 99 ? '99+' : String(count);

  const utils = trpc.useUtils();
  const markSeen = trpc.notifications.markSeen.useMutation({
    onSuccess: () => utils.notifications.unreadCount.invalidate(),
  });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  // markAllRead: помечает ВСЕ unread юзера (не только в dropdown) — global behavior per SPEC
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  // Lazy-fetch dropdown items — только когда открыт
  const { data: listData } = trpc.notifications.list.useQuery(
    { filter: 'all' },
    { enabled: isOpen },
  );
  const items = (listData?.items ?? []).slice(0, DROPDOWN_LIMIT);

  // D-02: split в «Новые» (unread) и «Раньше» (read, последние 7 дней)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newItems = items.filter((n: any) => n.readAt === null);
  const olderItems = items.filter(
    (n: any) => n.readAt !== null && new Date(n.createdAt) >= sevenDaysAgo,
  );

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) markSeen.mutate(); // D-07
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Уведомления"
          className="relative w-10 h-10 rounded-lg flex items-center justify-center text-mp-gray-400 hover:text-mp-blue-500 hover:bg-mp-gray-100 transition-colors duration-200"
        >
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span
              className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1
                         rounded-full bg-red-500 text-white text-[10px] font-bold
                         flex items-center justify-center pointer-events-none"
            >
              {badgeText}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] max-h-[480px] p-0 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-mp-gray-100 text-sm font-semibold">
          Уведомления
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-mp-gray-500">
              Пока тихо. Здесь появятся ответы на твои комментарии и важные обновления.
            </div>
          ) : (
            <>
              {newItems.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-mp-gray-400 font-semibold">
                    Новые
                  </div>
                  {newItems.map((n: any) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onClick={() => {
                        if (n.readAt === null) markRead.mutate({ notificationId: n.id });
                        setIsOpen(false);
                      }}
                    />
                  ))}
                </>
              )}
              {olderItems.length > 0 && (
                <>
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-mp-gray-400 font-semibold">
                    Раньше
                  </div>
                  {olderItems.map((n: any) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onClick={() => setIsOpen(false)}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer — actions */}
        <div className="border-t border-mp-gray-100 px-3 py-2 flex items-center justify-between gap-2">
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="text-xs text-mp-blue-600 hover:underline"
          >
            Все уведомления →
          </Link>
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={count === 0 || markAllRead.isPending}
            className={cn(
              'text-xs text-mp-gray-500 hover:text-mp-gray-700',
              (count === 0 || markAllRead.isPending) && 'opacity-50 cursor-not-allowed',
            )}
          >
            Отметить все прочитанными
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
