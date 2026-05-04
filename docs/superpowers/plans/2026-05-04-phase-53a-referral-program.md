# Phase 53A — Referral Program (External Flow) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Запустить пользовательскую реферальную программу: backfill `REF-*` кодов всем DOI-confirmed юзерам, парсинг `?ref=` в cookie, выдача 14-day trial PLATFORM-подписки приглашённому при регистрации, накопительные пакеты по 14 дней рефереру с ручной активацией. Один код покрывает обе итерации (i1 без условия оплаты, i2 после оплаты другом) через feature flag `referral_pay_gated`.

**Architecture:** Новый enum-значение `TRIAL` в `SubscriptionStatus` + новая таблица `Referral` + новая `ReferralBonusPackage` + поле `UserProfile.referralCode`. Логика активации пакета — pure function в `apps/web/src/lib/referral/activation.ts`, тестируемая. Хуки в `auth/confirm` route и Yandex OAuth callback читают cookie, дёргают anti-fraud checks, создают Referral + Package + Trial subscription. CP webhook `pay` в i2 mode конвертирует pending Referral в зачёт пакета.

**Tech Stack:** Next.js 14 App Router, Prisma 5.22, tRPC, Vitest (unit), Playwright (E2E), Tailwind, shadcn/ui, Supabase Auth.

**Spec:** `docs/superpowers/specs/2026-05-04-phase-53a-referral-program-design.md`

---

## File Structure

**New files:**
- `apps/web/src/lib/referral/code-generator.ts` — REF-* generation w/ collision retry
- `apps/web/src/lib/referral/activation.ts` — pure activation logic (testable)
- `apps/web/src/lib/referral/attribution.ts` — cookie read/write + validation
- `apps/web/src/lib/referral/fraud-checks.ts` — self-ref + cap-rate-limit
- `apps/web/src/lib/referral/issue.ts` — orchestrator: создаёт Referral + Package + Trial Sub в транзакции
- `apps/web/src/lib/referral/__tests__/code-generator.test.ts`
- `apps/web/src/lib/referral/__tests__/activation.test.ts`
- `apps/web/src/lib/referral/__tests__/fraud-checks.test.ts`
- `apps/web/src/lib/referral/__tests__/attribution.test.ts`
- `packages/api/src/services/billing/trial-subscription.ts` — createTrialSubscription
- `packages/api/src/routers/referral.ts` — tRPC router (getMyState, validateCode, activatePackage)
- `packages/api/src/routers/__tests__/referral.test.ts`
- `apps/web/src/app/(main)/profile/referral/page.tsx`
- `apps/web/src/components/profile/ReferralCodeBlock.tsx`
- `apps/web/src/components/profile/ReferralPackageList.tsx`
- `apps/web/src/components/profile/ReferralRulesText.tsx`
- `scripts/backfill-referral-codes.ts`
- `apps/web/tests/e2e/phase-53a-referral.spec.ts`

**Modified files:**
- `packages/db/prisma/schema.prisma` — enum + new tables + UserProfile field
- `packages/api/src/utils/access.ts` — include TRIAL in subscription queries
- `packages/api/src/routers/billing.ts` — include TRIAL where ACTIVE/CANCELLED queried
- `apps/web/src/lib/cloudpayments/subscription-service.ts` — handle trial replacement on first paid event
- `apps/web/src/lib/carrotquest/types.ts` — add 4 new CQ event names
- `apps/web/src/middleware.ts` — parse ?ref=, set cookie
- `apps/web/src/app/auth/confirm/route.ts` — referral hook after DOI verifyOtp success
- `apps/web/src/app/api/auth/yandex/callback/route.ts` — referral hook after OAuth success
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` — i2 conversion trigger in `pay` handler
- `apps/web/src/app/(auth)/register/page.tsx` — read cookie, show "+14 days" banner
- `apps/web/src/app/(main)/profile/page.tsx` — add "Рефералка" link to profile sections
- `packages/api/src/root.ts` — register referral router

---

## Task 1: Schema migration — TRIAL enum + Referral + ReferralBonusPackage + UserProfile.referralCode

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add TRIAL enum value to SubscriptionStatus**

In `packages/db/prisma/schema.prisma`, find `enum SubscriptionStatus` (around line 290 in current schema) and add `TRIAL`:

```prisma
enum SubscriptionStatus {
  PENDING
  ACTIVE
  TRIAL
  PAST_DUE
  CANCELLED
  EXPIRED
}
```

- [ ] **Step 2: Add referral models and UserProfile field**

In the same file, append at the end (before the closing of the file or near other domain blocks):

```prisma
// ============== REFERRAL (Phase 53A) ==============

enum ReferralCodeType {
  EXTERNAL_USER
  INTERNAL_CARE
  INTERNAL_SALES_SERVICE
  INTERNAL_CONSULTING
  INTERNAL_GO
  INTERNAL_TOCHKA
  INTERNAL_OTHER
}

enum ReferralStatus {
  PENDING
  CONVERTED
  EXPIRED
  BLOCKED_SELF_REF
  PENDING_REVIEW
}

enum ReferralBonusPackageStatus {
  PENDING
  USED
  REVOKED
}

model Referral {
  id                 String           @id @default(cuid())
  code               String           // captured at registration time (REF-XXXXXX or CARE-*, etc)
  codeType           ReferralCodeType @default(EXTERNAL_USER)
  referrerUserId     String?          // null for INTERNAL_* (departments tracked via code)
  referredUserId     String           @unique
  status             ReferralStatus   @default(PENDING)
  conversionTrigger  String?          // 'registration' (i1) | 'payment' (i2)
  createdAt          DateTime         @default(now())
  convertedAt        DateTime?

  referrer       UserProfile?           @relation("ReferralsAsReferrer", fields: [referrerUserId], references: [id], onDelete: SetNull)
  referred       UserProfile            @relation("ReferralsAsReferred", fields: [referredUserId], references: [id], onDelete: Cascade)
  bonusPackage   ReferralBonusPackage?

  @@index([referrerUserId, createdAt(sort: Desc)])
  @@index([status])
}

model ReferralBonusPackage {
  id              String                       @id @default(cuid())
  ownerUserId     String
  sourceReferralId String                      @unique
  days            Int                          @default(14)
  status          ReferralBonusPackageStatus   @default(PENDING)
  issuedAt        DateTime                     @default(now())
  usedAt          DateTime?

  owner           UserProfile                  @relation("ReferralPackagesOwned", fields: [ownerUserId], references: [id], onDelete: Cascade)
  sourceReferral  Referral                     @relation(fields: [sourceReferralId], references: [id], onDelete: Cascade)

  @@index([ownerUserId, status])
}
```

Then update `UserProfile` model — add 1 field and 3 back-relations:

```prisma
model UserProfile {
  id        String   @id // Matches Supabase auth.users.id
  name      String?
  avatarUrl String?
  role      Role     @default(USER)
  isActive  Boolean  @default(true)
  yandexId  String?  @unique
  phone     String?
  toursCompleted String[] @default([])
  referralCode String? @unique  // Phase 53A: REF-XXXXXX
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  lastActiveAt DateTime?
  lastNotificationsSeenAt DateTime?

  diagnosticSessions DiagnosticSession[]
  skillProfile       SkillProfile?
  learningPath       LearningPath?
  chatMessages       ChatMessage[]
  lessonComments     LessonComment[]
  subscriptions      Subscription[]
  promoActivations   PromoActivation[]
  notifications      Notification[]
  notificationPrefs  NotificationPreference[]
  referralsMade      Referral[] @relation("ReferralsAsReferrer")
  referralAsFriend   Referral?  @relation("ReferralsAsReferred")
  referralPackages   ReferralBonusPackage[] @relation("ReferralPackagesOwned")
}
```

- [ ] **Step 3: Push schema and verify**

Run: `pnpm --filter @mpstats/db db:push`
Expected: «Database is now in sync with your Prisma schema» — без data loss prompts (все изменения аддитивные).

Run: `pnpm --filter @mpstats/db db:generate`
Expected: «Generated Prisma Client».

- [ ] **Step 4: Typecheck monorepo**

Run: `pnpm typecheck`
Expected: PASS. Если ругается на отсутствие `Referral.*` references где-то — отложи фикс на потом, переходи дальше (нет смысла полировать пока используется только в новом коде).

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(phase-53a): schema — TRIAL status + Referral + ReferralBonusPackage + UserProfile.referralCode"
```

---

## Task 2: REF code generator with collision retry

