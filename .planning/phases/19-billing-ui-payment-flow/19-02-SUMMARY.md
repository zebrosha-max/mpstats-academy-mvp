---
phase: 19-billing-ui-payment-flow
plan: 02
subsystem: ui
tags: [react, trpc, cloudpayments, pricing, subscription, profile, sidebar]

requires:
  - phase: 19-billing-ui-payment-flow
    provides: Billing tRPC router with 6 endpoints + CloudPayments widget wrapper
provides:
  - Public /pricing page with two plan cards (COURSE/PLATFORM) and CloudPayments widget trigger
  - Profile subscription management section with cancel and payment history
  - Conditional sidebar/mobile-nav "Tarify" link gated by billing_enabled feature flag
affects: [deploy, 20-paywall-access-control]

tech-stack:
  added: []
  patterns: [conditional-nav-via-feature-flag, cardfooter-button-alignment, public-page-with-optional-auth-queries]

key-files:
  created:
    - apps/web/src/app/pricing/page.tsx
  modified:
    - apps/web/src/app/(main)/profile/page.tsx
    - apps/web/src/components/shared/sidebar.tsx
    - apps/web/src/components/shared/mobile-nav.tsx

key-decisions:
  - "Pricing page is outside (main) layout — no sidebar, minimal header with back navigation"
  - "Protected tRPC queries (getSubscription, getCourses) called with retry:false on public pricing page — gracefully fails for unauthenticated users"
  - "CardFooter with mt-auto pattern for consistent button alignment in equal-height plan cards"

patterns-established:
  - "Feature flag UI gating: query billing.isEnabled to conditionally render nav items"
  - "Public page with optional auth: call protected queries with retry:false, handle UNAUTHORIZED gracefully"

requirements-completed: [BILL-01, BILL-05, PAY-02, PAY-04]

duration: 4min
completed: 2026-03-11
---

# Phase 19 Plan 02: Billing Frontend Summary

**Public pricing page with COURSE/PLATFORM cards, CloudPayments widget integration, profile subscription management with cancel/history, and conditional sidebar navigation gated by billing_enabled flag**

## Performance

- **Duration:** 4 min (active work, excludes checkpoint wait)
- **Started:** 2026-03-11T09:17:01Z
- **Completed:** 2026-03-11T11:23:37Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments
- Pricing page renders two plan cards from DB with course dropdown for COURSE plan and CloudPayments widget trigger
- Profile page shows subscription status with badges, cancel button, and payment history table
- Sidebar and MobileNav conditionally show "Tarify" link based on billing_enabled feature flag
- Human verified: pricing displays correctly, back navigation works, buttons aligned, responsive layout confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Pricing page + sidebar + profile subscription section** - `9b23cf5` (feat)
2. **Task 2: UX fixes after human verification** - `d2e9012` (fix)

## Files Created/Modified
- `apps/web/src/app/pricing/page.tsx` - Public pricing page with two plan cards, CP widget, back nav
- `apps/web/src/app/(main)/profile/page.tsx` - Added subscription section with status/cancel/history
- `apps/web/src/components/shared/sidebar.tsx` - Conditional "Tarify" nav item via billing.isEnabled
- `apps/web/src/components/shared/mobile-nav.tsx` - Same conditional billing nav for mobile

## Decisions Made
- Pricing page placed outside (main) layout — no sidebar wrapping, uses its own minimal header with back arrow
- Protected tRPC queries on public pricing page use `retry: false` to gracefully handle unauthenticated visitors
- Used CardFooter with `mt-auto` and `flex flex-col` on cards for consistent CTA button alignment across equal-height plan cards

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed button alignment in plan cards**
- **Found during:** Task 2 (human verification)
- **Issue:** CTA buttons were at different heights in COURSE vs PLATFORM cards due to different content lengths
- **Fix:** Moved buttons to CardFooter with mt-auto, added flex flex-col and h-full on cards, items-stretch on grid
- **Files modified:** apps/web/src/app/pricing/page.tsx
- **Committed in:** d2e9012

**2. [Rule 1 - Bug] Fixed header navigation UX**
- **Found during:** Task 2 (human verification)
- **Issue:** "Личный кабинет" link was unclear navigation — user expected a back button
- **Fix:** Replaced with back arrow + "Назад" link, centered logo with spacer div
- **Files modified:** apps/web/src/app/pricing/page.tsx
- **Committed in:** d2e9012

---

**Total deviations:** 2 auto-fixed (2 UX bugs caught during verification)
**Impact on plan:** Minor UX polish, no scope creep.

## Issues Encountered
None.

## User Setup Required
None - billing_enabled flag and subscription plans already seeded in DB during verification.

## Next Phase Readiness
- Full billing UI is functional — pricing page, subscription management, conditional navigation
- Phase 19 (billing) complete — ready for Phase 20 (paywall/access control) if planned
- CloudPayments sandbox testing still needed for end-to-end payment flow verification

---
*Phase: 19-billing-ui-payment-flow*
*Completed: 2026-03-11*
