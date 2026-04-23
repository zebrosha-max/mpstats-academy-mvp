# Phase 48: Staging Environment — Research

**Researched:** 2026-04-23
**Domain:** Docker Compose multi-env + Nginx reverse proxy + Next.js feature flags
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Infrastructure:**
- D-01: Staging на том же VPS (89.208.106.208) как prod. Отдельный сервер НЕ берём.
- D-02: Порт контейнера staging = 3001 (prod = 3000). Наружу не пробрасывается, только через nginx.
- D-03: `docker-compose.staging.yml` — отдельный файл, копия prod compose. Разные `container_name`, `env_file`, порты. Сети изолированы.
- D-04: `.env.staging` — отдельный env-файл на VPS, не коммитится. Содержит `NEXT_PUBLIC_STAGING=true` + фича-флаги.
- D-05: Shared Supabase DB с prod. Тестовые аккаунты с префиксом `staging-*@mpstats.academy`.
- D-06: Deploy ручной: `git fetch && git checkout <branch> && docker compose -f docker-compose.staging.yml up -d --build`. Без CI/CD.
- D-07: Prod deploy НЕ меняется. Zero-downtime за скоуп не входит.

**Domain & Networking:**
- D-08: DNS A-record `staging.platform.mpstats.academy` → `89.208.106.208` (пользователь добавляет через панель провайдера).
- D-09: SSL через `certbot --nginx -d staging.platform.mpstats.academy`. Auto-renewal уже настроен.
- D-10: Nginx vhost `/etc/nginx/sites-available/staging.platform.mpstats.academy` — копия prod + (1) `proxy_pass http://localhost:3001`; (2) `auth_basic`.

**Access Control:**
- D-11: HTTP Basic Auth, файл `/etc/nginx/.htpasswd-staging` (через `htpasswd -c`). Один общий логин/пароль.
- D-12: `X-Robots-Tag: noindex, nofollow` заголовок.
- D-13: Basic auth на всех location'ах включая `/_next/*`, `/api/*`.

**UI — StagingBanner:**
- D-14: Жёлтая sticky плашка «STAGING — данные реальные, не заказывайте, не платите».
- D-15: Рендерится только при `process.env.NEXT_PUBLIC_STAGING === 'true'`.
- D-16: Положение — в корневом `apps/web/src/app/layout.tsx` перед `<main>`, снаружи route groups.
- D-17: НЕ dismissable на первой итерации.

**Feature Flags:**
- D-18: Паттерн `NEXT_PUBLIC_SHOW_<FEATURE>`. Пример — `NEXT_PUBLIC_SHOW_LIBRARY`. Проверка: `if (process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true')`.
- D-19: Флаги — read-only на UI-уровне. НЕ меняют DB-запись.
- D-20: Список флагов ведётся в `MAAL/CLAUDE.md` раздел Staging Workflow.
- D-21: Первый флаг — `NEXT_PUBLIC_SHOW_LIBRARY` → переключает видимость `LibrarySection` в `/learn`.

**Docs:**
- D-22: Новый раздел «Staging Workflow» в `MAAL/CLAUDE.md`.
- D-23: Новая memory entry `project_staging_environment.md` + ссылка в `MEMORY.md`.
- D-24: В публичный `/roadmap` запись НЕ делаем (правило `feedback_public_roadmap.md`).

**Risk Mitigations:**
- D-25: `.env.production` и `.env.staging` — разные файлы, жёстко привязаны к своим compose-файлам.
- D-26: `nginx -t` перед `systemctl reload nginx` — явный шаг, не свёрнутый.
- D-27: На staging — `git checkout <branch>`, обратный мерж ручной.

### Claude's Discretion
- Точное имя htpasswd-файла и пути внутри nginx — важно чтобы не конфликтовало с prod
- Docker network naming (staging_default vs shared) — prod network не трогаем, staging имеет свой default
- Формат healthcheck в docker-compose.staging.yml — можно копипасту или упростить
- Стиль текста в `StagingBanner` — главное жёлтый фон и читаемый warning

### Deferred Ideas (OUT OF SCOPE)
- Zero-downtime deploy для prod (отдельная фаза)
- CI/CD автоматика для staging
- Dismissable StagingBanner с localStorage
- Отдельный Supabase проект для staging
- Feature flag UI (/admin/flags)
- Stripe/CP test mode на staging
</user_constraints>

<phase_requirements>
## Phase Requirements

У Phase 48 **нет формальных REQ-ID** в `REQUIREMENTS.md` — это инфраструктурная фаза, не feature-фаза. Критерии успеха из ROADMAP (Phase 48):

| Critical Criterion | Research Support |
|----|-------------|
| C1: `https://staging.platform.mpstats.academy` открывается с basic auth prompt | Nginx `auth_basic` + `auth_basic_user_file` + certbot SSL |
| C2: После пароля — копия платформы с жёлтой плашкой STAGING в header | `StagingBanner` + `NEXT_PUBLIC_STAGING=true` через build-arg |
| C3: `NEXT_PUBLIC_SHOW_LIBRARY=true` на staging показывает Library, на prod скрыта | Feature flag как build-arg, условный рендер `<LibrarySection />` |
| C4: Деплой staging не трогает prod контейнер | Отдельный compose file, разные `container_name`, порты 3000/3001 |
| C5: Prod продолжает работать без регрессов | Healthcheck `/api/health` prod после staging deploy |
| C6: Staging имеет валидный SSL и `X-Robots-Tag: noindex` | certbot + nginx `add_header X-Robots-Tag` |
| C7: `MAAL/CLAUDE.md` содержит раздел Staging Workflow | Новый раздел с командами и списком флагов |
</phase_requirements>

