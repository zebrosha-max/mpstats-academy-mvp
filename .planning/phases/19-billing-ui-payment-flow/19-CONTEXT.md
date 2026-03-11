# Phase 19: Billing UI + Payment Flow - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Страница тарифов (/pricing), интеграция CloudPayments Checkout виджета для оплаты, секция управления подпиской в профиле, кнопка покупки курса на странице курса, навигационные ссылки. Paywall (блокировка контента) и content gating — Phase 20.

</domain>

<decisions>
## Implementation Decisions

### Страница тарифов (/pricing)
- Две карточки рядом: левая «Один курс» (2990 руб/мес), правая «Полный доступ» (4990 руб/мес) с градиентной рамкой и выделением
- Страница публичная — доступна без авторизации. Кнопка «Оформить» редиректит на /login если не авторизован
- При выборе «Один курс» — select/dropdown со списком 6 курсов прямо на /pricing, плюс кнопка «Купить» на странице курса (/learn)
- Если у пользователя активная подписка — на карточке текущего плана бэйдж «Ваш план», кнопка меняется на «Управление подпиской» → /profile
- Цены из DB (SubscriptionPlan модель) — обновляемые владельцем через админку
- Обновление цен: COURSE = 2990 руб/мес, PLATFORM = 4990 руб/мес (обновить seed и SubscriptionPlan)

### CloudPayments виджет
- CloudPayments Checkout popup (JS SDK checkout.cloudpayments.ru) — открывается поверх страницы при клике «Оформить»
- PCI DSS не нужен — карточные данные не касаются нашего сервера
- Перед открытием popup: tRPC endpoint создаёт Subscription(PENDING) + Payment(PENDING) в DB
- InvoiceId = subscriptionId, AccountId = userId (совместимо с Phase 18 handleCheck)
- Добавить PENDING в enum SubscriptionStatus (миграция Prisma)

### После оплаты
- Claude's Discretion: success-страница или toast — выбрать оптимальный UX на этапе планирования
- Webhook pay переводит Subscription из PENDING → ACTIVE (Phase 18 handlePaymentSuccess уже готов)

### Подписка в профиле
- Отдельная Card секция под «Личные данные» на /profile
- Активная подписка: план, статус (бэйдж «Активна»), дата следующего списания, цена, кнопка «Отменить подписку»
- Без подписки: CTA «У вас нет активной подписки» + кнопка → /pricing
- Отмена: наш сервер вызывает CloudPayments API (POST /subscriptions/cancel), CP присылает cancel webhook → Phase 18 handleCancellation ставит CANCELLED, доступ до currentPeriodEnd
- История платежей: таблица последних 5-10 платежей (дата, сумма, статус) из Payment модели

### Навигация и доступ
- Новый пункт «Тарифы» в sidebar (иконка CreditCard/Sparkles) — виден только при billing_enabled=true
- Ссылка «Тарифы» в header лендинга — Claude's discretion по best practices
- Кнопка «Купить курс» на странице курса — Claude's discretion по размещению и UX
- При billing_enabled=false: ссылка «Тарифы» скрыта из sidebar, секция подписки скрыта в профиле, /pricing при прямом переходе → редирект на главную, весь контент доступен бесплатно

### Claude's Discretion
- Success-экран после оплаты (страница vs toast)
- Размещение кнопки «Купить курс» на странице курса (баннер сверху vs inline)
- Ссылка «Тарифы» в header лендинга — позиция и стиль
- Точная иконка для sidebar пункта «Тарифы»
- UX при одновременной COURSE и PLATFORM подписке (апгрейд flow)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Card component** (`components/ui/card.tsx`): варианты shadow-mp-card, gradient, elevated — для pricing карточек
- **Badge component** (`components/ui/badge.tsx`): 15+ вариантов — для статусов подписки и «Ваш план»
- **Button component** (`components/ui/button.tsx`): варианты default/success/featured — для CTA «Оформить»
- **Sidebar** (`components/shared/sidebar.tsx`): существующие пункты (Главная, Диагностика, Обучение, Профиль) — добавить «Тарифы»
- **isFeatureEnabled()** (`packages/api/src/utils/feature-flags.ts`): проверка billing_enabled — использовать для conditional rendering
- **SubscriptionPlan model**: id, type (COURSE|PLATFORM), name, price, intervalDays, isActive — данные для pricing карточек
- **Subscription model**: userId, planId, courseId, status, currentPeriodStart/End, cancelledAt — для секции профиля
- **Payment model**: subscriptionId, amount, status, cloudPaymentsTxId, paidAt — для истории платежей
- **subscription-service.ts**: handlePaymentSuccess, handleCancellation, handleCheck — готовые handlers из Phase 18
- **webhook route** (`api/webhooks/cloudpayments/route.ts`): HMAC-верифицированный endpoint — Phase 18

### Established Patterns
- tRPC routers: protectedProcedure для user endpoints, adminProcedure для admin
- Next.js API routes для внешних интеграций (не tRPC) — паттерн из Yandex OAuth callback
- Card + Badge + Button композиция для информационных секций — паттерн dashboard/profile
- Profile page: grid md:grid-cols-3, Card с shadow-mp-card — добавить секцию подписки

### Integration Points
- `packages/api/src/root.ts` — добавить billing router (или расширить profile)
- `apps/web/src/app/(main)/profile/page.tsx` — добавить секцию подписки
- `apps/web/src/app/pricing/` — новая публичная страница (вне (main) layout)
- `components/shared/sidebar.tsx` — добавить пункт «Тарифы» с conditional billing_enabled
- `packages/db/prisma/schema.prisma` — добавить PENDING в SubscriptionStatus enum
- `scripts/seed/seed-billing.ts` — обновить цены SubscriptionPlan (2990/4990)

</code_context>

<specifics>
## Specific Ideas

- Изначально планировалось сначала продавать 1 курс, потестировать, потом добавить полный доступ. Решили отображать оба тарифа сразу: COURSE 2990 руб/мес, PLATFORM 4990 руб/мес
- «Скорее всего будем продавать курс Аналитика маркетплейсов во время теста» — Phase 16 контекст
- Цены placeholder — финальные установит владелец через админку

</specifics>

<deferred>
## Deferred Ideas

- **Диагностика при подписке на 1 курс** — что видит пользователь с COURSE-подпиской в диагностике? Вопросы только по купленному курсу или по всем? Рекомендации ограничены? ОБЯЗАТЕЛЬНО решить в Phase 20 (Paywall + Content Gating)
- **Уведомления о событиях подписки** — email при оплате, отказе, приближении конца периода. Отдельная фаза.
- **Admin-страница для платежей** — /admin/payments с таблицей PaymentEvent. Отдельная фаза.
- **Промокоды и скидки** (BILL-08) — deferred to v1.3
- **Trial period** (BILL-09) — deferred to v1.3

</deferred>

---

*Phase: 19-billing-ui-payment-flow*
*Context gathered: 2026-03-11*
