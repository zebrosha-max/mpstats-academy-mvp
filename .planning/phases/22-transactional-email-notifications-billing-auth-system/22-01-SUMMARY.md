---
phase: 22-transactional-email-notifications-billing-auth-system
plan: 01
subsystem: docs
tags: [email, carrot-quest, transactional-email, billing, auth]

requires:
  - phase: 18-cloudpayments-webhook-integration
    provides: Payment webhook events (pay, fail, cancel) for billing email triggers
  - phase: 17-yandex-id-oauth-integration
    provides: Auth flow (registration, password reset) for auth email triggers
provides:
  - EMAIL-SPEC.md with 9 email template drafts, variables, CQ event names, and flow diagrams
affects: [22-02, email-team]

tech-stack:
  added: []
  patterns: [email-spec-documentation]

key-files:
  created: [docs/EMAIL-SPEC.md]
  modified: []

key-decisions:
  - "noreply@mpstats.academy as sender address with MPSTATS Academy sender name"
  - "CQ events prefixed with $ for Carrot Quest convention"
  - "Auth emails (confirm, reset) via Supabase Send Email Hook, not CQ events"
  - "Inactivity chain: 7/14/30 days, stops on any platform visit"
  - "Expiring notification only for CANCELLED subscriptions (not active auto-renew)"

patterns-established:
  - "Email variable naming: {{snake_case}} with clear source mapping to DB models"
  - "Flow documentation: Mermaid diagrams for registration, billing, inactivity"

requirements-completed: [EMAIL-01]

duration: 3min
completed: 2026-03-13
---

# Phase 22 Plan 01: Email Spec Summary

**EMAIL-SPEC.md with 9 transactional email drafts (4 billing, 5 auth/system), CQ event mapping, and Mermaid flow diagrams for email team handoff**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T08:20:29Z
- **Completed:** 2026-03-13T08:23:30Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created comprehensive EMAIL-SPEC.md (712 lines) with all 9 email templates
- Full draft texts in Russian with professional SaaS tone
- Mermaid flow diagrams for registration, billing, and inactivity flows
- CQ event mapping table with variables for each template
- Implementation guide with design requirements and priority order for email team

## Task Commits

Each task was committed atomically:

1. **Task 1: Write EMAIL-SPEC.md with all 9 emails** - `b9286bc` (docs)

## Files Created/Modified
- `docs/EMAIL-SPEC.md` - Full email specification: 9 templates, variables, CQ events, flow diagrams, team instructions

## Decisions Made
- Used `noreply@mpstats.academy` as sender address (standard SaaS pattern)
- CQ event names prefixed with `$` (`$payment_success`, `$user_registered`, etc.)
- Auth emails (#6, #7) triggered via Supabase Send Email Hook rather than CQ events (URLs come from Supabase)
- Subscription expiring notification (#4) only for CANCELLED status (active subscriptions auto-renew)
- Inactivity chain stops at 30 days (3 steps: 7d, 14d, 30d)
- Priority order: billing+auth first, system emails second

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. EMAIL-SPEC.md is a documentation deliverable.

## Next Phase Readiness
- EMAIL-SPEC.md ready for handoff to email team (copy to Google Doc manually)
- Next plan (22-02) can proceed with CQ API integration using event names defined here

---
*Phase: 22-transactional-email-notifications-billing-auth-system*
*Completed: 2026-03-13*
