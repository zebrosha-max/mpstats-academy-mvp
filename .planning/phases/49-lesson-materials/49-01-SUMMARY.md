---
phase: 49-lesson-materials
plan: 01
subsystem: database
tags: [prisma, supabase, storage, materials, schema]

requires:
  - phase: 35-lesson-comments
    provides: "soft-hide pattern (isHidden/hiddenBy/hiddenAt) reused in Material"
  - phase: 48-staging-environment
    provides: "shared Supabase DB across staging+prod — db push hits both at once"
provides:
  - "Material model (id, type, title, ctaText, externalUrl|storagePath XOR, isStandalone, isHidden)"
  - "LessonMaterial join (lessonId+materialId unique, order Int for per-lesson sort)"
  - "MaterialType enum (PRESENTATION, CALCULATION_TABLE, EXTERNAL_SERVICE, CHECKLIST, MEMO)"
  - "Lesson.materials reverse relation"
  - "Private Supabase Storage bucket lesson-materials (25 MB limit, MIME whitelist)"
  - "Shared constants in @mpstats/shared (MATERIAL_TYPE_VALUES, MATERIAL_STORAGE_BUCKET, …)"
affects: [49-02-trpc-router, 49-03-ingest, 49-04-lesson-ui, 49-05-admin, 49-06-polish-deploy]

tech-stack:
  added:
    - "Supabase Storage bucket (first use in MAAL beyond avatars)"
  patterns:
    - "XOR на externalUrl/storagePath — валидация в Zod на уровне tRPC create/update (не CHECK constraint)"
    - "order Int на join-таблице, не на Material — один материал может быть «3-м» в одном уроке и «1-м» в другом"
    - "Soft-hide reuses isHidden pattern from Lesson/LessonComment"

key-files:
  created:
    - ".planning/phases/49-lesson-materials/49-01-NOTES.md"
  modified:
    - "packages/db/prisma/schema.prisma (+47 строк: Material, LessonMaterial, MaterialType, Lesson.materials)"
    - "packages/shared/src/types/index.ts (+31 строка: Phase 49 constants)"

key-decisions:
  - "Bucket creation via API (POST /storage/v1/bucket), not Dashboard — reproducible and idempotent"
  - "MIME whitelist на bucket-уровне дублирует frontend whitelist (defense in depth, D-12)"
  - "Smoke-test файл оставлен в bucket — будет почищен cron'ом 49-06 (orphan cleaner)"
  - "Constants в shared, не в db package — UI и tRPC импортируют без затягивания Prisma client"

patterns-established:
  - "Storage bucket setup: POST /storage/v1/bucket with service_role JWT, повтор getBucket() для проверки"
  - "Smoke-test pattern для приватных buckets: upload via service_role → createSignedUrl(3600) → fetch и сверка тела"

requirements-completed:
  - "Phase 49 (D-01..D-14, D-53)"

duration: 31 min
completed: 2026-04-27
---

# Phase 49 Plan 01: Schema + Storage Setup Summary

**Prisma модели Material/LessonMaterial + enum MaterialType добавлены и применены в Supabase, приватный Storage bucket lesson-materials создан (25 MB, MIME whitelist), shared-константы для Phase 49 экспортированы.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-04-27T05:28:20Z
- **Completed:** 2026-04-27T05:59:34Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Prisma schema расширена 3 новыми сущностями: `Material` (универсальная учебная единица с гибридом externalUrl/storagePath), `LessonMaterial` (many-to-many join с `order Int` per-lesson) и `MaterialType` enum (5 значений из методологического Sheet)
- `prisma db push` применил миграцию к shared Supabase (staging+prod одновременно per Phase 48 architecture). Подтверждено через Management API SQL-проб и `prisma.material.count()`.
- Создан приватный Supabase Storage bucket `lesson-materials`: `public: false`, лимит 25 MB, MIME whitelist (pdf/xlsx/docx/csv) — defense in depth перед серверной валидацией.
- Smoke-тест end-to-end: upload через service_role → createSignedUrl(3600s) → fetch вернул 200 OK с корректным телом. Signed URL flow готов к использованию в Wave 2 (`material.getSignedUrl`).
- Shared-константы (`MATERIAL_TYPE_VALUES`, `MATERIAL_TYPE_LABELS`, `MATERIAL_ALLOWED_MIME_TYPES`, `MATERIAL_MAX_FILE_SIZE`, `MATERIAL_SIGNED_URL_TTL`, `MATERIAL_STORAGE_BUCKET`) экспортированы из `@mpstats/shared` — UI и tRPC импортируют без зависимости от Prisma client.

## Task Commits

