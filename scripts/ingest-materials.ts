#!/usr/bin/env tsx
/**
 * Phase 49 — Ingest Lesson Materials from Google Sheet
 *
 * Reads "Доп материалы к урокам" tab from the methodologists' sheet,
 * matches lesson names to Lesson rows in DB (fuzzy), dedups materials by
 * (title, externalUrl), writes Material + LessonMaterial records.
 *
 * Usage:
 *   pnpm tsx scripts/ingest-materials.ts                                     # dry-run (default)
 *   pnpm tsx scripts/ingest-materials.ts --apply                             # write to DB
 *   pnpm tsx scripts/ingest-materials.ts --sheet-id=... --tab="..."          # custom source
 *
 * Env (optional):
 *   SENTRY_DSN — if set, emits a custom span per lesson block (D-43)
 *
 * Reports written to: scripts/ingest-results/
 *   - matched.tsv          : (lessonId, lessonTitle, materialType, materialTitle, externalUrl)
 *   - unmatched-lessons.tsv: (sheetLessonName, materialCount, sample_titles)
 *   - summary.json         : { mode, totals, materialsCreated, linksCreated, duplicatesSkipped, ... }
 *
 * IMPORTANT — Sheet column layout (verified live 2026-04-27, NOT what 49-03 plan assumed):
 *   A: Название урока (lessonName)            — empty = continuation of previous lesson
 *   B: Название материала (title)
 *   C: Тип (PRESENTATION / ... or Russian synonym)
 *   D: Ссылка (externalUrl)
 *   E: Текст для кнопки (ctaText)
 *   F: Может ли быть полезен без просмотра (TRUE/FALSE → isStandalone)
 *   G: (unused — sheet has 6 data columns, not 7)
 * Section headers (e.g. "#1Аналитика для маркетплейсов") in column A are skipped (D-17).
 */

import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load env from MAAL/.env (DATABASE_URL etc.) so the script works from MAAL root.
dotenvConfig();

// ===== Soft Sentry import (optional — works without DSN) =====
// We use @sentry/nextjs because it's already in apps/web. Without DSN, init is a no-op.
type SentryLike = {
  init: (opts: any) => void;
  startSpan: <T>(opts: any, fn: () => Promise<T> | T) => Promise<T>;
  captureException: (e: unknown, ctx?: any) => void;
  flush: (ms: number) => Promise<boolean>;
};
let Sentry: SentryLike;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  Sentry = require('@sentry/nextjs') as SentryLike;
} catch {
  Sentry = {
    init: () => {},
    startSpan: async (_opts, fn) => fn(),
    captureException: () => {},
    flush: async () => true,
  };
}

const prisma = new PrismaClient();

// ===== Sentry init (D-43) =====
// If SENTRY_DSN is not set → Sentry no-op, ingest continues without telemetry.
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
  'ссылка на доп.сервис': 'EXTERNAL_SERVICE',
  'ссылка на доп. сервис': 'EXTERNAL_SERVICE',
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
  if (!trimmed) return null;
  if (VALID_TYPES.has(trimmed.toUpperCase())) return trimmed.toUpperCase();
  const lower = trimmed.toLowerCase();
  return RUSSIAN_TYPE_MAP[lower] || null;
}

// Infer material type from URL when sheet has no `type` column populated.
// Methodologists sometimes leave type blank — we infer to keep the row matchable
// instead of dropping it into unmatched bucket (Rule 2 — fill missing critical field).
function inferTypeFromUrl(url: string): string | null {
  const u = (url || '').toLowerCase();
  if (!u) return null;
  if (u.includes('docs.google.com/spreadsheets')) return 'CALCULATION_TABLE';
  if (u.includes('docs.google.com/document')) return 'MEMO';
  if (u.includes('docs.google.com/presentation')) return 'PRESENTATION';
  if (u.includes('drive.google.com/file')) return 'PRESENTATION'; // most pdf decks
  if (u.includes('t.me/') || u.includes('telegram.me/')) return 'EXTERNAL_SERVICE';
  return null;
}

