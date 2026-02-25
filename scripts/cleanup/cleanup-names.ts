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

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ============== CLEANUP FUNCTIONS ==============

/**
 * Clean lesson title: remove file extensions, numeric prefixes, underscores
 * Example: "1 SEO-оптимизация.mp4" -> "SEO-оптимизация"
 * Example: "1.2 Типы конкуренции как понять, кто мой конкурент.mp4" -> "Типы конкуренции как понять, кто мой конкурент"
 */
export function cleanLessonTitle(raw: string): string {
  let title = raw;

  // 1. Remove file extensions (anchored to end of string)
  title = title.replace(/\.(mp4|mov|avi|mkv|webm|flv)$/i, '');

  // 2. Remove leading numeric prefixes:
  //    - "1. Title" or "1.2 Title" (number + dot + optional sub-number + space)
  //    - "001_Title" or "m01_Title" (number + underscore)
  //    - "1 Title" ONLY when followed by a file extension (already removed in step 1)
  //      i.e., bare "N word" like "3 способа" is preserved as meaningful content
  //    Also handle emoji digit variants (e.g. "5\uFE0F")
  title = title.replace(/^m?\d+[\uFE0F\u20E3]*[._]\s*\d*\.?\s*/, '');
  // Handle bare "N " ONLY when title originally had extension (heuristic: original has extension)
  if (raw.match(/\.(mp4|mov|avi|mkv|webm|flv)$/i)) {
    title = title.replace(/^\d+[\uFE0F\u20E3]*\s+/, '');
  }

  // 3. Replace underscores with spaces
  title = title.replace(/_/g, ' ');

  // 4. Collapse multiple spaces, trim
  title = title.replace(/\s{2,}/g, ' ').trim();

  // 5. Capitalize first letter, preserve rest (natural Russian style)
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // Safety: if result is empty or too short, keep original
  if (title.length < 2) {
    console.warn(`  WARNING: cleaned title too short for "${raw}" -> "${title}", keeping original`);
    return raw;
  }

  return title;
}

/**
 * Clean module description: remove "Модуль: Модуль N_" prefix, clean underscores
 * Example: "Модуль: Модуль 6_ Трафик_ привлекаем клиентов SEO и рекламой"
 *       -> "Трафик: привлекаем клиентов SEO и рекламой"
 */
export function cleanModuleDescription(raw: string): string {
  let desc = raw;

  // 1. Remove "Модуль: " prefix
  desc = desc.replace(/^Модуль:\s*/, '');

  // 2. Remove "Модуль N_ " or "Модуль N " prefix (the duplicate)
  desc = desc.replace(/^Модуль\s+\d+_?\s*/, '');

  // 3. Replace first "_ " (underscore + space) with ": " (section separator)
  //    e.g. "Трафик_ привлекаем" -> "Трафик: привлекаем"
  //    e.g. "Экономика продаж_ считаем" -> "Экономика продаж: считаем"
  desc = desc.replace(/_\s+/, ': ');

  // 4. Replace remaining underscores with spaces
  desc = desc.replace(/_/g, ' ');

  // 5. Collapse multiple spaces, trim
  desc = desc.replace(/\s{2,}/g, ' ').trim();

  // 6. Capitalize first letter
  if (desc.length > 0) {
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
  }

  return desc;
}

// ============== COURSE NAMES MAP ==============

export const COURSE_NAMES: Record<string, { title: string; description: string }> = {
  '01_analytics': {
    title: 'Аналитика для маркетплейсов',
    description: 'Внутренняя и внешняя аналитика, юнит-экономика, конкурентный анализ',
  },
  '02_ads': {
    title: 'Реклама и продвижение',
    description: 'SEO-оптимизация, рекламные кампании, трафик и конверсии',
  },
  '03_ai': {
    title: 'AI-инструменты для селлеров',
    description: 'Использование искусственного интеллекта в работе на маркетплейсах',
  },
  '04_workshops': {
    title: 'Практические воркшопы',
    description: 'Пошаговые разборы и мастер-классы',
  },
  '05_ozon': {
    title: 'Работа с Ozon',
    description: 'Особенности продаж и продвижения на площадке Ozon',
  },
  '06_express': {
    title: 'Экспресс-курсы',
    description: 'Быстрые курсы по ключевым темам маркетплейсов',
  },
};

// ============== MAIN ==============

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
