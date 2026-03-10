# Phase 16: Billing Data Foundation - Research

**Researched:** 2026-03-10
**Domain:** Prisma schema design (subscriptions, payments, feature flags) + admin UI for toggles
**Confidence:** HIGH

## Summary

Phase 16 is a pure data-layer phase: new Prisma models (Subscription, Payment, PaymentEvent, FeatureFlag), new fields on existing models (Course.price, Course.isFree, UserProfile.yandexId), seed data, and an admin Settings page for feature flag toggles. No payment processing, no webhooks, no paywall UI.

The existing codebase has well-established patterns for Prisma enums (PascalCase with SCREAMING_SNAKE values), admin procedures (adminProcedure guard), and admin UI (AdminSidebar with nav items, Card-based pages with lucide-react icons). All new code follows these patterns directly.

**Primary recommendation:** Add 4 new Prisma models + 2 enums, extend Course and UserProfile, create seed script, add admin.getFeatureFlags/toggleFeatureFlag endpoints, and build /admin/settings page following existing admin UI patterns exactly.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- All 6 courses paid, Course.isFree=false by default
- Single price: Course.price = 4990 (Int, rubles, no kopecks)
- Two subscription types: per-course (COURSE) and full platform (PLATFORM), both recurring monthly
- One Subscription model with enum type: COURSE | PLATFORM
- Statuses: ACTIVE, PAST_DUE, CANCELLED, EXPIRED
- On cancel: access until currentPeriodEnd
- Platform subscription absorbs course subscription
- Payment model stores each payment, PaymentEvent is webhook audit log
- FeatureFlag table: key (unique), enabled (bool), description
- First flag: billing_enabled = false
- Admin settings page at /admin/settings with toggle list
- Pricing is placeholder, owner adjusts via admin before launch
- 1-2 free preview lessons per course (implemented in Phase 20, not here)

### Claude's Discretion
- Exact field structure of Subscription/Payment/PaymentEvent
- Whether SubscriptionPlan is a separate model or hardcoded
- Overlap logic for course-to-platform upgrade
- Indexes and constraints in Prisma

### Deferred Ideas (OUT OF SCOPE)
- Paid diagnostics (v1.3+)
- Promo codes and discounts BILL-08 (v1.3)
- Trial period BILL-09 (v1.3)
- 54-FZ integration via CloudKassir BILL-07 (v1.3)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BILL-06 | Prisma models: Subscription, Payment, PaymentEvent, FeatureFlag | Schema design section with all fields, enums, indexes, and relations |
| BILL-04 | Billing toggle: enable/disable billing via DB flag without deploy | FeatureFlag model + admin endpoints + /admin/settings UI |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 5.x | ORM, schema, migrations | Already used throughout |
| tRPC | 11.x | API layer | Already used, adminProcedure ready |
| Next.js | 14 | App Router pages | Already used for admin UI |
| shadcn/ui | latest | UI components (Card, Button, Switch) | Already used in admin |
| lucide-react | latest | Icons | Already used in AdminSidebar |

### Supporting (may need to add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Switch | latest | Toggle component for feature flags | If not already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SubscriptionPlan model | Hardcoded plan config | Hardcoded is simpler for 2 plans, but model allows admin price editing without deploys. **Recommend: separate SubscriptionPlan model** since owner wants to adjust prices via admin |

## Architecture Patterns

### Recommended Prisma Schema Additions

