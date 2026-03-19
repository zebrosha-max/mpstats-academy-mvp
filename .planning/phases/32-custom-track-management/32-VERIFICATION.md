---
phase: 32-custom-track-management
verified: 2026-03-19T10:40:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 32: Custom Track Management — Verification Report

**Phase Goal:** Custom Track Management — ручное управление персональным треком (добавить/удалить уроки)
**Verified:** 2026-03-19T10:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01 — Backend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `addToTrack` creates LearningPath with custom section if user has no path | VERIFIED | `learning.ts:754` — creates sectioned path with `'Мои уроки'` title when path not found |
| 2 | `addToTrack` removes lesson from AI sections before adding to custom section (no duplicates) | VERIFIED | `learning.ts:796-807` — deduplication loop over sections before custom insert |
| 3 | `removeFromTrack` removes lesson from any section (custom or AI) | VERIFIED | `learning.ts:830+` — filters lessonIds across all sections |
| 4 | `rebuildTrack` regenerates AI sections while preserving custom section | VERIFIED | `learning.ts:876-941` — calls `generateSectionedPath`, then `unshift(customSection)` with dedup |
| 5 | Diagnostic completion preserves existing custom section in learning path | VERIFIED | `diagnostic.ts:753-767` — reads existing path, extracts custom section, prepends after AI path generation |

**Score Plan 01:** 5/5 truths verified

### Observable Truths (Plan 02 — Frontend)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | User sees '+' button on LessonCard in 'Vse kursy' mode to add lesson to track | VERIFIED | `LessonCard.tsx:155-176` — `onToggleTrack` button with '+' SVG renders conditionally; `learn/page.tsx:780-781` passes mutation callback |
| 7 | User sees checkmark on LessonCard in 'Vse kursy' mode for lessons already in track | VERIFIED | `LessonCard.tsx:170-176` — `inTrack ? checkmark SVG : plus SVG`; `learn/page.tsx:780` `inTrack={trackLessonIds.has(lesson.id)}` |
| 8 | User sees 'Ubrat' button on each lesson in 'Moi trek' view | VERIFIED | `LessonCard.tsx:183-197` — `onRemoveFromTrack` button; `learn/page.tsx:586` passes `removeFromTrackMutation` |
| 9 | User sees 'Moi uroki' section at the top of track, above AI sections | VERIFIED | Backend ensures custom section is `unshift`ed first; frontend renders `sections.map(...)` in order; `SECTION_STYLES.custom` with `bg-purple-50` defined at `learn/page.tsx:39` |
| 10 | User can rebuild AI track via 'Perestroit trek' button with confirmation dialog | VERIFIED | `learn/page.tsx:518-538` — `AlertDialog` with `AlertDialogContent`, `AlertDialogAction` calling `rebuildTrackMutation.mutate()` |
| 11 | Toast notifications appear on add/remove/rebuild actions | VERIFIED | `learn/page.tsx:129` `toast.success('Добавлено в трек')`, `:152` `toast.success('Убрано из трека')`, `:158` `toast.success('Трек перестроен')` |

**Score Plan 02:** 6/6 truths verified

