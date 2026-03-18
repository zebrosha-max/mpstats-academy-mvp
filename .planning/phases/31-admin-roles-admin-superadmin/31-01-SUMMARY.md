---
phase: 31-admin-roles-admin-superadmin
plan: 01
subsystem: api
tags: [prisma, trpc, rbac, access-control, admin]

requires:
  - phase: 16-billing-schema
    provides: UserProfile model with isAdmin boolean
provides:
  - Role enum (USER/ADMIN/SUPERADMIN) in Prisma schema
  - superadminProcedure for privileged tRPC operations
  - Admin paywall bypass in checkLessonAccess
  - changeUserRole mutation with self-demotion guard
  - SQL migration script for isAdmin->role transition
affects: [admin-panel-frontend, billing-access, user-management]

tech-stack:
  added: []
  patterns: [three-level RBAC with enum, superadminProcedure for privileged ops]

key-files:
  created:
    - scripts/sql/migrate_isadmin_to_role.sql
  modified:
    - packages/db/prisma/schema.prisma
    - packages/api/src/trpc.ts
    - packages/api/src/utils/access.ts
    - packages/api/src/routers/admin.ts
    - apps/web/src/app/(admin)/layout.tsx
    - apps/web/src/components/admin/UserTable.tsx

key-decisions:
  - "Three-level Role enum (USER/ADMIN/SUPERADMIN) replaces boolean isAdmin"
  - "adminProcedure accepts both ADMIN and SUPERADMIN roles"
  - "superadminProcedure restricts to SUPERADMIN only for role management and user deactivation"
  - "Self-demotion and self-deactivation guards prevent SUPERADMIN from locking themselves out"
  - "Two-step SQL migration script: add role column, migrate data, drop isAdmin"

patterns-established:
  - "RBAC pattern: adminProcedure for read/manage ops, superadminProcedure for privileged ops"
  - "Self-action guards: always check userId === ctx.user.id before destructive self-operations"

requirements-completed: [ROLE-01, ROLE-02, ROLE-03, ROLE-04, ROLE-05]

duration: 4min
completed: 2026-03-18
---

# Phase 31 Plan 01: Admin Roles Backend Summary

**Three-level RBAC (USER/ADMIN/SUPERADMIN) with Prisma enum, tRPC middleware, paywall bypass, and role management mutations**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T08:45:00Z
- **Completed:** 2026-03-18T08:49:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Replaced boolean isAdmin with enum Role { USER ADMIN SUPERADMIN } in Prisma schema
- Added superadminProcedure alongside existing adminProcedure for privilege separation
- Admin/Superadmin users bypass paywall via admin_bypass reason in checkLessonAccess
- changeUserRole mutation with SUPERADMIN-only access and self-demotion guard
- toggleUserField restricted to SUPERADMIN and isActive-only (removed isAdmin toggle)
- UserTable frontend updated: Role dropdown selector replaces boolean toggle

## Task Commits

1. **Task 1: Schema migration + tRPC middleware + access bypass** - `9b98c9f` (feat)
2. **Task 2: Admin router + changeUserRole + privilege guards** - `a68e268` (feat, co-committed with docs)

## Files Created/Modified
- `packages/db/prisma/schema.prisma` - Added Role enum, replaced isAdmin with role field
- `packages/api/src/trpc.ts` - Updated adminProcedure, added superadminProcedure
- `packages/api/src/utils/access.ts` - Added admin_bypass reason and role check
- `packages/api/src/routers/admin.ts` - Added changeUserRole, updated toggleUserField to SUPERADMIN-only
- `apps/web/src/app/(admin)/layout.tsx` - Check role instead of isAdmin for admin access
- `apps/web/src/components/admin/UserTable.tsx` - Role dropdown selector with optimistic UI
- `scripts/sql/migrate_isadmin_to_role.sql` - Safe two-step migration script

## Decisions Made
- Three-level Role enum chosen over more granular RBAC (sufficient for current team size)
- Self-demotion guard prevents SUPERADMIN from accidentally losing access
- SQL migration script created for manual execution before db:push (safe two-step approach)
- Admin layout updated to use role check (Rule 1 - direct breakage fix)
- UserTable updated from toggle to dropdown (Rule 1 - direct breakage fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated admin layout to use role instead of isAdmin**
- **Found during:** Task 1
- **Issue:** Admin layout checked isAdmin which no longer exists after schema change
- **Fix:** Updated to check role !== 'ADMIN' && role !== 'SUPERADMIN'
- **Files modified:** apps/web/src/app/(admin)/layout.tsx
- **Committed in:** 9b98c9f

**2. [Rule 1 - Bug] Updated UserTable to use role instead of isAdmin**
- **Found during:** Task 2
- **Issue:** UserTable referenced isAdmin boolean and isAdmin toggle, both removed from schema
- **Fix:** Replaced isAdmin toggle with Role dropdown selector, updated UserRow interface
- **Files modified:** apps/web/src/components/admin/UserTable.tsx
- **Committed in:** a68e268

---

**Total deviations:** 2 auto-fixed (2 bugs from schema change)
**Impact on plan:** Both fixes necessary to prevent build breakage. No scope creep.

## Issues Encountered
- Prisma generate failed due to DLL lock (dev server running) - verified TypeScript compilation directly instead
- Task 2 files co-committed with unrelated docs commit due to git index.lock timing issue

## User Setup Required

**Database migration required before deploy.** Run the SQL migration script on Supabase:
1. Execute `scripts/sql/migrate_isadmin_to_role.sql` in Supabase SQL Editor
2. Then run `pnpm db:push` to sync Prisma schema

## Next Phase Readiness
- Backend role system complete, ready for Plan 02 (frontend admin UI updates)
- SQL migration must be run on Supabase before deploying code changes

---
*Phase: 31-admin-roles-admin-superadmin*
*Completed: 2026-03-18*
