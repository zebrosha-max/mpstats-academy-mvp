---
phase: 36-product-tour-onboarding
plan: 01
subsystem: ui
tags: [driver.js, product-tour, onboarding, tooltips, react-context]

requires:
  - phase: none
    provides: standalone feature
provides:
  - driver.js tour infrastructure (TourProvider, HelpCircleButton, CSS, definitions)
  - data-tour attributes on sidebar-nav and mobile-nav
  - 3 tour definitions (dashboard 4 steps, learn 5 steps, lesson 5 steps)
affects: [36-02 (data-tour attributes on page components)]

tech-stack:
  added: [driver.js 1.4.0]
  patterns: [TourProvider context for tour orchestration, localStorage persistence per page, mobile-adaptive steps]

key-files:
  created:
    - apps/web/src/styles/tour.css
    - apps/web/src/lib/tours/definitions.ts
    - apps/web/src/components/shared/TourProvider.tsx
    - apps/web/src/components/shared/HelpCircleButton.tsx
  modified:
    - apps/web/package.json
    - apps/web/src/app/(main)/layout.tsx
    - apps/web/src/components/shared/sidebar.tsx
    - apps/web/src/components/shared/mobile-nav.tsx

key-decisions:
  - "overlayClickBehavior uses no-op DriverHook (driver.js 1.4 has no 'none' option, only 'close'|'nextStep'|DriverHook)"
  - "TourProvider wraps main content inside <main> (not entire layout) to keep server component boundary clean"

patterns-established:
  - "Tour definitions: declarative step arrays in definitions.ts with getSteps(page, isMobile) mobile adaptation"
  - "Tour persistence: localStorage key pattern tour_{page}_completed with string 'true'"
  - "data-tour attribute convention for tour target elements"

requirements-completed: [TOUR-01, TOUR-03, TOUR-04]

duration: 4min
completed: 2026-03-26
---

# Phase 36 Plan 01: Product Tour Infrastructure Summary

**driver.js tour system with 3 tour definitions (14 steps), MPSTATS-branded CSS, auto-start on first visit, and HelpCircle replay button**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T08:03:50Z
- **Completed:** 2026-03-26T08:07:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- driver.js 1.4.0 installed with MPSTATS brand CSS overrides (mp-blue CTA, white popover, 16px radius)
- 3 tour definitions with 14 total steps matching UI-SPEC copywriting contract exactly
- TourProvider with auto-start (1500ms delay) + localStorage persistence + mobile adaptation
- HelpCircleButton conditionally visible on /dashboard, /learn, /learn/[id]
- data-tour attributes on sidebar and mobile-nav for dashboard tour step 1

## Task Commits

Each task was committed atomically:

1. **Task 1: Install driver.js, create tour CSS + definitions + TourProvider + HelpCircleButton** - `061dc5a` (feat)
2. **Task 2: Integrate TourProvider + HelpCircle into layout, add data-tour to sidebar and mobile-nav** - `3b578de` (feat)

## Files Created/Modified
- `apps/web/src/styles/tour.css` - MPSTATS brand CSS overrides for driver.js popover
- `apps/web/src/lib/tours/definitions.ts` - 3 tour step arrays + getTourForPage + getSteps with mobile swap
- `apps/web/src/components/shared/TourProvider.tsx` - React context + driver.js orchestration with auto-start
- `apps/web/src/components/shared/HelpCircleButton.tsx` - Header button to replay tours
- `apps/web/package.json` - Added driver.js dependency
- `apps/web/src/app/(main)/layout.tsx` - TourProvider wrapping children + HelpCircleButton in header
- `apps/web/src/components/shared/sidebar.tsx` - data-tour="sidebar-nav" on nav element
- `apps/web/src/components/shared/mobile-nav.tsx` - data-tour="mobile-nav" on root nav

## Decisions Made
- Used no-op DriverHook for `overlayClickBehavior` because driver.js 1.4 TypeScript types only accept `"close" | "nextStep" | DriverHook` (no `"none"` value)
- TourProvider wraps content inside `<main>` element rather than entire layout div to keep server/client component boundary clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed overlayClickBehavior TypeScript type error**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Plan specified `overlayClickBehavior: 'none'` but driver.js 1.4 types only accept `"close" | "nextStep" | DriverHook`
- **Fix:** Used no-op DriverHook function `() => {}` instead of string `'none'`
- **Files modified:** apps/web/src/components/shared/TourProvider.tsx
- **Verification:** TypeScript compilation passes (0 tour-related errors)
- **Committed in:** 3b578de (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Behavioral outcome identical -- overlay click does nothing. Only the TypeScript representation changed.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all tour definitions contain real copy from UI-SPEC. Plan 02 will add data-tour attributes to page components.

## Next Phase Readiness
- Tour infrastructure fully operational
- Plan 02 only needs to add data-tour attributes to dashboard, learn, and lesson page components
- All 14 step targets defined in definitions.ts, ready for element matching

## Self-Check: PASSED

---
*Phase: 36-product-tour-onboarding*
*Completed: 2026-03-26*
