# Phase 21: Domain Migration from DuckDNS to platform.mpstats.academy - Research

**Researched:** 2026-03-11
**Domain:** DNS migration, SSL, Nginx, OAuth reconfiguration, Docker rebuild
**Confidence:** HIGH

## Summary

Domain migration from `academyal.duckdns.org` to `platform.mpstats.academy`. This is a well-understood infrastructure operation with no code changes to the application itself — all domain references flow through `NEXT_PUBLIC_SITE_URL` env var, which is injected at Docker build time. The scope is: DNS A-record on Reg.ru, new SSL cert via certbot, Nginx config update, env var update, Docker rebuild, and OAuth provider URL updates (Supabase Dashboard + Yandex OAuth app).

The project already has a "Domain Migration Checklist" in CLAUDE.md and MEMORY.md that enumerates all integration points. Research confirms this checklist is complete and accurate.

**Primary recommendation:** Execute as a single sequential plan — DNS first, then VPS updates (env + nginx + certbot + docker rebuild), then external service updates (Supabase, Yandex OAuth), then verification. No code changes needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- DNS: A-record `platform` -> `89.208.106.208` on Reg.ru, TTL 300 during migration
- SSL: Let's Encrypt via `certbot --nginx -d platform.mpstats.academy`
- Nginx: update `server_name`, keep `proxy_buffer_size 128k`
- Env: `NEXT_PUBLIC_SITE_URL=https://platform.mpstats.academy`, mandatory `docker compose build --no-cache`
- Supabase Dashboard: update Site URL + Redirect URLs
- Yandex OAuth (oauth.yandex.ru): update Redirect URI to `https://platform.mpstats.academy/api/auth/yandex/callback`
- Old domain: just disable, no redirect. Delete old DuckDNS SSL cert from certbot.
- Strategy: single-stage cutover, minimal downtime (5-10 min), no coordination needed (few users)

### Claude's Discretion
- Order of steps on VPS (nginx reload vs docker rebuild)
- Whether a temporary maintenance page is needed
- Verification format (manual check vs curl script)

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

No new libraries or tools needed. This phase uses only existing infrastructure:

| Tool | Version | Purpose | Already Installed |
|------|---------|---------|-------------------|
| certbot | system | SSL certificate provisioning | Yes, on VPS |
| Nginx | 1.24.0 | Reverse proxy, SSL termination | Yes, on VPS |
| Docker | 28.2.2+ | Container rebuild | Yes, on VPS |
| Docker Compose | v2 | Orchestration | Yes, on VPS |

## Architecture Patterns

### How NEXT_PUBLIC_SITE_URL Flows Through the System

The domain name enters the system through a single env var and propagates:

```
.env.production (VPS)
  NEXT_PUBLIC_SITE_URL=https://platform.mpstats.academy
    |
    +-> docker-compose.yml (build arg)
    |     +-> Dockerfile (ARG -> ENV at build time)
    |           +-> Next.js bundle (baked into client JS)
    |
    +-> Runtime env (server-side)
          +-> apps/web/src/lib/auth/actions.ts (email redirect, password reset)
          +-> apps/web/src/lib/auth/oauth-providers.ts (Yandex redirect_uri)
          +-> apps/web/src/app/auth/callback/route.ts (origin for redirect)
          +-> packages/ai/src/openrouter.ts (HTTP-Referer header)
```

**Key insight:** Because `NEXT_PUBLIC_*` vars are inlined at build time, changing `.env.production` alone is insufficient. A full `docker compose build --no-cache` is mandatory.

### Files That Hardcode the Old Domain (Tests Only)

These files contain `academyal.duckdns.org` as test fixtures — should be updated for correctness but do NOT affect production:

| File | Line | Usage |
|------|------|-------|
| `apps/web/tests/auth/yandex-oauth.test.ts` | 73, 79, 96, 192 | `vi.stubEnv` test fixtures |
| `apps/web/tests/auth/oauth-provider.test.ts` | 34, 51 | `vi.stubEnv` test fixtures |

### Documentation Files Referencing Old Domain

Multiple `.planning/` docs and `CLAUDE.md` reference `academyal.duckdns.org`. CONTEXT.md explicitly says to update these after migration.

### External Service Integration Points

