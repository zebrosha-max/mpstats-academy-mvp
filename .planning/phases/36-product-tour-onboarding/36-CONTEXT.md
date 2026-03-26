# Phase 36: Product Tour / Onboarding - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Новые пользователи получают пошаговый tooltip-тур при первом посещении ключевых страниц: Dashboard, Обучение, Урок. Тур можно пропустить и повторить через кнопку в хедере.

**Зависимость:** Phase 35 (Lesson Comments) — комментарии нужны для шага в lesson-туре.

</domain>

<decisions>
## Implementation Decisions

### Библиотека
- **D-01:** Использовать **driver.js** для tooltip-туров. ~35KB gzip, декларативные шаги, встроенный highlight, keyboard navigation, accessibility.

### Шаги туров
- **D-02:** **Dashboard-тур** — Claude's Discretion. Оптимальные шаги определяются при планировании (рекомендация: 4-5 шагов — sidebar навигация, radar chart, CTA диагностики).
- **D-03:** **Learn-тур** — 5-6 шагов: поиск, фильтры, переключатель "Мой трек"/"Все курсы", секции (ошибки/рекомендации/custom), добавление в трек.
- **D-04:** **Lesson-тур** — 4-5 шагов: видеоплеер, AI-summary, AI-чат, комментарии (Phase 35), навигация prev/next.

### Триггеры и UX
- **D-05:** **Триггер запуска** — Claude's Discretion. Рекомендация: автостарт с задержкой 1-2 сек при первом визите (без модалов).
- **D-06:** **Кнопка повтора** — Claude's Discretion. Рекомендация: иконка HelpCircle (?) в хедере рядом с UserNav, запускает тур текущей страницы.

### Мобилка
- **D-07:** Шаги туров **адаптируются** под мобильный layout. Dashboard-тур показывает MobileNav (нижняя панель) вместо sidebar. Все туры работают на mobile и desktop.

### Хранение состояния
- **D-08:** localStorage с ключами `tour_{page}_completed` (паттерн из ROADMAP). Кнопка "Пропустить" устанавливает флаг. Совпадает с существующими паттернами (CookieConsent, DiagnosticHint).

### Claude's Discretion
- Dashboard-тур: конкретные шаги и тексты (D-02)
- Триггер запуска тура: авто vs модал, задержка (D-05)
- Кнопка повтора: расположение и поведение (D-06)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/ROADMAP.md` §Phase 36 — Success criteria (7 пунктов), depends on Phase 35

### Existing Code (integration points)
- `apps/web/src/app/(main)/layout.tsx` — Main layout, header (место для кнопки ?)
- `apps/web/src/components/shared/sidebar.tsx` — Sidebar nav items (targets для dashboard-тура)
- `apps/web/src/components/shared/mobile-nav.tsx` — Mobile nav (adaptive tour targets)
- `apps/web/src/app/(main)/dashboard/page.tsx` — Dashboard page (tour 1)
- `apps/web/src/app/(main)/learn/page.tsx` — Learn page (tour 2)
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — Lesson page (tour 3)

### Existing Patterns (localStorage)
- `apps/web/src/components/shared/CookieConsent.tsx` — localStorage pattern reference
- `apps/web/src/components/diagnostic/DiagnosticHint.tsx` — Hint dismissal pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Radix Popover** (`@radix-ui/react-popover`) — уже в зависимостях, используется в FilterPanel
- **shadcn/ui Dialog** — для потенциального welcome-модала (если Claude выберет)
- **lucide-react** — уже в зависимостях, есть `HelpCircle` icon
- **CookieConsent.tsx** — готовый паттерн localStorage check + dismiss + JSON state

### Established Patterns
- `'use client'` — все интерактивные компоненты клиентские
- localStorage: `getItem` → show/hide, `setItem` → dismiss (CookieConsent, DiagnosticHint, ThemeProvider)
- z-index стек: CookieConsent z-[9999], MobileNav z-50, header z-40 — тур-overlay нужен между header и cookie

### Integration Points
- **Header** в `(main)/layout.tsx` (строка ~48) — место для кнопки ? перед UserNav
- **Sidebar links** — `Link[href="/dashboard"]`, `Link[href="/learn"]` и т.д. — CSS-селекторы для tour targets
- **data-tour attributes** — нужно добавить на ключевые элементы в Dashboard, Learn, Lesson pages

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-product-tour-onboarding*
*Context gathered: 2026-03-26*
