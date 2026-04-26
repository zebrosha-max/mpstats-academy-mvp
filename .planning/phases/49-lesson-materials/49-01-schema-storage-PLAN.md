---
phase: 49-lesson-materials
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/db/prisma/schema.prisma
  - packages/shared/src/types.ts
  - .planning/phases/49-lesson-materials/49-01-NOTES.md
autonomous: true
requirements:
  - Phase 49 (D-01..D-14, D-53)

must_haves:
  truths:
    - "В Postgres БД (Supabase) есть таблицы Material, LessonMaterial и enum MaterialType"
    - "В Supabase Storage есть приватный bucket lesson-materials"
    - "Можно вручную через service_role положить файл и получить signed URL с TTL 1 час"
  artifacts:
    - path: "packages/db/prisma/schema.prisma"
      provides: "Material, LessonMaterial models, MaterialType enum"
      contains: "model Material"
    - path: "packages/shared/src/types.ts"
      provides: "Shared TS типы MaterialTypeValue + DTO для использования в UI"
    - path: ".planning/phases/49-lesson-materials/49-01-NOTES.md"
      provides: "Чек-лист bucket setup + smoke-test signed URL (для history/reproducibility)"
  key_links:
    - from: "packages/db/prisma/schema.prisma"
      to: "Supabase PostgreSQL"
      via: "prisma db push"
      pattern: "model Material"
    - from: "Supabase Storage"
      to: "service_role клиент"
      via: "bucket lesson-materials"
      pattern: "createSignedUrl"
---

<objective>
Добавить в Prisma schema модели `Material` (универсальная учебная единица) и `LessonMaterial` (join к Lesson), enum `MaterialType` из 5 значений (D-02). Применить миграцию через `prisma db push` (BLOCKING: без этого Wave 2 типы будут устаревшими). Создать в Supabase Storage приватный bucket `lesson-materials` (D-08), zero RLS policies, проверить smoke-тест: положить тестовый файл через service_role, получить signed URL с TTL 1 час, скачать.

Purpose: фундамент для всей фазы 49. Без этой схемы и bucket'а ни tRPC роутер (49-02), ни ingest (49-03) работать не могут.
Output: 3 миграции (Material, LessonMaterial, enum), bucket в Supabase, NOTES.md с чек-листом и сохранённым тест-результатом.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/49-lesson-materials/49-CONTEXT.md
@MAAL/CLAUDE.md
@packages/db/prisma/schema.prisma
@.claude/memory/feedback_schema_migration_order.md
@.claude/memory/reference_supabase_mgmt.md

<interfaces>
<!-- Существующие модели, на которые ссылается Material -->
<!-- Lesson — основной target для LessonMaterial.lessonId -->

From packages/db/prisma/schema.prisma:
```prisma
model Lesson {
  id            String        @id   // например "01_analytics_m01_start_001"
  courseId      String
  title         String
  isHidden      Boolean       @default(false)
  // ... много полей; используется только для @relation
}
```

From packages/api/src/routers/admin.ts (Supabase service_role client pattern):
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

From .claude/memory/feedback_schema_migration_order.md:
- Schema migration ВСЕГДА перед docker rebuild
- Иначе tRPC компилируется на старом Prisma client → false positive в проде
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Material, LessonMaterial models and MaterialType enum to schema.prisma</name>
  <files>packages/db/prisma/schema.prisma</files>
  <read_first>
    - packages/db/prisma/schema.prisma (целиком — изучить стиль соседних моделей: Lesson, LessonComment, PromoCode/PromoActivation для join-pattern)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-01..D-07 — data model decisions)
  </read_first>
  <action>
В файл `packages/db/prisma/schema.prisma` добавить ПЕРЕД секцией `// ============== AI CACHE ==============` (после `LessonComment`) новый блок:

