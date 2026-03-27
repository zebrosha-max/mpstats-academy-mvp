---
phase: 42-diagnostic-prompt-tuning
plan: 01
subsystem: ai
tags: [llm, prompt-engineering, diagnostics, question-generation]

requires:
  - phase: 23-diagnostic-2
    provides: "AI question generation pipeline with sourceIndices"
provides:
  - "Enhanced buildSystemPrompt with 6 rule blocks from QA review"
  - "Category mapping rules for correct axis assignment"
  - "Answer quality, terminology, and style constraints"
affects: [diagnostic, ai]

tech-stack:
  added: []
  patterns:
    - "Structured LLM prompt with explicit topic-to-axis mapping table"
    - "Negative examples section with banned content categories"

key-files:
  created: []
  modified:
    - packages/ai/src/question-generator.ts

key-decisions:
  - "Prompt-only change, no code logic modifications"
  - "Removed old MPSTATS instrument rule (lines 283-284) and replaced with broader D-02 ban on all tools/plugins"
  - "Combined D-05 (terminology) and D-06 (style) into single section for prompt coherence"

patterns-established:
  - "Category mapping table at top of prompt for early LLM context"

requirements-completed: [PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06]

duration: 3min
completed: 2026-03-27
---

# Phase 42 Plan 01: Diagnostic Prompt Tuning Summary

**Enhanced diagnostic question generation prompt with 6 rule blocks from Mila's QA review: category mapping, negative examples, answer quality, marketplace context, terminology, and question style**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T12:32:01Z
- **Completed:** 2026-03-27T12:35:03Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added PRAVILA VYBORA RUBRIKI section with explicit topic-to-axis mapping (SEO->Marketing, budget->Finance, etc.)
- Added 4 new banned content categories (certs, plugins/MPSTATS tools, course structure, IT definitions)
- Added answer quality rules (plausible distractors, no absurd options)
- Added marketplace context rule (specify Wildberries or Ozon for platform-specific questions)
- Added terminology rule (real business terms only, no invented concepts)
- Added question style preference (practical algorithms over definitions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update buildSystemPrompt with 6 rule blocks** - `6c84bd6` (feat)
2. **Task 2: Build verification and dry-run** - no commit (verification only, no code changes)

## Files Created/Modified
- `packages/ai/src/question-generator.ts` - Enhanced buildSystemPrompt() with 6 rule blocks from Mila's review (+37 lines, -2 lines)

## Decisions Made
- Combined D-05 (terminology) and D-06 (question style) into a single "TERMINOLOGIYA I STIL" section for prompt coherence
- Removed old narrow MPSTATS instrument rule and replaced with broader ban on all tools/plugins (D-02)
- Added dynamic category interpolation in mapping section ("Generate ONLY for rubric ${category}")
- Prompt length is 3678 chars (slightly over 3000 target but well within token budget with max_tokens=2048 for response)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `pnpm build` fails with EPERM symlink error on Windows (pre-existing, unrelated to changes) - verified via `pnpm typecheck` and direct tsc instead
- Pre-existing TS error in `tagging.ts` (unused variable) - out of scope, not touched

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Prompt is ready for production use
- Quality improvement will be visible on next diagnostic session generation
- No blocking issues for subsequent phases

---
*Phase: 42-diagnostic-prompt-tuning*
*Completed: 2026-03-27*
