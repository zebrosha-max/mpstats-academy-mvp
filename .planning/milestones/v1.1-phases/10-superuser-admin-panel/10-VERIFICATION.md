---
phase: 10-superuser-admin-panel
verified: 2026-02-26T16:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Email not displayed in UserTable (commit 9b98633 — email fetched from Supabase auth.admin.listUsers and passed to UserRow)"
    - "Course reorder by position missing (commit 9b98633 — moveCourseToPosition mutation added)"
    - "Course title inline editing missing (commits 04e4a2b + 95d049f — updateCourseTitle mutation + UI)"
    - "Lesson title inline editing missing (commits 04e4a2b + 95d049f — updateLessonTitle mutation + UI)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Войти как isAdmin=true пользователь и открыть /admin"
    expected: "Видно dashboard с 4 KPI карточками (Total Users, Completed Diagnostics, Total Lessons, New Users 7d), mini area chart регистраций, лента Recent Activity"
    why_human: "Требует живого Supabase подключения и DB-данных — нельзя проверить статическим анализом"
  - test: "Открыть /admin без авторизации (инкогнито)"
    expected: "Редирект на /login"
    why_human: "Middleware behaviour в runtime, не в статике"
  - test: "Войти как обычный пользователь (не admin) и открыть /admin"
    expected: "Редирект на /dashboard"
    why_human: "Server component layout guard — requires live Supabase auth"
  - test: "На странице /admin/users ввести email в поиск"
    expected: "Таблица фильтруется по email (через Supabase Admin API), результаты появляются через ~300ms debounce; email пользователя отображается в столбце Email"
    why_human: "Требует SUPABASE_SERVICE_ROLE_KEY в env и живого auth.admin.listUsers вызова"
  - test: "На странице /admin/users переключить isAdmin toggle для пользователя"
    expected: "Toggle переключается мгновенно (optimistic), изменение сохраняется в DB"
    why_human: "Optimistic UI + mutation — требует live тестирования"
  - test: "На странице /admin/analytics нажать 30d"
    expected: "Оба графика перерисовываются с данными за 30 дней"
    why_human: "Chart re-render behaviour — визуальное и state-зависимое"
  - test: "На странице /admin/content кликнуть по номеру порядка курса, ввести новое значение, нажать Enter"
    expected: "Курс перемещается на новую позицию, список обновляется"
    why_human: "moveCourseToPosition mutation + query invalidation требует live DB"
  - test: "На странице /admin/content кликнуть по названию курса, ввести новое, нажать Enter"
    expected: "Название курса обновляется inline, сохраняется в DB"
    why_human: "updateCourseTitle mutation требует live Prisma + DB"
  - test: "На странице /admin/content раскрыть курс, кликнуть по названию урока, ввести новое, нажать Enter"
    expected: "Название урока обновляется inline, сохраняется в DB"
    why_human: "updateLessonTitle mutation требует live DB с уроками"
  - test: "Нажать Escape при любом inline-редактировании (порядок/название курса, название урока)"
    expected: "Редактирование отменяется без API вызова, исходное значение восстанавливается"
    why_human: "State reset logic требует взаимодействия в браузере"
---

# Phase 10: Superuser & Admin Panel — Verification Report

**Phase Goal:** Администратор может управлять платформой через защищённую админ-панель — видеть статистику, управлять пользователями и контентом
**Verified:** 2026-02-26T16:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after Plan 10-03 execution (commits 9b98633, 04e4a2b, 95d049f)

## Re-Verification Summary

Previous verification (2026-02-26T14:00:00Z) had status `human_needed` with one informational note about email not being displayed in UserTable. Since then, 3 commits added:
- Email display in UserTable (fetched from Supabase auth API)
- Course jump-to-position reorder via position number
- Inline editing for course titles (click-to-edit, Enter/Escape)
- Inline editing for lesson titles (click-to-edit, Enter/Escape)
- 3 new tRPC mutations: `moveCourseToPosition`, `updateCourseTitle`, `updateLessonTitle`