| Service | What to Update | Where |
|---------|---------------|-------|
| Supabase Dashboard | Site URL, Redirect URLs (Authentication > URL Configuration) | https://supabase.com/dashboard |
| Yandex OAuth App | Redirect URI: `https://platform.mpstats.academy/api/auth/yandex/callback` | https://oauth.yandex.ru/ |
| CloudPayments (future) | Webhook URL when configured | Not yet configured — no action needed |
| Nginx on VPS | `server_name` directive | `/etc/nginx/sites-available/maal.conf` |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSL certificates | Self-signed certs | `certbot --nginx` | Auto-configures Nginx SSL directives, auto-renewal |
| DNS propagation check | Custom polling script | `dig +short platform.mpstats.academy` | Simple, reliable, no tooling needed |
| Health verification | Complex test suite | `curl -s https://platform.mpstats.academy/api/health` | Existing health endpoint checks DB connectivity |

## Common Pitfalls

### Pitfall 1: DNS Not Propagated Before SSL Cert Request
**What goes wrong:** `certbot` fails with "unauthorized" because DNS hasn't propagated yet and Let's Encrypt can't reach the domain.
**Why it happens:** DNS propagation takes 1-30 minutes depending on TTL and resolver caches.
**How to avoid:** After creating A-record, verify propagation with `dig +short platform.mpstats.academy` from VPS (or external DNS checker). Wait until it resolves to `89.208.106.208` before running certbot.
**Warning signs:** certbot error "Challenge did not pass", "unauthorized", or timeout.

### Pitfall 2: Forgetting Docker Rebuild After Env Change
**What goes wrong:** Site still shows old domain in client-side URLs (auth redirects fail).
**Why it happens:** `NEXT_PUBLIC_*` variables are baked into the JS bundle at build time. Changing `.env.production` without rebuilding has no effect on these.
**How to avoid:** Always run `docker compose build --no-cache` after changing any `NEXT_PUBLIC_*` variable.
**Warning signs:** Auth callbacks redirect to old domain despite env change.

### Pitfall 3: Supabase Redirect URL Mismatch
**What goes wrong:** After login, user gets redirected to old domain or gets "Invalid redirect URL" error.
**Why it happens:** Supabase validates redirect URLs against its allowlist. If new domain isn't in the list, auth callbacks fail.
**How to avoid:** Update Supabase Dashboard BEFORE testing auth flow. Add `https://platform.mpstats.academy/**` to Redirect URLs.
**Warning signs:** "Invalid redirect URL" in Supabase error, 400 errors on auth callback.

### Pitfall 4: Nginx Config Syntax Error Kills Existing Site
**What goes wrong:** Editing Nginx config with a typo, then `nginx -t` fails, and if you already stopped the old config, site is down.
**Why it happens:** Manual editing of config files.
**How to avoid:** Always run `sudo nginx -t` before `sudo systemctl reload nginx`. Edit carefully — only change `server_name`.
**Warning signs:** `nginx -t` reports syntax error.

### Pitfall 5: Old Certbot Certificate Blocks New One
**What goes wrong:** certbot refuses to issue new cert because old DuckDNS cert still references the same Nginx server block.
**Why it happens:** certbot manages Nginx config directives tied to specific domain names.
**How to avoid:** Update `server_name` in Nginx config first, then run certbot for the new domain. Old cert can be deleted afterward with `certbot delete --cert-name academyal.duckdns.org`.
**Warning signs:** certbot "conflicting server names" or "already configured" errors.

### Pitfall 6: Yandex OAuth Redirect URI Must Match Exactly
**What goes wrong:** Yandex OAuth returns error because callback URL doesn't match registered redirect URI.
**Why it happens:** OAuth redirect URI matching is exact (including trailing slash, protocol, path).
**How to avoid:** Set redirect URI in Yandex app to exactly `https://platform.mpstats.academy/api/auth/yandex/callback` (no trailing slash).
**Warning signs:** "redirect_uri mismatch" or "invalid_client" from Yandex OAuth.

## Recommended Execution Order

Based on dependencies and minimizing downtime:

```
1. DNS: Create A-record on Reg.ru (platform -> 89.208.106.208)
2. WAIT: Verify DNS propagation (dig from VPS)
3. NGINX: Update server_name in maal.conf, nginx -t, reload
4. SSL: certbot --nginx -d platform.mpstats.academy
5. ENV: Update NEXT_PUBLIC_SITE_URL in .env.production
6. DOCKER: docker compose down && docker compose build --no-cache && docker compose up -d
7. EXTERNAL: Update Supabase Dashboard (Site URL + Redirect URLs)
8. EXTERNAL: Update Yandex OAuth app (Redirect URI)
9. VERIFY: Health check, auth flow, lesson page, RAG chat
10. CLEANUP: Delete old DuckDNS cert (certbot delete), update docs
11. CODE: Update test fixtures to use new domain (optional, non-blocking)
```

