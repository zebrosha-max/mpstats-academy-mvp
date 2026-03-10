# Phase 17: Yandex ID Auth - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Пользователи входят через Яндекс ID вместо Google OAuth. Google OAuth полностью убран из UI и Supabase. Email/password остаётся как fallback. Архитектура OAuth расширяема для будущих провайдеров (Точка ID через 1-2 месяца). Миграция существующих аккаунтов не требуется — пользователей 1-5, все тестовые, перерегистрируются.

</domain>

<decisions>
## Implementation Decisions

### OAuth flow механика
- Серверный OAuth proxy — Supabase не имеет нативного Яндекс провайдера
- Flow: кнопка "Войти через Яндекс" → redirect на oauth.yandex.ru/authorize → callback на /api/auth/yandex/callback → сервер обменивает code на токен → получает профиль Яндекс → Supabase Admin API (createUser если новый / find existing по email) → генерация Supabase session → redirect на /dashboard
- Создание Supabase-сессии через Admin API (SUPABASE_SERVICE_ROLE_KEY) — middleware, tRPC context, RLS работают без изменений
- Яндекс OAuth app ещё не зарегистрировано — в плане указать callback URL и scopes для регистрации на oauth.yandex.ru
- Scopes: login:email, login:info (минимум — email + имя, без аватара)
- Credentials (YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET) хранятся в .env / .env.production как остальные

### Миграция аккаунтов
- Миграция НЕ НУЖНА — пользователей 1-5, все тестовые, перерегистрируются заново
- Google OAuth убрать из Supabase провайдеров и из UI полностью
- ВАЖНО: создать admin-аккаунт для Egor Vasilev (текущий суперюзер, входил через Google OAuth). Способ: email/password или Яндекс OAuth, с isAdmin=true
- Старых тестовых пользователей — Claude's discretion (оставить или почистить)

### UI логин-страницы
- Заменить кнопку "Войти через Google" на "Войти с Яндекс ID" на обеих страницах (login + register)
- Стиль кнопки — официальный брендбук Яндекс ID: красная буква Я (логотип) слева, текст "Войти с Яндекс ID"
- Layout: email/password форма сверху → разделитель "или" → кнопка Яндекс снизу (как сейчас с Google)
- Страница регистрации зеркалит логин: форма email/password/имя + кнопка "Продолжить с Яндекс ID"
- Генерация паролей НЕ нужна — полагаемся на браузерный менеджер паролей
- Лендинг: Claude's discretion — проверить есть ли упоминания Google, убрать если есть

### Абстракция провайдера (AUTH-04)
- Точка ID реально появится через 1-2 месяца — архитектура должна упрощать добавление
- Уровень абстракции — Claude's discretion (от минимального interface OAuthProvider до registry pattern)
- Хранение провайдера в DB — Claude's discretion (текущий yandexId поле vs таблица OAuthLink vs другое)

### Claude's Discretion
- Уровень абстракции OAuth провайдера (минимальный interface vs registry vs plugin)
- DB схема для хранения OAuth привязок (отдельные поля vs OAuthLink таблица)
- Удалять ли старых тестовых пользователей из Supabase при деплое
- Лендинг — проверить и убрать упоминания Google если есть
- Error handling при Яндекс OAuth failures (что показывать пользователю)
- CSRF protection для OAuth state parameter

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **signInWithGoogle()** (`apps/web/src/lib/auth/actions.ts`): Паттерн OAuth server action — заменить на signInWithYandex()
- **Auth callback route** (`apps/web/src/app/auth/callback/route.ts`): Обрабатывает Supabase OAuth code exchange. Для Яндекс нужен отдельный callback route (/api/auth/yandex/callback) т.к. flow кастомный
- **Supabase server client** (`apps/web/src/lib/supabase/server.ts`): createClient() для серверных операций. Для Admin API нужен createClient с SERVICE_ROLE_KEY
- **protectedProcedure / adminProcedure** (`packages/api/src/trpc.ts`): Auth guards — работают без изменений после Supabase Admin session
- **UserProfile.yandexId** (schema.prisma): Поле уже существует (Phase 16), unique constraint

### Established Patterns
- Auth actions как server actions ('use server') — signUp, signIn, signInWithGoogle, signOut, resetPasswordRequest
- Login/Register pages — 'use client' с useState для loading/error, form action для submit
- OAuth кнопка — outline variant Button с SVG иконкой провайдера
- Auth callback — Next.js Route Handler (GET) с code exchange
- Middleware — createServerClient с cookie handling для session refresh

### Integration Points
- `apps/web/src/lib/auth/actions.ts` — заменить signInWithGoogle → signInWithYandex
- `apps/web/src/app/(auth)/login/page.tsx` — заменить Google кнопку на Яндекс
- `apps/web/src/app/(auth)/register/page.tsx` — заменить Google кнопку на Яндекс
- `apps/web/src/app/api/auth/yandex/callback/route.ts` — НОВЫЙ: Яндекс OAuth callback
- `apps/web/src/lib/supabase/server.ts` — добавить admin client (SERVICE_ROLE_KEY)
- `apps/web/src/middleware.ts` — НЕ МЕНЯЕТСЯ (Supabase session как обычно)
- `.env` / `.env.production` — добавить YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET, SUPABASE_SERVICE_ROLE_KEY

</code_context>

<specifics>
## Specific Ideas

- "Про текущих пользователей не паримся. Там по сути только тестеры. Перерегаются."
- "Надо только убедиться что будет опция авторизации через OAuth и через прямую регу email/пароль"
- "Важно не забыть — я, Egor Vasilev, супер-юзер, авторизован через Google OAuth. Надо создать мне admin аккаунт через который я буду ходить после того как отключим Google OAuth"
- "Появление Точка ID вполне реально, думаю через месяц-другой"

</specifics>

<deferred>
## Deferred Ideas

- Точка ID OAuth провайдер (AUTH-05) — v1.3+, через 1-2 месяца
- Аватар из Яндекс профиля (login:avatar scope) — можно добавить позже без breaking changes
- Multi-provider linking (один пользователь привязывает несколько провайдеров) — будущий milestone

</deferred>

---

*Phase: 17-yandex-id-auth*
*Context gathered: 2026-03-10*
