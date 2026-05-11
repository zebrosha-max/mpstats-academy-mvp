// scripts/vision-ingest/select-sprint2c-v2.ts
// Sprint 2C v2 selector — bipartite greedy assignment of local videos to visible DB lessons
// per module to achieve ~100% recall on 03_ai. See handoff doc for rationale.
//
// Differs from v1 by:
//   - Querying ALL visible lessons per module up-front (single query per module).
//   - Tokenizing filename (Latin + Cyrillic translit) and title; scoring by token overlap.
//   - Greedy bipartite assignment by descending score (resolves multi-row ambiguity).
//   - Handling `mNN_<slug>_<digit>` folder duplicates by normalizing to canonical module
//     name extracted from lesson id (`03_ai_<module>_<order>`).
import { execSync } from 'child_process';
import { readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, relative } from 'path';
import { INGEST_CONFIG } from './config';

interface VideoCandidate {
  localPath: string;
  filename: string;
  durationSeconds: number;
  durationFormatted: string;
  bucketSize: 'short' | 'medium' | 'long';
  module: string; // canonical (matches DB)
  rawModuleDir: string; // filesystem dir name (may have _<digit> suffix)
}

interface SelectedLesson extends Omit<VideoCandidate, 'rawModuleDir'> {
  lessonId: string;
  lessonTitle: string;
  platformUrl: string;
  category: 'theory' | 'ui_demo' | 'mpstats_cabinet';
}

interface LessonRow {
  id: string;
  title: string;
  order: number;
}

const VIDEO_EXT = ['.mp4', '.mov', '.mkv'];

// --- Transliteration (copied verbatim from v1) ---
const TRANSLIT_MULTI: Array<[string, string]> = [
  ['shch', 'щ'], ['sch', 'щ'],
  ['sh', 'ш'], ['ch', 'ч'], ['zh', 'ж'], ['ts', 'ц'],
  ['ya', 'я'], ['yu', 'ю'], ['yo', 'ё'],
  ['kh', 'х'],
];
const VOWELS_LAT = new Set(['a', 'e', 'i', 'o', 'u']);
const TRANSLIT_SINGLE: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р',
  s: 'с', t: 'т', u: 'у', f: 'ф', h: 'х', c: 'ц', j: 'ж', w: 'в',
  x: 'кс', q: 'к',
  "'": 'ь', '"': 'ъ',
};

function translitToCyrillic(latin: string): string {
  const s = latin.toLowerCase().replace(/_/g, ' ');
  let out = '';
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const [pat, rep] of TRANSLIT_MULTI) {
      if (s.startsWith(pat, i)) {
        out += rep;
        i += pat.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = s[i];
    if (ch === 'y') {
      const prev = i > 0 ? s[i - 1] : ' ';
      out += VOWELS_LAT.has(prev) || prev === ' ' ? 'й' : 'ы';
      i++;
      continue;
    }
    out += TRANSLIT_SINGLE[ch] !== undefined ? TRANSLIT_SINGLE[ch] : ch;
    i++;
  }
  return out;
}

// --- Supabase query helper (copied verbatim from v1) ---
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
      const body = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt < 5) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        return supabaseQuery(sql, attempt + 1);
      }
      throw new Error(`Supabase ${res.status}: ${body}`);
    }
    return res.json();
  } catch (e: any) {
    const transient = /fetch failed|socket|ECONN|UND_ERR/i.test(String(e?.message) + String(e?.cause?.code));
    if (transient && attempt < 5) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      return supabaseQuery(sql, attempt + 1);
    }
    throw e;
  }
}

// --- Tokenization ---
const TOKEN_SPLIT_RE = /[\s_\-.,|()«»"'!?]+/;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(TOKEN_SPLIT_RE)
    .map((t) => t.replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi, ''))
    .filter((t) => t.length >= 3);
}

interface FilenameTokens {
  latin: Set<string>;
  cyrillic: Set<string>;
  leadingOrder: number | null;
}

function extractFilenameTokens(filename: string): FilenameTokens {
  let stem = filename.replace(/\.[^.]+$/, '');
  // Capture leading numeric prefix as potential order signal.
  const orderMatch = stem.match(/^(\d+)(?:_(\d+))?_/);
  const leadingOrder = orderMatch ? parseInt(orderMatch[1], 10) : null;
  stem = stem.replace(/^\d+(?:_\d+)?_/, '');
  const latin = new Set(tokenize(stem));
  const cyrillic = new Set(tokenize(translitToCyrillic(stem)));
  return { latin, cyrillic, leadingOrder };
}

