# External Integrations

**Analysis Date:** 2026-02-16

## APIs & External Services

**AI/LLM:**
- OpenRouter - Multi-model LLM gateway
  - SDK/Client: `openai` package (OpenAI SDK with custom baseURL)
  - Base URL: `https://openrouter.ai/api/v1`
  - Auth: `OPENROUTER_API_KEY` (env var)
  - Models: `google/gemini-2.5-flash` (primary), `openai/gpt-4o-mini` (fallback)
  - Embeddings: `openai/text-embedding-3-small` (1536 dimensions)
  - Configuration: `packages/ai/src/openrouter.ts`

**Video Platform:**
- Kinescope - Video hosting and player
  - Integration: iframe embed via `videoUrl` field
  - Auth: `KINESCOPE_API_KEY`, `KINESCOPE_PROJECT_ID` (env vars, optional)
  - Usage: Lesson video player (`apps/web/src/app/(main)/learn/[id]/page.tsx`)
  - Image domain: `kinescope.io` (allowed in Next.js image config)

**Analytics (Optional):**
- PostHog - Product analytics
  - Auth: `NEXT_PUBLIC_POSTHOG_KEY` (env var)
  - Host: `https://eu.posthog.com`
  - Status: Configured but not required

**Monitoring (Optional):**
- Sentry - Error tracking
  - Auth: `SENTRY_DSN` (env var)
  - Status: Configured but not required

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Project URL: `NEXT_PUBLIC_SUPABASE_URL` (env var)
  - Connection: Pooled (`DATABASE_URL` with pgbouncer on port 6543)
  - Direct: `DIRECT_URL` (port 5432 for migrations)
  - Client: Prisma ORM (`@prisma/client`)
  - Extensions: pgvector (vector embeddings for RAG)
  - Auth: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public), `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - RPC: Custom function `match_chunks` for vector similarity search (`scripts/sql/match_chunks.sql`)

**Local Development Alternative:**
- Docker Compose PostgreSQL
  - Image: `pgvector/pgvector:pg16`
  - Port: 5432
  - Credentials: `mpstats:mpstats@localhost:5432/academy`
  - Status: Optional, Supabase cloud is primary

**File Storage:**
- Supabase Storage (via Supabase SDK)
  - Avatar images: `*.supabase.co` domain allowed in Next.js image config

**Caching:**
- React Query - Client-side cache (via @tanstack/react-query)
- SummaryCache model - Database-backed LLM response cache (Prisma model)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: `@supabase/ssr` for server-side rendering
  - Providers: Email/Password, Google OAuth
  - Client setup: `apps/web/src/lib/supabase/{client,server}.ts`
  - Middleware: Protected routes via `apps/web/src/middleware.ts`
  - Context: User injected into tRPC context (`packages/api/src/trpc.ts`)
  - Callback: `apps/web/src/app/auth/callback/route.ts`

**Session Management:**
- Cookie-based sessions via Supabase SSR
- Auto-refresh handled by Supabase SDK
- Protected procedures in tRPC via `protectedProcedure` helper

## Monitoring & Observability

**Error Tracking:**
- Sentry (optional, not enforced)

**Logs:**
- Console-based logging (development)
- Production: stdout (captured by PM2 on VPS)

**Uptime:**
- GitHub Actions workflow - Supabase keep-alive
  - File: `.github/workflows/supabase-keepalive.yml`
  - Schedule: Every 3 days (8:00 UTC, 20:00 UTC)
  - Purpose: Prevent Supabase free tier from pausing (7-day inactivity limit)
  - Retry logic: 3 attempts with 10-second delay

## CI/CD & Deployment

**Hosting:**
- VPS: 79.137.197.90 (Ubuntu 24.04 LTS)
  - User: `deploy`
  - Services: PM2, Nginx, Docker
  - Ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (Next.js), 5678 (n8n)

**CI Pipeline:**
- GitHub Actions
  - File: `.github/workflows/ci.yml`
  - Jobs: lint, typecheck, test, e2e, build
  - Trigger: Push to main/develop, pull requests
  - Parallelization: Independent jobs run concurrently
  - E2E: Chromium only in CI, all browsers locally

**Deployment:**
- Manual deployment to VPS (Sprint 4 pending)
- Process manager: PM2 with systemd startup
- Reverse proxy: Nginx (SSL via Let's Encrypt)

## Environment Configuration

**Required env vars:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
DIRECT_URL
OPENROUTER_API_KEY
```

**Optional env vars:**
```
NEXT_PUBLIC_SITE_URL
OPENROUTER_DEFAULT_MODEL
OPENROUTER_FALLBACK_MODEL
KINESCOPE_API_KEY
KINESCOPE_PROJECT_ID
NEXT_PUBLIC_POSTHOG_KEY
SENTRY_DSN
```

**Secrets location:**
- Environment variables in `.env` (local, gitignored)
- GitHub Secrets (CI/CD)
- Server: manual configuration on VPS

## Webhooks & Callbacks

**Incoming:**
- `/api/auth/callback` - Supabase OAuth callback handler
  - File: `apps/web/src/app/auth/callback/route.ts`
  - Method: GET
  - Purpose: Exchange auth code for session

**Outgoing:**
- None currently configured

## Rate Limits

**Application-defined:**
| Endpoint Type | Limit |
|--------------|-------|
| API general | 100 req/min (planned) |
| LLM requests | 50 req/hour (planned) |
| Chat messages | 20 msg/hour per user (planned) |

**External services:**
- OpenRouter: Per model limits (depends on provider)
- Supabase: Free tier limits (no hard rate limits documented)

---

*Integration audit: 2026-02-16*
