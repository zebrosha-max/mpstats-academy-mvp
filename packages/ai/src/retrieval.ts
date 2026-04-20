import 'server-only';

/**
 * Vector retrieval service
 *
 * Searches content_chunk table using pgvector similarity.
 * Uses Prisma raw SQL (direct TCP) instead of Supabase RPC (PostgREST HTTP)
 * because PostgREST times out on vector searches with large result sets.
 */

import { prisma } from '@mpstats/db/client';
import { embedQuery } from './embeddings';

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
  /**
   * When true (default), chunks belonging to hidden lessons or lessons in
   * hidden courses are excluded. Set to false only for admin tooling / audits.
   */
  includeHidden?: boolean;
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
  const { query, limit = 5, threshold = 0.5, lessonId, includeHidden = false } = options;

  // 1. Embed the query
  const queryEmbedding = await embedQuery(query);

  // 2. Search via Prisma raw SQL (direct TCP, not PostgREST)
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const lessonFilter = lessonId ? `AND c.lesson_id LIKE '${lessonId}%'` : '';

  // Default behavior: join Lesson + Course and exclude hidden rows. This keeps
  // RAG retrieval consistent with user-facing lesson queries.
  const hiddenJoin = includeHidden
    ? ''
    : `INNER JOIN "Lesson" l ON l.id = c.lesson_id
       INNER JOIN "Course" co ON co.id = l."courseId"`;
  const hiddenFilter = includeHidden
    ? ''
    : `AND l."isHidden" = false AND co."isHidden" = false`;

  const results = await prisma.$queryRawUnsafe<ChunkSearchResult[]>(`
    SELECT
      c.id::text as id,
      c.lesson_id::text as lesson_id,
      c.content::text as content,
      c.timecode_start::int as timecode_start,
      c.timecode_end::int as timecode_end,
      (1 - (c.embedding <=> '${embeddingStr}'::vector))::float as similarity
    FROM content_chunk c
    ${hiddenJoin}
    WHERE c.embedding IS NOT NULL
      AND (1 - (c.embedding <=> '${embeddingStr}'::vector)) > ${threshold}
      ${lessonFilter}
      ${hiddenFilter}
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
  lessonId: string,
  options: { includeHidden?: boolean } = {},
): Promise<ChunkSearchResult[]> {
  const { includeHidden = false } = options;

  // Use Prisma raw SQL (direct TCP) instead of Supabase PostgREST
  // PostgREST times out on lessons with many chunks (TypeError: terminated)
  // Hidden lesson/course → return no chunks so consumers degrade gracefully.
  if (!includeHidden) {
    const visible = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT l.id
      FROM "Lesson" l
      INNER JOIN "Course" co ON co.id = l."courseId"
      WHERE l.id = ${lessonId}
        AND l."isHidden" = false
        AND co."isHidden" = false
    `;
    if (visible.length === 0) return [];
  }

  const results = await prisma.$queryRaw<Array<{
    id: string;
    lesson_id: string;
    content: string;
    timecode_start: number;
    timecode_end: number;
  }>>`
    SELECT
      id::text as id,
      lesson_id::text as lesson_id,
      content::text as content,
      timecode_start::int as timecode_start,
      timecode_end::int as timecode_end
    FROM content_chunk
    WHERE lesson_id = ${lessonId}
    ORDER BY timecode_start ASC
  `;

  return results.map((chunk) => ({
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
