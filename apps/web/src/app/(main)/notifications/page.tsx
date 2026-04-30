'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NotificationItem } from '@/components/notifications/NotificationItem';

type FilterValue = 'all' | 'unread';

export default function NotificationsPage() {
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get('filter') as FilterValue) === 'unread' ? 'unread' : 'all';
  const [filter, setFilter] = useState<FilterValue>(initialFilter);

  // sync URL ?filter back if user switches
  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter === 'unread') url.searchParams.set('filter', 'unread');
    else url.searchParams.delete('filter');
    window.history.replaceState({}, '', url.toString());
  }, [filter]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.notifications.list.useInfiniteQuery(
      { filter },
      { getNextPageParam: (last: any) => last?.nextCursor ?? null },
    );

  const utils = trpc.useUtils();
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const items = data?.pages.flatMap((p: any) => p?.items ?? []) ?? [];

  const filterPill = (value: FilterValue, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm transition-colors',
        filter === value
          ? 'bg-mp-blue-600 text-white'
          : 'bg-mp-gray-100 text-mp-gray-700 hover:bg-mp-gray-200',
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-mp-gray-900">Уведомления</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending || items.every((n: any) => n.readAt !== null)}
        >
          Отметить все прочитанными
        </Button>
      </div>

      <div className="flex gap-2">
        {filterPill('all', 'Все')}
        {filterPill('unread', 'Непрочитанные')}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-mp-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-mp-gray-500 text-center py-12">
          {filter === 'unread'
            ? 'Все уведомления прочитаны. 🎉'
            : 'У тебя пока нет уведомлений.'}
        </p>
      ) : (
        <div className="space-y-1 border border-mp-gray-100 rounded-lg overflow-hidden divide-y divide-mp-gray-100">
          {items.map((n: any) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={() => {
                if (n.readAt === null) markRead.mutate({ notificationId: n.id });
              }}
            />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Загрузка...' : 'Показать ещё'}
          </Button>
        </div>
      )}
    </div>
  );
}
