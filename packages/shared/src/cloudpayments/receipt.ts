import type { CustomerReceipt } from './types';

/**
 * Receipt config — the only place where 54-FZ / ФФД values live.
 * Confirmed by the accountant for ООО «МПСТАТС ПРОДВИЖЕНИЕ» / kassa 1992320030103085.
 *
 *   ОСНО                       → taxationSystem = 0
 *   НДС 22% (включён в цену)   → vat = 22
 *   полный расчёт              → method = 4
 *   ФФД 1.2, предмет «подписка»→ object = 13
 */
const TAXATION_SYSTEM = 0;
const VAT_CODE: number | null = 22;
const PAYMENT_METHOD = 4;
const PAYMENT_OBJECT = 13;

const MAX_LABEL_LENGTH = 128;

export interface ReceiptPlanInput {
  type: 'COURSE' | 'PLATFORM';
  intervalDays: number;
}

export interface ReceiptUserInput {
  email?: string | null;
}

export interface BuildReceiptOptions {
  plan: ReceiptPlanInput;
  user: ReceiptUserInput;
  amount: number;
  /** Course title for COURSE plans; ignored for PLATFORM/TEST */
  courseTitle?: string;
  /** Override label entirely (used by hidden TEST plans) */
  labelOverride?: string;
}

function truncateLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label;
  return label.slice(0, MAX_LABEL_LENGTH - 1) + '…';
}

export function buildLabel(opts: BuildReceiptOptions): string {
  if (opts.labelOverride) return truncateLabel(opts.labelOverride);

  const days = opts.plan.intervalDays;
  if (opts.plan.type === 'COURSE') {
    const title = opts.courseTitle?.trim();
    const courseClause = title ? `"${title}" ` : '';
    return truncateLabel(
      `Доступ к онлайн-курсу ${courseClause}на платформе MPSTATS Academy на условиях подписки, ${days} дней`,
    );
  }

  return truncateLabel(
    `Доступ к онлайн-платформе MPSTATS Academy на условиях подписки, ${days} дней`,
  );
}

export function buildReceipt(opts: BuildReceiptOptions): CustomerReceipt {
  const label = buildLabel(opts);
  const amount = Number(opts.amount.toFixed(2));

  const receipt: CustomerReceipt = {
    items: [
      {
        label,
        price: amount,
        quantity: 1,
        amount,
        vat: VAT_CODE,
        method: PAYMENT_METHOD,
        object: PAYMENT_OBJECT,
      },
    ],
    taxationSystem: TAXATION_SYSTEM,
    amounts: { electronic: amount },
  };

  if (opts.user.email) receipt.email = opts.user.email;

  return receipt;
}
