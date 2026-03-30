'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc/client';
import { toast } from 'sonner';

const MAX_LENGTH = 1500;

interface CurrentUser {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

interface CommentInputProps {
  lessonId: string;
  parentId?: string;
  onCancel?: () => void;
  autoFocus?: boolean;
  onSuccess?: () => void;
  currentUser?: CurrentUser;
}

export function CommentInput({ lessonId, parentId, onCancel, autoFocus, onSuccess, currentUser }: CommentInputProps) {
  const [content, setContent] = useState('');
  const utils = trpc.useUtils();

  const createComment = trpc.comments.create.useMutation({
    onMutate: async (newComment) => {
      // Cancel outgoing refetches
      await utils.comments.list.cancel({ lessonId });

      // Snapshot previous data
      const previousData = utils.comments.list.getInfiniteData({ lessonId });

      // Optimistic update
      utils.comments.list.setInfiniteData({ lessonId }, (old) => {
        if (!old) return old;

        const optimisticComment = {
          id: `optimistic-${Date.now()}`,
          lessonId,
          userId: currentUser?.id ?? 'optimistic-user',
          content: newComment.content,
          parentId: newComment.parentId ?? null,
          createdAt: new Date(),
          user: {
            id: currentUser?.id ?? 'optimistic-user',
            name: currentUser?.name ?? null,
            avatarUrl: currentUser?.avatarUrl ?? null,
            role: (currentUser?.role ?? 'USER') as 'USER' | 'ADMIN' | 'SUPERADMIN',
          },
          isHidden: false,
          hiddenBy: null,
          hiddenAt: null,
          replies: [],
        };

        if (newComment.parentId) {
          // Adding a reply -- find the parent comment and add reply inline
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              comments: page.comments.map((c) =>
                c.id === newComment.parentId
                  ? {
                      ...c,
                      replies: [
                        ...c.replies,
                        {
                          id: optimisticComment.id,
                          lessonId,
                          userId: optimisticComment.userId,
                          content: optimisticComment.content,
                          parentId: newComment.parentId ?? null,
                          createdAt: optimisticComment.createdAt,
                          isHidden: false,
                          hiddenBy: null,
                          hiddenAt: null,
                          user: optimisticComment.user,
                        },
                      ],
                    }
                  : c
              ),
            })),
          };
        }

        // Adding a root comment -- prepend to first page
        return {
          ...old,
          pages: old.pages.map((page, idx) =>
            idx === 0
              ? {
                  ...page,
                  comments: [optimisticComment, ...page.comments],
                  totalCount: page.totalCount + 1,
                }
              : page
          ),
        };
      });

      return { previousData };
    },
    onError: (_err, _newComment, context) => {
      // Revert on error
      if (context?.previousData) {
        utils.comments.list.setInfiniteData({ lessonId }, context.previousData);
      }
      toast.error('Не удалось отправить комментарий. Попробуйте ещё раз.');
    },
    onSettled: () => {
      utils.comments.list.invalidate({ lessonId });
    },
    onSuccess: () => {
      setContent('');
      onSuccess?.();
      onCancel?.();
    },
  });

  const isOverLimit = content.length > MAX_LENGTH;
  const isEmpty = content.trim().length === 0;
  const isDisabled = isEmpty || isOverLimit || createComment.isPending;

  const handleSubmit = () => {
    if (isDisabled) return;
    createComment.mutate({
      lessonId,
      content: content.trim(),
      ...(parentId ? { parentId } : {}),
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? 'Напишите ответ...' : 'Напишите комментарий...'}
        rows={2}
        autoFocus={autoFocus}
        className="min-h-[5rem] max-h-[10rem] resize-none text-sm"
      />
      <div className="flex items-center justify-between">
        <span className={`text-xs ${isOverLimit ? 'text-destructive' : 'text-mp-gray-400'}`}>
          {content.length} / {MAX_LENGTH}
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Отмена
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isDisabled}
          >
            {createComment.isPending ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              'Отправить'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
