import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/experiments/save/route';
import { verifyToken } from '@/lib/auth';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

describe('/api/experiments/save', () => {
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

  beforeEach(() => {
    jest.clearAllMocks();
    const prisma = (globalThis as any).__mockPrisma;
    prisma.userExperiment.findUnique.mockResolvedValue(null);
    prisma.userExperiment.create.mockResolvedValue({
      id: 1,
      experimentId: 'exp1',
      status: 'COMPLETED',
      attempts: 1,
      timeSpent: 10,
      completedAt: new Date(),
    });
    prisma.userExperiment.update.mockResolvedValue({
      id: 1,
      experimentId: 'exp1',
      status: 'COMPLETED',
      attempts: 2,
      timeSpent: 20,
      completedAt: new Date(),
    });
    prisma.userExperiment.findMany.mockResolvedValue([]);
  });

  describe('POST', () => {
    it('缺少认证令牌应返回 401', async () => {
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('缺少认证令牌');
    });

    it('无效令牌应返回 401', async () => {
      mockVerifyToken.mockResolvedValue(null as any);
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-token' },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('缺少 experimentId 应返回 400', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ code: 'abc' }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('缺少实验ID');
    });

    it('应创建新实验记录', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ experimentId: 'exp1', code: 'abc', status: 'COMPLETED', timeSpent: 10 }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userExperiment.create).toHaveBeenCalled();
      expect(data.experiment.experimentId).toBe('exp1');
    });

    it('应更新已有实验记录', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 1,
        experimentId: 'exp1',
        status: 'IN_PROGRESS',
        attempts: 1,
        timeSpent: 10,
        completedAt: null,
        results: null,
      });

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ experimentId: 'exp1', code: 'abc', status: 'COMPLETED', timeSpent: 10 }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userExperiment.update).toHaveBeenCalled();
    });
  });

  describe('GET', () => {
    it('缺少认证令牌应返回 401', async () => {
      const req = new NextRequest('http://localhost/api/experiments/save', { method: 'GET' });
      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(401);
      expect(data.error).toBe('缺少认证令牌');
    });

    it('应返回实验记录列表（支持 experimentId 过滤）', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findMany.mockResolvedValueOnce([{ id: 1, experimentId: 'exp1' }]);

      const req = new NextRequest('http://localhost/api/experiments/save?experimentId=exp1', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(prisma.userExperiment.findMany).toHaveBeenCalled();
      expect(data.experiments).toHaveLength(1);
    });
  });
});

