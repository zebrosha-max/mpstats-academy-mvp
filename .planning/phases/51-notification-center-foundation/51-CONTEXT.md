# Phase 51: Notification Center Foundation - Context

**Gathered:** 2026-04-30
**Status:** Ready for research/planning
**SPEC.md loaded:** ✓ 11 requirements pre-locked (`51-SPEC.md`)

<domain>
## Phase Boundary

Notification Center фундамент: in-app уведомления с bell-иконкой, /notifications page, /profile/notifications для preferences, COMMENT_REPLY как первый живой триггер, схема под все 7 типов NotificationType готова к расширению фазами 52-54.

Discussion clarifies HOW to implement каждое требование SPEC. Что делаем — locked. Как — captured ниже.

</domain>

<decisions>
## Implementation Decisions

### Bell Dropdown UX
- **D-01:** **2-line items с preview** — каждое уведомление показывает иконку типа + заголовок (`<author> ответил`) + preview текста (slice 80-100 символов) + relative time
- **D-02:** **Группировка «Новые / Раньше»** — два сегмента с заголовком-разделителем; «Новые» = непрочитанные сверху, «Раньше» = прочитанные за 7 дней
- **D-03:** **Unread accent через background** — `bg-mp-blue-50` (легкий accent) для unread items, белый для read; не использовать точку-индикатор (избыточно с фоном)
- **D-04:** **Ширина dropdown 380-400px**, max-height 480px со скроллом внутри; footer с `Все уведомления →` + `Отметить все прочитанными`
- **D-05:** **Polling 60с через tRPC `refetchInterval`** + `Page Visibility API` (pause при `document.hidden`); endpoint `unreadCount` lightweight (одна COUNT-query)
- **D-06:** Click trigger (не hover) — mobile-friendly; используем существующий `<Popover>` из `apps/web/src/components/ui/popover.tsx`

### Mark-as-read поведение (гибрид)
- **D-07:** **«Видел»** — counter в badge обнуляется при открытии dropdown через отдельный механизм: `UserProfile.lastNotificationsSeenAt DateTime?` (мини-расширение схемы из SPEC); badge query: `count(WHERE userId=X AND readAt IS NULL AND createdAt > lastNotificationsSeenAt)`. Открытие dropdown триггерит mutation `markSeen` → `lastNotificationsSeenAt = NOW()`
- **D-08:** **«Прочитал»** — `readAt` ставится только при click на конкретный item; в dropdown unread accent (D-03) сохраняется до явного клика — юзер видит «знаю что было новое, не читал»
- **D-09:** **«Отметить все прочитанными»** — кнопка в footer dropdown'а + на странице /notifications; mutation `markAllRead` ставит `readAt = NOW()` всем непрочитанным юзера
- **D-10:** В SPEC требование 5 расширяется новой procedure: `markSeen()` (no-input, ставит lastNotificationsSeenAt) — итого 7 procedures в notifications router

### Anchor Highlight (deep-link к комменту)
- **D-11:** **Subtle background tint + 1.5s fade** — Tailwind `transition-colors duration-1000`, accent `bg-mp-yellow-50` или `bg-mp-blue-50` (выбрать тот что не конфликтует с unread-фоном D-03; вероятно blue-50). Никаких pulse-keyframes
- **D-12:** Триггер highlight на mount страницы `/learn/[id]` через `useEffect` reading `window.location.hash`; добавляет class `notification-highlight` на target div, через 1500ms убирает; сам класс через CSS-переменную или Tailwind `@apply` в globals.css
- **D-13:** Fallback при отсутствии target comment (deleted/hidden) — silent no-scroll, без error-toast

### Тон копии
- **D-14:** **«Ты» + дружелюбный** во всех местах: уведомления, dropdown empty state, /notifications empty state, /profile/notifications описания типов
- **D-15:** Шаблоны:
  - Dropdown empty: «Пока тихо. Здесь появятся ответы на твои комментарии и важные обновления.»
  - /notifications empty (filter=all): «У тебя пока нет уведомлений.»
  - /notifications empty (filter=unread): «Все уведомления прочитаны. 🎉»
  - /profile/notifications header: «Настрой, как хочешь получать уведомления.»
  - COMMENT_REPLY title в payload: `${replyAuthorName} ответил на твой комментарий`
  - COMMENT_REPLY description: первые ~80 символов текста ответа
- **D-16:** Описания типов в /profile/notifications:
  - COMMENT_REPLY: «Ответы на твои комментарии в уроках»
  - ADMIN_COMMENT_REPLY: «Ответы методологов на твои вопросы»
  - CONTENT_UPDATE: «Новые уроки и материалы в твоих курсах»
  - PROGRESS_NUDGE: «Напоминания о незавершённых уроках»
  - INACTIVITY_RETURN: «Если давно не заходил — расскажем что нового»
  - WEEKLY_DIGEST: «Дайджест по пятницам — новинки и активность»
  - BROADCAST: «Анонсы курсов и важные новости платформы»

