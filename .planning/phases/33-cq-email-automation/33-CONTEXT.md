# Phase 33: CQ Email Automation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Полная интеграция 10 email-событий через Carrot Quest API. Бэкенд отправляет события с правильными именами и свойствами, CQ отправляет HTML-письма по automation rules. Включает: переименование существующих событий, новые события (registration_completed, subscription_expiring, inactive), трекинг lastActiveAt, cron для inactive уведомлений, настройку CQ дашборда.

НЕ входит: вёрстка HTML-шаблонов (готовы в Stripo), CloudPayments production credentials (Phase 28), Sentry (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Event Naming Convention
- **D-01:** Все события используют префикс `pa_` (Platform Academy): `pa_payment_success`, `pa_payment_failed`, `pa_subscription_cancelled`, `pa_subscription_expiring`, `pa_doi`, `pa_registration_completed`, `pa_password_reset`, `pa_inactive_7`, `pa_inactive_14`, `pa_inactive_30`
- **D-02:** Свойства событий тоже с `pa_` префиксом: `pa_course_name`, `pa_amount`, `pa_period_end`, `pa_access_until`, `pa_name`, `pa_doi`, `pa_password_link`

### CTA Links in Emails
- **D-03:** "Начать учиться" → `https://platform.mpstats.academy/dashboard`
- **D-04:** "Попробовать снова" / "Возобновить подписку" → `https://platform.mpstats.academy/pricing`

### Subscription Expiring
- **D-05:** Напоминание за 3 дня до истечения подписки (один раз)

### Event Sources (where each event fires)
- **D-06:** Events 1-3 (payment/cancel) — из CloudPayments webhook handler (`/api/webhooks/cloudpayments`)
- **D-07:** Event 4 (expiring) — из cron endpoint, проверяет subscriptions с currentPeriodEnd через 3 дня
- **D-08:** Event 5 (DOI) — из Supabase email hook (`/api/webhooks/supabase-email`), тип `signup`
- **D-09:** Event 6 (registration_completed) — из auth callback (`/api/auth/callback`) при первом подтверждении email
- **D-10:** Event 7 (password_reset) — из Supabase email hook, тип `recovery`
- **D-11:** Events 8-10 (inactive) — из cron endpoint `/api/cron/inactive-users`, раз в сутки

### Inactive Tracking
- **D-12:** Добавить поле `lastActiveAt DateTime?` в UserProfile (Prisma)
- **D-13:** Обновлять `lastActiveAt` в tRPC context creation (при каждом аутентифицированном запросе)
- **D-14:** Cron идемпотентен — не отправляет повторно если событие уже отправлялось для этого периода неактивности

### Cron Implementation
- **D-15:** GitHub Action cron (раз в сутки, ~06:00 UTC) вызывает secured endpoint
- **D-16:** Endpoint защищён `CRON_SECRET` header — не доступен публично

### Existing Code Migration
- **D-17:** Существующие 4 email функции в `emails.ts` переименовываются (event names), свойства обновляются
- **D-18:** CQ types в `types.ts` обновляются под новые имена
- **D-19:** Supabase email hook уже перехватывает confirmation/recovery — нужно обновить event names и свойства

### Claude's Discretion
- Структура cron endpoint (один на всё или раздельные)
- Формат хранения "уже отправлено" для idempotency inactive events
- Оптимальный момент обновления lastActiveAt (каждый запрос vs раз в сессию)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CQ Integration (existing code)
- `apps/web/src/lib/carrotquest/client.ts` — CQ API client (fire-and-forget, form-encoded)
- `apps/web/src/lib/carrotquest/emails.ts` — 4 existing email functions (to be renamed)
- `apps/web/src/lib/carrotquest/types.ts` — Event name types (to be updated)

### Webhooks (existing code)
- `apps/web/src/app/api/webhooks/supabase-email/route.ts` — Standard Webhooks verification, handles signup/recovery/email_change
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` — CP webhook dispatcher, calls email functions

### Auth
- `apps/web/src/app/api/auth/callback/route.ts` — Auth callback (DOI confirmation lands here)

### Schema
- `packages/db/prisma/schema.prisma` — UserProfile (needs lastActiveAt), Subscription (has currentPeriodEnd)

### tRPC Context
- `packages/api/src/trpc.ts` — Context creation (place to update lastActiveAt)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `carrotquest/client.ts`: singleton CQ API client with `trackEvent()` and `setUserProps()` — fully reusable
- `carrotquest/emails.ts`: 4 email functions with feature flag check — pattern to follow for new events
- `supabase-email/route.ts`: Standard Webhooks verification — already handles signup/recovery, just needs event rename
- `cloudpayments/route.ts`: Already calls email functions on pay/fail/cancel — just needs event rename

### Established Patterns
- Fire-and-forget: errors logged but never thrown (safe for missing CQ API key)
- Feature flag `email_notifications_enabled` checked before each event
- CQ API is `application/x-www-form-urlencoded`, NOT JSON
- Event names without `$` prefix (reserved by CQ system events)
- `by_user_id=true` for Supabase UUID identification

### Integration Points
- CloudPayments webhook → email functions (events 1-3)
- Supabase email hook → CQ events (events 5, 7)
- Auth callback → new event (event 6)
- tRPC context → lastActiveAt update
- New cron endpoint → events 4, 8-10

</code_context>

<specifics>
## Specific Ideas

### ТЗ от CQ-команды (10 событий)
Полное ТЗ получено 2026-03-24 с конкретными event names, свойствами и Stripo ссылками на HTML-шаблоны.

### HTML-шаблоны (Stripo)
10 шаблонов готовы в Stripo (ссылки viewstripo.email). Также есть локальные копии в `docs/mails/E-mails/`. Загрузка в CQ — ручная операция в дашборде.

### Вопросы решены
- Все CTA links подтверждены (/dashboard, /pricing)
- Срок напоминания: 3 дня до истечения

</specifics>

<deferred>
## Deferred Ideas

- Второе напоминание за 1 день до истечения подписки (если конверсия от первого низкая)
- A/B тестирование subject lines в CQ
- Трекинг open rate / click rate в CQ аналитике

</deferred>

---

*Phase: 33-cq-email-automation*
*Context gathered: 2026-03-24*
