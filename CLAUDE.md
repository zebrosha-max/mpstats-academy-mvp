# CLAUDE.md — MPSTATS Academy MVP

**Last updated:** 2026-03-26

## Last Session (2026-03-26, session 2)

**Phase 36 — Product Tour / Onboarding (code complete, tested locally):**
- driver.js интегрирован, 3 tooltip-тура: Dashboard (4 шага), Learn (5 шагов), Lesson (5 шагов)
- TourProvider + HelpCircleButton в main layout, auto-start 1.5s delay, localStorage persistence
- 14 data-tour атрибутов на 5 файлах (sidebar, mobile-nav, dashboard, learn, lesson)
- 7/8 автотестов PASS, 1 (mobile viewport) требует ручной проверки
- 2 бага исправлены: TourProvider scope (header outside context), onDestroyStarted infinite loop
- CSS overrides загружены (40 rules), но визуально стандартный driver.js стиль — cosmetic issue
- Phase 35 (Comments) не реализована → `lesson-comments` data-tour атрибут отсутствует, driver.js gracefully пропускает

**Ключевые файлы Phase 36:**
- `apps/web/src/lib/tours/definitions.ts` — 3 tour definitions, 14 steps, mobile adaptation
- `apps/web/src/components/shared/TourProvider.tsx` — React context + driver.js orchestration
- `apps/web/src/components/shared/HelpCircleButton.tsx` — conditional help button
- `apps/web/src/styles/tour.css` — MPSTATS brand CSS overrides
- `apps/web/src/app/(main)/layout.tsx` — TourProvider wraps header+main

### Previous Session (2026-03-26)

**LLM Model Switch — Qwen 3.5 Flash (deployed):**
- Модель переключена с `openai/gpt-4.1-nano` на `qwen/qwen3.5-flash-02-23` (все задачи: summary, chat, диагностика)
- Причина: дешевле ($0.26/M vs $0.40/M output), быстрее (6.2s vs 6.5s), качественнее (верная арифметика, IFBench 76.5)
- json_schema strict mode — PASS, Zod validation — PASS, reasoning OFF — 6.2s
- Fallback: `openai/gpt-4.1-nano` (был `google/gemini-3.1-flash-lite-preview`)
- Файл: `packages/ai/src/openrouter.ts`

**Roadmap — 3 pre-launch фазы добавлены (34-36):**
- Phase 34: User Profile Enhancement (аватар upload, display name)
- Phase 35: Lesson Comments (комментарии к урокам, 1-level threading)
- Phase 36: Product Tour / Onboarding (3 tooltip-тура: dashboard, learn, lesson)

**Architecture HTML — 3 варианта созданы:**
- `docs/architecture-cyberpunk.html` — Cyberpunk/Terminal стиль
- `docs/architecture-blueprint.html` — Editorial/Blueprint стиль
- `docs/architecture-brand.html` — MPSTATS Brand стиль

### Previous Session (2026-03-25–26)

**Phase 33 — CQ fix + тестирование (2026-03-25):**
- Исправлен формат: `setUserProps` (свойства на лида) → `trackEvent` (триггер без params)
- CQ команда подтвердила корректность (10/10 событий, 200 OK)
- Phase 22 закрыта как superseded by Phase 33

**Phase 25 — Legal + Cookie Consent (2026-03-26, complete + deployed):**
- 5 legal-страниц: `/legal/offer`, `/legal/pdn`, `/legal/adv`, `/legal/cookies`, `/policy`
- Оферта из docx (ООО МПСТАТС ПРОДВИЖЕНИЕ, ИНН 7804713205, URL + 24ч заполнены)
- 3 чекбокса на регистрации: оферта (обязательный), ПДн (обязательный), рекламная рассылка (опциональный)
- Cookie consent баннер (необходимые/аналитика/маркетинг категории, localStorage)
- Legal ссылки в footer лендинга + sidebar
- `LegalPageLayout` — shared layout с prose styling
- 12 E2E тестов (`legal.spec.ts`) — все passed на проде

**CQ gotcha (critical):**
- Свойства передаются НЕ через `params` в `trackEvent`, а через `setUserProps` на лида
- Паттерн: `setUserProps(userId, { pa_course_name: '...' })` → `trackEvent(userId, 'pa_payment_success')`

**Ключевые файлы Phase 25:**
- `apps/web/src/components/legal/LegalPageLayout.tsx` — shared layout
- `apps/web/src/app/legal/offer/page.tsx` — оферта (418 строк)
- `apps/web/src/app/legal/pdn/page.tsx` — согласие ПДн
- `apps/web/src/app/legal/adv/page.tsx` — согласие реклама
- `apps/web/src/app/legal/cookies/page.tsx` — политика cookies
- `apps/web/src/app/policy/page.tsx` — политика конфиденциальности
- `apps/web/src/components/shared/CookieConsent.tsx` — cookie banner
- `apps/web/src/components/ui/checkbox.tsx` — shadcn checkbox
- `apps/web/tests/e2e/legal.spec.ts` — 12 E2E тестов

### Previous Session (2026-03-24)

**QA Test Suite — 55 тестов, 0 failures:**
- 24 unit тестов (Vitest) — auth integration
- 31 E2E тестов (Playwright) — 5 новых файлов:
  - `landing.spec.ts` — 4 теста (починены 2 устаревших селектора после редизайна)
  - `protected-routes.spec.ts` — 7 тестов (все 5 protected routes + login/register)
  - `auth-flow.spec.ts` — 4 теста (login, invalid creds, logout, auth redirect)
  - `diagnostic-flow.spec.ts` — 4 теста (intro → session → feedback → radar chart, полный flow ~1 мин)
  - `learning-flow.spec.ts` — 4 теста (courses → lesson → video → AI summary)
  - `accessibility.spec.ts` — 8 тестов (WCAG 2.0 AA на 8 страницах, axe-core)
- 4 a11y бага исправлены: Logo aria-label, FilterPanel select labels, pricing htmlFor, diagnostic link underline
- Test user: `tester@mpstats.academy` / `TestUser2024` (пароль сброшен через Admin API)
- Sprint 5 закрыт — все задачи выполнены через GSD фазы
- CLAUDE.md обновлён: QA debt почти полностью закрыт

