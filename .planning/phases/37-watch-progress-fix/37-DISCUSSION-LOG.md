# Phase 37: Watch Progress Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 37-watch-progress-fix
**Areas discussed:** Duration precision, Auto-complete threshold, Completion feedback, Counter unification
**Mode:** --auto (all decisions auto-selected)

---

## Duration Precision

| Option | Description | Selected |
|--------|-------------|----------|
| duration * 60 from DB | Up to 59s error, simple, no API calls | ✓ |
| Fetch exact seconds from Kinescope API | Precise but requires API call per lesson | |
| Store seconds in DB | Requires migration + re-fetch from Kinescope | |

**User's choice:** [auto] duration * 60 from DB (recommended default)
**Notes:** Lesson.duration already populated for all 405 lessons. 59s error at most — acceptable for progress %.

---

## Auto-complete Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 90% | Already in backend (learning.ts:590), proven | ✓ |
| Raise to 95% | Stricter but may frustrate users who skip outro | |
| Lower to 80% | More lenient | |

**User's choice:** [auto] Keep 90% (recommended default)
**Notes:** Backend already uses 90% in saveWatchProgress. No reason to change.

---

## Completion Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + badge update | Informative without blocking, uses existing patterns | ✓ |
| Badge update only | Silent, no notification | |
| Modal celebration | Heavy, interrupts flow | |

**User's choice:** [auto] Toast + badge update (recommended default)
**Notes:** Use sonner toast. Badge updates via tRPC query invalidation on saveWatchProgress.onSuccess.

---

## Counter Unification

| Option | Description | Selected |
|--------|-------------|----------|
| Single source (recommendedPath) | Both counters from same query, always consistent | ✓ |
| Keep separate + sync | More complex, risk of drift | |

**User's choice:** [auto] Single source — recommendedPath.completedLessons (recommended default)
**Notes:** Top counter and progress bar both read from getRecommendedPath response.

---

## Claude's Discretion

- Toast style and duration
- Debounce timing (keep 15s or adjust)
- Loading states during progress updates

## Deferred Ideas

None — discussion stayed within phase scope
