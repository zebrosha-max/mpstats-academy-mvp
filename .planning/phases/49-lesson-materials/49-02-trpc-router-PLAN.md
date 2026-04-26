---
phase: 49-lesson-materials
plan: 02
type: execute
wave: 2
depends_on: ['49-01']
files_modified:
  - packages/api/src/routers/material.ts
  - packages/api/src/router.ts
  - packages/api/src/routers/learning.ts
  - packages/api/src/routers/__tests__/material.test.ts
autonomous: true
requirements:
  - Phase 49 (D-21..D-25, D-37, D-39, D-43)

must_haves:
  truths:
    - "Существует tRPC роутер material с 9 procedures"
    - "Авторизованный юзер с подпиской может получить signed URL для материала"
    - "Залоченный урок не отдаёт materials в payload getLesson"
    - "Все CRUD-procedures отбиваются для роли USER (FORBIDDEN)"
  artifacts:
    - path: "packages/api/src/routers/material.ts"
      provides: "tRPC router materialRouter"
      exports: ["materialRouter"]
      min_lines: 250
    - path: "packages/api/src/router.ts"
      provides: "appRouter с подключённым material"
    - path: "packages/api/src/routers/learning.ts"
      provides: "getLesson возвращает materials"
    - path: "packages/api/src/routers/__tests__/material.test.ts"
      provides: "Unit-тесты на ACL и валидацию"
  key_links:
    - from: "packages/api/src/router.ts"
      to: "materialRouter"
      via: "router({ ..., material: materialRouter })"
      pattern: "material: materialRouter"
    - from: "material.getSignedUrl"
      to: "checkLessonAccess"
      via: "ACL чек прикреплённых уроков"
      pattern: "checkLessonAccess"
---

<objective>
Создать tRPC роутер `material` (9 procedures: list, getById, create, update, delete, attach, detach, requestUploadUrl, getSignedUrl) — это backend-API для админки и страницы урока. Расширить `learning.getLesson` — возвращать `materials[]` в payload, фильтровать по `isHidden=false`, обнулять при `lesson.locked=true` (D-37). Покрыть ACL и валидацию unit-тестами (Vitest).

Purpose: единая точка управления материалами + безопасная выдача signed URL (D-23 — без активной подписки на хотя бы один прикреплённый урок — FORBIDDEN).
Output: 4 модифицированных/новых файла, ~270 LoC роутера + 80 LoC тестов.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/49-lesson-materials/49-CONTEXT.md
@.planning/phases/49-lesson-materials/49-01-SUMMARY.md
@MAAL/CLAUDE.md
@packages/api/src/trpc.ts
@packages/api/src/routers/comments.ts
@packages/api/src/routers/learning.ts
@packages/api/src/routers/admin.ts
@packages/api/src/utils/db-errors.ts
@packages/shared/src/types.ts

<interfaces>
<!-- Контракты, которые нужны материалу -->

From packages/api/src/trpc.ts:
```typescript
export const protectedProcedure: ...;  // требует ctx.user
export const adminProcedure: ...;       // ADMIN или SUPERADMIN
export const superadminProcedure: ...;  // только SUPERADMIN
```

From packages/api/src/routers/learning.ts (existing helper):
```typescript
import { checkLessonAccess } from '../utils/access';
// checkLessonAccess(userId, { order, courseId }, prisma)
//   -> { hasAccess: boolean, hasPlatformSubscription: boolean }
```

From packages/shared/src/types.ts (созданные в 49-01):
```typescript
export const MATERIAL_TYPE_VALUES: readonly [...];  // 5 значений
export type MaterialTypeValue = ...;
export const MATERIAL_ALLOWED_MIME_TYPES: readonly [...];
export const MATERIAL_MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MATERIAL_SIGNED_URL_TTL = 3600;
export const MATERIAL_STORAGE_BUCKET = 'lesson-materials';
```

