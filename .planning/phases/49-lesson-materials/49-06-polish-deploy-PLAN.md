---
phase: 49-lesson-materials
plan: 06
type: execute
wave: 4
depends_on: ['49-04', '49-05']
files_modified:
  - apps/web/src/app/api/cron/orphan-materials/route.ts
  - .github/workflows/orphan-materials-cleanup.yml
  - apps/web/tests/lesson-materials.spec.ts
  - apps/web/src/app/(main)/roadmap/page.tsx
  - docs/admin-guides/lesson-materials.md
  - MAAL/CLAUDE.md
  - .claude/memory/project_lesson_materials.md
  - .claude/memory/MEMORY.md
autonomous: false
requirements:
  - Phase 49 (D-13, D-44, D-45, D-46, D-47)

must_haves:
  truths:
    - "E2E Playwright тесты покрывают сценарии: материал виден на уроке, signed URL открывается, locked → секции нет"
    - "Cron-эндпоинт удаляет orphan-файлы из Storage старше 24ч раз в сутки"
    - "Запись в /roadmap (публичный changelog) появилась от первого лица"
    - "Memory entry project_lesson_materials.md создан, ссылка добавлена в MEMORY.md"
    - "MAAL/CLAUDE.md содержит Last Session запись про Phase 49"
    - "docs/admin-guides/lesson-materials.md создан — пошаговая инструкция для методолога (D-47)"
    - "Production деплой выполнен через стандартный Docker workflow, smoke test 200 OK"
  artifacts:
    - path: "apps/web/tests/lesson-materials.spec.ts"
      provides: "E2E тесты на 3 сценария"
      min_lines: 80
    - path: "apps/web/src/app/api/cron/orphan-materials/route.ts"
      provides: "Cron handler с Sentry checkin"
      min_lines: 60
    - path: "docs/admin-guides/lesson-materials.md"
      provides: "1-page guide для методологов (D-47)"
      min_lines: 30
    - path: ".claude/memory/project_lesson_materials.md"
      provides: "Memory entry с gotchas, ingest mapping"
  key_links:
    - from: ".github/workflows/orphan-materials-cleanup.yml"
      to: "cron handler"
      via: "GitHub Actions schedule (раз в сутки)"
      pattern: "0 3 \\* \\* \\*"
---

<objective>
Финализировать фазу 49: E2E Playwright тесты, cron на orphan-файлы (D-13), публичная запись в /roadmap (D-44), документация для методологов (D-47 — `docs/admin-guides/lesson-materials.md`), внутренняя документация (CLAUDE.md, memory entry — D-45, D-46), деплой через стандартный Docker workflow на staging → smoke test → prod.

Purpose: фаза готова к проду, метрики собираются, методологи могут работать в админке без участия разработки (есть guide).
Output: тесты, cron, документация (внешняя для методологов + внутренняя для разработки), рабочий прод.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/49-lesson-materials/49-CONTEXT.md
@.planning/phases/49-lesson-materials/49-01-SUMMARY.md
@.planning/phases/49-lesson-materials/49-02-SUMMARY.md
@.planning/phases/49-lesson-materials/49-03-SUMMARY.md
@.planning/phases/49-lesson-materials/49-04-SUMMARY.md
@.planning/phases/49-lesson-materials/49-05-SUMMARY.md
@MAAL/CLAUDE.md
@apps/web/src/app/api/cron/check-subscriptions/route.ts
@.github/workflows/daily-cron.yml
@apps/web/src/app/(main)/roadmap/page.tsx
@.claude/memory/MEMORY.md
@.claude/memory/feedback_public_roadmap.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build orphan-materials cron handler + GitHub Action schedule</name>
  <files>apps/web/src/app/api/cron/orphan-materials/route.ts, .github/workflows/orphan-materials-cleanup.yml</files>
  <read_first>
    - apps/web/src/app/api/cron/check-subscriptions/route.ts (паттерн cron handler с Sentry checkin)
    - .github/workflows/daily-cron.yml (паттерн GitHub Action для cron)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-13)
    - packages/shared/src/types.ts (MATERIAL_STORAGE_BUCKET)
  </read_first>
  <action>
**Файл 1 — `apps/web/src/app/api/cron/orphan-materials/route.ts` (~80 LoC):**

