# Architecture Research

**Domain:** Educational platform integration milestone (mock-to-real data, video, AI diagnostics, VPS deploy)
**Researched:** 2026-02-16
**Confidence:** HIGH

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │
│  │Dashboard │  │Diagnostic│  │ Learning │  │ Profile/Settings │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘     │
│       │              │             │                  │               │
│  ┌────┴──────────────┴─────────────┴──────────────────┴──────────┐   │
│  │              tRPC Client (TanStack Query cache)                │   │
│  └───────────────────────────┬────────────────────────────────────┘   │
├──────────────────────────────┼───────────────────────────────────────┤
│                       API LAYER (tRPC)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ profile  │  │diagnostic│  │ learning │  │    ai    │             │
│  │ router   │  │ router   │  │ router   │  │  router  │             │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │              │             │              │                   │
│  ┌────┴──────────────┴─────────────┴──────┐ ┌────┴──────────────┐    │
│  │         Prisma Client (DB)             │ │  AI Package (RAG) │    │
│  └────────────────┬───────────────────────┘ └────┬──────────────┘    │
├───────────────────┼──────────────────────────────┼───────────────────┤
│                   │     DATA / SERVICES LAYER    │                   │
│  ┌────────────────┴────────────┐  ┌──────────────┴───────────────┐   │
│  │  Supabase PostgreSQL        │  │  External APIs               │   │
│  │  ├─ UserProfile             │  │  ├─ OpenRouter (LLM)         │   │
│  │  ├─ DiagnosticSession       │  │  ├─ OpenAI (Embeddings)      │   │
│  │  ├─ SkillProfile            │  │  ├─ Kinescope (Video)        │   │
│  │  ├─ Course / Lesson         │  │  └─ Supabase Auth            │   │
│  │  ├─ LearningPath            │  └──────────────────────────────┘   │
│  │  ├─ LessonProgress          │                                     │
│  │  ├─ ContentChunk (pgvector) │                                     │
│  │  └─ SummaryCache            │                                     │
│  └─────────────────────────────┘                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Next.js App Router** | SSR pages, middleware auth, route groups | tRPC client, Supabase SSR client |
| **tRPC Routers** (4 routers) | Type-safe API, auth middleware, business logic | Prisma, AI package, mock storage |
| **Prisma Client** | ORM queries, schema management, migrations | Supabase PostgreSQL |
| **AI Package** (`packages/ai/`) | Embedding, vector search, LLM generation | OpenRouter, OpenAI, Supabase RPC |
| **Mock Layer** (`packages/api/src/mocks/`) | Static courses/questions/dashboard data | Consumed by routers (to be replaced) |
| **In-Memory Storage** (`globalThis`) | Diagnostic sessions, progress, skill profiles | diagnostic/profile routers (to be replaced) |
| **Supabase Auth** | User registration, login, session cookies | Middleware, tRPC context |
| **Kinescope** | Video hosting, iframe player | Lesson pages (via videoUrl/videoId) |

## Current Architecture: What Needs to Change

### Migration Map: Mock to Real

The core integration challenge is replacing three layers of temporary data:

```
CURRENT (Mock)                          TARGET (Real)
─────────────────                       ─────────────────
1. Static course/lesson arrays          → Prisma queries to Course/Lesson tables
   (packages/api/src/mocks/courses.ts)

2. In-memory diagnostic sessions        → Prisma DiagnosticSession/DiagnosticAnswer
   (globalThis.mockStorage)               + SkillProfile persistence

3. Static mock questions                 → AI-generated questions from RAG chunks
   (packages/api/src/mocks/questions.ts)

4. Demo Kinescope videoIds               → Real videoId mapping per lesson
   ("demo1", "demo2", ...)

5. In-memory summary cache               → SummaryCache table (Prisma)
   (Map in ai router)

6. Mock dashboard stats                  → Computed from real progress data
   (packages/api/src/mocks/dashboard.ts)
```

### Component Boundaries for Integration

| Boundary | Current | Target | Interface Change |
|----------|---------|--------|------------------|
| `learning.getCourses()` | Reads `MOCK_COURSES` array | `ctx.prisma.course.findMany()` with includes | Return type unchanged (`CourseWithProgress[]`) |
| `learning.getLesson()` | Reads `MOCK_LESSONS` array | `ctx.prisma.lesson.findUnique()` with progress | Return type unchanged |
| `learning.updateProgress()` | Writes to in-memory Map | `ctx.prisma.lessonProgress.upsert()` | Return type unchanged |
| `diagnostic.startSession()` | Creates in-memory session | Choice: keep mock questions OR call AI generator | Return type unchanged, input source changes |
| `diagnostic.getResults()` | Reads in-memory, writes `globalThis` | `ctx.prisma.diagnosticSession` + `skillProfile.upsert()` | Return type unchanged |
| `profile.getDashboard()` | `getMockDashboardData()` | Aggregate from real tables | Return type unchanged |
| `ai.getLessonSummary()` | In-memory cache Map | `ctx.prisma.summaryCache.findUnique()` | Return type unchanged |
| Kinescope player | `videoUrl: "demo1"` | Real videoId from `lesson.videoId` column | No API change, data change only |

