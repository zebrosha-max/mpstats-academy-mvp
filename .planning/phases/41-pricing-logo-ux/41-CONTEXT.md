# Phase 41: Pricing & Logo UX - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Мелкие UX-фиксы: логотип ведёт в ЛК, курсы маппятся на оси диагностики, подпись в CP виджете, пустой custom track скрыт.

**Excluded from scope:**
- T-R5 (названия курсов) — скипнуто, текущие названия корректны
- T-R4 (таймер CP) — настройка в CloudPayments Dashboard, не в коде

</domain>

<decisions>
## Implementation Decisions

### Logo Navigation (T-R6)
- **D-01:** В `(main)` layout: Logo href → `/dashboard`. В `(auth)` layout и landing: Logo href → `/` (текущее поведение).
- **D-02:** Проверить все места где Logo используется: sidebar, pricing header, mobile nav.

### Course-to-Axis Mapping on Pricing (R15)
- **D-03:** В dropdown "Выберите курс" на pricing — после имени курса показать badge'и осей диагностики. Маппинг:
  - "Аналитика для маркетплейсов" → Аналитика, Финансы
  - "Реклама и продвижение" → Маркетинг, Операции
  - "AI-инструменты для селлеров" → Контент, Операции
  - "Работа с Ozon" → Аналитика, Операции, Финансы
- **D-04:** Маппинг хардкодить в pricing page (не тянуть из БД — 4 курса статичны).

### CP Widget Hint (T-R3)
- **D-05:** Добавить текст под полем "Номер карты" в CP виджете: "Дата и CVV — на следующем шаге". Мелкий серый текст (`text-xs text-muted-foreground`).

### Empty Custom Track (R40)
- **D-06:** Секция "Мои уроки" на learn page скрывается если `customSection.lessonIds.length === 0`.

### Claude's Discretion
- Exact badge styling for course→axis mapping
- CP hint exact placement (before or after button)

</decisions>

<canonical_refs>
## Canonical References

### Logo
- `apps/web/src/components/shared/sidebar.tsx` — Logo link in sidebar
- `apps/web/src/components/shared/Logo.tsx` — Logo component
- `apps/web/src/app/(main)/layout.tsx` — main layout

### Pricing
- `apps/web/src/app/pricing/page.tsx` — course dropdown, CP widget integration

### Learn Page
- `apps/web/src/app/(main)/learn/page.tsx` — custom section rendering

</canonical_refs>

<code_context>
## Existing Code Insights

### Logo
- `sidebar.tsx` uses `<Link href="/">` for Logo — needs conditional based on layout
- Logo component is pure visual, doesn't control href

### Pricing
- Dropdown renders courses from DB query — mapping needs to be added alongside
- Badge component already exists with category variants

### Custom Track
- Section rendering already has filter logic from Phase 38 (empty AI sections hidden)
- Custom section may need separate check

</code_context>

<specifics>
## Specific Ideas

- Course→axis mapping is business logic — hardcode is fine for 4 courses, no need for DB relation
- CP widget is CloudPayments iframe — hint text goes OUTSIDE the iframe, in our wrapper

</specifics>

<deferred>
## Deferred Ideas

- T-R5: Маркетинговые названия курсов — скипнуто (текущие ОК)
- T-R4: Таймер CP виджета — настройка в CP Dashboard, не код

</deferred>

---

*Phase: 41-pricing-logo-ux*
*Context gathered: 2026-03-27*
