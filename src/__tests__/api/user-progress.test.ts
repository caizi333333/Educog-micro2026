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
    (mockPrisma.userPointsTransaction.findUnique as jest.Mock).mockResolvedValue(null);
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
      { lastAccessAt: today },
      { lastAccessAt: yesterday },
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
    expect(data.lastActiveDate).toBe(today.toISOString());
    expect(data.streakSource).toBe('learningProgress.lastAccessAt');
    expect(data.studyPoints.note).toContain('满 1 小时');
    expect(mockPrisma.learningProgress.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 366,
      orderBy: { lastAccessAt: 'desc' },
      select: { lastAccessAt: true },
    }));
  });

  it('未完成章节的学习访问也计入连续天数和最近活跃', async () => {
    const accessedAt = new Date();
    (mockPrisma.learningProgress.aggregate as jest.Mock).mockResolvedValue({
      _sum: { timeSpent: 480 },
      _max: { completedAt: null },
      _count: 1,
    } as any);
    (mockPrisma.learningProgress.findMany as jest.Mock).mockResolvedValue([
      { lastAccessAt: accessedAt },
    ] as any);

    const data = await (await GET(request())).json();

    expect(data.streakDays).toBe(1);
    expect(data.lastActiveDate).toBe(accessedAt.toISOString());
    expect(data.studyPoints.totalStudySeconds).toBe(480);
    expect(data.studyPoints.note).toContain('当前累计 8 分钟');
    expect(data.studyPoints.note).toContain('时长积分尚未入账');
    expect(data.studyPoints.dailyLoginAwarded).toBe(false);
  });

  it('progress.studyPoints.dailyLoginAwarded 与当日 DAILY_LOGIN 账本行一致', async () => {
    (mockPrisma.learningProgress.aggregate as jest.Mock).mockResolvedValue({
      _sum: { timeSpent: 210 },
      _max: { completedAt: null },
      _count: 1,
    } as any);
    (mockPrisma.userPointsTransaction.findUnique as jest.Mock).mockResolvedValue({ id: 'pt_daily' });

    const data = await (await GET(request())).json();

    expect(data.studyPoints.dailyLoginAwarded).toBe(true);
    expect(data.studyPoints.note).toContain('当前累计 4 分钟');
    expect(mockPrisma.userPointsTransaction.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: expect.stringMatching(/^pt_/) },
      select: { id: true },
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
      { lastAccessAt: new Date(Date.now() - 3 * 86_400_000) },
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
