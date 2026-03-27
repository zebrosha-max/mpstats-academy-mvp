---
phase: 34-user-profile-enhancement
verified: 2026-03-26T09:00:00Z
status: gaps_found
score: 4/5 success criteria verified
gaps:
  - truth: "UserNav и Sidebar показывают аватар пользователя (или инициалы как fallback)"
    status: partial
    reason: "UserNav fully implements avatar with fallback. Sidebar does NOT display avatar or user name — it only fetches profile for role checks. Success Criterion #4 requires both components to show avatar."
    artifacts:
      - path: "apps/web/src/components/shared/sidebar.tsx"
        issue: "Sidebar fetches trpc.profile.get only for role detection (isAdmin check). No avatar/name rendered in sidebar footer or header area."
    missing:
      - "Add avatar + name display to Sidebar footer area (e.g., compact user identity card before bottom nav links)"
human_verification:
  - test: "Avatar upload end-to-end"
    expected: "Select image -> canvas resize to 256x256 webp -> upload to Supabase Storage avatars bucket -> avatar URL saved to UserProfile -> avatar appears in UserNav header"
    why_human: "Requires Supabase Storage bucket to be created first (scripts/sql/create_avatars_bucket.sql must be run manually) and actual file upload interaction"
  - test: "Profile completeness banner conditional display"
    expected: "Dashboard shows blue 'Заполните профиль' banner when user has no name set; banner disappears after name is saved on profile page"
    why_human: "Requires a test user with null name to verify banner appears, then fill name to confirm banner disappears"
  - test: "File validation on upload"
    expected: "Files > 2MB show error toast 'Файл слишком большой'. Non-image files rejected by accept attribute."
    why_human: "Requires browser interaction with file input"
  - test: "OAuth name auto-copy"
    expected: "First profile.get call for Yandex OAuth user copies full_name from user_metadata into UserProfile.name transparently"
    why_human: "Requires Yandex OAuth login with a fresh account that has no UserProfile.name"
---

# Phase 34: User Profile Enhancement Verification Report

**Phase Goal:** Пользователь может загрузить аватар и указать отображаемое имя (display name) в профиле. Аватар хранится в Supabase Storage, отображается в UserNav, Sidebar и будущих комментариях. При отсутствии аватара показывается fallback на инициалы. Display name запрашивается при первом входе (profile completeness).
**Verified:** 2026-03-26T09:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Supabase Storage bucket `avatars` создан с RLS-политикой | ✓ VERIFIED | `scripts/sql/create_avatars_bucket.sql` — INSERT into storage.buckets with id='avatars', public=true, 2097152 limit, 4 RLS policies (INSERT/UPDATE/DELETE/SELECT) with auth.uid() checks |
| 2 | Профиль содержит upload-компонент с crop/resize и preview, лимит 2MB, форматы jpg/png/webp | ✓ VERIFIED | `profile/page.tsx` — resizeImageToWebp() canvas function, MAX_FILE_SIZE = 2*1024*1024, accept="image/jpeg,image/png,image/webp", 96x96 circle preview |
| 3 | Display name запрашивается при первом входе через модал/баннер на дашборде | ✓ VERIFIED | `dashboard/page.tsx` line 104 — `{profile && !profile.name && (<Card...>Заполните профиль...href="/profile">Перейти в профиль</Card>)}` |
| 4 | UserNav и Sidebar показывают аватар пользователя (или инициалы как fallback) | ✗ PARTIAL | UserNav — VERIFIED (img tag + gradient initials fallback). Sidebar — NOT showing avatar, only uses profile for role check |
| 5 | tRPC мутация `updateProfile` обновляет name и avatarUrl атомарно | ✓ VERIFIED | `profile.ts` update mutation accepts `{ name?, avatarUrl? }`, single `prisma.userProfile.update` call |

