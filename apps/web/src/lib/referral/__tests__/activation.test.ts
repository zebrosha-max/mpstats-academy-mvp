import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockSubFindFirst = vi.fn();
const mockSubUpdate = vi.fn();
const mockSubCreate = vi.fn();
const mockPlanFindFirst = vi.fn();
const mockPkgFindUnique = vi.fn();
const mockPkgUpdate = vi.fn();

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    $transaction: async (cb: any) =>
      cb({
        subscription: {
          findFirst: mockSubFindFirst,
          update: mockSubUpdate,
          create: mockSubCreate,
        },
        subscriptionPlan: { findFirst: mockPlanFindFirst },
        referralBonusPackage: {
          findUnique: mockPkgFindUnique,
          update: mockPkgUpdate,
        },
      }),
  },
}));

import { activatePackage } from '../activation';

const PKG_ID = 'pkg-1';
const USER_ID = 'user-a';
const PLATFORM_PLAN = { id: 'plan-platform', type: 'PLATFORM' };

beforeEach(() => {
  vi.clearAllMocks();
  mockPlanFindFirst.mockResolvedValue(PLATFORM_PLAN);
  mockPkgFindUnique.mockResolvedValue({
    id: PKG_ID,
    ownerUserId: USER_ID,
    days: 14,
    status: 'PENDING',
  });
});

describe('activatePackage', () => {
  it('extends ACTIVE subscription periodEnd by 14 days', async () => {
    const futureEnd = new Date(Date.now() + 5 * 86400_000);
    mockSubFindFirst.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      currentPeriodEnd: futureEnd,
    });

    await activatePackage(PKG_ID, USER_ID);

    expect(mockSubUpdate).toHaveBeenCalledOnce();
    const updateArg = mockSubUpdate.mock.calls[0][0];
    expect(updateArg.where.id).toBe('sub-1');
    const expected = new Date(futureEnd.getTime() + 14 * 86400_000);
    expect(updateArg.data.currentPeriodEnd.getTime()).toBe(expected.getTime());
    expect(mockSubCreate).not.toHaveBeenCalled();
    expect(mockPkgUpdate).toHaveBeenCalledOnce();
  });

  it('extends TRIAL subscription periodEnd by 14 days', async () => {
    const futureEnd = new Date(Date.now() + 3 * 86400_000);
    mockSubFindFirst.mockResolvedValue({
      id: 'sub-trial',
      status: 'TRIAL',
      currentPeriodEnd: futureEnd,
    });

    await activatePackage(PKG_ID, USER_ID);

    expect(mockSubUpdate).toHaveBeenCalledOnce();
    expect(mockSubCreate).not.toHaveBeenCalled();
  });

  it('creates new TRIAL when no active subscription', async () => {
    mockSubFindFirst.mockResolvedValue(null);

    await activatePackage(PKG_ID, USER_ID);

    expect(mockSubCreate).toHaveBeenCalledOnce();
    const createArg = mockSubCreate.mock.calls[0][0];
    expect(createArg.data.status).toBe('TRIAL');
    expect(createArg.data.userId).toBe(USER_ID);
    expect(createArg.data.planId).toBe(PLATFORM_PLAN.id);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockPkgUpdate).toHaveBeenCalledOnce();
  });

  it('creates new TRIAL when current sub expired (periodEnd in past)', async () => {
    mockSubFindFirst.mockResolvedValue(null);
    await activatePackage(PKG_ID, USER_ID);
    expect(mockSubCreate).toHaveBeenCalledOnce();
  });

  it('throws when package not found', async () => {
    mockPkgFindUnique.mockResolvedValue(null);
    await expect(activatePackage(PKG_ID, USER_ID)).rejects.toThrow(/package/i);
    expect(mockSubUpdate).not.toHaveBeenCalled();
    expect(mockSubCreate).not.toHaveBeenCalled();
  });

  it('throws when package belongs to another user', async () => {
    mockPkgFindUnique.mockResolvedValue({
      id: PKG_ID,
      ownerUserId: 'other-user',
      days: 14,
      status: 'PENDING',
    });
    await expect(activatePackage(PKG_ID, USER_ID)).rejects.toThrow(/package/i);
  });

  it('throws when package already USED', async () => {
    mockPkgFindUnique.mockResolvedValue({
      id: PKG_ID,
      ownerUserId: USER_ID,
      days: 14,
      status: 'USED',
    });
    await expect(activatePackage(PKG_ID, USER_ID)).rejects.toThrow(/package/i);
  });
});
