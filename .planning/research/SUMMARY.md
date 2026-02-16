# Project Research Summary

**Project:** MPSTATS Academy Adaptive Learning (MAAL) — Sprints 4-5 Integration
**Domain:** Educational platform integration (mock-to-real data migration, video integration, AI diagnostics, production deployment)
**Researched:** 2026-02-16
**Confidence:** MEDIUM-HIGH

## Executive Summary

MAAL is an educational platform for marketplace sellers with adaptive learning driven by AI-powered diagnostics. The project has completed UI development (Sprints 0-2) and RAG integration (Sprint 3). The remaining work focuses on **data layer migration** (replacing in-memory mocks with persistent Prisma/Supabase storage), **video integration** (Kinescope player with timecode deep-linking), **AI question generation** (diagnostic questions derived from RAG chunks), and **production deployment** (VPS with PM2/Nginx).

The recommended approach is **incremental migration with fallbacks**: replace mock data sources one component at a time, keeping mock fallback logic until all integrations are complete. The highest-risk component is AI question generation, which introduces non-determinism into a critical user flow — this must include validation guardrails and mock fallbacks. The most impactful integration is database persistence — without it, all progress and diagnostic data is lost on server restarts, making the platform unusable in production.

The critical path is: (1) Seed real course/lesson data → (2) Migrate learning progress to database → (3) Migrate diagnostic persistence → (4) Secure endpoints and deploy to VPS. AI question generation and advanced video features can follow as post-launch enhancements. The primary pitfall to avoid is atomic migration failures — migrating one router while leaving cross-dependencies on mock data creates data integrity issues.

## Key Findings

### Recommended Stack

Three new integrations are required: video player SDK, production deployment architecture, and AI question generation. All leverage existing technologies (Kinescope, Next.js, OpenRouter) to minimize new dependencies.

**Core additions:**
- **Kinescope Player Iframe API Loader (0.9.0):** TypeScript-typed API for programmatic video control — enables timecode seek from RAG citations, watch progress tracking. Choose this over React wrapper (older, less flexible for App Router). Plain iframe embed already works, SDK adds programmatic control only.
- **Next.js standalone output:** `output: 'standalone'` in next.config.js produces minimal production bundle (50MB vs 500MB). Standard pattern for self-hosted deploys, eliminates node_modules on VPS.
- **PM2 (6.0.14):** Process manager for auto-restart, cluster mode, log management. VPS has PM2 5.x installed — upgrade recommended. Alternative: systemd service (more complex, no cluster mode).
- **Nginx + Let's Encrypt:** Reverse proxy for HTTPS termination. Standard for Ubuntu VPS. Certbot handles auto SSL renewal.

**No new dependencies for AI question generation:** Use existing OpenRouter + OpenAI SDK + Zod stack. JSON mode with schema validation, not function calling (better portability across LLM providers).

**Version compatibility:** Next.js 14.2.x compatible with Node.js 20.x (VPS has 20.19.6). Prisma 5.x requires `generate` on VPS before build. pnpm must be installed via corepack.

### Expected Features

Research identified 10 table stakes (must have), 7 differentiators (competitive advantage), and 8 anti-features (commonly requested but problematic). The MVP definition excludes advanced features like adaptive difficulty and full LMS capabilities.

**Must have (table stakes):**
- **TS-1: Dynamic course catalog from DB** — replacing hardcoded mocks, foundation for all other features
- **TS-2/3: Persistent progress and diagnostics** — data must survive server restarts (critical production blocker)
- **TS-4: Video player (Kinescope embed)** — core value delivery, depends on external videoId data
- **TS-6/7/8: Production deployment (VPS, env vars, HTTPS)** — must be accessible online with SSL for Google OAuth
- **TS-10: Protected routes enforcement** — fix 3 publicProcedure TODOs in ai.ts (security critical)
- **D-2: Soft access gating** — diagnostic-first UX (core value prop: personalized learning path)
- **D-3: Personalized path from skill gaps** — weak skill areas prioritized in lesson recommendations

