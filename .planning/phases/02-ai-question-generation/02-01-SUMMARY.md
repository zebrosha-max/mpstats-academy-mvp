---
phase: 02-ai-question-generation
plan: 01
subsystem: ai
tags: [openrouter, zod, json-schema, llm, question-generation, structured-output]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "content_chunk table with 5291 RAG chunks, COURSE_SKILL_MAP, @mpstats/shared types"
provides:
  - "generateDiagnosticQuestions() function with per-category parallel LLM generation"
  - "Zod + JSON Schema validation pipeline for structured LLM output"
  - "100-question mock bank (20 per category) with getMockQuestionsForCategory()"
  - "Seed script for AI-regenerating mock questions"
affects: [02-02-PLAN, diagnostic-router, diagnostic-session]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-category-parallel-generation, model-fallback-chain, option-shuffle-debias, structured-output-json-schema]

key-files:
  created:
    - packages/ai/src/question-schema.ts
    - packages/ai/src/question-generator.ts
    - scripts/seed/seed-mock-questions.ts
  modified:
    - packages/ai/src/index.ts
    - packages/ai/package.json
    - packages/api/src/mocks/questions.ts

key-decisions:
  - "question-generator accepts fallbackFn callback to avoid circular dep with @mpstats/api"
  - "FINANCE category (empty CATEGORY_TO_COURSES) always uses mock fallback"
  - "Options shuffled after LLM generation to avoid correctIndex bias"
  - "Added @mpstats/shared as workspace dependency to @mpstats/ai"

patterns-established:
  - "Model fallback chain: primary -> fallback -> throw (caller provides mock)"
  - "Per-category Promise.allSettled with independent fallback per category"
  - "Zod validation as safety net after JSON Schema structured output"
  - "Fisher-Yates shuffle for unbiased randomization"

# Metrics
duration: 10min
completed: 2026-02-17
---

# Phase 02 Plan 01: AI Question Generation Service Summary

**Per-category parallel LLM question generation with Zod validation, model fallback chain, and 100-question mock bank**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-17T09:13:42Z
- **Completed:** 2026-02-17T09:23:36Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built question-generator.ts with per-category parallel LLM generation via Promise.allSettled
- Created Zod + JSON Schema validation pipeline for structured LLM output
- Expanded mock question bank from 25 to 100 questions (20 per category)
- Created seed script for AI-regenerating mock questions with --dry-run and --output flags

## Task Commits

Each task was committed atomically:

1. **Task 1: Zod schema, JSON schema, and question generator service** - `9c10958` (feat)
2. **Task 2: Expanded 100-question mock bank and seed script** - `2581b18` (feat)

## Files Created/Modified
- `packages/ai/src/question-schema.ts` - Zod schema + JSON Schema for structured LLM output
- `packages/ai/src/question-generator.ts` - Core generation with per-category parallel execution and model fallback
- `packages/ai/src/index.ts` - Re-exports for new modules
- `packages/ai/package.json` - Added @mpstats/shared workspace dependency
- `packages/api/src/mocks/questions.ts` - 100-question fallback bank with getMockQuestionsForCategory
- `scripts/seed/seed-mock-questions.ts` - AI-powered seed script for regenerating questions

## Decisions Made
- **fallbackFn callback pattern:** question-generator.ts accepts a `fallbackFn` parameter instead of importing from @mpstats/api directly, avoiding circular dependency between packages
- **@mpstats/shared dependency:** Added workspace dependency to @mpstats/ai since question-generator needs DiagnosticQuestion and SkillCategory types
- **Import style consistency:** Used extensionless imports (matching existing code in generation.ts, retrieval.ts) instead of .js extensions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @mpstats/shared workspace dependency to @mpstats/ai**
- **Found during:** Task 1 (question-generator.ts creation)
- **Issue:** @mpstats/ai did not have @mpstats/shared as a dependency, causing "Cannot find module" error on typecheck
- **Fix:** Added `"@mpstats/shared": "workspace:*"` to packages/ai/package.json, ran pnpm install
- **Files modified:** packages/ai/package.json, pnpm-lock.yaml
- **Verification:** `pnpm --filter @mpstats/ai typecheck` passes
- **Committed in:** 9c10958 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary dependency addition for types. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- question-generator.ts ready for integration into diagnostic router (Plan 02)
- getMockQuestionsForCategory() exported and tested for fallback mechanism
- Plan 02 will wire generateDiagnosticQuestions() into diagnostic.startSession()

---
*Phase: 02-ai-question-generation*
*Completed: 2026-02-17*
