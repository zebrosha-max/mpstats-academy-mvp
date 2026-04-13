# CLAUDE.md — MPSTATS Academy MVP

**Last updated:** 2026-04-13

> Детали по сессиям, спринтам, Supabase, деплою, CQ — в `.claude/memory/`.
> Используй `Read .claude/memory/MEMORY.md` для индекса.

## Current Status

**Production:** https://platform.mpstats.academy

| Milestone | Status |
|-----------|--------|
| v1.0 MVP | Shipped 2026-02-26 (Phases 1-9) |
| v1.1 Admin & Polish | Shipped 2026-02-28 (Phases 10-15) |
| v1.2 Auth Rework + Billing | Shipped 2026-03-12 (Phases 16-21) |
| v1.3 Pre-release | In Progress (Phases 22-36; **remaining: 28**) |
| v1.4 QA Audit Fixes | Shipped 2026-03-29 (Phases 37-42) |
| Phase 43 Diagnostic v2 | Shipped 2026-04-02 |
| v1.5 Growth & Monetization | In Progress (Phase 44 shipped) |

**Remaining work:**
1. Phase 28: Боевой CloudPayments (тестовые → боевые ключи)
2. Phase 33-03: CQ Dashboard Setup (на стороне CQ команды)

## Pricing (as of 2026-04-13)

Источник правды — таблица `SubscriptionPlan` в Supabase. UI `/pricing`, виджет CP, profile, emails — всё подтягивается оттуда динамически через `trpc.billing.getPlans`.

| Plan type | Name | Price | Period |
|-----------|------|-------|--------|
| COURSE | Подписка на курс | **1 990 ₽** | 30 дней |
| PLATFORM | Полный доступ | **2 990 ₽** | 30 дней |

**Менять цены:** `UPDATE "SubscriptionPlan" SET price=XXX WHERE type='COURSE'` прямо в Supabase — эффект мгновенный, рестарт не нужен. Плюс обновить `scripts/seed/seed-billing.ts` чтобы fresh seed'ы соответствовали.

**Внимание при переходе на боевой CP (Phase 28):** CP хранит `amount` на своей стороне в момент создания подписки. Существующие ACTIVE подписки с тестового режима при автосписании всё равно спишут **старые** суммы. Перед переключением на боевые ключи отменить все тестовые ACTIVE подписки, чтобы реальные юзеры начали с новых цен.

## Last Session (2026-04-13)

**Sentry triage + два критических фикса + смена цен.**

1. **CP recurrent webhook crash** (MAAL-PLATFORM-2) — был бы блокером для Phase 28:
   - Recurrent webhook использует **отдельную схему** (`Id`/`AccountId`/`Status`/`SuccessfulTransactionsNumber`), а не payment-схему. Старый handler пытался читать `TransactionId`/`InvoiceId`/`DateTime` → `PrismaClientValidationError`
   - Новые pure-модули: `parse-webhook.ts` (parser/normalizer), `decide-recurrent-update.ts` (decision logic). 27 unit-тестов с реальным payload из Sentry
   - `Subscription.cpSubscriptionId String? @unique` добавлено — захватывается из `pay` event (`SubscriptionId` поле), потом recurrent lookup идёт детерминированно по unique-индексу
   - Defensive fallback в `resolveOurSubscriptionId`: `InvoiceId || ExternalId || Data.ourSubscriptionId`
   - Виджет теперь дублирует subscription id в `data` field (defense in depth)
   - 2 smoke-теста на проде прошли идеально

2. **Cron false-positive alert** (MAAL-PLATFORM-1):
   - GitHub Actions schedules дрейфят 60-100+ минут под нагрузкой, а Sentry monitor был с `checkinMargin: 5` → alert каждое утро хотя cron реально отрабатывал
   - Margin расширен до 180 минут в `api/cron/check-subscriptions/route.ts`. Реальные падения всё равно ловятся через `captureCheckIn({ status: 'error' })` в catch

3. **Смена цен**: COURSE 2990→1990, PLATFORM 4990→2990. `UPDATE` прямо в Supabase + обновлён `seed-billing.ts`. Никаких хардкодов в UI/коде — всё динамика.

Оба старых Sentry issue закрыты как resolved. На момент конца сессии — 0 unresolved issues.

### Previous Session (2026-04-07)

**Phase 44 — Промо-коды** (v1.5): design → plan → execute → deploy.
- DB: PromoCode, PromoActivation + Subscription.promoCodeId
- Backend: tRPC promo router (validate, activate, 4 admin CRUD), 5-step validation, $transaction
- /pricing: auth header, collapsible promo input, redirect /login?promo=КОД
- Admin: /admin/promo — create, table, deactivate, activations view

**Phase 29 — Sentry Monitoring**: @sentry/nextjs full stack.
- Org: mpstats-academy, project: maal-platform
- Client/server/edge config, global-error boundary, instrumentation hook
- Custom spans: CP webhooks, email webhook, OpenRouter LLM, Sentry Crons
- Alert rules: new issue + regression → email
- Performance transactions confirmed on prod ✓

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
