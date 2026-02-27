---
phase: 13-watch-progress-tracking
plan: 01
subsystem: api, video, database
tags: [kinescope, prisma, trpc, video-progress, debounce, postMessage]

requires:
  - phase: 12-lesson-page-performance
    provides: "Optimized getLesson query with course relation, KinescopePlayer component"
provides:
  - "LessonProgress.lastPosition and videoDuration fields for per-user per-lesson tracking"
  - "saveWatchProgress tRPC mutation (auto-save from video playback)"
  - "getWatchProgress tRPC query (resume position on lesson reopen)"
  - "Kinescope IframePlayer time tracking via 10-second polling interval"
  - "Debounced 15-second save loop in lesson page"
  - "Resume-from-position with visual notification"
affects: [13-02, dashboard, learning-path]

tech-stack:
  added: []
  patterns:
    - "Ref-based time tracking to avoid re-render storms"
    - "Debounced mutation pattern (15s timeout in useRef)"
    - "onTimeUpdate callback via ref to avoid stale closures"
    - "sendBeacon for reliable save on page unload"

key-files:
  created: []
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/routers/learning.ts
    - apps/web/src/components/video/KinescopePlayer.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx

key-decisions:
  - "10-second polling interval for time tracking (balance between accuracy and API load)"
  - "15-second debounce for save calls (prevents spamming DB on every tick)"
  - "Ignore saves < 5 seconds (prevents noise from page loads / autoplay)"
  - "Auto-complete at >= 90% watched (same threshold as existing updateProgress)"
  - "sendBeacon + fallback mutation for reliable save on page unload"

patterns-established:
  - "Ref-based callback pattern: store onTimeUpdate in ref to avoid re-renders and stale closures"
  - "Polling via setInterval on Kinescope IframePlayer.getCurrentTime()/getDuration()"

requirements-completed: [WATCH-01, WATCH-03]

duration: 8min
completed: 2026-02-27
---

# Phase 13 Plan 01: Watch Progress Persistence Summary

**Kinescope video progress tracking with 10s polling, 15s debounced DB save, and resume-from-position on lesson reopen**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-27T09:29:02Z
- **Completed:** 2026-02-27T09:37:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `lastPosition` and `videoDuration` fields to LessonProgress model in Prisma schema
- Created `saveWatchProgress` mutation with auto-status transition (IN_PROGRESS -> COMPLETED at 90%)
- Created `getWatchProgress` query for fetching saved position on lesson load
- Extended KinescopePlayer with `onTimeUpdate` callback (10s interval) and `initialTime` for resume
- Wired lesson page with debounced 15s save, beforeunload save, and query invalidation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add lastPosition to schema + saveWatchProgress/getWatchProgress endpoints** - `c50d000` (feat)
2. **Task 2: Kinescope time tracking + lesson page save/restore integration** - `0fb36e9` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added lastPosition and videoDuration fields to LessonProgress
- `packages/api/src/routers/learning.ts` - Added saveWatchProgress mutation and getWatchProgress query
- `apps/web/src/components/video/KinescopePlayer.tsx` - Added onTimeUpdate, initialTime, getCurrentTime, resume notice
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Wired debounced save loop, beforeunload handler, resume from position

## Decisions Made
- Used 10-second polling interval for Kinescope time tracking (balance between accuracy and API overhead)
- 15-second debounce for database saves (prevents excessive writes)
- Ignore position < 5 seconds to filter out autoplay/page-load noise
- Used ref-based patterns throughout to prevent re-render storms from time updates
- sendBeacon on beforeunload for reliable final position capture

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Next.js `build --filter=web` fails with EPERM symlink error on Windows (standalone output). This is a pre-existing Windows permissions issue unrelated to code changes. TypeScript compilation (`tsc --noEmit`) passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Watch progress persistence is complete and ready for Phase 13 Plan 02 (progress UI / completion badges)
- DB schema is synced with Supabase
- All endpoints available via tRPC

---
*Phase: 13-watch-progress-tracking*
*Completed: 2026-02-27*
