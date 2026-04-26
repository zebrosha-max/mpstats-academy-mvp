# Phase 49: Lesson Materials — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Brainstorming session (user + orchestrator, 2026-04-26)
**Trigger:** Методологи предоставили список из 120 материалов (Google Sheet `1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0`, вкладка «Доп материалы к урокам»). Селлеры и юзеры на текущей платформе спрашивают про «материалы из видео», которые были на прошлой LMS — презентации, таблицы юнит-экономики, чек-листы, шаблоны.

<domain>
## Phase Boundary

Дать клиентам доступ к учебным материалам (презентации, таблицы расчётов, чек-листы, памятки, ссылки на доп.сервисы), привязанным к конкретным урокам платформы. Дать методологам админку для управления этими материалами после первичной заливки из Google Sheet.

**In:**
- Prisma schema: `Material`, `LessonMaterial` (many-to-many), `MaterialType` enum (5 значений)
- One-shot ingest-скрипт: 120 строк Google Sheet → БД с дедупом, fuzzy-match названий уроков, dry-run режимом
- Supabase Storage bucket `lesson-materials` (private, signed URLs с TTL 1ч, доступ через ACL урока)
- tRPC router `material` (CRUD + attach/detach + signed URL endpoints)
- Расширение `learning.getLesson` — отдаёт `materials` в payload, фильтрует по `lesson.locked`
- UI секция «Материалы к уроку» на `/learn/[id]` (карточки, иконки по типу, CTA-кнопка)
- Админка `/admin/content/materials` — список с фильтрами, create/edit с гибридом URL-or-Upload, multi-attach к урокам
- Yandex Metrika events: `MATERIAL_OPEN`, `MATERIAL_SECTION_VIEW`
- Cron на orphan-файлы в Storage (раз в сутки)

**Out:**
- RAG-индексация контента материалов (PDF/Docs/Sheets parsing → embeddings → AI-чат) — отрезано пользователем как overengineering (заставит уйти от GPT-4.1 Nano к агентным пайплайнам)
- Каталог standalone-материалов в Library (`/learn` хаб) — поле `isStandalone` хранится в БД, UI добавим в Phase 47 или отдельной фазой
- Bulk-импорт через CSV в админке (одноразового ingest-скрипта достаточно)
- Версионность материалов (история правок) — только `updatedAt`
- Health-check внешних ссылок (мониторинг 404 на Google Drive)
- Watermark/PDF protection для платных материалов
- Public sharing standalone-материалов как lead magnet
- Двунаправленный sync с Google Sheet после bootstrap

**Demo-кейс для проверки в конце фазы:**
1. Методолог логинится в `/admin/content/materials`, создаёт новый материал «Шаблон ABC-анализа» (тип: CALCULATION_TABLE, источник: загрузка XLSX-файла), CTA «Скачать шаблон»
2. В той же форме прикрепляет материал к 3 урокам через multi-select
3. Юзер с активной подпиской открывает один из этих уроков на `/learn/[id]`
4. Видит секцию «Материалы к уроку» с карточкой — иконка таблицы, фиолетовый акцент, кнопка «Скачать шаблон»
5. Клик по кнопке → открывается signed URL из Supabase Storage, файл скачивается
6. Тот же урок без подписки (после исчерпания 2 бесплатных) — секция «Материалы к уроку» вообще не рендерится
7. Yandex Metrika получает событие `MATERIAL_OPEN`

</domain>

<decisions>
## Implementation Decisions

### Data Model

