---
phase: 48-staging-environment
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - Dockerfile
  - docker-compose.staging.yml
  - apps/web/src/components/shared/StagingBanner.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/app/(main)/learn/page.tsx
  - apps/web/.env.example
  - MAAL/.env.example
  - apps/web/tests/unit/StagingBanner.test.tsx
  - .gitignore
  - MAAL/CLAUDE.md
  - .claude/memory/project_staging_environment.md
  - .claude/memory/MEMORY.md
autonomous: true
requirements: [SC-2, SC-3, SC-4, SC-7]

must_haves:
  truths:
    - "Dockerfile принимает ARG/ENV для NEXT_PUBLIC_STAGING и NEXT_PUBLIC_SHOW_LIBRARY"
    - "docker-compose.staging.yml — отдельный compose, контейнер maal-staging-web, порт 127.0.0.1:3001:3000, env_file .env.staging"
    - "Компонент StagingBanner рендерит жёлтую плашку если NEXT_PUBLIC_STAGING === 'true', иначе null"
    - "StagingBanner вставлен в apps/web/src/app/layout.tsx как первый child внутри <body>"
    - "LibrarySection в /learn рендерится только если NEXT_PUBLIC_SHOW_LIBRARY === 'true'"
    - "Yandex Metrika НЕ грузится на staging (дополнительная проверка NEXT_PUBLIC_STAGING !== 'true')"
    - "Unit-тесты StagingBanner покрывают оба ветка (flag=true и flag=undefined)"
    - ".env.staging попадает в .gitignore и не может быть закоммичен"
    - "MAAL/CLAUDE.md содержит раздел ## Staging Workflow с deploy-командами и таблицей флагов"
    - "Memory entry project_staging_environment.md создан и зарегистрирован в MEMORY.md"
    - "Prod build продолжает работать (type-check + build зелёные)"
  artifacts:
    - path: "Dockerfile"
      provides: "ARG+ENV для двух новых флагов"
      contains: "ARG NEXT_PUBLIC_STAGING"
    - path: "docker-compose.staging.yml"
      provides: "compose для staging-контейнера на порту 3001"
      contains: "container_name: maal-staging-web"
    - path: "apps/web/src/components/shared/StagingBanner.tsx"
      provides: "жёлтая плашка на staging"
      min_lines: 10
    - path: "apps/web/src/app/layout.tsx"
      provides: "интеграция StagingBanner + guard для Yandex Metrika"
      contains: "StagingBanner"
    - path: "apps/web/src/app/(main)/learn/page.tsx"
      provides: "условный рендер LibrarySection"
      contains: "NEXT_PUBLIC_SHOW_LIBRARY"
    - path: "apps/web/tests/unit/StagingBanner.test.tsx"
      provides: "unit coverage для StagingBanner"
      min_lines: 20
    - path: "MAAL/CLAUDE.md"
      provides: "раздел Staging Workflow"
      contains: "## Staging Workflow"
    - path: ".claude/memory/project_staging_environment.md"
      provides: "детали nginx, VPS, troubleshooting"
      min_lines: 30
  key_links:
    - from: "docker-compose.staging.yml"
      to: "Dockerfile"
      via: "build.args передают NEXT_PUBLIC_STAGING/SHOW_LIBRARY"
      pattern: "NEXT_PUBLIC_STAGING: \"true\""
    - from: "layout.tsx"
      to: "StagingBanner component"
      via: "import + JSX render"
      pattern: "<StagingBanner"
    - from: "learn/page.tsx"
      to: "LibrarySection"
      via: "conditional process.env check"
      pattern: "NEXT_PUBLIC_SHOW_LIBRARY === 'true' && <LibrarySection"
---

<objective>
Все кодовые изменения для staging-стенда одним атомарным плаом: Dockerfile ARG/ENV, staging compose, StagingBanner, feature-flag для LibrarySection, заглушка Yandex Metrika на staging, документация, unit-тесты, .gitignore. После этого плана `pnpm typecheck && pnpm test` зелёные, prod-билд не сломан (безопасно, т.к. новые ARG не обязательные). Задеплой делает Plan 48-03.