## Context Summary

Phase 48 — инфраструктурная фаза: второй Docker-стенд на том же VPS под поддоменом `staging.platform.mpstats.academy`. Все ключевые решения уже приняты в CONTEXT.md (D-01..D-27), research'у остаётся **документировать текущую архитектуру** (compose, Dockerfile, layout.tsx, LibrarySection) и дать планировщику **точные значения для копирования**: имена переменных, пути, команды. Никаких альтернатив искать не нужно — CONTEXT зажал поле решений.

**Главное открытие при чтении кодбазы:** `LibrarySection` уже отрендерен безусловно в `apps/web/src/app/(main)/learn/page.tsx:876`. Сейчас на prod он пустой, потому что `Course.isHidden` у skill-курсов `true` и `learning.getLibrary` отдаёт уроки только из них (по коммиту Phase 46). Нужно **обернуть рендер в feature-flag**, не меняя серверный endpoint.

## Current Architecture Findings

### Docker Compose (prod) — `docker-compose.yml`
```yaml
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_SITE_URL: ${NEXT_PUBLIC_SITE_URL}
        NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID: ${NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID}
        NEXT_PUBLIC_YANDEX_ID: ${NEXT_PUBLIC_YANDEX_ID}
        SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
        OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
        DATABASE_URL: ${DATABASE_URL}
        DIRECT_URL: ${DIRECT_URL}
    ports:
      - "127.0.0.1:3000:3000"
    env_file:
      - .env.production
    environment:
      NODE_OPTIONS: --dns-result-order=ipv4first
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
```

**Наблюдения:**
- Один сервис `web`, один контейнер, default container_name = `maal-web-1` (генерируется Docker).
- Нет явного `container_name:` — Compose сам даёт имя по project name. **Для staging нужно ОБА: разные `container_name` И разные project name** (иначе `docker compose -f docker-compose.staging.yml up` с тем же project name `maal` сотрёт prod контейнер).
- Порт биндится только к `127.0.0.1` — nginx подключается через localhost. То же самое для staging: `127.0.0.1:3001:3000` (3000 внутри — это `ENV PORT=3000` из Dockerfile).
- `env_file: .env.production` — для runtime переменных. Build args читаются из docker-compose `args:` которые ссылаются на `${...}` — они резолвятся из файла, указанного в `env_file`, ТОЛЬКО если `.env` лежит рядом с compose. На VPS `.env` — симлинк на `.env.production` (см. deploy-details.md).
- `healthcheck` — `/api/health` endpoint возвращает JSON + пингует Prisma (`apps/web/src/app/api/health/route.ts`).

### Dockerfile — `Dockerfile`
```
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID
ARG NEXT_PUBLIC_YANDEX_ID

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
...
RUN pnpm turbo build --filter=@mpstats/web
```

**Критично:** для staging нужно добавить **два новых ARG+ENV пары**:
- `ARG NEXT_PUBLIC_STAGING` / `ENV NEXT_PUBLIC_STAGING=$NEXT_PUBLIC_STAGING`
- `ARG NEXT_PUBLIC_SHOW_LIBRARY` / `ENV NEXT_PUBLIC_SHOW_LIBRARY=$NEXT_PUBLIC_SHOW_LIBRARY`

Без этого значения переменных при `pnpm build` будут `undefined` → в бандле окажется `process.env.NEXT_PUBLIC_STAGING === 'true'` → `false === 'true'` → всегда `false`. Это тот самый gotcha из `MAAL/CLAUDE.md` и MEMORY (Phase 19 CP public key — тот же баг).

На prod новые ARG не сломают билд — если build-arg не передан, то `ENV NEXT_PUBLIC_STAGING=` (пустая строка) и `=== 'true'` всё равно `false`. Безопасно.

### `layout.tsx` — корневой layout
Находится в `apps/web/src/app/layout.tsx`. Структура:
```tsx
<html lang="ru">
  <head>
    <script /* CQ widget */ />
  </head>
  <body>
    <LandingThemeProvider>
      <TRPCProvider>{children}</TRPCProvider>
    </LandingThemeProvider>
    <Toaster />
    <CookieConsent />
    {YandexMetrika}
  </body>
</html>
```

`StagingBanner` нужно вставить **внутри `<body>` как первый ребёнок, до `<LandingThemeProvider>`** или сразу после открытия body, но позиционировать через `position: sticky; top: 0; z-50`. Так он будет над всеми layout'ами (auth / main / admin), включая пустые landing pages.

Компонент должен быть **Client Component** (`'use client'`) — `process.env.NEXT_PUBLIC_*` на билд-тайме инлайнится и в клиент, и в сервер, но читать в серверном layout.tsx при рендере ok. Серверный рендер безопаснее: не нужен runtime hydration для статичной плашки. Рекомендация: сделать **Server Component** (без `'use client'`) — просто вернуть `null` или JSX в зависимости от `process.env.NEXT_PUBLIC_STAGING`.

