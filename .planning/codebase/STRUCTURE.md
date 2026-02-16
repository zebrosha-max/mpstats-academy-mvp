# Codebase Structure

**Analysis Date:** 2026-02-16

## Directory Layout

```
MAAL/
├── .auto-claude/             # Auto-generated planning docs (ideation, roadmap, specs)
├── .claude/                  # Claude Code session config
├── .github/
│   └── workflows/            # CI/CD (supabase-keepalive.yml)
├── .planning/
│   └── codebase/             # Architecture documentation
├── .turbo/                   # Turborepo cache
├── _backup_design_v1/        # Pre-redesign snapshot (Sprint 2.5)
├── apps/
│   └── web/                  # Next.js 14 application
│       ├── public/           # Static assets
│       ├── src/
│       │   ├── app/          # App Router pages
│       │   ├── components/   # React components
│       │   ├── lib/          # Utilities (trpc, supabase, auth)
│       │   └── styles/       # Global CSS
│       └── tests/            # Vitest + Playwright
├── docs/                     # SDD documentation
│   ├── 00_constitution/      # Project principles, DoD
│   ├── 01_prd/               # Product requirements, user stories
│   ├── 02_technical_spec/    # Architecture, DB schema, API
│   └── 03_tasks/             # Sprint task breakdown
├── packages/
│   ├── ai/                   # RAG services (OpenRouter, embeddings, vector search)
│   ├── api/                  # tRPC routers + mock data
│   ├── db/                   # Prisma schema + client
│   └── shared/               # Shared TypeScript types
├── screenshots/              # Debug artifacts
├── scripts/                  # Utility scripts (SQL migrations, seeding)
├── docker-compose.yml        # Local PostgreSQL + pgvector (optional dev)
├── pnpm-workspace.yaml       # Monorepo workspace config
├── turbo.json                # Turborepo pipeline config
└── CLAUDE.md                 # Project-specific AI instructions
```

## Directory Purposes