**Should have (competitive differentiators):**
- **D-1: AI-generated diagnostic questions from RAG** — infinite variety, always relevant to actual content (HIGH complexity, post-launch)
- **D-4: Clickable timecodes that seek video** — deep integration between RAG citations and video player
- **D-6: Course structure auto-derived from RAG data** — 6 courses / 80+ lessons already in DB, endpoint to expose them
- **D-7: Summary cache in DB** — SummaryCache Prisma model already exists, trivial migration from in-memory Map

**Defer (v2+):**
- **D-5: Adaptive difficulty (IRT-lite)** — requires large question pool from AI generation first
- **AF-5: PWA manifest** — responsive web sufficient for MVP, add when mobile metrics justify
- **AF-6: Gamification (badges, streaks)** — adds complexity, defer until retention data demands it

**Anti-features to avoid:**
- Real-time collaborative features (WebSocket complexity, low value for solo learners)
- Custom video player (Kinescope already handles transcoding/DRM/CDN)
- Multi-language i18n (all content is Russian, translation doubles effort)
- Microservice architecture (single Next.js app is correct for scale)

### Architecture Approach

The integration milestone bridges UI (already built) and data layer (Prisma schema exists, tables not populated). The core challenge is replacing three mock layers atomically: static course arrays, in-memory diagnostic sessions (globalThis Maps), and static question pools.

**Major components and migration strategy:**

1. **Learning Router (learning.ts):** Currently reads `MOCK_COURSES` array → migrate to `ctx.prisma.course.findMany()` with progress relations. Replace in-memory `mockProgress` Map → `ctx.prisma.lessonProgress.upsert()`. Safest migration first (no cross-router dependencies).

2. **Diagnostic Router (diagnostic.ts):** Currently uses `globalThis.mockSessions` / `completedSessions` → migrate to `DiagnosticSession` + `DiagnosticAnswer` Prisma models. Store generated questions as JSON field on session (not normalized table — ephemeral per session). Critical: this exports `getLatestSkillProfile()` used by profile router — must migrate before profile.

3. **AI Package (packages/ai/):** Add `question-generator.ts` service following existing RAG pipeline pattern. Called from `diagnostic.startSession()` with fallback to mock questions. Uses same OpenRouter + Zod validation as summary/chat.

4. **Kinescope Integration:** No architectural change — `videoId` field already in Prisma schema. Integration is data-only: populate lesson videoIds via seed script. SDK enables `seekTo(seconds)` for timecode citations from RAG.

5. **VPS Deploy Architecture:** `Client -> Nginx (:443 HTTPS) -> PM2 (Next.js :3000) -> Supabase (cloud)`. Standalone build produces `.next/standalone/server.js` entrypoint. PM2 ecosystem config manages process, Nginx handles SSL termination.

**Key pattern: Strangler Fig migration** — try DB first, fall back to mock if not seeded. Allows partial migration without breaking existing features. Example: `learning.getCourses()` checks if `courses.length > 0` from DB, else returns `getMockCourses()`.

**Critical dependency chain:** Course/Lesson seed must happen first (everything depends on real data). Then learning progress, then diagnostics (exports functions used by profile), then profile dashboard (aggregates from real progress data). AI question generation and video SDK are independent of this chain.

### Critical Pitfalls

Six critical pitfalls identified that would block production launch or cause data integrity issues.

1. **Mock Data Shape Diverges from Prisma Schema** — `MOCK_COURSES` defines 5 courses (01-05) with computed fields like `progressPercent`. Real DB has 6 courses (including 03_ai, 05_ozon, 06_express) and Prisma returns relations, not computed fields. Fix: create DTO mapping layer (`toDTO()` functions), update SkillCategory enum to include missing courses, write integration tests that validate tRPC response shapes match shared types. **Address in Phase 1 (Mock-to-DB migration), first task before touching routers.**

2. **In-Memory State Not Migrated Atomically** — Three routers share data via `globalThis` and mock imports. Partial migration (e.g., diagnostic to DB while learning stays mock) breaks `recommendedPath` lesson IDs. Fix: map cross-router dependencies, migrate in order (Learning → Diagnostic → Profile), keep mock fallbacks until all migrated. **Address in Phase 1, plan migration order explicitly.**

