/**
 * Pure parsers/normalizers for CloudPayments webhook payloads.
 *
 * Kept separate from the route handler so they can be unit-tested without
 * mocking Next.js, Prisma, or Sentry. The route handler only orchestrates
 * I/O around these functions.
 */

export type RawWebhookPayload = Record<string, string>;

/**
 * Parse a CloudPayments webhook body. CP sends application/x-www-form-urlencoded
 * by default, but JSON has been observed in some flows, so we try both.
 *
 * Returns null when the body is empty or unparseable so the caller can REJECT
 * cleanly without crashing.
 */
export function parseWebhookBody(rawBody: string): RawWebhookPayload | null {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const obj: RawWebhookPayload = {};
      for (const [key, value] of Object.entries(parsed)) {
        obj[key] = String(value);
      }
      return obj;
    } catch {
      // fall through to form parser
    }
  }

  const params = new URLSearchParams(rawBody);
  const obj: RawWebhookPayload = {};
  for (const [key, value] of params.entries()) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Normalized payment-style event (check/pay/fail/refund/cancel).
 *
 * `ourSubscriptionId` is our internal Subscription.id. CloudPayments delivers
 * it under different field names depending on widget API version:
 *   - Legacy widget: `InvoiceId`
 *   - New widget (`widget.start`): `ExternalId`
 *   - Defensive fallback: `Data` JSON with `ourSubscriptionId` key
 */
export interface NormalizedPaymentEvent {
  cpTransactionId: string;
  ourSubscriptionId: string;
  /**
   * CP-side subscription id (`sc_xxx`). Present in pay/fail webhooks for
   * subscription-based charges. Captured here so we can save it to our
   * Subscription row immediately on the first pay event, instead of waiting
   * for the first recurrent notification — this gives recurrent webhooks a
   * deterministic lookup key from the very first cycle.
   */
  cpSubscriptionId: string | null;
  accountId: string;
  amount: number;
  paidAt: Date | null;
}

function resolveOurSubscriptionId(
  payload: RawWebhookPayload,
): string | null {
  if (payload.InvoiceId) return payload.InvoiceId;
  if (payload.ExternalId) return payload.ExternalId;
  if (payload.Data) {
    try {
      const data = JSON.parse(payload.Data) as { ourSubscriptionId?: unknown };
      if (typeof data.ourSubscriptionId === 'string' && data.ourSubscriptionId) {
        return data.ourSubscriptionId;
      }
    } catch {
      // ignore — Data may not be JSON
    }
  }
  return null;
}

function parseDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizePaymentEvent(
  payload: RawWebhookPayload,
): NormalizedPaymentEvent | null {
  if (!payload.TransactionId) return null;

  const ourSubscriptionId = resolveOurSubscriptionId(payload);
  if (!ourSubscriptionId) return null;

  const amount = Number(payload.Amount);
  if (!Number.isFinite(amount)) return null;

  return {
    cpTransactionId: payload.TransactionId,
    ourSubscriptionId,
    cpSubscriptionId: payload.SubscriptionId || null,
    accountId: payload.AccountId ?? '',
    amount,
    paidAt: parseDateTime(payload.DateTime),
  };
}

/**
 * CP-side subscription status as delivered in recurrent webhook notifications.
 * Source: https://developers.cloudpayments.ru/#uvedomlenie-recurrent
 */
export type CpRecurrentStatus =
  | 'Active'
  | 'PastDue'
  | 'Cancelled'
  | 'Rejected'
  | 'Expired';

/**
 * Normalized "recurrent" webhook event.
 *
 * Important: CP's recurrent webhook is a SUBSCRIPTION NOTIFICATION, not a
 * payment event. It uses an entirely different schema:
 *   - `Id` is the CP subscription ID (format `sc_...`), NOT a transaction ID
 *   - There is no `TransactionId`, `InvoiceId`, or `DateTime`
 *   - `Status` describes the subscription state, not a single payment
 */
export interface NormalizedRecurrentEvent {
  cpSubscriptionId: string;
  accountId: string;
  amount: number;
  cpStatus: CpRecurrentStatus;
  successCount: number;
  failCount: number;
  startDate: Date | null;
  nextTransactionDate: Date | null;
}

export function normalizeRecurrentEvent(
  payload: RawWebhookPayload,
): NormalizedRecurrentEvent | null {
  if (!payload.Id) return null;
  if (!payload.AccountId) return null;

  const amount = Number(payload.Amount);
  if (!Number.isFinite(amount)) return null;

  return {
    cpSubscriptionId: payload.Id,
    accountId: payload.AccountId,
    amount,
    cpStatus: (payload.Status ?? 'Active') as CpRecurrentStatus,
    successCount: Number(payload.SuccessfulTransactionsNumber ?? 0) || 0,
    failCount: Number(payload.FailedTransactionsNumber ?? 0) || 0,
    startDate: parseDateTime(payload.StartDate),
    nextTransactionDate: parseDateTime(payload.NextTransactionDate),
  };
}

export type OurSubscriptionStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'EXPIRED';

/**
 * Map a CP subscription status to our internal SubscriptionStatus.
 * `Rejected` means the very first charge failed, so the subscription never
 * activated — we treat it as `CANCELLED` rather than `PAST_DUE` because there
 * is nothing to retry.
 */
export function mapCpRecurrentStatus(
  status: CpRecurrentStatus,
): OurSubscriptionStatus {
  switch (status) {
    case 'Active':
      return 'ACTIVE';
    case 'PastDue':
      return 'PAST_DUE';
    case 'Cancelled':
    case 'Rejected':
      return 'CANCELLED';
    case 'Expired':
      return 'EXPIRED';
  }
}
