---
phase: 22-transactional-email-notifications-billing-auth-system
plan: 02
subsystem: payments
tags: [carrotquest, sonner, toast, email, webhooks, feature-flags]

requires:
  - phase: 18-cloudpayments-webhook-processing
    provides: subscription-service lifecycle handlers
  - phase: 16-billing-schema-feature-flags
    provides: FeatureFlag model and isFeatureEnabled utility
provides:
  - CarrotQuest API client with fire-and-forget pattern
  - Email helper functions (payment success/fail, cancellation, welcome, diagnostic)
  - Sonner toast notifications in root layout
  - Billing webhook email triggers (4 events)
affects: [22-03, 22-04, deploy]

tech-stack:
  added: [sonner]
  patterns: [fire-and-forget email via CQ events, feature flag caching]

key-files:
  created:
    - apps/web/src/lib/carrotquest/client.ts
    - apps/web/src/lib/carrotquest/types.ts
    - apps/web/src/lib/carrotquest/emails.ts
    - apps/web/src/components/ui/sonner.tsx
  modified:
    - apps/web/src/app/layout.tsx
    - apps/web/src/lib/cloudpayments/subscription-service.ts
    - apps/web/src/app/pricing/page.tsx
    - apps/web/src/app/(main)/profile/page.tsx
    - .env.example

key-decisions:
  - "Feature flag cache with 60s TTL to avoid DB query on every email send"
  - "handlePaymentFailure now includes plan relation for courseName in email"

patterns-established:
  - "Fire-and-forget email: sendXxxEmail().catch(console.error) -- never breaks billing"
  - "CQ client no-op guard: missing API key logs warning once, all methods skip silently"

requirements-completed: [EMAIL-02, EMAIL-03, EMAIL-06, EMAIL-07]

duration: 3min
completed: 2026-03-13
---

# Phase 22 Plan 02: CQ Email Triggers + Sonner Toasts Summary

**Carrot Quest API client with fire-and-forget billing email triggers and sonner toast notifications for payment/cancellation UI feedback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T08:20:46Z
- **Completed:** 2026-03-13T08:24:10Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- CQ API client with no-op guard for missing API key (safe for dev/staging)
- 5 email helper functions with feature flag check and 60s cache
- 4 billing email triggers wired into subscription-service (pay, fail, cancel, recurrent)
- Sonner toaster in root layout with toast calls on pricing and profile pages

## Task Commits

Each task was committed atomically:

1. **Task 1: CQ API Client + Email Helpers + Feature Flag + Sonner** - `1f638f0` (feat)
2. **Task 2: Wire Billing Email Triggers + Toast into Webhook Handlers** - `a341a43` (feat)

## Files Created/Modified
- `apps/web/src/lib/carrotquest/types.ts` - CQ event name union type and event data type
- `apps/web/src/lib/carrotquest/client.ts` - CQ API client class with trackEvent and setUserProps
- `apps/web/src/lib/carrotquest/emails.ts` - Email helper functions with feature flag guard
- `apps/web/src/components/ui/sonner.tsx` - Toaster component (shadcn/ui pattern)
- `apps/web/src/app/layout.tsx` - Added Toaster to root layout
- `apps/web/src/lib/cloudpayments/subscription-service.ts` - Added 4 fire-and-forget email sends
- `apps/web/src/app/pricing/page.tsx` - Toast on payment success/failure
- `apps/web/src/app/(main)/profile/page.tsx` - Toast on subscription cancel
- `.env.example` - CARROTQUEST_API_KEY placeholder

## Decisions Made
- Feature flag cache with 60s TTL to avoid DB query per email send
- handlePaymentFailure updated to include plan relation for courseName in email data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
- Add `CARROTQUEST_API_KEY` to production `.env.production` when CQ account is configured
- Create `email_notifications_enabled` feature flag in DB (INSERT INTO "FeatureFlag" (key, enabled) VALUES ('email_notifications_enabled', false))
- Configure CQ automation rules for each event type ($payment_success, $payment_failed, etc.)

## Next Phase Readiness
- CQ client and email helpers ready for auth email triggers (Plan 03)
- Sonner toaster available globally for any future toast notifications
- Feature flag defaults to false -- emails won't send until explicitly enabled

---
*Phase: 22-transactional-email-notifications-billing-auth-system*
*Completed: 2026-03-13*
