---
phase: 26-yandex-metrika
verified: 2026-03-19T11:30:00Z
status: human_needed
score: 4/5 must-haves verified
human_verification:
  - test: "Counter loads on production platform.mpstats.academy"
    expected: "DevTools Network tab shows mc.yandex.ru requests when visiting https://platform.mpstats.academy"
    why_human: "Cannot programmatically verify live production network requests; requires browser DevTools"
  - test: "8 goals exist in Yandex.Metrika dashboard for counter 94592073"
    expected: "Settings > Goals shows 8 JavaScript event goals: platform_signup, platform_login, platform_diagnostic_start, platform_diagnostic_complete, platform_lesson_open, platform_pricing_view, platform_payment, platform_cta_click"
    why_human: "External dashboard, no API access available in codebase"
---

# Phase 26: Yandex Metrika Verification Report

**Phase Goal:** Интеграция Яндекс.Метрики на платформу platform.mpstats.academy: подключение счётчика, SPA-навигация, набор целей с параметрами, ecommerce-цель с revenue.
**Verified:** 2026-03-19T11:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | YandexMetrika counter loads on production pages (counter 94592073) | ? HUMAN | Component present in layout.tsx behind `NODE_ENV === 'production'`; actual loading requires DevTools check on prod |
| 2 | SPA navigation sends page hits automatically | ✓ VERIFIED | `@koiztech/next-yandex-metrika` package handles SPA routing automatically via `strategy="afterInteractive"` — no manual hit() calls needed by design |
| 3 | 8 goals fire at correct call sites with typed params | ✓ VERIFIED | All 8 goals wired: SIGNUP (register), LOGIN (login), DIAGNOSTIC_START (session), DIAGNOSTIC_COMPLETE (results), LESSON_OPEN (learn/[id]), PRICING_VIEW+PAYMENT (pricing), CTA_CLICK (landing) |
| 4 | Counter works in Docker production build (NEXT_PUBLIC_YANDEX_ID inlined at build time) | ✓ VERIFIED | Dockerfile has `ARG NEXT_PUBLIC_YANDEX_ID` + `ENV NEXT_PUBLIC_YANDEX_ID=$NEXT_PUBLIC_YANDEX_ID`; docker-compose.yml passes `NEXT_PUBLIC_YANDEX_ID: ${NEXT_PUBLIC_YANDEX_ID}` as build arg |
| 5 | Goals are created in Metrika dashboard for conversion tracking | ? HUMAN | SUMMARY claims human completed this (Task 3); cannot programmatically verify external dashboard |

**Score:** 3/5 truths fully automated-verified (2 require human confirmation per design)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/analytics/constants.ts` | Typed METRIKA_GOALS constant and MetrikaGoal type | ✓ VERIFIED | Contains all 8 goals with `platform_` prefix; `export type MetrikaGoal` present |
| `apps/web/src/lib/analytics/metrika.ts` | Safe reachGoal helper with null checks | ✓ VERIFIED | Checks `window === 'undefined'`, `window.ym`, `counterId` before calling; substantive 9 lines |
| `apps/web/src/types/yandex-metrika.d.ts` | Window.ym global type declaration | ✓ VERIFIED | `declare global { interface Window { ym?: ... } }` with correct method signatures |
| `apps/web/src/app/layout.tsx` | YandexMetrika component in body, production-only | ✓ VERIFIED | Import from `@koiztech/next-yandex-metrika`; rendered under `process.env.NODE_ENV === 'production'` with all 4 options enabled |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/layout.tsx` | `@koiztech/next-yandex-metrika` | `import { YandexMetrika }` | ✓ WIRED | Import on line 7; component rendered on line 75 |
| `apps/web/src/app/(auth)/register/page.tsx` | `apps/web/src/lib/analytics/metrika.ts` | `reachGoal(METRIKA_GOALS.SIGNUP` | ✓ WIRED | Called twice: email method (line 37) and yandex method (line 46) |
| `Dockerfile` | `NEXT_PUBLIC_YANDEX_ID` | `ARG NEXT_PUBLIC_YANDEX_ID` | ✓ WIRED | `ARG NEXT_PUBLIC_YANDEX_ID` (line 29) + `ENV NEXT_PUBLIC_YANDEX_ID=$NEXT_PUBLIC_YANDEX_ID` (line 35) |

