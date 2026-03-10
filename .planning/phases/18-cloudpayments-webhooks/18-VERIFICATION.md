---
phase: 18-cloudpayments-webhooks
verified: 2026-03-11T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 18: CloudPayments Webhooks Verification Report

**Phase Goal:** CloudPayments webhook endpoint with HMAC verification, idempotent processing, subscription lifecycle state machine
**Verified:** 2026-03-11
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Webhook endpoint accepts POST from CloudPayments and returns {code: 0} on valid HMAC | VERIFIED | `route.ts` line 204: `return NextResponse.json(OK)` after successful processing; `OK = { code: 0 }` |
| 2 | Invalid HMAC signature returns 403 and logs the attempt | VERIFIED | `route.ts` lines 93-102: logs IP via `console.warn`, returns `NextResponse.json(REJECT, { status: 403 })` |
| 3 | Every incoming webhook payload is saved to PaymentEvent for audit | VERIFIED | `route.ts` lines 171-177: `prisma.paymentEvent.create` always called; duplicate COMPLETED payments also create event (line 145: paymentId preserved for audit log) |
| 4 | Duplicate TransactionId does not create duplicate Payment records | VERIFIED | `route.ts` lines 134-168: `prisma.payment.upsert` keyed by `cloudPaymentsTxId`; duplicate COMPLETED pay events skip the upsert entirely |
| 5 | Successful payment (pay) creates or activates subscription with correct period dates | VERIFIED | `subscription-service.ts` lines 14-53: `handlePaymentSuccess` sets status=ACTIVE, currentPeriodStart=now, currentPeriodEnd=now+intervalDays |
| 6 | Failed payment (fail) transitions subscription to PAST_DUE | VERIFIED | `subscription-service.ts` lines 63-102: `handlePaymentFailure` transitions ACTIVE/PAST_DUE to PAST_DUE; terminal states ignored |
| 7 | Cancel event sets subscription to CANCELLED with cancelledAt timestamp | VERIFIED | `subscription-service.ts` lines 112-144: `handleCancellation` sets status=CANCELLED and cancelledAt=new Date(); user retains access until currentPeriodEnd |
| 8 | Recurrent payment extends currentPeriodEnd by intervalDays from the plan | VERIFIED | `subscription-service.ts` lines 154-195: `handleRecurrentPayment` extends from `subscription.currentPeriodEnd` (not from now), prevents billing gaps |
| 9 | Subscription state machine only allows valid transitions | VERIFIED | `handlePaymentFailure` checks current status before transition (lines 79-95); `handleCheck` validates user+subscription ownership before accepting payment |

