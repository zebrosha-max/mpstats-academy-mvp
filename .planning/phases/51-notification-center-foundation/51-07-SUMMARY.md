---
phase: 51-notification-center-foundation
plan: 07
subsystem: notifications
tags: [cron, retention, e2e, playwright, github-actions, sentry]
requires:
  - 51-01 schema (Notification table)
  - 51-02 service (notify())
  - 51-04 route handler /api/notifications/notify-reply
  - 51-05 NotificationBell UI
  - 51-06 anchor scroll + highlight
provides:
  - cron /api/cron/notifications-cleanup (90d delete + 500/user cap)
  - GitHub Actions workflow notifications-cleanup.yml (daily 00:00 UTC)
  - Playwright E2E spec for COMMENT_REPLY full flow
affects: []
tech-stack:
  added: []
  patterns:
    - "Sentry checkin + 180-min margin (recurring lesson MAAL-PLATFORM-1)"
    - "Raw SQL window function для per-user cap (Prisma не поддерживает window via query API)"
    - "Explicit fail в test.beforeAll вместо test.skip (gate для secrets)"
key-files:
  created:
    - apps/web/src/app/api/cron/notifications-cleanup/route.ts
    - .github/workflows/notifications-cleanup.yml
    - apps/web/tests/e2e/notifications.spec.ts
  modified: []
decisions:
  - "checkinMargin: 180 — устранить false positives от GitHub schedule drift"
  - "Raw SQL ROW_NUMBER OVER PARTITION BY userId — единственный эффективный способ per-user top-N в Postgres через Prisma"
  - "Soft-fail в curl (|| echo) — Sentry checkin alert надёжнее GitHub Actions exit code"
  - "Explicit Error throw при отсутствии E2E secrets, НЕ test.skip — gate для shipping"
metrics:
  duration: ~25 minutes
  tasks_completed: 3 of 3 auto tasks (Task 4 — checkpoint:human-verify, deferred to user)
  completed_date: 2026-04-30
---

# Phase 51 Plan 07: Cron Cleanup + GitHub Workflow + E2E Summary

Финальная волна Phase 51: добавлен ежедневный cron для retention (90 дней + 500/user cap), GitHub Actions workflow для триггера, Playwright E2E полного flow reply→bell→click→markRead.

## What Was Built

### 1. Cron route handler — `apps/web/src/app/api/cron/notifications-cleanup/route.ts`

- GET + POST handlers (workflow_dispatch и scheduled run могут использовать разные методы)
- `Authorization: Bearer ${CRON_SECRET}` check first thing — 401 если отсутствует/неверен
- Sentry `captureCheckIn` slug `notifications-cleanup`, `checkinMargin: 180`, `crontab: '0 0 * * *'`, `maxRuntime: 30`, timezone UTC
- 90-day retention: `prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } })`
- 500-row per-user cap: raw SQL CTE с `ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt" DESC)`, удаляет `rn > 500`
- Errors → `Sentry.captureException` с tags `{area:'cron', stage:'notifications-cleanup'}` + checkin status `error`
- Логи: `[notifications-cleanup] retention=N overflow=M`

### 2. GitHub Actions workflow — `.github/workflows/notifications-cleanup.yml`

- `schedule: '0 0 * * *'` (00:00 UTC = 03:00 МСК per SPEC req 11)
- `workflow_dispatch: {}` для manual smoke testing после деплоя
- `curl -fsSL --max-time 600 -H "Authorization: Bearer $CRON_SECRET" $SITE_URL/api/cron/notifications-cleanup`
- Soft-fail (`|| echo "Warning..."`) — alerting через Sentry checkin, не GitHub Actions exit code
- Использует существующие repo secrets `SITE_URL` и `CRON_SECRET`

### 3. Playwright E2E spec — `apps/web/tests/e2e/notifications.spec.ts`

- Два независимых browser context'а (User A создатель + User B reply)
- Полный flow: A коммент → B reply → A видит badge ≤90с → click bell → dropdown → click item → URL содержит `#comment-` → reload → badge скрыт
- Verified селекторы из `CommentInput.tsx`: placeholders «Напишите комментарий...» / «Напишите ответ...», submit button «Отправить»
- Bell селектор: `getByRole('button', { name: 'Уведомления' })` (соответствует aria-label NotificationBell)
- Dropdown: `[data-radix-popper-content-wrapper]` (Radix Popover)
- **Explicit fail в `test.beforeAll`** при отсутствии любого из 5 env-vars (не `test.skip` — phase NOT shipped без secrets)
- Cleanup в `finally`: `ctxA.close()` + `ctxB.close()` гарантирован даже при failure

## Required GitHub Actions Secrets (BLOCKING для shipping)

