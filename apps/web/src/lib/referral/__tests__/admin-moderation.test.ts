import { describe, expect, it, beforeEach, vi } from 'vitest';

const {
  mockFindUnique,
  mockUpdate,
  mockFindMany,
  mockTransaction,
  mockPackageCreate,
  mockSetUserProps,
  mockTrackEvent,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockPackageCreate: vi.fn(),
  mockSetUserProps: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    referral: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      findMany: mockFindMany,
    },
    referralBonusPackage: {
      create: mockPackageCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/carrotquest/client', () => ({
  cq: {
    setUserProps: mockSetUserProps,
    trackEvent: mockTrackEvent,
  },
}));

import {
  approveReferral,
  rejectReferral,
  bulkApproveByReferrer,
  bulkRejectByReferrer,
} from '../admin-moderation';

beforeEach(() => {
  vi.clearAllMocks();
  mockSetUserProps.mockResolvedValue(undefined);
  mockTrackEvent.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (fn: any) => {
    const tx = {
      referral: { update: mockUpdate },
      referralBonusPackage: { create: mockPackageCreate },
    };
    return fn(tx);
  });
});

describe('approveReferral', () => {
  it('returns NOT_FOUND when referral missing', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await approveReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });
    expect(result).toEqual({ code: 'NOT_FOUND' });
  });

  it('returns WRONG_STATUS when not PENDING_REVIEW', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'r1',
      status: 'CONVERTED',
      referrerUserId: 'ref1',
      referred: { name: 'Friend' },
    });
    const result = await approveReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });
    expect(result).toEqual({ code: 'WRONG_STATUS', current: 'CONVERTED' });
  });

  it('returns NO_REFERRER when referrer is null', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'r1',
      status: 'PENDING_REVIEW',
      referrerUserId: null,
      referred: { name: 'Friend' },
    });
    const result = await approveReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });
    expect(result).toEqual({ code: 'NO_REFERRER' });
  });

  it('approves: updates referral, creates package, fires CQ event', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'r1',
      status: 'PENDING_REVIEW',
      referrerUserId: 'ref1',
      referred: { name: 'Иван' },
    });
    mockPackageCreate.mockResolvedValue({ id: 'pkg1' });

    const result = await approveReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });

    expect(result).toEqual({ ok: true, referralId: 'r1', packageId: 'pkg1' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r1' },
        data: expect.objectContaining({
          status: 'CONVERTED',
          conversionTrigger: 'admin_approve',
          reviewedByUserId: 'admin1',
        }),
      }),
    );
    expect(mockPackageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerUserId: 'ref1',
          sourceReferralId: 'r1',
          status: 'PENDING',
        }),
      }),
    );
    expect(mockSetUserProps).toHaveBeenCalledWith('ref1', {
      pa_referral_friend_name: 'Иван',
      pa_referral_package_days: 14,
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('ref1', 'pa_referral_friend_registered');
  });

  it('still returns ok when CQ fails', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'r1',
      status: 'PENDING_REVIEW',
      referrerUserId: 'ref1',
      referred: { name: 'Иван' },
    });
    mockPackageCreate.mockResolvedValue({ id: 'pkg1' });
    mockTrackEvent.mockRejectedValue(new Error('CQ down'));

    const result = await approveReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });
    expect(result).toEqual({ ok: true, referralId: 'r1', packageId: 'pkg1' });
  });
});

describe('rejectReferral', () => {
  it('returns NOT_FOUND when referral missing', async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await rejectReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });
    expect(result).toEqual({ code: 'NOT_FOUND' });
  });

  it('returns WRONG_STATUS when not PENDING_REVIEW', async () => {
    mockFindUnique.mockResolvedValue({ id: 'r1', status: 'CONVERTED' });
    const result = await rejectReferral({ referralId: 'r1', reviewedByUserId: 'admin1' });
    expect(result).toEqual({ code: 'WRONG_STATUS', current: 'CONVERTED' });
  });

  it('rejects with reason and audit fields, no CQ event', async () => {
    mockFindUnique.mockResolvedValue({ id: 'r1', status: 'PENDING_REVIEW' });
    const result = await rejectReferral({
      referralId: 'r1',
      reviewedByUserId: 'admin1',
      reason: 'spam pattern',
    });

    expect(result).toEqual({ ok: true, referralId: 'r1' });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: expect.objectContaining({
        status: 'BLOCKED_FRAUD',
        rejectReason: 'spam pattern',
        reviewedByUserId: 'admin1',
      }),
    });
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});

describe('bulkApproveByReferrer', () => {
  it('approves all PENDING_REVIEW from referrer', async () => {
    mockFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
    // approveReferral re-queries each referral via findUnique; mock all valid.
    mockFindUnique.mockResolvedValue({
      id: 'rX',
      status: 'PENDING_REVIEW',
      referrerUserId: 'ref1',
      referred: { name: 'Friend' },
    });
    mockPackageCreate.mockResolvedValue({ id: 'pkg' });

    const result = await bulkApproveByReferrer({
      referrerUserId: 'ref1',
      reviewedByUserId: 'admin1',
    });

    expect(result).toEqual({ approved: 3, failed: 0 });
    expect(mockTrackEvent).toHaveBeenCalledTimes(3);
  });

  it('counts failures separately', async () => {
    mockFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    // First call valid, second call returns null (deleted concurrently).
    mockFindUnique
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'PENDING_REVIEW',
        referrerUserId: 'ref1',
        referred: { name: 'F' },
      })
      .mockResolvedValueOnce(null);
    mockPackageCreate.mockResolvedValue({ id: 'pkg' });

    const result = await bulkApproveByReferrer({
      referrerUserId: 'ref1',
      reviewedByUserId: 'admin1',
    });

    expect(result).toEqual({ approved: 1, failed: 1 });
  });
});

describe('bulkRejectByReferrer', () => {
  it('rejects all PENDING_REVIEW with shared reason', async () => {
    mockFindMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    mockFindUnique.mockResolvedValue({ id: 'rX', status: 'PENDING_REVIEW' });

    const result = await bulkRejectByReferrer({
      referrerUserId: 'ref1',
      reviewedByUserId: 'admin1',
      reason: 'cap exceeded',
    });

    expect(result).toEqual({ rejected: 2, failed: 0 });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectReason: 'cap exceeded' }),
      }),
    );
  });
});
