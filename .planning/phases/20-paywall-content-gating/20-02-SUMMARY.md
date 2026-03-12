---
phase: 20-paywall-content-gating
plan: 02
subsystem: ui
tags: [react, paywall, content-gating, lock-overlay, upsell-banner]

requires:
  - phase: 20-paywall-content-gating
    provides: Access utility with locked flag enrichment and videoId stripping in tRPC responses
provides:
  - LockOverlay component for locked lesson pages
  - PaywallBanner soft upsell for free lessons
  - CourseLockBanner mini-banner per course
  - LessonCard lock icon variant
  - Track preview gating with blur and CTA
affects: [pricing-page, billing-flow]

tech-stack:
  added: []
  patterns: [lock-overlay-conditional-render, track-preview-blur-gating, paywall-priority-over-diagnostic-gate]

key-files:
  created:
    - apps/web/src/components/learning/LockOverlay.tsx
    - apps/web/src/components/learning/PaywallBanner.tsx
  modified:
    - apps/web/src/components/learning/LessonCard.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - apps/web/src/app/(main)/learn/page.tsx
    - apps/web/src/app/(main)/diagnostic/results/page.tsx

key-decisions:
  - "Paywall LockOverlay takes priority over DiagnosticGateBanner (locked check first)"
  - "PaywallBanner shown only on free lessons (order<=2) when course has >2 lessons and no platform subscription"
  - "Track preview gating shows first 3 lessons, blurs rest with pointer-events-none"

patterns-established:
  - "Lock overlay pattern: conditional render based on lesson.locked replacing video+AI section"
  - "Track blur gating: blur-sm + pointer-events-none + select-none for locked lesson preview"

requirements-completed: [PAY-03]

duration: 3min
completed: 2026-03-12
---

# Phase 20 Plan 02: Frontend Lock UI, Upsell Banners, and Track Preview Gating Summary

**LockOverlay, PaywallBanner, CourseLockBanner components with conditional rendering on lesson page, course catalog, and diagnostic results for paywall visibility**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T11:23:01Z
- **Completed:** 2026-03-12T11:25:39Z
- **Tasks:** 2 (auto) + 1 (checkpoint pending)
- **Files modified:** 6

## Accomplishments
- LockOverlay replaces video+AI panel on locked lessons with CTA to /pricing
- LessonCard shows lock icon and hides progress/recommended badge when locked
- PaywallBanner soft upsell on free lessons, CourseLockBanner per course in catalog
- Track preview gating: first 3 lessons visible, rest blurred with CTA card
- Diagnostic results page shows recommended lessons with same gating pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lock components + update LessonCard** - `47f66cd` (feat)
2. **Task 2: Wire lock UI into lesson, learn, and diagnostic pages** - `33b2b9a` (feat)
3. **Task 3: Human verification** - checkpoint (pending)

## Files Created/Modified
- `apps/web/src/components/learning/LockOverlay.tsx` - Full lock UI with CTA to /pricing
- `apps/web/src/components/learning/PaywallBanner.tsx` - PaywallBanner + CourseLockBanner exports
- `apps/web/src/components/learning/LessonCard.tsx` - Lock icon variant, hidden progress when locked
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - LockOverlay for locked lessons, PaywallBanner for free
- `apps/web/src/app/(main)/learn/page.tsx` - Locked prop on cards, CourseLockBanner, track blur gating
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` - Track preview with blur gating

## Decisions Made
- Paywall lock takes priority over diagnostic gate banner (checked first in conditional chain)
- PaywallBanner only shown for free lessons (order<=2) when billing active and course has >2 lessons
- Track blur gating uses CSS blur-sm + pointer-events-none (no JS interception)
- Diagnostic results page queries getRecommendedPath for track preview gating

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend gating implemented, awaiting human verification (Task 3 checkpoint)
- Lock UI, banners, and track preview ready for visual QA

---
*Phase: 20-paywall-content-gating*
*Completed: 2026-03-12*