**Score: 9/9 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/cloudpayments/hmac.ts` | HMAC-SHA256 verification for CloudPayments webhooks | VERIFIED | 49 lines; exports `verifyCloudPaymentsHmac`; uses `createHmac('sha256', secret)` + `timingSafeEqual`; handles missing secret and invalid base64 |
| `apps/web/src/lib/cloudpayments/types.ts` | TypeScript types for CloudPayments webhook payloads | VERIFIED | 63 lines; exports `CloudPaymentsEventType` (6 variants), `CloudPaymentsWebhookPayload` (full interface), `CloudPaymentsResponse` |
| `apps/web/src/app/api/webhooks/cloudpayments/route.ts` | POST handler for CloudPayments webhooks | VERIFIED | 211 lines; exports `POST` + `dynamic='force-dynamic'`; full lifecycle dispatch wired |
| `apps/web/src/lib/cloudpayments/subscription-service.ts` | Subscription lifecycle state machine | VERIFIED | 253 lines; exports 5 functions: `handlePaymentSuccess`, `handlePaymentFailure`, `handleCancellation`, `handleRecurrentPayment`, `handleCheck` |
| `.env.example` | Documents CLOUDPAYMENTS_API_SECRET and CLOUDPAYMENTS_PUBLIC_ID | VERIFIED | Lines 34-36: `# ============== CLOUDPAYMENTS ==============`, both variables present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `route.ts` | `hmac.ts` | `import verifyCloudPaymentsHmac` | WIRED | Line 5: `import { verifyCloudPaymentsHmac } from '@/lib/cloudpayments/hmac'`; called at line 93 |
| `route.ts` | `prisma.payment` | upsert by cloudPaymentsTxId | WIRED | Line 152: `prisma.payment.upsert({ where: { cloudPaymentsTxId: txId }, ... })`; also findUnique at line 134 |
| `route.ts` | `prisma.paymentEvent` | create for audit log | WIRED | Line 171: `prisma.paymentEvent.create({ data: { paymentId, type: eventType, payload: JSON.parse(rawBody) } })` |
| `route.ts` | `subscription-service.ts` | import and call after Payment upsert | WIRED | Lines 7-12: all 5 handlers imported; switch dispatch at lines 180-202 |
| `subscription-service.ts` | `prisma.subscription` | update status, dates | WIRED | `prisma.subscription.update` in all 4 state-changing handlers (lines 35, 83, 127, 177) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BILL-03 | 18-01 | Webhook handler с HMAC-SHA256 верификацией и идемпотентностью (по TransactionId) | SATISFIED | `hmac.ts` + `route.ts` with `cloudPaymentsTxId` upsert key + `PaymentEvent` audit log |
| BILL-02 | 18-02 | Рекуррентные подписки с автопродлением через CloudPayments | SATISFIED | `subscription-service.ts` with 5 lifecycle handlers; recurrent extension from currentPeriodEnd; state machine validated |

REQUIREMENTS.md mapping confirms both requirements show Phase 18 as Complete.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `subscription-service.ts` | `console.log` (6 occurrences) | Info | Intentional operational logging — lifecycle state transitions. Appropriate for a webhook handler where structured logging would be overkill at this stage. Not a stub. |

No blockers. No warnings. `console.log` in this context is operational instrumentation, not placeholder code.

---

### Human Verification Required

#### 1. CloudPayments Sandbox Integration Test

**Test:** Configure CloudPayments test dashboard with webhook URL `https://academyal.duckdns.org/api/webhooks/cloudpayments?type=pay`, set CLOUDPAYMENTS_API_SECRET in production env, trigger a test payment.
**Expected:** Payment record created in DB, PaymentEvent logged, subscription activated, CloudPayments receives `{"code": 0}`.
**Why human:** Requires live CloudPayments sandbox credentials and actual HTTP roundtrip to verify HMAC header format matches implementation.

#### 2. HMAC Rejection Verification

**Test:** Send a POST to `/api/webhooks/cloudpayments` with a body but a wrong or missing `Content-HMAC` header.
**Expected:** 403 response with `{"code": 13}`, warning logged with caller IP.
**Why human:** Can be curl-tested locally but requires the env var to be set — not verifiable statically.

#### 3. Recurrent Period Extension Correctness

**Test:** Trigger a `recurrent` event for a subscription with `currentPeriodEnd` in the future, verify `newPeriodEnd = oldPeriodEnd + intervalDays` (not `now + intervalDays`).
**Expected:** No billing gap — `currentPeriodStart` equals the old `currentPeriodEnd` exactly.
**Why human:** Date arithmetic correctness requires live DB state to confirm.

---

### Gaps Summary

No gaps. All 9 observable truths are verified against actual code. All 5 artifacts exist and are substantive. All 5 key links are wired end-to-end. Both requirement IDs (BILL-02, BILL-03) are satisfied with implementation evidence. No orphaned requirements from REQUIREMENTS.md for Phase 18.

Commit hashes from SUMMARYs verified in git log: `cf8162a`, `20eeb99`, `3ded385`, `e9d9217` — all present on master.

---

_Verified: 2026-03-11_
_Verifier: Claude (gsd-verifier)_
