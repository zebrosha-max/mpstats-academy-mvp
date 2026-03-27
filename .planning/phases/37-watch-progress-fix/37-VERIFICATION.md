---
phase: 37-watch-progress-fix
verified: 2026-03-27T09:30:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 37: Watch Progress Fix — Verification Report

**Phase Goal:** Просмотр урока до конца корректно отмечает 100% прогресса и статус COMPLETED. Счётчики "Завершено" и "X/Y завершено" согласованы.
**Verified:** 2026-03-27
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Watching a video to 90%+ marks it COMPLETED with toast notification | VERIFIED | `toast.success('Урок завершён!')` in onSuccess when `result?.status === 'COMPLETED'`, guarded by `completedRef` one-shot |
| 2 | Progress percent matches actual watch position vs DB duration | VERIFIED | Timer only fires `onTimeUpdateRef.current?.(position, knownDuration)` when `knownDuration > 0`; `position * 1.1` estimation completely removed |
| 3 | Top stats card 'Завершено' matches track progress bar 'X/Y завершено' | VERIFIED | Both read from same `stats` object: `completed: recommendedPath?.completedLessons ?? path?.completedLessons ?? 0` (line 278, 402) |
| 4 | Clicking 'Следующий урок' does not increment current lesson progress | VERIFIED | "Следующий" button is a plain `<Link href=...>` (line 754) — no mutation called; only `completeLesson.mutate` on explicit "Завершить урок" button |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/video/KinescopePlayer.tsx` | Timer fallback using DB duration only | VERIFIED | `if (knownDuration > 0)` guard at lines 144 and 149; `position * 1.1` absent |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | Auto-complete toast on COMPLETED status | VERIFIED | `toast.success('Урок завершён!')` at line 345 with `completedRef` one-shot guard |
| `apps/web/src/app/(main)/learn/page.tsx` | Unified counter source | VERIFIED | `recommendedPath?.completedLessons ?? path?.completedLessons ?? 0` at line 278 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| KinescopePlayer.tsx | learn/[id]/page.tsx | onTimeUpdate callback with knownDuration | WIRED | `onTimeUpdateRef.current?.(position, knownDuration)` (line 150); guard `if (knownDuration > 0)` present at line 149 |
| learn/[id]/page.tsx | learning.ts saveWatchProgress | tRPC mutation | WIRED | `saveWatchProgressRef.current.mutate({...})` at lines 373, 400, 417 |
| learn/page.tsx stats | recommendedPath | stats object derivation | WIRED | `recommendedPath?.completedLessons ?? path?.completedLessons ?? 0` at line 278; rendered at line 402 (`stats.completed`) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| learn/page.tsx (stats card) | `stats.completed` | `recommendedPath?.completedLessons` from tRPC `getRecommendedPath` | Yes — tRPC query from Prisma DB | FLOWING |
| learn/[id]/page.tsx (toast) | `result.status` | tRPC `saveWatchProgress` mutation return | Yes — mutation returns live DB status | FLOWING |
| KinescopePlayer.tsx (timer) | `knownDuration` | `durationSeconds` prop from lesson page | Yes — sourced from DB `lesson.duration * 60` | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running browser session to trigger video playback events. No stateless CLI entry points available for this behavior.

### Requirements Coverage

No requirement IDs were declared for this phase. Goal-derived truths cover audit items R24–R27 from the platform audit backlog.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| KinescopePlayer.tsx | 159 | `console.log` in timer start | Info | Dev log only, no user impact |
| learn/[id]/page.tsx | 352 | `console.warn` in onError | Info | Expected error logging pattern |

No blockers or stubs found.

### Human Verification Required

#### 1. Watch-to-completion toast fires at 90%+

**Test:** Open a lesson with known duration. Watch video timer past 90% of DB duration (or wait ~90 seconds for a ~100s lesson). Save interval is 15s.
**Expected:** After the next 15s save interval, a "Урок завершён!" toast appears once. Subsequent saves do not re-trigger the toast.
**Why human:** Requires live video playback and wall-clock waiting for timer intervals.

#### 2. Stats counter increments after toast

**Test:** On the learn page, note the "Завершено" count. Complete a lesson via video. Navigate back to learn page.
**Expected:** "Завершено" stat card and "X/Y уроков завершено" progress bar both increment by 1 and agree with each other.
**Why human:** Requires cross-page navigation and live query invalidation verification.

#### 3. "Следующий" button does not increment progress of current lesson

**Test:** Open a lesson at 0% progress. Click "Следующий" without watching any video. Check DB / lesson status on return.
**Expected:** Current lesson remains NOT_STARTED or at whatever progress it was before; only the next lesson page opens.
**Why human:** Requires checking DB state after navigation.

### Gaps Summary

No gaps found. All 4 observable truths are verified in the codebase:

- `position * 1.1` estimation is completely removed from KinescopePlayer timer fallback
- `onTimeUpdate` fires only when `knownDuration > 0` (real DB value)
- Auto-complete toast with `completedRef` one-shot guard is in place
- `useEffect` syncs `completedRef` on page load for already-completed lessons (deviation from plan, correctly auto-fixed)
- Learn page `stats` object uses nullish coalescing with `recommendedPath` as primary source
- Both "Завершено" stat card and "X/Y завершено" progress bar read from the same `stats.completed`
- "Следующий" button is a plain link, not a mutation trigger

Commits `6e4aa8b` and `f4cc9da` confirmed in git history.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
