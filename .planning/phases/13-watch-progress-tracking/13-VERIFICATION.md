---
phase: 13-watch-progress-tracking
verified: 2026-02-27T10:15:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 13: Watch Progress Tracking Verification Report

**Phase Goal:** Пользователь видит свой прогресс просмотра видео и может продолжить с последней позиции
**Verified:** 2026-02-27T10:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | При просмотре видео позиция и процент сохраняются в базу данных автоматически | VERIFIED | `saveWatchProgress` mutation wired to `handleTimeUpdate` with 15s debounce in lesson page; `sendBeacon` on unload. Verified in `apps/web/src/app/(main)/learn/[id]/page.tsx` |
| 2 | На карточках уроков отображается прогресс-бар с процентом просмотра | VERIFIED | `LessonCard.tsx` renders progress bar whenever `lesson.watchedPercent > 0` — blue for IN_PROGRESS, green for COMPLETED |
| 3 | При повторном открытии урока видео начинает воспроизведение с последней сохранённой позиции | VERIFIED | `getWatchProgress.useQuery` fetches saved position; `initialTime={watchProgress?.lastPosition}` passed to `VideoPlayer`; `seekTo(initialTime)` called after player creation with "Продолжаем с X:XX" notice |
| 4 | На странице курса отображается общий процент завершения на основе просмотренных видео | VERIFIED | `learn/page.tsx` reads `course.progressPercent`; `getCourses` calculates weighted average of `watchedPercent` across lessons with `videoId != null` |

**Score: 4/4 success criteria verified**

---

### Required Artifacts

#### Plan 13-01

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/prisma/schema.prisma` | LessonProgress model with lastPosition field | VERIFIED | Lines 139-140: `lastPosition Int @default(0)` and `videoDuration Int @default(0)` present |
| `packages/api/src/routers/learning.ts` | saveWatchProgress mutation and getWatchProgress query | VERIFIED | `saveWatchProgress` (line 457), `getWatchProgress` (line 426) both substantive — full DB upsert with position/percent calculation |
| `apps/web/src/components/video/KinescopePlayer.tsx` | onTimeUpdate callback and getCurrentTime on PlayerHandle | VERIFIED | `PlayerHandle.getCurrentTime` (line 15), `onTimeUpdate` prop (line 21), 10s `setInterval` polling (line 193) |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | Debounced progress saving and resume-from-position on load | VERIFIED | `handleTimeUpdate` with 15s debounce (line 87-102), `getWatchProgress.useQuery` (line 68), `initialTime={watchProgress?.lastPosition}` (line 304) |

#### Plan 13-02

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/learning/LessonCard.tsx` | Progress bar for all lessons with watchedPercent > 0 | VERIFIED | Renders progress bar when `lesson.watchedPercent > 0` (line 116), shows percentage and color-coded bar |
| `apps/web/src/app/(main)/learn/page.tsx` | Course-level progress percentage in course header | VERIFIED | `course.progressPercent` displayed with color-coded bar, "Курс завершён" badge, "Продолжить просмотр" button |
| `packages/api/src/routers/learning.ts` | getCourses returns progressPercent based on video watch data | VERIFIED | Weighted average: `sum(watchedPercent) / lessonsWithVideo.length` for both `getCourses` and `getCourse` |
| `packages/api/src/routers/admin.ts` | getWatchStats procedure for admin panel | VERIFIED | `getWatchStats` adminProcedure (line 536) returns `avgWatchPercent`, `totalWatchSessions`, `completionRate`, `courseEngagement`, `topActiveUsers` |

---

### Key Link Verification

#### Plan 13-01

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `learn/[id]/page.tsx` | `routers/learning.ts` | `trpc.learning.saveWatchProgress.useMutation()` | WIRED | Called as `saveWatchProgress.mutate({lessonId, position, duration})` on timer and unload |
| `KinescopePlayer.tsx` | `learn/[id]/page.tsx` | `onTimeUpdate` callback prop | WIRED | Prop passed at line 303; `intervalRef` calls `onTimeUpdateRef.current?.(time, dur)` every 10s |

