---
phase: 41-pricing-logo-ux
verified: 2026-03-27T12:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 41: Pricing / Logo UX Polish — Verification Report

**Phase Goal:** Логотип ведёт в ЛК, курсы маппятся на категории диагностики, подпись в CP виджете, пустой custom track скрыт.
**Verified:** 2026-03-27T12:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Logo in sidebar navigates to /dashboard (not /) | VERIFIED | `sidebar.tsx:109` — `<Link href="/dashboard" className="flex items-center">` wrapping Logo + Academy text |
| 2 | Course dropdown on pricing shows diagnostic axis badges next to course names | VERIFIED | `pricing/page.tsx:20-24` — `COURSE_AXIS_MAP` constant; `pricing/page.tsx:224` — ` — ${COURSE_AXIS_MAP[course.id].join(', ')}` appended to `<option>` text |
| 3 | CP widget hint text visible below the payment button | VERIFIED | `pricing/page.tsx:267-269` — hint "Дата и CVV — на следующем шаге" in COURSE card footer; `pricing/page.tsx:348-350` — same hint in PLATFORM card footer |
| 4 | Empty custom section hidden on learn page | VERIFIED | `learn/page.tsx:592-595` — filter guard: `if (section.id === 'custom' && (!section.lessons \|\| section.lessons.length === 0)) return false` |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/shared/sidebar.tsx` | Logo wrapped in Link to /dashboard | VERIFIED | Line 109: `<Link href="/dashboard" className="flex items-center">` |
| `apps/web/src/app/pricing/page.tsx` | Axis badges in course dropdown + CP hint text | VERIFIED | `COURSE_AXIS_MAP` at line 20, hint text at lines 267-269 and 348-350 |
| `apps/web/src/app/(main)/learn/page.tsx` | Custom section hidden when empty | VERIFIED | Guard at lines 593-594 with `section.id === 'custom'` check |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sidebar.tsx` | `/dashboard` | `Link href` | WIRED | `href="/dashboard"` on line 109, wraps Logo + Academy text |

### Data-Flow Trace (Level 4)

The three modified files are UI-only changes (navigation link, text rendering, filter logic). No new data sources were introduced:

- `COURSE_AXIS_MAP` is a hardcoded constant — appropriate, no DB query needed for stable mapping.
- CP hint text is static markup — no data dependency.
- Custom section guard operates on `section.lessons` array from existing tRPC `getMyPath` query — data source unchanged, guard is purely presentational.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `sidebar.tsx` | n/a (static href) | n/a | n/a | FLOWING |
| `pricing/page.tsx` | `COURSE_AXIS_MAP` | Hardcoded constant | Yes (stable mapping) | FLOWING |
| `learn/page.tsx` | `section.lessons` | tRPC `getMyPath` (unchanged) | Yes (existing source) | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — changes are pure markup/logic edits, no new runnable entry points or API routes introduced. TypeScript compilation is the applicable programmatic check; commits `9e18704` and `8e74933` both exist and have meaningful messages.

### Requirements Coverage

No requirement IDs were declared for this phase (requirements: []). Phase covers audit items D-01 through D-06.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No anti-patterns detected. All changes are minimal and targeted. COURSE_AXIS_MAP is a hardcoded constant, which is intentional and documented in key-decisions.

### Human Verification Required

#### 1. Logo click on mobile sidebar

**Test:** Open the app on a mobile viewport. Tap the hamburger menu. Tap the logo/Academy text.
**Expected:** Navigates to /dashboard (not the landing page /).
**Why human:** Mobile nav is a separate component (`mobile-nav.tsx`). The plan explicitly states mobile-nav has no Logo component, but a human should confirm the mobile entry point behaves as expected.

#### 2. CP widget hint visibility after auth redirect

**Test:** Visit /pricing as a logged-in user with an active subscription. Verify the hint "Дата и CVV — на следующем шаге" does NOT appear (it should only show when the payment button is visible, not the "Управление подпиской" link).
**Expected:** Hint hidden when subscription is active; visible when payment button is shown.
**Why human:** The conditional rendering wraps the hint inside the same fragment as the Button — logic is correct in code but confirmation in a real session prevents regression.

### Gaps Summary

No gaps. All four audit items (D-01 through D-06) are implemented correctly and substantively in the codebase. The implementation matches the plan spec exactly — no deviations were found.

---

_Verified: 2026-03-27T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
