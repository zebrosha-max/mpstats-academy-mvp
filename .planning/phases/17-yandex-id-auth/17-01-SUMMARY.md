---
phase: 17-yandex-id-auth
plan: 01
subsystem: auth
tags: [yandex-oauth, supabase-admin, csrf, server-actions, oauth-provider-interface]

# Dependency graph
requires:
  - phase: 16-billing-data-foundation
    provides: UserProfile.yandexId field, Prisma migration baseline
provides:
  - OAuthProvider interface for extensible OAuth flows
  - YandexProvider class (authorize, token exchange, user info)
  - Supabase admin client for privileged user/session management
  - Yandex OAuth callback route handler (/api/auth/yandex/callback)
  - signInWithYandex server action (replaces signInWithGoogle)
affects: [17-02-ui-integration, future-tochka-id]

# Tech tracking
tech-stack:
  added: [jsdom (dev)]
  patterns: [server-side-oauth-proxy, supabase-admin-session-creation, csrf-state-cookie]

key-files:
  created:
    - apps/web/src/lib/auth/oauth-providers.ts
    - apps/web/src/lib/auth/supabase-admin.ts
    - apps/web/src/app/api/auth/yandex/callback/route.ts
    - apps/web/tests/auth/oauth-provider.test.ts
    - apps/web/tests/auth/yandex-oauth.test.ts
  modified:
    - apps/web/src/lib/auth/actions.ts

key-decisions:
  - "Used @mpstats/db/client singleton instead of direct PrismaClient instantiation in callback route"
  - "NextResponse.redirect uses default 307 status (Next.js convention) for OAuth redirects"
  - "Prisma upsert for yandexId is non-fatal -- session still valid if DB update fails"

patterns-established:
  - "OAuthProvider interface: authorizeUrl/exchangeCode/getUserInfo -- add TochkaProvider later without changing callback logic"
  - "CSRF state via httpOnly cookie with crypto.randomUUID()"
  - "Supabase session injection via generateLink(magiclink) + verifyOtp pattern"

requirements-completed: [AUTH-01, AUTH-04]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 17 Plan 01: Yandex OAuth Backend Summary

**Server-side Yandex OAuth proxy with OAuthProvider abstraction, Supabase admin session creation, and CSRF-protected callback route**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T09:59:35Z
- **Completed:** 2026-03-10T10:04:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- OAuthProvider interface + YandexProvider class implementing full Yandex ID OAuth flow (authorize URL, code exchange, user info)
- Supabase admin client isolated in server-only module for privileged operations
- Yandex OAuth callback route handling CSRF verification, code exchange, user lookup/creation, session generation, and cookie setting
- signInWithYandex server action replacing signInWithGoogle with state cookie CSRF protection
- 15 unit/integration tests covering all provider methods, callback edge cases, and action exports

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuthProvider interface + YandexProvider + Supabase admin client** - `1a3352e` (feat)
2. **Task 2: Yandex OAuth callback route + signInWithYandex action** - `c8f34db` (feat)

_TDD flow: tests written first (RED), then implementation (GREEN) for both tasks._

## Files Created/Modified
- `apps/web/src/lib/auth/oauth-providers.ts` - OAuthProvider interface, OAuthUserInfo type, YandexProvider class
- `apps/web/src/lib/auth/supabase-admin.ts` - Supabase admin client with SERVICE_ROLE_KEY (server-only)
- `apps/web/src/app/api/auth/yandex/callback/route.ts` - GET handler for full OAuth callback flow
- `apps/web/src/lib/auth/actions.ts` - Removed signInWithGoogle, added signInWithYandex with state cookie
- `apps/web/tests/auth/oauth-provider.test.ts` - 10 tests for YandexProvider methods
- `apps/web/tests/auth/yandex-oauth.test.ts` - 5 tests for callback route and action exports

## Decisions Made
- Used `@mpstats/db/client` prisma singleton instead of instantiating PrismaClient directly (consistent with project pattern)
- NextResponse.redirect uses default 307 status code (standard Next.js behavior)
- yandexId Prisma upsert wrapped in try/catch as non-fatal -- session is still valid if DB write fails (handles trigger race condition gracefully)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing jsdom dependency**
- **Found during:** Task 1 (test execution)
- **Issue:** Vitest config specifies `environment: 'jsdom'` but jsdom package not installed
- **Fix:** `pnpm add -D jsdom --filter web`
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** Tests run successfully
- **Committed in:** 1a3352e (Task 1 commit)

**2. [Rule 3 - Blocking] Changed PrismaClient import to @mpstats/db/client**
- **Found during:** Task 2 (test execution)
- **Issue:** Direct `import { PrismaClient } from '@prisma/client'` not resolvable in Vitest test environment
- **Fix:** Used `import { prisma } from '@mpstats/db/client'` (project's existing singleton pattern)
- **Files modified:** apps/web/src/app/api/auth/yandex/callback/route.ts
- **Verification:** All tests pass, consistent with project patterns
- **Committed in:** c8f34db (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for test execution. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required

**External services require manual configuration.** Before Yandex OAuth will work:
- `YANDEX_CLIENT_ID` - Register app at https://oauth.yandex.ru/client/new
- `YANDEX_CLIENT_SECRET` - From Yandex OAuth app settings
- `SUPABASE_SERVICE_ROLE_KEY` - From Supabase Dashboard -> Settings -> API

## Next Phase Readiness
- Backend OAuth flow complete, ready for Plan 02 (UI integration)
- Login/register pages need Yandex button (replaces Google button)
- Landing page may need Google reference removal
- Requires Yandex OAuth app registration and env vars before testing

---
*Phase: 17-yandex-id-auth*
*Completed: 2026-03-10*