All previously noted informational gaps are now resolved. No regressions detected.

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Пользователь с isAdmin=true попадает на /admin dashboard со статистикой платформы | VERIFIED | `(admin)/layout.tsx` queries `UserProfile.isAdmin`, redirects non-admins; dashboard calls `trpc.admin.getDashboardStats.useQuery()` with real Prisma counts |
| 2  | Пользователь без isAdmin при попытке открыть /admin получает редирект | VERIFIED | Layout guard: `if (!profile || !profile.isAdmin) redirect('/dashboard')`. Middleware adds `/admin` to protectedRoutes for unauthenticated redirect to `/login` |
| 3  | Админ может найти пользователя по email и видеть его адрес в таблице | VERIFIED | `getUsers` queries Supabase `auth.admin.listUsers` for email match; `emailMap` built from listUsers and mapped to each `UserRow.email`; UserTable renders `{user.email || user.id.slice(0,8)+'...'}` |
| 4  | Админ может переключить is_active/is_admin через inline toggle | VERIFIED | `toggleUserField` mutation supports both enum values; `UserTable` renders two Toggle per row with optimistic state |
| 5  | Админ видит графики роста пользователей и активности по времени | VERIFIED | `getAnalytics` returns userGrowth+activity arrays; analytics/page.tsx renders two `ActivityChart` (Recharts AreaChart) with period selector 7d/14d/30d/90d |
| 6  | Админ может менять порядок курсов и уроков через click-to-edit по номеру позиции | VERIFIED | `moveCourseToPosition` mutation (shift algorithm, 428-486 admin.ts) called from CourseAccordion `handleCourseOrderSubmit`; `moveLessonToPosition` mutation for lessons |
| 7  | Админ может inline-редактировать названия курсов и уроков (Enter saves, Escape cancels) | VERIFIED | `updateCourseTitle` (491-508 admin.ts) + `updateLessonTitle` (513-530 admin.ts); CourseManager has `editingCourseTitle`, `editingLessonTitleId` state with Enter/Escape/onBlur handlers, `stopPropagation` prevents accordion toggle |

**Score:** 7/7 truths verified

### Required Artifacts

#### Plans 10-01 and 10-02 (unchanged from previous verification — all VERIFIED)

| Artifact | Expected | Status | Lines |
|----------|----------|--------|-------|
| `packages/db/prisma/schema.prisma` | isAdmin, isActive on UserProfile | VERIFIED | `isAdmin Boolean @default(false)`, `isActive Boolean @default(true)` |
| `packages/api/src/trpc.ts` | adminProcedure with isAdmin check | VERIFIED | Lines 42-53: throws FORBIDDEN for non-admins |
| `packages/api/src/routers/admin.ts` | Admin tRPC router | VERIFIED | 553 lines, 10 procedures |
| `apps/web/src/app/(admin)/layout.tsx` | Admin layout with isAdmin guard | VERIFIED | 61 lines, server-side redirect |
| `apps/web/src/components/admin/AdminSidebar.tsx` | Admin nav sidebar | VERIFIED | 94 lines, 4 nav items |
| `apps/web/src/app/(admin)/admin/page.tsx` | Dashboard with KPIs, chart, activity | VERIFIED | 225 lines |
| `apps/web/src/app/(admin)/admin/users/page.tsx` | Users page with search/table | VERIFIED | 93 lines |
| `apps/web/src/app/(admin)/admin/analytics/page.tsx` | Analytics with period selector | VERIFIED | 123 lines |
| `apps/web/src/app/(admin)/admin/content/page.tsx` | Content with course/lesson management | VERIFIED | 68 lines |
| `apps/web/src/components/admin/UserTable.tsx` | Table with email, pagination, toggles | VERIFIED | 227 lines; email field added |
| `apps/web/src/components/admin/StatCard.tsx` | KPI card | VERIFIED | 57 lines |
| `apps/web/src/components/admin/ActivityChart.tsx` | Recharts AreaChart wrapper | VERIFIED | 72 lines |
| `apps/web/src/components/admin/CourseManager.tsx` | Accordion with reorder + inline editing | VERIFIED | 377 lines |

