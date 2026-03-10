---
phase: 16-billing-data-foundation
plan: 01
subsystem: database
tags: [prisma, billing, subscriptions, payments, feature-flags, migration]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Prisma schema with UserProfile, Course, Lesson models"
provides:
  - "Billing data models: SubscriptionPlan, Subscription, Payment, PaymentEvent, FeatureFlag"
  - "Course.price and Course.isFree fields for paywall logic"
  - "UserProfile.yandexId field for Yandex ID OAuth binding"
  - "isFeatureEnabled() helper for billing gating"
  - "Prisma migrate baseline + billing migration applied to Supabase"
  - "Seed script with billing_enabled=false, 2 plans at 4990 RUB"
affects: [17-yandex-auth, 18-cloudpayments, 19-paywall-ui, 20-billing-admin]

# Tech tracking
tech-stack:
  added: []
  patterns: ["prisma migrate (baseline + deploy) instead of db push", "feature flags via FeatureFlag model + isFeatureEnabled()"]

key-files:
  created:
    - "packages/api/src/utils/feature-flags.ts"
    - "scripts/seed/seed-billing.ts"
    - "packages/db/prisma/migrations/0_init/migration.sql"
    - "packages/db/prisma/migrations/20260310081455_add_billing_models/migration.sql"
  modified:
    - "packages/db/prisma/schema.prisma"
    - "package.json"

key-decisions:
  - "Baselined existing DB with prisma migrate (0_init) since project previously used db push"
  - "Used prisma migrate diff + deploy instead of interactive migrate dev (non-interactive env)"
  - "All new NOT NULL fields have defaults for safe migration on existing data"

patterns-established:
  - "Prisma migrations: use baseline + migrate deploy pattern for Supabase"
  - "Feature flags: FeatureFlag model with isFeatureEnabled() safe-default helper"
  - "Seed scripts: standalone PrismaClient with upsert for idempotency"

requirements-completed: [BILL-06]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 16 Plan 01: Billing Data Foundation Summary

**Prisma billing schema with 5 new models (SubscriptionPlan, Subscription, Payment, PaymentEvent, FeatureFlag), 3 enums, migration applied to Supabase, seed data with billing_enabled=false**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T08:13:31Z
- **Completed:** 2026-03-10T08:17:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- 5 new billing models with proper relations, indexes, and enums added to Prisma schema
- Course extended with price/isFree, UserProfile extended with yandexId for downstream phases
- Prisma migrate baseline established (project previously used db push) and billing migration applied
- Feature flag helper and idempotent seed script ready for use

## Task Commits

Each task was committed atomically:

1. **Task 1: Add billing models to Prisma schema and run migration** - `e09d95f` (feat)
2. **Task 2: Create feature flag helper and billing seed script** - `0c9baa8` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added 5 billing models, 3 enums, extended Course and UserProfile
- `packages/db/prisma/migrations/0_init/migration.sql` - Baseline of existing DB state
- `packages/db/prisma/migrations/20260310081455_add_billing_models/migration.sql` - Billing schema migration
- `packages/api/src/utils/feature-flags.ts` - isFeatureEnabled() helper for billing gating
- `scripts/seed/seed-billing.ts` - Seed: 2 flags, 2 plans (4990 RUB), 6 courses updated
- `package.json` - Added db:seed-billing script

## Decisions Made
- **Prisma migrate baseline:** Project used `db push` previously. Created `0_init` baseline migration from current DB state and marked it as applied, enabling proper `migrate deploy` workflow going forward.
- **Non-interactive migration:** Used `prisma migrate diff --script` + `prisma migrate deploy` since the environment doesn't support interactive `migrate dev`.
- **Safe defaults:** All new NOT NULL fields (price, isFree) have defaults, so migration succeeded on existing 6 courses and user profiles without data loss.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma migrate baseline required**
- **Found during:** Task 1 (migration)
- **Issue:** `prisma migrate deploy` failed with P3005 "database schema is not empty" because the project never used migrations before (used `db push`)
- **Fix:** Created `0_init` baseline migration from current DB state using `prisma migrate diff --from-empty --to-schema-datasource`, then `prisma migrate resolve --applied 0_init`
- **Files modified:** `packages/db/prisma/migrations/0_init/migration.sql`
- **Verification:** `prisma migrate deploy` succeeded, billing migration applied
- **Committed in:** `e09d95f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Baseline was necessary to enable migration workflow. No scope creep.

## Issues Encountered
None beyond the baseline deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Billing schema ready for Phase 17 (Yandex Auth - yandexId field exists)
- Billing schema ready for Phase 18 (CloudPayments - Payment, PaymentEvent models exist)
- Feature flag `billing_enabled=false` ensures billing code won't activate until explicitly enabled
- All courses marked as paid (4990 RUB) but gating not enforced until paywall phase

---
*Phase: 16-billing-data-foundation*
*Completed: 2026-03-10*