- **D-01: Many-to-many через `LessonMaterial` join.** Один материал → много уроков (в Sheet «Плагин MPSTATS» прикреплён к 9 урокам, «Таблица Анализ конкурентов» — к 5). Правка URL в одном месте — обновляется во всех уроках. Альтернатива (дублирование) отклонена.
- **D-02: `MaterialType` enum из ровно 5 значений** — те же, что в Sheet методологов: `PRESENTATION`, `CALCULATION_TABLE`, `EXTERNAL_SERVICE`, `CHECKLIST`, `MEMO`. Новый тип = миграция enum (редкое событие). Free-form тип отклонён — приведёт к зоопарку.
- **D-03: Гибрид URL/Storage на одной таблице.** Поля `externalUrl` и `storagePath` оба nullable, валидация в API: ровно одно непустое (XOR). Prisma CHECK-constraint неудобно — проверяем в Zod схеме на уровне tRPC create/update.
- **D-04: `isStandalone Boolean`** хранится из колонки Sheet «Может ли быть полезен без просмотра урока» (TRUE/FALSE), но в UI этой фазы **не используется**. Задел под будущий каталог в Library без миграции.
- **D-05: `isHidden Boolean`** для soft-delete (паттерн используется уже в `Lesson` и `LessonComment`). Удаление из админки → `isHidden=true`, не физическое удаление.
- **D-06: `order Int` на join-таблице `LessonMaterial`**, не на `Material`. Один материал может быть «третьим» в одном уроке и «первым» в другом.
- **D-07: Дедупликация при ингесте по `(title, externalUrl)`** — те же материалы (тот же URL) переиспользуются, создаётся только новая запись `LessonMaterial`.

### Storage

- **D-08: Bucket `lesson-materials` — приватный**, RLS политик нет, весь доступ через service_role в `material.getSignedUrl`. Альтернатива (public bucket с прямыми URL) отклонена — теряем контроль доступа.
- **D-09: Структура путей** — `{type}/{materialId}/{filename}` (например `presentation/clx123abc/unit-economics.pdf`). Тип в пути для удобства диагностики; реальный path хранится в `Material.storagePath` целиком, никакой конкатенации в коде.
- **D-10: Signed URL TTL = 3600 секунд (1 час).** Достаточно для скачивания и пересмотра, но юзер не может «навсегда» расшарить ссылку. Cache-Control в ответе — `private, max-age=3000` (50 мин, не отдаём почти-просроченный URL).
- **D-11: Upload через signed URL напрямую в Storage, не через Next.js.** Шаги: tRPC `material.requestUploadUrl` возвращает signed PUT URL → frontend `PUT` файла → tRPC `material.create` с `storagePath`. Минует body-limit Next.js, не упирается в RAM сервера.
- **D-12: Лимит 25 MB на файл.** Whitelist MIME: `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/csv`. Whitelist расширений на фронте + повторная проверка MIME на сервере перед выдачей upload URL.
- **D-13: Cron на orphan-файлы.** Раз в сутки находим файлы в bucket без записи в БД, удаляем старше 24 часов. Reuse существующего `apps/web/src/app/api/cron/` паттерна с Sentry checkin.
- **D-14: Атомарность delete** — при `material.delete` сначала удаляем файл из Storage, потом DB record. На failure Storage delete — rollback DB (не удаляем). На failure DB delete — orphan чистится cron'ом.

### Ingest

- **D-15: One-shot скрипт `scripts/ingest-materials.ts`**, не cron, не sync. Запускается вручную: `pnpm tsx scripts/ingest-materials.ts --sheet-id=... --tab="Доп материалы к урокам" --apply`. После Wave 3 Sheet больше не используется как источник правды.
- **D-16: Dry-run по умолчанию.** Без `--apply` — печатает план + 3 отчёта в `scripts/ingest-results/`: `matched.tsv`, `unmatched-lessons.tsv`, `summary.json`. С `--apply` — пишет в БД одной транзакцией на каждый блок урока.
- **D-17: Парсинг блоков уроков.** Первая строка с непустой `lessonName` (col A) открывает блок, последующие строки с пустой A — продолжение того же урока. Section headers (`#1Аналитика для маркетплейсов`) — пропускаем.
- **D-18: Fuzzy-match названий уроков.** `Lesson.title` ищется через: trim → нормализация кавычек («» → ", `“”` → ") → нормализация тире → split по `|` (берём часть до пайпа) → ILIKE substring fallback. Unmatched попадают в `unmatched-lessons.tsv` для ручного review.
- **D-19: GWS CLI используется для чтения Sheet** (`npx @googleworkspace/cli sheets +read`) — OAuth токен `zebrosha@gmail.com` уже настроен. Альтернатива (service account JSON в репо) — отклонена, дополнительной аутентификации не нужно.
- **D-20: Apply делается на staging сначала**, ручная проверка отчётов и spot-check случайных уроков → apply на prod. Между средами БД shared (per Phase 48), фактически apply один раз — но `--dry-run` обязателен перед каждым `--apply`.

