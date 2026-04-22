/**
 * Skill Mapper — AI-powered skill classification for lessons
 *
 * Three-phase pipeline:
 *   Phase 1 (discover):  Extract skills from lesson content via LLM
 *   Phase 2 (cluster):   Cluster raw skills into taxonomy of skill blocks
 *   Phase 3 (classify):  Map each lesson to 1-3 blocks from the taxonomy
 *
 * Usage:
 *   npx tsx scripts/skill-mapping/skill-mapper.ts discover [--concurrency 5] [--resume]
 *   npx tsx scripts/skill-mapping/skill-mapper.ts cluster
 *   npx tsx scripts/skill-mapping/skill-mapper.ts classify [--concurrency 5] [--resume]
 *
 * Output:
 *   scripts/skill-mapping/results/discovery.json   — Phase 1
 *   scripts/skill-mapping/results/taxonomy.json     — Phase 2 (review before Phase 3!)
 *   scripts/skill-mapping/results/classification.json — Phase 3
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RESULTS_DIR = path.resolve(__dirname, 'results');
const DISCOVERY_FILE = path.join(RESULTS_DIR, 'discovery.json');
const TAXONOMY_FILE = path.join(RESULTS_DIR, 'taxonomy.json');
const CLASSIFICATION_FILE = path.join(RESULTS_DIR, 'classification.json');

const MODEL = 'openai/gpt-4.1-nano';

// --- OpenRouter client ---

function createClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || key === 'build-placeholder') {
    throw new Error('OPENROUTER_API_KEY not found in .env');
  }
  return new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: key,
    defaultHeaders: {
      'HTTP-Referer': 'https://platform.mpstats.academy',
      'X-Title': 'MPSTATS Academy Skill Mapper',
    },
  });
}

// --- Prisma ---

function createPrisma(): PrismaClient {
  return new PrismaClient();
}

// --- Helpers ---

function log(msg: string) {
  process.stdout.write(`[${new Date().toLocaleTimeString()}] ${msg}\n`);
}

function saveJSON(filepath: string, data: unknown) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

function loadJSON<T>(filepath: string): T {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

async function callLLM(
  client: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
): Promise<string> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  return response.choices[0]?.message?.content || '{}';
}

/** Run promises with concurrency limit */
async function parallel<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
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

// ================================================================
// PHASE 1: DISCOVER
// ================================================================

interface DiscoveryEntry {
  lesson_id: string;
  title: string | null;
  skills: string[];
  chunk_count: number;
  chars_used: number;
}

interface DiscoveryResult {
  phase: 'discovery';
  model: string;
  timestamp: string;
  total_lessons: number;
  lessons: DiscoveryEntry[];
}

const DISCOVER_SYSTEM = `Ты анализируешь содержимое урока онлайн-академии для селлеров маркетплейсов (Wildberries, Ozon).

Прочитай текст урока и определи 1-5 конкретных практических навыков, которым учит этот урок.

Правила:
- Навыки должны быть конкретными и практичными (НЕ "аналитика", А "расчёт юнит-экономики товара")
- Формулируй как действие/умение: "Расчёт маржинальности", "Настройка автобиддера", "ABC/XYZ анализ ассортимента"
- Если урок вводный/обзорный — навык = то, что слушатель научится ПОНИМАТЬ ("Понимание структуры юнит-экономики")
- Если урок практикум/воркшоп — определи основные темы, которые разбираются
- Максимум 5 навыков, минимум 1
- Только на русском языке

Ответ строго в JSON: {"skills": ["навык 1", "навык 2", ...]}`;