**Key insight:** tRPC router signatures stay the same. All integration happens inside router implementations. Frontend code requires zero changes for data migration.

## Data Flow: Integration Architecture

### Flow 1: Course/Lesson Data (Mock to DB)

```
BEFORE:
  learning.getCourses() → MOCK_COURSES array → hardcoded progress → response

AFTER:
  learning.getCourses()
    → ctx.prisma.course.findMany({
        include: {
          lessons: {
            include: {
              progress: { where: { path: { userId: ctx.user.id } } }
            }
          }
        },
        orderBy: { order: 'asc' }
      })
    → map to CourseWithProgress[] (same shape)
    → response
```

**Dependency:** Course and Lesson tables must be seeded first (`scripts/seed/`).

### Flow 2: Diagnostic Session Persistence

```
BEFORE:
  startSession() → mockSessions.set(id, {...}) → in-memory
  submitAnswer() → session.answers.push({...}) → in-memory
  getResults()   → calculate from in-memory → globalThis.latestSkillProfiles

AFTER:
  startSession()
    → ctx.prisma.diagnosticSession.create({ userId, status: 'IN_PROGRESS' })
    → generate questions (mock OR AI)
    → store questions in session metadata (JSON field or separate table)

  submitAnswer()
    → ctx.prisma.diagnosticAnswer.create({ sessionId, questionId, ... })
    → ctx.prisma.diagnosticSession.update({ currentQuestion: idx + 1 })

  getResults()
    → ctx.prisma.diagnosticAnswer.findMany({ where: { sessionId } })
    → calculate SkillProfile from answers
    → ctx.prisma.skillProfile.upsert({ where: { userId }, ... })
    → return DiagnosticResult (same shape)
```

**Critical decision:** Where to store generated questions per session. Options:
1. **JSON field on DiagnosticSession** (simplest, recommended for MVP)
2. **DiagnosticQuestion table** (normalized, better for analytics later)

Recommendation: JSON field. Questions are ephemeral per session, no cross-session queries needed.

### Flow 3: AI Question Generation

```
User clicks "Start Diagnostic"
    ↓
diagnostic.startSession()
    ↓
questionGenerator.generate({
    categories: ['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE'],
    perCategory: 3,
    difficulties: ['EASY', 'MEDIUM', 'HARD']
})
    ↓
For each category:
    1. searchChunks({ query: categoryPrompt, limit: 10, threshold: 0.3 })
    2. Build context from retrieved chunks
    3. LLM generates 3 questions with options + correct answer
    4. Validate structure (4 options, correctIndex 0-3, explanation)
    ↓
Return 15 questions → store in session → proceed
    ↓
FALLBACK: If LLM fails → use MOCK_QUESTIONS from questions.ts
```

**Architecture pattern:** `packages/ai/src/question-generator.ts` as new service file, following the same pattern as `generation.ts`. Called from `diagnostic.startSession()` in the API layer.

### Flow 4: Kinescope Video Mapping

```
Lesson in DB:
  { id: "01_analytics_m01_start_001", videoId: "abc123", videoUrl: null }

Lesson page renders:
  const { lesson } = trpc.learning.getLesson.useQuery({ lessonId });

  if (lesson.videoId) {
    <iframe src={`https://kinescope.io/embed/${lesson.videoId}`} />
  } else {
    <VideoPlaceholder message="Видео будет доступно скоро" />
  }
```

**No architectural change needed.** The `videoId` field already exists in the Prisma schema. Integration is purely a data operation: populate `videoId` values for each lesson row. This can be done via:
1. Seed script with mapping CSV/JSON
2. Admin API endpoint (future)
3. Direct SQL update

### Flow 5: Summary Cache Migration

```
BEFORE:
  const summaryCache = new Map<string, {...}>();  // In-memory, lost on restart

AFTER:
  // Check DB cache
  const cached = await ctx.prisma.summaryCache.findUnique({
    where: { lessonId }
  });

  if (cached && cached.expiresAt > new Date()) {
    return { content: cached.summary, fromCache: true };
  }

  // Generate and cache
  const result = await generateLessonSummary(lessonId);
  await ctx.prisma.summaryCache.upsert({
    where: { lessonId },
    update: { summary: result.content, expiresAt: addHours(new Date(), 24) },
    create: { lessonId, summary: result.content, expiresAt: addHours(new Date(), 24) }
  });
