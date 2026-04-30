---
phase: 51-notification-center-foundation
plan: 01
subsystem: notifications
tags: [schema, types, foundation, prisma, shared, carrotquest]
requires: []
provides:
  - "prisma.notification table"
  - "prisma.notificationPreference table"
  - "NotificationType enum (7 values)"
  - "UserProfile.lastNotificationsSeenAt column"
  - "NotificationPayload discriminated union"
  - "NOTIFICATION_TYPE_DESCRIPTIONS map"
  - "DEFAULT_IN_APP_PREFS map"
  - "ALL_NOTIFICATION_TYPES tuple"
  - "CQEventName extension with 7 pa_notif_* events"
affects:
  - packages/db/prisma/schema.prisma
  - packages/shared/src/notifications.ts
  - packages/shared/src/index.ts
  - apps/web/src/lib/carrotquest/types.ts
tech-stack:
  added: []
  patterns:
    - "discriminated union per NotificationType"
    - "@@id composite primary key (NotificationPreference)"
    - "@@index multi-column with sort (Notification)"
key-files:
  created:
    - packages/shared/src/notifications.ts
  modified:
    - packages/db/prisma/schema.prisma
    - packages/shared/src/index.ts
    - apps/web/src/lib/carrotquest/types.ts
decisions:
  - "Schema applied via pnpm db:push ONCE in this plan (recurring Phase 28 lesson). Downstream waves 02-07 must NOT re-run db:push."
  - "DEFAULT_IN_APP_PREFS implements WEEKLY_DIGEST=false at code level — Prisma cannot set per-enum-value default."
  - "NotificationType enum order is FROZEN per D-10 — order is part of public contract."
metrics:
  duration: "~25 minutes"
  completed: "2026-04-30"
---

# Phase 51 Plan 01: Notifications Foundation Summary

**One-liner:** Prisma schema extended with Notification + NotificationPreference + NotificationType enum + UserProfile.lastNotificationsSeenAt; shared package exports NotificationPayload discriminated union + descriptions + defaults; CQEventName union extended with 7 pa_notif_* events.

## What Shipped

### Database (`packages/db/prisma/schema.prisma`)

Added at the end of the schema file:

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
  id          String           @id @default(cuid())
  userId      String
  type        NotificationType
  payload     Json
  ctaUrl      String?
  readAt      DateTime?
  createdAt   DateTime         @default(now())
  broadcastId String?

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

Extended `UserProfile`:
- Added `lastNotificationsSeenAt DateTime?` (D-07 — badge counter clears on dropdown open)
- Added `notifications Notification[]` reverse relation
- Added `notificationPrefs NotificationPreference[]` reverse relation

**Migration applied:** `pnpm db:push` exit 0; smoke test `prisma.notification.count()` and `prisma.notificationPreference.count()` both return `0` rows. Schema is in sync with Supabase production database (shared with prod). Aдитивная миграция, data loss = 0.

### Shared Package (`packages/shared/src/notifications.ts` — NEW)

- `NotificationPayload` — TypeScript discriminated union with 7 variants (one per NotificationType). `COMMENT_REPLY` and `ADMIN_COMMENT_REPLY` carry `actorUserId` for anti-self-notify check (DC-08). Designed to round-trip through Prisma `Json` column.
- `ALL_NOTIFICATION_TYPES` — `as const` tuple in SPEC-locked order.
- `NotificationTypeName` — derived literal union from the tuple.
- `NOTIFICATION_TYPE_DESCRIPTIONS` — `Record<NotificationTypeName, string>` with Russian labels (D-16, «ты» tone D-14) for /profile/notifications copy.
- `DEFAULT_IN_APP_PREFS` — `Record<NotificationTypeName, boolean>`; `WEEKLY_DIGEST = false` (opt-in), all others `true`. Used by `notifications.getPreferences` to fill missing rows.

`packages/shared/src/index.ts` re-exports `./notifications` after the existing `./types` and `./cloudpayments` lines.

### CarrotQuest Types (`apps/web/src/lib/carrotquest/types.ts`)

Extended `CQEventName` union (preserved all 13 existing pa_* events) with 7 new entries:

```
pa_notif_comment_reply
pa_notif_admin_comment_reply
pa_notif_content_update
pa_notif_progress_nudge
pa_notif_inactivity_return
pa_notif_weekly_digest
pa_notif_broadcast
```

Naming convention `pa_notif_<lowercase_type>` matches `notify()` formula `\`pa_notif_\${type.toLowerCase()}\`` planned in wave 02.

## Migration Commands (executed)

