import { describe, it, expect } from 'vitest';

import {
  parseWebhookBody,
  normalizePaymentEvent,
  normalizeRecurrentEvent,
  mapCpRecurrentStatus,
} from '@/lib/cloudpayments/parse-webhook';

describe('parseWebhookBody', () => {
  it('parses application/x-www-form-urlencoded body into object with string values', () => {
    const rawBody =
      'TransactionId=3445404937&Amount=2990.00&Currency=RUB&InvoiceId=sub_abc123&AccountId=user-uuid';

    const result = parseWebhookBody(rawBody);

    expect(result).toEqual({
      TransactionId: '3445404937',
      Amount: '2990.00',
      Currency: 'RUB',
      InvoiceId: 'sub_abc123',
      AccountId: 'user-uuid',
    });
  });

  it('parses JSON body as fallback', () => {
    const rawBody = JSON.stringify({
      TransactionId: 3445404937,
      Amount: 2990,
      InvoiceId: 'sub_abc123',
    });

    const result = parseWebhookBody(rawBody);

    expect(result).toEqual({
      TransactionId: '3445404937',
      Amount: '2990',
      InvoiceId: 'sub_abc123',
    });
  });

  it('returns null for empty body', () => {
    expect(parseWebhookBody('')).toBeNull();
    expect(parseWebhookBody('   ')).toBeNull();
  });
});

describe('normalizePaymentEvent', () => {
  it('extracts fields from a real CP "pay" payload (form-encoded)', () => {
    const raw = parseWebhookBody(
      'TransactionId=3445404937&Amount=2990.00&Currency=RUB&InvoiceId=cmnh6subd001diezar5mnjuu8&AccountId=debdf21d-162d-4777-9055-c5b1d5df77d6&SubscriptionId=sc_fb5496f23442446ea18ca16b2c16b&Status=Completed&DateTime=2026-04-12+11%3A38%3A22',
    )!;

    const result = normalizePaymentEvent(raw);

    expect(result).toEqual({
      cpTransactionId: '3445404937',
      ourSubscriptionId: 'cmnh6subd001diezar5mnjuu8',
      cpSubscriptionId: 'sc_fb5496f23442446ea18ca16b2c16b',
      accountId: 'debdf21d-162d-4777-9055-c5b1d5df77d6',
      amount: 2990,
      paidAt: new Date('2026-04-12T11:38:22'),
    });
  });

  it('cpSubscriptionId is null when SubscriptionId field absent (e.g. one-time payment)', () => {
    const raw = parseWebhookBody(
      'TransactionId=99&Amount=2990&InvoiceId=sub1&AccountId=user1&Status=Completed&DateTime=2026-04-12+11%3A38%3A22',
    )!;

    const result = normalizePaymentEvent(raw);

    expect(result?.cpSubscriptionId).toBeNull();
  });

  it('falls back to ExternalId when InvoiceId is missing', () => {
    const raw = parseWebhookBody(
      'TransactionId=99&Amount=2990&AccountId=user1&ExternalId=our-sub-xyz&Status=Completed&DateTime=2026-04-12+11%3A38%3A22',
    )!;

    const result = normalizePaymentEvent(raw);

    expect(result?.ourSubscriptionId).toBe('our-sub-xyz');
  });

  it('falls back to Data.ourSubscriptionId when both InvoiceId and ExternalId missing', () => {
    const data = encodeURIComponent(JSON.stringify({ ourSubscriptionId: 'sub-from-data' }));
    const raw = parseWebhookBody(
      `TransactionId=99&Amount=2990&AccountId=user1&Data=${data}&Status=Completed&DateTime=2026-04-12+11%3A38%3A22`,
    )!;

    const result = normalizePaymentEvent(raw);

    expect(result?.ourSubscriptionId).toBe('sub-from-data');
  });

  it('returns null when no subscription id can be resolved', () => {
    const raw = parseWebhookBody(
      'TransactionId=99&Amount=2990&AccountId=user1&Status=Completed&DateTime=2026-04-12+11%3A38%3A22',
    )!;

    expect(normalizePaymentEvent(raw)).toBeNull();
  });

  it('returns null when TransactionId is missing', () => {
    const raw = parseWebhookBody(
      'InvoiceId=sub1&Amount=2990&AccountId=user1&Status=Completed&DateTime=2026-04-12+11%3A38%3A22',
    )!;

    expect(normalizePaymentEvent(raw)).toBeNull();
  });

  it('paidAt is null when DateTime is missing or invalid', () => {
    const raw = parseWebhookBody(
      'TransactionId=99&InvoiceId=sub1&Amount=2990&AccountId=user1',
    )!;

    const result = normalizePaymentEvent(raw);

    expect(result?.paidAt).toBeNull();
  });
});

