'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Trash2,
  EyeOff,
  Eye,
  ExternalLink,
  ChevronDown,
  Search,
} from 'lucide-react';

const PERIODS = [
  { value: 'all' as const, label: 'Все время' },
  { value: '30d' as const, label: '30 дней' },
  { value: '7d' as const, label: '7 дней' },
];

const STATUSES = [
  { value: 'all' as const, label: 'Все' },
  { value: 'visible' as const, label: 'Видимые' },
  { value: 'hidden' as const, label: 'Скрытые' },
];

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  if (diffHour < 24) return `${diffHour} ч назад`;
  if (diffDay < 7) return `${diffDay} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AdminCommentTable() {
  const [courseId, setCourseId] = useState<string | undefined>();
  const [status, setStatus] = useState<'all' | 'visible' | 'hidden'>('all');
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('all');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();

  const courses = trpc.admin.getCourses.useQuery();

  const comments = trpc.admin.getComments.useInfiniteQuery(
    {
      courseId,
      status,
      period,
      search: search || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    }
  );

  const toggleVisibility = trpc.admin.toggleCommentVisibility.useMutation({
    onSuccess: () => {
      utils.admin.getComments.invalidate();
      utils.admin.getNewCommentsCount.invalidate();
    },
  });

  const deleteComment = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.admin.getComments.invalidate();
      utils.admin.getNewCommentsCount.invalidate();
    },
  });

  const allItems = comments.data?.pages.flatMap(p => p?.items ?? []) ?? [];
  const totalCount = comments.data?.pages[0]?.totalCount ?? 0;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (comments.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Card key={i} className="p-4">
            <div className="flex gap-3">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={courseId ?? ''}
          onChange={e => setCourseId(e.target.value || undefined)}
          className="h-9 rounded-lg border border-mp-gray-200 bg-white px-3 text-body-sm text-mp-gray-700 focus:outline-none focus:ring-2 focus:ring-mp-blue-500"
        >
          <option value="">Все курсы</option>
          {courses.data?.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={e => setStatus(e.target.value as typeof status)}
          className="h-9 rounded-lg border border-mp-gray-200 bg-white px-3 text-body-sm text-mp-gray-700 focus:outline-none focus:ring-2 focus:ring-mp-blue-500"
        >
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={period}
          onChange={e => setPeriod(e.target.value as typeof period)}
          className="h-9 rounded-lg border border-mp-gray-200 bg-white px-3 text-body-sm text-mp-gray-700 focus:outline-none focus:ring-2 focus:ring-mp-blue-500"
        >
          {PERIODS.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mp-gray-400" />
          <input
            type="text"
            placeholder="Поиск по тексту или автору..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-mp-gray-200 bg-white pl-9 pr-3 text-body-sm text-mp-gray-700 placeholder:text-mp-gray-400 focus:outline-none focus:ring-2 focus:ring-mp-blue-500"
          />
        </div>
      </div>

      <p className="text-body-sm text-mp-gray-500">
        {totalCount === 0 ? 'Комментариев не найдено' : `Всего: ${totalCount}`}
      </p>

      <div className="space-y-2">
        {allItems.map(item => {
          const isExpanded = expandedIds.has(item.id);
          const contentPreview = item.content.length > 120 && !isExpanded
            ? item.content.slice(0, 120) + '...'
            : item.content;
          const lesson = item.lesson;

          return (
            <Card
              key={item.id}
              className={cn(
                'p-4 transition-colors',
                item.isHidden && 'bg-mp-gray-50 opacity-70',
              )}
            >
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-mp-blue-100 text-mp-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {item.user.avatarUrl ? (
                    <img
                      src={item.user.avatarUrl}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    getInitials(item.user.name)
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-body-sm font-semibold text-mp-gray-900">
                      {item.user.name || 'Пользователь'}
                    </span>
                    <span className="text-xs text-mp-gray-400">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                    {item.isHidden && (
                      <span className="text-xs font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                        Скрыт
                      </span>
                    )}
                    {item.parentId && (
                      <span className="text-xs text-mp-gray-400">ответ</span>
                    )}
                  </div>

                  <p
                    className={cn(
                      'text-body-sm text-mp-gray-700 mt-1',
                      !isExpanded && item.content.length > 120 && 'cursor-pointer',
                    )}
                    onClick={() => item.content.length > 120 && toggleExpand(item.id)}
                  >
                    {contentPreview}
                    {item.content.length > 120 && !isExpanded && (
                      <button className="text-mp-blue-500 ml-1 text-xs hover:underline">
                        ещё
                      </button>
                    )}
                  </p>

                  {lesson && (
                    <a
                      href={`/learn/${item.lessonId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs text-mp-blue-500 hover:underline"
                    >
                      {lesson.course?.title} &rarr; {lesson.title}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-start gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      toggleVisibility.mutate({
                        commentId: item.id,
                        isHidden: !item.isHidden,
                      })
                    }
                    title={item.isHidden ? 'Показать' : 'Скрыть'}
                  >
                    {item.isHidden ? (
                      <Eye className="w-4 h-4 text-mp-gray-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-mp-gray-500" />
                    )}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Удалить комментарий?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Комментарий будет удалён навсегда. Если это корневой комментарий, все ответы тоже будут удалены.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteComment.mutate({ commentId: item.id })}
                        >
                          Удалить
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {comments.hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => comments.fetchNextPage()}
            disabled={comments.isFetchingNextPage}
          >
            {comments.isFetchingNextPage ? 'Загрузка...' : 'Загрузить ещё'}
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
