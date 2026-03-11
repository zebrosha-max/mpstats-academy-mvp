---
phase: 21-domain-migration-from-duckdns-to-platform-mpstats-academy
verified: 2026-03-11T19:30:00Z
status: human_needed
score: 6/7 must-haves verified
re_verification: false
human_verification:
  - test: "Open https://platform.mpstats.academy in browser and verify landing page loads with valid SSL padlock"
    expected: "Landing page renders, padlock shows valid certificate for platform.mpstats.academy (expires 2026-06-09)"
    why_human: "VPS Nginx config and .env.production live on remote server — cannot read from local filesystem. Health endpoint curl result only verifiable live."
  - test: "Attempt Yandex OAuth login on https://platform.mpstats.academy"
    expected: "Full OAuth flow completes: Yandex login page opens, after auth redirects back to /dashboard on platform.mpstats.academy (no DuckDNS redirect)"
    why_human: "External service config (Supabase Site URL, Yandex OAuth redirect_uri) cannot be programmatically verified from codebase — requires live browser test."
  - test: "Check https://academyal.duckdns.org — confirm it does NOT load"
    expected: "Connection refused or timeout — old domain is disabled, no redirect"
    why_human: "External DNS state and VPS Nginx config for old domain cannot be verified from local codebase."
gaps: []
---

# Phase 21: Domain Migration Verification Report

**Phase Goal:** Migrate the production application from academyal.duckdns.org to platform.mpstats.academy — DNS, Nginx, SSL, env vars, Docker rebuild, OAuth provider updates, documentation updates.
**Verified:** 2026-03-11T19:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | platform.mpstats.academy resolves to 89.208.106.208 | ? UNCERTAIN | DNS confirmed by user via nslookup (per 21-01-SUMMARY.md); cannot verify from local env |
| 2 | HTTPS works on platform.mpstats.academy with valid Let's Encrypt cert | ? UNCERTAIN | SUMMARY claims cert issued 2026-03-11, expires 2026-06-09; VPS not accessible from verifier |
| 3 | Application serves pages on https://platform.mpstats.academy | ? UNCERTAIN | Health endpoint `{"status":"ok","database":"connected"}` reported in SUMMARY; live check needed |
| 4 | Health endpoint returns ok on new domain | ? UNCERTAIN | Documented in SUMMARY; cannot curl from local env |
| 5 | Yandex OAuth login works on platform.mpstats.academy | ? UNCERTAIN | Supabase + Yandex OAuth update documented as human-action in 21-02-SUMMARY.md; requires browser E2E |
| 6 | Supabase auth redirects use the new domain | ? UNCERTAIN | Checklist item marked [x] in CLAUDE.md; external service — cannot verify programmatically |
| 7 | Test fixtures reference platform.mpstats.academy instead of DuckDNS | ✓ VERIFIED | Both test files read directly — contain platform.mpstats.academy, no academyal.duckdns.org |
| 8 | Documentation reflects the new production URL | ✓ VERIFIED | CLAUDE.md: Production URL line 77 = https://platform.mpstats.academy; VPS Deploy table = https://platform.mpstats.academy; Domain Migration Checklist all [x] |

**Score:** 2/8 truths fully verified programmatically; 6/8 pass documentary evidence with human confirmation needed for live infra

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `/etc/nginx/sites-available/maal.conf` (VPS) | server_name platform.mpstats.academy, proxy_buffer_size 128k | ? UNCERTAIN | Lives on remote VPS (89.208.106.208); committed as b2035e1; SUMMARY confirms update |
| `/home/deploy/maal/.env.production` (VPS) | NEXT_PUBLIC_SITE_URL=https://platform.mpstats.academy | ? UNCERTAIN | Lives on remote VPS; committed as b2035e1; SUMMARY confirms update and Docker rebuild |
| `apps/web/tests/auth/yandex-oauth.test.ts` | Contains platform.mpstats.academy (not DuckDNS) | ✓ VERIFIED | File read — line 73: `vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://platform.mpstats.academy')`, lines 79/96/192: Request URLs use platform.mpstats.academy. No academyal.duckdns.org references. |
| `apps/web/tests/auth/oauth-provider.test.ts` | Contains platform.mpstats.academy (not DuckDNS) | ✓ VERIFIED | File read — line 34: `vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://platform.mpstats.academy')`, line 51: redirect_uri assertion uses platform.mpstats.academy. No academyal.duckdns.org references. |
| `CLAUDE.md` | Updated production URL, domain migration checklist complete | ✓ VERIFIED | File read — line 77: `Production URL: https://platform.mpstats.academy`; VPS Deploy table URL = https://platform.mpstats.academy; Domain Migration Checklist section (lines 556-565) all items marked [x] with date 2026-03-11 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| DNS A-record | Nginx server_name | DNS resolution to 89.208.106.208 | ? UNCERTAIN | User-confirmed via nslookup; cannot dig from local Windows env without VPS access |
| .env.production | Docker container | docker compose build --no-cache | ? UNCERTAIN | SUMMARY documents rebuild completed; VPS-side verification only |
| Supabase Dashboard | Auth callback route | Redirect URL allowlist containing platform.mpstats.academy | ? UNCERTAIN | External service; CLAUDE.md checklist shows [x]; requires browser auth test |
| Yandex OAuth app | Auth callback route | redirect_uri exact match platform.mpstats.academy/api/auth/yandex/callback | ? UNCERTAIN | External service; CLAUDE.md checklist shows [x]; requires browser auth test |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOM-01 | 21-01-PLAN.md | DNS A-record: platform.mpstats.academy → 89.208.106.208 | ? UNCERTAIN | Referenced in ROADMAP.md and PLAN frontmatter; **NOT defined in REQUIREMENTS.md** — ID exists only in roadmap/plan files, not in the requirements registry |
| DOM-02 | 21-01-PLAN.md | Nginx + SSL on new domain | ? UNCERTAIN | Same — ID not in REQUIREMENTS.md |
| DOM-03 | 21-01-PLAN.md | Docker rebuild with updated env | ? UNCERTAIN | Same — ID not in REQUIREMENTS.md |
| DOM-04 | 21-02-PLAN.md | Supabase auth redirects updated | ? UNCERTAIN | Same — ID not in REQUIREMENTS.md |
| DOM-05 | 21-02-PLAN.md | Yandex OAuth redirect URI updated | ? UNCERTAIN | Same — ID not in REQUIREMENTS.md |
| DOM-06 | 21-02-PLAN.md | Test fixtures + docs updated | ✓ VERIFIED | Test files and CLAUDE.md verified programmatically |

