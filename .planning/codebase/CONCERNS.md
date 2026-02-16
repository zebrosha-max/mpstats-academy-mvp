# Codebase Concerns

**Analysis Date:** 2026-02-16

## Tech Debt

**In-Memory Mock Data Storage:**
- Issue: Diagnostic sessions and skill profiles stored in `globalThis` instead of database
- Files: `packages/api/src/routers/diagnostic.ts` (lines 56-94), `packages/api/src/routers/profile.ts`
- Impact: Data lost on server restart, not suitable for production, no persistence across deployments
- Fix approach: Migrate to Prisma models (DiagnosticSession, SkillProfile already defined in schema), implement DB queries replacing mock storage

**Auth Protection Temporarily Disabled:**
- Issue: AI router endpoints using `publicProcedure` instead of `protectedProcedure` due to Supabase SSR cookie issues
- Files: `packages/api/src/routers/ai.ts` (lines 44, 92, 123)
- Impact: Any user can access RAG endpoints without authentication, potential abuse of LLM API quota
- Fix approach: Fix Supabase SSR cookie handling in tRPC context, switch back to protectedProcedure

**Large Hardcoded Mock Data Files:**
- Issue: 350+ line mock question bank, 380+ line mock courses/lessons hardcoded in source
- Files: `packages/api/src/mocks/questions.ts` (350 lines), `packages/api/src/mocks/courses.ts` (381 lines)
- Impact: Code bloat, difficult to maintain, duplicates data that should be in database
- Fix approach: Move to database seed scripts, fetch from Supabase in Sprint 4

**Console Logging in Production Code:**
- Issue: 25+ console.log/error statements scattered across codebase
- Files: `apps/web/src/app/auth/callback/route.ts` (lines 10-20), `packages/api/src/routers/ai.ts` (line 52), `apps/web/src/lib/auth/actions.ts` (lines 41, 66, 91, 127, 153), `packages/ai/src/retrieval.ts` (lines 57, 80)
- Impact: Performance overhead, sensitive data leakage in logs, noise in production
- Fix approach: Replace with proper logging library (pino/winston), remove debug logs, add log levels

**Missing Database Migration Strategy:**
- Issue: Using `db:push` instead of `db:migrate` for schema changes
- Files: Prisma schema changes applied directly without tracked migrations
- Impact: No rollback capability, schema drift risk between environments, production deployment fragility
- Fix approach: Switch to `prisma migrate dev`, create baseline migration, document migration workflow

**Incomplete Error Handling:**
- Issue: Generic `throw new Error()` without error codes or proper error types
- Files: `packages/api/src/routers/diagnostic.ts` (lines 201, 206), `packages/ai/src/retrieval.ts` (lines 58, 81), `packages/ai/src/embeddings.ts` (line 21)
- Impact: Difficult to debug, poor user experience, no error tracking/monitoring
- Fix approach: Create custom error classes, add error codes, implement proper tRPC error handling with TRPCError

**No Database Schema Synchronization:**
- Issue: Prisma schema defines Course/Lesson models but they're not seeded, relying on mock data
- Files: `packages/db/prisma/schema.prisma` (Course/Lesson models), `packages/api/src/mocks/courses.ts` (mock data used instead)
- Impact: RAG content exists in `content_chunk` table but no Course/Lesson records to join against, schema-data mismatch
- Fix approach: Run `scripts/seed/seed-from-manifest.ts` to populate Course/Lesson tables from manifest.json

## Known Bugs

**Supabase Free Tier Hibernation:**
- Symptoms: Database returns Error 521 (Web server is down) after 7 days of inactivity
- Files: `.github/workflows/supabase-keepalive.yml` (mitigation), `apps/web/src/middleware.ts` (fails silently)
- Trigger: 7+ days without database activity on free tier
- Workaround: GitHub Action pings every 3 days, manual restore via Supabase Dashboard if needed

**Google OAuth Callback Debugs Not Removed:**
- Symptoms: Auth callback logs sensitive data (ANON_KEY, user email) to console
- Files: `apps/web/src/app/auth/callback/route.ts` (lines 10-20)
- Trigger: Every OAuth login attempt
- Workaround: Remove console.logs before production deploy

**Large Lesson Page Component:**
- Symptoms: 493-line React component with multiple responsibilities
- Files: `apps/web/src/app/(main)/learn/[id]/page.tsx`
- Trigger: Editing lesson page becomes difficult, hard to test
- Workaround: Extract video player, summary panel, chat panel into separate components

**Missing Kinescope Video IDs:**
- Symptoms: Video player renders empty iframe, no actual videos
- Files: `apps/web/src/app/(main)/learn/[id]/page.tsx` (videoUrl rendering)
- Trigger: Opening any lesson detail page
- Workaround: Populate `videoId` field in Lesson records once Kinescope integration configured

## Security Considerations

**API Keys in Codebase:**
- Risk: `.env` file checked into git history (even if gitignored now)
- Files: `.env`, `.env.example` (template only, safe)
- Current mitigation: .gitignore prevents future commits
- Recommendations: Rotate all API keys, use Vercel/VPS environment variables in production, add pre-commit hook to prevent secret leaks