### Backend API

- **D-21: Новый tRPC router `material`** в `packages/api/src/routers/material.ts`. Procedures: `list`, `getById`, `create`, `update`, `delete`, `attach`, `detach`, `requestUploadUrl`, `getSignedUrl`. Все admin-only кроме `getSignedUrl` (доступен авторизованным юзерам с проверкой ACL урока).
- **D-22: Расширение `learning.getLesson`** — добавляется `materials` в payload, отсортировано по `LessonMaterial.order`, фильтровано по `material.isHidden=false`. Если `lesson.locked=true` — `materials = []` (даже названия не утекают в HTML).
- **D-23: `material.getSignedUrl` ACL логика.** Найти `LessonMaterial` для материала → проверить хотя бы один прикреплённый `Lesson` доступен юзеру (через `lesson.locked` логику) → если да, выдать signed URL; иначе `FORBIDDEN`.
- **D-24: Permissions.** `list/getById/create/update/delete/attach/detach/requestUploadUrl` — `superadminProcedure` или `adminProcedure` (используем существующий middleware из Phase 31). `getSignedUrl` — `protectedProcedure` (любой залогиненный юзер).
- **D-25: External URL клик не идёт через `getSignedUrl`** — фронт открывает `externalUrl` напрямую через `<a target="_blank">`. Для External Service / Google Drive материалов signed URL не нужен.

### UI — Lesson Page

- **D-26: Расположение секции** — между «Ключевыми тезисами» (`CollapsibleSummary`) и навигационным блоком (`Prev/Complete/Next`) на десктопе. На мобиле — над `MobileChatCommentsTabs`. Это основной поток чтения, материалы должны быть найдены сразу после видео и саммари.
- **D-27: Компонент `LessonMaterials`** в `apps/web/src/components/learning/LessonMaterials.tsx`. Принимает массив материалов, рендерит `<section>` с заголовком «Материалы к уроку» и grid с `MaterialCard`.
- **D-28: `MaterialCard` дизайн** — компактная карточка с иконкой типа (Lucide), accent-цветом фона по типу (presentation: blue, calculation: purple, external_service: orange, checklist: green, memo: gray), названием, опциональным описанием, CTA-кнопкой.
- **D-29: Empty state** — если `materials.length === 0`, секция **не рендерится**. Никаких «Материалов пока нет» — это шум. Методологи постепенно дополняют.
- **D-30: Mobile responsive** — `grid sm:grid-cols-2 gap-3`. На мобиле — одна колонка, на десктопе — две.
- **D-31: Skeleton не нужен** — материалы приходят в том же tRPC payload, что и lesson; отрисовываются вместе с остальным контентом урока.

### UI — Admin Panel

- **D-32: Страница `/admin/content/materials`** — список всех материалов с таблицей (`Иконка типа · Название · Тип · К-во уроков · Standalone? · Hidden? · Действия`), фильтрами (chips по типу, select курса, search input), пагинацией (20/page), кнопкой `+ Добавить материал`.
- **D-33: Create/Edit как одна страница `/admin/content/materials/[id]`** (или модалка — на усмотрение разработчика, но один компонент формы переиспользуется). Поля: название, тип (radio с иконками), source toggle (URL | Upload), CTA-текст, описание (textarea, опц.), `isStandalone` checkbox.
- **D-34: Multi-attach UI** — отдельный блок «Прикреплено к урокам» с Combobox-поиском уроков (имя курса + урока в результатах), drag-handle для `order`, удаление привязки.
- **D-35: Delete с confirmation modal** — soft-delete (`isHidden=true` + удаление файла из Storage, если `storagePath` заполнен).
- **D-36: Bulk-actions** в списке — hide/unhide через checkboxes. Bulk-delete не делаем (избегаем массовых ошибок).

