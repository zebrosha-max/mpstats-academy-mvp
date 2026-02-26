---
phase: 07-lesson-course-name-cleanup
verified: 2026-02-26T08:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
human_verification:
  - test: "Visit https://academyal.duckdns.org/learn and inspect course titles, lesson titles, and visual numbering"
    expected: "Russian course names, clean lesson titles without .mp4 or underscores, sequential numbers 1. 2. 3..."
    why_human: "Production DB state can only be confirmed by querying Supabase or visually on the live site. Orchestrator confirmed this passed via browser automation per task prompt."
---

# Phase 7: Lesson & Course Name Cleanup — Verification Report

**Phase Goal:** Все 405 уроков, модули и 6 курсов отображаются с чистыми, human-readable названиями — без расширений файлов, технической нумерации и разделителей. Пользователь видит понятную структуру обучения.
**Verified:** 2026-02-26T08:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ни одно название урока не содержит `.mp4`, `.mov` или других расширений файлов | VERIFIED | `cleanLessonTitle()` in `scripts/utils/clean-titles.ts` line 15 removes all file extensions with regex `\.(mp4\|mov\|avi\|mkv\|webm\|flv)$i`. Script ran with `--apply` flag per 07-01-SUMMARY.md. |
| 2 | Названия модулей не содержат технических разделителей `_` и нумерации вида "Модуль N_" | VERIFIED | `cleanModuleDescription()` in `scripts/utils/clean-titles.ts` lines 58-61 removes `Модуль: ` prefix and `Модуль N_` duplicate. Remaining underscores converted to spaces or `:` separator. |
| 3 | Названия курсов не начинаются с технической нумерации ("1.", "2." и т.д.) | VERIFIED | `COURSE_NAMES` hardcoded map in `scripts/utils/clean-titles.ts` lines 85-110 provides clean Russian titles for all 6 courses. Applied by `cleanup-names.ts --apply` and baked into `seed-from-manifest.ts`. |
| 4 | Уроки внутри каждого модуля пронумерованы последовательно и логично | VERIFIED | `learn/page.tsx` lines 253-256 (track view) and lines 319-326 (courses view) both use `idx + 1` for sequential visual numbering. Fixed from `lesson.order` (which was per-module) per commit `466ba95`. |
| 5 | Изменения применены в production (academyal.duckdns.org) и проверены визуально | VERIFIED | 07-02-SUMMARY.md documents human visual verification checkpoint passed. Supabase is cloud DB shared between dev and prod — DB changes take effect immediately. Container redeployed to pick up UI numbering change. Commit `466ba95` includes final fix. |

