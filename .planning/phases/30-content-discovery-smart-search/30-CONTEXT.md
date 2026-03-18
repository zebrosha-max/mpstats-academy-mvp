# Phase 30: Content Discovery — Smart Search - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Пользователь находит нужный контент через семантический поиск по проблеме/боли и расширенную фильтрацию по урокам (топики, сложность, длительность, курс, маркетплейс). Поиск и фильтры интегрированы на существующей странице /learn с маркировкой уроков из персонального трека.

</domain>

<decisions>
## Implementation Decisions

### Поиск по боли/проблеме
- Поисковая строка размещается вверху страницы /learn, над фильтрами
- Семантический (RAG) поиск через существующий `searchChunks` endpoint (pgvector + OpenAI embeddings)
- Под строкой 3-5 подсказок-примеров популярных запросов ("как снизить рекламные расходы", "стратегия контента", "финансовая модель")
- Поиск запускается по Enter (не debounced) — экономия embedding API вызовов
- При вводе запроса UI переключается в режим "Результаты поиска", при очистке — назад к курсам/треку

### Фильтры и навигация
- Компактная панель фильтров под поисковой строкой:
  - Категория — pills (уже есть: ANALYTICS, MARKETING, CONTENT, OPERATIONS, FINANCE)
  - Статус — pills (уже есть: Все/Не начатые/В процессе/Завершённые)
  - Топики — multi-select dropdown, топ-15 самых частых из канонических топиков Phase 23
  - Сложность — dropdown (Лёгкий/Средний/Сложный из Phase 23 EASY/MEDIUM/HARD)
  - Длительность — dropdown ("До 10 мин", "10-30 мин", "30+ мин")
  - Курс — dropdown (6 курсов)
  - Маркетплейс — из топиков (WB, OZON как теги), без нового поля в схеме
- Фильтры работают в обоих режимах: "Курсы" и "Мой трек" (внутри аккордеонов)

### Результаты и карточки
- Результаты поиска — карточки уроков с 1-2 релевантными фрагментами (RAG chunks) с таймкодами
- Клик на фрагмент → открывает урок на нужном таймкоде (seekTo через postMessage)
- Top-10 наиболее релевантных уроков (группировка chunks по lesson_id)
- Пустой результат — подсказка переформулировать запрос + популярные топики
- Карточка результата включает: название урока, название курса, теги топиков, badge сложности, длительность, прогресс просмотра

### Интеграция с треком
- В результатах поиска уроки из recommendedPath получают badge "В вашем треке"
- Поиск всегда ищет по ВСЕМ урокам (не ограничивается треком)
- Фильтры применяются и в режиме "Мой трек" (внутри секций-аккордеонов)

### Claude's Discretion
- Точный набор подсказок-примеров запросов
- Визуальный дизайн панели фильтров и карточки результата
- Алгоритм группировки chunks по урокам и выбора лучших 1-2 фрагментов
- Debounce для текстовых фильтров (не для поиска)
- Реализация dropdown для топиков (shadcn Popover/Combobox или кастомный)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing search infrastructure
- `packages/ai/src/retrieval.ts` — Vector search via `searchChunks()`, pgvector HNSW, threshold 0.3
- `packages/ai/src/embeddings.ts` — OpenAI text-embedding-3-small (1536 dims), `embedQuery()`
- `packages/api/src/routers/ai.ts` — tRPC `searchChunks` endpoint (already exists)
- `scripts/sql/match_chunks.sql` — Supabase RPC function for vector similarity

### Lesson data model (Phase 23 tagging)
- `packages/db/prisma/schema.prisma` — Lesson model with `skillCategories`, `topics`, `skillLevel` fields
- `packages/ai/src/tagging.ts` — LLM tagging pipeline (canonical topics dictionary)
- `packages/api/src/routers/learning.ts` — `getCourses`, `getRecommendedPath` endpoints

### Current /learn page
- `apps/web/src/app/(main)/learn/page.tsx` — Existing CATEGORY_FILTERS, STATUS_FILTERS, accordion sections
- `apps/web/src/components/learning/LessonCard.tsx` — Existing lesson card component

### tRPC infrastructure
- `apps/web/src/lib/trpc/provider.tsx` — splitLink (AI queries in separate batch)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `searchChunks()` in `packages/ai/src/retrieval.ts` — ready-to-use vector search, returns `ChunkSearchResult[]` with `lesson_id`, `content`, `timecode_start/end`, `similarity`
- `CATEGORY_FILTERS` and `STATUS_FILTERS` arrays in `/learn/page.tsx` — pattern for pill-based filter UI
- `LessonCard` component — existing card with progress bar, lock icon, category badge
- `recommendedLessonIds` Set in `/learn/page.tsx` — O(1) lookup for marking recommended lessons
- `splitLink` in tRPC provider — AI search queries already go to separate batch (won't block page render)
- Badge component (`components/ui/badge.tsx`) — 15+ variants including skill categories

### Established Patterns
- Accordion sections with `expandedSections` state (Phase 23 sectioned track)
- Topic tags as `Json` field on Lesson — needs parsing but no schema migration
- Filter combination: `categoryFilter` + `statusFilter` state variables with `useMemo` for filtering

### Integration Points
- `/learn/page.tsx` — main integration point for search bar, filters panel, and results view
- `ai.searchChunks` tRPC endpoint — backend for semantic search (already in splitLink)
- `learning.getCourses` — needs to return `skillCategories`, `topics`, `skillLevel` for client-side filtering
- `learning.getRecommendedPath` — for "В вашем треке" badge on search results

</code_context>

<specifics>
## Specific Ideas

- Маркетплейс (WB/OZON) — фильтр по маркетплейсу через существующие топики, без добавления нового поля в схему
- Подсказки под поисковой строкой — примеры запросов, ориентированных на боли селлеров маркетплейсов
- Фрагменты с таймкодами в результатах — как в текущем RAG chat, но в карточке результата

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-content-discovery-smart-search*
*Context gathered: 2026-03-18*