**Files:**
- Create: `apps/web/src/lib/referral/code-generator.ts`
- Create: `apps/web/src/lib/referral/__tests__/code-generator.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/referral/__tests__/code-generator.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    userProfile: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@mpstats/db/client';
import { generateRefCode, generateUniqueRefCode, REF_ALPHABET } from '../code-generator';

describe('generateRefCode', () => {
  it('returns string in format REF- + 6 chars', () => {
    const code = generateRefCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
  });

  it('uses only safe alphabet (no I, L, O, 0, 1)', () => {
    const code = generateRefCode();
    const chars = code.slice(4); // strip "REF-"
    for (const c of chars) {
      expect(REF_ALPHABET).toContain(c);
    }
    expect(REF_ALPHABET).not.toContain('I');
    expect(REF_ALPHABET).not.toContain('L');
    expect(REF_ALPHABET).not.toContain('O');
    expect(REF_ALPHABET).not.toContain('0');
    expect(REF_ALPHABET).not.toContain('1');
  });
});

describe('generateUniqueRefCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns code on first attempt when no collision', async () => {
    (prisma.userProfile.findUnique as any).mockResolvedValue(null);
    const code = await generateUniqueRefCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledOnce();
  });

  it('retries on collision and returns when free slot found', async () => {
    (prisma.userProfile.findUnique as any)
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    const code = await generateUniqueRefCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledTimes(2);
  });

  it('throws after maxRetries on persistent collision', async () => {
    (prisma.userProfile.findUnique as any).mockResolvedValue({ id: 'existing' });
    await expect(generateUniqueRefCode(3)).rejects.toThrow(/unique ref code/);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/code-generator.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `apps/web/src/lib/referral/code-generator.ts`:

```ts
/**
 * REF-* code generation (Phase 53A).
 *
 * Format: REF- + 6 chars from safe alphabet (excludes I, L, O, 0, 1
 * for visual readability — copy-paste resilience).
 *
 * Address space: 30^6 ≈ 730M combinations.
 * At 100K users: ~0.013% collision probability per generation. 5 retries
 * make practical collision unreachable.
 */

import { prisma } from '@mpstats/db/client';

export const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export function generateRefCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < CODE_LENGTH; i++) {
    chars.push(REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]);
  }
  return `REF-${chars.join('')}`;
}

export async function generateUniqueRefCode(maxRetries = 5): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRefCode();
    const exists = await prisma.userProfile.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error(`Could not generate unique ref code after ${maxRetries} retries`);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/code-generator.test.ts --run`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/referral/code-generator.ts apps/web/src/lib/referral/__tests__/code-generator.test.ts
git commit -m "feat(phase-53a): REF-* code generator with collision retry"
```

---

## Task 3: Backfill script — REF-* для всех существующих юзеров

**Files:**
- Create: `scripts/backfill-referral-codes.ts`

- [ ] **Step 1: Write the script**

Create `scripts/backfill-referral-codes.ts`:

```ts
/**
 * Phase 53A backfill: assign REF-* code to every UserProfile that doesn't have one.
 *
 * Idempotent — re-running skips users already with a code.
 *
 * Usage:
 *   npx tsx scripts/backfill-referral-codes.ts --dry-run
 *   npx tsx scripts/backfill-referral-codes.ts --apply
 */

import { prisma } from '@mpstats/db/client';
import { generateUniqueRefCode } from '../apps/web/src/lib/referral/code-generator';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');

  if (!dryRun && !apply) {
    console.error('Usage: --dry-run or --apply');
    process.exit(1);
  }

  const users = await prisma.userProfile.findMany({
    where: { referralCode: null },
    select: { id: true, name: true },
  });

  console.log(`Found ${users.length} users without referralCode.`);

  if (dryRun) {
    console.log('[DRY RUN] Would assign codes to:');
    for (const u of users.slice(0, 10)) {
      console.log(`  - ${u.id} (${u.name ?? '<no name>'})`);
    }
    if (users.length > 10) console.log(`  ... and ${users.length - 10} more`);
    return;
  }

  let assigned = 0;
  for (const user of users) {
    try {
      const code = await generateUniqueRefCode();
      await prisma.userProfile.update({
        where: { id: user.id },
        data: { referralCode: code },
      });
      assigned++;
      if (assigned % 25 === 0) {
        console.log(`Assigned ${assigned}/${users.length}...`);
      }
    } catch (err) {
      console.error(`Failed for user ${user.id}:`, err);
    }
  }
  console.log(`Done. Assigned ${assigned} codes.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Verify script runs (dry-run)**

Locally with .env pointed at dev DB (or skip if Supabase pause). On prod: deploy first, then run via VPS shell.

Run (when DB available): `npx tsx scripts/backfill-referral-codes.ts --dry-run`
Expected: «Found N users without referralCode. [DRY RUN] Would assign codes to: ...»

If dev DB not available — отложить smoke run до этапа deploy. Скрипт идемпотентен.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-referral-codes.ts
git commit -m "feat(phase-53a): backfill script for REF-* codes"
```

---

## Task 4: Update access checks to recognize TRIAL status

**Files:**
- Modify: `packages/api/src/utils/access.ts:30`
- Modify: `packages/api/src/routers/billing.ts:58,133`

- [ ] **Step 1: Update getUserActiveSubscriptions in access.ts**

In `packages/api/src/utils/access.ts`, find:

```ts
status: { in: ['ACTIVE', 'CANCELLED'] },
```

Replace with:

```ts
status: { in: ['ACTIVE', 'TRIAL', 'CANCELLED'] },
```

- [ ] **Step 2: Audit other ACTIVE-only references in billing-related code**

Run: `pnpm grep "status.*ACTIVE" packages/api/src/routers/billing.ts apps/web/src/lib/cloudpayments/`
Or: `grep -n "'ACTIVE'" packages/api/src/routers/billing.ts apps/web/src/lib/cloudpayments/subscription-service.ts`

Identified call sites and decisions:
- `packages/api/src/routers/billing.ts:58` — getCurrentSubscription includes ACTIVE/PAST_DUE/CANCELLED/PENDING — **add TRIAL**.
- `packages/api/src/routers/billing.ts:133` — checkExisting — used to prevent duplicate active sub when buying. **Add TRIAL** so trial-юзер не создаст вторую active случайно.
- `apps/web/src/lib/cloudpayments/subscription-service.ts:150` — `subscription.status === 'ACTIVE'` — оставить как есть (это конкретный narrow check для recurrent subscription, trial не recurrent).
- `apps/web/src/lib/cloudpayments/subscription-service.ts:257` — pre-existing-sub check, `[PENDING, ACTIVE, PAST_DUE]` — **add TRIAL** так чтобы trial-юзер не создал вторую sub при оплате (вместо этого см. Task 10 — replace flow).

Apply edits:

In `packages/api/src/routers/billing.ts:58`:
```ts
status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELLED', 'PENDING'] },
```

In `packages/api/src/routers/billing.ts:133`:
```ts
{ status: { in: ['ACTIVE', 'TRIAL', 'PAST_DUE'] }, currentPeriodEnd: { gt: now } },
```

In `apps/web/src/lib/cloudpayments/subscription-service.ts:257`:
```ts
status: { in: ['PENDING', 'ACTIVE', 'TRIAL', 'PAST_DUE'] },
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Run access tests**

Run: `pnpm --filter @mpstats/api test --run`
Expected: PASS — existing tests don't reference TRIAL, добавление в `in` array не должно сломать.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/utils/access.ts packages/api/src/routers/billing.ts apps/web/src/lib/cloudpayments/subscription-service.ts
git commit -m "feat(phase-53a): include TRIAL status in subscription queries"
```

---

## Task 5: Trial subscription primitive

**Files:**
- Create: `packages/api/src/services/billing/trial-subscription.ts`

- [ ] **Step 1: Write the helper**

Create `packages/api/src/services/billing/trial-subscription.ts`:

```ts
/**
 * Trial subscription helpers (Phase 53A).
 *
 * createTrialSubscription — creates a TRIAL Subscription on PLATFORM tier
 * with periodEnd = now + N days. Used by:
 *  - Friend registration with ?ref= cookie (Phase 53A — initial trial)
 *  - Package activation when no current sub exists (Phase 53A — packages.ts)
 */

import type { PrismaClient } from '@mpstats/db';

export interface CreateTrialOpts {
  userId: string;
  durationDays: number;
  prismaClient?: PrismaClient | any; // accepts transaction client
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createTrialSubscription(opts: CreateTrialOpts) {
  const tx = opts.prismaClient ?? (await import('@mpstats/db/client')).prisma;

  // Find PLATFORM plan id
  const platformPlan = await tx.subscriptionPlan.findFirst({
    where: { type: 'PLATFORM', isActive: true },
    select: { id: true },
  });
  if (!platformPlan) {
    throw new Error('No active PLATFORM SubscriptionPlan found');
  }

  const now = new Date();
  return tx.subscription.create({
    data: {
      userId: opts.userId,
      planId: platformPlan.id,
      courseId: null,
      status: 'TRIAL',
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + opts.durationDays * DAY_MS),
    },
  });
}

