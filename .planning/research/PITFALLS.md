# Pitfalls Research

**Domain:** Educational platform MVP — mock-to-real migration, video integration, AI question generation, VPS deployment
**Researched:** 2026-02-16
**Confidence:** MEDIUM (based on codebase analysis + training data; WebSearch/Context7 unavailable for verification)

## Critical Pitfalls

### Pitfall 1: Mock Data Shape Diverges from Prisma Schema

**What goes wrong:**
Mock data types in `packages/api/src/mocks/courses.ts` and `packages/shared/src/index.ts` define shapes (`Course`, `Lesson`, `CourseWithProgress`) that do not match the actual Prisma schema. When switching to `ctx.prisma.lesson.findMany()`, the return types differ: Prisma returns objects with relations defined in `schema.prisma`, while mocks use flat objects with computed fields like `progressPercent`, `completedLessons`, `status`.

Concrete example: `MOCK_COURSES` has 5 courses (01_analytics through 05_finance), but the actual Supabase `content_chunk` table has 6 courses (including 03_ai, 05_ozon, 06_express). The mock `skillCategory` mapping (`02_marketing` -> MARKETING) does not cover the real data (03_ai has no matching SkillCategory enum).

**Why it happens:**
During UI-first development, mock shapes were designed for frontend convenience, not database fidelity. The Prisma schema was written later and evolved independently.

**How to avoid:**
1. Before touching router code, run `pnpm db:generate` and compare Prisma types against `@mpstats/shared` types
2. Create a mapping layer (e.g., `toDTO()` functions) that transforms Prisma models into the shape the frontend expects
3. Add the missing courses (03_ai, 05_ozon, 06_express) to the Course/Lesson seed data, or update SkillCategory enum to include them
4. Write a single integration test that calls each tRPC endpoint with real Prisma and asserts the response shape matches `@mpstats/shared` types

**Warning signs:**
- TypeScript errors when replacing `MOCK_COURSES` with `prisma.course.findMany()`
- Frontend crashes on undefined properties (`lesson.status` exists on mock, but is computed from `LessonProgress` in Prisma)
- `CourseWithProgress` expects `progressPercent` which is not a DB column

**Phase to address:**
Phase 1 (Mock-to-DB migration) -- must be the first task before any other real data work.

---

### Pitfall 2: In-Memory State Not Migrated Atomically

**What goes wrong:**
Three routers maintain separate in-memory state using `globalThis`:
- `diagnostic.ts`: `mockSessions`, `completedSessions`, `latestSkillProfiles` (Map objects)
- `learning.ts`: `mockProgress` (Map)
- `ai.ts`: `summaryCache` (Map, 24h TTL)

Partial migration (e.g., migrating diagnostic to Prisma but leaving learning on mock) creates data integrity issues. The `diagnostic.ts` router calls `getRecommendedLessonsFromGaps()` which references `MOCK_LESSONS` to build recommended lesson IDs. If learning is migrated to real DB but diagnostic still returns mock lesson IDs, the `recommendedPath` will point to non-existent records.

**Why it happens:**
Each router looks independently migratable, but they share data through mock imports (`MOCK_LESSONS`, `MOCK_SKILL_PROFILE`) and through `globalThis` cross-references (`getLatestSkillProfile` is exported from diagnostic and imported by profile router).

**How to avoid:**
1. Map all cross-router dependencies before starting:
   - `diagnostic.ts` imports from `mocks/questions.ts`, `mocks/dashboard.ts`, `mocks/courses.ts`
   - `profile.ts` imports `getLatestSkillProfile` and `getCompletedSessions` from `diagnostic.ts`
   - `learning.ts` imports from `mocks/courses.ts`
2. Migrate in dependency order: Courses/Lessons seed first, then Diagnostic, then Learning Progress, then Profile
3. Keep mock fallback code until all routers are migrated, guarded by a feature flag or env var `USE_REAL_DB=true`

**Warning signs:**
- Profile page shows stale/empty skill profile after diagnostic migration
- "Recommended path" links go to 404 lessons
- `getLatestSkillProfile()` returns null for users who completed diagnostics via the new DB flow

**Phase to address:**
Phase 1 (Mock-to-DB migration) -- plan the migration order explicitly, do not parallelize.

---

### Pitfall 3: AI Endpoints Left as publicProcedure in Production

