# Phase 52 — Content Triggers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширить Notification Center двумя триггерами: ADMIN_COMMENT_REPLY (методолог отвечает юзеру → визуальный accent) и CONTENT_UPDATE (опционально при публикации урока/материала, с rolling 24h группировкой и таргетингом по фактическому прогрессу).

**Architecture:** Без миграций БД (Phase 51 заложил enum/payload). Логика триггеров живёт в `apps/web/src/lib/notifications/` рядом с существующим `notify.ts` (workspace dep direction: apps/web → packages, never reverse — `cq` клиент в apps/web). Триггеры дёргаются client-side через route handlers: `/api/notifications/notify-reply` (расширяем — supersede ADMIN over COMMENT_REPLY) и новый `/api/admin/notify-content-update`. Админский UI добавляет checkbox в unhide-action и material-attach.

**Tech Stack:** Next.js 14, tRPC, Prisma, Vitest (unit), Playwright (E2E), Tailwind, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-04-30-phase-52-content-triggers-design.md`

---

## File Structure

**Modify:**
- `packages/shared/src/notifications.ts` — extend CONTENT_UPDATE payload schema (lessonIds → mixed items array)
- `apps/web/src/lib/notifications/notify.ts` — modify `notifyCommentReply` to detect admin role + supersede
- `apps/web/src/components/notifications/NotificationItem.tsx` — accent for ADMIN_COMMENT_REPLY, new CONTENT_UPDATE rendering, ym events
- `apps/web/src/app/api/notifications/notify-reply/route.ts` — no API change; helper internally now picks correct type
- `packages/api/src/routers/material.ts` — `attach` returns lesson info (for client-side notify call)
- `apps/web/src/app/(admin)/admin/content/lessons/page.tsx` — notify checkbox on unhide
- `apps/web/src/app/(admin)/admin/content/materials/page.tsx` — notify checkbox on attach
- `docs/admin-guides/lesson-materials.md` — add «Анонс нового контента» section

**Create:**
- `apps/web/src/lib/notifications/targeting.ts` — `findUsersForCourseUpdate(courseId)`
- `apps/web/src/lib/notifications/grouping.ts` — `mergeOrCreateContentUpdate(...)` rolling 24h
- `apps/web/src/lib/notifications/content-update.ts` — `notifyContentUpdate(...)` orchestrator
- `apps/web/src/app/api/admin/notify-content-update/route.ts` — POST endpoint, admin-auth gated
- `apps/web/src/lib/notifications/__tests__/targeting.test.ts`
- `apps/web/src/lib/notifications/__tests__/grouping.test.ts`
- `apps/web/src/lib/notifications/__tests__/admin-comment-reply.test.ts`
- `apps/web/tests/e2e/phase-52-content-update.spec.ts`

---

## Task 1: Extend CONTENT_UPDATE payload schema

**Files:**
- Modify: `packages/shared/src/notifications.ts:29-34`

**Why:** Phase 51 placeholder `lessonIds: string[]` не покрывает D3 (mixed lessons + materials с titles).

- [ ] **Step 1: Update payload union**

In `packages/shared/src/notifications.ts`, replace the `CONTENT_UPDATE` variant (lines 29-34) with:

```ts
  | {
      type: 'CONTENT_UPDATE';
      courseId: string;
      courseTitle: string;
      items: Array<
        | { kind: 'lesson'; id: string; title: string }
        | { kind: 'material'; id: string; lessonId: string; lessonTitle: string; title: string }
      >;
    }
```

(`kind` instead of nested `type` to avoid clash with payload discriminant.)

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: errors in `NotificationItem.tsx` referencing `payload.lessonIds` (we'll fix in Task 7) and any tests using old shape (fix as encountered). No errors in `notify.ts` (it doesn't read CONTENT_UPDATE shape).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/notifications.ts
git commit -m "feat(phase-52): extend CONTENT_UPDATE payload to mixed items"
```

---

## Task 2: Targeting service — findUsersForCourseUpdate

