import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from '@mpstats/db/client';
import { findUsersForCourseUpdate } from '../targeting';

describe('findUsersForCourseUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes user with COMPLETED lesson and active sub', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ userId: 'u1' }]);
    const result = await findUsersForCourseUpdate('c1');
    expect(result).toEqual(['u1']);
  });

  it('returns empty array when no targets', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([]);
    const result = await findUsersForCourseUpdate('c1');
    expect(result).toEqual([]);
  });

  it('dedupes user ids', async () => {
    (prisma.$queryRaw as any).mockResolvedValue([{ userId: 'u1' }, { userId: 'u1' }]);
    const result = await findUsersForCourseUpdate('c1');
    expect(result).toEqual(['u1']);
  });
});