// Some sheet rows have title="нет" (methodologist marker = "no material for this lesson").
// These are explicit non-materials, not parse errors — skip them entirely.
function isNoMaterialMarker(title: string): boolean {
  const t = title.trim().toLowerCase();
  return t === 'нет' || t === '-' || t === '—' || t === 'нет материала';
}

// ===== Lesson title normalization (D-18) =====
// Base normalization: lowercase, unify quotes/dashes, collapse spaces, remove
// the standalone Russian conjunction "и" (sheet has "ABC и XYZ", DB has "ABC XYZ").
function normalizeBase(s: string): string {
  return s
    .trim()
    .replace(/[«»“”„]/g, '"')
    .replace(/[—–]/g, '-')
    .toLowerCase()
    .replace(/\s+и\s+/g, ' ')   // "abc и xyz" → "abc xyz"
    .replace(/\s+/g, ' ')
    .trim();
}

// Backwards-compat wrapper used by legacy code paths — returns the part-before-pipe variant.
function normalizeLessonTitle(s: string): string {
  return normalizeBase(s.split('|')[0]);
}

// Return all matching candidates for a sheet/db title:
// 1. part before the pipe ("Этапы анализа ЦА | Анализ ЦА, 1" → "этапы анализа ца")
// 2. part after the pipe ("анализ ца, 1")
// 3. full string ("этапы анализа ца | анализ ца, 1")
// All trimmed/lowercased/and-collapsed via normalizeBase.
function lessonNormVariants(s: string): string[] {
  const out = new Set<string>();
  const full = normalizeBase(s);
  if (full) out.add(full);
  const parts = s.split('|');
  for (const part of parts) {
    const n = normalizeBase(part);
    if (n) out.add(n);
  }
  return Array.from(out);
}

