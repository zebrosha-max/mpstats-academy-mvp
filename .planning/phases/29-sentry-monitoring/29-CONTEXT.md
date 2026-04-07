# Phase 29: Sentry Monitoring - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Source:** Design doc (docs/plans/2026-04-07-sentry-monitoring-design.md)

<domain>
## Phase Boundary

Sentry monitoring for Next.js 14 production app. Full stack: client errors, server errors, performance (Web Vitals, API latency). Email alerts on new issues.

</domain>

<decisions>
## Implementation Decisions

### D-01: SDK
- @sentry/nextjs — единый пакет для client/server/edge
- Версия: latest stable

### D-02: Sample rates
- Errors: 1.0 (100% — ловим всё)
- Performance: 0.3 (30% транзакций — экономим квоту 10K/мес)
- Replays: replaysSessionSampleRate=0, replaysOnErrorSampleRate=1.0

### D-03: Config файлы
- sentry.client.config.ts — браузерный SDK
- sentry.server.config.ts — серверный SDK
- sentry.edge.config.ts — edge runtime (middleware)
- src/instrumentation.ts — Next.js instrumentation hook
- src/app/global-error.tsx — error boundary для App Router

### D-04: next.config.js
- withSentryConfig() wrapper
- Source maps upload при build (SENTRY_AUTH_TOKEN)
- hideSourceMaps: true в проде

### D-05: Custom spans на критичных эндпоинтах
1. /api/webhooks/cloudpayments — Sentry.withScope, каждый webhook type как span
2. /api/webhooks/supabase-email — DOI/recovery events
3. packages/ai/src/openrouter.ts — Sentry.startSpan на LLM calls (model, latency)
4. /api/cron/check-subscriptions — Sentry Crons monitoring
5. promo.activate — через автоматический tRPC instrumentation

### D-06: Env переменные
- NEXT_PUBLIC_SENTRY_DSN — public, build time (вшивается в бандл)
- SENTRY_AUTH_TOKEN — secret, build time only (source maps)
- SENTRY_ORG — build time
- SENTRY_PROJECT — build time

### D-07: Алерты
- Email из коробки Sentry: новый issue, regression, spike detection
- Настройка в Sentry dashboard после деплоя

### Claude's Discretion
- Точная версия @sentry/nextjs
- Naming conventions для custom spans
- Sentry project name в dashboard
- Tunnel endpoint (если нужен для ad-blockers)

</decisions>

<canonical_refs>
## Canonical References

### Next.js Config
- `apps/web/next.config.js` — текущий конфиг (нужно обернуть в withSentryConfig)

### Webhook Handlers
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` — CP webhook (добавить spans)
- `apps/web/src/app/api/webhooks/supabase-email/route.ts` — email webhook (добавить spans)

### AI/LLM
- `packages/ai/src/openrouter.ts` — OpenRouter вызовы (добавить spans)

### Cron
- `apps/web/src/app/api/cron/check-subscriptions/route.ts` — cron job (Sentry Crons)

### Design Doc
- `docs/plans/2026-04-07-sentry-monitoring-design.md` — полная спецификация

</canonical_refs>

<specifics>
## Specific Ideas

- Бесплатный Sentry Developer plan (5K errors + 10K transactions/мес)
- Session replay только при ошибках (экономия квоты)
- Source maps для читаемых stack traces в проде

</specifics>

<deferred>
## Deferred Ideas

- Telegram алерты (через n8n/бот) — добавить позже если email недостаточно
- Sentry tunnel endpoint для обхода ad-blockers
- Custom dashboards в Sentry

</deferred>

---

*Phase: 29-sentry-monitoring*
*Context gathered: 2026-04-07 via brainstorming session*