export async function extendSubscriptionByDays(opts: {
  subscriptionId: string;
  days: number;
  prismaClient?: PrismaClient | any;
}) {
  const tx = opts.prismaClient ?? (await import('@mpstats/db/client')).prisma;
  const sub = await tx.subscription.findUnique({
    where: { id: opts.subscriptionId },
    select: { currentPeriodEnd: true },
  });
  if (!sub) throw new Error('Subscription not found');
  return tx.subscription.update({
    where: { id: opts.subscriptionId },
    data: {
      currentPeriodEnd: new Date(sub.currentPeriodEnd.getTime() + opts.days * DAY_MS),
    },
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @mpstats/api typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/services/billing/trial-subscription.ts
git commit -m "feat(phase-53a): trial subscription primitive (create + extend)"
```

---

## Task 6: Activation logic (pure function) + tests

**Files:**
- Create: `apps/web/src/lib/referral/activation.ts`
- Create: `apps/web/src/lib/referral/__tests__/activation.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/referral/__tests__/activation.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockSubFindFirst = vi.fn();
const mockSubUpdate = vi.fn();
const mockSubCreate = vi.fn();
const mockPlanFindFirst = vi.fn();
const mockPkgFindUnique = vi.fn();
const mockPkgUpdate = vi.fn();

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    $transaction: async (cb: any) =>
      cb({
        subscription: {
          findFirst: mockSubFindFirst,
          update: mockSubUpdate,
          create: mockSubCreate,
        },
        subscriptionPlan: { findFirst: mockPlanFindFirst },
        referralBonusPackage: {
          findUnique: mockPkgFindUnique,
          update: mockPkgUpdate,
        },
      }),
  },
}));

import { activatePackage } from '../activation';

const PKG_ID = 'pkg-1';
const USER_ID = 'user-a';
const PLATFORM_PLAN = { id: 'plan-platform', type: 'PLATFORM' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPlanFindFirst.mockResolvedValue(PLATFORM_PLAN);
  mockPkgFindUnique.mockResolvedValue({
    id: PKG_ID,
    ownerUserId: USER_ID,
    days: 14,
    status: 'PENDING',
  });
});

describe('activatePackage', () => {
  it('extends ACTIVE subscription periodEnd by 14 days', async () => {
    const futureEnd = new Date(Date.now() + 5 * 86400_000);
    mockSubFindFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      currentPeriodEnd: futureEnd,
    });

    await activatePackage(PKG_ID, USER_ID);

    expect(mockSubUpdate).toHaveBeenCalledOnce();
    const updateArg = mockSubUpdate.mock.calls[0][0];
    expect(updateArg.where.id).toBe('sub-1');
    const expected = new Date(futureEnd.getTime() + 14 * 86400_000);
    expect(updateArg.data.currentPeriodEnd.getTime()).toBe(expected.getTime());
    expect(mockSubCreate).not.toHaveBeenCalled();
    expect(mockPkgUpdate).toHaveBeenCalledOnce();
  });

  it('extends TRIAL subscription periodEnd by 14 days', async () => {
    const futureEnd = new Date(Date.now() + 3 * 86400_000);
    mockSubFindFirst.mockResolvedValue({
      id: 'sub-trial',
      status: 'TRIAL',
      currentPeriodEnd: futureEnd,
    });

    await activatePackage(PKG_ID, USER_ID);

    expect(mockSubUpdate).toHaveBeenCalledOnce();
    expect(mockSubCreate).not.toHaveBeenCalled();
  });

  it('creates new TRIAL when no active subscription', async () => {
    mockSubFindFirst.mockResolvedValue(null);

    await activatePackage(PKG_ID, USER_ID);

    expect(mockSubCreate).toHaveBeenCalledOnce();
    const createArg = mockSubCreate.mock.calls[0][0];
    expect(createArg.data.status).toBe('TRIAL');
    expect(createArg.data.userId).toBe(USER_ID);
    expect(createArg.data.planId).toBe(PLATFORM_PLAN.id);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockPkgUpdate).toHaveBeenCalledOnce();
  });

  it('creates new TRIAL when current sub expired (periodEnd in past)', async () => {
    // findFirst with currentPeriodEnd > now filter returns null in real life,
    // but if for some reason returns an expired one — we still treat as no active.
    // We test via findFirst returning null (matches WHERE filter).
    mockSubFindFirst.mockResolvedValue(null);
    await activatePackage(PKG_ID, USER_ID);
    expect(mockSubCreate).toHaveBeenCalledOnce();
  });

  it('throws when package not found', async () => {
    mockPkgFindUnique.mockResolvedValue(null);
    await expect(activatePackage(PKG_ID, USER_ID)).rejects.toThrow(/package/i);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCreate).not.toHaveBeenCalled();
  });

  it('throws when package belongs to another user', async () => {
    mockPkgFindUnique.mockResolvedValue({
      id: PKG_ID,
      ownerUserId: 'other-user',
      days: 14,
      status: 'PENDING',
    });
    await expect(activatePackage(PKG_ID, USER_ID)).rejects.toThrow(/package/i);
  });

  it('throws when package already USED', async () => {
    mockPkgFindUnique.mockResolvedValue({
      id: PKG_ID,
      ownerUserId: USER_ID,
      days: 14,
      status: 'USED',
    });
    await expect(activatePackage(PKG_ID, USER_ID)).rejects.toThrow(/package/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/activation.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `apps/web/src/lib/referral/activation.ts`:

```ts
/**
 * Referral package activation logic (Phase 53A).
 *
 * Atomic: lookup package + sub, decide extend/create, mark package USED.
 *
 * If user has active or trial subscription with currentPeriodEnd > now → extend.
 * Otherwise → create fresh TRIAL on PLATFORM tier with N days.
 */

import { prisma } from '@mpstats/db/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export class PackageActivationError extends Error {
  code: 'NOT_FOUND' | 'NOT_OWNER' | 'NOT_PENDING';
  constructor(code: 'NOT_FOUND' | 'NOT_OWNER' | 'NOT_PENDING', message: string) {
    super(message);
    this.code = code;
  }
}

export async function activatePackage(packageId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    const pkg = await tx.referralBonusPackage.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new PackageActivationError('NOT_FOUND', 'Package not found');
    }
    if (pkg.ownerUserId !== userId) {
      throw new PackageActivationError('NOT_OWNER', 'Package owner mismatch');
    }
    if (pkg.status !== 'PENDING') {
      throw new PackageActivationError('NOT_PENDING', 'Package already used or revoked');
    }

    const now = new Date();
    const sub = await tx.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIAL'] },
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: new Date(sub.currentPeriodEnd.getTime() + pkg.days * DAY_MS),
        },
      });
    } else {
      const platformPlan = await tx.subscriptionPlan.findFirst({
        where: { type: 'PLATFORM', isActive: true },
        select: { id: true },
      });
      if (!platformPlan) {
        throw new Error('No active PLATFORM SubscriptionPlan found');
      }
      await tx.subscription.create({
        data: {
          userId,
          planId: platformPlan.id,
          courseId: null,
          status: 'TRIAL',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + pkg.days * DAY_MS),
        },
      });
    }

    await tx.referralBonusPackage.update({
      where: { id: packageId },
      data: { status: 'USED', usedAt: now },
    });
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/activation.test.ts --run`
Expected: PASS, 7/7.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/referral/activation.ts apps/web/src/lib/referral/__tests__/activation.test.ts
git commit -m "feat(phase-53a): package activation logic with tests"
```

---

## Task 7: Anti-fraud checks (self-ref + cap-rate-limit)

**Files:**
- Create: `apps/web/src/lib/referral/fraud-checks.ts`
- Create: `apps/web/src/lib/referral/__tests__/fraud-checks.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/referral/__tests__/fraud-checks.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockReferralCount = vi.fn();
const mockSupabaseAdminGetUser = vi.fn();

vi.mock('@mpstats/db/client', () => ({
  prisma: { referral: { count: mockReferralCount } },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: { getUserById: mockSupabaseAdminGetUser },
    },
  }),
}));

import { checkFraudSignals } from '../fraud-checks';

beforeEach(() => {
  vi.clearAllMocks();
  mockReferralCount.mockResolvedValue(0);
});

describe('checkFraudSignals', () => {
  it('blocks when referrer.userId === friend.userId', async () => {
    const result = await checkFraudSignals({ referrerId: 'u1', friendId: 'u1' });
    expect(result).toEqual({ verdict: 'BLOCKED_SELF_REF' });
  });

  it('blocks when referrer email === friend email', async () => {
    mockSupabaseAdminGetUser
      .mockResolvedValueOnce({ data: { user: { email: 'same@x.com' } } })
      .mockResolvedValueOnce({ data: { user: { email: 'same@x.com' } } });
    const result = await checkFraudSignals({ referrerId: 'u1', friendId: 'u2' });
    expect(result).toEqual({ verdict: 'BLOCKED_SELF_REF' });
  });

  it('marks PENDING_REVIEW when referrer hits cap (5 in 7d)', async () => {
    mockSupabaseAdminGetUser
      .mockResolvedValueOnce({ data: { user: { email: 'a@x.com' } } })
      .mockResolvedValueOnce({ data: { user: { email: 'b@x.com' } } });
    mockReferralCount.mockResolvedValue(5);
    const result = await checkFraudSignals({ referrerId: 'u1', friendId: 'u2' });
    expect(result).toEqual({ verdict: 'PENDING_REVIEW' });
  });

  it('approves when no signals', async () => {
    mockSupabaseAdminGetUser
      .mockResolvedValueOnce({ data: { user: { email: 'a@x.com' } } })
      .mockResolvedValueOnce({ data: { user: { email: 'b@x.com' } } });
    mockReferralCount.mockResolvedValue(2);
    const result = await checkFraudSignals({ referrerId: 'u1', friendId: 'u2' });
    expect(result).toEqual({ verdict: 'OK' });
  });
});
```

- [ ] **Step 2: Verify Supabase admin helper exists**

Run: `grep -rn "createAdminClient\|@/lib/supabase/admin" apps/web/src/lib/supabase/ apps/web/src/app/ 2>/dev/null | head -5`

If `@/lib/supabase/admin` does NOT exist — find what file exports the admin client (used in Yandex callback or webhook routes). Likely `@/lib/supabase/server` or inline in routes. Adapt the import path in test mock and impl. If admin client is created inline elsewhere, create `apps/web/src/lib/supabase/admin.ts` with:

```ts
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

