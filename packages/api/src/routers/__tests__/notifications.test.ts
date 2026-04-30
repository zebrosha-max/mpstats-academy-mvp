import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsRouter } from '../notifications';

function makeCtx(overrides: any = {}) {
  const userId = overrides.userId ?? 'user-a';
  return {
    user: { id: userId },
    prisma: {
      notification: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      notificationPreference: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue({}),
      },
      userProfile: {
        findUnique: vi.fn().mockResolvedValue({ lastNotificationsSeenAt: null }),
        update: vi.fn().mockResolvedValue({}),
      },
      ...(overrides.prisma ?? {}),
    },
  } as any;
}

function caller(ctx: any) {
  return notificationsRouter.createCaller(ctx);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notifications.markRead', () => {
  it('throws FORBIDDEN when notification belongs to another user', async () => {
    const ctx = makeCtx();
    ctx.prisma.notification.findUnique.mockResolvedValue({
      userId: 'user-b',
      readAt: null,
    });

    await expect(
      caller(ctx).markRead({ notificationId: 'n-1' }),
    ).rejects.toThrow(/FORBIDDEN|Cannot mark/);
    expect(ctx.prisma.notification.update).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when notification does not exist', async () => {
    const ctx = makeCtx();
    ctx.prisma.notification.findUnique.mockResolvedValue(null);

    await expect(
      caller(ctx).markRead({ notificationId: 'missing' }),
    ).rejects.toThrow(/NOT_FOUND|not found/i);
  });

  it('returns alreadyRead without update when notification.readAt is set', async () => {
    const ctx = makeCtx();
    ctx.prisma.notification.findUnique.mockResolvedValue({
      userId: 'user-a',
      readAt: new Date('2026-01-01'),
    });

    const result = await caller(ctx).markRead({ notificationId: 'n-1' });
    expect(result).toEqual({ alreadyRead: true });
    expect(ctx.prisma.notification.update).not.toHaveBeenCalled();
  });

  it('updates readAt and returns success when own unread notification', async () => {
    const ctx = makeCtx();
    ctx.prisma.notification.findUnique.mockResolvedValue({
      userId: 'user-a',
      readAt: null,
    });

    const result = await caller(ctx).markRead({ notificationId: 'n-1' });
    expect(result).toEqual({ success: true });
    expect(ctx.prisma.notification.update).toHaveBeenCalledTimes(1);
  });
});

describe('notifications.list', () => {
  it('adds readAt: null filter when filter=unread', async () => {
    const ctx = makeCtx();
    await caller(ctx).list({ filter: 'unread' });

    const findManyArgs = ctx.prisma.notification.findMany.mock.calls[0][0];
    expect(findManyArgs.where).toMatchObject({
      userId: 'user-a',
      readAt: null,
    });
  });

  it('returns nextCursor when items length equals PAGE_SIZE (20)', async () => {
    const ctx = makeCtx();
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `n-${i}`,
      userId: 'user-a',
      type: 'COMMENT_REPLY',
      payload: {},
      ctaUrl: null,
      readAt: null,
      createdAt: new Date(),
      broadcastId: null,
    }));
    ctx.prisma.notification.findMany.mockResolvedValue(items);
    ctx.prisma.notification.count.mockResolvedValue(50);

    const result = await caller(ctx).list({ filter: 'all' });
    expect(result?.nextCursor).toBe('n-19');
    expect(result?.totalCount).toBe(50);
  });

  it('returns nextCursor=null when items length less than PAGE_SIZE', async () => {
    const ctx = makeCtx();
    ctx.prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n-1',
        userId: 'user-a',
        type: 'COMMENT_REPLY',
        payload: {},
        ctaUrl: null,
        readAt: null,
        createdAt: new Date(),
        broadcastId: null,
      },
    ]);

    const result = await caller(ctx).list({ filter: 'all' });
    expect(result?.nextCursor).toBeNull();
  });
});

