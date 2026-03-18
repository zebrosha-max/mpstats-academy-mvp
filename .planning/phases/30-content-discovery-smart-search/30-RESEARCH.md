# Phase 30: Content Discovery — Smart Search - Research

**Researched:** 2026-03-18
**Domain:** Semantic search UI, client-side filtering, pgvector integration
**Confidence:** HIGH

## Summary

Фаза 30 строится почти полностью на существующей инфраструктуре. Бэкенд для семантического поиска уже готов: `searchChunks()` в `packages/ai/src/retrieval.ts` + RPC `match_chunks` в Supabase + tRPC endpoint `ai.searchChunks`. Данные для фильтрации (topics, skillLevel, skillCategories) уже записаны в БД из Phase 23 (tagging). Главная работа -- фронтенд: поисковая строка, панель фильтров, новый режим "Результаты поиска" и расширение `getCourses` для передачи фильтруемых полей на клиент.

Ключевой архитектурный вопрос -- группировка chunks по lesson_id на бэкенде. Существующий `searchChunks` возвращает плоский список chunks. Для результатов поиска нужна группировка по уроку с выбором 1-2 лучших фрагментов. Это требует нового tRPC endpoint или модификации существующего.

**Primary recommendation:** Создать новый endpoint `ai.searchLessons` который вызывает `searchChunks` с увеличенным лимитом (30-50), группирует по lesson_id, обогащает данными урока из Prisma и возвращает top-10 уроков с лучшими фрагментами. Фильтрация по категории/сложности/курсу выполняется на клиенте из уже загруженных данных `getCourses`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Поисковая строка размещается вверху страницы /learn, над фильтрами
- Семантический (RAG) поиск через существующий `searchChunks` endpoint (pgvector + OpenAI embeddings)
- Под строкой 3-5 подсказок-примеров популярных запросов ("как снизить рекламные расходы", "стратегия контента", "финансовая модель")
- Поиск запускается по Enter (не debounced) -- экономия embedding API вызовов
- При вводе запроса UI переключается в режим "Результаты поиска", при очистке -- назад к курсам/треку
- Компактная панель фильтров под поисковой строкой:
  - Категория -- pills (уже есть: ANALYTICS, MARKETING, CONTENT, OPERATIONS, FINANCE)
  - Статус -- pills (уже есть: Все/Не начатые/В процессе/Завершённые)
  - Топики -- multi-select dropdown, топ-15 самых частых из канонических топиков Phase 23
  - Сложность -- dropdown (Лёгкий/Средний/Сложный из Phase 23 EASY/MEDIUM/HARD)
  - Длительность -- dropdown ("До 10 мин", "10-30 мин", "30+ мин")
  - Курс -- dropdown (6 курсов)
  - Маркетплейс -- из топиков (WB, OZON как теги), без нового поля в схеме
- Фильтры работают в обоих режимах: "Курсы" и "Мой трек" (внутри аккордеонов)
- Результаты поиска -- карточки уроков с 1-2 релевантными фрагментами (RAG chunks) с таймкодами
- Клик на фрагмент -> открывает урок на нужном таймкоде (seekTo через postMessage)
- Top-10 наиболее релевантных уроков (группировка chunks по lesson_id)
- Пустой результат -- подсказка переформулировать запрос + популярные топики
- Карточка результата включает: название урока, название курса, теги топиков, badge сложности, длительность, прогресс просмотра
- В результатах поиска уроки из recommendedPath получают badge "В вашем треке"
- Поиск всегда ищет по ВСЕМ урокам (не ограничивается треком)
- Фильтры применяются и в режиме "Мой трек" (внутри секций-аккордеонов)
- Маркетплейс (WB/OZON) -- фильтр через существующие топики, без нового поля в схеме

### Claude's Discretion
- Точный набор подсказок-примеров запросов
- Визуальный дизайн панели фильтров и карточки результата
- Алгоритм группировки chunks по урокам и выбора лучших 1-2 фрагментов
- Debounce для текстовых фильтров (не для поиска)
- Реализация dropdown для топиков (shadcn Popover/Combobox или кастомный)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tRPC 11.x | existing | API layer | Already used for all endpoints |
| pgvector + HNSW | existing | Vector similarity search | Already configured with match_chunks RPC |
| OpenAI text-embedding-3-small | existing | Query embedding (1536 dims) | Already used for content chunks |
| shadcn/ui | existing | UI components (Button, Card, Badge, Input) | Project design system |
| Tailwind CSS | existing | Styling | Project standard |

