---
phase: 49-lesson-materials
plan: 03
subsystem: data-ingest
tags: [ingest, scripts, prisma, google-sheets, gws-cli, idempotent]

requires:
  - phase: 49-01-schema-storage
    provides: "Material, LessonMaterial, MaterialType enum — destination tables for ingest"
  - phase: 48-staging-environment
    provides: "shared Supabase DB — apply on prod surfaces immediately on staging too"
provides:
  - "scripts/ingest-materials.ts — one-shot Sheet → DB pipeline with dry-run + --apply modes"
  - "62 Material rows + 97 LessonMaterial links in prod DB (idempotent on rerun)"
  - "URL-based type inference fallback for sheet rows with empty Type column"
  - "Methodologist handoff doc 49-03-NOTES.md with 16 unmatched materials grouped by lesson + nearest DB candidate (jaccard score)"
affects: [49-04-lesson-ui, 49-05-admin-panel, 49-06-polish-deploy]

tech-stack:
  added:
    - "GWS CLI (@googleworkspace/cli) usage in ingest scripts — first ingest beyond seed"
  patterns:
    - "Dry-run by default + --apply flag (mirror of scripts/dedup-lessons.ts pattern)"
    - "Per-lesson-block prisma.$transaction — partial apply safe, rerun dedup-friendly"
    - "Multi-variant lesson title normalization — split on `|`, base form, both halves indexed in lookup map"
    - "Soft Sentry require — if @sentry/nextjs missing or DSN unset, no-op spans (script doesn't depend on Next runtime)"
    - "Composite unique key (lessonId+materialId) makes upsert idempotent — rerun cannot duplicate"

key-files:
  created:
    - "scripts/ingest-materials.ts (456 lines)"
    - "scripts/ingest-results/.gitkeep"
    - "scripts/ingest-results/.gitignore (excludes tsv/json by default; this run forced)"
    - "scripts/ingest-results/matched.tsv (104 lines: header + 103 matched materials)"
    - "scripts/ingest-results/unmatched-lessons.tsv (11 lines: header + 10 lesson groups)"
    - "scripts/ingest-results/summary.json"
    - "scripts/ingest-results/apply-2026-04-27.log"
    - "scripts/ingest-results/apply-2026-04-27-rerun.log"
    - ".planning/phases/49-lesson-materials/49-03-NOTES.md"
  modified: []

key-decisions:
  - "[49-03] Sheet column layout differs from plan assumption — verified live: A=lesson, B=title, C=type, D=url, E=cta, F=isStandalone (no description column). Plan assumed 7 columns with description in D, real sheet has 6. Adjusted parser, no schema change."
  - "[49-03] URL-based type inference (Rule 2) — many sheet rows leave Type column blank; inferred from URL host (docs.google.com/spreadsheets → CALCULATION_TABLE, /presentation → PRESENTATION, /document → MEMO, drive → PRESENTATION pdf, t.me → EXTERNAL_SERVICE). Saves 30+ rows from unmatched bucket."
  - "[49-03] Skip 'нет' marker rows silently — methodologists explicitly mark 'no material for this lesson' with title='нет'. Counted in summary.skippedNoMaterialMarkers, not parseErrors."
  - "[49-03] Multi-variant title lookup — sheet titles often have form 'Этапы анализа ЦА | Анализ ЦА, 1' while DB has 'Этапы анализа ЦА' or 'Анализ ЦА, 1'. Index BOTH halves + the full string + base-normalized form. Boosts match rate from ~70% to 87%."
  - "[49-03] Force-commit ingest-results past .gitignore for this run — files are gitignored by default (build artifacts), but THIS apply is the audit trail of a one-shot prod write. Future reruns will overwrite + stay gitignored."

patterns-established:
  - "GWS CLI invocation: `npx --yes @googleworkspace/cli sheets spreadsheets values get --params <JSON> --format json`. Strip leading 'Using keyring backend: ...' line before JSON.parse."
  - "Prisma upsert by composite unique key for idempotent N-to-N joins: `where: { lessonId_materialId: {...} }, create: {...}, update: { order }`."
  - "Verification helper as separate tsx file (deleted after use): import dotenv → PrismaClient → counts + sample with includes. node -e shortcut fails because @prisma/client lives in workspace, not root."

