---
status: human_needed
phase: 51-notification-center-foundation
verified_at: 2026-04-30T12:55:57Z
score: 11/11 must-haves verified (code-level)
plans_verified: 7/7
new_tests_passing: 30/30
typecheck: green (6/6 turbo tasks)
unrelated_failing_tests: 3 (pre-existing Yandex OAuth, не блокирует)
human_verification_required: 5 items (UI smoke + cron secrets)
---

# Phase 51 Verification — Notification Center Foundation

## Summary

Все 11 SPEC-требований подтверждены spot-checks по реальному коду на master HEAD. 30 unit-тестов из новых модулей (10 notify + 6 notify-reply route + 14 notifications router) проходят. Typecheck зелёный. Schema push в Supabase prod-shared подтверждён 51-01-SUMMARY.

**Code-level verification: PASSED.**

**Human verification required:** 5 пунктов — UI smoke на staging + проверка GitHub Actions secrets перед деплоем cron.

## Requirements Coverage

| Req ID | Title | Status | Evidence |
|--------|-------|--------|----------|
| REQ-51-01 | Schema: Notification model | ✅ | `packages/db/prisma/schema.prisma` — model Notification + composite index `[userId, readAt, createdAt(sort: Desc)]` |
| REQ-51-02 | Schema: NotificationPreference | ✅ | model + composite PK `@@id([userId, type])` + WEEKLY_DIGEST default через `DEFAULT_IN_APP_PREFS` (D-15 enforced в коде getPreferences, не в schema) |
| REQ-51-03 | NotificationType enum × 7 | ✅ | Точно 7 значений в SPEC-порядке: COMMENT_REPLY, ADMIN_COMMENT_REPLY, CONTENT_UPDATE, PROGRESS_NUDGE, INACTIVITY_RETURN, WEEKLY_DIGEST, BROADCAST. **Order frozen (D-10).** UserProfile.lastNotificationsSeenAt — nullable timestamptz. |
| REQ-51-04 | notify() service | ✅ | `apps/web/src/lib/notifications/notify.ts` — 3 экспорта (`notify`, `notifyMany`, `notifyCommentReply`) + NotifyOpts interface + NotifyCommentReplyArgs. Anti-self-notify в двух слоях. Fire-and-forget try/catch с Sentry. 10/10 unit-тестов. |
| REQ-51-05 | tRPC router (7 procedures) | ✅ | `packages/api/src/routers/notifications.ts` — список процедур задокументирован в шапке: list, unreadCount, markRead, markAllRead, markSeen, getPreferences, updatePreference. Все `protectedProcedure`. Зарегистрирован в `appRouter` как `notifications`. 14/14 unit-тестов (включая FORBIDDEN ownership + WEEKLY_DIGEST default). |
| REQ-51-06 | COMMENT_REPLY trigger | ✅ | `apps/web/src/app/api/notifications/notify-reply/route.ts` — POST handler с Supabase auth + anti-spoofing. `CommentInput.tsx` onSuccess вызывает fetch fire-and-forget при наличии parentId. 6/6 integration-тестов (auth, anti-spoofing, 404, success, fire-and-forget при ошибке notify). |
| REQ-51-07 | NotificationBell + dropdown | ✅ | `apps/web/src/components/notifications/NotificationBell.tsx` — mounted в Header `apps/web/src/app/(main)/layout.tsx` (`<NotificationBell />`). Per-plan SUMMARY: badge skip-render при count=0 + 99+ cap, polling 60s c document.hidden pause, markSeen на open dropdown, группировка «Новые / Раньше», footer 2 CTA, ширина 380-400px. |
| REQ-51-08 | /notifications page | ✅ | `apps/web/src/app/(main)/notifications/page.tsx` — useInfiniteQuery 20/page, ?filter=all\|unread, empty states из D-15. |
| REQ-51-09 | /profile/notifications settings | ✅ | `apps/web/src/app/(main)/profile/notifications/page.tsx` — таблица 7 типов × 2 канала (in-app, email). Email Switch disabled+«Скоро». In-app Switch с optimistic update. `/profile/page.tsx` имеет блок «Уведомления» с ссылкой на settings. |
| REQ-51-10 | Anchor scroll к комменту | ✅ | `apps/web/src/app/(main)/learn/[id]/page.tsx` — useEffect читает `window.location.hash` (validated на префикс `comment-`), scrollIntoView smooth + class `notification-highlight` 1500ms + remove. `apps/web/src/components/comments/CommentItem.tsx` — root div получил `id={`comment-${id}`}` + `scroll-mt-20`. CSS `.notification-highlight` в `apps/web/src/styles/globals.css`. Silent fallback при отсутствии target (D-13). |
| REQ-51-11 | Cleanup cron + E2E | ✅ | `apps/web/src/app/api/cron/notifications-cleanup/route.ts` — GET+POST с `Authorization: Bearer ${CRON_SECRET}`, Sentry checkin slug `notifications-cleanup` margin 180, deleteMany старше 90 дней + 500-row per-user cap (raw SQL window function). `.github/workflows/notifications-cleanup.yml` — daily `0 0 * * *` + workflow_dispatch. `apps/web/tests/e2e/notifications.spec.ts` — Playwright spec для reply→bell→read flow. |

