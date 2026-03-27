---
phase: 37-watch-progress-fix
plan: 01
subsystem: ui
tags: [kinescope, watch-progress, toast, sonner, react-ref]

requires:
  - phase: none
    provides: n/a
provides:
  - "Accurate watch progress tracking using DB duration only"
  - "Auto-complete toast notification on lesson completion"
  - "Unified stats counters on learn page (recommendedPath primary)"
affects: [learn-page, lesson-page, kinescope-player]

tech-stack:
  added: []
  patterns: ["completedRef one-shot guard for toast dedup", "nullish coalescing for stats fallback chain"]

key-files:
  created: []
  modified:
    - apps/web/src/components/video/KinescopePlayer.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - apps/web/src/app/(main)/learn/page.tsx

key-decisions:
  - "Remove position*1.1 estimation entirely — no progress saved when DB duration unknown (correct behavior)"
  - "completedRef with useEffect sync prevents toast for already-completed lessons on page load"
  - "Nullish coalescing (??) instead of || to preserve zero values in stats"

patterns-established:
  - "One-shot ref guard: useRef(false) + useEffect sync for preventing duplicate toasts"

requirements-completed: []

duration: 3min
completed: 2026-03-27
---

# Phase 37 Plan 01: Watch Progress Fix Summary

**Fixed timer duration estimation (position*1.1 removed), added auto-complete toast, unified learn page stats counters to use recommendedPath as primary source**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T09:05:59Z
- **Completed:** 2026-03-27T09:08:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- KinescopePlayer timer no longer estimates duration — uses DB-sourced knownDuration exclusively (R25/R26/R27)
- Auto-complete toast fires once when lesson reaches COMPLETED status, with query invalidation for counter refresh (R25)
- Learn page stats card and progress bar use same data source: recommendedPath with path fallback (R24)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix KinescopePlayer timer fallback and add auto-complete toast** - `6e4aa8b` (fix)
2. **Task 2: Unify learn page stats counters** - `f4cc9da` (fix)

## Files Created/Modified
- `apps/web/src/components/video/KinescopePlayer.tsx` - Removed position*1.1 fallback, guard onTimeUpdate behind knownDuration > 0
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Added toast import, completedRef guard, onSuccess with toast + query invalidation
- `apps/web/src/app/(main)/learn/page.tsx` - Stats now use recommendedPath ?? path ?? 0 with nullish coalescing

## Decisions Made
- Removed position*1.1 estimation entirely rather than improving it — when DB duration is 0/unknown, progress simply won't save, which is correct (all 405 lessons have durations from Kinescope API fetch)
- Used completedRef with useEffect sync on data?.lesson?.status to prevent false toast on already-completed lessons
- Used nullish coalescing (??) instead of || so that 0 values are preserved correctly in stats

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added useEffect to sync completedRef with initial lesson status**
- **Found during:** Task 1 (auto-complete toast)
- **Issue:** completedRef initialized to false, but if lesson is already COMPLETED from query data, every subsequent saveWatchProgress would trigger a false toast
- **Fix:** Added useEffect that sets completedRef.current = true when data?.lesson?.status === 'COMPLETED'
- **Files modified:** apps/web/src/app/(main)/learn/[id]/page.tsx
- **Verification:** TypeScript compiles, logic prevents duplicate toast
- **Committed in:** 6e4aa8b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential correctness fix — prevents false toast for already-completed lessons. No scope creep.

## Issues Encountered
None

## Known Stubs
None

## Next Phase Readiness
- Watch progress tracking is now accurate with DB-sourced durations
- Stats counters are unified across learn page
- Ready for verification on dev server

---
*Phase: 37-watch-progress-fix*
*Completed: 2026-03-27*
