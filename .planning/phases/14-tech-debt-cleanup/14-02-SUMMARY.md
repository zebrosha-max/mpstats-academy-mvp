---
phase: 14-tech-debt-cleanup
plan: 02
subsystem: database, api, ui
tags: [prisma, question-bank, caching, ttl, diagnostic, admin, progressive-loading]

# Dependency graph
requires:
  - phase: 14-tech-debt-cleanup
    plan: 01
    provides: DiagnosticSession.questions Json field, Prisma schema base
  - phase: 01-data-foundation
    provides: SkillCategory enum, DiagnosticQuestion type
provides:
  - QuestionBank model with TTL-based cached AI questions
  - Bank-based instant diagnostic start (no per-session LLM calls)
  - Admin refreshQuestionBank endpoint
  - Progressive loading UX for diagnostic start
affects: [diagnostic, admin-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Question bank caching: DB-cached AI questions with 7-day TTL, non-blocking background refresh"
    - "Progressive loading stages: escalating timer-based text hints for slow operations"

key-files:
  created:
    - packages/api/src/utils/question-bank.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/routers/diagnostic.ts
    - packages/api/src/routers/admin.ts
    - packages/ai/src/question-generator.ts
    - packages/ai/src/index.ts
    - apps/web/src/app/(main)/diagnostic/page.tsx
    - apps/web/src/app/(admin)/admin/content/page.tsx

key-decisions:
  - "TTL = 7 days for question bank freshness without excessive LLM costs"
  - "Bank size = 30 questions per category (150 total) for session variety via random sampling"
  - "Non-blocking background refresh: stale bank triggers async regeneration, serves from mock meanwhile"

patterns-established:
  - "Shared utility pattern: question-bank.ts in packages/api/src/utils/ reused by both diagnostic and admin routers"

requirements-completed: [DEBT-02, DEBT-03]

# Metrics
duration: 5min
completed: 2026-02-27
---

# Phase 14 Plan 02: Question Bank Caching & Progressive Loading Summary

**DB-cached AI question bank with 7-day TTL eliminates per-session LLM calls; progressive loading UX with escalating stage labels; admin force-refresh button**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T14:13:20Z
- **Completed:** 2026-02-27T14:18:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- QuestionBank model stores ~30 AI-generated questions per skill category with 7-day TTL
- startSession reads from cached bank (instant DB read) instead of calling LLM on every diagnostic start
- Stale or missing bank triggers non-blocking background refresh; mock pool supplements when bank is empty
- Admin content page has "Обновить банк вопросов" button showing per-category generation results
- Diagnostic start shows progressive loading stages: "Подготовка вопросов..." -> "Подбираем вопросы..." -> "AI формирует набор..." -> "Почти готово..."

## Task Commits

Each task was committed atomically:

1. **Task 1: Create QuestionBank model and implement bank-based diagnostic start** - `b8f8eeb` (feat)
2. **Task 2: Progressive loading UX for diagnostic start + admin refresh button** - `caeab5a` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added QuestionBank model with @@unique(skillCategory)
- `packages/api/src/utils/question-bank.ts` - New: getQuestionsFromBank, refreshBankForCategory utilities
- `packages/api/src/routers/diagnostic.ts` - startSession uses cached bank instead of direct LLM call
- `packages/api/src/routers/admin.ts` - Added refreshQuestionBank admin mutation
- `packages/ai/src/question-generator.ts` - Added GenerateOptions for categories/count customization
- `packages/ai/src/index.ts` - Exported GenerateOptions type
- `apps/web/src/app/(main)/diagnostic/page.tsx` - Progressive loading stages with timer-based escalation
- `apps/web/src/app/(admin)/admin/content/page.tsx` - Question bank refresh card with per-category results

## Decisions Made
- TTL = 7 days: provides weekly freshness without excessive LLM costs
- Bank size = 30 questions per category: with 3 needed per session, repeat probability is very low (~1/4060)
- Non-blocking refresh: user gets mock questions immediately while bank regenerates in background
- Progressive loading uses text-based stage labels with escalating timeouts (2s, 5s, 10s) instead of progress bar (percentage not estimable)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `pnpm turbo build --filter=@mpstats/web` fails with EPERM symlink error on Windows (pre-existing issue unrelated to changes). Verified via `tsc --noEmit` which passes cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- QuestionBank schema pushed to Supabase
- Phase 14 (Tech Debt Cleanup) is now fully complete
- Bank will auto-populate on first diagnostic start per category

---
*Phase: 14-tech-debt-cleanup*
*Completed: 2026-02-27*