```prisma
// ============== BILLING ==============

enum SubscriptionType {
  COURSE
  PLATFORM
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  EXPIRED
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

model SubscriptionPlan {
  id            String           @id @default(cuid())
  type          SubscriptionType @unique  // COURSE or PLATFORM — one plan per type
  name          String                    // "Подписка на курс" / "Полный доступ"
  price         Int                       // rubles, e.g. 4990
  intervalDays  Int              @default(30) // billing cycle
  isActive      Boolean          @default(true)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  subscriptions Subscription[]
}

model Subscription {
  id               String             @id @default(cuid())
  userId           String
  planId           String
  courseId          String?            // null for PLATFORM, course ID for COURSE
  status           SubscriptionStatus @default(ACTIVE)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelledAt      DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  user     UserProfile      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan     SubscriptionPlan @relation(fields: [planId], references: [id])
  course   Course?          @relation(fields: [courseId], references: [id])
  payments Payment[]

  @@index([userId])
  @@index([userId, status])
  @@index([courseId])
}

model Payment {
  id              String        @id @default(cuid())
  subscriptionId  String
  amount          Int           // rubles
  status          PaymentStatus @default(PENDING)
  cloudPaymentsTxId String?    @unique  // CloudPayments TransactionId for idempotency
  paidAt          DateTime?
  createdAt       DateTime      @default(now())

  subscription Subscription   @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  events       PaymentEvent[]

  @@index([subscriptionId])
  @@index([cloudPaymentsTxId])
}

model PaymentEvent {
  id        String   @id @default(cuid())
  paymentId String
  type      String   // "pay", "fail", "refund", "recurrent" — raw from CloudPayments
  payload   Json     // full webhook payload for audit
  createdAt DateTime @default(now())

  payment Payment @relation(fields: [paymentId], references: [id], onDelete: Cascade)

  @@index([paymentId])
}

// ============== FEATURE FLAGS ==============

model FeatureFlag {
  key         String   @id          // "billing_enabled", "maintenance_mode"
  enabled     Boolean  @default(false)
  description String?
  updatedAt   DateTime @updatedAt
}
```

### Changes to Existing Models

```prisma
// Course — add pricing fields
model Course {
  // ... existing fields ...
  price   Int     @default(0)    // rubles, 0 = free
  isFree  Boolean @default(true) // explicit flag for queries

  // ... existing relations ...
  subscriptions Subscription[]
}

// UserProfile — add yandexId
model UserProfile {
  // ... existing fields ...
  yandexId String? @unique  // for future Yandex ID OAuth binding

  // ... existing relations ...
  subscriptions Subscription[]
}
```

### Pattern: SubscriptionPlan as Separate Model

**Why:** The user explicitly said "prices are placeholder, owner will set final prices via admin before launch." A SubscriptionPlan model allows:
- Admin can change price without code deploy
- Plan types are extensible (if they add yearly plans later)
- Clean separation: plan defines terms, subscription is instance

**Structure:** Only 2 plans seeded initially:
1. COURSE plan (4990 RUB/month)
2. PLATFORM plan (4990 RUB/month — same price initially, owner will differentiate)

### Pattern: Feature Flag Read Helper

```typescript
// packages/api/src/utils/feature-flags.ts
import { prisma } from '@mpstats/db';

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
  });
  return flag?.enabled ?? false;
}

// Usage in any tRPC procedure:
const billingEnabled = await isFeatureEnabled('billing_enabled');
```

### Pattern: Admin Feature Flag Endpoints

Follow existing `toggleUserField` pattern from admin.ts:

```typescript
// In admin router
getFeatureFlags: adminProcedure.query(async ({ ctx }) => {
  return ctx.prisma.featureFlag.findMany({
    orderBy: { key: 'asc' },
  });
}),

toggleFeatureFlag: adminProcedure
  .input(z.object({ key: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const flag = await ctx.prisma.featureFlag.findUnique({
      where: { key: input.key },
    });
    if (!flag) throw new TRPCError({ code: 'NOT_FOUND' });
    return ctx.prisma.featureFlag.update({
      where: { key: input.key },
      data: { enabled: !flag.enabled },
    });
  }),
```

### Admin Settings Page Pattern

Follow existing admin page structure (Card-based, StatCard-style layout):

```
apps/web/src/app/(admin)/admin/settings/page.tsx
```

- Page title + description (same as other admin pages)
- Card with list of feature flags
- Each flag: name, description, Switch toggle
- Use shadcn/ui Switch component (may need to add via `npx shadcn@latest add switch`)
- Optimistic update on toggle with error rollback

### AdminSidebar Update

Add Settings nav item with `Settings` icon from lucide-react:

```typescript
// In AdminSidebar navItems array:
{
  title: 'Settings',
  href: '/admin/settings',
  icon: Settings,  // from lucide-react
}
```

### Seed Script Pattern

Since there's no existing seed script (`pnpm db:push + manual SQL` is current pattern), create a migration-friendly seed:

