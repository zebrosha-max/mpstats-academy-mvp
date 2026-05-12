// scripts/vision-ingest/select-sprint2c-v3.ts
// Sprint 2C v3 selector — POSITIONAL 1:1 mapping of sorted local videos to
// visible DB lessons ordered by Lesson."order" ASC, per canonical module.
//
// Rationale: filename naming convention upstream (NNN_M_...) is positional and
// enforces order. v1 (word-overlap) and v2 (greedy bipartite scoring) both
// produced ≥6 wrong assignments in m03_visual alone because lessons share
// vocabulary (infographic, WeShop, Krea AI, etc.). Manual ground truth for
// m03_visual confirmed that sorted-by-filename ↔ sorted-by-order is correct
// for all 15 lessons there.
//
// Algorithm:
//   1. Discover canonical modules from DB.
//   2. List local videos, group by canonical module (folder `<m>_<digit>` → `<m>`).
//   3. For each module:
//        - Sort files lexicographically.
//        - Query visible lessons ordered by Lesson."order" ASC.
//        - If counts match → positional 1:1 mapping.
//        - If files > lessons → attempt to trim by dropping low-overlap edge files.
//        - If files < lessons → log unmatched lessons; positional best-effort.
//   4. For every assigned (file, lesson) pair, compute soft word-overlap as
//      validation; pairs with overlap == 0 are logged as WARNING (low-confidence).
//   5. Drop pairs whose lesson is already-ingested.
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

// --- Transliteration (copied verbatim from v2) ---
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

// --- Supabase query helper (copied verbatim from v2) ---
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

// --- Tokenization (for validation only) ---
const TOKEN_SPLIT_RE = /[\s_\-.,|()«»"'!?]+/;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(TOKEN_SPLIT_RE)
    .map((t) => t.replace(/^[^a-zа-яё0-9]+|[^a-zа-яё0-9]+$/gi, ''))
    .filter((t) => t.length >= 3);
}

function filenameTokens(filename: string): { latin: Set<string>; cyrillic: Set<string> } {
  let stem = filename.replace(/\.[^.]+$/, '');
  stem = stem.replace(/^\d+(?:_\d+)?_/, '');
  return {
    latin: new Set(tokenize(stem)),
    cyrillic: new Set(tokenize(translitToCyrillic(stem))),
  };
}

function overlapScore(filename: string, title: string): number {
  const ftok = filenameTokens(filename);
  const titleTokens = tokenize(title);
  let overlap = 0;
  for (const t of titleTokens) {
    if (ftok.latin.has(t) || ftok.cyrillic.has(t)) overlap++;
  }
  return overlap;
}

