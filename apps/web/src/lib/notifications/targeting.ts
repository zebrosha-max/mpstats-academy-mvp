/**
 * Targeting service for CONTENT_UPDATE notifications (Phase 52).
 *
 * Returns user IDs eligible to receive a course-content notification.
 * Eligibility (D1):
 *  - Active subscription (status='active', periodEnd > now())
 *  - At least one lesson in course where progress.status = COMPLETED
 *    OR (progress.status = IN_PROGRESS AND watchedPercent >= 50)
 */

import { Prisma } from '@mpstats/db';
import { prisma } from '@mpstats/db/client';

export async function findUsersForCourseUpdate(courseId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
    SELECT DISTINCT lp."userId" AS "userId"
    FROM "LearningPath" lp
    JOIN "LessonProgress" prog ON prog."pathId" = lp.id
    JOIN "Lesson" l ON prog."lessonId" = l.id
    JOIN "Subscription" s ON s."userId" = lp."userId"
    WHERE l."courseId" = ${courseId}
      AND s.status = 'active'
      AND s."periodEnd" > now()
      AND (
        prog.status = 'COMPLETED'
        OR (prog.status = 'IN_PROGRESS' AND prog."watchedPercent" >= 50)
      )
  `);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      out.push(r.userId);
    }
  }
  return out;
}
