# CLAUDE.md — MPSTATS Academy MVP

**Last updated:** 2026-03-12

## Last Session (2026-03-12)

**Milestone v1.2 (Auth Rework + Billing) — SHIPPED:**
- Phase 20 (Paywall + Content Gating) — verified complete (15/15 must-haves)
- Phase 21 (Domain Migration) — verified complete (6/6 requirements)
- ROADMAP.md обновлён: v1.2 помечен как shipped, таблица прогресса исправлена

**Следующий шаг:**
- [ ] Phase 22: Transactional email notifications (needs planning)

### Previous Session (2026-03-12 earlier)

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

**Пропущенные фазы (не реализованы, проект задеплоен без них):**
- Phase 4: Access Control & Personalization — нет soft gating и персонализированного трека
- Phase 5: Security Hardening — endpoints не защищены protectedProcedure, нет rate limiting

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
- [ ] QA-1.1: Auth integration tests — pending
- [ ] QA-1.2: Auth E2E tests — pending
- [x] QA-1.3: Landing E2E — `tests/e2e/landing.spec.ts`
- [ ] QA-1.4: Protected routes test — pending

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
- [ ] QA-2.1: UI Component tests — pending
- [ ] QA-2.2: Diagnostic flow E2E — pending
- [ ] QA-2.3: Learning flow E2E — pending
- [ ] QA-2.4: Responsive testing — pending
- [ ] QA-2.5: Accessibility audit — pending

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
- [x] AI-3.2.2: OpenRouter client — `src/openrouter.ts` (gemini-2.5-flash, gpt-4o-mini fallback)
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
- [x] AI-3.5.5: Model — google/gemini-2.5-flash via OpenRouter

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

### Sprint 5: RAG + Diagnostic Integration 📋 PLANNED (2026-01-14)
**Цель:** Синхронизировать UI с реальными данными RAG, добавить мягкое ограничение доступа, генерировать вопросы диагностики из контента уроков.

#### Фаза A: Синхронизация курсов с RAG
- [ ] RA-5.1: Endpoint `getCourseStructure()` — динамическая загрузка курсов из Supabase `content_chunk`
- [ ] RA-5.2: Маппинг lesson_id → категории навыков (01_analytics→ANALYTICS, 02_ads→MARKETING, etc.)
- [ ] RA-5.3: Обновить UI /learn для отображения реальных 6 курсов и 80+ уроков
- [ ] RA-5.4: Убрать hardcoded данные из `packages/api/src/mocks/courses.ts`

#### Фаза B: Мягкое ограничение доступа
- [ ] RA-5.5: Компонент `LessonLocked.tsx` — баннер "Пройди диагностику чтобы открыть видео"
- [ ] RA-5.6: Проверка `hasCompletedDiagnostic()` в lesson page
- [ ] RA-5.7: Фильтр "Мой трек" в /learn — показывает только recommendedPath уроки
- [ ] RA-5.8: Сохранение recommendedPath в профиль пользователя

#### Фаза C: AI генерация вопросов
- [ ] RA-5.9: Сервис `question-generator.ts` — генерация вопросов из RAG chunks
- [ ] RA-5.10: Интеграция с `diagnostic.startSession()` — вызов AI вместо mock
- [ ] RA-5.11: Fallback на mock вопросы если LLM недоступен
- [ ] RA-5.12: Rate limiting для генерации

#### Фаза D: Полировка
- [ ] RA-5.13: Badge "Рекомендовано для вас" на уроках из recommendedPath
- [ ] RA-5.14: UI animations для LessonLocked
- [ ] RA-5.15: E2E тестирование полного flow

**Детальный план:** `C:\Users\Zebrosha\.claude\plans\flickering-knitting-tarjan.md`

**RAG данные (готовы):**
- 6 курсов: 01_analytics, 02_ads, 03_ai, 04_workshops, 05_ozon, 06_express
- 80+ уроков, 5,291 chunks с embeddings в Supabase

## Current Status Summary

**Production deployed:** https://platform.mpstats.academy

| Milestone | Status | Phases |
|-----------|--------|--------|
| v1.0 MVP | ✅ Shipped 2026-02-26 | Phases 1-9 |
| v1.1 Admin & Polish | ✅ Shipped 2026-02-28 | Phases 10-15 |
| v1.2 Auth Rework + Billing | ✅ Shipped 2026-03-12 | Phases 16-21 |

**Kinescope integration notes:**
- `@kinescope/react-kinescope-player` v0.5.4 **НЕ РАБОТАЕТ** — Kinescope сломали свой API
- Используется прямой iframe embed: `https://kinescope.io/embed/{videoId}`
- seekTo через postMessage API к iframe

**Next Steps:**
1. Phase 22: Transactional email notifications (needs planning)
2. Phase 5: Security Hardening — rate limiting, sanitization (перед публичным запуском)

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Hosting | VPS (self-hosted) | Full control, existing server |
| Database | Supabase (cloud) | Managed, pgvector, free tier |
| Dev approach | UI-First | No content blocker for Sprint 0-2 |
| Progress tracking | Per-task updates | Granular, no lost context |
| Auth | Supabase Auth + Yandex ID OAuth | Server-side flow, Google removed |
| Mock storage | In-memory (globalThis) | Fast dev, no DB dependency for Sprint 0-2 |

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
| Auth Providers | Email/Password, Google OAuth |
| Status | ✅ Configured & Working |

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
