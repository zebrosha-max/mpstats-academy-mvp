---
phase: 51-notification-center-foundation
plan: 06
subsystem: notification-center
tags: [ui, preferences, deep-link, optimistic-update, css]
requires:
  - 51-03 (notifications tRPC router with getPreferences/updatePreference)
  - 51-05 (NotificationBell + /notifications page — for end-to-end click flow)
provides:
  - /profile/notifications page with 7 types × 2 channels toggles
  - Anchor scroll + highlight infrastructure on /learn/[id]
  - .notification-highlight CSS class
affects:
  - apps/web/src/app/(main)/profile/page.tsx (added Уведомления link)
  - apps/web/src/components/comments/CommentItem.tsx (id-anchor + scroll-mt-20)
tech-stack:
  added: []
  patterns: [optimistic-update-onMutate-onError-onSettled, hash-anchor-scroll-with-retry]
key-files:
  created:
    - apps/web/src/app/(main)/profile/notifications/page.tsx
  modified:
    - apps/web/src/app/(main)/profile/page.tsx
    - apps/web/src/components/comments/CommentItem.tsx
    - apps/web/src/app/(main)/learn/[id]/page.tsx
    - apps/web/src/styles/globals.css
decisions:
  - Optimistic update via tRPC utils.setData/getData/cancel (best-practice from Phase 49)
  - Email Switch hard-disabled (Phase 52+ enables per-type when CQ templates ready)
  - Anchor scroll uses retry loop (5×300ms) for async tRPC comment hydration
  - Silent no-op if comment not found (deleted/locked) per D-13
metrics:
  duration: ~25min
  completed: 2026-04-30
---

# Phase 51 Plan 06: Settings Page + Anchor Scroll Summary

Settings page `/profile/notifications` (7 types × 2 channels with optimistic in-app toggles, email hard-disabled), `/profile` linking block, and deep-link anchor scroll + highlight infrastructure on `/learn/[id]` — completing the click-from-bell → highlighted-comment UX loop.

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | Create /profile/notifications page with optimistic toggles | `09f6783` |
| 2 | Add «Уведомления» block to /profile page | `5355028` |
| 3 | Add id={`comment-${id}`} + scroll-mt-20 to CommentItem root | `97b33c5` |
| 4 | Add anchor scroll + highlight useEffect to /learn/[id] | `accd7c7` |
| 5 | Add .notification-highlight CSS class | `a4063ca` |

## Verification

- `pnpm --filter @mpstats/web typecheck` exits 0 after each task
- All grep checks pass:
  - `Настрой, как хочешь` found in notifications/page.tsx
  - `title="Скоро"` found on email column
  - `NOTIFICATION_TYPE_DESCRIPTIONS` imported and used
  - `onMutate / onError / onSettled` all present (optimistic pattern)
  - 14 `aria-label` attributes (7 types × 2 channels)
  - `comment-${comment.id}` template literal in CommentItem
  - `scroll-mt-20` class on CommentItem root
  - `notification-highlight` referenced 2× in learn/[id]/page.tsx (add + remove)
  - `attempts >= 5` retry guard
  - `.notification-highlight` defined with `transition: background-color 1500ms ease-out`

## End-to-End Flow Now Working

1. Юзер A пишет коммент к уроку, юзер B отвечает
2. У юзера A NotificationBell (51-05) показывает unread badge
3. Click → drop-down → click на notification → переход на `/learn/lessonX#comment-Y`
4. /learn/[id] useEffect ловит hash → scrollIntoView + .notification-highlight 1.5s
5. Юзер видит свой коммент с replies, рядом синяя подсветка → понимает контекст
6. Если решает отключить тип → /profile → «Уведомления → Настроить» → toggle off

## Deviations from Plan

### [Rule 3 - Blocking] Wrong globals.css path in plan

- **Found during:** Task 5
- **Issue:** Plan specified `apps/web/src/app/globals.css`, but actual file lives at `apps/web/src/styles/globals.css` (project convention since Phase 16+)
- **Fix:** Used the actual file path. CSS injected at end of file after V8 keyframes block
- **Impact:** None — Tailwind/Next.js picks up styles from the actual path; no other file references `app/globals.css`

### [Rule 3 - Blocking] PreferenceRow type missing userId

- **Found during:** Task 1 typecheck
- **Issue:** `trpc.notifications.getPreferences` returns rows with `userId` field; my local `PreferenceRow` interface omitted it, causing `Updater` type mismatch in `setData` call
- **Fix:** Added `userId: string` to `PreferenceRow` interface
- **Impact:** None — UI doesn't render userId, just preserves it in optimistic state

## Known Limitations

1. **Email switches hard-disabled** — phased rollout. Phase 52+ enables per-type as CQ templates ship
2. **WEEKLY_DIGEST default** — getPreferences (51-03) supplies `inApp: false` default for this type via DEFAULT_IN_APP_PREFS; toggle works normally, just starts OFF
3. **Anchor scroll retry window** — max 1.5s (5×300ms). If tRPC comments query takes longer (cold cache, slow network), highlight will silently no-op. Acceptable per D-13

## Artifacts for Next Plan (51-07)

End-to-end flow ready for Playwright E2E:
- Reply (51-04) → trigger creates Notification
- Bell badge (51-05) shows unread
- Click in dropdown → window.location with hash
- Anchor scroll + highlight (this plan) confirms target comment

## Self-Check: PASSED

Verified files exist:
- ✅ apps/web/src/app/(main)/profile/notifications/page.tsx
- ✅ Modifications applied to profile/page.tsx, CommentItem.tsx, learn/[id]/page.tsx, globals.css

Verified commits exist (git log):
- ✅ 09f6783, 5355028, 97b33c5, accd7c7, a4063ca
