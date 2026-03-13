# Phase 22: Transactional Email Notifications — Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Интеграция с Carrot Quest для отправки транзакционных email-уведомлений по событиям платформы (billing, auth, система). Первый deliverable — EMAIL-SPEC.md (спек для email-команды: список писем, драфты текстов, переменные, цепочки). Второй — интеграция CQ API из кода платформы + toast-уведомления в UI. Auth-письма Supabase переводятся на Carrot Quest для единого брендинга.

</domain>

<decisions>
## Implementation Decisions

### Email-провайдер
- **Carrot Quest** — единственный провайдер для всех писем платформы
- Интеграция через CQ REST API из серверного кода (не через автоматизации CQ)
- Платформа вызывает CQ API при событии (webhook, auth, cron), передаёт данные
- Шаблоны верстаются email-командой в Carrot Quest
- Credentials (CQ API key) запросит владелец, хранение в `.env` / `.env.production`

### Supabase Auth → Carrot Quest
- Auth-письма Supabase (подтверждение email, сброс пароля) переводятся на Carrot Quest
- Claude's discretion: custom SMTP в Supabase Dashboard или отключение Supabase mailer + свой flow через CQ API
- Цель — единый брендинг и шаблон для всех писем платформы

### Триггеры писем (9 типов + цепочка)

**Billing (4 письма):**
1. **Успешная оплата** — подтверждение платежа, сумма, период подписки
2. **Отказ платежа** — обновите карту / попробуйте снова
3. **Отмена подписки** — подписка отменена, доступ до [дата]
4. **Скоро истекает** — напоминание перед концом периода (для отменённых подписок)

**Auth/System (5 писем):**
5. **Welcome** — приветствие после регистрации, CTA: пройти диагностику
6. **Подтверждение email** — верификация при регистрации через email/password (замена Supabase)
7. **Сброс пароля** — ссылка для сброса (замена Supabase)
8. **Диагностика готова** — результаты AI-диагностики + персональный трек
9. **Неактивность** — цепочка из 3 шагов: 7 дней / 14 дней / 30 дней

### Тон писем
- Деловой + дружелюбный: на «вы», профессионально, но не сухо
- Стиль SaaS-платформы (как банковские уведомления, но теплее)

### Email sender
- Конкретный адрес отправителя пока не определён — зависит от настроек CQ и DNS
- Claude's discretion при реализации

### Документ для email-команды (EMAIL-SPEC.md)
- Первый deliverable фазы — готовится ДО технической интеграции
- Формат: MD-файл в репозитории + Google Doc на zebrosha@gmail.com для команды
- Содержание:
  - Список всех 9 писем с триггерами (когда, кому)
  - Драфты текстов (заголовок, тело, CTA)
  - Переменные/плейсхолдеры: `{{name}}`, `{{amount}}`, `{{date}}`, `{{course_name}}` и т.д.
  - Визуальные цепочки/флоу: регистрация → welcome → диагностика → ..., billing flow

### In-app уведомления
- Toast-уведомления в UI при ключевых событиях (оплата, отмена)
- Полноценный центр уведомлений (колокольчик) — deferred

### Claude's Discretion
- Supabase auth emails: custom SMTP relay через CQ vs отключение Supabase mailer + свой flow
- Конкретный email sender address
- Интервал для «скоро истекает» (за сколько дней до конца периода)
- Toast-компонент: использовать существующий или sonner/react-hot-toast
- Структура CQ API-клиента в коде (packages/notifications/ или lib/carrotquest/)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CloudPayments webhook handler** (`apps/web/src/app/api/webhooks/cloudpayments/route.ts`): Точки для вызова email при payment events (handlePaymentSuccess, handlePaymentFailure, handleCancellation)
- **Subscription service** (`apps/web/src/lib/cloudpayments/subscription-service.ts`): Бизнес-логика подписок — здесь добавлять вызовы CQ API
- **Auth actions** (`apps/web/src/lib/auth/actions.ts`): signUp, resetPasswordRequest — точки для welcome и password reset emails
- **Diagnostic results page** (`apps/web/src/app/(main)/diagnostic/results/page.tsx`): Точка для «диагностика готова»
- **Feature flags** (`packages/api/src/utils/feature-flags.ts`): isFeatureEnabled() — можно добавить `notifications_enabled`
- **Prisma billing models**: Subscription (status, currentPeriodEnd), Payment, PaymentEvent — данные для email переменных

### Established Patterns
- External API integration: CloudPayments webhook pattern (HMAC, catch-all route)
- ENV management: `.env` / `.env.production` / `.env.example` / Docker ARGs
- API routes: `apps/web/src/app/api/` для внешних интеграций

### Integration Points
- `apps/web/src/lib/cloudpayments/subscription-service.ts` — добавить CQ API вызовы при payment events
- `apps/web/src/lib/auth/actions.ts` — welcome email при signUp, password reset через CQ
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` или tRPC router — триггер «диагностика готова»
- Cron/scheduler — для цепочки неактивности (7/14/30 дней) и «скоро истекает»
- Supabase Dashboard — настройка custom SMTP или отключение auth emails

</code_context>

<specifics>
## Specific Ideas

- «Первым выводом в рамках этой фазы мне нужно будет передать команде какие конкретно письма для шаблонизации нужны» — EMAIL-SPEC.md готовится первым, до технической интеграции
- «Нужно подготовить примерные драфты этих писем и цепочку по которой они будут работать чтобы отдать команде» — полные драфты текстов + визуальные flow-схемы
- «Carrot Quest — нужно будет разобраться с их API, документацией, подключить» — исследовать CQ API docs при планировании
- «Письма от Supabase — я честно говоря никаких не видел» — проверить реальную работу Supabase mailer, возможно не настроен
- Google Doc копия EMAIL-SPEC.md на zebrosha@gmail.com для передачи email-команде

</specifics>

<deferred>
## Deferred Ideas

- **Центр уведомлений (колокольчик)** — полноценный notification center с историей, отдельная фаза
- **Push-уведомления (browser)** — Web Push API, требует service worker
- **Telegram-уведомления** — в проекте пока нет привязки к TG
- **Email-аналитика** — open rate, click rate, unsubscribe tracking
- **Настройки уведомлений пользователя** — какие письма получать, frequency preferences

</deferred>

---

*Phase: 22-transactional-email-notifications-billing-auth-system*
*Context gathered: 2026-03-13*
