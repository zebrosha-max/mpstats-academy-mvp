/**
 * Referral package activation logic (Phase 53A).
 *
 * Atomic: lookup package + sub, decide extend/create, mark package USED.
 *
 * If user has active or trial subscription with currentPeriodEnd > now → extend.
 * Otherwise → create fresh TRIAL on PLATFORM tier with N days.
 */

import { prisma } from '@mpstats/db/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export class PackageActivationError extends Error {
  code: 'NOT_FOUND' | 'NOT_OWNER' | 'NOT_PENDING';
  constructor(code: 'NOT_FOUND' | 'NOT_OWNER' | 'NOT_PENDING', message: string) {
    super(message);
    this.code = code;
  }
}

export async function activatePackage(packageId: string, userId: string): Promise<void> {
  await prisma.$transaction(async (tx: any) => {
    const pkg = await tx.referralBonusPackage.findUnique({
      where: { id: packageId },
    });

    if (!pkg) {
      throw new PackageActivationError('NOT_FOUND', 'Package not found');
    }
    if (pkg.ownerUserId !== userId) {
      throw new PackageActivationError('NOT_OWNER', 'Package owner mismatch');
    }
    if (pkg.status !== 'PENDING') {
      throw new PackageActivationError('NOT_PENDING', 'Package already used or revoked');
    }

    const now = new Date();
    const sub = await tx.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIAL'] },
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    if (sub) {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodEnd: new Date(sub.currentPeriodEnd.getTime() + pkg.days * DAY_MS),
        },
      });
    } else {
      const platformPlan = await tx.subscriptionPlan.findFirst({
        where: { type: 'PLATFORM', isActive: true },
        select: { id: true },
      });
      if (!platformPlan) {
        throw new Error('No active PLATFORM SubscriptionPlan found');
      }
      await tx.subscription.create({
        data: {
          userId,
          planId: platformPlan.id,
          courseId: null,
          status: 'TRIAL',
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + pkg.days * DAY_MS),
        },
      });
    }

    await tx.referralBonusPackage.update({
      where: { id: packageId },
      data: { status: 'USED', usedAt: now },
    });
  });
}