From packages/api/src/routers/admin.ts (Supabase client pattern):
```typescript
import { createClient } from '@supabase/supabase-js';
let supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() { /* lazy init с service_role */ }
```

From packages/api/src/router.ts:
```typescript
export const appRouter = router({
  profile: profileRouter,
  diagnostic: diagnosticRouter,
  learning: learningRouter,
  ai: aiRouter,
  comments: commentsRouter,
  billing: billingRouter,
  promo: promoRouter,
  admin: adminRouter,
});
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create material tRPC router with 9 procedures + ACL logic</name>
  <files>packages/api/src/routers/material.ts, packages/api/src/router.ts</files>
  <read_first>
    - packages/api/src/routers/comments.ts (паттерн router + protectedProcedure + handleDatabaseError)
    - packages/api/src/routers/admin.ts строки 17-35 (паттерн getSupabaseAdmin lazy client)
    - packages/api/src/routers/learning.ts строки 540-616 (getLesson + checkLessonAccess использование)
    - packages/api/src/router.ts (для подключения нового роутера в appRouter)
    - packages/shared/src/types.ts (созданные константы)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-21..D-25 — требования procedures, D-12, D-37, D-39)
  </read_first>
  <behavior>
    - list: возвращает массив материалов с filters (type, courseId, search, includeHidden) + count attached lessons
    - getById: один материал по id с массивом lessons (для админки edit page)
    - create: zod-валидация XOR(externalUrl, storagePath) (D-03), MIME whitelist (D-12), возвращает созданный
    - update: partial update тех же полей, не даёт переключить тип после создания (избегаем ломки UI)
    - delete: soft-delete (isHidden=true) + удаление файла из Storage если storagePath (D-14, D-35)
    - attach: создать LessonMaterial(lessonId, materialId, order) с unique-проверкой
    - detach: удалить LessonMaterial по lessonId+materialId
    - requestUploadUrl: вернуть signed PUT URL для загрузки в bucket lesson-materials (D-11), с проверкой MIME и size
    - getSignedUrl: ACL — найти все LessonMaterial для materialId, проверить access хотя бы для одного урока через checkLessonAccess; если нет — FORBIDDEN; иначе вернуть signed URL TTL 3600s (D-10, D-23, D-39)
    - admin/super procedures: list/getById/create/update/delete/attach/detach/requestUploadUrl
    - protected procedure: getSignedUrl
  </behavior>
  <action>
**Файл 1 — `packages/api/src/routers/material.ts` (новый, ~280 LoC):**

```typescript
/**
 * Material Router — Lesson learning materials (Phase 49)
 *
 * Procedures:
 *  - list, getById          : adminProcedure (read access)
 *  - create, update, delete : adminProcedure (CUD)
 *  - attach, detach         : adminProcedure (lesson links)
 *  - requestUploadUrl       : adminProcedure (Storage write)
 *  - getSignedUrl           : protectedProcedure (user download with ACL)
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { handleDatabaseError } from '../utils/db-errors';
import { checkLessonAccess } from '../utils/access'; // re-use from Phase 20
import {
  MATERIAL_TYPE_VALUES,
  MATERIAL_ALLOWED_MIME_TYPES,
  MATERIAL_MAX_FILE_SIZE,
  MATERIAL_SIGNED_URL_TTL,
  MATERIAL_STORAGE_BUCKET,
} from '@mpstats/shared';

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service role not configured');
    supabaseAdmin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return supabaseAdmin;
}

// Schemas
const materialTypeSchema = z.enum(MATERIAL_TYPE_VALUES as unknown as [string, ...string[]]);
const mimeSchema = z.enum(MATERIAL_ALLOWED_MIME_TYPES as unknown as [string, ...string[]]);

const createInputSchema = z.object({
  type: materialTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  ctaText: z.string().min(1).max(60),
  externalUrl: z.string().url().optional(),
  storagePath: z.string().optional(),
  fileSize: z.number().int().positive().max(MATERIAL_MAX_FILE_SIZE).optional(),
  fileMimeType: mimeSchema.optional(),
  isStandalone: z.boolean().default(false),
}).refine(
  (d) => Boolean(d.externalUrl) !== Boolean(d.storagePath),
  { message: 'Exactly one of externalUrl or storagePath must be set (D-03)' },
);

const updateInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  ctaText: z.string().min(1).max(60).optional(),
  externalUrl: z.string().url().nullable().optional(),
  storagePath: z.string().nullable().optional(),
  isStandalone: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

export const materialRouter = router({
  // ===== READ =====

  list: adminProcedure
    .input(z.object({
      type: materialTypeSchema.optional(),
      courseId: z.string().optional(),
      search: z.string().optional(),
      includeHidden: z.boolean().default(false),
      limit: z.number().int().min(1).max(100).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const where: any = {};
        if (input.type) where.type = input.type;
        if (!input.includeHidden) where.isHidden = false;
        if (input.search) where.title = { contains: input.search, mode: 'insensitive' };
        if (input.courseId) {
          where.lessons = { some: { lesson: { courseId: input.courseId } } };
        }

        const items = await ctx.prisma.material.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: input.limit,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          include: {
            _count: { select: { lessons: true } },
          },
        });

        const totalCount = await ctx.prisma.material.count({ where });

        return {
          items,
          totalCount,
          nextCursor: items.length === input.limit ? items[items.length - 1].id : null,
        };
      } catch (e) { handleDatabaseError(e); }
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const material = await ctx.prisma.material.findUnique({
          where: { id: input.id },
          include: {
            lessons: {
              orderBy: { order: 'asc' },
              include: {
                lesson: { select: { id: true, title: true, courseId: true, course: { select: { title: true } } } },
              },
            },
          },
        });
        if (!material) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material not found' });
        return material;
      } catch (e) {
        if (e instanceof TRPCError) throw e;
        handleDatabaseError(e);
      }
    }),

  // ===== CREATE / UPDATE / DELETE =====

  create: adminProcedure
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const material = await ctx.prisma.material.create({
          data: { ...input, createdBy: ctx.user.id },
        });
        return material;
      } catch (e) { handleDatabaseError(e); }
    }),

  update: adminProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, ...rest } = input;
        // XOR check on update if both fields touched
        if (rest.externalUrl !== undefined && rest.storagePath !== undefined) {
          if (Boolean(rest.externalUrl) === Boolean(rest.storagePath)) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Exactly one of externalUrl/storagePath required (D-03)' });
          }
        }
        const material = await ctx.prisma.material.update({ where: { id }, data: rest });
        return material;
      } catch (e) {
        if (e instanceof TRPCError) throw e;
        handleDatabaseError(e);
      }
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const material = await ctx.prisma.material.findUnique({ where: { id: input.id } });
        if (!material) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material not found' });

        // D-14: Storage delete first, then DB soft-delete
        if (material.storagePath) {
          const sb = getSupabaseAdmin();
          const { error } = await sb.storage.from(MATERIAL_STORAGE_BUCKET).remove([material.storagePath]);
          if (error) {
            // Don't rollback — orphan cron handles missing files; log but proceed
            Sentry.captureException(error, { tags: { route: 'material.delete', stage: 'storage' } });
          }
        }
        await ctx.prisma.material.update({ where: { id: input.id }, data: { isHidden: true } });
        return { success: true };
      } catch (e) {
        if (e instanceof TRPCError) throw e;
        handleDatabaseError(e);
      }
    }),

  // ===== ATTACH / DETACH =====

  attach: adminProcedure
    .input(z.object({
      materialId: z.string().min(1),
      lessonId: z.string().min(1),
      order: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const link = await ctx.prisma.lessonMaterial.upsert({
          where: { lessonId_materialId: { lessonId: input.lessonId, materialId: input.materialId } },
          create: { lessonId: input.lessonId, materialId: input.materialId, order: input.order },
          update: { order: input.order },
        });
        return link;
      } catch (e) { handleDatabaseError(e); }
    }),

  detach: adminProcedure
    .input(z.object({ materialId: z.string().min(1), lessonId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.prisma.lessonMaterial.delete({
          where: { lessonId_materialId: { lessonId: input.lessonId, materialId: input.materialId } },
        });
        return { success: true };
      } catch (e) { handleDatabaseError(e); }
    }),

  // ===== STORAGE =====

  requestUploadUrl: adminProcedure
    .input(z.object({
      type: materialTypeSchema,
      filename: z.string().min(1).max(200),
      mimeType: mimeSchema,
      fileSize: z.number().int().positive().max(MATERIAL_MAX_FILE_SIZE),
    }))
    .mutation(async ({ input }) => {
      const sb = getSupabaseAdmin();
      // ARCHITECTURAL NOTE (compromise vs D-09):
      // Используем upload-id (Date.now() + random) как proxy для materialId, потому что materialId создаётся
      // только в material.create — а файл нужно загрузить ДО create, чтобы передать storagePath в input.
      // Альтернатива (два round-trips: create empty material → get id → upload → update) хуже UX.
      // Storage path остаётся `{type}/{upload-id}/{filename}` навсегда — материал получит свой id, но в БД
      // storagePath продолжит указывать на upload-id-path. Это работает функционально (signed URL по path),
      // но архитектурно отличается от "идеального" `{type}/{materialId}/{filename}`.
      // Если потребуется миграция — orphan cron не тронет (есть DB-ссылка), вручную можно бэкфилом.
      const tmpId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${input.type.toLowerCase()}/${tmpId}/${safeName}`;
      const { data, error } = await sb.storage.from(MATERIAL_STORAGE_BUCKET).createSignedUploadUrl(storagePath);
      if (error || !data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message || 'Failed to create upload URL' });
      return { storagePath, uploadUrl: data.signedUrl, token: data.token };
    }),

  getSignedUrl: protectedProcedure
    .input(z.object({ materialId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return await Sentry.startSpan({ name: 'material.getSignedUrl', op: 'storage' }, async () => {
        try {
          // PERF (W#1): фильтр isHidden на уровне БД через include where, не JS-фильтр после fetch.
          // Уменьшает payload и работает корректно при N связанных уроках.
          const material = await ctx.prisma.material.findUnique({
            where: { id: input.materialId },
            include: {
              lessons: {
                where: { lesson: { isHidden: false } },
                include: { lesson: { select: { id: true, order: true, courseId: true } } },
              },
            },
          });
          if (!material || material.isHidden) throw new TRPCError({ code: 'NOT_FOUND', message: 'Material not found' });
          if (!material.storagePath) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Material has no storage file (external URL only)' });

          // D-23 ACL: at least one attached non-hidden lesson must be accessible
          if (material.lessons.length === 0) throw new TRPCError({ code: 'FORBIDDEN', message: 'Material is not attached to any visible lesson' });

          let allowed = false;
          for (const lm of material.lessons) {
            const access = await checkLessonAccess(ctx.user.id, { order: lm.lesson.order, courseId: lm.lesson.courseId }, ctx.prisma);
            if (access.hasAccess) { allowed = true; break; }
          }
          if (!allowed) throw new TRPCError({ code: 'FORBIDDEN', message: 'No active subscription for any attached lesson' });

          const sb = getSupabaseAdmin();
          const { data, error } = await sb.storage.from(MATERIAL_STORAGE_BUCKET).createSignedUrl(material.storagePath, MATERIAL_SIGNED_URL_TTL);
          if (error || !data) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message || 'Failed to create signed URL' });
          return { signedUrl: data.signedUrl, expiresIn: MATERIAL_SIGNED_URL_TTL };
        } catch (e) {
          if (e instanceof TRPCError) throw e;
          handleDatabaseError(e);
        }
      });
    }),
});
```

**Файл 2 — `packages/api/src/router.ts` (модификация):**

Найти `import { promoRouter }` блок и добавить ниже:
```typescript
import { materialRouter } from './routers/material';
```

В `appRouter = router({ ... })` добавить строку:
```typescript
  material: materialRouter,
```
(после `promo: promoRouter,`).

ВАЖНО: НЕ добавлять `material` в splitLink AI batch — это обычные queries, не AI.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/api typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Файл `packages/api/src/routers/material.ts` существует, ≥250 LoC
    - `grep -c "list:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "getById:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "create:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "update:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "delete:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "attach:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "detach:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "requestUploadUrl:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "getSignedUrl:" packages/api/src/routers/material.ts` >= 1
    - `grep -c "checkLessonAccess" packages/api/src/routers/material.ts` >= 1
    - `grep -c "where: { lesson: { isHidden: false } }" packages/api/src/routers/material.ts` >= 1 (W#1 — DB-level фильтр, не JS)
    - `grep -c "material: materialRouter" packages/api/src/router.ts` == 1
    - `pnpm --filter @mpstats/api typecheck` exit 0
  </acceptance_criteria>
  <done>Router material подключён, типизация чистая, все 9 procedures экспортированы, фильтр isHidden на уровне БД (perf).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend learning.getLesson to include materials, gated by lock</name>
  <files>packages/api/src/routers/learning.ts</files>
  <read_first>
    - packages/api/src/routers/learning.ts строки 547-616 (текущий getLesson)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-22, D-37 — locked → materials=[])
  </read_first>
  <behavior>
    - getLesson возвращает дополнительное поле `materials: MaterialPublic[]`
    - Для locked=true → materials=[] (даже названия не утекают в HTML)
    - Для unlocked → массив отсортированный по LessonMaterial.order asc
    - Только материалы с isHidden=false
    - Включает поля: id, type, title, description, ctaText, externalUrl, hasFile (bool — НЕ отдаём storagePath клиенту, только наличие)
  </behavior>
  <action>
В `packages/api/src/routers/learning.ts`:

**Шаг 1** — в include блоке `getLesson` (строка ~554) добавить `materials` рядом с `progress`:

```typescript
include: {
  course: { /* без изменений */ },
  progress: { /* без изменений */ },
  materials: {
    where: { material: { isHidden: false } },
    orderBy: { order: 'asc' },
    include: {
      material: {
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          ctaText: true,
          externalUrl: true,
          storagePath: true,
        },
      },
    },
  },
},
```

**Шаг 2** — в return блоке (строка ~590) добавить поле `materials` ПОСЛЕ `hasPlatformSubscription`:

```typescript
return {
  lesson: { /* без изменений */ },
  course: { /* без изменений */ },
  nextLesson: nextLessonNav,
  prevLesson: prevLessonNav,
  totalLessonsInCourse: courseLessons.length,
  currentLessonNumber: currentIndex + 1,
  hasPlatformSubscription: access.hasPlatformSubscription,
  // D-37: locked lesson → empty materials, не утекают даже метаданные
  materials: locked ? [] : lesson.materials.map(lm => ({
    id: lm.material.id,
    type: lm.material.type,
    title: lm.material.title,
    description: lm.material.description,
    ctaText: lm.material.ctaText,
    externalUrl: lm.material.externalUrl,
    hasFile: Boolean(lm.material.storagePath), // не отдаём path клиенту
    order: lm.order,
  })),
};
```

Не трогать остальные procedures файла. Не модифицировать `getNextLesson`, `getRecommendedPath` etc.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/api typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "materials: locked ? \\[\\]" packages/api/src/routers/learning.ts` находит ровно 1 строку
    - `grep -n "materials: {" packages/api/src/routers/learning.ts` находит как минимум 1 строку (новый include)
    - `grep -c "hasFile: Boolean" packages/api/src/routers/learning.ts` == 1
    - `pnpm --filter @mpstats/api typecheck` exit 0
    - В тестовой ручной проверке: открыть Prisma Studio, привязать материал к Lesson через таблицу LessonMaterial, дёрнуть getLesson — поле materials не пустое; пометить lesson как locked (мокать access.hasAccess=false) — materials = []
  </acceptance_criteria>
  <done>getLesson отдаёт materials с правильной фильтрацией по locked, storagePath не утекает в payload.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Unit tests for ACL (getSignedUrl) + XOR validation (create)</name>
  <files>packages/api/src/routers/__tests__/material.test.ts</files>
  <read_first>
    - packages/api/src/routers/__tests__/comments.test.ts если существует (паттерн mock prisma + tRPC caller)
    - packages/api/src/routers/material.ts (только что созданный)
    - packages/api/vitest.config.ts (как в Phase 35)
  </read_first>
  <behavior>
    - Test 1: getSignedUrl без активной подписки → throws FORBIDDEN
    - Test 2: getSignedUrl с подпиской на free lesson (order=1) → returns signedUrl
    - Test 3: getSignedUrl для материала только с externalUrl (no storagePath) → throws BAD_REQUEST
    - Test 4: getSignedUrl для hidden material → throws NOT_FOUND
    - Test 5: create с externalUrl + storagePath одновременно → throws (Zod refine fails)
    - Test 6: create без externalUrl и без storagePath → throws (Zod refine fails)
    - Test 7: create только с externalUrl → success
  </behavior>
  <action>
