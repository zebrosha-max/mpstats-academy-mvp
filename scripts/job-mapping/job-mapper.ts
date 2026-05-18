/**
 * Job Mapper — full pipeline for jobs-to-be-done mapping
 *
 * Three-phase pipeline:
 *   Phase 1 (discover):  Per-lesson LLM reads transcript → 1-3 seller jobs + axes + skill_blocks
 *   Phase 2 (cluster):   Cluster raw jobs into consolidated job cards (Task 5)
 *   Phase 3 (proposal):  Generate final library proposal (Task 6)
 *
 * Infrastructure copied verbatim from trial-run.ts (spike).
 * resume/checkpoint pattern from skill-mapper.ts.
 *
 * Usage:
 *   npx tsx scripts/job-mapping/job-mapper.ts discover [--concurrency=N] [--resume]
 *   npx tsx scripts/job-mapping/job-mapper.ts cluster
 *   npx tsx scripts/job-mapping/job-mapper.ts proposal
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RESULTS_DIR = path.resolve(__dirname, 'results');
const MODEL = 'openai/gpt-4.1-mini'; // project's quality choice (nano too weak — see Key Decisions)

function createClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'build-placeholder') throw new Error('OPENROUTER_API_KEY not in .env');
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: key,
    defaultHeaders: {
      'HTTP-Referer': 'https://platform.mpstats.academy',
      'X-Title': 'MPSTATS Academy Job Mapper (trial)',
    },
  });
}

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`);
}

async function callLLM(client: OpenAI, system: string, user: string, maxTokens = 1024): Promise<string> {
  const r = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  return r.choices[0]?.message?.content || '{}';
}

async function parallel<T, R>(items: T[], concurrency: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

/** course id = leading "NN_name" segment of a lesson id */
function courseOf(lessonId: string): string {
  const m = lessonId.match(/^\d+_[a-z]+/);
  return m ? m[0] : 'other';
}

// --- Helpers (from skill-mapper.ts lines 65-71) ---

