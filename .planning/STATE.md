---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 27-01-PLAN.md (SEO Foundation)
last_updated: "2026-03-18T08:57:50.919Z"
last_activity: 2026-03-18 — Phase 31 Plan 01 completed (backend role system)
progress:
  total_phases: 16
  completed_phases: 7
  total_plans: 22
  completed_plans: 19
  percent: 97
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 23 Diagnostic 2.0 — COMPLETE (all 3 plans)

## Current Position

Phase: 31 of 31 (Admin Roles — Plan 02 complete, checkpoint pending)
Plan: 2 of 2 in current phase
Status: Phase 31 Plan 02 automated tasks complete (frontend role UI), checkpoint:human-verify pending
Last activity: 2026-03-18 — Phase 31 Plan 02 completed (privilege-aware admin UI)

Progress: [██████████] 98% (v1.0 + v1.1 + v1.2 + Phase 23 + Phase 31)

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
- [21-01]: HTTP-only Nginx config before certbot (let certbot add SSL directives automatically)
- [21-01]: No redirect from old DuckDNS domain — just disabled
- [Phase 21]: No automated Supabase/Yandex config — requires dashboard access (human-action checkpoint)
- [20-01]: FREE_LESSON_THRESHOLD=2: lessons with order<=2 are always free
- [20-01]: Batch subscription fetch per procedure (not per lesson) for performance
- [20-01]: getRecommendedPath keeps videoId visible (track preview is frontend-only)
- [20-02]: Paywall LockOverlay takes priority over DiagnosticGateBanner in render chain
- [20-02]: Track blur gating: first 3 lessons visible, rest CSS-blurred with pointer-events-none
- [Phase 22]: noreply@mpstats.academy as sender, CQ events with $ prefix, auth emails via Supabase Hook not CQ
- [Phase 22]: Feature flag cache with 60s TTL to avoid DB query per email send
- [Phase 22]: Fire-and-forget email pattern: sendXxxEmail().catch(console.error) -- email failure never breaks billing
- [23-01]: Keep single skillCategory alongside new skillCategories Json for backward compat (8+ consumers)
- [23-01]: Tagging.ts has own OpenRouter/Supabase clients (no server-only import) for CLI script compatibility
- [23-01]: Two-stage topic pipeline: LLM free tagging then LLM clustering into canonical dictionary
- [23-02]: Source tracing fields optional on DiagnosticQuestion — mock/FINANCE gracefully omit them
- [23-02]: generateSectionedPath with try/catch fallback to flat generateFullRecommendedPath
- [23-02]: getRecommendedPath returns isSectioned flag for frontend format detection
- [23-03]: Errors section open by default in accordion, permanent localStorage hint dismissal
- [23-03]: Dual Radar Chart via previousData prop with dashed "before" + solid "after" polygons
- [31-01]: Three-level Role enum (USER/ADMIN/SUPERADMIN) replaces boolean isAdmin
- [31-01]: adminProcedure for ADMIN+SUPERADMIN, superadminProcedure for SUPERADMIN-only
- [31-01]: Self-demotion and self-deactivation guards prevent SUPERADMIN lockout
- [31-02]: Profile query reused for role detection in sidebar/mobile-nav (no new endpoint)
- [31-02]: Privilege-aware UI: SUPERADMIN sees dropdowns/toggles, ADMIN sees read-only badges
- [Phase 27]: Title template '%s | MPSTATS Academy' + metadataBase for correct OG URL resolution

### Blockers/Concerns

- Supabase Admin API session creation for custom OAuth needs sandbox validation (Phase 17)
- CloudPayments webhook payload format needs sandbox testing (Phase 18)
- Pricing structure (actual prices) needed from product owner before Phase 19

### Roadmap Evolution

- Phase 21 added: Domain migration from DuckDNS to platform.mpstats.academy
- Phase 22 added: Transactional email notifications (billing, auth, system)
- Phase 23 added: Diagnostic 2.0 — personalized learning track with lesson-level topic tagging, question-to-content tracing, and error-based path prioritization
- Phase 24 added: Support Contact — функционал связи со службой поддержки
- Phase 25 added: Legal + Cookie Consent — оферта, ПК, ПС, баннер кук
- Phase 26 added: Яндекс Метрика — интеграция аналитики
- Phase 27 added: SEO + Custom Error Pages — sitemap, robots.txt, OG-теги, 404/500
- Phase 28 added: Боевой CloudPayments — production credentials
- Phase 29 added: Sentry Monitoring — мониторинг ошибок в продакшене
- Phase 30 added: Content Discovery — smart search, фильтры, персональный трек
- Phase 31 added: Admin Roles — admin/superadmin, управление доступом команды

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
| 21    | 01   | 4min     | 2     | 3     |
| Phase 21 P02 | 5min | 3 tasks | 3 files |
| 20    | 01   | 3min     | 2     | 3     |
| 20    | 02   | 5min     | 3     | 6     |
| Phase 22 P01 | 3min | 1 tasks | 1 files |
| Phase 22 P02 | 3min | 2 tasks | 9 files |
| 23    | 01   | 4min     | 2     | 6     |
| 23    | 02   | 3min     | 2     | 3     |
| 23    | 03   | 5min     | 3     | 6     |
| 31    | 01   | 4min     | 2     | 7     |
| 31    | 02   | 4min     | 2     | 5     |
| Phase 27 P01 | 3min | 2 tasks | 5 files |

## Session Continuity

Last session: 2026-03-18T08:57:27.000Z
Stopped at: Phase 31 Plan 02 — checkpoint:human-verify (Task 3 pending)

### Session 2026-03-12 — Billing Payment Flow Testing & Fixes

**7 commits fixing billing end-to-end:**

1. `82427f4` — CP public key missing from Docker build args → widget silent fail
2. `ea5d6a1` — CP sends form-urlencoded webhooks, not JSON → parse error → "Платёж не может быть принят"
3. `77efd98` — Cancel sent our CUID to CP API (they expect their ID) → cancel locally instead
4. `9fdec81` — CANCELLED subscription hidden in profile → now shows with "Доступ до" date
5. `751da56` — Course name missing in payment history → include course relation
6. `5eaf750` — Unauthenticated user on /pricing gets raw error → friendly message + redirect to /login; table layout fix for long course names

**Verified on prod (platform.mpstats.academy):**
- [x] Widget opens from button click
- [x] Test card 4242...4242 accepted
- [x] 3D Secure test page works
- [x] Check webhook → 200, Pay webhook → 200
- [x] Subscription becomes ACTIVE in profile
- [x] "Ваш план" badge on /pricing
- [x] Payment history with course names
- [x] Cancel subscription → CANCELLED with access-until date
- [x] Re-subscribe after cancel works
- [x] currentPeriodEnd = +30 days (confirmed on screenshot)

**Remaining checks — ALL VERIFIED:**
- [x] /pricing incognito → redirect to /login works
- [x] Verify table layout fix on profile (course name on separate line)

### Session 2026-03-12 (later) — Pricing Page Bugfixes

**2 commits fixing pricing page for unauthenticated users:**

1. `04c38f7` — Course dropdown empty in incognito: `learning.getCourses` was protectedProcedure → added public `billing.getCourses` (id+title only)
2. `21ed7a0` — "Not authenticated" error without redirect: protectedProcedure throws message "Not authenticated" but catch checked for "UNAUTHORIZED" → added case-insensitive check

**Next step:** Phase 20: Paywall + Content Gating — `/gsd:plan-phase 20`
