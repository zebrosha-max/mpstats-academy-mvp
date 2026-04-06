---
phase: 44-promo-codes
plan: 03
subsystem: admin, web
tags: [admin-panel, promo-codes, ui, trpc]

requires:
  - phase: 44-promo-codes
    plan: 01
    provides: promo tRPC router with admin CRUD procedures
provides:
  - Admin promo codes management page with CRUD UI
  - AdminSidebar Promo navigation item
affects: []

tech-stack:
  added: []
  patterns: [expandable table rows for activations detail, duration preset buttons with custom input fallback]

key-files:
  created:
    - apps/web/src/app/(admin)/admin/promo/page.tsx
  modified:
    - apps/web/src/components/admin/AdminSidebar.tsx

key-decisions:
  - "Promo nav item accessible to ADMIN + SUPERADMIN (superadminOnly: false) per D-09"
  - "billing.getCourses (public procedure) used for course dropdown in create form"
  - "Expandable row pattern for activations instead of modal — simpler, inline context"

requirements-completed: [D-09]

duration: 3min
completed: 2026-04-06
---

# Phase 44 Plan 03: Admin Promo Codes Management Page Summary

**Admin promo page with create form (type/course/duration presets/maxUses/expiry/code), table with status badges, deactivate action, and expandable activations detail**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T19:37:02Z
- **Completed:** 2026-04-06T19:39:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- AdminSidebar "Promo" nav item with Ticket icon, placed before Settings
- Full admin promo page with toggleable create form
- Create form: PLATFORM/COURSE type toggle, course dropdown, duration presets (7/14/30) + custom, maxUses, expiry date with "Бессрочный" checkbox, optional custom code
- Table: code (monospace + copy button), type, duration, uses counter, expiry date, status badge (Активен/Использован/Истёк/Отключён), actions
- Deactivate button for active promo codes
- Expandable activations detail per row with user/date/subscription status

## Task Commits

1. **Task 1: Add Promo nav item to AdminSidebar** - `2e84108` (feat)
2. **Task 2: Create admin promo codes management page** - `7e55f2d` (feat)

## Files Created/Modified
- `apps/web/src/app/(admin)/admin/promo/page.tsx` - Full admin promo management page (511 lines)
- `apps/web/src/components/admin/AdminSidebar.tsx` - Added Ticket icon import and Promo nav item

## Decisions Made
- Promo nav item uses `superadminOnly: false` — accessible to both ADMIN and SUPERADMIN per D-09
- Used `billing.getCourses` (public procedure) for course dropdown since it returns id+title only
- Expandable inline activations detail instead of modal for simpler UX

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- apps/web/src/app/(admin)/admin/promo/page.tsx: FOUND
- apps/web/src/components/admin/AdminSidebar.tsx: FOUND
- Commit 2e84108: FOUND
- Commit 7e55f2d: FOUND

---
*Phase: 44-promo-codes*
*Completed: 2026-04-06*
