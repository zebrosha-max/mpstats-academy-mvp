---
phase: 51-notification-center-foundation
plan: 02
subsystem: notifications
tags: [service, notify, carrotquest, sentry, vitest, anti-self-notify]
requires:
  - "51-01 (Notification + NotificationPreference Prisma models)"
  - "51-01 (NotificationPayload + DEFAULT_IN_APP_PREFS in @mpstats/shared)"
  - "51-01 (CQEventName extended with 7 pa_notif_* events)"
provides:
  - "notify(userId, type, payload, opts) — single in-app + CQ trigger"
  - "notifyMany(userIds, type, buildPayload, opts) — bulk via createMany"
  - "notifyCommentReply({replyCommentId, actorUserId}) — resolves parent+lesson, calls notify"
  - "Anti-self-notify enforcement (DC-08) at notify() and notifyCommentReply() layers"
  - "DEFAULT_IN_APP_PREFS fallback when NotificationPreference row absent"
affects:
  - apps/web/src/lib/notifications/notify.ts
  - apps/web/src/lib/notifications/__tests__/notify.test.ts
tech-stack:
  added: []
  patterns:
    - "discriminated union narrow via 'in' operator for anti-self-notify"
    - "double-layer try/catch (outer for whole notify, inner for CQ)"
    - "fire-and-forget with Sentry.captureException + tags {area: notifications, stage}"
    - "createMany + sequential CQ events for rate-limit-aware bulk"
key-files:
  created:
    - apps/web/src/lib/notifications/notify.ts
    - apps/web/src/lib/notifications/__tests__/notify.test.ts
  modified: []
decisions:
  - "Module location apps/web/src/lib/notifications (NOT packages/api/services) per D-01: workspace dep direction is apps/web → packages, never reverse, and cq client lives in apps/web."
  - "Anti-self-notify uses 'actorUserId' in payload type-narrow — discriminated union guarantees the field exists only on COMMENT_REPLY / ADMIN_COMMENT_REPLY variants. Broadcast/system types correctly bypass."
  - "CQ event always fires regardless of inApp pref — CQ rule decides email delivery (per Phase 33 pattern). Failed CQ does not block already-created DB row."
  - "notifyMany applies NO anti-self-notify check — broadcast types have no actor. Use notify() per-user for actor-driven triggers."
metrics:
  duration: "~20 minutes"
  completed: "2026-04-30"
---

# Phase 51 Plan 02: Notification Service Summary

**One-liner:** Centralized `notify()` service в `apps/web/src/lib/notifications/notify.ts` с anti-self-notify, NotificationPreference.inApp gating, fire-and-forget Sentry error capture; плюс `notifyMany()` для bulk и `notifyCommentReply()` helper резолвящий parent comment + lesson title; покрытие 10 unit-тестов на Vitest.

## What Shipped

### Service module (`apps/web/src/lib/notifications/notify.ts` — NEW, 208 lines)

Three exports:

1. **`notify(userId, type, payload, opts)`** — основной entry-point. Поведение:
   - Если `'actorUserId' in payload && payload.actorUserId === userId` → return early (anti-self).
   - `prisma.notificationPreference.findUnique` → если row есть, читает `inApp`; иначе `DEFAULT_IN_APP_PREFS[type]`.
   - Если `inApp = true` → `prisma.notification.create` со ссылкой `ctaUrl` и optional `broadcastId`.
   - Всегда триггерит CQ: `cq.setUserProps` (если `payload.preview` присутствует) + `cq.trackEvent(userId, 'pa_notif_<type_lowercase>')`.
   - Inner try/catch вокруг CQ — failure не ломает уже созданный DB row.
   - Outer try/catch вокруг всего — Sentry.captureException + tags `{ area: 'notifications', stage }`, no throw.

2. **`notifyMany(userIds, type, buildPayload, opts)`** — bulk vehicle для Phase 53/54:
   - Один `prisma.notification.createMany({ data })` для всех получателей.
   - CQ events последовательно (CQ rate limit ~50/sec из Phase 33 опыта).
   - Each user wrapped в свой try/catch — single failure не ломает остальных.
   - **Не применяет anti-self-notify** — broadcast types не имеют actorUserId.

3. **`notifyCommentReply({replyCommentId, actorUserId})`** — helper для Phase 51 единственного живого триггера:
   - `prisma.lessonComment.findUnique` для reply (с `user.name` select).
   - Early return если `!reply || !reply.parentId` (комментарий удалён или не реплай).
   - `prisma.lessonComment.findUnique` для parent → `parent.userId` = recipient.
   - Defense-in-depth: `parent.userId === actorUserId` → return (notify() ниже тоже проверит).
   - `prisma.lesson.findUnique` для `title` (fallback `'Урок'` если null).
   - Calls `notify(parent.userId, 'COMMENT_REPLY', payload, { ctaUrl: '/learn/<lessonId>#comment-<replyId>' })`.

