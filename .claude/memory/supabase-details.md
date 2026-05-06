---
name: MAAL Supabase Configuration
description: Supabase project details, RLS strategy, keep-alive, test users for MAAL
type: reference
---

## Project
- URL: `https://saecuecevicwjkpmaoot.supabase.co`
- Database: PostgreSQL with pgvector
- Auth: Email/Password + Yandex ID OAuth (Google removed)
- Service role key prefix: `sjPfn`

## RLS Strategy (2026-03-16)
RLS ON на всех 18 public таблицах. Стратегия: **нулевые политики**.

**Почему безопасно:**
- Prisma (`DATABASE_URL`, роль `postgres`) — обходит RLS
- AI/RAG через `service_role` key — обходит RLS
- Trigger `handle_new_user` — `SECURITY DEFINER` — обходит RLS
- PostgREST (anon key из браузера) → 0 строк, полная блокировка

Если нужен Realtime или клиентские запросы — добавить политики точечно.
Скрипт: `scripts/sql/enable_rls_all_tables.sql`

## Storage
- Bucket `avatars` с 4 RLS-политиками (upload/update/delete per user, public read)
- Создан через Storage API + node pg

## Free Tier Keep-Alive
GitHub Action `.github/workflows/supabase-keepalive.yml` — ping каждые 3 дня (8:00 и 20:00 UTC), retry 3x.

**Если база заснула (Error 521):**
1. Dashboard → проект `saecuecevicwjkpmaoot` → "Restore project"
2. Ручной запуск: `gh workflow run supabase-keepalive.yml`

## Test Users
| Email | User ID | Notes |
|-------|---------|-------|
| `test@mpstats.academy` | `62b06f05-...` | Локальное тестирование |
| `tester@mpstats.academy` | `cff53dc4-...` | E2E тесты (пароль в global memory) |

## SMTP
Resend (smtp.resend.com): 30 emails/h, min interval 30s. API key от проекта MPSTATS Connect.

## Auth Gotchas
- `handle_new_user` trigger: обязательны `"createdAt"` и `"updatedAt"` с `NOW()` в INSERT
- DOI-ссылка: `site_url` уже содержит `/auth/v1` — не добавлять второй раз
- `pa_registration_completed`: только в `auth/callback/route.ts` (после DOI), не при `signUp()`
- `user_metadata.full_name` (не `.name`) — читать: `full_name || name || email`
- Supabase HTTPS hooks = Standard Webhooks (webhook-id/timestamp/signature headers)
- Free tier email rate limit: 3/hour per project, увеличить в Dashboard
