---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Auth Rework + Billing
status: completed
stopped_at: Phase 17 context gathered
last_updated: "2026-03-10T09:44:25.028Z"
last_activity: 2026-03-10 — Phase 16 Plan 02 executed (feature flag admin UI)
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 16 — Billing Data Foundation

## Current Position

Phase: 17 of 20 (Yandex ID Auth)
Plan: 1 of 2 in current phase
Status: In progress
Last activity: 2026-03-10 — Phase 17 Plan 01 executed (Yandex OAuth backend)

Progress: [██████████] 100% (v1.0 + v1.1 complete, v1.2 phases 16-17 in progress)

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
- [16-01]: Baselined existing DB with prisma migrate (0_init) since project used db push
- [16-01]: Feature flags via FeatureFlag model + isFeatureEnabled() safe-default helper
- [16-01]: All NOT NULL billing fields have defaults for safe migration on existing data
- [Phase 16]: Feature flag admin: toggleUserField pattern reused for toggleFeatureFlag with TRPCError re-throw
- [17-01]: OAuthProvider interface for extensible server-side OAuth (Yandex now, Tochka later)
- [17-01]: Supabase session via generateLink(magiclink)+verifyOtp pattern for custom OAuth providers
- [17-01]: Used @mpstats/db/client singleton in callback route instead of direct PrismaClient

### Blockers/Concerns

- Supabase Admin API session creation for custom OAuth needs sandbox validation (Phase 17)
- CloudPayments webhook payload format needs sandbox testing (Phase 18)
- Pricing structure (actual prices) needed from product owner before Phase 19

### Pending Todos

None.

## Performance Metrics (v1.2)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 16    | 01   | 4min     | 2     | 6     |
| Phase 16 P02 | 3min | 2 tasks | 4 files |
| 17    | 01   | 5min     | 2     | 6     |

## Session Continuity

Last session: 2026-03-10T10:04:47Z
Stopped at: Completed 17-01-PLAN.md
Resume file: .planning/phases/17-yandex-id-auth/17-02-PLAN.md
