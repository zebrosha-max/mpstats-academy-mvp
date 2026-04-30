'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';
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
import { CommentInput } from './CommentInput';
import { formatRelativeTime } from '@/lib/utils/format-time';

// Re-export для backward compat (Phase 51 Task 0 — extracted to shared util)
export { formatRelativeTime } from '@/lib/utils/format-time';

interface CommentUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

interface ReplyData {
  id: string;
  userId: string;
  content: string;
  createdAt: Date;
  user: CommentUser;
}

interface CommentData {
  id: string;
  lessonId: string;
  userId: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  user: CommentUser;
  replies: ReplyData[];
}

interface CurrentUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

interface CommentItemProps {
  comment: CommentData;
  currentUserId: string;
  currentUserRole: string;
  isReply?: boolean;
  currentUser?: CurrentUser;
}

function Avatar({ user, size = 'md' }: { user: CommentUser; size?: 'md' | 'sm' }) {
  const [imgError, setImgError] = useState(false);
  const sizeClass = size === 'md' ? 'w-8 h-8' : 'w-7 h-7';
  const textClass = size === 'md' ? 'text-xs' : 'text-[10px]';
  const initials = (user.name || '?').slice(0, 2).toUpperCase();
  const showFallback = !user.avatarUrl || imgError;

  return showFallback ? (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-mp-blue-500 to-mp-blue-600 text-white flex items-center justify-center ${textClass} font-semibold shrink-0`}>
      {initials}
    </div>
  ) : (
    <img
      src={user.avatarUrl!}
      alt={user.name || ''}
      className={`${sizeClass} rounded-full object-cover ring-2 ring-mp-gray-100 shrink-0`}
      onError={() => setImgError(true)}
    />
  );
}

export function CommentItem({ comment, currentUserId, currentUserRole, isReply = false, currentUser }: CommentItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const utils = trpc.useUtils();

  const canDelete =
    comment.userId === currentUserId ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'SUPERADMIN';

  const deleteComment = trpc.comments.delete.useMutation({
    onMutate: async () => {
      await utils.comments.list.cancel({ lessonId: comment.lessonId });
      const previousData = utils.comments.list.getInfiniteData({ lessonId: comment.lessonId });

      // Optimistic removal
      utils.comments.list.setInfiniteData({ lessonId: comment.lessonId }, (old) => {
        if (!old) return old;

        if (isReply) {
          // Remove reply from parent
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              comments: page.comments.map((c) => ({
                ...c,
                replies: c.replies.filter((r) => r.id !== comment.id),
              })),
            })),
          };
        }

        // Remove root comment (and its replies via cascade)
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            comments: page.comments.filter((c) => c.id !== comment.id),
            totalCount: page.totalCount - 1,
          })),
        };
      });

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        utils.comments.list.setInfiniteData({ lessonId: comment.lessonId }, context.previousData);
      }
      toast.error('Не удалось удалить комментарий. Попробуйте ещё раз.');
    },
    onSettled: () => {
      utils.comments.list.invalidate({ lessonId: comment.lessonId });
    },
  });

  const displayName = comment.user.name || 'Пользователь';
  const timestamp = formatRelativeTime(new Date(comment.createdAt));

  return (
    <div id={`comment-${comment.id}`} className="scroll-mt-20">
      <div className="flex gap-3">
        <Avatar user={comment.user} size={isReply ? 'sm' : 'md'} />
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-mp-gray-900 truncate">{displayName}</span>
            <span className="text-mp-gray-300">&middot;</span>
            <span className="text-xs text-mp-gray-400 shrink-0">{timestamp}</span>
            {/* Trash icon */}
            {canDelete && (
              <div className="ml-auto shrink-0">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1 text-mp-gray-400 hover:text-destructive transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить комментарий?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteComment.mutate({ commentId: comment.id })}
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {/* Comment text */}
          <p className="text-sm text-mp-gray-700 whitespace-pre-wrap mt-1">{comment.content}</p>

          {/* Action row -- reply button only on root comments */}
          {!isReply && (
            <div className="mt-1">
              <button
                className="text-xs text-mp-gray-400 hover:text-mp-blue-600 transition-colors"
                onClick={() => setShowReplyInput(true)}
              >
                Ответить
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Replies block */}
      {!isReply && comment.replies.length > 0 && (
        <div className="ml-6 border-l-2 border-mp-gray-200 pl-4 space-y-3 mt-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={{
                ...reply,
                lessonId: comment.lessonId,
                parentId: comment.id,
                replies: [],
              }}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              isReply
            />
          ))}
        </div>
      )}

      {/* Reply input */}
      {!isReply && showReplyInput && (
        <div className="ml-6 border-l-2 border-mp-gray-200 pl-4 mt-3">
          <CommentInput
            lessonId={comment.lessonId}
            parentId={comment.id}
            autoFocus
            onCancel={() => setShowReplyInput(false)}
            currentUser={currentUser}
          />
        </div>
      )}
    </div>
  );
}
