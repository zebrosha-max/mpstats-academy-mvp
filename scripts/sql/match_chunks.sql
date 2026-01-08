-- ============================================
-- Supabase RPC function: match_chunks
-- Vector similarity search for RAG
-- ============================================
--
-- Run this SQL in Supabase Dashboard:
-- https://supabase.com/dashboard/project/saecuecevicwjkpmaoot/sql
--
-- ВАЖНО: Выполнить ОДИН РАЗ при настройке проекта
-- ============================================

-- Drop existing function if exists (for updates)
DROP FUNCTION IF EXISTS match_chunks(vector(1536), float, int, text);

-- Create the vector similarity search function
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5,
  filter_lesson_prefix text DEFAULT NULL
)
RETURNS TABLE (
  id text,
  lesson_id text,
  content text,
  timecode_start int,
  timecode_end int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id::text,
    c.lesson_id::text,
    c.content::text,
    c.timecode_start::int,
    c.timecode_end::int,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  FROM content_chunk c
  WHERE
    c.embedding IS NOT NULL
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
    AND (
      filter_lesson_prefix IS NULL
      OR c.lesson_id LIKE filter_lesson_prefix || '%'
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_chunks(vector(1536), float, int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION match_chunks(vector(1536), float, int, text) TO service_role;

-- ============================================
-- Test query (run after creating function)
-- ============================================
--
-- SELECT * FROM match_chunks(
--   (SELECT embedding FROM content_chunk LIMIT 1),  -- Use an existing embedding as test
--   0.5,  -- threshold
--   5,    -- limit
--   '01_analytics'  -- lesson prefix filter (or NULL for all)
-- );
--
-- ============================================

-- HNSW index already exists (created during data ingestion):
-- CREATE INDEX idx_content_chunk_embedding
-- ON content_chunk USING hnsw (embedding vector_cosine_ops);
--
-- HNSW is faster than IVFFlat and works well with the match_chunks function.

-- Verify function was created
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'match_chunks';
