# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 1: Data Foundation

## Current Position

Phase: 1 of 6 (Data Foundation)
Plan: 4 of 4 in current phase (CHECKPOINT — awaiting human verification)
Status: Checkpoint
Last activity: 2026-02-17 — 01-04 Tasks 1-2 complete, Task 3 checkpoint pending

Progress: [████░░░░░░] 15%

## Performance Metrics

**Velocity:**
- Total plans completed: 4 (01-04 pending checkpoint)
- Average duration: 4.5 min
- Total execution time: 0.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4 | 17 min | 4.3 min |

**Recent Trend:**
- Last 5 plans: 01-01 (6 min), 01-02 (4 min), 01-03 (3 min), 01-04 (4 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Migration order Learning -> Diagnostic -> Profile (dependency chain)
- [Roadmap]: Strangler Fig pattern — try DB first, fallback to mock
- [Roadmap]: Phases 2+3 can parallel after Phase 1 completes
- [01-01]: COURSE_SKILL_MAP maps 6 courses to 5 categories (03_ai->CONTENT, 04_workshops->OPERATIONS, 05_ozon->MARKETING, 06_express->OPERATIONS)
- [01-01]: API utils import from @mpstats/db, not @prisma/client directly
- [01-01]: tsx added as root dev dependency for seed scripts
- [01-02]: Removed getLessonSummary from learning router (already handled by AI router)
- [01-02]: Default learn view changed from 'path' to 'courses' for 405-lesson scale
- [01-02]: Course lessons collapsed to first 5 with expand button
- [01-03]: Active session questions in globalThis Map (not DB) — short-lived, no schema change
- [01-03]: Server restart marks orphaned sessions as ABANDONED
- [01-03]: Exported functions take PrismaClient as first parameter (not singleton)
- [01-04]: Average score = mean of 5 skill axes (not per-diagnostic calculation)
- [01-04]: longestStreak = 0 for MVP (full history scan deferred)
- [01-04]: updateSettings kept as mock (no Settings model in schema)

### Pending Todos

None yet.

### Blockers/Concerns

- Kinescope videoId data needed from content team (blocks Phase 3 VIDEO-02)
- Domain name for production SSL not confirmed (blocks Phase 6 DEPLOY-03)
- SkillCategory enum has 5 values but 6 courses exist — RESOLVED in 01-01 (COURSE_SKILL_MAP)
- DATABASE_URL credentials need updating — seed scripts ready but cannot connect to Supabase

## Session Continuity

Last session: 2026-02-17
Stopped at: 01-04-PLAN.md Task 3 checkpoint (human-verify)
Resume file: .planning/phases/01-data-foundation/01-04-SUMMARY.md
