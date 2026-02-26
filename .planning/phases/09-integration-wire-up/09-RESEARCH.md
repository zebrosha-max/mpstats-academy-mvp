# Phase 9: Integration Wire-Up - Research

**Researched:** 2026-02-26
**Domain:** Integration gaps closure (profile data wiring, seekTo verification, UI polish)
**Confidence:** HIGH

## Summary

Phase 9 addresses three integration gaps identified in the v1.0 milestone audit. After thorough codebase analysis, the actual work is smaller than initially scoped because **SC #2 (dashboard recommended track progress) is DEFERRED** per CONTEXT.md.

The remaining two tasks are: (1) wire-up profile diagnostic history to use `getCompletedSessions` from diagnostic router (currently profile router queries DiagnosticSession directly, duplicating logic), and (2) verify that Kinescope postMessage seekTo works end-to-end (the TimecodeLink component already exists and is integrated in both summary and chat panels).

**Primary recommendation:** This is a verification and polish phase, not a building phase. The core infrastructure is already in place. Focus on confirming existing wiring works, eliminating duplicated queries, and ensuring seekTo functions correctly in production.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Wire-up: profile router uses getCompletedSessions instead of direct DB query
- UI: diagnostic history page polish allowed during wire-up
- seekTo: clickable timecodes in BOTH AI summary AND chat panels
- Visual: timecodes as "play icon + MM:SS" in mp-blue, styled as links
- Behavior: seekTo + autoplay on click
- Mechanism: postMessage API to Kinescope iframe
- **DEFERRED:** Dashboard recommended track progress widget (SC #2)

### Claude's Discretion
- Data fields per diagnostic session in profile (date, score, skill axes)
- Session list format and navigation (click to results page vs inline expand)
- Skill trend graph -- decide based on implementation complexity
- Edge case: seekTo behavior when iframe not loaded or not in viewport

### Deferred Ideas (OUT OF SCOPE)
- Video watch tracking (Kinescope events to LessonProgress)
- Recommended track progress widget on dashboard ("X/N lessons completed")
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-05 | Diagnostic router saves sessions in Supabase (not globalThis) | Already complete in Phase 1. Phase 9 addresses AUDIT gap: profile router should USE getCompletedSessions helper instead of raw Prisma query |
| DATA-06 | Profile router reads real data from DiagnosticSession/SkillProfile | Already complete in Phase 1. Phase 9 closes audit gap: profile.getDashboard queries DiagnosticSession directly instead of using shared getCompletedSessions |
| DATA-07 | Dashboard displays real statistics | Already complete. Dashboard progress widget DEFERRED per CONTEXT.md |
| VIDEO-03 | Timecode seek -- click timecode in RAG chat seeks video | Infrastructure exists (TimecodeLink + KinescopePlayer + postMessage). Phase 9 = verification + visual polish per CONTEXT.md specs |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Next.js | 14 | App Router framework | Deployed |
| tRPC | 11.x | Type-safe API | All routers wired |
| Prisma | 5.x | ORM | Schema stable |
| Supabase | - | PostgreSQL + Auth | Production |

### No New Dependencies Needed

This phase requires zero new packages. All components exist:
- `TimecodeLink` component: `apps/web/src/components/video/TimecodeLink.tsx`
- `VideoPlayer` (KinescopePlayer): `apps/web/src/components/video/KinescopePlayer.tsx`
- `getCompletedSessions`: `packages/api/src/routers/diagnostic.ts` (line 183)
- `getHistory` endpoint: `packages/api/src/routers/diagnostic.ts` (line 597)
- Profile history page: `apps/web/src/app/(main)/profile/history/page.tsx`

## Architecture Patterns

### Current State Analysis

#### Gap 1: Profile Router Does Not Use getCompletedSessions

**What exists:**
- `diagnostic.ts` exports `getCompletedSessions(prisma, userId)` (line 183) -- fetches COMPLETED sessions
- `diagnostic.ts` has `getHistory` endpoint (line 597) -- fetches COMPLETED sessions with answers, calculates score
- `profile.ts` `getDashboard` (line 159) -- queries `diagnosticSession.findMany` DIRECTLY (line 171)
- Profile history page calls `trpc.diagnostic.getHistory` -- this already works with real DB data

**The actual gap:** Profile router's `getDashboard` duplicates the query that `getCompletedSessions` provides. The audit flagged this as "getCompletedSessions exported but not called in profile router". However, `getHistory` endpoint in diagnostic router already returns the right data to the history page.

**Fix pattern:** Replace inline `ctx.prisma.diagnosticSession.findMany(...)` in profile.getDashboard with `getCompletedSessions(ctx.prisma, ctx.user.id)`. This is a 1-line refactor, not a feature build.

#### Gap 2: TimecodeLink Already Works

**What exists:**
- `TimecodeLink.tsx` renders a styled button with play icon + formatted time
- Both summary sources and chat sources render `<TimecodeLink>` components
- `handleTimecodeClick` in lesson page calls `playerRef.current?.seekTo(seconds)`
- `VideoPlayer` uses `postMessage(JSON.stringify({ method, params }), 'https://kinescope.io')`
- Ready event listener with pending seek queue

**The audit gap:** "KinescopePlayer rewritten to iframe+postMessage -- seekTo ref API may differ". The concern is that after the rewrite from `@kinescope/react-kinescope-player` to direct iframe, the postMessage format may not match what Kinescope expects.

**Verification needed:** Manual test on production -- click a timecode, confirm video seeks. If it works (audit line 150 says "Chat timecode -> Video seek" was human-verified), this is already closed.

#### Gap 3: Dashboard Progress Widget -- DEFERRED

Per CONTEXT.md, this is explicitly out of scope. No work needed.

### Recommended Task Structure

```
Task 1: Profile wire-up + history polish
  - Replace direct diagnosticSession query with getCompletedSessions
  - Optionally enhance history page with per-axis scores

Task 2: seekTo verification + visual polish
  - Verify postMessage seekTo works in production
  - Ensure TimecodeLink visual matches CONTEXT.md spec ("play + MM:SS" in mp-blue)
  - Handle edge cases (iframe not ready, no videoId)
```

### Anti-Patterns to Avoid
- **Over-engineering the history page:** It already works. Don't rebuild it -- just wire-up the helper and polish.
- **Replacing working postMessage with the broken npm package:** `@kinescope/react-kinescope-player` is confirmed broken. Keep iframe + postMessage.
- **Building the dashboard widget:** Explicitly deferred. Do not touch dashboard.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Diagnostic history data | New endpoint | Existing `diagnostic.getHistory` | Already returns id, status, startedAt, completedAt, score |
| Completed sessions list | New query | `getCompletedSessions()` from diagnostic.ts | Already exported, tested, used internally |
| Timecode UI | New component | Existing `TimecodeLink` | Already styled, handles disabled state |
| Video seek | Custom player API | Existing `VideoPlayer.seekTo` via postMessage | Already handles ready state, pending seeks |

## Common Pitfalls

### Pitfall 1: Kinescope postMessage Format Mismatch
**What goes wrong:** The `JSON.stringify({ method, params })` format may not match Kinescope's expected protocol
**Why it happens:** No official documentation found for Kinescope's postMessage API. The implementation was based on reverse-engineering.
**How to avoid:** Test on production. The audit already confirmed "Chat timecode -> Video seek" works (line 150). If it works, don't change it.
**Warning signs:** seekTo silently fails (no error, video doesn't move)

### Pitfall 2: getCompletedSessions Returns Different Shape
**What goes wrong:** `getCompletedSessions` returns raw DiagnosticSession objects without calculated score. The profile dashboard expects different fields.
**Why it happens:** `getCompletedSessions` returns `prisma.diagnosticSession.findMany(...)` without `.include({ answers: true })`, so there's no score calculation.
**How to avoid:** Check if the consumer (getDashboard) needs score. Currently getDashboard just counts sessions and uses them for streak calculation -- it does NOT need scores. So `getCompletedSessions` is sufficient.
**Warning signs:** TypeScript compile error if shape mismatch.

### Pitfall 3: Breaking History Page While "Improving" It
**What goes wrong:** The history page (`/profile/history`) already uses `trpc.diagnostic.getHistory` and renders correctly. Adding too much polish could break the working UI.
**Why it happens:** Desire to add skill axes per session, trend graphs, etc.
**How to avoid:** Keep changes minimal. Only add data that the `getHistory` endpoint already returns or can easily include.

### Pitfall 4: Forgetting postMessage Origin Check
**What goes wrong:** seekTo messages sent without proper origin targeting could be caught by other iframes
**How to avoid:** Already handled -- `postMessage` sends to `'https://kinescope.io'` origin. Keep this.

## Code Examples

### Current getCompletedSessions (diagnostic.ts:183)
```typescript
// Source: packages/api/src/routers/diagnostic.ts
export async function getCompletedSessions(prisma: PrismaClient, userId: string) {
  return prisma.diagnosticSession.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
  });
}
```

### Current getDashboard Query to Replace (profile.ts:171)
```typescript
// Source: packages/api/src/routers/profile.ts, line 171
// CURRENT (duplicated query):
ctx.prisma.diagnosticSession.findMany({
  where: { userId: ctx.user.id, status: 'COMPLETED' },
  orderBy: { completedAt: 'desc' },
  take: 10,
}),

// REPLACE WITH:
getCompletedSessions(ctx.prisma, ctx.user.id),
// Note: getCompletedSessions has no `take: 10` limit.
// Decide: add limit parameter or use .slice(0, 10) on result.
```

### Current TimecodeLink Usage (lesson page, both panels)
```typescript
// Source: apps/web/src/app/(main)/learn/[id]/page.tsx
// Summary panel (line 388):
<TimecodeLink
  startSeconds={source.timecode_start}
  formattedTime={source.timecodeFormatted}
  onSeek={handleTimecodeClick}
  disabled={!lesson.videoId}
/>

// Chat panel (line 461):
<TimecodeLink
  startSeconds={src.timecode_start}
  formattedTime={src.timecodeFormatted}
  onSeek={handleTimecodeClick}
  disabled={!lesson.videoId}
/>
```

### TimecodeLink Visual (already matches CONTEXT.md spec)
```typescript
// Source: apps/web/src/components/video/TimecodeLink.tsx
// Already has: play icon SVG + formattedTime, mp-blue-600 color, mp-blue-50 bg
// CONTEXT.md wants: "play + 02:15" in mp-blue, looks like a link
// Current format: "play + MM:SS - MM:SS" (range format from sources)
// Decision: format is driven by `formattedTime` prop which comes from
//   `timecodeFormatted: ${formatTimecode(start)} - ${formatTimecode(end)}`
// To show just start time, change the formattedTime passed, not the component.
```

## State of the Art

| Component | Current State | What Phase 9 Does |
|-----------|--------------|-------------------|
| Profile getDashboard | Queries DiagnosticSession directly | Refactor to use getCompletedSessions |
| History page | Works with real data via getHistory | Optional polish (add axes, trend) |
| TimecodeLink in summary | Working, renders in sources section | Verify + minor visual tweaks |
| TimecodeLink in chat | Working, renders in chat sources | Verify + minor visual tweaks |
| KinescopePlayer seekTo | postMessage implementation with ready queue | Verify on production |
| Dashboard progress | Shows real stats (lessons, time, streak) | NOT TOUCHED (deferred) |

## Open Questions

1. **Should getCompletedSessions accept a `take` limit?**
   - What we know: Current profile.getDashboard uses `take: 10`. `getCompletedSessions` has no limit.
   - What's unclear: Whether unbounded query is acceptable for users with many sessions
   - Recommendation: Add optional `limit` parameter to `getCompletedSessions`, or `.slice()` on caller side. For MVP with few users, either is fine.

2. **Should history page show per-axis scores?**
   - What we know: `getHistory` returns overall score (correctAnswers/totalAnswers). SkillProfile stores per-axis scores but is overwritten on each new diagnostic (not historical).
   - What's unclear: Can we show per-axis breakdown per session without schema change?
   - Recommendation: Per-axis scores per session require computing from DiagnosticAnswer + question skillCategory. This is doable without schema change but adds complexity. Claude's Discretion -- recommend keeping simple for MVP.

3. **Is Kinescope postMessage format correct?**
   - What we know: Audit says "Chat timecode -> Video seek" was human-verified on production. Current format: `JSON.stringify({ method: 'seekTo', params: [seconds] })`.
   - What's unclear: Official Kinescope postMessage protocol not documented publicly.
   - Recommendation: If it works in production, it's correct. Verify manually, document the format, move on.

## Sources

### Primary (HIGH confidence)
- `packages/api/src/routers/profile.ts` -- full file read, confirmed no getCompletedSessions usage
- `packages/api/src/routers/diagnostic.ts` -- confirmed getCompletedSessions export (line 183) and getHistory endpoint (line 597)
- `apps/web/src/components/video/KinescopePlayer.tsx` -- full file read, postMessage implementation confirmed
- `apps/web/src/components/video/TimecodeLink.tsx` -- full file read, visual spec confirmed
- `apps/web/src/app/(main)/learn/[id]/page.tsx` -- both summary and chat panels use TimecodeLink
- `apps/web/src/app/(main)/profile/history/page.tsx` -- already uses trpc.diagnostic.getHistory
- `.planning/v1.0-MILESTONE-AUDIT.md` -- gap definitions and flow verification status

### Secondary (MEDIUM confidence)
- [Kinescope GitHub](https://github.com/kinescope) -- confirmed player-iframe-api-loader exists but docs unavailable
- [Kinescope docs reference](https://docs.kinescope.io/player/latest/embed/iframe-api/) -- referenced in GitHub but timed out during fetch

### Tertiary (LOW confidence)
- Kinescope postMessage protocol format -- based on working production implementation, not official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all code examined
- Architecture: HIGH -- all relevant files read, gaps clearly identified
- Pitfalls: HIGH -- based on actual code analysis and audit findings

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable -- no external dependency changes expected)