### Supporting (may need)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cmdk | 1.x | Command palette / combobox for topic multi-select | If shadcn Combobox insufficient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom multi-select | cmdk / shadcn Popover+Command | shadcn has built-in Combobox pattern using Popover+Command, no extra dep needed |
| Server-side filtering | Client-side filtering | Courses data already loaded on /learn page, client-side is instant -- no extra API call |

**Installation:** No new packages required. All dependencies already in project.

## Architecture Patterns

### Recommended Approach

```
/learn page (existing)
├── SearchBar (NEW) — input + Enter trigger + example queries
├── FilterPanel (NEW) — pills + dropdowns, compact row
├── View mode toggle (existing) — "Мой трек" / "Все курсы"
├── Search Results view (NEW) — shown when searchQuery is set
│   └── SearchResultCard (NEW) — lesson info + 1-2 snippet cards with timecodes
├── Courses view (existing) — shown when no search + "Все курсы" mode
│   └── Course accordions with filtered lessons
└── Track view (existing) — shown when no search + "Мой трек" mode
    └── Section accordions with filtered lessons
```

### Pattern 1: New tRPC endpoint `ai.searchLessons`

**What:** Backend endpoint that wraps `searchChunks`, groups by lesson_id, and enriches with lesson metadata.

**When to use:** When user presses Enter in search bar.

**Example:**
```typescript
// packages/api/src/routers/ai.ts
searchLessons: protectedProcedure
  .input(z.object({
    query: z.string().min(1).max(500),
    limit: z.number().min(1).max(50).default(30),
  }))
  .query(async ({ ctx, input }) => {
    // 1. Vector search — get up to 30 chunks
    const chunks = await searchChunks({
      query: input.query,
      limit: input.limit,
      threshold: 0.3, // low threshold for better recall
    });

    // 2. Group by lesson_id, keep top 2 chunks per lesson
    const lessonChunks = new Map<string, typeof chunks>();
    for (const chunk of chunks) {
      const existing = lessonChunks.get(chunk.lesson_id) || [];
      if (existing.length < 2) {
        existing.push(chunk);
        lessonChunks.set(chunk.lesson_id, existing);
      }
    }

    // 3. Enrich with lesson data from Prisma
    const lessonIds = Array.from(lessonChunks.keys());
    const lessons = await ctx.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      include: {
        course: { select: { id: true, title: true } },
        progress: { where: { path: { userId: ctx.user.id } } },
      },
    });

    // 4. Merge and sort by best chunk similarity
    const results = lessons.map(lesson => {
      const snippets = lessonChunks.get(lesson.id) || [];
      return {
        lesson: { /* lesson fields */ },
        course: lesson.course,
        snippets: snippets.map(s => ({
          content: s.content.slice(0, 200), // truncate for card
          timecodeStart: s.timecode_start,
          timecodeEnd: s.timecode_end,
          similarity: s.similarity,
        })),
        bestSimilarity: Math.max(...snippets.map(s => s.similarity)),
      };
    }).sort((a, b) => b.bestSimilarity - a.bestSimilarity)
      .slice(0, 10); // top 10 lessons

    return { query: input.query, results };
  }),
```

### Pattern 2: Client-Side Filtering with Existing Data

**What:** Filters (category, status, topic, difficulty, duration, course, marketplace) applied client-side on already-loaded courses data.

**When to use:** In both "Курсы" and "Мой трек" views (non-search mode).

