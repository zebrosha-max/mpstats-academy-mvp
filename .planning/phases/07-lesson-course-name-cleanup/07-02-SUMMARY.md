---
phase: 07-lesson-course-name-cleanup
plan: 02
subsystem: infra
tags: [docker, vps, deploy, visual-verification]

# Dependency graph
requires:
  - phase: 07-lesson-course-name-cleanup
    provides: Cleaned lesson/course titles in Supabase DB + visual numbering in learn page
provides:
  - Production-verified clean naming across all 405 lessons and 6 courses
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/src/app/(main)/learn/page.tsx

key-decisions:
  - "Visual numbering uses array index (idx+1) instead of lesson.order — order field was per-module (most lessons had order=1)"

patterns-established: []

requirements-completed: [NAMING-05]

# Metrics
duration: 5min
completed: 2026-02-26
---

# Phase 7 Plan 02: Production Redeploy & Visual Verification Summary

**Redeployed MAAL container on VPS, human-verified all 405 lesson titles, 6 course names, and visual numbering are clean on production (academyal.duckdns.org/learn)**

## Performance

- **Duration:** ~5 min (redeploy + verification)
- **Started:** 2026-02-25T16:10:00Z
- **Completed:** 2026-02-26T07:39:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Docker container rebuilt and redeployed on VPS with latest code
- Human visual verification passed on production: all naming cleanup confirmed
- Additional fix applied: lesson numbering switched from order field to array index (order was per-module, not sequential)

## Task Commits

Each task was committed atomically:

1. **Task 1: Redeploy container on VPS** - deployed via SSH (no code commit, infra-only)
2. **Task 2: Visual verification checkpoint** - human-approved

**Additional fix during verification:**
- `466ba95` fix(07-01): use array index for visual lesson numbering instead of order field

## Files Created/Modified
- `apps/web/src/app/(main)/learn/page.tsx` - Visual numbering switched from lesson.order to idx+1

## Decisions Made
- Visual numbering uses `idx+1` (array index) instead of `lesson.order` -- the order field stored per-module position (most lessons had order=1), making it useless for sequential numbering across expanded course view

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed visual lesson numbering using wrong field**
- **Found during:** Task 2 (visual verification on production)
- **Issue:** `lesson.order` was per-module (not sequential across course), so most lessons showed "1." instead of sequential numbers
- **Fix:** Switched to array index `idx+1` for visual numbering
- **Files modified:** apps/web/src/app/(main)/learn/page.tsx
- **Verification:** Production redeployed, sequential numbering confirmed visually
- **Committed in:** 466ba95

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct visual numbering. No scope creep.

## Issues Encountered
None beyond the auto-fixed numbering issue above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 7 complete -- all naming cleanup done and verified in production
- No further phases planned in current milestone
- Technical debt remains in Phase 4 (Access Control) and Phase 5 (Security Hardening)

## Self-Check: PASSED

- 07-02-SUMMARY.md: FOUND
- Commit 466ba95: FOUND

---
*Phase: 07-lesson-course-name-cleanup*
*Completed: 2026-02-26*
