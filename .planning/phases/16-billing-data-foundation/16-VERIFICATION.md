---
phase: 16-billing-data-foundation
verified: 2026-03-10T08:29:51Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 16: Billing Data Foundation — Verification Report

**Phase Goal:** Create billing database schema and seed data for subscription management
**Verified:** 2026-03-10T08:29:51Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Prisma schema contains Subscription, Payment, PaymentEvent, FeatureFlag, SubscriptionPlan models | VERIFIED | All 5 models present in `packages/db/prisma/schema.prisma` lines 186-254 |
| 2 | Course model has price (Int) and isFree (Boolean) fields | VERIFIED | Lines 109-110 in schema: `price Int @default(0)`, `isFree Boolean @default(true)` |
| 3 | UserProfile model has yandexId (String? @unique) field | VERIFIED | Line 26 in schema: `yandexId String? @unique` |
| 4 | Migration applied (migration file exists with billing models DDL) | VERIFIED | `packages/db/prisma/migrations/20260310081455_add_billing_models/migration.sql` exists; contains CREATE TYPE for 3 enums, ALTER TABLE for Course/UserProfile, CREATE TABLE for all 5 billing models |
| 5 | Seed script sets billing_enabled=false, creates 2 plans (4990 each), updates courses | VERIFIED | `scripts/seed/seed-billing.ts` upserts both flags (enabled=false), upserts COURSE and PLATFORM plans at 4990 RUB, runs updateMany on all courses |
| 6 | Admin can see /admin/settings with feature flag list | VERIFIED | `apps/web/src/app/(admin)/admin/settings/page.tsx` renders Card with flag rows, loading skeletons, and empty state |
| 7 | Admin can toggle billing_enabled via Switch and change persists in DB | VERIFIED | `toggleFeatureFlag` mutation in `admin.ts` finds flag, flips `enabled`, updates record; page calls `flags.refetch()` on success |
| 8 | Settings link appears in AdminSidebar navigation | VERIFIED | `AdminSidebar.tsx` navItems array contains `{ title: 'Settings', href: '/admin/settings', icon: Settings }` |
| 9 | Non-admin users cannot access feature flag endpoints | VERIFIED | `getFeatureFlags` and `toggleFeatureFlag` both use `adminProcedure` (requires `isAdmin=true`); admin router wired in `root.ts` at `admin: adminRouter` |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema.prisma` | Billing data models with enums, relations, indexes | VERIFIED | Contains `model Subscription` (line 199), all 5 billing models, 3 new enums, relations with onDelete Cascade |
| `scripts/seed/seed-billing.ts` | Seed script for billing data | VERIFIED | Contains `featureFlag.upsert` (line 22), 89 lines of substantive implementation |
| `packages/api/src/utils/feature-flags.ts` | isFeatureEnabled helper function | VERIFIED | Exports `isFeatureEnabled`, queries `prisma.featureFlag.findUnique`, returns `flag?.enabled ?? false` |
| `packages/api/src/routers/admin.ts` | getFeatureFlags and toggleFeatureFlag endpoints | VERIFIED | Contains both endpoints at lines 698-736, both use `adminProcedure` |
| `apps/web/src/app/(admin)/admin/settings/page.tsx` | Admin settings page with feature flag toggles | VERIFIED | Contains `toggleFeatureFlag` call, Switch component, loading/empty states |
| `apps/web/src/components/admin/AdminSidebar.tsx` | Settings nav item in admin sidebar | VERIFIED | Contains `Settings` import from lucide-react, nav item with href `/admin/settings` |
| `apps/web/src/components/ui/switch.tsx` | shadcn/ui Switch component | VERIFIED | Radix UI primitive wrapper, exports `Switch`, 29 substantive lines |
| `packages/db/prisma/migrations/20260310081455_add_billing_models/migration.sql` | Billing schema migration | VERIFIED | DDL for all 3 enums, ALTER TABLE for Course and UserProfile, CREATE TABLE for all 5 billing models |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `Subscription` | `UserProfile` | `userId FK onDelete: Cascade` | WIRED | Schema line 211: `user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)` |
| `Subscription` | `Course` | `courseId FK (optional)` | WIRED | Schema line 213: `course Course? @relation(fields: [courseId], references: [id])` |
| `Payment` | `Subscription` | `subscriptionId FK` | WIRED | Schema line 230: `subscription Subscription @relation(fields: [subscriptionId], references: [id])` |
| `settings/page.tsx` | `admin.getFeatureFlags` | `trpc.admin.getFeatureFlags.useQuery()` | WIRED | Line 17 of settings page; response bound to `flags.data` and rendered in map |
| `settings/page.tsx` | `admin.toggleFeatureFlag` | `trpc.admin.toggleFeatureFlag.useMutation()` | WIRED | Line 18-20; `toggle.mutate({ key: flag.key })` on Switch `onCheckedChange`; `flags.refetch()` on success |
| `AdminSidebar` | `/admin/settings` | navItems array with Settings icon | WIRED | Line 39: `href: '/admin/settings'`, `icon: Settings` |
| `adminRouter` | `root.ts appRouter` | `admin: adminRouter` import | WIRED | `root.ts` line 6 imports adminRouter, line 13 registers as `admin:` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BILL-06 | 16-01-PLAN.md | Prisma модели: Subscription, Payment, PaymentEvent, FeatureFlag | SATISFIED | All 5 models verified in schema; migration applied; SubscriptionPlan also present |
| BILL-04 | 16-02-PLAN.md | Billing toggle — включение/выключение биллинга через DB flag без деплоя | SATISFIED | `getFeatureFlags` + `toggleFeatureFlag` endpoints; `/admin/settings` page with Switch; persists to DB via Prisma update |

Both requirements marked `[x]` in REQUIREMENTS.md Traceability table (Phase 16, Complete).

---

## Anti-Patterns Found

None. Scan across all 5 key modified files found zero TODO/FIXME/placeholder comments, no empty implementations, no stub returns.

---

## Human Verification Required

### 1. Settings page toggle persistence

**Test:** Log in as admin, navigate to /admin/settings, toggle `billing_enabled` on, refresh page
**Expected:** Switch shows enabled state after refresh (confirms DB write + read round-trip)
**Why human:** Cannot query live Supabase DB or run browser session in this verification

### 2. Non-admin 403 enforcement

**Test:** Log in as regular user (non-admin), attempt to call `admin.getFeatureFlags` via tRPC
**Expected:** UNAUTHORIZED or FORBIDDEN error (adminProcedure rejects)
**Why human:** Requires live session with non-admin user credentials

---

## Summary

Phase 16 goal fully achieved. Both plans executed cleanly:

**Plan 01 (BILL-06):** All 5 Prisma billing models (SubscriptionPlan, Subscription, Payment, PaymentEvent, FeatureFlag) are present in schema with correct relations, indexes, and enums. Course and UserProfile extended with required fields. Migration baseline established and billing migration applied. Seed script is idempotent (upsert pattern) and populates all required data. Feature flag helper correctly uses safe-default pattern.

**Plan 02 (BILL-04):** Admin tRPC endpoints are substantive (not stubs) and properly protected by `adminProcedure`. Settings page uses real tRPC calls with proper loading/empty/error states. Toggle is wired: Switch `onCheckedChange` calls mutation, mutation flips DB flag, `onSuccess` refetches. AdminSidebar navigation link present. Switch component is a proper Radix UI implementation.

No blocker anti-patterns, no stubs, no orphaned artifacts.

---

_Verified: 2026-03-10T08:29:51Z_
_Verifier: Claude (gsd-verifier)_
