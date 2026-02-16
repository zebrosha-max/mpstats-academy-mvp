# Phase 1: Data Foundation - Research

**Researched:** 2026-02-16
**Domain:** Prisma ORM migration, tRPC router refactoring, Supabase PostgreSQL
**Confidence:** HIGH

## Summary

Phase 1 migrates the MAAL application from in-memory mock data (`globalThis` Maps, hardcoded arrays) to persistent Supabase PostgreSQL storage via Prisma ORM. Three tRPC routers (learning, diagnostic, profile) must be rewritten to use Prisma queries instead of mock imports. A seed script must populate Course/Lesson tables from an existing `manifest.json` (405 lessons across 6 courses) with AI-based SkillCategory classification at the lesson level.

The codebase is well-structured for this migration: Prisma schema already defines all required models (Course, Lesson, DiagnosticSession, DiagnosticAnswer, SkillProfile, LearningPath, LessonProgress), the `@mpstats/db` package exports a singleton PrismaClient, and the tRPC context already passes `ctx.prisma`. The main work is replacing mock data sources in router files and building a robust seed script.

**Primary recommendation:** Migrate routers sequentially (Learning -> Diagnostic -> Profile) because Profile depends on data written by Diagnostic. Use Prisma `upsert` for seed idempotency. No mock fallback on DB errors -- show explicit error UI with Supabase-specific messaging for Error 521 (paused project).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mapping SkillCategory goes **at lesson level**, not course level. One course contains lessons from different SkillCategory
- Mapping lesson -> SkillCategory determined via **AI-classification** -- LLM analyzes content chunks and assigns category
- Seed script must be **idempotent** (upsert logic, safe re-run)
- Course metadata (names, descriptions): investigate what is available in existing content_chunk data
- **No mock fallback** -- if Supabase unavailable, show error, don't substitute mock data
- Supabase free tier pause (Error 521) -- **special message** with admin instructions ("Database paused, restore via dashboard")
- Generic DB errors -- graceful error page
- API can change -- frontend updates together with backend, no backward compatibility required
- Basic metrics (like in mock): skill profile, lesson progress, last diagnostic
- **Additionally:** skill dynamics (change between diagnostics) + activity streak (consecutive days)

### Claude's Discretion
- Mapping 6 courses to 5 SkillCategory (or extending enum) -- Claude determines optimal approach during research
- One primary SkillCategory per lesson vs primary + secondary -- Claude chooses based on AI-classification results
- Seed script format (from RAG chunks vs JSON)
- Migration strategy (phased or big bang)
- Fate of mock data after migration (delete vs keep)
- DTO layer (Prisma directly vs mapping) -- Claude chooses for MVP
- Auth behavior when DB unavailable
- Fallback UI (per-component vs error page)
- Dashboard empty state for new users
- Radar chart: last diagnostic vs overlay of two

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma Client | ^5.22.0 | ORM for PostgreSQL queries | Already installed in `@mpstats/db`, schema defined |
| @supabase/supabase-js | existing | Direct Supabase queries (for content_chunk) | Already used in `packages/ai/src/retrieval.ts` |
| tRPC | 11.x | API layer | Already configured, routers exist |
| Zod | existing | Input validation | Already used in all routers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | existing (dev) | Run TypeScript seed scripts | `npx tsx scripts/seed/*.ts` |
| OpenAI SDK (via OpenRouter) | existing | AI-classification of lessons | Seed script for SkillCategory assignment |

### No New Dependencies Needed
This phase requires zero new npm packages. Everything is already installed.

**Installation:**
```bash
# Nothing to install -- all dependencies exist
pnpm db:generate  # Regenerate Prisma client if schema changed
```

## Architecture Patterns

