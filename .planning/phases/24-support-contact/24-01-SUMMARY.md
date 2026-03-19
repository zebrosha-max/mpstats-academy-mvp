---
phase: 24-support-contact
plan: 01
subsystem: ui
tags: [support, faq, carrotquest, accordion, radix, feedback-form]

requires:
  - phase: 22-email-notifications
    provides: CarrotQuest client and event types
provides:
  - Public /support page with contacts, FAQ, feedback form
  - API route for support form CQ event tracking
  - Navigation links in sidebar, mobile-nav, landing footer
affects: [25-legal-cookie-consent]

tech-stack:
  added: ["@radix-ui/react-accordion"]
  patterns: ["shadcn accordion component", "public page with Supabase auth detection"]

key-files:
  created:
    - apps/web/src/app/support/page.tsx
    - apps/web/src/app/api/support/route.ts
    - apps/web/src/components/ui/accordion.tsx
  modified:
    - apps/web/src/lib/carrotquest/types.ts
    - apps/web/src/components/shared/sidebar.tsx
    - apps/web/src/components/shared/mobile-nav.tsx
    - apps/web/src/app/page.tsx

key-decisions:
  - "Supabase client for auth detection on public page (not tRPC profile.get which is protectedProcedure)"
  - "window.carrotquest accessed via `as any` cast to avoid conflicting global type declarations"

patterns-established:
  - "Public page auth detection: useEffect + createClient().auth.getUser() for optional auth on public pages"

requirements-completed: [SUPP-01, SUPP-02, SUPP-03, SUPP-04]

duration: 5min
completed: 2026-03-19
---

# Phase 24 Plan 01: Support Contact Summary

**Public /support page with contact card (email + CQ chat), 5-item FAQ accordion, and feedback form that fires CQ 'Support Request' event**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T08:38:11Z
- **Completed:** 2026-03-19T08:43:37Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- /support page with 3 sections: contacts (email + chat button), FAQ accordion (5 items), feedback form
- POST /api/support endpoint fires 'Support Request' CQ event with theme, message, email
- Navigation links added: sidebar footer (always visible), mobile-nav tab, landing footer

## Task Commits

1. **Task 1: Create /support page with contacts, FAQ, and feedback form** - `75bda3a` (feat)
2. **Task 2: Add navigation links to sidebar, mobile-nav, landing footer** - `ccbeaa8` (feat)

## Files Created/Modified
- `apps/web/src/app/support/page.tsx` - Support page with contacts, FAQ accordion, feedback form
- `apps/web/src/app/api/support/route.ts` - POST endpoint for CQ event tracking
- `apps/web/src/components/ui/accordion.tsx` - shadcn/ui accordion component (radix)
- `apps/web/src/lib/carrotquest/types.ts` - Added 'Support Request' event type
- `apps/web/src/components/shared/sidebar.tsx` - Added support link in footer
- `apps/web/src/components/shared/mobile-nav.tsx` - Added support tab
- `apps/web/src/app/page.tsx` - Added support link in landing footer
- `apps/web/package.json` - Added @radix-ui/react-accordion
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used Supabase browser client for auth detection instead of tRPC profile.get (which is protectedProcedure and would throw for unauthenticated users)
- Used `as any` type cast for window.carrotquest.open() to avoid conflicting global type declarations with CarrotQuestIdentify.tsx
- Mobile nav label "Помощь" (shorter) instead of "Поддержка" to fit mobile bottom bar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing shadcn accordion component**
- **Found during:** Task 1
- **Issue:** Plan references `@/components/ui/accordion` but component didn't exist
- **Fix:** Installed @radix-ui/react-accordion and created accordion.tsx component
- **Files modified:** apps/web/src/components/ui/accordion.tsx, apps/web/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 75bda3a (Task 1 commit)

**2. [Rule 1 - Bug] TypeScript conflict with Window.carrotquest type**
- **Found during:** Task 1
- **Issue:** Plan suggested `declare global { interface Window { carrotquest } }` but CarrotQuestIdentify.tsx already declares it differently
- **Fix:** Removed duplicate declaration, used `(window as any).carrotquest` for open() call
- **Files modified:** apps/web/src/app/support/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 75bda3a (Task 1 commit)

**3. [Rule 1 - Bug] UserProfile has no email field**
- **Found during:** Task 1
- **Issue:** Plan suggested `profile.email` but Prisma UserProfile model has no email field (email is on Supabase auth.users)
- **Fix:** Used Supabase browser client getUser() for auth detection and email retrieval
- **Files modified:** apps/web/src/app/support/page.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 75bda3a (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Support page ready for production deploy
- CQ automation rule for 'Support Request' event should be configured in CQ dashboard

---
## Self-Check: PASSED

- [x] apps/web/src/app/support/page.tsx exists
- [x] apps/web/src/app/api/support/route.ts exists
- [x] apps/web/src/components/ui/accordion.tsx exists
- [x] Commit 75bda3a found
- [x] Commit ccbeaa8 found

---
*Phase: 24-support-contact*
*Completed: 2026-03-19*
