import 'server-only';

/**
 * Vector retrieval service
 *
 * Searches content_chunk table using pgvector similarity.
 * Uses Prisma raw SQL (direct TCP) instead of Supabase RPC (PostgREST HTTP)
 * because PostgREST times out on vector searches with large result sets.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@mpstats/db/client';
import { embedQuery } from './embeddings';

// Lazy-initialized Supabase client (still used for getChunksForLesson)
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

/** @deprecated Use getSupabaseClient() for lazy initialization */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseClient() as any)[prop];
  },
});

// Types
export interface ChunkSearchResult {
  id: string;
  lesson_id: string;
  content: string;
  timecode_start: number;
  timecode_end: number;
  similarity: number;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  lessonId?: string; // Filter to specific lesson
}

/**
 * Search for relevant content chunks using vector similarity
 *
 * Uses Prisma raw SQL (direct TCP connection to PostgreSQL) instead of
 * Supabase PostgREST RPC which times out on vector searches.
 *
 * @param options - Search parameters
 * @returns Array of matching chunks with similarity scores
 */
export async function searchChunks(
  options: SearchOptions
): Promise<ChunkSearchResult[]> {
  const { query, limit = 5, threshold = 0.5, lessonId } = options;

  // 1. Embed the query
  const queryEmbedding = await embedQuery(query);

  // 2. Search via Prisma raw SQL (direct TCP, not PostgREST)
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const lessonFilter = lessonId ? `AND c.lesson_id LIKE '${lessonId}%'` : '';

  const results = await prisma.$queryRawUnsafe<ChunkSearchResult[]>(`
    SELECT
      c.id::text as id,
      c.lesson_id::text as lesson_id,
      c.content::text as content,
      c.timecode_start::int as timecode_start,
      c.timecode_end::int as timecode_end,
      (1 - (c.embedding <=> '${embeddingStr}'::vector))::float as similarity
    FROM content_chunk c
    WHERE c.embedding IS NOT NULL
      AND (1 - (c.embedding <=> '${embeddingStr}'::vector)) > ${threshold}
      ${lessonFilter}
    ORDER BY c.embedding <=> '${embeddingStr}'::vector
    LIMIT ${limit}
  `);

  return results;
}

/**
 * Get all chunks for a specific lesson
 *
 * @param lessonId - Lesson ID (e.g., "01_analytics_m01_start_001")
 * @returns All chunks for the lesson, ordered by timecode
 */
export async function getChunksForLesson(
  lessonId: string
): Promise<ChunkSearchResult[]> {
  const { data, error } = await supabase
    .from('content_chunk')
    .select('id, lesson_id, content, timecode_start, timecode_end')
    .eq('lesson_id', lessonId)
    .order('timecode_start', { ascending: true });

  if (error) {
    console.error('Get chunks error:', error);
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  // Add similarity: 1.0 since these are exact matches
  return (data || []).map((chunk) => ({
    ...chunk,
    similarity: 1.0,
  }));
}

/**
 * Format timecode as HH:MM:SS or MM:SS
 */
export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
