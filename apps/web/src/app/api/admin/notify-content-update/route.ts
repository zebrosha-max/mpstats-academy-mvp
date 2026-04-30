/**
 * POST /api/admin/notify-content-update
 *
 * Phase 52: admin-only fan-out endpoint for CONTENT_UPDATE notifications.
 * Called by admin UI after Lesson unhide / Material attach when "notify"
 * checkbox is set. tRPC stays pure DB; this route handles user targeting,
 * grouping, and CQ event dispatch (lives in apps/web because cq client
 * lives here — workspace dep direction is apps/web → packages, never reverse).
 *
 * Auth: ADMIN or SUPERADMIN role required.
 *
 * Contract:
 *  - 401 — no auth
 *  - 403 — not admin
 *  - 400 — invalid body
 *  - 200 { delivered: number } — fan-out complete
 *  - 500 — internal error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { createClient } from '@/lib/supabase/server';
import { notifyContentUpdate } from '@/lib/notifications/content-update';

export const dynamic = 'force-dynamic';

const itemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('lesson'),
    id: z.string().min(1),
    title: z.string(),
  }),
  z.object({
    kind: z.literal('material'),
    id: z.string().min(1),
    lessonId: z.string().min(1),
    lessonTitle: z.string(),
    title: z.string(),
  }),
]);

const InputSchema = z.object({
  courseId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    // 1) Auth
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // 4) Fan-out
    const result = await notifyContentUpdate(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { area: 'notifications', stage: 'notify-content-update-route' },
    });
    console.error('[notify-content-update] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