## Decisions Honored (CONTEXT.md cross-check)

| Decision | Honored | Notes |
|----------|---------|-------|
| D-01 | ✅ | NotificationItem рендерит icon + title + preview + relative time (per 51-05 SUMMARY) |
| D-02 | ✅ | Bell dropdown группировка «Новые / Раньше» |
| D-03 | ✅ | Unread accent через `bg-mp-blue-50` (per 51-05 SUMMARY) |
| D-04 | ✅ | Width 380-400px max-h 480px scroll внутри + footer (per 51-05 SUMMARY) |
| D-05 | ✅ | refetchInterval с document.hidden pause (DC-02 pattern) |
| D-06 | ✅ | Click trigger Popover (mobile-friendly) |
| D-07 | ✅ | UserProfile.lastNotificationsSeenAt + markSeen procedure (procedure №7 — confirmed) |
| D-08 | ✅ | readAt только при click на item |
| D-09 | ✅ | markAllRead + footer button |
| D-10 | ✅ | 7 procedures total (markSeen добавлен к SPEC's 6) |
| D-11..D-13 | ✅ | Highlight subtle background tint 1.5s через `.notification-highlight` |
| D-14..D-16 | ✅ | «Ты»-tone copy + NOTIFICATION_TYPE_DESCRIPTIONS map с дружелюбными формулировками |
| DC-01..DC-09 | ✅ | Все Claude's discretion items реализованы (анти-self-notify, bulk insert, GitHub Actions cron, z-index 50, badge 99+, fire-and-forget Sentry capture) |

## Test Suite Results

### Phase 51 Tests (NEW — 30/30 passing)

```
✓ src/lib/notifications/__tests__/notify.test.ts (10 tests, 14ms)
✓ src/lib/notifications/__tests__/notify-reply-route.test.ts (6 tests, 15ms)
✓ src/routers/__tests__/notifications.test.ts (14 tests, 43ms)
```

### Pre-existing failing tests (NOT Phase 51 regressions)

3 теста падают в `tests/auth/oauth-provider.test.ts` и `tests/auth/yandex-oauth.test.ts` — Yandex OAuth моки. Сломались 2026-04-14 при добавлении `force_confirm=yes` + IPv4 retry (commits 0e87fda, e5b7648, 15e3e86). **Production code работает** — пользователи логинятся через Яндекс на проде. Tech debt, не блокирует Phase 51.

### Typecheck

```
Tasks: 6 successful, 6 total (db, db#build, shared, ai, api, web)
```

## Human Verification Required

Code-level всё подтверждено, но 5 пунктов требуют ручной проверки человеком перед shipping в прод:

1. **UI smoke staging:** залить на `staging.platform.mpstats.academy`, залогиниться, увидеть NotificationBell справа в header (между Help и UserNav). Открыть dropdown — пустой state (для нового юзера). Создать тестовое уведомление через SQL/admin script — увидеть badge + item в dropdown.

2. **/notifications page:** перейти, проверить infinite list работает, фильтр all|unread меняет URL и список, empty states корректные.

3. **/profile/notifications:** все 7 строк отрендерены, in-app Switch работает с optimistic update, email Switch disabled + «Скоро», изменения сохраняются (refresh — toggle сохранил state).

4. **Anchor scroll:** вручную перейти на `/learn/SOME_LESSON_ID#comment-SOME_COMMENT_ID` (взять реальные ID из БД) — страница должна smooth-проскроллить к комменту, на 1.5с показать accent-фон, fade out. Если comment_id невалидный — silent (без error toast).

5. **GitHub Actions secrets для cron + E2E:**
   - `CRON_SECRET` — для cron auth (вероятно уже есть от check-subscriptions)
   - `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD`, `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD`, `TEST_LESSON_ID` — для E2E. **BLOCKING для shipping** — без них `notifications-cleanup.yml` job упадёт, и E2E spec выкинет ошибку (не skip).

## Gaps

Code-level гэпов не найдено. Human verification — 5 пунктов выше.

## Test Debt Flagged

- 3 Yandex OAuth теста падают по причинам, не связанным с Phase 51. Должны быть починены в отдельной сессии (обновить моки `tests/auth/oauth-provider.test.ts` под новый authorizeUrl с `force_confirm=yes`).

## Verifier Notes

- Auto-verifier (gsd-verifier subagent) был запущен, но завис на 18 минут без вывода (stream idle timeout). Этот VERIFICATION.md написан вручную orchestrator'ом на основе spot-checks через Grep/Read по всем артефактам.
- Все 7 SUMMARY.md существуют в `.planning/phases/51-notification-center-foundation/51-0[1-7]-SUMMARY.md` и соответствуют коду.
- Schema push выполнен один раз в 51-01 (per CRITICAL_NOTES — recurring Phase 28 lesson). Downstream waves использовали только `pnpm db:generate`.
- Worktree-директории `.claude/worktrees/agent-*` могут остаться на диске (Windows path-length при удалении), но git их не видит (`git worktree list` показывает только master + cp-receipts).
