# Phase 5: Security Hardening - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Защита всех endpoints авторизацией, rate limiting для AI/LLM endpoints, безопасный рендеринг AI-генерированного markdown, error boundaries для устойчивости UI. Приложение готово к production трафику.

</domain>

<decisions>
## Implementation Decisions

### Стратегия авторизации
- Все tRPC endpoints переводятся на `protectedProcedure` (без исключений)
- Публичные страницы (landing) не используют tRPC, конфликта нет
- Неавторизованный доступ к защищённой странице — тихий редирект на `/login` с `returnTo` параметром для возврата после логина
- CI скрипт сканирует `.next/` build output на наличие `service_role` key — build падает если найден

### Rate Limiting
- Реализация на уровне tRPC middleware (не Nginx)
- Лимиты по группам (из документации):
  - AI/LLM endpoints: 50 req/hour per user
  - Chat messages: 20 msg/hour per user
  - API general: 100 req/min per user
- Хранение счётчиков: in-memory Map (достаточно для MVP с одним контейнером, сбрасывается при рестарте)
- UX при 429: toast-уведомление "Слишком много запросов. Повторите через X минут" + disable кнопок на время ожидания

### AI Output Sanitization
- Библиотека: `react-markdown` с `rehype-sanitize` (без dangerouslySetInnerHTML)
- Разрешённые элементы: заголовки, списки, bold/italic, code blocks, таблицы
- Запрещённые: ссылки, изображения, raw HTML
- Таймкоды в AI ответах — кликабельные, по клику перематывают видео через postMessage API к Kinescope iframe
- Валидация AI output на сервере — Claude's discretion

### Error Boundaries
- Глобальная страница ошибки: `app/error.tsx` и `app/not-found.tsx` (кнопки "На главную" и "Повторить")
- Логирование: console.error (Sentry — потенциально позже)

### Claude's Discretion
- Гранулярность error boundaries (per-component vs per-page) — решить по анализу кода
- UX ошибки компонента (inline vs fullscreen) — решить при реализации
- Server-side валидация AI output (strip HTML или нет) — решить по анализу кода
- Конкретная библиотека для in-memory rate limiting (custom Map vs upstash/ratelimit)

</decisions>

<specifics>
## Specific Ideas

- Кликабельные таймкоды в AI ответах — уже есть postMessage API для Kinescope iframe, нужно парсить таймкоды из markdown и превращать в кнопки
- Rate limit toast должен показывать конкретное время ожидания, не просто "попробуйте позже"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-security-hardening*
*Context gathered: 2026-02-25*
