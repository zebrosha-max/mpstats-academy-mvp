---
phase: 23-diagnostic-2-0
plan: 01
subsystem: database, ai
tags: [prisma, openrouter, zod, llm-tagging, multi-category, topic-clustering]

# Dependency graph
requires:
  - phase: sprint-3-rag
    provides: content_chunk table with 5291 chunks, OpenRouter client, Supabase integration
provides:
  - Lesson model with multi-category skillCategories and free-form topics fields
  - DiagnosticAnswer model with sourceData Json field for question-to-content tracing
  - Extended DiagnosticQuestion type with sourceChunkIds, sourceLessonIds, sourceTimecodes
  - SectionedLearningPath and LearningPathSection interfaces with backward-compat parser
  - LLM tagging module (tagLesson, fetchLessonChunks, clusterTopics)
  - One-time tagging script for all 405 lessons (scripts/tag-lessons.ts)
affects: [23-02 question tracing, 23-03 path generation, 23-04 frontend accordion]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-stage-llm-pipeline, multi-category-json-field, backward-compat-json-parser]

key-files:
  created:
    - packages/ai/src/tagging.ts
    - scripts/tag-lessons.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/shared/src/types/index.ts
    - packages/ai/src/index.ts
    - package.json

key-decisions:
  - "Keep single skillCategory alongside new skillCategories Json for backward compat (8+ consumers)"
  - "Tagging.ts has own OpenRouter/Supabase clients (no server-only import) for CLI script compatibility"
  - "Two-stage topic pipeline: LLM free tagging then LLM clustering into canonical dictionary"

patterns-established:
  - "Multi-category Json fields alongside single enum for gradual migration"
  - "parseLearningPath() detects old string[] vs new SectionedLearningPath format"
  - "CLI-safe AI module pattern: duplicate client init without server-only import"

requirements-completed: [DIAG-01, DIAG-02, DIAG-03]

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 23 Plan 01: Data Foundation Summary

**Prisma schema extended with multi-category and topic fields, shared types with source tracing and sectioned path, LLM tagging script with two-stage pipeline (per-lesson tagging + topic clustering)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-16T14:42:54Z
- **Completed:** 2026-03-16T14:46:44Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Lesson model now supports 1-3 skillCategories (multi-category) and 2-5 free-form topics as Json fields
- DiagnosticAnswer model has sourceData Json field for question-to-content tracing
- DiagnosticQuestion type extended with optional source tracing fields (sourceChunkIds, sourceLessonIds, sourceTimecodes)
- SectionedLearningPath interface with backward-compat parser for old string[] format
- Complete LLM tagging pipeline: tagLesson + clusterTopics in packages/ai/src/tagging.ts
- Ready-to-run script: `pnpm tag-lessons` to tag all 405 lessons (~$0.05 cost)

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + shared types extension** - `1a3b723` (feat)
2. **Task 2: LLM lesson tagging script with two-stage topic pipeline** - `3534a81` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added skillCategories, topics on Lesson; sourceData on DiagnosticAnswer
- `packages/shared/src/types/index.ts` - Extended DiagnosticQuestion, added SectionedLearningPath + parseLearningPath
- `packages/ai/src/tagging.ts` - LLM tagging module (tagLesson, fetchLessonChunks, clusterTopics)
- `packages/ai/src/index.ts` - Export tagging module
- `scripts/tag-lessons.ts` - Two-stage tagging script (LLM per-lesson + topic clustering)
- `package.json` - Added tag-lessons script

## Decisions Made
- Kept single `skillCategory` enum alongside new `skillCategories` Json for backward compatibility (8+ consumers depend on single field)
- Created tagging.ts with its own OpenRouter/Supabase client initialization (without `server-only` import) to support CLI script execution outside Next.js
- Two-stage topic pipeline: Stage 1 tags freely, Stage 2 clusters into canonical dictionary via single LLM call

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tagging module uses own client init instead of importing from openrouter.ts/retrieval.ts**
- **Found during:** Task 2 (tagging module creation)
- **Issue:** `openrouter.ts` and `retrieval.ts` both have `import 'server-only'` which prevents use in CLI scripts run with `npx tsx`
- **Fix:** Created independent lazy-initialized OpenRouter and Supabase clients in `tagging.ts` using same configuration pattern
- **Files modified:** packages/ai/src/tagging.ts
- **Verification:** `npx tsc --noEmit` passes for ai package, script loads successfully
- **Committed in:** 3534a81

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for CLI script compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. User runs `pnpm tag-lessons` when ready (requires existing OPENROUTER_API_KEY in .env).

## Next Phase Readiness
- Schema ready for `prisma db push` to apply new fields to Supabase
- Tagging script ready to run: `pnpm tag-lessons` (or `pnpm tag-lessons --dry-run` to preview)
- After tagging, all 405 lessons will have multi-categories, topics, and LLM-assigned difficulty
- Plan 23-02 can proceed with question source tracing using the new DiagnosticQuestion fields

---
*Phase: 23-diagnostic-2-0*
*Completed: 2026-03-16*
