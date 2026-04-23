---
phase: 48
slug: staging-environment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 48 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> This is an **infrastructure + light code** phase — validation is primarily smoke tests (curl, docker ps, nginx -t) with a small unit-test component for the StagingBanner + feature-flag conditionals.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (existing, for unit) + manual smoke tests (infra) |
| **Config file** | `apps/web/vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter web test -- StagingBanner` |
| **Full suite command** | `pnpm test && pnpm typecheck` |
| **Estimated runtime** | ~30 seconds (unit) + ~2 min (smoke via SSH + curl) |

---

## Sampling Rate

- **After every code task commit:** Run `pnpm --filter web test -- StagingBanner` (seconds)
- **After every infra task (VPS):** Run relevant `curl` smoke from Validation Architecture section
- **After each wave:** Run full smoke suite (10 curl checks from 48-RESEARCH.md)
- **Before `/gsd-verify-work`:** Prod + staging both return 200, StagingBanner visible on staging, hidden on prod
- **Max feedback latency:** 60 seconds for unit, 5 minutes for infra smoke

---

## Per-Task Verification Map

> Exact task IDs will be assigned by the planner. This map sketches the verification approach per task-type.

| Task Type | Requirement | Test Type | Automated Command | Notes |
|-----------|-------------|-----------|-------------------|-------|
| DNS A-record | SC-1 | manual | `dig +short staging.platform.mpstats.academy` returns `89.208.106.208` | Human action required |
| Dockerfile ARG/ENV for NEXT_PUBLIC_STAGING | SC-2,3 | unit | `grep -E "ARG NEXT_PUBLIC_STAGING" Dockerfile` exits 0 | |
| docker-compose.staging.yml created | SC-4 | static | `docker compose -f docker-compose.staging.yml config` exits 0 | Validates YAML + env |
| StagingBanner component | SC-2 | unit | `pnpm --filter web test -- StagingBanner` passes | Vitest with `process.env.NEXT_PUBLIC_STAGING` mock |
| Layout integration | SC-2 | unit | Snapshot test or grep: `grep "StagingBanner" apps/web/src/app/layout.tsx` exits 0 | |
| LibrarySection feature flag | SC-3 | unit | Vitest: flag=true renders, flag=undefined hides | Need to verify `learning.getLibrary` isHidden filter (R1) |
| Nginx config exists on VPS | SC-1,6 | manual | SSH: `test -f /etc/nginx/sites-available/staging.platform.mpstats.academy && nginx -t` | |
| Basic auth works | SC-1 | smoke | `curl -I https://staging.platform.mpstats.academy` returns `401 Unauthorized` + `WWW-Authenticate: Basic` | |
| Basic auth accepts creds | SC-1 | smoke | `curl -I -u user:pass https://staging.platform.mpstats.academy` returns `200` | |
| SSL valid | SC-6 | smoke | `curl -Iv https://staging.platform.mpstats.academy 2>&1 \| grep "SSL certificate verify ok"` | certbot auto-check |
| noindex header | SC-6 | smoke | `curl -I -u user:pass https://staging.platform.mpstats.academy \| grep -i "X-Robots-Tag: noindex"` | |
| Staging container running | SC-4 | smoke | SSH: `docker ps --filter "name=maal-staging" --format "{{.Status}}"` shows `Up` | |
| Prod container untouched | SC-5 | smoke | SSH: `docker ps --filter "name=maal-web" --format "{{.Status}}"` before/after staging deploy — uptime continues, container ID unchanged | |
| Prod URL returns 200 after staging deploy | SC-5 | smoke | `curl -I https://platform.mpstats.academy` returns `200` | Run immediately after staging deploy |
| CLAUDE.md Staging Workflow section | SC-7 | static | `grep "## Staging Workflow" MAAL/CLAUDE.md` exits 0 | |
| Memory entry exists | SC-7 | static | `test -f .claude/memory/project_staging_environment.md` | |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/tests/unit/StagingBanner.test.tsx` — unit test for banner component (renders when flag true, null when flag false/undefined)
- [ ] `apps/web/tests/unit/LibraryFlag.test.tsx` (or inline in learn/page test) — feature-flag conditional
- [ ] No new framework install — Vitest already configured in repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DNS propagation | SC-1 | External service (DNS provider) | Run `dig +short staging.platform.mpstats.academy` from local machine, expect `89.208.106.208`. May take 5-60 min after A-record creation. |
| Yandex OAuth callback (R2) | non-SC, but blocks demo | Yandex OAuth admin UI | Add `https://staging.platform.mpstats.academy/api/auth/yandex/callback` to Yandex OAuth app + Supabase Auth allowed redirect URLs |
| Supabase redirect URLs (R2) | non-SC | Supabase dashboard | Same as above — add staging callback URL |
| Demo: Phase 46 Library visible | SC-3 + demo | Human eyeballs on staging | After deploy, login as test user on staging, navigate to /learn, confirm LibrarySection renders. On prod (same action), confirm it's hidden. |
| Team acceptance | Implicit SC-0 | Human feedback | Share URL + basic auth creds with 1-2 team members, confirm they can access, see banner, see Library. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify OR explicit `manual: true` flag
- [ ] Sampling continuity: each wave has at least 1 automated check
- [ ] Wave 0 covers unit tests for StagingBanner + feature-flag pattern
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 min for infra, < 60s for code
- [ ] `nyquist_compliant: true` set in frontmatter by checker after plans are verified

**Approval:** pending