### Claude's Discretion (technical, не требует input от user)
- **DC-01:** Payload schema — TypeScript discriminated union per NotificationType в `packages/shared/src/notifications.ts`: `{ type: 'COMMENT_REPLY', commentId, lessonId, lessonTitle, replyAuthorName, preview } | { type: 'CONTENT_UPDATE', courseId, ... } | ...`. Prisma `Json` тип; runtime validation через Zod schemas
- **DC-02:** Polling implementation — tRPC `useQuery` с `refetchInterval: (data) => document.hidden ? false : 60000` (react-query поддерживает функцию)
- **DC-03:** Cron infra — GitHub Actions schedule (как существующий daily-cron, см. `.github/workflows/`). Sentry checkin slug `notifications-cleanup`. Не Vercel Cron (не используется в проекте)
- **DC-04:** Highlight CSS — добавить keyframe или просто `@apply transition-colors duration-1000` через class `notification-highlight` в `globals.css`
- **DC-05:** Test stack — Vitest unit для `services/notifications.ts`, `notifications` router; Playwright E2E для reply→bell→click flow (соответствует существующему 24+31 testset)
- **DC-06:** dropdown z-index = 50 (выше header sticky-z40, ниже AlertDialog/Modal)
- **DC-07:** Bell badge — `99+` при count > 99, hidden при 0; pill-shape через `rounded-full`, accent цвет `bg-mp-red-500`
- **DC-08:** Anti-self-notify в `notify()` — проверка `payload.actorUserId !== userId`; если совпадает, return без создания row и без CQ event
- **DC-09:** В `notifyMany()` — bulk insert через `prisma.notification.createMany` для производительности; CQ events стреляем последовательно с rate-limit aware (CQ принимает по нашему опыту 50 events/sec)

</decisions>

<specifics>
## Specific Ideas

- Reference style: Linear/GitHub bell dropdown (двух-сегментная группировка «Новые / Раньше», 2-line items с preview, footer с actions)
- Highlight effect inspiration: GitHub deep-link to comments — subtle yellow flash that fades
- Tone reference: V8 marketing pages используют «ты» в hero/CTA («Пройди диагностику»); продолжаем тот же голос внутри платформы для consistency
- Дизайн-токены — использовать существующие `mp-blue-*`, `mp-gray-*`, `mp-red-*` из tailwind.config (см. .planning/codebase/CONVENTIONS.md)

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before research/planning.**

### Phase 51 spec
- `.planning/phases/51-notification-center-foundation/51-SPEC.md` — 11 locked requirements (schema × 3, service notify, tRPC router, COMMENT_REPLY trigger, NotificationBell, /notifications, /profile/notifications, anchor scroll с highlight, cleanup cron); 16 acceptance criteria

### V1.6 milestone (related phases для понимания границ)
- `.planning/ROADMAP.md` §«v1.6 Engagement (Phases 51-54)» — milestone goals, scope of phases 52-54 для понимания out-of-scope этой фазы

### CQ integration (Phase 33 pattern — reused)
- `apps/web/src/lib/carrotquest/client.ts` — CarrotQuestClient API (setUserProps + trackEvent)
- `apps/web/src/lib/carrotquest/emails.ts` — pattern for triggering pa_* events (lines 64-90: sendPaymentSuccessEmail как reference)
- `apps/web/src/lib/carrotquest/types.ts` — CQEventName union (нужно расширить 7 новыми `pa_notif_*`)
- `.claude/memory/cq-integration.md` — gotchas: form-encoded НЕ JSON, pa_ prefix, properties on lead через setUserProps НЕ в trackEvent params

### Codebase maps (read before planning)
- `.planning/codebase/CONVENTIONS.md` — naming, formatting, error handling patterns
- `.planning/codebase/STRUCTURE.md` — monorepo layout (packages/api, apps/web), path aliases
- `.planning/codebase/STACK.md` — tRPC, Prisma, Next.js 14 App Router, Tailwind v4
- `.planning/codebase/TESTING.md` — Vitest + Playwright стек

### Schema migration recurring lesson
- `.claude/memory/feedback_schema_migration_order.md` — schema migration ПЕРЕД rebuild docker; near-miss на /pricing showing PLATFORM@10₽

### Existing comments hook point
- `packages/api/src/routers/comments.ts:94-148` — `comments.create` mutation, точка хука для COMMENT_REPLY
- `apps/web/src/components/comments/CommentItem.tsx` — куда добавляем `id={`comment-${id}`}` для anchor (req 10)

