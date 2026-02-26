/**
 * Seed script: загрузка Course/Lesson из manifest.json
 *
 * Источник: E:\Academy Courses\manifest.json
 * Результат: 6 курсов, 405 уроков в Supabase
 *
 * Запуск:
 *   npx tsx scripts/seed/seed-from-manifest.ts
 *   npx tsx scripts/seed/seed-from-manifest.ts --dry-run
 */

import { PrismaClient, SkillCategory } from '@prisma/client';
import * as fs from 'fs';
import { cleanLessonTitle, cleanModuleDescription, COURSE_NAMES } from '../utils/clean-titles';

const prisma = new PrismaClient();

// CLI flags
const DRY_RUN = process.argv.includes('--dry-run');

// Путь к manifest.json
const MANIFEST_PATH = 'E:/Academy Courses/manifest.json';

// Маппинг course id -> SkillCategory (covers all 6 courses)
const COURSE_SKILL_MAP: Record<string, SkillCategory> = {
  '01_analytics': 'ANALYTICS',
  '02_ads': 'MARKETING',
  '03_ai': 'CONTENT',
  '04_workshops': 'OPERATIONS',
  '05_ozon': 'MARKETING',
  '06_express': 'OPERATIONS',
};

// Fallback: маппинг по значению skill_category из manifest
const SKILL_CATEGORY_MAP: Record<string, SkillCategory> = {
  ANALYTICS: 'ANALYTICS',
  MARKETING: 'MARKETING',
  CONTENT: 'CONTENT',
  OPERATIONS: 'OPERATIONS',
  FINANCE: 'FINANCE',
};

// Типы для manifest.json
interface ManifestLesson {
  id: string;
  filename: string;
  filepath: string;
  title_original: string;
  order: number;
  duration_seconds: number | null;
  transcription_status: string;
}

// Some manifest entries are submodule wrappers instead of direct lessons
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

function isSubmoduleEntry(entry: ManifestModuleEntry): entry is ManifestSubmoduleEntry {
  return 'submodule' in entry;
}

/** Flatten module entries — extract lessons from submodule wrappers */
function flattenLessons(entries: ManifestModuleEntry[]): ManifestLesson[] {
  const result: ManifestLesson[] = [];
  for (const entry of entries) {
    if (isSubmoduleEntry(entry)) {
      result.push(...entry.submodule.lessons);
    } else {
      result.push(entry);
    }
  }
  return result;
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
  stats: {
    courses: number;
    modules: number;
    lessons: number;
  };
  courses: ManifestCourse[];
}

function resolveSkillCategory(course: ManifestCourse): SkillCategory {
  // Primary: map by course id
  if (COURSE_SKILL_MAP[course.id]) {
    return COURSE_SKILL_MAP[course.id];
  }
  // Fallback: map by manifest skill_category field
  if (SKILL_CATEGORY_MAP[course.skill_category]) {
    return SKILL_CATEGORY_MAP[course.skill_category];
  }
  // Default
  console.warn(`  [WARN] Unknown skill_category for course "${course.id}" (${course.skill_category}), defaulting to ANALYTICS`);
  return 'ANALYTICS';
}

async function seedFromManifest() {
  if (DRY_RUN) {
    console.log('[DRY RUN] No database changes will be made.\n');
  }

  console.log('Loading manifest from:', MANIFEST_PATH);

  // Проверяем существование файла
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Manifest file not found:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestContent);

  console.log(`Manifest stats: ${manifest.stats.courses} courses, ${manifest.stats.modules} modules, ${manifest.stats.lessons} lessons\n`);

  let coursesProcessed = 0;
  let lessonsProcessed = 0;
  let totalDurationMinutes = 0;
  const lessonsPerCourse: Record<string, number> = {};

  for (const course of manifest.courses) {
    const skillCategory = resolveSkillCategory(course);
    let courseLessonCount = 0;

    console.log(`Course: ${course.title_original} [${course.id}] -> ${skillCategory}`);

    if (!DRY_RUN) {
      const courseTitle = COURSE_NAMES[course.id]?.title ?? course.title_original;
      const courseDesc = COURSE_NAMES[course.id]?.description ?? course.title_en;

      await prisma.course.upsert({
        where: { id: course.id },
        update: {
          title: courseTitle,
          description: courseDesc,
          order: course.order,
        },
        create: {
          id: course.id,
          title: courseTitle,
          description: courseDesc,
          slug: course.id,
          duration: 0,
          order: course.order,
        },
      });
    }
    coursesProcessed++;

    // Обрабатываем модули и уроки (flatten submodules)
    // Global order: sequential numbering across all modules in the course
    const sortedModules = [...course.modules].sort((a, b) => a.order - b.order);
    let globalOrder = 0;

    for (const module of sortedModules) {
      const lessons = flattenLessons(module.lessons).sort((a, b) => {
        // Normal orders first, order=999 at end (sorted by title for determinism)
        const aDefault = a.order >= 999;
        const bDefault = b.order >= 999;
        if (aDefault !== bDefault) return aDefault ? 1 : -1;
        if (!aDefault) return a.order - b.order;
        return a.title_original.localeCompare(b.title_original, 'ru');
      });

      for (const lesson of lessons) {
        globalOrder++;

        const durationMinutes = lesson.duration_seconds
          ? Math.ceil(lesson.duration_seconds / 60)
          : null;

        if (durationMinutes) {
          totalDurationMinutes += durationMinutes;
        }

        if (!DRY_RUN) {
          const lessonTitle = cleanLessonTitle(lesson.title_original);
          const lessonDesc = cleanModuleDescription(`Модуль: ${module.title_original}`);

          await prisma.lesson.upsert({
            where: { id: lesson.id },
            update: {
              title: lessonTitle,
              description: lessonDesc,
              order: globalOrder,
              duration: durationMinutes,
              skillCategory: skillCategory,
            },
            create: {
              id: lesson.id,
              courseId: course.id,
              title: lessonTitle,
              description: lessonDesc,
              order: globalOrder,
              duration: durationMinutes,
              skillCategory: skillCategory,
              skillLevel: 'MEDIUM',
            },
          });
        }

        lessonsProcessed++;
        courseLessonCount++;
      }
    }

    lessonsPerCourse[course.id] = courseLessonCount;
  }

  // Обновляем общую длительность курсов
  if (!DRY_RUN) {
    console.log('\nUpdating course durations...');
    for (const course of manifest.courses) {
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

  // Summary
  console.log('\n=== SEED SUMMARY ===');
  console.log(`Mode:           ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log(`Total courses:  ${coursesProcessed}`);
  console.log(`Total lessons:  ${lessonsProcessed}`);
  console.log(`Total duration: ${totalDurationMinutes} min (~${Math.round(totalDurationMinutes / 60)} hours)`);
  console.log('\nLessons per course:');
  for (const [courseId, count] of Object.entries(lessonsPerCourse)) {
    const category = COURSE_SKILL_MAP[courseId] || 'UNKNOWN';
    console.log(`  ${courseId}: ${count} lessons (${category})`);
  }
  console.log(`\nSeed ${DRY_RUN ? 'dry run' : ''} completed.`);
}

// Запуск
seedFromManifest()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