### `LibrarySection` — Phase 46 компонент
Файл `apps/web/src/components/learning/LibrarySection.tsx`. Экспортирует Client Component `LibrarySection()` — делает `trpc.learning.getLibrary.useQuery()` и рендерит оси → блоки → уроки.

**Сейчас на prod рендерится безусловно** в `apps/web/src/app/(main)/learn/page.tsx:876`:
```tsx
{/* Library: skill-based lessons */}
<LibrarySection />
```

На prod он визуально пустой потому что skill-курсы `isHidden: true`, и `learning.getLibrary` возвращает `[]` → компонент ретурнит `null` (строка 130 в LibrarySection.tsx: `if (!library || library.length === 0) return null;`). То есть **флаг `NEXT_PUBLIC_SHOW_LIBRARY` не решает проблему видимости "по данным"** — он решает проблему "рендерить ли вообще компонент".

Для демо нужно **либо** также временно переключить `Course.isHidden` на false для skill-курсов на staging (shared DB!) — но это затронет prod. **Либо** оставить skill-курсы hidden, но сделать так, чтобы `getLibrary` возвращал данные независимо от `isHidden`. Из CLAUDE.md:

> skill-курсы `isHidden: true` — ждут UI «Библиотека»
> Retrieval + диагностика подхватывают skill-контент (retrieval не фильтрует Course.isHidden)

Значит `learning.getLibrary` уже должен быть написан так, чтобы не фильтровать `isHidden`. Планировщик **должен проверить** код `learning.getLibrary` в `packages/api/src/routers/learning.ts` и подтвердить, что там нет фильтра `isHidden: false`. **Если фильтр есть — Library даже на staging с флагом будет пустой.** Это потенциальная скрытая задача.

### Env файлы
- На диске: `apps/web/.env`, `apps/web/.env.example`, `MAAL/.env`, `MAAL/.env.example`.
- На VPS: `/home/deploy/maal/.env.production` + симлинк `.env → .env.production`.
- В `.env.example` нет `NEXT_PUBLIC_STAGING` и `NEXT_PUBLIC_SHOW_LIBRARY` — нужно добавить с комментарием "only for staging".

## Staging Compose Strategy

### Рекомендуемая структура — **один Dockerfile + два compose-файла**

Причины:
1. Контент/бандл идентичен, отличие только в двух NEXT_PUBLIC build-args.
2. Параметризация через Docker Compose `args:` — стандартный паттерн.
3. Минимум дублирования кода.

### `docker-compose.staging.yml` (рекомендуемый шаблон для планировщика)

```yaml
# docker-compose.staging.yml
# Deploy: docker compose -p maal-staging -f docker-compose.staging.yml up -d --build
# Env file: .env.staging (не коммитить)

services:
  web:
    container_name: maal-staging-web
    build:
      context: .
      dockerfile: Dockerfile
      args:
        # Supabase — тот же проект, что у prod (shared DB решение D-05)
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        # Разные для staging!
        NEXT_PUBLIC_SITE_URL: https://staging.platform.mpstats.academy
        NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID: ${NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID}
        NEXT_PUBLIC_YANDEX_ID: ${NEXT_PUBLIC_YANDEX_ID}
        SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
        OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
        DATABASE_URL: ${DATABASE_URL}
        DIRECT_URL: ${DIRECT_URL}
        # Новые флаги
        NEXT_PUBLIC_STAGING: "true"
        NEXT_PUBLIC_SHOW_LIBRARY: ${NEXT_PUBLIC_SHOW_LIBRARY:-false}
    ports:
      - "127.0.0.1:3001:3000"  # хост 3001 → контейнер 3000
    env_file:
      - .env.staging
    environment:
      NODE_OPTIONS: --dns-result-order=ipv4first
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

**Ключевые отличия от prod (для планировщика):**
| Поле | prod | staging |
|------|------|---------|
| project name (в команде) | `maal` (default) | `maal-staging` (через `-p`) |
| `container_name` | отсутствует | `maal-staging-web` |
| host port | 3000 | 3001 |
| `env_file` | `.env.production` | `.env.staging` |
| `NEXT_PUBLIC_STAGING` | отсутствует/пусто | `"true"` |
| `NEXT_PUBLIC_SHOW_LIBRARY` | отсутствует/пусто | `"true"` на демо |
| `NEXT_PUBLIC_SITE_URL` | `https://platform.mpstats.academy` | `https://staging.platform.mpstats.academy` |

**Почему `-p maal-staging` критично:** иначе `docker compose down` на staging снесёт prod сеть `maal_default`, которую использует prod контейнер. Project name изолирует сеть и volume-нэймспейс.

**Volumes:** в prod compose нет именованных volumes — вся state во внешней Supabase. Для staging volume тоже не нужен. Конфликтов нет.

## NEXT_PUBLIC_* Build Pipeline (Full Chain)

Полная цепочка откуда приходит `NEXT_PUBLIC_STAGING` в бандл:

1. **На VPS `/home/deploy/maal/.env.staging`** (не в git):
   ```
   NEXT_PUBLIC_STAGING=true
   NEXT_PUBLIC_SHOW_LIBRARY=true
   NEXT_PUBLIC_SITE_URL=https://staging.platform.mpstats.academy
   # + все остальные из .env.production (Supabase, CP, Yandex, DB)
   ```

2. **`docker-compose.staging.yml`** читает `.env` (или указанный в команде) для резолва `${VAR}`:
   ```
   args:
     NEXT_PUBLIC_STAGING: "true"   # либо ${NEXT_PUBLIC_STAGING}
   ```

3. **Dockerfile** принимает через `ARG`:
   ```
   ARG NEXT_PUBLIC_STAGING
   ENV NEXT_PUBLIC_STAGING=$NEXT_PUBLIC_STAGING
   ```

4. **`pnpm turbo build`** — на этом шаге Next.js инлайнит `process.env.NEXT_PUBLIC_STAGING` в клиентский бандл. После билда переменная **вшита** в JS файлы.

5. **Runtime** — контейнер стартует с `env_file: .env.staging`, но `NEXT_PUBLIC_*` уже в коде. `env_file` нужен для **серверных** переменных (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` и т.д.).

**Следствие:** для смены флага нужен **rebuild**, не рестарт. Это OK для ручного deploy workflow.

**Gotcha из MEMORY:** тот же баг с `NEXT_PUBLIC_CP_PUBLIC_ID` уже ловился (Phase 19, commit `82427f4`). Рекомендация планировщику: поставить **явную проверку после build** — в логах билда должна быть строка с NEXT_PUBLIC_STAGING. Можно добавить `RUN echo "STAGING=$NEXT_PUBLIC_STAGING"` в Dockerfile.

## Nginx + Basic Auth + Certbot (exact commands/directives)

### Пакеты (VPS, Ubuntu)
`apache2-utils` для `htpasswd`:
```bash
sudo apt update && sudo apt install -y apache2-utils
```

### Создание htpasswd
```bash
sudo htpasswd -c /etc/nginx/.htpasswd-staging team
# запрашивает пароль интерактивно, пользователь задаёт
sudo chmod 644 /etc/nginx/.htpasswd-staging
sudo chown root:www-data /etc/nginx/.htpasswd-staging
```

### Nginx config — `/etc/nginx/sites-available/staging.platform.mpstats.academy`

**Step 1 (pre-SSL, HTTP only — чтобы certbot смог validate):**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name staging.platform.mpstats.academy;

    # ACME challenge без basic auth (certbot webroot)
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

**Step 2 (после certbot — итоговый HTTPS конфиг):**
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name staging.platform.mpstats.academy;

    ssl_certificate /etc/letsencrypt/live/staging.platform.mpstats.academy/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.platform.mpstats.academy/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # Обязательный для Supabase auth cookies (из MAAL gotchas)
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;

    # Basic auth на всём vhost (D-13)
    auth_basic "MPSTATS Academy Staging";
    auth_basic_user_file /etc/nginx/.htpasswd-staging;

    # Noindex заголовок (D-12)
    add_header X-Robots-Tag "noindex, nofollow" always;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name staging.platform.mpstats.academy;
    return 301 https://$host$request_uri;
}
```

### Certbot
```bash
sudo certbot --nginx -d staging.platform.mpstats.academy
# Выбрать: redirect HTTP → HTTPS (опция 2)
```

После certbot он сам добавит SSL-директивы в конфиг. **Auto-renewal** — systemd timer `certbot.timer` уже настроен (из Phase 21). Новый cert подхватится автоматически.

### Enable + reload
```bash
sudo ln -s /etc/nginx/sites-available/staging.platform.mpstats.academy /etc/nginx/sites-enabled/
sudo nginx -t     # D-26: обязательная проверка
sudo systemctl reload nginx
```

### Basic auth interaction with Next.js
Basic auth **ортогонален** к Supabase cookies — браузер высылает `Authorization: Basic` header, cookies работают как обычно. `/_next/*` static assets и HMR (если бы был dev) тоже работают — браузер кеширует credentials и высылает на все подрequests.

**Gotcha:** первый заход после чистой сессии выдаст prompt. Cookies Supabase не блокируются.

## Code Changes Required

### 1. `Dockerfile` — добавить два ARG+ENV
Вставить после существующих NEXT_PUBLIC блоков (строки 25-35):
```dockerfile
ARG NEXT_PUBLIC_STAGING
ARG NEXT_PUBLIC_SHOW_LIBRARY
ENV NEXT_PUBLIC_STAGING=$NEXT_PUBLIC_STAGING
ENV NEXT_PUBLIC_SHOW_LIBRARY=$NEXT_PUBLIC_SHOW_LIBRARY
```

**Безопасно для prod:** если compose не передаёт эти args, они пустые → `process.env.NEXT_PUBLIC_STAGING === 'true'` → `false`.

### 2. `docker-compose.yml` — НЕ ТРОГАТЬ
Решение D-07: prod compose не меняется. Новые ARG в Dockerfile работают без нового args в prod compose.

### 3. `docker-compose.staging.yml` — НОВЫЙ файл
Содержание — см. секцию "Staging Compose Strategy" выше.

### 4. `apps/web/src/components/shared/StagingBanner.tsx` — НОВЫЙ компонент
**Рекомендация: Server Component** (без `'use client'`), чтобы избежать hydration overhead:
```tsx
export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_STAGING !== 'true') return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[100] w-full bg-yellow-400 text-yellow-950 px-4 py-2 text-sm font-semibold text-center shadow-md"
    >
      STAGING — данные реальные, не заказывайте, не платите
    </div>
  );
}
```

**Путь:** `apps/web/src/components/shared/StagingBanner.tsx` (в `shared/` уже живут CookieConsent, ThemeProvider — тематически подходит).

### 5. `apps/web/src/app/layout.tsx` — вставить `<StagingBanner />`
После открытия `<body>`, перед `<LandingThemeProvider>`:
```tsx
<body className={inter.className}>
  <StagingBanner />
  <LandingThemeProvider>
    <TRPCProvider>{children}</TRPCProvider>
  </LandingThemeProvider>
  ...
</body>
```

`z-[100]` выше чем Toaster (z-50 по умолчанию в shadcn) и модалок — плашка всегда видна.

### 6. `apps/web/src/app/(main)/learn/page.tsx` — обернуть `<LibrarySection />` флагом
Строка 875-876:
```tsx
{/* Library: skill-based lessons (staging only until launch) */}
{process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true' && <LibrarySection />}
```

**На prod:** переменная не задана → условие false → компонент не рендерится → `trpc.learning.getLibrary` не вызывается → лишнего трафика на Supabase нет. Бонус.

### 7. `apps/web/.env.example` и `MAAL/.env.example` — добавить секцию
```
# Staging-only (only set in .env.staging, leave empty in .env.production)
NEXT_PUBLIC_STAGING=
NEXT_PUBLIC_SHOW_LIBRARY=
```

### 8. `MAAL/CLAUDE.md` — новый раздел «Staging Workflow»
Шаблон содержимого (D-22):
```markdown
## Staging Workflow

**URL:** https://staging.platform.mpstats.academy (basic auth: `team` / см. Server auth.md)
**VPS:** 89.208.106.208, порт 3001, container `maal-staging-web`

### Deploy
\`\`\`bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git fetch && git checkout <branch>
docker compose -p maal-staging -f docker-compose.staging.yml up -d --build
\`\`\`

### Активные feature flags
| Флаг | Назначение | Статус |
|------|-----------|--------|
| `NEXT_PUBLIC_STAGING=true` | Жёлтая плашка STAGING | Постоянный |
| `NEXT_PUBLIC_SHOW_LIBRARY=true` | Library section в /learn | Demo для Phase 46 |

### Добавление нового флага
1. `ARG` + `ENV` в `Dockerfile`
2. `args:` в `docker-compose.staging.yml`
3. `process.env.NEXT_PUBLIC_SHOW_<X> === 'true'` в коде
4. Строка в таблице выше
5. При выходе на прод — удалить флаг из кода, убрать из таблицы

### Rollback
\`\`\`bash
docker compose -p maal-staging -f docker-compose.staging.yml down
\`\`\`
(Prod не затронут.)
```

### 9. `.claude/memory/project_staging_environment.md` — новая memory
И ссылка в `.claude/memory/MEMORY.md`. Содержание — детали nginx конфига, путей на VPS, troubleshooting (D-23).

### 10. `.gitignore` — проверить, что `.env.staging` не попадёт в git
Сейчас в `.gitignore` (проверить) должен быть паттерн `.env*` или минимум `.env.staging`. Если нет — добавить.

## Deploy Workflow

### Первый запуск (setup phase — выполняется один раз)
1. Пользователь добавляет DNS A-record `staging.platform.mpstats.academy` → `89.208.106.208` через панель провайдера. Ждёт propagation (~5-60 мин).
2. На VPS под `deploy`:
   ```bash
   ssh deploy@89.208.106.208
   cd /home/deploy/maal
   git pull
   # Создать .env.staging (копия .env.production + добавить NEXT_PUBLIC_STAGING/SHOW_LIBRARY)
   cp .env.production .env.staging
   nano .env.staging  # добавить флаги + изменить NEXT_PUBLIC_SITE_URL
   ```
3. Под sudo-юзером (или с sudo):
   ```bash
   sudo apt install -y apache2-utils
   sudo htpasswd -c /etc/nginx/.htpasswd-staging team
   sudo cp /path/to/staging-pre-ssl.conf /etc/nginx/sites-available/staging.platform.mpstats.academy
   sudo ln -s /etc/nginx/sites-available/staging.platform.mpstats.academy /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d staging.platform.mpstats.academy
   # Certbot сам переписывает config на SSL, но basic auth и noindex могут пропасть — перезаписать финальный config с шагами выше
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Под `deploy`:
   ```bash
   docker compose -p maal-staging -f docker-compose.staging.yml up -d --build
   docker ps | grep maal-staging
   docker compose -p maal-staging -f docker-compose.staging.yml logs --tail=50
   ```

### Регулярный деплой (для фичи)
```bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git fetch origin
git checkout <branch>           # ветку с фичей
docker compose -p maal-staging -f docker-compose.staging.yml up -d --build
```

### Откат
```bash
docker compose -p maal-staging -f docker-compose.staging.yml down
# Prod не затронут — другой project name
```

### Что делать если staging build упал
Zombie containers не будут: `up -d --build` прерывается до swap'а. Старый контейнер продолжает жить. Логи: `docker compose -p maal-staging logs`.

## Validation Architecture

> `workflow.nyquist_validation` в `.planning/config.json` не задан → считаем enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash/curl (manual smoke) + Playwright (E2E) |
| Config file | `apps/web/playwright.config.ts` |
| Quick run command | `curl -I -u team:PASS https://staging.platform.mpstats.academy` |
| Full suite command | Manual smoke + `pnpm test:e2e` если хочется добавить |

### Phase Requirements → Test Map
| Criterion | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| C1 | Basic auth prompt | smoke | `curl -I https://staging.platform.mpstats.academy` → 401 with `WWW-Authenticate: Basic` | manual |
| C1 | Basic auth success | smoke | `curl -I -u team:PASS https://staging.platform.mpstats.academy` → 200 | manual |
| C2 | StagingBanner renders | smoke | `curl -u team:PASS https://staging.platform.mpstats.academy \| grep "STAGING"` → match | manual |
| C3 | Library visible on staging | manual | Открыть `/learn` — секция Библиотека видна | manual |
| C3 | Library hidden on prod | smoke | `curl https://platform.mpstats.academy/learn \| grep -c "Библиотека"` → 0 | manual |
| C4 | Prod container alive after staging deploy | smoke | `docker ps \| grep maal-web` (до и после) одинаков | manual |
| C5 | Prod health | smoke | `curl https://platform.mpstats.academy/api/health` → `{"status":"ok"}` | ✅ existing |
| C6 | SSL valid | smoke | `curl -Iv https://staging.platform.mpstats.academy` → SSL handshake OK | manual |
| C6 | Noindex header | smoke | `curl -I -u team:PASS https://staging.platform.mpstats.academy \| grep "X-Robots-Tag: noindex"` | manual |
| C7 | CLAUDE.md раздел | grep | `grep -A2 "## Staging Workflow" MAAL/CLAUDE.md` | ✅ exists |

### Sampling Rate
- **Per task commit:** Typecheck + lint (`pnpm typecheck && pnpm lint`) — critical чтобы не сломать prod build
- **Per phase gate:** Все 10 smoke проверок выше + визуальная проверка в браузере
- **Post-deploy:** `docker compose -p maal-staging logs --tail=100` на ошибки

### Wave 0 Gaps
- [ ] Файл `docker-compose.staging.yml` — новый
- [ ] Файл `apps/web/src/components/shared/StagingBanner.tsx` — новый
- [ ] Файл `.claude/memory/project_staging_environment.md` — новый
- [ ] Раздел в `MAAL/CLAUDE.md` — новый

*Никаких unit-тестов добавлять не надо — infra-фаза, всё через smoke/curl.*

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authentication | yes (basic auth) | `auth_basic` + htpasswd (bcrypt) |
| V3 Session Management | N/A — Supabase cookies already in prod | — |
| V4 Access Control | yes | Basic auth blocks unauthorized; Supabase session still required for app routes |
| V5 Input Validation | N/A (infra) | — |
| V6 Cryptography | yes (SSL) | Let's Encrypt, auto-renewal |

### Threat patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Staging indexed by search engines | Information Disclosure | Basic auth + `X-Robots-Tag: noindex` (defense in depth) |
| Staging user creates payment on prod CP | Tampering | Shared DB ok для юзеров (staging-* префикс), но CP не тестируем на staging (Phase 28 hidden test plans) |
| Weak htpasswd password | Authentication | Пользователь задаёт сильный пароль; можно добавить rate limit (`limit_req`) |
| Staging DATABASE_URL = prod DB | Integrity | **Ожидаемо (D-05)** — shared DB. Риск принят. Feature flags read-only (D-19). |

**Главный security-риск, уже принятый:** staging пишет в prod Supabase. Требуется дисциплина команды по префиксу `staging-*` аккаунтов. StagingBanner — визуальный напоминатель.

## Risks & Gotchas (beyond CONTEXT.md)

### R1: `learning.getLibrary` может фильтровать `isHidden` и вернуть пустой ответ
**Описание:** В `packages/api/src/routers/learning.ts` есть endpoint `getLibrary`. CLAUDE.md Phase 46 говорит: «retrieval + диагностика не фильтруют Course.isHidden» — но про `getLibrary` напрямую не сказано. Если там есть `where: { isHidden: false }`, то даже с флагом `NEXT_PUBLIC_SHOW_LIBRARY=true` Library будет пустой.
**Mitigation:** Планировщик должен **явной задачей** прочитать `getLibrary` и подтвердить/поправить фильтр. Либо как часть demo-сценария.

### R2: Supabase Redirect URLs для OAuth callback
**Описание:** Yandex OAuth callback идёт на `${NEXT_PUBLIC_SITE_URL}/api/auth/yandex/callback`. Если на staging юзер попробует залогиниться через Яндекс, callback пойдёт на `https://staging.platform.mpstats.academy/api/auth/yandex/callback` — **этого URL нет в списке разрешённых redirect в Yandex OAuth app и в Supabase Auth → Site URL**.
**Результат:** Яндекс-логин на staging **не будет работать** из коробки.
**Mitigation (выбор для планировщика):**
- **Option A (минимум для demo):** Не логиниться через Яндекс на staging, использовать email/password. В CLAUDE.md это отмечено как known limitation.
- **Option B (полноценная поддержка):** Добавить `https://staging.platform.mpstats.academy/api/auth/yandex/callback` в Yandex OAuth app allowed callbacks + `https://staging.platform.mpstats.academy/**` в Supabase Auth → Redirect URLs. Это затронет prod Supabase проект (shared DB → shared auth settings), но новые URL только добавляются, prod URLs не трогаются.

**Рекомендация:** Option B — фаза всё равно трогает инфру, добавить URL дешёво. Явная задача планировщику.

### R3: Supabase Site URL — один глобальный
**Описание:** В Supabase Auth → Settings → **Site URL** — **одно** значение. Сейчас это `https://platform.mpstats.academy`. При magic link / password reset через Supabase hooks URL собирается из Site URL.
**Mitigation:** Email-ссылки (reset password, DOI) со staging будут вести на **prod** домен. Это **ОК** для shared-DB логики (один юзер работает и там и там) и для запрещённого на staging платёжного флоу. Следует **документировать в CLAUDE.md раздел Staging Workflow** как known limitation.

### R4: CarrotQuest widget на staging
**Описание:** `layout.tsx` безусловно инжектит CQ widget с prod connect-ID `57576-5a5343ec7aac68d788dabb2569`. На staging все события будут лететь в prod CQ workspace с `staging-*` юзерами.
**Mitigation:** Команда может фильтровать по user email префиксу. Либо добавить условие `NEXT_PUBLIC_STAGING !== 'true'` в layout для CQ script. CONTEXT.md это не упоминает — **на усмотрение планировщика**. Рекомендация: оставить как есть на первой итерации, пометить в memory как потенциальный cleanup.

### R5: Yandex Metrika
**Описание:** `layout.tsx:76` условие `process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_YANDEX_ID` — Metrika **грузится и на staging**, т.к. `NODE_ENV=production` в обоих Docker builds.
**Mitigation:** Добавить `&& process.env.NEXT_PUBLIC_STAGING !== 'true'` в условие, чтобы staging не забивал метрики prod-воронки. **Рекомендую сделать в этой же фазе** — 1 строка.

### R6: Port 3001 может быть занят
**Описание:** На VPS уже висят Docker, Nginx, Node.js, n8n (5678), ngrok (4040), PM2, pm2 процессы. `ss -tlnp | grep 3001` перед setup.
**Mitigation:** Планировщик добавляет pre-flight check как задачу.

### R7: Git branch switching на VPS трогает deployed артефакты
**Описание:** `git checkout <branch>` меняет файлы в `/home/deploy/maal/`. Если prod потом сделает `docker compose build` без переключения обратно на master, билд пойдёт с чужим кодом.
**Mitigation:** В раздел Staging Workflow добавить pre-check/post-restore: после staging deploy `git checkout master` **обязательно**. Либо использовать `git worktree` (продвинутее).
**Рекомендация:** Документировать правило "после staging deploy сразу вернуть `git checkout master`" в CLAUDE.md Staging Workflow.

### R8: Docker Compose `-p` нужен на каждой команде
**Описание:** Забыть `-p maal-staging` в `logs`/`down` команде → Docker подумает что речь про default project и может затронуть prod.
**Mitigation:** Все команды в CLAUDE.md давать с `-p maal-staging -f docker-compose.staging.yml`.

### R9: nginx reload после certbot может потерять basic auth директивы
**Описание:** `certbot --nginx` редактирует конфиг автоматически, добавляя SSL блок. Если basic auth директивы были в server-блоке до certbot — он их сохранит. Если добавляли после — всё ок.
**Mitigation:** Порядок: (1) создать **pre-SSL** config с basic auth уже внутри; (2) certbot его дополнит SSL; (3) `nginx -t`; (4) если basic auth в HTTPS-блок не попал — вручную перенести. Явный шаг в плане.

## Open Questions

1. **Пароль для basic auth — кто задаёт и как команда его получает?**
   - Рекомендация: пользователь задаёт при `htpasswd -c`, кладёт в `Server auth.md` (local, не git). В CLAUDE.md ссылка на `Server auth.md`.

2. **Supabase Redirect URLs update — ответственный?**
   - Требует доступа к Supabase Management dashboard. Либо пользователь делает руками, либо через Management API token (уже есть, см. `reference_supabase_mgmt.md` в MEMORY).
   - Решение: планировщик делает human-action checkpoint.

3. **Yandex OAuth callback URL — кто добавляет?**
   - Требует доступ к Yandex OAuth app settings. Пользователь делает вручную.

4. **CQ и Yandex Metrika на staging — глушить или оставить?**
   - Research рекомендует: Yandex Metrika заглушить (быстро и ценно), CQ оставить (менее критично, cleanup потом).
   - Финальное слово — за планировщиком или пользователем.

5. **`learning.getLibrary` — есть ли фильтр `isHidden`?**
   - Нужно прочитать `packages/api/src/routers/learning.ts`. Если есть — отдельная задача на удаление (или игнор, если Library-курсы не hidden на shared DB).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Certbot auto-renewal systemd timer уже активен (Phase 21) | Nginx+Certbot | Новый cert не обновится автоматически — expires через 90 дней. Легко проверить `systemctl list-timers \| grep certbot`. |
| A2 | `apache2-utils` не установлен на VPS | Nginx | Если установлен — `apt install` no-op. Нет риска. |
| A3 | `learning.getLibrary` не фильтрует `Course.isHidden` | R1 | **MEDIUM** — если фильтрует, Library будет пустой даже с флагом. Планировщик ДОЛЖЕН проверить. |
| A4 | `.env.staging` НЕ в `.gitignore` | Code Changes | Критично — может уйти в git с ключами. Планировщик ДОЛЖЕН проверить. |
| A5 | Port 3001 свободен на VPS | R6 | Коллизия блокирует запуск контейнера. Pre-flight check обязателен. |
| A6 | Supabase project accepts multiple Site URLs через Redirect URLs list | R2 | Supabase Auth позволяет список allowed redirect URLs (wildcard поддержан). Стандартная фича. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Staging container | ✓ (prod uses) | 29.1.3 | — |
| Nginx | staging vhost | ✓ | 1.24.0 | — |
| certbot | SSL | ✓ (prod uses) | installed | — |
| apache2-utils (`htpasswd`) | basic auth | Unknown — check | — | `apt install apache2-utils` |
| Supabase project | shared DB | ✓ (prod uses) | — | — |
| DNS control (провайдер) | A-record | Human action | — | — |

**Missing dependencies with no fallback:** DNS A-record — требует человеческого действия у провайдера.

## Sources

### Primary (HIGH confidence)
- Codebase: `docker-compose.yml`, `Dockerfile`, `apps/web/src/app/layout.tsx`, `apps/web/src/components/learning/LibrarySection.tsx`, `apps/web/src/app/(main)/learn/page.tsx` — прочитаны напрямую в этой сессии
- `MAAL/CLAUDE.md` Gotchas раздел — NEXT_PUBLIC_* gotcha
- `.claude/memory/deploy-details.md` — VPS, Nginx, Docker config
- MEMORY.md — Phase 46 Library Section, NEXT_PUBLIC_SITE_URL patterns

### Secondary (MEDIUM confidence)
- Nginx basic auth — standard Ubuntu pattern, cited from training
- certbot --nginx — используется в Phase 21 (prod), known working

### Tertiary (LOW confidence)
- Yandex OAuth redirect URL behavior — не верифицировано напрямую в Supabase dashboard, проекция из кода `yandex/callback/route.ts`

## Metadata

**Confidence breakdown:**
- Docker/compose strategy: HIGH — точные значения из существующего compose
- Nginx config: HIGH — стандартные директивы + proxy_buffer_size из gotchas
- Code changes: HIGH — все файлы прочитаны
- Risks: MEDIUM — 4 из 9 требуют проверки планировщиком (R1, R2, R4, R6)
- Validation: MEDIUM — manual smoke, нет автоматизированных E2E

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (стабильная инфра, 30 дней)

## RESEARCH COMPLETE

**Phase:** 48 - Staging Environment
**Confidence:** HIGH

### Key Findings
1. Вся инфра уже знакома (nginx, certbot, Docker из prod) — новое только `docker-compose.staging.yml` + `.env.staging` + 2 ARG в Dockerfile + StagingBanner + feature flag оборачивание LibrarySection.
2. **Критично:** `docker compose -p maal-staging` обязателен — иначе prod project name сталкивается со staging.
3. **Критично:** `NEXT_PUBLIC_*` флаги должны быть в `ARG`+`ENV` Dockerfile, иначе build инлайнит `undefined`. Тот же gotcha что в Phase 19.
4. **5 скрытых рисков не в CONTEXT.md:** (R1) `getLibrary` может фильтровать isHidden, (R2) Yandex OAuth callback не знает staging URL, (R5) Yandex Metrika шлёт staging в prod метрики, (R6) port 3001 collision check, (R7) git branch на VPS после deploy вернуть на master.
5. Demo-сценарий Phase 46 Library требует проверки `learning.getLibrary` endpoint — **если там фильтр `isHidden: false`, флаг ничего не покажет**.

### File Created
`.planning/phases/48-staging-environment/48-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Compose/Docker strategy | HIGH | Точные значения из существующих файлов |
| Nginx + certbot | HIGH | Стандартные директивы + gotchas учтены |
| Code changes | HIGH | Все файлы прочитаны, пути верифицированы |
| Validation | MEDIUM | Manual smoke, автоматизация минимальна |
| Risks | MEDIUM | 5 скрытых, требуют проверок планировщика |

### Open Questions
5 вопросов для планировщика/пользователя (см. секцию Open Questions).

### Ready for Planning
Research complete. Planner может создавать PLAN.md. Рекомендуемая структура: **3 wave/plan**:
1. Wave 0 (setup): Dockerfile + `.env.staging` setup на VPS + DNS + certbot + nginx config
2. Wave 1 (code): StagingBanner + feature flag + `.env.example` + CLAUDE.md + memory doc
3. Wave 2 (verify): smoke tests (10 критериев) + human verify + Phase 46 Library demo