```

### Flow 6: VPS Production Deploy

```
Build Pipeline:
  Local/CI: pnpm build → .next/ output
    ↓
  SCP/rsync to VPS (79.137.197.90)
    ↓
  PM2 ecosystem.config.js:
    {
      name: "maal-web",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/home/deploy/maal",
      env: { NODE_ENV: "production", PORT: 3000 }
    }
    ↓
  Nginx reverse proxy:
    server {
      listen 443 ssl;
      server_name academy.mpstats.io;  // or custom domain
      location / { proxy_pass http://127.0.0.1:3000; }
    }
    ↓
  SSL: Let's Encrypt via certbot
```

**Architecture consideration:** Next.js standalone output mode (`output: 'standalone'` in next.config.js) reduces deployment size from ~500MB node_modules to ~50MB standalone folder.

## Architectural Patterns

### Pattern 1: Gradual Mock Replacement (Strangler Fig)

**What:** Replace mock data sources one router at a time, keeping the other routers functional with mocks.
**When:** During integration sprint, to avoid big-bang migration.
**Trade-offs:** Slower but safer. Each router can be tested independently.

```typescript
// Pattern: Try DB first, fall back to mock
export const learningRouter = router({
  getCourses: protectedProcedure.query(async ({ ctx }) => {
    try {
      const courses = await ctx.prisma.course.findMany({
        include: { lessons: true },
        orderBy: { order: 'asc' },
      });
      if (courses.length > 0) {
        return mapToCoursesWithProgress(courses, ctx.user.id);
      }
    } catch {
      // DB not seeded yet
    }
    // Fallback to mock
    return getMockCoursesWithProgress(ctx.user.id);
  }),
});
```

### Pattern 2: Service Isolation for AI Question Generation

**What:** New `question-generator.ts` in `packages/ai/src/` follows existing RAG pipeline pattern.
**When:** Sprint 5 Phase C.
**Trade-offs:** Adds LLM latency to diagnostic start (~3-5 seconds). Mitigated by fallback to mock questions.

```typescript
// packages/ai/src/question-generator.ts
export async function generateQuestions(options: {
  categories: SkillCategory[];
  perCategory: number;
}): Promise<DiagnosticQuestion[]> {
  const questions: DiagnosticQuestion[] = [];

  for (const category of options.categories) {
    // 1. Get relevant chunks for this category
    const chunks = await searchChunks({
      query: CATEGORY_PROMPTS[category],
      limit: 10,
      threshold: 0.3,
    });

    // 2. Generate questions via LLM
    const generated = await generateQuestionsFromContext(category, chunks);
    questions.push(...generated.slice(0, options.perCategory));
  }

  return questions;
}
```

### Pattern 3: Standalone Build for VPS

**What:** Use Next.js `output: 'standalone'` to create self-contained deployment artifact.
**When:** Sprint 4 deploy.
**Trade-offs:** Requires copying `public/` and `.next/static/` separately. But deployment is much lighter.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Migrating All Routers Simultaneously

**What people do:** Rewrite all 4 routers to use DB in one commit.
**Why it's wrong:** If Course seed data is wrong, all routers break at once. No rollback path.
**Do this instead:** Migrate one router at a time (learning first, then diagnostic, then profile). Keep mock fallbacks during transition.

### Anti-Pattern 2: AI Questions Without Fallback

**What people do:** Make `startSession()` fully dependent on LLM generation.
**Why it's wrong:** LLM can fail (rate limit, timeout, bad response). User stuck on "Starting diagnostic..." forever.
**Do this instead:** Always have mock questions as fallback. Set a 10-second timeout on AI generation. Log failures for monitoring.

### Anti-Pattern 3: Storing Questions in a Separate Table for MVP

**What people do:** Create `DiagnosticQuestion` table, normalize fully.
**Why it's wrong:** Over-engineering for MVP. Questions are generated per-session, not shared. Adds migration complexity.
**Do this instead:** Store generated questions as JSON on DiagnosticSession. Refactor to table only if cross-session question analytics is needed.

### Anti-Pattern 4: Running pnpm install on VPS

**What people do:** Clone repo on VPS, run `pnpm install`, build there.
**Why it's wrong:** VPS has limited RAM (build can OOM). Dependencies may fail on different OS. Slow deployments.
**Do this instead:** Build locally or in CI. Deploy only the standalone output + static files.

### Anti-Pattern 5: Hardcoding Kinescope videoIds in Code

**What people do:** Put videoId mapping in TypeScript constants or mock files.
**Why it's wrong:** Requires code deployment to change a video. Can not be managed by content team.
**Do this instead:** Store videoId in Lesson table (already in schema). Update via seed script or admin interface.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Supabase PostgreSQL** | Prisma ORM via connection pooler (port 6543) | Use `DIRECT_URL` for migrations only |
| **Supabase Auth** | SSR cookies via `@supabase/ssr` | Middleware validates, tRPC context injects user |
| **Supabase pgvector** | RPC function `match_chunks` | Called from `packages/ai/src/retrieval.ts` |
| **OpenRouter** | OpenAI SDK with custom baseURL | Primary: gemini-2.5-flash, Fallback: gpt-4o-mini |
| **OpenAI Embeddings** | Via OpenRouter proxy | text-embedding-3-small, 1536 dims |
| **Kinescope** | iframe embed `https://kinescope.io/embed/{videoId}` | No API needed for MVP, just embed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend to API | tRPC (HTTP, SuperJSON serialized) | Type-safe, no manual fetch calls |
| API to Database | Prisma Client (SQL over connection pool) | Singleton, injected via context |
| API to AI | Direct function import from `@mpstats/ai` | Same process, no network hop |
| AI to Supabase | `@supabase/supabase-js` client (HTTP REST + RPC) | Uses Service Role Key (bypasses RLS) |
| AI to OpenRouter | OpenAI SDK (HTTPS) | API key in env var |

## Build Order: Dependency Chain

```
Phase A: Database Foundation (no frontend changes)
  1. Seed Course + Lesson tables → prerequisite for everything
  2. Verify Prisma client generates correctly with new data
  │
  ↓
Phase B: Learning Router Migration (safest first)
  3. Replace MOCK_COURSES/MOCK_LESSONS with Prisma queries
  4. Replace in-memory progress with LessonProgress table
  5. Frontend works unchanged (same tRPC return types)
  │
  ↓
Phase C: Kinescope Integration (data-only, no code)
  6. Populate videoId column in Lesson table
  7. Update lesson page to handle missing videoId gracefully
  │
  ↓
Phase D: Diagnostic Persistence (medium complexity)
  8. Migrate DiagnosticSession to Prisma (create/update/query)
  9. Migrate DiagnosticAnswer to Prisma
  10. Persist SkillProfile on session completion
  11. Remove globalThis.mockStorage
  │
  ↓
Phase E: AI Question Generation (highest risk)
  12. Create question-generator.ts in packages/ai/
  13. Integrate into diagnostic.startSession() with fallback
  14. Test generation quality, add retry logic
  │
  ↓
Phase F: Profile/Dashboard Real Data (depends on B+D)
  15. Compute dashboard stats from real progress + sessions
  16. Remove MOCK_USER_STATS, MOCK_RECENT_ACTIVITY
  │
  ↓
Phase G: Cache Migration (low priority)
  17. Move summary cache from Map to SummaryCache table
  18. Switch AI router endpoints back to protectedProcedure
  │
  ↓
Phase H: VPS Deploy (depends on all above)
  19. Configure next.config.js standalone output
  20. Set up PM2 ecosystem config
  21. Configure Nginx + SSL
  22. Set env vars on server
  23. Deploy and smoke test
```

**Critical path:** A → B → D → F (learning data needed for dashboard stats, diagnostic persistence needed for profile).

**Parallel tracks:** C (Kinescope) can run in parallel with B/D. E (AI questions) can run in parallel with F. G can run anytime.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users | Current architecture is sufficient. Single Next.js process on VPS. Supabase free tier handles load. |
| 100-1k users | Move Supabase to Pro tier (no auto-pause). Add PM2 cluster mode (2-4 workers). Consider Redis for summary cache instead of DB. |
| 1k-10k users | Supabase connection pooling becomes important (pgbouncer). Rate limiting on AI endpoints is mandatory. Consider edge caching for static lesson data. |

### First bottleneck: LLM API rate limits
AI question generation and RAG chat will hit OpenRouter/provider limits first. Mitigation: aggressive caching (summary cache), question pool pre-generation, rate limiting per user.

### Second bottleneck: Supabase free tier limits
Connection limits and potential pausing. Mitigation: upgrade to Pro tier before production launch.

## Sources

- Codebase analysis: `packages/api/src/routers/*.ts`, `packages/ai/src/*.ts`, `packages/db/prisma/schema.prisma`
- Existing architecture doc: `.planning/codebase/ARCHITECTURE.md`
- Existing integrations doc: `.planning/codebase/INTEGRATIONS.md`
- CLAUDE.md project instructions (Sprint 5 plan, current status)
- Prisma schema: 12 models defined, Course/Lesson/ContentChunk ready
- Next.js App Router: standard patterns, no custom deviations

---
*Architecture research for: MAAL integration milestone*
*Researched: 2026-02-16*
