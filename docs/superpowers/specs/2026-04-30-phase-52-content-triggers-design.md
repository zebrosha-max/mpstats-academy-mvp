# Phase 52 — Content Triggers · Design Spec

**Date:** 2026-04-30
**Status:** Approved (pending user spec review)
**Predecessor:** Phase 51 (Notification Center Foundation, shipped 2026-04-30)
**Workflow:** Superpowers (brainstorming → writing-plans → executing-plans), GSD bypassed for token economy.

## Goal

Расширить Notification Center контентными триггерами:
1. **ADMIN_COMMENT_REPLY** — ответы методологов на комментарии пользователей с усиленным визуальным акцентом.
2. **CONTENT_UPDATE** — опциональные уведомления о новом контенте (уроки и материалы) с rolling-группировкой 24h и таргетингом по фактическому прогрессу в курсе.

## Foundation (заложено Phase 51)

БД-миграции в этой фазе **НЕ требуются**:

- `enum NotificationType` уже включает `ADMIN_COMMENT_REPLY` и `CONTENT_UPDATE` (schema.prisma 460-468).
- `Notification.payload Json` универсален.
- `NotificationPreference (userId, type)` управляет inApp/email per-type — юзер может выключить любой kind в `/profile/notifications`.
- `NotificationItem.tsx` уже маппит ADMIN_COMMENT_REPLY на эмодзи `👨‍🏫` (placeholder, accent добавится в этой фазе).

## Scope

### In scope

- Триггер ADMIN_COMMENT_REPLY в `comments.create` (supersede COMMENT_REPLY).
- Bulk-targeting service для CONTENT_UPDATE (по `LessonProgress` + активной подписке).
- Rolling 24h grouping для CONTENT_UPDATE (per user × course).
- Чекбокс «Уведомить подписчиков курса» в админке: на toggle `Lesson.isHidden=false` и в `material.attach` mutation.
- Visual accent для ADMIN_COMMENT_REPLY (border-left + цветная иконка).
- Yandex Metrika events для кликов по новым типам.
- Раздел в `docs/admin-guides/lesson-materials.md` про анонс контента.

### Out of scope

- Email-канал для CONTENT_UPDATE (только in-app, email спам).
- Холодный таргетинг (юзеры без прогресса в курсе).
- Авто-уведомления при seed-скриптах (только ручная галка админа).
- Группировка ADMIN_COMMENT_REPLY (каждый ответ — отдельная запись).
- Custom приоритизация ADMIN_COMMENT_REPLY в сортировке (visual accent делает работу, порядок остаётся `createdAt DESC`).

## Decisions (locked)

### D1. Таргетинг CONTENT_UPDATE — гибрид

Юзер получает уведомление, если **обе** условия выполнены:

1. Активная подписка с `periodEnd > now()` (включает COURSE и PLATFORM).
2. ≥1 урок в курсе со статусом `COMPLETED` ИЛИ (`IN_PROGRESS` AND `watchedPercent >= 50`).

**SQL:**
```sql
SELECT DISTINCT lp."userId"
FROM "LearningPath" lp
JOIN "LessonProgress" prog ON prog."pathId" = lp.id
JOIN "Lesson" l ON prog."lessonId" = l.id
JOIN "Subscription" s ON s."userId" = lp."userId"
WHERE l."courseId" = $1
  AND s.status = 'active'
  AND s."periodEnd" > now()
  AND (
    prog.status = 'COMPLETED'
    OR (prog.status = 'IN_PROGRESS' AND prog."watchedPercent" >= 50)
  )
```

### D2. ADMIN_COMMENT_REPLY — flat threads, supersede

- Комменты flat (root + плоский список replies, не вложенные деревья).
- Триггер: любой `reply` (parentId != null) от автора с `role IN (ADMIN, SUPERADMIN)` → notify root comment author.
- **Исключение:** не шлём, если `reply.userId === parent.userId` (админ отвечает сам себе).
- **Не проверяем роль root author** — даже если корневой коммент написал другой админ, шлём.
- **Supersede:** при срабатывании ADMIN_COMMENT_REPLY обычный COMMENT_REPLY НЕ создаётся (один объект, не дубль).

### D3. CONTENT_UPDATE kind — единый для уроков и материалов

Один `NotificationType.CONTENT_UPDATE`. Payload содержит массив `items` с разнотипным контентом:

