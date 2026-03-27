---
phase: 39-ai-content-quality
plan: 02
subsystem: database
tags: [prisma, dedup, scripts, maintenance]

requires:
  - phase: 39-ai-content-quality
    provides: "Phase context — R35 duplicate lessons bug"
provides:
  - "One-time dedup script for duplicate lessons by videoId"
  - "Safe progress/comment transfer with unique constraint handling"
affects: []

tech-stack:
  added: []
  patterns:
    - "Standalone Prisma script with dry-run/execute CLI pattern"
    - "@@unique conflict resolution via findUnique check before update"

key-files:
  created:
    - scripts/dedup-lessons.ts
  modified: []

key-decisions:
  - "Keep lesson with lowest order when duplicates found"
  - "Transfer LessonProgress with @@unique conflict check (delete if conflict, update if not)"
  - "Transfer LessonComment via updateMany (no unique constraint)"

patterns-established:
  - "Dedup script pattern: dry-run default, --execute flag for mutations"

requirements-completed: [R35]

duration: 1min
completed: 2026-03-27
---

# Phase 39 Plan 02: Lesson Dedup Script Summary

**One-time dedup script that finds duplicate lessons by videoId, keeps lowest-order lesson, and safely transfers progress/comments with unique constraint handling**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-27T10:22:33Z
- **Completed:** 2026-03-27T10:23:54Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `scripts/dedup-lessons.ts` with dry-run (default) and --execute modes
- Handles @@unique([pathId, lessonId]) constraint on LessonProgress via findUnique check
- Transfers LessonComment records via safe updateMany
- Verified against production DB: no duplicates currently present (database is clean)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dedup-lessons.ts script** - `1989245` (feat)

## Files Created/Modified
- `scripts/dedup-lessons.ts` - One-time dedup script with dry-run and execute modes

## Decisions Made
- Keep lesson with lowest `order` value when duplicates found (first in course sequence)
- LessonProgress transfer: check for existing record on keep lesson before update to avoid @@unique violation
- LessonComment transfer: simple updateMany (no unique constraint to worry about)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Script ran successfully in dry-run mode against production DB — no duplicate lessons currently exist. The script is ready for use if duplicates are re-introduced by future seeding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Dedup script ready for manual execution when needed
- Database currently clean (0 duplicates found)

---
*Phase: 39-ai-content-quality*
*Completed: 2026-03-27*
