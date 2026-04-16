import { NextRequest } from 'next/server';
import { GET } from '@/app/api/user/stats/route';
import { verifyToken } from '@/lib/auth';
import { createMockNextRequest } from '../utils/test-mocks';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

describe('/api/user/stats', () => {
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

  beforeEach(() => {
    jest.clearAllMocks();

    // 为该路由提供默认可用的 prisma mock（避免未设置返回值导致 500）
    const prisma = (globalThis as any).__mockPrisma;
    prisma.learningProgress.findMany.mockResolvedValue([]);
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    prisma.userExperiment.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({
      lastLoginAt: new Date(),
      createdAt: new Date(),
    });
  });

  it('应该返回用户统计数据（已登录）', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user123', email: 'x@y.com' } as any);

    const prisma = (globalThis as any).__mockPrisma;
    prisma.learningProgress.findMany.mockResolvedValue([
      { moduleId: 'm1', chapterId: 'c1', progress: 100, timeSpent: 200, completedAt: new Date() },
    ]);
    prisma.quizAttempt.findMany.mockResolvedValue([
      { score: 100, totalQuestions: 10, completedAt: new Date() },
    ]);
    prisma.userExperiment.findMany.mockResolvedValue([
      { experimentId: 'e1', completedAt: new Date() },
    ]);

    const req = createMockNextRequest('http://localhost:3000/api/user/stats', {
      headers: { authorization: 'Bearer valid-token' },
    }) as unknown as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('stats');
    expect(data.stats).toHaveProperty('modules_completed');
    expect(data.stats).toHaveProperty('experiments_completed');
    expect(data.stats).toHaveProperty('perfect_quiz');
  });

  it('应该在无数据时返回 0 值统计', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'user123', email: 'x@y.com' } as any);

    const req = createMockNextRequest('http://localhost:3000/api/user/stats', {
      headers: { authorization: 'Bearer valid-token' },
    }) as unknown as NextRequest;

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.stats.modules_completed).toBe(0);
    expect(data.stats.experiments_completed).toBe(0);
  });

  it('未授权时应返回 401', async () => {
    const req = createMockNextRequest('http://localhost:3000/api/user/stats') as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

