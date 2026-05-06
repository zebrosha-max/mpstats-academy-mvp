/**
 * Referral issuance orchestrator (Phase 53A).
 *
 * Called from /auth/confirm and Yandex callback after DOI/OAuth success.
 * Handles entire flow:
 *   1. Resolve referrer by code
 *   2. Run anti-fraud checks
 *   3. Read mode flag (i1 default, i2 if referral_pay_gated=true)
 *   4. Create Referral row
 *   5. Issue Package (i1 only — i2 issues on payment via webhook)
 *   6. Always create Trial Subscription for friend (14d in i1, 7d in i2)
 *
 * All in single transaction. Fire-and-forget Sentry on errors.
 */

import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { isFeatureEnabled, createTrialSubscription } from '@mpstats/api';
import { checkFraudSignals } from './fraud-checks';
import { cq } from '@/lib/carrotquest/client';

const I1_TRIAL_DAYS = 14;
const I2_TRIAL_DAYS = 7;
const PACKAGE_DAYS = 14;

/** "DD.MM.YYYY HH:MM" в МСК — формат Phase 33 для CQ-шаблонов. */
function formatDateRu(date: Date): string {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

export interface IssueArgs {
  refCode: string;
  friendUserId: string;
}

export async function issueReferralOnSignup(args: IssueArgs): Promise<void> {
  try {
    // 1) Resolve referrer
    const referrer = await prisma.userProfile.findUnique({
      where: { referralCode: args.refCode },
      select: { id: true, name: true },
    });
    if (!referrer) {
      Sentry.captureMessage('referral.unknown_code', {
        level: 'info',
        extra: { refCode: args.refCode, friendUserId: args.friendUserId },
      });
      return;
    }

    // 2) Mode flag
    const i2Mode = await isFeatureEnabled('referral_pay_gated');

    // 3) Anti-fraud
    const fraud = await checkFraudSignals({
      referrerId: referrer.id,
      friendId: args.friendUserId,
    });

    const trialDays = i2Mode ? I2_TRIAL_DAYS : I1_TRIAL_DAYS;

    let referralStatus: 'CONVERTED' | 'PENDING' | 'BLOCKED_SELF_REF' | 'PENDING_REVIEW';
    let issuePackage = false;

    if (fraud.verdict === 'BLOCKED_SELF_REF') {
      referralStatus = 'BLOCKED_SELF_REF';
      Sentry.captureMessage('referral.fraud_signal', {
        level: 'info',
        tags: { kind: 'self_ref' },
        extra: { referrerId: referrer.id, friendId: args.friendUserId },
      });
    } else if (fraud.verdict === 'PENDING_REVIEW') {
      referralStatus = 'PENDING_REVIEW';
      Sentry.captureMessage('referral.fraud_signal', {
        level: 'info',
        tags: { kind: 'cap_reached' },
        extra: { referrerId: referrer.id, friendId: args.friendUserId },
      });
    } else {
      referralStatus = i2Mode ? 'PENDING' : 'CONVERTED';
      issuePackage = !i2Mode;
    }

    // 4) Transaction
    await prisma.$transaction(async (tx: any) => {
      const referral = await tx.referral.create({
        data: {
          code: args.refCode,
          codeType: 'EXTERNAL_USER',
          referrerUserId: referrer.id,
          referredUserId: args.friendUserId,
          status: referralStatus,
          conversionTrigger: !i2Mode && referralStatus === 'CONVERTED' ? 'registration' : null,
          convertedAt: !i2Mode && referralStatus === 'CONVERTED' ? new Date() : null,
        },
      });

      if (issuePackage) {
        await tx.referralBonusPackage.create({
          data: {
            ownerUserId: referrer.id,
            sourceReferralId: referral.id,
            days: PACKAGE_DAYS,
            status: 'PENDING',
          },
        });
      }

      await createTrialSubscription({
        userId: args.friendUserId,
        durationDays: trialDays,
        prismaClient: tx,
      });
    });

    // 5) CQ events (best-effort) — setUserProps before trackEvent so email
    // templates can render trial duration / friend name (Phase 33 pattern).
    try {
      const friend = await prisma.userProfile.findUnique({
        where: { id: args.friendUserId },
        select: { name: true },
      });
      const trialUntil = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

      await cq.setUserProps(args.friendUserId, {
        pa_referral_trial_days: trialDays,
        pa_referral_trial_until: formatDateRu(trialUntil),
        pa_referral_trial_until_tech: trialUntil.toISOString(),
        pa_referral_referrer_name: referrer.name ?? '',
      });
      await cq.trackEvent(args.friendUserId, 'pa_referral_trial_started');

      if (issuePackage) {
        await cq.setUserProps(referrer.id, {
          pa_referral_friend_name: friend?.name ?? '',
          pa_referral_package_days: PACKAGE_DAYS,
        });
        await cq.trackEvent(referrer.id, 'pa_referral_friend_registered');
      }
    } catch (cqError) {
      Sentry.captureException(cqError, {
        tags: { area: 'referral', stage: 'cq' },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'referral', stage: 'issue-on-signup' },
      extra: { refCode: args.refCode, friendUserId: args.friendUserId },
    });
  }
}
