# Phase 35: Lesson Comments - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Блок комментариев под каждым уроком с аватарами и именами пользователей. Поддержка ответов (1 уровень вложенности), кнопка "Ответить", удаление своих комментариев (+ admin). На десктопе — в правой колонке под AI-чатом, на мобилке — отдельная секция под навигацией. Optimistic updates, пагинация (20 комментариев, "Показать ещё").

</domain>

<decisions>
## Implementation Decisions

### Desktop Layout
- **D-01:** Комментарии размещаются ПОД AI-чатом в правой колонке (не табы). Правая колонка скроллится — чат сверху, комментарии снизу.
- **D-02:** Высота чата — Claude's discretion (подобрать баланс, чтобы комментарии были видны при умеренном скролле).

### Mobile Layout
- **D-03:** Комментарии — отдельная секция под навигацией урока (как указано в ROADMAP). Не в sidebar.

### Формат и контент
- **D-04:** Формат текста комментариев — Claude's discretion (plain text или markdown с SafeMarkdown).
- **D-05:** Редактирование комментариев НЕ поддерживается. Только удаление (свои + ADMIN/SUPERADMIN).

### Отображение тредов
- **D-06:** Ответы (1 уровень) всегда раскрыты, отображаются с отступом сразу под родительским комментарием.
- **D-07:** Кнопка "Ответить" на каждом корневом комментарии → inline поле ввода.
- **D-08:** Сортировка: новые комментарии сверху (DESC by createdAt). Ответы внутри треда — хронологически (ASC).

### Модерация
- **D-09:** Только удаление: пользователь удаляет свои, ADMIN/SUPERADMIN удаляют любые.
- **D-10:** Без кнопки "Пожаловаться", без report-системы.
- **D-11:** Без уведомлений о новых ответах (отложено в отдельную фазу).

### Данные пользователя
- **D-12:** Аватар и display name берутся из `UserProfile` (Prisma), как решено в Phase 34. Fallback: инициалы.

### Claude's Discretion
- Формат текста (plain text vs markdown) — выбрать оптимальный для образовательной платформы
- Высота AI-чата при совмещении с комментариями
- Макс длина комментария (рекомендация: 1000-2000 символов)
- Точный UI дизайн компонента комментария (цвета, отступы, иконки)
- Loading/skeleton состояния
- Empty state (когда комментариев нет)
- Анимация optimistic update

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `packages/db/prisma/schema.prisma` — UserProfile модель (avatarUrl, name), Lesson модель, ChatMessage паттерн (self-relation для тредов)

### Lesson Page (integration point)
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — текущая структура: lg:grid-cols-3, правая колонка = AI-чат (Card 500px), мобилка = чат скрыт

### tRPC Patterns
- `packages/api/src/routers/learning.ts` — паттерн protectedProcedure, мутации, queries
- `packages/api/src/routers/profile.ts` — доступ к UserProfile данным
- `packages/api/src/routers/ai.ts` — AI-чат паттерн (chat endpoint с историей)
- `packages/api/src/root.ts` — регистрация нового router

### Access Control
- `packages/api/src/utils/access.ts` — проверка ролей (ADMIN, SUPERADMIN)
- `packages/api/src/trpc.ts` — protectedProcedure, adminProcedure определения

### UI Components
- `apps/web/src/components/shared/SafeMarkdown.tsx` — markdown renderer (если выбран markdown формат)
- `apps/web/src/components/ui/card.tsx` — Card wrapper
- `apps/web/src/components/ui/button.tsx` — Button variants
- `apps/web/src/components/diagnostic/DiagnosticHint.tsx` — паттерн lesson-level карточки с expandable content

### Phase 34 Context (зависимость)
- `.planning/phases/34-user-profile-enhancement/34-CONTEXT.md` — аватар из Supabase Storage, UserProfile как единый источник

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card`, `CardHeader`, `CardContent` — обёртка для секции комментариев
- `Button` (outline, ghost, sm) — кнопки "Ответить", "Удалить", "Показать ещё"
- `SafeMarkdown` — рендер markdown (если выбран markdown формат)
- `Skeleton` — loading state
- `cn()` — утилита classNames
- `toast` (sonner) — уведомления об ошибках
- `protectedProcedure` — авторизованные tRPC endpoints
- `AlertDialog` — подтверждение удаления (паттерн из Phase 32 Custom Track)

### Established Patterns
- tRPC queries: `trpc.{router}.{method}.useQuery()` / `.useMutation()`
- Optimistic updates: `utils.{router}.{method}.setData()` в `onMutate` callback
- Responsive grid: `lg:grid-cols-3` + `lg:col-span-2` для основного контента
- Мобилка: элементы скрываются через `lg:hidden` / `hidden lg:block`
- AI-чат: textarea + send button, messages в scrollable div

### Integration Points
- `apps/web/src/app/(main)/learn/[id]/page.tsx` — добавить секцию комментариев в правую колонку под чатом
- `packages/api/src/root.ts` — зарегистрировать `comments: commentsRouter`
- `packages/db/prisma/schema.prisma` — добавить `LessonComment` модель
- Мобилка: добавить секцию комментариев после навигационных кнопок

</code_context>

<specifics>
## Specific Ideas

Phase 34 (зависимость) должна быть выполнена первой — аватар и display name используются в комментариях.

Формат отображения ответов: всегда раскрыты с визуальным отступом (не collapse), как в превью обсуждения:
```
👤 Иван           2 ч назад
Как рассчитать ROI?
         [Ответить] [🗑]

  👤 Мария      1 ч назад
  Формула на 14:30
  👤 Алексей    30 мин
  Спасибо!
```

</specifics>

<deferred>
## Deferred Ideas

- **In-app Notifications** — универсальная система уведомлений внутри платформы: модель `Notification`, колокольчик в хедере, лог ответов на комментарии в профиле. При входе пользователь видит пуш о новых ответах. Лучше делать как отдельную фазу — покроет не только комментарии, но и другие события (новые уроки, результаты диагностики и т.д.).

</deferred>

---

*Phase: 35-lesson-comments*
*Context gathered: 2026-03-26*
