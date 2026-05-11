# scripts/vision-ingest/

Phase 55 Sprint 2B — production vision indexing pipeline.

Throwaway PoC scripts live in `scripts/vision-poc/` (Sprint 1 reference).
This folder is the production-grade evolution.

## Pipeline

0. Setup env vars:
   - `OPENROUTER_VISION_KEY` — OpenRouter API key (vision + embeddings)
   - `SUPABASE_MGMT_TOKEN` — for SQL queries (lesson lookup)
   - `SUPABASE_PROJECT_REF` — `saecuecevicwjkpmaoot`
   - `SUPABASE_SERVICE_ROLE_KEY` — for Storage upload + content_chunk INSERT
   - `DATABASE_URL` — Postgres direct connection (already in .env)

1. Select 10 pilot lessons:
   ```bash
   npx tsx scripts/vision-ingest/select-pilot-lessons.ts
   ```
2. Extract frames:
   ```bash
   npx tsx scripts/vision-ingest/extract-frames-prod.ts
   ```
3. Perceptual hash dedup:
   ```bash
   npx tsx scripts/vision-ingest/dedup-frames.ts
   ```
4. VLM describe:
   ```bash
   npx tsx scripts/vision-ingest/vlm-describe.ts
   ```
5. Upload frames to Supabase Storage:
   ```bash
   npx tsx scripts/vision-ingest/upload-frames-storage.ts
   ```
6. Embed and INSERT:
   ```bash
   npx tsx scripts/vision-ingest/embed-and-insert.ts
   ```

## Outputs

- `results/selected-pilot-lessons.json` — committed
- `results/frames/` — gitignored (binary)
- `results/frames-manifest.json` — gitignored
- `results/vlm-runs.json` — gitignored
- `results/decision.md` — committed (gate verdict)
- `results/pilot-qna-checklist.md` — committed (Mila/owner Q&A)

## Dependencies

- `ffmpeg` + `ffprobe` in PATH
- Node `sharp` package (perceptual hash via `sharp` + bundled hash)
- See package.json — add `sharp` if not yet present