**Why this order:**
- DNS must propagate before certbot can verify domain ownership
- Nginx must serve the domain before certbot can configure it
- SSL must be active before Docker rebuild (so the app serves HTTPS immediately)
- External services updated after app is accessible on new domain
- Docs and test cleanup is last (non-critical path)

**Downtime window:** Step 6 only (docker rebuild ~3-5 minutes). Steps 1-5 and 7-11 don't cause downtime.

### Claude's Discretion Recommendations

**Order of steps:** Nginx reload BEFORE docker rebuild. Nginx needs to serve the new domain for certbot to work. Docker rebuild is the last VPS step.

**Maintenance page:** NOT needed. Few users, 5-minute downtime during rebuild. If anyone hits the site, they'll get a standard Nginx 502 which resolves after container starts.

**Verification format:** Combination approach:
1. Automated: `curl -s https://platform.mpstats.academy/api/health` (checks app + DB)
2. Manual: Open browser, test login with Yandex OAuth, open a lesson page (verifies auth flow end-to-end)

## Code Examples

### DNS Verification (from VPS)
```bash
# Check A-record resolution
dig +short platform.mpstats.academy
# Expected: 89.208.106.208

# Alternative if dig not available
host platform.mpstats.academy
```

### Nginx Config Update
```nginx
# /etc/nginx/sites-available/maal.conf
# Change ONLY server_name line:
server_name platform.mpstats.academy;
# Keep everything else (proxy_pass, proxy_buffer_size 128k, headers)
```

### Certbot SSL
```bash
sudo certbot --nginx -d platform.mpstats.academy
# Certbot auto-configures SSL directives in Nginx
# Auto-renewal already set up via systemd timer
```

### Docker Rebuild
```bash
cd /home/deploy/maal
# Edit .env.production: NEXT_PUBLIC_SITE_URL=https://platform.mpstats.academy
docker compose down
docker compose build --no-cache
docker compose up -d
# Wait for healthcheck
docker compose logs --tail=20 -f
```

### Health Check Verification
```bash
curl -s https://platform.mpstats.academy/api/health | python3 -m json.tool
# Expected: {"status":"ok","database":"connected",...}
```

### Old Certificate Cleanup
```bash
sudo certbot delete --cert-name academyal.duckdns.org
```

## State of the Art

No technology changes — this is pure infrastructure reconfiguration using existing tools.

| Component | Current State | After Migration |
|-----------|--------------|-----------------|
| Domain | academyal.duckdns.org | platform.mpstats.academy |
| DNS Provider | DuckDNS (free) | Reg.ru (paid, owned) |
| SSL Cert | Let's Encrypt for DuckDNS | Let's Encrypt for mpstats.academy |
| VPS IP | 89.208.106.208 | 89.208.106.208 (unchanged) |
| Nginx config | server_name academyal.duckdns.org | server_name platform.mpstats.academy |

## Open Questions

1. **Reg.ru DNS zone status**
   - What we know: Domain `mpstats.academy` is purchased on Reg.ru
   - What's unclear: Whether DNS zone is already created, whether Reg.ru nameservers are authoritative
   - Recommendation: First step in plan should verify DNS zone exists; if not, create it before adding A-record

2. **Yandex OAuth app access**
   - What we know: App is registered at oauth.yandex.ru with current DuckDNS callback URL
   - What's unclear: Which Yandex account owns the app, whether user has credentials ready
   - Recommendation: Plan should include this as a HUMAN task with clear instructions

3. **CloudPayments webhook URL**
   - What we know: CloudPayments is not yet configured in production (Phase 19 built code but credentials not set)
   - What's unclear: Whether webhook URL has been set anywhere
   - Recommendation: No action needed for this phase. When CloudPayments is configured, use new domain.

## Sources

### Primary (HIGH confidence)
- Project codebase: `Dockerfile`, `docker-compose.yml`, `oauth-providers.ts`, `actions.ts`, `auth/callback/route.ts`
- Project documentation: `CLAUDE.md` Domain Migration Checklist, `MEMORY.md`
- Phase 21 CONTEXT.md: User-confirmed decisions
- Phase 05.1 and 06 summaries: Original VPS/SSL/Nginx setup documentation

### Secondary (MEDIUM confidence)
- certbot behavior with Nginx plugin: Based on standard certbot documentation and confirmed by existing Phase 05.1 setup on this VPS

## Metadata

**Confidence breakdown:**
- Infrastructure steps: HIGH - well-documented existing setup, no unknowns
- OAuth updates: HIGH - exact URLs known from codebase analysis
- DNS setup: MEDIUM - Reg.ru DNS zone status unknown, but standard process
- Pitfalls: HIGH - based on real issues documented in previous phases (05.1, 06)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable infrastructure, no time-sensitive dependencies)
