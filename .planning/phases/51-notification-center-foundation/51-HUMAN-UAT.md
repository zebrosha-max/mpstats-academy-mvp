---
status: resolved
phase: 51-notification-center-foundation
source: [51-VERIFICATION.md]
started: 2026-04-30T12:55:57Z
updated: 2026-04-30T14:30:00Z
---

## Current Test

[completed — все 5 пунктов проверены на staging]

## Tests

### 1. UI smoke: NotificationBell в header
expected: На staging.platform.mpstats.academy после логина видна Bell-иконка в header справа, между Help-кнопкой и UserNav. Badge скрыт при count=0. Открытие dropdown показывает empty-state.
result: passed

### 2. UI smoke: /notifications page
expected: Переход на /notifications работает. Infinite list 20/page. Фильтр all|unread меняет URL и список. Empty states корректные.
result: passed

### 3. UI smoke: /profile/notifications settings
expected: 7 строк, in-app Switch с optimistic update, email Switch disabled + «Скоро».
result: passed

### 4. UI smoke: anchor scroll к комменту
expected: Hash `#comment-<id>` smooth-scroll + 1.5с подсветка + fade. Silent no-op при невалидном.
result: passed (тест: «по ним проваливаться можно — телепортирует, всё работает»)

### 5. Reply-flow + badge indicator (объединил с 4 после реального теста)
expected: Юзер A постит коммент → Юзер B отвечает → у юзера A на колокольчике появляется красный badge с count в течение 60с (polling). Click → markSeen → badge → 0. Items в dropdown остаются подсвечены unread пока не кликнешь.
result: passed после fix

**Issue найден и устранён в этой же сессии:**
- Badge не показывался ни в одном сценарии. Root cause: `bg-mp-red-500` — несуществующий Tailwind-токен (в проекте только `mp-blue/mp-green/mp-gray`). Прозрачный фон + white text = невидимка.
- Fix: `bg-red-500` (стандартный Tailwind) + замена custom SVG на lucide-react Bell + выравнивание контейнера со стилем `HelpCircleButton` (одинаковая пара иконок).
- Commit: `5572305` shipped on staging 2026-04-30 14:25.
- Verified by user: «увидел индикатор что 3 ответа пришли на мой коммент».

### 6. GitHub Actions secrets для cron + E2E (отдельный пункт, blocking для prod-deploy)
expected: В Repo Settings → Secrets and variables → Actions присутствуют:
  - `CRON_SECRET` (вероятно уже есть от check-subscriptions cron)
  - `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`
  - `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`
  - `TEST_LESSON_ID` (id любого опубликованного урока)
**BLOCKING для prod-deploy:** без этих secrets `notifications-cleanup.yml` упадёт первой же ночью, а E2E spec выкинет ошибку.
result: pending — отдельная задача перед prod-deploy

## Summary

total: 6
passed: 5
issues: 1 (resolved — badge color hotfix)
pending: 1 (GitHub Actions secrets — pre-prod-deploy task)
skipped: 0
blocked: 0

## Gaps

Closed in-session:
- Badge invisible: fixed via commit `5572305` (Tailwind token + style alignment)

Outstanding (not Phase 51 code, infra):
- GitHub Actions secrets needed before prod cron + E2E job will succeed
