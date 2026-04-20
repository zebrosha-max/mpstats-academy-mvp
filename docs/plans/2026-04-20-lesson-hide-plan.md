# План: Скрытие уроков администраторами (Soft Hide)

**Дата:** 2026-04-20
**Тип:** Фича (admin tooling)
**Статус:** Planned

## Цель

Дать ADMIN/SUPERADMIN возможность скрывать уроки с платформы без удаления из БД, Kinescope и RAG (embeddings). Скрытые уроки:
- исчезают из всех пользовательских страниц (курсы, learning path, диагностика, retrieval);
- для ADMIN после скрытия тоже пропадают из вида (нельзя отменить своё действие);
- для SUPERADMIN остаются видимыми в админке с маркером, возможен возврат (unhide).

## Источник задачи

Google Sheet «Список уроков на доработку на платформе MPSTATS Academy» (<https://docs.google.com/spreadsheets/d/1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0>), колонка «Удалить». Список из 42 уроков на скрытие команда проставит сама через UI.

**Список для команды (справочно):**
- Реклама и продвижение: №18, 36, 67
- AI-инструменты: №1, 2, 5, 13, 14
- Аналитика: №1, 3, 18, 33, 34, 36, 37, 41, 42, 51, 52, 53, 55, 58, 64, 65, 66, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81
- Ozon: №4, 5, 50
- Экспресс-курсы: весь курс целиком (решить на этапе UI — скрывать `Course` или все его `Lesson`)

## Решения (согласованы с owner)

| Вопрос | Решение |
|---|---|
| Delete vs hide | Soft hide — флаг, БД/Kinescope/embeddings остаются |
| Кнопка где | `/admin/content` → раскрытый `CourseManager` → строка урока |
| Видимость для ADMIN | После скрытия не видит скрытый урок (фильтр по роли) |
| Видимость для SUPERADMIN | Видит скрытые с маркером, может вернуть |
| Прогресс пользователей | Сохраняется. Скрытые уроки не учитываются в % completion |
| Подтверждение | Обязательный confirm-диалог: «Скрыть урок "...“?» |
| RAG (retrieval) | Фильтрация чанков через JOIN по `lessonId` + `Lesson.isHidden=false` |

## Затрагиваемые файлы

### Схема БД
- `packages/db/prisma/schema.prisma` — добавить `Lesson.isHidden Boolean @default(false)`, `hiddenBy String?`, `hiddenAt DateTime?` (аналогично `LessonComment`)
- Миграция: `prisma migrate dev --name add_lesson_hidden`

### Backend (tRPC)
- `packages/api/src/routers/admin.ts`
  - `toggleLessonHidden` mutation (`adminProcedure`, input: `{ lessonId, hidden }`, записывает `hiddenBy` = current user id, `hiddenAt` = now или null)
  - `getCourses` / `getCourseLessons` — добавить параметр `includeHidden: boolean` (SUPERADMIN only). Для ADMIN всегда `false`.
- `packages/api/src/routers/learning.ts` — все запросы к `Lesson` добавляют `where: { isHidden: false }` (listCourses, getCourse, getLesson, getLearningPath и т.д.)
- `packages/api/src/routers/ai.ts` / `packages/ai/src/retrieval.ts` — retrieval должен JOIN'ить `Lesson` и исключать чанки скрытых уроков. Проверить запрос (скорее всего `ContentChunk` без фильтра — нужно изменить)
- `packages/api/src/routers/diagnostic.ts` — генератор вопросов не должен тянуть чанки скрытых уроков

### Frontend
- `apps/web/src/components/admin/CourseManager.tsx` — в строке урока кнопка «Скрыть» (ADMIN) / «Скрыть/Показать» (SUPERADMIN), бейдж «Скрыт» (SUPERADMIN only), фильтрация списка по роли
- Новый компонент `apps/web/src/components/admin/HideLessonDialog.tsx` — confirmation dialog (AlertDialog из shadcn)
- Слайдер/тогл «Показать скрытые» в `CourseManager` (SUPERADMIN only)

### Тесты
- `apps/web/tests/` — unit: `toggleLessonHidden` (role check), ADMIN не получает скрытые в `getCourses`, retrieval не возвращает чанки скрытых
- E2E (optional): скрыть → не виден в /learn/<course>, показать обратно

## Пошаговый план реализации

### Шаг 1 — Миграция БД
1. Добавить поля в `Lesson` в schema.prisma
2. `pnpm db:push` (prod VPS через Supabase)
3. `pnpm db:generate`

### Шаг 2 — Backend: admin.ts mutation
1. `toggleLessonHidden({ lessonId, hidden })` — только `adminProcedure`
2. Логируем `hiddenBy = ctx.user.id`, `hiddenAt = hidden ? new Date() : null`

### Шаг 3 — Backend: фильтрация в user-facing запросах
1. `learning.ts` — все `findMany/findFirst` на `Lesson` добавляют `isHidden: false`
2. `ai.ts retrieval` — JOIN с `Lesson` и `WHERE lesson.isHidden = false`. Проверить текущий raw-SQL запрос в `packages/ai/src/retrieval.ts`
3. `diagnostic.ts` — при генерации вопросов тоже фильтровать

### Шаг 4 — Backend: видимость в админке по роли
1. `admin.getCourses` / `getCourseLessons` — если `ctx.user.role === 'ADMIN'`, принудительно `isHidden: false`. Если `SUPERADMIN` — может запросить `includeHidden: true` и получить все
2. `chunkCount` / `lessonCount` в aggregation должны считать только видимые для роли

### Шаг 5 — Frontend: CourseManager
1. Добавить колонку статуса: для SUPERADMIN — бейдж «Скрыт» у hidden уроков
2. Кнопка-иконка «глаз» в строке: ADMIN видит только «скрыть», SUPERADMIN — toggle
3. Для SUPERADMIN — тогл «Показывать скрытые» сверху списка (сохраняется в useState, дёргает query с `includeHidden`)

### Шаг 6 — Frontend: confirmation dialog
1. `HideLessonDialog` на основе `AlertDialog` shadcn
2. Текст: «Скрыть урок "{title}“? После скрытия вы не сможете вернуть его самостоятельно — обратитесь к суперадмину при ошибке.»
3. Для SUPERADMIN текст мягче: «Скрыть урок "{title}“?»
4. Кнопки: «Отмена» / «Скрыть» (destructive variant)

### Шаг 7 — Тесты + деплой
1. Unit: role-based access + filter
2. Локальный smoke: залогиниться как ADMIN (`kolomiets@mpstats.ru`?), скрыть 1 урок, проверить исчезновение
3. Залогиниться как SUPERADMIN, проверить возврат
4. `git commit` → push → deploy на VPS по стандартной процедуре

## Риски / неясности

1. **Retrieval SQL** — если `ContentChunk` запрос идёт raw SQL без JOIN, нужно переписать. Проверить на этапе Шага 3.
2. **Диагностика уже выданная** — `DiagnosticSession.questions` (JSON) содержит копии вопросов с `sourceData.lessonIds`. Живые сессии могут ссылаться на скрытые уроки. Решение: не трогать завершённые/идущие сессии, новые сессии уже не получат вопросы по скрытым чанкам.
3. **Экспресс-курсы** — если прячем весь курс, логичнее флаг `Course.isHidden` тоже. Либо скрывать все уроки курса (массово). **Решение:** добавить `Course.isHidden` тем же миграционным шагом, UI — отдельная кнопка на уровне курса.
4. **SkillProfile score** — если user уже прошёл скрытый урок, скор остаётся. Не пересчитываем.

## Оценка

~4-6 часов разработки + 1 час деплой/smoke.

## Критерий готовности

- [ ] Миграция применена в prod
- [ ] ADMIN может скрыть урок через confirm-диалог
- [ ] После скрытия ADMIN не видит урок нигде
- [ ] SUPERADMIN видит скрытые с маркером, может вернуть
- [ ] Пользователь не видит скрытый урок на `/learn`, в learning path, в диагностике
- [ ] Retrieval не возвращает чанки скрытых уроков (ручная проверка через AI-ответ)
- [ ] `Course.isHidden` для скрытия раздела «Экспресс-курсы»
- [ ] Unit-тесты проходят
- [ ] Задеплоено на platform.mpstats.academy