### Recommended Migration Structure
```
packages/api/src/
├── routers/
│   ├── learning.ts      # Rewrite: Prisma queries instead of MOCK_COURSES/MOCK_LESSONS
│   ├── diagnostic.ts    # Rewrite: Prisma instead of globalThis Maps
│   ├── profile.ts       # Rewrite: Prisma queries for dashboard data
│   └── ai.ts            # No changes (already uses Supabase directly)
├── mocks/               # Keep for reference, but no longer imported by routers
│   ├── courses.ts       # DEPRECATED after migration
│   ├── dashboard.ts     # DEPRECATED after migration
│   └── questions.ts     # STILL USED -- diagnostic questions remain mock until Phase C (AI generation)
└── trpc.ts              # No changes -- ctx.prisma already available

scripts/seed/
├── seed-from-manifest.ts  # EXISTS -- needs update for lesson-level SkillCategory
└── seed-skill-categories.ts  # NEW -- AI-classification of lessons via content_chunk

packages/shared/src/types/index.ts  # May need UserStats updates for streak
```

### Pattern 1: Prisma-First Router (replaces mock)
**What:** Each tRPC procedure queries Prisma directly, no intermediate mock layer
**When to use:** All three routers being migrated
**Example:**
```typescript
// Source: Prisma docs + existing codebase pattern
// BEFORE (mock):
getCourses: protectedProcedure.query(async ({ ctx }) => {
  return getMockCoursesWithProgress(ctx.user.id);
}),

// AFTER (Prisma):
getCourses: protectedProcedure.query(async ({ ctx }) => {
  const courses = await ctx.prisma.course.findMany({
    include: {
      lessons: {
        orderBy: { order: 'asc' },
        include: {
          progress: {
            where: { path: { userId: ctx.user.id } },
          },
        },
      },
    },
    orderBy: { order: 'asc' },
  });
  // Transform to CourseWithProgress shape
  return courses.map(course => ({
    ...course,
    completedLessons: course.lessons.filter(l =>
      l.progress.some(p => p.status === 'COMPLETED')
    ).length,
    totalLessons: course.lessons.length,
    progressPercent: /* calculate */,
    lessons: course.lessons.map(l => ({
      ...l,
      status: l.progress[0]?.status || 'NOT_STARTED',
      watchedPercent: l.progress[0]?.watchedPercent || 0,
    })),
  }));
}),
```

### Pattern 2: UserProfile Auto-Creation
**What:** Create UserProfile on first API call if it doesn't exist (Supabase auth creates auth.users, but UserProfile needs explicit creation)
**When to use:** Any protectedProcedure that needs UserProfile
**Example:**
```typescript
// Middleware or helper to ensure UserProfile exists
async function ensureUserProfile(prisma: PrismaClient, user: User) {
  return prisma.userProfile.upsert({
    where: { id: user.id },
    update: { /* touch updatedAt */ },
    create: {
      id: user.id,
      name: user.email?.split('@')[0] || null,
    },
  });
}
```

### Pattern 3: Error Handling Without Mock Fallback
**What:** Catch Prisma/Supabase errors, throw typed tRPC errors
**When to use:** Every database operation
**Example:**
```typescript
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';

// In router procedure:
try {
  const result = await ctx.prisma.course.findMany({ ... });
  return result;
} catch (error) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'DATABASE_UNAVAILABLE',
      cause: error,
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unexpected database error',
    cause: error,
  });
}
```

### Pattern 4: Idempotent Seed with Upsert
**What:** Use Prisma `upsert` for all seed operations -- safe to re-run
**When to use:** Seed script
**Example:**
```typescript
// Source: Prisma docs seeding guide
await prisma.course.upsert({
  where: { id: course.id },
  update: { title: course.title, order: course.order },
  create: { id: course.id, title: course.title, slug: course.id, order: course.order },
});
```

### Anti-Patterns to Avoid
- **Keeping mock fallback in routers:** Decision is NO mock fallback. If DB fails, throw error.
- **Mixing mock and real data:** Don't import from `mocks/` in migrated routers (except `questions.ts` which stays until AI generation is built).
- **N+1 queries:** Use Prisma `include` for relations instead of separate queries per course/lesson.
- **Modifying shared types for Prisma shapes:** Keep `@mpstats/shared` types as the API contract. Map Prisma results to shared types in routers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent upserts | Custom "check then insert" logic | `prisma.upsert()` or `createMany({ skipDuplicates: true })` | Atomic, handles race conditions |
| Connection pooling | Manual pool | Prisma + Supabase PgBouncer (already in DATABASE_URL) | Connection limits on free tier |
| Activity streak calculation | Complex date math | SQL query with `DISTINCT DATE(...)` + `LAG()` window function | Database handles timezone correctly |
| Error type detection | String matching on error messages | `instanceof Prisma.PrismaClientInitializationError` etc. | Type-safe, stable API |