```typescript
/**
 * Cron: Cleanup orphan files in lesson-materials Storage bucket (Phase 49 D-13)
 *
 * Strategy:
 *  - List all files in bucket
 *  - For each file, check if any Material has matching storagePath
 *  - Delete files older than 24h with no DB reference
 *
 * Auth: CRON_SECRET header
 * Schedule: GitHub Action 03:00 UTC daily
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db';
import { MATERIAL_STORAGE_BUCKET } from '@mpstats/shared';

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000; // 24h (D-13)

export async function GET(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checkInId = Sentry.captureCheckIn({ monitorSlug: 'orphan-materials', status: 'in_progress' });

  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Walk bucket recursively (we have only top-level type/{id}/{filename} structure)
    let allPaths: { name: string; updated_at?: string }[] = [];
    const types = ['presentation', 'calculation_table', 'external_service', 'checklist', 'memo'];
    for (const t of types) {
      const { data: ids, error: e1 } = await sb.storage.from(MATERIAL_STORAGE_BUCKET).list(t, { limit: 1000 });
      if (e1) { console.error('List error', t, e1); continue; }
      for (const idDir of ids ?? []) {
        const { data: files } = await sb.storage.from(MATERIAL_STORAGE_BUCKET).list(`${t}/${idDir.name}`, { limit: 100 });
        for (const f of files ?? []) {
          allPaths.push({ name: `${t}/${idDir.name}/${f.name}`, updated_at: (f as any).updated_at || (f as any).created_at });
        }
      }
    }

    // Get all known storagePaths from DB
    const materials = await prisma.material.findMany({ select: { storagePath: true }, where: { storagePath: { not: null } } });
    const known = new Set(materials.map(m => m.storagePath!).filter(Boolean));

    const now = Date.now();
    const orphans: string[] = [];
    for (const p of allPaths) {
      if (known.has(p.name)) continue;
      const age = p.updated_at ? now - new Date(p.updated_at).getTime() : Infinity;
      if (age >= ORPHAN_AGE_MS) orphans.push(p.name);
    }

    let deleted = 0;
    if (orphans.length) {
      const { data, error } = await sb.storage.from(MATERIAL_STORAGE_BUCKET).remove(orphans);
      if (error) throw error;
      deleted = data?.length ?? 0;
    }

    Sentry.captureCheckIn({ checkInId, monitorSlug: 'orphan-materials', status: 'ok' });
    return NextResponse.json({ scanned: allPaths.length, orphans: orphans.length, deleted });
  } catch (e: any) {
    Sentry.captureCheckIn({ checkInId, monitorSlug: 'orphan-materials', status: 'error' });
    Sentry.captureException(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Файл 2 — `.github/workflows/orphan-materials-cleanup.yml`:**

```yaml
name: Orphan Materials Cleanup
on:
  schedule:
    - cron: '0 3 * * *'  # 03:00 UTC = 06:00 МСК
  workflow_dispatch:

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger cron endpoint
        run: |
          curl -fsSL --max-time 600 \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://platform.mpstats.academy/api/cron/orphan-materials
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm --filter @mpstats/web typecheck && test -f .github/workflows/orphan-materials-cleanup.yml</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/app/api/cron/orphan-materials/route.ts` существует, ≥60 LoC
    - `grep -c "CRON_SECRET" apps/web/src/app/api/cron/orphan-materials/route.ts` >= 1
    - `grep -c "captureCheckIn" apps/web/src/app/api/cron/orphan-materials/route.ts` >= 1
    - `grep -c "MATERIAL_STORAGE_BUCKET" apps/web/src/app/api/cron/orphan-materials/route.ts` >= 1
    - `.github/workflows/orphan-materials-cleanup.yml` существует
    - `grep "0 3 \\* \\* \\*" .github/workflows/orphan-materials-cleanup.yml` находит 1 строку
    - `pnpm --filter @mpstats/web typecheck` exit 0
  </acceptance_criteria>
  <done>Cron-эндпоинт + workflow готовы, монитор Sentry slug `orphan-materials` создан вручную в Sentry UI (см. post_deploy_followup).</done>
</task>

<task type="auto">
  <name>Task 2: Write E2E Playwright tests (3 scenarios)</name>
  <files>apps/web/tests/lesson-materials.spec.ts</files>
  <read_first>
    - apps/web/tests (просмотреть существующие .spec.ts для стиля и helpers)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (Demo-кейс из <domain>)
  </read_first>
  <action>
Создать `apps/web/tests/lesson-materials.spec.ts` (~120 LoC):

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER = { email: 'tester@mpstats.academy', password: process.env.TEST_USER_PASSWORD || 'TestUser2024' };

// IMPORTANT: эти тесты предполагают что на staging/local есть тестовый аккаунт с активной подпиской
// и хотя бы один урок имеет привязанный материал (через ingest 49-03 или ручную привязку в admin)

test.describe('Phase 49 - Lesson Materials', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard|learn/);
  });

  test('user with subscription sees materials section on lesson with attached materials', async ({ page }) => {
    // Используем известный урок из ingest - TODO: подставить реальный lesson id с материалами после ingest
    // Например: первый урок курса аналитики, к которому прикреплён "Плагин MPSTATS"
    const lessonWithMaterials = process.env.TEST_LESSON_WITH_MATERIALS || '01_analytics_m01_start_001';
    await page.goto(`${BASE_URL}/learn/${lessonWithMaterials}`);
    await expect(page.getByTestId('lesson-materials')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Материалы к уроку/ })).toBeVisible();
    // Хотя бы одна карточка
    const cards = page.locator('[data-testid^="material-cta-"]');
    await expect(cards.first()).toBeVisible();
  });

  test('locked lesson does NOT render materials section in DOM', async ({ page }) => {
    // Урок order > 2 в курсе, к которому есть материалы; для тестового аккаунта без подписки
    // Альтернатива: использовать аккаунт без подписки. Здесь мы предполагаем тестового юзера БЕЗ подписки -
    // создать через Supabase admin perm: 'staging-locked-user@mpstats.academy'
    const lockedLessonId = process.env.TEST_LOCKED_LESSON_WITH_MATERIALS;
    if (!lockedLessonId) test.skip(true, 'TEST_LOCKED_LESSON_WITH_MATERIALS env var not set');

    // Logout и login другим аккаунтом без подписки
    await page.goto(`${BASE_URL}/api/auth/logout`);
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', 'staging-locked@mpstats.academy');
    await page.fill('input[type="password"]', process.env.TEST_LOCKED_USER_PASSWORD!);
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/learn/${lockedLessonId}`);
    // Секция должна полностью отсутствовать в DOM
    const section = page.getByTestId('lesson-materials');
    await expect(section).toHaveCount(0);
  });

  test('admin can navigate to /admin/content/materials and see table', async ({ page }) => {
    // Тестовый юзер должен быть ADMIN или SUPERADMIN - иначе скип
    const isAdmin = process.env.TEST_USER_IS_ADMIN === 'true';
    if (!isAdmin) test.skip(true, 'TEST_USER_IS_ADMIN not set');

    await page.goto(`${BASE_URL}/admin/content/materials`);
    await expect(page.getByRole('heading', { name: /Материалы к урокам/ })).toBeVisible();
    // Кнопка добавления
    await expect(page.getByRole('link', { name: /Добавить материал/ })).toBeVisible();
  });
});
```

ВАЖНО: тесты требуют env vars `TEST_LESSON_WITH_MATERIALS`, `TEST_LOCKED_LESSON_WITH_MATERIALS`, `TEST_LOCKED_USER_PASSWORD`, `TEST_USER_IS_ADMIN`. Без них тесты скипаются (test.skip), но не падают - это normal, добавим переменные в `apps/web/playwright.config.ts` или env позже.

ВАЖНО: запускать тесты **локально** против dev-сервера (`pnpm dev`) с прикреплённым в админке материалом - проверить что зелёные.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && cd apps/web && npx playwright test tests/lesson-materials.spec.ts --list</automated>
  </verify>
  <acceptance_criteria>
    - Файл `apps/web/tests/lesson-materials.spec.ts` существует, ≥80 LoC
    - `npx playwright test tests/lesson-materials.spec.ts --list` показывает 3 теста
    - Запуск против локального dev-сервера: тесты или passed, или skipped (если env-vars не выставлены) - но НЕ failed
    - `grep -c "data-testid=\\"lesson-materials\\"" apps/web/tests/lesson-materials.spec.ts` >= 1 (или эквивалент `getByTestId('lesson-materials')`)
  </acceptance_criteria>
  <done>3 E2E теста определены, могут быть запущены руками с правильными env vars.</done>
</task>

<task type="auto">
  <name>Task 3: Write methodologist guide + roadmap entry + memory + MAAL/CLAUDE.md updates</name>
  <files>docs/admin-guides/lesson-materials.md, apps/web/src/app/(main)/roadmap/page.tsx, MAAL/CLAUDE.md, .claude/memory/project_lesson_materials.md, .claude/memory/MEMORY.md</files>
  <read_first>
    - apps/web/src/app/(main)/roadmap/page.tsx (паттерн добавления записи changelog от первого лица)
    - .claude/memory/feedback_public_roadmap.md (правило: техничка НЕ идёт; только видимые юзерам фичи)
    - MAAL/CLAUDE.md строки 60-80 (формат Last Session)
    - .claude/memory/MEMORY.md (где добавлять ссылку на новую memory entry)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-44, D-45, D-46, D-47)
  </read_first>
  <action>
**Шаг 1 — Methodologist guide `docs/admin-guides/lesson-materials.md` (D-47, ≥30 строк):**

Сначала проверить существование папки:
```bash
mkdir -p docs/admin-guides
```

Затем создать файл с содержимым:

```markdown
# Материалы к урокам - руководство методолога

