---
phase: 41-pricing-logo-ux
plan: 01
subsystem: ui
tags: [navigation, pricing, ux-polish]

requires: []
provides:
  - Sidebar logo navigates to /dashboard
  - Course dropdown shows diagnostic axis badges
  - CP widget hint below payment buttons
  - Empty custom section hidden on learn page
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/web/src/components/shared/sidebar.tsx
    - apps/web/src/app/pricing/page.tsx
    - apps/web/src/app/(main)/learn/page.tsx

key-decisions:
  - "COURSE_AXIS_MAP hardcoded mapping (no DB query) since course-to-axis relationship is stable"
  - "HTML <option> plain text for axis names (no rich Badge components possible inside <option>)"

patterns-established: []

requirements-completed: []

duration: 2min
completed: 2026-03-27
---

# Phase 41 Plan 01: Pricing/Logo UX Polish Summary

**Sidebar logo links to /dashboard, course dropdown shows axis names, CP hint text, empty custom section guard**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-27T12:16:34Z
- **Completed:** 2026-03-27T12:18:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Sidebar logo wrapped in Link to /dashboard (D-01/D-02 audit items)
- Course dropdown on pricing shows diagnostic axis names after course title (D-03/D-04)
- CP widget hint "Data and CVV on next step" below both payment buttons (D-05)
- Empty custom section hidden on learn page when user has no custom lessons (D-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: Logo navigation + empty custom section guard** - `9e18704` (feat)
2. **Task 2: Pricing axis badges + CP widget hint** - `8e74933` (feat)

## Files Created/Modified
- `apps/web/src/components/shared/sidebar.tsx` - Logo wrapped in Link to /dashboard
- `apps/web/src/app/pricing/page.tsx` - COURSE_AXIS_MAP + axis text in dropdown + CP hint below buttons
- `apps/web/src/app/(main)/learn/page.tsx` - Filter out empty custom section

## Decisions Made
- COURSE_AXIS_MAP is a hardcoded constant (not fetched from DB) since the course-to-axis mapping is stable and only 4 courses have per-course subscriptions
- Used plain text in `<option>` elements for axis names since HTML `<option>` does not support rich content (Badge components)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 UX audit items (D-01 through D-06) resolved
- Ready for next phase execution

---
*Phase: 41-pricing-logo-ux*
*Completed: 2026-03-27*
