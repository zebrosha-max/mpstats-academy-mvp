---
phase: 12-lesson-page-performance
plan: 01
subsystem: ui, api
tags: [react, kinescope, lazy-loading, react-query, prisma, performance]

# Dependency graph
requires: []
provides:
  - Lazy video player with click-to-play placeholder (no iframe until user interaction)
  - Optimized tRPC cache settings (gcTime 30min, retry 1)
  - Consolidated getLesson query (1 DB query instead of 2)
affects: [13-watch-progress-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Click-to-play lazy loading for heavy iframes"
    - "gcTime/staleTime separation for navigation-friendly caching"
    - "Course relation include for single-query lesson + navigation data"

key-files:
  created: []
  modified:
    - apps/web/src/components/video/KinescopePlayer.tsx
    - apps/web/src/lib/trpc/provider.tsx
    - packages/api/src/routers/learning.ts

key-decisions:
  - "Gradient placeholder with Play button instead of Kinescope poster (poster URL unreliable)"
  - "gcTime 30min for cross-lesson navigation cache persistence"
  - "Simplified prev/next to {id, title} instead of full LessonWithProgress"

patterns-established:
  - "PlayPlaceholder pattern: click-to-activate for heavy third-party embeds"
  - "Single query via Prisma relation include for entity + navigation data"

requirements-completed: [PERF-01, PERF-02, PERF-03]

# Metrics
duration: 6min
completed: 2026-02-27
---

# Phase 12 Plan 01: Lesson Page Performance Summary

**Lazy video loading with click-to-play placeholder, 30min React Query cache, and single-query getLesson via course relation include**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-27T08:58:29Z
- **Completed:** 2026-02-27T09:04:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Video iframe no longer loads until user clicks Play -- page content (breadcrumb, title, summary) renders without waiting for Kinescope JS
- seekTo from source citations auto-activates the player and seeks to the timecode position
- React Query gcTime 30min ensures lesson data persists in cache during back/forth navigation
- getLesson consolidated from 2 DB queries to 1 via course relation include

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement lazy video loading with click-to-play placeholder** - `86d7d73` (feat)
2. **Task 2: Optimize tRPC caching and getLesson query** - `cd21c56` (feat)

## Files Created/Modified
- `apps/web/src/components/video/KinescopePlayer.tsx` - Added PlayPlaceholder component, activated state, autoPlay on activation
- `apps/web/src/lib/trpc/provider.tsx` - Added gcTime 30min and retry 1
- `packages/api/src/routers/learning.ts` - Consolidated getLesson to single query, simplified prev/next type

## Decisions Made
- Used gradient placeholder with Play button instead of trying to fetch Kinescope poster URL (poster API unreliable/undocumented)
- Set gcTime to 30min (vs 5min default) to keep lesson data cached during multi-lesson navigation sessions
- Reduced retry from 3 (default) to 1 for faster error display -- network errors on education platform rarely resolve on retry
- Simplified prev/next navigation to `{id, title}` since lesson page only uses `id` for Link href

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Windows EPERM symlink error during `pnpm build` standalone step -- pre-existing Windows permission issue unrelated to code changes. TypeScript compilation (`tsc --noEmit`) passes cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Lazy video player ready for Phase 13 (Watch Progress Tracking) -- player activation state provides clear hook for progress save/restore
- No blockers

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 12-lesson-page-performance*
*Completed: 2026-02-27*
