import { describe, it, expect } from 'vitest';

import { buildReceipt, buildLabel } from '@mpstats/shared';

describe('buildLabel', () => {
  it('PLATFORM plan: composes "online platform" wording with intervalDays', () => {
    const label = buildLabel({
      plan: { type: 'PLATFORM', intervalDays: 30 },
      user: { email: 'u@x.ru' },
      amount: 2990,
    });
    expect(label).toBe(
      'Доступ к онлайн-платформе MPSTATS Academy на условиях подписки, 30 дней',
    );
  });

  it('COURSE plan with title: quotes the course title', () => {
    const label = buildLabel({
      plan: { type: 'COURSE', intervalDays: 30 },
      user: { email: 'u@x.ru' },
      amount: 1990,
      courseTitle: 'Аналитика',
    });
    expect(label).toBe(
      'Доступ к онлайн-курсу "Аналитика" на платформе MPSTATS Academy на условиях подписки, 30 дней',
    );
  });

  it('COURSE plan without title: drops the quoted clause cleanly', () => {
    const label = buildLabel({
      plan: { type: 'COURSE', intervalDays: 30 },
      user: { email: 'u@x.ru' },
      amount: 1990,
    });
    expect(label).toBe(
      'Доступ к онлайн-курсу на платформе MPSTATS Academy на условиях подписки, 30 дней',
    );
  });

  it('labelOverride wins over both PLATFORM and COURSE wording', () => {
    const label = buildLabel({
      plan: { type: 'PLATFORM', intervalDays: 1 },
      user: {},
      amount: 10,
      labelOverride: 'Тестовая операция, 1 день',
    });
    expect(label).toBe('Тестовая операция, 1 день');
  });

  it('truncates labels longer than 128 chars with ellipsis', () => {
    const longTitle = 'X'.repeat(200);
    const label = buildLabel({
      plan: { type: 'COURSE', intervalDays: 30 },
      user: {},
      amount: 1990,
      courseTitle: longTitle,
    });
    expect(label.length).toBeLessThanOrEqual(128);
    expect(label.endsWith('…')).toBe(true);
  });
});

describe('buildReceipt', () => {
  it('PLATFORM, 30 days, 2990₽: assembles a complete receipt', () => {
    const receipt = buildReceipt({
      plan: { type: 'PLATFORM', intervalDays: 30 },
      user: { email: 'user@x.ru' },
      amount: 2990,
    });
    expect(receipt).toEqual({
      items: [
        {
          label:
            'Доступ к онлайн-платформе MPSTATS Academy на условиях подписки, 30 дней',
          price: 2990,
          quantity: 1,
          amount: 2990,
          vat: 22,
          method: 4,
          object: 13,
        },
      ],
      taxationSystem: 0,
      email: 'user@x.ru',
      amounts: { electronic: 2990 },
    });
  });

  it('omits email when user has none', () => {
    const receipt = buildReceipt({
      plan: { type: 'PLATFORM', intervalDays: 30 },
      user: {},
      amount: 2990,
    });
    expect(receipt.email).toBeUndefined();
  });

  it('omits email when user.email is null', () => {
    const receipt = buildReceipt({
      plan: { type: 'PLATFORM', intervalDays: 30 },
      user: { email: null },
      amount: 2990,
    });
    expect(receipt.email).toBeUndefined();
  });

  it('rounds fractional amounts to 2 decimals across price/amount/electronic', () => {
    const receipt = buildReceipt({
      plan: { type: 'PLATFORM', intervalDays: 30 },
      user: { email: 'u@x.ru' },
      amount: 2990.005,
    });
    expect(receipt.items[0].price).toBe(2990.01);
    expect(receipt.items[0].amount).toBe(2990.01);
    expect(receipt.amounts?.electronic).toBe(2990.01);
  });

  it('TEST plan via labelOverride keeps numeric fields intact', () => {
    const receipt = buildReceipt({
      plan: { type: 'PLATFORM', intervalDays: 1 },
      user: { email: 'admin@x.ru' },
      amount: 10,
      labelOverride: 'Тестовая операция — доступ к онлайн-платформе MPSTATS Academy, 1 день',
    });
    expect(receipt.items[0].label).toContain('Тестовая операция');
    expect(receipt.items[0].amount).toBe(10);
    expect(receipt.amounts?.electronic).toBe(10);
  });
});
