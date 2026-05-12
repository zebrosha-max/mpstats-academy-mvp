# Phase 55 Sprint 2C — Vision RAG Expansion Decision

**Date:** 2026-05-11
**Branch:** `phase-55-sprint-2c`
**Scope:** Extend vision RAG coverage from 10 pilot lessons → 89 lessons of course `03_ai` (all visible, unprocessed).
**Verdict:** **GO Sprint 3** — smoke accuracy 88.9% (16/18) exceeds pilot baseline (84%) and threshold (80%). Pipeline scales cleanly; ready to roll out to full platform (440 lessons).

---

## Pipeline Metrics

| Метрика | Pilot (Sprint 2B) | Sprint 2C | Delta |
|---------|-------------------|-----------|-------|
| Lessons processed | 10 | 79 | +79 |
| Lessons total in DB with frames | 10 | 89 | +79 |
| Frames extracted (raw) | 185 | 762 | +577 |
| Frames after phash dedup | 148 | 644 | +496 |
| Dedup ratio | 20.0% | 15.5% | — |
| VLM cost | $0.2254 | $0.9388 | +$0.71 |
| VLM model | gpt-4.1-mini | gpt-4.1-mini | — |
| VLM errors (final) | 0 | 0 (25 retried via resume) | — |
| Embedding cost | ~$0.0002 | ~$0.0009 | — |
| **Total cost** | $0.2256 | **$0.9397** | +$0.71 |
| Frame chunks in DB | 148 | 792 (148 pilot + 644 new) | +644 |
| Storage objects in `lesson-frames` | 148 | 792 | +644 |

Within $2 budget per phase-55 sprint2c plan.

---

## Success Criteria

| SC | Criterion | Status | Evidence |
|----|-----------|--------|----------|
| SC1 | Selection covers 100% visible-unprocessed 03_ai lessons | ✅ | 79/79 (v1→v3 iter + manual override for m01/m08) |
| SC2 | Pipeline runs to completion w/o errors | ✅ | 0 ffmpeg, 0 VLM (after retry), 0 upload, 0 INSERT errors |
| SC3 | Cost ≤$2 | ✅ | $0.94 (53% under budget) |
| SC4 | Smoke accuracy ≥80% on 18 questions | ✅ | 88.9% (16/18) |
| SC5 | Pipeline idempotent / resumable | ✅ | VLM step rewritten with JSONL resume; mid-flight kill recovered cleanly |

---

## Smoke Test Methodology

6 newly-ingested lessons × 3 questions = 18 Q&A. Questions authored from VLM-generated frame summaries (ground truth = "what's on screen per the frame analyzer"). Categories:
- **url-tool** (6): specific URLs, tool names, UI elements visible on screen
- **number-metric** (6): specific numbers, prices, percentages
- **hybrid** (6): audio context + visual confirmation

Lessons picked (diverse modules):
- `03_ai_m02_neuroanalytics_003`, `03_ai_m03_visual_008`, `03_ai_m04_neurovideo_012`
- `03_ai_m05_neurotexts_002`, `03_ai_m07_neuroscout_003`, `03_ai_m08_neurointegrator_006`

Model: `openai/gpt-4.1-mini` (production default).

### Per-category results

| Категория | Y / P / N | Accuracy |
|-----------|-----------|----------|
| url-tool | 6 / 0 / 0 | **100%** |
| number-metric | 6 / 0 / 0 | **100%** |
| hybrid | 4 / 0 / 2 | 66.7% |
| **Total** | **16 / 0 / 2** | **88.9%** |

### Notable failures (both same pattern)

- **Q15 (m07 hybrid):** "критерии хорошей подниши" — retrieval returned 0 chunks despite content being in frames at tc 09:00/10:00. Frame summaries mention низкая насыщенность ~20 продавцов, FBO, не сезонный — embedding miss on abstract criteria query without lexical anchor.
- **Q18 (m08 hybrid):** "финальная самопроверка" — frame at tc 27:00 has verbatim chip-list (Title ≤60, Описание ≤2000), retrieval didn't surface it.

**Root cause:** abstract "list/criteria" hybrid questions lack strong lexical anchors (URLs/numbers/brand names). Already in **Phase 56 backlog**: query expansion + hybrid re-ranking.

### Latency