**Phase 33 — CQ Email Automation (code complete, deployed):**
- 12 CQ событий переименованы → `pa_` prefix (pa_payment_success, pa_doi, etc.)
- Свойства обновлены: pa_course_name, pa_amount, pa_period_end, pa_access_until, pa_name, pa_doi, pa_password_link
- `lastActiveAt DateTime?` добавлен в UserProfile + tRPC tracking (5-min debounce, fire-and-forget)
- 2 новые email функции: `sendSubscriptionExpiringEmail`, `sendInactiveEmail`
- Auth callback: `pa_registration_completed` при первом подтверждении email (lastActiveAt === null)
- 2 cron endpoints: `/api/cron/check-subscriptions` (3-day window), `/api/cron/inactive-users` (7/14/30d windows)
- GitHub Action `daily-cron.yml` — 06:00 UTC ежедневно
- CRON_SECRET + SITE_URL в GitHub Secrets
- Задеплоено на прод, контейнер healthy
- **Осталось:** Plan 33-03 — ручная настройка CQ дашборда (10 automation rules + HTML шаблоны)

**Ключевые файлы Phase 33:**
- `apps/web/src/lib/carrotquest/types.ts` — 12 CQ event names с pa_ prefix
- `apps/web/src/lib/carrotquest/emails.ts` — 6 email functions (4 renamed + 2 new)
- `apps/web/src/app/api/webhooks/supabase-email/route.ts` — pa_doi, pa_password_reset
- `apps/web/src/app/auth/callback/route.ts` — pa_registration_completed
- `apps/web/src/app/api/cron/check-subscriptions/route.ts` — subscription expiry cron
- `apps/web/src/app/api/cron/inactive-users/route.ts` — inactive users cron
- `.github/workflows/daily-cron.yml` — daily cron trigger
- `packages/api/src/trpc.ts` — lastActiveAt tracking in protectedProcedure

### Previous Session (2026-03-19, session 2)

**Phase 26 — Яндекс Метрика (complete + deployed):**
- Общий счётчик 94592073 (mpstats.academy) — тот же что в connect
- `@koiztech/next-yandex-metrika` в root layout (production-only, afterInteractive)
- Все функции: webvisor, clickmap, trackLinks, accurateTrackBounce
- 8 типизированных целей с префиксом `platform_` (signup, login, diagnostic_start/complete, lesson_open, pricing_view, payment с revenue, cta_click)
- Хелпер-модуль `lib/analytics/` (паттерн из connect): constants.ts + metrika.ts + yandex-metrika.d.ts
- `reachGoal()` вызывается в 7 страницах (register, login, diagnostic session/results, lesson, pricing, landing)
- Payment goal на клиенте (CP widget callback), не на server webhook
- Dockerfile ARG + docker-compose build arg для NEXT_PUBLIC_YANDEX_ID
- 8 целей созданы в дашборде Метрики (тип: JavaScript-событие)
- Задеплоено на прод, контейнер healthy

**Ключевые файлы:**
- `apps/web/src/lib/analytics/constants.ts` — METRIKA_GOALS typed constants
- `apps/web/src/lib/analytics/metrika.ts` — safe reachGoal helper
- `apps/web/src/types/yandex-metrika.d.ts` — Window.ym global type
- `apps/web/src/app/layout.tsx` — YandexMetrika component

### Previous Session (2026-03-19)

**Phase 32 — Custom Track Management (complete):**
- 3 tRPC мутации, custom секция в треке, toggle/remove buttons, rebuild с AlertDialog
- Verification: 11/11 must-haves, 10/10 TRACK requirements

### Previous Session (2026-03-18, session 3)

**Phase 22 — Carrot Quest Integration (code complete, deployed, testing tomorrow):**
- CQ credentials received from email team, full integration deployed
- CQ JS widget added to root layout `<head>` (app ID: `57576-5a5343ec7aac68d788dabb2569`)
- `CarrotQuestIdentify` component — HMAC-SHA256 user auth in (main) layout
- Supabase Send Email Hook fixed: Standard Webhooks verification (not JWT!)
- CQ API client: form-encoded requests, `by_user_id=true` for Supabase UUIDs
- Event names without `$` prefix: `User Registered`, `Payment Success`, `Email Confirmation`, etc.
- Props format: `operations=[{op,key,value}]` array
- `$email`/`$name` set on user registration via `setUserProps`
- Feature flag `email_notifications_enabled` = true
- First event `User Registered` for `clients@mpstats.academy` confirmed in CQ dashboard
- **Next:** test all events, configure CQ automation rules, upload HTML email templates

**CQ API Gotchas (critical):**
- API = `application/x-www-form-urlencoded`, NOT JSON
- Event names with `$` are reserved (system events) — use plain names
- Props = `operations` param with JSON array `[{op, key, value}]`
- Supabase HTTPS hooks = Standard Webhooks (webhook-id/timestamp/signature headers), secret format `v1,whsec_BASE64KEY`
- Supabase free tier email rate limit — 3/hour per project, increase in Dashboard

**Файлы:**
- `apps/web/src/lib/carrotquest/client.ts` — CQ API client (form-encoded, by_user_id)
- `apps/web/src/lib/carrotquest/emails.ts` — email helpers with setUserProps
- `apps/web/src/lib/carrotquest/types.ts` — event name types
- `apps/web/src/app/api/webhooks/supabase-email/route.ts` — Standard Webhooks verification
- `apps/web/src/components/shared/CarrotQuestIdentify.tsx` — frontend HMAC auth
- `apps/web/src/app/layout.tsx` — CQ widget script
- `apps/web/src/app/(main)/layout.tsx` — HMAC generation + CarrotQuestIdentify

### Previous Session (2026-03-18, session 2)

**Phase 27 — SEO + Custom Error Pages (complete + deployed):**
- sitemap, robots, OG-tags, 404/error pages, Yandex Webmaster verification

**Phase 31 — Admin Roles (complete + deployed):**
- `enum Role { USER ADMIN SUPERADMIN }` заменяет `isAdmin: Boolean`
- `adminProcedure` (ADMIN+SUPERADMIN) + `superadminProcedure` (только SUPERADMIN) в tRPC
- Paywall bypass для ADMIN/SUPERADMIN в `access.ts`
- `changeUserRole` — только SUPERADMIN, с self-demotion guard
- Settings (feature flags) — только SUPERADMIN
- UserTable: dropdown ролей для SUPERADMIN, read-only badges для ADMIN
- "Админка" в футере sidebar (не в основном меню)
- SUPERADMIN: e.n.vasilyev@yandex.ru, evasilev@mpstats.io
- Миграция: `scripts/sql/migrate_isadmin_to_role.sql` выполнена на Supabase