**Аудитория:** методологи MPSTATS Academy.
**Цель:** добавлять/редактировать/прикреплять учебные материалы к урокам без участия разработчиков.

## Доступ

1. Открыть `https://platform.mpstats.academy/admin/content/materials`
2. Нужны права **ADMIN** или **SUPERADMIN** (выдаёт Egor через Settings)
3. В sidebar админки пункт "Materials" между Content и Comments

## Создание материала

1. Кнопка `+ Добавить материал` в правом верхнем углу
2. Заполнить:
   - **Название** (до 200 символов): что юзер увидит на карточке. Пример: "Шаблон ABC-анализа товаров"
   - **Тип** - один из 5: Презентация / Таблица расчётов / Внешний сервис / Чек-лист / Памятка. Тип нельзя поменять после создания
   - **Описание** (опционально, до 2000 символов): подсказка под названием
   - **Текст кнопки** (до 60 символов): что написано на CTA. Примеры: "Скачать", "Открыть таблицу", "Перейти на сайт", "Установить плагин"
3. Выбрать **Источник** (одно из двух, не оба):
   - **Внешняя ссылка**: вставить URL (Google Drive, Sheets, Docs, любой external service)
   - **Загрузить файл**: drag-n-drop файла. Разрешены PDF, XLSX, DOCX, CSV, до 25 MB
