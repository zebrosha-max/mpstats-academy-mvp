# Phase 12: Lesson Page Performance - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Страница урока загружается быстро без длительного скелетона, видео не блокирует рендер. Требования: PERF-01 (< 2s рендер контента), PERF-02 (lazy video), PERF-03 (оптимизация tRPC запросов + кеширование).

Текущее состояние: вся страница `'use client'`, 3 tRPC запроса стартуют на клиенте параллельно (`getLesson`, `hasCompletedDiagnostic`, `getLessonSummary`), iframe Kinescope загружается синхронно с контентом. Пользователь сообщает: "страница в целом медленная".

</domain>

<decisions>
## Implementation Decisions

### Lazy video loading
- Thumbnail + кнопка Play вместо немедленной загрузки iframe
- iframe появляется только после клика пользователя на Play
- До клика — визуальный placeholder с превью и кнопкой воспроизведения

### Кеширование tRPC
- Prefetch следующего урока НЕ нужен — не усложнять
- Остальная стратегия кеширования (staleTime, gcTime, какие запросы кешировать агрессивнее) — на усмотрение Claude

### Claude's Discretion
- **Thumbnail источник** — Kinescope poster API vs генеричный placeholder (Claude исследует доступность)
- **Load trigger** — по клику на Play vs после рендера страницы (Claude выберет оптимальный)
- **Autoplay** — автозапуск после загрузки iframe или нет
- **Cache strategy** — React Query staleTime/gcTime vs Next.js fetch cache, конкретные TTL значения
- **Summary loading UX** — компактный spinner vs скрытие секции до готовности
- **SSR split** — разделять ли страницу на Server + Client компоненты (breadcrumb/заголовок серверно, видео/чат клиентски) или оставить client-only с оптимизацией кеша/lazy
- **Loading states** — постепенное появление vs полный скелетон, порядок элементов
- **Целевые метрики** — конкретные цифры (FCP, LCP) помимо требования "< 2 секунды"

</decisions>

<specifics>
## Specific Ideas

- Пользователь отмечает что страница в целом медленная — не один конкретный элемент, а общее впечатление
- Kinescope player использует прямой iframe embed (`https://kinescope.io/embed/{videoId}`) — React-компонент сломан
- Summary загружается через LLM (может занимать 5-10 сек первый раз), но серверный кеш уже есть (`fromCache` флаг)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-lesson-page-performance*
*Context gathered: 2026-02-27*