Purpose: изолировать код-волну от инфра-волны, чтобы коммит был ревьюемый и rollback-able одним `git revert`.
Output: готовый к деплою репозиторий — достаточно `git pull && docker compose -p maal-staging -f docker-compose.staging.yml up -d --build` на VPS.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/48-staging-environment/48-CONTEXT.md
@.planning/phases/48-staging-environment/48-RESEARCH.md
@.planning/phases/48-staging-environment/48-VALIDATION.md
@MAAL/CLAUDE.md
@docker-compose.yml
@Dockerfile
@apps/web/src/app/layout.tsx
@packages/api/src/routers/learning.ts
</context>

<interfaces>
<!-- Ключевые интерфейсы, которые нужно использовать/не ломать -->

Existing layout.tsx structure (apps/web/src/app/layout.tsx):
- Server Component (default export `RootLayout`), не `'use client'`
- Внутри <body>: <LandingThemeProvider> → <TRPCProvider> → children, потом Toaster, CookieConsent, YandexMetrika

Existing page.tsx (apps/web/src/app/(main)/learn/page.tsx:15, 876):
- `import { LibrarySection } from '@/components/learning/LibrarySection';`
- `<LibrarySection />` рендерится безусловно на строке 876

getLibrary endpoint (packages/api/src/routers/learning.ts:95-146):
- Фильтр: `where: { isHidden: false, videoId: { not: null }, course: { isHidden: true, id: { startsWith: 'skill_' } } }`
- ТРЕБУЕТ `course.isHidden === true` для skill_* — значит флаг на клиенте корректно раскрывает skill-контент без изменений endpoint'а (R1 проверен).

Vitest config (apps/web/vitest.config.ts):
- jsdom environment, setupFiles: ./tests/setup.ts
- Тесты живут в `tests/**/*.test.{ts,tsx}` или `src/**/*.test.{ts,tsx}`

Команда запуска одного теста:
`pnpm --filter @mpstats/web test -- StagingBanner`
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Dockerfile + StagingBanner + unit-тесты</name>
  <read_first>
    - Dockerfile (текущий, особенно строки 25-47 — блок NEXT_PUBLIC_*)
    - apps/web/src/components/shared/CookieConsent.tsx (как пример простого shared-компонента в проекте)
    - apps/web/tests/setup.ts (настройка vitest mocks)
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Code Changes Required" пункты 1 и 4
  </read_first>
  <behavior>
    - Test 1: `process.env.NEXT_PUBLIC_STAGING = 'true'` → `render(<StagingBanner />)` содержит текст "STAGING"
    - Test 2: `process.env.NEXT_PUBLIC_STAGING = undefined` (или пустая строка) → `render(<StagingBanner />)` возвращает null (container пустой)
    - Test 3: `process.env.NEXT_PUBLIC_STAGING = 'false'` → null (строгая проверка === 'true')
  </behavior>
  <files>
    - Dockerfile
    - apps/web/src/components/shared/StagingBanner.tsx (новый)
    - apps/web/tests/unit/StagingBanner.test.tsx (новый)
  </files>
  <action>

**1. Dockerfile — добавить ARG+ENV после существующих NEXT_PUBLIC блоков.**

Отредактировать `Dockerfile` строки 25-35 (добавить две пары после `ARG NEXT_PUBLIC_YANDEX_ID` / `ENV NEXT_PUBLIC_YANDEX_ID`):

Найти блок:
```dockerfile
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID
ARG NEXT_PUBLIC_YANDEX_ID

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID=$NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID
ENV NEXT_PUBLIC_YANDEX_ID=$NEXT_PUBLIC_YANDEX_ID
```

Добавить ПОСЛЕ него (до серверных ARG):
```dockerfile
# Staging-only flags — пустые на prod, передаются из docker-compose.staging.yml
ARG NEXT_PUBLIC_STAGING
ARG NEXT_PUBLIC_SHOW_LIBRARY
ENV NEXT_PUBLIC_STAGING=$NEXT_PUBLIC_STAGING
ENV NEXT_PUBLIC_SHOW_LIBRARY=$NEXT_PUBLIC_SHOW_LIBRARY
```

