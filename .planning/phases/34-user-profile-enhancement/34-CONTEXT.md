# Phase 34: User Profile Enhancement - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Пользователь может загрузить аватар и указать display name в профиле. Аватар хранится в Supabase Storage, отображается в UserNav, Sidebar и будущих комментариях (Phase 35). При отсутствии аватара — fallback на инициалы. Display name запрашивается через неблокирующий баннер на дашборде при первом входе.

</domain>

<decisions>
## Implementation Decisions

### Avatar Upload
- **D-01:** Simple upload с client-side resize (до 256x256) и preview. Без crop-модала — минимальная сложность. Crop можно добавить в будущем.
- **D-02:** Форматы: jpg, png, webp. Лимит: 2MB (до resize). После resize — webp для оптимального размера.
- **D-03:** Drag-n-drop не нужен — достаточно кнопки "Загрузить фото" + input[type=file].

### Data Source
- **D-04:** Единый источник данных — `UserProfile` (Prisma) через tRPC query `profile.get`. НЕ `user_metadata` из Supabase Auth.
- **D-05:** UserNav и Sidebar должны получать avatar/name из UserProfile, а не из Supabase user объекта. Это требует рефакторинга layout — передавать profile data вместо auth user.
- **D-06:** Для Yandex OAuth: при первом входе копировать имя/аватар из user_metadata в UserProfile (если UserProfile.name пустое).

### Profile Completeness
- **D-07:** Баннер на дашборде "Заполните профиль" — если `UserProfile.name` пустое. Неблокирующий, можно закрыть.
- **D-08:** Клик по баннеру ведёт на `/profile` с автофокусом на поле имени. Не модал, не отдельная страница.
- **D-09:** Баннер скрывается навсегда после заполнения имени (не нужен отдельный флаг dismissed — проверяем `name !== null`).

### Storage
- **D-10:** Supabase Storage bucket `avatars` с RLS — пользователь может загружать/удалять только свои файлы.
- **D-11:** Path convention: `avatars/{userId}/{timestamp}.webp` — timestamp для cache busting при замене.
- **D-12:** Public bucket (аватары не секретные) — упрощает URL без signed URLs.

### Claude's Discretion
- Client-side resize библиотека (canvas API vs browser-image-resizer vs другое)
- Точный UI дизайн upload компонента на странице профиля
- Skeleton/loading state при загрузке аватара
- Error handling при неудачной загрузке (toast достаточно)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `packages/db/prisma/schema.prisma` — UserProfile модель (avatarUrl, name уже существуют)

### Existing Profile Code
- `packages/api/src/routers/profile.ts` — tRPC router, `update` мутация уже принимает name + avatarUrl
- `apps/web/src/app/(main)/profile/page.tsx` — текущая страница профиля (name edit существует, avatar upload нет)
- `apps/web/src/components/shared/user-nav.tsx` — UserNav берёт данные из user_metadata (нужен рефакторинг → UserProfile)
- `apps/web/src/components/shared/sidebar.tsx` — Sidebar без аватара (навигация only)
- `apps/web/src/app/(main)/layout.tsx` — передаёт Supabase user в UserNav (нужен рефакторинг)

### Dashboard
- `apps/web/src/app/(main)/dashboard/page.tsx` — место для баннера profile completeness

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `profile.update` tRPC мутация — уже принимает `{ name, avatarUrl }`, нужно только добавить Supabase Storage upload
- `UserNav` компонент — уже имеет initials fallback логику, нужно переключить источник данных
- `toast` (sonner) — используется повсеместно для уведомлений
- `Button`, `Card`, `Input` — shadcn/ui компоненты

### Established Patterns
- tRPC queries через `trpc.profile.get.useQuery()` — стандартный паттерн
- Supabase server client в layout → server component data fetching
- Client components для интерактивных частей (`'use client'`)
- Toast уведомления через sonner

### Integration Points
- `apps/web/src/app/(main)/layout.tsx` — рефакторинг: добавить tRPC prefetch для profile, передать в UserNav
- `apps/web/src/app/(main)/dashboard/page.tsx` — добавить completeness баннер
- `packages/api/src/routers/profile.ts` — добавить upload URL generation endpoint
- Supabase Dashboard — создать bucket `avatars`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

Phase 35 (Lesson Comments) зависит от этой фазы — аватар и display name используются в комментариях.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 34-user-profile-enhancement*
*Context gathered: 2026-03-26*
