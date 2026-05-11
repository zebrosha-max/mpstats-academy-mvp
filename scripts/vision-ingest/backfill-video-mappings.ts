// One-off backfill: write known filename↔lessonId mappings into Lesson.metadata.videoSource.
// Reads selected-pilot-lessons.json (9 entries) + selected-sprint2c-lessons.json (79 entries).
// Uses Supabase Management API (same pattern as R1 recovery).
//
// Run:
//   npx tsx --env-file=.env scripts/vision-ingest/backfill-video-mappings.ts
//
// Idempotent: re-running overwrites existing videoSource value.

import { readFileSync } from 'fs';

interface Selected {
  localPath: string;
  filename: string;
  module: string;
  lessonId: string;
  lessonTitle: string;
}

interface VideoSourceMetadata {
  filename: string;
  module: string;
  localPath: string;
  source: 'pilot' | 'sprint2c' | 'manual' | 'positional' | 'llm-judge';
  backfilledAt: string;
}

async function supabaseQuery(sql: string, attempt = 1): Promise<any[]> {
  const token = process.env.SUPABASE_MGMT_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF || 'saecuecevicwjkpmaoot';
  if (!token) throw new Error('SUPABASE_MGMT_TOKEN required');
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
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
    const transient = /fetch failed|socket|ECONN|UND_ERR/i.test(String(e?.message));
    if (transient && attempt < 5) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      return supabaseQuery(sql, attempt + 1);
    }
    throw e;
  }
}

async function main() {
  const now = new Date().toISOString();
  const pilot = JSON.parse(readFileSync('scripts/vision-ingest/results/selected-pilot-lessons.json', 'utf8')) as Selected[];
  const sprint2c = JSON.parse(readFileSync('scripts/vision-ingest/results/selected-sprint2c-lessons.json', 'utf8')) as Selected[];

  const updates: Array<{ lessonId: string; vs: VideoSourceMetadata }> = [];
  for (const e of pilot) {
    updates.push({ lessonId: e.lessonId, vs: { filename: e.filename, module: e.module, localPath: e.localPath, source: 'pilot', backfilledAt: now } });
  }
  for (const e of sprint2c) {
    updates.push({ lessonId: e.lessonId, vs: { filename: e.filename, module: e.module, localPath: e.localPath, source: 'sprint2c', backfilledAt: now } });
  }
  console.log(`Backfill: ${pilot.length} pilot + ${sprint2c.length} sprint2c = ${updates.length} mappings`);

  // Dedup check (Lesson.id should be unique across the two JSONs anyway)
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const u of updates) {
    if (seen.has(u.lessonId)) dupes.push(u.lessonId);
    seen.add(u.lessonId);
  }
  if (dupes.length) {
    console.error('Duplicate lessonIds in backfill:', dupes);
    process.exit(1);
  }

  // Build a single multi-statement UPDATE — Supabase Management API supports it.
  // jsonb_set with create_missing=true (default), so metadata=null becomes {} then adds videoSource.
  const statements = updates.map((u) => {
    const vsJson = JSON.stringify(u.vs).replace(/'/g, "''");
    const idEsc = u.lessonId.replace(/'/g, "''");
    return `UPDATE "Lesson" SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{videoSource}', '${vsJson}'::jsonb) WHERE id = '${idEsc}';`;
  });

  // Chunk to avoid request size limits
  const CHUNK = 25;
  let done = 0;
  for (let i = 0; i < statements.length; i += CHUNK) {
    const sql = statements.slice(i, i + CHUNK).join('\n');
    await supabaseQuery(sql);
    done += Math.min(CHUNK, statements.length - i);
    console.log(`  ${done}/${statements.length} mappings written`);
  }

  // Verify
  const rows = await supabaseQuery(`SELECT COUNT(*) AS c FROM "Lesson" WHERE metadata->'videoSource' IS NOT NULL;`);
  console.log(`\nFinal: ${rows[0].c} lessons have metadata.videoSource set`);

  // Sample
  const sample = await supabaseQuery(`SELECT id, metadata->'videoSource'->>'filename' AS filename FROM "Lesson" WHERE metadata->'videoSource' IS NOT NULL ORDER BY random() LIMIT 5;`);
  console.log('Sample:');
  for (const r of sample) console.log(' ', r.id, '→', r.filename);
}

main().catch((e) => { console.error(e); process.exit(1); });
