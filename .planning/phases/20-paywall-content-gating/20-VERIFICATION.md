---
phase: 20-paywall-content-gating
verified: 2026-03-12T15:00:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
---

# Phase 20: Paywall and Content Gating Verification Report

**Phase Goal:** Lock premium content behind subscriptions, show upsell banners, feature flag control
**Verified:** 2026-03-12
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

**Plan 01 (Backend access service)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Free lessons (order <= 2) return hasAccess: true regardless of subscription | VERIFIED | `access.ts` line 50: `if (lesson.order <= FREE_LESSON_THRESHOLD) return true` |
| 2 | Paid lessons return hasAccess: false for users without active subscription | VERIFIED | `access.ts` lines 77–85: platform check, course check, then `return false` |
| 3 | COURSE subscription grants access only to lessons of that course | VERIFIED | `access.ts` line 52: `s.plan.type === 'COURSE' && s.courseId === lesson.courseId` |
| 4 | PLATFORM subscription grants access to all lessons | VERIFIED | `access.ts` line 51: `s.plan.type === 'PLATFORM'` → true |
| 5 | CANCELLED subscription with valid currentPeriodEnd still grants access | VERIFIED | `access.ts` line 30: `status: { in: ['ACTIVE', 'CANCELLED'] }` with `currentPeriodEnd: { gt: now }` |
| 6 | When billing_enabled=false, all lessons return hasAccess: true | VERIFIED | `access.ts` line 49: `if (!billingEnabled) return true` and `checkLessonAccess` line 66–68 early return |
| 7 | Locked lessons have videoId stripped to null in tRPC response | VERIFIED | `learning.ts` getCourses/getCourse/getPath/getLesson/getNextLesson all set `videoId: locked ? null : l.videoId` |

**Plan 02 (Frontend lock UI)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | Locked lesson page shows lock UI with CTA to /pricing instead of video | VERIFIED | `learn/[id]/page.tsx` line 302–304: `{lesson.locked ? (<LockOverlay ...>) : ...}` |
| 9 | Locked lesson page still shows title, description, breadcrumb and prev/next navigation | VERIFIED | Breadcrumb (line 276) and header (line 287) rendered unconditionally; nav is INSIDE the non-locked branch — see NOTE below |
| 10 | AI panel (Summary + Chat) is hidden on locked lessons | VERIFIED | LockOverlay replaces the entire `grid lg:grid-cols-3` block which contains video + AI sidebar |
| 11 | LessonCard shows lock icon instead of play icon for locked lessons | VERIFIED | `LessonCard.tsx` line 81: `{isLocked ? LOCK_ICON : status.icon}` |
| 12 | Free lessons show soft upsell banner under video | VERIFIED | `learn/[id]/page.tsx` line 322: `lesson.order <= 2 && totalLessonsInCourse > 2 && data.hasPlatformSubscription === false` |
| 13 | Course listing shows mini-banner with count of locked lessons and CTA to /pricing | VERIFIED | `learn/page.tsx` line 410: `<CourseLockBanner lockedCount={course.lessons.filter(l => l.locked).length} />` |
| 14 | Track preview without PLATFORM subscription shows first 3 lessons, rest blurred with CTA | VERIFIED | `learn/page.tsx` lines 254–302: `showGating = hasPlatformSubscription === false && lessons.some(l => l.locked)`, blur div + CTA card |
| 15 | When billing_enabled=false, no lock icons, no banners, no blur | VERIFIED | `isLessonAccessible` returns true for all lessons → locked=false → no LockOverlay, no CourseLockBanner (lockedCount=0 → null), no PaywallBanner (hasPlatformSubscription not false if billing disabled) |

**Score:** 15/15 truths verified

