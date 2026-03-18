---
phase: 31-admin-roles-admin-superadmin
verified: 2026-03-18T12:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 31: Admin Roles (ADMIN / SUPERADMIN) Verification Report

**Phase Goal:** Разделение единого isAdmin: Boolean на трёхуровневую иерархию ролей (USER / ADMIN / SUPERADMIN). Включает paywall bypass для админов, защиту привилегий (кто кого может назначать/деактивировать), и обновление UI админки.
**Verified:** 2026-03-18T12:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Prisma schema has enum Role { USER ADMIN SUPERADMIN } and UserProfile.role replaces isAdmin | VERIFIED | schema.prisma lines 20-24 contain `enum Role { USER ADMIN SUPERADMIN }`, UserProfile has `role Role @default(USER)`, no `isAdmin` field |
| 2 | adminProcedure allows ADMIN and SUPERADMIN, superadminProcedure allows only SUPERADMIN | VERIFIED | trpc.ts lines 42-67: adminProcedure checks `profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN'`; superadminProcedure checks `profile.role !== 'SUPERADMIN'` |
| 3 | ADMIN and SUPERADMIN bypass paywall in checkLessonAccess | VERIFIED | access.ts lines 71-77: role check after billingEnabled check, returns `{ hasAccess: true, reason: 'admin_bypass' }` for ADMIN/SUPERADMIN |
| 4 | changeUserRole mutation enforces SUPERADMIN-only + self-demotion guard | VERIFIED | admin.ts lines 317-347: `changeUserRole: superadminProcedure`, self-demotion guard `if (userId === ctx.user.id)` throws FORBIDDEN |
| 5 | toggleUserField for isActive is restricted to SUPERADMIN | VERIFIED | admin.ts lines 271-311: `toggleUserField: superadminProcedure`, field enum is `z.enum(['isActive'])` — no isAdmin in union |
| 6 | Admin layout allows ADMIN and SUPERADMIN users, redirects USER to /dashboard | VERIFIED | (admin)/layout.tsx lines 24-26: checks `profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN'`, redirects to /dashboard |
| 7 | UserTable shows role badge for ADMIN viewers and role dropdown for SUPERADMIN viewers | VERIFIED | UserTable.tsx lines 272-282: conditional render — `currentUserRole === 'SUPERADMIN'` shows RoleSelect, else shows RoleBadge |
| 8 | SUPERADMIN cannot demote themselves via the UI dropdown | VERIFIED | UserTable.tsx line 277: RoleSelect has `disabled={changeRole.isPending \|\| user.id === currentUserId}` |
| 9 | Sidebar and MobileNav show 'Админка' link for ADMIN and SUPERADMIN users | VERIFIED | sidebar.tsx lines 54-63 (adminNavItem defined), lines 92/132 (conditional render based on role); mobile-nav.tsx lines 53-62 (adminNavItem), line 91 (conditional push) |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema.prisma` | Role enum and UserProfile.role field | VERIFIED | Contains `enum Role { USER ADMIN SUPERADMIN }`, UserProfile has `role Role @default(USER)` |
| `packages/api/src/trpc.ts` | adminProcedure and superadminProcedure | VERIFIED | Both procedures exported, superadminProcedure at line 56, passes `userRole` via ctx |
| `packages/api/src/utils/access.ts` | Admin bypass in checkLessonAccess | VERIFIED | `admin_bypass` in AccessResult union type, role check at lines 71-77 |
| `packages/api/src/routers/admin.ts` | changeUserRole and privilege guards | VERIFIED | `changeUserRole: superadminProcedure` at line 317, self-demotion guard present, `toggleUserField: superadminProcedure` at line 271 |
| `apps/web/src/app/(admin)/layout.tsx` | Role-based admin access check | VERIFIED | `select: { role: true }` at line 21, condition checks role not isAdmin, role badge in header |
| `apps/web/src/components/admin/UserTable.tsx` | Role dropdown and privilege-aware UI | VERIFIED | RoleBadge (line 81), RoleSelect (line 89), `currentUserRole`/`currentUserId` props, `trpc.admin.changeUserRole.useMutation` at line 125 |
| `apps/web/src/components/shared/sidebar.tsx` | Conditional admin link | VERIFIED | adminNavItem with `href: '/admin'`, rendered conditionally in footer for ADMIN/SUPERADMIN |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/trpc.ts` | `packages/db/prisma/schema.prisma` | `select: { role: true }` in UserProfile query | VERIFIED | Lines 45 and 59: `select: { role: true }` |
| `packages/api/src/utils/access.ts` | `packages/db/prisma/schema.prisma` | `role === 'ADMIN' \|\| role === 'SUPERADMIN'` check | VERIFIED | Line 75: `userProfile?.role === 'ADMIN' \|\| userProfile?.role === 'SUPERADMIN'` |
| `apps/web/src/app/(admin)/layout.tsx` | `packages/db/prisma/schema.prisma` | `select: { role: true }` | VERIFIED | Line 21: `select: { role: true }` |
| `apps/web/src/components/admin/UserTable.tsx` | `packages/api/src/routers/admin.ts` | `trpc.admin.changeUserRole` | VERIFIED | Line 125: `trpc.admin.changeUserRole.useMutation(...)` |
| `apps/web/src/app/(admin)/admin/users/page.tsx` | `apps/web/src/components/admin/UserTable.tsx` | `currentUserRole` and `currentUserId` props | VERIFIED | Lines 96-97: `currentUserRole={(myProfile?.role as Role) ?? 'USER'}`, `currentUserId={myProfile?.id ?? ''}` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ROLE-01 | Plan 01 | Prisma enum Role replaces isAdmin boolean | SATISFIED | schema.prisma: `enum Role { USER ADMIN SUPERADMIN }`, `role Role @default(USER)`, no `isAdmin` field |
| ROLE-02 | Plan 01 | adminProcedure for ADMIN+SUPERADMIN, superadminProcedure for SUPERADMIN only | SATISFIED | trpc.ts: both procedures exist with correct guards |
| ROLE-03 | Plan 01 | ADMIN/SUPERADMIN bypass paywall via admin_bypass | SATISFIED | access.ts: `admin_bypass` in union type, role check with early return |
| ROLE-04 | Plan 01 | changeUserRole SUPERADMIN-only + self-demotion guard | SATISFIED | admin.ts: `superadminProcedure`, `userId === ctx.user.id` guard |
| ROLE-05 | Plan 01 | toggleUserField isActive restricted to SUPERADMIN | SATISFIED | admin.ts: `superadminProcedure`, `z.enum(['isActive'])` (no isAdmin) |
| ROLE-06 | Plan 02 | Admin layout checks role, shows role badge | SATISFIED | layout.tsx: role check, badge showing 'Superadmin' or 'Admin' in header |
| ROLE-07 | Plan 02 | UserTable privilege-aware controls | SATISFIED | UserTable.tsx: RoleSelect for SUPERADMIN, RoleBadge for ADMIN, isActive toggle SUPERADMIN-only |
| ROLE-08 | Plan 02 | Sidebar/MobileNav conditional admin link | SATISFIED | sidebar.tsx and mobile-nav.tsx: adminNavItem defined, shown only for ADMIN/SUPERADMIN role |