async function phaseDiscover(concurrency: number, resume: boolean) {
  const prisma = createPrisma();
  const client = createClient();

  try {
    // Load existing progress if resuming
    let existing: Record<string, DiscoveryEntry> = {};
    if (resume && fs.existsSync(DISCOVERY_FILE)) {
      const prev = loadJSON<DiscoveryResult>(DISCOVERY_FILE);
      for (const entry of prev.lessons) {
        existing[entry.lesson_id] = entry;
      }
      log(`Resume: loaded ${Object.keys(existing).length} existing entries`);
    }

    // Get all distinct lesson_ids from content_chunk
    const lessonRows: { lesson_id: string }[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT lesson_id FROM content_chunk ORDER BY lesson_id`,
    );
    const allLessonIds = lessonRows.map((r) => r.lesson_id);
    log(`Found ${allLessonIds.length} distinct lesson_ids in content_chunk`);

    // Get titles from Lesson table
    const lessonTitles: { id: string; title: string }[] = await prisma.$queryRawUnsafe(
      `SELECT id, title FROM "Lesson"`,
    );
    const titleMap = new Map(lessonTitles.map((l) => [l.id, l.title]));

    // Filter out already processed
    const toProcess = resume
      ? allLessonIds.filter((id) => !existing[id])
      : allLessonIds;
    log(`To process: ${toProcess.length} lessons (${allLessonIds.length - toProcess.length} skipped)`);

    const results: DiscoveryEntry[] = resume
      ? [...Object.values(existing)]
      : [];

    let processed = 0;
    let errors = 0;

    await parallel(toProcess, concurrency, async (lessonId) => {
      try {
        // Fetch first 3 chunks + middle + last for content coverage
        const chunks: { content: string; rn: number }[] = await prisma.$queryRawUnsafe(`
          WITH ranked AS (
            SELECT content, ROW_NUMBER() OVER (ORDER BY timecode_start) as rn,
                   COUNT(*) OVER () as total
            FROM content_chunk
            WHERE lesson_id = $1
          )
          SELECT content, rn::int FROM ranked
          WHERE rn <= 3
             OR rn = GREATEST(4, total / 2)
             OR rn = total
          ORDER BY rn
        `, lessonId);

        const contentText = chunks.map((c) => c.content).join('\n\n---\n\n');
        const title = titleMap.get(lessonId) || null;

        const titleLine = title ? `Название урока: "${title}"\nID: ${lessonId}` : `ID урока: ${lessonId}`;
        const userPrompt = `${titleLine}\n\nСодержимое урока (фрагменты):\n\n${contentText}`;

        const response = await callLLM(client, DISCOVER_SYSTEM, userPrompt);
        const parsed = JSON.parse(response);
        const skills: string[] = Array.isArray(parsed.skills) ? parsed.skills : [];

        const entry: DiscoveryEntry = {
          lesson_id: lessonId,
          title,
          skills,
          chunk_count: chunks.length,
          chars_used: contentText.length,
        };

        results.push(entry);
        processed++;

        if (processed % 20 === 0) {
          log(`Progress: ${processed}/${toProcess.length} (${errors} errors)`);
          // Checkpoint save
          saveJSON(DISCOVERY_FILE, {
            phase: 'discovery',
            model: MODEL,
            timestamp: new Date().toISOString(),
            total_lessons: results.length,
            lessons: results.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id)),
          } satisfies DiscoveryResult);
        }
      } catch (err: any) {
        errors++;
        log(`ERROR [${lessonId}]: ${err.message}`);
        // Still add with empty skills so we know it failed
        results.push({
          lesson_id: lessonId,
          title: titleMap.get(lessonId) || null,
          skills: [],
          chunk_count: 0,
          chars_used: 0,
        });
      }
    });

    // Final save
    const output: DiscoveryResult = {
      phase: 'discovery',
      model: MODEL,
      timestamp: new Date().toISOString(),
      total_lessons: results.length,
      lessons: results.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id)),
    };
    saveJSON(DISCOVERY_FILE, output);

    // Stats
    const allSkills = results.flatMap((r) => r.skills);
    const uniqueSkills = [...new Set(allSkills)];
    const withEmptySkills = results.filter((r) => r.skills.length === 0).length;

    log(`\nDone! Results saved to ${DISCOVERY_FILE}`);
    log(`Lessons processed: ${results.length}`);
    log(`Total skill mentions: ${allSkills.length}`);
    log(`Unique skills: ${uniqueSkills.length}`);
    log(`Lessons with no skills (errors): ${withEmptySkills}`);
    log(`Avg skills per lesson: ${(allSkills.length / results.length).toFixed(1)}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ================================================================
// PHASE 2: CLUSTER
// ================================================================

interface TaxonomyBlock {
  axis: string;
  block: string;
  title: string;
  description: string;
  skills: string[];
}

interface TaxonomyResult {
  phase: 'taxonomy';
  model: string;
  timestamp: string;
  total_blocks: number;
  total_skills_mapped: number;
  blocks: TaxonomyBlock[];
}

/**
 * Phase 2 approach: two-step clustering
 * Step A: Deduplicate 2000+ raw skills into ~200 consolidated skill groups
 * Step B: Organize groups into 25-40 taxonomy blocks
 *
 * This avoids the "too many skills for one LLM call" problem.
 */

const DEDUP_DIR = path.join(RESULTS_DIR, 'dedup-batches');

const DEDUP_SYSTEM = `Ты помогаешь создать таксономию навыков для академии селлеров маркетплейсов.

Задача: объединить похожие/синонимичные навыки в группы. Каждая группа — один обобщённый навык.

Правила:
- Объедини синонимы и близкие формулировки в одну группу
- Для каждой группы дай одно каноническое название (короткое, ёмкое)
- НЕ группируй разные по смыслу навыки только потому что они из одной области
- Формулировки "Анализ конкурентов" и "Конкурентный анализ" = одна группа
- Формулировки "Анализ конкурентов" и "Анализ ЦА" = разные группы

Ответ в JSON: {"groups": [{"name": "Каноническое название", "members": ["навык1", "навык2"]}, ...]}`;

const TAXONOMY_SYSTEM = `Ты создаёшь таксономию навыков для платформы обучения селлеров маркетплейсов (Wildberries, Ozon).

Задача: сгруппировать консолидированные навыки в 25-40 skill-блоков.

Правила:
- Каждый навык из списка должен попасть в один блок
- Блоки должны быть содержательными (минимум 3 навыка)
- Название блока = конкретная тема, не абстракция

Оси (axis) — СТРОГО одна из пяти:
- ANALYTICS — аналитика, отчёты, мониторинг, конкуренты, выбор товара, ассортимент, ниши
- MARKETING — SEO, реклама, продвижение, трафик, CTR, стратегии РК, внешняя реклама
- CONTENT — контент карточки, фото, видео, инфографика, тексты, нейросети для контента
- OPERATIONS — логистика, FBO/FBS, остатки, поставки, Ozon специфика, документы
- FINANCE — юнит-экономика, маржа, бюджеты, DRR, расходы, ценообразование

Ответ в JSON:
{
  "blocks": [
    {
      "axis": "ANALYTICS",
      "block": "unit_economics",
      "title": "Юнит-экономика",
      "description": "Расчёт себестоимости, маржинальности, точки безубыточности",
      "skills": ["навык1", "навык2", ...]
    }
  ]
}`;

async function phaseCluster() {
  const client = createClient();

  if (!fs.existsSync(DISCOVERY_FILE)) {
    throw new Error(`Discovery file not found: ${DISCOVERY_FILE}\nRun "discover" phase first.`);
  }

  const discovery = loadJSON<DiscoveryResult>(DISCOVERY_FILE);
  log(`Loaded discovery: ${discovery.total_lessons} lessons`);

  // Collect all unique skills with frequencies
  const allSkills = discovery.lessons.flatMap((l) => l.skills);
  const uniqueSkills = [...new Set(allSkills)].sort();
  const freq: Record<string, number> = {};
  for (const s of allSkills) freq[s] = (freq[s] || 0) + 1;
  log(`Unique skills: ${uniqueSkills.length}`);

  // --- Step A: Deduplicate in batches ---
  if (!fs.existsSync(DEDUP_DIR)) fs.mkdirSync(DEDUP_DIR, { recursive: true });

  const BATCH_SIZE = 100;
  const batches: string[][] = [];
  for (let i = 0; i < uniqueSkills.length; i += BATCH_SIZE) {
    batches.push(uniqueSkills.slice(i, i + BATCH_SIZE));
  }
  log(`Deduplication: ${batches.length} batches of ~${BATCH_SIZE} skills`);

  const allGroups: { name: string; members: string[] }[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batchFile = path.join(DEDUP_DIR, `batch_${i}.json`);

    // Skip if already processed
    if (fs.existsSync(batchFile)) {
      const cached = loadJSON<{ groups: { name: string; members: string[] }[] }>(batchFile);
      allGroups.push(...cached.groups);
      log(`  Batch ${i + 1}/${batches.length}: loaded from cache (${cached.groups.length} groups)`);
      continue;
    }

    const skillList = batches[i].map((s) => `- ${s} (×${freq[s]})`).join('\n');
    const userPrompt = `Навыков в батче: ${batches[i].length}\n\n${skillList}`;

    const response = await callLLM(client, DEDUP_SYSTEM, userPrompt, 4096);
    const parsed = JSON.parse(response);
    const groups: { name: string; members: string[] }[] = parsed.groups || [];

    saveJSON(batchFile, { groups });
    allGroups.push(...groups);
    log(`  Batch ${i + 1}/${batches.length}: ${groups.length} groups`);
  }

  log(`Total consolidated groups: ${allGroups.length}`);

  // Merge groups with same canonical name across batches
  const merged: Map<string, Set<string>> = new Map();
  for (const g of allGroups) {
    const key = g.name.toLowerCase().trim();
    if (!merged.has(key)) merged.set(key, new Set());
    for (const m of g.members) merged.get(key)!.add(m);
  }
  const consolidatedSkills = [...merged.keys()].sort();
  // Save canonical names (use original casing from first occurrence)
  const canonicalNames: Map<string, string> = new Map();
  for (const g of allGroups) {
    const key = g.name.toLowerCase().trim();
    if (!canonicalNames.has(key)) canonicalNames.set(key, g.name);
  }
  const consolidatedList = consolidatedSkills.map((k) => canonicalNames.get(k) || k);

  log(`After cross-batch merge: ${consolidatedList.length} canonical skills`);

  // Save consolidated skills for reference
  saveJSON(path.join(RESULTS_DIR, 'consolidated-skills.json'), {
    total: consolidatedList.length,
    skills: consolidatedList.map((name) => ({
      name,
      member_count: merged.get(name.toLowerCase().trim())?.size || 0,
    })),
  });

  // --- Step B: Build taxonomy from consolidated skills ---
  log('Building taxonomy from consolidated skills...');

  const skillLines = consolidatedList
    .map((s) => `- ${s} (${merged.get(s.toLowerCase().trim())?.size || 1} вариаций)`)
    .join('\n');

  const userPrompt = `Всего консолидированных навыков: ${consolidatedList.length}
Извлечены из ${discovery.total_lessons} уроков, исходно ${uniqueSkills.length} формулировок.

Список навыков:

${skillLines}`;

  const response = await callLLM(client, TAXONOMY_SYSTEM, userPrompt, 8192);
  const parsed = JSON.parse(response);

  if (!Array.isArray(parsed.blocks)) {
    // Save raw response for debugging
    saveJSON(path.join(RESULTS_DIR, 'taxonomy-raw-response.json'), { response });
    throw new Error('LLM response missing "blocks" array. Raw response saved.');
  }

  const blocks: TaxonomyBlock[] = parsed.blocks;

  const output: TaxonomyResult = {
    phase: 'taxonomy',
    model: MODEL,
    timestamp: new Date().toISOString(),
    total_blocks: blocks.length,
    total_skills_mapped: blocks.reduce((s, b) => s + b.skills.length, 0),
    blocks: blocks.sort((a, b) => `${a.axis}/${a.block}`.localeCompare(`${b.axis}/${b.block}`)),
  };
  saveJSON(TAXONOMY_FILE, output);

  // Summary
  log(`\nTaxonomy saved to ${TAXONOMY_FILE}`);
  log(`Blocks created: ${blocks.length}`);

  const axisMap: Record<string, number> = {};
  for (const b of blocks) axisMap[b.axis] = (axisMap[b.axis] || 0) + 1;
  log('\nBlocks per axis:');
  for (const [axis, count] of Object.entries(axisMap).sort()) {
    log(`  ${axis}: ${count} blocks`);
  }

  log('\nBlocks:');
  for (const b of output.blocks) {
    log(`  ${b.axis}/${b.block}: ${b.title} (${b.skills.length} skills)`);
  }

  log('\n--- REVIEW taxonomy.json BEFORE running "classify" phase ---');
}

// ================================================================
// PHASE 3: CLASSIFY
// ================================================================

interface ClassificationEntry {
  lesson_id: string;
  title: string | null;
  skill_blocks: string[]; // "AXIS/block" format
  confidence: string; // "high" | "medium" | "low"
}

interface ClassificationResult {
  phase: 'classification';
  model: string;
  taxonomy_timestamp: string;
  timestamp: string;
  total_lessons: number;
  lessons: ClassificationEntry[];
}

async function phaseClassify(concurrency: number, resume: boolean) {
  const prisma = createPrisma();
  const client = createClient();

  try {
    if (!fs.existsSync(DISCOVERY_FILE)) {
      throw new Error(`Discovery file not found. Run "discover" first.`);
    }
    if (!fs.existsSync(TAXONOMY_FILE)) {
      throw new Error(`Taxonomy file not found. Run "cluster" first.`);
    }

    const discovery = loadJSON<DiscoveryResult>(DISCOVERY_FILE);
    const taxonomy = loadJSON<TaxonomyResult>(TAXONOMY_FILE);
    log(`Loaded: ${discovery.total_lessons} lessons, ${taxonomy.total_blocks} blocks`);

    // Build valid block IDs list for strict matching
    const validBlockIds = taxonomy.blocks.map((b) => `${b.axis}/${b.block}`);
    const validBlockSet = new Set(validBlockIds);

    // Build taxonomy reference: numbered list with ID, title, description
    const taxonomyRef = taxonomy.blocks
      .map((b, i) => `${i + 1}. ID="${b.axis}/${b.block}" — ${b.title}: ${b.description}`)
      .join('\n');

    // Plain list of valid IDs for the constraint section
    const idList = validBlockIds.join(', ');

    const systemPrompt = `Ты классифицируешь уроки онлайн-академии для селлеров маркетплейсов.

ДОПУСТИМЫЕ ИДЕНТИФИКАТОРЫ БЛОКОВ (используй ТОЛЬКО из этого списка, ДОСЛОВНО):
${idList}

Описания блоков для понимания:
${taxonomyRef}

СТРОГИЕ ПРАВИЛА:
1. Назначь уроку 1-3 блока
2. В поле "blocks" — ТОЛЬКО идентификаторы из списка выше. Копируй ДОСЛОВНО.
3. НЕ придумывай новые идентификаторы. НЕ меняй ось (axis). НЕ добавляй описание в ID.
4. Примеры правильного формата: "FINANCE/unit_economics", "MARKETING/seo_optimization", "ANALYTICS/competitor_analysis"
5. confidence: "high" = чётко ложится, "medium" = неоднозначно, "low" = плохо вписывается

Ответ СТРОГО в JSON: {"blocks": ["AXIS/block_slug", ...], "confidence": "high"}`;

    // Load existing progress
    let existing: Record<string, ClassificationEntry> = {};
    if (resume && fs.existsSync(CLASSIFICATION_FILE)) {
      const prev = loadJSON<ClassificationResult>(CLASSIFICATION_FILE);
      for (const entry of prev.lessons) {
        existing[entry.lesson_id] = entry;
      }
      log(`Resume: loaded ${Object.keys(existing).length} existing entries`);
    }

    // Build lesson→skills map from discovery
    const skillsMap = new Map(discovery.lessons.map((l) => [l.lesson_id, l.skills]));

    const toProcess = resume
      ? discovery.lessons.filter((l) => !existing[l.lesson_id])
      : discovery.lessons;
    log(`To process: ${toProcess.length} lessons`);

    const results: ClassificationEntry[] = resume
      ? [...Object.values(existing)]
      : [];

    let processed = 0;
    let errors = 0;

    await parallel(toProcess, concurrency, async (lesson) => {
      try {
        const skills = skillsMap.get(lesson.lesson_id) || [];

        // Fetch first 2 chunks for additional context
        const chunks: { content: string }[] = await prisma.$queryRawUnsafe(`
          SELECT content FROM content_chunk
          WHERE lesson_id = $1
          ORDER BY timecode_start
          LIMIT 2
        `, lesson.lesson_id);

        const contentPreview = chunks.map((c) => c.content).join('\n---\n');

        const userPrompt = `Урок: ${lesson.title || lesson.lesson_id}
ID: ${lesson.lesson_id}

Выявленные навыки: ${skills.join(', ') || '(не определены)'}

Фрагмент содержимого:
${contentPreview.substring(0, 3000)}`;

        const response = await callLLM(client, systemPrompt, userPrompt, 512);
        const parsed = JSON.parse(response);

        const rawBlocks: string[] = Array.isArray(parsed.blocks) ? parsed.blocks : [];
        // Filter to only valid block IDs from taxonomy
        const blocks = rawBlocks.filter((b) => validBlockSet.has(b));
        const confidence: string = parsed.confidence || 'medium';

        if (blocks.length < rawBlocks.length) {
          const invalid = rawBlocks.filter((b) => !validBlockSet.has(b));
          log(`  WARN [${lesson.lesson_id}]: filtered ${invalid.length} invalid block(s): ${invalid.join(', ')}`);
        }

        const entry: ClassificationEntry = {
          lesson_id: lesson.lesson_id,
          title: lesson.title,
          skill_blocks: blocks,
          confidence,
        };

        results.push(entry);
        processed++;

        if (processed % 20 === 0) {
          log(`Progress: ${processed}/${toProcess.length} (${errors} errors)`);
          saveJSON(CLASSIFICATION_FILE, {
            phase: 'classification',
            model: MODEL,
            taxonomy_timestamp: taxonomy.timestamp,
            timestamp: new Date().toISOString(),
            total_lessons: results.length,
            lessons: results.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id)),
          } satisfies ClassificationResult);
        }
      } catch (err: any) {
        errors++;
        log(`ERROR [${lesson.lesson_id}]: ${err.message}`);
        results.push({
          lesson_id: lesson.lesson_id,
          title: lesson.title,
          skill_blocks: [],
          confidence: 'low',
        });
      }
    });

    // Final save
    const output: ClassificationResult = {
      phase: 'classification',
      model: MODEL,
      taxonomy_timestamp: taxonomy.timestamp,
      timestamp: new Date().toISOString(),
      total_lessons: results.length,
      lessons: results.sort((a, b) => a.lesson_id.localeCompare(b.lesson_id)),
    };
    saveJSON(CLASSIFICATION_FILE, output);

    // Stats
    const withBlocks = results.filter((r) => r.skill_blocks.length > 0);
    const avgBlocks = withBlocks.reduce((s, r) => s + r.skill_blocks.length, 0) / withBlocks.length;
    const highConf = results.filter((r) => r.confidence === 'high').length;
    const medConf = results.filter((r) => r.confidence === 'medium').length;
    const lowConf = results.filter((r) => r.confidence === 'low').length;

    // Block distribution
    const blockCounts: Record<string, number> = {};
    for (const r of results) {
      for (const b of r.skill_blocks) {
        blockCounts[b] = (blockCounts[b] || 0) + 1;
      }
    }

    log(`\nDone! Results saved to ${CLASSIFICATION_FILE}`);
    log(`Lessons classified: ${results.length}`);
    log(`With blocks: ${withBlocks.length}, empty: ${results.length - withBlocks.length}`);
    log(`Avg blocks per lesson: ${avgBlocks.toFixed(1)}`);
    log(`Confidence: high=${highConf}, medium=${medConf}, low=${lowConf}`);
    log(`\nBlock distribution (top 15):`);
    const sorted = Object.entries(blockCounts).sort((a, b) => b[1] - a[1]);
    for (const [block, count] of sorted.slice(0, 15)) {
      log(`  ${block}: ${count} lessons`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// ================================================================
// CLI
// ================================================================

async function main() {
  const args = process.argv.slice(2);
  const phase = args[0];
  const concurrency = parseInt(args.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || '5');
  const resume = args.includes('--resume');

  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }

  switch (phase) {
    case 'discover':
      log(`=== PHASE 1: DISCOVER SKILLS (concurrency=${concurrency}, resume=${resume}) ===`);
      await phaseDiscover(concurrency, resume);
      break;

    case 'cluster':
      log('=== PHASE 2: CLUSTER INTO TAXONOMY ===');
      await phaseCluster();
      break;

    case 'classify':
      log(`=== PHASE 3: CLASSIFY LESSONS (concurrency=${concurrency}, resume=${resume}) ===`);
      await phaseClassify(concurrency, resume);
      break;

    default:
      process.stdout.write(`
Skill Mapper — AI-powered skill classification

Usage:
  npx tsx scripts/skill-mapping/skill-mapper.ts <phase> [options]

Phases:
  discover    Extract skills from lesson content (→ results/discovery.json)
  cluster     Cluster skills into taxonomy      (→ results/taxonomy.json)
  classify    Map lessons to taxonomy blocks     (→ results/classification.json)

Options:
  --concurrency=N   Parallel LLM calls (default: 5)
  --resume          Skip already-processed lessons

Workflow:
  1. Run "discover" → review discovery.json
  2. Run "cluster"  → REVIEW taxonomy.json, edit if needed
  3. Run "classify" → final mapping in classification.json
`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
