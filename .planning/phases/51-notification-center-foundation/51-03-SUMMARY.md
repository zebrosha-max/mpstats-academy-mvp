---
phase: 51-notification-center-foundation
plan: 03
subsystem: notifications
tags: [trpc, router, api, permissions, pagination, notifications]
requires:
  - "prisma.notification table (51-01)"
  - "prisma.notificationPreference table (51-01)"
  - "NotificationType enum (51-01)"
  - "UserProfile.lastNotificationsSeenAt column (51-01)"
  - "ALL_NOTIFICATION_TYPES + DEFAULT_IN_APP_PREFS from @mpstats/shared (51-01)"
provides:
  - "trpc.notifications.list query (cursor pagination, all|unread filter)"
  - "trpc.notifications.unreadCount query (badge polling, lastNotificationsSeenAt aware)"
  - "trpc.notifications.markRead mutation (ownership check via FORBIDDEN)"
  - "trpc.notifications.markAllRead mutation"
  - "trpc.notifications.markSeen mutation (D-07 hybrid badge clear)"
  - "trpc.notifications.getPreferences query (7 types, default fallback)"
  - "trpc.notifications.updatePreference mutation (upsert by composite (userId, type))"
  - "appRouter.notifications registration"
affects:
  - packages/api/src/routers/notifications.ts
  - packages/api/src/root.ts
  - packages/api/src/routers/__tests__/notifications.test.ts
tech-stack:
  added: []
  patterns:
    - "cursor pagination with skip:1 (comments.ts pattern)"
    - "two-step ownership check (findUnique select userId → throw FORBIDDEN)"
    - "composite primary key upsert via where: { userId_type: { ... } }"
    - "Zod enum from `as const` tuple"
    - "TRPCError rethrow before handleDatabaseError"
key-files:
  created:
    - packages/api/src/routers/notifications.ts
    - packages/api/src/routers/__tests__/notifications.test.ts
  modified:
    - packages/api/src/root.ts
decisions:
  - "Schema NOT re-pushed — 51-01 already pushed schema; only `pnpm db:generate` required."
  - "markRead returns { alreadyRead: true } for already-read own notifications instead of no-op or duplicate write."
  - "updatePreference resolves nextInApp/nextEmail through existing row → DEFAULT_IN_APP_PREFS fallback to keep create branch consistent with implicit defaults."
  - "Zod NotificationTypeEnum derived from ALL_NOTIFICATION_TYPES tuple — single source of truth (no enum duplication)."
metrics:
  duration: "~20 minutes"
  completed: "2026-04-30"
---

# Phase 51 Plan 03: Notifications tRPC Router Summary

**One-liner:** tRPC `notifications` router with 7 protected procedures (list/unreadCount/markRead/markAllRead/markSeen/getPreferences/updatePreference) registered in appRouter, covered by 14 unit tests on permissions + pagination + lastNotificationsSeenAt edge cases.

## What Shipped

### `packages/api/src/routers/notifications.ts` (215 lines, NEW)

Seven `protectedProcedure` endpoints, all `try/catch` wrapped through `handleDatabaseError`:

| Procedure | Type | Input | Output | Notes |
|-----------|------|-------|--------|-------|
| `list` | query | `{ filter: 'all'\|'unread' = 'all', cursor?: string }` | `{ items, nextCursor, totalCount }` | Cursor pagination 20/page; `cursor + skip:1` pattern from comments.ts; total count from `Promise.all([count, findMany])` |
| `unreadCount` | query | none | `{ count: number }` | Reads `UserProfile.lastNotificationsSeenAt` first, then `count WHERE userId=me AND readAt IS NULL AND (createdAt > seenAt)`. Skips `createdAt` filter when `seenAt` is null |
| `markRead` | mutation | `{ notificationId: string }` | `{ success: true }` \| `{ alreadyRead: true }` | Two-step ownership: `findUnique select { userId, readAt }` → if missing → `NOT_FOUND`; if `userId !== ctx.user.id` → `FORBIDDEN`; if `readAt` already set → return early |
| `markAllRead` | mutation | none | `{ count: number }` | `updateMany WHERE userId=me AND readAt=null` — single SQL UPDATE |
| `markSeen` | mutation | none | `{ success: true }` | `UPDATE UserProfile SET lastNotificationsSeenAt = NOW() WHERE id = ctx.user.id`. D-07 hybrid: clears badge counter, but item-level `readAt` unchanged |
| `getPreferences` | query | none | `Array<NotificationPreference \| default>` | Iterates `ALL_NOTIFICATION_TYPES` tuple; for each type returns DB row if exists, else fallback `{ userId, type, inApp: DEFAULT_IN_APP_PREFS[type], email: false }`. Always 7 entries |
| `updatePreference` | mutation | `{ type: NotificationType, inApp?: boolean, email?: boolean }` | `NotificationPreference` row | `upsert WHERE userId_type = (me, type)`. `create` branch uses existing row OR DEFAULT_IN_APP_PREFS to populate non-supplied fields. `update` branch only writes provided fields |

