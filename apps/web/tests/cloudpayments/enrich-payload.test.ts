import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    subscription: { findUnique },
  },
}));

vi.mock('@/lib/carrotquest/emails', () => ({
  sendPaymentSuccessEmail: vi.fn(),
  sendPaymentFailedEmail: vi.fn(),
  sendCancellationEmail: vi.fn(),
}));

import { enrichPayloadWithDbLookup } from '@/lib/cloudpayments/subscription-service';

describe('enrichPayloadWithDbLookup', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('passes through unchanged when InvoiceId is already present', async () => {
    const payload = {
      TransactionId: '1',
      InvoiceId: 'sub_already_set',
      SubscriptionId: 'sc_xyz',
      AccountId: 'user-1',
      Amount: '10',
    };
    const result = await enrichPayloadWithDbLookup(payload);
    expect(result).toBe(payload);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('passes through unchanged when ExternalId is present', async () => {
    const payload = {
      TransactionId: '1',
      ExternalId: 'sub-external',
      SubscriptionId: 'sc_xyz',
      AccountId: 'user-1',
      Amount: '10',
    };
    const result = await enrichPayloadWithDbLookup(payload);
    expect(result).toBe(payload);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('passes through unchanged when Data.ourSubscriptionId is present', async () => {
    const payload = {
      TransactionId: '1',
      Data: JSON.stringify({ ourSubscriptionId: 'sub-from-data' }),
      SubscriptionId: 'sc_xyz',
      AccountId: 'user-1',
      Amount: '10',
    };
    const result = await enrichPayloadWithDbLookup(payload);
    expect(result).toBe(payload);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('injects InvoiceId from cpSubscriptionId DB lookup on tokenized recurrent payload', async () => {
    findUnique.mockResolvedValue({ id: 'cmoa61hjs0005923c77s0gvoa' });

    const payload = {
      TransactionId: '3469222281',
      InvoiceId: '',
      SubscriptionId: 'sc_6730d288a76e2e819bef46c36711b',
      AccountId: 'debdf21d-162d-4777-9055-c5b1d5df77d6',
      Amount: '10.00',
    };
    const result = await enrichPayloadWithDbLookup(payload);

    expect(findUnique).toHaveBeenCalledWith({
      where: { cpSubscriptionId: 'sc_6730d288a76e2e819bef46c36711b' },
      select: { id: true },
    });
    expect(result.InvoiceId).toBe('cmoa61hjs0005923c77s0gvoa');
    expect(result.SubscriptionId).toBe('sc_6730d288a76e2e819bef46c36711b');
  });

  it('returns payload unchanged when no Subscription matches cpSubscriptionId', async () => {
    findUnique.mockResolvedValue(null);

    const payload = {
      TransactionId: '1',
      SubscriptionId: 'sc_orphan',
      AccountId: 'user-1',
      Amount: '10',
    };
    const result = await enrichPayloadWithDbLookup(payload);

    expect(result).toBe(payload);
    expect(result.InvoiceId).toBeUndefined();
  });

  it('returns payload unchanged when SubscriptionId is also missing', async () => {
    const payload = {
      TransactionId: '1',
      AccountId: 'user-1',
      Amount: '10',
    };
    const result = await enrichPayloadWithDbLookup(payload);

    expect(result).toBe(payload);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('treats malformed Data JSON as missing and falls back to DB lookup', async () => {
    findUnique.mockResolvedValue({ id: 'cm_resolved' });

    const payload = {
      TransactionId: '1',
      Data: '{not valid json',
      SubscriptionId: 'sc_x',
      AccountId: 'user-1',
      Amount: '10',
    };
    const result = await enrichPayloadWithDbLookup(payload);

    expect(findUnique).toHaveBeenCalled();
    expect(result.InvoiceId).toBe('cm_resolved');
  });
});