**Total Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/types/index.ts` | `'custom'` in LearningPathSection id union, `addedAt` field | VERIFIED | Line 248: `id: 'errors' \| 'deepening' \| 'growth' \| 'advanced' \| 'custom'`; Line 252: `addedAt?: Record<string, string>` |
| `packages/api/src/routers/learning.ts` | `addToTrack`, `removeFromTrack`, `rebuildTrack` mutations + `pluralLessons` | VERIFIED | All three mutations at lines 740, 830, 876; `pluralLessons` at line 12 |
| `packages/api/src/routers/diagnostic.ts` | Custom section preservation + `export generateSectionedPath` | VERIFIED | `export async function generateSectionedPath` at line 240; custom preservation at lines 753-767 |
| `apps/web/src/components/learning/LessonCard.tsx` | `onToggleTrack`, `onRemoveFromTrack`, `inTrack` props | VERIFIED | Lines 14-16 props declared; lines 155-197 conditional rendering |
| `apps/web/src/app/(main)/learn/page.tsx` | Mutations wired, custom section, rebuild dialog, toasts | VERIFIED | All acceptance criteria patterns found |
| `apps/web/src/components/ui/alert-dialog.tsx` | AlertDialog shadcn component | VERIFIED | File exists (created during Plan 02 as deviation fix) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/learning.ts` | `packages/shared/src/types/index.ts` | `import parseLearningPath` | WIRED | Line 10: `import { generateSectionedPath } from './diagnostic'`; types imported from `@mpstats/shared` |
| `packages/api/src/routers/diagnostic.ts` | `packages/shared/src/types/index.ts` | `import parseLearningPath for custom section preservation` | WIRED | Line 10: `parseLearningPath` imported; `customSection` logic at line 755 |
| `apps/web/src/app/(main)/learn/page.tsx` | `packages/api/src/routers/learning.ts` | `trpc.learning.addToTrack.useMutation` | WIRED | Line 102: mutation declared; line 781: called in LessonCard `onToggleTrack` |
| `apps/web/src/app/(main)/learn/page.tsx` | `packages/api/src/routers/learning.ts` | `trpc.learning.removeFromTrack.useMutation` | WIRED | Line 133: mutation declared; line 586: `onRemoveFromTrack` callback wired |
| `apps/web/src/app/(main)/learn/page.tsx` | `packages/api/src/routers/learning.ts` | `trpc.learning.rebuildTrack.useMutation` | WIRED | Line 156: mutation declared; line 534: `AlertDialogAction onClick` calls `rebuildTrackMutation.mutate()` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRACK-01 | Plan 01 | LearningPathSection extends with `'custom'` id and `addedAt` field | SATISFIED | `types/index.ts:248,252` |
| TRACK-02 | Plan 01 | `addToTrack` mutation adds to "Мои уроки", creates LearningPath if absent | SATISFIED | `learning.ts:740-827` |
| TRACK-03 | Plan 01 | `removeFromTrack` deletes from any section (custom or AI) | SATISFIED | `learning.ts:830-874` |
| TRACK-04 | Plan 01 | `rebuildTrack` regenerates AI sections, preserves "Мои уроки" | SATISFIED | `learning.ts:876-945` |
| TRACK-05 | Plan 01 | Diagnostic completion preserves existing custom section | SATISFIED | `diagnostic.ts:753-767` |
| TRACK-06 | Plan 02 | '+' button on LessonCard in "Все курсы" view, toggle +/checkmark | SATISFIED | `LessonCard.tsx:155-176`, `learn/page.tsx:780-781` |
| TRACK-07 | Plan 02 | Remove button in "Мой трек" for any section | SATISFIED | `LessonCard.tsx:183-197`, `learn/page.tsx:586` |
| TRACK-08 | Plan 02 | "Мои уроки" section renders first with purple styling | SATISFIED | `learn/page.tsx:39` SECTION_STYLES.custom; backend `unshift` pattern |
| TRACK-09 | Plan 02 | "Перестроить трек" button with confirmation dialog | SATISFIED | `learn/page.tsx:518-538` AlertDialog |
| TRACK-10 | Plan 02 | Toast notifications on add/remove/rebuild via sonner | SATISFIED | `learn/page.tsx:129,152,158` |

All 10 TRACK requirements satisfied. No orphaned requirements.

---

## Anti-Patterns Found

No blocker or warning anti-patterns detected in modified files.

Checked files:
- `packages/shared/src/types/index.ts` — clean type extension
- `packages/api/src/routers/learning.ts` — no TODO/placeholder/empty returns in new mutations
- `packages/api/src/routers/diagnostic.ts` — custom preservation logic substantive
- `apps/web/src/components/learning/LessonCard.tsx` — conditional rendering, not stubs
- `apps/web/src/app/(main)/learn/page.tsx` — all three mutations with real logic and optimistic updates

---

## Human Verification Required

Plan 02 Task 3 was a `checkpoint:human-verify` gate. Per SUMMARY 32-02:

**Status: APPROVED** — user verified add/remove/rebuild end-to-end. One bug was found (static section descriptions) and fixed in commit `c42dd24` before approval was given.

The only remaining manual test that was explicitly skipped:
- Locked lesson add to track (admin bypass on localhost prevented realistic test). Not a blocker — the code path does not gate addToTrack on subscription status; this is a production verification item.

---

## Notable Decisions (No Action Required)

1. `rebuildTrack` uses `skillProfile.findUnique({ where: { userId } })` instead of plan's `findFirst({ where: { sessionId } })` — SkillProfile model has `userId @unique`, not `sessionId`. Fix was applied automatically and TypeScript confirms it.

2. `getRecommendedPath` query removed `enabled: hasDiagnostic === true` guard — users without diagnostic can now see custom-only tracks. CTA banner condition updated to `hasDiagnostic === false && !recommendedPath`.

3. `SECTION_DESCRIPTIONS` is now a dynamic function `(count) => string` computed from `section.lessons.length` at render time, not from stale generation-time data.

---

## Commit Verification

All commits referenced in SUMMARYs confirmed present in git log:

| Commit | Task | Status |
|--------|------|--------|
| `6178a18` | Plan 01 Task 1 — type extension + mutations | CONFIRMED |
| `be5f01b` | Plan 01 Task 2 — custom section preservation | CONFIRMED |
| `95a4e9d` | Plan 02 Task 1 — LessonCard toggle buttons | CONFIRMED |
| `677047e` | Plan 02 Task 2 — mutations wired, rebuild dialog | CONFIRMED |
| `c42dd24` | Plan 02 bugfix — dynamic section descriptions | CONFIRMED |

---

_Verified: 2026-03-19T10:40:00Z_
_Verifier: Claude (gsd-verifier)_
