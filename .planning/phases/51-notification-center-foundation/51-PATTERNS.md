# Phase 51: Notification Center Foundation — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 14 (10 new + 4 modified + 1 new directory)
**Analogs found:** 13 / 14 (1 file = enum extension, no analog needed)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|----------------|---------------|
| `packages/db/prisma/schema.prisma` (extend) | model | schema | Existing models `LessonComment` (l.369-386), `Material` (l.398-418), `PromoActivation` (l.312-324) | exact (in-file pattern) |
| `packages/api/src/services/notifications.ts` (new dir!) | service | event-driven (fire CQ + DB write) | `apps/web/src/lib/carrotquest/emails.ts` — функции `sendPaymentSuccessEmail` etc. | exact (same shape: setUserProps + trackEvent + try/catch + Sentry) |
| `packages/api/src/routers/notifications.ts` | controller (tRPC router) | CRUD / request-response | `packages/api/src/routers/comments.ts` (cursor pagination + protected) + `packages/api/src/routers/promo.ts` (multi-procedure CRUD with admin variants) | exact |
| `packages/shared/src/notifications.ts` | types | n/a | `packages/shared/src/types/index.ts` (enum-as-const + types) | exact |
| `apps/web/src/components/notifications/NotificationBell.tsx` | component | request-response (polling) | `apps/web/src/components/admin/AdminSidebar.tsx` (refetchInterval + badge) + `apps/web/src/components/learning/FilterPanel.tsx` (Popover trigger pattern) | role-match (closest combination) |
| `apps/web/src/components/notifications/NotificationItem.tsx` | component | render | `apps/web/src/components/comments/CommentItem.tsx` (avatar + name + relative time + click handler) | exact |
| `apps/web/src/app/(main)/notifications/page.tsx` | page | request-response | `apps/web/src/app/(main)/profile/history/page.tsx` (`'use client'` + trpc.useQuery + list rendering + empty state) | role-match |
| `apps/web/src/app/(main)/profile/notifications/page.tsx` | page | CRUD (mutations) | `apps/web/src/app/(admin)/admin/settings/page.tsx` (Switch + toggle mutation + optimistic refetch) | exact |
| `apps/web/src/app/api/cron/notifications-cleanup/route.ts` | cron route | batch | `apps/web/src/app/api/cron/orphan-materials/route.ts` (handle/GET/POST + Sentry checkin + bulk delete) | exact |
| `apps/web/src/lib/carrotquest/types.ts` (extend) | types | n/a | Same file — extend `CQEventName` union | exact |
| `packages/api/src/routers/comments.ts` (modify) | controller | request-response | Self — add hook after `db.create` and BEFORE return inside try block | exact |
| `apps/web/src/components/comments/CommentItem.tsx` (modify) | component | render | Self — wrap root with `<div id={`comment-${id}`}>` | exact |
| `apps/web/src/app/(main)/learn/[id]/page.tsx` (modify) | page | render | `apps/web/src/app/(main)/learn/page.tsx` lines 124-134 — useEffect reading `window.location.hash` + `scrollIntoView` (existing pattern в проекте!) | exact |
| `apps/web/src/app/(main)/layout.tsx` (modify) | layout | render | Self — insert `<NotificationBell />` between line 82 and 83 | exact |
| `packages/api/src/root.ts` (modify) | router registry | n/a | Self — add `notifications: notificationsRouter` line | exact |
| `.github/workflows/notifications-cleanup.yml` (new) | workflow | cron | `.github/workflows/orphan-materials-cleanup.yml` | exact |

---

## Pattern Assignments

### `packages/db/prisma/schema.prisma` — model + enum + composite PK

**Analog в этом же файле.** Три separate patterns reused:

**Pattern 1 — model with @@index multi-column** (LessonComment l.369-386):
```prisma
model LessonComment {
  id        String   @id @default(cuid())
  lessonId  String
  userId    String
  content   String   @db.Text
  parentId  String?
  createdAt DateTime  @default(now())
  isHidden  Boolean   @default(false)

  user     UserProfile    @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent   LessonComment? @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies  LessonComment[] @relation("CommentReplies")

  @@index([lessonId, createdAt(sort: Desc)])
  @@index([parentId])
}
```

**Pattern 2 — composite primary key** (PromoActivation l.323):
```prisma
model PromoActivation {
  ...
  @@unique([promoCodeId, userId])
}
```
Для Phase 51 NotificationPreference нужен `@@id([userId, type])` — composite **primary** key (а не unique). Prisma syntax идентичен.

**Pattern 3 — enum** (MaterialType l.390-396, SkillCategory l.56-62):
```prisma
enum MaterialType {
  PRESENTATION
  CALCULATION_TABLE
  EXTERNAL_SERVICE
  CHECKLIST
  MEMO
}
```

