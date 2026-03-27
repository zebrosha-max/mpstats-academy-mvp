---
phase: 39-ai-content-quality
plan: 01
subsystem: ai, ui
tags: [regex, brand-names, timecode, seek, vitest, kinescope]

requires:
  - phase: 23-diagnostic-v2
    provides: DiagnosticHint component with timecodes
provides:
  - fixBrandNames regex post-processing for AI output
  - Visual timecode highlight in DiagnosticHint
  - playerRef.seekTo integration for DiagnosticHint
affects: [ai-generation, lesson-page, diagnostic-hints]

tech-stack:
  added: [vitest config for packages/ai]
  patterns: [post-processing regex on LLM output, visual feedback on click with auto-clear timeout]

key-files:
  created:
    - packages/ai/src/__tests__/generation.test.ts
    - packages/ai/vitest.config.ts
  modified:
    - packages/ai/src/generation.ts
    - apps/web/src/components/diagnostic/DiagnosticHint.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx

key-decisions:
  - "Do NOT replace Ozon — valid Russian spelling, only Wildberries transliterations are incorrect"
  - "scrollIntoView block:'start' for DiagnosticHint (below fold, user explicitly wants to see video)"
  - "SourceTooltip already correct — uses onSeek + scrollIntoView via handleTimecodeClick, no changes needed"

patterns-established:
  - "fixBrandNames post-processing: apply regex after LLM response, before returning to client"
  - "Visual click feedback: useState + setTimeout 800ms auto-clear pattern for button highlight"

requirements-completed: [R42, R17, R18]

duration: 5min
completed: 2026-03-27
---

# Phase 39 Plan 01: AI Content Quality Summary

**fixBrandNames regex post-processing for AI responses + DiagnosticHint timecode seek via playerRef with amber highlight feedback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T10:22:57Z
- **Completed:** 2026-03-27T10:28:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- AI responses now replace Russian transliterations (Валберес, Вайлдберриз, etc.) with Wildberries
- Both system prompts (summary + chat) contain brand instruction for LLM guidance
- DiagnosticHint timecode buttons use playerRef.seekTo instead of direct iframe postMessage
- Clicking timecode scrolls to video player and highlights button amber for 800ms
- 9 unit tests for fixBrandNames regex covering all transliteration variants

## Task Commits

Each task was committed atomically:

1. **Task 1: Brand name fix (TDD)** - `39fb43c` (feat) — fixBrandNames function + system prompts + 9 unit tests
2. **Task 2: Timecode seek fix** - `e9736ec` (fix) — playerRef.seekTo + scrollIntoView + amber highlight

## Files Created/Modified
- `packages/ai/src/generation.ts` - Added fixBrandNames export, brand instruction in both system prompts, applied to both LLM responses
- `packages/ai/src/__tests__/generation.test.ts` - 9 unit tests for brand name regex
- `packages/ai/vitest.config.ts` - Vitest config for packages/ai (was missing)
- `apps/web/src/components/diagnostic/DiagnosticHint.tsx` - activeTimecode state, handleSeek with 800ms highlight, transition-colors duration-300
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - DiagnosticHint onSeek uses playerRef.seekTo + scrollIntoView block:'start'

## Decisions Made
- Do NOT replace "Озон" with "Ozon" — it's valid Russian spelling per research
- SourceTooltip already uses handleTimecodeClick (playerRef.seekTo + scrollIntoView) — no changes needed
- Use `block: 'start'` for DiagnosticHint scroll (user explicitly wants to see video, hint is below fold)
- Use string key `${hintIndex}-${timecodeIndex}` for activeTimecode to handle multiple hints with expanded view

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- vitest not installed in packages/ai — created vitest.config.ts with root pointing to packages/ai, ran via apps/web npx vitest
- `server-only` import in openrouter.ts blocks vitest — mocked via `vi.mock('server-only', () => ({}))`
- Pre-existing TypeScript error in `landing.spec.ts` (Playwright types) — out of scope, not related to changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AI content quality fixes complete, ready for Plan 39-02 (if exists)
- fixBrandNames can be extended with more brand patterns as needed

---
*Phase: 39-ai-content-quality*
*Completed: 2026-03-27*
