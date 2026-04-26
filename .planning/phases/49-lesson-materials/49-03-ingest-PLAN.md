---
phase: 49-lesson-materials
plan: 03
type: execute
wave: 2
depends_on: ['49-01']
files_modified:
  - scripts/ingest-materials.ts
  - scripts/ingest-results/.gitkeep
  - scripts/ingest-results/.gitignore
autonomous: true
requirements:
  - Phase 49 (D-15..D-20, D-43, D-49, D-52)

must_haves:
  truths:
    - "Скрипт ingest-materials.ts читает Google Sheet через GWS CLI"
    - "Dry-run печатает 3 файла-отчёта в scripts/ingest-results/"
    - "Apply-режим пишет в Supabase транзакцией на блок урока"
    - "После apply на проде ≥110 из 120 строк Sheet'а имеют запись Material + LessonMaterial"
    - "Повторный запуск с дедупом не создаёт дубликатов (idempotent)"
    - "Sentry custom span обворачивает обработку каждого блока урока (D-43)"
  artifacts:
    - path: "scripts/ingest-materials.ts"
      provides: "Sheet → DB ingest pipeline"
      min_lines: 200
    - path: "scripts/ingest-results/matched.tsv"
      provides: "Материалы с найденными уроками (после apply)"
    - path: "scripts/ingest-results/unmatched-lessons.tsv"
      provides: "Уроки из Sheet, которых нет в БД (для ручного review)"
    - path: "scripts/ingest-results/summary.json"
      provides: "Сводка: total/matched/unmatched/duplicates_skipped"
  key_links:
    - from: "scripts/ingest-materials.ts"
      to: "Google Sheet 1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0"
      via: "GWS CLI: npx @googleworkspace/cli sheets +read"
      pattern: "Доп материалы к урокам"
    - from: "scripts/ingest-materials.ts"
      to: "Lesson, Material, LessonMaterial tables"
      via: "Prisma client + fuzzy match"
      pattern: "prisma.lesson.findMany"
---

<objective>
Создать `scripts/ingest-materials.ts` — one-shot скрипт для заливки 120 материалов из Google Sheet методологов в БД. Поддерживает dry-run (по умолчанию) и `--apply` (запись в БД). Делает дедупликацию по `(title, normalizedUrl)` (D-07, D-49 — нормализация = trim, без lowercase/strip-query), fuzzy-match названий уроков (D-18), формирует 3 отчёта в `scripts/ingest-results/`. Транзакции — на каждый блок урока (D-52, частичный апплай безопасен). Sentry custom span обворачивает обработку каждого блока (D-43 — per-row processing time).

Purpose: bootstrap данных. Методологи отдали Sheet, после ingest управление переходит в админку (49-05).
Output: один TS-скрипт + папка с отчётами. Бежит ~30 секунд на 120 строках.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/49-lesson-materials/49-CONTEXT.md
@.planning/phases/49-lesson-materials/49-01-SUMMARY.md
@MAAL/CLAUDE.md
@scripts/seed/seed-billing.ts
@scripts/dedup-lessons.ts
@~/.claude/projects/D--GpT-docs-go-mpstats-academy/memory/reference_google_docs.md
@packages/shared/src/types.ts

<interfaces>
<!-- Google Sheet structure (вкладка "Доп материалы к урокам") -->
<!-- Колонки (обнаружены через изучение sheet — методологи могут уточнить): -->
<!-- A: Название урока (lessonName) — пустая строка = продолжение того же урока -->
<!-- B: Тип материала (PRESENTATION / CALCULATION_TABLE / EXTERNAL_SERVICE / CHECKLIST / MEMO или русский синоним) -->
<!-- C: Название материала (title) -->
<!-- D: Описание (description) — опц -->
<!-- E: Ссылка (externalUrl — Google Drive / Sheets / external service) -->
<!-- F: CTA-текст (ctaText) — например "Скачать", "Открыть", "Перейти на сайт" -->
<!-- G: Может ли быть полезен без просмотра урока (TRUE/FALSE → isStandalone) -->
<!-- Section headers вида "#1Аналитика для маркетплейсов" — пропускаем (D-17) -->

From scripts/seed/seed-billing.ts (паттерн прямого использования Prisma из script):
```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() { ... }
main().catch(...).finally(() => prisma.$disconnect());
```

