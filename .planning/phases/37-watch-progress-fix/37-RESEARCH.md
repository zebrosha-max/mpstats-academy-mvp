# Phase 37: Watch Progress Fix - Research

**Researched:** 2026-03-27
**Domain:** Video watch progress tracking, Kinescope player integration, tRPC mutations
**Confidence:** HIGH

## Summary

Phase 37 is a pure bugfix phase targeting 4 related bugs in the lesson watch progress system. The root causes are well-understood through code analysis: (1) the timer fallback in `KinescopePlayer.tsx` estimates duration as `position * 1.1` when `knownDuration` is 0, producing wildly wrong percentages; (2) the `saveWatchProgress` tRPC mutation receives this wrong duration from the frontend; (3) the stats counters on the learn page use data from two different queries (`getPath` vs `getRecommendedPath`) that count different sets of lessons; (4) there is no auto-complete mechanism when `saveWatchProgress` returns a COMPLETED status.

All fixes are localized to 3 files (KinescopePlayer.tsx, learn/[id]/page.tsx, learn/page.tsx) plus minor backend hardening in learning.ts. No new libraries, no schema changes, no migrations needed. Sonner toast is already installed and mounted in the root layout.

**Primary recommendation:** Fix the duration source in the timer fallback to use `durationSeconds` prop (already passed), add auto-complete toast on the lesson page, and unify counters to use `recommendedPath` data only.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Duration for percent calculation comes from DB (`Lesson.duration`, already populated for all 405 lessons), NOT from Kinescope player events. Timer fallback `position * 1.1` is removed.
- **D-02:** Duration passed to KinescopePlayer as prop `knownDuration` (in seconds, `Lesson.duration * 60`). Player uses it instead of estimated.
- **D-03:** Formula: `watchedPercent = Math.round((position / knownDuration) * 100)`. If `knownDuration === 0` or null -> don't save progress (division by zero guard).
- **D-04:** Auto-complete at 90%+: if `saveWatchProgress` returns `status: 'COMPLETED'` -> show toast "Урок завершён!" and update UI (badge, counters).
- **D-05:** Both counters ("N Завершено" top card and "X/Y завершено" in track progress) must use one source -- `recommendedPath.completedLessons`.
- **D-06:** Top counter "Завершено" takes data from same query as "X/Y завершено" (not from separate getPath).
- **D-07:** "Следующий" button -- navigation only, must NOT call saveWatchProgress or updateProgress. Current behavior (simple Link) is correct; ensure timer doesn't fire on navigation.

### Claude's Discretion
- Toast notification style and duration -- use existing sonner toast
- Exact debounce timing (15s) -- keep or change
- Loading states during progress updates

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Architecture Patterns

### Current Data Flow (buggy)

```
KinescopePlayer timer tick (1s)
  -> position += 1
  -> effectiveDuration = knownDuration > 0 ? knownDuration : position * 1.1   <-- BUG
  -> onTimeUpdate(position, effectiveDuration)
    -> learn/[id]/page.tsx handleTimeUpdate (15s throttle)
      -> saveWatchProgress.mutate({ lessonId, position, duration })
        -> backend: watchedPercent = position / duration * 100   <-- receives wrong duration
```

### Fixed Data Flow

```
KinescopePlayer timer tick (1s)
  -> position += 1 (capped at knownDuration)
  -> if knownDuration <= 0: skip onTimeUpdate entirely   <-- D-03 guard
  -> onTimeUpdate(position, knownDuration)   <-- always use DB duration
    -> learn/[id]/page.tsx handleTimeUpdate (15s throttle)
      -> saveWatchProgress.mutate({ lessonId, position, duration: knownDuration })
        -> backend: watchedPercent = position / duration * 100   <-- correct
        -> returns { status: 'COMPLETED' } when >= 90%
          -> frontend: toast("Урок завершён!") + invalidate queries   <-- D-04
```

### Counter Fix

**Current (buggy):**
- Top card "Завершено": `path?.completedLessons` (from `getPath` -- counts ALL 405 lessons)
- Progress bar "X/Y завершено": `recommendedPath.completedLessons` (from `getRecommendedPath` -- only recommended lessons, ~71)

**Fixed (D-05, D-06):**
- Both use `recommendedPath.completedLessons` / `recommendedPath.totalLessons`
- When no recommended path: use `path` as fallback (user without diagnostic)

### File Change Map

| File | Changes | Bug Fixed |
|------|---------|-----------|
| `apps/web/src/components/video/KinescopePlayer.tsx` | Remove `position * 1.1` fallback, skip onTimeUpdate when knownDuration <= 0 | R25, R26, R27 |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | Handle COMPLETED status from saveWatchProgress, show toast, invalidate queries | R25 |
| `apps/web/src/app/(main)/learn/page.tsx` | Unify stats to use recommendedPath data | R24 |
| `packages/api/src/routers/learning.ts` | Add server-side guard: reject saveWatchProgress when duration seems wrong (optional hardening) | defense in depth |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom notification component | `sonner` (already installed + mounted) | Already in `app/layout.tsx` as `<Toaster />`, used in learn/page.tsx |
| Query invalidation | Manual state management | tRPC `utils.invalidate()` | Already used in saveWatchProgress onSuccess |

## Common Pitfalls

### Pitfall 1: Timer cleanup on navigation
**What goes wrong:** When user clicks "Следующий урок" (Link), React unmounts the current page. The cleanup in `useEffect` fires `saveWatchProgressRef.current.mutate()` with the last known position/duration. If the timer was using wrong duration, this final save writes wrong data.
**How to avoid:** The timer fix (using knownDuration) must be applied BEFORE the cleanup save logic. No separate fix needed -- fixing the timer source fixes all saves.

