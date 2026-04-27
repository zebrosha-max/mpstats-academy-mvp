---
phase: 49-lesson-materials
plan: 02
subsystem: backend
tags: [trpc, materials, acl, supabase-storage, vitest]

requires:
  - phase: 49-01-schema-storage
    provides: "Material/LessonMaterial models, MaterialType enum, lesson-materials bucket, shared constants"
  - phase: 31-admin-roles
    provides: "adminProcedure / superadminProcedure middleware"
  - phase: 20-paywall
    provides: "checkLessonAccess helper (subscription/free-lesson/admin-bypass logic)"
provides:
  - "tRPC materialRouter with 9 procedures (list, getById, create, update, delete, attach, detach, requestUploadUrl, getSignedUrl)"
  - "ACL-protected getSignedUrl (FORBIDDEN if no accessible attached lesson)"
  - "learning.getLesson payload extended with materials[] (filtered by lesson.locked)"
  - "Vitest test runner setup in @mpstats/api package"
  - "7 unit tests covering ACL outcomes + XOR input validation"
affects: [49-03-ingest, 49-04-lesson-ui, 49-05-admin-panel, 49-06-polish-deploy]

tech-stack:
  added:
    - "vitest 2.1.9 — unit test runner in @mpstats/api (devDep)"
  patterns:
    - "Soft Sentry contract: optional `require('@sentry/nextjs')` with noop fallback to keep @mpstats/api decoupled from Next-only deps"
    - "z.nativeEnum(MaterialType) over z.enum(stringConst[]) — proper Prisma enum typing for create input"
    - "DB-level isHidden filter on related lessons (W#1 perf)"
    - "Public-safe payload: storagePath replaced with `hasFile: boolean` in learning.getLesson"

key-files:
  created:
    - "packages/api/src/routers/material.ts (493 lines)"
    - "packages/api/src/routers/__tests__/material.test.ts (180 lines, 7 tests)"
    - "packages/api/vitest.config.ts"
    - ".planning/phases/49-lesson-materials/49-02-SUMMARY.md"
  modified:
    - "packages/api/src/root.ts (+2: import + mount as `material`)"
    - "packages/api/src/routers/learning.ts (+28: include materials, locked-gate in return)"
    - "packages/api/package.json (+test/test:watch scripts, +vitest devDep)"
    - "pnpm-lock.yaml (vitest deps)"

key-decisions:
  - "[49-02] Sentry as soft-optional require — @mpstats/api stays free of @sentry/nextjs hard-dep; tests run without sentry, prod gets real spans"
  - "[49-02] z.nativeEnum(MaterialType) from @prisma/client (not z.enum cast on string array) — keeps create payload assignable to Prisma input types"
  - "[49-02] requestUploadUrl uses upload-id proxy (Date.now+random), not materialId — avoids two round-trips to Storage; documented compromise vs D-09 (storagePath stays at upload-id-path forever)"
  - "[49-02] DB-level isHidden filter on lessons (where in include) — perf improvement over JS post-fetch filter (W#1)"
  - "[49-02] storagePath never leaves server — public payload exposes `hasFile: boolean` only"
  - "[49-02] Path correction: plan said `packages/api/src/router.ts`, real file is `root.ts` — matched real codebase"
  - "[49-02] Added vitest to @mpstats/api (Rule 3) — package had no test runner; minimal additive change, no architectural impact"

patterns-established:
  - "tRPC router pattern with optional Sentry: try/require(@sentry/nextjs), graceful noop fallback for non-Next contexts (tests, scripts)"
  - "Vitest mock pattern for Supabase service-role client: vi.mock('@supabase/supabase-js') returning stub storage with createSignedUrl/createSignedUploadUrl/remove"
  - "tRPC ACL test pattern: createCaller with mocked prisma + mocked checkLessonAccess, assert TRPCError code via toMatchObject"

requirements-completed:
  - "Phase 49 D-21 (router with 9 procedures)"
  - "Phase 49 D-22 (learning.getLesson returns materials)"
  - "Phase 49 D-23 (getSignedUrl ACL: at least one accessible attached lesson)"
  - "Phase 49 D-24 (admin/super procedures vs protected for getSignedUrl)"
  - "Phase 49 D-25 (external URL bypass — clients open externalUrl directly)"
  - "Phase 49 D-37 (locked → materials=[])"
  - "Phase 49 D-39 (Storage signed URL behind server ACL check)"
  - "Phase 49 D-43 (Sentry custom span on getSignedUrl)"

duration: 6 min
completed: 2026-04-27
---

# Phase 49 Plan 02: tRPC Material Router + Lesson Payload Extension Summary

**Backend для управления учебными материалами готов: tRPC роутер `material` с 9 procedures, ACL на signed URL, расширение `learning.getLesson` с гейтингом по lock, 7 unit-тестов.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-27T06:12:58Z
- **Completed:** 2026-04-27T06:19:05Z
- **Tasks:** 3 (all auto, all green first or after one fix)
- **Files:** 4 created, 4 modified

## Accomplishments

