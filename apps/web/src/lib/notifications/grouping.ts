/**
 * Rolling 24h grouping logic for CONTENT_UPDATE (Phase 52, D4).
 *
 * Find latest unread CONTENT_UPDATE for (userId, courseId) within now-24h.
 * If found → append new items (dedup by (kind,id)), update payload + ctaUrl.
 * Else → create new row.
 */

import { prisma } from '@mpstats/db/client';

export type ContentUpdateItem =
  | { kind: 'lesson'; id: string; title: string }
  | { kind: 'material'; id: string; lessonId: string; lessonTitle: string; title: string };

export interface ContentUpdatePayload {
  type: 'CONTENT_UPDATE';
  courseId: string;
  courseTitle: string;
  items: ContentUpdateItem[];
}

const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function dedupItems(items: ContentUpdateItem[]): ContentUpdateItem[] {
  const seen = new Set<string>();
  const out: ContentUpdateItem[] = [];
  for (const it of items) {
    const key = `${it.kind}:${it.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export function resolveCtaUrl(courseId: string, items: ContentUpdateItem[]): string {
  if (items.length === 1) {
    const it = items[0];
    if (it.kind === 'lesson') return `/learn/${it.id}`;
    return `/learn/${it.lessonId}`;
  }
  return '/learn';
}

export async function mergeOrCreateContentUpdate(
  userId: string,
  courseId: string,
  newItems: ContentUpdateItem[],
): Promise<ContentUpdatePayload | null> {
  if (newItems.length === 0) return null;

  const cutoff = new Date(Date.now() - ROLLING_WINDOW_MS);

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: 'CONTENT_UPDATE',
      readAt: null,
      createdAt: { gt: cutoff },
      payload: {
        path: ['courseId'],
        equals: courseId,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    const prevPayload = existing.payload as unknown as ContentUpdatePayload;
    const merged = dedupItems([...(prevPayload.items ?? []), ...newItems]);
    const ctaUrl = resolveCtaUrl(courseId, merged);
    const nextPayload: ContentUpdatePayload = { ...prevPayload, items: merged };
    await prisma.notification.update({
      where: { id: existing.id },
      data: {
        payload: nextPayload as unknown as object,
        ctaUrl,
      },
    });
    return nextPayload;
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { title: true },
  });
  const courseTitle = course?.title ?? '';
  const items = dedupItems(newItems);
  const payload: ContentUpdatePayload = {
    type: 'CONTENT_UPDATE',
    courseId,
    courseTitle,
    items,
  };
  await prisma.notification.create({
    data: {
      userId,
      type: 'CONTENT_UPDATE',
      payload: payload as unknown as object,
      ctaUrl: resolveCtaUrl(courseId, items),
    },
  });
  return payload;
}