**What goes wrong:**
All three AI router endpoints (`getLessonSummary`, `chat`, `searchChunks`) are currently `publicProcedure` with TODO comments: "Switch back to protectedProcedure after fixing Supabase SSR cookies". This was a dev workaround. If deployed as-is:
- Any unauthenticated user can call the AI endpoints
- OpenRouter API costs are unbounded (no user-level rate limiting)
- `searchChunks` debug endpoint exposes raw vector search to the internet

**Why it happens:**
SSR cookie handling with Supabase Auth in tRPC context is tricky. The workaround was applied during Sprint 3 testing and never reverted.

**How to avoid:**
1. Fix Supabase SSR cookie propagation in the tRPC context creation (`packages/api/src/trpc.ts` + `apps/web/src/app/api/trpc/[trpc]/route.ts`)
2. Switch all AI endpoints back to `protectedProcedure` before deployment
3. Remove or protect the `searchChunks` endpoint (admin-only or delete it)
4. Add rate limiting middleware to `protectedProcedure` for AI endpoints (the PRD specifies 20 msg/hour per user, 50 LLM req/hour)

**Warning signs:**
- `grep -r "publicProcedure" packages/api/src/routers/ai.ts` returns matches
- OpenRouter bill spikes without corresponding authenticated user activity
- Bot traffic hitting `/api/trpc/ai.chat`

**Phase to address:**
Phase 3 (Pre-deployment hardening) -- must be resolved before VPS deploy.

---

### Pitfall 4: Next.js Standalone Build Missing for PM2 Deployment

**What goes wrong:**
The project has no `output: 'standalone'` in `next.config.js`. Without this, `next build` produces a build that requires the full `node_modules` on the server. PM2 then needs to run `next start` which expects the complete monorepo structure. On VPS, this means copying the entire monorepo (including dev dependencies, all packages) rather than a slim deployable bundle.

Additionally, `turbo.json` defines `build` tasks for the monorepo, but there is no explicit build pipeline for production that handles:
- Environment variable injection at build time vs runtime
- Prisma client generation on the target architecture (Linux vs Windows)
- The `packages/ai/` package which directly calls `process.env.OPENROUTER_API_KEY` at import time

**Why it happens:**
Development happens on Windows, deployment targets Ubuntu Linux. Prisma generates platform-specific binaries. The monorepo structure adds complexity to deployment that does not surface during local development.

**How to avoid:**
1. Add `output: 'standalone'` to `next.config.js` -- this bundles the app into a self-contained `.next/standalone/` directory
2. Configure Prisma `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` (or the correct Linux target for Ubuntu 24.04)
3. Create a deployment script that: builds on CI or server, copies `.next/standalone/`, `.next/static/`, and `public/` to the deploy directory
4. Use PM2 ecosystem file (`ecosystem.config.js`) pointing to `standalone/server.js`, not `next start`
5. Set all env vars in PM2 ecosystem config or `/etc/environment`, not in `.env` files

**Warning signs:**
- `next build` succeeds locally but fails on VPS with Prisma binary errors
- PM2 process crashes with "Cannot find module" errors
- Server starts but static assets return 404

**Phase to address:**
Phase 4 (VPS deployment) -- configure before first deploy attempt.

---

### Pitfall 5: AI Question Generation Without Quality Guardrails

**What goes wrong:**
Sprint 5 Phase C plans to generate diagnostic questions from RAG chunks via LLM. Common failures:
1. **Hallucinated answer options** -- LLM generates plausible-sounding but incorrect options that are not grounded in the chunk content
2. **Inconsistent difficulty** -- questions labeled HARD are actually EASY, breaking the IRT-lite adaptive difficulty
3. **Duplicate or near-duplicate questions** -- same chunk generates semantically identical questions across sessions
4. **Format violations** -- LLM returns malformed JSON, missing `correctIndex`, or fewer than 4 options

The current mock system in `mocks/questions.ts` uses hardcoded questions with guaranteed structure. Replacing this with LLM generation introduces non-determinism into a critical user-facing flow (diagnostic results directly determine the learning path).

**Why it happens:**
LLM outputs are probabilistic. Without structured output enforcement, validation, and caching, every generation call can produce different quality results.

**How to avoid:**
1. Use structured output (JSON mode) with a strict Zod schema for question format validation
2. Generate a question bank offline (batch process) and cache in DB, not on-the-fly during diagnostic sessions
3. Implement a validation pipeline: schema check -> answer verification against chunk -> difficulty heuristic -> deduplication
4. Keep mock questions as fallback (Sprint 5 plan RA-5.11 already specifies this -- actually implement it)
5. Set temperature to 0.2-0.3 for question generation (lower than chat)
6. Include the correct answer explicitly in the prompt context and validate that `correctIndex` points to it

