import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: (globalThis as any).__mockPrisma,
}));

import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GET, POST, PUT } from '@/app/api/user/progress/route';

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function request(method = 'GET'): NextRequest {
  return new NextRequest('http://localhost:3000/api/user/progress', {
    method,
    headers: { authorization: 'Bearer valid-token' },
  });
}

describe('/api/user/progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({
      userId: 'user123',
      email: 'test@example.com',
      role: 'STUDENT',
    } as any);
    (mockPrisma.learningProgress.count as jest.Mock).mockResolvedValue(0);
    (mockPrisma.learningProgress.aggregate as jest.Mock).mockResolvedValue({
      _sum: { timeSpent: null },
      _max: { completedAt: null },
      _count: 0,
    } as any);
    (mockPrisma.quizAttempt.aggregate as jest.Mock).mockResolvedValue({
      _avg: { score: null },
      _count: 0,
    } as any);
    (mockPrisma.learningProgress.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('应从服务端学习与测评记录派生进度', async () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 86_400_000);
    (mockPrisma.learningProgress.count as jest.Mock).mockResolvedValue(5);
    (mockPrisma.learningProgress.aggregate as jest.Mock).mockResolvedValue({
      _sum: { timeSpent: 3600 },
      _max: { completedAt: today },
      _count: 8,
    } as any);
    (mockPrisma.quizAttempt.aggregate as jest.Mock).mockResolvedValue({
      _avg: { score: 85.126 },
      _count: 3,
    } as any);
    (mockPrisma.learningProgress.findMany as jest.Mock).mockResolvedValue([
      { completedAt: today },
      { completedAt: yesterday },
    ] as any);

    const response = await GET(request());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(data).toMatchObject({
      source: 'SERVER_DERIVED',
      modulesCompleted: 5,
      totalTimeSpent: 3600,
      averageScore: 85.13,
      streakDays: 2,
      learningRecords: 8,
      quizAttempts: 3,
      dataSufficient: true,
    });
    expect(mockPrisma.userProgress.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.learningProgress.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 366,
      orderBy: { completedAt: 'desc' },
    }));
  });

  it('无学习记录时应返回明确的零值与数据不足状态', async () => {
    const response = await GET(request());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      modulesCompleted: 0,
      totalTimeSpent: 0,
      averageScore: null,
      streakDays: 0,
      dataSufficient: false,
    });
  });

  it('最近完成记录超过一天未更新时连续天数应归零', async () => {
    (mockPrisma.learningProgress.findMany as jest.Mock).mockResolvedValue([
      { completedAt: new Date(Date.now() - 3 * 86_400_000) },
    ] as any);

    const response = await GET(request());
    expect((await response.json()).streakDays).toBe(0);
  });

  it('无有效令牌时应返回 401 且不查询学习数据', async () => {
    mockVerifyToken.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(mockPrisma.learningProgress.aggregate).not.toHaveBeenCalled();
  });

  it('数据库失败时不得伪装成零值进度', async () => {
    (mockPrisma.learningProgress.aggregate as jest.Mock).mockRejectedValue(new Error('database unavailable'));

    const response = await GET(request());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('获取学习进度失败');
  });

  it.each([
    ['POST', POST],
    ['PUT', PUT],
  ])('%s 不得由客户端写入派生进度', async (method, handler) => {
    const response = await handler(request(method));
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(data.error).toContain('不支持客户端修改');
    expect(mockPrisma.userProgress.create).not.toHaveBeenCalled();
    expect(mockPrisma.userProgress.update).not.toHaveBeenCalled();
  });
});
