'use client';

import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentInput } from './CommentInput';
import { CommentItem } from './CommentItem';

interface CommentSectionProps {
  lessonId: string;
}

export function CommentSection({ lessonId }: CommentSectionProps) {
  const { data: profile } = trpc.profile.get.useQuery();

  const {
    data,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.comments.list.useInfiniteQuery(
    { lessonId },
    { getNextPageParam: (lastPage) => lastPage?.nextCursor }
  );

  const currentUserId = profile?.id ?? '';
  const currentUserRole = profile?.role ?? 'USER';
  const currentUser = profile ? {
    id: profile.id,
    name: profile.name ?? null,
    avatarUrl: profile.avatarUrl ?? null,
    role: profile.role ?? 'USER',
  } : undefined;
  const totalCount = data?.pages[0]?.totalCount ?? 0;
  const allComments = data?.pages.flatMap((p) => p?.comments ?? []) ?? [];

  return (
    <div data-tour="lesson-comments" className="bg-mp-gray-50 rounded-lg p-4">
      {/* Header */}
      <h3 className="text-base font-semibold text-mp-gray-900 mb-3">
        Комментарии ({totalCount})
      </h3>

      {/* Input for new root comment */}
      <div className="mb-4">
        <CommentInput lessonId={lessonId} currentUser={currentUser} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && totalCount === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="w-12 h-12 text-mp-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-sm font-medium text-mp-gray-500">Пока нет комментариев</p>
          <p className="text-xs text-mp-gray-400 mt-1">Будьте первым — поделитесь мыслями по уроку</p>
        </div>
      )}

      {/* Comments list */}
      {!isLoading && allComments.length > 0 && (
        <div className="space-y-4">
          {allComments.map((comment) => (
            <div key={comment.id} className="border-b border-mp-gray-200 pb-4 last:border-b-0 last:pb-0">
              <CommentItem
                comment={comment}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                currentUser={currentUser}
              />
            </div>
          ))}
        </div>
      )}

      {/* Show more button */}
      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Загрузка...
              </>
            ) : (
              'Показать ещё'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
