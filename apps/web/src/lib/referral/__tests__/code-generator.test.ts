import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    userProfile: { findUnique: vi.fn() },
  },
}));

import { prisma } from '@mpstats/db/client';
import { generateRefCode, generateUniqueRefCode, REF_ALPHABET } from '../code-generator';

describe('generateRefCode', () => {
  it('returns string in format REF- + 6 chars', () => {
    const code = generateRefCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
  });

  it('uses only safe alphabet (no I, L, O, 0, 1)', () => {
    const code = generateRefCode();
    const chars = code.slice(4); // strip "REF-"
    for (const c of chars) {
      expect(REF_ALPHABET).toContain(c);
    }
    expect(REF_ALPHABET).not.toContain('I');
    expect(REF_ALPHABET).not.toContain('L');
    expect(REF_ALPHABET).not.toContain('O');
    expect(REF_ALPHABET).not.toContain('0');
    expect(REF_ALPHABET).not.toContain('1');
  });
});

describe('generateUniqueRefCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns code on first attempt when no collision', async () => {
    (prisma.userProfile.findUnique as any).mockResolvedValue(null);
    const code = await generateUniqueRefCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledOnce();
  });

  it('retries on collision and returns when free slot found', async () => {
    (prisma.userProfile.findUnique as any)
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    const code = await generateUniqueRefCode();
    expect(code).toMatch(/^REF-[A-Z0-9]{6}$/);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledTimes(2);
  });

  it('throws after maxRetries on persistent collision', async () => {
    (prisma.userProfile.findUnique as any).mockResolvedValue({ id: 'existing' });
    await expect(generateUniqueRefCode(3)).rejects.toThrow(/unique ref code/);
    expect(prisma.userProfile.findUnique).toHaveBeenCalledTimes(3);
  });
});