// --- Filesystem walking (copied from v2) ---
function listVideos(courseRoot: string, canonicalModules: Set<string>): VideoCandidate[] {
  const out: VideoCandidate[] = [];
  function resolveCanonical(rawDir: string): string {
    if (canonicalModules.has(rawDir)) return rawDir;
    const stripped = rawDir.replace(/_\d+$/, '');
    if (canonicalModules.has(stripped)) return stripped;
    return rawDir;
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

interface ModuleStat {
  module: string;
  files: number;
  lessons: number;
  mapped: number;
  warnings: number;
  droppedFiles: string[];
  unmatchedLessons: string[];
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

  // Step 5: positional per-module mapping.
  interface Pair {
    video: VideoCandidate;
    lesson: LessonRow;
    overlap: number;
  }
  const pairs: Pair[] = [];
  const stats: ModuleStat[] = [];
  const unmatchedVideos: VideoCandidate[] = [];
  const lowConfidence: Pair[] = [];

  const modulesSorted = [...canonicalModules].sort();
  for (const m of modulesSorted) {
    const lessons = (await supabaseQuery(
      `SELECT id, title, "order"
       FROM "Lesson"
       WHERE id LIKE '03_ai_${m}_%' AND "isHidden" = false
       ORDER BY "order" ASC;`,
    )) as LessonRow[];
    const videos = (videosByModule.get(m) || []).slice().sort((a, b) =>
      a.filename.localeCompare(b.filename, 'en'),
    );

    const stat: ModuleStat = {
      module: m,
      files: videos.length,
      lessons: lessons.length,
      mapped: 0,
      warnings: 0,
      droppedFiles: [],
      unmatchedLessons: [],
    };

    console.log(`\n=== Module ${m}: ${videos.length} videos, ${lessons.length} visible lessons ===`);

    let workingVideos = videos.slice();

    if (workingVideos.length > lessons.length) {
      // Trim from edges: drop a file if it has 0 overlap with any lesson within ±2 of its
      // candidate position. Try start then end, until counts equal or no more droppable.
      const dropFromEdge = (side: 'start' | 'end'): boolean => {
        const idx = side === 'start' ? 0 : workingVideos.length - 1;
        const file = workingVideos[idx];
        if (!file) return false;
        // candidate position when aligned to lessons after dropping this one
        // if drop from start, remaining files align at lesson[0..lessons.length-1]
        // The dropped file's nearby lessons (±2 of its current proportional pos)
        const propPos = side === 'start' ? 0 : lessons.length - 1;
        const lo = Math.max(0, propPos - 2);
        const hi = Math.min(lessons.length - 1, propPos + 2);
        let anyOverlap = false;
        for (let j = lo; j <= hi; j++) {
          if (overlapScore(file.filename, lessons[j].title) > 0) {
            anyOverlap = true;
            break;
          }
        }
        if (!anyOverlap) {
          stat.droppedFiles.push(`${file.rawModuleDir}/${file.filename} (edge=${side})`);
          console.warn(
            `  ⚠ dropping extra file (no overlap near edge=${side}): ${file.rawModuleDir}/${file.filename}`,
          );
          unmatchedVideos.push(file);
          workingVideos.splice(idx, 1);
          return true;
        }
        return false;
      };

      // Greedily trim until counts equal or no progress.
      while (workingVideos.length > lessons.length) {
        let progress = false;
        if (dropFromEdge('end')) progress = true;
        else if (dropFromEdge('start')) progress = true;
        if (!progress) break;
      }

      if (workingVideos.length > lessons.length) {
        // Cannot safely trim further; log the remaining extras (last files preferred since
        // typically extras are at the end like "_intro" / bonus material). Drop from end.
        while (workingVideos.length > lessons.length) {
          const dropped = workingVideos.pop()!;
          stat.droppedFiles.push(`${dropped.rawModuleDir}/${dropped.filename} (forced)`);
          console.warn(
            `  ⚠ FORCED drop (extras): ${dropped.rawModuleDir}/${dropped.filename}`,
          );
          unmatchedVideos.push(dropped);
        }
      }
    }

    const N = Math.min(workingVideos.length, lessons.length);
    for (let i = 0; i < N; i++) {
      const v = workingVideos[i];
      const l = lessons[i];
      const overlap = overlapScore(v.filename, l.title);
      pairs.push({ video: v, lesson: l, overlap });
      stat.mapped++;
      if (overlap === 0) {
        stat.warnings++;
        lowConfidence.push({ video: v, lesson: l, overlap });
        console.warn(
          `  ⚠ LOW-CONFIDENCE (overlap=0): ${v.filename} → ${l.id} "${l.title}"`,
        );
      } else {
        console.log(
          `  [pos=${i} overlap=${overlap} ${v.bucketSize}] ${v.filename} → ${l.id} "${l.title}"`,
        );
      }
    }

    if (workingVideos.length < lessons.length) {
      for (let i = workingVideos.length; i < lessons.length; i++) {
        stat.unmatchedLessons.push(`${lessons[i].id} "${lessons[i].title}"`);
        console.warn(`  ⚠ unmatched lesson (no video): ${lessons[i].id} "${lessons[i].title}"`);
      }
    }

    stats.push(stat);
  }

  // Step 6: build selected list, filter excluded.
  const selected: SelectedLesson[] = [];
  let skipped = 0;
  for (const p of pairs) {
    if (excluded.has(p.lesson.id)) {
      skipped++;
      console.log(`  ⏭ ${p.video.module}/${p.video.filename} → ${p.lesson.id} (already-ingested)`);
      continue;
    }
    const category =
      p.video.bucketSize === 'short' ? 'theory' :
      p.video.bucketSize === 'medium' ? 'ui_demo' : 'mpstats_cabinet';
    const { rawModuleDir, ...videoCore } = p.video;
    selected.push({
      ...videoCore,
      category,
      lessonId: p.lesson.id,
      lessonTitle: p.lesson.title,
      platformUrl: `https://platform.mpstats.academy/learn/${p.lesson.id}`,
    });
  }

  if (!existsSync(INGEST_CONFIG.results_dir)) {
    mkdirSync(INGEST_CONFIG.results_dir, { recursive: true });
  }
  const outPath = join(INGEST_CONFIG.results_dir, 'selected-sprint2c-v3-lessons.json');
  writeFileSync(outPath, JSON.stringify(selected, null, 2), 'utf8');

  const totalUnmatchedLessons = stats.reduce((s, st) => s + st.unmatchedLessons.length, 0);

  console.log(`\n=== Final ===`);
  console.log(`Written: ${outPath}`);
  console.log(
    `Selected: ${selected.length} (sprint2c new), Skipped (already-ingested): ${skipped}, ` +
    `Unmatched-videos: ${unmatchedVideos.length}, Unmatched-lessons: ${totalUnmatchedLessons}, ` +
    `Low-confidence-pairs: ${lowConfidence.length}`,
  );
  console.log(`\nPer-module breakdown:`);
  for (const st of stats) {
    console.log(
      `  [${st.module}] files=${st.files}, lessons=${st.lessons}, mapped=${st.mapped}, warnings=${st.warnings}` +
      (st.droppedFiles.length > 0 ? `, dropped=${st.droppedFiles.length}` : '') +
      (st.unmatchedLessons.length > 0 ? `, unmatched-lessons=${st.unmatchedLessons.length}` : ''),
    );
  }
  if (lowConfidence.length > 0) {
    console.log(`\nLow-confidence pairs (overlap=0 — owner spot-check):`);
    for (const p of lowConfidence) {
      console.log(`  - ${p.video.module}/${p.video.filename}`);
      console.log(`    → ${p.lesson.id} "${p.lesson.title}"`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
