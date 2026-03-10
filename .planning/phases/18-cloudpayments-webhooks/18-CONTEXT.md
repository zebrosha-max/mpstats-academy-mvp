# Phase 18: CloudPayments Webhooks - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Webhook endpoint для обработки всех событий жизненного цикла подписки от CloudPayments (Check/Pay/Fail/Recurrent/Cancel). HMAC-SHA256 верификация, идемпотентная обработка по TransactionId, корректные переходы статусов подписки, audit log в PaymentEvent. Никакого UI (ни пользовательского, ни админского) — только backend webhook handlers + DB операции.

</domain>

<decisions>
## Implementation Decisions

### Отмена подписки
- Cancel webhook -> статус CANCELLED + cancelledAt
- Доступ сохраняется до currentPeriodEnd (оплаченный период)
- После currentPeriodEnd -> EXPIRED (проверяется при access check в Phase 20)

### HMAC и безопасность
- CloudPayments API Secret хранится в ENV: `CLOUDPAYMENTS_API_SECRET`
- На VPS -> `.env.production`, локально -> `.env`
- Только HMAC-SHA256 верификация, без IP whitelist (IP CloudPayments могут меняться)
- Аккаунт CloudPayments уже есть, API ключи доступны

### Аудит и логирование
- Полный raw JSON payload сохраняется в PaymentEvent.payload (Json поле уже в схеме)
- Каждый входящий webhook -> запись в PaymentEvent (включая дубли для audit trail)

### Уведомления
- В Phase 18 уведомления НЕ отправляются — только DB операции
- Email + in-app уведомления -> отдельная фаза (deferred)

### Admin UI
- В Phase 18 admin-страница для платежей НЕ создаётся
- Admin UI для мониторинга платежей -> отдельная фаза (deferred)
- Для диагностики достаточно Prisma Studio и серверных логов

### Claude's Discretion
- Создание подписки при первом платеже: webhook создаёт всё vs UI создаёт pending + webhook подтверждает (выбрать на основе документации CloudPayments)
- Грейс-период при Fail: длительность и поведение (на основе retry-логики CloudPayments)
- Обработка дублей: логировать + success vs полный skip (на основе best practices)
- Поведение при невалидной HMAC-подписи: HTTP код + логирование
- Поведение webhook при billing_enabled=false (рекомендация: принимать всегда, toggle влияет только на paywall)
- Конкретные CloudPayments webhook event types и их маппинг на бизнес-логику

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Prisma billing models** (`packages/db/prisma/schema.prisma`): Subscription, Payment, PaymentEvent, SubscriptionPlan уже созданы в Phase 16. Payment.cloudPaymentsTxId @unique для идемпотентности
- **isFeatureEnabled()** (`packages/api/src/utils/feature-flags.ts`): Проверка billing_enabled flag — safe default false
- **handleDatabaseError** (`packages/api/src/utils/db-errors.ts`): Стандартный error handler для Prisma операций
- **API route pattern** (`apps/web/src/app/api/auth/yandex/callback/route.ts`): Пример серверного API route с external service интеграцией

### Established Patterns
- Next.js API routes: `apps/web/src/app/api/` для внешних интеграций (не tRPC)
- Prisma enums: ACTIVE, PAST_DUE, CANCELLED, EXPIRED (SubscriptionStatus)
- PaymentStatus: PENDING, COMPLETED, FAILED, REFUNDED
- ENV переменные: `CLOUDPAYMENTS_API_SECRET` (новая), паттерн аналогичен `SUPABASE_SERVICE_ROLE_KEY`

### Integration Points
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` — новый API route для webhook
- `packages/db/prisma/schema.prisma` — модели готовы, миграция не нужна
- `.env` / `.env.production` — добавить `CLOUDPAYMENTS_API_SECRET` и `CLOUDPAYMENTS_PUBLIC_ID`
- `.env.example` — документировать новые переменные

</code_context>

<specifics>
## Specific Ideas

- Аккаунт CloudPayments уже есть — можно тестировать с реальным sandbox
- Phase 16 решения: per-course (COURSE) + full platform (PLATFORM), цена 4990 руб, ежемесячная подписка
- При отмене — доступ до конца оплаченного периода (Phase 16 context: cancelledAt + currentPeriodEnd)
- Платформенная подписка поглощает курсовую (не платить дважды) — Phase 16 решение

</specifics>

<deferred>
## Deferred Ideas

- **Уведомления о событиях подписки** — email + in-app (при оплате, отказе, отмене, приближении конца периода). В проекте пока нет привязки к TG, только email через Supabase Auth. Отдельная фаза.
- **Admin-страница для платежей** — /admin/payments с таблицей PaymentEvent для мониторинга webhook'ов и диагностики. Отдельная фаза.
- **54-ФЗ интеграция через CloudKassir** (BILL-07) — deferred to v1.3
- **Промокоды и скидки** (BILL-08) — deferred to v1.3

</deferred>

---

*Phase: 18-cloudpayments-webhooks*
*Context gathered: 2026-03-10*