**Apply for Phase 51:**
```prisma
enum NotificationType {
  COMMENT_REPLY
  ADMIN_COMMENT_REPLY
  CONTENT_UPDATE
  PROGRESS_NUDGE
  INACTIVITY_RETURN
  WEEKLY_DIGEST
  BROADCAST
}

model Notification {
  id           String           @id @default(cuid())
  userId       String
  type         NotificationType
  payload      Json
  ctaUrl       String?
  readAt       DateTime?
  createdAt    DateTime         @default(now())
  broadcastId  String?

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, readAt, createdAt(sort: Desc)])
}

model NotificationPreference {
  userId String
  type   NotificationType
  inApp  Boolean @default(true)
  email  Boolean @default(false)

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, type])
}
```

**Также добавить в UserProfile (l.26-46):** новую relation + поле:
```prisma
model UserProfile {
  ...
  lastNotificationsSeenAt DateTime?  // D-07 в CONTEXT.md — для badge counter

  notifications     Notification[]
  notificationPrefs NotificationPreference[]
  ...
}
```

**Migration order gotcha:** `feedback_schema_migration_order.md` — `pnpm db:push` ПЕРЕД docker rebuild.

---

### `packages/api/src/services/notifications.ts` (NEW DIRECTORY!)

**Analog:** `apps/web/src/lib/carrotquest/emails.ts` lines 17-83. Same shape: try/catch wrapper + setUserProps + trackEvent + Sentry on failure.

**Гид:** `services/` directory НЕ СУЩЕСТВУЕТ в `packages/api/src/`. Создать новую (это первая фаза с centralized service layer вне routers/utils).

**Imports pattern** (from `emails.ts:1-3` + `client.ts:1-2`):
```typescript
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { cq } from '../../../apps/web/src/lib/carrotquest/client';  // ⚠ CROSS-PACKAGE — see note below
// либо: импорт из packages/api с дублированием тонкого CQ-клиента,
// либо: вынести cq client в shared package
```

**⚠ ARCHITECTURE NOTE:** `cq` синглтон сейчас живёт в `apps/web/src/lib/carrotquest/client.ts`. `packages/api` не импортирует из `apps/web`. Решения для планировщика:
- **Option A** (рекомендация): переехать `carrotquest/{client,types,emails}.ts` в `packages/shared/src/carrotquest/` → импортируется и из api, и из web. Минимальный рефактор: `client.ts` server-only, типы — pure types.
- **Option B**: дублировать тонкий CQ-клиент в `packages/api/src/services/cq.ts` (anti-DRY).
- **Option C**: вынести `notify()` в `apps/web/src/lib/notifications.ts` и импортировать в comments.ts через прокси-helper. Но тогда сервис становится web-only и юнит-тесты ломаются (api package).

**Reporting helper pattern** (emails.ts:17-23):
```typescript
function reportEmailError(stage: string, userId: string, error: unknown): void {
  console.error(`[Email] ${stage} error for ${userId}:`, error);
  Sentry.captureException(error, {
    tags: { area: 'carrotquest-email', stage },
    extra: { userId },
  });
}
```
Apply: `reportNotifyError('notify', userId, error)` с tag `area: 'notifications'`.

**Core notify pattern** (emails.ts:64-83 — `sendPaymentSuccessEmail`):
```typescript
export async function sendPaymentSuccessEmail(
  userId: string,
  data: { amount: number; courseName?: string; periodEnd: Date },
): Promise<void> {
  try {
    if (!(await isEmailEnabled())) return;

    await cq.setUserProps(userId, {
      pa_amount: String(data.amount),
      pa_course_name: data.courseName ?? '',
      pa_period_end: formatDateRu(data.periodEnd),
      pa_period_end_tech: data.periodEnd.toISOString(),
    });
    await cq.trackEvent(userId, 'pa_payment_success');

    console.log(`[Email] Payment success event sent for user ${userId}`);
  } catch (error) {
    reportEmailError('sendPaymentSuccessEmail', userId, error);
  }
}
```

**Apply for Phase 51 — `notify()` skeleton:**
```typescript
export async function notify(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload,
  opts?: { ctaUrl?: string; broadcastId?: string },
): Promise<void> {
  try {
    // DC-08: anti-self-notify
    if ('actorUserId' in payload && payload.actorUserId === userId) {
      return;
    }

    // (a) Check NotificationPreference.inApp
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    const inAppEnabled = pref ? pref.inApp : DEFAULT_PREFS[type].inApp;

    // (b) Create row if inApp enabled
    if (inAppEnabled) {
      await prisma.notification.create({
        data: { userId, type, payload, ctaUrl: opts?.ctaUrl, broadcastId: opts?.broadcastId },
      });
    }

    // (c) ВСЕГДА fire CQ event (CQ-rule decides email delivery)
    const eventName = `pa_notif_${type.toLowerCase()}` as CQEventName;
    // setUserProps for payload preview (CQ rules read from lead, not event params)
    if ('preview' in payload) {
      await cq.setUserProps(userId, {
        pa_notif_preview: payload.preview,
        pa_notif_type: type,
      });
    }
    await cq.trackEvent(userId, eventName);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: 'notifications', stage: 'notify' },
      extra: { userId, type },
    });
    // Fire-and-forget: не ронять caller (comments.create)
  }
}
```

