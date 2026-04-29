# CLAUDE.md — MPSTATS Academy MVP

**Last updated:** 2026-04-24

> Детали по сессиям, спринтам, Supabase, деплою, CQ — в `.claude/memory/`.
> Используй `Read .claude/memory/MEMORY.md` для индекса.

## Current Status

**Production:** https://platform.mpstats.academy

| Milestone | Status |
|-----------|--------|
| v1.0 MVP | Shipped 2026-02-26 (Phases 1-9) |
| v1.1 Admin & Polish | Shipped 2026-02-28 (Phases 10-15) |
| v1.2 Auth Rework + Billing | Shipped 2026-03-12 (Phases 16-21) |
| v1.3 Pre-release | Shipped (Phases 22-36, last: Phase 28 boevye CP keys, ранее) |
| v1.4 QA Audit Fixes | Shipped 2026-03-29 (Phases 37-42) |
| Phase 43 Diagnostic v2 | Shipped 2026-04-02 |
| v1.5 Growth & Monetization | In Progress (Phase 44+45+46+48+50 shipped) |

**Remaining work:**
1. Phase 33-03: CQ Dashboard Setup (на стороне CQ команды)
2. Phase 47: /learn Hub-Layout — навигационный хаб (курсы свёрнуты, библиотека, мой трек наверху)

## Auth — Phone Collection (Phase 45, shipped 2026-04-21)

Телефон обязателен для новых регистраций. Существующих юзеров не трогаем.

| Путь | Как собираем телефон |
|------|---------------------|
| Email регистрация | Обязательное поле в форме `/register` (react-international-phone, дефолт RU) |
| Yandex OAuth | Scope `login:phone`, автоматически из Яндекса |
| Yandex без телефона | Редирект на `/complete-profile` (мини-форма, 1 поле) |

- DB: `UserProfile.phone String?` (E.164 формат: `+79001234567`)
- CQ: `$phone` + `pa_phone` при регистрации
- Pricing: неавторизованные юзеры → `/register` (было `/login`)

## Pricing (as of 2026-04-13)

Источник правды — таблица `SubscriptionPlan` в Supabase. UI `/pricing`, виджет CP, profile, emails — всё подтягивается оттуда динамически через `trpc.billing.getPlans`.

| Plan type | Name | Price | Period |
|-----------|------|-------|--------|
| COURSE | Подписка на курс | **1 990 ₽** | 30 дней |
| PLATFORM | Полный доступ | **2 990 ₽** | 30 дней |

**Менять цены:** `UPDATE "SubscriptionPlan" SET price=XXX WHERE type='COURSE'` прямо в Supabase — эффект мгновенный, рестарт не нужен. Плюс обновить `scripts/seed/seed-billing.ts` чтобы fresh seed'ы соответствовали.

**Внимание при переходе на боевой CP (Phase 28):** CP хранит `amount` на своей стороне в момент создания подписки. Существующие ACTIVE подписки с тестового режима при автосписании всё равно спишут **старые** суммы. Перед переключением на боевые ключи отменить все тестовые ACTIVE подписки, чтобы реальные юзеры начали с новых цен.

## Last Session (2026-04-27)

**Phase 49 — Lesson Materials. SHIPPED.**

