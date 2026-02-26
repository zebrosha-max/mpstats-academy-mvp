---
phase: 10-superuser-admin-panel
verified: 2026-02-26T14:00:00Z
status: human_needed
score: 5/5 must-haves verified
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
    expected: "Таблица фильтруется по email (через Supabase Admin API), результаты появляются через ~300ms debounce"
    why_human: "Требует SUPABASE_SERVICE_ROLE_KEY в env и живого auth.admin.listUsers вызова"
  - test: "На странице /admin/users переключить isAdmin toggle для пользователя"
    expected: "Toggle переключается мгновенно (optimistic), изменение сохраняется в DB"
    why_human: "Optimistic UI + mutation — требует live тестирования"
  - test: "На странице /admin/analytics нажать 30d"
    expected: "Оба графика перерисовываются с данными за 30 дней"
    why_human: "Chart re-render behaviour — визуальное и state-зависимое"
  - test: "На странице /admin/content раскрыть курс, нажать стрелку вверх/вниз для урока"
    expected: "Порядок уроков меняется, мутация вызывает invalidate и список обновляется"
    why_human: "Accordion lazy-load + mutation flow требует live DB"
---

# Phase 10: Superuser & Admin Panel — Verification Report

**Phase Goal:** Администратор может управлять платформой через защищённую админ-панель — видеть статистику, управлять пользователями и контентом
**Verified:** 2026-02-26T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth                                                                                          | Status     | Evidence                                                                                          |
|----|-----------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------|
| 1  | Пользователь с isAdmin=true попадает на /admin dashboard со статистикой платформы              | VERIFIED  | `(admin)/layout.tsx` queries UserProfile.isAdmin, redirects non-admins; dashboard calls `trpc.admin.getDashboardStats.useQuery()` with real Prisma counts |
| 2  | Пользователь без isAdmin при попытке открыть /admin получает редирект на главную              | VERIFIED  | Layout guard: `if (!profile \|\| !profile.isAdmin) redirect('/dashboard')`. Middleware adds `/admin` to protectedRoutes for unauthenticated redirect to `/login` |
| 3  | Админ может найти пользователя по email и переключить его is_active/is_admin через inline toggle | VERIFIED  | `getUsers` queries Supabase Admin API (`auth.admin.listUsers`) for email match + Prisma name search OR-combined; `UserTable` calls `trpc.admin.toggleUserField.useMutation` for both `isAdmin` and `isActive` with optimistic state |
| 4  | Админ видит графики роста пользователей и активности по времени                               | VERIFIED  | `analytics/page.tsx` calls `trpc.admin.getAnalytics.useQuery({ days })`, renders two `ActivityChart` (Recharts AreaChart) components; period selector 7d/14d/30d/90d changes `days` state |
| 5  | Админ может просматривать курсы и менять порядок уроков                                        | VERIFIED  | `CourseManager` accordion lazy-loads lessons via `trpc.admin.getCourseLessons` (enabled only when expanded); up/down arrows call `trpc.admin.updateLessonOrder.useMutation` swapping adjacent lesson orders |

**Score:** 5/5 truths verified

### Required Artifacts

#### Plan 10-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema.prisma` | isAdmin field on UserProfile | VERIFIED | Lines 24-25: `isAdmin Boolean @default(false)` and `isActive Boolean @default(true)` present |
| `packages/api/src/trpc.ts` | adminProcedure with isAdmin check | VERIFIED | Lines 42-53: `adminProcedure = protectedProcedure.use(...)` queries `UserProfile.isAdmin`, throws `FORBIDDEN` if not true |
| `packages/api/src/routers/admin.ts` | Admin tRPC router, exports adminRouter | VERIFIED | 358 lines, 7 procedures: getDashboardStats, getRecentActivity, getAnalytics, getUsers, toggleUserField, getCourses, getCourseLessons, updateLessonOrder. Exports `adminRouter` |
| `apps/web/src/app/(admin)/layout.tsx` | Admin layout with isAdmin guard | VERIFIED | 61 lines, checks `profile.isAdmin`, redirects to `/dashboard` if false. Renders AdminSidebar + content area |
| `apps/web/src/components/admin/AdminSidebar.tsx` | Admin sidebar navigation component | VERIFIED | 94 lines, exports `AdminSidebar`, 4 nav items (Dashboard/Users/Content/Analytics), active state via `usePathname()`, "Back to app" link |

#### Plan 10-02 Artifacts

