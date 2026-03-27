---
phase: 40-navigation-filters
verified: 2026-03-27T12:10:00Z
status: passed
score: 5/5 must-haves verified
---

# Phase 40: Navigation & Filters Verification Report

**Phase Goal:** Фильтры сохраняются в URL, тур не повторяется, email скрыт в комментариях, Yandex OAuth позволяет сменить аккаунт, autoplay консистентно.
**Verified:** 2026-03-27T12:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Filters persist in URL when navigating away from /learn and back | VERIFIED | `useSearchParams` + `router.replace` in `learn/page.tsx` lines 87-94; `filtersFromSearchParams` / `filtersToSearchParams` helpers at lines 47-69 |
| 2 | Tour does not auto-start more than once per page per browser lifetime | VERIFIED | `hasAutoStartedRef = useRef<Set<TourPage>>(new Set())` at line 32 of TourProvider.tsx; pre-timer guard at line 60, in-timer guard at line 70, mark at line 81 |
| 3 | Browser back button restores filter state on /learn | VERIFIED | `router.replace` used (not `push`) — no extra history entries added by filter changes; URL params survive navigation and are read back on mount via `useMemo(() => filtersFromSearchParams(searchParams), [searchParams])` |
| 4 | Comments never show raw email addresses as author name | VERIFIED | `sanitizeUserName` helper at lines 17-23 of `comments.ts`; applied in `list` (lines 68-75) and `create` (line 141); returns `null` for any name containing `@` and `.` |
| 5 | Yandex OAuth shows account selection screen on every login | VERIFIED | `prompt: 'login'` added to URLSearchParams in `oauth-providers.ts` line 32 |

Implicit truths from goal:

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Video does not autoplay when resuming from watch position | VERIFIED | `initialTime` branch (lines 190-196 of KinescopePlayer.tsx) calls `pl.seekTo` without `pl.play()`; only 1 remaining `pl.play()` call is in `pendingSeekRef` branch (explicit user timecode click) |

**Score:** 5/5 primary must-haves verified (6/6 including implicit autoplay truth)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/(main)/learn/page.tsx` | URL-backed filter state via useSearchParams | VERIFIED | Contains `useSearchParams`, `router.replace`, `filtersFromSearchParams`, `Suspense` wrapper; no `useState<FilterState>` or `DEFAULT_FILTERS` |
| `apps/web/src/components/shared/TourProvider.tsx` | Tour auto-start guard with hasAutoStartedRef | VERIFIED | `hasAutoStartedRef` present 4 times: declaration, pre-timer check, in-timer check, mark-after-start |
| `packages/api/src/routers/comments.ts` | Email-safe author name in comments | VERIFIED | `sanitizeUserName` function + applied in both `list` and `create` procedures |
| `apps/web/src/lib/auth/oauth-providers.ts` | Yandex OAuth with prompt=login | VERIFIED | `prompt: 'login'` in URLSearchParams at line 32 |
| `apps/web/src/components/video/KinescopePlayer.tsx` | No autoplay on resume | VERIFIED | `pl.play()` absent from `initialTime` branch; only remains in `pendingSeekRef` (intentional) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `learn/page.tsx` | URL searchParams | `useSearchParams` + `router.replace` | WIRED | `router.replace(query ? \`${pathname}?${query}\` : pathname)` at line 93 |
| `comments.ts` | `CommentItem.tsx` | tRPC response user.name field | WIRED | `sanitizeUserName(c.user.name)` mapped before return; `CommentItem` already uses `comment.user.name \|\| 'Пользователь'` |

### Data-Flow Trace (Level 4)

Not applicable — no new data-rendering components introduced. Existing components receive sanitized data from existing tRPC endpoints.

### Behavioral Spot-Checks

Step 7b: SKIPPED — changes require browser interaction (navigation, OAuth redirect, video resume) that cannot be tested without a running server.

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|-------------|-------------|--------|
| R21 | 40-01 | Filter state persists in URL | SATISFIED — `useSearchParams`/`router.replace` pattern implemented |
| R46 | 40-01 | Tour does not repeat within session | SATISFIED — `hasAutoStartedRef` session guard prevents re-trigger |
| R43 | 40-02 | Email not exposed in comment author names | SATISFIED — `sanitizeUserName` strips email-like names server-side |
| R10 | 40-02 | Yandex OAuth allows account switch | SATISFIED — `prompt: 'login'` forces account chooser |
| R22 | 40-02 | Video autoplay consistent (no autoplay on resume) | SATISFIED — `pl.play()` removed from `initialTime` branch |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TODOs, placeholders, or stub implementations found in modified files.

### Human Verification Required

#### 1. Filter URL persistence — browser navigation

**Test:** On /learn, set category filter to "Маркетинг", click a lesson, press browser Back.
**Expected:** URL shows `?category=MARKETING`, filter state is restored to "Маркетинг".
**Why human:** Requires browser navigation with real Next.js routing.

#### 2. Tour no-repeat — session guard

**Test:** Open /learn, let tour auto-start and complete it. Without closing browser, navigate away and return to /learn.
**Expected:** Tour does NOT start again on second visit within same tab session.
**Why human:** Requires real browser session state; `localStorage.clear()` needed for clean test.

#### 3. Yandex OAuth account chooser

**Test:** Click "Войти через Яндекс" while already logged into a Yandex account in browser.
**Expected:** Yandex shows account selection/login screen instead of silently reusing existing session.
**Why human:** Requires active Yandex session in browser; cannot test without OAuth redirect.

#### 4. Comment email masking

**Test:** Find a user whose Supabase `UserProfile.name` was set to their email address (legacy behavior), open a lesson, check comments authored by that user.
**Expected:** Author displays as "Пользователь", not as an email address.
**Why human:** Requires a real legacy user record in the database.

#### 5. Video no-autoplay on resume

**Test:** Watch 30 seconds of a lesson video, navigate away, return to the same lesson.
**Expected:** Video seeks to ~30 seconds but does NOT start playing automatically — user must press Play.
**Why human:** Requires Kinescope player to load and resume, which needs a real browser + valid Kinescope session.

### Gaps Summary

No gaps. All 5 must-have truths verified against actual code. All artifacts exist, are substantive, and are wired correctly. Commits `124c562`, `f501c3b`, `83ae6c9` confirmed in git history.

---

_Verified: 2026-03-27T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
