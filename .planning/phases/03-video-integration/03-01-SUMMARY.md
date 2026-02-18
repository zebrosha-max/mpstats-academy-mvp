---
phase: 03-video-integration
plan: 01
subsystem: ui
tags: [kinescope, video-player, timecodes, react, dynamic-import]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: Lesson model with videoId column, RAG SourceCitation with timecode_start/timecode_end
provides:
  - KinescopePlayer component with ref-based seekTo and onReady queue
  - TimecodeLink clickable badge component
  - VideoPlaceholder component for missing videos
  - Lesson page wired with player + timecode seek
affects: [03-video-integration plan 02 (bulk upload), future lesson UX]

# Tech tracking
tech-stack:
  added: [@kinescope/react-kinescope-player]
  patterns: [dynamic import with ssr:false for browser-only components, forwardRef + useImperativeHandle for player control, onReady queue pattern for deferred commands]

key-files:
  created:
    - apps/web/src/components/video/KinescopePlayer.tsx
    - apps/web/src/components/video/TimecodeLink.tsx
    - apps/web/src/components/video/VideoPlaceholder.tsx
  modified:
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - apps/web/package.json

key-decisions:
  - "Cast dynamic() result to original class type to preserve ref typing"
  - "seekTo + play on timecode click (not just seek) for intuitive UX"
  - "Timecodes shown as disabled badges when no video (not hidden)"

patterns-established:
  - "Dynamic import pattern: use `as unknown as typeof OriginalType` for class components loaded via next/dynamic to preserve ref support"
  - "Player ready queue: buffer commands in pendingSeekRef until onReady fires"

requirements-completed: [VIDEO-01, VIDEO-03, VIDEO-04]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 03 Plan 01: Video Player Integration Summary

**Kinescope React player with ref-based seekTo, clickable timecode badges in RAG sources, and VideoPlaceholder for missing videos**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T09:06:45Z
- **Completed:** 2026-02-18T09:10:15Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- KinescopePlayer component with dynamic import (SSR-safe), forwardRef seekTo, and onReady queue for deferred seek commands
- TimecodeLink component rendering as clickable badge with play icon, enabled/disabled states based on videoId presence
- VideoPlaceholder with informative message ("Видео готовится к публикации") and note that AI panel works from transcript
- Lesson page fully wired: playerRef, handleTimecodeClick with mobile scroll, TimecodeLink in both summary and chat sources

## Task Commits

Each task was committed atomically:

1. **Task 1: Create video components** - `e1b29c8` (feat)
2. **Task 2: Wire video components into lesson page** - `012dd7b` (feat)

## Files Created/Modified
- `apps/web/src/components/video/KinescopePlayer.tsx` - Kinescope player wrapper with dynamic import, ref-based seekTo, onReady queue
- `apps/web/src/components/video/TimecodeLink.tsx` - Clickable timecode badge with play icon, enabled/disabled states
- `apps/web/src/components/video/VideoPlaceholder.tsx` - Placeholder UI when videoId is null
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Updated lesson page wiring player + timecodes
- `apps/web/package.json` - Added @kinescope/react-kinescope-player dependency

## Decisions Made
- Cast dynamic() result to original class type (`as unknown as typeof KinescopePlayerType`) to preserve ref typing -- dynamic() wraps class components and strips ref prop type
- seekTo triggers play() as well, giving intuitive "click timecode, video jumps and plays" behavior
- Timecodes remain visible as disabled badges when no videoId (not hidden), preserving time reference information

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript ref typing for dynamic import**
- **Found during:** Task 1 (KinescopePlayer creation)
- **Issue:** `next/dynamic()` returns `ComponentType` which doesn't support `ref` prop on class components, causing TS2322
- **Fix:** Cast dynamic result as `unknown as typeof KinescopePlayerType` and import the type separately
- **Files modified:** apps/web/src/components/video/KinescopePlayer.tsx
- **Verification:** `pnpm --filter web typecheck` passes clean
- **Committed in:** e1b29c8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type-level fix only, no behavior change. No scope creep.

## Issues Encountered
- Pre-existing build failures in `diagnostic/session/page.tsx` (React hooks rule) and `design-v2/page.tsx` (unescaped entities) -- these are out of scope and pre-date this plan. TypeScript typecheck was used for verification instead of full build.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Video components ready for use once Kinescope videoIds are populated in Lesson records
- Plan 03-02 (bulk upload script + Kinescope setup guide) can proceed
- Timecodes will activate automatically when videoId is set on a lesson

---
*Phase: 03-video-integration*
*Completed: 2026-02-18*