describe('notifications.unreadCount', () => {
  it('does not add createdAt filter when lastNotificationsSeenAt is null', async () => {
    const ctx = makeCtx();
    ctx.prisma.userProfile.findUnique.mockResolvedValue({
      lastNotificationsSeenAt: null,
    });
    ctx.prisma.notification.count.mockResolvedValue(3);

    const result = await caller(ctx).unreadCount();
    expect(result).toEqual({ count: 3 });

    const countArgs = ctx.prisma.notification.count.mock.calls[0][0];
    expect(countArgs.where).not.toHaveProperty('createdAt');
    expect(countArgs.where).toMatchObject({
      userId: 'user-a',
      readAt: null,
    });
  });

  it('adds createdAt > seenAt filter when lastNotificationsSeenAt is set', async () => {
    const seenAt = new Date('2026-04-01');
    const ctx = makeCtx();
    ctx.prisma.userProfile.findUnique.mockResolvedValue({
      lastNotificationsSeenAt: seenAt,
    });
    ctx.prisma.notification.count.mockResolvedValue(1);

    await caller(ctx).unreadCount();

    const countArgs = ctx.prisma.notification.count.mock.calls[0][0];
    expect(countArgs.where.createdAt).toEqual({ gt: seenAt });
  });
});

describe('notifications.getPreferences', () => {
  it('returns 7 default prefs when no rows exist', async () => {
    const ctx = makeCtx();
    ctx.prisma.notificationPreference.findMany.mockResolvedValue([]);

    const result = await caller(ctx).getPreferences();
    expect(result).toHaveLength(7);

    const weekly = result?.find((p: any) => p.type === 'WEEKLY_DIGEST');
    expect(weekly?.inApp).toBe(false);
    expect(weekly?.email).toBe(false);

    const commentReply = result?.find((p: any) => p.type === 'COMMENT_REPLY');
    expect(commentReply?.inApp).toBe(true);
    expect(commentReply?.email).toBe(false);
  });

  it('merges user override rows with defaults', async () => {
    const ctx = makeCtx();
    ctx.prisma.notificationPreference.findMany.mockResolvedValue([
      { userId: 'user-a', type: 'COMMENT_REPLY', inApp: false, email: false },
      { userId: 'user-a', type: 'WEEKLY_DIGEST', inApp: true, email: true },
    ]);

    const result = await caller(ctx).getPreferences();
    const cr = result?.find((p: any) => p.type === 'COMMENT_REPLY');
    const wd = result?.find((p: any) => p.type === 'WEEKLY_DIGEST');
    expect(cr?.inApp).toBe(false);
    expect(wd?.inApp).toBe(true);
    expect(wd?.email).toBe(true);
  });
});

describe('notifications.updatePreference', () => {
  it('upserts row with NotificationType enum value', async () => {
    const ctx = makeCtx();
    ctx.prisma.notificationPreference.upsert.mockResolvedValue({
      userId: 'user-a',
      type: 'COMMENT_REPLY',
      inApp: false,
      email: false,
    });

    await caller(ctx).updatePreference({
      type: 'COMMENT_REPLY',
      inApp: false,
    });

    expect(ctx.prisma.notificationPreference.upsert).toHaveBeenCalledTimes(1);
    const args = ctx.prisma.notificationPreference.upsert.mock.calls[0][0];
    expect(args.where).toEqual({
      userId_type: { userId: 'user-a', type: 'COMMENT_REPLY' },
    });
    expect(args.update).toEqual({ inApp: false });
  });
});

describe('notifications.markSeen', () => {
  it('updates UserProfile.lastNotificationsSeenAt with NOW()', async () => {
    const ctx = makeCtx();
    await caller(ctx).markSeen();

    expect(ctx.prisma.userProfile.update).toHaveBeenCalledWith({
      where: { id: 'user-a' },
      data: { lastNotificationsSeenAt: expect.any(Date) },
    });
  });
});

describe('notifications.markAllRead', () => {
  it('updateMany only own unread notifications', async () => {
    const ctx = makeCtx();
    ctx.prisma.notification.updateMany.mockResolvedValue({ count: 5 });

    const result = await caller(ctx).markAllRead();
    expect(result).toEqual({ count: 5 });
    expect(ctx.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-a', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