```ts
type ContentUpdatePayload = {
  courseId: string
  courseTitle: string
  items: Array<
    | { type: 'lesson'; id: string; title: string }
    | { type: 'material'; id: string; lessonId: string; lessonTitle: string; title: string }
  >
}
```

Title в UI рассчитывается динамически по составу `items` (см. §4.3).

### D4. Rolling 24h grouping window

При создании нового CONTENT_UPDATE:
1. Найти последний unread CONTENT_UPDATE для `(userId, courseId)` с `createdAt > now() - 24h`.
2. Если есть — append к `payload.items` (с дедупом по `(type, id)`), `updatedAt = now()`. Окно скользит дальше от каждого апдейта.
3. Если нет (или последний read) — INSERT новый.

Прочтение естественно сбрасывает окно — следующая публикация создаст новое уведомление.

### D5. ctaUrl resolver

| Содержимое payload.items | Цель |
|---|---|
| 1 элемент, type=lesson | `/learn/lesson/{lessonId}` |
| 1 элемент, type=material | `/learn/lesson/{lessonId}` (jump к уроку-носителю; `#materials` если у урока есть якорь) |
| ≥2 элемента | `/learn/course/{courseSlug}` (точный роут уточнить при имплементации; fallback `/learn` если course-page нет) |

### D6. Visual treatment ADMIN_COMMENT_REPLY

В `apps/web/src/components/notifications/NotificationItem.tsx`:

```tsx
<div className={cn(
  baseClasses,
  isUnread && 'bg-mp-blue-50',
  kind === 'ADMIN_COMMENT_REPLY' && 'border-l-4 border-mp-blue-500 pl-3'
)}>
  <div className={cn(
    'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base',
    kind === 'ADMIN_COMMENT_REPLY' ? 'bg-mp-blue-100 text-mp-blue-700' : 'bg-mp-gray-100'
  )}>
    {emoji[kind]}
  </div>
  ...
</div>
```

Эмодзи остаётся `👨‍🏫` (методолог-учитель, точнее по семантике, чем 🎓 = «выпускник»).

## Architecture

### File layout

```
packages/api/src/services/notifications/
├── triggers/
│   ├── admin-comment-reply.ts        # NEW: detect admin reply → fire notification
│   └── content-update.ts             # NEW: bulk fire + grouping
├── targeting.ts                      # NEW: findUsersForCourseUpdate(courseId)
└── grouping.ts                       # NEW: rolling 24h merge logic

packages/api/src/routers/
├── comments.ts                       # MODIFY: hook trigger after create
├── material.ts                       # MODIFY: attach accepts notify flag
└── admin.ts                          # MODIFY: lesson.toggleHidden accepts notify flag

apps/web/src/components/notifications/
└── NotificationItem.tsx              # MODIFY: accent for ADMIN_COMMENT_REPLY

apps/web/src/app/(admin)/admin/content/
├── lessons/page.tsx                  # MODIFY: notify checkbox in unhide UI
└── materials/page.tsx                # MODIFY: notify checkbox in attach form

docs/admin-guides/
└── lesson-materials.md               # MODIFY: add "Анонс нового контента" section
```

### Data flow — ADMIN_COMMENT_REPLY

```
comments.create mutation
  ↓ insert LessonComment
  ↓ if (parentId)
  ↓   parent = SELECT comment + author.role
  ↓   reply.author.role from ctx.session
  ↓   if (reply.role ∈ {ADMIN,SUPERADMIN} && parent.userId !== reply.userId)
  ↓     fireAdminCommentReply(parent.userId, payload)
  ↓   else if (parent.userId !== reply.userId)
  ↓     fireCommentReply(parent.userId, payload)  // existing Phase 51
```

### Data flow — CONTENT_UPDATE

```
admin.lesson.toggleHidden { lessonId, isHidden: false, notify: true }
  ↓ update Lesson.isHidden = false
  ↓ if (notify)
  ↓   item = { type:'lesson', id, title }
  ↓   targets = findUsersForCourseUpdate(lesson.courseId)
  ↓   for each userId in targets:
  ↓     mergeOrCreateContentUpdate(userId, courseId, [item])

material.attach { lessonId, materialId, notify: true }
  ↓ insert LessonMaterial
  ↓ if (notify)
  ↓   item = { type:'material', id:materialId, lessonId, lessonTitle, title }
  ↓   targets = findUsersForCourseUpdate(lesson.courseId)
  ↓   for each userId in targets:
  ↓     mergeOrCreateContentUpdate(userId, courseId, [item])
```