**Key insight:** Prisma already handles the hard parts (type safety, relation loading, upsert atomicity). The migration is mostly about replacing mock data sources with Prisma calls and reshaping results.

## Common Pitfalls

### Pitfall 1: UserProfile Missing for Authenticated Users
**What goes wrong:** Supabase auth creates `auth.users` automatically, but `UserProfile` table is separate. New users who log in via Google OAuth have no UserProfile row, causing FK constraint violations when creating DiagnosticSession or LearningPath.
**Why it happens:** UserProfile was never auto-created in the mock era because mock data didn't need FK integrity.
**How to avoid:** Add `ensureUserProfile()` call in a tRPC middleware or at the start of key procedures (startSession, updateProgress, etc.). Use `upsert` so it's idempotent.
**Warning signs:** `Foreign key constraint failed` errors after login.

### Pitfall 2: LearningPath / LessonProgress Circular Dependency
**What goes wrong:** `LessonProgress` requires a `pathId` (FK to LearningPath), but LearningPath might not exist for a user who hasn't completed diagnostic yet.
**Why it happens:** The schema design ties progress tracking to LearningPath.
**How to avoid:** Either create a default LearningPath on first lesson interaction, or make `pathId` nullable. Recommended: auto-create LearningPath with empty `lessons: []` when user first interacts with learn page.
**Warning signs:** Users can't track progress until they complete diagnostic.

### Pitfall 3: Seed Script SkillCategory Mismatch
**What goes wrong:** Manifest has `skill_category` at course level only. Courses like `01_analytics` contain lessons about economics (FINANCE), marketing topics, etc. Assigning all lessons the course-level category is incorrect per user decision.
**Why it happens:** The manifest was designed before the lesson-level classification decision.
**How to avoid:** Run AI-classification on content_chunk data to determine per-lesson SkillCategory. Fall back to course-level category for lessons without content_chunk data.
**Warning signs:** Radar chart shows inflated scores in some categories because lessons are miscategorized.

### Pitfall 4: Supabase Free Tier Connection Limits
**What goes wrong:** Prisma opens multiple connections. Supabase free tier limits to ~20 direct connections.
**Why it happens:** PgBouncer pooling must be used (port 6543), not direct connection (port 5432).
**How to avoid:** `DATABASE_URL` must use port 6543 with `?pgbouncer=true`. `DIRECT_URL` uses port 5432 (for migrations only). This is already configured in `.env.example`.
**Warning signs:** `too many connections` errors during development with hot reload.

### Pitfall 5: content_chunk Table Has No FK to Lesson
**What goes wrong:** `ContentChunk.lessonId` is a string field, not a FK relation. Lessons seeded from manifest may not match existing `lesson_id` values in `content_chunk`.
**Why it happens:** content_chunk was populated independently via an ingestion script, not through Prisma.
**How to avoid:** Verify that seeded Lesson IDs match `content_chunk.lesson_id` values. The manifest lesson IDs (e.g., `01_analytics_m01_start_001`) should match because both came from the same naming convention.
**Warning signs:** RAG summary returns "no content" for lessons that should have chunks.

### Pitfall 6: 405 Lessons vs 80+ in Mock
**What goes wrong:** Mock has ~20 lessons across 5 courses. Real manifest has 405 lessons across 6 courses. Frontend might not handle this volume well (long lists, slow renders).
**Why it happens:** Mock was intentionally small for development.
**How to avoid:** Add pagination or course-based grouping in the learning router. Consider lazy loading lessons per course in the frontend.
**Warning signs:** Slow /learn page load, excessive DOM nodes.

## Code Examples

