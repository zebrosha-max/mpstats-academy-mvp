# Phase 14: Tech Debt Cleanup - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Устранение технического долга: миграция in-memory данных диагностики в Supabase, кеширование AI-сгенерированных вопросов с TTL-обновлением, progressive loading при генерации вопросов, динамическая версия Prisma в Dockerfile, восстановление Kinescope thumbnails для уроков.

</domain>

<decisions>
## Implementation Decisions

### Кеширование AI вопросов
- Глобальный банк ~30 AI-вопросов на категорию (5 категорий = ~150 вопросов) хранится в Supabase
- При старте диагностики — случайная выборка 15 вопросов (3/категория) из банка, без LLM-вызова
- TTL-обновление: банк регенерируется каждые 7-14 дней автоматически
- При регенерации: первый запрос триггерит обновление, остальные юзеры получают из старого банка пока не готово
- Фиксированный fallback-пул: существующие 100 mock-вопросов из `packages/api/src/mocks/questions.ts`
- Миксование: если AI-банка не хватает — добираем из fallback-пула
- Кнопка "Обновить вопросы" в админ-панели для принудительной регенерации

### Миграция in-memory данных
- Решение о scope миграции (activeSessionQuestions / completedSessions / skillProfiles) — Claude's Discretion
- Решение о поведении после рестарта (восстановление сессии vs начало заново) — Claude's Discretion
- Решение о таймауте активной сессии — Claude's Discretion

### Progressive loading UX
- Стиль и реализация progressive loading при генерации вопросов диагностики — Claude's Discretion
- Текущее состояние: генерация ощутимо долгая, но терпимая; желательно ускорить на 20-30%

### Kinescope thumbnails
- Восстановить индивидуальные thumbnails из Kinescope для каждого урока вместо одинаковых заглушек
- Thumbnails должны подтягиваться из Kinescope API или embed URL по videoId

### Dockerfile Prisma version
- Захардкоженная версия Prisma в Dockerfile → динамическое определение из package.json

### Claude's Discretion
- Scope миграции in-memory (всё или только activeSessionQuestions)
- Поведение при рестарте сервера (восстановление активной сессии или "начните заново")
- Таймаут активной сессии диагностики
- Стиль progressive loading (этапы с текстом, progress bar, или другое)
- Исключение повторных вопросов при повторной диагностике (best effort)
- Конкретный TTL (7 или 14 дней)

</decisions>

<specifics>
## Specific Ideas

- Цепочка fallback из Phase 2: Primary LLM → Fallback LLM → Mock вопросы — сохранить при кешировании
- AI-банк + fallback-пул дают надёжность: даже если LLM упал, юзер получает вопросы из fallback
- `questions.generated.ts` (100 AI-сгенерированных) можно использовать как seed для начального банка в DB
- Kinescope thumbnails — "выглядит более живо" с реальными превью вместо заглушек

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-tech-debt-cleanup*
*Context gathered: 2026-02-27*
