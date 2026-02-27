# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-26)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Milestone v1.1 — Phase 15: Landing Redesign & Theme Toggle

## Current Position

Phase: 15 of 15 (Landing Redesign & Theme Toggle)
Plan: 1 of 2 complete
Status: In Progress
Last activity: 2026-02-27 — Completed 15-01 (Theme Infrastructure)

Progress: [==========----------] 50% (1/2 plans)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 20
- Total phases: 10
- Timeline: 49 days (2026-01-08 -> 2026-02-26)

**v1.1 Plans:** 7 total (3+1+1+1+1)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Full v1.0 decision history archived in `milestones/v1.0-ROADMAP.md`.
Key decisions summary in PROJECT.md Key Decisions table.

- v1.1: Admin panel по паттерну MPSTATS Connect — (admin) route group, layout guard, adminProcedure
- v1.1: Phase 13 depends on Phase 12 (lazy video needed before progress tracking)
- v1.1: Phases 10, 11, 12, 14 are independent — can execute in any order
- 10-01: AdminSidebar uses lucide-react icons; email search via Supabase Admin API; added isActive field alongside isAdmin
- 10-02: Custom Toggle button instead of shadcn Switch; getCourseLessons for lazy accordion; analytics groups dates in app code
- 10-03: Course mutations lifted to parent CourseManager, lesson mutations stay in CourseAccordion; consistent click-to-edit UX pattern
- 11-01: SourceContext + SourceAwareWrapper pattern for injecting tooltips into markdown tree; summary always loads (removed tab gating)
- 12-01: Gradient PlayPlaceholder instead of Kinescope poster; gcTime 30min; single-query getLesson via course relation; prev/next simplified to {id, title}
- 13-01: 10s polling interval for Kinescope time; 15s debounced save; ignore < 5s; ref-based pattern to avoid re-renders; sendBeacon on unload
- 13-02: Progress bar on all lessons with watchedPercent > 0; weighted-average course progressPercent; admin getWatchStats endpoint
- 14-01: Session questions persisted to DB (Json field), no globalThis Map; Dockerfile dynamic Prisma engine copy
- 14-02: QuestionBank with 7-day TTL, bank-based instant diagnostic start, admin refresh, progressive loading UX
- 15-01: CSS variables on [data-landing-theme] attribute for independent landing theme; inline script FOUC prevention; useTheme() hook pattern

### Roadmap Evolution

- Phase 15 added: Landing Redesign & Theme Toggle

### Blockers/Concerns

None.

### Pending Todos

None.

## Session Continuity

Last session: 2026-02-27
Stopped at: Completed 15-01-PLAN.md (Theme Infrastructure)
Resume file: 15-02-PLAN.md (Unified Landing Page)
