/**
 * AI Router — RAG-powered features for MPSTATS Academy
 *
 * Endpoints:
 * - getLessonSummary: Generate or retrieve cached summary for a lesson
 * - chat: RAG chat with lesson content
 * - searchChunks: Debug endpoint for vector search
 */

import { router, protectedProcedure, aiProcedure, chatProcedure } from '../trpc';
import { z } from 'zod';
import {
  generateLessonSummary,
  generateChatResponse,
  searchChunks,
  type ChatMessage,
} from '@mpstats/ai';
import { getUserActiveSubscriptions, getUserAdminBypass, isLessonAccessible } from '../utils/access';
import { isFeatureEnabled } from '../utils/feature-flags';
import type { SearchLessonResult, SearchSnippet } from '@mpstats/shared';

// In-memory cache for summaries (will be replaced with DB in Sprint 4)
const summaryCache = new Map<string, {
  content: string;
  sources: Array<{
    id: string;
    lesson_id: string;
    content: string;
    timecode_start: number;
    timecode_end: number;
    timecodeFormatted: string;
  }>;
  generatedAt: Date;
}>();

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const aiRouter = router({
  /**
   * Get or generate a lesson summary
   *
   * 1. Check cache first
   * 2. If miss: generate via RAG
   * 3. Cache and return
   */
  getLessonSummary: aiProcedure
    .input(z.object({
      lessonId: z.string().min(1),
      forceRefresh: z.boolean().optional().default(false),
    }))
    .query(async ({ input }) => {
      const { lessonId, forceRefresh } = input;
      console.log('[AI Router] getLessonSummary called with lessonId:', lessonId);

      // Check cache
      const cached = summaryCache.get(lessonId);
      if (cached && !forceRefresh) {
        const age = Date.now() - cached.generatedAt.getTime();
        if (age < CACHE_TTL_MS) {
          return {
            content: cached.content,
            sources: cached.sources,
            fromCache: true,
          };
        }
      }

      // Generate new summary
      const result = await generateLessonSummary(lessonId);

      // Cache it
      summaryCache.set(lessonId, {
        content: result.content,
        sources: result.sources,
        generatedAt: new Date(),
      });

      return {
        content: result.content,
        sources: result.sources,
        fromCache: false,
      };
    }),

  /**
   * RAG chat for a specific lesson
   *
   * 1. Search chunks relevant to message
   * 2. Build context with citations
   * 3. Generate response
   * 4. Return with sources
   */
  chat: chatProcedure
    .input(z.object({
      lessonId: z.string().min(1),
      message: z.string().min(1).max(2000),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      })).optional().default([]),
    }))
    .mutation(async ({ input }) => {
      const { lessonId, message, history } = input;

      const result = await generateChatResponse(
        lessonId,
        message,
        history as ChatMessage[]
      );

      return {
        content: result.content,
        sources: result.sources,
        model: result.model,
      };
    }),

  /**
   * Debug: Search content chunks
   *
   * Direct access to vector search for debugging
   */
  searchChunks: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      lessonId: z.string().optional(),
      limit: z.number().min(1).max(20).default(5),
      threshold: z.number().min(0).max(1).default(0.5),
    }))
    .query(async ({ input }) => {
      const { query, lessonId, limit, threshold } = input;

      const chunks = await searchChunks({
        query,
        lessonId,
        limit,
        threshold,
      });

      return {
        query,
        count: chunks.length,
        chunks,
      };
    }),

  /**
   * Search lessons by semantic query (Phase 30)
   *
   * 1. Vector search — get up to 30 chunks
   * 2. Group by lesson_id, keep top 2 chunks per lesson
   * 3. Enrich with lesson data from Prisma
   * 4. Check access (locked/unlocked)
   * 5. Check recommended path membership
   * 6. Return top-10 lessons sorted by best similarity
   */
  searchLessons: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(500),
    }))
    .query(async ({ ctx, input }): Promise<{ query: string; results: SearchLessonResult[]; totalChunks: number }> => {
      const q = input.query.trim();

      // Hybrid search: vector (semantic) + keyword (title/description) in parallel.
      // Keyword fallback ensures that simple queries matching lesson titles always
      // return results, even when vector similarity falls below threshold.
      const [chunks, keywordLessons] = await Promise.all([
        searchChunks({ query: q, limit: 30, threshold: 0.5 }),
        ctx.prisma.lesson.findMany({
          where: {
            isHidden: false,
            course: { isHidden: false },
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 20,
        }),
      ]);

      const keywordMatchIds = new Set(keywordLessons.map((l) => l.id));

      if (chunks.length === 0 && keywordMatchIds.size === 0) {
        return { query: input.query, results: [], totalChunks: 0 };
      }

      // 2. Group chunks by lesson_id, keep top 2 chunks per lesson
      const lessonChunksMap = new Map<string, typeof chunks>();
      for (const chunk of chunks) {
        if (!chunk.lesson_id) continue;
        const existing = lessonChunksMap.get(chunk.lesson_id) || [];
        if (existing.length < 2) {
          existing.push(chunk);
          lessonChunksMap.set(chunk.lesson_id, existing);
        }
      }

      // 3. Enrich: union of vector hits + keyword hits
      const lessonIds = Array.from(new Set([
        ...lessonChunksMap.keys(),
        ...keywordMatchIds,
      ]));
      const lessons = await ctx.prisma.lesson.findMany({
        where: {
          id: { in: lessonIds },
          isHidden: false,
          course: { isHidden: false },
        },
        include: {
          course: { select: { id: true, title: true, isHidden: true } },
          progress: {
            where: { path: { userId: ctx.user.id } },
            take: 1,
          },
        },
      });

      // 4. Check access
      const [subs, billingEnabled, isAdminBypass] = await Promise.all([
        getUserActiveSubscriptions(ctx.user.id, ctx.prisma),
        isFeatureEnabled('billing_enabled'),
        getUserAdminBypass(ctx.user.id, ctx.prisma),
      ]);

      // 5. Check recommended path membership
      const activePath = await ctx.prisma.learningPath.findUnique({
        where: { userId: ctx.user.id },
        select: { lessons: true },
      });
      const recommendedLessonIds = new Set<string>();
      if (activePath?.lessons) {
        const parsed = activePath.lessons;
        if (Array.isArray(parsed)) {
          (parsed as string[]).forEach((id) => recommendedLessonIds.add(id));
        } else if (typeof parsed === 'object' && parsed !== null && 'sections' in (parsed as object)) {
          const sections = (parsed as any).sections;
          if (Array.isArray(sections)) {
            sections.forEach((s: any) => {
              if (Array.isArray(s.lessonIds)) {
                s.lessonIds.forEach((id: string) => recommendedLessonIds.add(id));
              }
            });
          }
        }
      }

      // 6. Merge and sort: keyword matches rank above vector matches,
      // then by chunk similarity for ties/vector-only results.
      const results: SearchLessonResult[] = lessons.map((lesson) => {
        const chunkList = lessonChunksMap.get(lesson.id) || [];
        const isKeywordMatch = keywordMatchIds.has(lesson.id);
        const locked = !isLessonAccessible(
          { order: lesson.order, courseId: lesson.courseId },
          subs,
          billingEnabled,
          isAdminBypass,
        );

        const snippets: SearchSnippet[] = chunkList.map((c) => ({
          content: c.content.length > 200 ? c.content.slice(0, 200) + '...' : c.content,
          timecodeStart: c.timecode_start,
          timecodeEnd: c.timecode_end,
          similarity: c.similarity,
        }));

        const vectorBest = snippets.length > 0 ? Math.max(...snippets.map((s) => s.similarity)) : 0;
        // Keyword matches are surfaced first (similarity=1.0) so users always
        // find lessons whose titles/descriptions contain their query terms.
        const bestSimilarity = isKeywordMatch ? 1 : vectorBest;

        return {
          lesson: {
            id: lesson.id,
            courseId: lesson.courseId,
            title: lesson.title,
            duration: lesson.duration || 0,
            order: lesson.order,
            skillCategory: lesson.skillCategory as any,
            skillLevel: (lesson.skillLevel || 'MEDIUM') as any,
            skillCategories: (lesson.skillCategories as string[] | null) ?? [],
            topics: (lesson.topics as string[] | null) ?? [],
          },
          course: lesson.course,
          snippets,
          bestSimilarity,
          watchedPercent: lesson.progress[0]?.watchedPercent || 0,
          status: (lesson.progress[0]?.status || 'NOT_STARTED') as any,
          locked,
          inRecommendedPath: recommendedLessonIds.has(lesson.id),
        };
      })
      .sort((a, b) => b.bestSimilarity - a.bestSimilarity)
      .slice(0, 10);

      return { query: input.query, results, totalChunks: chunks.length };
    }),

  /**
   * Clear summary cache for a lesson
   *
   * Admin/debug endpoint
   */
  clearSummaryCache: protectedProcedure
    .input(z.object({
      lessonId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.lessonId) {
        const deleted = summaryCache.delete(input.lessonId);
        return { cleared: deleted ? 1 : 0 };
      } else {
        const count = summaryCache.size;
        summaryCache.clear();
        return { cleared: count };
      }
    }),
});
