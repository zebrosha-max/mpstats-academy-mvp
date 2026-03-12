---
phase: 20-paywall-content-gating
plan: 01
subsystem: api
tags: [tRPC, prisma, access-control, paywall, subscriptions]

requires:
  - phase: 18-cloudpayments-webhooks
    provides: Subscription model with ACTIVE/CANCELLED status and currentPeriodEnd
  - phase: 16-billing-schema
    provides: FeatureFlag model with isFeatureEnabled utility
provides:
  - checkLessonAccess utility for per-lesson access checks
  - getUserActiveSubscriptions for batch subscription fetching
  - isLessonAccessible pure function for sync access checks
  - Learning router procedures returning locked flag per lesson
  - videoId stripping for locked lessons in tRPC responses
affects: [20-02-frontend-gating, 20-03-track-gating]

tech-stack:
  added: []
  patterns: [access-check-utility, locked-flag-enrichment, videoId-stripping]

key-files:
  created:
    - packages/api/src/utils/access.ts
  modified:
    - packages/api/src/routers/learning.ts
    - packages/shared/src/types/index.ts

key-decisions:
  - "FREE_LESSON_THRESHOLD=2: lessons with order<=2 are always free"
  - "Batch subscription fetch per procedure (not per lesson) for performance"
  - "getRecommendedPath keeps videoId visible (track preview is frontend-only)"

patterns-established:
  - "Access check pattern: getUserActiveSubscriptions once, isLessonAccessible per lesson"
  - "Locked flag enrichment: locked boolean + videoId nullification in tRPC response"

requirements-completed: [PAY-01, PAY-05]

duration: 3min
completed: 2026-03-12
---

# Phase 20 Plan 01: Access Service + Learning Router Gating Summary

**Centralized access utility (checkLessonAccess/isLessonAccessible) with locked flag enrichment and videoId stripping across all learning router procedures**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T11:16:46Z
- **Completed:** 2026-03-12T11:19:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Access utility with 3 exports handling 5 access scenarios (billing_disabled, free_lesson, platform_sub, course_sub, subscription_required)
- All 6 learning router read procedures enriched with locked flag per lesson
- Locked lessons have videoId stripped to null, preventing Kinescope URL extraction

## Task Commits

Each task was committed atomically:

1. **Task 1: Create access utility + update shared types** - `d0ee3be` (feat)
2. **Task 2: Enrich learning router with access checks** - `ba2fcf4` (feat)

## Files Created/Modified
- `packages/api/src/utils/access.ts` - Access check utility (getUserActiveSubscriptions, isLessonAccessible, checkLessonAccess)
- `packages/api/src/routers/learning.ts` - All read procedures enriched with locked flag + videoId stripping
- `packages/shared/src/types/index.ts` - LessonWithProgress.locked optional field added

## Decisions Made
- Batch subscription fetching per procedure call (not per lesson) to minimize DB queries
- getRecommendedPath does NOT strip videoId (track preview gating is frontend-only per plan)
- CANCELLED subscriptions with valid currentPeriodEnd still grant access (grace period)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend access checks complete, ready for frontend gating (Plan 20-02)
- All procedures return locked flag, frontend can render lock overlays
- hasPlatformSubscription available in getLesson and getRecommendedPath for track gating

---
*Phase: 20-paywall-content-gating*
*Completed: 2026-03-12*