Within Sprint 2 production envelope (4-6s avg). url-tool 6.7s, number-metric 5.7s, hybrid 5.3s — no regression.

---

## What Changed in the Pipeline

### Selector evolution (`select-sprint2c-lessons.ts` + v2/v3 + apply-manual-overrides.ts)
- v1 (word-overlap LIKE): 53/79 (67% recall). Failed on multi-row LIKE results and Latin-only title terms.
- v2 (greedy bipartite scoring): 79/79 nominal coverage but ~6 wrong assignments in m03_visual (overlapping vocabulary).
- v3 (positional alphabetic-vs-`order`): 79/79 with 7 of 9 modules high-confidence. m01_intro (interleaved hidden lessons) and m08 (last 3 scrambled) needed manual override.
- `apply-manual-overrides.ts`: hand-verified mappings for m01 (11 files) + m08 (5 files). Final JSON 79/79 exact match against DB.

**Sprint 3 implication:** Sprint 3 will hit 440 lessons across courses with messier naming conventions. The positional approach won't scale alone — need either richer admin metadata (mapping table from Kinescope `assetId` → lessonId) or a 2-pass resolver (positional + LLM disambiguator). Backlog for Phase 56.

### VLM runner rewrite (`vlm-describe.ts`)
- **Before:** serial, no timeout, no resume, no incremental save. First run hung mid-job after frame 142/644.
- **After:** concurrency=5, 60s per-request timeout via AbortController, append-per-frame JSONL save, resume from JSONL skips successful frames on retry. **25 transient errors auto-resumed and recovered in second invocation.** All 644 final responses parsed without fallback.

### Pipeline parametrization (committed `fee68bb`)
- `INGEST_SUFFIX=sprint2c` env var routes all 5 pipeline scripts to suffix-namespaced input/output files. Pilot artifacts untouched. Pattern reusable for Sprint 3.

---

## Backlog → Phase 56 (RAG Quality v1.8+)

Inherited from Sprint 2 decision.md plus new from Sprint 2C smoke:

1. **Hybrid retrieval re-ranking for abstract queries** — Q15/Q18 type: list/criteria queries without lexical anchors don't surface frames. Need query expansion ("критерии" → "критерии, признаки, метрики, требования") OR keyword extraction from frame summaries to boost recall.
2. **Selector v4 for cross-course scale** — positional alone won't survive 440 lessons; explore admin-side filename↔lessonId mapping table or 2-pass resolver.
3. **Hybrid model routing** via `isVisualQuery()` — already prototyped, validate cost/accuracy in prod.
4. **Retrieval miss fix on Q6-type** (specific revenue numbers buried in frames).

---

## Sprint 3 Readiness

GO/NO-GO for Sprint 3 (full platform vision ingest, ~440 lessons across 4 active courses):

- ✅ Pipeline mechanics validated at 8× scale (10 → 89 lessons)
- ✅ Cost projection: $0.94 / 79 lessons = $0.012/lesson → ~$5.2 for 440 lessons (well within next-sprint budget)
- ✅ Accuracy holds at 89% on diverse modules — generalizes beyond pilot's narrow sample
- ⚠ Selector needs Sprint 3 design (positional won't scale across courses with different naming)
- ⚠ Chat disclaimer "не вижу экран" stays in prod until Sprint 3 completes — coverage 89/440 = 20%

**Decision:** Proceed to Sprint 3 planning. Phase 56 (RAG quality) parallel-tracks.

---

## Artifacts

- `scripts/vision-ingest/results/selected-sprint2c-lessons.json` — 79 final selections (committed)
- `scripts/vision-ingest/results/sprint2c-smoke-checklist.md` — 18Q spec + ground truth + per-Q score
- `scripts/vision-ingest/results/sprint2c-smoke.md` — full Q+A transcript with chat answers and sources
- `scripts/vision-ingest/results/vlm-runs-sprint2c.{json,jsonl}` — VLM raw outputs (gitignored)
- `scripts/vision-ingest/results/frames-manifest-sprint2c.json` — manifest (gitignored)
- DB: 644 new frame chunks in `content_chunk` (`source_type='academy_video_frame'`, lesson_ids covering 79 new 03_ai lessons)
- Supabase Storage `lesson-frames`: 644 new jpgs