GWS CLI usage (для чтения Sheet):
```bash
npx @googleworkspace/cli sheets +read \
  --spreadsheetId 1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0 \
  --range "Доп материалы к урокам!A1:G500" \
  --output json
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build scripts/ingest-materials.ts (Sheet read + parse + match + write + Sentry span)</name>
  <files>scripts/ingest-materials.ts, scripts/ingest-results/.gitkeep, scripts/ingest-results/.gitignore</files>
  <read_first>
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-15..D-20, D-43, D-49, D-52)
    - scripts/seed/seed-billing.ts (паттерн Prisma в скрипте)
    - scripts/dedup-lessons.ts (паттерн dry-run + execute mode)
    - packages/shared/src/types.ts (MATERIAL_TYPE_VALUES для маппинга)
    - ~/.claude/projects/D--GpT-docs-go-mpstats-academy/memory/reference_google_docs.md (GWS CLI usage)
  </read_first>
  <action>
**Файл 1 — `scripts/ingest-materials.ts`:**

ВАЖНО — env var: скрипт читает `SENTRY_DSN` из `.env` (если задан) для отправки span'ов; если не задан → Sentry молча no-op (не блокирует ingest). DSN тот же что у prod web (см. `.env.production`).

```typescript
#!/usr/bin/env tsx
/**
 * Phase 49 — Ingest Lesson Materials from Google Sheet
 *
 * Usage:
 *   pnpm tsx scripts/ingest-materials.ts                                     # dry-run (default)
 *   pnpm tsx scripts/ingest-materials.ts --apply                             # write to DB
 *   pnpm tsx scripts/ingest-materials.ts --sheet-id=... --tab="..."          # custom source
 *
 * Env (optional):
 *   SENTRY_DSN — если задан, шлём custom span на каждый блок урока (D-43)
 *
 * Reports written to: scripts/ingest-results/
 *   - matched.tsv          : (lessonId, lessonTitle, materialTitle, materialType, source)
 *   - unmatched-lessons.tsv: (sheetLessonName, materialCount, sample_titles)
 *   - summary.json         : { total, matched, unmatched, duplicates_skipped, materials_created, links_created }
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/node';

const prisma = new PrismaClient();

// ===== Sentry init (D-43) =====
// Если SENTRY_DSN не задан → Sentry no-op, ingest продолжается без телеметрии
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: 'ingest-script',
    release: 'phase49-ingest',
  });
}

// ===== Args =====
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SHEET_ID = (args.find(a => a.startsWith('--sheet-id=')) || '--sheet-id=1xs0TkCrvu4IJ2MgLXYIF7oag501Orb4XFco4aIStsp0').split('=')[1];
const TAB_NAME = (args.find(a => a.startsWith('--tab=')) || '--tab=Доп материалы к урокам').split('=')[1];
const RESULTS_DIR = 'scripts/ingest-results';

// ===== Type maps =====
const RUSSIAN_TYPE_MAP: Record<string, string> = {
  'презентация': 'PRESENTATION',
  'презентации': 'PRESENTATION',
  'таблица': 'CALCULATION_TABLE',
  'таблица расчётов': 'CALCULATION_TABLE',
  'таблица расчетов': 'CALCULATION_TABLE',
  'внешний сервис': 'EXTERNAL_SERVICE',
  'сервис': 'EXTERNAL_SERVICE',
  'плагин': 'EXTERNAL_SERVICE',
  'чек-лист': 'CHECKLIST',
  'чеклист': 'CHECKLIST',
  'памятка': 'MEMO',
  'памятки': 'MEMO',
};

const VALID_TYPES = new Set(['PRESENTATION', 'CALCULATION_TABLE', 'EXTERNAL_SERVICE', 'CHECKLIST', 'MEMO']);

function normalizeType(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (VALID_TYPES.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return RUSSIAN_TYPE_MAP[lower] || null;
}

// ===== Lesson title normalization (D-18) =====
function normalizeLessonTitle(s: string): string {
  return s
    .trim()
    .replace(/[«»“”„]/g, '"')
    .replace(/[—–]/g, '-')
    .split('|')[0]              // берём часть до пайпа
    .trim()
    .toLowerCase();
}

// ===== URL normalization for dedup (D-49) =====
// Только trim — НЕ lowercase (URL case-sensitive после домена), НЕ удаляем query (gid=... важен для Google Sheets)
function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return trimmed || null;
}

// ===== Section header detection (D-17) =====
function isSectionHeader(name: string): boolean {
  return /^#\d/.test(name.trim());
}

// ===== Google Sheet read via GWS CLI =====
type SheetRow = string[];

function readSheet(): SheetRow[] {
  console.log(`[ingest] Reading sheet ${SHEET_ID} tab "${TAB_NAME}"…`);
  const cmd = `npx -y @googleworkspace/cli sheets +read --spreadsheetId ${SHEET_ID} --range ${JSON.stringify(TAB_NAME + '!A1:G500')} --output json`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  const parsed = JSON.parse(raw);
  // GWS CLI returns { values: [[...], [...]] } or similar — adjust if structure differs
  const rows: SheetRow[] = parsed.values || parsed.data?.values || parsed;
  if (!Array.isArray(rows)) throw new Error('Unexpected GWS CLI output: ' + JSON.stringify(parsed).slice(0, 200));
  return rows.slice(1); // skip header row
}

// ===== Main =====
type ParsedMaterial = {
  rowIndex: number;
  lessonName: string;       // active lesson group
  type: string;
  title: string;
  description: string;
  externalUrl: string;
  ctaText: string;
  isStandalone: boolean;
  parseErrors: string[];
};

function parseRows(rows: SheetRow[]): ParsedMaterial[] {
  const out: ParsedMaterial[] = [];
  let currentLesson = '';

  rows.forEach((row, i) => {
    const [aRaw, bRaw, cRaw, dRaw, eRaw, fRaw, gRaw] = row.map(x => (x ?? '').toString());
    const lessonName = aRaw.trim();

    if (lessonName) {
      if (isSectionHeader(lessonName)) return; // skip headers (D-17)
      currentLesson = lessonName;
    }
    if (!currentLesson) return;
    if (!cRaw.trim() && !eRaw.trim()) return; // empty material row

    const errors: string[] = [];
    const type = normalizeType(bRaw);
    if (!type) errors.push(`unknown type: "${bRaw}"`);
    if (!cRaw.trim()) errors.push('empty title');
    if (!eRaw.trim()) errors.push('empty externalUrl');

    out.push({
      rowIndex: i + 2,                 // +2 = header skipped + 1-based
      lessonName: currentLesson,
      type: type || 'MEMO',            // safe fallback
      title: cRaw.trim(),
      description: dRaw.trim(),
      externalUrl: eRaw.trim(),
      ctaText: fRaw.trim() || 'Открыть',
      isStandalone: gRaw.trim().toUpperCase() === 'TRUE',
      parseErrors: errors,
    });
  });

  return out;
}

async function main() {
  console.log(`[ingest] Mode: ${APPLY ? 'APPLY (write to DB)' : 'DRY-RUN (no write)'}`);
  console.log(`[ingest] Sentry: ${process.env.SENTRY_DSN ? 'ENABLED' : 'disabled (no DSN)'}`);
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const rows = readSheet();
  console.log(`[ingest] Read ${rows.length} rows from sheet`);
  const parsed = parseRows(rows);
  console.log(`[ingest] Parsed ${parsed.length} material entries`);

  // Build map of lesson titles in DB → id
  const lessons = await prisma.lesson.findMany({ select: { id: true, title: true } });
  const titleToId = new Map<string, string>();
  for (const l of lessons) {
    titleToId.set(normalizeLessonTitle(l.title), l.id);
  }
  console.log(`[ingest] Loaded ${lessons.length} lessons from DB`);

  // Match
  const matchedRows: Array<{ p: ParsedMaterial; lessonId: string; lessonTitle: string }> = [];
  const unmatched = new Map<string, ParsedMaterial[]>();

  for (const p of parsed) {
    if (p.parseErrors.length) {
      const list = unmatched.get(p.lessonName) || [];
      list.push(p);
      unmatched.set(p.lessonName, list);
      continue;
    }
    const norm = normalizeLessonTitle(p.lessonName);
    let lessonId = titleToId.get(norm);
    if (!lessonId) {
      // fallback: ILIKE substring (D-18)
      const lessonRow = lessons.find(l => normalizeLessonTitle(l.title).includes(norm) || norm.includes(normalizeLessonTitle(l.title)));
      lessonId = lessonRow?.id;
    }
    if (lessonId) {
      const found = lessons.find(l => l.id === lessonId)!;
      matchedRows.push({ p, lessonId, lessonTitle: found.title });
    } else {
      const list = unmatched.get(p.lessonName) || [];
      list.push(p);
      unmatched.set(p.lessonName, list);
    }
  }

  // Reports
  const matchedTsv = ['lessonId\tlessonTitle\tmaterialType\tmaterialTitle\texternalUrl']
    .concat(matchedRows.map(({ p, lessonId, lessonTitle }) =>
      `${lessonId}\t${lessonTitle}\t${p.type}\t${p.title}\t${p.externalUrl}`,
    )).join('\n');
  writeFileSync(path.join(RESULTS_DIR, 'matched.tsv'), matchedTsv);

  const unmatchedTsv = ['sheetLessonName\tmaterialCount\tsample_titles']
    .concat(Array.from(unmatched.entries()).map(([name, items]) =>
      `${name}\t${items.length}\t${items.map(i => i.title).slice(0, 3).join(' | ')}`,
    )).join('\n');
  writeFileSync(path.join(RESULTS_DIR, 'unmatched-lessons.tsv'), unmatchedTsv);

  let materialsCreated = 0, linksCreated = 0, duplicatesSkipped = 0;

  if (APPLY) {
    console.log(`[ingest] Applying ${matchedRows.length} matched materials…`);
    // Group by lesson for transactional safety (D-52)
    const byLesson = new Map<string, typeof matchedRows>();
    for (const m of matchedRows) {
      const list = byLesson.get(m.lessonId) || [];
      list.push(m);
      byLesson.set(m.lessonId, list);
    }

    for (const [lessonId, items] of byLesson) {
      // D-43: Sentry custom span на каждый блок урока (per-row processing time)
      await Sentry.startSpan(
        {
          name: 'ingest.lessonBlock',
          op: 'script',
          attributes: { lessonId, materialCount: items.length },
        },
        async () => {
          try {
            await prisma.$transaction(async (tx) => {
              for (let order = 0; order < items.length; order++) {
                const { p } = items[order];
                // D-07 + D-49: dedup by (title, normalizedUrl) — trim, без lowercase/strip-query
                const normalizedUrl = normalizeUrl(p.externalUrl);
                const titleTrimmed = p.title.trim();
                let mat = await tx.material.findFirst({
                  where: { title: titleTrimmed, externalUrl: normalizedUrl },
                });
                if (!mat) {
                  mat = await tx.material.create({
                    data: {
                      type: p.type as any,
                      title: titleTrimmed,
                      description: p.description || null,
                      ctaText: p.ctaText,
                      externalUrl: normalizedUrl,
                      isStandalone: p.isStandalone,
                      createdBy: 'ingest-script',
                    },
                  });
                  materialsCreated++;
                } else {
                  duplicatesSkipped++;
                }
                // upsert link
                await tx.lessonMaterial.upsert({
                  where: { lessonId_materialId: { lessonId, materialId: mat.id } },
                  create: { lessonId, materialId: mat.id, order },
                  update: { order },
                });
                linksCreated++;
              }
            });
          } catch (e) {
            console.error(`[ingest] FAILED for lessonId=${lessonId}:`, e);
            Sentry.captureException(e, { tags: { script: 'ingest-materials', lessonId } });
          }
        },
      );
    }
  }

  const summary = {
    mode: APPLY ? 'apply' : 'dry-run',
    sheetId: SHEET_ID,
    tab: TAB_NAME,
    totalSheetRows: rows.length,
    parsedMaterials: parsed.length,
    matchedMaterials: matchedRows.length,
    unmatchedLessonGroups: unmatched.size,
    unmatchedMaterials: Array.from(unmatched.values()).reduce((s, a) => s + a.length, 0),
    materialsCreated,
    duplicatesSkipped,
    linksCreated,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(path.join(RESULTS_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('[ingest] DONE:', summary);

  // Flush Sentry (D-43) — критично для one-shot скриптов, иначе span'ы потеряются
  if (process.env.SENTRY_DSN) {
    await Sentry.flush(2000);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

**Файл 2 — `scripts/ingest-results/.gitkeep`** (пустой — гарантирует, что папка существует в git).

**Файл 3 — `scripts/ingest-results/.gitignore`**:
```
*.tsv
*.json
!.gitkeep
!.gitignore
```
(не коммитим отчёты — только структуру папки).

ВАЖНО: если `@sentry/node` не установлен в корне monorepo (web использует `@sentry/nextjs`) — добавить через `pnpm add -D @sentry/node -w` в корне. Если уже есть `@sentry/nextjs` глобально, использовать его (`import * as Sentry from '@sentry/nextjs'`) — Sentry SDK автоматически no-op без DSN.
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && pnpm tsc --noEmit scripts/ingest-materials.ts</automated>
  </verify>
  <acceptance_criteria>
    - Файл `scripts/ingest-materials.ts` существует, ≥200 LoC
    - `grep -c "APPLY" scripts/ingest-materials.ts` >= 2 (флаг и проверка)
    - `grep -c "normalizeLessonTitle" scripts/ingest-materials.ts` >= 2
    - `grep -c "normalizeUrl" scripts/ingest-materials.ts` >= 2 (D-49 — функция определена и используется в dedup)
    - `grep -c "RUSSIAN_TYPE_MAP" scripts/ingest-materials.ts` >= 1
    - `grep -c "summary.json" scripts/ingest-materials.ts` == 1
    - `grep -c "matched.tsv" scripts/ingest-materials.ts` == 1
    - `grep -c "unmatched-lessons.tsv" scripts/ingest-materials.ts` == 1
    - `grep -c "prisma.\\$transaction" scripts/ingest-materials.ts` == 1
    - `grep -c "@googleworkspace/cli" scripts/ingest-materials.ts` >= 1
    - `grep -c "Sentry.startSpan" scripts/ingest-materials.ts` >= 1 (D-43)
    - `grep -c "Sentry.init" scripts/ingest-materials.ts` >= 1 (D-43)
    - `grep -c "Sentry.flush" scripts/ingest-materials.ts` >= 1 (D-43 — flush обязателен для one-shot)
    - `scripts/ingest-results/.gitignore` существует и содержит `*.tsv`
    - `pnpm tsc --noEmit scripts/ingest-materials.ts` exit 0 (типы валидны)
  </acceptance_criteria>
  <done>Скрипт компилируется, поддерживает оба режима, формирует 3 отчёта, шлёт Sentry span'ы при наличии DSN, нормализует URL для дедупа.</done>
</task>

<task type="auto">
  <name>Task 2: Run dry-run, review unmatched, run apply on production</name>
  <files>scripts/ingest-results/matched.tsv, scripts/ingest-results/unmatched-lessons.tsv, scripts/ingest-results/summary.json</files>
  <read_first>
    - scripts/ingest-materials.ts (только что созданный)
    - .planning/phases/49-lesson-materials/49-CONTEXT.md (D-20 — apply на staging сначала, но БД shared с prod per Phase 48)
  </read_first>
  <action>
**Шаг 1 — Dry-run:**
```bash
cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL"
pnpm tsx scripts/ingest-materials.ts
```

Проверить:
- В консоли: `[ingest] Mode: DRY-RUN`
- В консоли: `[ingest] Sentry: ENABLED` (если SENTRY_DSN задан) или `disabled (no DSN)`
- В консоли финальный summary: `parsedMaterials: ~120`, `matchedMaterials: ≥110`, `materialsCreated: 0`, `linksCreated: 0`
- В `scripts/ingest-results/` появились 3 файла

**Шаг 2 — Review `unmatched-lessons.tsv`:**
- Открыть файл, посмотреть какие lesson names не нашлись
- Если ≥10 unmatched → задача 49-03 НЕ закрыта; идти к методологам с конкретным списком, попросить переименовать в Sheet (либо вписать `Lesson.id` напрямую как fallback, добавить в скрипт явный mapping)
- Если ≤10 unmatched → продолжить к шагу 3 (документация в SUMMARY.md)

**Шаг 3 — Apply (БД shared между staging и prod per Phase 48):**
```bash
pnpm tsx scripts/ingest-materials.ts --apply
```

Проверить summary:
- `materialsCreated`: ожидаемо 60-110 (зависит от дедупа — материал прикреплённый к 9 урокам создаётся 1 раз)
- `linksCreated`: ≥110
- `duplicatesSkipped`: разница между matched и created (повторное использование одного Material для разных уроков)
- В Sentry (если DSN задан): должны появиться span'ы `ingest.lessonBlock` (Performance → Transactions, фильтр по environment=ingest-script)

**Шаг 4 — Spot-check в Prisma Studio или через node:**
```bash
node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); Promise.all([p.material.count(), p.lessonMaterial.count(), p.material.findMany({take:3, include:{lessons:true}})]).then(([m,lm,sample])=>{console.log('materials:', m, 'links:', lm); console.log('sample:', JSON.stringify(sample, null, 2)); process.exit(0)})"
```

Должно показать ≥60 материалов, ≥110 связей, и в sample у каждого материала есть массив `lessons`.

**Шаг 5 — Идемпотентность:** Запустить `--apply` ещё раз, summary.json должен показать `materialsCreated: 0` (все уже есть, дедуп сработал).

**Шаг 6 — Зафиксировать в `.planning/phases/49-lesson-materials/49-03-NOTES.md`:**

```markdown
# Phase 49 · Plan 03 · Ingest Notes

## Dry-run (<date>)
- Total sheet rows: <N>
- Parsed materials: <N>
- Matched: <N>
- Unmatched lesson groups: <N>
- Top 5 unmatched (manual review needed):
  1. <name>
  2. <name>
  ...

## Apply (<date>)
- Mode: --apply
- Materials created: <N>
- Links created: <N>
- Duplicates skipped: <N>
- Spot-check: 3 случайных материала открываются с правильным lessons[] (через Prisma Studio)
- Sentry span'ы: <N> зафиксировано в Performance dashboard (если SENTRY_DSN задан)

## Idempotency check
- Second --apply run: materialsCreated=0, linksCreated=<same as before>

## Methodologist follow-up
- (если есть unmatched) — список передан методологам в TG/email на ревизию
```
  </action>
  <verify>
    <automated>cd "D:/GpT_docs/MPSTATS ACADEMY ADAPTIVE LEARNING/MAAL" && node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.material.count().then(c=>{if(c<60){console.error('Material count too low:', c); process.exit(1)} console.log('Material count OK:', c); return p.lessonMaterial.count()}).then(lc=>{if(lc<110){console.error('Link count too low:', lc); process.exit(1)} console.log('Link count OK:', lc); process.exit(0)})"</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/ingest-results/matched.tsv` существует, имеет >=110 data lines (excluding header)
    - `scripts/ingest-results/summary.json` содержит `"mode": "apply"`, `materialsCreated >= 50`, `linksCreated >= 110`
    - `prisma.material.count()` >= 60 в проде
    - `prisma.lessonMaterial.count()` >= 110
    - 3 random материала имеют непустой `lessons` массив (spot-check)
    - Повторный `--apply` не создаёт дубликатов (idempotency)
    - `49-03-NOTES.md` зафиксировал результаты
  </acceptance_criteria>
  <done>120 материалов залиты в БД, дедуп работает (URL trim'нут, query сохранён), идемпотентный повтор, отчёт по unmatched задокументирован.</done>
</task>

</tasks>

<verification>
- Dry-run отрабатывает без ошибок
- Apply создал materials + lesson_materials в правильном количестве
- Идемпотентность: 2-й запуск не дублирует
- unmatched < 10 (если больше — план не закрыт, нужно work-with-методологами)
- Spot-check через Prisma Studio: материалы видны на странице урока (после деплоя 49-04)
- Sentry span'ы видны в Performance (если SENTRY_DSN задан)
</verification>

<success_criteria>
1. matched.tsv содержит ≥110 строк данных
2. summary.json показывает успешный apply с разумным числом дубликатов
3. Повторный apply не меняет числа (URL normalization исключает trailing-space duplicates)
4. Sheet → DB roundtrip работает на ≥110 из 120 материалов
5. Sentry span ingest.lessonBlock виден в dashboard (или no-op если DSN не задан)
</success_criteria>

<output>
After completion, create `.planning/phases/49-lesson-materials/49-03-SUMMARY.md` documenting:
- Final summary.json content
- List of unmatched lessons (если есть)
- Sample DB records после ingest
- Подтверждение что Sentry span'ы зафиксированы (или причина почему DSN не задавался)
</output>
</content>
</invoke>