# Phase 24: Support Contact - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Функционал связи пользователя со службой поддержки: публичная страница /support с контактной информацией, FAQ и формой обратной связи, ссылки в sidebar и landing footer. Администрирование обращений — через CQ dashboard (без интеграции в /admin).

</domain>

<decisions>
## Implementation Decisions

### Каналы связи
- Основной канал — CQ чат-виджет (уже встроен в root layout, Phase 22)
- Fallback — email clients@mpstats.academy (показывать на странице)
- CQ виджет остаётся на всех страницах без изменений
- Telegram — возможно позже, в скоупе этой фазы нет

### Точки входа
- Ссылка "Поддержка" в футере sidebar (рядом с "Админка")
- Ссылка в footer landing page (для неавторизованных)
- Отдельная страница `/support` — публичная, вне `(main)` layout (как /pricing)
- Свой header с кнопкой "Назад" (паттерн /pricing)

### Контент страницы /support
- Блок контактов: email clients@mpstats.academy + кнопка "Написать в чат" (открывает CQ виджет)
- FAQ блок: 3-5 частых вопросов в аккордеоне (оплата, доступ, технические проблемы)
- Форма обратной связи:
  - Дропдаун темы (4-5 вариантов): Оплата и подписка / Проблема с доступом / Техническая проблема / Предложение / Другое
  - Поле сообщения (textarea)
  - Поле email — показывается для неавторизованных, автозаполняется для авторизованных
  - Отправка через CQ event "Support Request" с props (theme, message, email)

### Доступность
- Страница /support — публичная, доступна всем (без авторизации)
- Форма работает и для гостей (с обязательным email) и для залогиненных (email подставляется)

### Админская сторона
- Все обращения (чат + форма) попадают в CQ dashboard
- Никакой интеграции в /admin панель нашей платформы
- CQ-автоматизация (автоответы, маршрутизация) — настроить позже вручную в CQ

### Claude's Discretion
- Дизайн и layout страницы /support (в стиле mp-colors)
- Точные тексты FAQ вопросов/ответов
- Анимации и hover-эффекты
- Toast-уведомление после отправки формы

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CQ Integration (Phase 22)
- `apps/web/src/lib/carrotquest/client.ts` — CQ API client (form-encoded, by_user_id)
- `apps/web/src/lib/carrotquest/types.ts` — Event name types
- `apps/web/src/app/layout.tsx` — CQ widget script injection

### UI Patterns
- `apps/web/src/app/pricing/page.tsx` — Паттерн публичной страницы вне (main) layout: свой header с back nav, LogoMark на мобилке
- `apps/web/src/components/shared/sidebar.tsx` — Футер sidebar (где добавить ссылку "Поддержка")
- `apps/web/src/components/shared/mobile-nav.tsx` — Мобильная навигация (добавить ссылку)

No external specs — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CQ API client** (`lib/carrotquest/client.ts`): trackEvent() для отправки "Support Request" events
- **CQ widget**: Уже в root layout — можно программно открыть через `window.carrotquest.open()`
- **CarrotQuestIdentify** (`components/shared/CarrotQuestIdentify.tsx`): HMAC auth для авторизованных
- **shadcn/ui components**: Accordion (для FAQ), Select (для дропдауна тем), Textarea, Input, Button, Card
- **Logo/LogoMark** (`components/shared/Logo.tsx`): Для header страницы
- **sonner toast**: Уже используется в проекте для уведомлений

### Established Patterns
- **Публичная страница вне (main) layout**: /pricing — свой header с back nav, публичный доступ, LogoMark на мобилке
- **CQ event отправка**: `trackEvent(userId, eventName, props)` через form-encoded API
- **Sidebar footer links**: "Админка" — условная ссылка внизу sidebar, тот же паттерн для "Поддержка"
- **Feature flag pattern**: `isFeatureEnabled()` если нужен kill switch

### Integration Points
- **Sidebar footer**: Добавить NavItem "Поддержка" → `/support` (всегда видна, не условная)
- **MobileNav**: Аналогично добавить ссылку
- **Landing footer**: Добавить ссылку в существующий footer секцию
- **CQ trackEvent**: Новый event "Support Request" с props: theme, message, email, userId (если авторизован)
- **middleware.ts**: /support должен быть в публичных routes (как /pricing)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- Telegram канал поддержки — возможно в будущем
- CQ автоматизация (автоответы, маршрутизация обращений) — настроить вручную в CQ dashboard
- Интеграция обращений в /admin панель — если вырастет объём обращений

</deferred>

---

*Phase: 24-support-contact*
*Context gathered: 2026-03-19*