### Pitfall 2: Division by zero when lesson.duration is NULL
**What goes wrong:** `Lesson.duration` is `Int?` (nullable). For lessons without duration, `lesson.duration * 60` = `NaN` or `0`.
**How to avoid:** Already handled by D-03: if `knownDuration === 0` or null, skip onTimeUpdate entirely. The `durationSeconds` prop is already passed as `lesson.duration ? lesson.duration * 60 : undefined`. In the player, `durationSeconds || 0` handles undefined.

### Pitfall 3: Auto-complete toast fires repeatedly
**What goes wrong:** After 90% is reached, every subsequent 15s save returns `status: 'COMPLETED'`, showing toast again and again.
**How to avoid:** Track completion state in a ref. Only show toast on first COMPLETED response. Or check `lesson.status` before showing -- if already COMPLETED, skip.

### Pitfall 4: Stale lesson data after auto-complete
**What goes wrong:** Badge shows "21% просмотрено" even after backend marks COMPLETED.
**How to avoid:** `invalidate({ lessonId })` in saveWatchProgress onSuccess already exists. After auto-complete, the badge will update on next render. Toast gives visual feedback immediately.

### Pitfall 5: sendBeacon on unload sends wrong duration
**What goes wrong:** The `handleBeforeUnload` function captures `lastDurationRef.current` which might still be the wrong estimated value if timer fallback was active.
**How to avoid:** Since the timer now uses knownDuration exclusively, `lastDurationRef` will always have the correct value. No separate fix needed.

### Pitfall 6: Counter shows 0 when no recommended path exists
**What goes wrong:** Switching stats to use `recommendedPath` only will show 0 for users who never ran diagnostic (no recommended path).
**How to avoid:** Use `recommendedPath` when available, fallback to `path` data. Or only show progress bar + counters when recommendedPath exists (current behavior already conditionally renders progress bar).

## Code Examples

### Fix 1: KinescopePlayer timer -- remove position * 1.1

```typescript
// KinescopePlayer.tsx, startTimerTracking function
const startTimerTracking = (startFrom: number) => {
  let position = startFrom;
  let isPageVisible = !document.hidden;
  const knownDuration = durationSeconds || 0;

  // ... visibilitychange handler ...

  const interval = setInterval(() => {
    if (!isPageVisible || destroyed) return;
    position += 1;
    if (knownDuration > 0) {
      position = Math.min(position, knownDuration);
    }
    currentTimeRef.current = position;
    // FIXED: only fire onTimeUpdate when we have a real duration (D-03)
    if (knownDuration > 0) {
      onTimeUpdateRef.current?.(position, knownDuration);
    }
  }, 1000);
};
```

### Fix 2: Auto-complete toast on lesson page

```typescript
// learn/[id]/page.tsx
import { toast } from 'sonner';

const completedRef = useRef(lesson.status === 'COMPLETED');

const saveWatchProgress = trpc.learning.saveWatchProgress.useMutation({
  onSuccess: (result) => {
    utils.learning.getLesson.invalidate({ lessonId });
    // Auto-complete toast (D-04)
    if (result?.status === 'COMPLETED' && !completedRef.current) {
      completedRef.current = true;
      toast.success('Урок завершён!');
      // Also invalidate learn page queries for counter update
      utils.learning.getRecommendedPath.invalidate();
      utils.learning.getPath.invalidate();
    }
  },
  onError: (err) => {
    console.warn('Failed to save watch progress:', err.message);
  },
});
```

### Fix 3: Unified counters on learn page

```typescript
// learn/page.tsx
const stats = {
  total: recommendedPath?.totalLessons ?? path?.totalLessons ?? 0,
  completed: recommendedPath?.completedLessons ?? path?.completedLessons ?? 0,
  inProgress: (recommendedPath?.lessons ?? path?.lessons ?? [])
    .filter(l => l.status === 'IN_PROGRESS').length,
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@kinescope/react-kinescope-player` | Direct iframe + timer fallback | 2026-02-25 | React component broken, timer is only tracking method |
| Timer estimates duration as `position * 1.1` | Duration from DB `Lesson.duration` | This phase | Correct percentage calculation |

## Open Questions

1. **Kinescope events recovery**
   - What we know: Events stopped working when Kinescope updated their iframe.player.js (broke v0.5.4)
   - What's unclear: Whether current Kinescope IframePlayer API events work with the factory.create approach
   - Recommendation: Keep the event subscription code as-is (lines 199-238). If events fire, they provide real-time data. Timer fallback activates after 5s timeout. This is fine for now -- not in scope for this phase.

2. **Duration precision**
   - What we know: `Lesson.duration` is stored in minutes (`Int?`), rounded up via `Math.ceil(seconds/60)`. Converting back: `duration * 60` gives an approximation (e.g., 15:36 video = 16 min in DB = 960s, but real duration is 936s).
   - What's unclear: Whether this 24-second discrepancy matters for the 90% threshold.
   - Recommendation: Acceptable. At 960s total, 90% = 864s. Real 90% of 936s = 842s. The difference (22s) means auto-complete fires slightly before true 90% -- this is fine for UX. No action needed.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `KinescopePlayer.tsx` (292 lines), `learning.ts` (955 lines), `learn/[id]/page.tsx`, `learn/page.tsx`
- Prisma schema: `LessonProgress` model, `Lesson.duration` field type
- CONTEXT.md decisions (D-01 through D-07)

## Metadata

**Confidence breakdown:**
- Bug root causes: HIGH -- verified by reading actual code, all 4 bugs traced to specific lines
- Fix approach: HIGH -- changes are minimal, no new dependencies, existing patterns (sonner, tRPC invalidation)
- Counter mismatch: HIGH -- confirmed `path` (getPath) vs `recommendedPath` (getRecommendedPath) use different lesson sets

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- no external dependencies changing)