#### Plan 13-02

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `LessonCard.tsx` | `LessonWithProgress` type | `lesson.watchedPercent` field | WIRED | Directly reads `lesson.watchedPercent` from prop |
| `learn/page.tsx` | `routers/learning.ts` | `trpc.learning.getCourses.useQuery()` | WIRED | Query at line 41; renders `course.progressPercent` from returned data |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WATCH-01 | 13-01 | Прогресс просмотра видео сохраняется в БД (позиция + процент) | SATISFIED | `saveWatchProgress` mutation persists `lastPosition`, `watchedPercent`, `videoDuration` via upsert on `LessonProgress` |
| WATCH-02 | 13-02 | Прогресс-бар просмотра отображается на карточках уроков | SATISFIED | `LessonCard.tsx` renders progress bar for all `watchedPercent > 0` lessons with color-coded bars |
| WATCH-03 | 13-01 | Возобновление просмотра с последней сохранённой позиции | SATISFIED | `getWatchProgress` query + `initialTime` prop + `seekTo()` in player init + "Продолжаем с X:XX" visual notice |
| WATCH-04 | 13-02 | Процент завершения курса рассчитывается на основе просмотренных видео | SATISFIED | `getCourses`/`getCourse` both calculate weighted average of per-lesson `watchedPercent` (lessons without `videoId` excluded) |

**All 4 WATCH requirements satisfied. No orphaned requirements.**

---

### Anti-Patterns Found

No significant anti-patterns found. Specific checks:

- No `TODO`/`FIXME`/`PLACEHOLDER` comments in modified files related to core functionality
- No `return null` or empty return stubs in `saveWatchProgress` or `getWatchProgress`
- `onTimeUpdate` correctly uses ref pattern to avoid re-render storms (`onTimeUpdateRef.current = onTimeUpdate`)
- Debounce implemented with `useRef` timeout, not state — no re-render side effects
- `< 5 second` guard on save prevents noise from page loads

One minor note (non-blocking):
- `sendBeacon` call at unload passes a JSON-in-JSON payload (`JSON.stringify({ json: payload })` where `payload` is already a JSON string). This could cause a parsing issue on the server if the tRPC handler expects proper batched JSON. The fallback mutation (`saveWatchProgress.mutate`) handles the same unload, making this non-critical — worst case is the beacon fails silently and the fallback runs.

---

### Human Verification Required

#### 1. Resume playback position

**Test:** Open any lesson with a video, play for 30+ seconds, navigate away, return to the same lesson.
**Expected:** Video seeks to approximately where you left off and shows "Продолжаем с X:XX" notification for 3 seconds.
**Why human:** Requires actual browser + Kinescope player interaction; cannot verify postMessage timing and seekTo behavior programmatically.

#### 2. Debounced save network calls

**Test:** Open a lesson, play video, watch Network tab in DevTools.
**Expected:** `saveWatchProgress` network calls appear approximately every 15 seconds during playback (not on every tick).
**Why human:** Requires live browser + network observation; grep cannot verify runtime debounce behavior.

#### 3. Course progress bar on /learn page

**Test:** After watching part of a lesson, go to /learn page and check the course accordion header.
**Expected:** Blue progress bar appears under the course title with "X% завершено" text. At 100%: green bar + "Курс завершён" badge.
**Why human:** Requires actual watch data in DB to trigger the progress display condition.

---

### Commit Verification

| Commit | Description | Files |
|--------|-------------|-------|
| `c50d000` | feat(13-01): add watch progress persistence endpoints | `schema.prisma`, `learning.ts` |
| `0fb36e9` | feat(13-01): wire Kinescope time tracking and lesson page save/restore | `KinescopePlayer.tsx`, `learn/[id]/page.tsx` |
| `afbf698` | feat(13-02): progress bars on lesson cards and course headers | `LessonCard.tsx`, `learn/page.tsx`, `learning.ts` |
| `66014eb` | feat(13-02): admin watch engagement stats on analytics page | `admin.ts`, `admin/analytics/page.tsx` |

All 4 commits verified present in git history.

---

## Summary

Phase 13 goal is fully achieved. All 4 success criteria are met by substantive, wired implementations:

1. **WATCH-01 + WATCH-03 (Plan 13-01):** The full save/restore loop is in place. Kinescope IframePlayer polls `getCurrentTime()`/`getDuration()` every 10 seconds via `setInterval`. The lesson page debounces saves to 15 seconds, guards against sub-5-second noise, and uses `sendBeacon`+mutation fallback on unload. Resume works via `initialTime` prop passed to player on load.

2. **WATCH-02 + WATCH-04 (Plan 13-02):** Progress bars appear on lesson cards for any `watchedPercent > 0` with color-coded bars (blue/green). Course headers show weighted-average `progressPercent` (excluding no-video lessons) with a "Продолжить просмотр" button. Admin analytics page has a full "Вовлечённость в видео" section with KPI cards, per-course table, and top-5 users table.

No gaps. Three human verification items remain for runtime behavior confirmation.

---

_Verified: 2026-02-27T10:15:00Z_
_Verifier: Claude Sonnet 4.6 (gsd-verifier)_