**Warning signs:**
- Diagnostic results vary wildly between sessions on the same content
- Users report "none of these answers are correct"
- `submitAnswer` returns `isCorrect: false` for questions where the user's answer matches the chunk content
- Generation latency exceeds 5s (p95 target from PRD), making diagnostic start feel slow

**Phase to address:**
Phase 2 (AI question generation) -- design validation pipeline before writing generation code.

---

### Pitfall 6: Supabase Service Role Key Exposed in Client Bundle

**What goes wrong:**
`packages/ai/src/retrieval.ts` uses `SUPABASE_SERVICE_ROLE_KEY` to initialize a Supabase client that bypasses RLS. This code is imported by `packages/api/src/routers/ai.ts` which runs in the tRPC API handler (server-side). However, if any import path accidentally pulls this into client-side code (e.g., via barrel exports or tree-shaking failure in Turborepo), the service role key leaks to the browser.

Additionally, the `OPENROUTER_API_KEY` is used directly in `packages/ai/src/openrouter.ts`. If these packages are ever imported from a client component (even transitively), the keys are exposed.

**Why it happens:**
Turborepo monorepos make it easy to import across package boundaries. Next.js server/client boundary is enforced by convention (the `'use server'` directive), not by the build system. A single missing `'use server'` or a shared barrel export can leak server-only code.

**How to avoid:**
1. Add `import 'server-only'` at the top of `packages/ai/src/index.ts` (or each server-only file) -- Next.js will throw a build error if any client component imports it
2. Verify env vars: `SUPABASE_SERVICE_ROLE_KEY` and `OPENROUTER_API_KEY` must NOT have `NEXT_PUBLIC_` prefix
3. After building, search the `.next/` output for the key values: `grep -r "SUPABASE_SERVICE_ROLE" .next/static/` should return nothing
4. Configure `next.config.js` `serverExternalPackages` to include `@mpstats/ai` if needed

**Warning signs:**
- Browser Network tab shows API keys in request headers
- Build warning about importing server-only module in client component
- `SUPABASE_SERVICE_ROLE_KEY` appears in `.next/static/chunks/`