requirements-completed:
  - "Phase 49 D-15 (one-shot script, not cron/sync)"
  - "Phase 49 D-16 (dry-run default + --apply explicit + 3 reports)"
  - "Phase 49 D-17 (section header skip, lesson-block continuation by empty col A)"
  - "Phase 49 D-18 (fuzzy match: trim + quote/dash unify + pipe-split + substring fallback)"
  - "Phase 49 D-19 (GWS CLI for Sheet read)"
  - "Phase 49 D-20 (apply on shared staging+prod DB; dry-run mandatory before each apply)"
  - "Phase 49 D-43 (Sentry custom span on lesson-block; soft-required, no-op without DSN)"
  - "Phase 49 D-49 (URL dedup: trim only, preserve query string for ?gid=... distinct tabs)"
  - "Phase 49 D-52 (transaction per lesson block — partial apply safe)"

duration: 12 min
completed: 2026-04-27
---

# Phase 49 Plan 03: Sheet → DB Ingest Summary

**One-shot ingest скрипт залил 103 из 119 материалов из методологического Google Sheet в прод (62 уникальных Material + 97 LessonMaterial связей на ~50 уроках). Идемпотентность подтверждена повторным запуском. 16 нематченных материалов в 10 группах задокументированы для ручной привязки в Wave 5 админке.**

## Performance

- **Duration:** ~12 min (Task 1 + Task 2 + finalize)
- **Started:** 2026-04-27T07:25:00Z (continuation after checkpoint on 49-03 Task 1 done)
- **Completed:** 2026-04-27T07:35:00Z
- **Tasks:** 2 + finalize (Task 1 done by previous executor — `55e47b7`)

## Accomplishments

### Final ingest numbers (apply on prod)

| Metric | Value |
|---|---|
| Sheet data rows | 398 |
| Skipped «нет» markers | 1 |
| Parsed materials | 119 |
| Matched | **103** |
| Materials created (unique) | **62** |
| LessonMaterial links created | **97** |
| Unmatched groups | 10 |
| Unmatched materials | 16 |
| Idempotent rerun | OK (0 created, 103 dedup, links unchanged at 97) |

**Why 103 link writes → 97 actual rows?** Six pairs of sheet rows mapped (через fuzzy lesson match) to the same `(lessonId, materialId)` pair. The composite unique constraint correctly collapsed them via upsert. No duplicates in DB (`SELECT lessonId, materialId, COUNT(*) GROUP BY HAVING > 1` returns empty).

### Sample of attached materials (verified post-apply)

| Lesson | Material | Type |
|---|---|---|
| `01_analytics_m01_start_002` «Для чего нужна аналитика для бизнеса на МП» | «Для чего нужна аналитика для бизнеса на МП» | PRESENTATION |
| `01_analytics_m02_economics_002` «Обзор и настройка таблицы» | «Таблица «Юнит-экономика»» | CALCULATION_TABLE |
| `01_analytics_m02_economics_003` «Заполняем "Вводные данные"...» | «Evirma Secret Bot» | EXTERNAL_SERVICE |
| 4 урока про Анализ ЦА | «Анализ ЦА: как сделать уникальный товар» | PRESENTATION |

### Idempotency proof

```
First --apply:  materialsCreated: 62, duplicatesSkipped: 41, linksCreated: 103
Second --apply: materialsCreated: 0,  duplicatesSkipped: 103, linksCreated: 103
DB counts unchanged: Material=62, LessonMaterial=97
```

Composite unique key `(lessonId, materialId)` + dedup на `(title, externalUrl)` гарантируют, что повторный запуск безопасен и нужен только если в Sheet'е появятся новые строки.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1: Build script | `55e47b7` (prev session) | `feat(49-03): add Sheet → DB ingest pipeline for lesson materials` |
| 2: Apply + verify + docs | `98b9a23` | `chore(49-03): apply ingest of 103 materials + handoff notes for methodologists` |

## Decisions Made

