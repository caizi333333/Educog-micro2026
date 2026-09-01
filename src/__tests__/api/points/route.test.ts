import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/points/route';
import { verifyToken } from '@/lib/auth';
import { POINTS_CONFIG } from '@/lib/points-system';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userPointsTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    userActivity: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/lib/points-system', () => ({
  POINTS_CONFIG: {
    COMPLETE_EXPERIMENT: 50,
    DAILY_LOGIN: 10,
    COMPLETE_QUIZ: 30,
  },
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

const awardRequest = (overrides: Record<string, unknown> = {}) => new NextRequest(
  'http://localhost/api/points',
  {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      userId: 'target-1',
      type: 'COMPLETE_EXPERIMENT',
      description: '完成寻址方式补充实践',
      requestId: 'points-request-001',
      confirm: 'AWARD_POINTS',
      ...overrides,
    }),
  },
);

describe('/api/points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    (prisma.userPointsTransaction.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'STUDENT', status: 'ACTIVE' });
    (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.userActivity.create as jest.Mock).mockResolvedValue({ id: 'activity-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
  });

  describe('POST', () => {
    it('returns 401 without an authorization header', async () => {
      const response = await POST(new NextRequest('http://localhost/api/points', {
        method: 'POST',
        body: JSON.stringify({}),
      }));

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: '未授权' });
    });

    it('returns 401 for an invalid token', async () => {
      mockVerifyToken.mockResolvedValue(null as any);
      const response = await POST(awardRequest());

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: '无效的令牌' });
    });

    it('rejects manual awards from non-admin users', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
      const response = await POST(awardRequest());

      expect(response.status).toBe(403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('requires an explicit confirmation token', async () => {
      const response = await POST(awardRequest({ confirm: undefined }));

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ confirmationRequired: true });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('requires a meaningful reason', async () => {
      const response = await POST(awardRequest({ description: '奖' }));

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an invalid points type', async () => {
      const response = await POST(awardRequest({ type: 'INVALID_TYPE' }));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: '无效的积分类型' });
    });

    it('rejects an inactive or non-student target', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'TEACHER', status: 'ACTIVE' });
      const response = await POST(awardRequest());

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: '目标学生不存在或未激活' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('awards the configured value atomically and records the administrator', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ role: 'STUDENT', status: 'ACTIVE' })
        .mockResolvedValueOnce({ totalPoints: 150 });
      (prisma.userPointsTransaction.create as jest.Mock).mockImplementation(async ({ data }) => ({
        ...data,
        createdAt: new Date(),
      }));

      const response = await POST(awardRequest({
        points: 9999,
        metadata: { experimentId: 'exp02' },
      }));
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body).toMatchObject({ success: true, duplicate: false, totalPoints: 150 });
      expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.stringMatching(/^manual_points_/),
          userId: 'target-1',
          points: POINTS_CONFIG.COMPLETE_EXPERIMENT,
          type: 'COMPLETE_EXPERIMENT',
          description: '完成寻址方式补充实践',
        }),
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'target-1', role: 'STUDENT', status: 'ACTIVE' },
        data: { totalPoints: { increment: POINTS_CONFIG.COMPLETE_EXPERIMENT } },
      });
      expect(prisma.userActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'target-1',
          action: 'EARN_POINTS',
          details: expect.stringContaining('admin-1'),
        }),
      });
      const metadata = JSON.parse((prisma.userPointsTransaction.create as jest.Mock).mock.calls[0][0].data.metadata);
      expect(metadata).toMatchObject({
        kind: 'MANUAL_POINTS_AWARD',
        requestId: 'points-request-001',
        awardedBy: 'admin-1',
        customMetadata: JSON.stringify({ experimentId: 'exp02' }),
      });
    });

    it('restores an exact request without adding points again', async () => {
      const receipt = {
        kind: 'MANUAL_POINTS_AWARD',
        requestId: 'points-request-001',
        awardedBy: 'admin-1',
        targetUserId: 'target-1',
        type: 'COMPLETE_EXPERIMENT',
        points: 50,
        description: '完成寻址方式补充实践',
        customMetadata: null,
      };
      (prisma.userPointsTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'manual_points_existing',
        userId: 'target-1',
        points: 50,
        type: 'COMPLETE_EXPERIMENT',
        description: receipt.description,
        metadata: JSON.stringify(receipt),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ totalPoints: 150 });

      const response = await POST(awardRequest());

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, duplicate: true, totalPoints: 150 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects reuse of a request ID for different award content', async () => {
      (prisma.userPointsTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'manual_points_existing',
        metadata: JSON.stringify({
          kind: 'MANUAL_POINTS_AWARD',
          requestId: 'points-request-001',
          awardedBy: 'admin-1',
          targetUserId: 'target-1',
          type: 'DAILY_LOGIN',
          points: 10,
          description: '另一项奖励原因',
          customMetadata: null,
        }),
      });

      const response = await POST(awardRequest());

      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: '请求编号已用于其他积分操作' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rolls back and returns a stable error when persistence fails', async () => {
      (prisma.userPointsTransaction.create as jest.Mock).mockRejectedValue(new Error('Database error'));
      const response = await POST(awardRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: '奖励积分失败' });
    });
  });

  describe('GET', () => {
    const prepareHistory = () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ totalPoints: 200 });
      (prisma.userPointsTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'tx-1',
          points: 50,
          type: 'COMPLETE_EXPERIMENT',
          description: '完成实验',
          metadata: '{"experimentId":"exp1"}',
          createdAt: new Date(),
        },
        {
          id: 'tx-2',
          points: 10,
          type: 'DAILY_LOGIN',
          description: '每日登录',
          metadata: null,
          createdAt: new Date(),
        },
      ]);
      (prisma.userPointsTransaction.groupBy as jest.Mock).mockResolvedValue([
        { type: 'COMPLETE_EXPERIMENT', _sum: { points: 100 }, _count: 2 },
      ]);
      (prisma.userPointsTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 30 } });
    };

    beforeEach(() => {
      mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });
      prepareHistory();
    });

    it('returns 401 without authorization', async () => {
      const response = await GET(new NextRequest('http://localhost/api/points'));
      expect(response.status).toBe(401);
    });

    it('returns 404 when the authenticated user no longer exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const response = await GET(new NextRequest('http://localhost/api/points', {
        headers: { authorization: 'Bearer valid-token' },
      }));

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: '用户不存在' });
    });

    it('returns history, statistics, and sanitized metadata', async () => {
      const response = await GET(new NextRequest('http://localhost/api/points', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({ success: true, totalPoints: 200, dailyPoints: 30 });
      expect(body.transactions[0].metadata).toEqual({ experimentId: 'exp1' });
      expect(body.transactions[1].metadata).toBeNull();
      expect(body.stats[0]).toEqual({ type: 'COMPLETE_EXPERIMENT', totalPoints: 100, count: 2 });
    });

    it('clamps unsafe pagination values', async () => {
      await GET(new NextRequest('http://localhost/api/points?limit=9999&offset=-20', {
        headers: { authorization: 'Bearer valid-token' },
      }));

      expect(prisma.userPointsTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
        take: 100,
        skip: 0,
      }));
    });

    it('uses China local midnight for daily points', async () => {
      await GET(new NextRequest('http://localhost/api/points', {
        headers: { authorization: 'Bearer valid-token' },
      }));

      const query = (prisma.userPointsTransaction.aggregate as jest.Mock).mock.calls[0][0];
      const start = query.where.createdAt.gte as Date;
      expect(start.getUTCHours()).toBe(16);
    });

    it('does not expose database error details', async () => {
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));
      const response = await GET(new NextRequest('http://localhost/api/points', {
        headers: { authorization: 'Bearer valid-token' },
      }));

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: '获取积分历史失败' });
    });
  });
});