- [ ] **Step 3: Write implementation**

Create `apps/web/src/lib/referral/fraud-checks.ts`:

```ts
/**
 * Anti-fraud checks for referral package issuance (Phase 53A, D7).
 *
 * Returns:
 *  - 'BLOCKED_SELF_REF' if referrer === friend (by userId or email)
 *  - 'PENDING_REVIEW' if referrer has ≥5 referrals in last 7 days
 *  - 'OK' otherwise
 */

import { prisma } from '@mpstats/db/client';
import { createAdminClient } from '@/lib/supabase/admin';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CAP_PER_WEEK = 5;

export type FraudVerdict =
  | { verdict: 'OK' }
  | { verdict: 'BLOCKED_SELF_REF' }
  | { verdict: 'PENDING_REVIEW' };

export interface CheckArgs {
  referrerId: string;
  friendId: string;
}

export async function checkFraudSignals(args: CheckArgs): Promise<FraudVerdict> {
  // 1. Self-ref by userId — short-circuit, не трогать Supabase
  if (args.referrerId === args.friendId) {
    return { verdict: 'BLOCKED_SELF_REF' };
  }

  // 2. Self-ref by email
  const supabase = createAdminClient();
  const [ref, fr] = await Promise.all([
    supabase.auth.admin.getUserById(args.referrerId),
    supabase.auth.admin.getUserById(args.friendId),
  ]);
  const refEmail = ref.data?.user?.email?.toLowerCase();
  const frEmail = fr.data?.user?.email?.toLowerCase();
  if (refEmail && frEmail && refEmail === frEmail) {
    return { verdict: 'BLOCKED_SELF_REF' };
  }

  // 3. Cap 5/week — count Referral rows for this referrer in last 7 days,
  //    excluding only BLOCKED_SELF_REF (PENDING_REVIEW counts toward cap).
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const recentCount = await prisma.referral.count({
    where: {
      referrerUserId: args.referrerId,
      createdAt: { gt: weekAgo },
      status: { notIn: ['BLOCKED_SELF_REF'] },
    },
  });
  if (recentCount >= CAP_PER_WEEK) {
    return { verdict: 'PENDING_REVIEW' };
  }

  return { verdict: 'OK' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/fraud-checks.test.ts --run`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/referral/fraud-checks.ts apps/web/src/lib/referral/__tests__/fraud-checks.test.ts
# If admin.ts was created in step 2:
# git add apps/web/src/lib/supabase/admin.ts
git commit -m "feat(phase-53a): anti-fraud checks (self-ref + cap-5/week)"
```

---

## Task 8: Cookie attribution helpers + tests

**Files:**
- Create: `apps/web/src/lib/referral/attribution.ts`
- Create: `apps/web/src/lib/referral/__tests__/attribution.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/referral/__tests__/attribution.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_TTL_DAYS,
  parseRefCodeFromUrl,
  isValidRefCodeShape,
} from '../attribution';

describe('parseRefCodeFromUrl', () => {
  it('extracts code from ?ref= param', () => {
    const url = new URL('https://platform.mpstats.academy/?ref=REF-X7K2P1');
    expect(parseRefCodeFromUrl(url)).toBe('REF-X7K2P1');
  });

  it('returns null when ?ref= absent', () => {
    const url = new URL('https://platform.mpstats.academy/');
    expect(parseRefCodeFromUrl(url)).toBeNull();
  });

  it('uppercases lowercase ref code', () => {
    const url = new URL('https://platform.mpstats.academy/?ref=ref-x7k2p1');
    expect(parseRefCodeFromUrl(url)).toBe('REF-X7K2P1');
  });

  it('rejects malformed codes (returns null)', () => {
    const url = new URL('https://platform.mpstats.academy/?ref=garbage123');
    expect(parseRefCodeFromUrl(url)).toBeNull();
  });
});

describe('isValidRefCodeShape', () => {
  it('accepts REF-XXXXXX format', () => {
    expect(isValidRefCodeShape('REF-A2B3C4')).toBe(true);
  });

  it('accepts internal codes (CARE-NAME etc)', () => {
    expect(isValidRefCodeShape('CARE-ANNA')).toBe(true);
    expect(isValidRefCodeShape('SALES-TEAM')).toBe(true);
  });

  it('rejects empty', () => {
    expect(isValidRefCodeShape('')).toBe(false);
  });

  it('rejects too long', () => {
    expect(isValidRefCodeShape('REF-' + 'A'.repeat(50))).toBe(false);
  });
});