**Example:**
```typescript
// Filter state
const [filters, setFilters] = useState({
  category: 'ALL' as SkillCategory | 'ALL',
  status: 'ALL',
  topics: [] as string[],
  difficulty: 'ALL',
  duration: 'ALL', // 'short' | 'medium' | 'long'
  courseId: 'ALL',
  marketplace: 'ALL', // 'WB' | 'OZON' | 'ALL'
});

// Filter lessons using useMemo
const filteredLessons = useMemo(() => {
  return allLessons.filter(lesson => {
    if (filters.category !== 'ALL' && lesson.skillCategory !== filters.category) return false;
    if (filters.status !== 'ALL' && lesson.status !== filters.status) return false;
    if (filters.difficulty !== 'ALL' && lesson.skillLevel !== filters.difficulty) return false;
    if (filters.duration !== 'ALL') {
      if (filters.duration === 'short' && lesson.duration > 10) return false;
      if (filters.duration === 'medium' && (lesson.duration <= 10 || lesson.duration > 30)) return false;
      if (filters.duration === 'long' && lesson.duration <= 30) return false;
    }
    if (filters.courseId !== 'ALL' && lesson.courseId !== filters.courseId) return false;
    if (filters.topics.length > 0) {
      const lessonTopics = (lesson.topics || []) as string[];
      if (!filters.topics.some(t => lessonTopics.includes(t))) return false;
    }
    if (filters.marketplace !== 'ALL') {
      const lessonTopics = (lesson.topics || []) as string[];
      const mpKeywords = filters.marketplace === 'WB'
        ? ['Wildberries', 'WB']
        : ['OZON', 'Ozon'];
      if (!lessonTopics.some(t => mpKeywords.some(kw => t.includes(kw)))) return false;
    }
    return true;
  });
}, [allLessons, filters]);
```

### Pattern 3: Topics/SkillLevel Exposed from getCourses

**What:** Extend `getCourses` response to include `topics`, `skillCategories`, `skillLevel` per lesson so client can filter.

**Why:** Currently `getCourses` returns `skillCategory` (single) but NOT `topics`, `skillCategories` (multi), or `skillLevel`. These are in DB but not mapped to response.

**Changes needed:**
```typescript
// In learning.ts getCourses:
lessons: course.lessons.map((l) => ({
  // ... existing fields ...
  skillCategories: l.skillCategories, // Json? -> string[]
  topics: l.topics,                   // Json? -> string[]
  skillLevel: l.skillLevel,           // Difficulty enum, already in schema but not returned
})),
```

Also extend the shared `Lesson` interface:
```typescript
export interface Lesson {
  // ... existing ...
  skillCategories?: string[];
  topics?: string[];
}
```

### Pattern 4: Timecode Deep-Link from Search Results

**What:** Click on a snippet in search results opens lesson with `?t=seconds` query param.

**Example:**
```typescript
// SearchResultCard snippet link
<Link href={`/learn/${lessonId}?t=${snippet.timecodeStart}`}>
  <div className="text-body-sm text-mp-gray-600">
    <span className="text-mp-blue-600 font-medium">
      {formatTimecode(snippet.timecodeStart)} - {formatTimecode(snippet.timecodeEnd)}
    </span>
    {' '}{snippet.content}
  </div>
</Link>

// In learn/[id]/page.tsx — read ?t param and seekTo
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('t');
  if (t && iframeRef.current) {
    iframeRef.current.contentWindow?.postMessage(
      { method: 'seekTo', value: parseInt(t) },
      'https://kinescope.io'
    );
  }
}, [/* player ready */]);
```

### Anti-Patterns to Avoid
- **Debouncing search input:** User decision says Enter-only, NOT debounced. Saves embedding API calls.
- **Searching on every filter change:** Filters are client-side on already-loaded data. Don't re-call vector search when filters change.
- **Over-fetching chunks:** Don't request 100+ chunks. 30-50 is enough to cover top-10 lessons with 2 snippets each.
- **Showing full chunk text in results:** Truncate to ~200 chars. Full chunk can be 500-1000 tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select dropdown | Custom dropdown with checkboxes | shadcn Popover + Command (Combobox pattern) | Accessible, keyboard navigable, search within options |
| Vector search | Custom similarity SQL | Existing `match_chunks` RPC + HNSW index | Already optimized, tested, production-proven |
| Embedding generation | Custom API call | Existing `embedQuery()` from `packages/ai/src/embeddings.ts` | Handles dimension validation, error handling |
| Topic list extraction | Manual DB query for unique topics | Server-side aggregation in new endpoint or client-side from loaded courses | Topics already on Lesson model from Phase 23 |
| Timecode formatting | Custom formatter | Existing `formatTimecode()` from `packages/ai/src/retrieval.ts` | Already handles HH:MM:SS and MM:SS |