**Phase to address:**
Phase 3 (Pre-deployment hardening) -- add `server-only` import before deploying.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `globalThis` mock storage | Fast prototyping, persists across hot reloads | Data loss on restart, no multi-process support, blocks PM2 cluster mode | Sprint 0-2 only; must migrate before production |
| `publicProcedure` on AI routes | Skip SSR cookie debugging | Unbounded API costs, security hole | Never in production |
| `dangerouslySetInnerHTML` for markdown | Quick rendering of AI-generated markdown | XSS vulnerability if AI output contains `<script>` tags | Only if sanitized with DOMPurify or similar; current code does NOT sanitize |
| Hardcoded mock lesson IDs in progress | No DB dependency for progress display | Impossible to show real progress for 80+ lessons | Sprint 0-2 only |
| In-memory summary cache (ai.ts) | No DB table needed | Lost on restart, no cross-process sharing, no persistence | MVP only; migrate to `SummaryCache` Prisma model before production |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Kinescope iframe | Using `lesson.videoId = 'demo1'` placeholder IDs that return Kinescope 404 page silently (no error, just blank) | Validate videoIds before deployment; add `onError` handler via Kinescope JS SDK postMessage API; show explicit "video not found" state |
| Supabase RPC `match_chunks` | Calling with `filter_lesson_prefix = null` returns ALL chunks across ALL lessons, causing slow queries and high token usage | Always pass lesson prefix when in lesson context; add a reasonable `match_count` limit (current default 5 is correct) |
| OpenRouter API | No retry/fallback logic when primary model (gemini-2.5-flash) is unavailable or rate-limited | Implement fallback chain: primary model -> fallback model -> cached response -> graceful error message. `openrouter.ts` defines `MODELS.fallback` but `generation.ts` never uses it |
| Prisma + Supabase | Running `db:push` on Supabase with `Unsupported("vector(1536)")` type can fail because Prisma does not natively manage pgvector columns | The `content_chunk` table already exists with data; use `db:push --accept-data-loss` cautiously or manage vector columns via raw SQL migrations only |
| PM2 + Next.js | Running `pm2 start "next start"` which spawns a shell subprocess that PM2 cannot properly signal | Use `pm2 start .next/standalone/server.js` directly; or use ecosystem config with `interpreter: 'node'` and `script: 'node_modules/.bin/next'` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all chunks for lesson summary | `generateLessonSummary` calls `getChunksForLesson()` which fetches ALL chunks. Some lessons may have 100+ chunks (a 60-min video = ~60-120 chunks). Sending all to LLM exceeds context window and costs a lot | Limit to first 20-30 chunks for summary, or use summarize-then-combine approach. Check `token_count` column to stay under model context limit | Lessons with >50 chunks (long videos) |
| No pagination on learning path endpoint | `getPath` returns ALL lessons for ALL courses in one query. With 80+ lessons, this is fine. But adding progress relations makes it N+1 | Add cursor pagination or load by course. For 80 lessons this is acceptable; flag for 500+ | >200 lessons |
| Chat history grows unbounded | `history.slice(-10)` in generation.ts is good, but the frontend `chatMessages` state accumulates indefinitely within the session | Add max history display limit in frontend; consider persisting to `ChatMessage` Prisma model to enable history recovery | Long chat sessions (>30 messages) |
| Embedding API called per chat message | Each `chat` call triggers `embedQuery()` which calls OpenAI embeddings API. No client-side debouncing or server-side deduplication | Add input debouncing (300ms) on chat input; consider caching embeddings for repeated/similar queries | High chat volume (>20 msg/hour per user) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `dangerouslySetInnerHTML` on AI-generated content without sanitization | XSS: if AI response contains `<img onerror=...>` or `<script>`, it executes in user's browser. Current `formatContent()` in lesson page uses regex-based markdown-to-HTML which does NOT strip malicious tags | Use DOMPurify or `sanitize-html` before rendering. Or use a proper markdown renderer (react-markdown) instead of regex + dangerouslySetInnerHTML |
| Service Role key in `retrieval.ts` bypasses ALL Supabase RLS | If `retrieval.ts` is ever misused or the service role key leaks, attacker has full DB access (read/write/delete all tables) | Use anon key + RLS policies for read operations where possible. Reserve service role for admin operations only. Consider creating a Supabase database function with SECURITY DEFINER that only exposes `match_chunks` |
| No rate limiting on tRPC endpoints | DDoS, API cost explosion, Supabase connection pool exhaustion | Implement per-user rate limiting in tRPC middleware. PRD specifies limits (100 req/min general, 50 LLM/hour, 20 chat/hour). Use `@upstash/ratelimit` or in-memory token bucket |
| `correctIndex` sent to client then hidden with `-1` | Security by obscurity: `correctIndex: -1` in `getSessionState`. The real answers live in server memory, but if someone modifies the mock to leak, all answers are exposed | When migrating to DB, never include `correctIndex` in the select query for session state. Only resolve it server-side in `submitAnswer` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Kinescope iframe shows blank box when videoId is invalid | User sees empty black rectangle with no explanation, thinks the page is broken | Check if `lesson.videoId` starts with 'demo' (placeholder). If so, show "Video coming soon" card instead of iframe. Add Kinescope postMessage error listener |
| AI summary takes 5-15s to generate on first load | User sees spinner for a long time, may navigate away | Pregenerate summaries during content ingestion (batch job). Cache in `SummaryCache` DB table. Show skeleton + "generating first time..." message with estimated time |
| Diagnostic session has no save/resume | If user closes browser mid-diagnostic (question 8/15), they lose all progress. `mockSessions` Map has no persistence | When migrating to DB, save answers incrementally (each `submitAnswer` persists). Add "Resume session" option on diagnostic intro page |
| Chat history lost on page navigation | Navigating to another lesson and back clears `chatMessages` state (React state, not persisted) | Persist chat to `ChatMessage` Prisma model. Load history on page mount. This model already exists in schema but is never used |

## "Looks Done But Isn't" Checklist