E2E spec падает с явной ошибкой если хотя бы один из этих secrets отсутствует. Phase 51 НЕ shipped пока все 5 не выставлены:

| Secret | Что содержит |
|--------|--------------|
| `TEST_USER_A_EMAIL` | Email тестового юзера-получателя уведомлений (например `staging-a@mpstats.academy`) |
| `TEST_USER_A_PASSWORD` | Пароль тестового юзера A |
| `TEST_USER_B_EMAIL` | Email тестового юзера-отвечающего (`staging-b@mpstats.academy`) |
| `TEST_USER_B_PASSWORD` | Пароль тестового юзера B |
| `TEST_LESSON_ID` | ID free-tier урока, доступного обоим юзерам без подписки (для гарантии что комменты в принципе доступны) |

Установить через `gh secret set <NAME>` либо Settings → Secrets and variables → Actions.

Существующие secrets `SITE_URL` и `CRON_SECRET` уже выставлены (используются другими cron'ами — orphan-materials, check-subscriptions) — переустанавливать не нужно.

## Deviations from Plan

### Auto-fixed Issues

Нет — план выполнен буквально. Все 3 файла созданы по референсным паттернам (`orphan-materials/route.ts`, `orphan-materials-cleanup.yml`, `lesson-materials.spec.ts`).

### Скоупные ограничения / known limitations для Phase 52+

- **Email-toggle hard-disabled** — снимется per-type когда CQ-шаблоны готовы (это Phase 52 work)
- **No real-time WS/SSE** — polling 60s достаточен для текущей нагрузки (~500-1000 active users)
- **No notification grouping** — Phase 52 для CONTENT_UPDATE
- **No ADMIN_COMMENT_REPLY accent** — Phase 52
- **Артефакты для Phase 52+:** `notify()` + tRPC router расширяемы. Новый тип уведомления = enum value + payload variant + триггер. Cron, polling, UI инфраструктура не меняется.

## Pre-shipping Checklist (для checkpoint Task 4)

Manual smoke test на staging.platform.mpstats.academy (см. PLAN.md Task 4 секции A-G):

- [ ] **A. Bell + polling** — bell виден в Header, badge скрыт при 0 уведомлений, dropdown показывает empty-state
- [ ] **B. COMMENT_REPLY end-to-end** — User A коммент → User B reply → User A через ≤60с видит badge, click → /learn/X#comment-Y + highlight ~1.5с
- [ ] **C. Anti-self-notify** — A reply на свой собственный коммент → НЕТ row, НЕТ CQ event
- [ ] **D. Preferences** — toggle In-app COMMENT_REPLY off → row не создаётся, но CQ event летит
- [ ] **E. Polling pause** — DevTools Network подтверждает что unreadCount запросы прекращаются при скрытой вкладке
- [ ] **F. Cron smoke** — manual workflow_dispatch → Sentry monitor `notifications-cleanup` → последний checkin = ok
- [ ] **G. Playwright E2E** — `pnpm test:e2e --grep "COMMENT_REPLY flow"` PASS локально и на CI

## Verification

- Cron route файл существует, содержит все required constants (`RETENTION_DAYS = 90`, `PER_USER_CAP = 500`, `checkinMargin: 180`, `Bearer ${CRON_SECRET}`, slug `notifications-cleanup`)
- GitHub workflow YAML валиден, schedule `0 0 * * *`, `workflow_dispatch` enabled
- E2E spec содержит explicit fail (не skip), verified selectors, 90s timeout, URL hash assertion

`pnpm typecheck` не запущен в worktree — `node_modules` отсутствует в parallel worktree (нормально для wave-параллельного запуска). Финальный typecheck — на orchestrator/merge stage. Pattern файла 1:1 копирует `orphan-materials/route.ts` (compiles в production), используются те же импорты (`@mpstats/db/client`, `@sentry/nextjs`, `next/server`) и `prisma.notification` модель из 51-01 schema commit (verified `grep "model Notification" packages/db/prisma/schema.prisma` → строка 470).

## Commits

- `f6a9994` — `feat(phase-51-07): add notifications-cleanup cron route`
- `b675c29` — `feat(phase-51-07): add notifications-cleanup GitHub Actions workflow`
- `3b13617` — `test(phase-51-07): add Playwright E2E for notification reply→bell→read flow`

## Self-Check: PASSED

- FOUND: apps/web/src/app/api/cron/notifications-cleanup/route.ts
- FOUND: .github/workflows/notifications-cleanup.yml
- FOUND: apps/web/tests/e2e/notifications.spec.ts
- FOUND: f6a9994 (cron route commit)
- FOUND: b675c29 (workflow commit)
- FOUND: 3b13617 (E2E spec commit)