## Common Pitfalls

### Pitfall 1: Topics field is Json, not string[]
**What goes wrong:** TypeScript treats `Json` as `any`. Filtering on `lesson.topics` without parsing causes runtime errors.
**Why it happens:** Prisma `Json` type maps to `JsonValue` which is `string | number | boolean | null | JsonObject | JsonArray`. Not typed as `string[]`.
**How to avoid:** Parse topics explicitly: `const topics = (lesson.topics as string[] | null) ?? []`. Add runtime validation.
**Warning signs:** `Property 'includes' does not exist on type 'JsonValue'`.

### Pitfall 2: splitLink must include new AI endpoint
**What goes wrong:** New `ai.searchLessons` endpoint not in `AI_PROCEDURES` set -> batches with fast queries -> blocks page render.
**Why it happens:** `provider.tsx` has hardcoded `AI_PROCEDURES = new Set(['ai.getLessonSummary', 'ai.chat', 'ai.searchChunks'])`.
**How to avoid:** Add `'ai.searchLessons'` to the `AI_PROCEDURES` set in `apps/web/src/lib/trpc/provider.tsx`.
**Warning signs:** Page feels slow when searching -- stats/courses load delayed.

### Pitfall 3: Lesson duration is in MINUTES, not seconds
**What goes wrong:** Duration filter thresholds wrong if assuming seconds.
**Why it happens:** Prisma schema says `duration Int? // minutes (from manifest)`. Timecodes in chunks are seconds, but lesson duration is minutes.
**How to avoid:** Filter uses minute thresholds: `<= 10`, `10-30`, `> 30` directly on `lesson.duration`.
**Warning signs:** "До 10 мин" filter shows no results or all results.

### Pitfall 4: Marketplace filter relies on topic string matching
**What goes wrong:** "WB" or "OZON" not found in topics because canonical forms differ.
**Why it happens:** Topics were clustered by LLM. "Wildberries" might be canonical form, not "WB".
**How to avoid:** Check actual canonical topic values in DB first. Use flexible matching: `topic.toLowerCase().includes('wildberries') || topic.toLowerCase().includes('wb')`.
**Warning signs:** Marketplace filter returns 0 results despite having Ozon/WB courses.

### Pitfall 5: getCourses already returns large data set
**What goes wrong:** Adding topics/skillCategories to 405 lessons increases payload size significantly.
**Why it happens:** Topics are arrays of 2-5 strings per lesson. 405 * 5 = ~2000 extra strings.
**How to avoid:** This is acceptable (a few KB extra). But don't add full chunk content or embeddings to lesson response.
**Warning signs:** None expected -- payload increase is minimal.

### Pitfall 6: Search results don't respect access control
**What goes wrong:** Locked lessons appear in search results without lock indication.
**Why it happens:** `searchChunks` searches all content_chunks regardless of user subscription.
**How to avoid:** In `searchLessons`, check access via `isLessonAccessible()` and set `locked` flag on results. Still show the lesson in results (for discovery), but with lock icon and no video link.

## Code Examples

### Existing searchChunks usage (from ai.ts)
```typescript
// Source: packages/api/src/routers/ai.ts line 121-143
searchChunks: protectedProcedure
  .input(z.object({
    query: z.string().min(1),
    lessonId: z.string().optional(),
    limit: z.number().min(1).max(20).default(5),
    threshold: z.number().min(0).max(1).default(0.5),
  }))
  .query(async ({ input }) => {
    const chunks = await searchChunks({
      query: input.query,
      lessonId: input.lessonId,
      limit: input.limit,
      threshold: input.threshold,
    });
    return { query: input.query, count: chunks.length, chunks };
  }),
```