**Roadmap — 8 pre-release фаз добавлены (24-31):**
- 24: Support Contact, 25: Legal + Cookie Consent, 26: Яндекс Метрика
- 27: SEO + Custom Error Pages (✅), 28: Боевой CP, 29: Sentry
- 30: Content Discovery (smart search + фильтры), 31: Admin Roles (✅)

### Previous Session (2026-03-16)

**Security Hardening — RLS + function search_path:**
- RLS включён на всех 18 таблицах (стратегия: нулевые политики, PostgREST заблокирован)
- `match_chunks` и `handle_new_user` — добавлен `SET search_path = ''` (Supabase lint 0011)
- Скрипты: `scripts/sql/enable_rls_all_tables.sql`, `scripts/sql/fix_function_search_paths.sql`
- Проверено: anon key → `[]`, service_role → данные, все продуктовые флоу работают

**Perf: lesson page instant load (splitLink):**
- Страница урока показывала скелетон 5-10 сек — ждала LLM summary из-за tRPC `httpBatchLink`
- **Причина:** все запросы батчились в один HTTP-запрос, быстрый `getLesson` (~100ms) ждал медленный `getLessonSummary` (3-10s)
- **Фикс:** `splitLink` в `apps/web/src/lib/trpc/provider.tsx` — AI-процедуры (`ai.getLessonSummary`, `ai.chat`, `ai.searchChunks`) идут в отдельном батче
- **Результат:** плеер и контент рендерятся за 1-2 сек, summary подгружается фоном

**UX: breadcrumb навигация к курсу:**
- Breadcrumb на странице урока: название курса теперь кликабельная ссылка → `/learn#courseId`
- Страница `/learn` автоматически раскрывает и скроллит к курсу из URL hash
- Файлы: `apps/web/src/app/(main)/learn/[id]/page.tsx`, `apps/web/src/app/(main)/learn/page.tsx`

**UX: диагностика — ручное переключение + сброс выделения:**
- Убран `setTimeout(2000)` авто-переход — заменён на кнопку "Следующий вопрос" / "Посмотреть результаты"
- Добавлен `key={question.id}` на `<Question>` — React пересоздаёт компонент при смене вопроса, сбрасывая `selectedIndex`
- Файл: `apps/web/src/app/(main)/diagnostic/session/page.tsx`

**Pricing: экспресс-курсы и воркшопы — только в полном доступе:**
- Из dropdown "Подписка на курс" убраны `04_workshops` и `06_express` (фильтр по id)
- В карточку "Полный доступ" добавлено преимущество "Экспресс-курсы и практические воркшопы"
- Исправлено количество уроков: "Все курсы (400+ видеоуроков)" (реально 405 в базе)
- Файл: `apps/web/src/app/pricing/page.tsx`

### Previous Session (2026-03-14)

**Mobile Responsive Audit & Fixes (6 commits deployed):**
- Viewport meta tag отсутствовал — добавлен `export const viewport: Viewport` в layout.tsx
- Landing nav: LogoMark на мобилке (полный лого 322px не влезал в 375px экран)
- Landing hero: текст `text-3xl`, кнопки `flex-col`, padding уменьшен
- Все секции: `px-4 sm:px-6` для мобильных отступов
- Lesson page: breadcrumb truncate, навигация — "Завершить" full-width сверху + компактный prev/next
- Profile page: overflow-hidden на subscription/payment cards, truncate на длинных значениях
- Pricing page: LogoMark на мобилке (было 241px + кнопка "Назад" слиплись)
- Global fix: `html,body{overflow-x:hidden}` в globals.css
- 2 pre-existing бага исправлены: diagnostic.ts syntax error, plan.title→plan.name

**Также исправлено (pre-existing):**
- `diagnostic.ts:18` — лишняя `}` ломала билд
- `subscription-service.ts` — `plan.title` (не существует) → `plan.name`

**Следующий шаг:**
- [ ] Phase 22: Transactional email notifications (needs planning)
- [ ] Проверить профиль на iPhone после очистки кэша Safari

### Previous Session (2026-03-12)

**Pricing page bugfixes for unauthenticated users (2 commits deployed):**
- /pricing в инкогнито — dropdown с курсами + редирект на /login при оплате
- Таблица истории платежей — layout OK
- Весь payment flow verified (widget → webhook → subscription → cancel → re-subscribe)

### Previous Session (2026-03-11)

**Roadmap planning + Phase 19 (Billing UI) complete + Phase 21 (Domain Migration) complete.**
- Тест фронтенд-скиллов — `/design-wdg` и `/design-uiux` лендинги

### Previous Session (2026-03-05)

**Kinescope Player UX Fix + Infinite Re-render Bug Fix:**

1. **Убрана чёрная заглушка PlayPlaceholder** — `KinescopePlayer.tsx`
   - Компонент `PlayPlaceholder` ("Нажмите для воспроизведения") удалён
   - Плеер Kinescope загружается сразу при открытии страницы урока (без autoplay)
   - Пользователь видит превью Kinescope напрямую, без промежуточного шага

