---
phase: 40-navigation-filters
plan: 02
subsystem: api, auth, ui
tags: [comments, oauth, yandex, kinescope, privacy, ux]

requires:
  - phase: 35-lesson-comments
    provides: comments router with user name field
  - phase: 17-yandex-oauth
    provides: YandexProvider OAuth class
provides:
  - Email-safe comment author names (server-side sanitization)
  - Yandex OAuth prompt=login for account selection
  - No-autoplay video resume behavior
affects: [comments, auth, video-player]

tech-stack:
  added: []
  patterns:
    - "sanitizeUserName helper strips email-like names before API response"

key-files:
  created: []
  modified:
    - packages/api/src/routers/comments.ts
    - apps/web/src/lib/auth/oauth-providers.ts
    - apps/web/src/components/video/KinescopePlayer.tsx

key-decisions:
  - "Server-side email sanitization (not frontend) to prevent any leak path"
  - "prompt=login forces Yandex account chooser on every login"
  - "Remove pl.play() only from initialTime branch, keep in pendingSeek (explicit user action)"

patterns-established:
  - "sanitizeUserName: null-out email-like names server-side before tRPC response"

requirements-completed: [R43, R10, R22]

duration: 3min
completed: 2026-03-27
---

# Phase 40 Plan 02: Navigation/UX Bugfixes Summary

**Server-side email guard on comments, Yandex OAuth prompt=login, and no-autoplay on video resume**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T11:44:12Z
- **Completed:** 2026-03-27T11:47:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Comments never expose email addresses as author name (sanitized server-side)
- Yandex OAuth forces account selection screen on every login attempt
- Video seeks to saved position without auto-playing on resume

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip email from comments + Yandex prompt=login + remove autoplay on resume** - `83ae6c9` (fix)

## Files Created/Modified
- `packages/api/src/routers/comments.ts` - Added sanitizeUserName helper, applied to list and create responses
- `apps/web/src/lib/auth/oauth-providers.ts` - Added prompt: 'login' to Yandex OAuth URL params
- `apps/web/src/components/video/KinescopePlayer.tsx` - Removed pl.play() from initialTime resume branch

## Decisions Made
- Server-side email sanitization (not frontend) to prevent any leak path -- even if new UI consumers appear, they get clean data
- prompt=login forces Yandex account chooser on every login -- users can switch accounts
- Remove pl.play() only from initialTime branch, keep in pendingSeek (explicit user timecode click action)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in landing.spec.ts (unrelated to our changes) -- ignored as out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three QA audit bugs (R43, R10, R22) fixed
- Ready for deployment

---
*Phase: 40-navigation-filters*
*Completed: 2026-03-27*
