# Phase 51: Notification Center Foundation — Specification

**Created:** 2026-04-29
**Ambiguity score:** 0.16 (gate: ≤ 0.20)
**Requirements:** 11 locked

## Goal

Юзер получает in-app уведомления через bell-иконку в header'е и страницу `/notifications`. Первый живой триггер — ответы на корневые комменты в уроках (`COMMENT_REPLY`). Инфраструктура (Notification + NotificationPreference + service `notify()`) рассчитана на 7 типов и без рефакторинга расширяется фазами 52-54.

## Background

Сейчас юзер узнаёт об ответе на свой коммент только если случайно вернётся на урок и проскроллит до своей ветки. В кодбейзе:

- `LessonComment` (packages/db/prisma/schema.prisma:369) с `parentId` для 1-уровневых replies
- `comments.create` mutation (packages/api/src/routers/comments.ts:94-148) — точка хука для COMMENT_REPLY
- `UserProfile.role` (Role enum: USER/ADMIN/SUPERADMIN) — пригодится для ADMIN_COMMENT_REPLY в Phase 52
- CQ infra: `apps/web/src/lib/carrotquest/{client,emails,types}.ts` с паттерном `setUserProps → trackEvent` и feature flag `email_notifications_enabled`
- Header в `apps/web/src/app/(main)/layout.tsx:72-90`: Logo + HelpCircleButton + UserNav — bell встаёт между HelpCircle и UserNav
- `/profile/page.tsx` — single page без табов/sub-routes (existing structure)
- Comments не имеют anchor IDs (нет deep-link инфраструктуры)
- Модели Notification и NotificationPreference не существуют

Phase 51 — фундамент v1.6 Engagement milestone'а (51-54). Все 7 типов NotificationType определяются в этой фазе, чтобы фазы 52-54 не мигрировали enum.

## Requirements

1. **Schema — Notification model**: Таблица для всех уведомлений со связью на UserProfile.
   - Current: моделей Notification и NotificationPreference в schema.prisma не существует
   - Target: `Notification { id, userId, type NotificationType, payload Json, ctaUrl String?, readAt DateTime?, createdAt DateTime, broadcastId String? }` + индекс `(userId, readAt, createdAt DESC)` для эффективного unread-count и пагинации
   - Acceptance: `pnpm db:push` применяет схему без ошибок; Prisma Studio показывает таблицу с правильными колонками; индекс существует (`\d notification_user_id_read_at_created_at_idx` в psql)

2. **Schema — NotificationPreference model**: Per-user, per-type preferences для in-app/email.
   - Current: модель не существует
   - Target: `NotificationPreference { userId, type NotificationType, inApp Boolean @default(true), email Boolean @default(false), @@id([userId, type]) }`. Default email=false на старте (включается per-type когда CQ-шаблон готов через миграцию). Default inApp=true для всех типов кроме `WEEKLY_DIGEST` (false — opt-in).
   - Acceptance: schema применяется; default values выставлены; composite primary key работает (нельзя создать дубль `(userId, type)`)

3. **Schema — NotificationType enum**: 7 значений, фиксированных на старте.
   - Current: enum не существует
   - Target: `enum NotificationType { COMMENT_REPLY, ADMIN_COMMENT_REPLY, CONTENT_UPDATE, PROGRESS_NUDGE, INACTIVITY_RETURN, WEEKLY_DIGEST, BROADCAST }`
   - Acceptance: enum в schema.prisma содержит ровно 7 значений в этом порядке; Prisma client типы генерируются

4. **Service `notify()`**: Centralized service для создания уведомлений.
   - Current: точки создания уведомлений нет
   - Target: `packages/api/src/services/notifications.ts` экспортирует `notify(userId, type, payload, opts?)` и `notifyMany(userIds, type, buildPayload, opts?)`. Поведение: (a) проверяет NotificationPreference.inApp — если false, не создаёт запись; (b) создаёт Notification row если inApp=true; (c) **всегда** триггерит CQ event `pa_notif_<type_lowercase>` через `setUserProps + trackEvent` (email-доставка решается на стороне CQ-правила). Anti-self-notify: если payload содержит `actorUserId === userId` — skip полностью.
   - Acceptance: unit test покрывает 3 сценария (inApp=true создаёт row + CQ event; inApp=false skip row + CQ event still fires; actorUserId === userId skip полностью)

