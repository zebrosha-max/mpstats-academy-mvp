---
phase: 01-data-foundation
plan: 02
subsystem: api
tags: [prisma, trpc, learning, courses, lessons, progress]

# Dependency graph
requires:
  - "01-01: ensureUserProfile utility, handleDatabaseError utility, Prisma schema with Course/Lesson/LearningPath models"
provides:
  - "Prisma-based learning router with 7 procedures (getCourses, getCourse, getPath, getLesson, getNextLesson, updateProgress, completeLesson)"
  - "LearningPath auto-creation on first lesson interaction"
  - "Frontend error handling for DATABASE_UNAVAILABLE on /learn pages"
  - "Course lesson collapsing for 405-lesson scale"
affects: [01-03-PLAN, 01-04-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns: [prisma-include-nested-progress, upsert-path-then-progress, course-lesson-collapsing]

key-files:
  created: []
  modified:
    - "packages/api/src/routers/learning.ts"
    - "apps/web/src/app/(main)/learn/page.tsx"
    - "apps/web/src/app/(main)/learn/[id]/page.tsx"

key-decisions:
  - "Removed getLessonSummary from learning router (already handled by AI router)"
  - "Default view changed from 'path' to 'courses' for better UX with 405 lessons"
  - "Course lessons collapsed to first 5 with expand button to handle 60+ lessons per course"

patterns-established:
  - "Prisma nested include with progress filtering by user's LearningPath"
  - "LearningPath auto-created via upsert before LessonProgress upsert"
  - "Error state pattern: isDatabaseUnavailable check with retry button"

# Metrics
duration: 4min
completed: 2026-02-17
---

# Phase 1 Plan 02: Learning Router Migration Summary

**Prisma-based learning router replacing mock data with real Course/Lesson/LessonProgress queries and auto-created LearningPath**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-17T07:20:33Z
- **Completed:** 2026-02-17T07:24:29Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote all 7 learning router procedures from mock data to Prisma queries against Supabase
- Removed getLessonSummary (dead code, already handled by AI router)
- Added LearningPath auto-creation via upsert for updateProgress and completeLesson
- Added error handling on both frontend pages for DATABASE_UNAVAILABLE errors
- Added course lesson collapsing (show first 5, expand all) to handle 405 lessons

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite learning router with Prisma queries** - `86e7015` (feat)
2. **Task 2: Update frontend learn pages for new data shape** - `6634a98` (feat)

## Files Created/Modified
- `packages/api/src/routers/learning.ts` - Complete rewrite: 7 procedures using ctx.prisma for all data operations
- `apps/web/src/app/(main)/learn/page.tsx` - Error state, course collapsing, default courses view
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Error state for lesson loading failures

## Decisions Made
- Removed getLessonSummary procedure from learning router since it was already superseded by `ai.getLessonSummary` in Sprint 3
- Changed default view mode from 'path' to 'courses' since with 405 lessons the courses view gives better structure
- Added INITIAL_LESSONS_SHOWN = 5 per course with expand/collapse to prevent 60+ lesson lists per course card

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type mismatch in getLesson mapLesson function**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** `mapLesson` was typed as `(l: typeof lesson)` but `courseLessons` (for next/prev) had different type (no `course` include)
- **Fix:** Created explicit `LessonWithProgressData` type that works for both lesson (with course) and courseLessons (without course)
- **Files modified:** packages/api/src/routers/learning.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 86e7015 (Task 1 commit)

**2. [Rule 1 - Bug] Removed unused TRPCError import**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** TRPCError was imported but not used (handleDatabaseError handles all error throwing)
- **Fix:** Removed the import
- **Files modified:** packages/api/src/routers/learning.ts
- **Committed in:** 86e7015 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Minor type fixes required for compilation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in diagnostic.ts (unused variables) -- out of scope, not fixed

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Learning router fully migrated to Prisma, ready for diagnostic router migration (Plan 03)
- Error handling pattern established for reuse in diagnostic and profile pages
- Course/lesson collapsing pattern available for dashboard if needed (Plan 04)

## Self-Check: PASSED

---
*Phase: 01-data-foundation*
*Completed: 2026-02-17*