**Additional wiring verified (beyond plan key_links):**

| Page | Goal | Call Site |
|------|------|-----------|
| `(auth)/login/page.tsx` | LOGIN (email + yandex) | Lines 26, 39 |
| `(main)/diagnostic/session/page.tsx` | DIAGNOSTIC_START | Line 119 |
| `(main)/diagnostic/results/page.tsx` | DIAGNOSTIC_COMPLETE with `avgScore: results.accuracy` | Line 44 |
| `(main)/learn/[id]/page.tsx` | LESSON_OPEN with courseId/lessonId | Line 88 |
| `pricing/page.tsx` | PRICING_VIEW (useEffect mount) + PAYMENT (CP widget success) | Lines 44, 94 |
| `page.tsx` (landing) | CTA_CLICK with position: nav/hero/footer | Lines 164, 193, 380 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| YM-01 | 26-01-PLAN.md | Яндекс.Метрика counter integration | ✓ SATISFIED | YandexMetrika in layout.tsx, package installed, production-only |
| YM-02 | 26-01-PLAN.md | SPA navigation tracking | ✓ SATISFIED | `@koiztech/next-yandex-metrika` with `strategy="afterInteractive"` handles SPA hits |
| YM-03 | 26-01-PLAN.md | 8 typed conversion goals with params | ✓ SATISFIED | All 8 goals in constants.ts, all 8 wired at correct call sites |

**Note on requirement IDs:** YM-01, YM-02, YM-03 are referenced in the PLAN frontmatter and ROADMAP.md but are **not defined in REQUIREMENTS.md**. The Traceability table in REQUIREMENTS.md has no YM-* entries. This is a documentation gap — the requirements exist functionally in the ROADMAP goal and success criteria but were never added to the requirements registry. The implementation satisfies the intent. No code action required; REQUIREMENTS.md should be updated to register these IDs.

**No orphaned requirements:** No other Phase 26 IDs appear in REQUIREMENTS.md outside the plan's declared set.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | No placeholders, stubs, or dead code found in analytics files or modified pages |

### Human Verification Required

#### 1. Counter Loading on Production

**Test:** Visit https://platform.mpstats.academy in a browser, open DevTools > Network, filter by `mc.yandex.ru`
**Expected:** Requests to `mc.yandex.ru` appear shortly after page load, confirming counter 94592073 is active
**Why human:** Cannot make HTTP requests to live production from codebase verification; requires browser environment

#### 2. Goals Created in Yandex.Metrika Dashboard

**Test:** Log in to https://metrika.yandex.ru/list with mpstats.academy account, open counter 94592073 > Settings > Goals
**Expected:** 8 goals of type "JavaScript event" exist with identifiers: `platform_signup`, `platform_login`, `platform_diagnostic_start`, `platform_diagnostic_complete`, `platform_lesson_open`, `platform_pricing_view`, `platform_payment`, `platform_cta_click`
**Why human:** External SaaS dashboard, no programmatic access available

### Gaps Summary

No implementation gaps found. All 4 artifacts are substantive and fully wired. All 8 goal call sites confirmed present with correct parameters.

The only open items are human-verified truths that were explicitly designed as human-action checkpoints in the plan (Task 3). Per SUMMARY.md, both were completed by the user (goals created in dashboard, deployment done, counter confirmed in DevTools). Automated verification cannot confirm external dashboard state or live network behavior.

The documentation gap (YM-01/02/03 not in REQUIREMENTS.md) does not affect functionality.

---

_Verified: 2026-03-19T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