1. **Schema + Storage (49-01)** — `Material` / `LessonMaterial` / `MaterialType` enum в Prisma; bucket `lesson-materials` private, 25 MB hard limit, MIME whitelist (PDF / XLSX / DOCX / CSV); `prisma db push` ПЕРЕД docker rebuild (recurring Phase 28 lesson).
2. **tRPC router (49-02)** — 9 procedures (`list/getById/create/update/delete/attach/detach/requestUploadUrl/getSignedUrl`), 8 admin + 1 protected; ACL: `getSignedUrl` проверяет access к ≥1 прикреплённому уроку; locked lesson → `materials: []` в payload (даже названия не утекают).
3. **Ingest (49-03)** — `scripts/ingest-materials.ts`, dry-run + apply, ~120 строк Google Sheet → 62 unique Material + 97 LessonMaterial links на ~50 уроках; дедуп по `(title, normalizedUrl)` с trim (D-49); fuzzy match (кавычки, тире, split `|`, ILIKE fallback); идемпотентный; Sentry custom span на блок урока (D-43); 16 unmatched в `49-03-NOTES.md` для ручной привязки.
4. **Lesson UI (49-04)** — секция «Материалы к уроку» между summary и навигацией (D-26); `MaterialCard` с иконкой по типу + accent-цветом (5 type configs); locked lesson не рендерит секцию (D-29); Yandex Metrika `MATERIAL_OPEN` + `MATERIAL_SECTION_VIEW` (Intersection Observer one-shot).
5. **Admin (49-05)** — `/admin/content/materials` список с фильтрами + create/edit с XOR (URL XOR upload); drag-n-drop file upload через signed PUT URL прямо в Storage (минует Next.js body limit); Combobox для multi-attach; «Materials» в AdminSidebar между Content и Comments.
6. **Polish (49-06)** — E2E Playwright тесты (3 сценария, env-var gated), cron `/api/cron/orphan-materials` (раз в сутки 03:00 UTC, удаляет файлы старше 24h без DB ref, Sentry checkin slug `orphan-materials`), запись в публичный `/roadmap` от первого лица, memory entry, **гайд методолога `docs/admin-guides/lesson-materials.md` (D-47)**, deploy на прод.

**Commits:** `a0ea1df` (cron + E2E), плюс серия предыдущих волн (49-01..49-05, см. `.planning/phases/49-lesson-materials/`).
**Результат:** Методологи получили автономную админку с инструкцией, юзеры с подпиской видят материалы под видео, без подписки — секция вообще не рендерится. Первая UI-фича где Storage используется не для аватаров.

---

**Skill batch 24.04.26 — Integrated (parallel session, 2026-04-27).**

16 ANALYTICS skill-уроков прошли весь pipeline от MP4 до Production-DB. Pipeline-spec для будущих батчей живёт в `E:/Academy Courses/CLAUDE.md` секция «End-to-End Pipeline».

1. **AI-классификация (сквозная, обязательна для плейбуков)** — `skill-mapping/skill-mapper.ts discover --resume` + `classify --resume`, 16 новых записей в `classification.json` (avg 2.7 блоков/урок, 32 заранее зафиксированных skill-блока, taxonomy НЕ перегенерировали).
2. **Seed** — `seed-skill-lessons.ts` (idempotent upsert) создал 16 Lesson c skillBlocks, durations из транскриптов; pre-existing 17 = no-op. Починен баг финальной статистики: `NOT: { skillBlocks: null }` → `skillBlocks: { not: Prisma.JsonNull }`.
3. **Перенос courseId** `skill_analytics` → `01_analytics` (consistency с Phase 46) — 01_analytics 92→108 уроков.
4. **Kinescope** — 16/16 видео (6.77 GB) залиты через TUS в папку skill_analytics; на одном файле упёрлись в HTTP 400 «already exists» (race в их CDN после orphan delete) — workaround: уникализировать title в map (`· v2`), retry прошёл.
5. **Заполненные skill-блоки** (все ANALYTICS): `internal_analytics` (2), `strategic_planning` (4), `promo_analysis` (2), `category_selection` (3), `sales_forecast` (2), `product_card_improvement` (3).
6. **Spec обновлён** — `E:/Academy Courses/CLAUDE.md` получил полную секцию «End-to-End Pipeline (Source → Platform)» с 10 шагами (Phase A: Academy Courses repo / Phase B: MAAL repo), verification SQL, checklist для новых батчей.

**Метрики платформы после батча:** 437 Lesson records (404 + 33 skill_*), 5,700 chunks в `content_chunk`, 434 уроков с AI-классификацией.

### Previous Session (2026-04-23 → 2026-04-24)

**Phase 48 — Staging Environment. SHIPPED + 5-layer debug incident resolved.**

1. **Staging стенд на VPS 89.208.106.208** — `staging.platform.mpstats.academy` (поддомен + DNS A-record)
   - Второй Docker-контейнер `maal-staging-web` на порту 3001 (prod остаётся 3000, не тронут)
   - Nginx vhost с basic auth (`team` / пароль в `.secrets/staging-credentials.md` gitignored), SSL через certbot, `X-Robots-Tag: noindex`
   - Shared Supabase DB с prod, тестовые аккаунты с префиксом `staging-*`
   - Swap увеличен с 512 MB до 2 GB (подстраховка при parallel-билдах)
   - Basic auth пароль: `u6M3yy4GELt1aQVOHn5U` (хранится локально в `.secrets/`)

