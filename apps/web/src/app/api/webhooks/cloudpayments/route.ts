import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@mpstats/db/client';
import { verifyCloudPaymentsHmac } from '@/lib/cloudpayments/hmac';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
  handleCancellation,
  handleRecurrentPayment,
  handleCheck,
} from '@/lib/cloudpayments/subscription-service';
import type {
  CloudPaymentsWebhookPayload,
  CloudPaymentsEventType,
  CloudPaymentsResponse,
} from '@/lib/cloudpayments/types';

export const dynamic = 'force-dynamic';

/** CloudPayments success response */
const OK: CloudPaymentsResponse = { code: 0 };
/** CloudPayments rejection response */
const REJECT: CloudPaymentsResponse = { code: 13 };

/**
 * Determine event type from URL query param (?type=pay) or from payload fields.
 * CloudPayments sends webhooks to separate URLs per event type.
 * We use a single catch-all route with a query parameter.
 */
function resolveEventType(
  url: string,
  payload: CloudPaymentsWebhookPayload,
): CloudPaymentsEventType {
  // Prefer explicit query param: /api/webhooks/cloudpayments?type=pay
  try {
    const searchParams = new URL(url).searchParams;
    const typeParam = searchParams.get('type');
    if (
      typeParam &&
      ['check', 'pay', 'fail', 'refund', 'cancel', 'recurrent'].includes(
        typeParam,
      )
    ) {
      return typeParam as CloudPaymentsEventType;
    }
  } catch {
    // URL parsing failed, fallback to payload inspection
  }

  // Fallback: infer from payload fields
  if (payload.Token && payload.Interval) return 'recurrent';
  if (payload.OperationType === 'Refund') return 'refund';
  if (payload.Status === 'Completed') return 'pay';
  if (payload.Status === 'Declined') return 'fail';

  return 'check';
}

/**
 * Map CloudPayments event type to our PaymentStatus enum.
 */
function mapEventToPaymentStatus(
  eventType: CloudPaymentsEventType,
): 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' {
  switch (eventType) {
    case 'pay':
    case 'recurrent':
      return 'COMPLETED';
    case 'fail':
    case 'cancel':
      return 'FAILED';
    case 'refund':
      return 'REFUNDED';
    case 'check':
    default:
      return 'PENDING';
  }
}

export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    console.error('[CloudPayments] Failed to read request body');
    return NextResponse.json(REJECT, { status: 400 });
  }

  // --- HMAC verification ---
  const hmacHeader = request.headers.get('Content-HMAC') ?? '';
  if (!verifyCloudPaymentsHmac(rawBody, hmacHeader)) {
    const ip =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('x-real-ip') ??
      'unknown';
    console.warn(
      `[CloudPayments] Invalid HMAC signature from IP: ${ip}`,
    );
    return NextResponse.json(REJECT, { status: 403 });
  }

  // --- Parse payload ---
  let payload: CloudPaymentsWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CloudPaymentsWebhookPayload;
  } catch {
    console.error('[CloudPayments] Invalid JSON payload');
    return NextResponse.json(REJECT, { status: 400 });
  }

  const eventType = resolveEventType(request.url, payload);
  const txId = String(payload.TransactionId);

  console.log(
    `[CloudPayments] ${eventType} for subscription ${payload.InvoiceId}, tx ${payload.TransactionId}`,
  );

  try {
    // --- Check event: pre-payment validation (no Payment record created) ---
    if (eventType === 'check') {
      const accepted = await handleCheck(
        payload.AccountId,
        payload.InvoiceId,
      );
      if (!accepted) {
        return NextResponse.json(REJECT);
      }
      return NextResponse.json(OK);
    }

    // --- Idempotency check ---
    const existing = await prisma.payment.findUnique({
      where: { cloudPaymentsTxId: txId },
    });

    let paymentId: string;

    if (existing && existing.status === 'COMPLETED' && eventType === 'pay') {
      // Duplicate successful payment -- log event for audit but skip update
      console.info(
        `[CloudPayments] Duplicate pay event for txId=${txId}, skipping update`,
      );
      paymentId = existing.id;
    } else {
      // --- Payment upsert ---
      const status = mapEventToPaymentStatus(eventType);
      const paidAt =
        status === 'COMPLETED' ? new Date(payload.DateTime) : undefined;

      const payment = await prisma.payment.upsert({
        where: { cloudPaymentsTxId: txId },
        create: {
          subscriptionId: payload.InvoiceId,
          amount: Math.round(payload.Amount),
          status,
          cloudPaymentsTxId: txId,
          paidAt: paidAt ?? null,
        },
        update: {
          status,
          ...(paidAt ? { paidAt } : {}),
        },
      });

      paymentId = payment.id;
    }

    // --- Audit log: always create PaymentEvent ---
    await prisma.paymentEvent.create({
      data: {
        paymentId,
        type: eventType,
        payload: JSON.parse(rawBody),
      },
    });

    // --- Subscription lifecycle dispatch ---
    switch (eventType) {
      case 'pay':
        await handlePaymentSuccess(payload.InvoiceId, {
          id: paymentId,
          amount: payload.Amount,
        });
        break;
      case 'fail':
        await handlePaymentFailure(payload.InvoiceId);
        break;
      case 'recurrent':
        await handleRecurrentPayment(payload.InvoiceId, {
          id: paymentId,
          amount: payload.Amount,
        });
        break;
      case 'cancel':
        await handleCancellation(payload.InvoiceId);
        break;
      case 'refund':
        // Payment status already set to REFUNDED in upsert. No subscription change needed.
        break;
    }

    return NextResponse.json(OK);
  } catch (error) {
    // Accept webhook to prevent CloudPayments retries, but log for investigation
    console.error('[CloudPayments] Webhook processing error:', error);
    return NextResponse.json(OK);
  }
}