### `mergeOrCreateContentUpdate` (pseudocode)

```ts
async function mergeOrCreateContentUpdate(
  userId: string,
  courseId: string,
  newItems: ContentUpdateItem[]
) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'CONTENT_UPDATE',
      readAt: null,
      createdAt: { gt: subHours(new Date(), 24) },
      // payload->>'courseId' filter — Prisma raw or post-filter
    },
    orderBy: { createdAt: 'desc' },
  })
  // refine to courseId match (Prisma JSON filter)

  if (existing) {
    const merged = dedupItems([...existing.payload.items, ...newItems])
    const ctaUrl = resolveCta(courseId, merged)
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        payload: { ...existing.payload, items: merged },
        ctaUrl,
        // updatedAt automatic if column exists; otherwise no-op
      },
    })
  } else {
    const course = await prisma.course.findUnique({ where: { id: courseId } })
    const payload = {
      courseId,
      courseTitle: course.title,
      items: newItems,
    }
    await prisma.notification.create({
      data: {
        userId,
        type: 'CONTENT_UPDATE',
        payload,
        ctaUrl: resolveCta(courseId, newItems),
      },
    })
  }
}

function dedupItems(items) {
  const seen = new Set()
  return items.filter((it) => {
    const key = `${it.type}:${it.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

**Note:** `Notification` модель Phase 51 не имеет `updatedAt`. Проверить при имплементации — если нет, либо добавить (легкая миграция), либо использовать `createdAt` как «last touched» (rolling window от `createdAt` остаётся корректным семантически).

### Title rendering

Helper `notificationTitle(notification)`:

```ts
function contentUpdateTitle(payload: ContentUpdatePayload): string {
  const lessons = payload.items.filter(i => i.type === 'lesson')
  const materials = payload.items.filter(i => i.type === 'material')
  const total = payload.items.length

  if (total === 1) {
    const item = payload.items[0]
    if (item.type === 'lesson') return `Новый урок: «${item.title}»`
    return `Новый материал к уроку «${item.lessonTitle}»`
  }
  // multiple items
  const parts: string[] = []
  if (lessons.length) parts.push(plural(lessons.length, ['урок', 'урока', 'уроков']))
  if (materials.length) parts.push(plural(materials.length, ['материал', 'материала', 'материалов']))
  return `Добавлено ${parts.join(' и ')} в курсе «${payload.courseTitle}»`
}
```

## Admin UX

### Lesson unhide

`/admin/content/lessons` — таблица уроков с действием «Скрыть/Показать». При unhide (isHidden true → false) появляется модалка/inline-форма с чекбоксом:

> ☐ Уведомить подписчиков курса (≈X пользователей с прогрессом)
> _Уведомление получат юзеры с активной подпиской и прогрессом в курсе._

Counter `X` опционально (запрос count во время рендера). Default — выключен.

### Material attach

`/admin/content/materials` — при attach материала к уроку (drag-n-drop или Combobox) форма имеет тот же чекбокс с тем же default-off.

### Скрипты seed (out of scope для триггера)

Skill-batch ingest и `seed-skill-lessons.ts` создают/обновляют уроки **без** прохода через UI. Если методолог хочет анонсировать batch — рекомендованный workflow:

1. Запустить seed скрипт с временным `isHidden = true` (override env или флаг скрипта).
2. В админке `/admin/content/lessons` отфильтровать новые скрытые уроки.
3. Bulk unhide с галкой «Уведомить» (или поштучно).

Документировать в `docs/admin-guides/lesson-materials.md` секцией «Анонс нового контента».

## Yandex Metrika events

В `notifications.markAsRead` mutation после успеха:

| Kind | Event | Params |
|---|---|---|
| ADMIN_COMMENT_REPLY | `NOTIF_ADMIN_REPLY_OPEN` | `{ commentId }` |
| CONTENT_UPDATE | `NOTIF_CONTENT_UPDATE_OPEN` | `{ courseId, itemsCount }` |

(COMMENT_REPLY event уже отправляется Phase 51, не трогаем.)

## NotificationPreference defaults

При первой инициализации профиля (или для существующих юзеров через миграционный скрипт):

| Type | inApp | email |
|---|---|---|
| ADMIN_COMMENT_REPLY | true | false |
| CONTENT_UPDATE | true | false |

Существующие предпочтения юзеров не перезаписываем.

## Tests

### Unit (Vitest)

**`admin-comment-reply.spec.ts`** (6 cases):

1. ADMIN replies to USER root comment → fires ADMIN_COMMENT_REPLY, no COMMENT_REPLY.
2. SUPERADMIN replies to USER → same as #1.
3. ADMIN replies to ADMIN root comment (different admins) → fires ADMIN_COMMENT_REPLY.
4. ADMIN replies to own comment (same userId) → no notification.
5. USER replies to USER → fires regular COMMENT_REPLY (existing path), no ADMIN.
6. Comment without parentId (root) → no-op.

**`content-update-grouping.spec.ts`** (5 cases):

1. No prior notification → INSERT new.
2. Existing unread within 24h, same course → UPDATE payload, append items.
3. Existing read within 24h → INSERT new (don't touch read one).
4. Existing unread but `createdAt > 24h ago` → INSERT new.
5. Same lesson published twice → dedup, items.length === 1.

**`targeting.spec.ts`** (4 cases):

1. User with COMPLETED lesson in course + active sub → included.
2. User with IN_PROGRESS, watchedPercent=60 → included.
3. User with IN_PROGRESS, watchedPercent=30 → excluded.
4. User with COMPLETED but expired subscription → excluded.

### E2E (Playwright)

`tests/e2e/phase-52-content-update.spec.ts` (1 happy-path):

1. Login as admin in setup.
2. Toggle hidden → false on a lesson with `notify: true` checkbox.
3. Login as test user with prior progress in same course.
4. Open bell → assert notification visible with expected title.
5. Click → assert lands on `/learn/lesson/{id}`.

## Risks

### R1. Skill-batch обходит триггер

**Severity:** medium
Когда seed-скрипт публикует 16 уроков сразу (`isHidden=false` по умолчанию), уведомления не уходят. Workaround: документация в admin-guides + `--hidden-by-default` флаг в seed-скрипте (опционально, post-MVP).

### R2. Performance bulk targeting

**Severity:** low (текущая база), high (масштабирование)
Запрос на курсе с тысячами активных юзеров может быть медленным. На текущей базе (~300 платных) <100ms. Метрика: Sentry custom span на `findUsersForCourseUpdate`. Если p95 > 500ms — переносим в очередь.

### R3. JSON-фильтр по courseId в Prisma

**Severity:** low
Prisma JSON path queries в Postgres работают, но синтаксис громоздкий. Альтернатива — добавить колонку `Notification.courseId String?` (легкая миграция, indexable). Решить на этапе implementation.

### R4. NotificationPreference не блокирует CONTENT_UPDATE

Если юзер выключил inApp для CONTENT_UPDATE — уведомление не должно создаваться. Trigger проверяет preference перед INSERT. Учтено в `mergeOrCreateContentUpdate`.

## Success criteria

1. Методолог отвечает на коммент юзера → юзер видит уведомление с border-left синего цвета и иконкой 👨‍🏫 на синем фоне.
2. Админ публикует урок с галкой → юзеры с прогрессом в курсе получают CONTENT_UPDATE через ≤30s после действия.
3. Админ публикует 5 уроков за час с галкой (для одного и того же юзера) → юзер видит **одно** уведомление «Добавлено 5 уроков в "Аналитика"» с merged items.
4. Юзер БЕЗ прогресса в курсе НЕ получает CONTENT_UPDATE.
5. Если юзер прочитал предыдущий CONTENT_UPDATE — следующая публикация создаёт новую запись (не апдейтит прочитанную).
6. ADMIN_COMMENT_REPLY и CONTENT_UPDATE кликабельны и ведут на правильные URL.
7. Юзер с `inApp=false` для CONTENT_UPDATE НЕ получает запись в БД.

## Open questions for implementation

- **Course slug routing:** есть ли `/learn/course/{slug}` или только `/learn` хаб? Уточнить при имплементации, fallback на `/learn`.
- **Notification.updatedAt:** добавить колонку или использовать `createdAt`? Решить при первой задаче.
- **Notification.courseId:** добавить indexable колонку для быстрого фильтра, или JSON path? Решить при имплементации.

---

**Next step:** invoke `superpowers:writing-plans` to break this design into atomic implementation tasks.
