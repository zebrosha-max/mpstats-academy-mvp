import { describe, it, expect } from 'vitest';

import { decideRecurrentUpdate } from '@/lib/cloudpayments/decide-recurrent-update';
import type { NormalizedRecurrentEvent } from '@/lib/cloudpayments/parse-webhook';

const baseEvent: NormalizedRecurrentEvent = {
  cpSubscriptionId: 'sc_fb5496f23442446ea18ca16b2c16b',
  accountId: 'user-uuid',
  amount: 2990,
  cpStatus: 'Active',
  successCount: 1,
  failCount: 0,
  startDate: new Date('2026-04-12T09:31:05'),
  nextTransactionDate: new Date('2026-05-12T09:31:05'),
};

const baseSub = {
  id: 'sub-internal-id',
  status: 'ACTIVE' as const,
  currentPeriodStart: new Date('2026-04-12T00:00:00'),
  currentPeriodEnd: new Date('2026-05-12T00:00:00'),
  cpSubscriptionId: null as string | null,
  plan: { intervalDays: 30 },
};

describe('decideRecurrentUpdate', () => {
  it('Active event always saves cpSubscriptionId on first match', () => {
    const update = decideRecurrentUpdate(baseEvent, baseSub);
    expect(update?.cpSubscriptionId).toBe('sc_fb5496f23442446ea18ca16b2c16b');
  });

  it('Active event with successCount > 0 extends period from CURRENT periodEnd', () => {
    const update = decideRecurrentUpdate(baseEvent, baseSub);

    expect(update?.status).toBe('ACTIVE');
    expect(update?.currentPeriodStart).toEqual(baseSub.currentPeriodEnd);
    // 2026-05-12 + 30 days = 2026-06-11
    const expected = new Date(baseSub.currentPeriodEnd);
    expected.setDate(expected.getDate() + 30);
    expect(update?.currentPeriodEnd).toEqual(expected);
  });

  it('Active event with successCount = 0 does NOT extend period (subscription created but not yet charged)', () => {
    const update = decideRecurrentUpdate(
      { ...baseEvent, successCount: 0 },
      baseSub,
    );
    expect(update?.currentPeriodStart).toBeUndefined();
    expect(update?.currentPeriodEnd).toBeUndefined();
    // But still saves cpSubscriptionId
    expect(update?.cpSubscriptionId).toBe(baseEvent.cpSubscriptionId);
  });

  it('Rejected event marks subscription CANCELLED when first charge failed', () => {
    const update = decideRecurrentUpdate(
      { ...baseEvent, cpStatus: 'Rejected', successCount: 0, failCount: 1 },
      baseSub,
    );
    expect(update?.status).toBe('CANCELLED');
    expect(update?.cancelledAt).toBeInstanceOf(Date);
  });

  it('PastDue event transitions our status to PAST_DUE', () => {
    const update = decideRecurrentUpdate(
      { ...baseEvent, cpStatus: 'PastDue', successCount: 1, failCount: 1 },
      baseSub,
    );
    expect(update?.status).toBe('PAST_DUE');
  });

  it('Cancelled event marks subscription CANCELLED with cancelledAt', () => {
    const update = decideRecurrentUpdate(
      { ...baseEvent, cpStatus: 'Cancelled' },
      baseSub,
    );
    expect(update?.status).toBe('CANCELLED');
    expect(update?.cancelledAt).toBeInstanceOf(Date);
  });

  it('Expired event marks subscription EXPIRED', () => {
    const update = decideRecurrentUpdate(
      { ...baseEvent, cpStatus: 'Expired' },
      baseSub,
    );
    expect(update?.status).toBe('EXPIRED');
  });

  it('does not overwrite cpSubscriptionId if already set to same value', () => {
    const update = decideRecurrentUpdate(baseEvent, {
      ...baseSub,
      cpSubscriptionId: baseEvent.cpSubscriptionId,
    });
    // Still safe to include — Prisma update is idempotent — but no need to set it
    expect(update?.cpSubscriptionId).toBeUndefined();
  });
});
