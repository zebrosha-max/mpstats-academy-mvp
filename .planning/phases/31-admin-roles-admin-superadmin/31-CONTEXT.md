# Phase 31: Admin Roles — разделение admin/superadmin - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Разделение единого `isAdmin: Boolean` на трёхуровневую иерархию ролей (USER / ADMIN / SUPERADMIN). Включает paywall bypass для админов, защиту привилегий (кто кого может назначать/деактивировать), и обновление UI админки.

</domain>

<decisions>
## Implementation Decisions

### Модель ролей
- Claude's Discretion: выбрать между enum Role { USER ADMIN SUPERADMIN } и двумя boolean полями. Рекомендация: enum (чистый, расширяемый)
- Заменить `isAdmin: Boolean` на выбранную модель
- Три уровня: USER (обычный), ADMIN (доступ к админке, bypass пейвола), SUPERADMIN (всё + управление ролями)
- ADMIN может: видеть dashboard KPI, управлять юзерами (кроме ролей и деактивации), контент-менеджмент, аналитика
- SUPERADMIN может: всё что ADMIN + назначение/снятие ролей ADMIN и SUPERADMIN + деактивация юзеров
- Пункт "Админка" в sidebar для ADMIN и SUPERADMIN (обычные юзеры не видят)

### Paywall bypass
- Добавить проверку роли в `checkLessonAccess` (packages/api/src/utils/access.ts)
- Если роль ADMIN или SUPERADMIN → hasAccess=true, reason='admin_bypass'
- Централизованно — не в каждом роутере, а в одной точке (access.ts)

### Защита привилегий
- SUPERADMIN может назначать роли через UI (dropdown в UserTable)
- ADMIN НЕ может менять роли (dropdown скрыт или disabled)
- Деактивация юзеров (isActive=false) — только SUPERADMIN
- ADMIN может: всё остальное в UserTable (сортировка, просмотр, фильтрация)
- Запрет само-разжалования (SUPERADMIN не может убрать SUPERADMIN у себя)

### Админ UI
- Claude's Discretion: dropdown с ролями или badge+кнопка в UserTable
- Роль НЕ отображается в профиле пользователя (/profile)
- Операции, доступные только SUPERADMIN, скрыты/disabled для ADMIN

### Claude's Discretion
- Выбор между enum и boolean (рекомендуется enum)
- UI компонент для переключения ролей в UserTable (dropdown vs badge+button)
- Миграция данных: как конвертировать существующие isAdmin=true → ADMIN/SUPERADMIN
- Обновление `adminProcedure` в tRPC (проверка role вместо isAdmin)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current admin implementation
- `packages/db/prisma/schema.prisma` — UserProfile model с текущим isAdmin: Boolean
- `packages/api/src/trpc.ts` — adminProcedure middleware (строки 41-50)
- `packages/api/src/routers/admin.ts` — Admin router с toggleUserField
- `apps/web/src/app/(admin)/layout.tsx` — Admin layout с isAdmin check
- `apps/web/src/components/admin/UserTable.tsx` — UserTable с isAdmin toggle

### Access control (paywall)
- `packages/api/src/utils/access.ts` — checkLessonAccess, getUserActiveSubscriptions

### Navigation
- `apps/web/src/components/shared/sidebar.tsx` — Main sidebar (нужно добавить пункт "Админка")

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `adminProcedure` в `trpc.ts` — единая точка проверки доступа, нужно обновить
- `UserTable.tsx` — уже имеет toggle для isAdmin, нужно заменить на dropdown/select
- `access.ts` — centralized access check, нужно добавить admin bypass
- Badge component из shadcn/ui — можно использовать для отображения ролей

### Established Patterns
- Prisma enum для типов (MessageRole, SubscriptionStatus) — паттерн уже используется
- Feature flags через DB (FeatureFlag table) — не нужен для ролей
- Optimistic updates в UserTable (handleToggle) — переиспользовать для role change

### Integration Points
- `(admin)/layout.tsx` — проверка доступа к админке (заменить isAdmin на role check)
- `sidebar.tsx` — добавить условный пункт "Админка"
- `access.ts` — добавить admin bypass в checkLessonAccess
- `admin.ts` router — обновить toggleUserField → changeUserRole

</code_context>

<specifics>
## Specific Ideas

- Реализация по аналогии с mpstats-connect (у них тоже есть разделение ролей)
- Основная мотивация: дать команде тестировать платформу без упирания в пейвол, при этом не давая права управления настройками платформы

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 31-admin-roles-admin-superadmin*
*Context gathered: 2026-03-18*
