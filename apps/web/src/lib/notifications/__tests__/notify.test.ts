import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks (vi.mock is hoisted to top by vitest)
vi.mock('@mpstats/db/client', () => ({
  prisma: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    notificationPreference: {
      findUnique: vi.fn(),
    },
    lessonComment: {
      findUnique: vi.fn(),
    },
    lesson: {
      findUnique: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn().mockResolvedValue({ role: 'USER' }),
    },
  },
}));

vi.mock('@/lib/carrotquest/client', () => ({
  cq: {
    setUserProps: vi.fn().mockResolvedValue(undefined),
    trackEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { notify, notifyCommentReply } from '../notify';
import { prisma } from '@mpstats/db/client';
import { cq } from '@/lib/carrotquest/client';
import * as Sentry from '@sentry/nextjs';

const COMMENT_REPLY_PAYLOAD = {
  type: 'COMMENT_REPLY' as const,
  commentId: 'reply-1',
  lessonId: 'lesson-1',
  lessonTitle: 'Test Lesson',
  replyAuthorName: 'User B',
  preview: 'Test reply content',
  actorUserId: 'user-b',
};

const CONTENT_UPDATE_PAYLOAD = {
  type: 'CONTENT_UPDATE' as const,
  courseId: 'course-1',
  courseTitle: 'Аналитика',
  items: [
    { kind: 'lesson' as const, id: 'l1', title: 'Lesson 1' },
    { kind: 'lesson' as const, id: 'l2', title: 'Lesson 2' },
  ],
};

const INACTIVITY_RETURN_PAYLOAD = {
  type: 'INACTIVITY_RETURN' as const,
  daysSinceLastActive: 14,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notify()', () => {
  it('creates Notification row + fires CQ event when inApp=true', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue({
      userId: 'user-a',
      type: 'COMMENT_REPLY',
      inApp: true,
      email: false,
    });

    await notify('user-a', 'COMMENT_REPLY', COMMENT_REPLY_PAYLOAD, {
      ctaUrl: '/learn/lesson-1#comment-reply-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-a',
        type: 'COMMENT_REPLY',
        ctaUrl: '/learn/lesson-1#comment-reply-1',
      }),
    });
    expect(cq.trackEvent).toHaveBeenCalledWith('user-a', 'pa_notif_comment_reply');
  });

  it('skips row creation but STILL fires CQ event when inApp=false', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue({
      userId: 'user-a',
      type: 'COMMENT_REPLY',
      inApp: false,
      email: false,
    });

    await notify('user-a', 'COMMENT_REPLY', COMMENT_REPLY_PAYLOAD);

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(cq.trackEvent).toHaveBeenCalledWith('user-a', 'pa_notif_comment_reply');
  });

  it('returns early without row or CQ event when actorUserId === userId (anti-self)', async () => {
    await notify('user-b', 'COMMENT_REPLY', {
      ...COMMENT_REPLY_PAYLOAD,
      actorUserId: 'user-b',
    });

    expect(prisma.notificationPreference.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(cq.trackEvent).not.toHaveBeenCalled();
  });

  it('uses DEFAULT_IN_APP_PREFS=true for COMMENT_REPLY when no preference row exists', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue(null);

    await notify('user-a', 'COMMENT_REPLY', COMMENT_REPLY_PAYLOAD);

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(cq.trackEvent).toHaveBeenCalledWith('user-a', 'pa_notif_comment_reply');
  });

  it('uses DEFAULT_IN_APP_PREFS=false for WEEKLY_DIGEST when no preference row exists', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue(null);

    await notify('user-a', 'WEEKLY_DIGEST', {
      type: 'WEEKLY_DIGEST',
      newLessonsCount: 3,
      activityCount: 12,
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(cq.trackEvent).toHaveBeenCalledWith('user-a', 'pa_notif_weekly_digest');
  });

  it('captures Sentry exception when CQ trackEvent fails but does not throw', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue({ inApp: true });
    (cq.trackEvent as any).mockRejectedValueOnce(new Error('CQ down'));

    await expect(
      notify('user-a', 'COMMENT_REPLY', COMMENT_REPLY_PAYLOAD),
    ).resolves.toBeUndefined();

    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('does NOT trigger anti-self-notify for CONTENT_UPDATE (no actorUserId in payload)', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue({ inApp: true });

    await notify('user-a', 'CONTENT_UPDATE', CONTENT_UPDATE_PAYLOAD);

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(cq.trackEvent).toHaveBeenCalledWith('user-a', 'pa_notif_content_update');
  });

  it('does NOT trigger anti-self-notify for INACTIVITY_RETURN (no actorUserId in payload)', async () => {
    (prisma.notificationPreference.findUnique as any).mockResolvedValue({ inApp: true });

    await notify('user-a', 'INACTIVITY_RETURN', INACTIVITY_RETURN_PAYLOAD);

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(cq.trackEvent).toHaveBeenCalledWith('user-a', 'pa_notif_inactivity_return');
  });
});

describe('notifyCommentReply()', () => {
  it('resolves parent + lesson and calls notify with COMMENT_REPLY payload + ctaUrl', async () => {
    (prisma.lessonComment.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'reply-1') {
        return Promise.resolve({
          id: 'reply-1',
          content: 'Hello back',
          parentId: 'parent-1',
          lessonId: 'lesson-1',
          user: { name: 'User B' },
        });
      }
      if (where.id === 'parent-1') {
        return Promise.resolve({ id: 'parent-1', userId: 'user-a' });
      }
      return Promise.resolve(null);
    });
    (prisma.lesson.findUnique as any).mockResolvedValue({ title: 'Урок про аналитику' });
    (prisma.notificationPreference.findUnique as any).mockResolvedValue({ inApp: true });

    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'user-b' });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-a',
        type: 'COMMENT_REPLY',
        ctaUrl: '/learn/lesson-1#comment-reply-1',
      }),
    });
  });

  it('skips when parent.userId === actorUserId (replied to self)', async () => {
    (prisma.lessonComment.findUnique as any).mockImplementation(({ where }: any) => {
      if (where.id === 'reply-1') {
        return Promise.resolve({
          id: 'reply-1',
          content: 'self reply',
          parentId: 'parent-1',
          lessonId: 'lesson-1',
          user: { name: 'User B' },
        });
      }
      if (where.id === 'parent-1') {
        return Promise.resolve({ id: 'parent-1', userId: 'user-b' }); // same as actor
      }
      return Promise.resolve(null);
    });

    await notifyCommentReply({ replyCommentId: 'reply-1', actorUserId: 'user-b' });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(cq.trackEvent).not.toHaveBeenCalled();
  });
});