2. **Feature flag pattern** — `NEXT_PUBLIC_STAGING` (жёлтая плашка в header) + `NEXT_PUBLIC_SHOW_LIBRARY` (показывает Phase 46 Library в `/learn`). Хардкодить флаги в `docker-compose.staging.yml` `args` как literal `"true"` — substitution через `${VAR}` не работает с Next.js SWC.

3. **5-layer debug incident** (3 часа, 5 rebuild) — LibrarySection не показывался. Все баги починены:
   - Layer 1: Turbo v2 strict env mode → `turbo.json` `build.env: ["NEXT_PUBLIC_*"]`
   - Layer 2: Compose `${VAR}` substitution ненадёжен → хардкод в args
   - Layer 3: `ReferenceError: process is not defined` в client (мой cast сломал) → `dynamic(ssr:false)` + прямой `process.env.X`
   - Layer 4: `getLibrary` фильтр `course.id startsWith 'skill_'` возвращал 0 (Phase 46 переместил уроки в regular courses) → фильтр по `skillBlocks != null`
   - Layer 5: `<LibrarySection />` был только в view='courses' branch → вынес наружу ternary
   - **Полный post-mortem** + checklist для будущих staging-флагов: `.claude/memory/project_phase48_debug_postmortem.md`

4. **Commits:** `a4a2f2c`, `369a022`, `f4f27aa`, `8e09e43` (plan phase), `c56ac76`, `366ce60`, `0c89d62`, `b54f762` (48-02 code in worktree), `f0b88b7`, `3d75fa4`, `76806d1`, `efffde2` (48-01+03 deploy), `b9ad285`, `0d0d6e9`, `820b699`, `9d37091`, `9728f80`, `01e8f28`, последние — debug loop

5. **Результат:** Staging работает, Library видна в `/learn` в обеих view (Мой трек + Все курсы), prod продолжает возвращать 200 OK с неизменённым container ID, команда может логиниться и смотреть фичи.

### Previous Session (2026-04-22, session 2)

**Phase 46 — Skill Lessons Integration + Library foundation. НЕ задеплоено (ждёт деплой).**

1. **17 новых skill-уроков** полностью интегрированы:
   - Транскрибация (Whisper large-v3) → 182 чанка → embeddings → Supabase (5,473 total)
   - Видео залиты на Kinescope (5.7 GB, 17 файлов), videoUrl/videoId в DB
   - Lesson записи созданы, перемещены в существующие курсы (10→Аналитика, 7→Реклама)
2. **AI skill-классификация всех 422 уроков** (3-фазный пайплайн по контенту, не по названиям):
   - Discovery: 2047 навыков из chunk-контента → 163 консолидированных
   - Taxonomy: 32 skill-блока × 5 осей (ручная курация после LLM)
   - Classification: 1146 присвоений, avg 2.7 блоков/урок, 90% high confidence
   - Schema: `Lesson.skillBlocks Json?` — заполнено на всех 422 уроках
3. **Retrieval**: убран `Course.isHidden` фильтр — skill-контент доступен в RAG/диагностике
4. **CATEGORY_TO_COURSES**: добавлены `skill_analytics`, `skill_marketing`
5. **Library UI**: компонент `LibrarySection` (оси→блоки→уроки), endpoint `learning.getLibrary`. Пока пустой — уроки в курсах. Готов для будущего контента
6. **Fix**: lesson detail page больше не 404 для уроков из hidden courses
7. **Архитектурное решение**: /learn → hub-layout (курсы свёрнуты, библиотека, мой трек наверху) — Phase 47
8. **Инфра**: 27 зомби node-процессов вычищены, Prisma DLL разлочен, pnpm --force reinstall

### Previous Session (2026-04-22, session 1)

**V8 Marketing Pages Launch — переезд 10 страниц на боевые публичные URL + SEO. Задеплоено на прод.**

1. **Переезд путей** `design-new-v8-*` → боевые публичные URL:
   - `/` (главная), `/pricing`, `/about`, `/skill-test` (новый слаг для AI-диагностики), `/roadmap`, `/courses`, `/courses/analytics|ads|ai|ozon`
   - Внутренняя `/diagnostic` (после логина) не тронута — лендинг живёт под `/skill-test`, чтобы не коллизировать
