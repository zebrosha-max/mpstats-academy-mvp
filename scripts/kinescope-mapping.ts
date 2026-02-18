/**
 * Kinescope Video Mapping Script
 *
 * Inspects E:\Academy Courses using manifest.json,
 * verifies video files exist on disk, and creates a mapping file
 * linking file paths to Lesson IDs in the database.
 *
 * Usage:
 *   npx tsx scripts/kinescope-mapping.ts
 *   npx tsx scripts/kinescope-mapping.ts --dry-run    # Skip DB check
 *   npx tsx scripts/kinescope-mapping.ts --check-db   # Also check which lessons already have videoId
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// CLI flags
const DRY_RUN = process.argv.includes('--dry-run');
const CHECK_DB = process.argv.includes('--check-db');

const MANIFEST_PATH = 'E:/Academy Courses/manifest.json';
const BASE_PATH = 'E:\\Academy Courses';
const OUTPUT_PATH = path.resolve(__dirname, 'kinescope-video-map.json');

// Supported video extensions
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v']);

// Types from manifest.json
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

// Output types
interface MatchedEntry {
  filePath: string;
  lessonId: string;
  title: string;
  courseId: string;
  fileExists: boolean;
  fileSizeMB: number | null;
  extension: string;
  hasVideoId?: boolean; // Only populated with --check-db
}

interface UnmatchedEntry {
  filePath: string;
  reason: string;
}

interface MappingOutput {
  generated: string;
  basePath: string;
  manifestPath: string;
  matched: MatchedEntry[];
  unmatched: UnmatchedEntry[];
  stats: {
    total: number;
    matched: number;
    unmatched: number;
    filesExist: number;
    filesMissing: number;
    totalSizeMB: number;
    alreadyHaveVideoId: number;
    byExtension: Record<string, number>;
    byCourse: Record<string, number>;
  };
}

function isSubmoduleEntry(entry: ManifestModuleEntry): entry is ManifestSubmoduleEntry {
  return 'submodule' in entry;
}

/** Flatten module entries - extract lessons from submodule wrappers */
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

function getFileSizeMB(filePath: string): number | null {
  try {
    const stats = fs.statSync(filePath);
    return Math.round((stats.size / (1024 * 1024)) * 100) / 100;
  } catch {
    return null;
  }
}