#### Plan 10-03 Artifacts (new)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/api/src/routers/admin.ts` | `moveCourseToPosition`, `updateCourseTitle`, `updateLessonTitle` mutations | VERIFIED | Lines 428-530; all use `adminProcedure`, Zod validation, `ctx.prisma`, error handling |
| `apps/web/src/components/admin/CourseManager.tsx` | Inline editing for course order, course title, lesson title | VERIFIED | `editingCourseOrder`, `editingCourseTitle`, `editingLessonTitleId` states; all handlers with Enter/Escape/onBlur; `stopPropagation` on header clicks |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(admin)/layout.tsx` | `schema.prisma` | `prisma.userProfile.findUnique({ select: { isAdmin: true } })` | WIRED | Line 19-23 of layout.tsx |
| `packages/api/src/trpc.ts` | `schema.prisma` | `adminProcedure` queries `UserProfile.isAdmin` | WIRED | Lines 43-46 of trpc.ts |
| `packages/api/src/root.ts` | `routers/admin.ts` | `admin: adminRouter` | WIRED | Line 13 of root.ts |
| `(admin)/admin/page.tsx` | `routers/admin.ts` | `trpc.admin.getDashboardStats.useQuery()` | WIRED | Line 66 of admin/page.tsx |
| `(admin)/admin/users/page.tsx` | `routers/admin.ts` | `trpc.admin.getUsers.useQuery(...)` | WIRED | Line 27 of users/page.tsx |
| `components/admin/UserTable.tsx` | `routers/admin.ts` | `trpc.admin.toggleUserField.useMutation(...)` | WIRED | Line 66 of UserTable.tsx |
| `(admin)/admin/analytics/page.tsx` | `routers/admin.ts` | `trpc.admin.getAnalytics.useQuery({ days })` | WIRED | Line 28 of analytics/page.tsx |
| `(admin)/admin/content/page.tsx` | `routers/admin.ts` | `trpc.admin.getCourses.useQuery()` | WIRED | Line 10 of content/page.tsx |
| `components/admin/CourseManager.tsx` | `routers/admin.ts` | `trpc.admin.moveCourseToPosition.useMutation(...)` | WIRED | Line 43 of CourseManager.tsx |
| `components/admin/CourseManager.tsx` | `routers/admin.ts` | `trpc.admin.updateCourseTitle.useMutation(...)` | WIRED | Line 49 of CourseManager.tsx |
| `components/admin/CourseManager.tsx` | `routers/admin.ts` | `trpc.admin.updateLessonTitle.useMutation(...)` | WIRED | Line 108 of CourseManager.tsx |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 10-02-PLAN.md | Admin видит dashboard со статистикой (юзеры, диагностики, активность) | SATISFIED | `getDashboardStats` returns totalUsers/totalDiagnostics/totalLessons/recentRegistrations; dashboard renders 4 KPI cards + activity feed |
| ADMIN-02 | 10-02-PLAN.md | Admin просматривает список пользователей с поиском | SATISFIED | `getUsers` with search, page, limit; email displayed via Supabase auth API lookup; debounced search in users/page.tsx |
| ADMIN-03 | 10-02-PLAN.md | Admin переключает is_active и is_admin inline | SATISFIED | `toggleUserField` mutation for both fields; UserTable renders two Toggle per row with optimistic updates |
| ADMIN-04 | 10-02-PLAN.md | Admin видит аналитику платформы (графики) | SATISFIED | `getAnalytics` returns userGrowth+activity arrays; two `ActivityChart` with period selector |
| ADMIN-05 | 10-02-PLAN.md + 10-03-PLAN.md | Admin управляет курсами и уроками (порядок + редактирование) | SATISFIED | Lesson/course reorder via position numbers; inline title editing for both courses and lessons; all 5 mutations wired |
| ADMIN-06 | 10-01-PLAN.md | isAdmin в UserProfile + Prisma migration + adminProcedure | SATISFIED | `isAdmin Boolean @default(false)`, `isActive Boolean @default(true)` in schema; `adminProcedure` throws FORBIDDEN for non-admins |
| ADMIN-07 | 10-01-PLAN.md | Route group (admin) с layout guard + защита API через adminProcedure | SATISFIED | `(admin)/layout.tsx` checks isAdmin server-side; all admin router procedures use `adminProcedure`; middleware adds `/admin` to protectedRoutes |

All 7 requirements accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/admin.ts` | 246 | `TODO: Add isActive support when access control is enforced` | Info | `isActive` toggle is fully implemented; TODO refers to blocking `isActive=false` users from logging in (Phase 5 tech debt). No blocker. |

