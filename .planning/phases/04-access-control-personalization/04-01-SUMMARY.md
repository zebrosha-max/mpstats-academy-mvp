---
phase: 04-access-control-personalization
plan: 01
subsystem: api, ui
tags: [trpc, prisma, soft-gating, learning-path, diagnostic]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Prisma models (DiagnosticSession, LearningPath, Lesson, SkillProfile)"
  - phase: 02-ai-question-generation
    provides: "AI-powered diagnostic sessions that produce SkillProfile"
provides:
  - "hasCompletedDiagnostic tRPC query for gating checks"
  - "generateFullRecommendedPath helper for building personalized path"
  - "LearningPath.lessons persistence on diagnostic completion"
  - "getRecommendedPath tRPC query with ordered lessons and progress"
  - "DiagnosticGateBanner component for lesson page gating"
affects: [04-02-PLAN, learn-page, diagnostic-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: ["soft content gating via tRPC query + conditional rendering", "path generation from SkillProfile weakness analysis"]

key-files:
  created:
    - "apps/web/src/components/learning/DiagnosticGateBanner.tsx"
  modified:
    - "packages/api/src/routers/diagnostic.ts"
    - "packages/api/src/routers/learning.ts"
    - "apps/web/src/app/(main)/learn/[id]/page.tsx"

key-decisions:
  - "Gate defaults to showing content while diagnostic status loads (no flash of lock)"
  - "Weak categories threshold is score < 50 for recommended path generation"
  - "Path is regenerated on every diagnostic completion (including re-takes) via upsert"

patterns-established:
  - "Soft gating: check boolean query, show gate banner when false, show content when true/undefined"
  - "Path generation: sort categories by weakness, collect all lessons from weak categories"

requirements-completed: [ACCESS-01, ACCESS-03]

# Metrics
duration: 2min
completed: 2026-02-25
---

# Phase 04 Plan 01: Soft Content Gating Summary

**Soft content gating on lesson pages with diagnostic gate banner and recommended path persistence on diagnostic completion**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-25T11:46:44Z
- **Completed:** 2026-02-25T11:48:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- hasCompletedDiagnostic query checks if user has any COMPLETED diagnostic session
- generateFullRecommendedPath builds lesson list from categories with score < 50, ordered by weakness
- submitAnswer now persists full recommended path to LearningPath.lessons on completion
- getRecommendedPath returns ordered lessons with progress data and completion stats
- DiagnosticGateBanner shows motivating lock screen with CTA to /diagnostic
- Lesson page conditionally gates video+summary+chat while keeping title/breadcrumb/badge visible

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backend endpoints and path generation logic** - `3bcf044` (feat)
2. **Task 2: Create DiagnosticGateBanner and wire lesson page gating** - `943cfdb` (feat)

## Files Created/Modified
- `packages/api/src/routers/diagnostic.ts` - hasCompletedDiagnostic query, generateFullRecommendedPath helper, path persistence in submitAnswer
- `packages/api/src/routers/learning.ts` - getRecommendedPath query with ordered lessons and progress
- `apps/web/src/components/learning/DiagnosticGateBanner.tsx` - Gate banner component with lock icon and CTA
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - Conditional rendering based on diagnostic status

## Decisions Made
- Gate defaults to showing content while diagnostic status loads (hasDiagnostic === false, not !hasDiagnostic) to avoid flash of lock banner
- Weak categories threshold is score < 50 for path generation
- Path regenerated on every diagnostic completion via upsert (supports re-takes)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend endpoints ready for 04-02 (My Track tab on /learn page)
- getRecommendedPath provides all data needed for track view and recommendation badges
- DiagnosticGateBanner pattern can be reused for other gating scenarios

---
*Phase: 04-access-control-personalization*
*Completed: 2026-02-25*
