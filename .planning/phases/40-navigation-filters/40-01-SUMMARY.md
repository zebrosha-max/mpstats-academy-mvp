---
phase: 40-navigation-filters
plan: 01
subsystem: ui
tags: [next.js, useSearchParams, url-state, driver.js, tour, react]

requires:
  - phase: 30-content-discovery
    provides: FilterPanel component with FilterState interface
  - phase: 36-product-tour
    provides: TourProvider with driver.js auto-start

provides:
  - URL-backed filter persistence on /learn page
  - Session-scoped tour auto-start guard

affects: [learn-page, tour-system]

tech-stack:
  added: []
  patterns:
    - "URL-backed state via useSearchParams + router.replace (no history entries)"
    - "Session-scoped useRef guard for one-time effects"

key-files:
  created: []
  modified:
    - apps/web/src/app/(main)/learn/page.tsx
    - apps/web/src/components/shared/TourProvider.tsx

key-decisions:
  - "router.replace instead of router.push to avoid polluting browser history with filter changes"
  - "ReturnType<typeof useSearchParams> instead of ReadonlyURLSearchParams (not available in Next.js 14 types)"

patterns-established:
  - "URL-backed filter state: filtersFromSearchParams/filtersToSearchParams helpers + Suspense wrapper"
  - "Session guard via useRef<Set> for one-time auto-start effects"

requirements-completed: [R21, R46]

duration: 3min
completed: 2026-03-27
---

# Phase 40 Plan 01: Navigation & Filters Summary

**URL-backed filter persistence on /learn via useSearchParams and session-scoped tour auto-start guard via useRef**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T11:45:28Z
- **Completed:** 2026-03-27T11:48:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Filters on /learn page now persist in URL query string, surviving browser back/forward navigation
- Tour auto-start no longer repeats within the same browser session (useRef guard per page)
- Clean URLs: only non-default filter values appear in query string

## Task Commits

Each task was committed atomically:

1. **Task 1: URL-backed filters on /learn page** - `124c562` (feat)
2. **Task 2: Tour auto-start guard with hasAutoStartedRef** - `f501c3b` (fix)

## Files Created/Modified
- `apps/web/src/app/(main)/learn/page.tsx` - Replaced useState with useSearchParams + router.replace for filter state; added Suspense wrapper
- `apps/web/src/components/shared/TourProvider.tsx` - Added hasAutoStartedRef (Set<TourPage>) session guard to prevent tour re-triggering

## Decisions Made
- Used `router.replace` (not `push`) so filter changes don't create history entries -- user pressing Back goes to previous page, not previous filter state
- Used `ReturnType<typeof useSearchParams>` for type annotation since `ReadonlyURLSearchParams` is not directly available in Next.js 14 TypeScript types
- Removed unused `DEFAULT_FILTERS` import after switching to URL-backed state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ReadonlyURLSearchParams type not available**
- **Found during:** Task 1 (URL-backed filters)
- **Issue:** `ReadonlyURLSearchParams` from the plan caused TS2304 -- type not available in Next.js 14
- **Fix:** Used `ReturnType<typeof useSearchParams>` instead
- **Files modified:** apps/web/src/app/(main)/learn/page.tsx
- **Verification:** TypeScript typecheck passes
- **Committed in:** 124c562

**2. [Rule 1 - Bug] Unused DEFAULT_FILTERS import**
- **Found during:** Task 1 (URL-backed filters)
- **Issue:** After removing `useState<FilterState>(DEFAULT_FILTERS)`, the `DEFAULT_FILTERS` import became unused
- **Fix:** Removed from import statement
- **Files modified:** apps/web/src/app/(main)/learn/page.tsx
- **Verification:** No lint warnings
- **Committed in:** 124c562

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Minor type adaptation and cleanup. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both R21 (filter persistence) and R46 (tour repeat) bugs are fixed
- Plan 40-02 (already completed) handles the other navigation fixes

---
*Phase: 40-navigation-filters*
*Completed: 2026-03-27*