**Bulk pattern** (`notifyMany`) — DC-09:
```typescript
export async function notifyMany(
  userIds: string[],
  type: NotificationType,
  buildPayload: (userId: string) => NotificationPayload,
  opts?: { ctaUrl?: string; broadcastId?: string },
): Promise<void> {
  // Bulk insert через createMany для производительности
  const rows = userIds.map(userId => ({
    userId, type, payload: buildPayload(userId),
    ctaUrl: opts?.ctaUrl, broadcastId: opts?.broadcastId,
  }));
  await prisma.notification.createMany({ data: rows });

  // CQ events последовательно (rate-limit aware)
  for (const userId of userIds) {
    try {
      await cq.trackEvent(userId, `pa_notif_${type.toLowerCase()}` as CQEventName);
    } catch (error) {
      Sentry.captureException(error, { tags: { area: 'notifications' }, extra: { userId } });
    }
  }
}
```

---

### `packages/api/src/routers/notifications.ts`

**Analog 1 (cursor pagination + protectedProcedure):** `packages/api/src/routers/comments.ts` lines 32-91.
**Analog 2 (multi-procedure router with mutations + adminProcedure variants):** `packages/api/src/routers/promo.ts` lines 1-185.

**File header pattern** (comments.ts:1-15):
```typescript
/**
 * Notifications Router — In-app notification center
 *
 * Endpoints:
 * - list: Paginated notifications (cursor-based, 20/page, filter all|unread)
 * - unreadCount: Lightweight COUNT for badge polling
 * - markRead, markAllRead, markSeen: Update read state
 * - getPreferences, updatePreference: Per-type/channel toggles
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { NotificationType } from '@mpstats/db';
import { router, protectedProcedure } from '../trpc';
import { handleDatabaseError } from '../utils/db-errors';

const NOTIFICATIONS_PER_PAGE = 20;
```

**List with cursor pagination pattern** (comments.ts:32-91):
```typescript
list: protectedProcedure
  .input(
    z.object({
      filter: z.enum(['all', 'unread']).default('all'),
      cursor: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    try {
      const { filter, cursor } = input;
      const where = {
        userId: ctx.user.id,
        ...(filter === 'unread' ? { readAt: null } : {}),
      };

      const [totalCount, items] = await Promise.all([
        ctx.prisma.notification.count({ where }),
        ctx.prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: NOTIFICATIONS_PER_PAGE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      ]);

      const nextCursor =
        items.length === NOTIFICATIONS_PER_PAGE
          ? items[items.length - 1].id
          : null;

      return { items, nextCursor, totalCount };
    } catch (error) {
      handleDatabaseError(error);
    }
  }),
```

**Mutation with ownership check pattern** (comments.ts:151-196 — `delete`):
```typescript
markRead: protectedProcedure
  .input(z.object({ notificationId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    try {
      const notif = await ctx.prisma.notification.findUnique({
        where: { id: input.notificationId },
        select: { userId: true, readAt: true },
      });

      if (!notif) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Notification not found' });
      }
      if (notif.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot mark others\' notifications' });
      }
      if (notif.readAt) return { alreadyRead: true };

      await ctx.prisma.notification.update({
        where: { id: input.notificationId },
        data: { readAt: new Date() },
      });
      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      handleDatabaseError(error);
    }
  }),
```

**unreadCount endpoint** — простой COUNT через индекс `(userId, readAt, createdAt)`:
```typescript
unreadCount: protectedProcedure.query(async ({ ctx }) => {
  try {
    const profile = await ctx.prisma.userProfile.findUnique({
      where: { id: ctx.user.id },
      select: { lastNotificationsSeenAt: true },
    });
    const seenAt = profile?.lastNotificationsSeenAt;

    const count = await ctx.prisma.notification.count({
      where: {
        userId: ctx.user.id,
        readAt: null,
        ...(seenAt ? { createdAt: { gt: seenAt } } : {}),
      },
    });
    return { count };
  } catch (error) {
    handleDatabaseError(error);
  }
}),
```

**getPreferences with default fallback for missing rows** (D-15 / req 9):
```typescript
getPreferences: protectedProcedure.query(async ({ ctx }) => {
  try {
    const existing = await ctx.prisma.notificationPreference.findMany({
      where: { userId: ctx.user.id },
    });
    const map = new Map(existing.map(p => [p.type, p]));

    const allTypes: NotificationType[] = [
      'COMMENT_REPLY', 'ADMIN_COMMENT_REPLY', 'CONTENT_UPDATE',
      'PROGRESS_NUDGE', 'INACTIVITY_RETURN', 'WEEKLY_DIGEST', 'BROADCAST',
    ];
    return allTypes.map(type => map.get(type) ?? {
      userId: ctx.user.id,
      type,
      inApp: type !== 'WEEKLY_DIGEST',  // SPEC req 2
      email: false,
    });
  } catch (error) {
    handleDatabaseError(error);
  }
}),
```

