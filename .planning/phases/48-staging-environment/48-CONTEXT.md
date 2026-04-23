# Phase 48: Staging Environment - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** Chat discussion (user + orchestrator, 2026-04-23)

<domain>
## Phase Boundary

Запустить второй Docker-стенд на том же VPS (89.208.106.208) под поддоменом `staging.platform.mpstats.academy`. Цель — дать команде Академии площадку, где можно показывать WIP-фичи (библиотека, лендинги, AI-эксперименты) до их деплоя в прод. Прод (`platform.mpstats.academy`) при деплое staging не трогается.

**In:**
- Второй docker-compose файл с отдельным портом и env-файлом
- Nginx vhost для staging поддомена + HTTP basic auth + noindex header
- DNS A-record + certbot SSL
- Код: `StagingBanner` компонент + feature-flag паттерн (`NEXT_PUBLIC_STAGING`, `NEXT_PUBLIC_SHOW_LIBRARY`)
- Документация в `MAAL/CLAUDE.md` и `.claude/memory/`

**Out:**
- Отдельная база/Supabase проект (shared DB с prod — решение подтверждено)
- Zero-downtime deploy для прод (отдельная задача, отложена)
- Автоматизированный CI/CD для staging (ручной деплой достаточно на старте)
- Платёжные флоу на staging (не тестируем через CP, для этого есть Phase 28 hidden test plans)

**Demo-кейс для проверки в конце фазы:** ветка с Phase 46 Library Section задеплоена на staging с `NEXT_PUBLIC_SHOW_LIBRARY=true`, команда открывает `staging.platform.mpstats.academy`, вводит basic auth пароль, видит Library раздел. На prod этот раздел остаётся скрытым.

</domain>

<decisions>
## Implementation Decisions

### Infrastructure

- **D-01: Staging живёт на том же VPS, что и prod (89.208.106.208).** Отдельный сервер не берём — железа хватает, БД всё равно shared.
- **D-02: Порт контейнера staging = 3001** (prod — 3000). Порты НЕ пробрасываются наружу напрямую, всё через Nginx.
- **D-03: docker-compose.staging.yml — отдельный файл, копия prod compose**. Разные `container_name` (чтобы не конфликтовали), разные `env_file`, разные порты. Сети prod и staging изолированы.
- **D-04: `.env.staging` — отдельный env-файл на VPS**, не коммитится в git. Содержит `NEXT_PUBLIC_STAGING=true` + набор фича-флагов. Prod `.env.production` остаётся нетронутым.
- **D-05: Shared Supabase DB с prod** — тестовые аккаунты команда создаёт с префиксом `staging-*@mpstats.academy`. Читаем документированный набор feature flags и фейк-признак в header — избегаем путаницы.
- **D-06: Deploy на staging — ручной**, запускается с VPS: `cd <repo> && git fetch && git checkout <branch> && docker compose -f docker-compose.staging.yml up -d --build`. Без GitHub Actions/CI на первом этапе.
- **D-07: Prod деплой НЕ меняется.** Текущий workflow `docker compose down && build && up` остаётся — zero-downtime deploy вынесен за скоуп.

### Domain & Networking

- **D-08: DNS A-record** для `staging.platform.mpstats.academy` → `89.208.106.208`. Пользователь добавляет через панель провайдера, план фиксирует это шагом.
- **D-09: SSL через certbot**: `certbot --nginx -d staging.platform.mpstats.academy` на VPS. Auto-renewal уже настроен для prod поддомена — новый домен подцепится.
- **D-10: Nginx vhost** — отдельный конфиг `/etc/nginx/sites-available/staging.platform.mpstats.academy` по образцу prod, с двумя отличиями: (1) `proxy_pass http://localhost:3001`; (2) `auth_basic` + `auth_basic_user_file` директивы.

### Access Control

- **D-11: HTTP Basic Auth на nginx-уровне**. Пароль задаёт юзер, хранится в `/etc/nginx/.htpasswd-staging` (создаётся через `htpasswd -c`). Один общий логин/пароль для команды на старте.
- **D-12: `X-Robots-Tag: noindex, nofollow`** заголовок в nginx-конфиге staging поддомена — защита от случайного индексирования Яндексом/Google на случай, если basic auth обойдут.
- **D-13: Basic auth НЕ мешает ассетам Next.js** — применяется ко всем location'ам включая `/_next/*`, `/api/*`. Это нормально, команда ходит с одной парой credentials.

### UI — StagingBanner

- **D-14: Компонент `StagingBanner`** — жёлтая sticky плашка поверх всего, текст: «STAGING — данные реальные, не заказывайте, не платите». Z-index выше всех модалок, но не блокирует interaction.
- **D-15: Рендерится только при `process.env.NEXT_PUBLIC_STAGING === 'true'`**. На prod банка не появляется даже если случайно закоммитили проверку.
- **D-16: Положение в layout** — в корневом `apps/web/src/app/layout.tsx` перед `<main>`, снаружи всех route groups. Попадает на все страницы включая auth и landing.
- **D-17: Не делаем dismissable** на первой итерации — если надо будет, добавим later. Простая yellow bar.

### Feature Flags

- **D-18: Паттерн `NEXT_PUBLIC_SHOW_<FEATURE>`** для фич, которые должны быть видны только на staging. Пример — `NEXT_PUBLIC_SHOW_LIBRARY`. В коде: `if (process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true') { render LibrarySection }`.
- **D-19: Фича-флаги — read-only на UI-уровне.** НЕ меняют то, что пишется в БД (иначе staging и prod начнут расходиться в данных — нарушение shared-DB архитектуры).
- **D-20: Список активных флагов ведётся в `MAAL/CLAUDE.md`** в разделе Staging Workflow. Когда фича выходит на прод — флаг убирается из кода, секция в докмене чистится.
- **D-21: Первый флаг для проверки — `NEXT_PUBLIC_SHOW_LIBRARY`.** Должен переключать видимость `LibrarySection` в `/learn` (Phase 46 уже имплементировал компонент, но он скрыт — флаг его покажет).