4. Опциональный чекбокс "Может быть полезен без просмотра урока" - задел под будущий каталог Library, в текущем UI не используется. Можно отмечать заранее.
5. Нажать **Создать**

## Прикрепление к урокам

После создания материал нужно прикрепить хотя бы к одному уроку, иначе юзеры его не увидят.

1. На странице редактирования материала — секция "Прикреплено к урокам"
2. Кнопка "Прикрепить к уроку" - открывает поиск
3. Ввести часть названия урока ИЛИ название курса
4. Кликнуть на нужный урок - он добавится в список
5. Один материал можно прикрепить к произвольному количеству уроков (типичный кейс - "Плагин MPSTATS" виден на 9+ уроках)
6. Удалить привязку - кнопка X в списке прикреплений

## Редактирование

- Нажать на название материала в списке - откроется страница редактирования
- Менять можно: название, описание, текст кнопки, источник, привязки к урокам
- **Тип менять нельзя** - если ошиблись, создайте новый, удалите старый

## Скрытие и удаление

- **Скрыть** (значок глаза в таблице): материал исчезнет с уроков, но остаётся в БД. Можно вернуть через тот же значок, отметив "Показывать скрытые" в фильтрах
- **Удалить** (значок корзины): окно подтверждения. Файл из Storage удаляется, привязки к урокам сохраняются в архивном виде. Это soft-delete - данные можно восстановить разработчиком при необходимости

## Что видит юзер

- Юзер с активной подпиской на курс/Платформу: видит секцию "Материалы к уроку" под видео + ключевыми тезисами, до навигации
- Юзер без доступа к уроку (locked): секция вообще не рендерится, материалы не утекают
- Клик по кнопке материала: внешняя ссылка открывается в новой вкладке, файл скачивается через защищённый signed URL (TTL 1 час)

## Поиск дубликатов

Если ввести материал с тем же названием и тем же URL, что уже существует, система покажет ошибку - дубликаты запрещены. Это защита от случайных повторов после массового импорта (ingest).

## Если что-то не работает

- "Доступ к материалу ограничен" при попытке скачать - материал не прикреплён ни к одному уроку, либо урок скрыт
- Файл не загружается - проверить что меньше 25 MB и формат разрешён (PDF/XLSX/DOCX/CSV)
- Материал не виден на уроке - проверить что не в режиме "Скрыт" + урок не залочен для тестового аккаунта

При непонятных багах - писать в @ZebroPersonalBot или Egor лично.
```

**Шаг 2 — Public roadmap entry в `apps/web/src/app/(main)/roadmap/page.tsx`:**

Найти массив changelog-записей (или JSX-блоки) в файле. Добавить НОВУЮ запись в самый верх (свежие — первыми) от первого лица, без технички (D-44, feedback_public_roadmap.md):

```
Дата: <текущая ISO дата>
Заголовок: Материалы к урокам
Текст:
"Под видеоуроками появились полезные материалы — презентации, таблицы расчётов, чек-листы и памятки.
То, что мы упоминаем в уроках, теперь можно скачать и применить в работе сразу. Материалы видны
по подписке, открываются в один клик."
```

Конкретный синтаксис зависит от структуры. Если массив - добавить объект; если JSX - добавить блок.

ЗАПРЕЩЕНО упоминать: Storage, Supabase, ingest, админка, signed URL, методологи, Google Sheet, fuzzy match, cron - это техничка для команды, не для клиента.

**Шаг 3 — Memory entry `.claude/memory/project_lesson_materials.md`:**

```markdown
# Phase 49 · Lesson Materials - Project Memory