3. **AI Endpoints Left as publicProcedure in Production** — All `ai.ts` endpoints are `publicProcedure` with TODO comments about SSR cookies. If deployed as-is: unbounded API costs, unauthenticated access to LLM. Fix: resolve SSR cookie propagation, switch to `protectedProcedure`, add rate limiting (PRD specifies 20 msg/hour chat, 50 LLM/hour), remove/protect `searchChunks` debug endpoint. **Address in Phase 3 (Pre-deploy hardening), blocker for deployment.**

4. **Next.js Standalone Build Missing for PM2 Deployment** — No `output: 'standalone'` configured. Without it, VPS needs full node_modules (500MB) and monorepo structure. Prisma generates platform-specific binaries (Windows dev, Linux prod) which fail if not configured. Fix: add standalone output, configure Prisma `binaryTargets`, copy static assets to standalone folder, PM2 points to `standalone/server.js` not `next start`. **Address in Phase 4 (VPS deployment) before first deploy.**

5. **AI Question Generation Without Quality Guardrails** — LLM-generated MCQs can have hallucinated answers, inconsistent difficulty, format violations. Unlike hardcoded mocks, LLM output is non-deterministic. Fix: structured output (JSON mode + Zod schema), validation pipeline (schema → answer verification → difficulty check → dedup), offline question bank generation (not on-the-fly), keep mock fallback, temperature 0.2-0.3. **Address in Phase 2 (AI question generation) — design validation before writing generation code.**

6. **Supabase Service Role Key Exposed in Client Bundle** — `packages/ai/src/retrieval.ts` uses service role key (bypasses RLS). If imported client-side via barrel exports or tree-shaking failure, key leaks to browser. Fix: add `import 'server-only'` to `packages/ai/src/index.ts`, verify env vars lack `NEXT_PUBLIC_` prefix, grep `.next/static/` for key after build. **Address in Phase 3 (Pre-deploy hardening).**

**Honorable mention pitfalls:** XSS via `dangerouslySetInnerHTML` without sanitization (lesson page markdown rendering), no rate limiting on tRPC endpoints, missing error boundaries, Supabase free tier auto-pause (keep-alive already configured).

## Implications for Roadmap

Based on research, suggested phase structure with clear dependency ordering:

### Phase 1: Database Foundation & Data Migration
**Rationale:** All integration work depends on real data in the database. Mock-to-DB migration is the critical path. Learning router is safest to migrate first (no cross-router dependencies), diagnostic second (exports to profile), profile last (aggregates from others).

**Delivers:**
- Course/Lesson seed script populating 6 courses, 80+ lessons (derived from `content_chunk.lesson_id`)
- Learning router migrated to Prisma (courses, lessons, progress persistence)
- Diagnostic router migrated to Prisma (sessions, answers, skill profiles)
- Profile router computing dashboard stats from real data
- Removal of `globalThis` mock storage and `mocks/` imports

**Addresses:** TS-1 (DB catalog), TS-2 (persistent progress), TS-3 (persistent diagnostics), D-7 (summary cache in DB)

**Avoids:** Pitfall #1 (schema mismatch — fix DTO mapping first), Pitfall #2 (partial migration — migrate in dependency order)

**Critical tasks:**
1. Compare Prisma types vs `@mpstats/shared` types, create DTO layer
2. Seed Course/Lesson tables with lesson_id → SkillCategory mapping (extend enum for 03_ai, 05_ozon, 06_express)
3. Migrate learning.ts: `getCourses()`, `getLesson()`, `updateProgress()` → Prisma
4. Migrate diagnostic.ts: `startSession()`, `submitAnswer()`, `getResults()` → Prisma (store questions as JSON field)
5. Migrate profile.ts: `getDashboard()` aggregates from real tables
6. Integration tests validating all tRPC endpoints return correct shapes

**Complexity:** MEDIUM — schema/models exist, business logic exists in mocks, this is migration not rewrite. Main risk: schema mismatches.

