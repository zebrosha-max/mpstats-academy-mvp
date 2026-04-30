import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase server client — sigнатура совпадает с реальным `createClient`
// из `@/lib/supabase/server` (async function returning a Supabase client).
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    lessonComment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/notifications/notify', () => ({
  notifyCommentReply: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import { POST } from '../../../app/api/notifications/notify-reply/route';
import { prisma } from '@mpstats/db/client';
import { notifyCommentReply } from '../notify';
import { createClient } from '@/lib/supabase/server';

function mockSupabaseUser(user: { id: string } | null) {
  (createClient as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  });
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/notifications/notify-reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/notifications/notify-reply', () => {
  it('returns 401 when there is no auth', async () => {
    mockSupabaseUser(null);
    const res = await POST(makeRequest({ replyCommentId: 'r-1' }));
    expect(res.status).toBe(401);
    expect(notifyCommentReply).not.toHaveBeenCalled();
  });

  it('returns 400 when replyCommentId is missing', async () => {
    mockSupabaseUser({ id: 'user-a' });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    expect(notifyCommentReply).not.toHaveBeenCalled();
  });

  it('returns 403 when replier.userId does not match auth user (anti-spoofing)', async () => {
    mockSupabaseUser({ id: 'user-x' });
    (prisma.lessonComment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: 'r-1',
      userId: 'user-y',
      parentId: 'parent-1',
    });

    const res = await POST(makeRequest({ replyCommentId: 'r-1' }));
    expect(res.status).toBe(403);
    expect(notifyCommentReply).not.toHaveBeenCalled();
  });

  it('returns 200 + skipped when comment is root (no parentId)', async () => {
    mockSupabaseUser({ id: 'user-a' });
    (prisma.lessonComment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: 'r-1',
      userId: 'user-a',
      parentId: null,
    });

    const res = await POST(makeRequest({ replyCommentId: 'r-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe('not_a_reply');
    expect(notifyCommentReply).not.toHaveBeenCalled();
  });

  it('calls notifyCommentReply when reply is valid and ownership matches', async () => {
    mockSupabaseUser({ id: 'user-a' });
    (prisma.lessonComment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      id: 'r-1',
      userId: 'user-a',
      parentId: 'parent-1',
    });

    const res = await POST(makeRequest({ replyCommentId: 'r-1' }));
    expect(res.status).toBe(200);
    expect(notifyCommentReply).toHaveBeenCalledWith({
      replyCommentId: 'r-1',
      actorUserId: 'user-a',
    });
  });

  it('returns 404 when reply comment does not exist', async () => {
    mockSupabaseUser({ id: 'user-a' });
    (prisma.lessonComment.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(null);

    const res = await POST(makeRequest({ replyCommentId: 'missing' }));
    expect(res.status).toBe(404);
    expect(notifyCommentReply).not.toHaveBeenCalled();
  });
});
