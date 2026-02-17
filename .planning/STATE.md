# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 1: Data Foundation

## Current Position

Phase: 1 of 6 (Data Foundation)
Plan: 3 of 4 in current phase
Status: Executing
Last activity: 2026-02-17 — Completed 01-03 (diagnostic router Prisma migration)

Progress: [███░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 4 min
- Total execution time: 0.2 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 3 | 13 min | 4.3 min |

**Recent Trend:**
- Last 5 plans: 01-01 (6 min), 01-02 (4 min), 01-03 (3 min)
- Trend: Accelerating

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

### Pending Todos

None yet.

### Blockers/Concerns

- Kinescope videoId data needed from content team (blocks Phase 3 VIDEO-02)
- Domain name for production SSL not confirmed (blocks Phase 6 DEPLOY-03)
- SkillCategory enum has 5 values but 6 courses exist — RESOLVED in 01-01 (COURSE_SKILL_MAP)
- DATABASE_URL credentials need updating — seed scripts ready but cannot connect to Supabase

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 01-03-PLAN.md
Resume file: .planning/phases/01-data-foundation/01-03-SUMMARY.md