### Access & Security

- **D-37: Гейтинг материалов = гейтинг урока.** Фильтрация на сервере в `learning.getLesson`. Залоченный урок → `materials = []`. Бесплатные уроки (order ≤ 2) → материалы видны всем зарегистрированным.
- **D-38: External URL — известный компромисс.** Google Drive ссылки технически открыты «всем по ссылке», как и сейчас в таблице методологов. Контроль на нашей стороне — не показывать ссылку залоченным юзерам. Если в будущем потребуется жёсткий контроль — мигрируем презентации в Storage.
- **D-39: Storage signed URL — серверная проверка ACL.** Невозможно запросить signed URL без активной подписки на урок, к которому привязан материал.
- **D-40: CSRF / replay protection** не отдельно — уже покрыто tRPC HTTP-only cookies + signed URL TTL.

### Analytics

- **D-41: Yandex Metrika events.** Новые цели в `apps/web/src/lib/analytics/constants.ts`:
  - `MATERIAL_OPEN` — клик по кнопке материала, params: `materialId`, `materialType`, `lessonId`
  - `MATERIAL_SECTION_VIEW` — секция отрисована (Intersection Observer)
- **D-42: CarrotQuest events НЕ делаем** — это поведение в продукте, не в воронке. Для CRM/менеджеров нерелевантно.
- **D-43: Sentry custom span** на `getSignedUrl` (latency Storage API), на ingest-скрипте (per-row processing time) — для dev/ops визуала.

### Documentation

- **D-44: Запись в `/roadmap` (публичный changelog)** — да, делаем. Это видимая клиентами фича («Появились материалы к урокам»). От первого лица, без технички (без упоминания Storage, ingest, админки).
- **D-45: `MAAL/CLAUDE.md` Last Session запись** — стандартная пост-сессионная фиксация.
- **D-46: Memory entry `project_lesson_materials.md`** в `.claude/memory/` — детали ingest-mapping (какие lesson titles попали в unmatched и как пофикшены), schema decisions, gotchas.
- **D-47: Документация для методологов** — короткая инструкция «Как добавить материал в админке» (1 страница в Notion или README в `docs/admin-guides/lesson-materials.md`). Решает раз и навсегда вопрос «куда тыкать», экономит мне время на onboarding методологов.

### Risk Mitigations

- **D-48: Имена уроков в Sheet ≠ `Lesson.title` в БД.** Митигация — fuzzy match (D-18) + dry-run отчёт + ручной mapping CSV для residual.
- **D-49: Дедуп по URL** ломается, если методолог дал ссылку на разные tabs одного Sheet (`?gid=...`). Решение — нормализация URL: query string учитывается (разные `gid` = разные материалы), дедуп по точному match URL.
- **D-50: Methodologist загружает 50MB-файл.** Hard limit 25 MB на frontend + serverside, понятная ошибка в UI до начала upload.
- **D-51: External URL → методолог удалил файл в Drive → клиент видит 404.** Не отслеживаем в этой фазе. Опционально cron health-check ссылок раз в неделю — отложено в out of scope.
- **D-52: Ингест прервался посередине.** Транзакция per блок урока (~1-7 материалов), частичный апплай безопасен — повторный запуск с дедупом не создаст дубликатов.
- **D-53: Migration order** — schema migration ПЕРЕД rebuild docker (lesson `lessons` field не нужен в новых tRPC payload до того, как frontend готов читать его). Pattern из Phase 28 lesson learned (`feedback_schema_migration_order.md`).

### Claude's Discretion