5. **tRPC notifications router**: 6 procedures для управления уведомлениями.
   - Current: router не существует
   - Target: `packages/api/src/routers/notifications.ts` с `list` (cursor pagination 20/page, фильтр `filter: 'all' | 'unread'`), `unreadCount` (lightweight COUNT по индексу), `markRead` (input commentId, проверка ownership), `markAllRead`, `getPreferences` (возвращает все 7 типов с дефолтами если row отсутствует), `updatePreference` (input type, inApp?, email?). Все procedures `protectedProcedure`.
   - Acceptance: tRPC router зарегистрирован в `appRouter`; permission test — юзер B не может markRead уведомление юзера A (FORBIDDEN); list pagination работает с cursor; unreadCount возвращает корректное число

6. **COMMENT_REPLY trigger**: Hook в `comments.create` срабатывает при reply.
   - Current: `comments.create` (comments.ts:128-138) создаёт LessonComment без сайд-эффектов
   - Target: после успешного `comments.create` если `parentId !== null` → fetch parent comment (userId, lessonId) + lesson title → `notify(parent.userId, 'COMMENT_REPLY', { commentId: created.id, lessonId, lessonTitle, replyAuthorName, preview: content.slice(0, 120), actorUserId: ctx.user.id })`. Anti-self-notify уже в `notify()`.
   - Acceptance: интеграционный тест — юзер A reply'ает на коммент B → в БД появляется Notification для B с type=COMMENT_REPLY и payload с lessonId; юзер B reply'ает на свой коммент → Notification НЕ создаётся

7. **NotificationBell в Header**: Bell icon с badge unread count + dropdown.
   - Current: в Header (layout.tsx:81-88) только HelpCircleButton + UserNav
   - Target: `<NotificationBell />` встаёт между HelpCircleButton и UserNav. Polling `unreadCount` каждые 60с (через tRPC + setInterval, pause при `document.hidden`). Badge показывает `99+` при count > 99. Click → dropdown с 10 последними уведомлениями (ordered by createdAt DESC), кнопка «Все уведомления» внизу → `/notifications`. Каждый item в dropdown — clickable, ведёт на `ctaUrl` + триггерит `markRead`.
   - Acceptance: Playwright тест — после reply (юзер A → коммент B), юзер B видит badge `1` в bell в течение 90с; click на item dropdown'а → переход на ctaUrl + readAt в БД заполнен

8. **/notifications page**: Полная история с пагинацией и фильтрами.
   - Current: страница не существует
   - Target: `apps/web/src/app/(main)/notifications/page.tsx` — список с пагинацией 20/страница (cursor-based), фильтр `все / непрочитанные` (URL param `?filter=unread`), кнопка «Отметить все прочитанными», empty state «У вас нет уведомлений», каждый item показывает иконку типа, заголовок (из payload), preview, relative time, бейдж «Новое» если readAt=null
   - Acceptance: страница рендерится при 0 уведомлений (empty state), 1 уведомлении, 50+ (видна пагинация); markAllRead очищает badge bell-а; фильтр unread показывает только readAt=null

9. **/profile/notifications page**: Toggle preferences per type.
   - Current: /profile — single page без sub-routes
   - Target: `apps/web/src/app/(main)/profile/notifications/page.tsx` — таблица 7 типов × 2 канала (In-app, Email), Switch-ы из shadcn/ui, optimistic update через `updatePreference` mutation. Описание под каждым типом по-русски (например «Ответы на ваши комментарии»). Email-Switch'и видимо disabled с tooltip «Скоро» если CQ-шаблон ещё не готов (определяется через flag в коде, не БД — фаза 52+ снимет disabled per-type). Ссылка на эту страницу из существующего /profile (новый блок «Уведомления» с CTA).
   - Acceptance: открытие страницы создаёт NotificationPreference rows если отсутствуют; toggle Switch сохраняется в БД; reload — состояние сохранилось; ссылка из /profile работает

