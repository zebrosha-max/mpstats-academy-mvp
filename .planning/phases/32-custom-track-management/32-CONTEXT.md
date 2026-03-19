# Phase 32: Custom Track Management - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Ручное управление персональным треком обучения: добавление и удаление уроков из трека, сброс AI-генерации. Пользователь может дополнять AI-сгенерированный трек своим выбором уроков. Drag-and-drop, кастомные секции и переупорядочивание — вне скоупа.

</domain>

<decisions>
## Implementation Decisions

### Добавление уроков
- Кнопка «+» на LessonCard в режиме «Все курсы» — toggle: «+» (не в треке) / «✓» (в треке)
- При добавлении урок попадает в отдельную секцию «Мои уроки» (не в AI-секции)
- Если у пользователя нет трека (не прошёл диагностику) — при первом добавлении создаётся LearningPath только с секцией «Мои уроки»
- После диагностики AI-секции добавляются рядом, «Мои уроки» сохраняются
- Обратная связь: toast «Добавлено в трек» (sonner) + смена иконки на ✓
- Платные (locked) уроки можно добавлять в трек — при открытии показывается paywall баннер

### Удаление уроков
- Кнопка «Убрать» появляется только в режиме «Мой трек» (не в «Все курсы»)
- Удалять можно из любой секции — и из AI-секций, и из «Мои уроки»
- В «Все курсы» toggle ✓ → + НЕ работает как удаление (только добавление)
- Toast «Убрано из трека» при удалении

### Сброс трека
- Кнопка «Перестроить трек» — перегенерация AI-секций из последней диагностики
- «Мои уроки» сохраняются при сбросе
- Удалённые вручную уроки из AI-секций могут вернуться после сброса
- Диалог подтверждения: «Перестроить AI-трек? Удалённые вручную уроки могут вернуться. Мои уроки сохранятся.»

### Порядок и секции
- Секция «Мои уроки» отображается СВЕРХУ, перед AI-секциями (ошибки → углубление → развитие → продвинутый)
- Порядок внутри «Мои уроки» — по дате добавления (новые в конце)
- Drag-and-drop не нужен — порядок фиксированный
- Кастомные секции не нужны — только «Мои уроки» + 4 AI-секции

### Границы
- Без лимита на количество уроков в «Мои уроки» (максимум 405 = вся библиотека)
- Дубликаты: урок не может быть одновременно в «Мои уроки» и AI-секции — если добавляется вручную, остаётся только в «Мои уроки»

### Claude's Discretion
- Стиль иконки «+» / «✓» на карточке (размер, позиция, hover state)
- Анимация появления/исчезновения при добавлении/удалении
- Формат хранения «Мои уроки» в JSON (расширение существующей SectionedLearningPath)
- Оптимистичные обновления vs серверные мутации

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing implementation
- `.planning/phases/23-diagnostic-2-0.../23-CONTEXT.md` — Sectioned path algorithm, 4 AI sections, top-N limits
- `packages/api/src/routers/diagnostic.ts` — `generateSectionedPath()` function, SectionedLearningPath type
- `packages/api/src/routers/learning.ts` — getRecommendedPath, getPath, existing CRUD endpoints
- `apps/web/src/app/(main)/learn/page.tsx` — Track UI with accordion sections, SECTION_STYLES
- `packages/db/prisma/schema.prisma` — LearningPath model (lessons: Json), LessonProgress

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `LessonCard` component — needs «+»/«✓» toggle button addition
- `SECTION_STYLES` object — extend with `custom` section style (e.g., bookmark icon, purple/indigo)
- `sonner` toast — already used for feedback throughout the app
- `AlertDialog` (shadcn/ui) — for reset confirmation dialog

### Established Patterns
- `LearningPath.lessons: Json` — JSON field stores `SectionedLearningPath` with sections array. New section `{ id: 'custom', title: 'Мои уроки', lessons: [...] }` fits naturally
- `protectedProcedure` — all mutations must use protected tRPC procedure
- Optimistic updates pattern — not established yet (server-first mutations with `invalidate`)
- `trpc.learning.*` namespace — new mutations go here

### Integration Points
- `learn/page.tsx` viewMode toggle — «Все курсы» needs «+» buttons on LessonCard
- `learn/page.tsx` «Мой трек» — needs «Убрать» buttons and «Перестроить трек» action
- `diagnostic.ts` `generateSectionedPath` — needs to exclude lessons already in custom section when regenerating
- `getRecommendedPath` query — needs to include custom section in response

</code_context>

<specifics>
## Specific Ideas

- Кнопка «+» на карточке должна быть ненавязчивой — маленькая иконка в углу, не доминирует над контентом
- «Мои уроки» секция с иконкой закладки/сердца — визуально отличается от AI-секций
- При сбросе трека — мгновенный рефетч, не требует перезагрузки страницы

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 32-custom-track-management*
*Context gathered: 2026-03-19*
