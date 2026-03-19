---
phase: 32-custom-track-management
plan: 02
subsystem: ui
tags: [react, trpc, optimistic-updates, toast, alert-dialog, learning-path]

requires:
  - phase: 32-custom-track-management
    provides: "addToTrack, removeFromTrack, rebuildTrack tRPC mutations"
provides:
  - "Track toggle buttons (+/checkmark) on LessonCard in courses view"
  - "Remove (X) buttons on LessonCard in track view"
  - "Rebuild track button with confirmation AlertDialog"
  - "Optimistic updates and toast feedback for all track mutations"
  - "Custom section purple styling in SECTION_STYLES"
affects: [learning, diagnostic]

tech-stack:
  added: ["@radix-ui/react-alert-dialog"]
  patterns: ["optimistic update with rollback via onMutate/onError", "no-op callback for read-only toggle state"]

key-files:
  created:
    - apps/web/src/components/ui/alert-dialog.tsx
  modified:
    - apps/web/src/components/learning/LessonCard.tsx
    - apps/web/src/app/(main)/learn/page.tsx

key-decisions:
  - "getRecommendedPath always fetched (not gated by hasDiagnostic) to support custom-only tracks"
  - "Checkmark in courses view uses no-op onToggleTrack (visual-only, no remove action from courses)"
  - "CTA banner only shown when hasDiagnostic===false AND no recommendedPath exists"

patterns-established:
  - "No-op callback pattern: pass () => {} for visual-only toggle state"
  - "Optimistic update with prev snapshot rollback on tRPC mutations"

requirements-completed: [TRACK-06, TRACK-07, TRACK-08, TRACK-09, TRACK-10]

duration: 5min
completed: 2026-03-19
---

# Phase 32 Plan 02: Custom Track Management Frontend Summary

**Track toggle buttons on LessonCard, remove buttons in track view, rebuild dialog with confirmation, optimistic updates and toast feedback via sonner**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T10:23:00Z
- **Completed:** 2026-03-19T10:27:35Z
- **Tasks:** 2 (code) + 1 (checkpoint)
- **Files modified:** 3 (+ 1 created)

## Accomplishments
- LessonCard extended with inTrack/onToggleTrack/onRemoveFromTrack props and conditional button rendering
- All three track mutations wired with optimistic updates (add with custom section creation, remove with filter, rebuild)
- AlertDialog component created (shadcn/ui pattern) for rebuild confirmation
- Custom section purple styling added to SECTION_STYLES
- getRecommendedPath no longer gated by hasDiagnostic (supports custom-only tracks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add track toggle to LessonCard and custom section style** - `95a4e9d` (feat)
2. **Task 2: Wire mutations, optimistic updates, rebuild button, toast feedback** - `677047e` (feat)

## Files Created/Modified
- `apps/web/src/components/ui/alert-dialog.tsx` - New shadcn AlertDialog component (radix-based)
- `apps/web/src/components/learning/LessonCard.tsx` - Toggle (+/checkmark) and remove (X) buttons with conditional rendering
- `apps/web/src/app/(main)/learn/page.tsx` - Three mutations with optimistic updates, rebuild dialog, toast notifications, custom section style

## Decisions Made
- getRecommendedPath always fetched (removed `enabled: hasDiagnostic === true`) to support users who add lessons to track without completing diagnostic first
- Checkmark in courses view uses no-op `() => {}` callback so the button renders visually but does not trigger remove (per design: remove only from track view)
- CTA "Пройди диагностику" banner only shown when `hasDiagnostic === false && !recommendedPath` (previously showed whenever no diagnostic)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AlertDialog component did not exist**
- **Found during:** Task 1 (before edits)
- **Issue:** Plan assumed AlertDialog shadcn component existed but it was not installed
- **Fix:** Installed @radix-ui/react-alert-dialog, created apps/web/src/components/ui/alert-dialog.tsx
- **Files modified:** apps/web/package.json, apps/web/src/components/ui/alert-dialog.tsx
- **Verification:** TypeScript compilation passes, component renders correctly
- **Committed in:** 95a4e9d (Task 1 commit)

**2. [Rule 1 - Bug] getRecommendedPath gated by hasDiagnostic blocked custom-only tracks**
- **Found during:** Task 2 (wiring mutations)
- **Issue:** Query had `enabled: hasDiagnostic === true` preventing users without diagnostic from seeing their custom track
- **Fix:** Removed enabled condition, query always runs for authenticated users
- **Committed in:** 677047e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both essential for correct functionality. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full track management UI complete pending human verification (Task 3 checkpoint)
- All mutations compile and integrate with Plan 01 backend

---
*Phase: 32-custom-track-management*
*Completed: 2026-03-19*