### Seed Script: Idempotent Course/Lesson Upsert
```typescript
// Source: existing scripts/seed/seed-from-manifest.ts + Prisma docs
// Already exists in codebase, needs update for lesson-level SkillCategory

await prisma.course.upsert({
  where: { id: course.id },
  update: { title: course.title_original, order: course.order },
  create: {
    id: course.id,
    title: course.title_original,
    description: course.title_en,
    slug: course.id,
    duration: 0,
    order: course.order,
  },
});

// For lessons, use AI-classified category (or course-level fallback)
await prisma.lesson.upsert({
  where: { id: lesson.id },
  update: { title: lesson.title_original, skillCategory: classifiedCategory },
  create: {
    id: lesson.id,
    courseId: course.id,
    title: lesson.title_original,
    description: `${module.title_original}`,
    order: lesson.order,
    duration: durationMinutes,
    skillCategory: classifiedCategory, // From AI or course-level fallback
    skillLevel: 'MEDIUM',
  },
});
```

### Diagnostic Router: Save Session to DB
```typescript
// DiagnosticSession + DiagnosticAnswer creation
startSession: protectedProcedure.mutation(async ({ ctx }) => {
  await ensureUserProfile(ctx.prisma, ctx.user);

  const session = await ctx.prisma.diagnosticSession.create({
    data: {
      userId: ctx.user.id,
      status: 'IN_PROGRESS',
      currentQuestion: 0,
    },
  });

  return {
    id: session.id,
    status: session.status,
    totalQuestions: 15, // Still using mock questions for now
    currentQuestion: 0,
  };
}),

// Submit answer -- save to DiagnosticAnswer
submitAnswer: protectedProcedure
  .input(z.object({ sessionId: z.string(), questionId: z.string(), selectedIndex: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const question = MOCK_QUESTIONS.find(q => q.id === input.questionId);
    if (!question) throw new TRPCError({ code: 'NOT_FOUND', message: 'Question not found' });

    const isCorrect = input.selectedIndex === question.correctIndex;

    await ctx.prisma.diagnosticAnswer.create({
      data: {
        sessionId: input.sessionId,
        questionId: input.questionId,
        answer: question.options[input.selectedIndex],
        isCorrect,
        difficulty: question.difficulty,
        skillCategory: question.skillCategory,
      },
    });

    await ctx.prisma.diagnosticSession.update({
      where: { id: input.sessionId },
      data: { currentQuestion: { increment: 1 } },
    });

    // Check completion
    const session = await ctx.prisma.diagnosticSession.findUnique({
      where: { id: input.sessionId },
      include: { answers: true },
    });

    const isComplete = (session?.answers.length || 0) >= 15;

    return { isCorrect, correctIndex: question.correctIndex, explanation: question.explanation, isComplete };
  }),
```

### Profile Router: Real Dashboard Stats
```typescript
getDashboard: protectedProcedure.query(async ({ ctx }) => {
  const [skillProfile, lessonProgress, diagnosticSessions, recentActivity] = await Promise.all([
    ctx.prisma.skillProfile.findUnique({ where: { userId: ctx.user.id } }),
    ctx.prisma.lessonProgress.findMany({
      where: { path: { userId: ctx.user.id } },
      include: { lesson: true },
    }),
    ctx.prisma.diagnosticSession.findMany({
      where: { userId: ctx.user.id, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
    // Activity streak: count distinct days with any activity
    ctx.prisma.$queryRaw`
      SELECT COUNT(DISTINCT DATE("completedAt")) as active_days
      FROM "LessonProgress"
      WHERE "pathId" IN (SELECT id FROM "LearningPath" WHERE "userId" = ${ctx.user.id})
      AND "completedAt" > NOW() - INTERVAL '30 days'
    `,
  ]);

  return {
    stats: {
      totalLessonsCompleted: lessonProgress.filter(p => p.status === 'COMPLETED').length,
      totalWatchTime: lessonProgress.reduce((sum, p) => sum + (p.lesson.duration || 0), 0),
      currentStreak: calculateStreak(lessonProgress), // Helper function
      longestStreak: 0, // Calculate from full history
      averageScore: calculateAverageScore(diagnosticSessions),
      lastActivityAt: lessonProgress[0]?.completedAt || null,
    },
    skillProfile: skillProfile ? {
      analytics: skillProfile.analytics,
      marketing: skillProfile.marketing,
      content: skillProfile.content,
      operations: skillProfile.operations,
      finance: skillProfile.finance,
    } : null,
    recentActivity: buildRecentActivity(lessonProgress, diagnosticSessions),
    nextLesson: await getNextLesson(ctx.prisma, ctx.user.id),
    completionPercent: calculateCompletionPercent(lessonProgress),
  };
}),
```

