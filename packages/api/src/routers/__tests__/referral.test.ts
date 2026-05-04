import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockPkgFindMany = vi.hoisted(() => vi.fn());
const mockReferralCount = vi.hoisted(() => vi.fn());
const mockActivatePackage = vi.hoisted(() => vi.fn());

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    userProfile: { findUnique: mockUserFindUnique },
    referralBonusPackage: { findMany: mockPkgFindMany },
    referral: { count: mockReferralCount },
  },
}));

vi.mock('../../services/referral/activation', () => ({
  activatePackage: mockActivatePackage,
  PackageActivationError: class extends Error {
    code: string;
    constructor(code: string, msg: string) {
      super(msg);
      this.code = code;
    }
  },
}));

import { referralRouter } from '../referral';

// protectedProcedure fires ctx.prisma.userProfile.findUnique (lastActiveAt debounce).
// Provide a minimal stub so the middleware doesn't crash.
const ctxPrismaStub = {
  userProfile: {
    findUnique: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
};

const ctx = {
  user: { id: 'user-1' },
  prisma: ctxPrismaStub as any,
};

function caller() {
  return referralRouter.createCaller(ctx as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('referral.getMyState', () => {
  it('returns code, counters, packages', async () => {
    mockUserFindUnique.mockResolvedValue({ referralCode: 'REF-AAA111' });
    mockReferralCount.mockResolvedValueOnce(5).mockResolvedValueOnce(3);
    mockPkgFindMany
      .mockResolvedValueOnce([
        { id: 'pkg1', days: 14, status: 'PENDING', issuedAt: new Date(), usedAt: null },
      ])
      .mockResolvedValueOnce([]);
    const result = await caller().getMyState();
    expect(result.referralCode).toBe('REF-AAA111');
    expect(result.totalReferred).toBe(5);
    expect(result.totalConverted).toBe(3);
    expect(result.pendingPackages).toHaveLength(1);
  });

  it('returns null code if user has none yet', async () => {
    mockUserFindUnique.mockResolvedValue({ referralCode: null });
    mockReferralCount.mockResolvedValue(0);
    mockPkgFindMany.mockResolvedValue([]);
    const result = await caller().getMyState();
    expect(result.referralCode).toBeNull();
  });
});

describe('referral.validateCode', () => {
  it('returns valid + referrerName for known code', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'u-ref',
      name: 'Anna',
    });
    const result = await caller().validateCode({ code: 'REF-AAA111' });
    expect(result.valid).toBe(true);
    expect(result.referrerName).toBe('Anna');
  });

  it('returns invalid for unknown code', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await caller().validateCode({ code: 'REF-XXXXXX' });
    expect(result.valid).toBe(false);
  });

  it('returns invalid for malformed code', async () => {
    const result = await caller().validateCode({ code: 'garbage' });
    expect(result.valid).toBe(false);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });
});

describe('referral.activatePackage', () => {
  it('calls activation with userId from ctx', async () => {
    mockActivatePackage.mockResolvedValue(undefined);
    await caller().activatePackage({ packageId: 'pkg-1' });
    expect(mockActivatePackage).toHaveBeenCalledWith('pkg-1', 'user-1');
  });

  it('translates PackageActivationError to TRPCError', async () => {
    const { PackageActivationError } = await import('../../services/referral/activation');
    mockActivatePackage.mockRejectedValue(
      new PackageActivationError('NOT_FOUND', 'Package not found'),
    );
    await expect(caller().activatePackage({ packageId: 'pkg-x' })).rejects.toBeInstanceOf(
      TRPCError,
    );
  });
});
