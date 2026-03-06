# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 16 — Billing Data Foundation

## Current Position

Phase: 16 of 20 (Billing Data Foundation)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-06 — Roadmap created for v1.2 milestone (5 phases, 15 requirements)

Progress: [████████████████░░░░] 80% (v1.0 + v1.1 complete, v1.2 starting)

## Performance Metrics

**Velocity (v1.0):**
- Total plans completed: 20
- Total phases: 10
- Timeline: 49 days (2026-01-08 -> 2026-02-26)

**Velocity (v1.1):**
- Total plans completed: 11
- Total phases: 6
- Timeline: 2 days (2026-02-26 -> 2026-02-27)

## Accumulated Context

### Decisions

Full v1.0 decision history: `milestones/v1.0-ROADMAP.md`
Full v1.1 decision history: `milestones/v1.1-ROADMAP.md`

- [v1.2]: Yandex ID via server-side OAuth proxy (Supabase has no native provider)
- [v1.2]: Paywall in tRPC procedure, NOT middleware (Edge Runtime cannot use Prisma)
- [v1.2]: CloudPayments webhooks need HMAC + idempotency by TransactionId
- [v1.2]: Auth and Billing are independent tracks after Phase 16

### Blockers/Concerns

- Supabase Admin API session creation for custom OAuth needs sandbox validation (Phase 17)
- CloudPayments webhook payload format needs sandbox testing (Phase 18)
- Pricing structure (actual prices) needed from product owner before Phase 19

### Pending Todos

None.

## Session Continuity

Last session: 2026-03-06
Stopped at: Roadmap created for v1.2 (Phases 16-20, 15 requirements mapped)
Resume file: None