- Wave 2 (Backend API) и Wave 3 (Ingest) могут идти параллельно — они зависят только от Wave 1 (schema).
- Wave 4 (UI урока) и Wave 5 (Админка) тоже могут параллелиться, но имеют общие компоненты (`MaterialCard` может переиспользоваться в админке для preview). Решение — сначала Wave 5 (админка использует raw данные, без card preview), потом Wave 4 (карточка для лесон-страницы и копия в admin для preview если нужно).
- Конкретный layout админки — на усмотрение разработчика, главное — соблюсти декомпозицию полей из D-32 / D-33.
- Cron orphan-файлов (D-13) — низкий приоритет, может уехать в follow-up если время поджимает.

</decisions>

<context>
## Project Context

**Текущее состояние:**
- 422 урока в БД (все 4 курса + skill-уроки из Phase 46)
- Урок имеет `videoUrl` (Kinescope) + summary (AI-generated) + чат + комментарии
- Никаких прикреплённых материалов
- Методологи отдали Google Sheet с 120 материалами на ~65 уроков (далеко не все 422)

**Платформа уже умеет:**
- Soft-hide на сущностях (`Lesson.isHidden`, `LessonComment.isHidden`)
- Admin/SuperAdmin permissions через middleware (Phase 31)
- tRPC роутеры с `adminProcedure`/`superadminProcedure`
- Yandex Metrika events
- Sentry custom spans
- Cron jobs через `/api/cron/*` с GitHub Actions schedule
- Динамические UI-секции на странице урока (Summary, AI-чат, Comments — добавляли инкрементально)

**Платформа НЕ умеет (придётся ввести):**
- Supabase Storage (использовали только PostgreSQL) — bucket setup, RLS, signed URLs
- Many-to-many с `order` на join (есть только 1-к-N)
- Drag-n-drop file upload в админке (есть только текстовые формы)
- Multi-select Combobox с поиском (можем взять shadcn pattern)

**Источники для разработчика:**
- Spec: этот файл (`49-CONTEXT.md`)
- Brainstorming session: чат от 2026-04-26 (orchestrator + user)
- Sample data: Google Sheet `1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0`, вкладка «Доп материалы к урокам»
- Existing patterns: `Lesson` model, `LessonComment` model (soft-hide), tRPC routers `comments`, `learning`, `material` после создания
- UI patterns: `apps/web/src/components/learning/*` (LessonCard, LibrarySection как образец для MaterialCard)
- Admin patterns: `/admin/comments`, `/admin/promo`, `/admin/content` (существующие админ-страницы)
- Storage docs: Supabase Storage Quickstart (частично загружено через context7)

</context>

## Wave Breakdown (Preliminary)

Финальный план (с задачами и subtasks) генерируется через `/gsd-plan-phase`. Здесь — высокоуровневая декомпозиция.

| Wave | Содержание | Зависимости | Параллелизация |
|------|-----------|-------------|----------------|
| **1A** | Prisma schema (Material, LessonMaterial, MaterialType enum) + миграция | — | Параллельно с 1B |
| **1B** | Supabase Storage bucket setup + ручная проверка signed URL | — | Параллельно с 1A |
| **2** | tRPC `material` router (CRUD, attach/detach, signed URLs) + расширение `learning.getLesson` + unit-тесты на ACL | 1A, 1B | Параллельно с 3 |
| **3** | `scripts/ingest-materials.ts` (Sheet → DB) + dry-run + apply на prod | 1A | Параллельно с 2 |
| **4** | UI секция «Материалы к уроку» на `/learn/[id]` + `MaterialCard` + Metrika events | 2 | Параллельно с 5 |
| **5** | Админка `/admin/content/materials` (список, create/edit, multi-attach, upload) | 2 | Параллельно с 4 |
| **6** | E2E тесты (Playwright) + cron orphan-файлов + roadmap entry + memory + deploy на prod | 4, 5 | — |

**Ожидаемая длительность:** 7-10 дней одного разработчика.