**apps/web/src/app/**
- Purpose: Next.js 14 App Router pages and layouts
- Contains: Route handlers, page components, API routes, middleware
- Key files:
  - `layout.tsx` — Root layout with tRPC provider
  - `page.tsx` — Landing page
  - `middleware.ts` — Auth protection middleware
  - `(auth)/` — Auth route group (login, register, verify, reset-password)
  - `(main)/` — Protected route group (dashboard, diagnostic, learn, profile)
  - `api/trpc/[trpc]/route.ts` — tRPC API handler
  - `auth/callback/route.ts` — OAuth callback handler

**apps/web/src/components/**
- Purpose: Reusable React components organized by domain
- Contains:
  - `ui/` — shadcn/ui base components (Button, Card, Input, Badge)
  - `charts/` — Data visualization (RadarChart using Recharts)
  - `diagnostic/` — Question, ProgressBar
  - `learning/` — LessonCard
  - `shared/` — Layout components (Sidebar, UserNav, MobileNav, Logo)
- Key files:
  - `ui/button.tsx` — 8 variants (default, success, featured, outline, secondary, ghost, link, destructive)
  - `ui/card.tsx` — 7 variants (default, soft-blue, soft-green, soft-pink, gradient, glass, elevated)
  - `ui/badge.tsx` — 15 variants (skill categories, status badges, priorities)

**apps/web/src/lib/**
- Purpose: Framework integrations and utilities
- Contains:
  - `trpc/` — tRPC client setup (client.ts, provider.tsx)
  - `supabase/` — Supabase clients (client.ts for browser, server.ts for SSR)
  - `auth/` — Server actions (actions.ts: signIn, signUp, signOut, resetPassword, signInWithGoogle)
  - `utils.ts` — cn() utility for Tailwind class merging

**packages/api/src/**
- Purpose: Backend business logic via tRPC
- Contains:
  - `routers/` — Domain routers (profile.ts, diagnostic.ts, learning.ts, ai.ts)
  - `mocks/` — Mock data for Sprint 0-2 UI development
  - `root.ts` — Aggregated app router
  - `trpc.ts` — Context factory, protectedProcedure middleware
- Key files:
  - `routers/ai.ts` — RAG endpoints (getLessonSummary, chat, searchChunks, clearSummaryCache)
  - `routers/diagnostic.ts` — In-memory diagnostic sessions (startSession, submitAnswer, getResults)

**packages/ai/src/**
- Purpose: RAG pipeline services
- Contains:
  - `openrouter.ts` — OpenRouter client (gemini-2.5-flash, gpt-4o-mini fallback)
  - `embeddings.ts` — OpenAI text-embedding-3-small integration (1536 dims)
  - `retrieval.ts` — Supabase pgvector search (searchChunks, getChunksForLesson, formatTimecode)
  - `generation.ts` — LLM generation (generateLessonSummary, generateChatResponse)
  - `index.ts` — Barrel exports
- Key files:
  - `retrieval.ts` — Calls Supabase RPC `match_chunks` for HNSW vector search

**packages/db/**
- Purpose: Database schema and ORM
- Contains:
  - `prisma/schema.prisma` — Full schema (UserProfile, DiagnosticSession, Course, Lesson, ContentChunk with vector embeddings, ChatMessage, SummaryCache)
  - `src/client.ts` — Singleton Prisma client
- Key files:
  - `schema.prisma` — 15 models, pgvector extension enabled

**packages/shared/**
- Purpose: Shared TypeScript types across packages
- Contains: Type definitions, enums, interfaces
- Key files: `src/index.ts` — Exports all shared types

**docs/**
- Purpose: Software Design Documentation (SDD)
- Contains:
  - `00_constitution/PROJECT_CONSTITUTION.md` — Principles, success metrics, DoD
  - `01_prd/PRD.md`, `USER_STORIES.md` — Product requirements (27 user stories)
  - `02_technical_spec/TECHNICAL_SPEC.md` — Architecture diagrams, DB schema, API contracts
  - `03_tasks/TASK_BREAKDOWN.md` — Sprint tasks mapped to subagents

**scripts/**
- Purpose: Database and content management scripts
- Contains:
  - `sql/match_chunks.sql` — Supabase RPC function for vector search
  - `seed/` — Database seeding scripts (planned)
  - `ingest/` — Content ingestion for RAG (planned)

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx` — Root layout
- `apps/web/src/app/page.tsx` — Landing page
- `apps/web/src/middleware.ts` — Request interceptor
- `apps/web/src/app/api/trpc/[trpc]/route.ts` — tRPC handler
- `packages/db/src/client.ts` — Prisma singleton

**Configuration:**
- `turbo.json` — Turborepo tasks (build, dev, lint, db:*)
- `pnpm-workspace.yaml` — Monorepo packages
- `apps/web/next.config.js` — Next.js config
- `apps/web/tailwind.config.ts` — Design system (mp-blue, mp-green, mp-pink, mp-gray scales)
- `packages/db/prisma/schema.prisma` — Database schema
- `.env` — Environment variables (Supabase, OpenRouter, OpenAI keys)

**Core Logic:**
- `packages/api/src/routers/ai.ts` — RAG endpoints
- `packages/ai/src/generation.ts` — LLM generation with citations
- `packages/api/src/routers/diagnostic.ts` — Adaptive testing logic
- `apps/web/src/lib/auth/actions.ts` — Authentication server actions

**Testing:**
- `apps/web/vitest.config.ts` — Vitest config
- `apps/web/playwright.config.ts` — E2E test config
- `apps/web/tests/e2e/landing.spec.ts` — Landing page E2E test

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx` (Next.js convention)
- Components: PascalCase `LessonCard.tsx`, `RadarChart.tsx`
- Utilities: camelCase `utils.ts`, `actions.ts`
- Config: kebab-case `vitest.config.ts`, `tailwind.config.ts`
- Types: PascalCase `schema.prisma` models, `index.ts` for exports

**Directories:**
- Route groups: `(auth)`, `(main)` — parentheses for layout grouping without URL impact
- Domain: lowercase `diagnostic/`, `learning/`, `ai/`
- Packages: kebab-case `@mpstats/ai`, `@mpstats/db`, `@mpstats/api`, `@mpstats/shared`

**Functions:**
- Components: PascalCase `LessonPage()`, `LoginForm()`
- Hooks: camelCase `useQuery()`, `useMutation()`
- Server actions: camelCase `signIn()`, `signOut()`, `signInWithGoogle()`
- Services: camelCase `generateLessonSummary()`, `searchChunks()`, `embedQuery()`

**Variables:**
- Constants: UPPER_SNAKE_CASE `CACHE_TTL_MS`, `TARGET_SCORE`, `MODELS`
- Props: camelCase `lessonId`, `activeTab`, `chatMessages`
- State: camelCase `const [error, setError] = useState()`

**Types:**
- Interfaces: PascalCase `GenerationResult`, `SourceCitation`, `ChunkSearchResult`
- Enums (Prisma): PascalCase `DiagnosticStatus`, `SkillCategory`, `MessageRole`
- Type aliases: PascalCase `AppRouter`, `Context`

## Where to Add New Code

**New Feature (e.g., "Quiz Module"):**
- Primary code:
  - Backend: `packages/api/src/routers/quiz.ts` (tRPC router)
  - Database: Add models to `packages/db/prisma/schema.prisma`
  - Frontend: `apps/web/src/app/(main)/quiz/` (pages)
- Tests:
  - Unit: `apps/web/tests/unit/quiz.test.ts`
  - E2E: `apps/web/tests/e2e/quiz.spec.ts`
- Types: `packages/shared/src/index.ts` (shared types)

**New Component/Module:**
- Implementation:
  - UI component: `apps/web/src/components/{domain}/{ComponentName}.tsx`
  - Base UI (design system): `apps/web/src/components/ui/{component-name}.tsx`
- Usage: Import in pages via `@/components/{domain}/{ComponentName}`

**Utilities:**
- Shared helpers:
  - Frontend: `apps/web/src/lib/{category}/{helper}.ts`
  - Backend: Create new package if substantial (`packages/{name}/`)
  - Cross-package: `packages/shared/src/{category}.ts`

**New AI Feature:**
- Service: `packages/ai/src/{feature}.ts` (e.g., `question-generator.ts`)
- Router: Add endpoint to `packages/api/src/routers/ai.ts`
- Export: Add to `packages/ai/src/index.ts`

**New Auth Provider:**
- Action: Add function to `apps/web/src/lib/auth/actions.ts`
- UI: Add button to `apps/web/src/app/(auth)/login/page.tsx`
- Callback: Handled by existing `apps/web/src/app/auth/callback/route.ts`

**Database Changes:**
- Schema: Edit `packages/db/prisma/schema.prisma`
- Migration: `pnpm db:push` (dev) or `pnpm db:migrate` (prod)
- Types: Regenerate via `pnpm db:generate`

## Special Directories

**_backup_design_v1/**
- Purpose: Snapshot of UI before Sprint 2.5 redesign
- Generated: Manual (2025-12-23)
- Committed: Yes (backup reference)
- Restore: `cp -r _backup_design_v1/apps/web/* apps/web/`

**.turbo/**
- Purpose: Turborepo build cache
- Generated: Automatic during builds
- Committed: No (in .gitignore)

**.next/**
- Purpose: Next.js build output
- Generated: Automatic during `pnpm dev` or `pnpm build`
- Committed: No (in .gitignore)

**node_modules/**
- Purpose: Installed dependencies
- Generated: Via `pnpm install`
- Committed: No (in .gitignore)

**.auto-claude/**
- Purpose: Auto-generated documentation by Claude Code
- Generated: Via `/gsd` commands
- Committed: Yes (project planning artifacts)

**design-demo/, design-v1/, design-v2/, design-v3/ (in apps/web/src/app/)**
- Purpose: Design iteration experiments
- Generated: Manual during Sprint 2.5
- Committed: No (untracked in git status)

**screenshots/**
- Purpose: Debug screenshots (e.g., oauth_bug.jpg)
- Generated: Manual during troubleshooting
- Committed: Optional (helpful for context)

---

*Structure analysis: 2026-02-16*