```prisma
// ============== LESSON MATERIALS ==============

enum MaterialType {
  PRESENTATION
  CALCULATION_TABLE
  EXTERNAL_SERVICE
  CHECKLIST
  MEMO
}

model Material {
  id            String       @id @default(cuid())
  type          MaterialType
  title         String
  description   String?      @db.Text
  ctaText       String       // Текст кнопки: "Скачать", "Открыть таблицу", "Перейти" и т.п.
  externalUrl   String?      // Google Drive / Sheets / external service URL
  storagePath   String?      // Supabase Storage path: "{type}/{id}/{filename}"
  fileSize      Int?         // bytes (только для storagePath)
  fileMimeType  String?      // только для storagePath
  isStandalone  Boolean      @default(false) // D-04: задел под Library, в этой фазе не используется
  isHidden      Boolean      @default(false) // D-05: soft-delete
  createdBy     String       // userId автора (методолог/админ)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  lessons       LessonMaterial[]

  @@index([type, isHidden])
  @@index([isHidden])
}

model LessonMaterial {
  id          String    @id @default(cuid())
  lessonId    String
  materialId  String
  order       Int       @default(0) // D-06: order на join, не на Material
  attachedAt  DateTime  @default(now())

  lesson      Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  material    Material  @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@unique([lessonId, materialId])
  @@index([lessonId])
  @@index([materialId])
}
```

Затем в существующей модели `Lesson` (строка ~133) добавить обратную связь — найти строку:
```
  // ContentChunk связь через lessonId (lesson_id) без FK
```
И ПЕРЕД ней добавить:
```
  materials LessonMaterial[]
```

Не трогать ничего другого. Не менять enum SkillCategory. Не менять @@index у Lesson.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm exec prisma validate --schema packages/db/prisma/schema.prisma</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "enum MaterialType" packages/db/prisma/schema.prisma` == 1
    - `grep -c "model Material " packages/db/prisma/schema.prisma` >= 1 (с пробелом, чтобы не считать LessonMaterial)
    - `grep -c "model LessonMaterial" packages/db/prisma/schema.prisma` == 1
    - `grep -c "PRESENTATION" packages/db/prisma/schema.prisma` >= 1
    - `grep -c "CALCULATION_TABLE" packages/db/prisma/schema.prisma` >= 1
    - `grep -c "EXTERNAL_SERVICE" packages/db/prisma/schema.prisma` >= 1
    - `grep -c "CHECKLIST" packages/db/prisma/schema.prisma` >= 1
    - `grep -c "MEMO" packages/db/prisma/schema.prisma` >= 1
    - `grep "materials LessonMaterial\\[\\]" packages/db/prisma/schema.prisma` находит ровно 1 строку (внутри model Lesson)
    - `pnpm exec prisma validate --schema packages/db/prisma/schema.prisma` exit code 0
  </acceptance_criteria>
  <done>Схема Prisma содержит Material/LessonMaterial/MaterialType, валидируется без ошибок, связь Lesson.materials объявлена.</done>
</task>

<task type="auto">
  <name>Task 2: [BLOCKING] Apply migration via prisma db push and generate client</name>
  <files>packages/db/prisma/schema.prisma (no edits, only push), packages/db/node_modules/.prisma (regenerated)</files>
  <read_first>
    - packages/db/prisma/schema.prisma (только что обновлённый файл)
    - .claude/memory/feedback_schema_migration_order.md (правило: миграция ПЕРЕД rebuild docker)
    - MAAL/.env (для DATABASE_URL и DIRECT_URL — НЕ читать значения вслух)
  </read_first>
  <action>
**[BLOCKING]** — без этого шага Wave 2 (49-02) скомпилируется со старым Prisma client'ом и tRPC payload не будет содержать новые поля (false positive в проде, повтор Phase 28 incident).

Из корня репозитория выполнить ПОСЛЕДОВАТЕЛЬНО:

1. `cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL"`
2. `pnpm exec prisma db push --schema packages/db/prisma/schema.prisma --skip-generate`
   - Это применит схему к Supabase напрямую (как делалось в Phase 16, 28, 44 — проект использует `db push`, не `migrate`)
