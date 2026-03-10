---
phase: 17-yandex-id-auth
plan: 02
subsystem: auth
tags: [yandex-id, oauth, ui, react, vitest]

# Dependency graph
requires:
  - phase: 17-01
    provides: signInWithYandex action in auth/actions.ts, OAuthProvider interface
provides:
  - Login page with "Войти с Яндекс ID" button (red Ya logo)
  - Register page with "Продолжить с Яндекс ID" button (red Ya logo)
  - Zero Google OAuth references in codebase
  - Comprehensive auth test suite (24 tests across 3 files)
affects: [phase-18, phase-19]

# Tech tracking
tech-stack:
  added: []
  patterns: [inline-svg-brand-icon, fs-based-codebase-tests]

key-files:
  created:
    - apps/web/tests/auth/no-google.test.ts
  modified:
    - apps/web/src/app/(auth)/login/page.tsx
    - apps/web/src/app/(auth)/register/page.tsx

key-decisions:
  - "Inline SVG for Yandex Ya logo (no external dependency)"
  - "File-system grep tests to enforce no-Google policy at CI level"

patterns-established:
  - "Brand icon as inline SVG: Yandex red circle with white Ya letter"
  - "Codebase constraint tests: read source files and assert absence of deprecated patterns"

requirements-completed: [AUTH-02, AUTH-03]

# Metrics
duration: 3min
completed: 2026-03-10
---

# Phase 17 Plan 02: UI OAuth Replacement Summary

**Login and register pages replaced Google OAuth button with Yandex ID (red Ya logo), verified zero Google references across entire src/ directory**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-10T10:30:00Z
- **Completed:** 2026-03-10T10:33:00Z
- **Tasks:** 2 (TDD task + verification task)
- **Files modified:** 3

## Accomplishments
- Login page shows "Войти с Яндекс ID" with red Ya circle logo, replacing Google button
- Register page shows "Продолжить с Яндекс ID" with same branding
- Zero `signInWithGoogle` or `Google` OAuth references remain in src/
- Landing page confirmed clean -- no Google OAuth mentions
- 24 auth tests pass across 3 test files (oauth-provider, yandex-oauth, no-google)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for Google removal** - `27c079e` (test)
2. **Task 1 (GREEN): Replace Google with Yandex on login/register** - `fedd114` (feat)
3. **Task 2: Landing page verification + test expansion** - `b056167` (test)

## Files Created/Modified
- `apps/web/src/app/(auth)/login/page.tsx` - Google button replaced with Yandex ID button
- `apps/web/src/app/(auth)/register/page.tsx` - Google button replaced with Yandex ID button
- `apps/web/tests/auth/no-google.test.ts` - 9 tests verifying zero Google references across auth files, actions, landing, and entire src/

## Decisions Made
- Used inline SVG for Yandex brand icon (red circle #FC3F1D with white Cyrillic Ya) -- avoids external asset dependency
- Added landing page test to no-google suite to prevent future regressions
- `next/font/google` import in layout.tsx correctly excluded from "no Google" policy (it's a Next.js font loader, not OAuth)

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration** (from plan frontmatter):
- Disable Google provider in Supabase Dashboard: Authentication -> Providers -> Google -> toggle OFF
- Create admin account for Egor Vasilev (isAdmin=true via SQL Editor)
- Register Yandex OAuth app and add credentials to .env (covered in Plan 01 setup)

## Next Phase Readiness
- Auth UI migration complete -- users see Yandex ID and email/password options only
- Backend OAuth flow ready (from Plan 01) -- needs real Yandex credentials for end-to-end testing
- Phase 18 (CloudPayments Webhooks) can proceed independently

---
*Phase: 17-yandex-id-auth*
*Completed: 2026-03-10*
