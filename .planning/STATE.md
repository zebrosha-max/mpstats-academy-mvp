# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Пользователь проходит AI-диагностику, получает точную карту навыков и персонализированный трек обучения из реальных данных
**Current focus:** Phase 05: Security Hardening

## Current Position

Phase: 05 of 7 (Security Hardening) — COMPLETE
Plan: 2 of 2 in current phase (ALL COMPLETE)
Status: Phase 05 complete — All security hardening plans executed
Last activity: 2026-02-25 — Plan 05-02 complete (output sanitization + error boundaries)

Progress: [██████████] 100% (Phase 05 complete, 2/2 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 7.0 min
- Total execution time: ~1.4 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-foundation | 4 | 17 min | 4.3 min |
| 02-ai-question-generation | 2 | 12 min | 6 min |
| 03-video-integration | 2 | 38 min | 19 min |
| 04-access-control | 2 | 4 min | 2 min |

**Recent Trend:**
- Last 5 plans: 01-04 (4 min), 02-01 (10 min), 02-02 (2 min), 03-01 (3 min), 03-02 (35 min)
- Trend: Stable

*Updated after each plan completion*
| Phase 05.1-vps-infrastructure-setup P01 | 12 | 2 tasks | 4 files |
| Phase 05.1-vps-infrastructure-setup P02 | 15 | 2 tasks | VPS only |
| Phase 06-production-deploy P01 | 1 | 2 tasks | 4 files |
| Phase 06-production-deploy P02 | 45 | 2 tasks | 3 files |
| Phase 05-security-hardening P01 | 2 | 2 tasks | 6 files |
| Phase 05-security-hardening P02 | 3 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Migration order Learning -> Diagnostic -> Profile (dependency chain)
- [Roadmap]: Strangler Fig pattern — try DB first, fallback to mock
- [Roadmap]: Phases 2+3 can parallel after Phase 1 completes
- [01-01]: COURSE_SKILL_MAP maps 6 courses to 5 categories (03_ai->CONTENT, 04_workshops->OPERATIONS, 05_ozon->MARKETING, 06_express->OPERATIONS)
- [01-01]: API utils import from @mpstats/db, not @prisma/client directly
- [01-01]: tsx added as root dev dependency for seed scripts
- [01-02]: Removed getLessonSummary from learning router (already handled by AI router)
- [01-02]: Default learn view changed from 'path' to 'courses' for 405-lesson scale
- [01-02]: Course lessons collapsed to first 5 with expand button
- [01-03]: Active session questions in globalThis Map (not DB) — short-lived, no schema change
- [01-03]: Server restart marks orphaned sessions as ABANDONED
- [01-03]: Exported functions take PrismaClient as first parameter (not singleton)
- [01-04]: Average score = mean of 5 skill axes (not per-diagnostic calculation)
- [01-04]: longestStreak = 0 for MVP (full history scan deferred)
- [01-04]: updateSettings kept as mock (no Settings model in schema)
- [02-01]: question-generator accepts fallbackFn callback to avoid circular dep with @mpstats/api
- [02-01]: FINANCE category (empty courses) always uses mock fallback
- [02-01]: Options shuffled after LLM generation to avoid correctIndex bias
- [02-01]: @mpstats/shared added as workspace dep to @mpstats/ai
- [02-02]: Rate limiter stored in globalThis Map (same pattern as activeSessionQuestions)
- [02-02]: Triple fallback: AI per-category -> mock per-category -> full mock (getBalancedQuestions)
- [03-01]: Cast dynamic() to original type for class component ref support
- [03-01]: seekTo + play on timecode click for intuitive UX
- [03-01]: Disabled timecodes shown as grayed badges (not hidden) when no videoId
- [03-02]: Used manifest.json as mapping source — 100% match rate (405/405 videos)
- [03-02]: Native fetch + FormData for upload instead of form-data package
- [03-02]: Progress file (kinescope-upload-progress.json) for resume on re-run
- [Phase 05.1-01]: VPS already pre-configured: Docker/Nginx/UFW/fail2ban verified rather than installed
- [Phase 05.1-01]: Docker port binding 127.0.0.1:3000:3000 — port 3000 not exposed externally, Nginx+Cloudflare handle ingress
- [Phase 05.1-01]: turbo prune @mpstats/web --docker + outputFileTracingRoot for monorepo standalone Next.js build
- [Phase 05.1-02]: DuckDNS + Let's Encrypt instead of Cloudflare Tunnel (user has no CF domain)
- [Phase 05.1-02]: Production URL: https://academyal.duckdns.org (cert expires 2026-05-25)
- [06-01]: openssl in Alpine runner (not binaryTargets) — Prisma auto-detects linux-musl-openssl-3.0.x
- [06-01]: Health endpoint uses singleton prisma from @mpstats/db, no $disconnect
- [06-01]: CI includes master, main, develop for backward compatibility
- [06-02]: appleboy/ssh-action@v1 for CD — simple SSH-based deploy, no Docker registry needed
- [06-02]: Prisma binaryTargets added linux-musl-openssl-3.0.x alongside openssl package for reliability
- [06-02]: Prisma engine binaries explicitly copied to standalone output in Dockerfile
- [04-01]: Gate defaults to showing content while loading (hasDiagnostic === false, not !hasDiagnostic)
- [04-01]: Weak categories threshold score < 50 for recommended path generation
- [04-01]: Path regenerated on every diagnostic completion via upsert (supports re-takes)
- [04-02]: View mode skeleton shown until diagnostic status resolves to prevent flicker
- [04-02]: Recommended lessons cast as LessonWithProgress (compatible shape, courseName passed separately)
- [04-02]: Button text changed from "Мой план" to "Мой трек" per CONTEXT.md naming decision
- [05-01]: Rate limiter uses globalThis Map for HMR persistence (same pattern as diagnostic.ts)
- [05-01]: server-only added to @mpstats/ai package — Next.js traces imports through monorepo
- [05-01]: searchChunks uses protectedProcedure without rate limit (debug endpoint)
- [05-02]: SafeMarkdown blocks all links, images, scripts via allowlist (not blocklist)
- [05-02]: not-found.tsx uses inline text logo instead of Logo component (server component compatibility)
- [05-02]: global-error.tsx uses inline styles (no Tailwind — catches root layout failures)

### Roadmap Evolution

- Phase 5.1 inserted after Phase 5: VPS Infrastructure Setup (INSERTED) — deploy target changed from 79.137.197.90 to 89.208.106.208
- Phase 7 added: Lesson & Course Name Cleanup — очистка 405 названий уроков, модулей и курсов от технических артефактов (.mp4, нумерация, разделители _)

### Pending Todos

None yet.

### Blockers/Concerns

- Kinescope videoId data needed from content team — RESOLVED: upload scripts ready, user setting up Kinescope account
- Domain name for production SSL — RESOLVED: academyal.duckdns.org with Let's Encrypt
- SkillCategory enum has 5 values but 6 courses exist — RESOLVED in 01-01 (COURSE_SKILL_MAP)
- DATABASE_URL credentials RESOLVED — host changed from aws-0-eu-central-1 to aws-1-eu-west-1, DIRECT_URL switched to session pooler

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 05-02-PLAN.md — Output sanitization + error boundaries (Phase 05 COMPLETE)
Resume file: .planning/phases/05-security-hardening/05-02-SUMMARY.md
