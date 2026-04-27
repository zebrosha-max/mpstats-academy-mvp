# Phase 49 · Plan 01 · Setup Notes

## Schema applied

- Date: 2026-04-27 (commits `7697186` schema add, `e297be6` db push)
- Tables: `Material`, `LessonMaterial`
- Enum: `MaterialType` (5 values: `PRESENTATION`, `CALCULATION_TABLE`, `EXTERNAL_SERVICE`, `CHECKLIST`, `MEMO`)
- Method: `prisma db push` (project uses db push, not migrate — see Phase 16 baseline decision)
- Verification (SQL probe via Supabase Management API):
  ```
  SELECT table_name FROM information_schema.tables
  WHERE table_name IN ('Material', 'LessonMaterial')
  ```
  Result: `[{"table_name":"LessonMaterial"},{"table_name":"Material"}]` — both present.
- Verification (Prisma client):
  - `prisma.material.count()` → `0`
  - `prisma.lessonMaterial.count()` → `0`
  - exit code `0`

## Bucket created

- Name: `lesson-materials`
- Method: `POST /storage/v1/bucket` with `service_role` JWT (reproducible via API, not Dashboard)
- Created at: 2026-04-27T05:47:56.353Z
- Parameters (verified via `getBucket('lesson-materials')`):
  - `public: false`
  - `file_size_limit: 26214400` (25 MB, D-12)
  - `allowed_mime_types`:
    - `application/pdf`
    - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)
    - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
    - `text/csv`
- RLS policies: zero (D-08 — все обращения через `service_role`, ACL логика в `material.getSignedUrl` Wave 2).

## Smoke test

- Test file: `smoke/test-1777269178053.csv`
- Content: `id,value\nhello,phase49\n` (uploaded with `contentType: 'text/csv'`)
- Signed URL TTL: 3600s (D-10)
- Browser/fetch verification: PASS
  - HTTP status: 200
  - Body matches uploaded content (`hello,phase49`)
- Conclusion: bucket приватный, выдача signed URL через service_role работает, TTL 1 час валиден.

## Constants exported

`packages/shared/src/types/index.ts` (через секцию `LESSON MATERIALS (Phase 49)`):
- `MATERIAL_TYPE_VALUES` — readonly tuple из 5 значений enum
- `MaterialTypeValue` — type alias из tuple
- `MATERIAL_TYPE_LABELS` — Record<MaterialTypeValue, string> с RU-локализацией
- `MATERIAL_ALLOWED_MIME_TYPES` — whitelist для frontend и серверной валидации
- `MATERIAL_MAX_FILE_SIZE` — 25 MB (D-12)
- `MATERIAL_SIGNED_URL_TTL` — 3600 (D-10)
- `MATERIAL_STORAGE_BUCKET` — `'lesson-materials'`

Импорт: `import { MATERIAL_TYPE_VALUES, MATERIAL_STORAGE_BUCKET } from '@mpstats/shared'`.

## Cleanup

- Smoke-test файл `smoke/test-1777269178053.csv` оставлен в bucket — будет почищен cron'ом orphan-файлов из Wave 6 (49-06) либо ручным DELETE через service_role при необходимости.
