/**
 * Referral conversion (Phase 53A, i2 mode).
 *
 * Called from CP webhook `pay` handler after a successful subscription creation.
 * Looks up Referral { referredUserId=userId, status='PENDING' } and:
 *  - Marks Referral.status='CONVERTED', convertedAt=now, conversionTrigger='payment'
 *  - Issues ReferralBonusPackage to referrer
 *  - Emits CQ event pa_referral_friend_paid
 *
 * Idempotent — re-running on already CONVERTED Referral is no-op (status filter).
 * In i1 mode the Referral is CONVERTED at signup, so the status filter short-circuits.
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { cq } from '@/lib/carrotquest/client';

const PACKAGE_DAYS = 14;

export async function processReferralConversion(payingUserId: string): Promise<void> {
  const referral = await prisma.referral.findUnique({
    where: { referredUserId: payingUserId },
  });

  // No referral, already CONVERTED (i1 mode or duplicate), or no referrer — skip.
  if (!referral || referral.status !== 'PENDING' || !referral.referrerUserId) {
    return;
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        conversionTrigger: 'payment',
      },
    });
    await tx.referralBonusPackage.create({
      data: {
        ownerUserId: referral.referrerUserId!,
        sourceReferralId: referral.id,
        days: PACKAGE_DAYS,
        status: 'PENDING',
      },
    });
  });

  try {
    const friend = await prisma.userProfile.findUnique({
      where: { id: referral.referredUserId },
      select: { name: true },
    });
    await cq.setUserProps(referral.referrerUserId, {
      pa_referral_friend_name: friend?.name ?? '',
      pa_referral_package_days: PACKAGE_DAYS,
    });
    await cq.trackEvent(referral.referrerUserId, 'pa_referral_friend_paid');
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'referral', stage: 'cq-friend-paid' },
    });
  }
}
