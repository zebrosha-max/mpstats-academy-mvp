/**
 * Comments Router -- Lesson comments with 1-level threading
 *
 * Endpoints:
 * - list: Paginated root comments with replies and author profiles
 * - create: New root comment or reply (max 1500 chars, no nested replies)
 * - delete: Owner or ADMIN/SUPERADMIN can delete
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { handleDatabaseError } from '../utils/db-errors';

const COMMENTS_PER_PAGE = 20;

const userSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  role: true,
} as const;

export const commentsRouter = router({
  // List paginated root comments with nested replies and author profiles
  list: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { lessonId, cursor } = input;

        // Count total root comments for this lesson
        const totalCount = await ctx.prisma.lessonComment.count({
          where: { lessonId, parentId: null },
        });

        // Fetch root comments with replies
        const comments = await ctx.prisma.lessonComment.findMany({
          where: { lessonId, parentId: null },
          orderBy: { createdAt: 'desc' },
          take: COMMENTS_PER_PAGE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: {
            user: { select: userSelect },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: { select: userSelect },
              },
            },
          },
        });

        const nextCursor =
          comments.length === COMMENTS_PER_PAGE
            ? comments[comments.length - 1].id
            : null;

        return {
          comments,
          nextCursor,
          totalCount,
        };
      } catch (error) {
        handleDatabaseError(error);
      }
    }),

  // Create a root comment or reply
  create: protectedProcedure
    .input(
      z.object({
        lessonId: z.string(),
        content: z.string().min(1).max(1500),
        parentId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { lessonId, content, parentId } = input;

        // Validate parent exists and is a root comment (no nested replies)
        if (parentId) {
          const parent = await ctx.prisma.lessonComment.findUnique({
            where: { id: parentId },
            select: { parentId: true },
          });

          if (!parent) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Parent comment not found',
            });
          }

          if (parent.parentId !== null) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Cannot reply to a reply (max 1 level nesting)',
            });
          }
        }

        const comment = await ctx.prisma.lessonComment.create({
          data: {
            lessonId,
            userId: ctx.user.id,
            content,
            parentId: parentId ?? null,
          },
          include: {
            user: { select: userSelect },
          },
        });

        return comment;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),

  // Delete own comment or any comment (ADMIN/SUPERADMIN)
  delete: protectedProcedure
    .input(
      z.object({
        commentId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const comment = await ctx.prisma.lessonComment.findUnique({
          where: { id: input.commentId },
          select: { userId: true },
        });

        if (!comment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Comment not found',
          });
        }

        // Check ownership or admin role
        if (comment.userId !== ctx.user.id) {
          const profile = await ctx.prisma.userProfile.findUnique({
            where: { id: ctx.user.id },
            select: { role: true },
          });

          if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN')) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: 'You can only delete your own comments',
            });
          }
        }

        // Cascade delete removes replies if root comment
        await ctx.prisma.lessonComment.delete({
          where: { id: input.commentId },
        });

        return { deleted: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        handleDatabaseError(error);
      }
    }),
});
