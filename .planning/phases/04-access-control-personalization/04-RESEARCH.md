# Phase 4: Access Control & Personalization - Research

**Researched:** 2026-02-25
**Domain:** Soft content gating + personalized learning path generation
**Confidence:** HIGH

## Summary

Phase 4 adds two core behaviors: (1) soft gating that blocks lesson content (video, AI summary, RAG chat) until the user completes at least one diagnostic session, and (2) a personalized "My Track" view on /learn that shows recommended lessons based on the user's SkillProfile weak categories (score < 50).

The existing codebase already has all the infrastructure needed. The `DiagnosticSession` and `SkillProfile` models are in Supabase, the `LearningPath` model has a `lessons` Json field for storing ordered lesson IDs, and the diagnostic router already calculates `recommendedPath` from `SkillGap` data. The work is primarily: (a) a new tRPC endpoint to check diagnostic completion status, (b) generating and persisting `recommendedPath` into `LearningPath.lessons`, (c) frontend components for the gating banner and "My Track" filter with badge.

**Primary recommendation:** Use the existing `LearningPath.lessons` Json field to store the recommended lesson IDs (no schema migration needed). Add a `hasCompletedDiagnostic` query to the diagnostic router. Build the gating check and recommendation logic server-side, UI components client-side.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Блокируется: видео + AI summary + RAG чат — весь контент урока недоступен без диагностики
- Страница урока открывается (пользователь может перейти по ссылке), но вместо контента — баннер с CTA
- Название урока и базовая информация остаются видимыми
- Проверка: наличие хотя бы одной завершённой DiagnosticSession у пользователя
- Упор на слабые навыки: приоритет уроков из категорий с SkillProfile < 50
- Рекомендации строятся на основе последнего SkillProfile пользователя
- recommendedPath сохраняется в профиль и доступен между сессиями (требование из Success Criteria)
- Empty state (без диагностики): баннер "Пройди диагностику чтобы получить персональный трек" + CTA кнопка на /diagnostic
- По умолчанию на /learn: "Мой трек" если диагностика пройдена, "Все курсы" если нет
- Прогресс-бар в шапке трека: "5/18 уроков завершено" с визуальной полоской
- Тон текста: мотивирующий ("Пройди диагностику, чтобы получить доступ к урокам и персональный трек")
- Баннер заменяет область видео+summary+чат на странице урока

### Claude's Discretion
- Повторная диагностика: как обновляет трек (перестраивать или дополнять)
- Количество уроков в треке (все уроки слабых категорий vs фиксированный лимит)
- Порядок уроков в треке (по слабости категории, чередование, или иной)
- Механика переключателя на /learn (табы, toggle, или другой паттерн)
- Дизайн баннера на странице урока (полноэкранный vs компактный)
- Визуал бейджа "Рекомендовано" на карточках уроков
- Иконка замка на карточках в /learn (показывать или нет)
- Что происходит при завершении всех уроков трека

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACCESS-01 | Пользователь без диагностики видит баннер "Пройди диагностику чтобы открыть видео" | New `hasCompletedDiagnostic` query + `DiagnosticGateBanner` component on lesson page |
| ACCESS-02 | Фильтр "Мой трек" показывает только рекомендованные уроки на основе SkillProfile | New `getRecommendedPath` query + modified /learn page with "Мой трек" tab filtering by stored lesson IDs |
| ACCESS-03 | recommendedPath сохраняется в профиль пользователя (Supabase) | `LearningPath.lessons` Json field already exists — store recommended lesson IDs there on diagnostic completion |
| ACCESS-04 | Badge "Рекомендовано для вас" на уроках из recommendedPath | `LessonCard` receives `isRecommended` prop, renders badge |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tRPC | 11.x | API endpoints for gating check and path generation | Already in use, all routers use tRPC |
| Prisma | 5.x | DB queries for DiagnosticSession, SkillProfile, LearningPath | Already in use, all data access via Prisma |
| React / Next.js 14 | 14.x | UI components for banner, badge, filter | Already in use |
| Tailwind CSS | 3.x | Styling with mp-* design tokens | Already in use |
| shadcn/ui | latest | Card, Button, Badge components | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mpstats/shared | workspace | Shared types (LessonWithProgress, SkillProfile, etc.) | Type definitions for new fields |
| zod | 3.x | Input validation for tRPC procedures | Already used in all routers |

