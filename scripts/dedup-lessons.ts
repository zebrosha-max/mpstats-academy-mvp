/**
 * Dedup script: find and remove duplicate lessons by videoId
 *
 * Bug R35: lessons 4=6, 7=10 have the same videoId (duplicate content)
 * Strategy: keep lesson with lowest order, delete the rest
 * Transfers LessonProgress and LessonComment to the kept lesson
 *
 * Usage:
 *   npx tsx scripts/dedup-lessons.ts            # dry-run (show duplicates)
 *   npx tsx scripts/dedup-lessons.ts --execute   # apply changes
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes('--execute');

interface LessonInfo {
  id: string;
  courseId: string;
  title: string;
  order: number;
  videoId: string;
}

async function main() {
  console.log(`\n=== Lesson Dedup Script ===`);
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (will modify DB)' : 'DRY RUN (read-only)'}\n`);

  // 1. Fetch all lessons with non-null videoId, ordered by courseId, order
  const lessons = await prisma.lesson.findMany({
    where: { videoId: { not: null } },
    select: { id: true, courseId: true, title: true, order: true, videoId: true },
    orderBy: [{ courseId: 'asc' }, { order: 'asc' }],
  });

  console.log(`Total lessons with videoId: ${lessons.length}`);

  // 2. Group by videoId
  const groups = new Map<string, LessonInfo[]>();
  for (const lesson of lessons) {
    const vid = lesson.videoId as string;
    if (!groups.has(vid)) {
      groups.set(vid, []);
    }
    groups.get(vid)!.push({ ...lesson, videoId: vid });
  }

  // 3. Find duplicate groups (size > 1)
  const duplicateGroups: LessonInfo[][] = [];
  for (const [, group] of groups) {
    if (group.length > 1) {
      duplicateGroups.push(group);
    }
  }

  if (duplicateGroups.length === 0) {
    console.log('\nNo duplicate lessons found. Database is clean.');
    return;
  }

  console.log(`\nFound ${duplicateGroups.length} duplicate group(s):\n`);

  let totalDeleted = 0;
  let totalProgressTransferred = 0;
  let totalCommentsTransferred = 0;

  for (const group of duplicateGroups) {
    // Sort by order ascending — keep the first (lowest order)
    group.sort((a, b) => a.order - b.order);
    const keep = group[0];
    const duplicates = group.slice(1);

    console.log(`--- videoId: ${keep.videoId} ---`);
    console.log(`  KEEP:   id=${keep.id} course=${keep.courseId} order=${keep.order} "${keep.title}"`);
    for (const dup of duplicates) {
      console.log(`  DELETE: id=${dup.id} course=${dup.courseId} order=${dup.order} "${dup.title}"`);
    }

    if (EXECUTE) {
      for (const dup of duplicates) {
        // Transfer LessonProgress with @@unique([pathId, lessonId]) handling
        const progRecords = await prisma.lessonProgress.findMany({
          where: { lessonId: dup.id },
        });

        for (const prog of progRecords) {
          const existing = await prisma.lessonProgress.findUnique({
            where: { pathId_lessonId: { pathId: prog.pathId, lessonId: keep.id } },
          });

          if (existing) {
            // Keep lesson already has progress for this path — delete duplicate's record
            await prisma.lessonProgress.delete({ where: { id: prog.id } });
            console.log(`    Progress pathId=${prog.pathId}: conflict — deleted duplicate's record`);
          } else {
            // No conflict — transfer to keep lesson
            await prisma.lessonProgress.update({
              where: { id: prog.id },
              data: { lessonId: keep.id },
            });
            totalProgressTransferred++;
            console.log(`    Progress pathId=${prog.pathId}: transferred to keep lesson`);
          }
        }

        // Transfer LessonComment (no unique constraint — safe updateMany)
        const commentResult = await prisma.lessonComment.updateMany({
          where: { lessonId: dup.id },
          data: { lessonId: keep.id },
        });
        if (commentResult.count > 0) {
          totalCommentsTransferred += commentResult.count;
          console.log(`    Comments: transferred ${commentResult.count} comment(s)`);
        }

        // Delete the duplicate lesson (cascades remaining relations)
        await prisma.lesson.delete({ where: { id: dup.id } });
        totalDeleted++;
        console.log(`    Deleted lesson ${dup.id}`);
      }
    }

    console.log('');
  }

  if (EXECUTE) {
    console.log(`=== Summary ===`);
    console.log(`Deleted ${totalDeleted} duplicate lesson(s)`);
    console.log(`Transferred ${totalProgressTransferred} progress record(s)`);
    console.log(`Transferred ${totalCommentsTransferred} comment(s)`);
  } else {
    console.log(`DRY RUN — use --execute to apply changes`);
    console.log(`Would delete ${duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0)} duplicate lesson(s)`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
