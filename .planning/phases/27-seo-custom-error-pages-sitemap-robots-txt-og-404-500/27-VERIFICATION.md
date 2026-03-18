---
phase: 27-seo-custom-error-pages-sitemap-robots-txt-og-404-500
verified: 2026-03-18T12:30:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Открыть / в браузере и проверить page source"
    expected: "og:image, og:locale='ru_RU', og:type='website' присутствуют в <head>; title = 'MPSTATS Academy — образовательная платформа для селлеров'"
    why_human: "Нельзя запустить Next.js сервер в процессе верификации; метатеги рендерятся только при SSR/SSG"
  - test: "Открыть /sitemap.xml"
    expected: "XML с 4 URL: platform.mpstats.academy, /pricing, /login, /register"
    why_human: "Требует запущенного dev-сервера или production"
  - test: "Открыть /robots.txt"
    expected: "Disallow: /dashboard, /learn, /diagnostic, /profile, /admin, /api; Sitemap: https://platform.mpstats.academy/sitemap.xml"
    why_human: "Требует запущенного dev-сервера или production"
  - test: "Открыть несуществующую страницу /nonexistent"
    expected: "Отображается логотип MPSTATS Academy, текст 'Страница не найдена', кнопка 'На главную' ведёт на /"
    why_human: "Визуальная проверка брендинга 404"
  - test: "Поделиться ссылкой https://platform.mpstats.academy в Telegram или VK"
    expected: "Предварительный просмотр показывает OG-карточку с mp-blue фоном, логотипом MPSTATS Academy и описанием"
    why_human: "Социальные предварительные просмотры не поддаются программной проверке"
  - test: "Открыть /pricing и проверить title вкладки браузера"
    expected: "'Тарифы и цены | MPSTATS Academy'"
    why_human: "Требует запущенного сервера"
  - test: "Открыть /login и проверить title вкладки браузера"
    expected: "'Авторизация | MPSTATS Academy'"
    why_human: "Требует запущенного сервера"
---

# Phase 27: SEO + Custom Error Pages Verification Report

