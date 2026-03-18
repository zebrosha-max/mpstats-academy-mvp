# Phase 27: SEO + Custom Error Pages - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Техническое SEO и брендинг ошибок: sitemap.xml, robots.txt, OG-теги для соцсетей, per-page metadata с уникальными title/description, брендированные 404/500 страницы с логотипом MPSTATS Academy. Yandex Webmaster верификация.

Не входит: JSON-LD structured data, динамические OG-изображения для уроков/курсов, legal-страницы (Phase 25).

</domain>

<decisions>
## Implementation Decisions

### OG-теги и соцсети
- Статичный PNG 1200x630 как OG-изображение по умолчанию — логотип MPSTATS Academy + слоган + градиент mp-blue
- Claude сгенерирует OG-изображение (SVG → PNG)
- Только Open Graph теги (og:title, og:description, og:image, og:url, og:type, og:locale)
- Twitter Cards НЕ добавлять — нерелевантно для РУ аудитории
- og:locale = ru_RU, никаких альтернативных locale
- Целевые соцсети: Telegram, VK, мессенджеры

### Sitemap + robots.txt
- Статический sitemap: `/`, `/pricing`, `/login`, `/register`
- Динамический sitemap для курсов/уроков НЕ нужен — контент за авторизацией
- Legal-страницы добавить в sitemap позже, когда Phase 25 будет реализована
- robots.txt: Disallow `/dashboard`, `/learn`, `/diagnostic`, `/profile`, `/admin`, `/api`. Allow `/`, `/pricing`, `/login`, `/register`
- Указать Sitemap URL в robots.txt
- Yandex Webmaster верификация через мета-тег (потребуется код верификации от пользователя)

### Брендированные 404/500
- Полировка текущих страниц (не полный редизайн): добавить логотип MPSTATS Academy (компонент Logo уже есть), улучшить тексты, mp-blue стиль
- Добавить `global-error.tsx` для обработки ошибок root layout (500-сценарий)
- Кнопка на 404 ведёт на `/` (сейчас на `/dashboard` — неаутентифицированные пользователи тоже видят 404)
- Кнопки: "На главную" (/) + "Повторить" (на error-страницах)

### Per-page metadata
- Уникальные title/description для всех публичных + основных защищённых страниц
- Формат title: "Название страницы | MPSTATS Academy"
- Страницы: /, /pricing, /login, /register, /dashboard, /learn, /diagnostic, /profile
- JSON-LD НЕ добавлять — закрытая образовательная платформа, не e-commerce/блог

### Claude's Discretion
- Конкретные тексты title и description для каждой страницы
- Дизайн OG-изображения (градиент, расположение элементов)
- Частоты обновления в sitemap (changefreq, priority)
- Стиль текстов на error-страницах

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing code
- `apps/web/src/app/layout.tsx` — текущий root layout с минимальной metadata
- `apps/web/src/app/not-found.tsx` — текущая 404 страница (базовый Card)
- `apps/web/src/app/error.tsx` — текущая error boundary
- `apps/web/src/app/(main)/error.tsx` — error boundary для main layout
- `apps/web/src/components/shared/Logo.tsx` — компонент логотипа (sizes: sm/md/lg/xl)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Logo` компонент (`components/shared/Logo.tsx`): sizes sm/md/lg/xl, variants default/white/dark — использовать на error-страницах
- `Card`, `CardContent` (`components/ui/card.tsx`): уже используются на текущих error-страницах
- `Button` (`components/ui/button.tsx`): variants default/outline — для CTA на error-страницах
- mp-blue/green/pink цветовая палитра в `tailwind.config.ts`

### Established Patterns
- Next.js Metadata API: `export const metadata: Metadata = {...}` — уже используется в layout.tsx
- Next.js Viewport: `export const viewport: Viewport = {...}` — уже используется в layout.tsx
- Компоненты error-страниц: `'use client'` + `useEffect` для логирования ошибок

### Integration Points
- `apps/web/src/app/layout.tsx` — root metadata (title template, default OG)
- `apps/web/src/app/*/page.tsx` — per-page metadata exports
- `apps/web/public/` — статические файлы (OG-изображение, favicon)
- `apps/web/src/app/sitemap.ts` — Next.js sitemap route (создать)
- `apps/web/src/app/robots.ts` — Next.js robots route (создать)

</code_context>

<specifics>
## Specific Ideas

- OG-изображение: mp-blue градиент фон, белый логотип MPSTATS Academy, слоган "Образовательная платформа для селлеров маркетплейсов"
- Legal-страницы (Phase 25) добавить в sitemap когда будут реализованы — не забыть

</specifics>

<deferred>
## Deferred Ideas

- Динамические OG-изображения (next/og ImageResponse) для курсов/уроков — отдельная фаза, когда контент станет публичным
- JSON-LD structured data (Organization, WebSite, Course) — пересмотреть когда платформа станет более открытой
- Google Search Console верификация — если понадобится
- Legal-страницы в sitemap — после Phase 25

</deferred>

---

*Phase: 27-seo-custom-error-pages-sitemap-robots-txt-og-404-500*
*Context gathered: 2026-03-18*