**Score:** 5/5 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/cleanup/cleanup-names.ts` | One-time cleanup script with `--dry-run` flag, min 80 lines | VERIFIED | 135 lines. Has `--apply` flag check, fetches all lessons, applies `cleanLessonTitle()` and `cleanModuleDescription()`, updates courses from `COURSE_NAMES` map, uses `prisma.lesson.update()` and `prisma.course.update()`. |
| `scripts/utils/clean-titles.ts` | Shared module (DRY improvement): exports `cleanLessonTitle`, `cleanModuleDescription`, `COURSE_NAMES` | VERIFIED | 111 lines. Created as DRY improvement over inlining in both scripts. Fully substantive — all three exports have real implementations. |
| `scripts/seed/seed-from-manifest.ts` | Updated seed using `cleanLessonTitle` | VERIFIED | Line 14 imports from `../utils/clean-titles`. Line 192 calls `cleanLessonTitle(lesson.title_original)`. Line 193 calls `cleanModuleDescription(...)`. Lines 157-158 use `COURSE_NAMES` map for course titles. |
| `apps/web/src/app/(main)/learn/page.tsx` | Visual numbering using `idx + 1` | VERIFIED | Line 256: `lesson={{ ...lesson, title: \`${idx + 1}. ${lesson.title}\` }}` in track view. Line 322: same pattern in courses view. Both views covered. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/cleanup/cleanup-names.ts` | Supabase Lesson/Course tables | Prisma `update()` | WIRED | Line 61: `prisma.lesson.update(...)`. Lines 99-103: `prisma.course.update(...)`. Both calls conditional on `--apply` flag. |
| `scripts/seed/seed-from-manifest.ts` | `cleanLessonTitle` function | Import + call in upsert | WIRED | Import on line 14. Call on line 192 inside `prisma.lesson.upsert()` create/update data. |
| `scripts/cleanup/cleanup-names.ts` | `COURSE_NAMES` map | Import + iteration | WIRED | Import on line 17. Used in `Object.entries(COURSE_NAMES)` loop on line 77. |
| `apps/web/src/app/(main)/learn/page.tsx` | Visual numbering in rendered output | `idx + 1` spread into lesson prop | WIRED | `{ ...lesson, title: \`${idx + 1}. ${lesson.title}\` }` passed to `LessonCard` in both view modes. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NAMING-01 | 07-01-PLAN.md | Lesson titles cleaned (no .mp4, no numeric prefixes, no underscores) | SATISFIED | `cleanLessonTitle()` implements all three transformations. Script ran with `--apply`. |
| NAMING-02 | 07-01-PLAN.md | Module descriptions cleaned (no "Модуль: Модуль N_" prefix) | SATISFIED | `cleanModuleDescription()` removes prefix and cleans underscores. |
| NAMING-03 | 07-01-PLAN.md | Course names are clean Russian titles (no technical IDs) | SATISFIED | `COURSE_NAMES` map provides Russian titles for all 6 courses. Applied to DB and baked into seed. |
| NAMING-04 | 07-01-PLAN.md | Seed script produces clean names on re-run (regression prevention) | SATISFIED | `seed-from-manifest.ts` imports and uses `cleanLessonTitle()` and `COURSE_NAMES` in all upsert calls. |
| NAMING-05 | 07-02-PLAN.md | Changes applied to production and visually verified | SATISFIED | Docker container redeployed on VPS. Human visual verification checkpoint passed per 07-02-SUMMARY.md. |

**Note on REQUIREMENTS.md:** NAMING-01 through NAMING-05 are defined in ROADMAP.md Phase 7 section but are not present in `.planning/REQUIREMENTS.md` Traceability table. These are orphaned requirement IDs — REQUIREMENTS.md was not updated when Phase 7 was added to the roadmap. This is a documentation gap (not a functionality gap) — the work is done and the IDs are tracked in ROADMAP.md and the plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODO/FIXME/placeholder comments, no empty implementations, no stubs found in the four modified files.

### Commits Verified

| Commit | Description | Status |
|--------|-------------|--------|
| `76f024d` | feat(07-01): create cleanup-names.ts script | FOUND |
| `28ea488` | feat(07-01): extract shared clean-titles module, update seed script | FOUND |
| `6758378` | feat(07-01): add visual lesson numbering from order field | FOUND |
| `466ba95` | fix(07-01): use array index for visual lesson numbering instead of order field | FOUND |

### Human Verification Required

#### 1. Production DB State

**Test:** Query Supabase `Lesson` table for any titles matching `\.mp4$` or `^Модуль:` pattern. Query `Course` table for titles matching `^\d+_`.
**Expected:** Zero matches.
**Why human:** Cannot connect to Supabase from this environment to run SELECT queries. The cleanup script was run with `--apply` per SUMMARY, but the DB state at time of verification cannot be confirmed programmatically from the local filesystem.

Note: The orchestrator confirmed this passed via production browser automation (per task prompt). The visual verification in 07-02-SUMMARY.md also confirms no technical artifacts were visible on the production site.

### Gaps Summary

No gaps found. All 5 success criteria are verified through artifact inspection and commit history. The cleanup script is substantive and wired to Prisma. The seed script is updated to prevent regression. The learn page uses sequential visual numbering (with the `lesson.order` bug fixed to `idx + 1`). Production redeploy and human visual verification are documented in 07-02-SUMMARY.md.

The only documentation gap noted is that NAMING-01 through NAMING-05 are not in REQUIREMENTS.md's Traceability table — they exist only in ROADMAP.md. This does not affect functionality.

---

_Verified: 2026-02-26T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