**ORPHANED REQUIREMENTS ISSUE:** DOM-01 through DOM-06 are referenced in ROADMAP.md and PLAN frontmatter but are **not present in `.planning/REQUIREMENTS.md`** (v1.2 requirements only cover AUTH-*, BILL-*, PAY-*). These requirement IDs have no formal definition. This is a traceability gap — the requirements were planned around but never added to the registry. Goal achievement is not blocked (the work was done), but formal requirement traceability is incomplete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/ROADMAP.md` | 170 | `- [ ] 21-02-PLAN.md` — unchecked despite plan being COMPLETE | ℹ️ Info | Documentation inconsistency only; actual work completed per commits and SUMMARY |

No code-level anti-patterns found in the modified local files (test fixtures are substantive, CLAUDE.md is updated documentation).

### Human Verification Required

#### 1. Live HTTPS Endpoint Check

**Test:** `curl -vI https://platform.mpstats.academy/api/health` from any terminal with internet access
**Expected:** HTTP 200, response body `{"status":"ok","database":"connected"}`, TLS certificate issued to platform.mpstats.academy by Let's Encrypt, valid through 2026-06-09
**Why human:** VPS Nginx config and Docker container live on remote server 89.208.106.208 — cannot be read or curled from local codebase verification

#### 2. Yandex OAuth Full Flow

**Test:** Open https://platform.mpstats.academy → click "Войти" → click Yandex login → complete Yandex auth → observe redirect
**Expected:** After Yandex auth, browser redirects to https://platform.mpstats.academy/dashboard (not academyal.duckdns.org). No OAuth errors.
**Why human:** Supabase Site URL and Yandex OAuth redirect_uri are external service configs — cannot be verified programmatically from codebase

#### 3. Old Domain Disabled

**Test:** Navigate to https://academyal.duckdns.org in browser
**Expected:** Connection fails (timeout, refused, or DNS NXDOMAIN) — no redirect, no content
**Why human:** DuckDNS external DNS state and VPS Nginx state cannot be verified locally

### Commits Verified

| Commit | Description | Files |
|--------|-------------|-------|
| `b2035e1` | feat(21-01): VPS infrastructure migration (Nginx, SSL, env, Docker rebuild) | CLAUDE.md |
| `7d121b6` | docs(21-02): test fixtures + docs updated for new domain | CLAUDE.md, yandex-oauth.test.ts, oauth-provider.test.ts |
| `3bbed46` | docs(21-02): Phase 21 complete — SUMMARY.md, ROADMAP.md, STATE.md | Planning files |

All 3 commits exist and are verified via `git log`.

### Gaps Summary

No hard gaps blocking goal achievement. All local codebase artifacts are correct:
- Test fixtures: both files updated, zero DuckDNS references remain
- CLAUDE.md: production URL updated, domain migration checklist fully marked complete
- Commits: all documented commits exist with correct content

The "human_needed" status reflects that VPS-side changes (Nginx config, .env.production, Docker container, live SSL cert) and external service configs (Supabase, Yandex OAuth) cannot be verified by reading the local codebase — they require a live check. The SUMMARY documents successful completion of all these steps including health endpoint confirmation and full E2E browser verification by the user.

**Minor documentation issue:** ROADMAP.md line 170 shows `21-02-PLAN.md` as unchecked (`- [ ]`) despite the plan being complete. This should be updated to `- [x]` for consistency.

**Traceability issue:** DOM-01 through DOM-06 requirement IDs are not defined in REQUIREMENTS.md. They exist only in ROADMAP.md and PLAN frontmatter. The requirements file covers v1.2 (AUTH-*, BILL-*, PAY-*) but Phase 21 was an infrastructure phase added after the v1.2 requirements were written. Not a blocker for goal achievement.

---

_Verified: 2026-03-11T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