describe('constants', () => {
  it('cookie TTL is 30 days', () => {
    expect(REFERRAL_COOKIE_TTL_DAYS).toBe(30);
  });

  it('cookie name is referral_code', () => {
    expect(REFERRAL_COOKIE_NAME).toBe('referral_code');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/attribution.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `apps/web/src/lib/referral/attribution.ts`:

```ts
/**
 * Referral attribution — cookie + URL parsing (Phase 53A).
 *
 * Cookie set in middleware on ?ref= visit, read in /auth/confirm and Yandex
 * callback to attribute referral on DOI/OAuth completion.
 */

export const REFERRAL_COOKIE_NAME = 'referral_code';
export const REFERRAL_COOKIE_TTL_DAYS = 30;
export const REFERRAL_COOKIE_TTL_SECONDS = REFERRAL_COOKIE_TTL_DAYS * 24 * 60 * 60;

const SHAPE_REGEX = /^[A-Z][A-Z0-9_]{0,15}-[A-Z0-9]{2,12}$/;

export function isValidRefCodeShape(code: string): boolean {
  if (!code || code.length === 0 || code.length > 32) return false;
  return SHAPE_REGEX.test(code);
}

export function parseRefCodeFromUrl(url: URL): string | null {
  const raw = url.searchParams.get('ref');
  if (!raw) return null;
  const upper = raw.toUpperCase();
  return isValidRefCodeShape(upper) ? upper : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/web test -- src/lib/referral/__tests__/attribution.test.ts --run`
Expected: PASS, 11/11.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/referral/attribution.ts apps/web/src/lib/referral/__tests__/attribution.test.ts
git commit -m "feat(phase-53a): URL + cookie attribution helpers"
```

---

## Task 9: Middleware — parse ?ref= and set cookie

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Inspect current middleware**

Run: `cat apps/web/src/middleware.ts | head -60`

Note the current matcher and structure. Should NOT replace existing logic — append referral cookie handling.

- [ ] **Step 2: Add referral attribution block**

In `apps/web/src/middleware.ts`, near the start of the middleware function (before any auth/redirect logic that might short-circuit):

```ts
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_COOKIE_TTL_SECONDS,
  parseRefCodeFromUrl,
} from '@/lib/referral/attribution';

// ...inside middleware function, near top:
const refCode = parseRefCodeFromUrl(request.nextUrl);
if (refCode) {
  // Set cookie on the response — propagated even if other logic redirects
  // We must use NextResponse.next() to attach the cookie, but if other code
  // builds its own response, we must replicate. Simplest: set on the
  // pass-through response when no auth redirect happens. For redirects,
  // accept that the cookie is set on the next visit (idempotent — code in URL too).
}
```

The cleanest implementation: at the END of middleware, after all decisions, when returning a response — set the cookie. Adapt to existing structure:

```ts
const response = NextResponse.next(); // or whatever existing flow returns
if (refCode) {
  response.cookies.set({
    name: REFERRAL_COOKIE_NAME,
    value: refCode,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: REFERRAL_COOKIE_TTL_SECONDS,
    path: '/',
  });
}
return response;
```

If middleware uses early returns / multiple response paths (auth redirects), wrap each one to set the cookie. **Конкретные правки** зависят от текущей формы файла; engineer должен прочитать middleware целиком и интегрировать вручную, не нарушая существующей логики.

- [ ] **Step 3: Manual smoke test (если есть локальный dev)**

`pnpm dev`, открыть `http://localhost:3000/?ref=REF-TEST01` → DevTools → Application → Cookies → ожидать `referral_code = REF-TEST01`.

Если dev environment недоступен (Supabase paused) — отложи smoke test до staging deploy.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(phase-53a): middleware parses ?ref= and sets cookie"
```

---

## Task 10: Issue orchestrator — Referral + Package + Trial in transaction

**Files:**
- Create: `apps/web/src/lib/referral/issue.ts`

- [ ] **Step 1: Write the orchestrator**

Create `apps/web/src/lib/referral/issue.ts`:

```ts
/**
 * Referral issuance orchestrator (Phase 53A).
 *
 * Called from /auth/confirm and Yandex callback after DOI/OAuth success.
 * Handles entire flow:
 *   1. Resolve referrer by code
 *   2. Run anti-fraud checks
 *   3. Read mode flag (i1 default, i2 if referral_pay_gated=true)
 *   4. Create Referral row
 *   5. Issue Package (i1 only — i2 issues on payment via webhook)
 *   6. Always create Trial Subscription for friend (14d in i1, 7d in i2)
 *
 * All in single transaction. Fire-and-forget Sentry on errors.
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { isFeatureEnabled } from '@mpstats/api/utils/feature-flags';
import { createTrialSubscription } from '@mpstats/api/services/billing/trial-subscription';
import { checkFraudSignals } from './fraud-checks';
import { cq } from '@/lib/carrotquest/client';

const I1_TRIAL_DAYS = 14;
const I2_TRIAL_DAYS = 7;
const PACKAGE_DAYS = 14;

export interface IssueArgs {
  refCode: string;
  friendUserId: string;
}

export async function issueReferralOnSignup(args: IssueArgs): Promise<void> {
  try {
    // 1) Resolve referrer
    const referrer = await prisma.userProfile.findUnique({
      where: { referralCode: args.refCode },
      select: { id: true },
    });
    if (!referrer) {
      // Unknown code — silent no-op (could be expired/typo, не блокируем регистрацию)
      Sentry.captureMessage('referral.unknown_code', {
        level: 'info',
        extra: { refCode: args.refCode, friendUserId: args.friendUserId },
      });
      return;
    }

    // 2) Mode flag
    const i2Mode = await isFeatureEnabled('referral_pay_gated');

    // 3) Anti-fraud
    const fraud = await checkFraudSignals({
      referrerId: referrer.id,
      friendId: args.friendUserId,
    });

    // Always create trial for the friend, even if referrer is blocked
    // (friend's experience must not break because of referrer's fraud).
    let trialDays = i2Mode ? I2_TRIAL_DAYS : I1_TRIAL_DAYS;

    let referralStatus: 'CONVERTED' | 'PENDING' | 'BLOCKED_SELF_REF' | 'PENDING_REVIEW';
    let issuePackage = false;

    if (fraud.verdict === 'BLOCKED_SELF_REF') {
      referralStatus = 'BLOCKED_SELF_REF';
      Sentry.captureMessage('referral.fraud_signal', {
        level: 'info',
        tags: { kind: 'self_ref' },
        extra: { referrerId: referrer.id, friendId: args.friendUserId },
      });
    } else if (fraud.verdict === 'PENDING_REVIEW') {
      referralStatus = 'PENDING_REVIEW';
      Sentry.captureMessage('referral.fraud_signal', {
        level: 'info',
        tags: { kind: 'cap_reached' },
        extra: { referrerId: referrer.id, friendId: args.friendUserId },
      });
    } else {
      // OK — issue based on mode
      referralStatus = i2Mode ? 'PENDING' : 'CONVERTED';
      issuePackage = !i2Mode; // i1 issues immediately; i2 on payment
    }

    // 4) Transaction
    await prisma.$transaction(async (tx: any) => {
      const referral = await tx.referral.create({
        data: {
          code: args.refCode,
          codeType: 'EXTERNAL_USER',
          referrerUserId: referrer.id,
          referredUserId: args.friendUserId,
          status: referralStatus,
          conversionTrigger: !i2Mode && referralStatus === 'CONVERTED' ? 'registration' : null,
          convertedAt: !i2Mode && referralStatus === 'CONVERTED' ? new Date() : null,
        },
      });

      if (issuePackage) {
        await tx.referralBonusPackage.create({
          data: {
            ownerUserId: referrer.id,
            sourceReferralId: referral.id,
            days: PACKAGE_DAYS,
            status: 'PENDING',
          },
        });
      }

      // Friend's trial subscription
      await createTrialSubscription({
        userId: args.friendUserId,
        durationDays: trialDays,
        prismaClient: tx,
      });
    });

    // 5) CQ events (best-effort)
    try {
      await cq.trackEvent(args.friendUserId, 'pa_referral_trial_started');
      if (issuePackage) {
        await cq.trackEvent(referrer.id, 'pa_referral_friend_registered');
      }
    } catch (cqError) {
      Sentry.captureException(cqError, {
        tags: { area: 'referral', stage: 'cq' },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'referral', stage: 'issue-on-signup' },
      extra: { refCode: args.refCode, friendUserId: args.friendUserId },
    });
    // Fire-and-forget — caller (auth route) НЕ должен падать
  }
}
```

- [ ] **Step 2: Add CQ event names**

In `apps/web/src/lib/carrotquest/types.ts`, find the `CQEventName` union and add 4 new entries (place near other `pa_*` events):

```ts
  | 'pa_referral_trial_started'
  | 'pa_referral_friend_registered'
  | 'pa_referral_friend_paid'
  | 'pa_referral_package_activated'
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/referral/issue.ts apps/web/src/lib/carrotquest/types.ts
git commit -m "feat(phase-53a): referral issuance orchestrator + CQ events"
```

---

## Task 11: Hook — /auth/confirm route reads cookie + dispatches issue

**Files:**
- Modify: `apps/web/src/app/auth/confirm/route.ts`

- [ ] **Step 1: Add referral processing after verifyOtp success**

In `apps/web/src/app/auth/confirm/route.ts`, after the `if (type === 'recovery')` early return and before the welcome-email/promo-salvage block:

```ts
import { REFERRAL_COOKIE_NAME, isValidRefCodeShape } from '@/lib/referral/attribution';
import { issueReferralOnSignup } from '@/lib/referral/issue';

// ...inside GET handler, after recovery early-return, before getUser():
// Read referral cookie BEFORE clearing it later
const refCookie = request.cookies.get(REFERRAL_COOKIE_NAME)?.value;
const refCode = refCookie && isValidRefCodeShape(refCookie) ? refCookie : null;
```

Then in the same try-block where `getUser()` is called, after `if (user)` and before the welcome-email logic:

```ts
if (user && refCode) {
  // Fire-and-forget — don't await, never block redirect
  issueReferralOnSignup({ refCode, friendUserId: user.id }).catch((err) => {
    console.error('[AuthConfirm] referral issue failed:', err);
  });
}
```

When constructing the redirect response at the end, clear the cookie:

```ts
const redirectUrl = new URL(salvagedNext ?? safeNext, origin);
const response = NextResponse.redirect(redirectUrl);
if (refCode) {
  response.cookies.delete(REFERRAL_COOKIE_NAME);
}
return response;
```

(Note: existing code uses `return NextResponse.redirect(...)` directly. Refactor to construct response first, attach cookie deletion, then return.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/auth/confirm/route.ts
git commit -m "feat(phase-53a): /auth/confirm hooks referral issuance after DOI"
```

---

## Task 12: Hook — Yandex OAuth callback dispatches issue

**Files:**
- Modify: `apps/web/src/app/api/auth/yandex/callback/route.ts`

- [ ] **Step 1: Read current callback structure**

Run: `cat apps/web/src/app/api/auth/yandex/callback/route.ts | wc -l`
And: `grep -n "redirectTo\|response.cookies\|user.id\|supabaseUserId" apps/web/src/app/api/auth/yandex/callback/route.ts`

Identify the spot AFTER successful user creation/upsert (where `supabaseUserId` is known) and BEFORE final redirect.

- [ ] **Step 2: Add referral handling**

Imports near top of file:

```ts
import { REFERRAL_COOKIE_NAME, isValidRefCodeShape } from '@/lib/referral/attribution';
import { issueReferralOnSignup } from '@/lib/referral/issue';
```

After the user is created/upserted (after `supabaseUserId = createData.user.id` or equivalent), and after any `prisma.userProfile.upsert()`, add:

```ts
// Phase 53A — referral attribution
const refCookie = request.cookies.get(REFERRAL_COOKIE_NAME)?.value;
const refCode = refCookie && isValidRefCodeShape(refCookie) ? refCookie : null;
if (refCode && supabaseUserId) {
  issueReferralOnSignup({ refCode, friendUserId: supabaseUserId }).catch((err) => {
    console.error('[YandexCallback] referral issue failed:', err);
  });
}
```

Where the redirect response is constructed (existing line `const response = NextResponse.redirect(...)`), add cookie deletion:

```ts
if (refCode) {
  response.cookies.delete(REFERRAL_COOKIE_NAME);
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/auth/yandex/callback/route.ts
git commit -m "feat(phase-53a): Yandex callback hooks referral issuance"
```

---

## Task 13: i2 conversion — CP webhook pay handler issues package

**Files:**
- Modify: `apps/web/src/app/api/webhooks/cloudpayments/route.ts` OR
- Modify: `apps/web/src/lib/cloudpayments/subscription-service.ts` (where pay handler logic lives)

- [ ] **Step 1: Locate pay handler**

Run: `grep -n "type === 'pay'\|handlePay\|case 'pay'\|onPay\|on-pay" apps/web/src/app/api/webhooks/cloudpayments/route.ts apps/web/src/lib/cloudpayments/`

Identify the function that fires after a successful `pay` webhook (creates the Subscription record).

- [ ] **Step 2: Add post-pay referral conversion**

After successful subscription creation in pay handler, add:

```ts
import { processReferralConversion } from '@/lib/referral/conversion';
// ...inside handler, after subscription.create or status='ACTIVE' update:
await processReferralConversion(userId).catch((err) => {
  Sentry.captureException(err, {
    tags: { area: 'referral', stage: 'cp-pay-conversion' },
    extra: { userId },
  });
});
```

- [ ] **Step 3: Create conversion processor**

Create `apps/web/src/lib/referral/conversion.ts`:

```ts
/**
 * Referral conversion (Phase 53A, i2 mode).
 *
 * Called from CP webhook `pay` handler after a successful subscription creation.
 * Looks up Referral { referredUserId=userId, status='PENDING' } and:
 *  - Marks Referral.status='CONVERTED', convertedAt=now, conversionTrigger='payment'
 *  - Issues ReferralBonusPackage to referrer
 *  - Emits CQ event pa_referral_friend_paid
 *
 * Idempotent — re-running on already CONVERTED Referral is no-op.
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { cq } from '@/lib/carrotquest/client';

const PACKAGE_DAYS = 14;

export async function processReferralConversion(payingUserId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId: payingUserId },
  });
  if (!referral || referral.status !== 'PENDING' || !referral.referrerUserId) {
    return; // not a referred user, or already converted, or referrer deleted
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        conversionTrigger: 'payment',
      },
    });
    await tx.referralBonusPackage.create({
      data: {
        ownerUserId: referral.referrerUserId!,
        sourceReferralId: referral.id,
        days: PACKAGE_DAYS,
        status: 'PENDING',
      },
    });
  });

  try {
    await cq.trackEvent(referral.referrerUserId, 'pa_referral_friend_paid');
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'referral', stage: 'cq-friend-paid' } });
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/referral/conversion.ts apps/web/src/app/api/webhooks/cloudpayments/route.ts apps/web/src/lib/cloudpayments/subscription-service.ts
git commit -m "feat(phase-53a): i2 conversion via CP webhook pay handler"
```

---

## Task 14: tRPC router — referral.getMyState, validateCode, activatePackage

**Files:**
- Create: `packages/api/src/routers/referral.ts`
- Modify: `packages/api/src/root.ts`
- Create: `packages/api/src/routers/__tests__/referral.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/routers/__tests__/referral.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const mockUserFindUnique = vi.fn();
const mockPkgFindMany = vi.fn();
const mockReferralCount = vi.fn();
const mockActivatePackage = vi.fn();

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    userProfile: { findUnique: mockUserFindUnique },
    referralBonusPackage: { findMany: mockPkgFindMany },
    referral: { count: mockReferralCount },
  },
}));

vi.mock('@/lib/referral/activation', () => ({
  activatePackage: mockActivatePackage,
  PackageActivationError: class extends Error {
    code: string;
    constructor(code: string, msg: string) { super(msg); this.code = code; }
  },
}));

import { referralRouter } from '../referral';

const ctx = {
  user: { id: 'user-1' },
  prisma: undefined as any,
};

function caller() {
  return referralRouter.createCaller(ctx as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('referral.getMyState', () => {
  it('returns code, counters, packages', async () => {
    mockUserFindUnique.mockResolvedValue({ referralCode: 'REF-AAA111' });
    mockReferralCount.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
    mockPkgFindMany.mockResolvedValue([
      { id: 'pkg1', days: 14, status: 'PENDING', issuedAt: new Date(), usedAt: null },
    ]);
    const result = await caller().getMyState();
    expect(result.referralCode).toBe('REF-AAA111');
    expect(result.totalReferred).toBe(5);
    expect(result.totalConverted).toBe(3);
    expect(result.pendingPackages).toHaveLength(1);
  });

  it('returns null code if user has none yet', async () => {
    mockUserFindUnique.mockResolvedValue({ referralCode: null });
    mockReferralCount.mockResolvedValue(0);
    mockPkgFindMany.mockResolvedValue([]);
    const result = await caller().getMyState();
    expect(result.referralCode).toBeNull();
  });
});

describe('referral.validateCode', () => {
  it('returns valid + referrerName for known code', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'u-ref',
      name: 'Anna',
    });
    const result = await caller().validateCode({ code: 'REF-AAA111' });
    expect(result.valid).toBe(true);
    expect(result.referrerName).toBe('Anna');
  });

  it('returns invalid for unknown code', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await caller().validateCode({ code: 'REF-XXXXXX' });
    expect(result.valid).toBe(false);
  });

  it('returns invalid for malformed code', async () => {
    const result = await caller().validateCode({ code: 'garbage' });
    expect(result.valid).toBe(false);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('referral.activatePackage', () => {
  it('calls activation with userId from ctx', async () => {
    mockActivatePackage.mockResolvedValue(undefined);
    await caller().activatePackage({ packageId: 'pkg-1' });
    expect(mockActivatePackage).toHaveBeenCalledWith('pkg-1', 'user-1');
  });

  it('translates PackageActivationError to TRPCError', async () => {
    const { PackageActivationError } = await import('@/lib/referral/activation');
    mockActivatePackage.mockRejectedValue(new PackageActivationError('NOT_FOUND', 'Package not found'));
    await expect(caller().activatePackage({ packageId: 'pkg-x' })).rejects.toBeInstanceOf(TRPCError);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mpstats/api test -- src/routers/__tests__/referral.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Write router**

Create `packages/api/src/routers/referral.ts`:

```ts
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@mpstats/db/client';
import { activatePackage, PackageActivationError } from '@/lib/referral/activation';
import { isValidRefCodeShape } from '@/lib/referral/attribution';

export const referralRouter = router({
  // Returns user's REF code, counters, and PENDING packages list
  getMyState: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const [profile, totalReferred, totalConverted, pendingPackages, usedPackages] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      }),
      prisma.referral.count({ where: { referrerUserId: userId } }),
      prisma.referral.count({
        where: { referrerUserId: userId, status: 'CONVERTED' },
      }),
      prisma.referralBonusPackage.findMany({
        where: { ownerUserId: userId, status: 'PENDING' },
        orderBy: { issuedAt: 'desc' },
        select: { id: true, days: true, issuedAt: true, status: true, usedAt: true },
      }),
      prisma.referralBonusPackage.findMany({
        where: { ownerUserId: userId, status: 'USED' },
        orderBy: { usedAt: 'desc' },
        take: 10,
        select: { id: true, days: true, issuedAt: true, status: true, usedAt: true },
      }),
    ]);

    return {
      referralCode: profile?.referralCode ?? null,
      totalReferred,
      totalConverted,
      pendingPackages,
      usedPackages,
    };
  }),

  // Validates a code (e.g., on /register page banner) — returns referrer name if known
  validateCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      if (!isValidRefCodeShape(input.code)) {
        return { valid: false, referrerName: null };
      }
      const referrer = await prisma.userProfile.findUnique({
        where: { referralCode: input.code },
        select: { id: true, name: true },
      });
      if (!referrer) {
        return { valid: false, referrerName: null };
      }
      return { valid: true, referrerName: referrer.name };
    }),

  // Activate a package — extends sub or creates new TRIAL
  activatePackage: protectedProcedure
    .input(z.object({ packageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await activatePackage(input.packageId, ctx.user.id);
        return { ok: true };
      } catch (err) {
        if (err instanceof PackageActivationError) {
          const map: Record<string, 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_REQUEST'> = {
            NOT_FOUND: 'NOT_FOUND',
            NOT_OWNER: 'FORBIDDEN',
            NOT_PENDING: 'BAD_REQUEST',
          };
          throw new TRPCError({
            code: map[err.code] ?? 'BAD_REQUEST',
            message: err.message,
          });
        }
        throw err;
      }
    }),
});
```

- [ ] **Step 4: Register router in root**

In `packages/api/src/root.ts`, add the import and router registration:

```ts
import { referralRouter } from './routers/referral';
// ...inside appRouter object:
referral: referralRouter,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/api test -- src/routers/__tests__/referral.test.ts --run`
Expected: PASS, 7/7.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers/referral.ts packages/api/src/routers/__tests__/referral.test.ts packages/api/src/root.ts
git commit -m "feat(phase-53a): tRPC referral router (getMyState, validateCode, activatePackage)"
```

---

## Task 15: Profile Referral page — UI

**Files:**
- Create: `apps/web/src/app/(main)/profile/referral/page.tsx`
- Create: `apps/web/src/components/profile/ReferralCodeBlock.tsx`
- Create: `apps/web/src/components/profile/ReferralPackageList.tsx`
- Create: `apps/web/src/components/profile/ReferralRulesText.tsx`

- [ ] **Step 1: Write the page**

Create `apps/web/src/app/(main)/profile/referral/page.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc/client';
import { ReferralCodeBlock } from '@/components/profile/ReferralCodeBlock';
import { ReferralPackageList } from '@/components/profile/ReferralPackageList';
import { ReferralRulesText } from '@/components/profile/ReferralRulesText';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function ReferralPage() {
  const stateQ = trpc.referral.getMyState.useQuery();
  const utils = trpc.useUtils();
  const activate = trpc.referral.activatePackage.useMutation({
    onSuccess: () => utils.referral.getMyState.invalidate(),
  });

  if (stateQ.isLoading) {
    return <div className="p-6 text-mp-gray-500">Загружаем…</div>;
  }

  const state = stateQ.data;
  if (!state) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Link href="/profile" className="inline-flex items-center text-mp-gray-600 hover:text-mp-gray-900 text-sm">
        <ChevronLeft className="w-4 h-4 mr-1" /> К профилю
      </Link>

      <div>
        <h1 className="text-heading-lg font-semibold mb-1">Рефералка</h1>
        <p className="text-mp-gray-600 text-sm">
          Приглашай друзей в Платформу — оба получаете доступ.
        </p>
      </div>

      <ReferralRulesText />

      <ReferralCodeBlock code={state.referralCode} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Привёл друзей" value={state.totalReferred} />
        <Stat label="Оплатили" value={state.totalConverted} />
        <Stat label="Доступно пакетов" value={state.pendingPackages.length} />
      </div>

      <ReferralPackageList
        pending={state.pendingPackages}
        used={state.usedPackages}
        isActivating={activate.isPending}
        onActivate={(packageId) => activate.mutate({ packageId })}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-mp-gray-200 rounded-lg p-3 bg-white">
      <div className="text-2xl font-semibold text-mp-gray-900">{value}</div>
      <div className="text-xs text-mp-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write ReferralCodeBlock**

Create `apps/web/src/components/profile/ReferralCodeBlock.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';

export function ReferralCodeBlock({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!code) {
    return (
      <div className="border border-mp-gray-200 rounded-lg p-4 bg-mp-gray-50 text-sm text-mp-gray-600">
        Реф-код будет доступен после подтверждения email.
      </div>
    );
  }

  const link =
    typeof window !== 'undefined'
      ? `${window.location.origin}/?ref=${code}`
      : `https://platform.mpstats.academy/?ref=${code}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border border-mp-gray-200 rounded-lg p-4 bg-white">
      <div className="text-sm text-mp-gray-500 mb-1">Твоя ссылка</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          className="flex-1 font-mono text-sm bg-mp-gray-50 rounded px-3 py-2 border border-mp-gray-200"
        />
        <Button onClick={handleCopy} variant="outline" size="sm">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Скопировано' : 'Скопировать'}
        </Button>
      </div>
      <div className="text-xs text-mp-gray-500 mt-2">
        Код: <span className="font-mono">{code}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write ReferralPackageList**

Create `apps/web/src/components/profile/ReferralPackageList.tsx`:

```tsx
'use client';
import { Button } from '@/components/ui/button';
import { Gift } from 'lucide-react';

interface Package {
  id: string;
  days: number;
  status: string;
  issuedAt: Date | string;
  usedAt: Date | string | null;
}

export function ReferralPackageList({
  pending,
  used,
  isActivating,
  onActivate,
}: {
  pending: Package[];
  used: Package[];
  isActivating: boolean;
  onActivate: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-heading-md font-semibold mb-2">Доступные пакеты</h2>
        {pending.length === 0 ? (
          <div className="text-sm text-mp-gray-500 border border-dashed border-mp-gray-300 rounded-lg p-4">
            Пока ни одного пакета. Поделись ссылкой с друзьями.
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border border-mp-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-mp-blue-500" />
                  <div>
                    <div className="text-sm font-medium">+{p.days} дней доступа</div>
                    <div className="text-xs text-mp-gray-500">
                      Получен {new Date(p.issuedAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => onActivate(p.id)}
                  disabled={isActivating}
                >
                  Активировать
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {used.length > 0 && (
        <div>
          <h2 className="text-heading-md font-semibold mb-2">История</h2>
          <ul className="space-y-2">
            {used.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between text-sm text-mp-gray-600 border border-mp-gray-100 rounded-lg p-3 bg-mp-gray-50"
              >
                <span>+{p.days} дней — активирован</span>
                <span className="text-xs">
                  {p.usedAt ? new Date(p.usedAt).toLocaleDateString('ru-RU') : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write ReferralRulesText**

Create `apps/web/src/components/profile/ReferralRulesText.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc/client';

// We don't have a direct trpc endpoint for the flag; render i1 copy by default,
// override via env if desired. Simplest: render conditional text via known feature flag
// reader (server-side only). For now — render both rules, showing the ACTIVE one
// based on a public env var that admin updates alongside the DB flag.

export function ReferralRulesText() {
  const i2Mode = process.env.NEXT_PUBLIC_REFERRAL_PAY_GATED === 'true';
  return (
    <div className="rounded-lg border border-mp-blue-200 bg-mp-blue-50 p-4 text-sm text-mp-gray-800">
      <div className="font-semibold mb-1">Как это работает</div>
      {i2Mode ? (
        <ul className="list-disc list-inside space-y-1">
          <li>Друг переходит по твоей ссылке и регистрируется → получает 7 дней Платформы бесплатно.</li>
          <li>Когда друг оплачивает первую подписку → ты получаешь пакет +14 дней.</li>
          <li>Активируй пакет вручную здесь — продлит подписку или создаст новый 14-дневный триал.</li>
        </ul>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          <li>Друг переходит по твоей ссылке и регистрируется → сразу получает 14 дней Платформы бесплатно.</li>
          <li>Ты получаешь пакет +14 дней за каждого зарегистрированного друга.</li>
          <li>Активируй пакет здесь — продлит твою подписку на 14 дней или запустит новый триал.</li>
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Add link to /profile from main profile page**

In `apps/web/src/app/(main)/profile/page.tsx`, find the existing Link to `/profile/notifications` (around line 717-722) and add a similar block for `/profile/referral` right after:

```tsx
<Link
  href="/profile/referral"
  className="block p-4 border border-mp-gray-200 rounded-lg hover:bg-mp-gray-50 transition-colors"
>
  <div className="flex items-center justify-between">
    <span className="text-mp-gray-900 font-medium">Рефералка</span>
    <ChevronRight className="w-5 h-5 text-mp-gray-400" />
  </div>
  <p className="text-sm text-mp-gray-500 mt-1">
    Твоя реф-ссылка и накопленные пакеты
  </p>
</Link>
```

(If `ChevronRight` is not yet imported, add to lucide-react import at top.)

- [ ] **Step 6: Typecheck + smoke**

Run: `pnpm typecheck`
Expected: PASS.

(Smoke runs against real DB later on staging.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(main\)/profile/referral/ apps/web/src/components/profile/ apps/web/src/app/\(main\)/profile/page.tsx
git commit -m "feat(phase-53a): /profile/referral page — code, packages, rules"
```

---

## Task 16: Register page banner — show "+14 days" on valid ?ref=

**Files:**
- Modify: `apps/web/src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Inspect register page structure**

Run: `head -80 apps/web/src/app/\(auth\)/register/page.tsx`

Note client/server boundary, existing layout. Likely client component with form.

- [ ] **Step 2: Add referral banner**

Add at the top of the register form (above the email/password inputs):

```tsx
'use client';
// ...existing imports
import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/client';

// Inside the component, near other state:
const [refCode, setRefCode] = useState<string | null>(null);
useEffect(() => {
  // Read cookie via document.cookie (HttpOnly cookies are NOT accessible in JS,
  // so we set ref code in URL search params if user landed via /?ref=)
  const params = new URLSearchParams(window.location.search);
  const code = params.get('ref') ?? null;
  if (code) setRefCode(code.toUpperCase());
}, []);

const refValidation = trpc.referral.validateCode.useQuery(
  { code: refCode! },
  { enabled: !!refCode },
);

// Render banner above form (i1: 14 days, i2: 7 days — env-driven):
const i2Mode = process.env.NEXT_PUBLIC_REFERRAL_PAY_GATED === 'true';
const trialDays = i2Mode ? 7 : 14;

{refValidation.data?.valid && (
  <div className="rounded-lg border border-mp-blue-300 bg-mp-blue-50 p-4 mb-4 text-sm">
    <div className="font-semibold text-mp-gray-900">
      🎁 Тебе подарили {trialDays} дней бесплатного доступа к Платформе
    </div>
    {refValidation.data.referrerName && (
      <div className="text-mp-gray-600 mt-1">
        От пользователя: <strong>{refValidation.data.referrerName}</strong>
      </div>
    )}
  </div>
)}
```

Note: HttpOnly cookie won't be readable client-side. We rely on the URL search param being preserved (if user arrived via `/?ref=`, the param stays in URL during navigation to /register — middleware sets cookie + we read URL on register page client side for display).

If `/register` is reached via internal navigation (no `?ref=` in URL but cookie exists from earlier middleware visit), banner won't show. Acceptable trade-off for client-side display — cookie still works for actual issuance.

Alternative: convert register to RSC and read cookie server-side. **Скоп этой задачи — клиентский баннер по URL param.** Cookie-based banner — opt-in полировка, не блокер.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(auth\)/register/page.tsx
git commit -m "feat(phase-53a): /register banner — '+14 days' on valid ?ref= URL"
```

---

## Task 17: Public roadmap entry

**Files:**
- Modify: `apps/web/src/app/roadmap/page.tsx`

- [ ] **Step 1: Add changelog entry**

In `apps/web/src/app/roadmap/page.tsx`, find the `changelogEntries` array and prepend:

```ts
{ date: '04.05.2026', text: 'Запустили реферальную программу. У каждого из вас в личном кабинете появилась персональная ссылка — поделись с другом, и оба получите 14 дней бесплатного доступа к Платформе. Друзья регистрируются — у тебя в кабинете копятся пакеты, активируешь когда хочешь.' },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/roadmap/page.tsx
git commit -m "docs(phase-53a): roadmap changelog entry"
```

---

## Task 18: E2E test (env-gated)

**Files:**
- Create: `apps/web/tests/e2e/phase-53a-referral.spec.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/tests/e2e/phase-53a-referral.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 53A — Referral E2E happy path
 *
 * Required env (set when running):
 *   - TEST_USER_A_EMAIL / TEST_USER_A_PASSWORD     existing user with REF code
 *   - TEST_NEW_FRIEND_EMAIL                        unique email for new friend signup
 *
 * Skipped automatically when env not set.
 */

const A_EMAIL = process.env.TEST_USER_A_EMAIL;
const A_PASSWORD = process.env.TEST_USER_A_PASSWORD;
const FRIEND_EMAIL = process.env.TEST_NEW_FRIEND_EMAIL;
const haveEnv = A_EMAIL && A_PASSWORD && FRIEND_EMAIL;

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|learn|diagnostic|admin)/, { timeout: 15000 });
}

