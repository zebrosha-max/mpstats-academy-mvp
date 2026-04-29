/**
 * Backfill CustomerReceipt template on existing CP subscriptions.
 *
 * Why this script exists: subscriptions created before the receipt fix went
 * live were registered in CP with `recurrent.receipt = null`. CP keeps that
 * template forever and fires every auto-charge with `CustomerReceipt: null`
 * — exactly what CP support flagged on operations 3477150564 / 3479149166.
 * Patching the widget alone does NOT fix existing subscriptions; we have to
 * call POST /subscriptions/update with a fresh receipt for each one.
 *
 * Run modes:
 *   npx tsx scripts/cloudpayments/backfill-receipts.ts            # dry-run
 *   npx tsx scripts/cloudpayments/backfill-receipts.ts --apply    # actually call CP
 *
 * DO NOT RUN ON PROD until:
 *   1. Accountant confirms taxation/vat/method/object constants in
 *      packages/shared/src/cloudpayments/receipt.ts
 *   2. Boevye CP keys are live (Phase 28). Test keys reject /subscriptions/update.
 *   3. Receipt fix has been smoke-tested on staging.
 */

import { PrismaClient } from '@prisma/client';
import { buildReceipt, type CustomerReceipt } from '@mpstats/shared';

const prisma = new PrismaClient();

const CP_UPDATE_URL = 'https://api.cloudpayments.ru/subscriptions/update';

interface CPUpdateResponse {
  Success: boolean;
  Message?: string;
  Model?: unknown;
}

async function callCpUpdate(
  cpSubscriptionId: string,
  receipt: CustomerReceipt,
): Promise<CPUpdateResponse> {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;
  if (!publicId || !apiSecret) {
    throw new Error('CLOUDPAYMENTS_PUBLIC_ID / CLOUDPAYMENTS_API_SECRET required');
  }
  const credentials = Buffer.from(`${publicId}:${apiSecret}`).toString('base64');

  const response = await fetch(CP_UPDATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      Id: cpSubscriptionId,
      CustomerReceipt: receipt,
    }),
  });

  if (!response.ok) {
    throw new Error(`CP HTTP ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as CPUpdateResponse;
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`[backfill-receipts] mode: ${apply ? 'APPLY (real CP calls)' : 'DRY-RUN'}`);

  const subs = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      cpSubscriptionId: { not: null },
    },
    include: {
      plan: true,
      course: { select: { title: true } },
      user: { select: { id: true } },
    },
  });

  console.log(`[backfill-receipts] found ${subs.length} active subscriptions to patch`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subs) {
    const userEmail = await fetchAuthEmail(sub.user.id);
    if (!sub.cpSubscriptionId) {
      skipped++;
      continue;
    }

    const receipt = buildReceipt({
      plan: { type: sub.plan.type, intervalDays: sub.plan.intervalDays },
      user: { email: userEmail },
      amount: sub.plan.price,
      courseTitle: sub.course?.title,
    });

    if (!apply) {
      console.log(
        `  [DRY] ${sub.id} cp=${sub.cpSubscriptionId} email=${userEmail ?? '∅'} label="${receipt.items[0].label.slice(0, 60)}…"`,
      );
      ok++;
      continue;
    }

    try {
      const res = await callCpUpdate(sub.cpSubscriptionId, receipt);
      if (res.Success) {
        console.log(`  [OK]  ${sub.id} cp=${sub.cpSubscriptionId}`);
        ok++;
      } else {
        console.error(`  [ERR] ${sub.id} cp=${sub.cpSubscriptionId} message="${res.Message}"`);
        failed++;
      }
    } catch (err) {
      console.error(
        `  [ERR] ${sub.id} cp=${sub.cpSubscriptionId} ${err instanceof Error ? err.message : err}`,
      );
      failed++;
    }
  }

  console.log(`[backfill-receipts] done: ok=${ok} skipped=${skipped} failed=${failed}`);
}

async function fetchAuthEmail(userId: string): Promise<string | undefined> {
  const rows = await prisma.$queryRawUnsafe<Array<{ email: string | null }>>(
    'SELECT email FROM auth.users WHERE id::text = $1 LIMIT 1',
    userId,
  );
  return rows[0]?.email ?? undefined;
}

main()
  .catch((err) => {
    console.error('[backfill-receipts] fatal:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