**Error handling:** в каждом try/catch использовать `handleDatabaseError(error)` (l.13 import); `TRPCError` rethrow перед db error handler (см. comments.ts:145).

---

### `packages/shared/src/notifications.ts`

**Analog:** `packages/shared/src/types/index.ts` lines 1-77.

**Pattern (enum-as-const + types):**
```typescript
// packages/shared/src/types/index.ts l.3-11
export const SkillCategory = {
  ANALYTICS: 'ANALYTICS',
  MARKETING: 'MARKETING',
  ...
} as const;
export type SkillCategory = (typeof SkillCategory)[keyof typeof SkillCategory];
```

**Apply for Phase 51 — discriminated union:**
```typescript
import type { SkillCategory } from './types';

export type NotificationPayload =
  | {
      type: 'COMMENT_REPLY';
      commentId: string;
      lessonId: string;
      lessonTitle: string;
      replyAuthorName: string;
      preview: string;
      actorUserId: string;  // for anti-self-notify check (DC-08)
    }
  | {
      type: 'ADMIN_COMMENT_REPLY';
      commentId: string;
      lessonId: string;
      lessonTitle: string;
      preview: string;
      actorUserId: string;
    }
  | {
      type: 'CONTENT_UPDATE';
      courseId: string;
      lessonIds: string[];
      courseTitle: string;
    }
  | {
      type: 'PROGRESS_NUDGE';
      lessonId: string;
      lessonTitle: string;
    }
  | {
      type: 'INACTIVITY_RETURN';
      daysSinceLastActive: number;
    }
  | {
      type: 'WEEKLY_DIGEST';
      newLessonsCount: number;
      activityCount: number;
    }
  | {
      type: 'BROADCAST';
      title: string;
      body: string;
      ctaText?: string;
    };

// Russian labels for /profile/notifications descriptions (D-16)
export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<string, string> = {
  COMMENT_REPLY: 'Ответы на твои комментарии в уроках',
  ADMIN_COMMENT_REPLY: 'Ответы методологов на твои вопросы',
  CONTENT_UPDATE: 'Новые уроки и материалы в твоих курсах',
  PROGRESS_NUDGE: 'Напоминания о незавершённых уроках',
  INACTIVITY_RETURN: 'Если давно не заходил — расскажем что нового',
  WEEKLY_DIGEST: 'Дайджест по пятницам — новинки и активность',
  BROADCAST: 'Анонсы курсов и важные новости платформы',
};
```

**Не забыть:** добавить `export * from './notifications';` в `packages/shared/src/index.ts` (текущее содержимое l.1-2):
```typescript
export * from './types';
export * from './cloudpayments';
export * from './notifications';  // <-- new
```

---

### `apps/web/src/components/notifications/NotificationBell.tsx`

**Analog 1 (refetchInterval + badge):** `apps/web/src/components/admin/AdminSidebar.tsx` l.74-90:
```typescript
function NavLinks({ userRole, pathname, onNavigate }) {
  const newComments = trpc.admin.getNewCommentsCount.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  // ...
  const badgeCount = item.href === '/admin/comments'
    ? (newComments.data?.count ?? 0)
    : 0;
}
```

**Analog 2 (Popover trigger + content):** `apps/web/src/components/learning/FilterPanel.tsx` l.166-213:
```typescript
<Popover>
  <PopoverTrigger asChild>
    <button data-no-ring className={cn(/* trigger styles */)}>
      {label}
      <svg /* chevron */ />
    </button>
  </PopoverTrigger>
  <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
    {/* content */}
  </PopoverContent>
</Popover>
```

**Analog 3 (Page Visibility API):** `apps/web/src/components/video/KinescopePlayer.tsx` l.132-156:
```typescript
let isPageVisible = !document.hidden;
const handleVisibility = () => { isPageVisible = !document.hidden; };
document.addEventListener('visibilitychange', handleVisibility);
// ... cleanup:
document.removeEventListener('visibilitychange', handleVisibility);
```

**Apply for NotificationBell — DC-02 polling pause:**
```typescript
'use client';
import { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  // D-05 / DC-02: pause polling when tab hidden
  useEffect(() => {
    const handler = () => setDocHidden(document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  const { data } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: docHidden ? false : 60_000,  // DC-02
  });
  const count = data?.count ?? 0;
  const badgeText = count > 99 ? '99+' : String(count);  // DC-07

  const markSeen = trpc.notifications.markSeen.useMutation();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) markSeen.mutate();  // D-07: clear badge counter
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          aria-label="Уведомления"
          className="relative p-2 hover:bg-mp-gray-100 rounded-md transition-colors"
        >
          {/* Bell SVG */}
          <svg className="w-5 h-5 text-mp-gray-600" /* ... */ />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
                             rounded-full bg-mp-red-500 text-white text-[10px] font-bold
                             flex items-center justify-center">
              {badgeText}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] max-h-[480px] p-0 z-50" align="end" sideOffset={8}>
        {/* Внутри: список 10 последних, два сегмента "Новые / Раньше" (D-02), footer */}
      </PopoverContent>
    </Popover>
  );
}
```