10. **Anchor scroll к комменту с highlight**: Deep-link через URL hash.
    - Current: CommentItem не имеет id-атрибута, deep-link не работает
    - Target: каждый CommentItem рендерит `<div id={`comment-${comment.id}`} ...>`. На странице `/learn/[id]` при наличии URL hash `#comment-<id>` — после mount auto-scroll (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) + добавляется CSS class `notification-highlight` на 1.5с (pulse animation, accent цвет border). Comment Reply notifications формируют `ctaUrl = /learn/<lessonId>#comment-<commentId>`.
    - Acceptance: переход по `/learn/lessonX#comment-Y` → виден scroll к коммент Y + highlight ~1.5с; если comment не существует — fallback скролл в начало страницы (без error boundary trip)

11. **Cron notifications-cleanup**: Авто-очистка по retention policy.
    - Current: cron не существует
    - Target: `apps/web/src/app/api/cron/notifications-cleanup/route.ts` (Vercel/GitHub Actions cron 03:00 МСК ежедневно), Sentry checkin slug `notifications-cleanup`. Логика: (a) `DELETE FROM Notification WHERE createdAt < NOW() - INTERVAL '90 days'`; (b) для каждого юзера у которого > 500 rows — оставить top 500 по createdAt DESC, удалить остальные. Логирование `cleaned: N rows`.
    - Acceptance: ручной запуск cron на dev DB удаляет старые записи; Sentry получает checkin success; повторный запуск идемпотентен (0 удалений если ничего не подходит)

## Boundaries

**In scope:**
- DB schema: Notification, NotificationPreference, NotificationType enum (все 7 значений)
- Service `notify()` + `notifyMany()` с anti-self-notify и preference-check
- tRPC router `notifications` (list, unreadCount, markRead, markAllRead, getPreferences, updatePreference)
- COMMENT_REPLY trigger в comments.create
- UI: NotificationBell в Header, `/notifications`, `/profile/notifications`, ссылка на neighbours из /profile
- Anchor scroll + highlight на /learn/[id] для deep-link
- Cron notifications-cleanup (90 дней + 500/user cap)
- CQ event `pa_notif_comment_reply` (стреляет всегда; CQ-правило/шаблон — параллельная задача CQ-команды)
- Default preferences (email=false везде, inApp=true кроме WEEKLY_DIGEST)
- Unit tests на сервис + router permissions; E2E test на reply→bell→click→read flow

**Out of scope:**
- ADMIN_COMMENT_REPLY trigger — Phase 52 (требует доп. логику role detection + accent-стилизацию)
- CONTENT_UPDATE триггер и админ-чекбокс «уведомить» — Phase 52
- Retention crons (PROGRESS_NUDGE, INACTIVITY_RETURN, WEEKLY_DIGEST) — Phase 53 (с priority-resolver)
- BROADCAST UI и Broadcast model для метрик — Phase 54
- WebSocket / Server-Sent Events — polling 60с достаточно при текущем масштабе
- Push-уведомления браузера / Telegram — не делаем
- CQ email-шаблоны — параллельная задача CQ-команды/Милы (вне кодбейза)
- Per-broadcast метрики / трекинг кликов — Phase 54
- Refactor /profile в табы — отложено до Phase 53 когда появится 3-я секция
- Notification grouping logic — Phase 52 (для CONTENT_UPDATE)

## Constraints

- **Polling load**: `unreadCount` endpoint ДОЛЖЕН быть lightweight (одна COUNT-query через индекс `(userId, readAt, createdAt)`) — выдерживает текущий масштаб ~500-1000 active users без специальной оптимизации
- **Polling pause**: NotificationBell ДОЛЖЕН останавливать setInterval при `document.hidden` (Page Visibility API), возобновлять при возврате видимости — экономия запросов
- **Schema migration order**: миграция применяется ПЕРЕД rebuild docker (recurring Phase 28 lesson, см. `feedback_schema_migration_order.md`)
- **Email default = false**: ВСЕ NotificationPreference rows стартуют с `email=false`. Включение per-type — отдельная миграция через сервисный SQL-скрипт когда CQ-команда подтверждает готовность шаблона
- **CQ event firing always**: `notify()` стреляет `pa_notif_*` event даже если inApp=false и даже если email=false — CQ-правило само принимает решение о доставке. Это даёт админу контроль через CQ dashboard без редеплоя
- **Bell z-index**: dropdown DOLZHEN иметь z-index > 40 (header sticky-z40 в layout.tsx:72) и < z-index for AlertDialog/Modal — typically 50

