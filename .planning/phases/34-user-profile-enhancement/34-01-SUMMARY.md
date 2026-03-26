---
phase: 34-user-profile-enhancement
plan: 01
subsystem: api
tags: [supabase-storage, tRPC, prisma, avatar, profile, rls]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: UserProfile model with name and avatarUrl fields
provides:
  - Supabase Storage 'avatars' bucket SQL with RLS policies
  - tRPC getAvatarUploadUrl and deleteAvatar procedures
  - OAuth name copy on first profile.get
  - UserNav refactored to use UserProfile as data source
affects: [34-02-avatar-upload-ui, 35-lesson-comments]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side profile fetch in layout, profile-based UserNav props]

key-files:
  created:
    - scripts/sql/create_avatars_bucket.sql
  modified:
    - packages/api/src/routers/profile.ts
    - apps/web/src/app/(main)/layout.tsx
    - apps/web/src/components/shared/user-nav.tsx

key-decisions:
  - "Direct Prisma query in layout (not tRPC server caller) for profile fetch — faster, follows admin layout pattern"
  - "Public bucket for avatars — avatars not secret, avoids signed URL complexity"
  - "OAuth name copy is one-time in profile.get — transparent, no migration needed"

patterns-established:
  - "Profile-based UserNav: layout fetches UserProfile, passes name/avatarUrl to UserNav"
  - "Avatar path convention: avatars/{userId}/{timestamp}.webp for cache busting"

requirements-completed: [PROF-01, PROF-04]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 34 Plan 01: Backend Foundation Summary

**Supabase Storage avatars bucket with RLS, tRPC upload/delete endpoints, and UserNav refactored to use UserProfile as single data source**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T07:51:08Z
- **Completed:** 2026-03-26T07:55:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- SQL script for Supabase Storage `avatars` bucket with 4 RLS policies (INSERT, UPDATE, DELETE, SELECT)
- tRPC `getAvatarUploadUrl` (path generation) and `deleteAvatar` (with ownership check) procedures
- OAuth name copy in `profile.get` — one-time sync of Yandex/OAuth display name into UserProfile
- UserNav and layout refactored: data source is now UserProfile (Prisma) instead of Supabase user_metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Supabase Storage bucket SQL + tRPC profile enhancements** - `3bcb88a` (feat)
2. **Task 2: Refactor layout and UserNav to use UserProfile** - `33aa504` (refactor)

## Files Created/Modified
- `scripts/sql/create_avatars_bucket.sql` - SQL for avatars bucket creation + 4 RLS policies
- `packages/api/src/routers/profile.ts` - getAvatarUploadUrl, deleteAvatar, OAuth name copy
- `apps/web/src/app/(main)/layout.tsx` - Prisma profile fetch, passes profile data to UserNav
- `apps/web/src/components/shared/user-nav.tsx` - Interface changed to accept name/avatarUrl directly

## Decisions Made
- Direct Prisma query in layout (not tRPC server caller) for profile fetch — faster, follows existing admin layout pattern
- Public bucket for avatars — avatars are not secret, avoids signed URL complexity
- OAuth name copy is one-time in profile.get — transparent, no separate migration needed
- Fallback chain: profile.name -> OAuth metadata -> email prefix -> default "Пользователь"

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**SQL script must be run manually in Supabase SQL Editor:**
- Run `scripts/sql/create_avatars_bucket.sql` to create the `avatars` bucket with RLS policies
- This creates the Supabase Storage bucket required for avatar upload functionality in Plan 02

## Next Phase Readiness
- Backend infrastructure ready for Plan 02 (avatar upload UI + profile completeness banner)
- SQL script needs to be run in Supabase before avatar uploads will work
- UserNav already accepts avatarUrl — will display avatars as soon as they're uploaded

---
*Phase: 34-user-profile-enhancement*
*Completed: 2026-03-26*
