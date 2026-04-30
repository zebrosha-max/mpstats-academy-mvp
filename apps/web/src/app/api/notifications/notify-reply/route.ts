/**
 * POST /api/notifications/notify-reply
 *
 * Phase 51 plan 04: bridge between frontend `comments.create` mutation and the
 * `notifyCommentReply` service. tRPC router (`packages/api`) intentionally stays
 * pure — it cannot import from `apps/web` (workspace dep direction). So the
 * frontend, after a successful reply create, fires a fire-and-forget POST here.
 *
 * Security:
 *  - Requires authenticated Supabase session (cookies).
 *  - Anti-spoofing: only the actual replier (LessonComment.userId === user.id)
 *    can trigger the notification for THIS reply. Otherwise 403.
 *
 * Contract:
 *  - 401 — no auth
 *  - 400 — invalid body
 *  - 404 — replyCommentId not found
 *  - 403 — auth user is not the replier
 *  - 200 { ok: true }                       — notification scheduled
 *  - 200 { ok: true, skipped: 'not_a_reply' } — root comment, silent no-op
 *  - 500 { ok: false }                      — internal error (frontend ignores; fire-and-forget)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import * as Sentry from '@sentry/nextjs';
import { prisma } from '@mpstats/db/client';
import { createClient } from '@/lib/supabase/server';
import { notifyCommentReply } from '@/lib/notifications/notify';

export const dynamic = 'force-dynamic';

const InputSchema = z.object({
  replyCommentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // 1) Auth — Supabase server client reads cookies via `next/headers`.
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Validate body.
    const body = await request.json().catch(() => null);
    const parsed = InputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { replyCommentId } = parsed.data;

    // 3) Anti-spoofing: requesting user must BE the replier.
    const reply = await prisma.lessonComment.findUnique({
      where: { id: replyCommentId },
      select: { id: true, userId: true, parentId: true },
    });
    if (!reply) {
      return NextResponse.json({ error: 'Reply comment not found' }, { status: 404 });
    }
    if (reply.userId !== user.id) {
      Sentry.captureMessage('notify-reply spoofing attempt', {
        level: 'warning',
        extra: {
          actualReplier: reply.userId,
          requestingUser: user.id,
          replyCommentId,
        },
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!reply.parentId) {
      // Root comment — no recipient, silent no-op (frontend should not have called).
      return NextResponse.json({ ok: true, skipped: 'not_a_reply' });
    }

    // 4) Fire notification. notifyCommentReply has its own try/catch + Sentry.
    await notifyCommentReply({ replyCommentId, actorUserId: user.id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { area: 'notifications', stage: 'notify-reply-route' },
    });
    console.error('[notify-reply] error:', error);
    // Frontend treats this as fire-and-forget — won't retry.
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