- [ ] **Course/Lesson DB tables:** Schema exists in Prisma but tables are not synced to Supabase (`db:push` not run for Course/Lesson models). Verify with `prisma db pull` that tables actually exist
- [ ] **AI fallback model:** `MODELS.fallback` is defined but never called in `generation.ts`. If primary model fails, the entire AI feature crashes. Verify fallback chain is implemented
- [ ] **Rate limiting:** PRD specifies 3 rate limit tiers (100/min, 50/hour LLM, 20/hour chat). Zero implementation exists. Verify middleware is added before deploy
- [ ] **Error boundaries:** No React Error Boundary components wrap the diagnostic session, lesson page, or chat. A single failed tRPC call crashes the entire page. Verify `ErrorBoundary` wraps each major feature
- [ ] **ChatMessage persistence:** Prisma model `ChatMessage` exists in schema but no code reads/writes to it. Chat messages are client-state only. Verify DB persistence is wired up
- [ ] **SummaryCache persistence:** Prisma model `SummaryCache` exists but is unused. In-memory `Map` is used instead. Verify DB-backed cache before deploy
- [ ] **Lesson-to-SkillCategory mapping:** Real data has 6 course prefixes (01-06) but SkillCategory enum has only 5 values. Courses 03_ai, 05_ozon, 06_express have no category mapping. Verify mapping or extend enum
- [ ] **UserProfile creation:** Auth is Supabase, but `UserProfile` Prisma model requires a row to exist before any `protectedProcedure` that joins on userId. No auto-creation hook exists. Verify profile is created on first login

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Mock shape mismatch (Pitfall 1) | MEDIUM | Create adapter layer (`toDTO` functions), update shared types, fix failing tests |
| Partial mock migration (Pitfall 2) | HIGH | Roll back to full-mock, plan migration order, re-migrate atomically with tests |
| publicProcedure in prod (Pitfall 3) | LOW (if caught quickly) | Hotfix: switch to `protectedProcedure`, deploy. Check OpenRouter usage for abuse |
| Missing standalone build (Pitfall 4) | LOW | Add `output: 'standalone'` to next.config, rebuild, redeploy |
| Bad AI questions (Pitfall 5) | MEDIUM | Switch to fallback mock questions, implement validation pipeline, regenerate question bank |
| Service key leak (Pitfall 6) | HIGH | Rotate Supabase service role key immediately, audit DB for unauthorized changes, add `server-only` import |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Mock shape mismatch | Phase 1: Mock-to-DB migration | TypeScript compiles with no `any` casts; integration tests pass |
| Partial mock migration | Phase 1: Mock-to-DB migration | All tRPC endpoints return data from Prisma, no `globalThis` references remain |
| publicProcedure exposure | Phase 3: Pre-deploy hardening | `grep "publicProcedure" packages/api/src/routers/ai.ts` returns 0 matches |
| Missing standalone build | Phase 4: VPS deployment | `ls .next/standalone/server.js` exists; PM2 process stays up for >1 hour |
| AI question quality | Phase 2: AI question generation | 100 generated questions pass Zod schema validation; manual review of 10 random questions |
| Service key leak | Phase 3: Pre-deploy hardening | `grep -r "SUPABASE_SERVICE_ROLE" .next/static/` returns nothing |
| XSS via dangerouslySetInnerHTML | Phase 3: Pre-deploy hardening | AI response containing `<script>alert(1)</script>` renders as escaped text |
| Missing rate limiting | Phase 3: Pre-deploy hardening | Sending 200 requests in 1 minute returns 429 after 100th |
| Supabase free tier pause | Phase 4: VPS deployment | Keep-alive cron runs on VPS (not just GitHub Actions); verify with `supabase status` |

## Sources

- Codebase analysis: `packages/api/src/routers/diagnostic.ts`, `learning.ts`, `ai.ts` (in-memory state patterns)
- Codebase analysis: `packages/ai/src/generation.ts`, `retrieval.ts`, `openrouter.ts` (AI pipeline)
- Codebase analysis: `packages/db/prisma/schema.prisma` (schema vs mock divergence)
- Codebase analysis: `apps/web/src/app/(main)/learn/[id]/page.tsx` (dangerouslySetInnerHTML, chat state)
- Codebase analysis: `packages/api/src/mocks/courses.ts` (mock data shapes, hardcoded IDs)
- Project documentation: `MAAL/CLAUDE.md` (known limitations, sprint progress, Supabase issues)
- Training data: Next.js standalone output, PM2 deployment patterns, Prisma binary targets (MEDIUM confidence)
- Training data: LLM question generation quality patterns (MEDIUM confidence)

---
*Pitfalls research for: MAAL educational platform -- mock-to-real migration, video, AI questions, VPS deploy*
*Researched: 2026-02-16*
