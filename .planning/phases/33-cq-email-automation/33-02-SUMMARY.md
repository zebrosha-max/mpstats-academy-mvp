---
phase: 33-cq-email-automation
plan: 02
subsystem: carrotquest-events
tags: [cq, events, cron, github-actions, email-lifecycle]
dependency_graph:
  requires:
    - phase: 33-cq-email-automation-01
      provides: pa-prefixed events, lastActiveAt field, activity tracking
  provides:
    - sendSubscriptionExpiringEmail and sendInactiveEmail helper functions
    - pa_registration_completed event on first email confirmation
    - /api/cron/check-subscriptions endpoint for subscription expiry
    - /api/cron/inactive-users endpoint for inactivity notifications
    - daily-cron.yml GitHub Action
  affects: [cq-dashboard-automation, deployment]
tech_stack:
  added: []
  patterns: [24h-sliding-window-idempotency, fire-and-forget-welcome-email]
key_files:
  created:
    - apps/web/src/app/api/cron/check-subscriptions/route.ts
    - apps/web/src/app/api/cron/inactive-users/route.ts
    - .github/workflows/daily-cron.yml
  modified:
    - apps/web/src/lib/carrotquest/emails.ts
    - apps/web/src/app/auth/callback/route.ts
key_decisions:
  - "ACTIVE subscriptions checked for expiry (2-3 day window) per plan spec"
  - "24h sliding window for idempotency — no extra DB table needed"
  - "Welcome email fires on first email confirmation via lastActiveAt === null check"
patterns_established:
  - "Cron endpoint pattern: POST + CRON_SECRET Bearer auth + force-dynamic"
  - "24h window idempotency: users fall into window for exactly one day per threshold"
requirements_completed: [CQ-04, CQ-06, CQ-07, CQ-08, CQ-09, CQ-10]
duration: 4min
completed: 2026-03-24
---

# Phase 33 Plan 02: Registration, Expiring, Inactive Events + Cron Endpoints Summary

**Two new email helpers, welcome event in auth callback, two secured cron endpoints with 24h sliding window idempotency, daily GitHub Action**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T14:49:50Z
- **Completed:** 2026-03-24T14:53:29Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `sendSubscriptionExpiringEmail` and `sendInactiveEmail` to carrotquest emails module
- Auth callback now fires `pa_registration_completed` on first email confirmation (lastActiveAt === null)
- Two separate cron endpoints for subscription expiry and user inactivity, both secured with CRON_SECRET
- GitHub Action `daily-cron.yml` runs at 06:00 UTC, calling both cron endpoints

## Task Commits

1. **Task 1+2: Email functions + auth callback + cron endpoints + GitHub Action** - `36a398c` (feat)

## Files Created/Modified
- `apps/web/src/lib/carrotquest/emails.ts` - Added sendSubscriptionExpiringEmail and sendInactiveEmail
- `apps/web/src/app/auth/callback/route.ts` - Added pa_registration_completed on first email confirmation
- `apps/web/src/app/api/cron/check-subscriptions/route.ts` - ACTIVE subs expiring in 2-3 days
- `apps/web/src/app/api/cron/inactive-users/route.ts` - 7/14/30 day inactivity with 24h windows
- `.github/workflows/daily-cron.yml` - Daily 06:00 UTC trigger for both cron endpoints

## Decisions Made
- ACTIVE subscriptions checked for expiry per plan spec (existing email-scheduler checks CANCELLED — both endpoints coexist)
- 24h sliding window idempotency: subscription window is 2d..3d from now; inactivity windows are Nd..(N+1)d ago
- Welcome email is fire-and-forget (.catch) so it doesn't block the auth redirect

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

GitHub Secrets needed for `daily-cron.yml`:
- `CRON_SECRET` - same value as in `.env.production` on VPS
- `SITE_URL` - `https://platform.mpstats.academy`

Both already documented in existing `email-scheduler.yml` workflow (same secrets).

## Next Phase Readiness
- All 10 CQ events now have code coverage (Plan 01 + Plan 02)
- Existing email-scheduler.yml handles the same events via different approach — can be consolidated later
- Ready for CQ dashboard automation rule setup (manual step)

## Self-Check: PASSED

- All 5 files exist on disk
- Commit 36a398c verified in git log
- pa_subscription_expiring confirmed in emails.ts (called by check-subscriptions endpoint)
- pa_inactive_7 confirmed in emails.ts (called by inactive-users endpoint)
- pa_registration_completed confirmed in auth callback
- TypeScript compiles (only pre-existing e2e error)

---
*Phase: 33-cq-email-automation*
*Completed: 2026-03-24*
