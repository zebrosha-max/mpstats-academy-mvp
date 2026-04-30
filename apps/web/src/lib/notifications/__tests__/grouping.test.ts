import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    course: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@mpstats/db/client';
import { mergeOrCreateContentUpdate, dedupItems } from '../grouping';

const courseStub = { id: 'c1', title: 'Аналитика' };

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.course.findUnique as any).mockResolvedValue(courseStub);
});

describe('dedupItems', () => {
  it('dedupes by (kind, id)', () => {
    const out = dedupItems([
      { kind: 'lesson', id: 'l1', title: 'A' },
      { kind: 'lesson', id: 'l1', title: 'A' },
      { kind: 'material', id: 'l1', lessonId: 'x', lessonTitle: 'y', title: 'z' },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('mergeOrCreateContentUpdate', () => {
  it('inserts new when no prior unread within 24h', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
    ]);
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('updates existing unread within 24h, appending items', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue({
      id: 'n1',
      payload: {
        type: 'CONTENT_UPDATE',
        courseId: 'c1',
        courseTitle: 'Аналитика',
        items: [{ kind: 'lesson', id: 'l1', title: 'A' }],
      },
    });
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l2', title: 'B' },
    ]);
    expect(prisma.notification.update).toHaveBeenCalledOnce();
    const updateArg = (prisma.notification.update as any).mock.calls[0][0];
    expect(updateArg.where.id).toBe('n1');
    expect(updateArg.data.payload.items).toHaveLength(2);
  });

  it('inserts new when no unread row exists (read rows filtered by query)', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
    ]);
    expect(prisma.notification.create).toHaveBeenCalledOnce();
  });

  it('dedupes when same lesson in both existing and new items', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue({
      id: 'n1',
      payload: {
        type: 'CONTENT_UPDATE',
        courseId: 'c1',
        courseTitle: 'Аналитика',
        items: [{ kind: 'lesson', id: 'l1', title: 'A' }],
      },
    });
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
    ]);
    const updateArg = (prisma.notification.update as any).mock.calls[0][0];
    expect(updateArg.data.payload.items).toHaveLength(1);
  });

  it('resolves ctaUrl: single lesson → /learn/{lessonId}', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'lesson-x', title: 'A' },
    ]);
    const createArg = (prisma.notification.create as any).mock.calls[0][0];
    expect(createArg.data.ctaUrl).toBe('/learn/lesson-x');
  });

  it('resolves ctaUrl: multiple items → /learn (course hub fallback)', async () => {
    (prisma.notification.findFirst as any).mockResolvedValue(null);
    await mergeOrCreateContentUpdate('u1', 'c1', [
      { kind: 'lesson', id: 'l1', title: 'A' },
      { kind: 'lesson', id: 'l2', title: 'B' },
    ]);
    const createArg = (prisma.notification.create as any).mock.calls[0][0];
    expect(createArg.data.ctaUrl).toBe('/learn');
  });

  it('skips when newItems is empty', async () => {
    await mergeOrCreateContentUpdate('u1', 'c1', []);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
  });
});