2. **CP-виджет встроен в новую `/pricing`**: перенесена логика из старой `/pricing` (trpc.billing.initiatePayment, openPaymentWidget, CP SDK через next/script, промо через trpc.promo.activate), сохранён V8-дизайн (pill-chips из backend, `COURSE_SHORT_LABEL` для id → short name). Suspense wrapper + useSearchParams для `?promo=`
3. **V8 компоненты обновлены**: V8Header/V8Footer/StickyCTA — NAV_LINKS на новые пути, диагностика-CTA → `/skill-test`
4. **Связал href="#" заглушки**: карточки курсов в каталоге → `/courses/*`, CTA «Пройти диагностику» → `/diagnostic` (middleware редиректит неавторизованных на /login)
5. **SEO**: 9 layout.tsx с per-page metadata (title через `absolute` чтобы не дублировать template), root layout.tsx обновлён под канон v2.1, `sitemap.ts` со всеми 10 URL + приоритеты
6. **Changelog запись от 22.04** в /roadmap — от первого лица, без технички («Обновили сайт целиком… Стало понятнее, что внутри платформы»)
7. **Починил 3 pre-existing typecheck ошибки**: `OAuthUserInfo.phone` в тестах (появилось в Phase 45), `getByRole({ href })` → `page.locator('a[href]')` в landing.spec.ts
8. **5 коммитов**, все на проде: `6206104` (V8 pages core) + `4c8e1a5` (SEO metadata) + `35b4061` (gitignore) + `d8bfdcb` (roadmap entry) + `d0b398c` (test fixes)
9. **QA**: все 10 URL отдают 200, title/description/canonical корректны на каждой, Playwright прогон desktop+mobile подтвердил рендер без console errors (кроме CORS-шума от Carrot Quest — внешний tracker)

**Известные баги от Егора → следующая сессия.**

### Previous Session (2026-04-21)

**Phase 45 — Сбор телефонов + Pricing redirect swap. Задеплоено на прод.**

1. **Обязательный телефон при регистрации**: `react-international-phone` с дропдауном стран (дефолт Россия), поддержка СНГ/международных номеров. Имя тоже стало обязательным.
2. **Yandex OAuth**: добавлен scope `login:phone`, телефон автоматически сохраняется из Яндекса. Новые юзеры без телефона → `/complete-profile` (мини-форма с одним полем).
3. **DB**: `UserProfile.phone String?` (E.164), миграция применена на Supabase.
4. **Backend**: `profile.update` принимает phone с E.164 валидацией, `ensureUserProfile` подтягивает phone из user_metadata.
5. **CQ**: `pa_phone` + `$phone` отправляются при регистрации для менеджеров/CRM.
6. **Pricing redirect**: неавторизованные юзеры при покупке/промо → `/register` (было `/login`). Header pricing: "Регистрация" вместо "Войти".
7. **7 коммитов**, задеплоено на VPS через Docker.

### Previous Session (2026-04-16 → 2026-04-20)

**Marketing Pages Sprint — дизайн-система, 10 маркетинговых страниц, выбор V8 Brand Bento.**

**Статус:** ожидание доработки позиционирования от Егора → обновление текстов → деплой на прод.

### Previous Session (2026-04-16)

**Diagnostic prompt v3 — анализ 9 ревью Милы + обновление промпта генерации вопросов.**

1. **Анализ Google Doc** «CHECK платформы» (12 вкладок: GPT 1-3, Qwen 1-3, GPT nano 1-3, вывод, таблица итогов):
   - Сводная статистика по 9 сессиям × 15 вопросов. Лидер: GPT-4.1 сессия 3 (12+/15). GPT nano: разброс 5-9+. Qwen стабильно плохой (0-5+).
   - Выявлено **10 системных проблем**: повторяющиеся вопросы с конфликтом ответов, ссылки на учебные материалы, обтекаемость, фактологические ошибки (CTR/ROI/выкуп), неправильная терминология (ампостат), отсутствие ситуативности, слишком простые вопросы, неполные объяснения, нерелевантные темы (налоги, этикетки, SMART).

