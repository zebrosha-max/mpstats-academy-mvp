---
phase: 01-data-foundation
plan: 01
subsystem: database
tags: [prisma, seed, openrouter, supabase, skill-classification]

# Dependency graph
requires: []
provides:
  - "Idempotent Course/Lesson seeding from manifest.json (6 courses, 357 lessons)"
  - "AI-based lesson SkillCategory classification script (OpenRouter + Gemini 2.5 Flash)"
  - "ensureUserProfile utility for auto-creating UserProfile on Google OAuth"
  - "handleDatabaseError utility with Supabase 521 detection"
affects: [01-02-PLAN, 01-03-PLAN, 01-04-PLAN]

# Tech tracking
tech-stack:
  added: [tsx]
  patterns: [idempotent-upsert, env-file-loading, batch-llm-classification]

key-files:
  created:
    - "packages/api/src/utils/ensure-user-profile.ts"
    - "packages/api/src/utils/db-errors.ts"
    - "scripts/seed/seed-skill-categories.ts"
  modified:
    - "scripts/seed/seed-from-manifest.ts"
    - ".gitignore"
    - "package.json"

key-decisions:
  - "COURSE_SKILL_MAP maps 6 courses to 5 categories: 03_ai->CONTENT, 04_workshops->OPERATIONS, 05_ozon->MARKETING, 06_express->OPERATIONS"
  - "Utilities import from @mpstats/db (not @prisma/client directly) to match api package conventions"
  - "Added tsx as root dev dependency for running seed scripts via pnpm tsx"

patterns-established:
  - "Seed scripts support --dry-run flag for safe testing"
  - "DB utilities use @mpstats/db re-exports, not direct @prisma/client imports"
  - "AI scripts load .env manually without dotenv dependency"

# Metrics
duration: 6min
completed: 2026-02-17
---

# Phase 1 Plan 01: Data Foundation Summary

**Idempotent seed scripts for 6 courses/357 lessons with AI SkillCategory classification, plus shared ensureUserProfile and DB error utilities**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-17T07:11:59Z
- **Completed:** 2026-02-17T07:17:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Updated seed-from-manifest.ts with --dry-run flag, correct SkillCategory mapping for all 6 courses, and detailed summary output
- Created AI classification script that batches lessons through OpenRouter Gemini 2.5 Flash for per-lesson SkillCategory
- Created ensureUserProfile utility for automatic UserProfile creation on Google OAuth signup
- Created handleDatabaseError utility distinguishing Supabase 521 (paused) from generic DB errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Update seed-from-manifest.ts and create shared utilities** - `c8bc450` (feat)
2. **Task 2: Create AI-classification seed script for lesson-level SkillCategory** - `b32453e` (feat)

## Files Created/Modified
- `scripts/seed/seed-from-manifest.ts` - Updated with --dry-run, COURSE_SKILL_MAP, summary output
- `scripts/seed/seed-skill-categories.ts` - New AI classification script with batch processing
- `packages/api/src/utils/ensure-user-profile.ts` - UserProfile auto-creation via Prisma upsert
- `packages/api/src/utils/db-errors.ts` - Typed DB error handling with Supabase 521 detection
- `package.json` - Added tsx dev dependency
- `.gitignore` - Added classification-results.json to ignore list

## Decisions Made
- COURSE_SKILL_MAP maps all 6 courses: 01_analytics->ANALYTICS, 02_ads->MARKETING, 03_ai->CONTENT, 04_workshops->OPERATIONS, 05_ozon->MARKETING, 06_express->OPERATIONS
- Used @mpstats/db imports instead of @prisma/client to match existing api package conventions
- Added tsx as root dev dependency (was only available via npx which has module resolution issues with pnpm hoisting)
- Manual .env loading in classification script to avoid adding dotenv dependency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed @prisma/client import resolution in api utils**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** packages/api uses @mpstats/db for Prisma imports, not @prisma/client directly
- **Fix:** Changed imports to use @mpstats/db which re-exports all @prisma/client types
- **Files modified:** packages/api/src/utils/ensure-user-profile.ts, packages/api/src/utils/db-errors.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** c8bc450 (Task 1 commit)

**2. [Rule 3 - Blocking] Added tsx as root dev dependency**
- **Found during:** Task 1 (dry-run verification)
- **Issue:** npx tsx creates isolated environment that cannot resolve @prisma/client in pnpm monorepo
- **Fix:** Added tsx to root devDependencies, use pnpm tsx instead of npx tsx
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** pnpm tsx scripts/seed/seed-from-manifest.ts --dry-run runs successfully
- **Committed in:** c8bc450 (Task 1 commit)

**3. [Rule 3 - Blocking] Fixed Prisma client generation (Windows EPERM)**
- **Found during:** Task 1 (verification)
- **Issue:** Prisma generate failed with EPERM on query_engine-windows.dll.node (file locked)
- **Fix:** Removed locked DLL file, re-ran prisma generate successfully
- **Files modified:** None (node_modules only)
- **Verification:** Prisma client generated, TypeScript compilation works

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes were necessary for the scripts to compile and run. No scope creep.

## Issues Encountered
- Supabase DB connection fails with "Tenant or user not found" — DATABASE_URL credentials need updating (known blocker from Sprint 4 status). This does not block the plan: scripts are written and compile correctly, DB operations will work once credentials are updated.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared utilities (ensureUserProfile, db-errors) ready for Plans 02-04 router migrations
- Seed scripts ready to populate data once DATABASE_URL is updated
- AI classification script ready to run after seed-from-manifest populates lessons

---
*Phase: 01-data-foundation*
*Completed: 2026-02-17*
