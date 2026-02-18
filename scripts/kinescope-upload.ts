/**
 * Kinescope Bulk Upload Script
 *
 * Reads kinescope-video-map.json (from mapping script),
 * uploads videos to Kinescope API, and updates Lesson.videoId in Supabase.
 *
 * Usage:
 *   npx tsx scripts/kinescope-upload.ts              # Upload all
 *   npx tsx scripts/kinescope-upload.ts --dry-run     # Show what would be uploaded
 *   npx tsx scripts/kinescope-upload.ts --limit 5     # Upload only first 5
 *   npx tsx scripts/kinescope-upload.ts --resume      # Resume from progress file (default behavior)
 *
 * Required env vars:
 *   KINESCOPE_API_KEY     - Bearer token from Kinescope dashboard
 *   KINESCOPE_PROJECT_ID  - Project ID from Kinescope dashboard
 *   DATABASE_URL          - Prisma connection string (already in .env)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ============== CONFIG ==============

const KINESCOPE_API_KEY = process.env.KINESCOPE_API_KEY;
const KINESCOPE_PROJECT_ID = process.env.KINESCOPE_PROJECT_ID;

// Kinescope upload endpoint
const UPLOAD_URL = 'https://upload.new.video';

// Retry config
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000]; // Exponential backoff

// Upload timeout: 5 minutes per file
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

// File paths
const MAP_PATH = path.resolve(__dirname, 'kinescope-video-map.json');
const PROGRESS_PATH = path.resolve(__dirname, 'kinescope-upload-progress.json');

// CLI flags
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_INDEX = process.argv.indexOf('--limit');
const LIMIT = LIMIT_INDEX !== -1 ? parseInt(process.argv[LIMIT_INDEX + 1], 10) : Infinity;

// ============== TYPES ==============

interface MatchedEntry {
  filePath: string;
  lessonId: string;
  title: string;
  courseId: string;
  fileExists: boolean;
  fileSizeMB: number | null;
  extension: string;
}

interface MappingFile {
  generated: string;
  matched: MatchedEntry[];
  stats: { total: number; matched: number };
}

interface UploadProgress {
  startedAt: string;
  lastUpdated: string;
  uploaded: Array<{
    lessonId: string;
    videoId: string;
    uploadedAt: string;
  }>;
  failed: Array<{
    lessonId: string;
    filePath: string;
    error: string;
    failedAt: string;
  }>;
}

// ============== HELPERS ==============

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadProgress(): UploadProgress {
  if (fs.existsSync(PROGRESS_PATH)) {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf-8'));
  }
  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    uploaded: [],
    failed: [],
  };
}

function saveProgress(progress: UploadProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

/**
 * Upload a single video to Kinescope API
 *
 * Uses multipart form upload to https://upload.new.video
 * Returns the Kinescope video ID from the response.
 *
 * NOTE: Kinescope API response format has MEDIUM confidence from research.
 * The script logs the full response for the first upload so the user
 * can verify the videoId field name.
 *
 * // TODO: verify response.data.id is the correct videoId field after first upload test
 */
