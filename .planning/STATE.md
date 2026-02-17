# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 2: AI Question Generation

## Current Position

Phase: 2 of 6 (AI Question Generation)
Plan: 1 of 2 in current phase
Status: Executing
Last activity: 2026-02-17 — Plan 02-01 complete (AI question generation service)

Progress: [███░░░░░░░] 21%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: 5.4 min
- Total execution time: 0.45 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4 | 17 min | 4.3 min |
| 02-ai-question-generation | 1 | 10 min | 10 min |

**Recent Trend:**
- Last 5 plans: 01-01 (6 min), 01-02 (4 min), 01-03 (3 min), 01-04 (4 min), 02-01 (10 min)
- Trend: Stable (02-01 longer due to 100-question expansion)

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
- [02-01]: question-generator accepts fallbackFn callback to avoid circular dep with @mpstats/api
- [02-01]: FINANCE category (empty courses) always uses mock fallback
- [02-01]: Options shuffled after LLM generation to avoid correctIndex bias
- [02-01]: @mpstats/shared added as workspace dep to @mpstats/ai

### Pending Todos

None yet.

### Blockers/Concerns

- Kinescope videoId data needed from content team (blocks Phase 3 VIDEO-02)
- Domain name for production SSL not confirmed (blocks Phase 6 DEPLOY-03)
- SkillCategory enum has 5 values but 6 courses exist — RESOLVED in 01-01 (COURSE_SKILL_MAP)
- DATABASE_URL credentials RESOLVED — host changed from aws-0-eu-central-1 to aws-1-eu-west-1, DIRECT_URL switched to session pooler

## Session Continuity

Last session: 2026-02-17
Stopped at: Completed 02-01-PLAN.md (AI question generation service)
Resume file: .planning/phases/02-ai-question-generation/02-02-PLAN.md