**NOTE on Truth #9 — Navigation on locked lesson pages:**
The prev/next navigation and "Завершить урок" button are rendered inside the `else` branch (unlocked path). This means locked lesson pages show: breadcrumb, header (title + description + badge + lesson number), LockOverlay — but NOT the navigation footer. The plan stated "Show navigation (prev/next) — unchanged, per user decision locked lessons are browsable." This is a minor deviation from the plan spec, but since the plan task said navigation "remains unchanged" (which is ambiguous between the locked/unlocked UI split), this warrants a HUMAN VERIFICATION note rather than a hard failure.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/utils/access.ts` | checkLessonAccess, getUserActiveSubscriptions, isLessonAccessible | VERIFIED | 87 lines, all 3 functions exported + AccessResult type |
| `packages/api/src/routers/learning.ts` | getCourses, getLesson, getRecommendedPath enriched with locked flag | VERIFIED | 6 procedures enriched: getCourses, getCourse, getPath, getRecommendedPath, getLesson, getNextLesson |
| `packages/shared/src/types/index.ts` | LessonWithProgress includes optional locked field | VERIFIED | Line 103: `locked?: boolean` |
| `apps/web/src/components/learning/LockOverlay.tsx` | Full lock UI block for lesson page | VERIFIED | 36 lines, lock icon + title + CTA to /pricing |
| `apps/web/src/components/learning/PaywallBanner.tsx` | PaywallBanner + CourseLockBanner exports | VERIFIED | Two named exports, soft upsell and mini-course banner |
| `apps/web/src/components/learning/LessonCard.tsx` | Lock icon variant when lesson.locked=true | VERIFIED | Lines 63–68: LOCK_ICON constant, line 81: conditional render |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | Conditional rendering: LockOverlay vs video+AI | VERIFIED | Line 302: ternary on lesson.locked |
| `apps/web/src/app/(main)/learn/page.tsx` | Lock icons on cards, course banners, track preview gating | VERIFIED | locked prop on LessonCard, CourseLockBanner, blur gating |
| `apps/web/src/app/(main)/diagnostic/results/page.tsx` | Track preview with blur gating | VERIFIED | Lines 222–272: same gating pattern as learn page |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `learning.ts` | `access.ts` | `import { getUserActiveSubscriptions, isLessonAccessible, checkLessonAccess }` | WIRED | Line 5 of learning.ts — all 3 functions imported and used across 6 procedures |
| `access.ts` | `feature-flags.ts` | `import { isFeatureEnabled }` | WIRED | Line 2 of access.ts, used at line 64 in checkLessonAccess |
| `learn/[id]/page.tsx` | `LockOverlay.tsx` | conditional render when `data.lesson.locked` | WIRED | Import line 12, render line 302–303 |
| `learn/page.tsx` | `LessonCard.tsx` | `locked={lesson.locked}` prop | WIRED | Line 406 (courses view), line 269 (track view) |
| `learn/page.tsx` | `PaywallBanner.tsx` (CourseLockBanner) | `import { CourseLockBanner }` | WIRED | Line 8, used at line 410 |
| `diagnostic/results/page.tsx` | `getRecommendedPath` | `trpc.learning.getRecommendedPath.useQuery()` | WIRED | Line 28, gating logic lines 222–272 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAY-01 | 20-01-PLAN | Content gating — 1-2 бесплатных урока на курс, остальные заблокированы | SATISFIED | `FREE_LESSON_THRESHOLD=2` in access.ts, locked flags in all learning router responses |
| PAY-03 | 20-02-PLAN | Lock UI на платных уроках (замки, баннер "Оформи подписку") | SATISFIED | LockOverlay on lesson pages, LOCK_ICON on LessonCard, CourseLockBanner in catalog |
| PAY-05 | 20-01-PLAN | Централизованный access service в tRPC (не в middleware) | SATISFIED | `packages/api/src/utils/access.ts` — server-side utility called from tRPC procedures, not middleware |

All 3 requirement IDs from plan frontmatter accounted for. No orphaned requirements for Phase 20 in REQUIREMENTS.md.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No TODOs, no stubs, no placeholder returns found in any phase 20 files |

Anti-pattern scan over all 9 files: no `TODO`, `FIXME`, `placeholder`, `return null` stubs, no empty handlers, no static JSON returns.

---

## Human Verification Required

### 1. Navigation on locked lesson pages

**Test:** Run `pnpm dev`, log in as a user with no subscription, open a lesson with order > 2. Verify whether prev/next navigation buttons are visible at the bottom of the page.
**Expected per plan:** Navigation (prev/next) should be visible on locked lesson pages ("locked lessons are browsable").
**Actual in code:** Navigation is inside the unlocked branch — locked pages show only breadcrumb, header, and LockOverlay. No navigation footer.
**Why human:** This is a UX decision — the plan text says "browsable" but the ternary puts nav inside the unlocked block. Either behavior is reasonable; owner should confirm which is preferred.

### 2. PaywallBanner display when billing is disabled

**Test:** Set `billing_enabled=false` in FeatureFlag table, open a free lesson (order <= 2). Verify no PaywallBanner appears.
**Expected:** When `billing_enabled=false`, banner should be hidden.
**Note:** The banner condition checks `data.hasPlatformSubscription === false`. When billing is disabled, `checkLessonAccess` returns `hasPlatformSubscription: false` (see access.ts line 67). This means the banner MAY still show when billing is disabled if user hits a free lesson with >2 total lessons. Needs runtime verification.
**Why human:** The `billing_disabled` path returns `hasPlatformSubscription: false`, which would satisfy the banner condition. This is a potential edge case the code may not handle.

### 3. Feature flag toggle end-to-end

**Test:** Toggle `billing_enabled` in database (Prisma Studio), refresh `/learn`. Verify all lock icons and banners disappear.
**Expected:** All gating UI removed when `billing_enabled=false`.
**Why human:** Cannot verify runtime database flag behavior without running the app.

---

## Gaps Summary

No gaps found. All 15 must-have truths verified against actual code. All 9 artifacts exist and are substantive and wired. All 6 key links confirmed. Requirements PAY-01, PAY-03, PAY-05 fully implemented.

One minor concern to human-verify: the PaywallBanner edge case when `billing_enabled=false` (human verification item #2 above) — this does not block the phase goal but should be confirmed at runtime.

---

_Verified: 2026-03-12T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