### Procedures shipped (9)

| Procedure | Auth | Purpose |
|-----------|------|---------|
| `list` | adminProcedure | Список материалов с фильтрами (type/courseId/search/includeHidden), курсором, count attached lessons |
| `getById` | adminProcedure | Один материал + все привязки к урокам с титулами курса (для admin edit page) |
| `create` | adminProcedure | Zod-XOR на externalUrl/storagePath, MIME whitelist, createdBy=ctx.user.id |
| `update` | adminProcedure | Partial update + повторная XOR-проверка если оба поля передали |
| `delete` | adminProcedure | Soft-delete (isHidden=true) + Storage remove (D-14, ошибка не откатывает БД — orphan cron подберёт) |
| `attach` | adminProcedure | Upsert LessonMaterial(lessonId+materialId), order Int |
| `detach` | adminProcedure | Delete по composite key |
| `requestUploadUrl` | adminProcedure | Signed PUT URL для прямой загрузки в bucket до создания material (см. compromise ниже) |
| `getSignedUrl` | protectedProcedure | Signed download URL с ACL: хотя бы один прикреплённый видимый урок должен быть доступен юзеру |

### ACL логика `getSignedUrl`

```
material.findUnique({ where: { id }, include: { lessons: { where: { lesson: { isHidden: false } } } } })

if (!material || material.isHidden) → NOT_FOUND
if (!material.storagePath)         → BAD_REQUEST (только externalUrl)
if (lessons.length === 0)          → FORBIDDEN ("not attached to any visible lesson")
for each lesson:
  if checkLessonAccess(user, lesson).hasAccess → return signed URL (TTL 3600s)
fallthrough                          → FORBIDDEN ("no active subscription")
```

`checkLessonAccess` уже включает: free lesson по `order ≤ 2`, COURSE-подписка на этот курс, PLATFORM-подписка, ADMIN/SUPERADMIN bypass.

### `learning.getLesson` payload — что изменилось

Добавлено поле `materials[]` после `hasPlatformSubscription`:

```ts
materials: locked ? [] : [{
  id, type, title, description, ctaText, externalUrl,
  hasFile: boolean,   // ← НЕ storagePath; защита от утечки путей в HTML
  order,
}]
```

- `locked=true` → `materials = []` даже если в БД 5 материалов привязано (D-37)
- `material.isHidden=true` отфильтрованы DB-where (не возвращаются)
- Сортировка по `LessonMaterial.order` ASC

### Test coverage (Vitest, 7/7 passing)