**Prod-safety:** если `docker-compose.yml` не передаёт эти ARG, они остаются пустыми, `process.env.NEXT_PUBLIC_STAGING === 'true'` → `false`. Prod-билд не ломается.

**2. Новый файл `apps/web/src/components/shared/StagingBanner.tsx`:**

```tsx
/**
 * Жёлтая sticky-плашка на staging-стенде.
 * Рендерится только если NEXT_PUBLIC_STAGING=true (устанавливается в docker-compose.staging.yml).
 * Server Component — нет hydration overhead.
 * См. .claude/memory/project_staging_environment.md
 */
export function StagingBanner() {
  if (process.env.NEXT_PUBLIC_STAGING !== 'true') return null;
  return (
    <div
      role="status"
      aria-label="Staging environment warning"
      className="sticky top-0 z-[100] w-full bg-yellow-400 text-yellow-950 px-4 py-2 text-sm font-semibold text-center shadow-md"
    >
      STAGING — данные реальные, не заказывайте, не платите
    </div>
  );
}
```

**3. Новый файл `apps/web/tests/unit/StagingBanner.test.tsx`:**

```tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StagingBanner } from '@/components/shared/StagingBanner';

describe('StagingBanner', () => {
  const originalEnv = process.env.NEXT_PUBLIC_STAGING;

  afterEach(() => {
    cleanup();
    process.env.NEXT_PUBLIC_STAGING = originalEnv;
  });

  it('renders banner text when NEXT_PUBLIC_STAGING === "true"', () => {
    process.env.NEXT_PUBLIC_STAGING = 'true';
    const { container, getByText } = render(<StagingBanner />);
    expect(getByText(/STAGING/)).toBeDefined();
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('returns null when NEXT_PUBLIC_STAGING is undefined', () => {
    delete process.env.NEXT_PUBLIC_STAGING;
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when NEXT_PUBLIC_STAGING === "false"', () => {
    process.env.NEXT_PUBLIC_STAGING = 'false';
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when NEXT_PUBLIC_STAGING === "" (empty string)', () => {
    process.env.NEXT_PUBLIC_STAGING = '';
    const { container } = render(<StagingBanner />);
    expect(container.innerHTML).toBe('');
  });
});
```

**Caveat про `process.env` в unit-тестах:** в Next.js client-компонентах `process.env.NEXT_PUBLIC_*` инлайнится webpack'ом на билд. В vitest без Next-loader переменная читается как runtime — то есть наши тесты корректно работают с `process.env.NEXT_PUBLIC_STAGING = 'true'`. Если после прогона `pnpm test` выясняется что vitest не подхватывает runtime env (такое может быть, если кто-то добавил плагин для инлайна) — fallback: заменить `process.env.NEXT_PUBLIC_STAGING` в компоненте на helper `getStagingFlag()` и мокать через `vi.mock()`. Документировать в коммите если такое понадобится.

Последовательность выполнения задачи (TDD):
1. RED: создать test-файл → `pnpm --filter @mpstats/web test -- StagingBanner` должен упасть (компонент не существует)
2. GREEN: создать компонент → тесты проходят
3. Dockerfile диф → `pnpm typecheck` не меняется, но проверяется, что diff применился
  </action>
  <verify>
    <automated>cd apps/web && pnpm test -- StagingBanner запускается и возвращает "4 passed"; grep -q "ARG NEXT_PUBLIC_STAGING" Dockerfile возвращает 0; grep -q "ENV NEXT_PUBLIC_SHOW_LIBRARY" Dockerfile возвращает 0</automated>
  </verify>
  <acceptance_criteria>
    - Файл `apps/web/src/components/shared/StagingBanner.tsx` существует и экспортирует функцию `StagingBanner`
    - Файл `apps/web/tests/unit/StagingBanner.test.tsx` существует с 4 тест-кейсами
    - `pnpm --filter @mpstats/web test -- StagingBanner` — все 4 теста зелёные
    - `grep "ARG NEXT_PUBLIC_STAGING" Dockerfile` находит строку
    - `grep "ARG NEXT_PUBLIC_SHOW_LIBRARY" Dockerfile` находит строку
    - `grep "ENV NEXT_PUBLIC_STAGING=\$NEXT_PUBLIC_STAGING" Dockerfile` находит строку
    - `pnpm --filter @mpstats/web typecheck` — зелёный
  </acceptance_criteria>
  <done>Dockerfile расширен, StagingBanner + тесты созданы, все проверки зелёные.</done>