**Phase Goal:** Сайт корректно индексируется поисковиками (sitemap, robots.txt), ссылки красиво отображаются в соцсетях (OG-теги с брендированным изображением), каждая страница имеет уникальный title/description, error-страницы брендированы логотипом MPSTATS Academy
**Verified:** 2026-03-18T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | sitemap.xml содержит 4 публичные страницы (/, /pricing, /login, /register) | VERIFIED | `apps/web/src/app/sitemap.ts` — все 4 URL с baseUrl `platform.mpstats.academy` |
| 2 | robots.txt блокирует /dashboard, /learn, /diagnostic, /profile, /admin, /api | VERIFIED | `apps/web/src/app/robots.ts` — disallow array содержит все 6 путей; sitemap URL указан |
| 3 | Root layout имеет OG-теги (og:image, og:locale ru_RU, og:type website) и title template | VERIFIED | `apps/web/src/app/layout.tsx` строки 16-42 — `openGraph.locale='ru_RU'`, `openGraph.type='website'`, `images:[{url:'/og-default.png'}]`, `title.template='%s | MPSTATS Academy'` |
| 4 | Каждый route group имеет уникальный title и description | VERIFIED | `(auth)/layout.tsx` → 'Авторизация'; `(main)/layout.tsx` → 'Личный кабинет' + noindex; `pricing/layout.tsx` → 'Тарифы и цены' + OG override |
| 5 | Error-страницы (404, error, global-error) показывают логотип MPSTATS Academy | VERIFIED | `not-found.tsx` — `import { Logo }`, рендерит `<Logo size="md">`; `error.tsx` — `import { Logo }`, рендерит `<Logo size="md">`; `global-error.tsx` — inline SVG с `viewBox="0 0 100 143"` fill="#2C4FF8"; `(main)/error.tsx` — `import { Logo }`, рендерит `<Logo size="sm" showText={false}>` |
| 6 | 404 страница ведёт на / (не /dashboard) | VERIFIED | `not-found.tsx` строка 21: `<Link href="/">` — не содержит `/dashboard` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/layout.tsx` | Root metadata с title template, OG defaults, og:locale ru_RU | VERIFIED | Содержит `openGraph`, `locale: 'ru_RU'`, `template: '%s | MPSTATS Academy'`, `metadataBase`, Yandex verification |
| `apps/web/src/app/sitemap.ts` | Static sitemap с публичными URL | VERIFIED | Экспортирует default function, 4 URL, priority и changeFrequency |
| `apps/web/src/app/robots.ts` | robots.txt с Disallow rules | VERIFIED | Экспортирует default function, 6 Disallow путей, sitemap reference |
| `apps/web/public/og-default.png` | Default OG image 1200x630 | VERIFIED | Существует, валидный PNG (magic bytes 89 50 4E 47), размер 58842 байт (58KB) |
| `apps/web/src/app/not-found.tsx` | Branded 404 с Logo, link to / | VERIFIED | Импортирует Logo, `<Logo size="md">`, `<Link href="/">` |
| `apps/web/src/app/error.tsx` | Branded error page с Logo | VERIFIED | Импортирует Logo, рендерит `<Logo size="md">`, Retry + Home кнопки |
| `apps/web/src/app/global-error.tsx` | Root-level error с inline branding | VERIFIED | Inline SVG логотипа `viewBox="0 0 100 143"` fill="#2C4FF8", inline styles (корректно для root error — нет Tailwind) |
| `apps/web/src/app/(auth)/layout.tsx` | Auth pages metadata | VERIFIED | `export const metadata: Metadata = { title: 'Авторизация', description: ... }` |
| `apps/web/src/app/(main)/layout.tsx` | Main pages metadata с noindex | VERIFIED | `robots: { index: false, follow: false }`, title: 'Личный кабинет' |
| `apps/web/src/app/pricing/layout.tsx` | Pricing page metadata | VERIFIED | Создан, title: 'Тарифы и цены', openGraph overrides |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/app/layout.tsx` | `apps/web/public/og-default.png` | `metadata.openGraph.images` | WIRED | `images: [{ url: '/og-default.png', width: 1200, height: 630 }]` |
| `apps/web/src/app/robots.ts` | `apps/web/src/app/sitemap.ts` | sitemap URL reference | WIRED | `sitemap: 'https://platform.mpstats.academy/sitemap.xml'` |
| `apps/web/src/app/not-found.tsx` | `apps/web/src/components/shared/Logo.tsx` | `import { Logo }` | WIRED | Строка 2: `import { Logo } from '@/components/shared/Logo'` |
| `apps/web/src/app/error.tsx` | `apps/web/src/components/shared/Logo.tsx` | `import { Logo }` | WIRED | Строка 5: `import { Logo } from '@/components/shared/Logo'` |
| `apps/web/src/app/(main)/error.tsx` | `apps/web/src/components/shared/Logo.tsx` | `import { Logo }` | WIRED | Строка 5: `import { Logo } from '@/components/shared/Logo'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SEO-01 | 27-01-PLAN.md | (не описан в REQUIREMENTS.md) | ORPHANED | Покрыт sitemap.ts (4 публичных URL) |
| SEO-02 | 27-01-PLAN.md | (не описан в REQUIREMENTS.md) | ORPHANED | Покрыт robots.ts (6 Disallow правил) |
| SEO-03 | 27-01-PLAN.md | (не описан в REQUIREMENTS.md) | ORPHANED | Покрыт layout.tsx (OG-теги, title template) |
| SEO-04 | 27-02-PLAN.md | (не описан в REQUIREMENTS.md) | ORPHANED | Покрыт per-layout metadata |
| SEO-05 | 27-02-PLAN.md | (не описан в REQUIREMENTS.md) | ORPHANED | Покрыт branded error pages |
| SEO-06 | 27-02-PLAN.md | (не описан в REQUIREMENTS.md) | ORPHANED | Покрыт not-found.tsx → href="/" |

**Важно: SEO-01 — SEO-06 отсутствуют в `.planning/REQUIREMENTS.md`.** Они заявлены в PLAN frontmatter, но не зарегистрированы в документе требований. Реализация выполнена, но трейсабилити разорвана. Требования следует добавить в REQUIREMENTS.md для полноты.

### Anti-Patterns Found

Нет. Все файлы содержат полноценные реализации без заглушек, TODO или placeholder-контента.

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | — |

Дополнительная проверка выполнена:
- `layout.tsx` не содержит `twitter` (Twitter Cards исключены по решению)
- `layout.tsx` не содержит `application/ld+json` (JSON-LD исключён по решению)
- OG image — валидный PNG (magic bytes подтверждены), 58KB, не заглушка

### Human Verification Required

#### 1. OG-карточки в соцсетях

**Test:** Поделиться ссылкой `https://platform.mpstats.academy` в Telegram и VK
**Expected:** Отображается OG-карточка с mp-blue градиентом, логотипом MPSTATS Academy, описанием "AI-диагностика навыков..."
**Why human:** Социальные предварительные просмотры не поддаются программной проверке