## Status
Shipped <date>. Production: https://platform.mpstats.academy

## Schema
- Tables: Material, LessonMaterial
- Enum: MaterialType (5 значений: PRESENTATION, CALCULATION_TABLE, EXTERNAL_SERVICE, CHECKLIST, MEMO)
- Storage bucket: `lesson-materials` (private, MIME whitelist, 25 MB hard limit)
- Schema applied via `prisma db push` ПЕРЕД docker rebuild (lesson learned from Phase 28)

## Ingest
- Скрипт: `scripts/ingest-materials.ts`
- Источник: Google Sheet `1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0` вкладка "Доп материалы к урокам"
- One-shot, dry-run по умолчанию, `--apply` для записи
- Дедуп по (title, normalizedUrl) с trim — D-49
- Fuzzy match по нормализации (кавычки, тире, split по `|`, ILIKE substring fallback)
- Sentry custom span `ingest.lessonBlock` на каждый блок урока (D-43)
- Результат: <N> материалов, <M> привязок, <K> unmatched (см. ingest-results/summary.json)

## Unmatched lessons (после первого ingest)
<скопировать из ingest-results/unmatched-lessons.tsv топ-5 - для последующего обсуждения с методологами>

## ACL
- Backend: getSignedUrl проверяет хотя бы один прикреплённый Lesson доступен (checkLessonAccess из Phase 20)
- Залоченный урок: getLesson возвращает `materials: []` (не утекает даже title)
- External URL - известный компромисс (Google Drive открыт всем по ссылке), контроль через не-показ в UI

## API surface
- 9 procedures в material router: list, getById, create, update, delete, attach, detach, requestUploadUrl, getSignedUrl
- 8 admin-only, 1 protected (getSignedUrl)

## Gotchas
- `prisma db push` ВСЕГДА перед docker build - иначе stale Prisma client (Phase 28 lesson)
- File upload: signed PUT URL ПРЯМО в Supabase Storage (не через Next.js - body limit 4 MB у App Router)
- Yandex Metrika события: `MATERIAL_OPEN` (per click) + `MATERIAL_SECTION_VIEW` (Intersection Observer threshold 0.4)
- Cron orphan: 03:00 UTC ежедневно, удаляет файлы в bucket без DB-записи старше 24h
- requestUploadUrl использует upload-id (Date.now+random) как proxy для materialId - архитектурный компромисс vs D-09 (см. inline-комментарий в material.ts)

## Methodologist guide
- `docs/admin-guides/lesson-materials.md` (D-47) - пошаговая инструкция для методологов

## Future work (НЕ в этой фазе)
- Library каталог standalone-материалов (поле `isStandalone` хранится, UI не сделан) - кандидат для Phase 47 hub
- RAG-индексация контента материалов - отрезано как overengineering (агентные пайплайны)
- Bulk-импорт CSV в админке - пока не нужно, у методологов есть админ-форма
- Версионность материалов
- Health-check внешних ссылок (404 detection)
```

**Шаг 4 — Добавить ссылку в `.claude/memory/MEMORY.md`:**

В соответствующем разделе (по аналогии с другими `## Phase XX -` записями) добавить:

```markdown
## Phase 49 - Lesson Materials (shipped <date>)
- [project_lesson_materials.md](project_lesson_materials.md) - Schema, ingest, ACL, gotchas. 120 материалов из Sheet методологов залиты, ~60 unique materials, 110+ links к урокам. Админка `/admin/content/materials` для CRUD без участия разработки. Гайд методолога `docs/admin-guides/lesson-materials.md`.
```

**Шаг 5 — Last Session запись в `MAAL/CLAUDE.md`:**

В секцию `## Last Session` добавить ПЕРЕД текущей записью (которая станет `### Previous Session`):