async function uploadToKinescope(
  filePath: string,
  title: string,
  isFirstUpload: boolean,
): Promise<string> {
  if (!KINESCOPE_API_KEY || !KINESCOPE_PROJECT_ID) {
    throw new Error(
      'KINESCOPE_API_KEY and KINESCOPE_PROJECT_ID must be set in .env',
    );
  }

  // Read file as buffer for upload
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  // Build multipart form data manually using standard FormData
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'video/mp4' });
  formData.append('video', blob, fileName);
  formData.append('title', title);
  formData.append('project_id', KINESCOPE_PROJECT_ID);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KINESCOPE_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Log full response for the first upload to verify field names
    if (isFirstUpload) {
      console.log('\n  [FIRST UPLOAD] Full API response:');
      console.log(JSON.stringify(data, null, 2));
      console.log('  Verify that the videoId field is correct above.\n');
    }

    // Try common response patterns for video ID
    // Kinescope API may return: { data: { id: "..." } } or { id: "..." } or { video_id: "..." }
    const videoId =
      data?.data?.id || data?.id || data?.video_id || data?.data?.video_id;

    if (!videoId) {
      console.error('  [WARN] Could not extract videoId from response:', JSON.stringify(data));
      throw new Error('videoId not found in API response');
    }

    return videoId;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error.name === 'AbortError') {
      throw new Error(`Upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  }
}

/**
 * Upload with retry logic (exponential backoff)
 */
async function uploadWithRetry(
  filePath: string,
  title: string,
  isFirstUpload: boolean,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await uploadToKinescope(filePath, title, isFirstUpload && attempt === 0);
    } catch (error: any) {
      lastError = error;

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempt] || 8000;
        console.log(
          `  [RETRY] Attempt ${attempt + 1}/${MAX_RETRIES} failed: ${error.message}. Retrying in ${delay / 1000}s...`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Upload failed after all retries');
}

// ============== MAIN ==============

async function main() {
  console.log('=== Kinescope Bulk Upload ===\n');

  // 1. Validate environment
  if (!DRY_RUN) {
    if (!KINESCOPE_API_KEY) {
      console.error('ERROR: KINESCOPE_API_KEY not set in .env');
      console.error('See docs/KINESCOPE_SETUP.md for setup instructions.');
      process.exit(1);
    }
    if (!KINESCOPE_PROJECT_ID) {
      console.error('ERROR: KINESCOPE_PROJECT_ID not set in .env');
      console.error('See docs/KINESCOPE_SETUP.md for setup instructions.');
      process.exit(1);
    }
  }

  // 2. Load mapping file
  if (!fs.existsSync(MAP_PATH)) {
    console.error('Mapping file not found:', MAP_PATH);
    console.error('Run mapping script first: npx tsx scripts/kinescope-mapping.ts');
    process.exit(1);
  }

  const mapping: MappingFile = JSON.parse(fs.readFileSync(MAP_PATH, 'utf-8'));
  console.log(`Mapping loaded: ${mapping.matched.length} entries (generated ${mapping.generated})\n`);

  // 3. Load progress (for resume)
  const progress = loadProgress();
  const uploadedSet = new Set(progress.uploaded.map((u) => u.lessonId));
  console.log(`Previous progress: ${progress.uploaded.length} uploaded, ${progress.failed.length} failed`);

  // 4. Check DB for existing videoIds
  const prisma = new PrismaClient();
  let dbSkipped = 0;

  const lessonsWithVideo = DRY_RUN
    ? []
    : await prisma.lesson.findMany({
        where: { videoId: { not: null } },
        select: { id: true },
      });

  const hasVideoIdSet = new Set(lessonsWithVideo.map((l) => l.id));

  // 5. Build upload queue
  const queue: MatchedEntry[] = [];

  for (const entry of mapping.matched) {
    // Skip if file doesn't exist
    if (!entry.fileExists) continue;

    // Skip if already uploaded in previous run
    if (uploadedSet.has(entry.lessonId)) {
      dbSkipped++;
      continue;
    }

    // Skip if lesson already has videoId in DB
    if (hasVideoIdSet.has(entry.lessonId)) {
      dbSkipped++;
      continue;
    }

    queue.push(entry);
  }

  // Apply limit
  const toUpload = queue.slice(0, LIMIT);

  console.log(`\nUpload queue: ${toUpload.length} videos`);
  console.log(`Skipped: ${dbSkipped} (already have videoId or previously uploaded)`);
  if (LIMIT < Infinity) console.log(`Limit: ${LIMIT}`);
  if (DRY_RUN) console.log('[DRY RUN] No uploads will be performed.\n');

  // 6. Process uploads
  let uploaded = 0;
  let failed = 0;
  let skipped = dbSkipped;
  let isFirstUpload = true;

  for (let i = 0; i < toUpload.length; i++) {
    const entry = toUpload[i];
    const num = i + 1;
    const total = toUpload.length;
    const sizeMB = entry.fileSizeMB ? `${entry.fileSizeMB} MB` : 'unknown size';

    console.log(`[${num}/${total}] Uploading: ${entry.lessonId} (${sizeMB})`);
    console.log(`  File: ${path.basename(entry.filePath)}`);
    console.log(`  Title: ${entry.title}`);

    if (DRY_RUN) {
      console.log('  [DRY RUN] Would upload to Kinescope and update DB\n');
      uploaded++;
      continue;
    }

    try {
      // Upload to Kinescope
      const videoId = await uploadWithRetry(entry.filePath, entry.title, isFirstUpload);
      isFirstUpload = false;

      console.log(`  Kinescope videoId: ${videoId}`);

      // Update Lesson in DB
      await prisma.lesson.update({
        where: { id: entry.lessonId },
        data: {
          videoId: videoId,
          videoUrl: `https://kinescope.io/embed/${videoId}`,
        },
      });

      console.log(`  DB updated: Lesson.videoId = ${videoId}\n`);

      // Track progress
      progress.uploaded.push({
        lessonId: entry.lessonId,
        videoId,
        uploadedAt: new Date().toISOString(),
      });
      saveProgress(progress);
      uploaded++;
    } catch (error: any) {
      console.error(`  [FAILED] ${error.message}\n`);

      // Track failure
      progress.failed.push({
        lessonId: entry.lessonId,
        filePath: entry.filePath,
        error: error.message,
        failedAt: new Date().toISOString(),
      });
      saveProgress(progress);
      failed++;
    }
  }

  // 7. Summary
  console.log('\n=== UPLOAD SUMMARY ===');
  console.log(`Mode:     ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped:  ${skipped} (already had videoId)`);
  console.log(`Failed:   ${failed}`);
  console.log(`Total:    ${mapping.matched.length} in mapping`);

  if (failed > 0) {
    console.log(`\nFailed uploads saved to: ${PROGRESS_PATH}`);
    console.log('Re-run the script to retry failed uploads.');
  }

  if (!DRY_RUN) {
    console.log(`\nProgress saved to: ${PROGRESS_PATH}`);
  }

  console.log('\nDone.');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Upload failed:', error);
  process.exit(1);
});
