---
phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy
plan: 02
subsystem: auth
tags: [supabase, yandex-oauth, domain-migration, e2e-verification]

# Dependency graph
requires:
  - phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy
    plan: 01
    provides: VPS serving HTTPS on platform.mpstats.academy
provides:
  - "Supabase auth redirects use platform.mpstats.academy"
  - "Yandex OAuth callback updated to new domain"
  - "Test fixtures reference new domain"
  - "CLAUDE.md and docs fully updated"
affects: [phase-22, paywall-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - "apps/web/tests/auth/yandex-oauth.test.ts"
    - "apps/web/tests/auth/oauth-provider.test.ts"
    - "CLAUDE.md"

key-decisions:
  - "No automated Supabase/Yandex config — requires dashboard access (human-action checkpoint)"

patterns-established: []

requirements-completed: [DOM-04, DOM-05, DOM-06]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 21 Plan 02: OAuth Services + Docs + E2E Verification Summary

**Supabase and Yandex OAuth updated to platform.mpstats.academy, test fixtures migrated, full E2E verified (landing, SSL, OAuth, lessons, video, AI)**

## Performance

- **Duration:** 5 min (spread across human-action + auto + human-verify)
- **Started:** 2026-03-11T16:00:00Z
- **Completed:** 2026-03-11T16:30:00Z
- **Tasks:** 3 (1 human-action + 1 auto + 1 human-verify)
- **Files modified:** 3

## Accomplishments
- Supabase Site URL and Redirect URLs updated to platform.mpstats.academy (user action)
- Yandex OAuth redirect URI updated to exact match: platform.mpstats.academy/api/auth/yandex/callback (user action)
- Test fixtures in yandex-oauth.test.ts and oauth-provider.test.ts migrated from DuckDNS to new domain
- CLAUDE.md production URL and domain migration checklist updated
- Full E2E verification passed: landing page, HTTPS/SSL, Yandex OAuth full flow, lesson pages, video playback, AI summary generation, AI chat responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Supabase Dashboard and Yandex OAuth app** - user action (no commit, external service config)
2. **Task 2: Update test fixtures and documentation** - `7d121b6` (docs)
3. **Task 3: End-to-end verification on new domain** - user verification (no commit, all checks passed)

## Files Created/Modified
- `apps/web/tests/auth/yandex-oauth.test.ts` - Domain references updated to platform.mpstats.academy
- `apps/web/tests/auth/oauth-provider.test.ts` - Domain references updated to platform.mpstats.academy
- `CLAUDE.md` - Production URL, VPS deploy section, domain migration checklist marked complete

## Decisions Made
- External OAuth service updates handled as human-action checkpoint (no API access to Supabase Dashboard or Yandex OAuth management)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all external service updates and verification completed successfully.

## Related Fix (Out of Scope)

During E2E verification, a separate bug was discovered and fixed: diagnostic learning path generation used threshold < 50 instead of < 70 for weak skills. Fixed in commit `3546a40` (not part of this plan).

## User Setup Required

None - all external service configuration was completed during Task 1.

## Next Phase Readiness
- Domain migration fully complete (Phase 21 done)
- Production URL: https://platform.mpstats.academy
- All auth flows verified working
- Ready for Phase 20 (Paywall deploy) or Phase 22 (Transactional emails)

---
*Phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy*
*Completed: 2026-03-11*
