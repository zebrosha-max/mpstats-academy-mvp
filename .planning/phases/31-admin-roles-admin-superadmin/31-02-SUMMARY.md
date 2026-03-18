---
phase: 31-admin-roles-admin-superadmin
plan: 02
subsystem: ui
tags: [react, rbac, admin-panel, sidebar, mobile-nav, role-management]

requires:
  - phase: 31-admin-roles-admin-superadmin
    provides: Role enum, superadminProcedure, changeUserRole mutation
provides:
  - Privilege-aware admin UI (SUPERADMIN vs ADMIN controls)
  - Role badge in admin header
  - Conditional admin link in sidebar and mobile nav
  - Self-demotion guard in UserTable dropdown
affects: [admin-panel, navigation, user-management]

tech-stack:
  added: []
  patterns: [privilege-aware UI rendering based on currentUserRole prop]

key-files:
  created: []
  modified:
    - apps/web/src/app/(admin)/layout.tsx
    - apps/web/src/components/admin/UserTable.tsx
    - apps/web/src/components/shared/sidebar.tsx
    - apps/web/src/components/shared/mobile-nav.tsx
    - apps/web/src/app/(admin)/admin/users/page.tsx

key-decisions:
  - "Profile query reused for role detection in sidebar/mobile-nav (no new endpoint needed)"
  - "RoleBadge read-only component for ADMIN viewers, RoleSelect dropdown for SUPERADMIN"
  - "Self-demotion guard: disabled dropdown and toggle on own user row"

patterns-established:
  - "Privilege-aware controls: render interactive or read-only based on currentUserRole prop"

requirements-completed: [ROLE-06, ROLE-07, ROLE-08]

duration: 4min
completed: 2026-03-18
---

# Phase 31 Plan 02: Admin Roles Frontend UI Summary

**Privilege-aware admin UI with role badge, conditional nav link, and SUPERADMIN-only role/active management controls**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-18T08:53:37Z
- **Completed:** 2026-03-18T08:57:27Z
- **Tasks:** 2 (of 3, checkpoint pending)
- **Files modified:** 5

## Accomplishments
- Admin layout header shows role badge (Superadmin/Admin) next to user email
- Sidebar and MobileNav conditionally show "Админка" link for ADMIN/SUPERADMIN users
- UserTable renders privilege-aware controls: SUPERADMIN gets role dropdown and isActive toggle, ADMIN gets read-only badges/text
- Self-demotion guard disables role dropdown and isActive toggle on current user's own row
- Users page passes currentUserRole and currentUserId from profile query to UserTable

## Task Commits

1. **Task 1: Admin layout + sidebar/mobile admin link** - `d74f7f0` (feat)
2. **Task 2: UserTable role dropdown + privilege-aware controls** - `c583e85` (feat)

## Files Created/Modified
- `apps/web/src/app/(admin)/layout.tsx` - Added role badge next to email in admin header
- `apps/web/src/components/shared/sidebar.tsx` - Added conditional "Админка" link with gear icon for ADMIN/SUPERADMIN
- `apps/web/src/components/shared/mobile-nav.tsx` - Same conditional admin link for mobile navigation
- `apps/web/src/components/admin/UserTable.tsx` - Added RoleBadge component, currentUserRole/currentUserId props, privilege-aware rendering
- `apps/web/src/app/(admin)/admin/users/page.tsx` - Added profile query, passes role context to UserTable

## Decisions Made
- Reused existing `profile.get` query for role detection (returns full UserProfile including role field) -- no new endpoint needed
- RoleBadge as local component inside UserTable (not exported, simple enough to not warrant separate file)
- Admin link appended at end of nav items list (after billing if enabled)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 3 (checkpoint:human-verify) pending - full role system needs manual verification
- SQL migration from Plan 01 must be run before testing
- All automated tasks complete, ready for human verification

---
*Phase: 31-admin-roles-admin-superadmin*
*Completed: 2026-03-18*
