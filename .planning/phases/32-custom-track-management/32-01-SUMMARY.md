---
phase: 32-custom-track-management
plan: 01
subsystem: api
tags: [trpc, prisma, learning-path, custom-track]

requires:
  - phase: 23-diagnostic-2
    provides: "SectionedLearningPath type, generateSectionedPath function, parseLearningPath"
provides:
  - "addToTrack, removeFromTrack, rebuildTrack tRPC mutations"
  - "Custom section preservation on diagnostic completion"
  - "LearningPathSection 'custom' id and addedAt field"
affects: [32-02-frontend, learning, diagnostic]

tech-stack:
  added: []
  patterns: ["custom section preservation on path regeneration", "pluralLessons Russian pluralization helper"]

key-files:
  created: []
  modified:
    - packages/shared/src/types/index.ts
    - packages/api/src/routers/learning.ts
    - packages/api/src/routers/diagnostic.ts

key-decisions:
  - "findUnique for SkillProfile by userId (not sessionId — field does not exist on model)"
  - "Custom section kept even if empty on removeFromTrack (UX: preserve user intent)"
  - "Flat path format converted to sectioned on addToTrack (forward migration)"

patterns-established:
  - "Custom section always first in sections array (unshift pattern)"
  - "Deduplicate custom lesson IDs from AI sections on any path regeneration"

requirements-completed: [TRACK-01, TRACK-02, TRACK-03, TRACK-04, TRACK-05]

duration: 4min
completed: 2026-03-19
---

# Phase 32 Plan 01: Custom Track Management Backend Summary

**Three tRPC mutations (addToTrack/removeFromTrack/rebuildTrack) with custom section type extension and diagnostic completion preservation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T10:18:09Z
- **Completed:** 2026-03-19T10:22:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended LearningPathSection type with 'custom' id and addedAt timestamp field
- Added three tRPC mutations for manual track management: add, remove, rebuild
- Modified diagnostic completion to preserve custom section when regenerating AI path
- Exported generateSectionedPath for reuse by rebuildTrack mutation

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend types and add tRPC mutations** - `6178a18` (feat)
2. **Task 2: Preserve custom section on diagnostic completion** - `be5f01b` (feat)

## Files Created/Modified
- `packages/shared/src/types/index.ts` - Added 'custom' to LearningPathSection id union, addedAt field
- `packages/api/src/routers/learning.ts` - Three new mutations: addToTrack, removeFromTrack, rebuildTrack + pluralLessons helper
- `packages/api/src/routers/diagnostic.ts` - Custom section preservation before upsert, export generateSectionedPath, import parseLearningPath

## Decisions Made
- Used findUnique by userId for SkillProfile (plan specified sessionId which does not exist on the model)
- Custom section preserved even when empty on removeFromTrack to maintain user intent
- Flat path format automatically converted to sectioned format on addToTrack (forward migration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SkillProfile query used non-existent sessionId field**
- **Found during:** Task 1 (rebuildTrack mutation)
- **Issue:** Plan specified `skillProfile.findFirst({ where: { sessionId } })` but SkillProfile model has userId @unique, no sessionId
- **Fix:** Changed to `skillProfile.findUnique({ where: { userId: ctx.user.id } })`
- **Files modified:** packages/api/src/routers/learning.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 6178a18 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend mutations ready for frontend integration (Plan 32-02)
- All three mutations compile and handle edge cases: no path, flat path, sectioned path, duplicates, empty sections

---
*Phase: 32-custom-track-management*
*Completed: 2026-03-19*