3. `pnpm exec prisma generate --schema packages/db/prisma/schema.prisma`
4. Проверить, что в БД появились таблицы — выполнить через Supabase Management API (см. `.claude/memory/reference_supabase_mgmt.md` для токена):
   ```bash
   node -e "fetch('https://api.supabase.com/v1/projects/saecuecevicwjkpmaoot/database/query', {method:'POST', headers:{Authorization: 'Bearer ' + process.env.SUPABASE_MGMT_TOKEN, 'Content-Type':'application/json'}, body: JSON.stringify({query: \"SELECT table_name FROM information_schema.tables WHERE table_name IN ('Material', 'LessonMaterial')\"})}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))"
   ```
   Должен вернуть оба имени таблиц.

ВАЖНО: НЕ выполнять `docker compose ... build` на этом этапе — деплой делается в Wave 4 (49-06). Эта таска только пишет схему в shared Supabase. Staging и prod увидят новые таблицы сразу (БД shared per Phase 48).
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && node -e "const{PrismaClient}=require('@mpstats/db'); const p=new PrismaClient(); p.material.count().then(c=>{console.log('Material count:', c); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})"</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec prisma db push` завершился с `Your database is now in sync with your Prisma schema.`
    - `pnpm exec prisma generate` завершился с `Generated Prisma Client`
    - SQL-проба возвращает обе таблицы: `Material`, `LessonMaterial`
    - Node-проба `prisma.material.count()` возвращает 0 (таблица существует, пустая) — exit code 0
    - `prisma.lessonMaterial.count()` тоже доступен (можно проверить дополнительно)
  </acceptance_criteria>
  <done>Таблицы Material и LessonMaterial существуют в Supabase, Prisma client сгенерирован с новыми типами.</done>
</task>

<task type="auto">
  <name>Task 3: Create private Supabase Storage bucket "lesson-materials" + smoke-test signed URL</name>
  <files>.planning/phases/49-lesson-materials/49-01-NOTES.md (новый), packages/shared/src/types.ts (если есть, иначе создать)</files>
  <read_first>
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-08, D-09, D-10 — Storage decisions)
    - .claude/memory/reference_supabase_mgmt.md (Management API + service_role key)
    - packages/api/src/routers/admin.ts строки 17-35 (паттерн supabaseAdmin client)
    - packages/api/src/routers/profile.ts строки 355-376 (паттерн avatar Storage path)
  </read_first>
  <action>
**Шаг 1 — Создать bucket через Supabase Storage API (service_role, НЕ через Dashboard вручную, чтобы шаг был воспроизводим):**

Выполнить из корня MAAL:
```bash
node -e "
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://saecuecevicwjkpmaoot.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(SUPABASE_URL + '/storage/v1/bucket', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: 'lesson-materials', name: 'lesson-materials', public: false, file_size_limit: 26214400, allowed_mime_types: ['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/csv'] })
}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d)))
"
```
Ожидаемый результат: `{"name":"lesson-materials"}` или `{"error":"Bucket already exists"}` (оба ОК).

Параметры (из D-08, D-12):
- `public: false` — приватный
- `file_size_limit: 26214400` — 25 MB (25 * 1024 * 1024)
- `allowed_mime_types`: PDF, XLSX, DOCX, CSV (whitelist из D-12)

**Шаг 2 — Smoke-test signed URL:**

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const buf = Buffer.from('hello phase 49 storage smoke test', 'utf-8');
sb.storage.from('lesson-materials').upload('smoke/test-' + Date.now() + '.txt', buf, { contentType: 'text/plain' })
  .then(({ data, error }) => {
    if (error) { console.error('UPLOAD FAIL', error); process.exit(1); }
    console.log('Uploaded:', data.path);
    return sb.storage.from('lesson-materials').createSignedUrl(data.path, 3600);
  })
  .then(({ data, error }) => {
    if (error) { console.error('SIGN FAIL', error); process.exit(1); }
    console.log('Signed URL (TTL 1h):', data.signedUrl);
  });
"
```
Скопировать signedUrl, открыть в браузере — должен вернуть содержимое файла.

**Шаг 3 — Создать `packages/shared/src/types.ts` (если файла нет — создать; если есть — добавить в конец):**

