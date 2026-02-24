# Phase 6: Production Deploy - Research

**Researched:** 2026-02-24
**Domain:** Docker deploy, Prisma OpenSSL, GitHub Actions CD, Next.js health checks
**Confidence:** HIGH

## Summary

Phase 6 focuses on making the existing Docker deploy fully functional end-to-end. The infrastructure (Docker, Nginx, SSL, DuckDNS) is already in place from Phase 05.1. The remaining work falls into four areas: (1) fixing Prisma OpenSSL compatibility so DB routes work in the Alpine container, (2) seeding Course/Lesson data into Supabase so pages display real content, (3) adding a health check API endpoint, and (4) setting up GitHub Actions CD for automated deploys on push to master.

The core blocker for empty pages (Dashboard, Learn) is almost certainly the Prisma libssl warning preventing DB queries from executing in the Alpine runner stage. The fix is adding `openssl` to the runner stage in the Dockerfile. Once DB routes work, seeding Course/Lesson data (which may already exist in Supabase from local seed runs) will make all pages display real content.

**Primary recommendation:** Fix Prisma OpenSSL in Dockerfile runner stage first, verify DB routes work, then seed data, add health check, and set up CD pipeline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Полный E2E flow работает на проде: регистрация -> диагностика -> результаты -> обучение -> RAG chat
- Все страницы показывают реальные данные (не пустые экраны)
- PM2 и ngrok из оригинального плана НЕ нужны (Docker + DuckDNS уже есть)
- GitHub Actions CD pipeline, триггер: push в master
- SSH доступ: проверить существующий deploy key, если нет — создать новый
- Секреты: SSH key + VPS host/user в GitHub Secrets
- Prisma libssl.so.1.1 — исследовать и починить

### Claude's Discretion
- Seeding подход: seed в Docker или с локального PC через Supabase cloud
- Health check: минимальный /api/health endpoint (app + DB status), Docker restart policy
- Мониторинг: разумный минимум для MVP
- CD pipeline: конкретная реализация (ssh action, docker compose rebuild)

