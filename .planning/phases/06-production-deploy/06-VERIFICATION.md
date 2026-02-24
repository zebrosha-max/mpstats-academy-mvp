---
phase: 06-production-deploy
verified: 2026-02-24T16:30:00Z
status: gaps_found
score: 5/7 requirements verified
re_verification: false
gaps:
  - truth: "PM2 ecosystem config exists for production"
    status: failed
    reason: "DEPLOY-02 requires PM2 ecosystem config, but no ecosystem.config.js exists anywhere in the repo. Docker Compose with restart: unless-stopped is used instead."
    artifacts:
      - path: "ecosystem.config.js"
        issue: "File does not exist — no PM2 config in repo"
    missing:
      - "Either create ecosystem.config.js at repo root (if PM2 is the intended process manager), or update REQUIREMENTS.md DEPLOY-02 to reflect that Docker Compose restart policy satisfies the intent"
  - truth: "Automated E2E tests cover auth flow, diagnostic flow, and learning flow"
    status: failed
    reason: "DEPLOY-07 requires 'critical E2E tests: auth flow, diagnostic flow, learning flow', but only landing.spec.ts exists. The E2E verification in the plan was a blocking human-verify checkpoint, not automated tests."
    artifacts:
      - path: "apps/web/tests/e2e/landing.spec.ts"
        issue: "Only landing page tests exist — no auth, diagnostic, or learning flow specs"
    missing:
      - "apps/web/tests/e2e/auth.spec.ts — login/register/OAuth flow"
      - "apps/web/tests/e2e/diagnostic.spec.ts — start session, answer questions, see results"
      - "apps/web/tests/e2e/learning.spec.ts — navigate to lesson, see video and RAG chat"
---

# Phase 6: Production Deploy Verification Report

**Phase Goal:** Приложение задеплоено на VPS 89.208.106.208, доступно через HTTPS (academyal.duckdns.org), работает стабильно в Docker с полным E2E flow
**Verified:** 2026-02-24T16:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Пользователь открывает production URL по HTTPS и видит landing page | ? HUMAN | Confirmed via browser automation in task context (not automated test) |
| 2 | Google OAuth работает в production (redirect URI обновлён) | ? HUMAN | Confirmed via browser automation; auth/callback/route.ts uses NEXT_PUBLIC_SITE_URL |
| 3 | Полный flow: регистрация -> диагностика -> результаты -> обучение -> RAG chat | ? HUMAN | Confirmed via browser automation (06-02-SUMMARY E2E table); no automated test |
| 4 | Docker restart policy автоматически перезапускает контейнер при crash | ✓ VERIFIED | docker-compose.yml: `restart: unless-stopped` |
| 5 | Health check endpoint возвращает статус приложения и БД | ✓ VERIFIED | /api/health returns `{status, timestamp, uptime, database}` with 200/503 |

**Score:** 2/5 truths verified programmatically (3 confirmed via human browser automation, not automated tests)

---

## Required Artifacts

### Plan 06-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/api/health/route.ts` | Health check endpoint | ✓ VERIFIED | Exports GET, uses singleton prisma, force-dynamic, returns 200/503 |
| `Dockerfile` | Runner stage with openssl | ✓ VERIFIED | Line 53: `RUN apk add --no-cache openssl`; also copies Prisma .so.node binaries |
| `docker-compose.yml` | Healthcheck pointing to /api/health | ✓ VERIFIED | Line 20: wget spider hits `http://127.0.0.1:3000/api/health` |
| `.github/workflows/ci.yml` | Triggers on master branch | ✓ VERIFIED | Line 5: `branches: [master, main, develop]` in both push and pull_request |

### Plan 06-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/cd.yml` | CD pipeline using appleboy/ssh-action | ✓ VERIFIED | Triggers on master push + workflow_dispatch, SSH deploy script included |
| `packages/db/prisma/schema.prisma` | binaryTargets includes linux-musl-openssl-3.0.x | ✓ VERIFIED | Line 7: `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` |
| `apps/web/next.config.js` | output: standalone | ✓ VERIFIED | Line 5: `output: 'standalone'` |
| `ecosystem.config.js` | PM2 ecosystem config (DEPLOY-02) | ✗ MISSING | No such file exists; Docker Compose restart policy used instead |
| `apps/web/tests/e2e/` | Auth + diagnostic + learning E2E tests (DEPLOY-07) | ✗ MISSING | Only `landing.spec.ts` exists — no flow-specific test files |

---

## Key Link Verification

### Plan 06-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Dockerfile runner stage | Prisma query engine | `apk add openssl` provides libssl | ✓ WIRED | Line 53 in Dockerfile |
| docker-compose.yml healthcheck | /api/health | wget spider check | ✓ WIRED | `http://127.0.0.1:3000/api/health` in healthcheck test |

