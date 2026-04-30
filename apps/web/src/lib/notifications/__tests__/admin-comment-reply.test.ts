import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('@mpstats/db/client', () => ({
  prisma: {
    lessonComment: { findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    userProfile: { findUnique: vi.fn() },
  },
}));
vi.mock('@/lib/carrotquest/client', () => ({
  cq: { setUserProps: vi.fn(), trackEvent: vi.fn() },
}));

import { prisma } from '@mpstats/db/client';
import { notifyCommentReply } from '../notify';

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.notificationPreference.findUnique as any).mockResolvedValue(null);
  (prisma.lesson.findUnique as any).mockResolvedValue({ title: 'Урок 1' });
});

function setupReply(opts: {
  parentUserId: string;
  parentExists?: boolean;
  replyAuthorRole?: 'USER' | 'ADMIN' | 'SUPERADMIN';
}) {
  (prisma.lessonComment.findUnique as any)
    .mockResolvedValueOnce({
      id: 'reply-1',
      content: 'hi',
      parentId: 'parent-1',
      lessonId: 'lesson-1',
      user: { name: 'Mila' },
    })
    .mockResolvedValueOnce(
      opts.parentExists === false
        ? null
        : {
            id: 'parent-1',
            userId: opts.parentUserId,
          },
    );
  (prisma.userProfile.findUnique as any).mockResolvedValue({
    role: opts.replyAuthorRole ?? 'USER',
  });
}

describe('notifyCommentReply supersede', () => {
  it('admin replying to user → ADMIN_COMMENT_REPLY (not COMMENT_REPLY)', async () => {
    setupReply({ parentUserId: 'user-A', replyAuthorRole: 'ADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-1' });
    expect(prisma.notification.create).toHaveBeenCalledOnce();
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('ADMIN_COMMENT_REPLY');
  });

  it('SUPERADMIN replying to user → ADMIN_COMMENT_REPLY', async () => {
    setupReply({ parentUserId: 'user-A', replyAuthorRole: 'SUPERADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'super-1' });
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('ADMIN_COMMENT_REPLY');
  });

  it('USER replying to USER → COMMENT_REPLY', async () => {
    setupReply({ parentUserId: 'user-A', replyAuthorRole: 'USER' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'user-B' });
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('COMMENT_REPLY');
  });

  it('admin replying to own comment → no notification', async () => {
    setupReply({ parentUserId: 'admin-1', replyAuthorRole: 'ADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-1' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('admin A replying to admin B (different admins) → ADMIN_COMMENT_REPLY for B', async () => {
    setupReply({ parentUserId: 'admin-B', replyAuthorRole: 'ADMIN' });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-A' });
    const arg = (prisma.notification.create as any).mock.calls[0][0];
    expect(arg.data.type).toBe('ADMIN_COMMENT_REPLY');
    expect(arg.data.userId).toBe('admin-B');
  });

  it('reply with deleted parent → no-op', async () => {
    setupReply({ parentUserId: 'user-A', parentExists: false });
    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'admin-1' });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
