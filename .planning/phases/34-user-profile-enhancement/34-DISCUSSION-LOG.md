# Phase 34: User Profile Enhancement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 34-user-profile-enhancement
**Areas discussed:** Avatar upload UX, Data source, Profile completeness, Storage
**Mode:** --auto (all decisions auto-selected with recommended defaults)

---

## Avatar Upload UX

| Option | Description | Selected |
|--------|-------------|----------|
| Simple upload + resize | Client-side resize to 256x256, preview, no crop modal | ✓ |
| Crop modal | Full crop/resize UI with aspect ratio lock | |
| Drag-n-drop zone | Large drop area with drag support | |

**User's choice:** [auto] Simple upload + resize (recommended default)
**Notes:** Минимальная сложность, crop можно добавить позже. Drag-n-drop — overkill для единичного файла.

---

## Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| UserProfile (Prisma) | Единый источник через tRPC, рефакторинг UserNav | ✓ |
| user_metadata (Supabase Auth) | Текущий подход, данные из auth | |
| Hybrid | Fallback chain: UserProfile → user_metadata → initials | |

**User's choice:** [auto] UserProfile (Prisma) (recommended default)
**Notes:** user_metadata может быть пустой для email-регистраций, единый источник правды проще поддерживать.

---

## Profile Completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Баннер на дашборде | Неблокирующий, ведёт на /profile | ✓ |
| Модал при первом входе | Блокирующий, заполнение прямо в модале | |
| Отдельная onboarding страница | Redirect на /onboarding если name пустой | |

**User's choice:** [auto] Баннер на дашборде (recommended default)
**Notes:** Менее навязчивый, пользователь может пропустить. Проверка через `name !== null`.

---

## Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Storage (public bucket) | Нативная интеграция, RLS, прямые URL | ✓ |
| External CDN (Cloudflare R2) | Дешевле на масштабе, больше настроек | |
| Base64 in DB | Без дополнительных сервисов, но тяжёлые queries | |

**User's choice:** [auto] Supabase Storage (recommended default)
**Notes:** Уже в requirements, нативная интеграция с Supabase Auth для RLS.

---

## Claude's Discretion

- Client-side resize library choice
- Upload component UI design
- Loading/skeleton states
- Error handling approach

## Deferred Ideas

None — discussion stayed within phase scope.
