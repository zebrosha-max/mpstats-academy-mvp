# CLAUDE.md — MPSTATS Academy MVP

**Last updated:** 2026-04-07

> Детали по сессиям, спринтам, Supabase, деплою, CQ — в `.claude/memory/`.
> Используй `Read .claude/memory/MEMORY.md` для индекса.

## Current Status

**Production:** https://platform.mpstats.academy

| Milestone | Status |
|-----------|--------|
| v1.0 MVP | Shipped 2026-02-26 (Phases 1-9) |
| v1.1 Admin & Polish | Shipped 2026-02-28 (Phases 10-15) |
| v1.2 Auth Rework + Billing | Shipped 2026-03-12 (Phases 16-21) |
| v1.3 Pre-release | In Progress (Phases 22-36; **remaining: 28, 29**) |
| v1.4 QA Audit Fixes | Shipped 2026-03-29 (Phases 37-42) |
| Phase 43 Diagnostic v2 | Shipped 2026-04-02 |
| v1.5 Growth & Monetization | In Progress (Phase 44 shipped) |

**Remaining work:**
1. Phase 28: Боевой CloudPayments (тестовые → боевые ключи)
2. Phase 29: Sentry Monitoring
3. Phase 33-03: CQ Dashboard Setup (на стороне CQ команды)

## Last Session (2026-04-07)

Phase 44 — Промо-коды: design → plan (4 plans, 3 waves) → execute → deploy.
- DB: PromoCode, PromoActivation + Subscription.promoCodeId
- Backend: tRPC promo router (validate, activate, 4 admin CRUD), 5-step validation, $transaction
- /pricing: auth header, collapsible promo input, redirect /login?promo=КОД
- Profile: badge "Промо" (featured), "Промо-доступ", hidden cancel
- Admin: /admin/promo — create, table, deactivate, activations view
- Deployed + db push applied to Supabase

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM model | GPT-4.1 Nano | QA: 12/15 good questions vs Qwen 5/15 |
| LLM fallback | Qwen 3.5 Flash | Cheaper, decent quality |
| Auth | Supabase Auth + Yandex ID | Google removed |
| tRPC batching | splitLink | AI queries (3-10s) must not block page render |
| RLS | ON + zero policies | All data via Prisma/service_role |
| Kinescope | Direct iframe | react-kinescope-player v0.5.4 broken |
| Video hosting | Kinescope | 405 videos, 209.4 GB |

## Commands

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm typecheck        # TypeScript check
pnpm test             # Unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm db:push          # Push schema
pnpm db:generate      # Generate Prisma client
pnpm db:studio        # Prisma Studio
pnpm lint             # ESLint
```

## Project Structure

```
MAAL/
├── apps/web/                 # Next.js 14 App Router
│   ├── src/app/
│   │   ├── (auth)/           # Login, register, verify, reset
│   │   ├── (main)/           # Dashboard, diagnostic, learn, profile
│   │   ├── (admin)/          # Admin panel
│   │   ├── api/              # tRPC, webhooks, cron
│   │   ├── legal/            # Offer, PDN, cookies
│   │   └── pricing/          # Billing + promo codes
│   ├── src/components/       # UI (shadcn), diagnostic, learning, shared, comments, pricing
│   ├── src/lib/              # trpc, supabase, auth, analytics, carrotquest, tours
│   └── tests/                # 24 unit + 31 E2E tests
├── packages/
│   ├── api/src/routers/      # profile, diagnostic, learning, ai, comments, billing, promo
│   ├── ai/src/               # openrouter, embeddings, retrieval, generation, question-generator
│   ├── db/prisma/            # Schema + migrations
│   └── shared/               # Types
├── scripts/                  # seed, ingest, SQL
├── docs/                     # SDD, test sessions, changelog, plans
└── .github/workflows/        # CI, supabase-keepalive, daily-cron
```

## Supabase

- Project: `saecuecevicwjkpmaoot.supabase.co`
- Auth: Email/Password + Yandex ID OAuth
- RLS: ON, zero policies (all via Prisma/service_role)
- Embeddings: text-embedding-3-small (1536 dims)
- Keep-alive: GitHub Action каждые 3 дня
- Details: `.claude/memory/supabase-details.md`

## Deploy

- VPS: **89.208.106.208** (deploy user, Docker Compose)
- Redeploy: `git pull && docker compose down && docker compose build --no-cache && docker compose up -d`
- Details: `.claude/memory/deploy-details.md`

## Gotchas

- `@kinescope/react-kinescope-player` **НЕ РАБОТАЕТ** — используется прямой iframe
- `NEXT_PUBLIC_*` вшиваются при build, не runtime
- Nginx `proxy_buffer_size 128k` обязателен для Supabase auth cookies
- CQ API: form-encoded, NOT JSON. Props через `setUserProps`, NOT `trackEvent` params
- Details: `.claude/memory/cq-integration.md`

## QA

55 тестов (24 unit + 31 E2E), 0 failures. Test user: `tester@mpstats.academy`.