function saveJSON(filepath: string, data: unknown) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadJSON<T>(filepath: string): T {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

// --- Prompts ---

const DISCOVER_SYSTEM = `Ты анализируешь урок онлайн-академии для селлеров маркетплейсов (Wildberries, Ozon).

Прочитай содержимое урока и определи 1-3 конкретные ЗАДАЧИ селлера (jobs-to-be-done), которые этот урок помогает выполнить.

Что такое задача (job):
- Это то, что селлер хочет СДЕЛАТЬ и какой РЕЗУЛЬТАТ получить
- Формулируй от лица селлера, через глагол: "Вывести новый товар в топ", "Посчитать юнит-экономику товара", "Снизить ДРР рекламной кампании"
- Это НЕ навык и НЕ тема. "Аналитика" — тема. "Выбрать прибыльную нишу для запуска" — задача.
- Если урок вводный/теоретический — сформулируй задачу, к подготовке которой он относится

Также укажи, какие из 5 направлений урок реально затрагивает:
ANALYTICS (аналитика, конкуренты, ниши, спрос), MARKETING (SEO, реклама, продвижение),
CONTENT (фото, видео, тексты, карточка), OPERATIONS (логистика, остатки, кабинет, Ozon),
FINANCE (юнит-экономика, маржа, бюджеты, цены).

Дополнительно укажи skill_blocks — теги из 32-блочной таксономии в формате "AXIS/block_slug"
(см. scripts/skill-mapping/results/taxonomy.json). 1-3 блока. Ответ в JSON:
{"jobs":[...],"axes":["ANALYTICS"],"skill_blocks":["ANALYTICS/competitor_analysis"]}`;

// --- Interfaces ---

const DISCOVERY_FILE = path.join(RESULTS_DIR, 'jobs-discovery.json');

interface DiscoverEntry {
  lesson_id: string;
  course: string;
  title: string | null;
  jobs: string[];
  axes: string[];      // строго из 5: ANALYTICS|MARKETING|CONTENT|OPERATIONS|FINANCE
  skill_blocks: string[];
}
interface DiscoveryResult {
  phase: 'discovery'; model: string; timestamp: string;
  total_lessons: number; lessons: DiscoverEntry[];
}

// --- Phase: discover ---

async function phaseDiscover(concurrency: number, resume: boolean) {
  const prisma = new PrismaClient();
  const client = createClient();
  try {
    // Только видимые уроки в видимых курсах, без 06_express (спек §9)
    const visible: { id: string; title: string; courseId: string }[] = await prisma.$queryRawUnsafe(`
      SELECT l.id, l.title, l."courseId"
      FROM "Lesson" l JOIN "Course" c ON c.id = l."courseId"
      WHERE l."isHidden" = false AND c."isHidden" = false AND l."courseId" <> '06_express'
        AND l."videoId" IS NOT NULL
      ORDER BY l.id
    `);
    log(`Видимых уроков для разметки: ${visible.length}`);

    let existing: Record<string, DiscoverEntry> = {};
    if (resume && fs.existsSync(DISCOVERY_FILE)) {
      for (const e of loadJSON<DiscoveryResult>(DISCOVERY_FILE).lessons) existing[e.lesson_id] = e;
      log(`Resume: ${Object.keys(existing).length} уже размечено`);
    }
    const toProcess = visible.filter((l) => !existing[l.id]);
    const results: DiscoverEntry[] = [...Object.values(existing)];
    let done = 0;

    await parallel(toProcess, concurrency, async (lesson) => {
      try {
        const chunks: { content: string }[] = await prisma.$queryRawUnsafe(`
          WITH ranked AS (
            SELECT content, ROW_NUMBER() OVER (ORDER BY timecode_start) rn, COUNT(*) OVER () total
            FROM content_chunk WHERE lesson_id = $1)
          SELECT content FROM ranked
          WHERE rn <= 3 OR rn = GREATEST(4, total/2) OR rn = total ORDER BY rn`, lesson.id);
        const text = chunks.map((c) => c.content).join('\n\n---\n\n').substring(0, 8000);
        const userPrompt = `Название урока: "${lesson.title}"\nID: ${lesson.id}\n\nСодержимое (фрагменты):\n\n${text}`;
        const parsed = JSON.parse(await callLLM(client, DISCOVER_SYSTEM, userPrompt));
        results.push({
          lesson_id: lesson.id, course: lesson.courseId, title: lesson.title,
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
          axes: Array.isArray(parsed.axes) ? parsed.axes : [],
          skill_blocks: Array.isArray(parsed.skill_blocks) ? parsed.skill_blocks : [],
        });
      } catch (err: any) {
        log(`ERROR [${lesson.id}]: ${err.message}`);
        results.push({ lesson_id: lesson.id, course: lesson.courseId, title: lesson.title,
          jobs: [], axes: [], skill_blocks: [] });
      }
      if (++done % 20 === 0) {
        log(`discover ${done}/${toProcess.length}`);
        saveJSON(DISCOVERY_FILE, { phase: 'discovery', model: MODEL,
          timestamp: new Date().toISOString(), total_lessons: results.length,
          lessons: results.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id)) });
      }
    });
    saveJSON(DISCOVERY_FILE, { phase: 'discovery', model: MODEL,
      timestamp: new Date().toISOString(), total_lessons: results.length,
      lessons: results.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id)) });
    log(`Готово: ${results.length} уроков → ${DISCOVERY_FILE}`);
  } finally { await prisma.$disconnect(); }
}

// --- Stubs (Tasks 5 and 6 will implement) ---

async function phaseCluster() { throw new Error('Task 5'); }
async function phaseProposal() { throw new Error('Task 6'); }

// --- CLI router ---

async function main() {
  const phase = process.argv[2];
  const concurrency = parseInt(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '5');
  const resume = process.argv.includes('--resume');
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });
  switch (phase) {
    case 'discover': await phaseDiscover(concurrency, resume); break;
    case 'cluster': await phaseCluster(); break;       // Task 5
    case 'proposal': await phaseProposal(); break;     // Task 6
    default:
      process.stdout.write('Usage: npx tsx scripts/job-mapping/job-mapper.ts <discover|cluster|proposal> [--concurrency=N] [--resume]\n');
      process.exit(1);
  }
}
main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
