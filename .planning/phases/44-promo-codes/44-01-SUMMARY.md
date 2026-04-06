---
phase: 44-promo-codes
plan: 01
subsystem: api, database
tags: [prisma, trpc, promo-codes, subscription, billing]

requires:
  - phase: 16-billing-data-foundation
    provides: Subscription, SubscriptionPlan, SubscriptionType models
provides:
  - PromoCode and PromoActivation Prisma models
  - promo tRPC router with validate, activate, and 4 admin procedures
  - Subscription.promoCodeId nullable field for promo-sourced subscriptions
  - CQ event type pa_promo_activated
affects: [44-02-PLAN, 44-03-PLAN, 44-04-PLAN]

tech-stack:
  added: []
  patterns: [promo code validation chain (5 checks), transactional activation with audit trail]

key-files:
  created:
    - packages/api/src/routers/promo.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/root.ts
    - apps/web/src/lib/carrotquest/types.ts

key-decisions:
  - "CQ pa_promo_activated event fired from frontend, not backend (follows existing CQ pattern)"
  - "Auto-generated promo codes use PROMO-XXXXX format (5 random alphanumeric chars)"

patterns-established:
  - "Promo activation: 5-step validation then $transaction for atomicity"
  - "Public validate + protected activate pattern for promo codes"

requirements-completed: [D-01, D-02, D-05, D-06, D-07, D-08]

duration: 16min
completed: 2026-04-06
---

# Phase 44 Plan 01: Promo Codes DB Schema and tRPC Router Summary

**PromoCode/PromoActivation Prisma models with 6-procedure tRPC router: public validate, protected activate (5-check + transaction), 4 admin CRUD endpoints**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-06T19:16:07Z
- **Completed:** 2026-04-06T19:32:25Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PromoCode model with code, planType, durationDays, maxUses, expiresAt, isActive, createdBy
- PromoActivation audit model with @@unique([promoCodeId, userId]) preventing duplicate use
- Subscription.promoCodeId nullable field distinguishing promo-sourced from paid subscriptions
- promo.validate (public) and promo.activate (protected, 5 validation checks + $transaction)
- 4 admin procedures: getPromoCodes, createPromoCode, deactivatePromoCode, getPromoActivations

## Task Commits

1. **Task 1: Add PromoCode, PromoActivation models and Subscription.promoCodeId** - `880fad6` (feat)
2. **Task 2: Create promo tRPC router, wire to root** - `9e9bcf7` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - PromoCode, PromoActivation models, Subscription.promoCodeId, Course.promoCodes, UserProfile.promoActivations
- `packages/api/src/routers/promo.ts` - Full promo tRPC router (validate, activate, 4 admin procedures)
- `packages/api/src/root.ts` - Wired promoRouter into appRouter
- `apps/web/src/lib/carrotquest/types.ts` - Added pa_promo_activated CQ event type

## Decisions Made
- CQ pa_promo_activated event fired from frontend after successful activation response (follows existing pattern where CQ/Metrika is client-side)
- Auto-generated promo codes use PROMO-XXXXX format with random alphanumeric characters

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prisma validate requires DATABASE_URL/DIRECT_URL env vars - used dummy values for schema validation in worktree
- Global prisma v7 on system conflicted with project v5.22.0 - used project-local binary from packages/db/node_modules/.bin/prisma
- pnpm typecheck shows pre-existing errors (missing module declarations in monorepo) - no new errors from promo router changes

## User Setup Required
- `prisma db push` must be run against production DB to create PromoCode and PromoActivation tables and add promoCodeId column to Subscription

## Next Phase Readiness
- Schema and router ready for Plan 02 (pricing page UI) and Plan 03 (admin page)
- Schema push to DB required before frontend can call promo procedures

## Self-Check: PASSED

- All 5 files verified present
- Both commit hashes (880fad6, 9e9bcf7) found in git log

---
*Phase: 44-promo-codes*
*Completed: 2026-04-06*