#### 2. Sitemap и robots.txt в браузере

**Test:** Открыть `/sitemap.xml` и `/robots.txt` в запущенном приложении
**Expected:** sitemap — XML с 4 URL; robots.txt — Disallow для 6 защищённых путей + Sitemap reference
**Why human:** Требует запущенного dev-сервера или production

#### 3. Page titles по всем маршрутам

**Test:** Открыть `/pricing`, `/login`, `/register`, `/dashboard` и проверить title вкладки
**Expected:** `/pricing` → "Тарифы и цены | MPSTATS Academy"; `/login` → "Авторизация | MPSTATS Academy"; `/dashboard` → "Личный кабинет | MPSTATS Academy"
**Why human:** Next.js Metadata API рендерит теги только при активном сервере

#### 4. Branded 404 page

**Test:** Открыть несуществующий URL `/nonexistent` в браузере
**Expected:** Логотип MPSTATS Academy, текст "Страница не найдена", кнопка "На главную" ведёт на `/`
**Why human:** Визуальная проверка, требует запущенного приложения

#### 5. OG source в HTML

**Test:** Открыть `/` → "Просмотр кода страницы" в браузере, поиск `og:image`, `og:locale`, `og:type`
**Expected:** `og:image` → `https://platform.mpstats.academy/og-default.png`; `og:locale` → `ru_RU`; `og:type` → `website`
**Why human:** Требует SSR-рендеринга страницы в браузере

### Notes

1. **Yandex Webmaster верификация:** Добавлена через `verification.yandex: 'ca2450fe5fe87a68'` в root metadata (commit `5f5af7d`). Next.js автоматически рендерит `<meta name="yandex-verification" content="ca2450fe5fe87a68">`. Сам код верификации предоставлен пользователем на checkpoint.

2. **REQUIREMENTS.md не обновлён:** SEO-01..SEO-06 определены в PLAN frontmatter, но не добавлены в `.planning/REQUIREMENTS.md`. Трейсабилити таблица (`## Traceability`) также не обновлена. Рекомендуется добавить эти требования в следующей сессии.

3. **Windows symlink EPERM:** `next build --output=standalone` падает на Windows из-за EPERM при создании симлинков. Это pre-existing баг (не связан с Phase 27). Компиляция TypeScript (`tsc --noEmit`) успешна.

4. **`global-error.tsx` использует inline styles:** Это корректное решение — root error boundary не имеет доступа к Tailwind CSS. Брендирование реализовано через inline SVG с `fill="#2C4FF8"`.

---

_Verified: 2026-03-18T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