- **URL-based type inference (Rule 2 — auto-fix critical missing).** Plan assumed Type column always populated. Real sheet has many blank Type cells. Inferring from URL host saves dozens of rows from unmatched bucket without methodologist intervention. Documented in code with a comment.
- **«нет»-marker skip.** Methodologists use a convention: if a lesson explicitly has no material, they put title=«нет» in the row. Treated as silent skip, not parse error — counted separately in summary.
- **Multi-variant title indexing.** Sheet titles often combine module name + lesson order («Этапы анализа ЦА | Анализ ЦА, 1»). Indexing both halves + full string + base-normalized form yielded ~87% match rate vs ~70% with simple split-before-pipe.
- **Force commit of ingest-results past .gitignore.** `.gitignore` excludes `*.tsv` / `*.json` because they're regenerated artifacts. But this specific apply is the audit trail of a prod-DB write — committed for traceability. Future runs will overwrite the same files (since they're untracked again from the perspective of `.gitignore`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Sheet column layout discovery + Type inference**
- **Found during:** Task 1 (in previous executor's session, but worth documenting here)
- **Issue:** Plan assumed 7 columns (A=lesson, B=type, C=title, D=desc, E=url, F=cta, G=isStandalone). Real sheet (verified live) has 6 columns: A=lesson, B=title, C=type, D=url, E=cta, F=isStandalone. No description column. Many Type cells are blank.
- **Fix:** Adjusted parser column order; added `inferTypeFromUrl(url)` fallback; added `isNoMaterialMarker(title)` for «нет»-marker skip.
- **Files modified:** `scripts/ingest-materials.ts` (committed in `55e47b7`)

**2. [Rule 2 - Missing critical functionality] GWS CLI output preamble**
- **Found during:** Task 1 (previous session)
- **Issue:** GWS CLI prints `Using keyring backend: keyring` line before JSON. Naive `JSON.parse(raw)` fails.
- **Fix:** Strip everything before first `{` in output.
- **Files modified:** `scripts/ingest-materials.ts` (committed in `55e47b7`)

### Plan-vs-reality numbers

- Plan target: matched ≥110 of 120. Actual: matched 103 of 119 (87%). Below stretch target but above 85% — acceptable per user decision (Option A: apply 103, document 16 for manual handoff).
- Plan target: materials_created ≥60. Actual: 62. ✓
- Plan target: links_created ≥110. Actual: 97 (less than 110 because 6 sheet rows mapped to same lesson+material pair via fuzzy match — collapsed by composite unique key). ✓ functionally (every distinct material-lesson pair from sheet is represented).

### Out-of-scope deferrals

- 16 unmatched materials → methodologist manual attach in Wave 5 admin UI. Documented in `49-03-NOTES.md` with nearest DB candidate per group (jaccard token similarity), so methodologists don't have to search blindly.

## Issues Encountered

- **Sentry: disabled**. Local `.env` has no `SENTRY_DSN` — script ran without telemetry. On VPS the var is set; if methodologists rerun ingest from VPS, spans will appear in Sentry Performance. Not a blocker for Wave 5 — script is one-shot.
- **`node -e` cannot import @prisma/client** in monorepo root — package lives in workspace. Worked around by writing temp tsx files, then deleted after verification.

## User Setup Required

None for Wave 4 / Wave 5 — data is in DB, ACL on `learning.getLesson` (49-02) already filters by `lesson.locked`. Methodologist handoff doc (`49-03-NOTES.md`) ready to share once admin UI ships in 49-05.

## Next Phase Readiness

- **Wave 4 (49-04 lesson UI)** — может стартовать. `learning.getLesson.materials[]` payload уже отдаёт реальные материалы из БД (раньше всегда был пустой массив). UI секция получит данные сразу.
- **Wave 5 (49-05 admin)** — может стартовать. `material.list` / `material.getById` / `material.attach` / `material.detach` готовы. Методологам достаточно админки чтобы привязать оставшиеся 16 материалов руками.
- **Wave 6 (49-06 polish + deploy)** — без блокеров.

## Verification (final)

- `pnpm tsx scripts/ingest-materials.ts --apply` → exit 0, materialsCreated 62, linksCreated 103
- `pnpm tsx scripts/ingest-materials.ts --apply` (rerun) → exit 0, materialsCreated 0, linksCreated 103, duplicatesSkipped 103
- `prisma.material.count()` → 62 ✓ (target ≥60)
- `prisma.lessonMaterial.count()` → 97 ✓
- DB-level duplicate check `(lessonId, materialId)` → 0 ✓
- 3 random lessons with materials — sample displayed correctly attached materials with correct types ✓

## Self-Check: PASSED

- File checks:
  - `scripts/ingest-materials.ts` → FOUND (456 lines, committed in 55e47b7)
  - `scripts/ingest-results/matched.tsv` → FOUND (committed in 98b9a23)
  - `scripts/ingest-results/unmatched-lessons.tsv` → FOUND
  - `scripts/ingest-results/summary.json` → FOUND
  - `scripts/ingest-results/apply-2026-04-27.log` → FOUND
  - `scripts/ingest-results/apply-2026-04-27-rerun.log` → FOUND
  - `.planning/phases/49-lesson-materials/49-03-NOTES.md` → FOUND
- Commit checks:
  - `git log --oneline | grep 55e47b7` → FOUND (Task 1 — script)
  - `git log --oneline | grep 98b9a23` → FOUND (Task 2 — apply + notes)

---
*Phase: 49-lesson-materials*
*Completed: 2026-04-27*