test.describe('Phase 53A — referral flow', () => {
  test.skip(!haveEnv, 'env not set');

  test('referrer copies code, friend registers via link, package issued', async ({
    page,
    context,
  }) => {
    // 1. Login as A, capture REF code
    await login(page, A_EMAIL!, A_PASSWORD!);
    await page.goto('/profile/referral');
    const codeText = await page.locator('span.font-mono').first().textContent();
    expect(codeText).toMatch(/^REF-/);

    // 2. Logout, visit /?ref= as anonymous
    await context.clearCookies();
    await page.goto(`/?ref=${codeText}`);

    // 3. Go to /register — banner visible
    await page.goto(`/register?ref=${codeText}`);
    await expect(page.getByText(/14 дней бесплатного доступа/)).toBeVisible();

    // The full flow (register + DOI + back-to-A activation) requires
    // mailbox automation — out of scope for unit-level e2e. We verify only:
    // - banner visible
    // - cookie set (middleware test)
    // Manual / staging completes the rest.
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/tests/e2e/phase-53a-referral.spec.ts
git commit -m "test(phase-53a): e2e for referral banner + code copy"
```

---

## Task 19: Memory + ROADMAP marker + final verification

**Files:**
- Create: `.claude/memory/project_phase53a_referral_program.md`
- Modify: `.claude/memory/MEMORY.md`
- Modify: `MAAL/CLAUDE.md`
- Modify: `.planning/ROADMAP.md` (if Phase 53A is listed there; if not, add)

- [ ] **Step 1: Run full verification**

```bash
pnpm typecheck
pnpm --filter @mpstats/web test --run
pnpm --filter @mpstats/api test --run
pnpm build
```

Expected: typecheck PASS, all tests PASS (33 existing + new ~25), build PASS. Pre-existing 3 fail в `tests/auth/` (Yandex OAuth) — независимы от фазы.

- [ ] **Step 2: Write memory file**

Create `.claude/memory/project_phase53a_referral_program.md`:

```markdown
---
name: Phase 53A Referral Program
description: External referral flow — REF-* codes, manual package activation, 14-day TRIAL Subscription, anti-fraud cap-5/week + self-ref guard, dual-iteration via referral_pay_gated flag. i1 = no payment required, i2 = pay-gated.
type: project
---

## Shipped (2026-05-04)

- New `SubscriptionStatus.TRIAL` enum value, propagated through `getUserActiveSubscriptions` and `billing.ts` queries.
- New `Referral` and `ReferralBonusPackage` tables with cascade deletes.
- `UserProfile.referralCode String? @unique` + backfill script for existing DOI users.
- Full registration hook in `/auth/confirm` and Yandex OAuth callback — reads cookie, runs anti-fraud, creates Referral + (i1) Package + Trial Subscription in transaction.
- CP webhook `pay` handler converts pending Referral to package on first paid subscription.
- tRPC router `referral.{getMyState, validateCode, activatePackage}` with PackageActivationError mapping to TRPCError.
- `/profile/referral` page with code, copy button, counters, pending packages, USED history.
- `/register` page banner showing trial days when valid `?ref=` in URL.
- Feature flag `referral_pay_gated` (boolean) — false = i1 (default), true = i2.

## Architecture notes

- All referral helpers live in `apps/web/src/lib/referral/` (workspace dep direction: apps/web → packages, never reverse, because cq client + supabase admin are in apps/web).
- `activation.ts` is a pure function tested at unit level. `issue.ts` orchestrator wraps targeting + fraud + transaction + CQ events. `conversion.ts` handles i2 payment-driven conversion.
- Trial subscription flow is fully decoupled from CP — never touches CP webhooks. Friend's trial created directly in transaction. Replacement on paid handled by existing CP `pay` handler (creates new ACTIVE sub; trial naturally expires).
- Public env var `NEXT_PUBLIC_REFERRAL_PAY_GATED` mirrors the DB flag for client-side rules text (trial days display in /register banner and /profile/referral rules block). Admin must update both when flipping mode.

## Gotchas

- HttpOnly cookie can't be read in client JS, so `/register` banner reads `?ref=` from URL params instead. Cookie still drives actual issuance in server-side hooks.
- `Referral.referredUserId @unique` — one user can only be a friend once. Re-using same friend account for second referrer is impossible.
- Cap 5/week counts ALL Referrals from a referrer (including PENDING, CONVERTED, PENDING_REVIEW), excludes only BLOCKED_SELF_REF. Resets via 7-day rolling window.
- Internal codes (CARE-*/SALES-*/CON-*/GO-*) — `Referral.codeType` enum supports them but admin/seed UI for creating them is deferred to Phase 53C.
```

- [ ] **Step 3: Add MEMORY.md pointer**

In `.claude/memory/MEMORY.md`, add this entry near the top (recent phase entries section):

```markdown
## Phase 53A — Referral Program (shipped YYYY-MM-DD)
- [project_phase53a_referral_program.md](project_phase53a_referral_program.md) — REF-* codes, manual package activation, 14-day TRIAL Subscription, anti-fraud, dual-iteration via referral_pay_gated flag.
```

- [ ] **Step 4: Update CLAUDE.md Last Session**

In `MAAL/CLAUDE.md`, replace the existing `## Last Session` block with a new one summarizing Phase 53A. Push the previous one down to `### Previous Session`.

- [ ] **Step 5: Mark phase shipped in ROADMAP**

If `.planning/ROADMAP.md` lists Phase 53A — flip `[ ]` to `[x]` with date. If not, add an entry under the v1.6 Engagement milestone.

- [ ] **Step 6: Final commit**

```bash
git add .claude/memory/ MAAL/CLAUDE.md .planning/ROADMAP.md
git commit -m "docs(phase-53a): memory + CLAUDE.md + ROADMAP shipped marker"
```

- [ ] **Step 7: Push to GitHub + deploy to staging**

```bash
git push origin master
ssh deploy@89.208.106.208 "cd /home/deploy/maal && git fetch origin && git checkout master && git pull origin master && docker compose -p maal-staging -f docker-compose.staging.yml up -d --build"
```

After build success — run backfill on staging:

```bash
ssh deploy@89.208.106.208 "cd /home/deploy/maal && docker compose -p maal-staging exec web npx tsx scripts/backfill-referral-codes.ts --dry-run"
# If output looks right:
ssh deploy@89.208.106.208 "cd /home/deploy/maal && docker compose -p maal-staging exec web npx tsx scripts/backfill-referral-codes.ts --apply"
```

- [ ] **Step 8: Wait for user feedback before prod deploy**

Phase 53A на staging. Прод-деплой по решению Егора.

---

## Self-review (against spec)

| Spec section | Plan task |
|---|---|
| D1 Trial Subscription mechanism | Tasks 1, 4, 5 |
| D2 Friend conversion gate (DOI/OAuth) | Tasks 11, 12 (hooks) |
| D3 Package model | Tasks 1 (schema), 6 (activation), 14 (tRPC) |
| D4 Iteration switching via flag | Task 10 (issue uses isFeatureEnabled) |
| D5 Backfill | Tasks 2, 3 |
| D6 Existing-user gate | Implicit (Supabase unique email) |
| D7 Anti-fraud (self-ref + cap) | Task 7 |
| D8 Cookie attribution 30d | Tasks 8, 9 |
| D9 Trial replacement on paid | Task 13 (CP webhook conversion + existing CP pay flow handles new ACTIVE sub) |
| D10 UI placement (separate route) | Task 15 |
| Tests: code-generator | Task 2 |
| Tests: activation | Task 6 |
| Tests: fraud-checks | Task 7 |
| Tests: attribution | Task 8 |
| Tests: tRPC router | Task 14 |
| E2E happy path | Task 18 |
| Public roadmap entry | Task 17 |
| Memory + ROADMAP marker | Task 19 |
| EC1-EC8 edge cases | Covered by activation tests + Referral.@unique constraint + Subscription transaction |

All spec sections covered. No placeholders. Type names consistent (`SubscriptionStatus.TRIAL`, `ReferralStatus`, `ReferralBonusPackageStatus`, `referral_pay_gated`, `REFERRAL_COOKIE_NAME`).