### Existing filter pills pattern (from learn/page.tsx)
```typescript
// Source: apps/web/src/app/(main)/learn/page.tsx line 13-27
const CATEGORY_FILTERS = [
  { value: 'ALL', label: 'Все', color: 'bg-mp-gray-100 text-mp-gray-700' },
  { value: 'ANALYTICS', label: 'Аналитика', color: 'bg-mp-blue-100 text-mp-blue-700' },
  // ...
];

// Render as clickable pills
{CATEGORY_FILTERS.map(filter => (
  <button
    key={filter.value}
    onClick={() => setCategoryFilter(filter.value)}
    className={cn('px-3 py-1.5 rounded-full text-sm',
      categoryFilter === filter.value ? filter.color : 'bg-mp-gray-50'
    )}
  >
    {filter.label}
  </button>
))}
```

### Timecode formatting (reusable)
```typescript
// Source: packages/ai/src/retrieval.ts line 113-122
export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No search on /learn | Semantic vector search + filters | Phase 30 | Users find content by pain point, not browsing |
| Single skillCategory | Multi skillCategories + topics | Phase 23 | Enables topic-based filtering |
| Fixed difficulty MEDIUM | LLM-assigned EASY/MEDIUM/HARD | Phase 23 | Enables difficulty filtering |

## Open Questions

1. **Canonical topic values in DB**
   - What we know: Topics were assigned by LLM and clustered into canonical forms in Phase 23
   - What's unclear: Exact list of canonical topics currently in Lesson.topics field
   - Recommendation: Query DB for distinct topics at implementation time: `SELECT DISTINCT jsonb_array_elements_text(topics::jsonb) FROM "Lesson" WHERE topics IS NOT NULL ORDER BY 1`

2. **Marketplace detection in topics**
   - What we know: WB/OZON courses exist (05_ozon course, topics may reference Wildberries)
   - What's unclear: Whether canonical topics consistently use "Wildberries"/"OZON" or variations
   - Recommendation: Check actual values, build a small mapping dictionary

3. **Topic count for top-15 filter**
   - What we know: Each lesson has 2-5 topics, ~405 lessons, probably 50-100 unique canonical topics
   - What's unclear: Exact count and frequency distribution
   - Recommendation: Server-side or startup-time query to get top-15 by frequency, cache in endpoint or hardcode after checking

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements -> Test Map

No formal requirement IDs assigned for Phase 30. Key behaviors to validate:

| Behavior | Test Type | Automated Command |
|----------|-----------|-------------------|
| searchLessons groups chunks by lesson | unit | `pnpm test -- --run` |
| Filters narrow lessons correctly | unit | `pnpm test -- --run` |
| Empty search shows hints | manual-only | Visual check |
| Timecode link opens lesson at position | manual-only | Visual check |

### Sampling Rate
- **Per task commit:** `pnpm test -- --run`
- **Per wave merge:** `pnpm test && pnpm build`
- **Phase gate:** Full suite green + manual search flow test

### Wave 0 Gaps
None -- existing test infrastructure covers phase. No new test files strictly required for this UI-heavy phase.

## Sources

### Primary (HIGH confidence)
- `packages/ai/src/retrieval.ts` -- existing searchChunks implementation, ChunkSearchResult type
- `packages/api/src/routers/ai.ts` -- existing tRPC endpoints, searchChunks query
- `packages/api/src/routers/learning.ts` -- getCourses, getRecommendedPath implementations
- `apps/web/src/app/(main)/learn/page.tsx` -- current page structure, filter patterns, state management
- `packages/db/prisma/schema.prisma` -- Lesson model fields (topics Json?, skillCategories Json?, skillLevel Difficulty)
- `packages/ai/src/tagging.ts` -- topic schema, canonical clustering approach
- `apps/web/src/lib/trpc/provider.tsx` -- splitLink AI_PROCEDURES set
- `scripts/sql/match_chunks.sql` -- RPC function signature, HNSW index

### Secondary (MEDIUM confidence)
- `packages/shared/src/types/index.ts` -- Lesson, LessonWithProgress interfaces (need extension for topics/skillLevel)
- `apps/web/src/components/learning/LessonCard.tsx` -- existing card component (reusable for search results with extension)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project
- Architecture: HIGH -- builds on well-understood existing patterns
- Pitfalls: HIGH -- based on direct code analysis of current implementation

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- internal project, no external API changes expected)
