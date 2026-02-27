# Session Handoff — 2026-02-27 (session 2)

## Phase 13 (Watch Progress Tracking) — Timer Fallback Implemented, Needs Testing

### What Was Done This Session

**1. Root Cause Confirmed:**
- Kinescope IframePlayer API `player.Events` object EXISTS (not undefined)
- Events subscribed successfully via `player.Events.TimeUpdate` / `player.Events.DurationChange`
- BUT events never fire — postMessage bridge from iframe→parent is broken in Kinescope `latest`
- Console proof: `[KP] Subscribed via player.Events: Object` → 5s later → `[KP] Kinescope events not firing — activating timer fallback`
- `@kinescope/player-iframe-api-loader` npm does the same thing as our manual loader — won't fix
- Kinescope docs confirm no URL params to enable events

**2. Timer Fallback Implemented:**
- After 5s if Kinescope events silent → starts `setInterval(1000)` timer
- Page Visibility API pauses timer when tab hidden
- Works without known duration (lesson.duration=0 in DB for most lessons)
- `durationSeconds` prop added but gracefully handles 0/undefined

**3. Debounce→Throttle Bug Fixed:**
- `handleTimeUpdate` in lesson page used debounce (clearTimeout + setTimeout 15s)
- With timer calling every 1s, debounce NEVER fires (reset every second)
- Changed to throttle: first call schedules save, subsequent calls only update refs
- Only saves when position >= 5s

**4. Browser Testing Issue:**
- Browser automation `left_click` on PlayPlaceholder doesn't trigger React onClick
- `find` tool found the button but `ref` click also failed
- `document.querySelector('[role="button"]')` returns empty after page renders
- Likely: the PlayPlaceholder div renders but browser automation click doesn't bubble to React synthetic events
- **MANUAL testing needed** — open localhost:3000/learn/03_ai_m01_intro_001, click Play, check console for `[KP]` logs

### Files Changed

| File | Change |
|------|--------|
| `apps/web/src/components/video/KinescopePlayer.tsx` | Timer fallback, `durationSeconds` prop, multi-format event names, `Events?` optional |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` | `durationSeconds={lesson.duration * 60}` prop, debounce→throttle fix |

### What To Test Next (Manual)

1. Open http://localhost:3000/learn/03_ai_m01_intro_001
2. Open DevTools Console
3. Click the Play placeholder
4. Expect console logs:
   - `[KP] Subscribed via player.Events: {...}`
   - After 5s: `[KP] Kinescope events not firing — activating timer fallback`
   - `[KP] Timer tracking started: position=0s, knownDuration=0s`
5. After 20s total: check Network tab for `saveWatchProgress` POST request
6. If saveWatchProgress fires → progress tracking works!

### Known Issues

1. **lesson.duration = 0** for all lessons in DB — Kinescope video durations were never populated
   - Timer still works: position increments, effectiveDuration = `max(position * 1.1, 60)`
   - watchedPercent will be approximate but functional
   - Fix later: script to populate durations from Kinescope API or content_chunk data

2. **Timer doesn't detect pause** — if user pauses video within visible tab, timer keeps ticking
   - Only pauses on tab visibility change (Page Visibility API)
   - Acceptable for MVP — approximate progress is better than no progress

3. **Timer doesn't detect seek** — if user rewinds, position is wrong
   - seekTo via timecodes still works (IframePlayer API write path)
   - Timer position doesn't adjust on user seek within Kinescope player controls

### Architecture Decision

```
Kinescope IframePlayer API:
  ├── WORKS: factory.create(), seekTo(), play(), pause()  (parent→iframe postMessage)
  └── BROKEN: events, getCurrentTime(), getDuration()     (iframe→parent postMessage)

Solution: Hybrid approach
  ├── Primary: Subscribe to Kinescope events (future-proof if they fix it)
  ├── Fallback: Timer after 5s silence (current workaround)
  └── Duration: From DB prop, or estimated as max(position*1.1, 60)
```

### Commits Pending
- No commits yet — changes are unstaged
- Two files modified: KinescopePlayer.tsx, learn/[id]/page.tsx
