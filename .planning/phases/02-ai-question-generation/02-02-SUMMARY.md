---
phase: 02-ai-question-generation
plan: 02
subsystem: api
tags: [rate-limiting, fallback, diagnostic, llm-integration, loading-ui]

# Dependency graph
requires:
  - phase: 02-ai-question-generation
    plan: 01
    provides: "generateDiagnosticQuestions() with per-category LLM generation and fallbackFn callback"
provides:
  - "Diagnostic router with AI question generation, rate limiting, and triple fallback chain"
  - "Loading UI with contextual AI generation messaging"
affects: [diagnostic-flow, frontend-ux]

# Tech tracking
tech-stack:
  added: []
  patterns: [sliding-window-rate-limiter, triple-fallback-chain, slow-hint-ux]

key-files:
  created: []
  modified:
    - packages/api/src/routers/diagnostic.ts
    - apps/web/src/app/(main)/diagnostic/session/page.tsx

key-decisions:
  - "Rate limiter stored in globalThis Map (same pattern as activeSessionQuestions) for hot-reload persistence"
  - "Triple fallback: AI per-category -> mock per-category (via fallbackFn) -> full mock (getBalancedQuestions)"

patterns-established:
  - "Sliding window rate limiter: in-memory Map<userId, timestamps[]> with configurable window"
  - "Slow hint UX: show secondary text after 3s timeout during async operations"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 02 Plan 02: Diagnostic Router Integration Summary

**AI question generation wired into startSession with 50/hour rate limiter, triple fallback chain, and contextual loading UI**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T09:26:30Z
- **Completed:** 2026-02-17T09:28:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Integrated generateDiagnosticQuestions into diagnostic router startSession mutation
- Added sliding window rate limiter (50 req/hour per user) with globalThis persistence
- Built triple fallback chain ensuring diagnostic never fails even if LLM is unavailable
- Updated loading UI with "Готовим вопросы..." message and slow-connection hint after 3s

## Task Commits

Each task was committed atomically:

1. **Task 1: Rate limiter and async question generation in diagnostic router** - `4355667` (feat)
2. **Task 2: Loading state UI for question generation** - `f45b4eb` (feat)

## Files Created/Modified
- `packages/api/src/routers/diagnostic.ts` - Rate limiter, AI generation with fallback in startSession
- `apps/web/src/app/(main)/diagnostic/session/page.tsx` - Contextual loading state with slow hint

## Decisions Made
- **Rate limiter in globalThis:** Same persistence pattern as activeSessionQuestions Map, survives Next.js hot reloads
- **Triple fallback chain:** AI per-category (via generateDiagnosticQuestions) -> mock per-category (via fallbackFn callback) -> full mock (getBalancedQuestions) as outer safety net

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Diagnostic flow fully integrated with AI question generation
- Phase 02 (AI Question Generation) complete
- Ready for Phase 03 (Adaptive Engine / Diagnostic UI improvements)

---
*Phase: 02-ai-question-generation*
*Completed: 2026-02-17*