</task>

<task type="auto">
  <name>Task 2: Интеграция в layout + feature-flag для LibrarySection + guard для Yandex Metrika</name>
  <read_first>
    - apps/web/src/app/layout.tsx (текущий код layout — знать точно куда вставляется)
    - apps/web/src/app/(main)/learn/page.tsx строки 12-20 и 870-880
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Code Changes Required" пункты 5, 6 + раздел "Risks" R5 (Yandex Metrika guard)
    - .planning/phases/48-staging-environment/48-CONTEXT.md D-14, D-15, D-16, D-18, D-21
  </read_first>
  <files>
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/(main)/learn/page.tsx
  </files>
  <action>

**1. `apps/web/src/app/layout.tsx` — два изменения:**

**(a)** Добавить импорт в начало (после существующих импортов):
```tsx
import { StagingBanner } from '@/components/shared/StagingBanner';
```

**(b)** Вставить `<StagingBanner />` первым child внутри `<body>` (до `<LandingThemeProvider>`). Текущий код:
```tsx
<body className={inter.className}>
  <LandingThemeProvider>
    <TRPCProvider>{children}</TRPCProvider>
  </LandingThemeProvider>
  <Toaster />
  ...
```

Станет:
```tsx
<body className={inter.className}>
  <StagingBanner />
  <LandingThemeProvider>
    <TRPCProvider>{children}</TRPCProvider>
  </LandingThemeProvider>
  <Toaster />
  ...
```

**(c)** Yandex Metrika guard (R5). Текущее условие (строка 76):
```tsx
{process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_YANDEX_ID && (
  <YandexMetrika ... />
)}
```

Расширить:
```tsx
{process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_STAGING !== 'true' &&
  process.env.NEXT_PUBLIC_YANDEX_ID && (
  <YandexMetrika ... />
)}
```

Причина (из research R5): staging бежит с `NODE_ENV=production` → Metrika грузилась бы и засоряла prod-воронку событиями от тестовых пользователей.

**CarrotQuest НЕ глушим** — research R4 рекомендует оставить на первой итерации, пометить в memory как cleanup-кандидат. Экономим изменения.

**2. `apps/web/src/app/(main)/learn/page.tsx` — обернуть `<LibrarySection />` флагом.**

Текущая строка 875-876:
```tsx
{/* Library: skill-based lessons */}
<LibrarySection />
```

Заменить на:
```tsx
{/* Library: skill-based lessons. Показываем только на staging через NEXT_PUBLIC_SHOW_LIBRARY=true (см. MAAL/CLAUDE.md → Staging Workflow). */}
{process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true' && <LibrarySection />}
```

**R1 verified:** `packages/api/src/routers/learning.ts:95-146` — `getLibrary` явно фильтрует `course: { isHidden: true, id: { startsWith: 'skill_' } }`, то есть endpoint ТРЕБУЕТ `isHidden=true` у skill-курсов. Значит флаг на клиенте корректно раскрывает skill-контент без изменений endpoint'а. Endpoint не трогаем. Если при деплое Library пустая — причина либо нет skill-курсов с `isHidden=true, id LIKE skill_%`, либо у них нет уроков с `videoId`. Проверить на staging через Prisma Studio (за скоупом этого плана).