### Error Handling: Supabase-Specific
```typescript
// Frontend error boundary or tRPC error handler
function handleDatabaseError(error: TRPCClientError) {
  if (error.message === 'DATABASE_UNAVAILABLE') {
    // Check if it's Supabase pause (521)
    if (error.data?.cause?.message?.includes('521')) {
      return {
        title: 'База данных приостановлена',
        message: 'Supabase Free Tier приостанавливает проект после 7 дней неактивности. Администратору нужно восстановить проект через Supabase Dashboard.',
        action: 'Обратитесь к администратору',
      };
    }
    return {
      title: 'Ошибка подключения к базе данных',
      message: 'Не удалось подключиться к серверу базы данных. Попробуйте позже.',
    };
  }
}
```

## Discretion Recommendations

### 1. SkillCategory Mapping: Keep 5 Enums, Primary-Only per Lesson
**Recommendation:** Keep the existing 5-value `SkillCategory` enum. Assign ONE primary category per lesson via AI-classification. Do NOT add a secondary category -- it adds complexity without clear MVP value.
**Rationale:** The manifest already assigns course-level categories covering 4 of 5 enums (ANALYTICS, MARKETING, CONTENT, OPERATIONS). FINANCE maps to lessons within analytics/economics modules. AI-classification will correctly assign FINANCE to economics-focused lessons in 01_analytics.
**Confidence:** HIGH

### 2. Seed Script: Hybrid (Manifest JSON + AI Classification)
**Recommendation:** Two-step seed process:
1. `seed-from-manifest.ts` (existing) -- seeds Course/Lesson structure with course-level SkillCategory as default
2. `seed-skill-categories.ts` (new) -- reads content_chunk text, sends batches to LLM for classification, updates Lesson.skillCategory via upsert
**Rationale:** Separating concerns makes each step idempotent and debuggable. Step 1 can run without API keys. Step 2 can be re-run independently when classification improves.
**Confidence:** HIGH

### 3. Migration Strategy: Phased (Learning -> Diagnostic -> Profile)
**Recommendation:** Migrate one router per task. Each task includes router rewrite + frontend verification. This matches the dependency chain: Profile reads Diagnostic data, so Diagnostic must migrate first.
**Rationale:** Phased migration reduces blast radius. Each router can be independently tested. Prior decisions document already specifies this order.
**Confidence:** HIGH

### 4. Fate of Mock Data: Keep but Deprecate
**Recommendation:** Keep `packages/api/src/mocks/` files in codebase but stop importing them from migrated routers. Add `// DEPRECATED: Phase 1 migration removed usage` comments. Delete in a future cleanup sprint.
**Rationale:** `questions.ts` is still actively used (diagnostic questions are mock until AI generation phase). Keeping others as reference helps during debugging.
**Confidence:** HIGH

### 5. DTO Layer: No Separate DTO -- Map in Router
**Recommendation:** For MVP, transform Prisma results directly in router procedures to match `@mpstats/shared` types. No separate DTO/mapper layer.
**Rationale:** Adding a DTO layer is over-engineering for 3 routers with 10-15 procedures. The shared types ARE the DTO contract. Prisma result shapes are close enough that inline `.map()` is sufficient.
**Confidence:** HIGH

### 6. Auth Behavior When DB Unavailable
**Recommendation:** Auth (Supabase SSR middleware) works independently of Prisma DB. If Prisma DB is down, users can still log in but will see error pages on protected routes. This is correct behavior -- no special handling needed.
**Confidence:** HIGH

### 7. Fallback UI: Per-Route Error Boundary
**Recommendation:** Use React error boundaries at the page level (one per route), not global. Show route-specific error messages. For Supabase 521, show the special "paused" message at the layout level.
**Rationale:** Per-route errors are more user-friendly. A global error page loses navigation.
**Confidence:** MEDIUM -- depends on implementation complexity