1. **Task 1: schema + Lesson.materials relation** — `7697186` (feat)
2. **Task 2: prisma db push + generate** — `e297be6` (chore)
3. **Task 3: bucket + smoke-test + shared constants + NOTES.md** — `534e8f5` (feat)

## Files Created/Modified

- `packages/db/prisma/schema.prisma` — добавлен блок `LESSON MATERIALS` (Material, LessonMaterial, MaterialType, +1 строка `materials LessonMaterial[]` в model Lesson)
- `packages/shared/src/types/index.ts` — секция `LESSON MATERIALS (Phase 49)` с 7 экспортами
- `.planning/phases/49-lesson-materials/49-01-NOTES.md` — журнал шагов: schema, bucket params, smoke-test результат, экспортированные константы (для воспроизводимости/отката)

## Decisions Made

- **D-08 / D-10 / D-12 honored as planned:** bucket private, signed URL TTL 1h, 25 MB лимит, MIME whitelist (pdf, xlsx, docx, csv).
- **Bucket идемпотентность:** API вернул `409 Duplicate` при повторе — это OK, т.к. предыдущая попытка уже создала bucket с правильными параметрами (verified через `getBucket`). В скрипте/доке отмечено что 409 не ошибка.
- **Schema migration ordering (D-53):** аддитивные таблицы — безопасно применять до rebuild docker, никакое существующее поведение не ломается. Wave 4 (UI) не упадёт, потому что `learning.getLesson` не отдаёт `materials` до Wave 2.

## Deviations from Plan

None - plan executed exactly as written. Все 3 задачи выполнены строго по acceptance criteria, без auto-fix Rule 1/2/3 правок.

Единственный «отход» — bucket уже существовал на момент Step 1 (создан в предыдущей попытке/сессии, видимо). Поведение `POST /storage/v1/bucket` идемпотентное (409 на duplicate, без изменений), параметры через `getBucket('lesson-materials')` проверены — соответствуют плану. Не считаю это deviation, т.к. итоговое состояние соответствует контракту таски.

## Issues Encountered

- `pnpm exec prisma` из корня репо не разрешает CLI (Prisma stays in `packages/db/`). Решение — `cd packages/db && pnpm exec prisma validate`. Разовый отход от текста плана, на функциональность не влияет.
- Node 24 на Windows бросает `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` после `process.exit(0)` в скриптах с `@supabase/supabase-js`. Косметическое — output корректный, exit code 0. Не блокирует.
- Smoke-test использует `text/csv` (есть в whitelist), а не `text/plain` как в примере плана — потому что bucket жёстко фильтрует MIME. Эквивалентная проверка, тот же контракт.

## User Setup Required

None - no external service configuration required. Bucket создан и проверен полностью автоматически через Storage API + service_role.

## Next Phase Readiness

- **Wave 2 (49-02 tRPC router) — готова к старту.** Prisma client сгенерирован с типами `Material`/`LessonMaterial`/`MaterialType`, импортируется напрямую в `packages/api`. Можно писать procedures `list/create/getSignedUrl/...`.
- **Wave 3 (49-03 ingest) — готова к старту параллельно с 49-02.** Schema есть, dedup-логика по `(title, externalUrl)` будет писать в готовые таблицы.
- **Blockers:** нет.
- **Concerns:** Smoke-test файл `smoke/test-1777269178053.csv` остался в bucket — нужен cron orphan-cleaner из Wave 6 (49-06), либо ручная зачистка перед прод-запуском фазы.

## Self-Check: PASSED

- File checks:
  - `[ -f packages/db/prisma/schema.prisma ]` → FOUND
  - `[ -f packages/shared/src/types/index.ts ]` → FOUND
  - `[ -f .planning/phases/49-lesson-materials/49-01-NOTES.md ]` → FOUND
- Commit checks:
  - `git log --oneline | grep 7697186` → FOUND (Task 1)
  - `git log --oneline | grep e297be6` → FOUND (Task 2)
  - `git log --oneline | grep 534e8f5` → FOUND (Task 3)
- Acceptance criteria re-run:
  - `prisma validate` → exit 0 (schema is valid)
  - `prisma.material.count()` → 0
  - `prisma.lessonMaterial.count()` → 0
  - SQL probe → both `Material`, `LessonMaterial` present
  - `getBucket('lesson-materials').public` → `false`
  - Smoke-test signed URL → fetch 200 OK, body matches uploaded content
  - `grep -c MATERIAL_STORAGE_BUCKET packages/shared/src/types/index.ts` → 1
  - `grep -c PRESENTATION packages/shared/src/types/index.ts` → 2
  - NOTES.md содержит секцию `Smoke test` с PASS

---
*Phase: 49-lesson-materials*
*Completed: 2026-04-27*
