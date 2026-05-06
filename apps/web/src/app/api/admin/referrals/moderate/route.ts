/**
 * POST /api/admin/referrals/moderate
 *
 * Phase 53B: admin actions on PENDING_REVIEW referrals.
 * Single endpoint with action discriminator (approve / reject / bulk-approve / bulk-reject).
 *
 * tRPC stays read-only (referral.adminList) because writes need to fire CQ
 * events post-DB and cq client lives in apps/web (workspace dep direction).
 *
 * Auth: ADMIN or SUPERADMIN.
 *
 * Contract:
 *  - 401 — no auth
 *  - 403 — not admin
 *  - 400 — invalid body / wrong status
 *  - 404 — referral not found
 *  - 200 — action result
 *  - 500 — internal
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { createClient } from '@/lib/supabase/server';
import {
  approveReferral,
  rejectReferral,
  bulkApproveByReferrer,
  bulkRejectByReferrer,
} from '@/lib/referral/admin-moderation';

export const dynamic = 'force-dynamic';

const InputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    referralId: z.string().min(1),
  }),
  z.object({
    action: z.literal('reject'),
    referralId: z.string().min(1),
    reason: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('bulk-approve'),
    referrerUserId: z.string().min(1),
  }),
  z.object({
    action: z.literal('bulk-reject'),
    referrerUserId: z.string().min(1),
    reason: z.string().trim().max(500).optional(),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    // 1) Auth
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2) Role check
    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!profile || (profile.role !== 'ADMIN' && profile.role !== 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3) Validate body
    const body = await request.json().catch(() => null);
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Bad request', issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const input = parsed.data;

    // 4) Dispatch
    if (input.action === 'approve') {
      const result = await approveReferral({
        referralId: input.referralId,
        reviewedByUserId: user.id,
      });
      if ('ok' in result) return NextResponse.json(result);
      return NextResponse.json({ error: result }, { status: errStatus(result.code) });
    }
    if (input.action === 'reject') {
      const result = await rejectReferral({
        referralId: input.referralId,
        reviewedByUserId: user.id,
        reason: input.reason,
      });
      if ('ok' in result) return NextResponse.json(result);
      return NextResponse.json({ error: result }, { status: errStatus(result.code) });
    }
    if (input.action === 'bulk-approve') {
      const result = await bulkApproveByReferrer({
        referrerUserId: input.referrerUserId,
        reviewedByUserId: user.id,
      });
      return NextResponse.json(result);
    }
    if (input.action === 'bulk-reject') {
      const result = await bulkRejectByReferrer({
        referrerUserId: input.referrerUserId,
        reviewedByUserId: user.id,
        reason: input.reason,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'referral', stage: 'admin-moderate-route' },
    });
    console.error('[admin/referrals/moderate] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function errStatus(code: string): number {
  if (code === 'NOT_FOUND') return 404;
  return 400;
}