**No orphaned requirements.** All 8 ROLE-01 through ROLE-08 requirements are claimed in plans and verified in code.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments in modified files. No stub implementations. No empty handlers.

**Additional observation (not a blocker):** The `isAdmin` string still appears in `sidebar.tsx` as a local variable name (`const isAdmin = myProfile?.role === 'ADMIN' || myProfile?.role === 'SUPERADMIN'`). This is a local boolean computed from role — not a reference to the removed schema field. The computation is correct.

**Commit note:** admin.ts (changeUserRole + toggleUserField superadminProcedure) was co-committed in `a68e268` (a docs commit for phase 27). The code change is real and verified — the commit labeling is misleading but harmless.

### Human Verification Required

The following items require runtime testing to fully confirm:

**1. Paywall bypass end-to-end**
- Test: Log in as ADMIN user and open a paid lesson with billing enabled
- Expected: Lesson loads without paywall prompt (reason: admin_bypass)
- Why human: Requires runtime with billing feature flag enabled and active subscription check

**2. ADMIN user admin panel access**
- Test: Log in as an ADMIN-role user (not SUPERADMIN) and navigate to /admin/users
- Expected: Page loads, role badges visible, no role dropdown, no isActive toggles — only read-only text
- Why human: Requires an ADMIN-role user account and runtime rendering

**3. Self-demotion guard in UI**
- Test: Log in as SUPERADMIN and go to /admin/users, find own row
- Expected: Role dropdown is disabled (grayed out) for own row
- Why human: Requires runtime UI rendering with real user data

**4. Database migration confirmed on production**
- Test: Verify `isAdmin` column no longer exists in production Supabase and all users have `role` field
- Expected: `SELECT column_name FROM information_schema.columns WHERE table_name='UserProfile'` shows `role`, no `isAdmin`
- Why human: `migrate_isadmin_to_role.sql` / `migrate-roles.ts` exist but execution on production DB must be confirmed separately

### Gaps Summary

No gaps found. All 9 observable truths are verified against actual code. All 8 requirement IDs are satisfied by substantive implementations. Key links are confirmed wired. No stub patterns detected.

The phase successfully achieves its goal: the single `isAdmin: Boolean` field has been replaced by a three-level `Role` enum (USER / ADMIN / SUPERADMIN) with proper privilege separation throughout the stack — schema, tRPC middleware, paywall access logic, admin mutations, admin layout, user table, and navigation.

---

_Verified: 2026-03-18T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