**Key implementation details:**

- `NotificationTypeEnum` is a `z.enum(...)` derived from `ALL_NOTIFICATION_TYPES` tuple — Zod parses untyped runtime input into the discriminated union literal.
- `NOTIFICATIONS_PER_PAGE = 20` constant matches SPEC req 5.
- All mutations that throw `TRPCError` (markRead) rethrow it before `handleDatabaseError` to preserve the original code (FORBIDDEN/NOT_FOUND vs. INTERNAL_SERVER_ERROR mapping).

### `packages/api/src/root.ts` (modified)

Added 2 lines:
```ts
import { notificationsRouter } from './routers/notifications';
// ... and inside router({}):
notifications: notificationsRouter,
```

`appRouter.notifications.*` is now reachable in `apps/web` via `trpc.notifications.*` (auto type-inferred).

### `packages/api/src/routers/__tests__/notifications.test.ts` (253 lines, 14 tests, NEW)

Mock-based unit tests using `notificationsRouter.createCaller(ctx)` (no real DB). All 14 tests pass.

| Suite | Test count | Coverage |
|-------|-----------|----------|
| `markRead` | 4 | FORBIDDEN on foreign user; NOT_FOUND on missing row; `alreadyRead` short-circuit when `readAt` set; success path triggers `update` exactly once |
| `list` | 3 | `filter='unread'` adds `readAt: null` to where; nextCursor returns last id when 20 items; nextCursor null when < PAGE_SIZE |
| `unreadCount` | 2 | No `createdAt` filter when `lastNotificationsSeenAt` is null; `createdAt: { gt: seenAt }` when set |
| `getPreferences` | 2 | 7 default rows when DB empty (WEEKLY_DIGEST inApp=false, others true; email=false everywhere); user override merges correctly |
| `updatePreference` | 1 | Upsert called with composite `{ userId_type: { userId, type } }`; `update` branch only contains supplied fields |
| `markSeen` | 1 | `userProfile.update` called with `{ lastNotificationsSeenAt: any Date }` |
| `markAllRead` | 1 | `updateMany` called with `{ where: { userId, readAt: null }, data: { readAt: any Date } }` |

## Artifacts for Downstream Waves

| Artifact | Where | Used by |
|----------|-------|---------|
| `notificationsRouter` (7 procedures) | `packages/api/src/routers/notifications.ts` | wave 04 (NotificationBell — unreadCount, markSeen), wave 05 (/notifications page — list, markRead, markAllRead), wave 05 (/profile/notifications — getPreferences, updatePreference) |
| `trpc.notifications.*` client API | `apps/web/src/lib/trpc/client.ts` (auto-inferred from AppRouter) | All UI waves |
| Permission guarantees (FORBIDDEN on foreign markRead) | covered by 14 unit tests | future maintenance / regression prevention |

## Verification

- [x] `packages/api/src/routers/notifications.ts` exists, 215 lines (≥150 required)
- [x] `grep -c "protectedProcedure"` returns 9 (≥7 required — 7 procedures + 1 import + 1 type usage)
- [x] `grep -n "FORBIDDEN"` finds ownership check in markRead
- [x] `grep -n "lastNotificationsSeenAt"` finds usage in `unreadCount` and `markSeen`
- [x] `packages/api/src/root.ts` registers `notifications: notificationsRouter` (line 23)
- [x] `pnpm typecheck` exits 0 (6/6 tasks pass)
- [x] `vitest run src/routers/__tests__/notifications.test.ts` — 14/14 tests pass in 12ms
- [x] Test file 253 lines (≥100 required), `grep -c "  it("` returns 14 (≥10 required)

## Deviations from Plan

None — plan executed exactly as written.

The only environmental setup outside the plan: worktree had no `node_modules` and no `packages/db/.env`. Resolved by `pnpm install --prefer-offline --ignore-scripts` (13.2s, used pnpm store from main MAAL, 0 downloads) + `cp ../../../packages/db/.env packages/db/.env`. Same pattern as 51-01 plan execution. Schema was NOT re-pushed (per parallel-executor instruction: 51-01 already pushed it).

## Commits

| Task | Hash | Subject |
|------|------|---------|
| 1 | `edfb58f` | feat(phase-51-03): add notifications router with 7 protected procedures |
| 2 | `3354409` | feat(phase-51-03): register notificationsRouter in appRouter |
| 3 | `4b086a8` | test(phase-51-03): add notifications router unit tests (14 tests) |

## Self-Check: PASSED

- All claimed files exist on disk (router 215 lines, root.ts modified, test 253 lines).
- All 3 commits present in git log of the worktree branch.
- Typecheck green across monorepo (6/6 turbo tasks pass).
- Vitest run confirmed 14/14 tests pass against router behaviour.