**z-index = 50** уже установлен в `popover.tsx:22` — не переопределять.

---

### `apps/web/src/components/notifications/NotificationItem.tsx`

**Analog:** `apps/web/src/components/comments/CommentItem.tsx` l.22-34 (relative time formatter).

**Reuse `formatRelativeTime`** — экспортирован из `CommentItem.tsx:22`:
```typescript
import { formatRelativeTime } from '@/components/comments/CommentItem';
// или вынести в shared utils если будут конфликты импортов через 'use client'
```

**Apply skeleton:**
```typescript
'use client';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '../comments/CommentItem';
import type { NotificationPayload } from '@mpstats/shared';

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    payload: NotificationPayload;
    ctaUrl: string | null;
    readAt: Date | null;
    createdAt: Date;
  };
  onClick?: () => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const isUnread = notification.readAt === null;
  const { type, payload, ctaUrl, createdAt } = notification;

  // Type-specific title + preview (discriminated union)
  let title = '';
  let preview = '';
  if (payload.type === 'COMMENT_REPLY' || payload.type === 'ADMIN_COMMENT_REPLY') {
    title = `${payload.replyAuthorName} ответил на твой комментарий`;  // D-15
    preview = payload.preview;
  }
  // ... другие типы

  const content = (
    <div
      className={cn(
        'flex gap-3 p-3 transition-colors hover:bg-mp-gray-50',
        isUnread && 'bg-mp-blue-50',  // D-03 unread accent
      )}
    >
      {/* TypeIcon — иконка по типу */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-mp-gray-900 truncate">{title}</p>
        <p className="text-xs text-mp-gray-500 line-clamp-2 mt-0.5">{preview}</p>
        <span className="text-xs text-mp-gray-400 mt-1 block">
          {formatRelativeTime(new Date(createdAt))}
        </span>
      </div>
    </div>
  );

  return ctaUrl ? (
    <Link href={ctaUrl} onClick={onClick} className="block">
      {content}
    </Link>
  ) : (
    <button onClick={onClick} className="w-full text-left">
      {content}
    </button>
  );
}
```

---

### `apps/web/src/app/(main)/notifications/page.tsx`

**Analog:** `apps/web/src/app/(main)/profile/history/page.tsx` (full page with trpc + isLoading + empty state).

**Skeleton from history/page.tsx:1-60:**
```typescript
'use client';

import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
// ...

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    trpc.notifications.list.useInfiniteQuery(
      { filter },
      { getNextPageParam: (last) => last?.nextCursor }
    );

  const utils = trpc.useUtils();
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => utils.notifications.invalidate(),
  });

  const items = data?.pages.flatMap(p => p?.items ?? []) ?? [];

  if (isLoading) {
    return <div className="max-w-2xl mx-auto space-y-4">{/* skeleton */}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-display-sm">Уведомления</h1>
        <Button onClick={() => markAllRead.mutate()} variant="outline" size="sm">
          Отметить все прочитанными
        </Button>
      </div>

      {/* Filter pills (all / unread) */}

      {items.length === 0 ? (
        <p className="text-mp-gray-500 text-center py-12">
          {filter === 'unread'
            ? 'Все уведомления прочитаны. 🎉'
            : 'У тебя пока нет уведомлений.'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map(n => <NotificationItem key={n.id} notification={n} />)}
        </div>
      )}

      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} variant="outline">
          {isFetchingNextPage ? 'Загрузка...' : 'Показать ещё'}
        </Button>
      )}
    </div>
  );
}
```

**URL filter param** через `useSearchParams()` (Next.js App Router): `?filter=unread` → читать в client component.

---

### `apps/web/src/app/(main)/profile/notifications/page.tsx`

**Analog:** `apps/web/src/app/(admin)/admin/settings/page.tsx` lines 1-102 (Switch + mutation + Card list pattern).

**Pattern (settings/page.tsx:18-32):**
```typescript
export default function SettingsPage() {
  const flags = trpc.admin.getFeatureFlags.useQuery(undefined, { retry: false });
  const toggle = trpc.admin.toggleFeatureFlag.useMutation({
    onSuccess: () => flags.refetch(),
  });
  // ...
}
```

**Switch usage (l.90-94):**
```typescript
<Switch
  checked={flag.enabled}
  onCheckedChange={() => toggle.mutate({ key: flag.key })}
  disabled={toggle.isPending}
/>
```

