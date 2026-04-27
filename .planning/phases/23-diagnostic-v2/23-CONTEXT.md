# Phase 23: Diagnostic 2.0 — Personalized Learning Track - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Улучшение персонализации трека обучения: тематическая разметка всех 405 уроков (мульти-категории + топики + сложность), привязка диагностических вопросов к конкретным урокам и таймкодам, приоритезация трека по конкретным ошибкам пользователя, секционная структура трека, хинты с таймкодами на страницах уроков, двойной Radar Chart для повторной диагностики.

НЕ входит: адаптивная сложность вопросов (IRT), spaced repetition, изменение формата/количества вопросов диагностики, новые UI-компоненты диагностики (intro/session/results flow остаётся как есть).

</domain>

<decisions>
## Implementation Decisions

### Тематическая разметка уроков
- **Мульти-категорийность:** каждый урок получает 1-3 skillCategory (вместо жёсткой привязки 1 курс = 1 категория). Урок "Юнит-экономика WB" → [ANALYTICS, FINANCE]
- **Топики:** свободные теги 2-5 на урок (маржинальность, себестоимость, ABC-анализ и т.д.)
- **Двухэтапная генерация топиков:** 1) LLM свободно размечает все 405 уроков → 2) кластеризация похожих топиков в канонический словарь (без дублей "маржа" vs "маржинальность")
- **Сложность:** LLM размечает EASY/MEDIUM/HARD в том же проходе (сейчас все 405 = MEDIUM)
- **Один LLM-проход:** категории + топики + сложность за 1 вызов на урок. Входные данные: первые 2-3 чанка урока (из content_chunk)
- **Без ручной валидации:** доверяем LLM-разметке. 405 уроков — слишком много для ручной проверки
- **Финансы:** ось FINANCE сохраняется (5 осей без изменений). Уроки по юнит-экономике, марже, ROI получат FINANCE через мульти-категорийность

### Привязка вопросов к контенту
- При генерации вопроса сохранять `sourceChunkIds` и `sourceLessonIds` — связь "вопрос → откуда он взялся"
- Таймкоды (`timecodeStart`, `timecodeEnd`) доступны из чанков — сохранять вместе с вопросом
- При ошибке пользователя: запоминать конкретные уроки и таймкоды, которые покрывают этот вопрос

### Структура трека "Мой трек"
- **4 секции-аккордеона:**
  1. "Проработка ошибок" (N уроков) — уроки из неправильных ответов диагностики
  2. "Углубление" (N уроков) — остальные уроки слабых категорий (<70%)
  3. "Развитие" (N уроков) — уроки из средних категорий (70-85%)
  4. "Продвинутый уровень" (N уроков) — HARD-уроки из сильных категорий (>85%)
- **Первая секция раскрыта**, остальные свёрнуты (аккордеон)
- **Все секции доступны** — это рекомендация, не блокировка. Пользователь может перейти к любой секции
- **Порядок внутри секции "Ошибки":** по слабости категории (наименьший балл первый), внутри категории — авторский порядок уроков
- **Отличники (80%+):** секция "Ошибки" короткая (2-4 урока из неправильных ответов), акцент на секцию "Продвинутый уровень" с HARD-уроками

### Хинт с таймкодом на странице урока
- **Позиция:** между видеоплеером и табами (Конспект | AI-чат)
- **Содержимое:** текст вопроса из диагностики + кликабельный таймкод (▶ MM:SS)
- **Клик на таймкод:** seekTo() в Kinescope плеере (инфра уже есть: TimecodeLink + postMessage API)
- **Dismissible навсегда:** кнопка "Скрыть" прячет хинт перманентно (persist в DB или localStorage)
- **Не принудительно:** пользователь может игнорировать хинт и смотреть урок целиком
- **Показывается только на уроках из секции "Ошибки"** — не на всех уроках трека

### Повторная диагностика
- **Трек при повторной:** спрашиваем пользователя "Обновить трек по новым результатам?" (не автоматически)
- **Прогресс сохраняется:** LessonProgress не сбрасывается, просмотренные уроки помечены галочкой
- **Мотивация — мягкая:** после завершения секции "Ошибки" — похвалить + предложить опцию пройти заново. Не пушить, не блокировать
- **Пользователь может идти по треку до конца** без повторной диагностики — его право
- **Двойной Radar Chart:** при повторной диагностике — два полигона на Radar Chart: "было" (полупрозрачный) и "стало". Показывает рост навыков

### Claude's Discretion
- Количество хинтов при множественных ошибках на одном уроке (все vs первый + "ещё N")
- Точный дизайн хинта (цвета, иконка, typography)
- Определение сложности уроков (LLM в одном проходе vs эвристика по позиции — рекомендован LLM)
- Точки размещения мотивационного CTA для повторной диагностики
- Дизайн аккордеон-секций трека
- Формулировки текстов для отличников

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diagnostic system
- `packages/api/src/routers/diagnostic.ts` — Core diagnostic logic: startSession, submitAnswer, calculateSkillProfileFromAnswers, generateFullRecommendedPath, getResults
- `packages/ai/src/question-generator.ts` — LLM question generation pipeline, CATEGORY_TO_COURSES mapping, fetchRandomChunks
- `packages/ai/src/question-schema.ts` — Zod schema for generated questions (needs sourceChunkIds, sourceLessonIds)
- `packages/api/src/utils/question-bank.ts` — QuestionBank caching logic
- `packages/api/src/mocks/questions.ts` — 100 hardcoded fallback questions

