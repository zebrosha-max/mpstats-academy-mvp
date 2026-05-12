// scripts/vision-ingest/review-mappings.ts
// Helper for human review of low-confidence selector candidates.
//
// Run:
//   npx tsx scripts/vision-ingest/review-mappings.ts --suffix <SUFFIX>
//
// Reads:  results/low-confidence-${SUFFIX}.csv
// Prints: row count, markdown preview table, path to the CSV, and (Windows) tries
//         to open the folder in Explorer so owner can edit in Excel/Sheets.
//
// Owner workflow:
//   1. Open the CSV in Excel / Google Sheets.
//   2. For each row, fill the `approved_lessonId` column:
//        - copy candidate lessonId (current selector guess) → confirm
//        - paste a different lessonId → override
//        - leave blank → skip (defer)
//   3. Save as `low-confidence-${SUFFIX}-approved.csv` in the same folder.
//   4. Run `import-mappings.ts --suffix ${SUFFIX}` to apply.
//
// This script does NOT call any API or DB — it's pure local file inspection.

import { existsSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { spawn } from 'child_process';
import { INGEST_CONFIG } from './config';

interface Args { suffix?: string; open: boolean; }

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--suffix') out.suffix = argv[++i];
    else if (a === '--no-open') out.open = false;
  }
  return out;
}

// Tiny CSV parser — handles quoted fields with escaped quotes.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      cur += c;
      i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(cur); cur = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); row = []; cur = ''; }
        // swallow \r\n pair
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++;
        continue;
      }
      cur += c;
      i++;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function main() {
  const args = parseArgs();
  if (!args.suffix) {
    console.error('Usage: review-mappings.ts --suffix <SUFFIX> [--no-open]');
    process.exit(1);
  }

  const csvPath = resolve(join(INGEST_CONFIG.results_dir, `low-confidence-${args.suffix}.csv`));
  if (!existsSync(csvPath)) {
    console.error(`CSV not found: ${csvPath}`);
    console.error(`Run select-v4 with INGEST_SUFFIX=${args.suffix} first.`);
    process.exit(1);
  }

  const text = readFileSync(csvPath, 'utf8');
  const rows = parseCSV(text);
  if (rows.length === 0) {
    console.log(`Empty CSV: ${csvPath}`);
    return;
  }
  const header = rows[0];
  const data = rows.slice(1).filter((r) => r.length > 1 || (r[0] || '').trim().length > 0);

  console.log(`\nLow-confidence review — suffix=${args.suffix}`);
  console.log(`File: ${csvPath}`);
  console.log(`Rows to review: ${data.length}`);
  if (data.length === 0) {
    console.log(`\nNo low-confidence rows. Nothing to do.`);
    return;
  }

  // Print compact markdown table (first 20 rows)
  const idxLessonId = header.indexOf('lessonId');
  const idxModule = header.indexOf('module');
  const idxTitle = header.indexOf('lessonTitle');
  const idxFile = header.indexOf('candidateFilename');
  const idxScore = header.indexOf('score');
  const idxJudge = header.indexOf('llmConfidence');
  const idxRat = header.indexOf('llmRationale');

  console.log(`\nPreview (first ${Math.min(20, data.length)}):`);
  console.log(`| # | lessonId | module | title | file | score | judge | rationale |`);
  console.log(`|---|----------|--------|-------|------|-------|-------|-----------|`);
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const r = data[i];
    console.log(
      `| ${i + 1} | ${truncate(r[idxLessonId] || '', 32)} | ${truncate(r[idxModule] || '', 20)} | ${truncate((r[idxTitle] || '').replace(/\|/g, '/'), 40)} | ${truncate((r[idxFile] || '').replace(/\|/g, '/'), 40)} | ${r[idxScore] || ''} | ${r[idxJudge] || '-'} | ${truncate((r[idxRat] || '').replace(/\|/g, '/'), 50)} |`,
    );
  }
  if (data.length > 20) console.log(`... and ${data.length - 20} more rows`);

  console.log(`\nNext steps:`);
  console.log(`  1. Edit CSV in Excel / Sheets (fill 'approved_lessonId' column).`);
  console.log(`  2. Save as: low-confidence-${args.suffix}-approved.csv (same folder).`);
  console.log(`  3. Run: npx tsx --env-file=.env scripts/vision-ingest/import-mappings.ts --suffix ${args.suffix}`);

  if (args.open && process.platform === 'win32') {
    const folder = dirname(csvPath);
    try {
      spawn('cmd', ['/c', 'start', '""', folder], { detached: true, stdio: 'ignore' }).unref();
      console.log(`\nOpened folder in Explorer: ${folder}`);
    } catch {
      // ignore
    }
  }
}

main();