**Bonus перформанс:** на prod условие false → `trpc.learning.getLibrary.useQuery()` не вызывается → один лишний запрос в Supabase сэкономили.

  </action>
  <verify>
    <automated>grep -q "import { StagingBanner }" apps/web/src/app/layout.tsx; grep -q "<StagingBanner />" apps/web/src/app/layout.tsx; grep -q "NEXT_PUBLIC_STAGING !== 'true'" apps/web/src/app/layout.tsx; grep -q "NEXT_PUBLIC_SHOW_LIBRARY === 'true'" apps/web/src/app/\\(main\\)/learn/page.tsx; cd apps/web && pnpm typecheck возвращает exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "import { StagingBanner }" apps/web/src/app/layout.tsx` = 1
    - `<StagingBanner />` вставлен ровно один раз, внутри `<body>` до `<LandingThemeProvider>`
    - Yandex Metrika условие содержит `process.env.NEXT_PUBLIC_STAGING !== 'true'`
    - В `learn/page.tsx` `<LibrarySection />` обёрнут условием `process.env.NEXT_PUBLIC_SHOW_LIBRARY === 'true' &&`
    - `pnpm --filter @mpstats/web typecheck` — зелёный
    - `pnpm --filter @mpstats/web test` — все существующие тесты плюс новые StagingBanner зелёные (ни один не сломался)
  </acceptance_criteria>
  <done>layout.tsx и learn/page.tsx отредактированы, типизация и тесты зелёные, prod-поведение сохранено.</done>
</task>

<task type="auto">
  <name>Task 3: docker-compose.staging.yml + .env.example + .gitignore + документация + memory</name>
  <read_first>
    - docker-compose.yml (референсный prod compose)
    - .planning/phases/48-staging-environment/48-RESEARCH.md раздел "Staging Compose Strategy" (готовый шаблон) + "Code Changes Required" пункты 3, 7, 8, 9, 10
    - .planning/phases/48-staging-environment/48-CONTEXT.md D-03, D-04, D-22, D-23, D-24
    - MAAL/CLAUDE.md (понять где вставить раздел "Staging Workflow")
    - .claude/memory/MEMORY.md (формат index-а)
    - .gitignore
  </read_first>
  <files>
    - docker-compose.staging.yml (новый)
    - apps/web/.env.example
    - MAAL/.env.example (если существует; если нет — создать только apps/web/.env.example)
    - .gitignore
    - MAAL/CLAUDE.md
    - .claude/memory/project_staging_environment.md (новый)
    - .claude/memory/MEMORY.md
  </files>
  <action>

**1. Новый файл `docker-compose.staging.yml` в корне репо:**

```yaml
# docker-compose.staging.yml — staging-стенд на VPS 89.208.106.208
# Запуск: docker compose -p maal-staging -f docker-compose.staging.yml up -d --build
# Останов: docker compose -p maal-staging -f docker-compose.staging.yml down
# ВАЖНО: всегда с -p maal-staging, иначе Docker может затронуть prod project

services:
  web:
    container_name: maal-staging-web
    build:
      context: .
      dockerfile: Dockerfile
      args:
        # Shared Supabase DB с prod (D-05), значения из .env.staging
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        # URL обязательно staging — используется в OAuth callback и NEXT_PUBLIC_SITE_URL
        NEXT_PUBLIC_SITE_URL: https://staging.platform.mpstats.academy
        NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID: ${NEXT_PUBLIC_CLOUDPAYMENTS_PUBLIC_ID}
        NEXT_PUBLIC_YANDEX_ID: ${NEXT_PUBLIC_YANDEX_ID}
        SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
        OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
        DATABASE_URL: ${DATABASE_URL}
        DIRECT_URL: ${DIRECT_URL}
        # Staging-only флаги
        NEXT_PUBLIC_STAGING: "true"
        NEXT_PUBLIC_SHOW_LIBRARY: ${NEXT_PUBLIC_SHOW_LIBRARY:-false}
    ports:
      - "127.0.0.1:3001:3000"
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

**Важно:**
- `container_name: maal-staging-web` — уникальное имя (Task в research CONTEXT.md D-03)
- Порт `127.0.0.1:3001:3000` — хост 3001, внутри контейнера всё ещё 3000
- `NEXT_PUBLIC_STAGING: "true"` — хардкод, не из env (staging compose всегда staging)
- `NEXT_PUBLIC_SHOW_LIBRARY: ${NEXT_PUBLIC_SHOW_LIBRARY:-false}` — читается из .env.staging, default false
- `NEXT_PUBLIC_SITE_URL` — хардкод на staging URL, НЕ из env (иначе можно случайно получить prod URL)

