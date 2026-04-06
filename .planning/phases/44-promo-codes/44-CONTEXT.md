# Phase 44: Промо-коды - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning
**Source:** Design doc (docs/plans/2026-04-06-promo-codes-design.md)

<domain>
## Phase Boundary

Промо-коды для выдачи бесплатного доступа к платформе. Админ создаёт коды в админке, пользователь активирует на /pricing. Подписка создаётся в обход CloudPayments.

</domain>

<decisions>
## Implementation Decisions

### D-01: Типы промо-доступа
- Поддерживаются оба типа: PLATFORM (все курсы) и COURSE (конкретный курс)
- Зеркалит существующую billing модель (PlanType enum)

### D-02: Активация в обход CloudPayments
- Промо-код создаёт Subscription напрямую в БД (status: ACTIVE)
- Без привязки карты, без Payment записей
- Поле `promoCodeId` (nullable) в Subscription для отличия от платных

### D-03: Место ввода промо-кода
- Только на /pricing — под карточками тарифов
- "Есть промо-код?" — раскрывающееся поле + кнопка "Активировать"

### D-04: Auth на /pricing
- Хедер с auth-состоянием (как в (main) layout): логотип + "Войти" / аватар
- Не авторизован → при нажатии "Активировать" редирект на `/login?redirect=/pricing&promo=КОД`
- После логина: /pricing читает `?promo=` из URL, подставляет код автоматически

### D-05: Модель PromoCode
- code (unique), planType (PLATFORM/COURSE), courseId (nullable), durationDays
- maxUses + currentUses (для массовых и индивидуальных кодов)
- expiresAt (nullable — дедлайн акции), isActive, createdBy (adminId)

### D-06: Модель PromoActivation
- Аудит: promoCodeId + userId + subscriptionId + activatedAt
- @@unique([promoCodeId, userId]) — один код один раз на юзера
- subscriptionId @unique — связь с созданной подпиской

### D-07: Валидация при активации (5 проверок в порядке)
1. Код не найден или !isActive → "Промо-код не найден"
2. expiresAt просрочен → "Срок действия промо-кода истёк"
3. currentUses >= maxUses → "Промо-код уже использован" (отдельная ошибка от "не найден")
4. @@unique нарушен → "Вы уже использовали этот промо-код"
5. Активная подписка того же типа → "У вас уже есть активная подписка" / "...доступ к этому курсу"

### D-08: Транзакция активации
- Шаги 6-8 (create Subscription, create PromoActivation, increment currentUses) в одной Prisma $transaction
- CQ событие pa_promo_activated после транзакции

### D-09: Админка — вкладка "Промо-коды"
- Доступ: ADMIN + SUPERADMIN
- Таблица: код, тип, длительность, использований (N/max), истекает, статус
- Форма создания: тип, курс (если COURSE), дней (пресеты 7/14/30 + ручной), maxUses, expiresAt, код (авто или ручной)
- Действия: деактивировать, просмотр активаций

### D-10: Промо-подписка в профиле
- Бейдж "Промо" вместо "Активна"
- Текст: "Промо-доступ · Полная платформа · до DD.MM.YYYY"
- Нет кнопки "Отменить" (промо нечего отменять)

### Claude's Discretion
- Формат автогенерируемого кода (длина, символы, префикс)
- Точный UI компонент для раскрывающегося поля промо-кода
- Стили бейджа "Промо" в профиле
- Порядок колонок в таблице админки

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Billing & Subscriptions
- `packages/db/prisma/schema.prisma` — Subscription, SubscriptionPlan, Payment models (must extend)
- `packages/api/src/routers/billing.ts` — Existing billing tRPC router (pattern to follow)
- `apps/web/src/lib/cloudpayments/subscription-service.ts` — Subscription state machine
- `packages/api/src/utils/access.ts` — Lesson access control (must work with promo subscriptions)

### Pricing Page
- `apps/web/src/app/pricing/page.tsx` — Current pricing page (must modify)

### Admin Panel
- `packages/api/src/routers/admin.ts` — Admin tRPC procedures (must extend)
- `apps/web/src/app/(admin)/admin/layout.tsx` — Admin navigation (must add tab)

### Profile
- `apps/web/src/app/(main)/profile/page.tsx` — Subscription display (must modify)

### Auth
- `apps/web/src/app/(main)/layout.tsx` — Auth header pattern to reuse on /pricing

### CQ Integration
- `apps/web/src/lib/carrotquest/index.ts` — CQ event pattern (pa_ prefix)

### Design Doc
- `docs/plans/2026-04-06-promo-codes-design.md` — Full design specification

</canonical_refs>

<specifics>
## Specific Ideas

- Промо-коды для партнёрства с банками (доступ за открытие РС)
- Tripwire-курсы через COURSE промо-коды
- Массовые коды (один код на 500 активаций) для партнёрских акций

</specifics>

<deferred>
## Deferred Ideas

- Автопродление после окончания промо-периода
- Отдельная страница /promo (решено делать только на /pricing)
- Промо-код в профиле (решено делать только на /pricing)

</deferred>

---

*Phase: 44-promo-codes*
*Context gathered: 2026-04-06 via brainstorming session*