### Phase 2: Video Integration & AI Question Generation
**Rationale:** Independent of Phase 1 data migration (can run in parallel). Video integration is data-only (populate videoId column). AI question generation is highest-risk feature, needs validation pipeline.

**Delivers:**
- Kinescope videoId mapping per lesson (via seed script or manual data entry)
- Video player showing real videos (iframe already implemented)
- Kinescope Player SDK integration for timecode seek (`player.seekTo(seconds)`)
- Clickable timecode badges in RAG summary/chat UI
- `question-generator.ts` service generating MCQs from RAG chunks
- Validation pipeline: Zod schema → answer verification → difficulty check
- Mock question fallback if LLM fails

**Addresses:** TS-4 (video player), TS-5 (timecode deep-links), D-4 (clickable timecodes), D-1 (AI question generation), TS-9 (question variety)

**Avoids:** Pitfall #5 (AI quality — validation guardrails + fallback)

**Uses stack:** Kinescope iframe API loader (0.9.0), existing OpenRouter + Zod, JSON mode structured output

**Critical tasks:**
1. Obtain real Kinescope videoIds from content team (external dependency)
2. Populate `lesson.videoId` column via seed script
3. Integrate `@kinescope/player-iframe-api-loader`, replace raw iframe
4. Implement `seekTo()` handler from timecode badges (postMessage or SDK ref)
5. Create `packages/ai/src/question-generator.ts` following RAG pipeline pattern
6. Build validation pipeline (Zod + answer verification against chunk content)
7. Integrate into `diagnostic.startSession()` with 10s timeout → fallback to mocks
8. Test generation quality: 100 questions through schema validation, manual review of 10

**Complexity:** AI generation is HIGH (prompt engineering, validation), video integration is LOW-MEDIUM (SDK integration, cross-component communication).

**Research flag:** AI question prompt engineering likely needs iteration during implementation. Consider pre-generating question bank offline vs on-the-fly during sessions.

### Phase 3: Security Hardening & Pre-Deploy Preparation
**Rationale:** Production blockers that must be resolved before VPS deploy. Security issues (publicProcedure, service key exposure), missing guardrails (rate limiting, error boundaries), UX gaps (error states, loading skeletons).

**Delivers:**
- All AI endpoints switched to `protectedProcedure` (SSR cookie issue resolved)
- Rate limiting middleware (100 req/min general, 50 LLM/hour, 20 chat/hour)
- `server-only` import in `packages/ai/src/index.ts`
- XSS protection: DOMPurify or react-markdown for AI-generated content (replace dangerouslySetInnerHTML)
- Error boundaries wrapping diagnostic, lesson, chat features
- Graceful error states for failed LLM calls
- UserProfile auto-creation on first login (no manual DB insert required)
- `searchChunks` debug endpoint removed or admin-protected

**Addresses:** TS-10 (protected routes), D-2 soft gating logic (hasCompletedDiagnostic check), edge case handling

**Avoids:** Pitfall #3 (publicProcedure in prod), Pitfall #6 (service key leak)

**Critical tasks:**
1. Fix Supabase SSR cookie propagation in tRPC context
2. Switch `ai.ts` endpoints back to `protectedProcedure`
3. Implement rate limiting middleware (@upstash/ratelimit or token bucket)
4. Add `import 'server-only'` to `packages/ai/`, verify with build + grep
5. Replace `dangerouslySetInnerHTML` with sanitized markdown renderer
6. Add React Error Boundary components to diagnostic session, lesson page, chat
7. Implement `hasCompletedDiagnostic()` check, wire up soft gating UI (`LessonLocked.tsx`)
8. UserProfile upsert hook in auth callback or tRPC middleware

**Complexity:** LOW-MEDIUM — mostly configuration and adding protective layers, not new features.

### Phase 4: VPS Production Deployment
**Rationale:** All data/features complete, now deploy to production. Standalone build, PM2 process management, Nginx reverse proxy, SSL configuration. Deploy early, iterate features in production.