```markdown
## Last Session (<date>)

**Phase 49 - Lesson Materials. SHIPPED.**

1. **Schema + Storage (49-01)** - Material/LessonMaterial/MaterialType enum в Prisma; bucket `lesson-materials` private, 25 MB hard limit, MIME whitelist (PDF/XLSX/DOCX/CSV); `prisma db push` ПЕРЕД docker (Phase 28 lesson)
2. **tRPC router (49-02)** - 9 procedures (list/getById/create/update/delete/attach/detach/requestUploadUrl/getSignedUrl), 8 admin + 1 protected; ACL: getSignedUrl проверяет access к хотя бы одному прикреплённому уроку; залоченный урок -> `materials: []` в payload
3. **Ingest (49-03)** - `scripts/ingest-materials.ts`, dry-run + apply, ~120 строк Google Sheet -> ~60 unique materials + 110+ links; дедуп по (title, normalizedUrl) с trim (D-49); fuzzy match (кавычки, тире, split `|`, ILIKE fallback); идемпотентный; Sentry custom span на блок урока (D-43)
4. **Lesson UI (49-04)** - секция "Материалы к уроку" между summary и навигацией (D-26); `MaterialCard` с иконкой по типу + accent-цветом; залоченный урок не рендерит секцию (D-29); Yandex Metrika `MATERIAL_OPEN` + `MATERIAL_SECTION_VIEW`
5. **Admin (49-05)** - `/admin/content/materials` список с фильтрами + create/edit с XOR (URL OR upload); drag-n-drop file upload через signed PUT URL прямо в Storage (минует Next.js body limit); Combobox для multi-attach; ссылка "Materials" в AdminSidebar
6. **Polish (49-06)** - E2E Playwright тесты, cron на orphan-файлы (раз в сутки 03:00 UTC), запись в публичный /roadmap от первого лица, memory entry, **гайд методолога `docs/admin-guides/lesson-materials.md` (D-47)**, deploy

**Commits:** <вставить хэши после коммита>
**Результат:** Методологи получили автономную админку с инструкцией, юзеры с подпиской видят материалы под видео, без подписки - секция не рендерится. Первая UI-фича где Storage используется не для аватаров.
```

