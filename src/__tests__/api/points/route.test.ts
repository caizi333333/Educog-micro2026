import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/points/route';
import { verifyToken } from '@/lib/auth';
import { 
  setupAuthMock,
  createMockNextRequest,
  clearAllMocks,
  mockPrisma
} from '../../utils/test-mocks';
import { POINTS_CONFIG } from '@/lib/points-system';
import { prisma } from '@/lib/prisma';

// Mock dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userPointsTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
    },
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

describe('/api/points', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  describe('POST', () => {
    it('should return 401 if no authorization header', async () => {
      const request = createMockNextRequest('http://localhost/api/points', {
        method: 'POST',
        body: JSON.stringify({}) as any,
      });

      const response = await POST(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('should return 401 if invalid token', async () => {
      mockVerifyToken.mockResolvedValue(null as any);

      const request = new NextRequest('http://localhost/api/points', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-token',
        },
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('should return 400 if invalid points type', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });

      const request = new NextRequest('http://localhost/api/points', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'INVALID_TYPE',
          points: 50,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效的积分类型');
    });

    it('should award points successfully', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.userPointsTransaction.create as jest.Mock).mockResolvedValue({
        id: 1,
        userId: '1',
        points: 50,
        type: 'COMPLETE_EXPERIMENT',
        description: '完成实验',
        createdAt: new Date(),
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        totalPoints: 150,
      });

      const request = new NextRequest('http://localhost/api/points', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'COMPLETE_EXPERIMENT',
          description: '完成实验',
          metadata: { experimentId: 'exp1' },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalPoints).toBe(150);
      expect(data.message).toContain('成功获得');
      expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: '1',
          points: POINTS_CONFIG.COMPLETE_EXPERIMENT,
          type: 'COMPLETE_EXPERIMENT',
          description: '完成实验',
          metadata: JSON.stringify({ experimentId: 'exp1' }),
        },
      });
      expect(prisma.user.update).toHaveBeenCalled();
      expect(prisma.userActivity.create).toHaveBeenCalled();
    });

    it('should use default points from config if not provided', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.userPointsTransaction.create as jest.Mock).mockResolvedValue({
        id: 1,
        userId: '1',
        points: 10,
        type: 'DAILY_LOGIN',
        description: '获得10积分',
        createdAt: new Date(),
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        totalPoints: 110,
      });

      const request = new NextRequest('http://localhost/api/points', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'DAILY_LOGIN',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: '1',
          points: POINTS_CONFIG.DAILY_LOGIN,
          type: 'DAILY_LOGIN',
          description: '获得10积分',
          metadata: null,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.userPointsTransaction.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/points', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
        },
        body: JSON.stringify({
          type: 'COMPLETE_EXPERIMENT',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('奖励积分失败');
      expect(data.details).toBe('Database error');
    });
  });

  describe('GET', () => {
    it('should return 401 if no authorization header', async () => {
      const request = createMockNextRequest('http://localhost/api/points') as any;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('should return 401 if invalid token', async () => {
      mockVerifyToken.mockResolvedValue(null as any);

      const request = new NextRequest('http://localhost/api/points', {
        headers: {
          'authorization': 'Bearer invalid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('should return user points history', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        totalPoints: 200,
      });
      (prisma.userPointsTransaction.findMany as jest.Mock).mockResolvedValue([
        {
          id: 1,
          points: 50,
          type: 'COMPLETE_EXPERIMENT',
          description: '完成实验',
          metadata: '{"experimentId":"exp1"}',
          createdAt: new Date(),
        },
        {
          id: 2,
          points: 10,
          type: 'DAILY_LOGIN',
          description: '每日登录',
          metadata: null,
          createdAt: new Date(),
        },
      ]);
      (prisma.userPointsTransaction.groupBy as jest.Mock).mockResolvedValue([
        {
          type: 'COMPLETE_EXPERIMENT',
          _sum: { points: 100 },
          _count: 2,
        },
        {
          type: 'DAILY_LOGIN',
          _sum: { points: 50 },
          _count: 5,
        },
      ]);
      (prisma.userPointsTransaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { points: 30 },
      });

      const request = new NextRequest('http://localhost/api/points', {
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.totalPoints).toBe(200);
      expect(data.dailyPoints).toBe(30);
      expect(data.transactions).toHaveLength(2);
      expect(data.transactions[0].metadata).toEqual({ experimentId: 'exp1' });
      expect(data.transactions[1].metadata).toBeNull();
      expect(data.stats).toHaveLength(2);
      expect(data.stats[0]).toEqual({
        type: 'COMPLETE_EXPERIMENT',
        totalPoints: 100,
        count: 2,
      });
    });

    it('should handle pagination parameters', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ totalPoints: 100 });
      (prisma.userPointsTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userPointsTransaction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.userPointsTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 0 } });

      const request = new NextRequest('http://localhost/api/points?limit=20&offset=10', {
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      await GET(request);

      expect(prisma.userPointsTransaction.findMany).toHaveBeenCalledWith({
        where: { userId: '1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 10,
      });
    });

    it('should use default pagination if not provided', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ totalPoints: 100 });
      (prisma.userPointsTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.userPointsTransaction.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.userPointsTransaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { points: 0 } });

      const request = new NextRequest('http://localhost/api/points', {
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      await GET(request);

      expect(prisma.userPointsTransaction.findMany).toHaveBeenCalledWith({
        where: { userId: '1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should handle errors gracefully', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'test@example.com', role: 'student' });
      (prisma.user.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost/api/points', {
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('获取积分历史失败');
      expect(data.details).toBe('Database error');
    });
  });
});