### Tests (`apps/web/src/lib/notifications/__tests__/notify.test.ts` — NEW, 218 lines, 10 cases)

| # | Test | Coverage |
|---|------|----------|
| 1 | inApp=true → row created + CQ event | Happy path |
| 2 | inApp=false → no row, BUT CQ event fires | SPEC req 4 (CQ independent of in-app) |
| 3 | actorUserId === userId → no row, no event, no findUnique | DC-08 anti-self-notify |
| 4 | pref=null + COMMENT_REPLY → DEFAULT=true, row created | DEFAULT_IN_APP_PREFS fallback |
| 5 | pref=null + WEEKLY_DIGEST → DEFAULT=false, no row, CQ fires | DEFAULT_IN_APP_PREFS opt-in case |
| 6 | cq.trackEvent throws → Sentry captured, notify resolves | Fire-and-forget contract |
| 7 | CONTENT_UPDATE bypasses anti-self (no actorUserId) | Discriminated union narrow |
| 8 | INACTIVITY_RETURN bypasses anti-self | Same |
| 9 | notifyCommentReply happy path → notify called with correct ctaUrl | Helper integration |
| 10 | notifyCommentReply parent.userId === actorUserId → no notify | Helper layer self-skip |

All mocks hoisted via `vi.mock`: `@mpstats/db/client`, `@/lib/carrotquest/client`, `@sentry/nextjs`. `beforeEach(vi.clearAllMocks)` ensures isolation.

## Verification Output

- `pnpm typecheck` → 6/6 tasks pass (db, shared, ai, api, web, db#build)
- `pnpm vitest run src/lib/notifications/__tests__/notify.test.ts` → **10/10 passed**, 1.68s total
- `grep -c "export async function" apps/web/src/lib/notifications/notify.ts` → **3**
- `grep -c "Sentry.captureException" apps/web/src/lib/notifications/notify.ts` → **1** (helper used 4x via reportNotifyError)
- `grep -n "actorUserId === userId"` → found at line 57 + comments at 8, 150
- `grep -n "DEFAULT_IN_APP_PREFS\[type\]"` → found at line 65 + comment at 10
- `grep -c "it(" apps/web/src/lib/notifications/__tests__/notify.test.ts` → **10**

## Artifacts for Downstream Waves

| Artifact | Where | Used by wave |
|----------|-------|--------------|
| `notify(userId, type, payload, opts)` | `@/lib/notifications/notify` | 03 (router internal — markRead etc. don't call it; broadcast cron in Phase 54 will) |
| `notifyCommentReply({replyCommentId, actorUserId})` | `@/lib/notifications/notify` | 04 (route handler `/api/notifications/notify-reply` — POSITION-AFTER-create в comments router) |
| `notifyMany` | `@/lib/notifications/notify` | Phase 53 (retention cron), Phase 54 (broadcast send) |
| `NotifyOpts` interface | `@/lib/notifications/notify` | 04 (route handler types) |
| `NotifyCommentReplyArgs` interface | `@/lib/notifications/notify` | 04 (route handler input shape) |

## Deviations from Plan

None — plan executed exactly as written.

The only environmental work outside plan logic: worktree's `node_modules` and `packages/db/.env` were missing (worktrees are bare git checkouts). Resolved by `pnpm install --prefer-offline --ignore-scripts` (12.2s, 0 downloads, used pnpm store cache from main MAAL) + copying `.env` from main project + `pnpm db:generate`. **No `pnpm db:push` ran** — schema already pushed by 51-01.

One minor defensive addition vs plan literal text: helper uses `reply.user?.name ?? 'Пользователь'` (optional chain) instead of `reply.user.name ?? 'Пользователь'`. Prisma typing returns `user` as nullable on the include shape; without `?` typecheck would warn under stricter settings. Behavior is identical — same fallback string. Categorized as Rule 1 (correctness) micro-fix, no scope expansion.

## Commits

| Task | Hash | Subject |
|------|------|---------|
| 1 | `b0740a7` | feat(phase-51-02): add notify service with notify, notifyMany, notifyCommentReply |
| 2 | `a77b2f5` | test(phase-51-02): add 10 unit tests for notify, notifyMany scenarios + notifyCommentReply |

## Self-Check: PASSED

- [x] `apps/web/src/lib/notifications/notify.ts` exists (208 lines, 3 exported async functions)
- [x] `apps/web/src/lib/notifications/__tests__/notify.test.ts` exists (218 lines, 10 it-blocks)
- [x] Commit `b0740a7` present in `git log`
- [x] Commit `a77b2f5` present in `git log`
- [x] `pnpm typecheck` exits 0 across monorepo
- [x] All 10 tests PASS (vitest exit 0)
- [x] Anti-self-notify covered by explicit test (case 3)
- [x] Discriminated union narrow verified for broadcast types (cases 7-8)
- [x] Sentry capture on CQ failure verified (case 6)
- [x] No edits to STATE.md or ROADMAP.md (per orchestrator contract)