```typescript
// ====== Lesson Materials (Phase 49) ======

export const MATERIAL_TYPE_VALUES = [
  'PRESENTATION',
  'CALCULATION_TABLE',
  'EXTERNAL_SERVICE',
  'CHECKLIST',
  'MEMO',
] as const;

export type MaterialTypeValue = (typeof MATERIAL_TYPE_VALUES)[number];

export const MATERIAL_TYPE_LABELS: Record<MaterialTypeValue, string> = {
  PRESENTATION: 'Презентация',
  CALCULATION_TABLE: 'Таблица расчётов',
  EXTERNAL_SERVICE: 'Внешний сервис',
  CHECKLIST: 'Чек-лист',
  MEMO: 'Памятка',
};

export const MATERIAL_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'text/csv',
] as const;

export const MATERIAL_MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (D-12)
export const MATERIAL_SIGNED_URL_TTL = 3600; // 1 hour (D-10)
export const MATERIAL_STORAGE_BUCKET = 'lesson-materials';
```

**Шаг 4 — Создать `.planning/phases/49-lesson-materials/49-01-NOTES.md`:**

```markdown
# Phase 49 · Plan 01 · Setup Notes

## Schema applied
- Date: <ISO timestamp>
- Tables: Material, LessonMaterial
- Enum: MaterialType (5 values)
- Method: `prisma db push` (project uses db push, not migrate — see Phase 16 baseline decision)

## Bucket created
- Name: lesson-materials
- Public: false
- file_size_limit: 26214400 (25 MB)
- allowed_mime_types: pdf, xlsx, docx, csv

## Smoke test
- Uploaded test file: smoke/test-<timestamp>.txt
- Signed URL TTL: 3600s
- Browser test: PASS / FAIL — <observation>

## Constants exported
- packages/shared/src/types.ts:
  - MATERIAL_TYPE_VALUES, MATERIAL_TYPE_LABELS
  - MATERIAL_ALLOWED_MIME_TYPES, MATERIAL_MAX_FILE_SIZE, MATERIAL_SIGNED_URL_TTL, MATERIAL_STORAGE_BUCKET

## Cleanup
- Smoke-test файл оставляем — будет почищен cron'ом (49-06)
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && node -e "const {createClient}=require('@supabase/supabase-js'); const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); sb.storage.getBucket('lesson-materials').then(({data,error})=>{if(error){console.error(error);process.exit(1)} console.log(JSON.stringify(data)); if(data.public!==false){console.error('Bucket NOT private');process.exit(1)} process.exit(0)})"</automated>
  </verify>
  <acceptance_criteria>
    - `getBucket('lesson-materials')` возвращает объект с `public: false`
    - Файл `packages/shared/src/types.ts` содержит `export const MATERIAL_TYPE_VALUES`
    - `grep -c "MATERIAL_STORAGE_BUCKET" packages/shared/src/types.ts` == 1
    - `grep -c "PRESENTATION" packages/shared/src/types.ts` >= 1
    - `.planning/phases/49-lesson-materials/49-01-NOTES.md` существует
    - В NOTES.md строка `Smoke test` помечена как PASS (после ручной проверки signed URL в браузере)
  </acceptance_criteria>
  <done>Bucket lesson-materials создан приватным, MIME whitelist выставлен, signed URL генерируется и работает в браузере, shared-константы доступны для импорта.</done>
</task>

</tasks>

<verification>
- Schema validated, prisma client сгенерирован с Material/LessonMaterial типами
- Таблицы Material, LessonMaterial видны в Supabase (SQL-проба)
- Bucket lesson-materials в Storage, public=false
- Signed URL TTL 1h работает в браузере
- packages/shared экспортирует MATERIAL_TYPE_VALUES и константы для tRPC + UI
</verification>

<success_criteria>
1. `pnpm exec prisma validate` exit 0
2. `prisma.material.count()` возвращает число (0)
3. `getBucket('lesson-materials').public === false`
4. Smoke-test signed URL открывается в браузере, возвращает test-content
5. NOTES.md зафиксировал шаги для возможного отката/воспроизведения
</success_criteria>

<output>
After completion, create `.planning/phases/49-lesson-materials/49-01-SUMMARY.md` documenting:
- What schema/enum was added
- Bucket parameters
- Result of smoke test
- Path to shared types
</output>
