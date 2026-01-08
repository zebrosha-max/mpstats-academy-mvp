/**
 * Seed script: загрузка Course/Lesson из manifest.json
 *
 * Источник: E:\Academy Courses\manifest.json
 * Результат: 6 курсов, 405 уроков в Supabase
 *
 * Запуск: npx tsx scripts/seed/seed-from-manifest.ts
 */

import { PrismaClient, SkillCategory, Difficulty } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Путь к manifest.json
const MANIFEST_PATH = 'E:/Academy Courses/manifest.json';

// Маппинг skill_category из manifest на enum
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

interface ManifestModule {
  id: string;
  folder: string;
  title_original: string;
  order: number;
  lessons: ManifestLesson[];
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

async function seedFromManifest() {
  console.log('📚 Loading manifest from:', MANIFEST_PATH);

  // Проверяем существование файла
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('❌ Manifest file not found:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestContent);

  console.log(`📊 Manifest stats: ${manifest.stats.courses} courses, ${manifest.stats.modules} modules, ${manifest.stats.lessons} lessons`);

  let coursesCreated = 0;
  let lessonsCreated = 0;

  for (const course of manifest.courses) {
    console.log(`\n📁 Processing course: ${course.title_original}`);

    // Создаём или обновляем курс
    const skillCategory = SKILL_CATEGORY_MAP[course.skill_category] || 'ANALYTICS';

    await prisma.course.upsert({
      where: { id: course.id },
      update: {
        title: course.title_original,
        description: course.title_en,
        order: course.order,
      },
      create: {
        id: course.id,
        title: course.title_original,
        description: course.title_en,
        slug: course.id, // используем id как slug
        duration: 0, // будет вычислено позже
        order: course.order,
      },
    });
    coursesCreated++;

    // Обрабатываем модули и уроки
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        // Длительность в минутах (округляем)
        const durationMinutes = lesson.duration_seconds
          ? Math.ceil(lesson.duration_seconds / 60)
          : null;

        await prisma.lesson.upsert({
          where: { id: lesson.id },
          update: {
            title: lesson.title_original,
            order: lesson.order,
            duration: durationMinutes,
            skillCategory: skillCategory,
          },
          create: {
            id: lesson.id,
            courseId: course.id,
            title: lesson.title_original,
            description: `Модуль: ${module.title_original}`,
            order: lesson.order,
            duration: durationMinutes,
            skillCategory: skillCategory,
            skillLevel: 'MEDIUM',
            // videoUrl и videoId пока null (Kinescope не настроен)
          },
        });
        lessonsCreated++;
      }
    }
  }

  // Обновляем общую длительность курсов
  console.log('\n⏱️ Updating course durations...');
  for (const course of manifest.courses) {
    const lessons = await prisma.lesson.findMany({
      where: { courseId: course.id },
      select: { duration: true },
    });

    const totalDuration = lessons.reduce((sum, l) => sum + (l.duration || 0), 0);

    await prisma.course.update({
      where: { id: course.id },
      data: { duration: totalDuration },
    });
  }

  console.log('\n✅ Seed completed!');
  console.log(`   Courses: ${coursesCreated}`);
  console.log(`   Lessons: ${lessonsCreated}`);
}

// Запуск
seedFromManifest()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