**ACL (4):**
1. FORBIDDEN когда ни один прикреплённый урок не доступен
2. Success (signedUrl=https://signed.example/abc, expiresIn=3600) когда хотя бы один доступен
3. BAD_REQUEST для material без storagePath (только externalUrl)
4. NOT_FOUND для hidden material

**XOR validation (3):**
5. Reject когда оба externalUrl + storagePath
6. Reject когда ни externalUrl, ни storagePath
7. Accept externalUrl-only material → returns id

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1: Router + appRouter wiring | `be969ba` | `feat(49-02): add material tRPC router with 9 procedures + ACL` |
| 2: learning.getLesson extension | `33b67c0` | `feat(49-02): extend learning.getLesson with materials, gated by lock` |
| 3: Vitest setup + 7 unit tests | `c129976` | `test(49-02): add unit tests for material router (ACL + XOR)` |

## Decisions Made

- **Sentry as soft-optional require.** `@mpstats/api` остаётся независимым от `@sentry/nextjs` (Next-only deps, server-only коллизии). В рантайме (Next.js) `require('@sentry/nextjs')` подцепится, в тестах — fallback noop. Чище, чем глобальный peer-dep.
- **`z.nativeEnum(MaterialType)` instead of `z.enum(stringConst as [...])`.** Прямая совместимость с `Prisma.MaterialCreateInput` — без него TS жаловался на `type: string is not assignable to MaterialType`. `MATERIAL_TYPE_VALUES` из @mpstats/shared остаётся для UI/forms (runtime-parity гарантируется prisma generate).
- **`requestUploadUrl` использует upload-id proxy, не materialId.** Документировано в коде (NOTE архитектурный компромисс vs D-09): альтернатива (создать пустой material → upload → update) хуже UX (двойной round-trip). Storage path остаётся `{type}/{upload-id}/{filename}` — это work as expected, signedUrl получает path при getSignedUrl.
- **DB-level isHidden фильтр (perf W#1).** Изначальный план мог фильтровать после fetch — заменили на `where: { lesson: { isHidden: false } }` в include. Меньше payload + корректно при N связанных уроках.
- **`storagePath` никогда не уезжает клиенту.** В `learning.getLesson.materials` отдаём `hasFile: boolean`. Storage path знают только сервер и Storage API.
- **Plan path correction.** План ссылается на `packages/api/src/router.ts`, реальный файл — `root.ts`. Исправил без deviation tracking — это просто опечатка в плане, не архитектурная правка.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @mpstats/api had no test runner**
- **Found during:** Task 3
- **Issue:** Plan требует `pnpm --filter @mpstats/api test` зелёным. В пакете не было vitest devDep, не было `vitest.config.ts`, не было `test` script.
- **Fix:** Добавил vitest 2.1.9 (та же версия что в apps/web, чтоб lock-файл не разбух), создал `vitest.config.ts` (node env, `src/**/*.test.ts`), добавил scripts `test`/`test:watch`.
- **Files modified:** `packages/api/package.json`, `packages/api/vitest.config.ts` (new), `pnpm-lock.yaml`
- **Commit:** `c129976` (вошло одним коммитом с тестами)

**2. [Rule 1 - Bug] Type error: `type: string` not assignable to `MaterialType`**
- **Found during:** Task 1 typecheck
- **Issue:** `z.enum(MATERIAL_TYPE_VALUES as unknown as [string, ...string[]])` возвращает `string`, а `prisma.material.create({ data: { type } })` ожидает enum.
- **Fix:** Заменил на `z.nativeEnum(MaterialType)` с импортом из `@mpstats/db`. `MATERIAL_TYPE_VALUES` из @mpstats/shared остался — теперь `void`-ссылка для устранения unused-warn (он нужен UI).
- **Files modified:** `packages/api/src/routers/material.ts`
- **Commit:** Включено в `be969ba`

### Plan-text discrepancies (не deviation, ок)

- План пишет «Файл 2 — `packages/api/src/router.ts`» — реальный файл `packages/api/src/root.ts`. Применил к реальному пути.
- План в `<read_first>` ссылается на `packages/shared/src/types.ts` — реальный путь `packages/shared/src/types/index.ts` (поправлено в 49-01-SUMMARY).

## Issues Encountered

- **Vitest не установлен в `@mpstats/api`** — не было где запустить тесты. Решение в Rule 3 выше. Альтернатива (положить тесты в `apps/web/tests/api/`) отвергнута: путь жёстко прописан в плане (`packages/api/src/routers/__tests__/material.test.ts`), и логически тесты роутера должны жить с роутером.
- **Prisma create input strict typing.** `z.enum(string-tuple)` возвращает обобщённый `string`, а Prisma ждёт enum. Решение — `z.nativeEnum(MaterialType)`.

## User Setup Required

None — backend-only changes, никаких внешних сервисов конфигурировать не нужно. Bucket уже создан в Phase 49-01, env vars (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`) уже на VPS.

## Next Phase Readiness

- **Wave 3 (49-03 ingest)** — может стартовать. Schema есть с 49-01, append-only ingest пишет напрямую в Material/LessonMaterial.
- **Wave 4 (49-04 lesson UI)** — может стартовать. `learning.getLesson` уже отдаёт `materials[]` payload, фронт получает type-safe payload через tRPC autocomplete.
- **Wave 5 (49-05 admin panel)** — может стартовать. Все 8 admin procedures (`list/getById/create/update/delete/attach/detach/requestUploadUrl`) готовы.
- **Blockers:** нет.
- **Concerns:** `requestUploadUrl` использует upload-id proxy (не materialId), что отличается от «идеального» плана D-09 — нужно учесть в Wave 5 при дизайне формы загрузки (storagePath возвращается из endpoint и кладётся в `material.create({ storagePath })` без модификации).

## Verification (final)

- `pnpm --filter @mpstats/api typecheck` → exit 0
- `pnpm --filter @mpstats/web typecheck` → exit 0
- `pnpm --filter @mpstats/api test` → 7/7 passing (`material.test.ts`)
- `grep -c "material: materialRouter" packages/api/src/root.ts` → 1
- `grep -c "checkLessonAccess" packages/api/src/routers/material.ts` → 2
- `grep -c "where: { lesson: { isHidden: false } }" packages/api/src/routers/material.ts` → 1
- `grep -c "FORBIDDEN" packages/api/src/routers/__tests__/material.test.ts` → 2
- `grep -c "BAD_REQUEST" packages/api/src/routers/__tests__/material.test.ts` → 2
- `wc -l packages/api/src/routers/material.ts` → 493 (требование: ≥250)

## Self-Check: PASSED

- File checks:
  - `packages/api/src/routers/material.ts` → FOUND (493 lines)
  - `packages/api/src/routers/__tests__/material.test.ts` → FOUND
  - `packages/api/vitest.config.ts` → FOUND
  - `packages/api/src/root.ts` → modified (material wired in appRouter)
  - `packages/api/src/routers/learning.ts` → modified (getLesson + materials)
- Commit checks:
  - `git log --oneline | grep be969ba` → FOUND (Task 1)
  - `git log --oneline | grep 33b67c0` → FOUND (Task 2)
  - `git log --oneline | grep c129976` → FOUND (Task 3)
- Acceptance criteria re-run:
  - typecheck api / web → exit 0
  - vitest 7/7 → passing
  - all 9 procedures present, ACL helper invoked, DB-level isHidden filter present, router wired in appRouter

---
*Phase: 49-lesson-materials*
*Completed: 2026-04-27*