**2. `apps/web/.env.example` — добавить секцию в конец:**

```
# Staging-only flags (only set in .env.staging, leave empty/unset in .env.production)
# NEXT_PUBLIC_STAGING=true       # Shows yellow STAGING banner, hides Yandex Metrika
# NEXT_PUBLIC_SHOW_LIBRARY=true  # Reveals LibrarySection on /learn (Phase 46 demo)
```

Если `MAAL/.env.example` существует — добавить ту же секцию. Если не существует — пропустить (нет необходимости создавать).

**3. `.gitignore` — проверить, что `.env.staging` не попадёт в git.**

Текущие env-правила (из `.gitignore` строки 10-13):
```
.env
.env.local
.env.*.local
```

`.env.staging` под эти паттерны НЕ подходит. Добавить после `.env.*.local`:
```
.env.production
.env.staging
```

Обе строки: `.env.production` на самом деле тоже не должен быть в git (он есть только на VPS), но сейчас попадает под `.env` → уже защищён. Для надёжности — явная строка. `.env.staging` — новая защита.

**4. `MAAL/CLAUDE.md` — добавить раздел `## Staging Workflow` перед разделом `## QA` (последний раздел в файле, должен остаться последним):**

```markdown
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
```

**5. `.claude/memory/project_staging_environment.md` — новый файл:**

```markdown
# Staging Environment — реализация и эксплуатация

**Phase:** 48 (shipped 2026-04-23+)
**Status:** Active

## Что это
Второй Docker-стенд на VPS 89.208.106.208 под поддоменом `staging.platform.mpstats.academy`. Цель — показывать команде WIP-фичи через feature flags без риска для prod.

## Архитектура
- Prod: `docker-compose.yml`, project `maal`, container `maal-web-1`, порт 3000, env `.env.production`
- Staging: `docker-compose.staging.yml`, project `maal-staging`, container `maal-staging-web`, порт 3001, env `.env.staging`
- Shared Supabase DB (D-05). Тестовые юзеры с префиксом `staging-*@mpstats.academy`.

## VPS файлы
| Путь | Содержимое |
|------|-----------|
| `/home/deploy/maal/.env.staging` | Копия `.env.production` + `NEXT_PUBLIC_STAGING=true` + фича-флаги. Не в git. |
| `/etc/nginx/sites-available/staging.platform.mpstats.academy` | vhost (HTTPS + basic auth + noindex + proxy_pass :3001) |
| `/etc/nginx/.htpasswd-staging` | bcrypt hash user `team`, 640 root:www-data |
| `/etc/letsencrypt/live/staging.platform.mpstats.academy/` | SSL cert (auto-renewal через certbot.timer) |

## NEXT_PUBLIC_* build-time gotcha
Эти переменные вшиваются в JS-бандл при `pnpm build`, не runtime. Поэтому:
1. Должны быть переданы как `ARG` в Dockerfile
2. Должны быть переданы через `args:` в docker-compose.staging.yml
3. При смене флага — полный `up -d --build`, рестарта контейнера мало

Известный инцидент: Phase 19 commit `82427f4` (CP public key missing).

## Troubleshooting

### `docker compose up` собирается, но банк STAGING не виден
- Проверить, что `.env.staging` содержит `NEXT_PUBLIC_STAGING=true`
- Проверить, что `docker-compose.staging.yml` args содержит `NEXT_PUBLIC_STAGING: "true"`
- Убедиться что был `--build`, не только `up -d`
- `docker compose -p maal-staging -f docker-compose.staging.yml logs web | head -50` — искать `NEXT_PUBLIC_STAGING` в build-log

### `nginx -t` падает после reload
- Откатить vhost: `sudo rm /etc/nginx/sites-enabled/staging.platform.mpstats.academy && sudo systemctl reload nginx`
- Разобрать ошибку, починить конфиг, повторить

### curl возвращает 502 с правильным паролем
- Staging-контейнер не стартовал или упал. `docker ps -a | grep maal-staging` + `docker logs maal-staging-web`
- Порт конфликт: `ss -tlnp | grep 3001`

### Library (Phase 46) пустая на staging с флагом
- `packages/api/src/routers/learning.ts:95-146` — endpoint `getLibrary` фильтрует `course: { isHidden: true, id: { startsWith: 'skill_' } }`. Проверить в Supabase: есть ли skill-курсы с таким `isHidden` + `id LIKE 'skill_%'` + уроки с `videoId not null`. Если нет — контент не попадал в БД, надо догнать seed.

### Prod сломался после деплоя staging
- Критично проверить что `docker compose -p maal-staging` использовался, а не default project
- `git status` на VPS — если на VPS активна ветка, отличная от master, сделать `git checkout master && docker compose down && docker compose build --no-cache && docker compose up -d`
- Смотреть логи prod: `docker compose logs --tail=100 -f` (без `-p`, default project)

## Связанные решения
- D-01..D-27 — в `.planning/phases/48-staging-environment/48-CONTEXT.md`
- Research R1..R9 — в `.planning/phases/48-staging-environment/48-RESEARCH.md`

## Cleanup кандидаты (backlog)
- CarrotQuest condition (не грузить на staging) — сейчас CQ events летят в prod workspace
- Supabase OAuth Redirect URLs — добавить staging callback для Yandex OAuth
- Feature flag UI (`/admin/flags`) — если флагов станет >5
- Zero-downtime prod deploy — отдельная фаза после staging
```

