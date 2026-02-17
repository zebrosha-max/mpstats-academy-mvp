/**
 * Seed script: AI-classification of lesson-level SkillCategory
 *
 * Uses OpenRouter (Gemini 2.5 Flash) to classify each lesson into
 * one of 5 skill categories based on its content_chunk text.
 *
 * Lessons without content_chunks keep their course-level default.
 *
 * Usage:
 *   pnpm tsx scripts/seed/seed-skill-categories.ts --dry-run
 *   pnpm tsx scripts/seed/seed-skill-categories.ts --batch-size 15
 *   pnpm tsx scripts/seed/seed-skill-categories.ts --skip-cached
 *
 * Requires: OPENROUTER_API_KEY, DATABASE_URL in .env
 * Run with: node --env-file=.env -e "" && pnpm tsx scripts/seed/seed-skill-categories.ts
 * Or rely on Prisma loading .env from packages/db/.env
 */

import { PrismaClient, SkillCategory } from '@prisma/client';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

// ── CLI flags ──────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_CACHED = process.argv.includes('--skip-cached');

const batchSizeIdx = process.argv.indexOf('--batch-size');
const BATCH_SIZE = batchSizeIdx !== -1 ? parseInt(process.argv[batchSizeIdx + 1], 10) || 10 : 10;

// ── Load .env manually (no dotenv dependency) ─────────────────────
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Load env files (root first, then web for OPENROUTER_API_KEY, then db for DATABASE_URL)
const rootDir = path.resolve(__dirname, '../..');
loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, 'apps/web/.env'));
loadEnvFile(path.join(rootDir, 'packages/db/.env'));

// ── Clients ───────────────────────────────────────────────────────
const prisma = new PrismaClient();

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'MPSTATS Academy Seed',
  },
});

const MODEL = 'google/gemini-2.5-flash';

// ── Valid categories ──────────────────────────────────────────────
const VALID_CATEGORIES = new Set<string>(['ANALYTICS', 'MARKETING', 'CONTENT', 'OPERATIONS', 'FINANCE']);

const CACHE_PATH = path.join(__dirname, 'classification-results.json');

// ── Types ─────────────────────────────────────────────────────────
interface LessonClassification {
  lesson_id: string;
  category: SkillCategory;
  source: 'ai' | 'cached' | 'default';
}

interface LessonWithContent {
  lessonId: string;
  contentPreview: string;
}

// ── Functions ─────────────────────────────────────────────────────

/**
 * Get unique lesson IDs from content_chunk table and sample their content.
 * Returns first 3-5 chunks concatenated (up to ~1000 tokens) per lesson.
 */
async function getLessonsWithContent(): Promise<LessonWithContent[]> {
  // Get unique lesson_ids that have content chunks
  const lessons = await prisma.$queryRaw<Array<{ lesson_id: string }>>`
    SELECT DISTINCT lesson_id FROM content_chunk ORDER BY lesson_id
  `;

  const result: LessonWithContent[] = [];

  for (const { lesson_id } of lessons) {
    // Get first 4 chunks as representative content
    const chunks = await prisma.$queryRaw<Array<{ content: string }>>`
      SELECT content FROM content_chunk
      WHERE lesson_id = ${lesson_id}
      ORDER BY timecode_start ASC
      LIMIT 4
    `;

    const contentPreview = chunks.map((c) => c.content).join('\n\n').slice(0, 2000);
    result.push({ lessonId: lesson_id, contentPreview });
  }

  return result;
}

/**
 * Classify a batch of lessons using LLM.
 * Returns array of {lesson_id, category} objects.
 */
async function classifyBatch(
  lessons: LessonWithContent[]
): Promise<Array<{ lesson_id: string; category: string }>> {
  const lessonsPayload = lessons.map((l) => ({
    lesson_id: l.lessonId,
    content_preview: l.contentPreview.slice(0, 500), // Keep prompt size reasonable
  }));

  const prompt = `Classify each lesson into exactly ONE category based on its content.
Categories: ANALYTICS, MARKETING, CONTENT, OPERATIONS, FINANCE

ANALYTICS: Data analysis, metrics, KPIs, tracking, reports, ABC-analysis, unit economics analysis
MARKETING: Advertising, promotion, SEO, PPC, marketplace ads, Ozon/WB promotion, product positioning
CONTENT: Product cards, photos, descriptions, A+ content, infographics, AI tools for content
OPERATIONS: Logistics, FBO/FBS, supply chain, warehouse, delivery, returns, workshops, processes
FINANCE: Unit economics, pricing, margins, profitability, financial planning, budgeting

Return ONLY a valid JSON array: [{"lesson_id": "...", "category": "ANALYTICS"}, ...]
No markdown formatting, no code blocks, just the JSON array.

Lessons:
${JSON.stringify(lessonsPayload, null, 2)}`;

  const response = await openrouter.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const rawContent = response.choices[0]?.message?.content || '[]';

  // Try to parse JSON, stripping markdown code blocks if present
  let content = rawContent.trim();
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    return JSON.parse(content);
  } catch {
    console.warn(`  [WARN] Failed to parse LLM response, retrying once...`);
    // Retry once
    const retryResponse = await openrouter.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt + '\n\nIMPORTANT: Return ONLY raw JSON, no code blocks.' }],
      max_tokens: 4096,
      temperature: 0.0,
    });

    const retryContent = retryResponse.choices[0]?.message?.content?.trim() || '[]';
    try {
      let cleaned = retryContent;
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleaned);
    } catch {
      console.error(`  [ERROR] Failed to parse LLM response after retry. Skipping batch.`);
      return [];
    }
  }
}