2. **Обновлён промпт** — вынесен в `packages/ai/src/question-prompt.ts` (без server-only зависимостей):
   - 7 новых блоков: РАЗНООБРАЗИЕ, ФАКТОЛОГИЧЕСКАЯ ТОЧНОСТЬ, СИТУАТИВНОСТЬ, КАЧЕСТВО ОБЪЯСНЕНИЙ, ТЕРМИНОЛОГИЯ (обязательные написания), ПЛОХИЕ ПРИМЕРЫ
   - Расширен ЗАПРЕЩЕНО: +4 правила (очевидные вопросы, тайм-менеджмент, конкретные числа в стратегиях, налоги усилены)
   - `question-generator.ts` реэкспортирует из `question-prompt.ts`

3. **Сгенерированы 2 тестовые сессии** для Милы (промпт v3):
   - `docs/test-session-gpt-41-nano-v3-1.md` (15 вопросов)
   - `docs/test-session-gpt-41-nano-v3-2.md` (13 вопросов — Finance недогенерировал)
   - Переданы Миле, ждём ревью

**Статус:** ожидание ревью Милы по v3-сессиям. По результатам — ещё итерация промпта или фиксация.

### Previous Session (2026-04-14)

**Yandex OAuth: три бага починены за одну сессию.**

1. **Callback падал с `auth_callback_error` на проде** — пользователи не могли регистрироваться через Yandex ID. Sentry молчал, потому что в `apps/web/src/app/api/auth/yandex/callback/route.ts` все ветки ошибок использовали `console.error` без `Sentry.captureException`.
   - **Root cause:** Node 20 undici fetch делает Happy Eyeballs, гонит IPv4 и IPv6 одновременно. На VPS нет маршрута до IPv6 (`ENETUNREACH`), а IPv4 cold-connect до `87.250.251.227` периодически таймаутит (~10%). Первый запрос падал с `AggregateError [ETIMEDOUT; ENETUNREACH]`, все следующие работали через keep-alive.
   - **Fix:** `NODE_OPTIONS=--dns-result-order=ipv4first` в `docker-compose.yml` + `fetchWithRetry` в `YandexProvider` (3 попытки, backoff 250/500мс, `AbortController` 8s). Добавлены `Sentry.captureException` в 4 catch-ветках callback с tags `{route:'yandex-callback', stage:'...'}`.

2. **Yandex login не показывал account picker** — юзер автоматически логинился в последний использованный аккаунт, без возможности выбрать другой. Старый фикс R10 (83ae6c9) добавил `prompt=login`, но Yandex этот параметр не поддерживает и молча игнорирует.
   - **Fix:** `prompt=login` → `force_confirm=yes` (Yandex-specific параметр из официальной документации). Теперь passport всегда показывает экран подтверждения с возможностью сменить аккаунт.

3. **Sentry cron alert false-positive fix** — хвост от предыдущей сессии, `checkinMargin: 180` в `api/cron/check-subscriptions/route.ts` подтверждён на проде.

Commits: `0e87fda` (IPv4+Sentry), `e5b7648` (retry), `15e3e86` (force_confirm). Все задеплоены на VPS, тесты прошли: регистрация через Yandex работает, account picker появляется.

### Previous Session (2026-04-13)

**Sentry triage + два критических фикса + смена цен.**

1. **CP recurrent webhook crash** (MAAL-PLATFORM-2) — был бы блокером для Phase 28:
   - Recurrent webhook использует **отдельную схему** (`Id`/`AccountId`/`Status`/`SuccessfulTransactionsNumber`), а не payment-схему. Старый handler пытался читать `TransactionId`/`InvoiceId`/`DateTime` → `PrismaClientValidationError`
   - Новые pure-модули: `parse-webhook.ts` (parser/normalizer), `decide-recurrent-update.ts` (decision logic). 27 unit-тестов с реальным payload из Sentry
   - `Subscription.cpSubscriptionId String? @unique` добавлено — захватывается из `pay` event (`SubscriptionId` поле), потом recurrent lookup идёт детерминированно по unique-индексу
   - Defensive fallback в `resolveOurSubscriptionId`: `InvoiceId || ExternalId || Data.ourSubscriptionId`
   - Виджет теперь дублирует subscription id в `data` field (defense in depth)
   - 2 smoke-теста на проде прошли идеально

