---
phase: 20-paywall-content-gating
plan: 02
subsystem: ui
tags: [react, paywall, content-gating, lock-overlay, upsell-banner, track-gating]

requires:
  - phase: 20-paywall-content-gating
    provides: Access utility with locked flag enrichment and videoId stripping in tRPC responses
  - phase: 16-billing-schema
    provides: billing_enabled feature flag
provides:
  - LockOverlay component for locked lesson pages
  - PaywallBanner soft upsell for free lessons
  - CourseLockBanner mini-banner per course
  - LessonCard lock icon variant
  - Track preview gating with blur and CTA
affects: [pricing-page, billing-flow, deploy]

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
  - "PaywallBanner shown only on free lessons (order<=2) when course has >2 lessons"
  - "Track preview gating shows first 3 lessons, blurs rest with pointer-events-none"

patterns-established:
  - "Lock overlay pattern: conditional render based on lesson.locked replacing video+AI section"
  - "Track blur gating: blur-sm + pointer-events-none + select-none for locked lesson preview"
  - "Feature flag UI gating: billing_enabled=false removes all lock/paywall UI"

requirements-completed: [PAY-03]

duration: 5min
completed: 2026-03-12
---

# Phase 20 Plan 02: Frontend Lock UI, Upsell Banners, and Track Preview Gating Summary

**LockOverlay, PaywallBanner, CourseLockBanner components with conditional rendering on lesson page, course catalog, and diagnostic results for paywall visibility**

## Performance

- **Duration:** 5 min (including human verification)
- **Started:** 2026-03-12T11:23:01Z
- **Completed:** 2026-03-12T12:45:00Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 6

## Accomplishments
- LockOverlay replaces video+AI panel on locked lessons with CTA to /pricing
- LessonCard shows lock icon and hides progress/recommended badge when locked
- PaywallBanner soft upsell on free lessons, CourseLockBanner per course in catalog
- Track preview gating: first 3 lessons visible, rest blurred with CTA card
- Diagnostic results page shows recommended lessons with same gating pattern
- Human verification passed all 6 checks (lock UI, free banner, catalog icons, track gating, feature flag off, videoId security)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lock components + update LessonCard** - `47f66cd` (feat)
2. **Task 2: Wire lock UI into lesson, learn, and diagnostic pages** - `33b2b9a` (feat)
3. **Task 3: Verify paywall UI end-to-end** - human-verify checkpoint (approved, all 6 checks passed)

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

## Human Verification

All 6 verification checks passed:
1. Lock UI on paid lesson (lock icon + CTA, no video/AI) -- OK
2. Free lesson with soft upsell banner -- OK
3. Catalog lock icons on paid lessons -- OK
4. Track gating (3 visible, rest blurred) -- OK
5. Feature flag off (billing_enabled=false) removes all locks -- OK
6. Security: videoId=null for locked lessons -- confirmed in code

## Next Phase Readiness
- Complete paywall + content gating system operational (backend + frontend)
- Ready for production deploy
- Phase 20 fully complete (Plan 01 + Plan 02)

## Self-Check: PASSED

- All 6 files FOUND
- Both commits FOUND (47f66cd, 33b2b9a)

---
*Phase: 20-paywall-content-gating*
*Completed: 2026-03-12*
