-- ============================================================
-- Fix search_path mutable warnings for Supabase linter
-- ============================================================
-- Both functions need SET search_path = '' to prevent
-- search_path injection attacks (Supabase lint 0011).
-- ============================================================

-- 1. Fix match_chunks: add SET search_path = ''
-- Must use fully-qualified table names with search_path = ''
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding extensions.vector(1536),
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
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id::text,
    c.lesson_id::text,
    c.content::text,
    c.timecode_start::int,
    c.timecode_end::int,
    (1 - (c.embedding OPERATOR(extensions.<=>) query_embedding))::float as similarity
  FROM public.content_chunk c
  WHERE
    c.embedding IS NOT NULL
    AND (1 - (c.embedding OPERATOR(extensions.<=>) query_embedding)) > match_threshold
    AND (
      filter_lesson_prefix IS NULL
      OR c.lesson_id LIKE filter_lesson_prefix || '%'
    )
  ORDER BY c.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Fix handle_new_user: add SET search_path = ''
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public."UserProfile" (id, "createdAt", "updatedAt")
  VALUES (new.id, NOW(), NOW());
  RETURN new;
END;
$$;
