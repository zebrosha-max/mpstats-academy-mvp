---
phase: 48
plan: 03-deploy-demo
status: complete
completed: 2026-04-24
---

# Plan 48-03 — Deploy + Demo — SUMMARY

## What was built

Staging-стенд задеплоен, `maal-staging-web` контейнер поднят, 9/10 автоматических smoke-тестов зелёные, prod-инвариант сохранён. 10-й тест (Library hidden on prod) — manual, передан на визуальную проверку Егору и команде.

## Steps executed

### Task 1 — commit + push + .env.staging (✅ done)
- Код Plan 48-02 уже закоммичен и запушен (`76806d1` on origin/master)
- `/home/deploy/maal/.env.staging` создан на VPS из `.env.production` + три правки:
  - `NEXT_PUBLIC_SITE_URL=https://staging.platform.mpstats.academy`
  - `NEXT_PUBLIC_STAGING=true`
  - `NEXT_PUBLIC_SHOW_LIBRARY=true`
- chmod 600, owner deploy:deploy
- Verified: `grep -q NEXT_PUBLIC_STAGING=true .env.staging` exits 0
- `.env.staging` НЕ в git (gitignored via `.gitignore` entry `.env.staging`)

### Task 2 — docker compose up ✅
- `docker compose -p maal-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build`
- Build ~4.5 мин (Next.js standalone + 28 layers)
- Container `maal-staging-web` — Up, healthy после первой попытки (<10 сек)
- Ports: `127.0.0.1:3001:3000` (nginx reverse-proxy'ит на него)
- **Prod container ID**: `b4e746f585c7` до и после деплоя — **identical ✓**

### Task 3 — 10 smoke tests

| # | SC | Проверка | Ожидание | Результат |
|---|----|----------|----------|-----------|
| 1 | SC-1 | 401 без auth | HTTP 401 | ✅ HTTP 401 |
| 2 | SC-1 | WWW-Authenticate header | `Basic realm` | ✅ `Basic realm="MAAL Staging"` |
| 3 | SC-1 | 200 с auth | HTTP 200 | ✅ HTTP 200 |
| 4 | SC-2 | «STAGING» в HTML | ≥1 match | ✅ 2 matches |
| 5 | SC-6 | X-Robots-Tag | `noindex, nofollow` | ✅ `noindex, nofollow, noarchive` |
| 6 | SC-6 | SSL valid | Let's Encrypt ok | ✅ verify ok, issuer Let's Encrypt E8 |
| 7 | SC-3 | Library hidden on prod | manual | ⏳ Task 4 (human verify) |
| 8 | SC-5 | Prod URL 200 | HTTP 200 | ✅ HTTP 200 |
| 9 | SC-5 | Prod container ID unchanged | same as before | ✅ `b4e746f585c7` match |
| 10 | SC-4 | Staging Up | Up + healthy | ✅ `Up 42 seconds (healthy)` |

### Task 4 — Manual demo (pending human verify)
Credentials выданы Егору (stored in `.secrets/staging-credentials.md`). Manual checks:
- [ ] Browser: basic auth popup появляется на `https://staging.platform.mpstats.academy`
- [ ] После auth — жёлтая плашка «STAGING — данные реальные, не заказывайте» видна
- [ ] `/learn` показывает Library раздел (через `NEXT_PUBLIC_SHOW_LIBRARY=true`)
- [ ] На prod `platform.mpstats.academy/learn` Library **не** виден
- [ ] 1-2 члена команды подтвердили доступ

## Requirements coverage (live verification)

- SC-1 ✅ (T1, T2, T3)
- SC-2 ✅ (T4 — 2 упоминания STAGING в HTML) + человеческая проверка через браузер
- SC-3 ⏳ pending manual
- SC-4 ✅ (T10)
- SC-5 ✅ (T8, T9)
- SC-6 ✅ (T5, T6)
- SC-7 — уже покрыт в 48-02 (CLAUDE.md раздел Staging Workflow)

## Files touched

- `/home/deploy/maal/.env.staging` (VPS, chmod 600, gitignored)
- `maal-staging-web` Docker container + image `maal-staging-web:latest`
- `maal-staging_default` Docker network

## Risks — post-deploy status

- **R2 (Yandex OAuth callback)** — НЕ настроен на staging. Email/password логин работает, Yandex на staging упадёт. Задокументировано в CLAUDE.md → отложено в backlog.
- **R4 (CarrotQuest на staging)** — шлёт события в prod CQ воронку. Не критично для тестового трафика, документировано.
- **R5 (Yandex Metrika на staging)** — guard добавлен в 48-02 Task 2 (`NEXT_PUBLIC_STAGING !== 'true'`), fired events в prod-счётчик НЕ идут. ✓
- **R6 (порт 3001 collision)** — pre-flight в 48-01 OK, порт был свободен.
- **R7 (git checkout leaves VPS on non-master)** — N/A в этом деплое, т.к. staging собран из master. Задокументировано в CLAUDE.md для будущих деплоев feature-веток.

## Demo-запуск для команды

Phase 46 Library видна **только** потому что `.env.staging` содержит `NEXT_PUBLIC_SHOW_LIBRARY=true`. На prod этого флага нет → компонент скрыт. Это доказывает работоспособность feature-flag паттерна.

Для любой следующей WIP-фичи:
1. Добавить `NEXT_PUBLIC_SHOW_<FEATURE>=true` в `.env.staging` (прямо на VPS)
2. Rebuild staging: `docker compose -p maal-staging --env-file .env.staging -f docker-compose.staging.yml up -d --build`
3. Команда видит фичу на staging, prod не тронут

## Nothing left except human UAT of Task 4.