**Files:**
- Create: `apps/web/src/lib/notifications/targeting.ts`
- Create: `apps/web/src/lib/notifications/__tests__/targeting.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/lib/notifications/__tests__/targeting.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { findUsersForCourseUpdate } from '../targeting';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@mpstats/db/client';

describe('findUsersForCourseUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes user with COMPLETED lesson and active sub', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ userId: 'u1' }]);
    const result = await findUsersForCourseUpdate('c1');
    expect(result).toEqual(['u1']);
  });

  it('returns empty array when no targets', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([]);
    const result = await findUsersForCourseUpdate('c1');
    expect(result).toEqual([]);
  });

  it('dedupes user ids', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ userId: 'u1' }, { userId: 'u1' }]);
    const result = await findUsersForCourseUpdate('c1');
    expect(result).toEqual(['u1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/__tests__/targeting.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `apps/web/src/lib/notifications/targeting.ts`:

```ts
/**
 * Targeting service for CONTENT_UPDATE notifications (Phase 52).
 *
 * Returns user IDs eligible to receive a course-content notification.
 * Eligibility (D1):
 *  - Active subscription (status='active', periodEnd > now())
 *  - At least one lesson in course where progress.status = COMPLETED
 *    OR (progress.status = IN_PROGRESS AND watchedPercent >= 50)
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@mpstats/db/client';

export async function findUsersForCourseUpdate(courseId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT DISTINCT lp."userId" AS "userId"
    FROM "LearningPath" lp
    JOIN "LessonProgress" prog ON prog."pathId" = lp.id
    JOIN "Lesson" l ON prog."lessonId" = l.id
    JOIN "Subscription" s ON s."userId" = lp."userId"
    WHERE l."courseId" = ${courseId}
      AND s.status = 'active'
      AND s."periodEnd" > now()
      AND (
        prog.status = 'COMPLETED'
        OR (prog.status = 'IN_PROGRESS' AND prog."watchedPercent" >= 50)
      )
  `);
  // Dedup defense (DISTINCT already enforces, but tests check this)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      out.push(r.userId);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/__tests__/targeting.test.ts`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/notifications/targeting.ts apps/web/src/lib/notifications/__tests__/targeting.test.ts
git commit -m "feat(phase-52): add findUsersForCourseUpdate targeting"
```

---

## Task 3: Grouping logic — mergeOrCreateContentUpdate

**Files:**
- Create: `apps/web/src/lib/notifications/grouping.ts`
- Create: `apps/web/src/lib/notifications/__tests__/grouping.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/notifications/__tests__/grouping.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    course: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@mpstats/db/client';
import { mergeOrCreateContentUpdate, dedupItems } from '../grouping';

const courseStub = { id: 'c1', title: 'Аналитика' };

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.course.findUnique as any).mockResolvedValue(courseStub);
});

describe('dedupItems', () => {
  it('dedupes by (kind, id)', () => {
    const out = dedupItems([
      { kind: 'lesson', id: 'l1', title: 'A' },
      { kind: 'lesson', id: 'l1', title: 'A' },
      { kind: 'material', id: 'l1', lessonId: 'x', lessonTitle: 'y', title: 'z' },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('mergeOrCreateContentUpdate', () => {
  it('inserts new when no prior unread within 24h', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
    ]);
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('updates existing unread within 24h, appending items', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue({
      id: 'n1',
      payload: {
        type: 'CONTENT_UPDATE',
        courseId: 'c1',
        courseTitle: 'Аналитика',
        items: [{ kind: 'lesson', id: 'l1', title: 'A' }],
      },
    });
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l2', title: 'B' },
    ]);
    expect(prisma.notification.update).toHaveBeenCalledOnce();
    const updateArg = (prisma.notification.update as any).mock.calls[0][0];
    expect(updateArg.where.id).toBe('n1');
    expect(updateArg.data.payload.items).toHaveLength(2);
  });

  it('inserts new when existing in 24h was already read (ignored by query)', async () => {
    // findFirst contract: `readAt: null` is in WHERE clause, so caller never sees read rows.
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
    ]);
    expect(prisma.notification.create).toHaveBeenCalledOnce();
  });

  it('dedupes when same lesson in both existing and new items', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue({
      id: 'n1',
      payload: {
        type: 'CONTENT_UPDATE',
        courseId: 'c1',
        courseTitle: 'Аналитика',
        items: [{ kind: 'lesson', id: 'l1', title: 'A' }],
      },
    });
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
    ]);
    const updateArg = (prisma.notification.update as any).mock.calls[0][0];
    expect(updateArg.data.payload.items).toHaveLength(1);
  });

  it('resolves ctaUrl: single lesson → /learn/{lessonId}', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'lesson-x', title: 'A' },
    ]);
    const createArg = (prisma.notification.create as any).mock.calls[0][0];
    expect(createArg.data.ctaUrl).toBe('/learn/lesson-x');
  });

  it('resolves ctaUrl: multiple items → /learn (course hub fallback)', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
      { kind: 'lesson', id: 'l2', title: 'B' },
    ]);
    const createArg = (prisma.notification.create as any).mock.calls[0][0];
    expect(createArg.data.ctaUrl).toBe('/learn');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/__tests__/grouping.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `apps/web/src/lib/notifications/grouping.ts`:

```ts
/**
 * Rolling 24h grouping logic for CONTENT_UPDATE (Phase 52, D4).
 *
 * Find latest unread CONTENT_UPDATE for (userId, courseId) within now-24h.
 * If found → append new items (dedup by (kind,id)), update payload + ctaUrl.
 * Else → create new row.
 */

import { prisma } from '@mpstats/db/client';

export type ContentUpdateItem =
  | { kind: 'lesson'; id: string; title: string }
  | { kind: 'material'; id: string; lessonId: string; lessonTitle: string; title: string };