**Apply for Phase 51:**
```typescript
'use client';
import { trpc } from '@/lib/trpc/client';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { NOTIFICATION_TYPE_DESCRIPTIONS } from '@mpstats/shared';

export default function NotificationsPreferencesPage() {
  const { data: prefs } = trpc.notifications.getPreferences.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.notifications.updatePreference.useMutation({
    onSuccess: () => utils.notifications.getPreferences.invalidate(),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-display-sm">Настрой, как хочешь получать уведомления.</h1>
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-mp-gray-100">
          {prefs?.map((pref) => (
            <div key={pref.type} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{pref.type}</p>
                <p className="text-xs text-mp-gray-500 mt-0.5">
                  {NOTIFICATION_TYPE_DESCRIPTIONS[pref.type]}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-mp-gray-500">In-app</span>
                  <Switch
                    checked={pref.inApp}
                    onCheckedChange={(v) => update.mutate({ type: pref.type, inApp: v })}
                    disabled={update.isPending}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-mp-gray-400">Email</span>
                  <Switch checked={pref.email} disabled  /* "Скоро" tooltip */ />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

---

### `apps/web/src/app/api/cron/notifications-cleanup/route.ts`

**Analog:** `apps/web/src/app/api/cron/orphan-materials/route.ts` (full file 1-153). Idеnтичный shape — handle/GET/POST + Sentry checkin.

**Imports + dynamic + auth pattern (l.1-34):**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';

export const dynamic = 'force-dynamic';

async function handle(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // GitHub Actions schedules drift 60-100min — wide margin avoids false alerts.
  const checkInId = Sentry.captureCheckIn(
    {
      monitorSlug: 'notifications-cleanup',
      status: 'in_progress',
    },
    {
      schedule: { type: 'crontab', value: '0 0 * * *' },  // 00:00 UTC = 03:00 МСК
      checkinMargin: 180,
      maxRuntime: 30,
      timezone: 'UTC',
    },
  );

  try {
    // 1) Delete rows older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const oldDeleted = await prisma.notification.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });

    // 2) For users with > 500 rows: keep top 500 by createdAt DESC
    // (raw SQL для эффективности)
    const overflowDeleted = await prisma.$executeRaw`
      DELETE FROM "Notification"
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC) AS rn
          FROM "Notification"
        ) ranked
        WHERE rn > 500
      )
    `;

    console.log(
      `[notifications-cleanup] old=${oldDeleted.count} overflow=${overflowDeleted}`,
    );

    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'notifications-cleanup',
      status: 'ok',
    });

    return NextResponse.json({
      ok: true,
      cleaned: { old: oldDeleted.count, overflow: overflowDeleted },
    });
  } catch (error) {
    Sentry.captureException(error);
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'notifications-cleanup',
      status: 'error',
    });
    console.error('[notifications-cleanup] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
```

---

### `.github/workflows/notifications-cleanup.yml` (NEW)

**Analog:** `.github/workflows/orphan-materials-cleanup.yml` (полностью):
```yaml
name: Notifications Cleanup
on:
  schedule:
    - cron: '0 0 * * *'  # 00:00 UTC daily = 03:00 МСК
  workflow_dispatch: {}

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger notifications-cleanup cron endpoint
        run: |
          curl -fsSL --max-time 600 \
            -H "Authorization: Bearer $CRON_SECRET" \
            "$SITE_URL/api/cron/notifications-cleanup" \
            || echo "Warning: notifications-cleanup failed"
        env:
          SITE_URL: ${{ secrets.SITE_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

---

### `apps/web/src/lib/carrotquest/types.ts` (extend)

**Pattern (current file, l.7-26 — extend union):**
```typescript
export type CQEventName =
  // Payment & Billing
  | 'pa_payment_success'
  // ... existing ...
  | 'pa_email_change'
  // Notifications (Phase 51)
  | 'pa_notif_comment_reply'
  | 'pa_notif_admin_comment_reply'
  | 'pa_notif_content_update'
  | 'pa_notif_progress_nudge'
  | 'pa_notif_inactivity_return'
  | 'pa_notif_weekly_digest'
  | 'pa_notif_broadcast';
```

---

### MODIFIED: `packages/api/src/routers/comments.ts` (COMMENT_REPLY hook)

**Hook point:** lines 128-143 (between `prisma.lessonComment.create` and final return).

**Current (l.128-143):**
```typescript
const comment = await ctx.prisma.lessonComment.create({
  data: {
    lessonId,
    userId: ctx.user.id,
    content,
    parentId: parentId ?? null,
  },
  include: { user: { select: userSelect } },
});

return {
  ...comment,
  user: { ...comment.user, name: sanitizeUserName(comment.user.name) },
};
```

**After modification (insert before return, INSIDE existing try-catch):**
```typescript
const comment = await ctx.prisma.lessonComment.create({ /* ... */ });

// COMMENT_REPLY notification trigger — SPEC req 6
if (parentId) {
  // Fire-and-forget: ошибка в notify не должна ронять comment creation
  notifyCommentReply({
    parentCommentId: parentId,
    replyId: comment.id,
    lessonId,
    replyContent: content,
    replyAuthorName: comment.user.name ?? 'Пользователь',
    actorUserId: ctx.user.id,
  }).catch((err) => {
    console.error('[comments] notifyCommentReply failed:', err);
    // Sentry уже захватит inside notify()
  });
}

