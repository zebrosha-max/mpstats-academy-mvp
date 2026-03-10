# Phase 16: Billing Data Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Prisma-модели для подписок, платежей и feature flags. Поля Course.price/isFree и UserProfile.yandexId. Seed-скрипт с начальными данными. Billing выключен по умолчанию. Никаких UI-фичей, webhook handler'ов или интеграций с CloudPayments — это фазы 18-20.

</domain>

<decisions>
## Implementation Decisions

### Ценообразование курсов
- Все 6 курсов платные, Course.isFree=false по умолчанию
- Единая цена: Course.price = 4990 (в рублях, Int — копейки не нужны)
- Два типа подписки: per-course (на один курс) и full platform (все курсы)
- Оба типа рекуррентные (ежемесячная подписка)
- На этапе тестирования продаём курс "Аналитика маркетплейсов" (01_analytics)
- Цены placeholder — финальные установит владелец через админку перед запуском
- 1-2 первых урока в каждом курсе бесплатны как превью (реализуется в Phase 20)

### Модель подписки в DB
- Одна модель Subscription с enum type: COURSE | PLATFORM (Claude's discretion)
- Если type=COURSE — есть courseId. Если PLATFORM — courseId=null
- Статусы: ACTIVE, PAST_DUE, CANCELLED, EXPIRED
- При отмене — доступ до конца оплаченного периода (currentPeriodEnd)
- Платформенная подписка поглощает курсовую (не платить дважды)
- Пользователь видит историю платежей в профиле (дата, сумма, статус)
- Payment модель хранит каждый платёж, PaymentEvent — webhook audit log

### Feature flags
- Таблица FeatureFlag: key (unique), enabled (bool), description
- Расширяется без миграций — новые записи через INSERT
- Первый flag: billing_enabled = false
- В админке — новая секция Settings (/admin/settings) со списком toggles
- Дополнительные flags (maintenance_mode и т.п.) — Claude's discretion, добавить если разумно

### Claude's Discretion
- Конкретная структура полей Subscription/Payment/PaymentEvent (какие поля, какие типы)
- Нужен ли SubscriptionPlan (тарифные планы) как отдельная модель или хардкод
- Overlap-логика при апгрейде курсовой → платформенной подписки
- Индексы и constraints в Prisma

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **adminProcedure** (`packages/api/src/trpc.ts`): Готовый guard для admin-only endpoints. Нужен для toggleFeatureFlag, getFeatureFlags
- **toggleUserField** (`packages/api/src/routers/admin.ts`): Паттерн для toggle boolean полей — можно обобщить для feature flags
- **handleDatabaseError** (`packages/api/src/utils/db-errors.ts`): Стандартный error handler для Prisma операций
- **Admin UI** (`apps/web/src/app/(admin)/admin/`): 4 страницы (dashboard, users, analytics, content) — добавить settings

### Established Patterns
- Prisma enums: PascalCase с SCREAMING_SNAKE values (DiagnosticStatus, SkillCategory)
- Модели: PascalCase с camelCase полями, `@@map` для snake_case таблиц где нужно
- tRPC routers: adminProcedure для admin endpoints, protectedProcedure для user endpoints
- Seed: нет существующего seed-скрипта — `pnpm db:push` + ручной SQL через Supabase dashboard

### Integration Points
- `packages/db/prisma/schema.prisma` — добавить новые модели
- `packages/api/src/routers/admin.ts` — добавить feature flag endpoints
- `packages/api/src/root.ts` — может потребоваться billing router (или расширить admin)
- `apps/web/src/app/(admin)/admin/settings/` — новая страница для feature flags
- `Course` модель — добавить поля price, isFree
- `UserProfile` модель — добавить поле yandexId

</code_context>

<specifics>
## Specific Ideas

- "Курс мы попробуем продавать на ранних этапах, а потом скорее всего будет только подписка" — архитектура должна поддерживать оба варианта, но per-course может быть убран позже
- "Скорее всего будем продавать курс Аналитика маркетплейсов во время теста" — seed должен пометить 01_analytics как первый продаваемый курс
- Цена 4990₽ одинаковая для курса и платформы на старте — владелец скорректирует позже
- Диагностика бесплатна в текущем виде, платная диагностика — будущий milestone

</specifics>

<deferred>
## Deferred Ideas

- Платная диагностика (более глубокие/гибкие варианты за paywall) — будущий milestone v1.3+
- Промокоды и скидки (BILL-08) — deferred to v1.3
- Trial period (BILL-09) — deferred to v1.3
- 54-ФЗ интеграция через CloudKassir (BILL-07) — deferred to v1.3

</deferred>

---

*Phase: 16-billing-data-foundation*
*Context gathered: 2026-03-10*
