---
phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy
plan: 01
subsystem: infra
tags: [nginx, ssl, certbot, docker, dns, domain-migration]

# Dependency graph
requires:
  - phase: 19-billing-ui-payment-flow
    provides: running production app on VPS
provides:
  - "platform.mpstats.academy serving HTTPS with valid Let's Encrypt cert"
  - "Nginx config with new server_name and proxy_buffer_size 128k"
  - ".env.production NEXT_PUBLIC_SITE_URL updated and baked into Docker image"
affects: [21-02 (OAuth service updates), docs, CLAUDE.md]

# Tech tracking
tech-stack:
  added: []
  patterns: [certbot --nginx for automated SSL with HTTP-01 challenge]

key-files:
  created: []
  modified:
    - "/etc/nginx/sites-available/maal.conf (VPS)"
    - "/home/deploy/maal/.env.production (VPS)"
    - "CLAUDE.md (local — domain references updated)"

key-decisions:
  - "HTTP-only Nginx config before certbot (let certbot add SSL directives automatically)"
  - "No redirect from old domain — just disabled (few users, no SEO value)"

patterns-established:
  - "Certbot --nginx --non-interactive for automated SSL provisioning"

requirements-completed: [DOM-01, DOM-02, DOM-03]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 21 Plan 01: Domain Migration (DNS + VPS Infrastructure) Summary

**DNS A-record for platform.mpstats.academy, Nginx reconfigured, Let's Encrypt SSL issued, Docker rebuilt with new NEXT_PUBLIC_SITE_URL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T15:43:50Z
- **Completed:** 2026-03-11T15:48:00Z
- **Tasks:** 2 (1 human-action + 1 auto)
- **Files modified:** 3 (2 VPS, 1 local)

## Accomplishments
- DNS A-record platform.mpstats.academy -> 89.208.106.208 confirmed (user action)
- Nginx server_name updated, SSL certificate issued (expires 2026-06-09), proxy_buffer_size 128k preserved
- .env.production NEXT_PUBLIC_SITE_URL changed and Docker container rebuilt with --no-cache
- Health endpoint verified: {"status":"ok","database":"connected"} on https://platform.mpstats.academy
- Old DuckDNS certificate deleted from certbot

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DNS A-record on Reg.ru** - user action (no commit, DNS confirmed via nslookup)
2. **Task 2: Update VPS infrastructure (Nginx + SSL + env + Docker rebuild)** - `b2035e1` (feat)

## Files Created/Modified
- `/etc/nginx/sites-available/maal.conf` (VPS) - server_name platform.mpstats.academy, SSL via certbot
- `/home/deploy/maal/.env.production` (VPS) - NEXT_PUBLIC_SITE_URL=https://platform.mpstats.academy
- `CLAUDE.md` (local) - Production URL, SSL expiry, domain migration checklist updated

## Decisions Made
- Wrote HTTP-only Nginx config first, then ran certbot to add SSL directives (cleaner than editing SSL paths manually)
- No maintenance page during migration (few users, ~5 min downtime for Docker rebuild)
- Deleted old DuckDNS certificate to avoid certbot renewal warnings

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all steps completed successfully on first attempt.

## User Setup Required

None - DNS was the only human action and was completed before this execution.

## Next Phase Readiness
- VPS infrastructure complete on new domain
- Plan 21-02 pending: Supabase URL Config + Yandex OAuth redirect URI updates
- Auth callback will fail until Supabase Site URL is updated (Plan 21-02)

---
*Phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy*
*Completed: 2026-03-11*
