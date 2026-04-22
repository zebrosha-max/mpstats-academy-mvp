/**
 * Seed script: create skill-based courses, lessons, and apply skillBlocks mapping.
 *
 * 1. Creates 2 container courses: skill_analytics, skill_marketing
 * 2. Creates 17 new Lesson records from _rename_map.json + transcript durations
 * 3. Applies skillBlocks from classification.json to ALL 418 lessons
 *
 * Usage:
 *   npx tsx scripts/seed/seed-skill-lessons.ts --dry-run
 *   npx tsx scripts/seed/seed-skill-lessons.ts
 */

import { PrismaClient, SkillCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// --- Paths ---
const RENAME_MAP = 'E:/Academy Courses/skills/_rename_map.json';
const TRANSCRIPTS_BASE = 'E:/Academy Courses/transcripts/skills';
const CLASSIFICATION_FILE = path.resolve(__dirname, '../skill-mapping/results/classification.json');

// --- Types ---
interface RenameEntry {
  lesson_id: string;
  title_original: string;
  skill_axis: string;
  skill_block: string;
  block_title: string;
  order: number;
  renamed: string; // relative path: "analytics/assortment/001_assortment_as_system.mp4"
}

interface RenameMap {
  mappings: RenameEntry[];
}

interface ClassificationEntry {
  lesson_id: string;
  skill_blocks: string[];
}

interface ClassificationResult {
  lessons: ClassificationEntry[];
}

// --- Helpers ---
function log(msg: string) {
  process.stdout.write(`${msg}\n`);
}

/** Get duration in minutes from transcript (last segment end) */
function getDurationFromTranscript(lessonId: string, entry: RenameEntry): number | null {
  // Build transcript path from renamed field: "analytics/assortment/001_foo.mp4" -> "analytics/assortment/lesson_id.json"
  const dir = path.dirname(entry.renamed); // "analytics/assortment"
  const transcriptPath = path.join(TRANSCRIPTS_BASE, dir, `${lessonId}.json`);

  if (!fs.existsSync(transcriptPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'));
    const segments = data.segments || [];
    if (segments.length === 0) return null;
    const lastEnd = segments[segments.length - 1].end || 0;
    return Math.ceil(lastEnd / 60);
  } catch {
    return null;
  }
}

// --- Skill axis to SkillCategory mapping ---
const AXIS_TO_CATEGORY: Record<string, SkillCategory> = {
  ANALYTICS: 'ANALYTICS',
  MARKETING: 'MARKETING',
};

// --- Container courses for skill-based lessons ---
const SKILL_COURSES = [
  {
    id: 'skill_analytics',
    title: 'Навыковые уроки: Аналитика',
    description: 'Уроки по аналитическим навыкам (ассортимент, фокусные товары, ЦА)',
    slug: 'skill-analytics',
    order: 10,
  },
  {
    id: 'skill_marketing',
    title: 'Навыковые уроки: Маркетинг',
    description: 'Уроки по маркетингу (SEO-оптимизация, метрики РК)',
    slug: 'skill-marketing',
    order: 11,
  },
];

async function main() {
  if (DRY_RUN) log('[DRY RUN] No database changes will be made.\n');

  // --- Load data ---
  const renameMap: RenameMap = JSON.parse(fs.readFileSync(RENAME_MAP, 'utf-8'));
  log(`Loaded rename map: ${renameMap.mappings.length} entries`);

  const classification: ClassificationResult = JSON.parse(fs.readFileSync(CLASSIFICATION_FILE, 'utf-8'));
  const classMap = new Map(classification.lessons.map((l) => [l.lesson_id, l.skill_blocks]));
  log(`Loaded classification: ${classification.lessons.length} lessons`);

  // --- Step 1: Create container courses ---
  log('\n--- Step 1: Container courses ---');
  for (const course of SKILL_COURSES) {
    log(`  ${course.id}: ${course.title}`);
    if (!DRY_RUN) {
      await prisma.course.upsert({
        where: { id: course.id },
        update: { title: course.title, description: course.description, order: course.order },
        create: {
          id: course.id,
          title: course.title,
          description: course.description,
          slug: course.slug,
          order: course.order,
          duration: 0,
          isHidden: true, // hidden from course list, visible through playbooks later
        },
      });
    }
  }

  // --- Step 2: Create 17 skill lessons ---
  log('\n--- Step 2: New skill lessons ---');
  let totalDuration = 0;

  for (const entry of renameMap.mappings) {
    const courseId = entry.skill_axis === 'ANALYTICS' ? 'skill_analytics' : 'skill_marketing';
    const skillCategory = AXIS_TO_CATEGORY[entry.skill_axis] || 'ANALYTICS';
    const duration = getDurationFromTranscript(entry.lesson_id, entry);
    const skillBlocks = classMap.get(entry.lesson_id) || [];

    log(`  ${entry.lesson_id}: "${entry.title_original}" (${duration || '?'} min) → ${courseId} [${skillBlocks.join(', ')}]`);

    if (duration) totalDuration += duration;

    if (!DRY_RUN) {
      await prisma.lesson.upsert({
        where: { id: entry.lesson_id },
        update: {
          title: entry.title_original,
          description: `${entry.block_title} — ${entry.skill_axis.toLowerCase()}`,
          order: entry.order,
          duration,
          skillCategory,
          skillBlocks: skillBlocks.length > 0 ? skillBlocks : undefined,
        },
        create: {
          id: entry.lesson_id,
          courseId,
          title: entry.title_original,
          description: `${entry.block_title} — ${entry.skill_axis.toLowerCase()}`,
          order: entry.order,
          duration,
          skillCategory,
          skillLevel: 'MEDIUM',
          skillBlocks: skillBlocks.length > 0 ? skillBlocks : undefined,
        },
      });
    }
  }

  log(`  Total: ${renameMap.mappings.length} lessons, ${totalDuration} min`);

  // Update course durations
  if (!DRY_RUN) {
    for (const course of SKILL_COURSES) {
      const lessons = await prisma.lesson.findMany({
        where: { courseId: course.id },
        select: { duration: true },
      });
      const courseDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);
      await prisma.course.update({
        where: { id: course.id },
        data: { duration: courseDuration },
      });
    }
  }

  // --- Step 3: Apply skillBlocks to ALL existing lessons ---
  log('\n--- Step 3: Apply skillBlocks to existing lessons ---');
  let updated = 0;
  let skipped = 0;

  for (const entry of classification.lessons) {
    // Skip skill_ lessons — already handled in Step 2
    if (entry.lesson_id.startsWith('skill_')) continue;

    const blocks = entry.skill_blocks;
    if (blocks.length === 0) {
      skipped++;
      continue;
    }

    if (!DRY_RUN) {
      try {
        await prisma.lesson.update({
          where: { id: entry.lesson_id },
          data: { skillBlocks: blocks },
        });
        updated++;
      } catch {
        // Lesson might not exist in Prisma (13 orphan lesson_ids in content_chunk)
        skipped++;
      }
    } else {
      updated++;
    }
  }

  log(`  Updated: ${updated}, Skipped: ${skipped}`);

  // --- Summary ---
  log('\n=== SUMMARY ===');
  log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log(`Container courses: ${SKILL_COURSES.length}`);
  log(`New skill lessons: ${renameMap.mappings.length}`);
  log(`Existing lessons with skillBlocks: ${updated}`);
  log(`Skipped (no Lesson record): ${skipped}`);

  if (!DRY_RUN) {
    const totalLessons = await prisma.lesson.count();
    const withBlocks = await prisma.lesson.count({ where: { NOT: { skillBlocks: null } } });
    log(`\nTotal lessons in DB: ${totalLessons}`);
    log(`With skillBlocks: ${withBlocks}`);
  }
}

main()
  .catch((err) => { console.error('Failed:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
