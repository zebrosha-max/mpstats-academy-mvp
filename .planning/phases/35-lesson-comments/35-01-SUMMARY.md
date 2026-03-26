---
phase: 35-lesson-comments
plan: 01
subsystem: api
tags: [prisma, trpc, comments, threading, pagination]

requires:
  - phase: 34-user-profile-enhancement
    provides: "UserProfile with avatarUrl and name for comment author display"
provides:
  - "LessonComment Prisma model with self-relation for 1-level threading"
  - "tRPC comments router (list/create/delete) with pagination and role-based deletion"
  - "shadcn textarea component for comment input"
affects: [35-02, lesson-page-ui, admin-moderation]

tech-stack:
  added: [shadcn-textarea]
  patterns: [cursor-pagination, self-relation-threading, role-based-delete]

key-files:
  created:
    - packages/api/src/routers/comments.ts
    - apps/web/src/components/ui/textarea.tsx
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/root.ts

key-decisions:
  - "Plain text comments (not markdown) -- simpler, no XSS surface for short user messages"
  - "Cascade delete on parent removes all replies (per D-09)"
  - "Cursor-based pagination with 20 comments per page"

patterns-established:
  - "Self-relation pattern: CommentReplies relation for parent/replies on same model"
  - "Role-based delete: owner check first, then ADMIN/SUPERADMIN fallback query"

requirements-completed: [COMM-01, COMM-02, COMM-03]

duration: 3min
completed: 2026-03-26
---

# Phase 35 Plan 01: Backend Foundation Summary

**LessonComment Prisma model with self-relation threading, tRPC comments router (list/create/delete) with cursor pagination and ADMIN delete**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T08:27:13Z
- **Completed:** 2026-03-26T08:30:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- LessonComment model with parentId self-relation (CommentReplies) and cascade delete
- Composite index on [lessonId, createdAt DESC] for optimized query
- tRPC comments router: list (cursor pagination, 20/page, with replies + author profiles), create (1-1500 chars, nesting validation), delete (owner or ADMIN/SUPERADMIN)
- shadcn textarea component installed for comment input UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma LessonComment model + shadcn textarea + db push** - `6c2a070` (feat)
2. **Task 2: tRPC comments router with list/create/delete** - `31b8e44` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added LessonComment model with self-relation, indexes, UserProfile relation
- `packages/api/src/routers/comments.ts` - Comments router with list/create/delete endpoints
- `packages/api/src/root.ts` - Registered commentsRouter in appRouter
- `apps/web/src/components/ui/textarea.tsx` - shadcn textarea component

## Decisions Made
- Plain text for comments (not markdown) -- simpler for short user messages, no XSS surface (per D-04 discretion)
- Cascade delete on parent comment removes all replies (per D-09)
- 20 comments per page with cursor-based pagination (standard for this codebase)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
- Windows EPERM file lock on Prisma query engine DLL prevented turbo `typecheck` from running `prisma generate` as build step. Direct `tsc --noEmit` confirmed no type errors in the comments router. The Prisma client was already generated successfully via `pnpm db:generate` earlier.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Backend API ready for 35-02 (frontend CommentSection, CommentItem, CommentInput components)
- `trpc.comments.list/create/delete` endpoints available
- textarea component ready for comment input UI

## Self-Check: PASSED

- [x] packages/api/src/routers/comments.ts -- FOUND
- [x] apps/web/src/components/ui/textarea.tsx -- FOUND
- [x] .planning/phases/35-lesson-comments/35-01-SUMMARY.md -- FOUND
- [x] Commit 6c2a070 (Task 1) -- FOUND
- [x] Commit 31b8e44 (Task 2) -- FOUND
- [x] model LessonComment in schema -- FOUND
- [x] commentsRouter in root.ts -- FOUND

---
*Phase: 35-lesson-comments*
*Completed: 2026-03-26*
