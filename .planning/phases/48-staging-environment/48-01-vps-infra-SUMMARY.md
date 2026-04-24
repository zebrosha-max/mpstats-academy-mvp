---
phase: 48
plan: 01-vps-infra
status: complete
completed: 2026-04-24
---

# Plan 48-01 — VPS Infrastructure — SUMMARY

## What was built

VPS-инфраструктура для staging-стенда на `staging.platform.mpstats.academy`. После этого плана nginx корректно защищает staging-эндпоинт: без basic auth отдаёт **401**, с правильными кредами — **502** (backend-контейнера ещё нет, это сделает 48-03).

## Steps executed

| # | Step | Result |
|---|------|--------|
| 1 | DNS A-record `staging.platform.mpstats.academy → 89.208.106.208` (human action, Egor) | ✅ Распространилось на 1.1.1.1 / 8.8.8.8 / 77.88.8.8 |
| 2 | Port 3001 collision check on VPS (`ss -tlnp \| grep 3001`) | ✅ Free |
| 3 | Install `apache2-utils` (for htpasswd) | ✅ Installed after `apt-get update` (stale package list initially) |
| 4 | Create `/etc/nginx/.htpasswd-staging` with user `team` | ✅ bcrypt hash, chmod 640, owner root:www-data; pw verified with `htpasswd -v` |
| 5 | Pre-SSL nginx vhost (HTTP-only) for certbot validation | ✅ Returns 200 'staging-pre-ssl' on port 80 |
| 6 | `certbot --nginx --non-interactive --email zebrosha@gmail.com --redirect -d staging.platform.mpstats.academy` | ✅ Cert at `/etc/letsencrypt/live/staging.platform.mpstats.academy/`, expires 2026-07-23, auto-renewal picked up |
| 7 | Final nginx vhost: SSL + `auth_basic` + `X-Robots-Tag: noindex, nofollow, noarchive` + `proxy_pass 127.0.0.1:3001` + `proxy_buffer_size 128k` + HTTP→HTTPS redirect | ✅ `nginx -t` OK, reloaded |
| 8 | Smoke tests | ✅ See below |

## Smoke tests (SC-1, SC-6)

```
$ curl -sI https://staging.platform.mpstats.academy/
HTTP/1.1 401 Unauthorized                            ← SC-1 ✅
Server: nginx/1.24.0 (Ubuntu)

$ curl -sI -u team:*** https://staging.platform.mpstats.academy/
HTTP/1.1 502 Bad Gateway                             ← expected, no container yet ✅
Server: nginx/1.24.0 (Ubuntu)
X-Robots-Tag: noindex, nofollow, noarchive           ← SC-6 ✅

$ curl -sI https://platform.mpstats.academy
HTTP/1.1 200 OK                                      ← prod unaffected ✅
```

## Files touched (VPS only — nothing in repo)

- `/etc/nginx/sites-available/staging.platform.mpstats.academy` (new)
- `/etc/nginx/sites-enabled/staging.platform.mpstats.academy` (symlink)
- `/etc/nginx/.htpasswd-staging` (new, root:www-data 640)
- `/etc/letsencrypt/live/staging.platform.mpstats.academy/*` (certbot)
- `/etc/letsencrypt/renewal/staging.platform.mpstats.academy.conf` (auto-renewal entry)

## Credentials

- **User:** `team`
- **Password:** stored locally in `D:\GpT_docs\MPSTATS ACADEMY ADAPTIVE LEARNING\MAAL\.secrets\staging-credentials.md` (gitignored)

## Requirements covered

- **SC-1** (basic auth prompt) — ✅ 401 без auth
- **SC-6** (SSL + noindex) — ✅ cert valid, X-Robots-Tag present
- **Partial SC-5** (prod untouched) — ✅ curl prod still 200

Остальные SC (2, 3, 4, 7) будут покрыты в 48-02 (код, уже merged) и 48-03 (deploy + demo).

## Risks addressed

- **R6** (port 3001 collision) — pre-flight OK, port free
- **R7** (VPS state cleanup) — N/A, git операции делает 48-03

## Nothing left for this plan. Proceed to 48-03 after smoke-test of 48-02 code on prod path.