### Header integration point
- `apps/web/src/app/(main)/layout.tsx:72-90` — header structure, bell встаёт между HelpCircleButton (line 82) и UserNav (lines 83-87)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`@/components/ui/popover.tsx`** — shadcn/ui Popover из radix; используем для NotificationBell dropdown (трap-focus, escape, aria уже корректно настроены)
- **`@/components/ui/switch.tsx`** — для toggle preferences в /profile/notifications
- **`@/components/ui/button.tsx`** — для «Все уведомления» / «Отметить все прочитанными» CTAs
- **`@/lib/carrotquest/client.ts`** — `cq` singleton с `setUserProps()` + `trackEvent()` уже работает в проде (Phase 33)
- **`@/lib/carrotquest/emails.ts`** — pattern с `isEmailEnabled()` cache (60s TTL) для feature flag — переиспользуем, но НЕ блокируем CQ event (event стреляет всегда, email-доставка решается CQ-правилом)
- **`@/lib/trpc/client.ts`** — клиент с react-query под капотом, поддерживает `refetchInterval`
- **`@/components/shared/sidebar.tsx`**, **`@/components/shared/user-nav.tsx`** — паттерны для header-style компонентов
- **`@/lib/utils.ts`** — `cn()` для classname merging
- **`packages/api/src/utils/db-errors.ts`** — `handleDatabaseError` pattern (см. comments.ts:13)
- **GitHub Actions schedule** в `.github/workflows/` — паттерн для cron'ов (Sentry checkin см. `apps/web/src/app/api/cron/check-subscriptions/route.ts`)

### Established Patterns
- **tRPC router structure** — каждый router в `packages/api/src/routers/`, экспорт в `packages/api/src/index.ts` через `appRouter`
- **`protectedProcedure`** — auto-injects `ctx.user`, throws UNAUTHORIZED если auth missing
- **`handleDatabaseError`** в catch для Prisma errors (паттерн из comments.ts, materials.ts)
- **`'use client'`** на UI components с интерактивностью; layout.tsx — server component
- **CQ pattern (Phase 33):** `setUserProps(userId, { pa_*: ... })` затем `trackEvent(userId, 'pa_event_name')`. Свойства живут на лиде, не в event params
- **Sentry checkins для cron** — pattern `Sentry.captureCheckIn({ monitorSlug, status })` (см. cron/check-subscriptions)
- **Email feature flag** через `featureFlag` table — global on/off; per-type включение через NotificationPreference

### Integration Points
- **Header (line 72-90)** — `<NotificationBell />` встаёт ПЕРЕД `<HelpCircleButton />` чтобы порядок был: Bell | Help | UserNav (стандарт UX)
- **`comments.create`** — после успешного create, если `parentId !== null` → fetch parent + lesson title → `notify(...)`. Хорошо бы вынести в `services/notifications.ts:notifyCommentReply()` чтобы comments router был чистым
- **`appRouter`** — добавить `notifications: notificationsRouter`
- **`/profile`** — добавить блок «Уведомления» с CTA «Настроить» → /profile/notifications

### Конфликты / риски в коде
- В `comments.create` сейчас финальный return уже включает sanitized user — сайд-эффект `notify()` ставим ПОСЛЕ db.create но ДО return; ошибка в notify не должна ронять comment creation (try/catch + Sentry, fire-and-forget паттерн)
- В Header сейчас sticky `z-40` — dropdown z=50 не конфликтует с AlertDialog/Modal (typically 50+), но проверить на staging visually
- `lessonComments` relation на UserProfile уже есть — можно использовать для подсчёта в админ-метриках в будущем (не в этой фазе)

</code_context>

<deferred>
## Deferred Ideas

- **ADMIN_COMMENT_REPLY триггер с accent визуалом** — Phase 52 (требует role detection + отдельная иконка/цвет)
- **CONTENT_UPDATE с админ-чекбоксом «уведомить» + автогруппировка** — Phase 52
- **Group similar notifications в dropdown** (e.g., 3 reply'я в одной ветке → 1 collapsible item) — Phase 52 если потребуется
- **Real-time через WebSocket / SSE** — отложено; polling 60с покрывает текущий масштаб
- **Push browser / Telegram уведомления** — out of scope, юзер подтвердил
- **Мобильное приложение** — нет нативного app, только PWA через web; bell работает в той же inset-area что и хедер
- **Refactor /profile в табы** — отложено до Phase 53 когда появится 3-я секция (preferences для retention)
- **Метрики уведомлений (delivery rate, open rate, CTR)** — Phase 54 (для broadcast); per-notification metrics не нужны в Phase 51

</deferred>

---

*Phase: 51-notification-center-foundation*
*Context gathered: 2026-04-30*
*Next step: /gsd-plan-phase 51 — researcher reads SPEC + CONTEXT, planner создаёт atomic plans*
