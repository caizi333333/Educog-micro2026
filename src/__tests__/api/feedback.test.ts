import { NextRequest } from 'next/server';
import { POST } from '@/app/api/feedback/route';
import { verifyToken } from '@/lib/auth';
import { getActiveClassIdForUser } from '@/lib/classroom';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/classroom', () => ({ getActiveClassIdForUser: jest.fn() }));
jest.mock('@/lib/prisma', () => {
  const client = {
    siteFeedback: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    userAchievement: { createManyAndReturn: jest.fn() },
    userPointsTransaction: { createMany: jest.fn() },
    user: { update: jest.fn() },
    userActivity: { createMany: jest.fn() },
    achievementAuditLog: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation(async (callback: (tx: typeof client) => Promise<unknown>) => callback(client));
  return { prisma: client };
});

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockClassId = getActiveClassIdForUser as jest.MockedFunction<typeof getActiveClassIdForUser>;

const validBody = '测验提交后页面没有回到成绩，我重复试了两次。';

function feedbackRequest(body: Record<string, unknown>, authorization = 'Bearer valid-token'): NextRequest {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json', 'user-agent': 'jest' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    mockClassId.mockResolvedValue('class-1');
    (prisma.siteFeedback.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.siteFeedback.count as jest.Mock).mockResolvedValue(0);
    (prisma.siteFeedback.create as jest.Mock).mockResolvedValue({ id: 'fb-1' });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([]);
    (prisma.userPointsTransaction.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.userActivity.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.achievementAuditLog.createMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it('requires a student session', async () => {
    const missing = await POST(new NextRequest('http://localhost/api/feedback', { method: 'POST', body: '{}' }));
    expect(missing.status).toBe(401);

    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    const forbidden = await POST(feedbackRequest({ category: 'bug', body: validBody }));
    expect(forbidden.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a too-short body before writing', async () => {
    const response = await POST(feedbackRequest({ category: 'bug', body: '太短' }));
    expect(response.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a burst inside the one-minute interval', async () => {
    (prisma.siteFeedback.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });
    const response = await POST(feedbackRequest({ category: 'bug', body: validBody }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(prisma.siteFeedback.create).not.toHaveBeenCalled();
  });

  it('stores a named submission and unlocks the first feedback medal at count 1', async () => {
    (prisma.siteFeedback.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([
      { achievementId: 'feedback_first' },
    ]);

    const response = await POST(feedbackRequest({ category: 'bug', body: validBody, anonymous: false, pagePath: '/quiz' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      unlockedAchievements: [{ achievementId: 'feedback_first', points: 40, unlocked: true }],
    });
    expect(prisma.siteFeedback.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'student-1',
        anonymous: false,
        category: 'bug',
        classId: 'class-1',
        pagePath: '/quiz',
      }),
    }));
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { totalPoints: { increment: 40 } },
    }));
  });

  it('stores an anonymous submission and only returns medals that were newly inserted', async () => {
    (prisma.siteFeedback.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    (prisma.siteFeedback.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date(Date.now() - 120_000),
    });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([
      { achievementId: 'feedback_second' },
    ]);

    const response = await POST(feedbackRequest({ category: 'suggestion', body: validBody, anonymous: true }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.unlockedAchievements).toEqual([
      { achievementId: 'feedback_second', points: 60, unlocked: true },
    ]);
    expect(prisma.siteFeedback.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ anonymous: true }),
    }));
    expect(prisma.userPointsTransaction.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ points: 60 })],
    }));
  });

  it('does not award points again when the medal row already exists', async () => {
    (prisma.siteFeedback.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([]);

    const response = await POST(feedbackRequest({ category: 'content', body: validBody }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.unlockedAchievements).toEqual([]);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
