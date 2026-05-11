-- Add multi-purpose metadata JSONB column to Lesson.
-- Initial use: { videoSource: { filename, module, localPath, ... } } for vision-RAG
-- ingest pipeline (Phase 55 Sprint 3+). Persists filename↔lesson mappings so
-- selectors don't re-resolve on every sprint.
-- Nullable, backwards-compatible.
ALTER TABLE "Lesson" ADD COLUMN "metadata" JSONB;
