import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { isFeatureEnabled } from '../utils/feature-flags';

/**
 * Billing tRPC router — 6 endpoints for subscription management.
 * All endpoints gated by billing_enabled feature flag.
 */
export const billingRouter = router({
  /**
   * Check if billing feature is enabled.
   * Public — used by frontend to conditionally show pricing UI.
   */
  isEnabled: publicProcedure.query(async () => {
    return isFeatureEnabled('billing_enabled');
  }),

  /**
   * Get all active subscription plans.
   * Public — pricing page is visible to everyone.
   */
  getPlans: publicProcedure.query(async ({ ctx }) => {
    const enabled = await isFeatureEnabled('billing_enabled');
    if (!enabled) return [];

    return ctx.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }),

  /**
   * Get current user's subscription (most recent non-expired).
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const enabled = await isFeatureEnabled('billing_enabled');
    if (!enabled) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing is not enabled' });
    }

    return ctx.prisma.subscription.findFirst({
      where: {
        userId: ctx.user.id,
        status: { in: ['ACTIVE', 'PAST_DUE', 'CANCELLED', 'PENDING'] },
      },
      include: { plan: true, course: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * Initiate payment: create PENDING subscription + payment record.
   * Frontend then opens CloudPayments widget with returned data.
   */
  initiatePayment: protectedProcedure
    .input(
      z.object({
        planType: z.enum(['COURSE', 'PLATFORM']),
        courseId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const enabled = await isFeatureEnabled('billing_enabled');
      if (!enabled) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing is not enabled' });
      }

      // Validate courseId requirements
      if (input.planType === 'COURSE' && !input.courseId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'courseId is required for COURSE plan',
        });
      }
      if (input.planType === 'PLATFORM' && input.courseId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'courseId must not be provided for PLATFORM plan',
        });
      }

      // Find plan
      const plan = await ctx.prisma.subscriptionPlan.findUnique({
        where: { type: input.planType },
      });
      if (!plan || !plan.isActive) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found or inactive' });
      }

      // Verify course exists if COURSE plan
      if (input.planType === 'COURSE' && input.courseId) {
        const course = await ctx.prisma.course.findUnique({
          where: { id: input.courseId },
        });
        if (!course) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Course not found' });
        }
      }

      // Check for existing ACTIVE/PENDING subscription of same type for same course
      const existing = await ctx.prisma.subscription.findFirst({
        where: {
          userId: ctx.user.id,
          status: { in: ['ACTIVE', 'PENDING'] },
          plan: { type: input.planType },
          ...(input.courseId ? { courseId: input.courseId } : { courseId: null }),
        },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have an active or pending subscription for this plan',
        });
      }

      const now = new Date();

      // Create PENDING subscription
      const subscription = await ctx.prisma.subscription.create({
        data: {
          userId: ctx.user.id,
          planId: plan.id,
          courseId: input.courseId ?? null,
          status: 'PENDING',
          currentPeriodStart: now,
          currentPeriodEnd: now, // Will be set properly by webhook on payment success
        },
      });

      // Create PENDING payment
      await ctx.prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          amount: plan.price,
          status: 'PENDING',
        },
      });

      return {
        subscriptionId: subscription.id,
        amount: plan.price,
        planName: plan.name,
        description: plan.name,
      };
    }),

  /**
   * Get payment history for current user (excludes PENDING payments).
   */
  getPaymentHistory: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(20).default(10),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const enabled = await isFeatureEnabled('billing_enabled');
      if (!enabled) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing is not enabled' });
      }

      const limit = input?.limit ?? 10;

      return ctx.prisma.payment.findMany({
        where: {
          subscription: { userId: ctx.user.id },
          status: { not: 'PENDING' },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      });
    }),

  /**
   * Cancel active subscription.
   * Calls CloudPayments API, then marks subscription as CANCELLED.
   */
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const enabled = await isFeatureEnabled('billing_enabled');
    if (!enabled) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing is not enabled' });
    }

    // Find active subscription
    const subscription = await ctx.prisma.subscription.findFirst({
      where: {
        userId: ctx.user.id,
        status: 'ACTIVE',
      },
    });
    if (!subscription) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No active subscription found',
      });
    }

    // Call CloudPayments cancel API (inline to avoid cross-package import)
    const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
    const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;

    if (!publicId || !apiSecret) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Payment provider not configured',
      });
    }

    const credentials = Buffer.from(`${publicId}:${apiSecret}`).toString('base64');

    try {
      const response = await fetch('https://api.cloudpayments.ru/subscriptions/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({ Id: subscription.id }),
      });

      if (!response.ok) {
        throw new Error(`CP API returned ${response.status}`);
      }

      const data = (await response.json()) as { Success: boolean; Message?: string };

      if (!data.Success) {
        throw new Error(data.Message ?? 'CloudPayments cancel failed');
      }
    } catch (error) {
      console.error('CloudPayments cancel error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to cancel subscription with payment provider',
      });
    }

    // Update subscription status (idempotent — webhook will also arrive)
    const updated = await ctx.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return {
      success: true,
      accessUntil: updated.currentPeriodEnd,
    };
  }),
});
