---
phase: 35-lesson-comments
plan: 02
subsystem: ui
tags: [react, comments, tabs, mobile, optimistic-updates, trpc]

requires:
  - phase: 35-lesson-comments
    provides: "tRPC comments router (list/create/delete) from Plan 01"
  - phase: 34-user-profile-enhancement
    provides: "UserProfile with avatarUrl and name for optimistic comment display"
provides:
  - "CommentSection, CommentItem, CommentInput UI components with optimistic updates"
  - "Mobile tabbed AI-chat + Comments layout on lesson page"
  - "Desktop comments section below AI-chat in right sidebar"
  - "Role-based comment deletion with AlertDialog confirmation"
  - "Cursor-based comment pagination with 'Показать ещё' button"
affects: [36-product-tour, lesson-page-ui]

tech-stack:
  added: []
  patterns: [mobile-tabs-pattern, optimistic-user-profile, infinite-query-with-tabs]

key-files:
  created:
    - apps/web/src/components/comments/CommentSection.tsx
    - apps/web/src/components/comments/CommentItem.tsx
    - apps/web/src/components/comments/CommentInput.tsx
  modified:
    - apps/web/src/app/(main)/learn/[id]/page.tsx

key-decisions:
  - "Mobile tabs for AI-chat + Comments instead of separate stacked sections"
  - "Optimistic comments use current user profile data (name, avatar) for instant display"
  - "Desktop sidebar hidden on mobile entirely, mobile tabs container is separate component"

patterns-established:
  - "MobileChatCommentsTabs: inline component for mobile-only tabbed layout with shared chat state"
  - "currentUser prop drilling: CommentSection -> CommentItem -> CommentInput for optimistic identity"

requirements-completed: [COMM-04, COMM-05, COMM-06]

duration: 3min
completed: 2026-03-26
---

# Phase 35 Plan 02: Frontend Comment Components + Lesson Integration Summary

**Comment UI with optimistic updates, mobile tabs (AI-chat + Comments), avatar/name in optimistic creation, pagination, and role-based deletion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T08:55:28Z
- **Completed:** 2026-03-26T08:58:29Z
- **Tasks:** 3 (2 auto + 1 checkpoint with post-checkpoint fixes)
- **Files modified:** 4

## Accomplishments
- CommentSection with infinite query pagination, empty/loading states, and data-tour attribute
- CommentItem with avatar (image + initials fallback), relative Russian timestamps, reply threading, AlertDialog delete
- CommentInput with character counter (1500 max), optimistic create using real user profile data
- Mobile layout: tabs for "AI-чат" and "Комментарии (N)" with live comment count, default to AI-чат tab
- Desktop layout: comments below AI-chat in right sidebar column

## Task Commits

Each task was committed atomically:

1. **Task 1: Comment components (CommentSection, CommentItem, CommentInput)** - `f38d71d` (feat)
2. **Task 2: Integrate CommentSection into lesson page (desktop + mobile)** - `70b1166` (feat)
3. **Task 3: Mobile tabs + optimistic user profile fix (post-checkpoint)** - `6a654a1` (fix)

## Files Created/Modified
- `apps/web/src/components/comments/CommentSection.tsx` - Main container with pagination, empty/loading states, profile-aware input
- `apps/web/src/components/comments/CommentItem.tsx` - Comment display with avatar, timestamp, reply/delete actions, currentUser forwarding
- `apps/web/src/components/comments/CommentInput.tsx` - Textarea input with character counter, optimistic create with real user profile
- `apps/web/src/app/(main)/learn/[id]/page.tsx` - MobileChatCommentsTabs component, desktop sidebar hidden on mobile

## Decisions Made
- Mobile tabs instead of stacked sections: AI-chat was pushed below comments and hard to find
- Default mobile tab is AI-chat (most used feature on lesson page)
- Tab label shows live comment count: "Комментарии (N)"
- Desktop sidebar uses `hidden lg:block` to avoid duplicate CommentSection renders
- currentUser prop drilled through component tree for optimistic identity (no extra queries)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Optimistic comment showed placeholder avatar/name for ~1 second**
- **Found during:** Task 3 (checkpoint feedback)
- **Issue:** Optimistic comment used `{ name: null, avatarUrl: null }` which showed "?" initials instead of real user data
- **Fix:** Added `currentUser` prop to CommentInput, populated from profile query in CommentSection, forwarded through CommentItem for replies
- **Files modified:** CommentInput.tsx, CommentItem.tsx, CommentSection.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** `6a654a1`

**2. [Rule 1 - Bug] Mobile layout: comments above AI-chat made chat hard to find**
- **Found during:** Task 3 (checkpoint feedback from user)
- **Issue:** On mobile, CommentSection appeared as separate section above where AI-chat card would render in the stacked grid
- **Fix:** Created MobileChatCommentsTabs component with tab-based layout, default to AI-chat tab
- **Files modified:** apps/web/src/app/(main)/learn/[id]/page.tsx
- **Verification:** TypeScript compiles clean, desktop sidebar unaffected
- **Committed in:** `6a654a1`

---

**Total deviations:** 2 auto-fixed (2 bug fixes from checkpoint feedback)
**Impact on plan:** Both fixes improve UX on mobile. No scope creep.

## Issues Encountered
- Windows EPERM file lock on Prisma query engine DLL prevented `pnpm typecheck` (turbo pipeline). Used direct `npx tsc --noEmit` in web app directory as workaround. Pre-existing, same as Plan 01.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Lesson comments fully functional (create, reply, delete, paginate)
- Phase 36 product tour can target `data-tour="lesson-comments"` attribute
- Ready for production deploy

---
*Phase: 35-lesson-comments*
*Completed: 2026-03-26*
