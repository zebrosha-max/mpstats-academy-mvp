# Phase 26: Яндекс Метрика — Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Интеграция Яндекс.Метрики на платформу platform.mpstats.academy: подключение счётчика, SPA-навигация, набор целей с параметрами, ecommerce-цель с revenue. Cookie consent вне скоупа (Phase 25).

</domain>

<decisions>
## Implementation Decisions

### Счётчик и окружение
- Общий счётчик **94592073** (mpstats.academy) — тот же что в connect.mpstats.academy
- Цели с префиксом `platform_` для отличия от `connect_` целей
- Метрика загружается **только в production** (`NODE_ENV === 'production'`)
- Загрузка безусловная (без consent-проверки) — Phase 25 потом обернёт в баннер кук
- ENV переменная `NEXT_PUBLIC_YANDEX_ID=94592073`

### SPA-навигация и функции
- Библиотека `@koiztech/next-yandex-metrika` (та же что в connect) — авто-хиты при client-side переходах
- Все функции включены: webvisor, clickmap, trackLinks, accurateTrackBounce
- Стратегия загрузки: `afterInteractive`

### Цели и события (полный набор с параметрами)
- `platform_signup` — регистрация (params: method: 'email'|'yandex')
- `platform_login` — логин (params: method)
- `platform_diagnostic_start` — начало диагностики
- `platform_diagnostic_complete` — завершение диагностики (params: avgScore)
- `platform_lesson_open` — открытие урока (params: courseId, lessonId)
- `platform_pricing_view` — открытие /pricing
- `platform_payment` — успешная оплата (params: planId, amount, currency)
- `platform_cta_click` — клик по CTA на лендинге (params: position)

### Ecommerce-трекинг
- Цель оплаты `platform_payment` с revenue: передаём сумму (amount) и id плана (planId)
- Без полного dataLayer — достаточно reachGoal с параметрами
- Revenue данные для ROI-анализа в Метрике

### Архитектура кода
- Хелпер-модуль `lib/analytics/metrika.ts` + `lib/analytics/constants.ts` (паттерн из connect)
- Типизированные имена целей через `METRIKA_GOALS` const + `MetrikaGoal` type
- `reachGoal(goal, params)` — safe-вызов с проверкой window/ym/counterId

### Claude's Discretion
- Конкретные точки вызова reachGoal в компонентах (какие хендлеры/useEffect)
- Нужна ли noscript-заглушка `<img>` для Метрики
- Добавление NEXT_PUBLIC_YANDEX_ID в Dockerfile ARGs (аналогично CP public key)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Паттерн из connect
- `D:\GpT_docs\mpstats-connect\web\lib\analytics\metrika.ts` — reachGoal хелпер
- `D:\GpT_docs\mpstats-connect\web\lib\analytics\constants.ts` — METRIKA_GOALS типы
- `D:\GpT_docs\mpstats-connect\web\app\layout.tsx` — YandexMetrika компонент в body, production-only

### Текущий проект
- `apps/web/src/app/layout.tsx` — root layout, сюда добавляется YandexMetrika
- `apps/web/src/app/(auth)/register/page.tsx` — точка вызова platform_signup
- `apps/web/src/app/(auth)/login/page.tsx` — точка вызова platform_login
- `apps/web/src/app/(main)/diagnostic/session/page.tsx` — diagnostic_start/complete
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — lesson_open
- `apps/web/src/app/pricing/page.tsx` — pricing_view
- `apps/web/src/app/api/webhooks/cloudpayments/route.ts` — payment webhook (server-side, reachGoal не вызвать)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Root layout уже имеет `<script dangerouslySetInnerHTML>` паттерн (тема + Carrot Quest)
- `@koiztech/next-yandex-metrika` — уже используется в connect, npm зависимость проверена
- `sonner` Toaster — уже в layout, можно координировать позиционирование

### Established Patterns
- Third-party скрипты в `<head>` через `dangerouslySetInnerHTML` (тема, CQ)
- `NEXT_PUBLIC_*` переменные вшиваются при build — нужен ARG в Dockerfile
- Production-only рендеринг через `process.env.NODE_ENV === 'production'`
- Carrot Quest аналитика уже трекает events — не дублировать CQ и YM для тех же событий

### Integration Points
- `apps/web/src/app/layout.tsx` — `<YandexMetrika>` компонент в `<body>`
- Auth pages — вызов reachGoal при успешной регистрации/логине
- Diagnostic session — вызов при старте и завершении сессии
- Lesson page — вызов при открытии урока
- Pricing page — вызов при маунте страницы
- **Payment:** CloudPayments webhook — server-side, reachGoal нужен на клиенте после возврата из виджета

</code_context>

<specifics>
## Specific Ideas

- Использовать тот же паттерн что в mpstats-connect: `@koiztech/next-yandex-metrika` + `lib/analytics/` с constants + хелпером
- Общий счётчик 94592073 на весь mpstats.academy — данные фильтруются по URL в отчётах Метрики
- Префикс `platform_` во всех целях для разделения с `connect_` целями

</specifics>

<deferred>
## Deferred Ideas

- Cookie consent баннер — Phase 25 (Legal + Cookie Consent). Когда будет готова — обернуть загрузку Метрики в проверку согласия
- GTM/Google Analytics — не планируется, достаточно Яндекс.Метрики
- A/B тесты через Метрику — отдельная инициатива если понадобится

</deferred>

---

*Phase: 26-yandex-metrika*
*Context gathered: 2026-03-19*