### Alternatives Considered
None — this phase uses only existing stack. No new dependencies needed.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/routers/
├── diagnostic.ts          # Add: hasCompletedDiagnostic query
├── learning.ts            # Add: getRecommendedPath query, generateRecommendedPath mutation
└── profile.ts             # No changes needed

apps/web/src/components/
├── learning/
│   ├── LessonCard.tsx     # Modify: add isRecommended badge
│   └── DiagnosticGateBanner.tsx  # NEW: banner for locked lesson content
└── shared/
    └── ...

apps/web/src/app/(main)/
├── learn/page.tsx         # Modify: add "Мой трек" tab, default based on diagnostic status
└── learn/[id]/page.tsx    # Modify: conditionally show banner instead of video+summary+chat
```

### Pattern 1: Server-Side Gating Check
**What:** Check diagnostic completion on the server (tRPC query), not client-side. The lesson page fetches `hasCompletedDiagnostic` alongside lesson data.
**When to use:** Always — prevents content flash before gating kicks in.
**Example:**
```typescript
// packages/api/src/routers/diagnostic.ts
hasCompletedDiagnostic: protectedProcedure.query(async ({ ctx }) => {
  const count = await ctx.prisma.diagnosticSession.count({
    where: { userId: ctx.user.id, status: 'COMPLETED' },
  });
  return count > 0;
}),
```

### Pattern 2: Recommended Path Generation on Diagnostic Completion
**What:** When a diagnostic session completes (in `submitAnswer` mutation, after `isComplete` block), generate the recommended path and persist it to `LearningPath.lessons`.
**When to use:** On every diagnostic completion — path gets rebuilt with latest SkillProfile.
**Example:**
```typescript
// After SkillProfile upsert in submitAnswer:
const gaps = await calculateSkillGaps(ctx.prisma, skillProfile);
const recommendedLessonIds = getRecommendedLessonsFromGaps(gaps);

