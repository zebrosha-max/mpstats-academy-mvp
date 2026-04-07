# Sentry Monitoring: Дизайн-документ

**Дата:** 2026-04-07
**Фаза:** 29

## Цель

Подключить Sentry для мониторинга ошибок (фронтенд + бэкенд) и performance tracking (Web Vitals, API latency). Бесплатный Developer plan (5K ошибок + 10K транзакций/мес).

## Ключевые решения

| Решение | Выбор | Причина |
|---------|-------|---------|
| SDK | @sentry/nextjs | Единый пакет для client/server/edge |
| Error sample rate | 1.0 (100%) | 5K/мес хватит при текущем трафике |
| Performance sample rate | 0.3 (30%) | Экономия квоты 10K транзакций/мес |
| Replays | 0.0 / 1.0 on error | Replay только при ошибках |
| Алерты | Email (из коробки) | Новый issue, regression, spike |
| Custom spans | 5 критичных эндпоинтов | CP webhooks, email webhook, AI/LLM, cron, promo |

## Конфигурация

### SDK Init файлы

```
sentry.client.config.ts  — браузерный SDK
sentry.server.config.ts  — серверный SDK  
sentry.edge.config.ts    — edge runtime (middleware)
```

### Sample rates

- Errors: `1.0` — ловим все ошибки
- Performance: `0.3` — 30% транзакций
- Session replays: `replaysSessionSampleRate: 0` / `replaysOnErrorSampleRate: 1.0`

## Критичные эндпоинты — custom spans

1. `/api/webhooks/cloudpayments` — каждый webhook type (pay/fail/recurrent/cancel) как span
2. `/api/webhooks/supabase-email` — DOI/recovery events
3. `packages/ai/src/openrouter.ts` — LLM вызовы (model, latency, tokens)
4. `/api/cron/check-subscriptions` — Sentry Crons monitoring
5. `promo.activate` — tRPC promo activation

## Алерты (email, из коробки Sentry)

- Новый issue → email немедленно
- Regression (закрытый issue повторился) → email
- Spike detection (всплеск ошибок) → email

## Новые файлы

- `apps/web/sentry.client.config.ts` — клиентский SDK init
- `apps/web/sentry.server.config.ts` — серверный SDK init
- `apps/web/sentry.edge.config.ts` — edge runtime init
- `apps/web/src/app/global-error.tsx` — Sentry error boundary для App Router
- `apps/web/src/instrumentation.ts` — Next.js instrumentation hook

## Изменения в существующих файлах

- `apps/web/next.config.js` — `withSentryConfig()` wrapper + source maps upload
- `apps/web/package.json` — `@sentry/nextjs` dependency
- `.env.production` (VPS) — SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
- `apps/web/.env` (local) — NEXT_PUBLIC_SENTRY_DSN

## Точечная инструментация

- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` — Sentry.withScope
- `packages/ai/src/openrouter.ts` — Sentry.startSpan на LLM calls
- `apps/web/src/app/api/cron/check-subscriptions/route.ts` — Sentry Crons

## Env переменные

| Переменная | Тип | Описание |
|------------|-----|----------|
| NEXT_PUBLIC_SENTRY_DSN | public, build time | DSN для SDK init |
| SENTRY_AUTH_TOKEN | secret, build time | Для source maps upload |
| SENTRY_ORG | build time | Организация в Sentry |
| SENTRY_PROJECT | build time | Проект в Sentry |

## Что НЕ трогаем

- tRPC роутеры — @sentry/nextjs автоматически ловит ошибки в API routes
- React компоненты — global-error.tsx ловит всё на уровне App Router
- Middleware — edge config покрывает