// ===== URL normalization for dedup (D-49) =====
// trim only — URLs are case-sensitive after the host, and ?gid=... matters for Google Sheets.
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
  // Real CLI syntax (verified 2026-04-27): `gws sheets spreadsheets values get --params '{...}'`
  const params = JSON.stringify({
    spreadsheetId: SHEET_ID,
    range: `${TAB_NAME}!A1:G500`,
  });
  // Quoting: double-quote-escape JSON for cross-platform shell compatibility (Windows bash incl.)
  const quoted = `"${params.replace(/"/g, '\\"')}"`;
  const cmd = `npx --yes @googleworkspace/cli sheets spreadsheets values get --params ${quoted} --format json`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  // GWS CLI prepends "Using keyring backend: ..." line before JSON — strip it.
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) throw new Error(`No JSON in GWS CLI output: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(raw.slice(jsonStart));
  const rows: SheetRow[] = parsed.values || [];
  if (!Array.isArray(rows)) throw new Error('Unexpected GWS CLI output shape: ' + JSON.stringify(parsed).slice(0, 200));
  return rows.slice(1); // skip header row
}

// ===== Parse rows =====
type ParsedMaterial = {
  rowIndex: number;
  lessonName: string;
  type: string;
  title: string;
  description: string;
  externalUrl: string;
  ctaText: string;
  isStandalone: boolean;
  parseErrors: string[];
};

function parseRows(rows: SheetRow[]): { parsed: ParsedMaterial[]; skippedNoMaterial: number } {
  const out: ParsedMaterial[] = [];
  let currentLesson = '';
  let skippedNoMaterial = 0;

  rows.forEach((row, i) => {
    // Real layout: A=lesson, B=title, C=type, D=url, E=cta, F=isStandalone (NO description column)
    // Sheets API returns short arrays for trailing empty cells — pad with '' to length 6.
    const safe = (row || []).map(x => (x ?? '').toString());
    while (safe.length < 6) safe.push('');
    const [aRaw, bRaw, cRaw, dRaw, eRaw, fRaw] = safe;
    const lessonName = aRaw.trim();

    if (lessonName) {
      if (isSectionHeader(lessonName)) return; // skip section headers (D-17)
      currentLesson = lessonName;
    }
    if (!currentLesson) return;
    if (!bRaw.trim() && !dRaw.trim()) return; // empty material row (continuation marker only)

    // Methodologist marker "нет"/"-" in title column — explicit "no material", skip silently.
    if (isNoMaterialMarker(bRaw)) {
      skippedNoMaterial++;
      return;
    }

    const errors: string[] = [];
    // Try direct type, then fallback to URL-based inference (Rule 2 — many sheet rows have empty type)
    let type = normalizeType(cRaw);
    if (!type) type = inferTypeFromUrl(dRaw);
    if (!type) errors.push(`unknown type: "${cRaw}" and URL-inference failed`);
    if (!bRaw.trim()) errors.push('empty title');
    if (!dRaw.trim()) errors.push('empty externalUrl');

    out.push({
      rowIndex: i + 2, // +2 = header skipped (1) + 1-based numbering
      lessonName: currentLesson,
      type: type || 'MEMO', // safe fallback (won't be used if errors → unmatched bucket)
      title: bRaw.trim(),
      description: '', // sheet has no description column
      externalUrl: dRaw.trim(),
      ctaText: eRaw.trim() || 'Открыть',
      isStandalone: fRaw.trim().toUpperCase() === 'TRUE',
      parseErrors: errors,
    });
  });

  return { parsed: out, skippedNoMaterial };
}

// ===== Main =====
async function main() {
  console.log(`[ingest] Mode: ${APPLY ? 'APPLY (write to DB)' : 'DRY-RUN (no write)'}`);
  console.log(`[ingest] Sentry: ${process.env.SENTRY_DSN ? 'ENABLED' : 'disabled (no DSN)'}`);
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });

  const rows = readSheet();
  console.log(`[ingest] Read ${rows.length} data rows from sheet`);
  const { parsed, skippedNoMaterial } = parseRows(rows);
  console.log(`[ingest] Parsed ${parsed.length} material entries (skipped ${skippedNoMaterial} "нет"-marker rows)`);

  // Build lookup of lessons by all normalization variants
  const lessons = await prisma.lesson.findMany({ select: { id: true, title: true } });
  const variantToLesson = new Map<string, { id: string; title: string }>();
  // Pre-compute variants per lesson so we can also use them in substring fallback
  const lessonVariants: Array<{ id: string; title: string; variants: string[] }> = [];
  for (const l of lessons) {
    const vs = lessonNormVariants(l.title);
    lessonVariants.push({ id: l.id, title: l.title, variants: vs });
    for (const v of vs) {
      // Don't overwrite — first lesson with this variant wins (deterministic order)
      if (!variantToLesson.has(v)) variantToLesson.set(v, { id: l.id, title: l.title });
    }
  }
  console.log(`[ingest] Loaded ${lessons.length} lessons from DB (${variantToLesson.size} unique title variants)`);

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

    const sheetVariants = lessonNormVariants(p.lessonName);
    let match: { id: string; title: string } | undefined;

    // Stage 1: exact variant lookup (includes the legacy `normalizeLessonTitle` form
    // — part before the pipe — as one of the variants).
    const legacyNorm = normalizeLessonTitle(p.lessonName); // explicit invocation, kept for clarity
    if (legacyNorm) {
      const hit = variantToLesson.get(legacyNorm);
      if (hit) match = hit;
    }
    if (!match) {
      for (const v of sheetVariants) {
        const hit = variantToLesson.get(v);
        if (hit) { match = hit; break; }
      }
    }

    // Stage 2: substring match (any sheet variant containing/contained in any lesson variant)
    if (!match) {
      for (const lv of lessonVariants) {
        for (const sv of sheetVariants) {
          for (const v of lv.variants) {
            if (sv.length >= 8 && v.length >= 8 && (v.includes(sv) || sv.includes(v))) {
              match = { id: lv.id, title: lv.title };
              break;
            }
          }
          if (match) break;
        }
        if (match) break;
      }
    }

    if (match) {
      matchedRows.push({ p, lessonId: match.id, lessonTitle: match.title });
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
      // D-43: Sentry custom span around per-lesson block processing
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
                // D-07 + D-49: dedup by (title, normalizedUrl) — trim only, no lowercase/strip-query
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
                // upsert link (idempotent on rerun)
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
    totalSheetDataRows: rows.length,
    skippedNoMaterialMarkers: skippedNoMaterial,
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

  // Flush Sentry (D-43) — critical for one-shot scripts, otherwise spans are lost.
  if (process.env.SENTRY_DSN) {
    await Sentry.flush(2000);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
