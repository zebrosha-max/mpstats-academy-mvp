/**
 * One-time cleanup script: clean lesson titles, module descriptions, and course names
 *
 * Removes technical artifacts from DB records:
 * - File extensions (.mp4, .mov, etc.) from lesson titles
 * - Numeric prefixes (1., 1.2, 001_, m01_) from lesson titles
 * - Underscores replaced with spaces
 * - "Модуль: Модуль N_" prefix from lesson descriptions
 * - Course names replaced with clean Russian titles
 *
 * Usage:
 *   npx tsx scripts/cleanup/cleanup-names.ts          # Dry-run (default)
 *   npx tsx scripts/cleanup/cleanup-names.ts --apply   # Live execution
 */

import { PrismaClient } from '@prisma/client';
import { cleanLessonTitle, cleanModuleDescription, COURSE_NAMES } from '../utils/clean-titles';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'LIVE (will update DB)' : 'DRY RUN (no changes)'}\n`);

  // Step 1: Clean lesson titles and descriptions
  const lessons = await prisma.lesson.findMany({
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
  });

  console.log(`=== LESSON TITLES (${lessons.length} total) ===\n`);

  let lessonsChanged = 0;
  let titlesChanged = 0;
  let descriptionsChanged = 0;

  for (const lesson of lessons) {
    const newTitle = cleanLessonTitle(lesson.title);
    const newDesc = lesson.description ? cleanModuleDescription(lesson.description) : null;
    const titleChanged = newTitle !== lesson.title;
    const descChanged = newDesc !== lesson.description;

    if (titleChanged || descChanged) {
      lessonsChanged++;
      console.log(`[${lesson.id}]`);

      if (titleChanged) {
        titlesChanged++;
        console.log(`  title: "${lesson.title}"`);
        console.log(`      -> "${newTitle}"`);
      }

      if (descChanged) {
        descriptionsChanged++;
        console.log(`  desc:  "${lesson.description}"`);
        console.log(`      -> "${newDesc}"`);
      }

      console.log('');

      if (APPLY) {
        await prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            ...(titleChanged ? { title: newTitle } : {}),
            ...(descChanged ? { description: newDesc } : {}),
          },
        });
      }
    }
  }

  // Step 2: Clean course names
  console.log(`\n=== COURSE NAMES ===\n`);

  let coursesChanged = 0;

  for (const [courseId, names] of Object.entries(COURSE_NAMES)) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      console.log(`[${courseId}] NOT FOUND in DB, skipping`);
      continue;
    }

    const titleChanged = course.title !== names.title;
    const descChanged = course.description !== names.description;

    if (titleChanged || descChanged) {
      coursesChanged++;
      console.log(`[${courseId}]`);
      if (titleChanged) {
        console.log(`  title: "${course.title}" -> "${names.title}"`);
      }
      if (descChanged) {
        console.log(`  desc:  "${course.description}" -> "${names.description}"`);
      }
      console.log('');

      if (APPLY) {
        await prisma.course.update({
          where: { id: courseId },
          data: { title: names.title, description: names.description },
        });
      }
    } else {
      console.log(`[${courseId}] already clean`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Mode:                ${APPLY ? 'LIVE' : 'DRY RUN'}`);
  console.log(`Lessons scanned:     ${lessons.length}`);
  console.log(`Lessons changed:     ${lessonsChanged}`);
  console.log(`  - titles changed:  ${titlesChanged}`);
  console.log(`  - descriptions:    ${descriptionsChanged}`);
  console.log(`Courses changed:     ${coursesChanged}`);

  if (!APPLY && (lessonsChanged > 0 || coursesChanged > 0)) {
    console.log('\nTo apply changes, run: npx tsx scripts/cleanup/cleanup-names.ts --apply');
  }

  if (APPLY) {
    console.log('\nAll changes applied to database.');
  }
}

main()
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
