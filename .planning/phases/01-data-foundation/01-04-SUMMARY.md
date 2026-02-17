---
phase: 01-data-foundation
plan: 04
subsystem: api, ui
tags: [prisma, trpc, dashboard, profile, real-stats, error-handling]

# Dependency graph
requires:
  - phase: 01-02
    provides: Learning router Prisma migration (LessonProgress queries)
  - phase: 01-03
    provides: Diagnostic router Prisma migration (getLatestSkillProfile, getCompletedSessions exports)
provides:
  - Profile router with Prisma-based dashboard stats (lessons completed, watch time, streak, score)
  - DatabaseError component for Supabase 521 and generic DB error states
  - Dashboard empty state for new users with CTA to diagnostic
affects: [02-diagnostic-ai, 03-learning-ux, 06-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dashboard stats aggregation via parallel Prisma queries (Promise.all)"
    - "Activity streak calculation from consecutive calendar days"
    - "DatabaseError component pattern for typed tRPC error display"

key-files:
  created:
    - apps/web/src/components/shared/DatabaseError.tsx
  modified:
    - packages/api/src/routers/profile.ts
    - apps/web/src/app/(main)/dashboard/page.tsx

key-decisions:
  - "Average score calculated from SkillProfile axes average (not per-diagnostic)"
  - "longestStreak left as 0 for MVP — full history calculation deferred"
  - "updateSettings kept as mock (no Settings model in schema)"
  - "Pre-existing build errors in design-v2/ not fixed (out of scope)"

patterns-established:
  - "DatabaseError component: check error.message for DATABASE_UNAVAILABLE to show Supabase-specific message"
  - "Dashboard error handling: show greeting + DatabaseError on tRPC failure"

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 01 Plan 04: Profile Router + Dashboard Summary

**Profile router rewritten to Prisma with real dashboard stats (lessons, watch time, streak, score) and DatabaseError component for Supabase 521 handling**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T07:26:52Z
- **Completed:** 2026-02-17T07:33:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint awaiting human verification)
- **Files modified:** 3

## Accomplishments
- Profile router fully migrated from mock data to Prisma — getDashboard, getStats, getRecentActivity, getSkillProfile all query real DB
- Dashboard stats calculated from real data: completed lessons count, total watch time from lesson durations, activity streak from consecutive days, average score from skill profile
- DatabaseError component distinguishes Supabase 521 (paused) from generic DB errors with specific admin instructions
- Dashboard handles error state (shows DatabaseError) and empty state for new users (skeleton radar with CTA)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite profile router with Prisma queries and real stats** - `7887bfa` (feat)
2. **Task 2: Create DatabaseError component and update dashboard empty state** - `a53de8c` (feat)
3. **Task 3: Verify full data flow end-to-end** - CHECKPOINT (awaiting human verification)

## Files Created/Modified
- `packages/api/src/routers/profile.ts` - Complete Prisma rewrite with real stats, streak calculation, recent activity, next lesson recommendation
- `apps/web/src/components/shared/DatabaseError.tsx` - Reusable DB error component with Supabase 521 detection
- `apps/web/src/app/(main)/dashboard/page.tsx` - Added error state with DatabaseError, enhanced empty state CTA

## Decisions Made
- Average score calculated as mean of 5 skill profile axes (simpler than per-diagnostic calculation, same result for latest diagnostic)
- longestStreak set to 0 for MVP — full history scan not worth complexity at this stage
- updateSettings kept as mock since no Settings table exists in schema
- Pre-existing ESLint errors in `design-v2/page.tsx` (untracked files) not fixed — out of scope per deviation rules

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed unused variable TypeScript errors**
- **Found during:** Task 1 verification (typecheck)
- **Issue:** `getCompletedSessions` import unused, `userId` param unused in getNextUncompletedLesson, `learningPath` destructured but unused
- **Fix:** Removed unused import, prefixed unused vars with underscore
- **Files modified:** packages/api/src/routers/profile.ts
- **Verification:** `pnpm typecheck` passes
- **Committed in:** 7887bfa (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript hygiene fix. No scope creep.

## Issues Encountered
- `pnpm build` fails due to pre-existing ESLint errors in `apps/web/src/app/design-v2/page.tsx` (unescaped entities). These are untracked files not related to this plan. `pnpm typecheck` passes cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three routers (learning, diagnostic, profile) now use Prisma for data
- Dashboard displays real statistics from Supabase
- Phase 1 Data Foundation complete after Task 3 verification
- Ready for Phase 2 (Diagnostic AI) and Phase 3 (Learning UX)

---
*Phase: 01-data-foundation*
*Completed: 2026-02-17*