```
scripts/seed/seed-billing.ts
```

Operations:
1. Upsert FeatureFlag records: `billing_enabled` (false), optionally `maintenance_mode` (false)
2. Upsert SubscriptionPlan records: COURSE (4990), PLATFORM (4990)
3. Update all Course records: `price = 4990, isFree = false`

**Run via:** `npx tsx scripts/seed/seed-billing.ts` or add as `pnpm db:seed-billing`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature flag toggle UI | Custom checkbox with state | shadcn/ui Switch component | Accessible, animated, consistent |
| Enum validation | Manual string checks | Zod enums matching Prisma enums | Type-safe, auto-validated |
| Optimistic updates | Manual state management | tRPC utils.invalidate after mutation | Already used pattern in admin |

## Common Pitfalls

### Pitfall 1: Prisma Migrate vs db:push on Supabase
**What goes wrong:** `db:push` drops and recreates tables, losing production data. `db:migrate` needs careful ordering.
**Why it happens:** Project currently uses `db:push` for development.
**How to avoid:** For this phase, use `prisma migrate dev --name add-billing-models` to create proper migration. Then apply to Supabase via `prisma migrate deploy`. Existing data in Course/UserProfile tables must be preserved.
**Warning signs:** If migration fails, check that new `NOT NULL` fields have defaults.

### Pitfall 2: Course.isFree Default vs Migration
**What goes wrong:** Adding `isFree Boolean @default(true)` but then seed sets all to `false` — inconsistency between schema default and business intent.
**Why it happens:** Default should reflect "billing off" state (everything accessible).
**How to avoid:** Schema default `isFree = true`, seed updates to `false`. When billing is disabled, `isFree` doesn't matter; when enabled, seed data is correct.

### Pitfall 3: Missing Relation on UserProfile
**What goes wrong:** Adding `subscriptions Subscription[]` to UserProfile but forgetting to update the existing `UserProfile` model's relations list.
**Why it happens:** Prisma needs both sides of relation declared.
**How to avoid:** Add relation fields to both UserProfile and Course models.

### Pitfall 4: cloudPaymentsTxId Uniqueness Before Webhooks Exist
**What goes wrong:** Creating Payment records in tests/seed without cloudPaymentsTxId, then later CloudPayments sends duplicates.
**Why it happens:** The field is optional now but will be critical for idempotency in Phase 18.
**How to avoid:** Make `cloudPaymentsTxId` optional (`String?`) with unique constraint. Null values don't violate unique in PostgreSQL.

### Pitfall 5: SubscriptionPlan.type @unique May Block Future Plans
**What goes wrong:** If they want two COURSE plans with different prices (e.g., monthly vs yearly).
**Why it happens:** `@unique` on type limits to one plan per type.
**How to avoid:** For now this is fine (only monthly). If yearly plans are needed later, remove @unique and add interval field. Document this as known limitation.

## Code Examples

### Migration Strategy

```bash
# 1. Generate migration (development)
cd packages/db
npx prisma migrate dev --name add-billing-models

# 2. Apply to production Supabase
npx prisma migrate deploy

# 3. Generate updated client
npx prisma generate
```

### Seed Script Structure

```typescript
// scripts/seed/seed-billing.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Feature Flags
  await prisma.featureFlag.upsert({
    where: { key: 'billing_enabled' },
    update: {},
    create: { key: 'billing_enabled', enabled: false, description: 'Enable billing and subscription features' },
  });

  await prisma.featureFlag.upsert({
    where: { key: 'maintenance_mode' },
    update: {},
    create: { key: 'maintenance_mode', enabled: false, description: 'Show maintenance page to non-admin users' },
  });

  // 2. Subscription Plans
  await prisma.subscriptionPlan.upsert({
    where: { type: 'COURSE' },
    update: { price: 4990 },
    create: { type: 'COURSE', name: 'Подписка на курс', price: 4990, intervalDays: 30 },
  });

  await prisma.subscriptionPlan.upsert({
    where: { type: 'PLATFORM' },
    update: { price: 4990 },
    create: { type: 'PLATFORM', name: 'Полный доступ', price: 4990, intervalDays: 30 },
  });

  // 3. Update all courses: set price and isFree
  await prisma.course.updateMany({
    data: { price: 4990, isFree: false },
  });

  console.log('Billing seed complete');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
```

