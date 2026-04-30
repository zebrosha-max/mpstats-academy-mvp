---
phase: 51-notification-center-foundation
plan: 04
subsystem: notifications
tags: [route-handler, supabase-auth, anti-spoofing, fire-and-forget, vitest]
requires:
  - "51-01 (Notification + NotificationPreference schema, DEFAULT_IN_APP_PREFS)"
  - "51-02 (notifyCommentReply helper in @/lib/notifications/notify)"
provides:
  - "POST /api/notifications/notify-reply — single live notification trigger in Phase 51"
  - "Anti-spoofing pattern reusable for Phase 52 ADMIN_COMMENT_REPLY route handler"
  - "Frontend hook in CommentInput.tsx onSuccess (fire-and-forget fetch)"
affects:
  - apps/web/src/app/api/notifications/notify-reply/route.ts
  - apps/web/src/components/comments/CommentInput.tsx
  - apps/web/src/lib/notifications/__tests__/notify-reply-route.test.ts
tech-stack:
  added: []
  patterns:
    - "Next.js route handler as bridge between frontend and packages/api-incompatible service"
    - "Server-resolved actorUserId (never accept from request body)"
    - "Fire-and-forget fetch from client onSuccess — no UI blocking"
    - "vi.mock with @/ alias for route handler tests (no MSW needed)"
key-files:
  created:
    - apps/web/src/app/api/notifications/notify-reply/route.ts
    - apps/web/src/lib/notifications/__tests__/notify-reply-route.test.ts
  modified:
    - apps/web/src/components/comments/CommentInput.tsx
decisions:
  - "Trigger lives in Next.js route handler, NOT in tRPC comments.create — packages/api cannot import from apps/web (workspace dep direction). Route handler is the only place where Supabase server client + notify service can co-exist."
  - "Body schema accepts ONLY replyCommentId. actorUserId is always derived from supabase.auth.getUser() server-side. Prevents T-51-04-02 (spoofed actor)."
  - "Anti-spoofing: load LessonComment.userId, compare with auth user. 403 if mismatch + Sentry warning. T-51-04-01 mitigation."
  - "Fire-and-forget contract: route returns 500 on internal error, but frontend uses .catch + console.warn (no toast, no retry). Notification failure must not affect comment-create UX."
  - "Root comment (parentId === null) returns 200 + skipped:not_a_reply — defensive: frontend SHOULD only call when parentId truthy, but server tolerates."
metrics:
  duration: "~15 minutes"
  completed: "2026-04-30"
---

# Phase 51 Plan 04: COMMENT_REPLY Trigger Summary

**One-liner:** Next.js route handler `POST /api/notifications/notify-reply` с Supabase auth + anti-spoofing (replier ownership check), вызываемый из `CommentInput.tsx` `onSuccess` fire-and-forget; обходит cross-package import direction (packages/api → apps/web невозможен) и активирует единственный живой триггер уведомлений в Phase 51.

## What Shipped

### Route handler (`apps/web/src/app/api/notifications/notify-reply/route.ts`, NEW, 94 lines)

POST endpoint, 6 distinct response paths:

| Status | Cause |
|--------|-------|
| 401 | `supabase.auth.getUser()` returns no user |
| 400 | Body missing or `replyCommentId` invalid (zod validation) |
| 404 | `LessonComment` with given id not in DB |
| 403 | `LessonComment.userId !== auth user` (anti-spoofing) — Sentry warning captured |
| 200 `{ ok: true, skipped: 'not_a_reply' }` | `parentId === null` (root comment) |
| 200 `{ ok: true }` | Happy path — `notifyCommentReply` invoked |
| 500 `{ ok: false }` | Internal error — Sentry.captureException with tags `{area:'notifications',stage:'notify-reply-route'}` |

Key security properties:
- `actorUserId` is taken from `user.id` (server-resolved), never from request body — defeats T-51-04-02.
- 403 path emits `Sentry.captureMessage('notify-reply spoofing attempt', { level: 'warning' })` with extras `{actualReplier, requestingUser, replyCommentId}` so we can detect API abuse.
- `dynamic = 'force-dynamic'` — request handlers reading cookies must opt out of static optimization.

### Frontend hook (`apps/web/src/components/comments/CommentInput.tsx`, modified, +17/-1)

`onSuccess` now receives the mutation result (`created`) and, when `parentId && created?.id`, fires `fetch('/api/notifications/notify-reply', ...)` with `credentials: 'include'`. Not awaited — UI must not block on notification flow. `.catch(err => console.warn(...))` swallows network errors silently; Sentry capture lives server-side.

Existing optimistic update / `onMutate` / `onError` / `onSettled` / cache invalidation logic untouched.

### Tests (`apps/web/src/lib/notifications/__tests__/notify-reply-route.test.ts`, NEW, 121 lines, 6 cases)

