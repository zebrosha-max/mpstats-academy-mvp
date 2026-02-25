---
phase: 07-lesson-course-name-cleanup
plan: 01
subsystem: database
tags: [prisma, data-cleanup, regex, seed-script, ui]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: 405 lessons and 6 courses seeded in Supabase via seed-from-manifest.ts
provides:
  - Cleanup script (dry-run + apply) for lesson/course title cleanup
  - Shared clean-titles module (cleanLessonTitle, cleanModuleDescription, COURSE_NAMES)
  - Seed script updated to produce clean names on re-seed
  - Visual lesson numbering in /learn page from order field
affects: [07-02-production-redeploy]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared scripts/utils module for DRY between cleanup and seed scripts]

key-files:
  created:
    - scripts/cleanup/cleanup-names.ts
    - scripts/utils/clean-titles.ts
  modified:
    - scripts/seed/seed-from-manifest.ts
    - apps/web/src/app/(main)/learn/page.tsx

key-decisions:
  - "Extracted cleanup functions to scripts/utils/clean-titles.ts for DRY between cleanup and seed"
  - "Bare 'N word' prefix preserved (not stripped) when no file extension present -- idempotent cleanup"
  - "First underscore-space pattern in module description replaced with colon separator"
  - "Visual numbering uses lesson.order field, not array index"

patterns-established:
  - "scripts/utils/ for shared utilities between script files"

requirements-completed: [NAMING-01, NAMING-02, NAMING-03, NAMING-04]

# Metrics
duration: 9min
completed: 2026-02-25
---

# Phase 7 Plan 01: Lesson & Course Name Cleanup Summary

**Cleanup script cleaned 405 lesson titles (.mp4, numeric prefixes, underscores), 405 module descriptions, and 6 course names to Russian; seed script updated for regression prevention; visual numbering added to /learn**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-25T15:49:26Z
- **Completed:** 2026-02-25T15:58:27Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- All 405 lesson titles cleaned: no .mp4 extensions, no numeric prefixes, no underscores
- All 405 lesson descriptions cleaned: "Modul: Modul N_" prefix removed, colon separators added
- All 6 courses have clean Russian titles and descriptions (hardcoded map)
- Seed script uses cleanLessonTitle() and cleanModuleDescription() to prevent regression
- Lesson cards in /learn show visual numbering from order field (e.g., "1. SEO-optimizaciya")

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cleanup-names.ts script with dry-run mode** - `76f024d` (feat)
2. **Task 2: Update seed-from-manifest.ts with cleanTitle functions** - `28ea488` (feat)
3. **Task 3: Add visual lesson numbering in learn page** - `6758378` (feat)

## Files Created/Modified
- `scripts/cleanup/cleanup-names.ts` - One-time cleanup script with --dry-run/--apply flags
- `scripts/utils/clean-titles.ts` - Shared module: cleanLessonTitle, cleanModuleDescription, COURSE_NAMES
- `scripts/seed/seed-from-manifest.ts` - Updated to use clean title functions for future seeds
- `apps/web/src/app/(main)/learn/page.tsx` - Visual lesson numbering in courses and track views

## Decisions Made
- Extracted cleanup functions to shared `scripts/utils/clean-titles.ts` module (DRY over inlining in both scripts)
- Bare "N word" prefix (e.g., "3 sposobov") is NOT stripped when title has no file extension -- prevents content loss and makes cleanup idempotent
- First `_ ` (underscore + space) in module description becomes `: ` separator (e.g., "Trafik: privlekaem klientov")
- Visual numbering uses `lesson.order` field (not array index) -- consistent with DB ordering

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed non-idempotent numeric prefix regex**
- **Found during:** Task 1 (cleanup-names.ts verification)
- **Issue:** Original regex `^(\d+\.?\d*\.?\s*|m?\d+_)` stripped bare "N " prefix unconditionally, causing titles like "3 sposobov vybora nishi" to lose the meaningful number on second run
- **Fix:** Split into two patterns: (a) strip "N." and "N_" prefixes always, (b) strip bare "N " only when original title had file extension
- **Files modified:** scripts/cleanup/cleanup-names.ts, scripts/utils/clean-titles.ts
- **Verification:** Running cleanup dry-run twice shows 0 changes on second run (idempotent)
- **Committed in:** 28ea488 (Task 2 commit, part of shared module extraction)

**2. [Rule 1 - Bug] Fixed multi-word module description colon separator**
- **Found during:** Task 1 (cleanup-names.ts verification)
- **Issue:** Original regex `^([^\s_]+)_\s*` only matched single-word before underscore, so "Ekonomika prodazh_" missed the colon
- **Fix:** Changed to `/_\s+/` replacing first underscore-space with ": " regardless of word count
- **Files modified:** scripts/cleanup/cleanup-names.ts, scripts/utils/clean-titles.ts
- **Verification:** All multi-word module names now correctly have colon separators
- **Committed in:** 76f024d (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes essential for data correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed regex issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB data is clean, ready for production redeploy (Plan 07-02)
- Redeploy needed to reflect changes on academyal.duckdns.org

---
*Phase: 07-lesson-course-name-cleanup*
*Completed: 2026-02-25*
