# План: 17 новых уроков — транскрибация → RAG → Kinescope → платформа + переход к skill-центричной модели

**Дата:** 2026-04-20
**Тип:** Контент + архитектурная эволюция
**Статус:** Planned

## Цель

Провести полный pipeline для 17 новых уроков с Яндекс.Диска и **одновременно** начать архитектурный переход от курс-центричной модели к skill-центричной. Урок должен принадлежать **навыку** (skill / topic cluster), а не конкретному курсу. Один навык (например, «Анализ ЦА», «SEO-оптимизация») может проявляться в разных курсах.

## Источник

Google Sheet «Список уроков на доработку…» (<https://docs.google.com/spreadsheets/d/1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0>), колонка «Что нужно сделать» = `Загрузить на платформу`.

### Список 17 новых уроков

**Блок A — Реклама и продвижение (7):**
1. SEO 2026 — как работает выдача на WB и Ozon · https://disk.360.yandex.ru/i/iV6R7mp19CEIdQ
2. Сбор SEO-ключей · https://disk.360.yandex.ru/i/UGz8A192fN1QNg
3. Правильное оформление карточки · https://disk.360.yandex.ru/i/DbdRFXo_69VRog
4. Проверка SEO — индексация, релевантность, ошибки · https://disk.360.yandex.ru/i/31DgTJMp5fD06w
5. Как читать эффективность РК | Метрики РК, 1 · https://disk.360.yandex.ru/i/yaESHGWwUjVI0w
6. Стратегии РК | Метрики РК, 2 · https://disk.360.yandex.ru/i/3c1-0PqClRNnAw
7. Анализ РК — точки просадки и корректировки · https://disk.360.yandex.ru/i/cYH3WMQQ0PqGVg

**Блок B — Аналитика (10):**
1. Этапы анализа ЦА | Анализ ЦА, 1 · https://disk.360.yandex.ru/i/E7CFMLA7fTCy9A
2. Скачиваем отзывы из карточек для анализа ЦА | Анализ ЦА, 2 · https://disk.360.yandex.ru/i/jeaVLLr6jQG7PA
3. Анализируем отзывы с помощью нейросети | Анализ ЦА, 3 · https://disk.360.yandex.ru/i/CPZUcNCgMh2qgQ
4. Анализ вопросов в карточках товара | Анализ ЦА, 4 · https://disk.360.yandex.ru/i/wqwXcpnRsH9jJg
5. Ассортимент как система: где «лежат деньги» · https://disk.360.yandex.ru/i/zvnE9pwZOXvawA
6. Как принимать решения по ассортименту: ABC/XYZ и матрица · https://disk.360.yandex.ru/i/ENriQVprGO2YjA
7. Вероятность продажи и ранжирование товара | Работа с фокусными товарами, 1 · https://disk.360.yandex.ru/i/Qzx2r9z0Xeu-WQ
8. Воронка продаж | Работа с фокусными товарами, 2 · https://disk.360.yandex.ru/i/GZExbil3RrG3Eg
9. Анализ воронки на примере реального кабинета WB | Работа с фокусными товарами, 3 · https://disk.360.yandex.ru/i/aYY5ZJxJSN49uQ
10. Анализ конкурентов через «Сравнение карточек» | Работа с фокусными товарами, 4 · https://disk.360.yandex.ru/i/3gsHZx-WQvLyvw

### Естественные skill-кластеры в этих уроках
- **SEO-оптимизация** (A1–A4) → `MARKETING`
- **Метрики и стратегия РК** (A5–A7) → `MARKETING`
- **Анализ ЦА** (B1–B4) → `ANALYTICS`
- **Управление ассортиментом** (B5–B6) → `ANALYTICS` + `FINANCE`
- **Работа с фокусными товарами / воронка** (B7–B10) → `ANALYTICS`

## Архитектурный сдвиг: от Course к Skill

### Текущая модель
```
Course (01_analytics) → Lesson (order=5) → ContentChunk
                        └── skillCategory (single)
                        └── skillCategories (Json, multi)
                        └── topics (Json, free-form)
```

Lesson жёстко привязан к `courseId` FK. Если тот же урок релевантен в двух курсах — дубликат.

### Целевая модель (минимальный шаг сейчас)
```
Skill (new) — справочник навыков ("SEO-оптимизация", "Анализ ЦА", …)
LessonSkill (join) — many-to-many Lesson ↔ Skill (с weight?)
Course — остаётся как «программа / плейлист», но урок может быть и вне курса
```

**Что меняется на уровне БД (Phase 1 — осторожно):**
- **НЕ удалять** `Course` / `Lesson.courseId` сейчас. `Lesson.courseId` остаётся FK (обратная совместимость).
- **Добавить** таблицы `Skill` и `LessonSkill` (many-to-many).
- **Добавить** флаг `Lesson.isStandalone Boolean @default(false)` — признак того, что урок не имеет курса-родителя (в будущем `courseId` станет `null`-able).

**Что меняется в retrieval / диагностике:**
- Сейчас retrieval фильтрует по `skillCategory` (одна) и topics. Переходим к query по `Skill.slug` через `LessonSkill`.
- Retrieval возвращает чанки, у которых `Lesson` имеет нужный Skill.

### Pragma: 2-фазный подход

- **Фаза 1 (сейчас, в рамках этого плана):** 17 новых уроков заводятся по старой схеме (`courseId` проставляется) **И** получают записи в `Skill` + `LessonSkill`. Тем самым начинаем наполнять справочник, не ломая прод.
- **Фаза 2 (отдельный план, позже):** миграция retrieval/UI/диагностики на skill-first. `Course` становится опциональной группировкой для UI «Курсы».

## Затрагиваемые папки / файлы

### E:\Academy Courses\ (транскрибация pipeline)
- `manifest.json` — дописать новые lessons (инкрементально)
- `scripts/transcribe.py` — использовать `--resume` для обработки только новых
- `scripts/chunk_transcripts.py` — прогнать только по новым
- `scripts/generate_embeddings.py` — только новые
- `scripts/upload_to_supabase.py` — инкрементальный upsert (нужен флаг `--only <lessonIds>` либо фильтр по `transcription_status`)
- **Новое:** `scripts/download_from_yadisk.py` (опционально — ручное скачивание тоже подойдёт)

### MAAL backend
- `packages/db/prisma/schema.prisma` — новые модели `Skill`, `LessonSkill`
- Миграция `add_skill_taxonomy`
- `packages/ai/src/tagging.ts` — расширить, чтобы одновременно тэггить в `Skill` (выбирать из справочника + при необходимости создавать новый)
- `scripts/tag-lessons.ts` — флаг `--only <lessonIds>` + поддержка записи в `LessonSkill`
- `scripts/seed/seed-from-manifest.ts` — инкрементальный режим (`--only` или UPSERT по lesson id)
- `scripts/kinescope-upload.ts` — уже поддерживает batch, проверить
- `scripts/kinescope-mapping.ts` — смаппить 17 новых videoId → Lesson.videoId/videoUrl
- `scripts/seed/seed-skills.ts` (**новое**) — первичный сид справочника Skill: SEO, Метрики РК, Анализ ЦА, Ассортимент, Фокусные товары, Юнит-экономика, Автобиддер, Рекламные стратегии (базовый набор из 10-15 skills под первые 17 уроков + покрытие части старого каталога)

### MAAL frontend — пока не трогаем
В Фазе 1 новые уроки видны обычным способом через `courseId`. Поверх добавим UI «Skill explorer» в Фазе 2.

## Пошаговый план

### Шаг 0 — Подготовка (ты)
- Скачать 17 видео с Я.Диска в `E:\Academy Courses\02_ads\` (7 рекламных) и `E:\Academy Courses\01_analytics\<новый модуль>\` (10 аналитика). Можно создать модули `m08_seo_2026/`, `m09_ad_metrics/`, `m06_ca_analysis/`, `m07_assortment/`, `m08_focus_products/` — финальное именование уточним.

### Шаг 1 — Обновить manifest + imena
1. Прогнать `generate_rename_plan.py` в ручном режиме для 17 новых файлов (транслит имён)
2. Внести в `manifest.json` новые lessons с `transcription_status: "pending"`, указать `skill_category` + **новое поле** `skills: ["seo", "ad_metrics", ...]` (slug-и)

### Шаг 2 — Транскрибация
```
cd E:\Academy Courses\scripts
python run_transcription.py --manifest ../manifest.json --resume
```
Только pending lessons. ~15-30 мин на RTX 5080.

### Шаг 3 — Chunking + embeddings
```
python chunk_transcripts.py --only-new
python generate_embeddings.py --only-new
```
(Если скриптам нужна доработка — добавляю в рамках фазы.)

### Шаг 4 — Миграция БД: Skill + LessonSkill
1. Написать схему:
   ```prisma
   model Skill {
     id           String   @id @default(cuid())
     slug         String   @unique // "seo-optimization", "ca-analysis"
     title        String            // "SEO-оптимизация"
     description  String?
     skillCategory SkillCategory    // ANALYTICS / MARKETING / …
     order        Int      @default(0)
     createdAt    DateTime @default(now())

     lessons      LessonSkill[]
   }

   model LessonSkill {
     lessonId String
     skillId  String
     weight   Int      @default(1) // 1=primary, 2=secondary

     lesson   Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
     skill    Skill  @relation(fields: [skillId], references: [id], onDelete: Cascade)

     @@id([lessonId, skillId])
     @@index([skillId])
   }
   ```
2. Добавить в `Lesson` relation: `skills LessonSkill[]`
3. `prisma db push` + `db generate`

### Шаг 5 — Seed справочника Skill
`scripts/seed/seed-skills.ts` — закрыть первичный набор (~15 skills). Покрыть слоты под новые 17 уроков + основные skill-кластеры старых уроков.

### Шаг 6 — Upload в Supabase (новые уроки + чанки)
1. `pnpm tsx scripts/seed/seed-from-manifest.ts --only <17 lesson IDs>` — создать `Course` (если новый модуль) + `Lesson` записи
2. `ContentChunk` — upload embeddings из `E:\Academy Courses\embeddings\...`

### Шаг 7 — Tagging
1. `pnpm tsx scripts/tag-lessons.ts --only <17 lesson IDs>`
2. Скрипт должен:
   - вызвать LLM (OpenRouter) с транскриптом → получить `skillCategories`, `topics`, `skillLevel`
   - **новое:** сматчить topics со справочником `Skill` (fuzzy + LLM choice), создать `LessonSkill` записи (primary = 1, secondary = 2)
3. Ручная сверка результата в Prisma Studio

### Шаг 8 — Kinescope
1. `pnpm tsx scripts/kinescope-upload.ts --only <17 video paths>` — загрузить видео
2. `pnpm tsx scripts/kinescope-mapping.ts` — смаппить `videoId` → `Lesson.videoUrl`/`videoId` (работает по имени файла)

### Шаг 9 — Smoke + QA
1. На `platform.mpstats.academy` (или staging) — открыть новые уроки в /learn, проверить:
   - видео играет
   - AI-чат по уроку выдаёт ответы из этого транскрипта
   - retrieval возвращает чанки (в Sentry / logs)
2. Запустить диагностику под тестовым пользователем — убедиться, что генерируются вопросы с ссылками на новые уроки

### Шаг 10 — Документация
- Обновить `MAAL/CLAUDE.md` Last Session + memory `.claude/memory/project_new_lessons_<date>.md`
- Обновить `E:\Academy Courses\SESSION_LOG.md`
- Добавить запись в `docs/CHANGELOG-v1.3.md` или новую v1.5

## Риски / неясности

1. **`skillCategory` в `ContentChunk`** — сейчас единичная. В skill-модели это становится «слабой» категорией. Решение: пока оставляем как есть (берётся из primary Skill урока), а в Фазе 2 переходим на JOIN `LessonSkill`.
2. **Тэггинг через LLM ненадёжен** — может назначить скиллы криво. Нужна ручная сверка перед commit'ом. Предусмотреть `--dry-run` в `tag-lessons.ts`.
3. **Именование модулей** — 10 уроков в аналитику делятся на 3 skill-кластера. Как их группировать в модули для UI «старого курса»? Предлагаю временно положить в один новый модуль `m06_focus_and_ca` или подшить в существующие модули по смыслу.
4. **Kinescope API rate-limit** — если загрузка 17 видео падает, делить по 5-7.
5. **Дубликаты со старым контентом** — №73-76 в Аналитике («Как работает выдача на WB и Ozon», «Сбор SEO-ключей» и т.д.) **помечены на удаление** в Google Sheet, а новые SEO 1-4 их заменяют. Важно сначала **скрыть старые** (Задача 1), потом **загрузить новые** — иначе retrieval выдаст оба варианта.

## Зависимости

- **Задача 1 (скрытие уроков) должна быть готова перед Шагом 9**, чтобы скрыть старые 42 урока (включая дубли SEO/Метрики РК) и не путать пользователей.

## Оценка

- Подготовка (Шаг 0-1): 1-2 часа (владелец — ты)
- Шаги 2-3 (транскрибация, embeddings): ~1 час GPU + ~15 мин
- Шаги 4-5 (миграция + сид Skill): 2-3 часа
- Шаги 6-8 (upload + tagging + kinescope): 2-3 часа
- Шаг 9 (smoke): 1 час
- **Итого: ~1 полный рабочий день после того, как видео скачаны**

## Критерий готовности

- [ ] 17 видео скачаны в `E:\Academy Courses\`
- [ ] Транскрибация завершена для 17 уроков (`transcription_status: completed`)
- [ ] Chunks + embeddings сгенерированы
- [ ] Миграция `add_skill_taxonomy` применена в prod
- [ ] Справочник Skill засеян (~15 skills)
- [ ] 17 уроков созданы в БД (`Course` / `Lesson` / `ContentChunk`)
- [ ] Каждому уроку назначен 1-3 `Skill` через `LessonSkill`
- [ ] Видео загружены в Kinescope, `Lesson.videoUrl` проставлены
- [ ] Старые дубли (SEO 73-76 и др.) скрыты через Задачу 1
- [ ] Smoke-тест: AI-чат, retrieval, диагностика работают с новыми уроками
- [ ] Задеплоено на prod

## Что НЕ входит

- Миграция frontend на skill-first UI (Фаза 2, отдельный план)
- Переработка диагностики под skill-first вопросы (Фаза 2)
- Удаление `Course` / `Lesson.courseId` (далёкая перспектива)