function score(filenameTokens: FilenameTokens, lesson: LessonRow): number {
  const titleTokens = tokenize(lesson.title);
  let overlap = 0;
  for (const t of titleTokens) {
    if (filenameTokens.latin.has(t) || filenameTokens.cyrillic.has(t)) overlap++;
  }
  let s = overlap;
  if (filenameTokens.leadingOrder !== null && filenameTokens.leadingOrder === lesson.order) {
    s += 0.5;
  }
  return s;
}

// --- Filesystem walking ---
// Canonical module name is derived from the lesson id pattern: `03_ai_<module>_<order>`.
// Filesystem may have suffixed dirs like `m03_visual_1`. We map raw dir → canonical
// by checking if the raw dir name matches `<canonical>_<digit>` for any canonical.
function listVideos(courseRoot: string, canonicalModules: Set<string>): VideoCandidate[] {
  const out: VideoCandidate[] = [];
  function resolveCanonical(rawDir: string): string {
    if (canonicalModules.has(rawDir)) return rawDir;
    // Try stripping trailing `_<digit>(s)`
    const stripped = rawDir.replace(/_\d+$/, '');
    if (canonicalModules.has(stripped)) return stripped;
    return rawDir; // unknown — keep raw, will fail to match
  }
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (VIDEO_EXT.some((e) => entry.name.toLowerCase().endsWith(e))) {
        try {
          const out2 = execSync(
            `ffprobe -v error -show_entries format=duration -of csv=p=0 "${full}"`,
            { encoding: 'utf8' },
          ).trim();
          const seconds = Math.round(parseFloat(out2));
          const rel = relative(courseRoot, full).replace(/\\/g, '/');
          const moduleMatch = rel.match(/^(m\d+_[^/]+)/);
          const rawModuleDir = moduleMatch ? moduleMatch[1] : 'unknown';
          const canonical = resolveCanonical(rawModuleDir);
          let bucket: 'short' | 'medium' | 'long';
          if (seconds < 900) bucket = 'short';
          else if (seconds < 2400) bucket = 'medium';
          else bucket = 'long';
          out.push({
            localPath: full.replace(/\\/g, '/'),
            filename: entry.name,
            durationSeconds: seconds,
            durationFormatted: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
            bucketSize: bucket,
            module: canonical,
            rawModuleDir,
          });
        } catch {
          // skip
        }
      }
    }
  }
  walk(courseRoot);
  return out;
}

