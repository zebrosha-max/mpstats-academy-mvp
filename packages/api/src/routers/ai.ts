/**
 * AI Router — RAG-powered features for MPSTATS Academy
 *
 * Endpoints:
 * - getLessonSummary: Generate or retrieve cached summary for a lesson
 * - chat: RAG chat with lesson content
 * - searchChunks: Debug endpoint for vector search
 */

import { router, protectedProcedure, publicProcedure } from '../trpc';
import { z } from 'zod';
import {
  generateLessonSummary,
  generateChatResponse,
  searchChunks,
  type ChatMessage,
} from '@mpstats/ai';

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
  // TODO: Switch back to protectedProcedure after fixing Supabase SSR cookies
  getLessonSummary: publicProcedure
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
  // TODO: Switch back to protectedProcedure after fixing Supabase SSR cookies
  chat: publicProcedure
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
  // TODO: Switch back to protectedProcedure after fixing Supabase SSR cookies
  searchChunks: publicProcedure
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
