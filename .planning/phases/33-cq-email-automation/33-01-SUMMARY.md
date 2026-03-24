---
phase: 33-cq-email-automation
plan: 01
subsystem: carrotquest-events
tags: [cq, events, schema, trpc, rename]
dependency_graph:
  requires: []
  provides: [pa-prefixed-events, lastActiveAt-field, activity-tracking]
  affects: [carrotquest-emails, supabase-email-hook, email-scheduler, support-api, trpc-context]
tech_stack:
  added: []
  patterns: [fire-and-forget-db-update, debounced-tracking]
key_files:
  created: []
  modified:
    - apps/web/src/lib/carrotquest/types.ts
    - apps/web/src/lib/carrotquest/emails.ts
    - apps/web/src/app/api/webhooks/supabase-email/route.ts
    - apps/web/src/app/api/cron/email-scheduler/route.ts
    - apps/web/src/app/api/support/route.ts
    - packages/db/prisma/schema.prisma
    - packages/api/src/trpc.ts
decisions:
  - "All CQ events use pa_ prefix per CQ team specification"
  - "lastActiveAt uses fire-and-forget with 5-minute debounce to avoid DB hammering"
  - "userId captured before async chain to satisfy TypeScript strict null checks"
metrics:
  duration: 209s
  completed: 2026-03-24T14:49:44Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 33 Plan 01: CQ Event Rename + lastActiveAt Tracking Summary

**All 12 CQ events migrated to pa_ prefix, lastActiveAt field added with fire-and-forget tracking in tRPC middleware**

## What Was Done

### Task 1: Rename CQ events to pa_ prefix
- Updated `CQEventName` type union: all 12 events now use `pa_` prefix
- Updated 4 email helper functions in `emails.ts`: event names and property names (pa_amount, pa_course_name, pa_period_end, pa_access_until, pa_name)
- Updated `supabase-email/route.ts`: signup -> `pa_doi` (with `pa_doi` property), recovery -> `pa_password_reset` (with `pa_password_link` property), email_change -> `pa_email_change`
- [Deviation Rule 3] Fixed `email-scheduler/route.ts`: `Subscription Expiring` -> `pa_subscription_expiring`, inactive events -> `pa_inactive_7/14/30`, properties renamed
- [Deviation Rule 3] Fixed `support/route.ts`: `Support Request` -> `pa_support_request`

### Task 2: Add lastActiveAt to schema + tRPC tracking
- Added `lastActiveAt DateTime?` to `UserProfile` model in Prisma schema
- Generated Prisma client (--no-engine due to DLL lock from running dev server)
- Added fire-and-forget lastActiveAt update in `protectedProcedure` middleware with 5-minute debounce

## Event Name Mapping

| Old Name | New Name |
|----------|----------|
| Payment Success | pa_payment_success |
| Payment Failed | pa_payment_failed |
| Subscription Cancelled | pa_subscription_cancelled |
| Subscription Expiring | pa_subscription_expiring |
| User Registered | pa_registration_completed |
| Inactive 7d/14d/30d | pa_inactive_7/14/30 |
| Email Confirmation | pa_doi |
| Password Reset | pa_password_reset |
| Email Change | pa_email_change |
| Support Request | pa_support_request |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1+2 | 2095445 | feat(33-01): rename CQ events to pa_ prefix + add lastActiveAt tracking |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed email-scheduler and support route old event names**
- **Found during:** Task 1 verification (grep for old names)
- **Issue:** `email-scheduler/route.ts` and `support/route.ts` also used old CQ event names not listed in plan's files_modified
- **Fix:** Updated all event names and properties in both files
- **Files modified:** `apps/web/src/app/api/cron/email-scheduler/route.ts`, `apps/web/src/app/api/support/route.ts`
- **Commit:** 2095445

**2. [Rule 1 - Bug] Fixed TypeScript strict null check in trpc.ts**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `ctx.user.id` inside `.then()` callback was flagged as possibly null by TypeScript
- **Fix:** Captured `const userId = ctx.user.id` before the async chain
- **Commit:** 2095445

## Known Stubs

None.

## Verification

- TypeScript compiles: packages/api OK, apps/web OK (only pre-existing errors in ai/tagging.ts and e2e test)
- grep for old event names in src/: zero matches
- grep for pa_ events: confirmed in types.ts, emails.ts, supabase-email route, email-scheduler, support route
- Prisma client generated with lastActiveAt field
- subscription-service.ts imports unchanged (function signatures preserved)
