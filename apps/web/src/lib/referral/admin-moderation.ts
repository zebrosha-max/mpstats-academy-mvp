/**
 * Phase 53B: admin moderation of PENDING_REVIEW referrals.
 *
 * Approve → status PENDING_REVIEW → CONVERTED, conversionTrigger='admin_approve',
 * issues ReferralBonusPackage to referrer (PENDING — referrer activates manually).
 * Fires `pa_referral_friend_registered` to referrer (same as i1 auto-flow).
 *
 * Reject → status PENDING_REVIEW → BLOCKED_FRAUD, stores rejectReason + reviewer.
 * No CQ event fires (silent rejection).
 *
 * Bulk variants iterate all PENDING_REVIEW for a single referrer in one call —
 * useful when a single sloppy referrer accumulates many capped referrals.
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { cq } from '@/lib/carrotquest/client';

const PACKAGE_DAYS = 14;

export type AdminModerationError =
  | { code: 'NOT_FOUND' }
  | { code: 'WRONG_STATUS'; current: string }
  | { code: 'NO_REFERRER' };

export interface ApproveResult {
  ok: true;
  referralId: string;
  packageId: string;
}

export interface RejectResult {
  ok: true;
  referralId: string;
}

/**
 * Approve a PENDING_REVIEW referral.
 * Atomic: status update + package creation + audit fields in single transaction.
 * CQ event fires best-effort after commit.
 */
export async function approveReferral(args: {
  referralId: string;
  reviewedByUserId: string;
}): Promise<ApproveResult | AdminModerationError> {
  const referral = await prisma.referral.findUnique({
    where: { id: args.referralId },
    include: { referred: { select: { name: true } } },
  });
  if (!referral) return { code: 'NOT_FOUND' };
  if (referral.status !== 'PENDING_REVIEW') {
    return { code: 'WRONG_STATUS', current: referral.status };
  }
  if (!referral.referrerUserId) return { code: 'NO_REFERRER' };
  const referrerId = referral.referrerUserId;

  const pkg = await prisma.$transaction(async (tx) => {
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        conversionTrigger: 'admin_approve',
        reviewedAt: new Date(),
        reviewedByUserId: args.reviewedByUserId,
      },
    });
    return tx.referralBonusPackage.create({
      data: {
        ownerUserId: referrerId,
        sourceReferralId: referral.id,
        days: PACKAGE_DAYS,
        status: 'PENDING',
      },
    });
  });

  // Best-effort CQ — same shape as i1 auto-flow (issue.ts).
  try {
    await cq.setUserProps(referrerId, {
      pa_referral_friend_name: referral.referred.name ?? '',
      pa_referral_package_days: PACKAGE_DAYS,
    });
    await cq.trackEvent(referrerId, 'pa_referral_friend_registered');
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'referral', stage: 'admin-approve-cq' },
      extra: { referralId: referral.id },
    });
  }

  return { ok: true, referralId: referral.id, packageId: pkg.id };
}

/**
 * Reject a PENDING_REVIEW referral. Sets BLOCKED_FRAUD + audit fields.
 * No CQ event — silent.
 */
export async function rejectReferral(args: {
  referralId: string;
  reviewedByUserId: string;
  reason?: string;
}): Promise<RejectResult | AdminModerationError> {
  const referral = await prisma.referral.findUnique({
    where: { id: args.referralId },
    select: { id: true, status: true },
  });
  if (!referral) return { code: 'NOT_FOUND' };
  if (referral.status !== 'PENDING_REVIEW') {
    return { code: 'WRONG_STATUS', current: referral.status };
  }

  await prisma.referral.update({
    where: { id: referral.id },
    data: {
      status: 'BLOCKED_FRAUD',
      rejectReason: args.reason ?? null,
      reviewedAt: new Date(),
      reviewedByUserId: args.reviewedByUserId,
    },
  });

  return { ok: true, referralId: referral.id };
}

/**
 * Bulk approve all PENDING_REVIEW referrals from a single referrer.
 * Iterates per-referral so each is its own transaction (atomicity per record);
 * one failure does not abort the rest.
 */
export async function bulkApproveByReferrer(args: {
  referrerUserId: string;
  reviewedByUserId: string;
}): Promise<{ approved: number; failed: number }> {
  const pending = await prisma.referral.findMany({
    where: { referrerUserId: args.referrerUserId, status: 'PENDING_REVIEW' },
    select: { id: true },
  });

  let approved = 0;
  let failed = 0;
  for (const r of pending) {
    const result = await approveReferral({
      referralId: r.id,
      reviewedByUserId: args.reviewedByUserId,
    });
    if ('ok' in result) approved += 1;
    else failed += 1;
  }
  return { approved, failed };
}

/**
 * Bulk reject all PENDING_REVIEW referrals from a single referrer.
 * Same reason applied to all.
 */
export async function bulkRejectByReferrer(args: {
  referrerUserId: string;
  reviewedByUserId: string;
  reason?: string;
}): Promise<{ rejected: number; failed: number }> {
  const pending = await prisma.referral.findMany({
    where: { referrerUserId: args.referrerUserId, status: 'PENDING_REVIEW' },
    select: { id: true },
  });

  let rejected = 0;
  let failed = 0;
  for (const r of pending) {
    const result = await rejectReferral({
      referralId: r.id,
      reviewedByUserId: args.reviewedByUserId,
      reason: args.reason,
    });
    if ('ok' in result) rejected += 1;
    else failed += 1;
  }
  return { rejected, failed };
}