**Delivers:**
- Next.js standalone build configured (`output: 'standalone'`)
- PM2 ecosystem config pointing to standalone server.js
- Nginx reverse proxy on VPS (79.137.197.90) with SSL (Let's Encrypt)
- Environment variables configured on VPS (DATABASE_URL, OPENROUTER_API_KEY, SUPABASE_*)
- Google OAuth redirect URI updated to production domain
- Deploy script: git pull, pnpm install, build, PM2 reload
- Smoke tests: auth flow, diagnostic flow, lesson video, RAG chat

**Addresses:** TS-6 (production deploy), TS-7 (env management), TS-8 (HTTPS/SSL)

**Avoids:** Pitfall #4 (standalone build missing)

**Uses stack:** PM2 (6.0.14), Nginx, Certbot, Next.js standalone output

**Critical tasks:**
1. Add `output: 'standalone'` to next.config.js
2. Configure Prisma `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`
3. Create PM2 ecosystem.config.js (script: standalone/server.js, env vars, log rotation)
4. Write deploy script: build, copy static assets, PM2 reload
5. Configure Nginx reverse proxy (port 80/443 → 3000)
6. Set up Let's Encrypt SSL with certbot
7. Update Google OAuth redirect URI in Supabase (academy.mpstats.io or custom domain)
8. Deploy, run smoke tests

**Complexity:** MEDIUM — standard deployment pattern, many steps, first-time setup. Requires domain name pointed to VPS (external dependency).

**External dependency:** Domain name for SSL and Google OAuth. Currently only IP 79.137.197.90.

### Phase 5 (Post-Launch): Enhancements & Analytics
**Rationale:** Features deferred from MVP that add value after core product is validated. Can be prioritized based on user feedback and analytics.

**Possible features:**
- D-6: Auto course structure from RAG (dynamic catalog endpoint)
- D-5: Adaptive difficulty IRT-lite (requires large question pool from Phase 2)
- Chat history persistence (ChatMessage Prisma model exists, wire up)
- Watch progress tracking via Kinescope timeupdate events
- PWA manifest for mobile home screen install
- Batch question generation for offline question bank
- Advanced rate limiting per endpoint tier
- Admin dashboard for content management

**Rationale:** Defer until product-market fit established, user data informs priorities.

### Phase Ordering Rationale

- **Phase 1 must come first:** Everything depends on real data in DB. No parallelization until course/lesson seed completes.
- **Phases 2 and 3 can overlap:** Video integration (external videoId dependency) and AI questions (riskiest feature) can develop in parallel with security hardening.
- **Phase 4 depends on Phases 1-3 complete:** Can't deploy without data migration (production blocker) and security hardening (publicProcedure exposure).
- **Phase 5 is post-launch:** Based on user feedback and analytics.

**Strangler Fig pattern throughout:** Keep mock fallbacks during Phase 1-2, remove only when confident all migrations work. Allows rollback without breaking app.

**Critical path:** Phase 1 (data migration) → Phase 3 (security) → Phase 4 (deploy). Phase 2 (video/AI) can lag behind if external dependencies (videoIds, prompt quality) take longer than expected.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (AI question generation):** Prompt engineering for reliable MCQ generation is niche, sparse documentation. May need iteration cycles with real RAG data to tune. Consider `/gsd:research-phase` if initial attempts produce low-quality questions.
- **Phase 4 (VPS deployment):** Turborepo monorepo deployment patterns with standalone output less documented than single-app Next.js. May need troubleshooting for static asset copying, Prisma binary targets. Standard patterns exist but first-time setup has gotchas.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Mock-to-DB migration):** Well-documented Prisma patterns, clear migration path. Research already identified DTO mapping as solution.
- **Phase 3 (Security hardening):** Standard Next.js + tRPC + Supabase Auth patterns. Rate limiting libraries well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Technologies verified via npm registry (Kinescope SDK 0.9.0, PM2 6.0.14), Next.js standalone documented, OpenRouter already working in codebase |
| Features | MEDIUM-HIGH | Based on codebase analysis (mocks, Prisma schema, existing UI) + training data. Feature priorities clear, but MVP scope could shift based on external dependencies (videoIds) |
| Architecture | HIGH | Full codebase analysis of routers, Prisma schema, AI package. Migration patterns clear, dependency chain mapped. Integration points well-defined |
| Pitfalls | MEDIUM | Based on codebase analysis (globalThis storage, publicProcedure TODOs) + training data patterns. Specific issues identified (schema mismatch, partial migration), but unknowns may surface during migration |

