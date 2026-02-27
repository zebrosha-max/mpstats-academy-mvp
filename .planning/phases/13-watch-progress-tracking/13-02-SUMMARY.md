---
phase: 13-watch-progress-tracking
plan: 02
subsystem: ui, api, admin
tags: [progress-bar, watch-percent, course-completion, admin-analytics, trpc]

requires:
  - phase: 13-watch-progress-tracking
    provides: "LessonProgress.lastPosition/watchedPercent fields and saveWatchProgress mutation"
provides:
  - "Progress bars on all lesson cards with watchedPercent > 0 (green for completed, blue for in-progress)"
  - "Course-level progressPercent based on weighted average of lesson watchedPercent"
  - "Continue-watching button linking to first unwatched lesson in course"
  - "Admin getWatchStats endpoint with avg watch %, completion rate, per-course breakdown, top users"
  - "Watch engagement section on admin analytics page"
affects: [dashboard, admin-panel]

tech-stack:
  added: []
  patterns:
    - "Weighted average progress calculation excluding lessons without videoId"
    - "In-memory aggregation for admin watch stats (groupBy userId/courseId)"

key-files:
  created: []
  modified:
    - apps/web/src/components/learning/LessonCard.tsx
    - apps/web/src/app/(main)/learn/page.tsx
    - packages/api/src/routers/learning.ts
    - packages/api/src/routers/admin.ts
    - apps/web/src/app/(admin)/admin/analytics/page.tsx

key-decisions:
  - "Progress bar shown for ALL lessons with watchedPercent > 0 (not just IN_PROGRESS status)"
  - "Course progressPercent uses weighted average of lesson watchedPercent, excluding lessons without videoId"
  - "Continue-watching button finds first IN_PROGRESS lesson, then first NOT_STARTED if none in progress"

patterns-established:
  - "Color-coded progress bars: green (bg-mp-green-500) for COMPLETED, blue (bg-mp-blue-500) for in-progress"

requirements-completed: [WATCH-02, WATCH-04]

duration: 5min
completed: 2026-02-27
---

# Phase 13 Plan 02: Progress UI & Admin Watch Stats Summary

**Progress bars on lesson cards and course headers with weighted-average completion, plus admin watch engagement dashboard**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-27T09:39:42Z
- **Completed:** 2026-02-27T09:44:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Lesson cards show progress bars for all lessons with watchedPercent > 0 (green for completed, blue for in-progress)
- Course headers display weighted-average progress bar with completion % and "Продолжить просмотр" button
- Admin analytics page shows watch engagement section: KPI cards, per-course table, top-5 active users

## Task Commits

Each task was committed atomically:

1. **Task 1: Progress UI on lesson cards + course completion in /learn page** - `afbf698` (feat)
2. **Task 2: Admin watch engagement stats** - `66014eb` (feat)

## Files Created/Modified
- `apps/web/src/components/learning/LessonCard.tsx` - Progress bar for all watched lessons with color-coded bars and checkmark
- `apps/web/src/app/(main)/learn/page.tsx` - Course progress bar with completion %, continue-watching button
- `packages/api/src/routers/learning.ts` - Weighted-average progressPercent calculation in getCourses and getCourse
- `packages/api/src/routers/admin.ts` - getWatchStats procedure with aggregate metrics
- `apps/web/src/app/(admin)/admin/analytics/page.tsx` - Watch engagement section with KPI cards and tables

## Decisions Made
- Progress bar shown for ALL lessons with watchedPercent > 0, not just IN_PROGRESS — ensures completed lessons show full green bar
- Course progressPercent uses weighted average of per-lesson watchedPercent instead of binary completed/total — provides more granular progress indication
- Lessons without videoId excluded from course progress calculation — only video-based lessons contribute
- Used inline span with border instead of Badge component for "Курс завершён" label — Badge lacked outline variant

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Badge variant mismatch**
- **Found during:** Task 1 (learn page course header)
- **Issue:** Plan specified Badge with `variant="outline"` but the Badge component has no "outline" variant
- **Fix:** Replaced with inline styled span element matching the intended design
- **Files modified:** apps/web/src/app/(main)/learn/page.tsx
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** afbf698

**2. [Rule 1 - Bug] getCourse progressPercent inconsistency**
- **Found during:** Task 1 (learning router)
- **Issue:** Plan only mentioned getCourses but getCourse (single) had the same binary calculation
- **Fix:** Applied same weighted-average formula to getCourse procedure
- **Files modified:** packages/api/src/routers/learning.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** afbf698

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 13 (Watch Progress Tracking) is now complete
- All WATCH requirements covered: persistence (13-01), UI display (13-02)
- Ready for Phase 14 or any remaining phases

---
*Phase: 13-watch-progress-tracking*
*Completed: 2026-02-27*