2. **Исправлен бесконечный цикл ре-рендеров (React error #185)** — `learn/[id]/page.tsx`
   - **Симптом:** через ~30 сек после открытия урока появлялась ошибка "Ошибка загрузки"
   - **Причина:** `saveWatchProgress` от `useMutation()` — нестабильная ссылка, пересоздаётся каждый рендер. Была в deps `useEffect` и `useCallback` → cleanup вызывал `mutate()` → `invalidate getLesson` → ре-рендер → cleanup → бесконечный цикл
   - **Фикс:** `saveWatchProgressRef` (ref-паттерн) вместо прямого использования mutation в deps

**Файлы:**
- `apps/web/src/components/video/KinescopePlayer.tsx` — удалён PlayPlaceholder, autoPlay=false
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — saveWatchProgressRef для стабильности

### Previous Session (2026-02-25)

**Phase 2 (AI Question Generation) — формально закрыта:**
- Была выполнена ранее (2026-02-17), но не отмечена `[x]` в ROADMAP.md
- Верификация: 4/4 must-haves, AIGEN-01..05 покрыты, human approved
- Коммит: `e99a41e`

**Phase 3 (Video Integration) — формально закрыта:**
- Была выполнена ранее (2026-02-18), верификация: 10/10 must-haves, passed
- Коммит: `4feaa9e`

**Kinescope Player — CRITICAL FIX (2 проблемы):**

1. **Сжатый плеер (aspect ratio):** контейнер `<div>` не имел `aspect-video` → iframe коллапсировал
   - Фикс: добавлен `aspect-video` на обёртку в `KinescopePlayer.tsx`
   - Коммит: `92a842f`

2. **Белый экран вместо видео:** `@kinescope/react-kinescope-player` v0.5.4 сломался — Kinescope обновил `iframe.player.js`, метод `IframePlayer.create` больше не существует (есть только `createMutex` и `creatingIds`). React-компонент рендерил пустой `<span>`.
   - Фикс: полностью заменён на прямой `<iframe src="kinescope.io/embed/{videoId}">` с postMessage API для seekTo/play
   - Коммит: `ec6d2c2`
   - **Файл:** `apps/web/src/components/video/KinescopePlayer.tsx`

**CD pipeline удалён:**
- `.github/workflows/cd.yml` удалён — GitHub secrets не настроены
- Деплой через vps-ops-manager (ручной SSH + docker compose)
- Коммит: `c37ccb2`

**Деплой:** Все фиксы задеплоены на прод, плеер проверен — видео отображается корректно

**Production URL:** https://platform.mpstats.academy

### Previous Session (2026-02-24)

**Auth Registration Bug Fix + Phase 6 Complete:**

**Auth bug (critical):**
- Сотрудник (tokarev.explorer@gmail.com) не мог зарегистрироваться — "Database error saving new user"
- **Причина:** Trigger-функция `handle_new_user` в Supabase делала INSERT в `UserProfile` без колонок `createdAt` и `updatedAt`. Prisma `@updatedAt` не создаёт DEFAULT в PostgreSQL → NOT NULL violation
- **Фикс:** `CREATE OR REPLACE FUNCTION public.handle_new_user()` — добавлены `"createdAt"` и `"updatedAt"` с `NOW()` в INSERT

**Phase 6: Production Deploy — COMPLETE (GSD workflow):**
- ✅ Plan 06-01: Prisma OpenSSL fix, health endpoint `/api/health`, CI master branch
- ✅ Plan 06-02: CD pipeline, full E2E verification (12/12 pages)

**Пропущенные фазы (реализованы позже):**
- Phase 4: Access Control & Personalization — ✅ реализована (soft gating через paywall, Phase 20)
- Phase 5: Security Hardening — ✅ реализована 2026-02-25 (rate limiting, protectedProcedure, SafeMarkdown, error boundaries)

### Previous Session (2026-02-24 earlier)

**Production Deploy infrastructure:**
- VPS 89.208.106.208: Docker 28.2.2, Nginx 1.24.0, UFW, fail2ban, SSL (DuckDNS + Let's Encrypt)
- Dockerfile: 5-stage multi-stage build с turbo prune
- 8 deploy-time fixes (Prisma OpenSSL, OAuth redirect, Nginx buffers, etc.)
- Supabase URL Config: Site URL + Redirect URLs обновлены

### Previous Session (2026-02-21)
**Kinescope Upload — COMPLETE:**
- ✅ Все 405 видео загружены на Kinescope (209.4 GB, 6 курсов)
- ✅ Все Lesson.videoId записаны в Supabase DB
- Timeline: 2026-02-18..20 (4 сессии)

**Dev Bypass (для отладки без auth):**
Если Supabase снова недоступна, можно временно добавить bypass в 3 файла:
1. `apps/web/src/middleware.ts` — добавить `DEV_BYPASS_AUTH = true` в начало middleware
2. `apps/web/src/app/api/trpc/[trpc]/route.ts` — mock user для tRPC context
3. `apps/web/src/app/(main)/layout.tsx` — mock user для layout

## Development Workflow

### Environment Strategy
- **Development:** Локально (Windows PC)
- **Production:** VPS 89.208.106.208 (Ubuntu 24.04, Docker, Nginx + Let's Encrypt)
- **Database:** Supabase (cloud) — доступна из любого окружения

### Progress Tracking Rules
1. После КАЖДОЙ задачи (BE-0.1, FE-1.2 и т.д.) обновлять секцию Sprint Progress
2. Формат: `- [x] ID: Описание — ключевые файлы`
3. Незавершённые задачи: `- [ ] ID: Описание`

### Commands
```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to DB
pnpm db:studio        # Open Prisma Studio
```

## Project Structure

```
MAAL/
├── apps/web/                 # Next.js 14 App Router
│   ├── src/app/              # Pages (App Router)
│   │   ├── (auth)/           # Auth pages (login, register, verify, reset)
│   │   ├── (main)/           # Protected pages (dashboard, diagnostic, learn, profile)
│   │   └── api/              # API routes (tRPC, auth callback)
│   ├── src/components/       # React components
│   │   ├── ui/               # shadcn/ui (button, card, input)
│   │   ├── charts/           # RadarChart (Recharts)
│   │   ├── diagnostic/       # Question, ProgressBar
│   │   ├── learning/         # LessonCard
│   │   └── shared/           # Sidebar, UserNav, MobileNav
│   ├── src/lib/              # Utils, Supabase, tRPC, Auth
│   └── tests/                # Vitest + Playwright
├── packages/
│   ├── api/                  # tRPC routers + mock data
│   │   └── src/routers/      # profile, diagnostic, learning
│   ├── db/                   # Prisma schema
│   └── shared/               # Shared types
├── .github/workflows/        # CI pipeline
├── docker-compose.yml        # Local PostgreSQL + pgvector
└── .env                      # Environment (Supabase configured)
```

## Sprint Progress

### Sprint 0: Project Setup ✅ COMPLETE (2025-12-21)
- [x] BE-0.1: Turborepo monorepo — `turbo.json`, `pnpm-workspace.yaml`, `package.json`
- [x] BE-0.2: Prisma + Supabase — `packages/db/prisma/schema.prisma`, `packages/db/src/client.ts`
- [x] BE-0.3: tRPC routers — `packages/api/src/routers/{profile,diagnostic,learning}.ts`
- [x] BE-0.4: Docker Compose — `docker-compose.yml`
- [x] BE-0.5: ENV template — `.env.example`
- [x] FE-0.1: Next.js 14 App Router — `apps/web/src/app/`
- [x] FE-0.2: Tailwind CSS — `tailwind.config.ts`, `globals.css`
- [x] FE-0.3: shadcn/ui — `apps/web/src/components/ui/{button,card,input}.tsx`
- [x] FE-0.4: tRPC client — `apps/web/src/lib/trpc/{client,provider}.tsx`
- [x] QA-0.1: Vitest — `apps/web/vitest.config.ts`
- [x] QA-0.2: Playwright — `apps/web/playwright.config.ts`
- [x] QA-0.3: CI Pipeline — `.github/workflows/ci.yml`

### Sprint 1: Foundation ✅ COMPLETE (2025-12-22)
- [x] BE-1.1: Supabase project setup — `saecuecevicwjkpmaoot.supabase.co`
- [x] BE-1.2: Supabase client setup — `lib/supabase/{client,server}.ts`
- [x] BE-1.3: UserProfile model — `packages/db/prisma/schema.prisma`
- [x] BE-1.4: Auth actions — `lib/auth/actions.ts` (signUp, signIn, signOut, resetPassword)
- [x] BE-1.5: Google OAuth setup — работает, протестировано
- [x] BE-1.6: Auth callback route — `app/auth/callback/route.ts`
- [x] BE-1.7: Protected middleware — `middleware.ts` (полный, с редиректами)
- [x] BE-1.8: tRPC context with auth — `packages/api/src/trpc.ts` (protectedProcedure)
- [x] BE-1.9: Profile router — `packages/api/src/routers/profile.ts`
- [x] FE-1.1: Landing page — `app/page.tsx` (Hero, Features, CTA, Footer)
- [x] FE-1.2: Auth layout — `app/(auth)/layout.tsx`
- [x] FE-1.3: Login page — `app/(auth)/login/page.tsx`
- [x] FE-1.4: Register page — `app/(auth)/register/page.tsx` (+ Google OAuth)
- [x] FE-1.5: Verify email page — `app/(auth)/verify/page.tsx`
- [x] FE-1.6: Password reset pages — `app/(auth)/forgot-password/`, `reset-password/`
- [x] FE-1.7: Main layout — `app/(main)/layout.tsx` + Sidebar + UserNav + MobileNav
- [x] FE-1.8: Dashboard — `app/(main)/dashboard/page.tsx` (полный, не placeholder!)
- [x] QA-1.1: Auth integration tests — `tests/auth/oauth-provider.test.ts`, `yandex-oauth.test.ts`, `no-google.test.ts` (440 lines, 3 files)
- [x] QA-1.2: Auth E2E tests — `tests/e2e/auth-flow.spec.ts` (4 tests: login, invalid creds, logout, auth redirect)
- [x] QA-1.3: Landing E2E — `tests/e2e/landing.spec.ts` (4 tests: hero, nav links, navigate, sections)
- [x] QA-1.4: Protected routes E2E — `tests/e2e/protected-routes.spec.ts` (7 tests: 5 routes redirect + login/register accessible)

### Sprint 2: UI Shell ✅ COMPLETE (2025-12-22)

#### Backend (Mock Data Layer)
- [x] BE-2.1: Mock data types — `packages/shared/src/index.ts`
- [x] BE-2.2: Mock API layer — `packages/api/src/mocks/{dashboard,questions,courses}.ts`
- [x] BE-2.3: Diagnostic mock router — `routers/diagnostic.ts` (in-memory sessions с userId)
- [x] BE-2.4: Learning mock router — `routers/learning.ts` (курсы, уроки, прогресс)
- [x] BE-2.5: Profile mock router — `routers/profile.ts` (dashboard data, stats)

#### Frontend — Diagnostic UI
- [x] FE-2.1: Diagnostic intro page — `app/(main)/diagnostic/page.tsx`
- [x] FE-2.2: Question component — `components/diagnostic/Question.tsx`
- [x] FE-2.3: Progress bar — `components/diagnostic/ProgressBar.tsx`
- [x] FE-2.4: Diagnostic session page — `app/(main)/diagnostic/session/page.tsx`
- [x] FE-2.5: Results page — `app/(main)/diagnostic/results/page.tsx`
- [x] FE-2.6: Radar chart — `components/charts/RadarChart.tsx` (Recharts)

#### Frontend — Learning UI
- [x] FE-2.7: Learning path page — `app/(main)/learn/page.tsx`
- [x] FE-2.8: Lesson card — `components/learning/LessonCard.tsx`
- [x] FE-2.9: Lesson page layout — `app/(main)/learn/[id]/page.tsx`
- [x] FE-2.10: Kinescope player — iframe embed готов (нужен videoId)
- [x] FE-2.11: AI panels — Summary (mock) + Chat placeholder

#### Frontend — Dashboard & Profile
- [x] FE-2.13: Dashboard page — `app/(main)/dashboard/page.tsx` (полный!)
- [x] FE-2.14: Stats cards — встроены в dashboard
- [x] FE-2.15: Recent activity — встроены в dashboard
- [x] FE-2.16: Profile settings — `app/(main)/profile/page.tsx`
- [x] FE-2.17: Diagnostic history — `app/(main)/profile/history/page.tsx`

#### QA
- [ ] QA-2.1: UI Component tests — pending (shadcn компоненты: Button, Card, Badge variants)
- [x] QA-2.2: Diagnostic flow E2E — `tests/e2e/diagnostic-flow.spec.ts` (4 tests: intro, session start, answer+feedback, full flow with radar chart)
- [x] QA-2.3: Learning flow E2E — `tests/e2e/learning-flow.spec.ts` (4 tests: course list, lesson page, video player, AI summary)
- [x] QA-2.4: Responsive testing — Phase 14 mobile audit (viewport meta, nav, hero, overflow — 6 commits deployed)
- [x] QA-2.5: Accessibility audit — `tests/e2e/accessibility.spec.ts` (8 tests: 4 public + 4 protected pages, axe-core WCAG 2.0 AA)

### Sprint 2.5: UI Redesign ✅ COMPLETE (2025-12-24)
**Parallel sprint** — выполнялся пока ожидаем транскрипты для RAG.

**Design Sources:**
| Источник | URL | Использование |
|----------|-----|---------------|
| Color System | `wheel-next-22559505.figma.site` | Цветовая палитра (Blue/Green/Pink) |
| Landing Redesign | `figma.com/design/ltQb2GRetrS17SDzjSudOX` | Структура landing page |
| Brand Guideline | `figma.com/design/OmBVlWAJYzUKV3yQHywFMo` | Логотип, typography |

#### Фаза 1: Foundation ✅ COMPLETE
- [x] RD-1.1: Tailwind Color Config — `mp-blue`, `mp-green`, `mp-pink`, `mp-gray` scales
- [x] RD-1.2: CSS Variables — MPSTATS theme (light + dark mode)
- [x] RD-1.3: Logo component — `components/shared/Logo.tsx`
- [x] RD-1.4: Typography + Shadows — `fontSize`, `boxShadow` in tailwind.config.ts

#### Фаза 2: Базовые компоненты ✅ COMPLETE (2025-12-24)
- [x] RD-2.1: Button redesign — variants: default/success/featured/outline/secondary/ghost/link
- [x] RD-2.2: Card redesign — variants: default/soft-blue/soft-green/soft-pink/gradient/glass/elevated
- [x] RD-2.3: Badge redesign — NEW component with 15+ variants (skill categories, status badges)
- [x] RD-2.4: Input redesign — variants: default/error/success with auto-detect
- [x] RD-2.5: Logo integration — sizes (sm/md/lg/xl), variants (default/white/dark)

#### Фаза 3: Layout Components ✅ COMPLETE (2025-12-24)
- [x] RD-3.1: Landing page redesign — Logo, mp-colors, Hero с градиентом, Badge, Stats
- [x] RD-3.2: Sidebar redesign — LogoMark + "Academy", fixed position, mp-blue active states
- [x] RD-3.3: Main layout — proper flex structure with md:ml-64
- [x] RD-3.4: UserNav — avatar with fallback, gradient initials
- [x] RD-3.5: MobileNav — mp-blue colors, scale animation
- [x] RD-3.6: Auth layout — Logo integration, mp-gray styles
- [x] RD-3.7: Login page — elevated card, Google colored icon

#### Фаза 4: App Pages Redesign ✅ COMPLETE (2025-12-24)
- [x] RD-4.1: Dashboard redesign — mp-colors, shadow-mp-card, Card variants
- [x] RD-4.2: Diagnostic intro — Badge, mp-colors, gradient CTA card
- [x] RD-4.3: Diagnostic session — mp-gray loading states, mp-blue accents
- [x] RD-4.4: Diagnostic results — priority badges, mp-color scheme
- [x] RD-4.5: Learn page — filters with mp-blue, course progress bars
- [x] RD-4.6: Lesson detail — Badge categories, AI sidebar tabs
- [x] RD-4.7: LessonCard — hover effects, mp-color category badges
- [x] RD-4.8: Profile page — quick actions with icons, account card
- [x] RD-4.9: Diagnostic history — score colors, hover cards

#### Фаза 5: Polish & Animations ✅ COMPLETE (2025-12-24)
- [x] RD-5.1: CSS animations — fadeIn, slideUp, slideInLeft, scaleIn, pulseGlow
- [x] RD-5.2: Skeleton component — shimmer effect, SkeletonCard, SkeletonText
- [x] RD-5.3: Page transitions — animate-fade-in on all main pages
- [x] RD-5.4: Staggered animations — delayed slide-up for sections
- [x] RD-5.5: Global polish — smooth scroll, custom scrollbar, selection color
- [x] RD-5.6: Focus states — mp-blue-500 ring with offset
- [x] RD-5.7: Reduced motion support — prefers-reduced-motion media query
- [x] RD-5.8: Dark mode CSS variables — готовы (переключатель не добавлен)

### Sprint 3: RAG Integration ✅ COMPLETE (2025-01-08)
**RAG данные готовы:** 5,291 chunks с embeddings в Supabase (`content_chunk` таблица)

#### Фаза 1: Prisma Schema Sync ✅
- [x] AI-3.1.1: ContentChunk model — `@@map("content_chunk")`, snake_case колонки
- [x] AI-3.1.2: Course/Lesson models — custom IDs без @default(cuid())
- [ ] AI-3.1.3: db:push + seed — ожидает обновления credentials

#### Фаза 2: AI Package ✅ COMPLETE
- [x] AI-3.2.1: `packages/ai/` structure — package.json, tsconfig.json
- [x] AI-3.2.2: OpenRouter client — `src/openrouter.ts` (qwen3.5-flash primary, gpt-4.1-nano fallback)
- [x] AI-3.2.3: Embedding service — `src/embeddings.ts` (text-embedding-3-small, 1536 dims)
- [x] AI-3.2.4: Vector retrieval — `src/retrieval.ts` (Supabase RPC `match_chunks`)
- [x] AI-3.2.5: LLM generation — `src/generation.ts` (summary + chat with citations)
- [x] AI-3.2.6: Supabase RPC — `scripts/sql/match_chunks.sql` (HNSW index)

#### Фаза 3: tRPC Router ✅ COMPLETE
- [x] AI-3.3.1: AI router — `packages/api/src/routers/ai.ts`
- [x] AI-3.3.2: Endpoints — getLessonSummary, chat, searchChunks, clearSummaryCache
- [x] AI-3.3.3: Root router — добавлен `ai: aiRouter` в `root.ts`

#### Фаза 4: Frontend Integration ✅ COMPLETE
- [x] AI-3.4.1: Lesson page — `app/(main)/learn/[id]/page.tsx`
- [x] AI-3.4.2: Summary tab — real RAG summary с citations
- [x] AI-3.4.3: Chat tab — working chat с history и sources
- [x] AI-3.4.4: Loading states — spinner, "AI думает..."
- [x] AI-3.4.5: Error handling — error states для summary и chat

#### Фаза 5: Testing ✅ COMPLETE (2026-01-08)
- [x] AI-3.5.1: Summary endpoint — verified working, returns structured markdown with 7 sources
- [x] AI-3.5.2: Chat endpoint — verified working, returns answers with citations and 5 sources
- [x] AI-3.5.3: Vector search — threshold 0.3 for better recall
- [x] AI-3.5.4: Timecodes — formatted as "MM:SS - MM:SS"
- [x] AI-3.5.5: Model — qwen/qwen3.5-flash-02-23 via OpenRouter (switched from gemini-2.5-flash → gpt-4.1-nano → qwen3.5-flash)

#### Ключевые файлы Sprint 3:
```
packages/ai/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── openrouter.ts      # OpenRouter client (OpenAI SDK compatible)
    ├── embeddings.ts      # Query embedding (1536 dims)
    ├── retrieval.ts       # Vector search via Supabase RPC
    └── generation.ts      # Summary + Chat generation

packages/api/src/routers/ai.ts    # tRPC router
scripts/sql/match_chunks.sql      # Supabase RPC function
```

### Sprint 4: Integration ✅ COMPLETE (2026-02-24)
- [x] Kinescope видео интеграция — 405 видео загружены (209.4 GB), все videoId в DB
- [x] VPS Infrastructure — Docker, Nginx, UFW, fail2ban, SSL (Phase 05.1)
- [x] Docker Deploy — multi-stage build, контейнер healthy на VPS
- [x] HTTPS — platform.mpstats.academy с Let's Encrypt
- [x] OAuth fix — Supabase URL Config + auth callback redirect
- [x] Nginx proxy buffer fix — для Supabase auth cookies

### Sprint 5: RAG + Diagnostic Integration ✅ COMPLETE (реализовано через GSD фазы)
**Все задачи выполнены в рамках GSD milestone фаз:**

#### Фаза A: Синхронизация курсов с RAG → **Phase 1 + Phase 9 (v1.0)**
- [x] RA-5.1–5.3: Prisma роутеры переписаны с mock на реальные данные (Phase 1: Data Foundation)
- [x] RA-5.4: Mock данные заменены на Prisma queries (Phase 9: Integration Wire-Up)

#### Фаза B: Мягкое ограничение доступа → **Phase 4 + Phase 20 + Phase 32**
- [x] RA-5.5–5.6: Diagnostic gate + lesson gating (Phase 4: Access Control)
- [x] RA-5.7–5.8: My Track tab + paywall (Phase 20: Paywall + Phase 32: Custom Track)

#### Фаза C: AI генерация вопросов → **Phase 23 (Diagnostic 2.0)**
- [x] RA-5.9–5.12: AI question generation from RAG chunks, source tracing, model switch

#### Фаза D: Полировка → **Phase 4 + Phase 14**
- [x] RA-5.13: isRecommended badge (Phase 4, `04-02`)
- [x] RA-5.14: Mobile responsive audit (Phase 14)

### QA Test Suite ✅ (2026-03-24)

**Unit tests (Vitest):** 24 tests, 3 files — auth integration
**E2E tests (Playwright):** 31 tests, 5 files — full coverage

| File | Tests | Coverage |
|------|-------|----------|
| `tests/auth/*.test.ts` | 24 unit | OAuth provider, Yandex OAuth, Google removal |
| `tests/e2e/landing.spec.ts` | 4 | Hero, nav, navigation, sections |
| `tests/e2e/protected-routes.spec.ts` | 7 | 5 routes redirect + login/register accessible |
| `tests/e2e/auth-flow.spec.ts` | 4 | Login, invalid creds, logout, auth redirect |
| `tests/e2e/diagnostic-flow.spec.ts` | 4 | Intro, session, answer+feedback, full flow (radar chart) |
| `tests/e2e/learning-flow.spec.ts` | 4 | Course list, lesson page, video player, AI summary |
| `tests/e2e/accessibility.spec.ts` | 8 | WCAG 2.0 AA audit on 8 pages (axe-core) |

**Test user:** `tester@mpstats.academy` / `TestUser2024` (id: `cff53dc4`)

**Remaining debt:**
- QA-2.1: UI Component unit tests (P3 — low priority, shadcn components are well-tested upstream)

## Current Status Summary

**Production deployed:** https://platform.mpstats.academy

| Milestone | Status | Phases |
|-----------|--------|--------|
| v1.0 MVP | ✅ Shipped 2026-02-26 | Phases 1-9 |
| v1.1 Admin & Polish | ✅ Shipped 2026-02-28 | Phases 10-15 |
| v1.2 Auth Rework + Billing | ✅ Shipped 2026-03-12 | Phases 16-21 |
| v1.3 Pre-release | 🔄 In Progress | Phases 22-33 (28-29 remaining; 33-03 on CQ team) |

**Kinescope integration notes:**
- `@kinescope/react-kinescope-player` v0.5.4 **НЕ РАБОТАЕТ** — Kinescope сломали свой API
- Используется прямой iframe embed: `https://kinescope.io/embed/{videoId}`
- seekTo через postMessage API к iframe

**Completed v1.3 phases:** 23, 24, 25, 26, 27, 30, 31, 32, 33 (code complete)

**Remaining v1.3 phases:**
1. Phase 28: Боевой CloudPayments
2. Phase 29: Sentry Monitoring
3. Phase 33-03: CQ Dashboard Setup — на стороне CQ команды
4. Phase 34: User Profile Enhancement (аватар, display name)
5. Phase 35: Lesson Comments (комментарии, 1-level threading)
6. Phase 36: Product Tour / Onboarding (3 tooltip-тура)

**Closed:** Phase 22 (superseded by Phase 33)

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Hosting | VPS (self-hosted) | Full control, existing server |
| Database | Supabase (cloud) | Managed, pgvector, free tier |
| Dev approach | UI-First | No content blocker for Sprint 0-2 |
| Progress tracking | Per-task updates | Granular, no lost context |
| Auth | Supabase Auth + Yandex ID OAuth | Server-side flow, Google removed |
| Mock storage | In-memory (globalThis) | Fast dev, no DB dependency for Sprint 0-2 |
| tRPC batching | splitLink (AI vs fast) | AI queries (3-10s) must not block page render |
| RLS strategy | RLS ON + zero policies | All data via Prisma/service_role, PostgREST blocked |
| LLM model | Qwen 3.5 Flash (qwen3.5-flash-02-23) | $0.26/M output, IFBench 76.5, верная арифметика, json_schema strict |

## Known Limitations (Sprint 2)

### In-Memory Data Storage
Диагностики и профили навыков хранятся в памяти сервера (`globalThis`):
- ✅ Данные привязаны к `userId` — каждый пользователь видит только свои сессии
- ✅ Персистентность между hot reloads (Next.js dev mode)
- ⚠️ **Данные теряются при перезапуске сервера**
- ⚠️ Не подходит для production

**Файлы:**
- `packages/api/src/routers/diagnostic.ts` — `mockSessions`, `completedSessions`, `latestSkillProfiles`
- `packages/api/src/routers/profile.ts` — использует `getLatestSkillProfile(userId)`

**Решение в Sprint 3/4:** Миграция на Prisma + Supabase для постоянного хранения.

## Supabase Configuration

| Parameter | Value |
|-----------|-------|
| Project URL | `https://saecuecevicwjkpmaoot.supabase.co` |
| Database | PostgreSQL with pgvector |
| Auth Providers | Email/Password, Yandex ID OAuth |
| RLS | ✅ Enabled on all 18 tables (zero policies) |
| Status | ✅ Configured & Working |

### Row Level Security (RLS)
RLS включён на всех 18 public таблицах (2026-03-16). Стратегия: **нулевые политики**.

**Почему безопасно:**
- Все данные идут через Prisma (`DATABASE_URL`, роль `postgres`) — обходит RLS
- AI/RAG идёт через `service_role` key — обходит RLS
- Trigger `handle_new_user` — `SECURITY DEFINER` — обходит RLS
- PostgREST (anon key из браузера) → **0 строк**, полная блокировка

**Если в будущем нужен Supabase Realtime или клиентские запросы** — добавить политики точечно под конкретную задачу.

**Скрипт:** `scripts/sql/enable_rls_all_tables.sql`

### Test User (для локального тестирования)
| Field | Value |
|-------|-------|
| Email | `test@mpstats.academy` |
| Password | `TestUser2024` |
| User ID | `62b06f05-1d65-47b6-8f7c-9f535449a9d9` |
| Created | 2026-01-08 |

### Free Tier Keep-Alive
⚠️ **Supabase Free Tier паузит проект после 7 дней неактивности!**

**Автоматическая защита:**
- GitHub Action `.github/workflows/supabase-keepalive.yml`
- Ping каждые 3 дня (8:00 и 20:00 UTC)
- Retry logic: 3 попытки с паузой 10 сек

**Если база заснула (Error 521):**
1. Зайти на https://supabase.com/dashboard
2. Открыть проект `saecuecevicwjkpmaoot`
3. Нажать "Restore project"
4. Подождать 1-2 минуты

**Ручной запуск keep-alive:**
```bash
gh workflow run supabase-keepalive.yml
```

### Known Issues
- ✅ ~~Google OAuth callback error~~ — ИСПРАВЛЕНО (2026-01-14). Причина: повреждённый SUPABASE_ANON_KEY в `apps/web/.env`
- ✅ ~~Supabase paused (Error 521)~~ — ИСПРАВЛЕНО (2026-01-27). Keep-alive workflow улучшен.

## Design Backups

### v1 (2025-12-23) — Pre-Redesign
**Location:** `_backup_design_v1/`
**Purpose:** Snapshot before Sprint 2.5 UI Redesign

**Backed up files (18):**
```
_backup_design_v1/
├── README.md
├── apps/web/
│   ├── tailwind.config.ts
│   └── src/
│       ├── styles/globals.css
│       ├── utils.ts
│       ├── app/
│       │   ├── layout.tsx          # Root layout
│       │   ├── page.tsx            # Landing page
│       │   ├── (auth)/layout.tsx
│       │   └── (main)/layout.tsx
│       └── components/
│           ├── ui/                 # button, card, input
│           ├── shared/             # sidebar, user-nav, mobile-nav
│           ├── diagnostic/         # Question, ProgressBar
│           ├── learning/           # LessonCard
│           └── charts/             # RadarChart
```

**Restore command:**
```bash
cp -r _backup_design_v1/apps/web/* apps/web/
```

## VPS Deploy (Sprint 4) ✅ COMPLETE

| Параметр | Значение |
|----------|----------|
| VPS IP | 89.208.106.208 |
| User | deploy (SSH key auth only) |
| URL | https://platform.mpstats.academy |
| SSL | Let's Encrypt (expires 2026-06-09, auto-renewal) |
| Reverse Proxy | Nginx 1.24.0 (proxy_buffer_size 128k для Supabase auth) |
| Container | Docker Compose, image `maal-web`, port 127.0.0.1:3000 |
| Repo на VPS | `/home/deploy/maal/` (git clone from GitHub) |
| Env | `/home/deploy/maal/.env.production` + `.env` symlink |

**Редеплой:**
```bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git pull origin master
docker compose down && docker compose build --no-cache && docker compose up -d
```

**Логи:**
```bash
docker compose logs --tail=50 -f
```

**Gotchas:**
- `.env` должен быть симлинком на `.env.production` (Docker Compose читает build args из `.env`)
- `NEXT_PUBLIC_*` переменные вшиваются в бандл при build time, не runtime
- Nginx `proxy_buffer_size 128k` обязателен для Supabase auth cookies
- Alpine `localhost` резолвит в IPv6 — использовать `127.0.0.1` в healthcheck
- Auth callback redirect использует `NEXT_PUBLIC_SITE_URL`, не `request.url`

## Domain Migration Checklist

**Domain migration COMPLETE (2026-03-11) -- migrated from `academyal.duckdns.org` to `platform.mpstats.academy`:**

- [x] **Yandex OAuth** — Redirect URI updated to `https://platform.mpstats.academy/api/auth/yandex/callback` (2026-03-11)
- [x] **Supabase** — Site URL + Redirect URLs updated to platform.mpstats.academy (2026-03-11)
- [x] **`.env.production`** на VPS — `NEXT_PUBLIC_SITE_URL` (updated 2026-03-11)
- [x] **Nginx** — `server_name` в конфиге (updated 2026-03-11)
- [x] **Let's Encrypt** — перевыпустить SSL сертификат (issued 2026-03-11, expires 2026-06-09)
- [x] **DuckDNS** — заменён на platform.mpstats.academy (2026-03-11)
