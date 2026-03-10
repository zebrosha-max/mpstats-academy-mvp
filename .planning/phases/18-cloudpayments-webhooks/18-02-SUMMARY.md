---
phase: 18-cloudpayments-webhooks
plan: 02
subsystem: payments
tags: [subscription-lifecycle, state-machine, cloudpayments, webhooks]

requires:
  - phase: 18-cloudpayments-webhooks
    plan: 01
    provides: Webhook route with HMAC verification and payment upsert

provides:
  - Subscription lifecycle state machine (5 handlers)
  - Webhook route dispatch to subscription service
  - Pre-payment validation (check event)

affects: [19-paywall, 20-access-control]

tech-stack:
  added: []
  patterns: [subscription-state-machine, pre-payment-validation, non-throwing-handlers]

key-files:
  created:
    - apps/web/src/lib/cloudpayments/subscription-service.ts
  modified:
    - apps/web/src/app/api/webhooks/cloudpayments/route.ts

key-decisions:
  - "Recurrent extends from currentPeriodEnd (not now) to avoid billing gaps"
  - "Cancel sets CANCELLED but does NOT expire — user retains access until currentPeriodEnd"
  - "Check event returns false on error (safer to decline than accept unknown state)"
  - "All handlers are non-throwing — log errors, never crash webhook"

requirements-completed: [BILL-02]

duration: 2min
completed: 2026-03-11
---

# Phase 18 Plan 02: Subscription Lifecycle Summary

**Subscription state machine with 5 lifecycle handlers wired into CloudPayments webhook route — pay/recurrent activate, fail sets PAST_DUE, cancel preserves access until period end**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T21:35:37Z
- **Completed:** 2026-03-10T21:37:24Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Subscription lifecycle state machine with 5 exported handlers
- Pre-payment validation (handleCheck) verifies user and subscription ownership
- Pay/Recurrent activate subscription and set correct billing period
- Recurrent extends from currentPeriodEnd (not now) to prevent billing gaps
- Failed payments set PAST_DUE with CloudPayments retry grace period
- Cancelled subscriptions retain access until currentPeriodEnd (EXPIRED handled at access-check time in Phase 20)
- All handlers non-throwing for webhook reliability

## Task Commits

Each task was committed atomically:

1. **Task 1: Subscription lifecycle service** - `3ded385` (feat)
2. **Task 2: Wire subscription service into webhook route** - `e9d9217` (feat)

## Files Created/Modified
- `apps/web/src/lib/cloudpayments/subscription-service.ts` - 5 exported functions: handlePaymentSuccess, handlePaymentFailure, handleCancellation, handleRecurrentPayment, handleCheck
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` - Added subscription service imports, check validation before payment creation, event-type dispatch after payment upsert

## Decisions Made
- **Recurrent period extension:** Extends currentPeriodEnd from the CURRENT currentPeriodEnd, not from now. Prevents gaps and overlaps in billing periods.
- **Cancel does not expire:** CANCELLED status + cancelledAt timestamp set, but user retains access until currentPeriodEnd. EXPIRED transition deferred to Phase 20 access-check logic.
- **Check declines on error:** handleCheck returns false on any error (DB failure, etc.) — safer to decline a payment than accept with unknown system state.
- **Non-throwing handlers:** All 5 functions wrap DB calls in try/catch and log errors. Webhook handler always returns {code: 0} to CloudPayments.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## State Transitions

| Event | From Status | To Status | Period Change |
|-------|------------|-----------|---------------|
| pay | any | ACTIVE | start=now, end=now+intervalDays |
| recurrent | any | ACTIVE | start=oldEnd, end=oldEnd+intervalDays |
| fail | ACTIVE/PAST_DUE | PAST_DUE | no change |
| fail | CANCELLED/EXPIRED | no change | no change |
| cancel | any | CANCELLED | cancelledAt=now |
| check | - | - | validation only |

---
*Phase: 18-cloudpayments-webhooks*
*Completed: 2026-03-11*