describe('normalizeRecurrentEvent', () => {
  // This is the EXACT payload captured from Sentry issue MAAL-PLATFORM-2
  // (event 7405643262) on 2026-04-12. It crashed Prisma in the original handler.
  const sentryPayload = {
    AccountId: 'debdf21d-162d-4777-9055-c5b1d5df77d6',
    Amount: '2990.00',
    Currency: 'RUB',
    Description: 'Подписка на курс',
    Email: '',
    FailedTransactionsNumber: '1',
    Id: 'sc_fb5496f23442446ea18ca16b2c16b',
    Interval: 'Month',
    Period: '1',
    RequireConfirmation: '0',
    StartDate: '2026-04-12 09:31:05',
    Status: 'Rejected',
    SuccessfulTransactionsNumber: '0',
  };

  it('extracts subscription notification fields from real Sentry payload', () => {
    const result = normalizeRecurrentEvent(sentryPayload);

    expect(result).toEqual({
      cpSubscriptionId: 'sc_fb5496f23442446ea18ca16b2c16b',
      accountId: 'debdf21d-162d-4777-9055-c5b1d5df77d6',
      amount: 2990,
      cpStatus: 'Rejected',
      successCount: 0,
      failCount: 1,
      startDate: new Date('2026-04-12 09:31:05'),
      nextTransactionDate: null,
    });
  });

  it('parses NextTransactionDate when present', () => {
    const result = normalizeRecurrentEvent({
      ...sentryPayload,
      Status: 'Active',
      SuccessfulTransactionsNumber: '1',
      FailedTransactionsNumber: '0',
      NextTransactionDate: '2026-05-12 09:31:05',
    });

    expect(result?.nextTransactionDate).toEqual(new Date('2026-05-12 09:31:05'));
    expect(result?.cpStatus).toBe('Active');
  });

  it('returns null when CP subscription Id is missing', () => {
    const noId = { ...sentryPayload, Id: '' };
    expect(normalizeRecurrentEvent(noId)).toBeNull();
  });

  it('returns null when AccountId is missing', () => {
    const noAccount = { ...sentryPayload, AccountId: '' };
    expect(normalizeRecurrentEvent(noAccount)).toBeNull();
  });
});

describe('mapCpRecurrentStatus', () => {
  it('Active → ACTIVE', () => {
    expect(mapCpRecurrentStatus('Active')).toBe('ACTIVE');
  });

  it('PastDue → PAST_DUE', () => {
    expect(mapCpRecurrentStatus('PastDue')).toBe('PAST_DUE');
  });

  it('Cancelled → CANCELLED', () => {
    expect(mapCpRecurrentStatus('Cancelled')).toBe('CANCELLED');
  });

  it('Rejected → CANCELLED (failed initial payment, treat as cancelled)', () => {
    expect(mapCpRecurrentStatus('Rejected')).toBe('CANCELLED');
  });

  it('Expired → EXPIRED', () => {
    expect(mapCpRecurrentStatus('Expired')).toBe('EXPIRED');
  });
});