### Learning track
- `packages/api/src/routers/learning.ts` — getRecommendedPath, getCourses, getLesson, lesson ordering
- `apps/web/src/app/(main)/learn/page.tsx` — "Мой трек" / "Все курсы" views, viewMode toggle
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — Lesson page layout (video → tabs)

### RAG & timecodes
- `packages/ai/src/retrieval.ts` — formatTimecode(), vector search
- `packages/ai/src/generation.ts` — Citation formatting with timecodes
- `apps/web/src/components/video/KinescopePlayer.tsx` — seekTo() via postMessage
- `apps/web/src/components/video/TimecodeLink.tsx` — Clickable timecode component

### Database
- `packages/db/prisma/schema.prisma` — Lesson, ContentChunk, DiagnosticSession, DiagnosticAnswer, SkillProfile, LearningPath models
- `scripts/seed/seed-from-manifest.ts` — Lesson seeding (COURSE_SKILL_MAP, hardcoded skillLevel=MEDIUM)
- `scripts/sql/match_chunks.sql` — Vector search RPC function

### Diagnostic results & Radar Chart
- `apps/web/src/app/(main)/diagnostic/results/page.tsx` — Results display, Radar Chart
- `apps/web/src/components/charts/RadarChart.tsx` — Recharts Radar (needs dual polygon support)

### Prior phase contexts
- `.planning/phases/02-ai-question-generation/02-CONTEXT.md` — Original question generation decisions
- `.planning/phases/04-access-control-personalization/04-CONTEXT.md` — Original access control & personalization decisions
- `.planning/phases/20-paywall-content-gating/20-CONTEXT.md` — Paywall decisions (track = PLATFORM feature)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **TimecodeLink** (`components/video/TimecodeLink.tsx`): Clickable `[▶] MM:SS` button that calls `onSeek(seconds)` — reuse directly for diagnostic hints
- **KinescopePlayer.seekTo()**: PostMessage API to iframe — already works, tested in production
- **RadarChart** (`components/charts/RadarChart.tsx`): Recharts-based, needs extension for dual polygon (before/after)
- **Badge** (`components/ui/badge.tsx`): 15+ variants — use for section headers, lesson type indicators
- **DiagnosticGateBanner** (`components/learning/DiagnosticGateBanner.tsx`): Gate banner pattern — reuse for hint block
- **formatTimecode()** (`packages/ai/src/retrieval.ts`): Seconds → "MM:SS" formatting

### Established Patterns
- **tRPC protectedProcedure**: All learning endpoints require auth — diagnostic hints fit here
- **splitLink**: AI-heavy queries separated from fast queries — new hint queries should be "fast" (pre-computed)
- **LessonProgress tracking**: 15s debounced save via Kinescope postMessage — hint dismissal can use similar persist pattern
- **Question generation**: Triple fallback (AI → cache → mock) — source tracking adds to AI tier, cache stores it

### Integration Points
- `diagnostic.ts:submitAnswer()` — Save source lesson/chunk IDs when recording answer
- `diagnostic.ts:generateFullRecommendedPath()` — Replace with section-based path generation
- `learning.ts:getRecommendedPath()` — Return sections instead of flat list
- `learn/page.tsx` — Render accordion sections instead of flat list
- `learn/[id]/page.tsx` — Add DiagnosticHint component between video and tabs
- `diagnostic/results/page.tsx` — Dual Radar Chart when previous session exists
- `schema.prisma` — Add Lesson.skillCategories (Json), Lesson.topics (Json), Lesson.difficulty update
- `question-generator.ts:fetchRandomChunks()` — Return timecodeStart/timecodeEnd with chunks

</code_context>

<specifics>
## Specific Ideas

- Ключевое ощущение пользователя: **"Ошибся на вопрос → вижу урок именно по этой теме первым в треке"**. Прямая причинно-следственная связь между ошибкой и рекомендацией
- Хинт в уроке — **ненавязчивый**: пользователь может полностью его проигнорировать и смотреть урок целиком. Это подсказка, не принуждение
- Повторная диагностика — **мягкая мотивация**: похвалить за завершение секции, предложить опцию, но не пушить. Пользователь идёт в своём темпе
- Двойной Radar: визуальное подтверждение роста — "было 45% Финансы, стало 72%" — мощная мотивация
- Тематическая разметка — **одноразовая операция** на 405 уроков, результат в базе навсегда. Обогащает не только диагностику, но и будущие фичи (поиск по топикам, фильтрация)

</specifics>

<deferred>
## Deferred Ideas

- **Адаптивная сложность (IRT-lite)** — подбор сложности вопросов на лету по текущим ответам. Отдельная фаза
- **Spaced repetition** — повторение вопросов через интервалы для закрепления. Отдельная фаза
- **Визуализация прогресса между диагностиками** — полная история + графики роста по осям. Отдельная фаза
- **Гибкая диагностика (10-100 вопросов)** — выбор количества и сложности для разных сегментов. Отдельная фаза
- **Поиск/фильтрация по топикам** — после разметки уроков можно добавить фильтр "Все уроки про юнит-экономику". Отдельная фаза

</deferred>

---

*Phase: 23-diagnostic-2-0*
*Context gathered: 2026-03-16*