async function main() {
  const courseRoot = join(INGEST_CONFIG.academy_courses_root, INGEST_CONFIG.pilot_target_course);

  // Step 1: discover canonical modules from DB.
  console.log('Discovering canonical module names from DB...');
  const moduleRows = await supabaseQuery(
    `SELECT DISTINCT substring(id from '^03_ai_(m\\d+_[a-z_]+)_\\d+$') AS module
     FROM "Lesson"
     WHERE id LIKE '03_ai_%' AND substring(id from '^03_ai_(m\\d+_[a-z_]+)_\\d+$') IS NOT NULL
     ORDER BY module;`,
  );
  const canonicalModules = new Set<string>(moduleRows.map((r) => r.module).filter(Boolean));
  console.log(`Canonical modules (${canonicalModules.size}): ${[...canonicalModules].join(', ')}`);

  // Step 2: scan filesystem.
  console.log(`Сканирую видео в ${courseRoot}...`);
  const allVideos = listVideos(courseRoot, canonicalModules);
  console.log(`Найдено ${allVideos.length} видео в 03_ai`);

  // Step 3: exclusion set.
  console.log('Fetching already-ingested lessons from DB...');
  const alreadyIngestedRows = await supabaseQuery(
    `SELECT DISTINCT lesson_id FROM content_chunk WHERE source_type='academy_video_frame';`,
  );
  const excluded = new Set<string>(alreadyIngestedRows.map((r) => r.lesson_id));
  console.log(`Already-ingested lessons: ${excluded.size}`);

  // Step 4: group videos by canonical module.
  const videosByModule = new Map<string, VideoCandidate[]>();
  for (const v of allVideos) {
    if (!videosByModule.has(v.module)) videosByModule.set(v.module, []);
    videosByModule.get(v.module)!.push(v);
  }

  // Step 5: for each module, fetch visible lessons, score, and greedy-assign.
  const assignments: Array<{ video: VideoCandidate; lesson: LessonRow; score: number }> = [];
  const unmatchedVideos: VideoCandidate[] = [];
  const unmatchedLessonsByModule = new Map<string, LessonRow[]>();

  const modulesSorted = [...canonicalModules].sort();
  for (const m of modulesSorted) {
    const lessons = (await supabaseQuery(
      `SELECT id, title, "order"
       FROM "Lesson"
       WHERE id LIKE '03_ai_${m}_%' AND "isHidden" = false
       ORDER BY "order";`,
    )) as LessonRow[];
    const videos = videosByModule.get(m) || [];

    console.log(`\n=== Module ${m}: ${videos.length} videos, ${lessons.length} visible lessons ===`);

    // Build score matrix.
    type Pair = { video: VideoCandidate; lesson: LessonRow; score: number };
    const pairs: Pair[] = [];
    for (const v of videos) {
      const fnTok = extractFilenameTokens(v.filename);
      for (const l of lessons) {
        const sc = score(fnTok, l);
        if (sc > 0) pairs.push({ video: v, lesson: l, score: sc });
      }
    }
    // Sort by score desc; tie-break: prefer pair where filename leading order == lesson order.
    pairs.sort((a, b) => b.score - a.score);

    const assignedVideos = new Set<string>();
    const assignedLessonIds = new Set<string>();
    for (const p of pairs) {
      if (assignedVideos.has(p.video.localPath)) continue;
      if (assignedLessonIds.has(p.lesson.id)) continue;
      assignments.push(p);
      assignedVideos.add(p.video.localPath);
      assignedLessonIds.add(p.lesson.id);
    }

    for (const v of videos) {
      if (!assignedVideos.has(v.localPath)) {
        unmatchedVideos.push(v);
        console.warn(`  ⚠ unmatched video: ${v.rawModuleDir}/${v.filename}`);
      }
    }
    const unmatchedLessons = lessons.filter((l) => !assignedLessonIds.has(l.id));
    if (unmatchedLessons.length > 0) {
      unmatchedLessonsByModule.set(m, unmatchedLessons);
      for (const l of unmatchedLessons) {
        console.warn(`  ⚠ unmatched lesson: ${l.id} "${l.title}"`);
      }
    }
  }

  // Step 6: build selected list, filter excluded.
  const selected: SelectedLesson[] = [];
  let skipped = 0;
  for (const a of assignments) {
    if (excluded.has(a.lesson.id)) {
      skipped++;
      console.log(`  ⏭ ${a.video.module}/${a.video.filename} → ${a.lesson.id} (already-ingested)`);
      continue;
    }
    const category =
      a.video.bucketSize === 'short' ? 'theory' :
      a.video.bucketSize === 'medium' ? 'ui_demo' : 'mpstats_cabinet';
    const { rawModuleDir, ...videoCore } = a.video;
    selected.push({
      ...videoCore,
      category,
      lessonId: a.lesson.id,
      lessonTitle: a.lesson.title,
      platformUrl: `https://platform.mpstats.academy/learn/${a.lesson.id}`,
    });
    console.log(
      `  [score=${a.score} ${a.video.bucketSize}] ${a.video.module}/${a.video.filename} → ${a.lesson.title}`,
    );
  }

  if (!existsSync(INGEST_CONFIG.results_dir)) {
    mkdirSync(INGEST_CONFIG.results_dir, { recursive: true });
  }
  const outPath = join(INGEST_CONFIG.results_dir, 'selected-sprint2c-v2-lessons.json');
  writeFileSync(outPath, JSON.stringify(selected, null, 2), 'utf8');

  console.log(`\nГотово: ${outPath}`);
  console.log(
    `Selected: ${selected.length}, Skipped (already-ingested): ${skipped}, ` +
    `Unmatched-videos: ${unmatchedVideos.length}, ` +
    `Unmatched-lessons: ${[...unmatchedLessonsByModule.values()].reduce((s, l) => s + l.length, 0)}`,
  );
  if (unmatchedVideos.length > 0) {
    console.log('\nUnmatched videos:');
    for (const v of unmatchedVideos) console.log(`  - ${v.rawModuleDir}/${v.filename}`);
  }
  if (unmatchedLessonsByModule.size > 0) {
    console.log('\nUnmatched visible lessons:');
    for (const [m, ls] of unmatchedLessonsByModule) {
      for (const l of ls) console.log(`  - ${m}: ${l.id} "${l.title}"`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
