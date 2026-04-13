/**
 * Pure decision logic for handling a CP recurrent (subscription notification)
 * webhook event. Separated from prisma I/O so it can be unit-tested without
 * mocks.
 */
import {
  mapCpRecurrentStatus,
  type NormalizedRecurrentEvent,
  type OurSubscriptionStatus,
} from './parse-webhook';

export interface CurrentSubscriptionState {
  id: string;
  status: OurSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cpSubscriptionId: string | null;
  plan: { intervalDays: number };
}

export interface SubscriptionUpdate {
  status?: OurSubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelledAt?: Date;
  cpSubscriptionId?: string;
}

export function decideRecurrentUpdate(
  event: NormalizedRecurrentEvent,
  sub: CurrentSubscriptionState,
): SubscriptionUpdate {
  const update: SubscriptionUpdate = {};

  // Always capture cpSubscriptionId on first match so we can look up by it next time.
  if (sub.cpSubscriptionId !== event.cpSubscriptionId) {
    update.cpSubscriptionId = event.cpSubscriptionId;
  }

  const newStatus = mapCpRecurrentStatus(event.cpStatus);
  update.status = newStatus;

  if (newStatus === 'CANCELLED' || newStatus === 'EXPIRED') {
    update.cancelledAt = new Date();
  }

  // Extend billing period only for actual successful charges (not subscription
  // creation notifications which arrive with successCount=0).
  if (newStatus === 'ACTIVE' && event.successCount > 0) {
    const newPeriodStart = sub.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);
    newPeriodEnd.setDate(newPeriodEnd.getDate() + sub.plan.intervalDays);
    update.currentPeriodStart = newPeriodStart;
    update.currentPeriodEnd = newPeriodEnd;
  }

  return update;
}