return {
  ...comment,
  user: { ...comment.user, name: sanitizeUserName(comment.user.name) },
};
```

`notifyCommentReply` — helper в `services/notifications.ts`, который сам fetch'ит parent + lesson title и зовёт `notify()`. Это держит comments router чистым (см. CONTEXT.md → "code_context" → "Integration Points").

**New import at top of file** (after line 13):
```typescript
import { notifyCommentReply } from '../services/notifications';
```

---

### MODIFIED: `apps/web/src/components/comments/CommentItem.tsx`

**Hook point:** line 157-158 (root `<div>` opening), line 220 (reply `<CommentItem>` map).

**Current root div (l.157-158):**
```typescript
return (
  <div>
    <div className="flex gap-3">
```

**After modification:**
```typescript
return (
  <div id={`comment-${comment.id}`} className="scroll-mt-20">
    {/*                              ^^^^^^^^^^^^^^ scroll-margin для header offset */}
    <div className="flex gap-3">
```

**Replies — нужно проверить, что reply тоже получает id.** Lines 220-232 уже зовут `<CommentItem>` рекурсивно — id придёт автоматически из `comment={reply}`.

`scroll-mt-20` — Tailwind утилита, компенсирует sticky header высотой ~64px (h-16 в layout.tsx:72 = 4rem = 64px ≈ scroll-mt-16/20). Уточнить число при тестировании.

---

### MODIFIED: `apps/web/src/app/(main)/learn/[id]/page.tsx`

**Analog внутри проекта:** `apps/web/src/app/(main)/learn/page.tsx` lines 124-134 — IDENTICAL pattern hash → scrollIntoView.

**Existing pattern (learn/page.tsx:124-134):**
```typescript
// Auto-expand course from URL hash (e.g. /learn#01_analytics)
useEffect(() => {
  const hash = window.location.hash.slice(1);
  if (hash && courses?.some((c) => c.id === hash)) {
    setExpandedCourses((prev) => new Set(prev).add(hash));
    setViewMode('courses');
    setTimeout(() => {
      document.getElementById(`course-${hash}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}, [courses]);
```

**Apply for Phase 51 — D-11/D-12 in `learn/[id]/page.tsx`:**
Добавить новый useEffect после уже существующих (около l.314, после Metrika tracking):
```typescript
// Phase 51 — anchor scroll к комменту с highlight (D-11, D-12)
useEffect(() => {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash.slice(1);  // "comment-cuid123"
  if (!hash.startsWith('comment-')) return;

  // Wait for comments to render — they load async via tRPC
  const tryHighlight = () => {
    const el = document.getElementById(hash);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('notification-highlight');
    setTimeout(() => el.classList.remove('notification-highlight'), 1500);
    return true;
  };

  // Try immediately, retry up to 5x (comments load async)
  if (tryHighlight()) return;
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (tryHighlight() || attempts >= 5) clearInterval(interval);
  }, 300);
  return () => clearInterval(interval);
}, [data?.lesson?.id]);  // Re-run when lesson loads
```

**Также добавить в `globals.css`** (DC-04):
```css
.notification-highlight {
  background-color: rgb(239 246 255 / 1);  /* mp-blue-50 */
  transition: background-color 1500ms ease-out;
}
```

---

### MODIFIED: `apps/web/src/app/(main)/layout.tsx`

**Hook point:** lines 81-88 (header right cluster).

**Current (l.81-88):**
```typescript
{/* Help + User nav */}
<div className="flex items-center gap-2">
  <HelpCircleButton />
  <UserNav user={{
    email: user.email,
    name: profile?.name || user.user_metadata?.full_name || user.user_metadata?.name || null,
    avatarUrl: profile?.avatarUrl || null,
  }} />
</div>
```

**After modification (insert NotificationBell BEFORE HelpCircleButton per CONTEXT D-Integration):**

CONTEXT.md "Integration Points" говорит: «`<NotificationBell />` встаёт **ПЕРЕД** `<HelpCircleButton />` чтобы порядок был: Bell | Help | UserNav».

```typescript
{/* Bell + Help + User nav */}
<div className="flex items-center gap-2">
  <NotificationBell />
  <HelpCircleButton />
  <UserNav user={/* ... */} />
</div>
```

**Import (after line 12):**
```typescript
import { NotificationBell } from '@/components/notifications/NotificationBell';
```

⚠ `layout.tsx` is server component, `NotificationBell` is `'use client'`. This works в App Router — server component render'ит client component as child.

---

### MODIFIED: `packages/api/src/root.ts`

**Current (full file):**
```typescript
import { router } from './trpc';
import { profileRouter } from './routers/profile';
// ...
import { materialRouter } from './routers/material';

export const appRouter = router({
  profile: profileRouter,
  // ...
  material: materialRouter,
});
export type AppRouter = typeof appRouter;
```

**Apply (add 2 lines):**
```typescript
import { notificationsRouter } from './routers/notifications';

export const appRouter = router({
  // ...existing...
  material: materialRouter,
  notifications: notificationsRouter,  // <-- new
});
```

---

## Shared Patterns (cross-cutting)

### Authentication (protected procedure)
**Source:** `packages/api/src/trpc.ts:29-58`
**Apply to:** All notifications router procedures

Все 7 procedures в notifications router — `protectedProcedure` (auto-injects `ctx.user`, throws UNAUTHORIZED). См. comments.ts pattern — все procedures уже используют этот паттерн.

### Error handling (handleDatabaseError)
**Source:** `packages/api/src/utils/db-errors.ts:15-44`
**Apply to:** Every try/catch in notifications router + service

Pattern (comments.ts:88-90):
```typescript
} catch (error) {
  if (error instanceof TRPCError) throw error;  // Rethrow tRPC errors first
  handleDatabaseError(error);  // Then map Prisma errors to TRPCError
}
```

### Sentry checkin для cron
**Source:** `apps/web/src/app/api/cron/orphan-materials/route.ts:37-48`
**Apply to:** notifications-cleanup cron

Pattern: `captureCheckIn({ monitorSlug, status: 'in_progress' }, { schedule, checkinMargin: 180, maxRuntime, timezone })`. Margin = 180 минут — крайне важно (false-alert lesson из MAAL-PLATFORM-1).

### CQ event firing (fire-and-forget с Sentry)
**Source:** `apps/web/src/lib/carrotquest/emails.ts:64-83`
**Apply to:** `services/notifications.ts:notify()`

Pattern: `try { setUserProps + trackEvent } catch (e) { reportError(stage, userId, e) }`. CQ failures НЕ должны ронять caller (notify() called inside comments.create which already returns successfully).

### Page Visibility API for polling pause
**Source:** `apps/web/src/components/video/KinescopePlayer.tsx:132-156`
**Apply to:** NotificationBell (DC-02)

Pattern: `addEventListener('visibilitychange', handler)` + cleanup в `useEffect` return. См. snippet выше в NotificationBell section.

### Hash-based scroll deep-link
**Source:** `apps/web/src/app/(main)/learn/page.tsx:124-134`
**Apply to:** `learn/[id]/page.tsx` для anchor highlight (req 10)

Pattern: `window.location.hash.slice(1)` → `getElementById` → `scrollIntoView({ behavior: 'smooth' })`. Async DOM (comments load via tRPC) → setTimeout/retry interval.

### Russian relative time formatter
**Source:** `apps/web/src/components/comments/CommentItem.tsx:22-34`
**Apply to:** `NotificationItem.tsx` (consistency с CommentItem'ом)

Reuse export `formatRelativeTime` (или вынести в `@/lib/utils.ts` если возникнет проблема с client-component import chain).

---

## Testing Pattern

**Source:** `packages/api/src/routers/__tests__/material.test.ts:1-60`

Pattern для unit-тестов router'а с моком prisma + cq:
```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/notifications', () => ({
  notify: vi.fn(),
  notifyMany: vi.fn(),
  notifyCommentReply: vi.fn(),
}));

function makeCtx(overrides = {}) {
  return {
    user: { id: 'user-1' },
    prisma: {
      notification: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      notificationPreference: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
      },
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({ role: 'USER', lastNotificationsSeenAt: null }),
        update: vi.fn(),
      },
      ...overrides.prisma,
    },
    ...overrides,
  };
}
```

Required test scenarios (SPEC req 4 + req 5 acceptance):
1. `notify()`: inApp=true → row created + CQ event fired
2. `notify()`: inApp=false → no row, but CQ event STILL fires
3. `notify()`: actorUserId === userId → return early, no row, no event
4. `markRead`: ownership check — user B нельзя прочитать notification A (FORBIDDEN)
5. `list`: cursor pagination возвращает корректный nextCursor
6. `unreadCount`: учитывает `lastNotificationsSeenAt`

E2E тест (Playwright, DC-05):
- Login как user B → user A reply на коммент B → wait 90s → user B видит badge `1` → click → markRead → badge gone

---

## No Analog Found

Все файлы имеют analog в кодбейзе. Близких к 1:1 переиспользований — большинство (см. таблицу File Classification, "exact" matches).

**Единственный нюанс:** `packages/api/src/services/` — НОВАЯ ДИРЕКТОРИЯ. До Phase 51 в `packages/api/src/` были только `routers/`, `middleware/`, `mocks/`, `utils/`. Service layer создаётся впервые. Аналог по shape — `apps/web/src/lib/carrotquest/emails.ts`, но архитектурно лежит в другом package (см. ARCHITECTURE NOTE выше — нужно решение по cross-package CQ client).

---

## Metadata

**Analog search scope:**
- `packages/api/src/routers/` (10 routers)
- `packages/api/src/utils/`, `packages/api/src/trpc.ts`
- `packages/db/prisma/schema.prisma` (всё)
- `packages/shared/src/types/index.ts`
- `apps/web/src/lib/carrotquest/` (client.ts, emails.ts, types.ts)
- `apps/web/src/components/{ui,comments,admin,learning,shared}/`
- `apps/web/src/app/(main)/` + `app/(admin)/admin/settings/`
- `apps/web/src/app/api/cron/` (4 routes)
- `.github/workflows/`
- `packages/api/src/routers/__tests__/`

**Files scanned:** ~30 files (read), ~15 files (grep)
**Pattern extraction date:** 2026-04-30