### Feature Flag Admin Page

```typescript
// apps/web/src/app/(admin)/admin/settings/page.tsx
'use client';

import { trpc } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Settings as SettingsIcon } from 'lucide-react';

export default function AdminSettingsPage() {
  const flags = trpc.admin.getFeatureFlags.useQuery();
  const toggle = trpc.admin.toggleFeatureFlag.useMutation({
    onSuccess: () => flags.refetch(),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-heading-lg font-bold text-mp-gray-900">Settings</h2>
        <p className="text-body-sm text-mp-gray-500 mt-1">Feature flags and platform configuration</p>
      </div>

      <Card className="divide-y divide-mp-gray-100">
        {flags.data?.map((flag) => (
          <div key={flag.key} className="flex items-center justify-between p-4">
            <div>
              <p className="text-body-sm font-medium text-mp-gray-900">{flag.key}</p>
              {flag.description && (
                <p className="text-xs text-mp-gray-500 mt-0.5">{flag.description}</p>
              )}
            </div>
            <Switch
              checked={flag.enabled}
              onCheckedChange={() => toggle.mutate({ key: flag.key })}
              disabled={toggle.isPending}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Env vars for feature flags | DB-backed feature flags | Standard practice | No deploy needed for toggles |
| Single "subscription" boolean | Typed subscription with plans | N/A (new) | Supports course vs platform billing |

## Open Questions

1. **SubscriptionPlan pricing editable in admin?**
   - What we know: Owner wants to set final prices via admin before launch
   - What's unclear: Does Phase 16 need price editing UI, or just the model?
   - Recommendation: Phase 16 creates the model and seed data only. Price editing UI can be in Phase 19 (billing UI phase). Keep scope minimal.

2. **Additional feature flags beyond billing_enabled?**
   - What we know: Context says "add if reasonable" for maintenance_mode etc.
   - Recommendation: Seed `billing_enabled` and `maintenance_mode`. Both are useful and zero-cost.

3. **Course-to-Platform upgrade overlap logic**
   - What we know: Platform subscription absorbs course subscription
   - What's unclear: Exact DB behavior when upgrading
   - Recommendation: This is Phase 18-19 logic (subscription management). Phase 16 just needs the schema to support it: Subscription.status can be set to CANCELLED when platform sub is created.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BILL-06 | Prisma models exist and can CRUD | integration | `npx prisma validate` (schema check) | N/A - schema validation |
| BILL-06 | Subscription/Payment relations work | unit | `pnpm test -- --run tests/billing-models.test.ts` | Wave 0 |
| BILL-04 | Feature flag read/toggle via tRPC | unit | `pnpm test -- --run tests/feature-flags.test.ts` | Wave 0 |
| BILL-04 | Admin settings page renders flags | unit | `pnpm test -- --run tests/admin-settings.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx prisma validate && pnpm test --run`
- **Per wave merge:** `pnpm test && pnpm build`
- **Phase gate:** Full suite green + `prisma validate` + manual admin settings page check

### Wave 0 Gaps
- [ ] `npx shadcn@latest add switch` -- if Switch component not yet installed
- [ ] `scripts/seed/seed-billing.ts` -- seed script for billing data
- [ ] Schema validation: `npx prisma validate` after model changes

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/db/prisma/schema.prisma` -- current schema patterns, enum naming, relation style
- Existing codebase: `packages/api/src/routers/admin.ts` -- admin endpoint patterns, toggleUserField as reference
- Existing codebase: `packages/api/src/trpc.ts` -- adminProcedure guard
- Existing codebase: `apps/web/src/components/admin/AdminSidebar.tsx` -- nav item structure

### Secondary (MEDIUM confidence)
- Prisma documentation -- standard practices for enums, relations, indexes, upsert
- shadcn/ui -- Switch component API

### Tertiary (LOW confidence)
- None -- all recommendations based on existing codebase patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - follows existing patterns exactly (Prisma enums, admin router, admin UI)
- Pitfalls: HIGH - identified from direct codebase inspection (migration strategy, relation requirements)

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, no external dependencies changing)