```bash
cd MAAL  # (worktree root in this case)
pnpm install --prefer-offline --ignore-scripts   # 13.4s — was missing in worktree
cp packages/db/.env <worktree>/packages/db/.env  # main project's .env (DATABASE_URL etc.)
pnpm db:generate                                 # ✔ Prisma Client v5.22.0 generated
pnpm db:push                                     # ✔ Database in sync, additive only
pnpm typecheck                                   # ✔ 6/6 tasks pass
```

For the VPS production deploy: only `pnpm install && pnpm db:push && docker compose ... build` — schema already pushed to shared Supabase from this run; VPS `pnpm db:push` will be a no-op.

## Artifacts for Downstream Waves

| Artifact | Where | Used by wave |
|----------|-------|--------------|
| `Notification`, `NotificationPreference` Prisma models | `@mpstats/db` | 02 (notify service), 03 (router), 06 (cron cleanup) |
| `NotificationType` enum | `@prisma/client` re-export | 02, 03, 04, 05 |
| `UserProfile.lastNotificationsSeenAt` | `@mpstats/db` | 03 (`unreadCount`, `markSeen`), 04 (NotificationBell) |
| `NotificationPayload` discriminated union | `@mpstats/shared` | 02 (notify), 04 (NotificationItem render), 05 (preferences page) |
| `ALL_NOTIFICATION_TYPES` tuple | `@mpstats/shared` | 03 (`getPreferences` iteration), 05 |
| `NOTIFICATION_TYPE_DESCRIPTIONS` | `@mpstats/shared` | 05 (/profile/notifications copy) |
| `DEFAULT_IN_APP_PREFS` | `@mpstats/shared` | 02 (notify inApp check), 03 (`getPreferences` fallback) |
| `CQEventName` 7 new entries | `apps/web/src/lib/carrotquest/types.ts` | 02 (`cq.trackEvent`) |

## Schema Push Marker (CRITICAL for downstream)

**`pnpm db:push` HAS BEEN EXECUTED** in this plan. Database state matches schema at commit `93442fb`.

Downstream waves (02-07) MUST NOT run `pnpm db:push`. They:
- May run `pnpm db:generate` after pulling new schema commits if Prisma client gets out of sync
- May NOT add new migrations or schema changes — phase 51 schema is now frozen
- If wave 06 (cron-cleanup) needs new schema fields → escalate as architectural change (Rule 4), not silent push

## Deviations from Plan

None — plan executed exactly as written.

The only environmental work outside the plan: the worktree's `node_modules` and `packages/db/.env` were missing (worktrees are bare git checkouts — no install state). Resolved by running `pnpm install --prefer-offline --ignore-scripts` (used pnpm store cache from main MAAL, 0 downloads, 13.4s) and copying `.env` from the main project. This is environmental setup, not a deviation from plan logic.

## Commits

| Task | Hash | Subject |
|------|------|---------|
| 1 | `28341bc` | feat(phase-51-01): add Notification + NotificationPreference models + NotificationType enum |
| 2 | `6c8a275` | feat(phase-51-01): add NotificationPayload discriminated union + descriptions |
| 3 | `93442fb` | feat(phase-51-01): extend CQEventName with 7 pa_notif_* events |

## Verification

- [x] `pnpm db:generate` exits 0
- [x] `pnpm db:push` exits 0 (no data loss prompts)
- [x] `prisma.notification.count()` returns 0 (table exists, queryable)
- [x] `prisma.notificationPreference.count()` returns 0 (table exists, queryable)
- [x] `pnpm typecheck` exits 0 — 6/6 tasks pass (db, shared, ai, api, web, db#build)
- [x] `grep -n "model Notification {" packages/db/prisma/schema.prisma` — found at line 470
- [x] `grep -n "enum NotificationType" packages/db/prisma/schema.prisma` — found at line 460, 7 values in SPEC order
- [x] `grep -n "lastNotificationsSeenAt" packages/db/prisma/schema.prisma` — found in UserProfile
- [x] `packages/shared/src/notifications.ts` exists and exports `NotificationPayload`, `NOTIFICATION_TYPE_DESCRIPTIONS`, `DEFAULT_IN_APP_PREFS`, `ALL_NOTIFICATION_TYPES`, `NotificationTypeName`
- [x] `packages/shared/src/index.ts` contains `export * from './notifications';`
- [x] `apps/web/src/lib/carrotquest/types.ts` `CQEventName` union has all 7 new `pa_notif_*` entries (grep count = 7)
- [x] All 13 pre-existing pa_* events preserved (no deletions)

## Self-Check: PASSED

All claimed files exist, all commits present in git log, typecheck green across monorepo, smoke query against Supabase confirmed both new tables are reachable.
