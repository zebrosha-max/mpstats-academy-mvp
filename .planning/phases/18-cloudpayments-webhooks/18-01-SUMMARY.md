---
phase: 18-cloudpayments-webhooks
plan: 01
subsystem: payments
tags: [cloudpayments, hmac, webhooks, idempotency, prisma]

requires:
  - phase: 16-billing-schema
    provides: Payment, PaymentEvent, Subscription Prisma models

provides:
  - HMAC-SHA256 webhook signature verification utility
  - CloudPayments webhook POST endpoint with idempotency
  - PaymentEvent audit log for all incoming webhooks
  - CloudPayments TypeScript types

affects: [18-02-subscription-lifecycle, 19-paywall]

tech-stack:
  added: []
  patterns: [webhook-hmac-verification, idempotent-upsert-by-txid, audit-event-log]

key-files:
  created:
    - apps/web/src/lib/cloudpayments/hmac.ts
    - apps/web/src/lib/cloudpayments/types.ts
    - apps/web/src/app/api/webhooks/cloudpayments/route.ts
  modified:
    - .env.example

key-decisions:
  - "Single catch-all webhook route with query param ?type= for event type resolution"
  - "Return {code: 0} on DB errors to prevent CloudPayments retry storms, log for investigation"
  - "timingSafeEqual for HMAC comparison to prevent timing attacks"

patterns-established:
  - "Webhook HMAC verification: raw body + Content-HMAC header + timingSafeEqual"
  - "Idempotent payment processing: upsert by cloudPaymentsTxId, skip update on duplicate COMPLETED"
  - "Audit-first: PaymentEvent created for every webhook including duplicates"

requirements-completed: [BILL-03]

duration: 3min
completed: 2026-03-11
---

# Phase 18 Plan 01: CloudPayments Webhooks Summary

**HMAC-SHA256 verified webhook endpoint with idempotent payment upsert by TransactionId and full PaymentEvent audit trail**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T21:31:40Z
- **Completed:** 2026-03-10T21:35:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- HMAC-SHA256 webhook signature verification with timing-safe comparison
- Idempotent payment creation/update keyed by CloudPayments TransactionId
- Full audit trail via PaymentEvent for every incoming webhook (including duplicates)
- CloudPayments-specific TypeScript types for webhook payloads

## Task Commits

Each task was committed atomically:

1. **Task 1: HMAC verification utility + CloudPayments types** - `cf8162a` (feat)
2. **Task 2: Webhook route handler with idempotency and audit logging** - `20eeb99` (feat)

## Files Created/Modified
- `apps/web/src/lib/cloudpayments/hmac.ts` - HMAC-SHA256 verification using timingSafeEqual
- `apps/web/src/lib/cloudpayments/types.ts` - CloudPaymentsWebhookPayload, EventType, Response types
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` - POST handler with HMAC check, idempotent upsert, audit log
- `.env.example` - Added CLOUDPAYMENTS_API_SECRET and CLOUDPAYMENTS_PUBLIC_ID variables

## Decisions Made
- **Single catch-all route:** Instead of separate /check, /pay, /fail endpoints, used single route with `?type=` query param. Simpler, fewer files, CloudPayments dashboard configures the URL.
- **Accept on DB error:** Return `{code: 0}` even on Prisma errors to prevent CloudPayments retry storms. Error is logged for manual investigation.
- **timingSafeEqual for HMAC:** Prevents timing attacks on signature verification. Buffer length check before comparison to avoid Node.js exception.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before testing webhooks, add to `.env`:
- `CLOUDPAYMENTS_API_SECRET` - from CloudPayments dashboard (Settings > API keys)
- `CLOUDPAYMENTS_PUBLIC_ID` - from CloudPayments dashboard

## Next Phase Readiness
- Webhook endpoint ready for Plan 02 (subscription lifecycle transitions)
- Route will be extended to call subscription service on pay/fail/cancel events
- CloudPayments sandbox testing needed to validate payload format

---
*Phase: 18-cloudpayments-webhooks*
*Completed: 2026-03-11*