### Deferred Ideas (OUT OF SCOPE)
- Phase 4: Access Control & Personalization — мягкое ограничение доступа, персонализированный трек
- Phase 5: Security Hardening — protected endpoints, rate limiting, XSS sanitization
- Telegram алерты при падении контейнера — можно добавить после MVP
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEPLOY-01 | Next.js standalone build (`output: 'standalone'`) | ALREADY DONE: `next.config.js` has `output: 'standalone'`, Dockerfile copies standalone output |
| DEPLOY-02 | PM2 ecosystem config (REPLACED by Docker restart policy) | Docker Compose already has `restart: unless-stopped`; no PM2 needed |
| DEPLOY-03 | Nginx reverse proxy + SSL (Let's Encrypt) | ALREADY DONE in Phase 05.1: Nginx + DuckDNS + Let's Encrypt working |
| DEPLOY-04 | Environment variables on VPS | Partially done: `.env.production` exists on VPS; need to verify all vars present including runtime ones |
| DEPLOY-05 | Prisma binary targets for Linux | Fix: add `openssl` package to Alpine runner stage; see Prisma SSL section |
| DEPLOY-06 | Health check endpoint | Create `/api/health` route with DB connectivity check; see Health Check section |
| DEPLOY-07 | Critical E2E tests: auth, diagnostic, learning flows | Manual verification + optional curl smoke tests post-deploy |
</phase_requirements>

## Standard Stack

### Core (already in place)
| Library/Tool | Version | Purpose | Status |
|-------------|---------|---------|--------|
| Docker | 28.2.2 | Container runtime on VPS | Installed |
| Docker Compose | v2 | Container orchestration | Configured |
| Nginx | 1.24.0 | Reverse proxy + SSL termination | Configured |
| Let's Encrypt | certbot | SSL certificates | Configured, auto-renewal |
| Node.js | 20-alpine | Runtime in Docker | Dockerfile base image |
| Prisma | ^5.22.0 | ORM, DB access | Needs OpenSSL fix |
| Next.js | 14 | App framework (standalone output) | Configured |

### Supporting (to add)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `appleboy/ssh-action@v1` | SSH into VPS from GitHub Actions | CD pipeline deploy step |
| `openssl` Alpine package | Prisma engine compatibility | Dockerfile runner stage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `appleboy/ssh-action` | Direct SSH with `webfactory/ssh-agent` | ssh-action is simpler, single step |
| Building on VPS | Building in CI + pushing image to registry | Registry approach is cleaner but adds complexity; building on VPS is fine for MVP |

## Architecture Patterns

### Pattern 1: Fix Prisma OpenSSL on Alpine
**What:** Add `openssl` package to the runner stage of Dockerfile
**Why:** node:20-alpine uses Alpine 3.20/3.21 which ships OpenSSL 3.x. Prisma 5.x query engine requires libssl detection. Without the package, Prisma silently fails DB queries.
**Confidence:** HIGH (verified via [prisma/prisma#25817](https://github.com/prisma/prisma/issues/25817) and [nodejs/docker-node#2175](https://github.com/nodejs/docker-node/issues/2175))

**Fix:**
```dockerfile
# Stage 5: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# CRITICAL: Prisma needs openssl to detect and use libssl
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# ... rest unchanged
```

**No `binaryTargets` needed** in schema.prisma. Prisma auto-detects `linux-musl-openssl-3.0.x` once openssl is installed.

### Pattern 2: Seeding from Local PC
**What:** Run seed script from local machine, targeting Supabase cloud DB
**Why:** The seed script (`scripts/seed/seed-from-manifest.ts`) reads `manifest.json` from local path `E:/Academy Courses/manifest.json`. This file exists only on the dev PC, not on VPS or in the repo. Running seed locally writes directly to Supabase cloud, which is accessible from both local and production.
**Recommendation:** Seed from local PC via `npx tsx scripts/seed/seed-from-manifest.ts`. No Docker seed step needed.

**Verification:** After seeding, check Course/Lesson counts via Prisma Studio or direct SQL:
```sql
SELECT COUNT(*) FROM "Course";  -- expect 6
SELECT COUNT(*) FROM "Lesson";  -- expect 405
```

**Note:** ContentChunk table already has 5,291 rows with embeddings from previous ingestion. Lesson.videoId values were already set during Kinescope upload (405 videos).

### Pattern 3: Health Check Endpoint
**What:** Minimal `/api/health` route that checks app liveness + DB connectivity
**Example:**
```typescript
// apps/web/src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@mpstats/db';

export async function GET() {
  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch (error) {
    health.status = 'degraded';
    health.database = 'disconnected';
    return NextResponse.json(health, { status: 503 });
  }

  return NextResponse.json(health);
}
```

**Docker healthcheck update:**
```yaml
healthcheck:
  test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Pattern 4: GitHub Actions CD Pipeline
**What:** Auto-deploy on push to master via SSH
**Example workflow:**
```yaml
# .github/workflows/cd.yml
name: Deploy

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /home/deploy/maal
            git pull origin master
            docker compose down
            docker compose build --no-cache
            docker compose up -d
            # Wait for container to be healthy
            sleep 45
            wget -q --spider http://127.0.0.1:3000/api/health || echo "HEALTH CHECK FAILED"
```

**Required GitHub Secrets:**
| Secret | Value |
|--------|-------|
| `VPS_HOST` | `89.208.106.208` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Private SSH key content |

### Anti-Patterns to Avoid
- **Building Docker image in CI and pushing to registry:** Overkill for single-VPS MVP. Building on VPS is fine.
- **Running seed in Dockerfile:** manifest.json is not in repo; seed is a one-time operation from local PC.
- **Adding PM2 inside Docker:** Docker already handles restart policy and health checks. PM2 adds unnecessary layer.
- **Using `docker compose up --build` without `down` first:** Can leave orphan containers and cause port conflicts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH deploy from CI | Custom SSH scripts | `appleboy/ssh-action@v1` | Handles key management, timeouts, error reporting |
| SSL certificates | Manual cert management | Let's Encrypt + certbot | Already configured, auto-renewal |
| Process management | PM2 or systemd | Docker restart policy | Container already has `restart: unless-stopped` |
| Health monitoring | Custom monitoring | Docker healthcheck + `/api/health` | Built-in restart on failure |

## Common Pitfalls

### Pitfall 1: Prisma Silently Fails Without OpenSSL
**What goes wrong:** All tRPC routes that use Prisma return errors or empty data. Pages appear blank.
**Why it happens:** Alpine Linux lacks `openssl` by default. Prisma engine can't load libssl, fails at runtime.
**How to avoid:** Add `RUN apk add --no-cache openssl` to the runner stage of Dockerfile.
**Warning signs:** Pages load but show no data; tRPC errors mentioning "Unable to require" or "engines not compatible".

### Pitfall 2: NEXT_PUBLIC_ Variables Not Available at Runtime
**What goes wrong:** Client-side code can't reach Supabase because env vars are empty.
**Why it happens:** `NEXT_PUBLIC_*` variables are inlined at build time, not read at runtime. If build args are missing during `docker compose build`, the bundled values will be empty.
**How to avoid:** Ensure `.env` on VPS has all `NEXT_PUBLIC_*` values AND that Docker Compose passes them as build args. Currently this is handled via `.env` symlink to `.env.production`.
**Warning signs:** OAuth redirects to `undefined`, Supabase client errors in browser console.

### Pitfall 3: Seed Script Requires Local Manifest File
**What goes wrong:** Running seed on VPS fails because `E:/Academy Courses/manifest.json` doesn't exist there.
**Why it happens:** The seed script has a hardcoded Windows path.
**How to avoid:** Run seed from local dev machine. Supabase is cloud-hosted, accessible from anywhere.
**Warning signs:** "Manifest file not found" error.

### Pitfall 4: Docker Build Cache Hides Env Changes
**What goes wrong:** After updating `.env.production`, rebuild doesn't pick up new values.
**Why it happens:** Docker caches layers. Build args that changed may still use cached layer.
**How to avoid:** Always use `docker compose build --no-cache` after env changes.
**Warning signs:** Old values persist after `.env` update.

### Pitfall 5: GitHub Actions CI Targets Wrong Branch
**What goes wrong:** CI workflow triggers on `main` but repo uses `master` as primary branch.
**Why it happens:** The existing `ci.yml` has `branches: [main, develop]`.
**How to avoid:** Update CI workflow to use `master` or create CD workflow targeting `master`.
**Warning signs:** Pushes to master don't trigger any workflows.

## Code Examples

### Dockerfile Runner Stage Fix (Prisma OpenSSL)
```dockerfile
# Stage 5: Production runner (minimal image)
FROM node:20-alpine AS runner
WORKDIR /app

# Prisma needs openssl for libssl detection
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
```

### Health Check API Route
```typescript
// apps/web/src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const health: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
  } catch (error) {
    health.status = 'degraded';
    health.database = 'disconnected';
    health.error = error instanceof Error ? error.message : 'Unknown DB error';
    return NextResponse.json(health, { status: 503 });
  } finally {
    await prisma.$disconnect();
  }

  return NextResponse.json(health);
}
```

### CD Workflow
```yaml
# .github/workflows/cd.yml
name: Deploy to Production

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script_stop: true
          script: |
            cd /home/deploy/maal
            git pull origin master
            docker compose down
            docker compose build --no-cache
            docker compose up -d
            echo "Waiting for container health..."
            sleep 45
            wget -q -O- http://127.0.0.1:3000/api/health || echo "WARNING: Health check failed"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PM2 process manager | Docker restart policy | Phase 05.1 decision | Simpler, no extra dependency |
| ngrok for tunnel | DuckDNS + Let's Encrypt | Phase 05.1 decision | Stable domain, real SSL |
| Manual deploy via SSH | GitHub Actions CD | This phase | Automated on push |
| `openssl1.1-compat` package | `openssl` (3.x) + Prisma 5.x | Prisma 5.x supports OpenSSL 3 | Simpler fix, no compat layer |

## Open Questions

1. **Is Course/Lesson data already seeded in Supabase?**
   - What we know: Seed script exists, manifest was used previously for Kinescope upload. ContentChunk has 5,291 rows.
   - What's unclear: Whether `seed-from-manifest.ts` was already run successfully. videoId values exist on Lesson rows, suggesting seed was run.
   - Recommendation: Check with `SELECT COUNT(*) FROM "Course"` before re-seeding. If 6 courses and 405 lessons exist, skip seeding.

2. **Does the VPS already have an SSH deploy key in GitHub?**
   - What we know: VPS user `deploy` has SSH key auth. A `vps-ops-manager` agent may have set up a deploy key previously.
   - What's unclear: Whether GitHub Secrets are configured.
   - Recommendation: Check `gh secret list` and VPS `~/.ssh/authorized_keys` before creating new keys.

3. **Existing CI workflow targets `main` branch, not `master`**
   - What we know: `.github/workflows/ci.yml` triggers on `[main, develop]`. Repo primary branch is `master`.
   - What's unclear: Whether CI ever ran successfully.
   - Recommendation: Update CI to include `master` or create separate CD workflow targeting `master`.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `Dockerfile`, `docker-compose.yml`, `next.config.js`, `schema.prisma`, `seed-from-manifest.ts`, `learning.ts`, `profile.ts`, `diagnostic.ts`
- [prisma/prisma#25817](https://github.com/prisma/prisma/issues/25817) - Alpine 3.21 OpenSSL detection fix
- [nodejs/docker-node#2175](https://github.com/nodejs/docker-node/issues/2175) - Prisma OpenSSL path change in Alpine

### Secondary (MEDIUM confidence)
- [appleboy/ssh-action](https://github.com/appleboy/ssh-action) - GitHub Actions SSH deploy
- [Hyperping: Next.js health check](https://hyperping.com/blog/nextjs-health-check-endpoint) - Health check patterns

### Tertiary (LOW confidence)
- None. All findings verified via primary or secondary sources.

## Metadata

**Confidence breakdown:**
- Prisma OpenSSL fix: HIGH - verified via official GitHub issues and Prisma docs
- Seeding approach: HIGH - seed script inspected, Supabase is cloud-hosted
- Health check: HIGH - standard Next.js API route pattern
- CD pipeline: HIGH - appleboy/ssh-action is widely used, well-documented
- E2E verification: MEDIUM - manual verification approach, no automated production E2E

**Research date:** 2026-02-24
**Valid until:** 2026-03-24 (stable domain, infrastructure unlikely to change)
