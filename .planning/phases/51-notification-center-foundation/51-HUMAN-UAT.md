---
status: partial
phase: 51-notification-center-foundation
source: [51-VERIFICATION.md]
started: 2026-04-30T12:55:57Z
updated: 2026-04-30T12:55:57Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. UI smoke: NotificationBell в header
expected: На staging.platform.mpstats.academy после логина видна Bell-иконка в header справа, между Help-кнопкой и UserNav. Badge скрыт при count=0. Открытие dropdown показывает empty-state «Пока тихо. Здесь появятся ответы на твои комментарии и важные обновления.»
result: [pending]

### 2. UI smoke: /notifications page
expected: Переход на /notifications работает (route защищён auth). Infinite list рендерится с пагинацией 20/page. Фильтр all|unread меняет URL `?filter=unread` и список перерисовывается. Empty states корректные:
  - filter=all empty: «У тебя пока нет уведомлений.»
  - filter=unread empty: «Все уведомления прочитаны. 🎉»
result: [pending]

### 3. UI smoke: /profile/notifications settings
expected: Все 7 строк (по NotificationType) отрендерены с описаниями. In-app Switch работает с optimistic update — toggle мгновенный, если refresh — состояние сохранилось. Email Switch disabled + label «Скоро». Header «Настрой, как хочешь получать уведомления.»
result: [pending]

### 4. UI smoke: anchor scroll к комменту
expected: Открыть `/learn/SOME_LESSON_ID#comment-SOME_COMMENT_ID` (взять реальные ID из БД через SQL). Страница должна smooth-scroll к комменту, на 1.5с показать `bg-mp-blue-50` accent, fade out. При невалидном comment_id — silent no-op (без error toast).
result: [pending]

### 5. GitHub Actions secrets для cron + E2E
expected: В Repo Settings → Secrets and variables → Actions присутствуют:
  - `CRON_SECRET` (вероятно уже есть от check-subscriptions cron)
  - `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`
  - `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`
  - `TEST_LESSON_ID` (id любого опубликованного урока)
**BLOCKING для shipping:** без этих secrets `notifications-cleanup.yml` упадёт первой же ночью, а E2E spec выкинет ошибку (spec написан с explicit fail, не skip).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

(no automated gaps detected — все code-level требования подтверждены)