**6. `.claude/memory/MEMORY.md` — добавить строку в индекс.**

Читается в начале других сессий. Добавить в секцию `## Phase 28 — Hidden Test Plans Deployed` или между существующими записями (хронологически — в конец перед "Key Patterns"):

```markdown
## Staging Environment — Shipped (2026-04-23)
- [project_staging_environment.md](project_staging_environment.md) — второй Docker-стенд `staging.platform.mpstats.academy`, basic auth `team`, порт 3001, shared Supabase DB, feature flags `NEXT_PUBLIC_STAGING` + `NEXT_PUBLIC_SHOW_LIBRARY`. Deploy: `docker compose -p maal-staging -f docker-compose.staging.yml up -d --build`.
```
  </action>
  <verify>
    <automated>docker compose -f docker-compose.staging.yml config --quiet возвращает exit 0 (синтаксис YAML корректен); grep -q "^\.env\.staging$" .gitignore; grep -q "## Staging Workflow" MAAL/CLAUDE.md; test -f .claude/memory/project_staging_environment.md; grep -q "project_staging_environment.md" .claude/memory/MEMORY.md; cd apps/web && pnpm typecheck возвращает exit 0</automated>
  </verify>
  <acceptance_criteria>
    - `docker-compose.staging.yml` создан в корне репо (`MAAL/`)
    - `docker compose -f docker-compose.staging.yml config` (dry-run validate) отрабатывает без ошибок. **Caveat:** команда будет ругаться на отсутствие env-переменных, пробрасывается через `DATABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=x ... docker compose ... config --quiet` — либо запустить на VPS где `.env.staging` уже есть. Локально принять "Variable is not set" как warning, не error.
    - `.gitignore` содержит строку `.env.staging`
    - `MAAL/CLAUDE.md` содержит раздел `## Staging Workflow` с таблицей флагов и deploy-командой
    - `.claude/memory/project_staging_environment.md` существует, минимум 30 строк
    - `.claude/memory/MEMORY.md` содержит ссылку на новый memory-файл
    - `pnpm --filter @mpstats/web typecheck` — зелёный
    - **Prod безопасность:** `.env.staging` не коммитится — `git status` показывает его как untracked или не показывает вовсе (если не существует локально)
  </acceptance_criteria>
  <done>compose + docs + memory + .gitignore готовы. Код-волна полностью самодостаточна, готова к git commit и деплою.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Staging-браузер клиент → Next.js client bundle | `NEXT_PUBLIC_*` видны всем, не класть туда секреты |
