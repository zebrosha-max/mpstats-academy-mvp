// scripts/vision-ingest/import-mappings.ts
// Apply human-approved low-confidence mappings back into Lesson.metadata.videoSource.
//
// Run:
//   npx tsx --env-file=.env scripts/vision-ingest/import-mappings.ts --suffix <SUFFIX>
//   (add --dry-run to preview without writing)
//
// Reads:  results/low-confidence-${SUFFIX}-approved.csv
//
// CSV columns (must include): lessonId, courseId, module, lessonTitle,
//   candidateFilename, candidateLocalPath, score, llmConfidence, llmRationale,
//   approved_lessonId.
//
// Per-row logic:
//   - approved_lessonId blank → skip (owner deferred).
//   - approved_lessonId set → write videoSource{filename,module,localPath,source:'human-review',backfilledAt}
//     to that lessonId (which may or may not equal candidate lessonId).
//
// Idempotent: re-running with the same CSV produces the same DB state.

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { INGEST_CONFIG } from './config';

interface Args { suffix?: string; dryRun: boolean; }

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const out: Args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--suffix') out.suffix = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

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
      cur += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(cur); cur = ''; i++; continue; }
      if (c === '\n' || c === '\r') {
        if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); row = []; cur = ''; }
        if (c === '\r' && text[i + 1] === '\n') i++;
        i++; continue;
      }
      cur += c; i++;
    }
  }
  if (cur.length > 0 || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

const FETCH_TIMEOUT_MS = 60_000;

async function supabaseQuery(sql: string, attempt = 1): Promise<any[]> {
  const token = process.env.SUPABASE_MGMT_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF || 'saecuecevicwjkpmaoot';
  if (!token) throw new Error('SUPABASE_MGMT_TOKEN required');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
      signal: ctl.signal,
    });
    if (!res.ok) {
      if ((res.status === 429 || res.status >= 500) && attempt < 5) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        return supabaseQuery(sql, attempt + 1);
      }
      throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    }
    return res.json();
  } catch (e: any) {
    const transient = /fetch failed|socket|ECONN|UND_ERR|aborted/i.test(String(e?.message));
    if (transient && attempt < 5) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      return supabaseQuery(sql, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

interface VideoSourceMetadata {
  filename: string;
  module: string;
  localPath: string;
  source: 'human-review';
  backfilledAt: string;
  reviewSuffix: string;
}

async function main() {
  const args = parseArgs();
  if (!args.suffix) {
    console.error('Usage: import-mappings.ts --suffix <SUFFIX> [--dry-run]');
    process.exit(1);
  }
  const csvPath = resolve(join(INGEST_CONFIG.results_dir, `low-confidence-${args.suffix}-approved.csv`));
  if (!existsSync(csvPath)) {
    console.error(`Approved CSV not found: ${csvPath}`);
    console.error(`Expected file produced by review workflow (rename of low-confidence-${args.suffix}.csv after fill).`);
    process.exit(1);
  }

  const rows = parseCSV(readFileSync(csvPath, 'utf8'));
  if (rows.length < 2) { console.log('Empty CSV. Nothing to import.'); return; }
  const header = rows[0];
  const idx = (name: string) => header.indexOf(name);
  const required = ['module', 'candidateFilename', 'candidateLocalPath', 'approved_lessonId'];
  for (const r of required) {
    if (idx(r) === -1) {
      console.error(`CSV missing required column: ${r}`);
      console.error(`Header found: ${header.join(',')}`);
      process.exit(1);
    }
  }

  const data = rows.slice(1).filter((r) => r.length > 1 || (r[0] || '').trim().length > 0);
  const now = new Date().toISOString();

  interface Pending { lessonId: string; vs: VideoSourceMetadata; }
  const pending: Pending[] = [];
  let skipped = 0;
  for (const r of data) {
    const approved = (r[idx('approved_lessonId')] || '').trim();
    if (!approved) { skipped++; continue; }
    pending.push({
      lessonId: approved,
      vs: {
        filename: r[idx('candidateFilename')] || '',
        module: r[idx('module')] || '',
        localPath: r[idx('candidateLocalPath')] || '',
        source: 'human-review',
        backfilledAt: now,
        reviewSuffix: args.suffix,
      },
    });
  }
  console.log(`Approved: ${pending.length}, skipped (blank): ${skipped}, total rows: ${data.length}`);

  if (pending.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  // Pre-check: do all approved lessonIds exist?
  const ids = pending.map((p) => p.lessonId.replace(/'/g, "''"));
  const inList = ids.map((id) => `'${id}'`).join(',');
  const existRows = await supabaseQuery(`SELECT id FROM "Lesson" WHERE id IN (${inList});`);
  const existSet = new Set<string>(existRows.map((r) => r.id));
  const missing = pending.filter((p) => !existSet.has(p.lessonId)).map((p) => p.lessonId);
  if (missing.length > 0) {
    console.error(`! ${missing.length} approved lessonIds not in DB:`);
    for (const m of missing) console.error(`  - ${m}`);
    console.error(`Aborting (no partial writes). Fix CSV and re-run.`);
    process.exit(1);
  }

  // Build SQL statements
  const statements = pending.map((p) => {
    const vsJson = JSON.stringify(p.vs).replace(/'/g, "''");
    const idEsc = p.lessonId.replace(/'/g, "''");
    return `UPDATE "Lesson" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{videoSource}', '${vsJson}'::jsonb) WHERE id = '${idEsc}';`;
  });

  if (args.dryRun) {
    console.log('\n[DRY-RUN] Statements that would be executed:');
    for (const s of statements.slice(0, 5)) console.log('  ' + s);
    if (statements.length > 5) console.log(`  ... and ${statements.length - 5} more`);
    return;
  }

  const CHUNK = 25;
  let done = 0;
  for (let i = 0; i < statements.length; i += CHUNK) {
    const sql = statements.slice(i, i + CHUNK).join('\n');
    await supabaseQuery(sql);
    done += Math.min(CHUNK, statements.length - i);
    console.log(`  ${done}/${statements.length} mappings written`);
  }

  console.log(`\nApplied: ${pending.length}, skipped (blank): ${skipped}, failed (not in DB): 0`);
}

main().catch((e) => { console.error(e); process.exit(1); });