**Overall confidence:** MEDIUM-HIGH

Confidence is high for technical architecture and integration patterns. Confidence is medium for AI question generation quality (requires empirical testing) and deployment edge cases (first-time Turborepo + standalone setup). External dependencies (Kinescope videoIds, domain name for SSL) introduce schedule risk but not technical risk.

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation:

- **AI question generation prompt quality:** Research identified validation strategies (Zod schema, answer verification) but actual prompt engineering for reliable MCQ output requires iteration with real RAG data. Plan for 2-3 revision cycles in Phase 2.

- **Lesson_id to SkillCategory mapping:** Real data has 6 courses (01-06) but SkillCategory enum has 5 values. Gap: how to map 03_ai (AI tools), 05_ozon (Ozon marketplace), 06_express (express delivery). Options: (1) extend SkillCategory enum with new categories, (2) map multiple lesson prefixes to existing categories (e.g., 03_ai → CONTENT, 05_ozon → OPERATIONS, 06_express → FINANCE). **Resolution: decide during Phase 1 seed script creation.**

- **Kinescope videoId availability:** Research assumes real videoIds will be provided. If not available, video player remains placeholder (blocker for TS-4). **Mitigation: confirm videoId timeline with content team before starting Phase 2.**

- **Prisma binary target for Ubuntu 24.04:** VPS runs Ubuntu 24.04 LTS, but research did not verify exact Prisma binary target. Common targets: `linux-musl-openssl-3.0.x`, `debian-openssl-3.0.x`. **Resolution: test Prisma generate on VPS during Phase 4, adjust binaryTargets if needed.**

- **Rate limiting implementation:** PRD specifies 3 tiers (100 req/min, 50 LLM/hour, 20 chat/hour). Research did not select specific rate limiting library (@upstash/ratelimit requires Redis, in-memory token bucket simpler for MVP). **Resolution: evaluate options during Phase 3 implementation.**

- **Domain name for production:** Deployment requires domain pointed to VPS IP for SSL and Google OAuth. Assumed domain `academy.mpstats.io` but not confirmed. **Resolution: confirm domain before Phase 4.**

## Sources

### Primary (HIGH confidence)
- **Codebase analysis:** Full audit of `packages/api/src/routers/*.ts` (diagnostic, learning, profile, ai), `packages/ai/src/*.ts` (RAG pipeline), `packages/db/prisma/schema.prisma` (12 models), `apps/web/src/app/(main)/*` (UI implementation), `CLAUDE.md` (Sprint 0-3 completion status, known issues)
- **npm registry (verified 2026-02-16):** `@kinescope/player-iframe-api-loader@0.9.0`, `pm2@6.0.14`, `next@16.1.6` latest vs project `14.2.x`, `openai@6.22.0` latest vs project `4.73.0`
- **Existing documentation:** `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md`, `docs/02_technical_spec/TECHNICAL_SPEC.md`, Sprint 5 plan in CLAUDE.md

### Secondary (MEDIUM confidence)
- **Next.js deployment patterns:** Standalone output, PM2 ecosystem config, static asset copying (based on training data, not verified against current Next.js 14 docs due to web tool restrictions)
- **Nginx reverse proxy configuration:** SSL termination, proxy headers, WebSocket upgrade (standard patterns from training data)
- **LLM question generation quality patterns:** Validation strategies, structured output best practices, temperature settings (based on training data, not domain-specific research)

### Tertiary (LOW confidence)
- **Prisma binary targets for Ubuntu 24.04:** Inferred `linux-musl-openssl-3.0.x` based on common targets, needs verification during deployment
- **Kinescope Player SDK exact API:** Assumed `seekTo(seconds)` method based on package description, not verified against actual SDK docs

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
