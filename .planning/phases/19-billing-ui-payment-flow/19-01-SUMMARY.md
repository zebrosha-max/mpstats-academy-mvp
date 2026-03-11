---
phase: 19-billing-ui-payment-flow
plan: 01
subsystem: payments
tags: [trpc, cloudpayments, prisma, billing, subscriptions]

requires:
  - phase: 16-billing-db-feature-flags
    provides: Prisma billing models + FeatureFlag + isFeatureEnabled
  - phase: 18-cloudpayments-webhooks
    provides: Webhook handlers + subscription lifecycle state machine
provides:
  - Billing tRPC router with 6 endpoints (isEnabled, getPlans, getSubscription, initiatePayment, getPaymentHistory, cancelSubscription)
  - CloudPayments widget type-safe wrapper (openPaymentWidget)
  - CloudPayments cancel API helper (cancelCloudPaymentsSubscription)
  - PENDING status in SubscriptionStatus enum
  - Updated seed prices (COURSE=2990, PLATFORM=4990)
affects: [19-02-billing-frontend, deploy]

tech-stack:
  added: []
  patterns: [inline-cp-cancel-in-router, pending-subscription-before-payment]

key-files:
  created:
    - packages/api/src/routers/billing.ts
    - apps/web/src/lib/cloudpayments/widget.ts
    - apps/web/src/lib/cloudpayments/cancel-api.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/root.ts
    - scripts/seed/seed-billing.ts

key-decisions:
  - "Inline CP cancel logic in tRPC router (3-line fetch) instead of cross-package import"
  - "PENDING subscription created before CP widget opens — webhook confirms payment"

patterns-established:
  - "Payment initiation: create PENDING records first, then open payment widget"
  - "Feature flag gating: every billing endpoint checks billing_enabled before executing"

requirements-completed: [BILL-01, BILL-05, PAY-02, PAY-04]

duration: 3min
completed: 2026-03-11
---

# Phase 19 Plan 01: Billing Backend Summary

**Billing tRPC router with 6 endpoints, CloudPayments widget wrapper, cancel API, PENDING status enum, and corrected seed prices (COURSE=2990, PLATFORM=4990)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T09:12:00Z
- **Completed:** 2026-03-11T09:15:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Billing tRPC router registered with all 6 endpoints, each gated by billing_enabled feature flag
- CloudPayments widget wrapper with type-safe charge interface and recurrent subscription config
- PENDING status added to SubscriptionStatus enum for payment initiation flow
- Seed script updated with correct prices and upsert update blocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma migration + CloudPayments helpers + seed update** - `a5f5070` (feat)
2. **Task 2: Billing tRPC router with all endpoints** - `c789a06` (feat)

## Files Created/Modified
- `packages/api/src/routers/billing.ts` - Billing tRPC router with 6 endpoints
- `packages/api/src/root.ts` - Added billing router registration
- `packages/db/prisma/schema.prisma` - Added PENDING to SubscriptionStatus enum
- `apps/web/src/lib/cloudpayments/widget.ts` - Type-safe CloudPayments Checkout widget wrapper
- `apps/web/src/lib/cloudpayments/cancel-api.ts` - Server-side CloudPayments subscription cancel
- `scripts/seed/seed-billing.ts` - Updated COURSE=2990 price, added upsert update blocks

## Decisions Made
- Inlined CloudPayments cancel API call in tRPC router instead of cross-package import, since tRPC routers are in `packages/api/` and the cancel helper is in `apps/web/`. 3 lines of fetch is simpler than creating a shared package.
- PENDING subscription + payment records are created before the CP widget opens. The webhook handler (Phase 18) will update status on payment success.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prisma 7.4.2 installed globally conflicts with project's 5.22.0 schema syntax (url/directUrl in datasource). Used project-local Prisma binary from `packages/db/node_modules/prisma/` to generate client successfully.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Billing router ready for frontend consumption in Plan 19-02
- All endpoints are feature-flagged — billing_enabled must be set to true via admin panel
- CloudPayments widget script needs to be added to page head in the billing UI

---
*Phase: 19-billing-ui-payment-flow*
*Completed: 2026-03-11*