## Acceptance Criteria

- [ ] Schema applied: `Notification`, `NotificationPreference`, `NotificationType` существуют в БД prod-Supabase с правильными индексами
- [ ] `services/notifications.ts` экспортирует `notify` и `notifyMany`; unit tests проходят (3+ сценария включая anti-self-notify)
- [ ] tRPC router `notifications` зарегистрирован в `appRouter`; permission tests проходят (юзер не может markRead чужие уведомления)
- [ ] Юзер A reply на коммент B → в БД появляется Notification для B с type=COMMENT_REPLY и корректным payload
- [ ] Юзер B видит badge `1` в bell-иконке в течение ≤90 секунд после reply (polling 60s + render)
- [ ] Click на dropdown item → переход на `/learn/<lessonId>#comment-<commentId>` + readAt ставится в БД
- [ ] Anchor scroll работает: переход по deep-link смотрит scroll к коммент + 1.5с highlight pulse
- [ ] `/notifications` page рендерится корректно при 0/1/50+ записях; пагинация работает; markAllRead очищает badge
- [ ] `/profile/notifications` показывает таблицу всех 7 типов; toggle сохраняется в БД; persist через reload
- [ ] Юзер B НЕ получает уведомление если ответил сам на свой коммент
- [ ] Юзер B НЕ создаётся Notification row если `NotificationPreference.inApp=false` для COMMENT_REPLY (но CQ event всё равно стреляет)
- [ ] CQ event `pa_notif_comment_reply` fires на каждый reply; видно в CQ dashboard (verification вне кодбейза)
- [ ] Email НЕ отправляется на этой фазе (CQ-правило для `pa_notif_*` ещё не настроено — это намеренно)
- [ ] Cron `notifications-cleanup` выполняется ежедневно 03:00 МСК; Sentry checkin success; ручной dry-run на dev DB удаляет старые записи корректно
- [ ] Polling в bell останавливается при `document.hidden`, возобновляется при возврате видимости (DevTools Network tab проверка)
- [ ] Playwright E2E: reply flow end-to-end (login B → A reply → 90s wait → B sees badge → click → markRead → badge gone)
- [ ] Typecheck (`pnpm typecheck`) и lint (`pnpm lint`) проходят без новых ошибок

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                       |
|--------------------|-------|------|--------|-------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Конкретный outcome COMMENT_REPLY end-to-end                 |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit out-of-scope, фазы 52-54 для расширений            |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Polling, retention, schema order, email-default зафиксированы |
| Acceptance Criteria| 0.75  | 0.70 | ✓      | 16 pass/fail criteria включая E2E                           |
| **Ambiguity**      | 0.16  | ≤0.20| ✓      |                                                             |

## Interview Log

| Round | Perspective    | Question summary                          | Decision locked                                              |
|-------|----------------|-------------------------------------------|--------------------------------------------------------------|
| 0     | Researcher     | Codebase scout (no question)              | LessonComment hook ready, CQ infra exists, header position clear |
| 1     | Boundary Keeper| Retention policy для Notification table?  | Auto-delete 90d + hard cap 500/user, daily cron 03:00 МСК (Claude pick — user delegated) |
| 1     | Simplifier     | /profile/notifications structure?         | Sub-route сейчас, refactor в табы в Phase 53 (Claude pick) |
| 1     | Researcher     | Deep-link strategy для COMMENT_REPLY?     | Anchor + auto-scroll + 1.5s highlight pulse (Claude pick — user said «лучшая для понимания опция») |

---

*Phase: 51-notification-center-foundation*
*Spec created: 2026-04-29*
*Next step: /gsd-discuss-phase 51 — implementation decisions (как реализовать каждое требование)*