async function createMapping() {
  console.log('=== Kinescope Video Mapping ===\n');

  // 1. Load manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Manifest not found:', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`Manifest: ${manifest.stats.courses} courses, ${manifest.stats.lessons} lessons`);
  console.log(`Base path: ${manifest.base_path}\n`);

  // 2. Check DB for existing videoIds (optional)
  let existingVideoIds = new Map<string, string>();
  let prisma: PrismaClient | null = null;

  if (CHECK_DB && !DRY_RUN) {
    prisma = new PrismaClient();
    console.log('Checking database for existing videoIds...');
    const lessonsWithVideo = await prisma.lesson.findMany({
      where: { videoId: { not: null } },
      select: { id: true, videoId: true },
    });
    for (const l of lessonsWithVideo) {
      if (l.videoId) existingVideoIds.set(l.id, l.videoId);
    }
    console.log(`Found ${existingVideoIds.size} lessons already with videoId\n`);
  }

  // 3. Process manifest entries
  const matched: MatchedEntry[] = [];
  const unmatched: UnmatchedEntry[] = [];
  const extensionCounts: Record<string, number> = {};
  const courseCounts: Record<string, number> = {};
  let filesExist = 0;
  let filesMissing = 0;
  let totalSizeMB = 0;

  for (const course of manifest.courses) {
    courseCounts[course.id] = 0;

    for (const module of course.modules) {
      const lessons = flattenLessons(module.lessons);

      for (const lesson of lessons) {
        const fullPath = path.join(BASE_PATH, lesson.filepath);
        const ext = path.extname(lesson.filename).toLowerCase();

        // Check if it's a video file
        if (!VIDEO_EXTENSIONS.has(ext)) {
          unmatched.push({
            filePath: fullPath,
            reason: `Not a video file (extension: ${ext})`,
          });
          continue;
        }

        // Check if file exists on disk
        const exists = fs.existsSync(fullPath);
        const sizeMB = exists ? getFileSizeMB(fullPath) : null;

        if (exists) {
          filesExist++;
          if (sizeMB) totalSizeMB += sizeMB;
        } else {
          filesMissing++;
        }

        // Track extension
        extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
        courseCounts[course.id]++;

        const entry: MatchedEntry = {
          filePath: fullPath,
          lessonId: lesson.id,
          title: lesson.title_original.replace(/\.\w+$/, ''), // Remove extension from title
          courseId: course.id,
          fileExists: exists,
          fileSizeMB: sizeMB,
          extension: ext,
        };

        if (CHECK_DB) {
          entry.hasVideoId = existingVideoIds.has(lesson.id);
        }

        matched.push(entry);
      }
    }
  }

  // 4. Scan for orphan video files not in manifest
  console.log('Scanning for orphan video files not in manifest...');
  const manifestPaths = new Set(matched.map((m) => m.filePath.toLowerCase()));

  function scanDir(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip non-course directories
          if (['chunks', 'embeddings', 'transcripts', 'scripts'].includes(entry.name)) continue;
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.has(ext) && !manifestPaths.has(fullPath.toLowerCase())) {
            unmatched.push({
              filePath: fullPath,
              reason: 'Video file not in manifest',
            });
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  scanDir(BASE_PATH);

  // 5. Build output
  const output: MappingOutput = {
    generated: new Date().toISOString(),
    basePath: BASE_PATH,
    manifestPath: MANIFEST_PATH,
    matched,
    unmatched,
    stats: {
      total: matched.length + unmatched.length,
      matched: matched.length,
      unmatched: unmatched.length,
      filesExist,
      filesMissing,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      alreadyHaveVideoId: existingVideoIds.size,
      byExtension: extensionCounts,
      byCourse: courseCounts,
    },
  };

  // 6. Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nMapping written to: ${OUTPUT_PATH}`);

  // 7. Console summary
  console.log('\n=== MAPPING SUMMARY ===');
  console.log(`Total video entries:  ${output.stats.total}`);
  console.log(`Matched to lessons:   ${output.stats.matched}`);
  console.log(`Unmatched:            ${output.stats.unmatched}`);
  console.log(`Files exist on disk:  ${output.stats.filesExist}`);
  console.log(`Files missing:        ${output.stats.filesMissing}`);
  console.log(`Total size:           ${output.stats.totalSizeMB} MB (~${Math.round(output.stats.totalSizeMB / 1024)} GB)`);

  if (CHECK_DB) {
    console.log(`Already have videoId: ${output.stats.alreadyHaveVideoId}`);
    console.log(`Need upload:          ${output.stats.matched - output.stats.alreadyHaveVideoId}`);
  }

  console.log('\nBy extension:');
  for (const [ext, count] of Object.entries(output.stats.byExtension)) {
    console.log(`  ${ext}: ${count}`);
  }

  console.log('\nBy course:');
  for (const [courseId, count] of Object.entries(output.stats.byCourse)) {
    console.log(`  ${courseId}: ${count} videos`);
  }

  if (output.unmatched.length > 0) {
    console.log('\nUnmatched files:');
    for (const u of output.unmatched) {
      console.log(`  ${u.filePath}`);
      console.log(`    Reason: ${u.reason}`);
    }
  }

  console.log('\nDone. Review kinescope-video-map.json before running upload script.');

  // Cleanup
  if (prisma) await prisma.$disconnect();
}

createMapping().catch((error) => {
  console.error('Mapping failed:', error);
  process.exit(1);
});