2. **Cron false-positive alert** (MAAL-PLATFORM-1):
   - GitHub Actions schedules дрейфят 60-100+ минут под нагрузкой, а Sentry monitor был с `checkinMargin: 5` → alert каждое утро хотя cron реально отрабатывал
   - Margin расширен до 180 минут в `api/cron/check-subscriptions/route.ts`. Реальные падения всё равно ловятся через `captureCheckIn({ status: 'error' })` в catch

3. **Смена цен**: COURSE 2990→1990, PLATFORM 4990→2990. `UPDATE` прямо в Supabase + обновлён `seed-billing.ts`. Никаких хардкодов в UI/коде — всё динамика.

Оба старых Sentry issue закрыты как resolved. На момент конца сессии — 0 unresolved issues.

### Phase 44 + Sentry (2026-04-07)

**Phase 44 — Промо-коды** (v1.5): design → plan → execute → deploy.
- DB: PromoCode, PromoActivation + Subscription.promoCodeId
- Backend: tRPC promo router (validate, activate, 4 admin CRUD), 5-step validation, $transaction
- /pricing: auth header, collapsible promo input, redirect /login?promo=КОД
- Admin: /admin/promo — create, table, deactivate, activations view

**Phase 29 — Sentry Monitoring**: @sentry/nextjs full stack.
- Org: mpstats-academy, project: maal-platform
- Client/server/edge config, global-error boundary, instrumentation hook
- Custom spans: CP webhooks, email webhook, OpenRouter LLM, Sentry Crons
- Alert rules: new issue + regression → email
- Performance transactions confirmed on prod ✓

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM model | GPT-4.1 Nano | QA: 12/15 good questions vs Qwen 5/15 |
| LLM fallback | Qwen 3.5 Flash | Cheaper, decent quality |
| Auth | Supabase Auth + Yandex ID | Google removed |
| tRPC batching | splitLink | AI queries (3-10s) must not block page render |
| RLS | ON + zero policies | All data via Prisma/service_role |
| Kinescope | Direct iframe | react-kinescope-player v0.5.4 broken |
| Video hosting | Kinescope | 405 videos, 209.4 GB |

## Commands

```bash
pnpm dev              # Dev server
pnpm build            # Production build
pnpm typecheck        # TypeScript check
pnpm test             # Unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm db:push          # Push schema
pnpm db:generate      # Generate Prisma client
pnpm db:studio        # Prisma Studio
pnpm lint             # ESLint
```

## Project Structure

```
MAAL/
├── apps/web/                 # Next.js 14 App Router
│   ├── src/app/
│   │   ├── (auth)/           # Login, register, verify, reset
│   │   ├── (main)/           # Dashboard, diagnostic, learn, profile
│   │   ├── (admin)/          # Admin panel
│   │   ├── api/              # tRPC, webhooks, cron
│   │   ├── legal/            # Offer, PDN, cookies
│   │   └── pricing/          # Billing + promo codes
│   ├── src/components/       # UI (shadcn), diagnostic, learning, shared, comments, pricing
│   ├── src/lib/              # trpc, supabase, auth, analytics, carrotquest, tours
│   └── tests/                # 24 unit + 31 E2E tests
├── packages/
│   ├── api/src/routers/      # profile, diagnostic, learning, ai, comments, billing, promo
│   ├── ai/src/               # openrouter, embeddings, retrieval, generation, question-generator
│   ├── db/prisma/            # Schema + migrations
│   └── shared/               # Types
├── scripts/                  # seed, ingest, SQL
├── docs/                     # SDD, test sessions, changelog, plans
└── .github/workflows/        # CI, supabase-keepalive, daily-cron
```

## Supabase

- Project: `saecuecevicwjkpmaoot.supabase.co`
- Auth: Email/Password + Yandex ID OAuth
- RLS: ON, zero policies (all via Prisma/service_role)
- Embeddings: text-embedding-3-small (1536 dims)
- Keep-alive: GitHub Action каждые 3 дня
- Details: `.claude/memory/supabase-details.md`

## Deploy

- VPS: **89.208.106.208** (deploy user, Docker Compose)
- Redeploy: `git pull && docker compose down && docker compose build --no-cache && docker compose up -d`
- Details: `.claude/memory/deploy-details.md`

