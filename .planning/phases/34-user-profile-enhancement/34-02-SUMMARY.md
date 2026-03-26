---
phase: 34-user-profile-enhancement
plan: 02
subsystem: ui
tags: [avatar, supabase-storage, canvas-resize, profile, dashboard-banner]

# Dependency graph
requires:
  - phase: 34-user-profile-enhancement
    provides: tRPC getAvatarUploadUrl/deleteAvatar, UserNav with avatarUrl, avatars bucket SQL
provides:
  - Avatar upload UI with client-side resize to 256x256 webp
  - Profile completeness banner on dashboard
  - Account info card shows avatar
affects: [35-lesson-comments]

# Tech tracking
tech-stack:
  added: []
  patterns: [canvas API client-side image resize, Supabase Storage browser upload]

key-files:
  created: []
  modified:
    - apps/web/src/app/(main)/profile/page.tsx
    - apps/web/src/app/(main)/dashboard/page.tsx

key-decisions:
  - "Client-side canvas resize (no external lib) — 256x256 square crop from center, webp 0.85 quality"
  - "next/image with unoptimized for avatar display — Supabase Storage public URLs"
  - "Avatar path extraction from public URL via regex for delete flow"

patterns-established:
  - "Avatar upload pattern: file input -> validate -> canvas resize -> Storage upload -> tRPC update -> refetch"
  - "Profile completeness banner: reactive to profile.name via tRPC query, auto-disappears"

requirements-completed: [PROF-02, PROF-03]

# Metrics
duration: 3min
completed: 2026-03-26
---

# Phase 34 Plan 02: Frontend Avatar Upload & Profile Completeness Summary

**Client-side avatar upload with canvas resize to 256x256 webp on profile page, plus reactive profile completeness banner on dashboard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T07:58:55Z
- **Completed:** 2026-03-26T08:02:14Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Avatar upload section on profile page with 96px circular preview, file size/type validation, canvas resize to 256x256 webp, Supabase Storage upload, and delete with toast feedback
- Profile completeness banner on dashboard — blue banner with person icon shown when name is null, links to /profile, disappears reactively when name is filled
- Account info card in profile right column now shows avatar image instead of just initials

## Task Commits

Each task was committed atomically:

1. **Task 1: Avatar upload section on profile page** - `ac906fa` (feat)
2. **Task 2: Profile completeness banner on dashboard** - `7e537d1` (feat)

## Files Created/Modified
- `apps/web/src/app/(main)/profile/page.tsx` - Avatar upload section (resize, upload, delete, preview), account card avatar display
- `apps/web/src/app/(main)/dashboard/page.tsx` - Profile completeness banner when name is null

## Decisions Made
- Client-side canvas resize with no external library — canvas API is sufficient for 256x256 square crop
- next/image with `unoptimized` flag for avatar display — Supabase Storage public URLs don't need Next.js image optimization
- Extract avatar storage path from public URL via regex (`/avatars/(.+)$`) for delete flow

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**SQL script must be run manually in Supabase SQL Editor (from Plan 01):**
- Run `scripts/sql/create_avatars_bucket.sql` to create the `avatars` bucket with RLS policies
- Without this, avatar uploads will fail with storage permission errors

## Known Stubs

None - all functionality is fully wired.

## Next Phase Readiness
- Phase 34 (User Profile Enhancement) fully complete
- Avatar upload and display working end-to-end (pending bucket creation in Supabase)
- Profile completeness banner guides new users to fill their profile

---
*Phase: 34-user-profile-enhancement*
*Completed: 2026-03-26*