**Unvalidated LLM Input:**
- Risk: User chat messages sent directly to LLM without sanitization or length limits (2000 char max in schema but no content validation)
- Files: `packages/api/src/routers/ai.ts` (chat endpoint), `packages/ai/src/generation.ts`
- Current mitigation: Zod validation for length only
- Recommendations: Add input sanitization, content moderation checks, rate limiting per user

**Missing CSRF Protection:**
- Risk: tRPC endpoints have no CSRF tokens, relying only on Supabase session cookies
- Files: `apps/web/src/app/api/trpc/[trpc]/route.ts`
- Current mitigation: Supabase auth cookies are httpOnly
- Recommendations: Enable Next.js built-in CSRF protection, add origin validation

**No Rate Limiting on AI Endpoints:**
- Risk: User can spam RAG chat/summary endpoints, drain OpenRouter quota
- Files: `packages/api/src/routers/ai.ts` (all endpoints)
- Current mitigation: None (auth temporarily disabled makes this worse)
- Recommendations: Implement rate limiting (20 requests/hour per user per lesson as documented in CLAUDE.md), add queue system for LLM requests

**Exposed Database Structure:**
- Risk: Prisma schema includes commented database URLs with connection strings format
- Files: `packages/db/prisma/schema.prisma`, `.env.example`
- Current mitigation: Actual credentials in .env (gitignored)
- Recommendations: Ensure no real credentials ever committed, use secrets scanning in CI

## Performance Bottlenecks

**RAG Summary Generation on Every Request:**
- Problem: Lesson summaries regenerated on each view until cached (can take 3-5 seconds)
- Files: `packages/api/src/routers/ai.ts` (getLessonSummary), `packages/ai/src/generation.ts`
- Cause: In-memory cache lost on server restart, no persistent cache
- Improvement path: Implement persistent cache in `SummaryCache` table (already defined in schema), pre-generate summaries for popular lessons during seed

**Vector Search Without Index Optimization:**
- Problem: pgvector search may be slow without proper index configuration
- Files: `scripts/sql/match_chunks.sql` (RPC function), `packages/db/prisma/schema.prisma` (ContentChunk model)
- Cause: HNSW index exists but may need tuning (ef_search, m parameters)
- Improvement path: Benchmark vector search, tune HNSW parameters, add ivfflat index for larger datasets

**No Query Result Caching:**
- Problem: tRPC queries refetch on every navigation, no React Query cache configuration
- Files: `apps/web/src/lib/trpc/client.tsx`, all page components using trpc.*.useQuery
- Cause: Default React Query settings, no staleTime/cacheTime configured
- Improvement path: Configure React Query defaults (staleTime: 5 minutes for static content), add query key invalidation strategy

**Large Mock Data Loading:**
- Problem: 350+ mock questions loaded into memory on every cold start
- Files: `packages/api/src/mocks/questions.ts` (all questions array)
- Cause: Imported at module level, not lazy-loaded
- Improvement path: Move to database, lazy-load mock data only in development

**N+1 Query Pattern in Diagnostic Results:**
- Problem: Session results fetch questions individually instead of batch
- Files: `packages/api/src/routers/diagnostic.ts` (getResults query, lines 233-333)
- Cause: Looping through session.questions to find metadata
- Improvement path: Use Prisma `include` to fetch related data in single query when migrated to DB

## Fragile Areas

**Supabase SSR Cookie Handling:**
- Files: `apps/web/src/middleware.ts`, `apps/web/src/lib/supabase/server.ts`, `apps/web/src/app/api/trpc/[trpc]/route.ts`
- Why fragile: Multiple cookie handling implementations, easy to desync between middleware and API routes
- Safe modification: Always use same Supabase SSR client creation pattern, test auth flow after changes
- Test coverage: Manual testing only, no automated auth tests

**tRPC Context Construction:**
- Files: `apps/web/src/app/api/trpc/[trpc]/route.ts` (createContext), `packages/api/src/trpc.ts` (protectedProcedure)
- Why fragile: User object manually constructed from Supabase session, can break if session shape changes
- Safe modification: Add TypeScript strict checks, add integration tests for protected procedures
- Test coverage: None

**Mock Session State Management:**
- Files: `packages/api/src/routers/diagnostic.ts` (globalThis.mockStorage)
- Why fragile: Global state, no race condition protection, can break with concurrent requests
- Safe modification: Lock when writing, or migrate to database immediately
- Test coverage: None

**Manual Chunk Citation Parsing:**
- Files: `packages/ai/src/generation.ts` (extracting [1], [2] from LLM response)
- Why fragile: Relies on LLM output format consistency, regex parsing can fail
- Safe modification: Use structured output (JSON mode), fallback to no citations if parsing fails
- Test coverage: None

**Environment Variable Loading:**
- Files: All components using `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`, OpenRouter client initialization
- Why fragile: No validation that required env vars exist before runtime
- Safe modification: Add startup validation script, fail fast if missing critical env vars
- Test coverage: None

## Scaling Limits

