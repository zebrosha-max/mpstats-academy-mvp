---
phase: 05-security-hardening
plan: 01
subsystem: api
tags: [trpc, rate-limiting, server-only, security, middleware]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: tRPC router infrastructure and protectedProcedure
provides:
  - Sliding window rate limiter middleware (createRateLimitMiddleware)
  - aiProcedure (50 req/hour) and chatProcedure (20 req/hour) tRPC procedures
  - server-only guards on modules with secrets
  - CI service_role key leak detection
affects: [05-security-hardening, production-deploy]

# Tech tracking
tech-stack:
  added: [server-only]
  patterns: [sliding-window-rate-limit, globalThis-persistence, server-only-guards]

key-files:
  created:
    - packages/api/src/middleware/rate-limit.ts
  modified:
    - packages/api/src/trpc.ts
    - packages/api/src/routers/ai.ts
    - packages/ai/src/retrieval.ts
    - packages/ai/src/openrouter.ts
    - .github/workflows/ci.yml

key-decisions:
  - "Rate limiter uses globalThis Map for HMR persistence (same pattern as diagnostic.ts)"
  - "server-only added to @mpstats/ai package (not web app) — Next.js traces imports through monorepo"
  - "searchChunks uses protectedProcedure without rate limit (debug endpoint)"

patterns-established:
  - "createRateLimitMiddleware: reusable sliding window rate limiter for any tRPC procedure"
  - "server-only import as first line in modules that use secrets"

requirements-completed: [SEC-01, SEC-02, SEC-04]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 05 Plan 01: Security Hardening Summary

**Rate limiting middleware (50/hour AI, 20/hour chat) + server-only guards on secret-bearing modules + CI leak detection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T13:11:38Z
- **Completed:** 2026-02-25T13:13:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- All AI endpoints protected with authentication (no more publicProcedure)
- Rate limiting: 50 req/hour for AI summary/search, 20 req/hour for chat
- server-only guards prevent secret leakage to client bundle
- CI pipeline detects service_role key in client bundle post-build

## Task Commits

Each task was committed atomically:

1. **Task 1: Rate limit middleware + protected AI procedures** - `3ae5a0b` (feat)
2. **Task 2: server-only guards + CI service_role leak detection** - `ed8b9c2` (feat)

## Files Created/Modified
- `packages/api/src/middleware/rate-limit.ts` - Sliding window rate limiter with globalThis persistence
- `packages/api/src/trpc.ts` - Added aiProcedure and chatProcedure exports
- `packages/api/src/routers/ai.ts` - Switched all endpoints from publicProcedure to protected
- `packages/ai/src/retrieval.ts` - Added server-only guard (uses SUPABASE_SERVICE_ROLE_KEY)
- `packages/ai/src/openrouter.ts` - Added server-only guard (uses OPENROUTER_API_KEY)
- `.github/workflows/ci.yml` - Added service_role leak check after build

## Decisions Made
- Rate limiter uses globalThis Map for HMR persistence (same pattern as diagnostic.ts)
- server-only package added to @mpstats/ai (Next.js traces imports through monorepo)
- searchChunks uses protectedProcedure without rate limit (debug endpoint, low risk)
- clearSummaryCache kept as protectedProcedure without rate limit (admin utility)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All AI endpoints secured with auth + rate limiting
- Ready for Plan 05-02 (if additional security tasks planned)
- Production redeploy needed to apply these protections on VPS

---
*Phase: 05-security-hardening*
*Completed: 2026-02-25*