await ctx.prisma.learningPath.upsert({
  where: { userId: ctx.user.id },
  update: { lessons: recommendedLessonIds, generatedAt: new Date() },
  create: { userId: ctx.user.id, lessons: recommendedLessonIds },
});
```

### Pattern 3: Conditional UI Rendering with tRPC
**What:** Use parallel tRPC queries on the lesson page — `getLesson` + `hasCompletedDiagnostic`. Show banner or content based on result.
**When to use:** On every lesson page load.
**Example:**
```typescript
// apps/web/src/app/(main)/learn/[id]/page.tsx
const { data: hasDiagnostic } = trpc.diagnostic.hasCompletedDiagnostic.useQuery();
const showContent = hasDiagnostic === true;
// Render banner if !showContent, else render video+summary+chat
```

### Anti-Patterns to Avoid
- **Client-side only gating:** Never hide content purely with CSS/conditional rendering without server-side check — content would still be fetched.
- **Storing recommendedPath in SkillProfile:** SkillProfile is scores-only. Use LearningPath.lessons (Json field) for path data.
- **Blocking lesson page navigation:** User should be able to visit `/learn/[id]` — they see title/breadcrumb but content is gated. Don't redirect them away.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Storing ordered lesson list | Custom table with position column | `LearningPath.lessons` Json field | Already exists in schema, stores ordered array |
| Recommendation algorithm | Complex scoring/ML | `calculateSkillGaps` + `getRecommendedLessonsFromGaps` | Already implemented in diagnostic.ts, proven logic |
| Auth check for gating | Custom middleware | `protectedProcedure` + `ctx.user.id` | Already enforced, just need to query DiagnosticSession |

**Key insight:** Nearly all backend logic already exists. `calculateSkillGaps` and `getRecommendedLessonsFromGaps` in `diagnostic.ts` already compute the recommended path. The gap is that this data is only returned in the API response but never persisted.

## Common Pitfalls

### Pitfall 1: Race Condition on Diagnostic Completion
**What goes wrong:** `submitAnswer` mutation writes SkillProfile and completes the session, but the recommended path generation could fail mid-way, leaving the user with a completed diagnostic but no persisted path.
**Why it happens:** Multiple DB operations without a transaction.
**How to avoid:** Wrap the completion block (SkillProfile upsert + session status update + LearningPath upsert) in a Prisma `$transaction`. Or at minimum, generate path after SkillProfile is confirmed saved.
**Warning signs:** User completes diagnostic but "Мой трек" shows empty state.

### Pitfall 2: LearningPath.lessons Json Field Type Mismatch
**What goes wrong:** `LearningPath.lessons` is `Json` type in Prisma. Writing a string array works, but reading it back may need type assertion.
**Why it happens:** Prisma's `Json` type is untyped at runtime.
**How to avoid:** Define a TypeScript type for the Json field content and validate/cast on read:
```typescript
type RecommendedPathData = string[]; // array of lesson IDs
const lessonIds = path.lessons as RecommendedPathData;
```
**Warning signs:** TypeScript `any` leaks into UI code.

### Pitfall 3: Default View Mode Flickering
**What goes wrong:** /learn page defaults to 'courses' but should default to 'Мой трек' if diagnostic is completed. The `hasCompletedDiagnostic` query loads async, so viewMode flickers from 'courses' to 'path'.
**Why it happens:** Initial state is set before async data arrives.
**How to avoid:** Don't render view mode toggle until `hasCompletedDiagnostic` query resolves. Use loading skeleton for the header area, then set initial viewMode based on the result.
**Warning signs:** Flash of "Все курсы" view before switching to "Мой трек".

### Pitfall 4: getRecommendedLessonsFromGaps Returns Too Few Lessons
**What goes wrong:** Current implementation limits to 5 lessons total (`maxLessons: number = 5`), taking only 2 per category. For a meaningful track, users need more.
**Why it happens:** Original function was designed for diagnostic results preview, not full learning path.
**How to avoid:** Create a separate function or increase limits for path generation. For the full track, include ALL lessons from categories with score < 50, ordered by gap priority.
**Warning signs:** Track has only 5 lessons while user has 3+ weak categories.

### Pitfall 5: Stale Path After Re-Diagnostic
**What goes wrong:** User re-takes diagnostic, scores improve, but old recommended path still shows previously weak categories.
**Why it happens:** Path not regenerated on new diagnostic completion.
**How to avoid:** Always regenerate (overwrite) `LearningPath.lessons` on every diagnostic completion. Decision from CONTEXT.md: Claude's discretion — recommend full rebuild.
**Warning signs:** User sees same track after improving skills.

## Code Examples

### Checking Diagnostic Completion (tRPC query)
```typescript
// packages/api/src/routers/diagnostic.ts — new query
hasCompletedDiagnostic: protectedProcedure.query(async ({ ctx }) => {
  try {
    const count = await ctx.prisma.diagnosticSession.count({
      where: { userId: ctx.user.id, status: 'COMPLETED' },
    });
    return count > 0;
  } catch (error) {
    handleDatabaseError(error);
  }
}),
```

### Generating Recommended Path (all lessons from weak categories)
```typescript
// packages/api/src/routers/learning.ts or diagnostic.ts
async function generateFullRecommendedPath(
  prisma: PrismaClient,
  skillProfile: SkillProfile,
): Promise<string[]> {
  const categories: Array<{ key: keyof SkillProfile; category: SkillCategory }> = [
    { key: 'analytics', category: 'ANALYTICS' },
    { key: 'marketing', category: 'MARKETING' },
    { key: 'content', category: 'CONTENT' },
    { key: 'operations', category: 'OPERATIONS' },
    { key: 'finance', category: 'FINANCE' },
  ];

  // Sort by weakness (lowest score first)
  const weakCategories = categories
    .map(c => ({ ...c, score: skillProfile[c.key] }))
    .filter(c => c.score < 50)
    .sort((a, b) => a.score - b.score);

  const lessonIds: string[] = [];
  for (const cat of weakCategories) {
    const lessons = await prisma.lesson.findMany({
      where: { skillCategory: cat.category },
      orderBy: { order: 'asc' },
      select: { id: true },
    });
    lessonIds.push(...lessons.map(l => l.id));
  }

  return lessonIds;
}
```

### Persisting Path on Diagnostic Completion
```typescript
// In submitAnswer mutation, after SkillProfile upsert:
if (isComplete) {
  // ... existing SkillProfile upsert code ...

  // Generate and persist recommended path
  const fullPath = await generateFullRecommendedPath(ctx.prisma, skillProfile);
  await ctx.prisma.learningPath.upsert({
    where: { userId: ctx.user.id },
    update: { lessons: fullPath, generatedAt: new Date() },
    create: { userId: ctx.user.id, lessons: fullPath },
  });
}
```

### DiagnosticGateBanner Component
```typescript
// apps/web/src/components/learning/DiagnosticGateBanner.tsx
'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function DiagnosticGateBanner() {
  return (
    <Card className="shadow-mp-card border-mp-blue-200 bg-gradient-to-br from-mp-blue-50 to-white">
      <CardContent className="py-12 text-center">
        {/* Lock icon */}
        <div className="w-16 h-16 rounded-2xl bg-mp-blue-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-mp-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-heading text-mp-gray-900 mb-2">
          Пройди диагностику, чтобы получить доступ
        </h2>
        <p className="text-body text-mp-gray-500 mb-6 max-w-md mx-auto">
          Диагностика определит твои сильные и слабые стороны, и мы подберём персональный трек обучения
        </p>
        <Link href="/diagnostic">
          <Button size="lg">
            Начать диагностику
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
```

### Lesson Page Gating (conditional rendering)
```typescript
// In apps/web/src/app/(main)/learn/[id]/page.tsx
const { data: hasDiagnostic, isLoading: diagLoading } = trpc.diagnostic.hasCompletedDiagnostic.useQuery();

// In render, replace video+summary+chat section:
{hasDiagnostic ? (
  <div className="lg:col-span-2 space-y-4">
    {/* Video player */}
    <Card id="video-player" className="overflow-hidden shadow-mp-card">
      <VideoPlayer ref={playerRef} videoId={lesson.videoId} />
    </Card>
    {/* ... rest of content ... */}
  </div>
) : (
  <div className="lg:col-span-3">
    <DiagnosticGateBanner />
  </div>
)}
```

### "Recommended" Badge on LessonCard
```typescript
// Modified LessonCard props
interface LessonCardProps {
  lesson: LessonWithProgress;
  showCourse?: boolean;
  courseName?: string;
  isRecommended?: boolean;  // NEW
}

// In LessonCard render, after title:
{isRecommended && (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-medium bg-mp-green-100 text-mp-green-700">
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
    Рекомендовано для вас
  </span>
)}
```

### /learn Page Default View Mode
```typescript
// In LearnPage component:
const { data: hasDiagnostic, isLoading: diagLoading } = trpc.diagnostic.hasCompletedDiagnostic.useQuery();
const { data: recommendedPath } = trpc.learning.getRecommendedPath.useQuery(
  undefined,
  { enabled: hasDiagnostic === true }
);

// Set initial view mode based on diagnostic status
const [viewMode, setViewMode] = useState<'path' | 'courses'>('courses');
const [viewModeInitialized, setViewModeInitialized] = useState(false);

useEffect(() => {
  if (!diagLoading && !viewModeInitialized) {
    setViewMode(hasDiagnostic ? 'path' : 'courses');
    setViewModeInitialized(true);
  }
}, [hasDiagnostic, diagLoading, viewModeInitialized]);
```

## Discretion Recommendations

Based on research of the existing codebase and UX patterns:

### Re-diagnostic: Full Rebuild
**Recommendation:** On re-diagnostic, fully rebuild the recommended path from the new SkillProfile. Rationale: the SkillProfile is overwritten on each diagnostic completion (upsert), so the path should reflect the latest state. Completed lessons in the old path retain their LessonProgress — only the recommendation list changes.

### Number of Lessons in Track
**Recommendation:** Include ALL lessons from categories with score < 50. For 405 total lessons across 6 courses, if 2-3 categories are weak, that's ~100-200 lessons. This gives a meaningful long-term track. The progress bar ("X/Y lessons") provides motivation regardless of size.

### Lesson Order in Track
**Recommendation:** Order by category weakness (weakest first), then by course order within category. This ensures the user starts with their biggest gaps.

### View Switcher on /learn
**Recommendation:** Keep the existing two-button pattern ("Мой трек" / "Все курсы") — it matches the current UI. Rename "Мой план" to "Мой трек" per CONTEXT.md wording.

### Banner Design
**Recommendation:** Full-width banner replacing the video+summary+chat area (lg:col-span-3 instead of split). Gradient background (mp-blue-50 to white), lock icon, motivating text, CTA button. Lesson title and breadcrumb remain visible above.

### "Recommended" Badge
**Recommendation:** Small green badge with checkmark icon, text "Рекомендовано для вас", placed in the meta row of LessonCard next to category badge.

### Lock Icon on /learn Cards
**Recommendation:** No lock icon on lesson cards in /learn. The gating is only on the lesson page itself. Cards should remain inviting to click. User discovers the gate on the lesson page.

### Track Completion
**Recommendation:** When all recommended lessons are completed, show a congratulatory message in the "Мой трек" view with a CTA to re-take the diagnostic ("Проверь свой прогресс!").

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| recommendedPath computed on-the-fly in getResults | Persisted in LearningPath.lessons | Phase 4 | Path survives between sessions |
| All content visible to all users | Soft gating behind diagnostic | Phase 4 | Users encouraged to complete diagnostic first |
| /learn defaults to "Все курсы" always | /learn defaults to "Мой трек" when diagnostic done | Phase 4 | Personalized experience |

## Open Questions

1. **LearningPath.lessons vs new column**
   - What we know: `LearningPath.lessons` is `Json` type, currently initialized as `[]` on auto-create. It stores "ordered array of lessonIds with metadata" per schema comment.
   - What's unclear: Is storing just `string[]` sufficient, or should we store `{ lessonId: string; category: SkillCategory; priority: string }[]`?
   - Recommendation: Start with `string[]` for simplicity. The category and priority can be derived from the lesson's `skillCategory` and the SkillProfile at read time. This avoids data staleness if lessons change categories.

2. **FINANCE category handling**
   - What we know: FINANCE has no mapped courses (from STATE.md: "FINANCE category (empty courses) always uses mock fallback" for questions).
   - What's unclear: If a user's FINANCE score is < 50, should we include zero lessons from that category?
   - Recommendation: Yes, skip FINANCE in path generation if no lessons exist for it. The filter `prisma.lesson.findMany({ where: { skillCategory: 'FINANCE' } })` will return empty and that's fine.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/db/prisma/schema.prisma` — LearningPath model with Json lessons field
- Codebase analysis: `packages/api/src/routers/diagnostic.ts` — calculateSkillGaps, getRecommendedLessonsFromGaps
- Codebase analysis: `packages/api/src/routers/learning.ts` — getPath, getCourses, getLesson
- Codebase analysis: `packages/shared/src/types/index.ts` — all type definitions
- Codebase analysis: `apps/web/src/app/(main)/learn/page.tsx` — current /learn page structure
- Codebase analysis: `apps/web/src/app/(main)/learn/[id]/page.tsx` — current lesson page structure
- Codebase analysis: `apps/web/src/components/learning/LessonCard.tsx` — current card component

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions from user discussion session (2026-02-25)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - patterns directly derived from existing codebase analysis
- Pitfalls: HIGH - identified from reading actual code and data flow

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable — no dependency changes)
