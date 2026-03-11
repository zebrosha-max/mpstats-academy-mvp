---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Auth Rework + Billing
status: completed
stopped_at: Phase 21 context gathered
last_updated: "2026-03-11T14:35:07.645Z"
last_activity: "2026-03-11 — Phase 19 Plan 02 executed (Billing UI: pricing page, subscription management, conditional nav)"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 8
  completed_plans: 8
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 21 — Domain migration from DuckDNS to platform.mpstats.academy

## Current Position

Phase: 19 of 20 (Billing UI & Payment Flow)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phase 19 Complete
Last activity: 2026-03-11 — Phase 19 Plan 02 executed (Billing UI: pricing page, subscription management, conditional nav)

Progress: [██████████] 100% (v1.0 + v1.1 + v1.2 complete)

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
- [17-02]: Inline SVG for Yandex Ya logo (no external asset dependency)
- [17-02]: File-system grep tests to enforce no-Google policy at CI level
- [Phase 18]: Single catch-all webhook route with query param for event type resolution
- [Phase 18]: Return {code: 0} on DB errors to prevent CloudPayments retry storms
- [Phase 18]: Recurrent extends from currentPeriodEnd (not now) to avoid billing gaps
- [Phase 18]: Cancel sets CANCELLED but does NOT expire — access until currentPeriodEnd
- [Phase 19]: Inline CP cancel logic in tRPC router instead of cross-package import
- [19-02]: Pricing page outside (main) layout — own header with back nav, no sidebar
- [19-02]: Protected queries on public page use retry:false for graceful unauthenticated handling
- [19-02]: CardFooter + mt-auto pattern for equal-height plan card button alignment

### Blockers/Concerns

- Supabase Admin API session creation for custom OAuth needs sandbox validation (Phase 17)
- CloudPayments webhook payload format needs sandbox testing (Phase 18)
- Pricing structure (actual prices) needed from product owner before Phase 19

### Roadmap Evolution

- Phase 21 added: Domain migration from DuckDNS to platform.mpstats.academy

### Pending Todos

None.

## Performance Metrics (v1.2)

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 16    | 01   | 4min     | 2     | 6     |
| Phase 16 P02 | 3min | 2 tasks | 4 files |
| 17    | 01   | 5min     | 2     | 6     |
| 17    | 02   | 3min     | 2     | 3     |
| Phase 18 P01 | 3min | 2 tasks | 4 files |
| 18    | 02   | 2min     | 2     | 2     |
| Phase 19 P01 | 3min | 2 tasks | 6 files |
| 19    | 02   | 4min     | 2     | 4     |

## Session Continuity

Last session: 2026-03-11T14:35:07.643Z
Stopped at: Phase 21 context gathered
Resume file: .planning/phases/21-domain-migration-from-duckdns-to-platform-mpstats-academy/21-CONTEXT.md