### Plan 06-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| .github/workflows/cd.yml | VPS Docker Compose | SSH action runs git pull + docker compose rebuild | ✓ WIRED | appleboy/ssh-action with `docker compose down/build/up` script |
| Docker container | Supabase cloud DB | DATABASE_URL in .env.production (VPS-side file, not in repo) | ? EXTERNAL | Cannot verify VPS file from local codebase; confirmed working via human E2E |
| auth/callback/route.ts | NEXT_PUBLIC_SITE_URL | Uses env var for redirect origin | ✓ WIRED | Line 10: `const origin = process.env.NEXT_PUBLIC_SITE_URL \|\| requestUrl.origin` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| DEPLOY-01 | 06-01-PLAN | `output: 'standalone'` in next.config.js | ✓ SATISFIED | `apps/web/next.config.js` line 5 |
| DEPLOY-02 | 06-01-PLAN | PM2 ecosystem config для production | ✗ BLOCKED | No `ecosystem.config.js` found; Docker Compose used instead. Requirement text may be stale (PM2 not needed when containerized). |
| DEPLOY-03 | 06-01-PLAN | Nginx reverse proxy с SSL (Let's Encrypt) | ✓ SATISFIED (Phase 05.1) | Nginx + SSL implemented in Phase 05.1 VPS infrastructure — pre-requisite phase |
| DEPLOY-04 | 06-01-PLAN, 06-02-PLAN | Environment variables настроены на VPS | ✓ SATISFIED | `.env.production` on VPS (not in repo); all build args in Dockerfile/docker-compose.yml; auth callback uses NEXT_PUBLIC_SITE_URL |
| DEPLOY-05 | 06-01-PLAN | Prisma binary targets для Linux (Ubuntu 24.04) | ✓ SATISFIED | `schema.prisma` binaryTargets includes `linux-musl-openssl-3.0.x`; Dockerfile copies .so.node binaries |
| DEPLOY-06 | 06-01-PLAN | Health check endpoint для мониторинга | ✓ SATISFIED | `/api/health` returns `{status, timestamp, uptime, database}` with 200/503 |
| DEPLOY-07 | 06-02-PLAN | Критичные E2E тесты: auth flow, diagnostic flow, learning flow | ✗ BLOCKED | Only `landing.spec.ts` exists. Human-verify checkpoint was used in plan, not automated tests. |

**Coverage:** 5/7 DEPLOY requirements satisfied.

### Orphaned Requirements Check

REQUIREMENTS.md maps DEPLOY-01 through DEPLOY-07 to Phase 6 Production Deploy.
All 7 IDs appear in plan frontmatter (`06-01-PLAN.md`: DEPLOY-01..06; `06-02-PLAN.md`: DEPLOY-04, DEPLOY-07).
No orphaned requirements — all Phase 6 requirement IDs are claimed by plans.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/tests/e2e/` | - | Only `landing.spec.ts` exists | ⚠️ Warning | DEPLOY-07 not met — no automated regression tests for critical user flows |
| `Dockerfile` | 64 | Hardcoded `@prisma+client@5.22.0_prisma@5.22.0` path for binary copy | ℹ️ Info | Will break if Prisma version is bumped without updating Dockerfile |

---

## Human Verification Required

All five production-side truths have been confirmed by browser automation as described in the additional context, but they are not reproducible via automated test suite. The following items should be formally verified if the CI E2E gap is resolved:

### 1. Full Production E2E Flow

**Test:** Open https://academyal.duckdns.org and complete: landing -> login with Google OAuth -> dashboard -> /learn (verify 405 lessons) -> open any lesson (verify Kinescope video + RAG summary) -> Chat tab (ask a question) -> /diagnostic (start + answer + results with radar chart) -> /profile
**Expected:** All pages render with real Supabase data, no blank pages, OAuth redirect uses academyal.duckdns.org domain
**Why human:** No automated E2E test covers this flow; VPS-side state (DB connectivity, container health) cannot be verified from local codebase

### 2. Docker Restart Policy

**Test:** On VPS: `docker compose kill web && sleep 10 && docker compose ps`
**Expected:** Container restarts automatically with `restart: unless-stopped`
**Why human:** Cannot trigger a container crash from local codebase inspection

---

## Gaps Summary

Two requirements are not satisfied by the codebase as it stands:

**DEPLOY-02 (PM2 ecosystem config):** This requirement was written before the team chose Docker Compose as the container runtime. Docker Compose with `restart: unless-stopped` provides equivalent process management inside a container. The requirement is technically stale — PM2 is not needed when the app runs in Docker. Resolution options: (1) create a minimal `ecosystem.config.js` to satisfy the literal requirement text, or (2) update REQUIREMENTS.md to change DEPLOY-02 description to "Docker Compose restart policy configured" and mark it satisfied.

**DEPLOY-07 (critical E2E tests):** The plan used a blocking human-verify checkpoint (`checkpoint:human-verify gate="blocking"`) which was approved. The E2E verification was thorough and is documented in the SUMMARY. However, no automated Playwright test files were created for auth, diagnostic, or learning flows — only `landing.spec.ts` exists. The CI pipeline will not catch regressions in these critical flows. To fully satisfy DEPLOY-07, three spec files need to be created.

The production deployment itself is functional and verified by human browser automation across all critical flows. The gaps are around process management documentation (DEPLOY-02) and automated regression test coverage (DEPLOY-07).

---

_Verified: 2026-02-24T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