## Gotchas

- `@kinescope/react-kinescope-player` **НЕ РАБОТАЕТ** — используется прямой iframe
- `NEXT_PUBLIC_*` вшиваются при build, не runtime
- Nginx `proxy_buffer_size 128k` обязателен для Supabase auth cookies
- CQ API: form-encoded, NOT JSON. Props через `setUserProps`, NOT `trackEvent` params
- **Node fetch к внешним API с VPS**: undici Happy Eyeballs пробует IPv6 (нет маршрута → ENETUNREACH), v4 cold-connect иногда таймаутит. Держим `NODE_OPTIONS=--dns-result-order=ipv4first` в `docker-compose.yml` + retry-обёртку для критичных вызовов (см. `YandexProvider.fetchWithRetry`)
- **Yandex OAuth — account picker**: только через `force_confirm=yes`. Стандартный `prompt=login` Yandex молча игнорирует
- Details: `.claude/memory/cq-integration.md`

## Staging Workflow

**URL:** https://staging.platform.mpstats.academy
**Basic Auth:** `team` / см. `Server auth.md` (локально, не в git)
**VPS:** 89.208.106.208, порт 3001, container `maal-staging-web`
**БД:** Shared с prod (Supabase). Тестовые аккаунты создавать с префиксом `staging-*@mpstats.academy`.

### Деплой фичи на staging

```bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git fetch origin
git checkout <branch>
docker compose -p maal-staging -f docker-compose.staging.yml up -d --build

# ВАЖНО: вернуть master ДО следующего prod-deploy
git checkout master
```

### Активные feature flags

| Флаг | Что включает | Статус |
|------|-------------|--------|
| `NEXT_PUBLIC_STAGING=true` | Жёлтая плашка STAGING, глушит Yandex Metrika | Постоянный (задан в docker-compose.staging.yml) |
| `NEXT_PUBLIC_SHOW_LIBRARY=true` | Library section на `/learn` | Demo Phase 46 — уберём когда Library выйдет на prod |

### Добавить новый флаг

1. `ARG NEXT_PUBLIC_SHOW_X` + `ENV NEXT_PUBLIC_SHOW_X=$NEXT_PUBLIC_SHOW_X` в `Dockerfile`
2. `NEXT_PUBLIC_SHOW_X: ${NEXT_PUBLIC_SHOW_X:-false}` в `docker-compose.staging.yml` args
3. В коде: `{process.env.NEXT_PUBLIC_SHOW_X === 'true' && <FeatureComponent />}`
4. Добавить флаг в таблицу выше + в `.env.staging` на VPS
5. Rebuild staging: `docker compose -p maal-staging -f docker-compose.staging.yml up -d --build`
6. **При выходе фичи на prod:** удалить флаг из кода + убрать из таблицы + `unset` в `.env.staging`

### Rollback / остановка staging

```bash
docker compose -p maal-staging -f docker-compose.staging.yml down
# Prod не задет (другое project name)
```

### Known limitations

- **Yandex OAuth на staging:** callback URL `https://staging.platform.mpstats.academy/api/auth/yandex/callback` нужно добавить в Yandex OAuth app + Supabase Auth Redirect URLs. Пока не добавили — использовать email/password логин
- **Supabase Site URL** — глобальный, настроен на prod. Email-ссылки (password reset, DOI) со staging будут вести на prod-домен. Не баг, фича shared-DB
- **CarrotQuest events** — летят в prod workspace. Фильтровать по `staging-*` префиксу email. Cleanup: условие `NEXT_PUBLIC_STAGING !== 'true'` у CQ-скрипта в `layout.tsx` если понадобится
- **Git branch на VPS:** после staging deploy **обязательно** `git checkout master` перед prod-deploy, иначе prod соберётся с чужим кодом
- **Публичный роадмеп:** запись о staging в `/roadmap` НЕ делаем (правило из `feedback_public_roadmap.md` — техничка не идёт в публичный changelog)

Детали nginx/certbot/troubleshooting: `.claude/memory/project_staging_environment.md`.

## QA

55 тестов (24 unit + 31 E2E), 0 failures. Test user: `tester@mpstats.academy`.