| # | Case | Asserts |
|---|------|---------|
| 1 | No auth | 401, `notifyCommentReply` NOT called |
| 2 | Missing replyCommentId | 400, no notify |
| 3 | Anti-spoofing (replier.userId !== user.id) | 403, no notify |
| 4 | Root comment (parentId=null) | 200 + `skipped: 'not_a_reply'`, no notify |
| 5 | Happy path | 200, `notifyCommentReply` called with `{replyCommentId, actorUserId: user.id}` |
| 6 | Reply not found | 404, no notify |

Mocks (all `vi.mock`-hoisted): `@/lib/supabase/server` (createClient), `@mpstats/db/client` (prisma.lessonComment.findUnique), `@/lib/notifications/notify` (notifyCommentReply), `@sentry/nextjs` (captureException, captureMessage). `beforeEach(vi.clearAllMocks)` for isolation.

## Verification Output

- `pnpm typecheck` → 6/6 tasks pass (db, shared, ai, api, web, db#build)
- `pnpm vitest run src/lib/notifications/__tests__/notify-reply-route.test.ts` → **6/6 passed**, 1.52s total
- `grep -n "401\|403\|404\|notifyCommentReply\|createClient" apps/web/src/app/api/notifications/notify-reply/route.ts` — all present
- `grep -c "notify-reply" apps/web/src/components/comments/CommentInput.tsx` → 1 (fetch URL)
- `grep -c "credentials: 'include'" apps/web/src/components/comments/CommentInput.tsx` → 1
- `grep -c "setInfiniteData" apps/web/src/components/comments/CommentInput.tsx` → 2 (optimistic update intact)
- `packages/api/src/routers/comments.ts` НЕ модифицирован (verified via `git diff base..HEAD -- packages/api/src/routers/comments.ts` empty)

## Artifacts for Downstream Phases

| Artifact | Where | Used by |
|----------|-------|---------|
| Route handler pattern (auth + anti-spoofing + fire-and-forget) | `apps/web/src/app/api/notifications/notify-reply/route.ts` | Phase 52 will reuse for `ADMIN_COMMENT_REPLY` (admin replies to user comments) |
| Frontend onSuccess fetch pattern | `apps/web/src/components/comments/CommentInput.tsx` | Phase 52 admin comment UI mirrors this |
| Test mock template (`@/lib/supabase/server` + prisma + notify) | `apps/web/src/lib/notifications/__tests__/notify-reply-route.test.ts` | All future notification-trigger route tests |

## Threat Mitigation Summary

| Threat ID | Mitigation Implemented | Verified by |
|-----------|------------------------|-------------|
| T-51-04-01 (Spoofing replier) | `LessonComment.userId !== user.id` → 403 + Sentry warning | Test case 3 |
| T-51-04-02 (Spoofing actorUserId via body) | Body schema accepts ONLY `replyCommentId`; `actorUserId = user.id` server-side | Test case 5 (asserts `actorUserId: 'user-a'` from auth) |
| T-51-04-05 (Tampering — fake replyCommentId) | `findUnique` returns null → 404 | Test case 6 |
| T-51-04-03 (Info disclosure 404 vs 403) | accept (symmetry with tRPC comments router) | — |
| T-51-04-04 (DoS via spam) | accept (Vercel/Next.js layer; tRPC create rate-limits upstream) | — |

## Deviations from Plan

**One micro-deviation (Rule 1, robustness):** added a 6th test case for 404 (reply not found). Plan's `<behavior>` listed 5 cases; the route handler explicitly returns 404 on missing reply, so leaving that path uncovered would be a gap. Categorized as Rule 1 (correctness) — documents the contract. No production code changed.

Otherwise plan executed exactly as written, including the verified `createClient` import path from `@/lib/supabase/server`.

## Commits

| Task | Hash | Subject |
|------|------|---------|
| 1 | `a855c48` | feat(phase-51-04): add POST /api/notifications/notify-reply route handler |
| 2 | `5d20780` | feat(phase-51-04): trigger notify-reply route from CommentInput onSuccess |
| 3 | `c5a9228` | test(phase-51-04): integration tests for notify-reply route handler |

## Self-Check: PASSED

- [x] `apps/web/src/app/api/notifications/notify-reply/route.ts` exists (94 lines, exports POST)
- [x] `apps/web/src/components/comments/CommentInput.tsx` modified (notify-reply fetch + parentId guard)
- [x] `apps/web/src/lib/notifications/__tests__/notify-reply-route.test.ts` exists (121 lines, 6 it-blocks)
- [x] Commits `a855c48`, `5d20780`, `c5a9228` present in `git log`
- [x] `pnpm typecheck` exits 0 across monorepo
- [x] All 6 tests PASS (vitest exit 0)
- [x] `packages/api/src/routers/comments.ts` NOT modified (tRPC create stays pure)
- [x] Server-resolved `actorUserId` (no body acceptance) — verified in route line 81
- [x] Anti-spoofing 403 path emits Sentry warning
- [x] No edits to STATE.md or ROADMAP.md (per orchestrator contract)
