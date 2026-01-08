# CLAUDE.md — MPSTATS Academy MVP

**Last updated:** 2026-01-08

## Development Workflow

### Environment Strategy
- **Development:** Локально (Windows PC)
- **Production:** VPS 79.137.197.90 (Ubuntu 24.04, Docker, PM2)
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

### Sprint 4: Integration (pending)
Final integration and deploy to VPS.
- [ ] Обновить DATABASE_URL credentials
- [ ] Запустить db:push + seed (Course/Lesson таблицы)
- [ ] Kinescope видео интеграция
- [ ] Deploy на VPS

## Current Status Summary

| Sprint | Status | Completion |
|--------|--------|------------|
| Sprint 0 | ✅ Complete | 100% |
| Sprint 1 | ✅ Complete | 95% (QA pending) |
| Sprint 2 | ✅ Complete | 95% (QA pending) |
| Sprint 2.5 | ✅ Complete | 100% (Все фазы) |
| Sprint 3 | ✅ Complete | 95% (db:push pending) |
| Sprint 4 | 🚀 Ready | Waiting for credentials |

**Next Steps:**
1. Обновить DATABASE_URL credentials в Supabase Dashboard
2. Запустить `pnpm db:push` для синхронизации схемы
3. Kinescope: получить videoId для видеоплеера
4. Deploy на VPS (Sprint 4)
5. E2E тестирование RAG с реальными lessonId

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Hosting | VPS (self-hosted) | Full control, existing server |
| Database | Supabase (cloud) | Managed, pgvector, free tier |
| Dev approach | UI-First | No content blocker for Sprint 0-2 |
| Progress tracking | Per-task updates | Granular, no lost context |
| Auth | Supabase Auth + Google OAuth | Proven, easy integration |
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

## VPS Deploy (Sprint 4)

Target: `79.137.197.90`
- Node.js 20 + PM2
- Nginx reverse proxy
- Let's Encrypt SSL
- Docker optional (can run Next.js directly)