### Documentation

- **D-22: Новый раздел «Staging Workflow» в `MAAL/CLAUDE.md`**: команды деплоя, URL, список текущих feature flags, процедура добавления нового флага.
- **D-23: Новая memory entry `project_staging_environment.md`** в `.claude/memory/` с деталями nginx-конфига, путей на VPS, troubleshooting. Ссылка добавлена в `MEMORY.md`.
- **D-24: Запись в `/roadmap` (публичный changelog) НЕ делаем** — это внутренняя инфраструктура, клиентам не интересна. Правило из `feedback_public_roadmap.md` (техничка не идёт в публичный роадмеп).

### Risk Mitigations

- **D-25: Env var изоляция.** `.env.production` и `.env.staging` — разные файлы. `docker-compose.production.yml` и `docker-compose.staging.yml` жёстко ссылаются на свои env-файлы. Никаких shared `.env`.
- **D-26: Nginx reload safety.** Перед `systemctl reload nginx` обязательно `nginx -t` — в плане шаг сделан явно, не сворачивается в один.
- **D-27: Staging ветка конвенция.** Для проверки используем либо ветку `staging`, либо любую feature-ветку. Договорённость: после pull/checkout на staging — НЕ мержить обратно автоматически, это ручной шаг.

### Claude's Discretion

- Имя htpasswd-файла и пути внутри nginx (например, /etc/nginx/.htpasswd-staging) — на усмотрение планировщика, важно чтобы не конфликтовало с прод-конфигом
- Docker network naming (staging_default vs shared с prod) — по факту prod network пусть остаётся как есть, staging имеет свой default network
- Формат healthcheck в docker-compose.staging.yml — можно копипасту с prod или упростить
- Стиль текста в `StagingBanner` — шрифт/цвет на стороне UI guidelines, главное жёлтый фон и читаемый warning-текст

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Deploy & Infrastructure
- `docker-compose.yml` — существующий prod compose (пока что единственный), копируем его структуру
- `.claude/memory/deploy-details.md` — детали VPS деплоя, SSH доступ, текущий Dockerfile/compose workflow

### Design System
- `.claude/memory/reference_design_system.md` — токены цвета (жёлтый warning подходит из Academy palette)
- `apps/web/src/app/layout.tsx` — корневой layout, куда интегрируется `StagingBanner`

### Feature Demo Target
- `apps/web/src/components/learning/LibrarySection.tsx` (или аналогичный путь, точно указан в Phase 46) — компонент, который должен быть скрыт за `NEXT_PUBLIC_SHOW_LIBRARY`
- CLAUDE.md раздел Phase 46 — Library Section, чтобы понять что именно flag переключает

### Nginx (живёт на VPS)
- `/etc/nginx/sites-available/platform.mpstats.academy` (на VPS) — референсный конфиг prod поддомена, новый staging-конфиг копируется с него + добавляет basic auth и noindex

### Project Gotchas
- `MAAL/CLAUDE.md` раздел Gotchas: `NEXT_PUBLIC_*` вшиваются при build — это критично для `NEXT_PUBLIC_STAGING`, флаги должны быть прописаны в build-args Dockerfile, не только в runtime env
- `.claude/memory/deploy-details.md` — чтобы понять как docker build принимает ARGs

### Policy
- `.claude/memory/feedback_public_roadmap.md` — не писать технические фазы в публичный /roadmap

</canonical_refs>

<specifics>
## Specific Ideas

- **Staging URL:** `https://staging.platform.mpstats.academy`
- **Порт staging контейнера:** 3001 (prod — 3000)
- **VPS IP:** 89.208.106.208
- **Basic auth файл:** `/etc/nginx/.htpasswd-staging`
- **Префикс тестовых аккаунтов:** `staging-*@mpstats.academy`
- **Первый фича-флаг для smoke-теста:** `NEXT_PUBLIC_SHOW_LIBRARY=true` → показывает Library Section из Phase 46
- **Demo команде:** задеплоить ветку с Phase 46 кодом + флагом на staging, команда заходит, видит Library, фидбек, решаем — мержить в main или итерировать

</specifics>

<deferred>
## Deferred Ideas

- **Zero-downtime deploy для prod** (blue-green или rolling через `docker compose up -d --no-deps --build web`) — отдельная фаза после staging, чтобы починить даунтайм при обычном деплое прод
- **CI/CD автоматика** для staging деплоя (GitHub Action: push в ветку `staging` → автоматический rebuild) — добавим после ручной проверки workflow
- **Dismissable StagingBanner** с localStorage-флагом — если команда пожалуется на визуальный шум
- **Отдельный Supabase проект для staging** — если начнём тестировать деструктивные операции (миграции, массовые UPDATE), которые могут повредить prod-данные. Сейчас shared DB достаточно
- **Feature flag UI** (`/admin/flags` тогглы) — если флагов станет больше 5-6, имеет смысл вынести в UI, а не хранить в env
- **Stripe/CP test mode на staging** — для тестирования флоу оплаты без реальных списаний. Сейчас для этого есть Phase 28 hidden test plans на prod

</deferred>

---

*Phase: 48-staging-environment*
*Context gathered: 2026-04-23 via PRD Express Path (chat discussion)*