/**
 * Load cached classification results if they exist.
 */
function loadCachedResults(): Map<string, SkillCategory> {
  if (!fs.existsSync(CACHE_PATH)) return new Map();

  try {
    const data: LessonClassification[] = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    const map = new Map<string, SkillCategory>();
    for (const entry of data) {
      if (VALID_CATEGORIES.has(entry.category)) {
        map.set(entry.lesson_id, entry.category);
      }
    }
    return map;
  } catch {
    console.warn('[WARN] Could not parse cached results, ignoring cache.');
    return new Map();
  }
}

/**
 * Save classification results to JSON cache file.
 */
function saveCacheResults(results: LessonClassification[]): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nCache saved: ${CACHE_PATH} (${results.length} entries)`);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('=== Lesson SkillCategory AI Classification ===\n');
  console.log(`Mode:       ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Model:      ${MODEL}`);
  console.log(`Cache:      ${SKIP_CACHED ? 'using cached results' : 'fresh classification'}\n`);

  if (!process.env.OPENROUTER_API_KEY && !SKIP_CACHED) {
    console.error('[ERROR] OPENROUTER_API_KEY not set. Set it in .env or use --skip-cached with existing cache.');
    process.exit(1);
  }

  // 1. Get lessons with content chunks
  console.log('Fetching lessons with content chunks...');
  const lessonsWithContent = await getLessonsWithContent();
  console.log(`Found ${lessonsWithContent.length} lessons with content chunks.\n`);

  if (lessonsWithContent.length === 0) {
    console.log('No lessons with content chunks found. Nothing to classify.');
    return;
  }

  // 2. Load or build classifications
  const allResults: LessonClassification[] = [];

  if (SKIP_CACHED) {
    const cached = loadCachedResults();
    if (cached.size === 0) {
      console.error('[ERROR] --skip-cached specified but no cache file found or it is empty.');
      process.exit(1);
    }
    console.log(`Using ${cached.size} cached classifications.\n`);

    for (const lesson of lessonsWithContent) {
      const cachedCategory = cached.get(lesson.lessonId);
      if (cachedCategory) {
        allResults.push({ lesson_id: lesson.lessonId, category: cachedCategory, source: 'cached' });
      } else {
        allResults.push({ lesson_id: lesson.lessonId, category: 'ANALYTICS' as SkillCategory, source: 'default' });
        console.log(`  [INFO] No cache for ${lesson.lessonId}, keeping default.`);
      }
    }
  } else {
    // Classify in batches
    const batches: LessonWithContent[][] = [];
    for (let i = 0; i < lessonsWithContent.length; i += BATCH_SIZE) {
      batches.push(lessonsWithContent.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${batches.length} batches...\n`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Batch ${i + 1}/${batches.length} (${batch.length} lessons)...`);

      const classifications = await classifyBatch(batch);

      // Map results
      const classMap = new Map<string, string>();
      for (const c of classifications) {
        classMap.set(c.lesson_id, c.category);
      }

      for (const lesson of batch) {
        const category = classMap.get(lesson.lessonId);
        if (category && VALID_CATEGORIES.has(category)) {
          allResults.push({
            lesson_id: lesson.lessonId,
            category: category as SkillCategory,
            source: 'ai',
          });
          console.log(`  ${lesson.lessonId} -> ${category}`);
        } else {
          // Invalid or missing — keep default
          allResults.push({
            lesson_id: lesson.lessonId,
            category: 'ANALYTICS' as SkillCategory,
            source: 'default',
          });
          if (category) {
            console.warn(`  [WARN] Invalid category "${category}" for ${lesson.lessonId}, keeping default.`);
          } else {
            console.warn(`  [WARN] No classification for ${lesson.lessonId}, keeping default.`);
          }
        }
      }

      // Rate limit delay between batches (skip on last batch)
      if (i < batches.length - 1) {
        console.log('  Waiting 1.5s (rate limit)...');
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  // 3. Save cache
  saveCacheResults(allResults);

  // 4. Update DB (unless dry-run)
  if (!DRY_RUN) {
    console.log('\nUpdating lesson categories in database...');
    let updated = 0;
    let errors = 0;

    for (const result of allResults) {
      try {
        await prisma.lesson.update({
          where: { id: result.lesson_id },
          data: { skillCategory: result.category },
        });
        updated++;
      } catch (err) {
        // Lesson might not exist in DB yet (not seeded via seed-from-manifest)
        errors++;
        if (errors <= 3) {
          console.warn(`  [WARN] Could not update ${result.lesson_id}: ${(err as Error).message}`);
        }
      }
    }

    if (errors > 3) {
      console.warn(`  ... and ${errors - 3} more errors (lessons may not exist in DB yet)`);
    }
    console.log(`\nUpdated ${updated} lessons, ${errors} errors.`);
  }

  // 5. Summary
  const categoryCounts: Record<string, number> = {};
  for (const r of allResults) {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  }

  const sourceCounts: Record<string, number> = {};
  for (const r of allResults) {
    sourceCounts[r.source] = (sourceCounts[r.source] || 0) + 1;
  }

  console.log('\n=== CLASSIFICATION SUMMARY ===');
  console.log(`Total lessons classified: ${allResults.length}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log('\nBy category:');
  for (const [cat, count] of Object.entries(categoryCounts).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log('\nBy source:');
  for (const [src, count] of Object.entries(sourceCounts).sort()) {
    console.log(`  ${src}: ${count}`);
  }
  console.log('\nDone.');
}

// ── Run ───────────────────────────────────────────────────────────
main()
  .catch((error) => {
    console.error('Classification failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
