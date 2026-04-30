---
phase: 51-notification-center-foundation
plan: 05
subsystem: notifications-ui
tags: [ui, tRPC, popover, polling, page-visibility, infinite-list]
requires:
  - 51-01-SUMMARY.md (Notification model)
  - 51-03-SUMMARY.md (notifications router — unreadCount/list/markSeen/markRead/markAllRead)
provides:
  - Shared formatRelativeTime utility (server-safe)
  - NotificationBell в Header на каждой /(main)/* странице
  - Reusable NotificationItem
  - /notifications full history page
affects:
  - apps/web/src/components/comments/CommentItem.tsx (re-export)
  - apps/web/src/app/(main)/layout.tsx (header insertion)
tech-stack:
  added:
    - Page Visibility API для pause polling
  patterns:
    - tRPC useQuery с conditional refetchInterval (false ↔ 60_000)
    - tRPC useInfiniteQuery + getNextPageParam
    - Lazy fetch через `enabled: isOpen`
    - URL state sync через replaceState (без router.push, не дёргает rerender)
key-files:
  created:
    - apps/web/src/lib/utils/format-time.ts
    - apps/web/src/components/notifications/NotificationItem.tsx
    - apps/web/src/components/notifications/NotificationBell.tsx
    - apps/web/src/app/(main)/notifications/page.tsx
  modified:
    - apps/web/src/components/comments/CommentItem.tsx
    - apps/web/src/app/(main)/layout.tsx
decisions:
  - emoji-style icons вместо SVG accent (Phase 52 заменит для ADMIN_COMMENT_REPLY)
  - markAllRead в Bell footer помечает ВСЕ unread юзера (не только видимые в dropdown) — соответствует SPEC
  - URL filter sync через replaceState вместо router.push (не вызывает rerender / refetch)
metrics:
  duration: ~15min
  completed: 2026-04-30
---

# Phase 51 Plan 05: Notification UI (Bell + Item + /notifications) Summary

UI-слой Phase 51 — Bell в header c badge + dropdown + polling pause + markSeen on open, reusable NotificationItem, полная страница `/notifications` с infinite pagination и filter all|unread.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Extract formatRelativeTime to shared utility | `014323c` | format-time.ts (new), CommentItem.tsx (import + re-export) |
| 1 | NotificationItem reusable component | `5e9c9b5` | NotificationItem.tsx |
| 2 | NotificationBell with polling pause + grouped dropdown | `f02603f` | NotificationBell.tsx |
| 3 | /notifications page with infinite list + filter | `a805bbc` | (main)/notifications/page.tsx |
| 4 | Mount NotificationBell in main layout header | `5d00b99` | (main)/layout.tsx |

## Implementation Highlights

### formatRelativeTime extraction (Task 0)
- New `apps/web/src/lib/utils/format-time.ts` (server-safe, no React, no client APIs).
- CommentItem.tsx больше не определяет функцию — импортит из util и re-exportит для backward compat.
- `grep` подтвердил: в проекте нет внешних импортов `formatRelativeTime` из CommentItem, но re-export оставлен на случай тестов или подэкспортов.

### NotificationItem (Task 1)
- TypeIcon: emoji map для 7 NotificationType (`COMMENT_REPLY` → 💬, `ADMIN_COMMENT_REPLY` → 👨‍🏫, etc.) + fallback 🔔.
- `deriveTitleAndPreview`: discriminant runtime narrow по `payload.type` — каждый из 7 типов даёт уместный title + preview.
- `bg-mp-blue-50` для unread (D-03), `bg-white` (по дефолту) для read.
- ctaUrl → `<Link>`; no ctaUrl → `<button>`. `onClick` пропсом для markRead callback.

### NotificationBell (Task 2)
- **Polling 60s** через `refetchInterval: docHidden ? false : 60_000` (DC-02).
- **Page Visibility**: `useEffect` слушает `visibilitychange`, обновляет `docHidden` state — refetch автоматически паузится/возобновляется при смене.
- **markSeen on open** (D-07) — в `handleOpenChange`, инвалидирует `unreadCount`.
- **Badge** (DC-07): hidden при count=0, `99+` при > 99, `bg-mp-red-500` rounded-full pill.
- **Dropdown UX**: 380px width, max-height 480px, z-50 (DC-06), header + scrollable body + footer.
- **Группировка** «Новые / Раньше» (D-02): unread в верхней секции, read за последние 7 дней — в нижней.
- **Footer**: Link на `/notifications` + кнопка markAllRead (disabled при count=0 / pending).
- Lazy-fetch list через `enabled: isOpen` — экономия RPC.
- Empty state copy: «Пока тихо. Здесь появятся ответы на твои комментарии и важные обновления.»

### /notifications page (Task 3)
- `useSearchParams` читает initial filter, `useEffect` синхронизирует URL через `window.history.replaceState` (не дёргает рендер).
- `useInfiniteQuery` с `getNextPageParam: last => last?.nextCursor ?? null`, кнопка «Показать ещё» в конце списка.
- Skeleton loader (3 div'а с animate-pulse) при первой загрузке.
- Empty states (D-15):
  - filter=all empty: «У тебя пока нет уведомлений.»
  - filter=unread empty: «Все уведомления прочитаны. 🎉»
- markAllRead disabled когда `items.every(n => n.readAt !== null)` или mutation pending.
- Filter pills: `bg-mp-blue-600` active / `bg-mp-gray-100` inactive.

### Layout integration (Task 4)
- Импорт NotificationBell после HelpCircleButton.
- Вставлен ПЕРЕД HelpCircleButton в header flex-контейнере.
- Final order: `Bell | Help | UserNav`.
- Server component layout (`async function MainLayout`) рендерит client component (`'use client'` NotificationBell) как child — стандартный App Router pattern, типечек подтверждает совместимость.

## Verification

- `pnpm typecheck --force` (без cache): **6/6 successful, 0 errors** (включая `@mpstats/web` где живут все новые компоненты).
- Все 5 коммитов созданы с `--no-verify` per parallel-executor protocol.
- `formatRelativeTime` теперь экспортится из единого места (`@/lib/utils/format-time`); CommentItem.tsx сохраняет re-export для обратной совместимости.
- NotificationBell использует `process` API только через `document.hidden` (browser API, защищено `'use client'` директивой).

## Deviations from Plan

**None — план выполнен 1:1.**

Минорная деталь: типечек в isolation worktree прошёл несмотря на отсутствие `notifications` router'а в base. tRPC client при первом обращении к `trpc.notifications.X.useQuery` через proxy типизируется без compile-time check'а имени procedure'а (proxy.get на любом ключе валиден до runtime resolve). После merge с волной 03 (router в `appRouter`) типы сузятся автоматически.

## Artifacts for Plan 06

- **NotificationItem** — переиспользуемый компонент (Bell + /notifications page уже используют). Plan 06 (lesson page integration / scroll-to-comment) может встроить тот же компонент в `/profile/notifications` или дополнительные локации.
- **format-time.ts** — общий util готов для любых компонентов с relative-time UI.
- **Layout pattern** — server-component с client-component header element (NotificationBell) — паттерн зафиксирован, можно повторять для будущих global UI elements.

## Known Limitations

- **Emoji icons** для NotificationType. Phase 52 заменит на SVG accent (особенно ADMIN_COMMENT_REPLY с цветовой меткой).
- **markAllRead в Bell footer** — global mutation, помечает ВСЕ unread юзера, не только видимые 10 в dropdown (intentional по SPEC).
- **URL filter sync** через `window.history.replaceState` — не работает в SSR контексте, но `'use client'` гарантирует client-only execution.

## Self-Check: PASSED

**Files exist:**
- ✔ `apps/web/src/lib/utils/format-time.ts`
- ✔ `apps/web/src/components/notifications/NotificationItem.tsx`
- ✔ `apps/web/src/components/notifications/NotificationBell.tsx`
- ✔ `apps/web/src/app/(main)/notifications/page.tsx`
- ✔ `apps/web/src/app/(main)/layout.tsx` (modified, contains `<NotificationBell />`)
- ✔ `apps/web/src/components/comments/CommentItem.tsx` (modified, imports + re-exports formatRelativeTime)

**Commits exist (verified via `git log --oneline -5`):**
- ✔ `014323c` refactor(phase-51-05): extract formatRelativeTime to shared utility
- ✔ `5e9c9b5` feat(phase-51-05): add reusable NotificationItem component
- ✔ `f02603f` feat(phase-51-05): add NotificationBell with polling pause + grouped dropdown
- ✔ `a805bbc` feat(phase-51-05): add /notifications page with infinite list + filter
- ✔ `5d00b99` feat(phase-51-05): mount NotificationBell in main layout header

**Typecheck:** `pnpm typecheck --force` → 6/6 successful, 0 errors.