Создать `packages/api/src/routers/__tests__/material.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Мокаем Supabase client — не делаем реальные сетевые вызовы в unit-тестах
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example/abc' }, error: null }),
        createSignedUploadUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://upload.example/xyz', token: 'tok' }, error: null }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}));

vi.mock('../../utils/access', () => ({
  checkLessonAccess: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  startSpan: (_o: any, fn: any) => fn(),
}));

import { materialRouter } from '../material';
import { checkLessonAccess } from '../../utils/access';

function makeCtx(overrides: any = {}) {
  return {
    user: { id: 'user-1' },
    prisma: {
      material: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      lessonMaterial: {
        upsert: vi.fn(),
        delete: vi.fn(),
      },
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
      },
      ...overrides.prisma,
    },
    ...overrides,
  } as any;
}

// Note: lessons теперь приходят УЖЕ отфильтрованными (DB-level isHidden=false), поэтому
// в моках возвращаем массив без hidden — мокаем как Prisma вернёт после where-фильтра.
const VISIBLE_LESSON = { id: 'l-1', order: 1, courseId: 'c-1' };

describe('material.getSignedUrl ACL', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws FORBIDDEN when no attached lesson is accessible', async () => {
    const ctx = makeCtx();
    ctx.prisma.material.findUnique.mockResolvedValue({
      id: 'm-1', isHidden: false, storagePath: 'pdf/m-1/file.pdf',
      lessons: [{ lesson: VISIBLE_LESSON }],
    });
    (checkLessonAccess as any).mockResolvedValue({ hasAccess: false, hasPlatformSubscription: false });

    const caller = materialRouter.createCaller(ctx);
    await expect(caller.getSignedUrl({ materialId: 'm-1' })).rejects.toThrow(TRPCError);
  });

  it('returns signed URL when at least one attached lesson is accessible', async () => {
    const ctx = makeCtx();
    ctx.prisma.material.findUnique.mockResolvedValue({
      id: 'm-1', isHidden: false, storagePath: 'pdf/m-1/file.pdf',
      lessons: [{ lesson: VISIBLE_LESSON }],
    });
    (checkLessonAccess as any).mockResolvedValue({ hasAccess: true, hasPlatformSubscription: true });

    const caller = materialRouter.createCaller(ctx);
    const result = await caller.getSignedUrl({ materialId: 'm-1' });
    expect(result.signedUrl).toBe('https://signed.example/abc');
    expect(result.expiresIn).toBe(3600);
  });

  it('throws BAD_REQUEST for material without storagePath', async () => {
    const ctx = makeCtx();
    ctx.prisma.material.findUnique.mockResolvedValue({
      id: 'm-1', isHidden: false, storagePath: null, externalUrl: 'https://drive.google.com/foo',
      lessons: [{ lesson: VISIBLE_LESSON }],
    });
    const caller = materialRouter.createCaller(ctx);
    await expect(caller.getSignedUrl({ materialId: 'm-1' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws NOT_FOUND for hidden material', async () => {
    const ctx = makeCtx();
    ctx.prisma.material.findUnique.mockResolvedValue({ id: 'm-1', isHidden: true, lessons: [] });
    const caller = materialRouter.createCaller(ctx);
    await expect(caller.getSignedUrl({ materialId: 'm-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('material.create XOR validation', () => {
  it('rejects when both externalUrl and storagePath are set', async () => {
    const ctx = makeCtx();
    const caller = materialRouter.createCaller(ctx);
    await expect(caller.create({
      type: 'PRESENTATION', title: 'X', ctaText: 'Скачать',
      externalUrl: 'https://drive.example/a', storagePath: 'pdf/x/y.pdf',
    } as any)).rejects.toThrow();
  });

  it('rejects when neither externalUrl nor storagePath are set', async () => {
    const ctx = makeCtx();
    const caller = materialRouter.createCaller(ctx);
    await expect(caller.create({
      type: 'PRESENTATION', title: 'X', ctaText: 'Скачать',
    } as any)).rejects.toThrow();
  });

  it('accepts externalUrl-only material', async () => {
    const ctx = makeCtx();
    ctx.prisma.material.create.mockResolvedValue({ id: 'm-new' });
    const caller = materialRouter.createCaller(ctx);
    const r = await caller.create({
      type: 'EXTERNAL_SERVICE', title: 'Plugin MPSTATS', ctaText: 'Установить',
      externalUrl: 'https://mpstats.io/plugin',
    } as any);
    expect(r.id).toBe('m-new');
  });
});
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/api test -- material.test</automated>
  </verify>
  <acceptance_criteria>
    - Файл `packages/api/src/routers/__tests__/material.test.ts` существует
    - Тест-команда `pnpm --filter @mpstats/api test -- material.test` exit 0
    - Все 7 тестов pass (ACL: 4, XOR: 3)
    - `grep -c "FORBIDDEN" packages/api/src/routers/__tests__/material.test.ts` >= 1
    - `grep -c "BAD_REQUEST" packages/api/src/routers/__tests__/material.test.ts` >= 1
  </acceptance_criteria>
  <done>Unit-тесты на ACL (FORBIDDEN/NOT_FOUND/BAD_REQUEST) и XOR (create with both/none/only-external) проходят.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @mpstats/api typecheck` exit 0
- `pnpm --filter @mpstats/api test -- material.test` 7/7 passing
- `pnpm --filter @mpstats/web typecheck` exit 0 (если задеваются типы из learning.getLesson)
- Manually via Prisma Studio: insert dummy Material + LessonMaterial → query getLesson → materials non-empty
</verification>

<success_criteria>
1. material router в appRouter (visible в trpc client autocomplete)
2. learning.getLesson возвращает materials с правильной фильтрацией по locked
3. ACL unit-тесты проходят
4. Никакая из admin procedures не работает для USER роли
5. storagePath не утекает в payload getLesson (только hasFile boolean)
</success_criteria>

<output>
After completion, create `.planning/phases/49-lesson-materials/49-02-SUMMARY.md` documenting:
- 9 procedures и их permissions
- ACL-логика getSignedUrl
- Изменения в learning.getLesson payload schema
- Покрытие тестами
- Известный архитектурный компромисс: requestUploadUrl использует upload-id как proxy для materialId (см. inline-комментарий в коде, отличие от D-09 для UX)
</output>
</content>
</invoke>
