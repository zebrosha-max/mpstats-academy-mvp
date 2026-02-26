/**
 * Fix lesson ordering: convert per-module order to global sequential order within each course.
 *
 * Problem: lesson.order stores order within a module (1, 2, 3...),
 * so lessons with order=1 from different modules get mixed together.
 * Also 16 lessons have order=999 (default from manifest).
 *
 * Solution: read manifest.json, iterate modules in module.order,
 * iterate lessons within each module in lesson.order,
 * assign globalOrder (1, 2, 3...) per course.
 *
 * Lessons with order=999 are placed at the end of their module,
 * sorted by title for determinism.
 *
 * Usage:
 *   npx tsx scripts/cleanup/fix-lesson-order.ts          # Dry-run (default)
 *   npx tsx scripts/cleanup/fix-lesson-order.ts --apply   # Live execution
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const MANIFEST_PATH = 'E:/Academy Courses/manifest.json';

// --- Manifest types (same as seed-from-manifest.ts) ---

interface ManifestLesson {
  id: string;
  filename: string;
  filepath: string;
  title_original: string;
  order: number;
  duration_seconds: number | null;
  transcription_status: string;
}

interface ManifestSubmoduleEntry {
  submodule: {
    id: string;
    folder: string;
    title_original: string;
    order: number;
    lessons: ManifestLesson[];
  };
}

type ManifestModuleEntry = ManifestLesson | ManifestSubmoduleEntry;

interface ManifestModule {
  id: string;
  folder: string;
  title_original: string;
  order: number;
  lessons: ManifestModuleEntry[];
}

interface ManifestCourse {
  id: string;
  title_original: string;
  title_en: string;
  order: number;
  skill_category: string;
  modules: ManifestModule[];
}

interface Manifest {
  version: string;
  generated: string;
  base_path: string;
  stats: { courses: number; modules: number; lessons: number };
  courses: ManifestCourse[];
}

function isSubmoduleEntry(entry: ManifestModuleEntry): entry is ManifestSubmoduleEntry {
  return 'submodule' in entry;
}

/** Flatten module entries — extract lessons from submodule wrappers */
function flattenLessons(entries: ManifestModuleEntry[]): ManifestLesson[] {
  const result: ManifestLesson[] = [];
  for (const entry of entries) {
    if (isSubmoduleEntry(entry)) {
      // Submodule lessons are already ordered within the submodule
      result.push(...entry.submodule.lessons);
    } else {
      result.push(entry);
    }
  }
  return result;
}

/** Sort lessons: normal orders first (ascending), then order=999 sorted by title */
function sortLessons(lessons: ManifestLesson[]): ManifestLesson[] {
  return [...lessons].sort((a, b) => {
    const aDefault = a.order >= 999;
    const bDefault = b.order >= 999;

    // Normal orders before defaults
    if (aDefault !== bDefault) return aDefault ? 1 : -1;

    // Both normal: sort by order
    if (!aDefault) return a.order - b.order;

    // Both default (999): sort by title for determinism
    return a.title_original.localeCompare(b.title_original, 'ru');
  });
}

interface OrderChange {
  lessonId: string;
  title: string;
  courseId: string;
  moduleName: string;
  moduleOrder: number;
  oldOrder: number;
  newOrder: number;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'LIVE (will update DB)' : 'DRY RUN (no changes)'}\n`);

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Manifest file not found:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`Manifest: ${manifest.stats.courses} courses, ${manifest.stats.lessons} lessons\n`);

  const allChanges: OrderChange[] = [];
  let totalLessons = 0;
  let changedCount = 0;

  for (const course of manifest.courses) {
    console.log(`\n=== ${course.title_original} [${course.id}] ===`);

    const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
    let globalOrder = 0;

    for (const module of sortedModules) {
      const lessons = sortLessons(flattenLessons(module.lessons));

      console.log(`  Module ${module.order}: ${module.title_original} (${lessons.length} lessons)`);

      for (const lesson of lessons) {
        globalOrder++;
        totalLessons++;

        const change: OrderChange = {
          lessonId: lesson.id,
          title: lesson.title_original,
          courseId: course.id,
          moduleName: module.title_original,
          moduleOrder: module.order,
          oldOrder: lesson.order,
          newOrder: globalOrder,
        };

        if (lesson.order !== globalOrder) {
          changedCount++;
          const marker = lesson.order >= 999 ? ' [was 999!]' : '';
          console.log(`    ${globalOrder}. ${lesson.title_original}  (was: ${lesson.order}${marker})`);
        }

        allChanges.push(change);
      }
    }

    console.log(`  Total: ${globalOrder} lessons`);
  }

  // Apply changes
  if (APPLY && changedCount > 0) {
    console.log(`\nApplying ${changedCount} order updates...`);

    for (const change of allChanges) {
      if (change.oldOrder !== change.newOrder) {
        await prisma.lesson.update({
          where: { id: change.lessonId },
          data: { order: change.newOrder },
        });
      }
    }

    console.log('Done.');
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Mode:            ${APPLY ? 'LIVE' : 'DRY RUN'}`);
  console.log(`Total lessons:   ${totalLessons}`);
  console.log(`Order changed:   ${changedCount}`);
  console.log(`Already correct: ${totalLessons - changedCount}`);

  if (!APPLY && changedCount > 0) {
    console.log('\nTo apply changes, run: npx tsx scripts/cleanup/fix-lesson-order.ts --apply');
  }

  if (APPLY && changedCount > 0) {
    console.log('\nAll order changes applied to database.');
  }
}

main()
  .catch((error) => {
    console.error('Fix-lesson-order failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