export interface ContentUpdatePayload {
  type: 'CONTENT_UPDATE';
  courseId: string;
  courseTitle: string;
  items: ContentUpdateItem[];
}

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function dedupItems(items: ContentUpdateItem[]): ContentUpdateItem[] {
  const seen = new Set<string>();
  const out: ContentUpdateItem[] = [];
  for (const it of items) {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function resolveCtaUrl(courseId: string, items: ContentUpdateItem[]): string {
  if (items.length === 1) {
    const it = items[0];
    if (it.kind === 'lesson') return `/learn/${it.id}`;
    // material → jump to host lesson
    return `/learn/${it.lessonId}`;
  }
  // multiple → course hub. /learn is the existing hub route; course-specific page may not exist.
  return '/learn';
}

export async function mergeOrCreateContentUpdate(
  userId: string,
  courseId: string,
  newItems: ContentUpdateItem[],
): Promise<void> {
  if (newItems.length === 0) return;

  const cutoff = new Date(Date.now() - ROLLING_WINDOW_MS);

  // Find latest unread CONTENT_UPDATE for this user.
  // Postgres JSONB path: payload->>'courseId' = courseId.
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'CONTENT_UPDATE',
      readAt: null,
      createdAt: { gt: cutoff },
      payload: {
        path: ['courseId'],
        equals: courseId,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const prevPayload = existing.payload as unknown as ContentUpdatePayload;
    const merged = dedupItems([...(prevPayload.items ?? []), ...newItems]);
    const ctaUrl = resolveCtaUrl(courseId, merged);
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        payload: { ...prevPayload, items: merged } as unknown as object,
        ctaUrl,
      },
    });
    return;
  }

  // New row
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  const courseTitle = course?.title ?? '';
  const items = dedupItems(newItems);
  const payload: ContentUpdatePayload = {
    type: 'CONTENT_UPDATE',
    courseId,
    courseTitle,
    items,
  };
  await prisma.notification.create({
    data: {
      userId,
      type: 'CONTENT_UPDATE',
      payload: payload as unknown as object,
      ctaUrl: resolveCtaUrl(courseId, items),
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/__tests__/grouping.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/notifications/grouping.ts apps/web/src/lib/notifications/__tests__/grouping.test.ts
git commit -m "feat(phase-52): rolling 24h grouping for CONTENT_UPDATE"
```

---

## Task 4: notifyContentUpdate orchestrator + NotificationPreference gate

**Files:**
- Create: `apps/web/src/lib/notifications/content-update.ts`

- [ ] **Step 1: Write implementation**

Create `apps/web/src/lib/notifications/content-update.ts`:

```ts
/**
 * notifyContentUpdate — orchestrates targeting + grouping + per-user CQ event.
 *
 * Flow:
 *  1. Resolve targets via findUsersForCourseUpdate(courseId).
 *  2. For each target: check NotificationPreference (skip if inApp=false).
 *  3. mergeOrCreateContentUpdate(userId, courseId, items).
 *  4. Fire CQ event pa_notif_content_update.
 *
 * Failures isolated per user (one user's CQ failure does not abort the loop).
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { DEFAULT_IN_APP_PREFS } from '@mpstats/shared';
import { cq } from '@/lib/carrotquest/client';
import { findUsersForCourseUpdate } from './targeting';
import { mergeOrCreateContentUpdate, type ContentUpdateItem } from './grouping';

export interface NotifyContentUpdateArgs {
  courseId: string;
  items: ContentUpdateItem[];
}

export async function notifyContentUpdate(args: NotifyContentUpdateArgs): Promise<{ delivered: number }> {
  let delivered = 0;
  try {
    if (args.items.length === 0) return { delivered: 0 };
    const userIds = await findUsersForCourseUpdate(args.courseId);
    if (userIds.length === 0) return { delivered: 0 };

    // Pull preferences in one query
    const prefs = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, type: 'CONTENT_UPDATE' },
    });
    const prefByUser = new Map(prefs.map((p) => [p.userId, p.inApp]));

    for (const userId of userIds) {
      const inApp = prefByUser.has(userId)
        ? prefByUser.get(userId)!
        : DEFAULT_IN_APP_PREFS.CONTENT_UPDATE;
      if (!inApp) continue;
      try {
        await mergeOrCreateContentUpdate(userId, args.courseId, args.items);
        delivered += 1;
      } catch (err) {
        Sentry.captureException(err, {
          tags: { area: 'notifications', stage: 'content-update.merge' },
          extra: { userId, courseId: args.courseId },
        });
      }
      try {
        await cq.trackEvent(userId, 'pa_notif_content_update');
      } catch (err) {
        Sentry.captureException(err, {
          tags: { area: 'notifications', stage: 'content-update.cq' },
          extra: { userId },
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'notifications', stage: 'content-update.outer' },
      extra: { courseId: args.courseId },
    });
  }
  return { delivered };
}
```

- [ ] **Step 2: Verify CQ event name is registered**

Run: `grep -n "pa_notif_content_update" apps/web/src/lib/carrotquest/types.ts`
Expected: present (Phase 51 registered all 7 types).
If absent: add `'pa_notif_content_update'` to the `CQEventName` union literal type and re-run typecheck.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/notifications/content-update.ts
git commit -m "feat(phase-52): notifyContentUpdate orchestrator with prefs gate"
```

---

## Task 5: ADMIN_COMMENT_REPLY supersede in notifyCommentReply

**Files:**
- Modify: `apps/web/src/lib/notifications/notify.ts:157-208`
- Create: `apps/web/src/lib/notifications/__tests__/admin-comment-reply.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/lib/notifications/__tests__/admin-comment-reply.test.ts`:

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    lessonComment: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    userProfile: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/carrotquest/client', () => ({
  cq: { setUserProps: vi.fn(), trackEvent: vi.fn() },
}));

import { prisma } from '@mpstats/db/client';
import { notifyCommentReply } from '../notify';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.notificationPreference.findUnique as any).mockResolvedValue(null);
  (prisma.lesson.findUnique as any).mockResolvedValue({ title: 'Урок 1' });
});

function setupReply(opts: {
  parentUserId: string;
  parentExists?: boolean;
  replyAuthorRole?: 'USER' | 'ADMIN' | 'SUPERADMIN';
  replyUserId?: string;
}) {
  (prisma.lessonComment.findUnique as any)
    .mockResolvedValueOnce({
      id: 'reply-1',
      content: 'hi',
      parentId: 'parent-1',
      lessonId: 'lesson-1',
      user: { name: 'Mila' },
    })
    .mockResolvedValueOnce(opts.parentExists === false ? null : {
      id: 'parent-1',
      userId: opts.parentUserId,
    });
  (prisma.userProfile.findUnique as any).mockResolvedValue({
    role: opts.replyAuthorRole ?? 'USER',
  });
}

describe('notifyCommentReply supersede', () => {
  it('admin replying to user → ADMIN_COMMENT_REPLY (not COMMENT_REPLY)', async () => {
    setupReply({ parentUserId: 'user-A', replyAuthorRole: 'ADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-1' });
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('ADMIN_COMMENT_REPLY');
  });

  it('SUPERADMIN replying to user → ADMIN_COMMENT_REPLY', async () => {
    setupReply({ parentUserId: 'user-A', replyAuthorRole: 'SUPERADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'super-1' });
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('ADMIN_COMMENT_REPLY');
  });

  it('USER replying to USER → COMMENT_REPLY', async () => {
    setupReply({ parentUserId: 'user-A', replyAuthorRole: 'USER' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'user-B' });
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('COMMENT_REPLY');
  });

  it('admin replying to own comment → no notification', async () => {
    setupReply({ parentUserId: 'admin-1', replyAuthorRole: 'ADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-1' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('admin A replying to admin B (different admins) → ADMIN_COMMENT_REPLY for B', async () => {
    setupReply({ parentUserId: 'admin-B', replyAuthorRole: 'ADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-A' });
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('ADMIN_COMMENT_REPLY');
    expect(arg.data.userId).toBe('admin-B');
  });

  it('reply with deleted parent → no-op', async () => {
    setupReply({ parentUserId: 'user-A', parentExists: false });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-1' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/__tests__/admin-comment-reply.test.ts`
Expected: FAIL — current `notifyCommentReply` always uses `COMMENT_REPLY` type.

- [ ] **Step 3: Modify notifyCommentReply**

In `apps/web/src/lib/notifications/notify.ts`, replace the `notifyCommentReply` function body (lines 157-208) with:

```ts
export async function notifyCommentReply(args: NotifyCommentReplyArgs): Promise<void> {
  try {
    const reply = await prisma.lessonComment.findUnique({
      where: { id: args.replyCommentId },
      select: {
        id: true,
        content: true,
        parentId: true,
        lessonId: true,
        user: { select: { name: true } },
      },
    });
    if (!reply || !reply.parentId) return;

    const parent = await prisma.lessonComment.findUnique({
      where: { id: reply.parentId },
      select: { id: true, userId: true },
    });
    if (!parent) return;

    // Skip if reply author == parent author (admin replying to self, or user replying to self)
    if (parent.userId === args.actorUserId) return;

    // Detect reply author's role to choose ADMIN_COMMENT_REPLY vs COMMENT_REPLY (D2 supersede)
    const actor = await prisma.userProfile.findUnique({
      where: { id: args.actorUserId },
      select: { role: true },
    });
    const isAdminAuthor = actor?.role === 'ADMIN' || actor?.role === 'SUPERADMIN';
    const notificationType: NotificationTypeName = isAdminAuthor
      ? 'ADMIN_COMMENT_REPLY'
      : 'COMMENT_REPLY';

    const lesson = await prisma.lesson.findUnique({
      where: { id: reply.lessonId },
      select: { title: true },
    });
    const lessonTitle = lesson?.title ?? 'Урок';
    const replyAuthorName = reply.user?.name ?? 'Пользователь';
    const preview = reply.content.slice(0, 120);

    await notify(
      parent.userId,
      notificationType,
      {
        type: notificationType,
        commentId: reply.id,
        lessonId: reply.lessonId,
        lessonTitle,
        replyAuthorName,
        preview,
        actorUserId: args.actorUserId,
      },
      {
        ctaUrl: `/learn/${reply.lessonId}#comment-${reply.id}`,
      },
    );
  } catch (error) {
    reportNotifyError('notifyCommentReply', args.actorUserId, error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/__tests__/admin-comment-reply.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Run full notification test suite**

Run: `pnpm --filter @mpstats/web test apps/web/src/lib/notifications/`
Expected: all green (no regressions in Phase 51 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/notifications/notify.ts apps/web/src/lib/notifications/__tests__/admin-comment-reply.test.ts
git commit -m "feat(phase-52): supersede ADMIN_COMMENT_REPLY for admin/superadmin replies"
```

---

## Task 6: Visual accent for ADMIN_COMMENT_REPLY in NotificationItem

**Files:**
- Modify: `apps/web/src/components/notifications/NotificationItem.tsx`

- [ ] **Step 1: Update TypeIcon to accept admin variant**

Replace the `TypeIcon` function (lines 22-39) with:

```tsx
function TypeIcon({ type }: { type: string }) {
  const map: Record<string, string> = {
    COMMENT_REPLY: '💬',
    ADMIN_COMMENT_REPLY: '👨‍🏫',
    CONTENT_UPDATE: '📚',
    PROGRESS_NUDGE: '📍',
    INACTIVITY_RETURN: '👋',
    WEEKLY_DIGEST: '📰',
    BROADCAST: '📣',
  };
  const isAdminReply = type === 'ADMIN_COMMENT_REPLY';
  return (
    <div
      className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base',
        isAdminReply ? 'bg-mp-blue-100 text-mp-blue-700' : 'bg-mp-gray-100',
      )}
    >
      {map[type] ?? '🔔'}
    </div>
  );
}
```

- [ ] **Step 2: Add border-left accent to inner container**

In the same file, replace the `inner` div (lines 85-103) with:

```tsx
  const isAdminReply = notification.type === 'ADMIN_COMMENT_REPLY';
  const inner = (
    <div
      className={cn(
        'flex gap-3 p-3 transition-colors hover:bg-mp-gray-50',
        isUnread && 'bg-mp-blue-50',
        isAdminReply && 'border-l-4 border-mp-blue-500 pl-3',
      )}
    >
      <TypeIcon type={notification.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mp-gray-900 truncate">{title}</p>
        {preview && (
          <p className="text-xs text-mp-gray-500 line-clamp-2 mt-0.5">{preview}</p>
        )}
        <span className="text-xs text-mp-gray-400 mt-1 block">
          {formatRelativeTime(created)}
        </span>
      </div>
    </div>
  );
```

(Place `const isAdminReply = ...` line right above `const inner = (`.)

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Visual smoke (manual)**

Start dev server: `pnpm --filter @mpstats/web dev`
Visit `/profile/notifications` (login as test user). If no ADMIN_COMMENT_REPLY exists, seed one via SQL/Prisma Studio:

```sql
INSERT INTO "Notification" (id, "userId", type, payload)
VALUES (gen_random_uuid()::text, '<your-user-id>', 'ADMIN_COMMENT_REPLY',
  '{"type":"ADMIN_COMMENT_REPLY","commentId":"x","lessonId":"y","lessonTitle":"Test","replyAuthorName":"Mila","preview":"Hello","actorUserId":"x"}'::jsonb);
```

Verify: blue left border 4px, blue circular icon background, content readable.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/notifications/NotificationItem.tsx
git commit -m "feat(phase-52): visual accent for ADMIN_COMMENT_REPLY"
```

---

## Task 7: Update CONTENT_UPDATE rendering in NotificationItem

**Files:**
- Modify: `apps/web/src/components/notifications/NotificationItem.tsx:50-54`

- [ ] **Step 1: Replace CONTENT_UPDATE branch in deriveTitleAndPreview**

Replace lines 50-54 (the `case 'CONTENT_UPDATE':` block) with:

```ts
    case 'CONTENT_UPDATE': {
      const items: Array<any> = payload.items ?? [];
      const lessons = items.filter((i: any) => i.kind === 'lesson');
      const materials = items.filter((i: any) => i.kind === 'material');
      const total = items.length;
      const courseTitle = payload.courseTitle ?? '';
      if (total === 1) {
        const it = items[0];
        if (it.kind === 'lesson') {
          return {
            title: `Новый урок: «${it.title}»`,
            preview: `В курсе «${courseTitle}»`,
          };
        }
        return {
          title: `Новый материал к уроку «${it.lessonTitle}»`,
          preview: it.title,
        };
      }
      // multiple
      const parts: string[] = [];
      if (lessons.length) parts.push(pluralize(lessons.length, ['урок', 'урока', 'уроков']));
      if (materials.length) parts.push(pluralize(materials.length, ['материал', 'материала', 'материалов']));
      return {
        title: `Добавлено ${parts.join(' и ')} в курсе «${courseTitle}»`,
        preview: '',
      };
    }
```

- [ ] **Step 2: Add pluralize helper at top of file**

After the imports (right before `export interface NotificationItemData`), add:

```ts
function pluralize(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form: string;
  if (mod10 === 1 && mod100 !== 11) form = forms[0];
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];
  else form = forms[2];
  return `${n} ${form}`;
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/notifications/NotificationItem.tsx
git commit -m "feat(phase-52): render CONTENT_UPDATE with mixed items"
```

---

## Task 8: Yandex Metrika events on notification click

**Files:**
- Modify: `apps/web/src/components/notifications/NotificationItem.tsx`

- [ ] **Step 1: Find existing ym helper**

Run: `grep -rn "ym(\|reachGoal\|ymEvent" apps/web/src/lib/ apps/web/src/components/ 2>/dev/null | head -10`
Expected: locate the helper used by Phase 26 (Yandex Metrika integration). If file is `apps/web/src/lib/analytics/yandex.ts` (or similar) with exported function `ym(eventName, params?)`, use it. If not found, fallback to direct `window.ym(METRIKA_ID, 'reachGoal', eventName, params)`.

- [ ] **Step 2: Wrap onClick to fire ym event**

In `NotificationItem.tsx`, modify the component to compute event params and call ym before invoking the existing `onClick`. Replace the existing `onClick` usages in both `<Link>` and `<button>` branches with a wrapped handler.

Add inside the component, before `const inner = ...`:

```tsx
  const handleClick = () => {
    try {
      // Fire metrika event per kind (best-effort, never throw)
      const w = typeof window !== 'undefined' ? (window as any) : null;
      if (w?.ym && process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID) {
        const id = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
        if (notification.type === 'ADMIN_COMMENT_REPLY') {
          w.ym(id, 'reachGoal', 'NOTIF_ADMIN_REPLY_OPEN', {
            commentId: notification.payload?.commentId,
          });
        } else if (notification.type === 'CONTENT_UPDATE') {
          w.ym(id, 'reachGoal', 'NOTIF_CONTENT_UPDATE_OPEN', {
            courseId: notification.payload?.courseId,
            itemsCount: notification.payload?.items?.length ?? 0,
          });
        }
      }
    } catch {
      // swallow — metrika must never break navigation
    }
    onClick?.();
  };
```

Replace `onClick={onClick}` with `onClick={handleClick}` in both the `<Link>` and `<button>` JSX (lines 107 and 113 in the original file, now shifted).

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/notifications/NotificationItem.tsx
git commit -m "feat(phase-52): yandex metrika events for new notification kinds"
```

---

## Task 9: Route handler for content-update fan-out

**Files:**
- Create: `apps/web/src/app/api/admin/notify-content-update/route.ts`

- [ ] **Step 1: Identify auth helper used by other admin routes**

Run: `grep -rn "requireAdmin\|adminAuth\|getAdminUser" apps/web/src/app/api/admin/ apps/web/src/lib/ 2>/dev/null | head -10`
Expected: find existing helper. If pattern is `import { requireAdminAuth } from '@/lib/auth/admin'` (or similar), use it. If not, use the same auth pattern as existing admin routes — copy structure from `apps/web/src/app/api/admin/<existing-route>/route.ts`.

- [ ] **Step 2: Write route handler**

Create `apps/web/src/app/api/admin/notify-content-update/route.ts`:

```ts
/**
 * POST /api/admin/notify-content-update
 *
 * Admin-only fan-out endpoint for CONTENT_UPDATE notifications.
 * Called by admin UI after Lesson unhide / Material attach when "notify" checkbox is set.
 *
 * Body: { courseId: string, items: ContentUpdateItem[] }
 * Returns: { delivered: number }
 *
 * Auth: SUPERADMIN or ADMIN role required (matches admin tRPC procedures).
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { prisma } from '@mpstats/db/client';
import { notifyContentUpdate } from '@/lib/notifications/content-update';

const itemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('lesson'), id: z.string().min(1), title: z.string() }),
  z.object({
    kind: z.literal('material'),
    id: z.string().min(1),
    lessonId: z.string().min(1),
    lessonTitle: z.string(),
    title: z.string(),
  }),
]);

const bodySchema = z.object({
  courseId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(50),
});

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'bad_request', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const result = await notifyContentUpdate(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'notifications', stage: 'notify-content-update-route' },
    });
    console.error('[notify-content-update] error:', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify Supabase server helper path**

Run: `ls apps/web/src/lib/supabase/server.ts || grep -rn "createServerClient" apps/web/src/lib/supabase/`
If the import path differs, update the import in the route. (If `getServerUser`-style helper exists, prefer it for consistency.)

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/admin/notify-content-update/route.ts
git commit -m "feat(phase-52): admin route handler for content-update fan-out"
```

---

## Task 10: Admin UI — notify checkbox on lesson unhide

**Files:**
- Read first: `apps/web/src/app/(admin)/admin/content/lessons/page.tsx` (locate the unhide button/handler)
- Modify: same file

- [ ] **Step 1: Locate unhide handler**

Run: `grep -n "toggleLessonHidden\|hidden.*false\|isHidden" apps/web/src/app/\(admin\)/admin/content/lessons/page.tsx | head -10`
Expected: find the click handler that calls `trpc.admin.toggleLessonHidden.mutate(...)` with `hidden: false`.

- [ ] **Step 2: Add confirmation dialog state and notify checkbox**

Wrap the unhide button click with a confirmation dialog (use existing `AlertDialog` / `Dialog` from shadcn — search `import { Dialog }` for existing pattern). The dialog presents:

- Lesson title in body
- Checkbox: «Уведомить подписчиков курса (только тех, у кого есть прогресс)» — default unchecked
- Cancel / Confirm buttons

On Confirm:

```ts
async function handleConfirmUnhide(lessonId: string, courseId: string, lessonTitle: string, notify: boolean) {
  await trpc.admin.toggleLessonHidden.mutate({ lessonId, hidden: false });
  if (notify) {
    try {
      await fetch('/api/admin/notify-content-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          items: [{ kind: 'lesson', id: lessonId, title: lessonTitle }],
        }),
      });
    } catch (err) {
      console.warn('[admin/lessons] notify failed:', err);
    }
  }
  // existing refresh logic (refetch list)
}
```

Concrete implementation depends on the existing component shape — preserve all existing behavior, only add the dialog wrapper and the `notify` flag plumbing.

- [ ] **Step 3: Manual smoke**

Start dev server, login as ADMIN, navigate to `/admin/content/lessons`. Find a hidden lesson. Click "Показать" → confirm dialog appears with checkbox. Toggle the checkbox on, confirm, then check `/api/admin/notify-content-update` ran (Network tab) and `delivered` count is plausible.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(admin\)/admin/content/lessons/page.tsx
git commit -m "feat(phase-52): notify checkbox on lesson unhide"
```

---

## Task 11: Admin UI — notify checkbox on material attach

**Files:**
- Read first: `apps/web/src/app/(admin)/admin/content/materials/page.tsx`
- Modify: same file
- Modify (if needed): `packages/api/src/routers/material.ts:287-315` — extend `attach` to return lesson info needed for notify (course id + lesson title)

- [ ] **Step 1: Inspect attach response**

Run: `grep -n "attach\." apps/web/src/app/\(admin\)/admin/content/materials/page.tsx`
Then inspect what `material.attach` returns currently (just `LessonMaterial` row). The notify call needs `courseId` and `lessonTitle` — fetch them via the existing lesson query the page already has, OR extend `attach` to include lesson info in response.

Prefer **fetch from existing data** (page already loads lessons list). Use that to avoid changing tRPC contract.

- [ ] **Step 2: Add notify checkbox to attach UI**

Locate the attach action (likely a Combobox or drag-drop with confirm). Add a checkbox below the lesson selector:

```
☐ Уведомить подписчиков курса о новом материале
```

Default unchecked. On submit:

```ts
const link = await trpc.material.attach.mutate({ materialId, lessonId, order });
if (notify) {
  // Lookup lesson + material info from already-loaded state
  const lesson = lessonsById[lessonId]; // page state
  const material = materialsById[materialId];
  if (lesson?.courseId && material?.title) {
    try {
      await fetch('/api/admin/notify-content-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: lesson.courseId,
          items: [{
            kind: 'material',
            id: materialId,
            lessonId,
            lessonTitle: lesson.title,
            title: material.title,
          }],
        }),
      });
    } catch (err) {
      console.warn('[admin/materials] notify failed:', err);
    }
  }
}
```

- [ ] **Step 3: Manual smoke**

Login as admin, attach a material to a lesson with checkbox on → Network tab shows POST → response has `delivered: N`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(admin\)/admin/content/materials/page.tsx
git commit -m "feat(phase-52): notify checkbox on material attach"
```

---

## Task 12: E2E test — happy path

**Files:**
- Create: `apps/web/tests/e2e/phase-52-content-update.spec.ts`

- [ ] **Step 1: Verify e2e setup pattern**

Run: `ls apps/web/tests/e2e/ | head` and `cat apps/web/tests/e2e/<existing>.spec.ts | head -40` to copy auth/login fixture pattern (Phase 51 likely added a notification e2e — check `phase-51-*.spec.ts` if present).

- [ ] **Step 2: Write the test**

Create `apps/web/tests/e2e/phase-52-content-update.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// Skip if env not set (e2e runs only with ENABLE_E2E=true on CI/staging)
test.skip(!process.env.ENABLE_E2E, 'set ENABLE_E2E=true to run');

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD!;
const USER_EMAIL = process.env.E2E_USER_EMAIL!;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD!;
// User must have prior progress in the test lesson's course (seed via setup if needed)

test('admin unhides lesson with notify → user sees CONTENT_UPDATE', async ({ page, context }) => {
  // 1. Login as admin
  await page.goto('/login');
  await page.fill('input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/learn**');

  // 2. Navigate to admin lessons, find a hidden lesson, unhide with notify
  await page.goto('/admin/content/lessons');
  await page.click('button:has-text("Hidden filter")'); // adapt selector to actual UI
  const firstHidden = page.locator('[data-test="lesson-row"][data-hidden="true"]').first();
  await firstHidden.locator('button:has-text("Показать")').click();
  await page.locator('input[type="checkbox"][name="notify"]').check();
  await page.click('button:has-text("Подтвердить")');
  await expect(page.getByText(/обновлено/i)).toBeVisible();

  // 3. Logout, login as test user with progress
  await page.goto('/login?signout=1');
  await page.fill('input[name="email"]', USER_EMAIL);
  await page.fill('input[name="password"]', USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/learn**');

  // 4. Open notification bell, expect new CONTENT_UPDATE
  await page.click('[data-test="notification-bell"]');
  const notif = page.locator('[data-test="notification-item"]').first();
  await expect(notif).toContainText('Новый урок');

  // 5. Click → lands on lesson page
  await Promise.all([
    page.waitForURL('**/learn/**'),
    notif.click(),
  ]);
});
```

- [ ] **Step 3: Verify selectors match real UI**

Run a manual click-through against staging or local dev as ADMIN to confirm `data-test` attributes exist. If they don't, **add the data-test attributes** to the relevant components in earlier tasks (or substitute role/text selectors that work without them — `getByRole('button', { name: 'Показать' })`, etc.).

- [ ] **Step 4: Add to package.json e2e script ignore-list if needed (skipped by default via env gate)**

Verify the test is gated by `ENABLE_E2E` and won't run in CI unless that env is set.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/e2e/phase-52-content-update.spec.ts
git commit -m "test(phase-52): e2e for admin unhide → user CONTENT_UPDATE"
```

---

## Task 13: Admin guide — «Анонс нового контента» section

**Files:**
- Modify: `docs/admin-guides/lesson-materials.md`

- [ ] **Step 1: Append section**

At the end of `docs/admin-guides/lesson-materials.md`, append:

```markdown

## Анонс нового контента подписчикам

Когда вы делаете урок видимым (Показать) или прикрепляете материал к уроку, появляется чекбокс **«Уведомить подписчиков курса»**.

**Кому уйдёт уведомление:**
- Юзеры с активной подпиской на курс
- И с прогрессом в этом курсе: ≥1 урок завершён, ИЛИ начат и просмотрен на ≥50%

«Холодным» юзерам без прогресса уведомление НЕ уходит — это сделано чтобы лента уведомлений не превращалась в спам.

**Группировка за 24h:**
Если за последние 24 часа юзер уже получил непрочитанное уведомление по этому же курсу, новый урок/материал добавится в существующее уведомление («Добавлено 5 новых уроков в курсе Аналитика») — не плодится отдельная запись на каждый клик.

**При seed-скриптах** (массовая публикация через `scripts/seed/`):
Уведомления НЕ отправляются автоматически. Если хотите анонсировать пакет уроков:
1. Запустите seed с временным `isHidden = true` (или вручную через админку выставьте флаг скрытия).
2. В `/admin/content/lessons` отфильтруйте новые скрытые уроки и снимайте скрытие поштучно с галкой «Уведомить» — или скрипт `bulk-unhide-with-notify` (если будет создан).

**Ответы методологов на комментарии** уходят пользователям автоматически — отдельной галки нет. Когда сотрудник с ролью ADMIN/SUPERADMIN отвечает на коммент юзера, тот получает уведомление с акцентом (синяя полоска и иконка 👨‍🏫).
```

- [ ] **Step 2: Commit**

```bash
git add docs/admin-guides/lesson-materials.md
git commit -m "docs(phase-52): admin guide for content-update notifications"
```

---

## Task 14: Public roadmap entry

**Files:**
- Modify: `apps/web/src/app/design-new-v8-roadmap/page.tsx` (or whichever roadmap component holds changelog entries — confirm with `grep -n "23.04\|22.04\|changelog" apps/web/src/app/(main)/roadmap/`)

- [ ] **Step 1: Add changelog entry**

Add a new entry at the top of the changelog list with today's date (DD.MM):

> **Ответы методологов теперь заметнее**
> Когда сотрудники Академии отвечают на твои вопросы под уроками, в шторке уведомлений появляется акцент — синяя полоска и иконка учителя. Так ты сразу замечаешь, что ответил человек, а не другой ученик.
>
> **Уведомления о новом контенте — без спама**
> Когда мы добавляем уроки и материалы в курсы, ты получаешь одно сводное уведомление по курсу за сутки, а не десяток отдельных. И только если ты уже учишься в этом курсе — холодные подписчики не дёргаются.

Tone: «ты», от первого лица, без техничных слов (CRON, webhook, group-by).

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/<path>/roadmap-page-or-component
git commit -m "docs(phase-52): roadmap changelog entry"
```

---

## Task 15: Memory entry + final verification

**Files:**
- Create: `.claude/memory/project_phase52_content_triggers.md`
- Modify: `.claude/memory/MEMORY.md`
- Modify: `MAAL/CLAUDE.md` — bump Last Session entry

- [ ] **Step 1: Run full test suite**

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. Fix anything red before continuing.

- [ ] **Step 2: Write memory file**

Create `.claude/memory/project_phase52_content_triggers.md`:

```markdown
---
name: Phase 52 Content Triggers
description: ADMIN_COMMENT_REPLY supersede + CONTENT_UPDATE rolling 24h grouping with progress-gated targeting. Shipped via Superpowers workflow (no GSD).
type: project
---

## What shipped
- ADMIN_COMMENT_REPLY supersedes COMMENT_REPLY when reply author has role ADMIN/SUPERADMIN; visual accent (border-l-4 border-mp-blue-500 + bg-mp-blue-100 icon).
- CONTENT_UPDATE: single kind, mixed lessons + materials in payload.items.
- Rolling 24h grouping per (user, course): unread row within window appended; read or expired triggers new row.
- Targeting: active subscription AND ≥1 lesson with COMPLETED or (IN_PROGRESS AND watchedPercent ≥ 50). No cold targeting.
- Admin UI: confirm dialog with notify checkbox on lesson unhide and material attach.

## Architecture notes
- All notification helpers live in apps/web/src/lib/notifications/ (NOT packages/api) — workspace dep direction is apps/web → packages, never reverse, because cq client is in apps/web.
- Trigger fan-out goes through route handlers (`/api/admin/notify-content-update`, existing `/api/notifications/notify-reply`) — tRPC routers stay pure DB logic.
- CONTENT_UPDATE payload schema lives in packages/shared/src/notifications.ts; Phase 51 placeholder `lessonIds: string[]` was widened to `items: Array<lesson|material>`.
- Notification.payload JSONB filtered via Prisma `path: ['courseId'], equals: courseId` — no separate courseId column added (deferred to perf-tuning phase).

## Gotchas
- Skill-batch ingest bypasses the trigger (seed-scripts go directly to DB without UI). Workflow for announcement: seed with isHidden=true, then unhide via admin UI with checkbox. Documented in docs/admin-guides/lesson-materials.md.
- `Notification.updatedAt` does not exist — rolling window uses `createdAt`; appending updates payload but createdAt stays at original (semantically «window opens at first publish»; close enough).
- Admin replying to own root comment does not fire notification (anti-self-notify covers reply.author === parent.author case for both COMMENT_REPLY and ADMIN_COMMENT_REPLY paths).
```

- [ ] **Step 3: Add MEMORY.md pointer**

In `.claude/memory/MEMORY.md`, add this line in an appropriate section (e.g., near Phase 51 entry):

```markdown
## Phase 52 — Content Triggers (shipped YYYY-MM-DD)
- [project_phase52_content_triggers.md](project_phase52_content_triggers.md) — ADMIN_COMMENT_REPLY supersede + CONTENT_UPDATE rolling 24h with progress-gated targeting
```

- [ ] **Step 4: Bump CLAUDE.md Last Session**

Update the `## Last Session` section in `MAAL/CLAUDE.md` with a brief Phase 52 summary (date, headline, link to memory).

- [ ] **Step 5: Mark Phase 52 shipped in roadmap**

In `.planning/ROADMAP.md`, change `- [ ] Phase 52:` to `- [x] Phase 52:` and append `(shipped YYYY-MM-DD)`.

- [ ] **Step 6: Final commit + deploy**

```bash
git add .claude/memory/ MAAL/CLAUDE.md .planning/ROADMAP.md
git commit -m "docs(phase-52): memory + roadmap shipped marker"
```

Deploy: ssh deploy@VPS → `git pull && docker compose down && docker compose build --no-cache && docker compose up -d`. Smoke-test on prod (admin unhide with notify on test lesson, verify notification appears for test user).

---

## Self-review (against spec)

| Spec section | Plan task |
|---|---|
| D1 Targeting (hybrid) | Task 2 (targeting.ts SQL) |
| D2 ADMIN supersede + flat threads + same-author skip | Task 5 |
| D3 Single CONTENT_UPDATE kind, mixed items | Task 1 (schema), Task 7 (rendering) |
| D4 Rolling 24h grouping | Task 3 (grouping.ts) |
| D5 ctaUrl resolver | Task 3 (resolveCtaUrl) |
| D6 Visual treatment | Task 6 |
| Admin UX checkboxes | Tasks 10, 11 |
| Yandex Metrika events | Task 8 |
| NotificationPreference defaults | Task 4 (uses DEFAULT_IN_APP_PREFS already wired in Phase 51) |
| Tests: admin-comment-reply 6 cases | Task 5 |
| Tests: content-update-grouping 5+ cases | Task 3 |
| Tests: targeting 4 cases | Task 2 |
| E2E happy-path | Task 12 |
| Risk R1 (skill-batch bypass) doc | Task 13 |
| Open question: course slug routing | Task 3 (resolveCtaUrl falls back to /learn for ≥2 items) |
| Open question: Notification.updatedAt | Task 3 (uses createdAt; documented in memory) |
| Open question: Notification.courseId column | Task 3 (uses Prisma JSON path; documented in memory) |

All spec sections covered. No placeholders. Type names consistent (`ContentUpdateItem`, `kind` discriminator, `notifyContentUpdate`).