### 8. Dashboard Empty State
**Recommendation:** New users (no diagnostic, no progress) see: skeleton radar chart with "Пройдите диагностику" prompt, 0/0/0 stats, empty activity list with CTA. This already partially exists in the dashboard page (`dashboard?.skillProfile ? <chart> : <prompt>`).
**Confidence:** HIGH

### 9. Radar Chart: Last Diagnostic Only (MVP)
**Recommendation:** Show only the latest diagnostic SkillProfile on radar chart. Overlaying two diagnostics adds UI complexity without clear MVP value.
**Rationale:** Skill dynamics (change between diagnostics) can be shown as "+5" / "-3" badges next to category scores instead of chart overlay.
**Confidence:** HIGH

## State of the Art

| Old Approach (Mock Era) | Current Approach (Phase 1) | Impact |
|-------------------------|---------------------------|--------|
| `globalThis` Map storage | Prisma PostgreSQL queries | Data persists across restarts |
| Hardcoded MOCK_COURSES array | Seed from manifest.json | 405 real lessons instead of 20 |
| Course-level SkillCategory | AI-classified lesson-level | Accurate skill assessment |
| Mock fallback on DB error | Explicit error with guidance | Users know what happened |
| In-memory session tracking | DiagnosticSession + DiagnosticAnswer tables | Full history preserved |

## Open Questions

1. **AI Classification Cost and Latency**
   - What we know: 405 lessons, each needs content_chunk text analyzed by LLM to determine SkillCategory
   - What's unclear: Cost per classification via OpenRouter (gemini-flash), total cost for full seed, how to handle lessons with zero content_chunks (~357 out of 405 based on content_chunk having 5,291 chunks for subset of lessons)
   - Recommendation: Use course-level category as default, only AI-classify lessons that have content_chunks. Batch 10-20 lessons per LLM call to reduce cost. Estimate: ~20-40 API calls at ~$0.001 each = negligible cost.

2. **Lesson Count Mismatch: Manifest vs Content_Chunk**
   - What we know: Manifest has 405 lessons. content_chunk has 5,291 chunks. Not all lessons have chunks (many are "pending" transcription).
   - What's unclear: Exact count of lessons with chunks vs without.
   - Recommendation: Seed all 405 lessons from manifest. AI-classify only those with content_chunks. Others keep course-level default. Can be verified by querying `SELECT DISTINCT lesson_id FROM content_chunk`.

3. **Activity Streak Calculation**
   - What we know: User wants Duolingo-style streak (consecutive days of activity)
   - What's unclear: What counts as "activity" -- lesson completion only? Or also diagnostic completion, lesson start?
   - Recommendation: Count any of: lesson completion, lesson progress update, diagnostic completion. Use SQL window functions for efficient calculation.

## Sources

### Primary (HIGH confidence)
- `/prisma/docs` - upsert patterns, seed scripts, createMany with skipDuplicates, transaction error handling
- `/trpc/trpc` - TRPCError codes, error handling in procedures, middleware patterns
- Codebase analysis: All source files read directly from `D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL/`

### Secondary (MEDIUM confidence)
- Prisma 5.22.0 docs - connection pooling with PgBouncer (verified via `.env.example` config)

### Data Verified from Codebase
- `E:/Academy Courses/manifest.json` -- confirmed 6 courses, 405 lessons, course-level skill_category
- `packages/db/prisma/schema.prisma` -- all models defined, ready for use
- `packages/api/src/routers/*.ts` -- all three routers analyzed, mock dependencies mapped
- `packages/api/src/mocks/*.ts` -- mock data structure documented
- `packages/shared/src/types/index.ts` -- shared type contracts verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and configured
- Architecture: HIGH -- patterns derived directly from existing codebase + Prisma official docs
- Pitfalls: HIGH -- identified from actual code analysis (FK constraints, connection limits, data mismatches)
- Discretion recommendations: HIGH -- based on concrete codebase data (manifest analysis, content_chunk structure)

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no fast-moving dependencies)