| Docker build args → image | Серверные ARG (`SUPABASE_SERVICE_ROLE_KEY` и пр.) не должны утекать в staging-специфичные файлы, commited в git |
| Git commit → remote | `.env.staging` НЕ должен уйти в git |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-07 | Information Disclosure | .env.staging утекает в git | mitigate | Явная строка `.env.staging` в `.gitignore` + verification в acceptance_criteria |
| T-48-08 | Tampering | Prod build сломается от новых ARG | accept | ARG без `required` — если compose их не передаёт, ENV пустые, `=== 'true'` возвращает false. Prod safe. |
| T-48-09 | Information Disclosure | Yandex Metrika шлёт staging-события в prod-воронку | mitigate | R5 — условие `NEXT_PUBLIC_STAGING !== 'true'` в layout.tsx |
| T-48-10 | Tampering | Случайный коммит файла со staging-env | accept | Дополнительных pre-commit хуков не ставим; полагаемся на .gitignore + code review. Эскалация — если будет утечка |
| T-48-11 | Information Disclosure | CarrotQuest прод events от staging юзеров | accept | Команда фильтрует по `staging-*` префиксу email. Cleanup-кандидат зафиксирован в memory |
</threat_model>

<verification>
Полный набор после кодовой волны:

```bash
cd apps/web

# 1. Unit-тесты StagingBanner
pnpm test -- StagingBanner
# Ожидается: 4 passed

# 2. Полный типчек
pnpm typecheck
# Ожидается: exit 0

# 3. Все тесты (регрессия)
pnpm test
# Ожидается: всё зелёное, новые тесты StagingBanner в счёте

# 4. Prod-build не сломан
cd ../..
pnpm --filter @mpstats/web build
# Ожидается: Next.js build успешно собирается (без .env.staging, без NEXT_PUBLIC_STAGING)

# 5. docker-compose.staging.yml валиден
docker compose -f docker-compose.staging.yml config --quiet || echo "warnings ok, errors not"
# Ожидается: только warnings про отсутствующие env-переменные (резолв на VPS), без errors

# 6. Grep-контракты
grep -q "ARG NEXT_PUBLIC_STAGING" Dockerfile && echo OK1
grep -q "ENV NEXT_PUBLIC_SHOW_LIBRARY" Dockerfile && echo OK2
grep -q "import { StagingBanner }" apps/web/src/app/layout.tsx && echo OK3
grep -q "NEXT_PUBLIC_SHOW_LIBRARY === 'true'" apps/web/src/app/\(main\)/learn/page.tsx && echo OK4
grep -q "^\.env\.staging$" .gitignore && echo OK5
grep -q "## Staging Workflow" MAAL/CLAUDE.md && echo OK6
test -f .claude/memory/project_staging_environment.md && echo OK7
```
</verification>

<success_criteria>
- SC-2: StagingBanner создан, интегрирован в layout, unit-тесты зелёные (Task 1 + Task 2)
- SC-3: LibrarySection обёрнут флагом `NEXT_PUBLIC_SHOW_LIBRARY === 'true'` (Task 2)
- SC-4: `docker-compose.staging.yml` создан с корректным `container_name`, портом и env_file (Task 3) → изолирован от prod project при `-p maal-staging`
- SC-7: `## Staging Workflow` раздел в `MAAL/CLAUDE.md` + memory entry (Task 3)

Prod-инвариант: `pnpm --filter @mpstats/web build` и `pnpm --filter @mpstats/web test` зелёные, никакие существующие файлы не ломаются. Все новые изменения — additive (новые строки, новые файлы, новые ARG без дефолтов).
</success_criteria>

<output>
После завершения создать `.planning/phases/48-staging-environment/48-02-SUMMARY.md` с:
- Подтверждением всех verification команд
- Полным diff-листом модифицированных файлов
- R1 status: resolved (endpoint не трогаем, флаг достаточен)
- R5 status: resolved (Yandex Metrika guard добавлен)
- Открытыми cleanup-кандидатами (CarrotQuest guard, Yandex OAuth callback URL — для Plan 48-03)
- Готовностью к git commit и деплою
</output>