| Artifact | Expected | Min Lines | Actual | Status | Details |
|----------|----------|-----------|--------|--------|---------|
| `apps/web/src/app/(admin)/admin/page.tsx` | Dashboard with KPIs, chart, activity feed | 50 | 225 | VERIFIED | 4 StatCards, AreaChart (Recharts), recent activity feed — all wired to live tRPC queries |
| `apps/web/src/app/(admin)/admin/users/page.tsx` | Users page with table, search, pagination, toggles | 80 | 93 | VERIFIED | Debounced search, `getUsers.useQuery`, renders `UserTable` |
| `apps/web/src/app/(admin)/admin/analytics/page.tsx` | Analytics page with charts and period selector | 50 | 123 | VERIFIED | Period selector (7d/14d/30d/90d), 2 `ActivityChart` components, 6 summary stat cards |
| `apps/web/src/app/(admin)/admin/content/page.tsx` | Content page with courses and lesson ordering | 50 | 68 | VERIFIED | Calls `getCourses.useQuery`, renders `CourseManager`, shows badges for counts |
| `apps/web/src/components/admin/UserTable.tsx` | Table with search, pagination, inline toggles | 60 | 227 | VERIFIED | Custom Toggle component, optimistic updates with revert-on-error, pagination controls |
| `apps/web/src/components/admin/StatCard.tsx` | Reusable KPI card | — | 57 | VERIFIED | 4 color variants, icon + value + optional trend |
| `apps/web/src/components/admin/ActivityChart.tsx` | Recharts AreaChart wrapper | — | 72 | VERIFIED | Gradient fill, responsive container, configurable color |
| `apps/web/src/components/admin/CourseManager.tsx` | Accordion with lazy lesson load and reorder | — | 203 | VERIFIED | Accordion with `enabled: isExpanded` query flag, swap-order mutation via ArrowUp/ArrowDown buttons |

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
| `components/admin/CourseManager.tsx` | `routers/admin.ts` | `trpc.admin.updateLessonOrder.useMutation(...)` | WIRED | Line 70 of CourseManager.tsx |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ADMIN-01 | 10-02-PLAN.md | Admin видит dashboard со статистикой (юзеры, диагностики, активность) | SATISFIED | `getDashboardStats` returns totalUsers/totalDiagnostics/totalLessons/recentRegistrations; dashboard page renders 4 KPI cards + activity feed |
| ADMIN-02 | 10-02-PLAN.md | Admin просматривает список пользователей с поиском | SATISFIED | `getUsers` procedure with search, page, limit; users/page.tsx renders `UserTable` with debounced search |
| ADMIN-03 | 10-02-PLAN.md | Admin переключает is_active и is_admin inline | SATISFIED | `toggleUserField` mutation supports both `isAdmin` and `isActive` enum values; `UserTable` renders two Toggle per row with optimistic updates |
| ADMIN-04 | 10-02-PLAN.md | Admin видит аналитику платформы (графики) | SATISFIED | `getAnalytics` returns userGrowth+activity arrays; analytics/page.tsx renders two `ActivityChart` with period selector |
| ADMIN-05 | 10-02-PLAN.md | Admin управляет курсами и уроками (порядок) | SATISFIED | `getCourses`+`getCourseLessons` procedures; `CourseManager` accordion with reorder arrows calling `updateLessonOrder` |
| ADMIN-06 | 10-01-PLAN.md | isAdmin в UserProfile + Prisma migration + adminProcedure | SATISFIED | Schema has `isAdmin Boolean @default(false)` and `isActive Boolean @default(true)`; `adminProcedure` in trpc.ts throws FORBIDDEN for non-admins |
| ADMIN-07 | 10-01-PLAN.md | Route group (admin) с layout guard + защита API через adminProcedure | SATISFIED | `(admin)/layout.tsx` checks isAdmin server-side and redirects; all admin router procedures use `adminProcedure`; middleware adds `/admin` to protectedRoutes |

All 7 requirements for Phase 10 are accounted for and satisfied. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/admin.ts` | 246 | `TODO: Add isActive support when field is used in access control` | Info | Misleading comment — `isActive` toggle IS fully implemented (line 249 Zod enum includes `'isActive'`, mutation reads and writes it). The TODO refers to using `isActive` in *access control enforcement* (e.g., blocking login), not the toggle itself. No blocker. |

### Human Verification Required

All automated checks passed. The following require live environment testing:

#### 1. Admin Dashboard Live Data

**Test:** Set test user as admin via Supabase SQL (`UPDATE "UserProfile" SET "isAdmin" = true WHERE id = '62b06f05-1d65-47b6-8f7c-9f535449a9d9'`), start `pnpm dev`, visit `http://localhost:3000/admin`
**Expected:** Dashboard shows 4 KPI cards with real numbers from DB, a mini registrations chart, and recent activity feed
**Why human:** Requires live Supabase connection and populated DB data

#### 2. Auth Guard — Unauthenticated

**Test:** Open `/admin` in incognito browser (not logged in)
**Expected:** Immediate redirect to `/login`
**Why human:** Middleware behaviour in runtime

#### 3. Auth Guard — Non-Admin User

**Test:** Login as regular user (not admin), navigate to `/admin`
**Expected:** Redirect to `/dashboard`
**Why human:** Server component layout queries live Supabase auth + Prisma

#### 4. Email Search in User Management

**Test:** On `/admin/users`, type a known email address into the search input
**Expected:** Table filters to show matching user after ~300ms debounce. Requires `SUPABASE_SERVICE_ROLE_KEY` env var.
**Why human:** Depends on `auth.admin.listUsers()` API call to live Supabase service

#### 5. Inline Toggle — isAdmin/isActive

**Test:** On `/admin/users`, click isAdmin toggle for any user
**Expected:** Toggle flips immediately (optimistic), then DB is updated. Refresh page — value persists.
**Why human:** Optimistic mutation flow + DB persistence require live testing

#### 6. Analytics Period Selector

**Test:** On `/admin/analytics`, click "30d" button
**Expected:** Both AreaCharts re-render with data spanning 30 days; summary stats update
**Why human:** Chart re-render with state change is visual and runtime-dependent

#### 7. Course Lesson Reordering

**Test:** On `/admin/content`, expand a course (e.g., "Аналитика"), click down arrow on first lesson
**Expected:** Lesson moves down one position, list re-fetches via query invalidation
**Why human:** Accordion lazy-load + mutation invalidation flow requires live DB with lessons

---

## Verification Notes

**Email field in UserTable:** The `UserRow` interface in `UserTable.tsx` does not include an `email` field — email is stored in Supabase `auth.users`, not `UserProfile`. The table currently shows user ID prefix instead of email. This is by design (no email field in Prisma `UserProfile`), but means the table does not display emails even when found by email search. This is an informational gap, not a blocker for goal achievement.

**isActive enforcement:** The `isActive` field can be toggled in the admin panel, but there is currently no enforcement in middleware or layout guards that blocks `isActive=false` users from accessing the platform. This matches the documented Phase 5 (Security Hardening) technical debt.

---

_Verified: 2026-02-26T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
