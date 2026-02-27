# Phase 15: Landing Redesign & Theme Toggle - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Заменить текущий лендинг (app/page.tsx) на новый дизайн design-v4a (light) с возможностью переключения на тёмную тему (design-v1). Премиальный вид, SVG radar chart, dark CTA блок, toggle dark/light. Оба дизайна уже готовы как отдельные страницы — нужно объединить в один компонент с переключением.

</domain>

<decisions>
## Implementation Decisions

### Theme Toggle UX
- Toggle размещён в header, справа от кнопки "Войти" (перед auth-кнопками)
- Вид: иконка Sun/Moon — одна иконка, клик переключает
- Анимация смены темы: плавный fade ~300ms (CSS transition на background/color)
- Сохранение: localStorage. При первом визите — light тема. При повторном — восстановление выбора
- Порядок элементов в header: [Logo] ... [Toggle] [Войти] [Начать бесплатно]

### Цветовая палитра
- Синий акцент: #2C4FF8 — одинаковый в обеих темах (брендовый цвет)
- Зелёный акцент: разный по темам — Light: #10B981 (emerald), Dark: #87F50F (acid green)
- Radar chart: цвета точек навыков (indigo, blue, green, amber, pink) одинаковые в обеих темах
- Тёмный фон: #060B1F (из design-v1)
- Светлый фон: #FAFBFC (из design-v4a)

### Навигация и Header
- Sticky header с backdrop-blur в обеих темах (Light: white/90, Dark: #060B1F/80)
- Минимальная навигация: только [Toggle] [Войти] [Начать бесплатно] — без доп. ссылок
- Hamburger-меню на мобильных: на усмотрение Claude

### Контент и секции
- Все секции из design-v4a остаются: Hero+Bento, Ticker, Stats, Features (Bento), How it works, Quote, CTA, Footer
- Данные (кол-во уроков, курсов, часов) — динамические из БД через API-запрос
- CTA блок внизу — ВСЕГДА тёмный в обеих темах
- Старые design-страницы (design-v1/v2/v3/v4/v4a/v4b/design-demo) — оставить как бэкап, НЕ удалять

### Claude's Discretion
- Подход к тематизации: CSS-переменные vs Tailwind dark: vs другой подход
- Hamburger-меню на мобильных: нужен или нет
- Структура компонентов (один файл vs разбивка на секции)
- Обработка FOUC (flash of unstyled content) при загрузке с localStorage

</decisions>

<specifics>
## Specific Ideas

- Оба дизайна (v1 dark и v4a light) уже полностью готовы как отдельные страницы — одинаковая верстка, разные цвета
- design-v4a: `apps/web/src/app/design-v4a/page.tsx` — эталон для light
- design-v1: `apps/web/src/app/design-v1/page.tsx` — эталон для dark
- SVG radar chart вычисляется inline (пентагон, 5 осей навыков) — нужно сохранить
- CTA блок в v4a использует `bg-[#0A0F25]` — фактически уже тёмный

</specifics>

<deferred>
## Deferred Ideas

- Применение dark/light темы ко внутренним страницам (dashboard, learn, diagnostic) — отдельная фаза
- Удаление design-* страниц — пользователь хочет оставить как бэкап (отклоняется от success criteria #5)

</deferred>

---

*Phase: 15-landing-redesign-theme-toggle*
*Context gathered: 2026-02-27*