**In-Memory Summary Cache:**
- Current capacity: Limited by Node.js heap (default ~4GB)
- Limit: ~10,000 summaries before memory pressure (assuming 50KB each)
- Scaling path: Move to Redis cache or database SummaryCache table, add TTL-based eviction

**OpenRouter API Quota:**
- Current capacity: Free/paid tier limits unknown
- Limit: 50 LLM requests/hour documented, but not enforced in code
- Scaling path: Implement request queue with rate limiting, add fallback model, cache aggressively

**Supabase Free Tier Limits:**
- Current capacity: 500MB database, 2GB bandwidth/month, 50,000 monthly active users
- Limit: 5,291 content chunks already in DB, limited space for user data growth
- Scaling path: Migrate to Supabase Pro ($25/month) or self-hosted Postgres + pgvector

**Single-Region Deployment:**
- Current capacity: All services in one region (Supabase EU, VPS Ukraine)
- Limit: High latency for users outside Europe, no failover
- Scaling path: Add CDN (Cloudflare), consider multi-region Supabase replication, deploy to Vercel edge

**Monolithic Next.js Application:**
- Current capacity: All features in one Next.js app, single deployment unit
- Limit: Difficult to scale individual features, long build times as codebase grows
- Scaling path: Extract RAG service as separate API microservice, use Turborepo remote caching

## Dependencies at Risk

**Supabase SSR (@supabase/ssr@0.5.2):**
- Risk: Frequent breaking changes in SSR package, cookie handling bugs
- Impact: Auth breaks, middleware needs rewrite
- Migration plan: Pin version, test thoroughly before upgrading, consider moving to stable auth solution (NextAuth.js)

**Prisma 5.x with pgvector:**
- Risk: pgvector support still in preview features, may change in Prisma 6
- Impact: Schema changes, migration rewrite needed
- Migration plan: Monitor Prisma changelog, test migrations in staging before upgrading

**OpenRouter API:**
- Risk: Third-party service, uptime not guaranteed, pricing changes
- Impact: RAG features break if OpenRouter down
- Migration plan: Add direct OpenAI/Anthropic fallback, implement circuit breaker pattern

**Next.js 14 App Router:**
- Risk: App Router still evolving, some features unstable (server actions, parallel routes)
- Impact: Breaking changes in minor versions
- Migration plan: Pin to 14.2.x, avoid experimental features, migrate to 15.x only when stable

## Missing Critical Features

**User Session Persistence:**
- Problem: Diagnostic sessions lost on server restart due to in-memory storage
- Blocks: Production deployment, multi-user testing
- Priority: High

**LLM Rate Limiting:**
- Problem: No protection against quota exhaustion
- Blocks: Safe public launch
- Priority: High

**Error Monitoring:**
- Problem: No Sentry/logging infrastructure for production errors
- Blocks: Debugging production issues
- Priority: Medium

**Database Backups:**
- Problem: No automated backup strategy for Supabase data
- Blocks: Data recovery if corruption occurs
- Priority: Medium

**Content Moderation:**
- Problem: No filtering of inappropriate user chat messages
- Blocks: Safe user-generated content
- Priority: Medium

**Real-Time Features:**
- Problem: No WebSocket/SSE for live diagnostic progress or chat streaming
- Blocks: Better UX for long-running LLM responses
- Priority: Low

## Test Coverage Gaps

**Auth Flow:**
- What's not tested: Login, register, OAuth callback, session refresh, logout
- Files: `apps/web/src/lib/auth/actions.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/auth/callback/route.ts`
- Risk: Auth breaks unnoticed, security vulnerabilities
- Priority: High

**tRPC Procedures:**
- What's not tested: All routers (diagnostic, learning, profile, ai)
- Files: `packages/api/src/routers/*.ts`
- Risk: Business logic bugs, data corruption
- Priority: High

**RAG Pipeline:**
- What's not tested: Embedding generation, vector search, LLM generation, citation extraction
- Files: `packages/ai/src/*.ts`
- Risk: RAG quality degradation, hallucinations increase
- Priority: High

**Diagnostic Algorithm:**
- What's not tested: Skill score calculation, gap analysis, recommended path generation
- Files: `packages/api/src/routers/diagnostic.ts` (lines 27-54, 236-270)
- Risk: Wrong recommendations, inaccurate skill profiles
- Priority: High

**Error Handling:**
- What's not tested: Network failures, database timeouts, LLM errors, malformed responses
- Files: All API endpoints, all UI components
- Risk: Poor error UX, unhandled exceptions
- Priority: Medium

**Responsive Design:**
- What's not tested: Mobile layouts, tablet breakpoints, touch interactions
- Files: All page components, all UI components
- Risk: Broken UI on mobile devices
- Priority: Medium

**Accessibility:**
- What's not tested: Keyboard navigation, screen readers, ARIA labels, color contrast
- Files: All UI components
- Risk: Inaccessible to users with disabilities
- Priority: Medium

**Performance:**
- What's not tested: Page load times, LLM response times, vector search latency
- Files: N/A (needs performance testing suite)
- Risk: Slow UX, poor user retention
- Priority: Low

---

*Concerns audit: 2026-02-16*
