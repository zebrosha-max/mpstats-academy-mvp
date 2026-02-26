---
phase: 10-superuser-admin-panel
plan: 01
subsystem: auth, admin
tags: [prisma, trpc, admin-panel, rbac, supabase, next-app-router]

# Dependency graph
requires:
  - phase: 01-data-foundation
    provides: "Prisma schema with UserProfile model"
provides:
  - "isAdmin and isActive boolean fields on UserProfile"
  - "adminProcedure for tRPC (FORBIDDEN for non-admins)"
  - "Admin tRPC router with 5 procedures (getDashboardStats, getUsers, toggleUserField, getCourses, updateLessonOrder)"
  - "(admin) route group with isAdmin layout guard"
  - "AdminSidebar component with navigation"
affects: [10-02-admin-pages, admin-dashboard, user-management, content-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [adminProcedure extends protectedProcedure, (admin) route group with server-side isAdmin check, email search via Supabase Admin API]

key-files:
  created:
    - "packages/api/src/routers/admin.ts"
    - "apps/web/src/app/(admin)/layout.tsx"
    - "apps/web/src/app/(admin)/admin/page.tsx"
    - "apps/web/src/components/admin/AdminSidebar.tsx"
  modified:
    - "packages/db/prisma/schema.prisma"
    - "packages/api/src/trpc.ts"
    - "packages/api/src/root.ts"
    - "apps/web/src/middleware.ts"

key-decisions:
  - "AdminSidebar uses lucide-react icons (already in web deps) instead of inline SVGs"
  - "Email search in getUsers uses Supabase Admin API (service role) since emails live in auth.users not UserProfile"
  - "Added isActive field alongside isAdmin to avoid future migration"

patterns-established:
  - "adminProcedure: extend protectedProcedure with DB-level isAdmin check"
  - "(admin) route group: server component layout queries UserProfile.isAdmin, redirects non-admins to /dashboard"

requirements-completed: [ADMIN-06, ADMIN-07]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 10 Plan 01: Admin Infrastructure Summary

**Admin panel foundation with isAdmin/isActive schema fields, adminProcedure for tRPC authorization, admin router with 5 endpoints, and (admin) route group with layout-level isAdmin guard**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T13:23:27Z
- **Completed:** 2026-02-26T13:27:55Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- isAdmin and isActive boolean fields added to UserProfile schema (pushed to Supabase)
- adminProcedure created in tRPC — queries UserProfile.isAdmin, throws FORBIDDEN for non-admins
- Admin tRPC router with getDashboardStats, getUsers (with email search via Supabase Admin API), toggleUserField, getCourses, updateLessonOrder
- (admin) route group with server-side layout guard and AdminSidebar navigation component

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isAdmin to Prisma schema + create adminProcedure + admin tRPC router** - `ada94e8` (feat)
2. **Task 2: Create (admin) route group with layout guard + admin sidebar + middleware protection** - `d943667` (feat)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added isAdmin and isActive boolean fields to UserProfile
- `packages/api/src/trpc.ts` - Added adminProcedure (extends protectedProcedure with isAdmin check)
- `packages/api/src/routers/admin.ts` - New admin router with 5 endpoints
- `packages/api/src/root.ts` - Registered adminRouter in appRouter
- `apps/web/src/middleware.ts` - Added /admin to protected routes
- `apps/web/src/app/(admin)/layout.tsx` - Admin layout with isAdmin guard (redirect to /dashboard)
- `apps/web/src/app/(admin)/admin/page.tsx` - Placeholder admin dashboard page
- `apps/web/src/components/admin/AdminSidebar.tsx` - Admin sidebar with nav links and "Back to app"

## Decisions Made
- Used lucide-react icons for AdminSidebar (already available in web app deps) instead of inline SVGs
- Email search in getUsers uses Supabase Admin API (`auth.admin.listUsers()`) with service role key, since email is in auth.users not UserProfile. Gracefully falls back to name-only search if service key is missing.
- Added isActive field to schema alongside isAdmin to preempt future migration for user deactivation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Prisma generate failed due to Windows EPERM (query_engine DLL locked by node processes). Resolved by deleting the locked DLL file and retrying generate.
- Global `npx prisma` picked up Prisma 7.x (incompatible with schema). Used `packages/db`-local Prisma 5.22 instead.

## User Setup Required

For email search in admin panel to work, `SUPABASE_SERVICE_ROLE_KEY` environment variable must be set. Without it, user search falls back to name-only search.

## Next Phase Readiness
- Admin infrastructure complete — Plan 02 can build admin dashboard, user management, and content management pages
- All admin pages will use the (admin) route group and adminProcedure

---
*Phase: 10-superuser-admin-panel*
*Completed: 2026-02-26*
