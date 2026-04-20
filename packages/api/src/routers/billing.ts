import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure, superadminProcedure } from '../trpc';
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
   * Get courses list for pricing dropdown (public — no auth required).
   * Returns only id + title, no progress data.
   */
  getCourses: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.course.findMany({
      where: { isHidden: false },
      select: { id: true, title: true },
      orderBy: { order: 'asc' },
    });
  }),

  /**
   * Get all active subscription plans.
   * Public — pricing page is visible to everyone.
   */
  getPlans: publicProcedure.query(async ({ ctx }) => {
    const enabled = await isFeatureEnabled('billing_enabled');
    if (!enabled) return [];

    return ctx.prisma.subscriptionPlan.findMany({
      where: { isActive: true, hidden: false },
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

      // Find public plan of requested type. With @unique dropped from
      // SubscriptionPlan.type to allow hidden test plans, the public plan
      // must be resolved by filtering hidden:false explicitly.
      const plan = await ctx.prisma.subscriptionPlan.findFirst({
        where: { type: input.planType, hidden: false, isActive: true },
      });
      if (!plan) {
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

      // Check for existing subscription of same type for same course
      const existing = await ctx.prisma.subscription.findFirst({
        where: {
          userId: ctx.user.id,
          status: { in: ['ACTIVE', 'PENDING'] },
          plan: { type: input.planType },
          ...(input.courseId ? { courseId: input.courseId } : { courseId: null }),
        },
      });

      if (existing?.status === 'ACTIVE') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have an active subscription for this plan',
        });
      }

      // Replace stale PENDING — user closed widget or payment failed
      if (existing?.status === 'PENDING') {
        await ctx.prisma.payment.deleteMany({
          where: { subscriptionId: existing.id },
        });
        await ctx.prisma.subscription.delete({
          where: { id: existing.id },
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
        userId: ctx.user.id,
      };
    }),

  /**
   * SUPERADMIN: list hidden test plans (not exposed on /pricing).
   * Used by /admin/billing-test to drive prod CP smoke tests.
   */
  listTestPlans: superadminProcedure.query(async ({ ctx }) => {
    return ctx.prisma.subscriptionPlan.findMany({
      where: { hidden: true },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * SUPERADMIN: initiate payment for a specific hidden plan by id.
   *
   * Mirrors initiatePayment but:
   *  - takes planId directly (not planType)
   *  - only resolves HIDDEN plans (refuses to charge against public plans
   *    via this route, so it can never be abused to bypass the normal flow)
   *  - PLATFORM-only (no courseId wiring), keeps the surface tiny
   */
  initiateTestPayment: superadminProcedure
    .input(z.object({ planId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const enabled = await isFeatureEnabled('billing_enabled');
      if (!enabled) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Billing is not enabled' });
      }

      const plan = await ctx.prisma.subscriptionPlan.findUnique({
        where: { id: input.planId },
      });
      if (!plan || !plan.isActive || !plan.hidden) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Hidden test plan not found or inactive',
        });
      }
      if (plan.type !== 'PLATFORM') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Test plans must be PLATFORM type',
        });
      }

      // Drop any stale PENDING of the same shape before creating a fresh one.
      const existing = await ctx.prisma.subscription.findFirst({
        where: {
          userId: ctx.user.id,
          status: 'PENDING',
          planId: plan.id,
        },
      });
      if (existing) {
        await ctx.prisma.payment.deleteMany({ where: { subscriptionId: existing.id } });
        await ctx.prisma.subscription.delete({ where: { id: existing.id } });
      }

      const now = new Date();
      const subscription = await ctx.prisma.subscription.create({
        data: {
          userId: ctx.user.id,
          planId: plan.id,
          courseId: null,
          status: 'PENDING',
          currentPeriodStart: now,
          currentPeriodEnd: now,
        },
      });
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
        userId: ctx.user.id,
        intervalDays: plan.intervalDays,
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
            include: { plan: true, course: true },
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

    // Cancel locally — CP cancel API requires their subscription ID which
    // we don't store yet (paymentSchema: 'Single' mode). When switching to
    // real recurrent billing, store CP subscription ID from webhook Token field
    // and call https://api.cloudpayments.ru/subscriptions/cancel with it.
    //
    // CP cancel webhook (if it arrives) is handled idempotently by our webhook handler.
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
