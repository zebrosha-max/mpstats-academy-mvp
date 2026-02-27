---
phase: 14-tech-debt-cleanup
plan: 01
subsystem: database, api, infra
tags: [prisma, globalThis, docker, diagnostic, session-persistence]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: DiagnosticSession Prisma model
provides:
  - DiagnosticSession.questions Json field for persisting question set
  - Version-independent Prisma engine copy in Dockerfile
affects: [production-deploy, diagnostic]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-persisted session questions instead of globalThis Map"
    - "Dynamic Prisma engine collection via find in Docker builder stage"

key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/routers/diagnostic.ts
    - Dockerfile

key-decisions:
  - "No session timeout mechanism added — existing ABANDONED-on-new-start is sufficient for MVP"
  - "Only activeSessionQuestions migrated; rate limiter Map stays in globalThis (ephemeral by nature)"
  - "Prisma engines collected to /app/prisma-collected/ in builder, copied to /app/node_modules/.prisma/client/ in runner"

patterns-established:
  - "Json field + unknown cast pattern for typed JSON in Prisma: `session.questions as unknown as DiagnosticQuestion[]`"

requirements-completed: [DEBT-01, DEBT-04]

# Metrics
duration: 4min
completed: 2026-02-27
---

# Phase 14 Plan 01: Session Persistence & Dockerfile Fix Summary

**Diagnostic session questions persisted to DB via Json field, Dockerfile uses dynamic Prisma engine discovery instead of hardcoded 5.22.0 paths**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-27T14:06:59Z
- **Completed:** 2026-02-27T14:11:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- DiagnosticSession.questions Json? field stores full question set in database — server restarts no longer lose active diagnostic sessions
- Removed entire globalThis activeSessionQuestions Map pattern from diagnostic router
- Dockerfile copies Prisma engine binaries via dynamic find instead of hardcoded @prisma+client@5.22.0 paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist session questions in DiagnosticSession model + migrate diagnostic router** - `7e73bbf` (feat)
2. **Task 2: Fix hardcoded Prisma version in Dockerfile** - `880a197` (fix)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added questions Json? field to DiagnosticSession model
- `packages/api/src/routers/diagnostic.ts` - Replaced globalThis Map with DB reads/writes for session questions
- `Dockerfile` - Dynamic Prisma engine collection via find, version-independent COPY

## Decisions Made
- No session timeout mechanism — existing pattern (ABANDONED on new session start) is sufficient for MVP
- Only activeSessionQuestions migrated to DB; rate limiter Map stays in globalThis (ephemeral, losing it on restart is fine)
- Used `as unknown as DiagnosticQuestion[]` cast for Prisma Json type (TypeScript doesn't allow direct cast from JsonValue)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript strict cast error for Prisma Json type**
- **Found during:** Task 1 (diagnostic router migration)
- **Issue:** `as DiagnosticQuestion[]` fails TypeScript strict check on Prisma's `JsonValue` type
- **Fix:** Changed to `as unknown as DiagnosticQuestion[]` (2 occurrences)
- **Files modified:** packages/api/src/routers/diagnostic.ts
- **Verification:** `tsc --noEmit` passes clean
- **Committed in:** 7e73bbf (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type cast adjustment, no scope creep.

## Issues Encountered
- Prisma generate failed due to Windows DLL file lock (query_engine-windows.dll.node held by running node processes). Resolved by deleting the locked file before regenerating.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema change already pushed to Supabase via db:push
- Dockerfile ready for next production deploy
- Plan 14-02 can proceed independently

---
*Phase: 14-tech-debt-cleanup*
*Completed: 2026-02-27*