### Human Verification Required

All automated checks passed. The following require live environment testing:

#### 1. Admin Dashboard Live Data

**Test:** Set test user as admin via Supabase SQL (`UPDATE "UserProfile" SET "isAdmin" = true WHERE id = '62b06f05-1d65-47b6-8f7c-9f535449a9d9'`), start `pnpm dev`, visit `http://localhost:3000/admin`
**Expected:** Dashboard shows 4 KPI cards with real numbers from DB, mini registrations chart, and recent activity feed
**Why human:** Requires live Supabase connection and populated DB data

#### 2. Auth Guard — Unauthenticated

**Test:** Open `/admin` in incognito browser (not logged in)
**Expected:** Immediate redirect to `/login`
**Why human:** Middleware behaviour in runtime

#### 3. Auth Guard — Non-Admin User

**Test:** Login as regular user (not admin), navigate to `/admin`
**Expected:** Redirect to `/dashboard`
**Why human:** Server component layout queries live Supabase auth + Prisma

#### 4. Email Display and Search in User Management

**Test:** On `/admin/users`, verify emails are shown in the Email column; type a known email address into the search input
**Expected:** Email addresses visible in table; table filters matching user after ~300ms debounce. Requires `SUPABASE_SERVICE_ROLE_KEY` env var.
**Why human:** Depends on `auth.admin.listUsers()` API call to live Supabase service

#### 5. Inline Toggle — isAdmin/isActive

**Test:** On `/admin/users`, click isAdmin toggle for any user
**Expected:** Toggle flips immediately (optimistic), then DB is updated. Refresh page — value persists.
**Why human:** Optimistic mutation flow + DB persistence require live testing

#### 6. Analytics Period Selector

**Test:** On `/admin/analytics`, click "30d" button
**Expected:** Both AreaCharts re-render with data spanning 30 days; summary stats update
**Why human:** Chart re-render with state change is visual and runtime-dependent

#### 7. Course Reorder by Position

**Test:** On `/admin/content`, click the `#1` order number next to a course, type `3`, press Enter
**Expected:** Course moves to position 3, other courses shift accordingly, list re-fetches
**Why human:** `moveCourseToPosition` shift algorithm requires live DB with multiple courses

#### 8. Course Title Inline Editing

**Test:** On `/admin/content`, click a course title, type new name, press Enter; then try Escape on another
**Expected:** Enter saves new title (DB updated, list refreshes); Escape restores original without API call. Clicking title does NOT toggle accordion.
**Why human:** `updateCourseTitle` mutation + accordion stopPropagation requires browser interaction

#### 9. Lesson Title Inline Editing

**Test:** On `/admin/content`, expand a course, click a lesson title, type new name, press Enter
**Expected:** Lesson title updates inline, DB updated via `updateLessonTitle` mutation
**Why human:** Requires live DB with lesson records

#### 10. Escape Cancels All Edits

**Test:** Start editing any field (course order, course title, lesson title), press Escape
**Expected:** Input disappears, original value restored, no API call made
**Why human:** State reset interaction requires browser

---

## Verification Notes

**isActive enforcement:** The `isActive` field can be toggled in the admin panel, but there is currently no enforcement in middleware or layout guards that blocks `isActive=false` users from accessing the platform. This matches the documented Phase 5 (Security Hardening) technical debt.

**Plan 10-03 scope note:** ADMIN-05 requirement ("управление курсами и уроками") was initially satisfied by basic reorder (plan 10-02). Plan 10-03 extended this with jump-to-position reorder and inline title editing. Both are now covered under ADMIN-05 and fully wired.

---

_Verified: 2026-02-26T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after: Plan 10-03 execution (commits 9b98633, 04e4a2b, 95d049f)_