И переименовать предыдущую запись `## Last Session (2026-04-23 -> 2026-04-24)` в `### Previous Session (2026-04-23 -> 2026-04-24)`.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && grep -c "Phase 49" .claude/memory/MEMORY.md && grep -c "Lesson Materials" MAAL/CLAUDE.md && test -f .claude/memory/project_lesson_materials.md && test -f docs/admin-guides/lesson-materials.md</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/src/app/(main)/roadmap/page.tsx` содержит новую запись с заголовком "Материалы к урокам"
    - В записи /roadmap НЕТ слов: "Supabase", "Storage", "ingest", "админка", "методологи", "Google Sheet", "cron"
    - `.claude/memory/project_lesson_materials.md` существует
    - `.claude/memory/MEMORY.md` содержит строку с `Phase 49 - Lesson Materials` (или `Phase 49 — Lesson Materials`)
    - `MAAL/CLAUDE.md` `## Last Session` обновлён, предыдущая стала `### Previous Session`
    - `grep -c "shipped" MAAL/CLAUDE.md` увеличился на 1 (новая фаза помечена как shipped)
    - **D-47:** `test -f docs/admin-guides/lesson-materials.md` (файл существует)
    - **D-47:** `wc -l docs/admin-guides/lesson-materials.md` >= 30 (≥30 строк - содержательный guide)
    - **D-47:** `grep -c "Создание материала\\|Прикрепление к урокам\\|Скрытие и удаление" docs/admin-guides/lesson-materials.md` >= 3 (содержит ключевые разделы)
  </acceptance_criteria>
  <done>Документация обновлена везде: внешняя для методологов (D-47), внутренняя для разработки, /roadmap имеет публичную запись от первого лица.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Manual Demo verification before deploy</name>
  <what-built>
    Полный flow Phase 49 готов локально или на staging:
    - Schema applied, ingest run with ~110+ materials
    - tRPC router работает
    - Lesson page показывает материалы
    - Админка функциональна
    - Гайд методолога создан
  </what-built>
  <how-to-verify>
    Выполнить Demo-кейс из CONTEXT.md `<domain>` секции (10 шагов):

    1. Залогиниться как ADMIN/SUPERADMIN на staging (https://staging.platform.mpstats.academy)
    2. Открыть `/admin/content/materials`, нажать "+ Добавить материал"
    3. Создать тест: type=CALCULATION_TABLE, title="Шаблон ABC-анализа [TEST]", upload XLSX файла любого (до 25 MB)
    4. После создания - на edit page прикрепить к 3 урокам через Combobox (например первые 3 урока курса аналитики)
    5. Залогиниться как обычный юзер с подпиской (test@mpstats.academy)
    6. Открыть один из 3 уроков -> секция "Материалы к уроку" видна, карточка с типом "Таблица расчётов", фиолетовый accent
    7. Кликнуть "Скачать шаблон" -> файл скачивается через signed URL (можно проверить URL содержит `supabase.co/storage/v1/object/sign/lesson-materials/`)
    8. Залогиниться как юзер БЕЗ подписки (создать staging-locked@... через Supabase Dashboard)
    9. Открыть тот же урок (если order > 2 - он залочен) -> секция "Материалы" отсутствует в DOM (проверить через DevTools Elements)
    10. Открыть `docs/admin-guides/lesson-materials.md` - убедиться что guide читаемый, шаги корректны (передать ссылку методологу для финального ревью если возможно)

    Yandex Metrika и Sentry проверки переехали в post_deploy_followup (не блокируют закрытие плана, проверяются через 1+ час после деплоя).

    Если все 10 шагов работают -> approve. Если что-то не так - описать конкретно что и где.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

<task type="auto">
  <name>Task 5: Deploy to staging, smoke test, then prod via standard Docker workflow</name>
  <files>(deployment only - no file modifications)</files>
  <read_first>
    - MAAL/CLAUDE.md секция "Staging Workflow" + "Deploy"
    - .claude/memory/project_phase48_debug_postmortem.md (lessons learned про staging)
  </read_first>
  <action>
**Шаг 1 - Staging deploy:**

```bash
ssh deploy@89.208.106.208
cd /home/deploy/maal
git fetch origin
git checkout <feature-branch-or-master>
docker compose -p maal-staging -f docker-compose.staging.yml up -d --build
```

Дождаться завершения build (~5-10 мин).

**Шаг 2 - Staging smoke test:**

Открыть `https://staging.platform.mpstats.academy` (basic auth: team / см. Server auth.md):
- `/learn/<lesson-with-materials>` -> секция Материалы видна
- `/admin/content/materials` -> таблица с материалами
- Создать тестовый материал в админке -> ОК
- Скачать тестовый материал через signed URL -> ОК

Если что-то не так - fix -> push -> rebuild staging -> smoke test ещё раз.

**Шаг 3 - Production deploy (когда staging зелёный):**

КРИТИЧНО: schema УЖЕ применена в Wave 1 (49-01) на shared Supabase DB -> prod уже видит таблицы; нужно только пересобрать prod-контейнер с новым кодом.

```bash
# Vernуться на master перед prod build (см. Phase 48 lesson)
git checkout master
git pull origin master
docker compose down && docker compose build --no-cache && docker compose up -d
```

Build ~5-10 мин. Прод лежит ~30-60 секунд (известный downtime).

**Шаг 4 - Production smoke test (моментальные проверки):**
- `https://platform.mpstats.academy/learn/<lesson-with-materials>` -> 200, секция видна
- `/admin/content/materials` (logged as admin) -> 200
- Container ID сменился (`docker ps`)

**Шаг 5 - Git commit:**

W#4: ASCII-only commit messages (em-dash -> hyphen, кириллица в Windows bash + HEREDOC ломает кодировку, em-dash как не-ASCII символ усугубляет). Header английский.

Закоммитить все изменения за фазу одним коммитом:
```bash
git add packages/db/prisma/schema.prisma packages/shared/src/types.ts \
        packages/api/src/routers/material.ts packages/api/src/router.ts packages/api/src/routers/learning.ts packages/api/src/routers/__tests__/material.test.ts \
        scripts/ingest-materials.ts scripts/ingest-results/.gitignore scripts/ingest-results/.gitkeep \
        apps/web/src/lib/analytics/constants.ts \
        apps/web/src/components/learning/MaterialCard.tsx apps/web/src/components/learning/LessonMaterials.tsx \
        apps/web/src/app/\(main\)/learn/\[id\]/page.tsx \
        apps/web/src/app/\(admin\)/admin/content/materials/ \
        apps/web/src/components/admin/MaterialsTable.tsx apps/web/src/components/admin/MaterialForm.tsx apps/web/src/components/admin/MaterialFileUpload.tsx apps/web/src/components/admin/LessonMultiAttach.tsx apps/web/src/components/admin/AdminSidebar.tsx \
        apps/web/src/app/api/cron/orphan-materials/ \
        apps/web/tests/lesson-materials.spec.ts \
        apps/web/src/app/\(main\)/roadmap/page.tsx \
        .github/workflows/orphan-materials-cleanup.yml \
        docs/admin-guides/lesson-materials.md \
        MAAL/CLAUDE.md

git commit -m "$(cat <<'EOF'
feat(materials): Phase 49 - lesson materials with admin CRUD and ingest

Add learning materials (presentations, tables, checklists, memos, external links)
attached to lessons. Methodologists get autonomous admin panel with guide;
users with subscription see materials section under lesson video.

- Prisma: Material + LessonMaterial models + MaterialType enum (5 types)
- Storage: private bucket lesson-materials with signed URLs (TTL 1h, 25 MB limit)
- tRPC: material router with 9 procedures (CRUD + attach/detach + signed URLs)
- Ingest: one-shot script imports ~120 materials from methodologists Google Sheet
- UI: LessonMaterials section between summary and navigation; locked lessons hide
- Admin: /admin/content/materials list + edit + drag-n-drop file upload
- Sidebar: Materials nav item between Content and Comments
- Cron: daily orphan-files cleanup
- Analytics: MATERIAL_OPEN + MATERIAL_SECTION_VIEW Yandex Metrika goals
- Docs: methodologist guide at docs/admin-guides/lesson-materials.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"

# Также отдельные коммиты для отчётов и memory:
git add .planning/phases/49-lesson-materials/ .claude/memory/project_lesson_materials.md .claude/memory/MEMORY.md
git commit -m "docs(49): plan summaries + memory entry"
```

**Шаг 6 - Push:**
```bash
git push origin master
```

(Если работаем в feature branch - открыть PR; если master - пушим напрямую как обычно для MAAL.)
  </action>
  <verify>
    <automated>curl -fsSL -o /dev/null -w "%{http_code}\n" https://platform.mpstats.academy/learn/01_analytics_m01_start_001 | grep -q "^200$" && echo "Prod 200 OK"</automated>
  </verify>
  <acceptance_criteria>
    - Staging deploy успешен, smoke-checks зелёные
    - Production deploy успешен, container ID сменился
    - `curl https://platform.mpstats.academy/` возвращает 200
    - `/admin/content/materials` возвращает 200 (для авторизованного admin) или 401/redirect (для неавторизованного)
    - Git commit с диапазоном файлов фазы создан
    - Commit message содержит только ASCII (em-dash заменён на hyphen, кириллица только в body не в header)
  </acceptance_criteria>
  <done>Phase 49 в проде, ошибок нет в моментальных smoke-чеках, git history чистый. Sentry/Metrika проверки в post_deploy_followup.</done>
</task>

</tasks>

<post_deploy_followup>
**Не блокирует закрытие плана. Проверяется через 1+ час после деплоя.**

W#3: эти проверки требуют времени на накопление данных, поэтому не входят в acceptance_criteria Task 5 (момент закрытия), но должны быть выполнены в течение 24h.

1. **Sentry monitor создан** для cron `orphan-materials`:
   - Открыть Sentry UI -> Crons
   - Создать monitor slug `orphan-materials`, schedule `0 3 * * *` UTC, timezone UTC, margin 60min
   - Альтернатива: cron сам создаёт checkin при первом запуске, monitor появится автоматически после первого триггера

2. **Sentry: 0 новых ошибок** с тегом `route: 'material.*'` в течение 1 часа после деплоя
   - Открыть Sentry -> Issues -> Filter by `tags:route:material*`
   - Если 0 - OK; если есть - открыть, разобраться, патч/rollback

3. **Yandex Metrika** показывает ≥1 hit:
   - Открыть Metrika dashboard -> Цели
   - Через 1+ час после первого юзера на странице урока с материалом: `platform_material_section_view` >= 1
   - Через 1+ час после первого клика: `platform_material_open` >= 1
   - Если 0 за 24h при ненулевом трафике - проверить `reachGoal` вызовы в Network tab

4. **Cron первый успешный запуск:**
   - GitHub Actions -> Workflows -> "Orphan Materials Cleanup" -> через 24h должен быть зелёный run
   - Sentry checkin для `orphan-materials` -> status: ok

5. **Методолог-фидбек:**
   - Передать `docs/admin-guides/lesson-materials.md` Миле или другому методологу
   - Собрать фидбек по понятности шагов
   - Доработать guide через 1-2 недели использования
</post_deploy_followup>

<verification>
- E2E тесты определены и могут быть запущены
- Cron handler + GitHub workflow готовы
- /roadmap содержит публичную запись от первого лица
- Memory + CLAUDE.md обновлены
- **`docs/admin-guides/lesson-materials.md` создан (D-47)**
- Production задеплоен через стандартный Docker workflow
- Smoke checks 200 OK
- Sentry monitor + Metrika проверки запланированы в post_deploy_followup
</verification>

<success_criteria>
1. E2E тесты добавлены (3 сценария)
2. Cron orphan-materials работает (manual trigger через workflow_dispatch)
3. Запись в /roadmap появилась в публичном changelog
4. MAAL/CLAUDE.md Last Session обновлён
5. Memory entry создан и связан в MEMORY.md
6. **Гайд методолога `docs/admin-guides/lesson-materials.md` создан (D-47)**
7. Production отвечает 200, моментальные smoke-чеки зелёные
8. Sentry/Metrika проверки запланированы (не блокируют закрытие)
</success_criteria>

<output>
After completion, create `.planning/phases/49-lesson-materials/49-06-SUMMARY.md` documenting:
- Deploy result (commit hash, container id, deploy date)
- Smoke test results
- Sentry monitor создан (или TODO в post_deploy_followup)
- Yandex Metrika ожидание (post_deploy_followup)
- D-47 guide path
- Phase 49 marked complete in ROADMAP.md (Plans: 6/6)
</output>
</content>
</invoke>