**Score:** 4/5 success criteria verified (SC-4 partial)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `scripts/sql/create_avatars_bucket.sql` | ✓ VERIFIED | 53 lines — bucket creation + 4 RLS policies |
| `packages/api/src/routers/profile.ts` | ✓ VERIFIED | getAvatarUploadUrl (L349), deleteAvatar with FORBIDDEN check (L357), OAuth name copy in get (L150-158) |
| `apps/web/src/app/(main)/layout.tsx` | ✓ VERIFIED | prisma.userProfile.findUnique at L37, passes name+avatarUrl to UserNav at L67-71 |
| `apps/web/src/components/shared/user-nav.tsx` | ✓ VERIFIED | UserNavProps with name/avatarUrl (not user_metadata), img tag with onError fallback |
| `apps/web/src/app/(main)/profile/page.tsx` | ✓ VERIFIED | Avatar upload section with canvas resize, Supabase Storage upload, delete flow |
| `apps/web/src/app/(main)/dashboard/page.tsx` | ✓ VERIFIED | Profile completeness banner with !profile.name condition |
| `apps/web/src/components/shared/sidebar.tsx` | ⚠️ ORPHANED (for avatar) | Fetches profile.get but only uses it for role detection — no avatar rendered |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `(main)/layout.tsx` | `packages/api/src/routers/profile.ts` | `prisma.userProfile.findUnique` | ✓ WIRED | L37: direct Prisma query, select name+avatarUrl |
| `components/shared/user-nav.tsx` | UserProfile data | props from layout | ✓ WIRED | UserNavProps.name + UserNavProps.avatarUrl consumed at L17-22 |
| `profile/page.tsx` | Supabase Storage | `supabase.storage.from('avatars').upload()` | ✓ WIRED | L169-171: upload to avatars bucket |
| `profile/page.tsx` | `profile.ts` update mutation | `trpc.profile.update.useMutation` | ✓ WIRED | L121 mutation, L180 mutateAsync({ avatarUrl }) |
| `dashboard/page.tsx` | `profile.ts` get query | `trpc.profile.get.useQuery()` | ✓ WIRED | L50 query, L104 condition on profile.name |
| `sidebar.tsx` | UserProfile avatar | (expected) | ✗ NOT_WIRED | Sidebar fetches profile (L91) but renders no avatar UI |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `user-nav.tsx` | `user.avatarUrl`, `user.name` | layout.tsx → prisma.userProfile.findUnique | Yes — Prisma DB query | ✓ FLOWING |
| `profile/page.tsx` | `profile.avatarUrl` | trpc.profile.get.useQuery() → Prisma | Yes — DB query with avatarUrl field | ✓ FLOWING |
| `dashboard/page.tsx` | `profile.name` | trpc.profile.get.useQuery() | Yes — same Prisma query | ✓ FLOWING |
| `sidebar.tsx` | avatar display | Not fetched for avatar display | N/A — avatar not displayed | ✗ DISCONNECTED (for avatar) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SQL bucket script contains all 4 policies | grep "CREATE POLICY" scripts/sql/create_avatars_bucket.sql | 4 matches | ✓ PASS |
| Profile page contains canvas resize | grep "toBlob\|canvas" apps/web/src/app/(main)/profile/page.tsx | canvas.toBlob found | ✓ PASS |
| Dashboard banner condition | grep "!profile.name" apps/web/src/app/(main)/dashboard/page.tsx | Line 104 found | ✓ PASS |
| UserNav uses profile-based props | grep "user_metadata" apps/web/src/components/shared/user-nav.tsx | 0 matches | ✓ PASS |
| TypeScript: Phase 34 files | npx tsc --noEmit | 0 errors in profile/layout/user-nav/dashboard files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PROF-01 | 34-01-PLAN.md | Supabase Storage bucket + RLS + UserNav refactor | ✓ SATISFIED | SQL script + user-nav.tsx refactored |
| PROF-02 | 34-02-PLAN.md | Avatar upload UI with resize, preview, 2MB limit | ✓ SATISFIED | profile/page.tsx canvas resize + validation |
| PROF-03 | 34-02-PLAN.md | Profile completeness banner on dashboard | ✓ SATISFIED | dashboard/page.tsx banner with !profile.name |
| PROF-04 | 34-01-PLAN.md | tRPC profile endpoints + OAuth name copy | ✓ SATISFIED | getAvatarUploadUrl, deleteAvatar, OAuth name copy in get |

Note: PROF-01..04 requirement IDs are not present in `.planning/REQUIREMENTS.md` (requirements file only goes up to v1.9/SUPP- IDs). They are defined implicitly in the ROADMAP.md success criteria for Phase 34. This is an ORPHANED requirement gap — the IDs were used in PLAN frontmatter but never formally registered in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/(main)/profile/page.tsx` | 215 | `const avatarInitial = profile?.name?.charAt(0)?.toUpperCase() \|\| 'U'` — fallback is 'U' not email initial | ℹ️ Info | Minor UX: if name not loaded yet, fallback is 'U' instead of email-derived initial |
| `apps/web/src/components/shared/sidebar.tsx` | 91-94 | `trpc.profile.get.useQuery()` fetched but avatarUrl never rendered | ⚠️ Warning | SC-4 gap: Sidebar goal says avatar should be shown here |

### Human Verification Required

#### 1. Avatar Upload End-to-End

**Test:** Run `scripts/sql/create_avatars_bucket.sql` in Supabase SQL Editor, then on https://platform.mpstats.academy/profile click "Загрузить фото", select a JPG/PNG image.
**Expected:** Preview appears as 96x96 circle, avatar then appears in UserNav header (top right).
**Why human:** Requires Supabase Storage bucket to actually exist (SQL must be executed manually) + browser file interaction.

#### 2. Profile Completeness Banner

**Test:** Log in as a user whose UserProfile.name is NULL (or clear name in Prisma Studio), navigate to /dashboard.
**Expected:** Blue "Заполните профиль" banner visible at top. Click "Перейти в профиль", set name, return to dashboard — banner gone.
**Why human:** Requires a controlled test user state.

#### 3. File Validation

**Test:** On /profile, try to upload a file > 2MB.
**Expected:** Toast error "Файл слишком большой. Максимум 2 МБ".
**Why human:** Requires browser file input interaction.

#### 4. OAuth Name Auto-Copy

**Test:** Log in via Yandex OAuth with an account that has no UserProfile.name set; observe profile.name field.
**Expected:** profile.name is populated from user_metadata.full_name automatically on first profile.get.
**Why human:** Requires Yandex OAuth login flow.

## Gaps Summary

**1 gap blocking full goal achievement:**

**Success Criterion #4 (Sidebar avatar)** — The ROADMAP explicitly states "UserNav и Sidebar показывают аватар пользователя". Only UserNav was implemented. Sidebar.tsx fetches `trpc.profile.get` but uses it solely for `isAdmin` role detection and renders no user avatar or name.

**Context note:** The CONTEXT.md (decision D-05) states "Sidebar без аватара (навигация only)" — this represents a scoping decision made during planning that narrowed the implementation relative to the ROADMAP success criterion. The ROADMAP criterion and the planning decision are in conflict. The gap is real against the ROADMAP success criteria.

**Fix required:** Add a compact user identity row to the Sidebar (typically in footer area — above the bottom nav links), showing the avatar image or initials fallback and the user's display name. The data is already available via the existing `trpc.profile.get.useQuery()` call in sidebar.tsx.

**Orphaned requirement IDs:** PROF-01..04 are referenced in plan frontmatter but not registered in `.planning/REQUIREMENTS.md`. Not a functional gap but a traceability gap.

---

_Verified: 2026-03-26T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
