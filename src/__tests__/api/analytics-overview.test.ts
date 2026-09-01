import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analytics/overview/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements-v2';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/classroom', () => ({ getAccessibleClassIds: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    quizAttempt: { findMany: jest.fn() },
    learningProgress: { findMany: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    userExperiment: { findMany: jest.fn() },
    classEnrollment: { findMany: jest.fn() },
  },
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('GET /api/analytics/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    (mockPrisma.learningProgress.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      totalPoints: 0,
      achievements: [],
      _count: { experiments: 0, quizAttempts: 2, achievements: 0, learningPaths: 0 },
    });
    (mockPrisma.userExperiment.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('uses the stored 0-100 quiz score directly when calculating the average', async () => {
    (mockPrisma.quizAttempt.findMany as jest.Mock).mockResolvedValue([
      { id: 'a1', score: 80, totalQuestions: 20, completedAt: new Date() },
      { id: 'a2', score: 60, totalQuestions: 10, completedAt: new Date() },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/analytics/overview', {
      headers: { authorization: 'Bearer valid-token' },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.avgQuizScore).toBe(70);
    expect(data.dataProvenance.mode).toMatch(/^(DEMO|REAL|MIXED)$/);
    expect(data.asOf).toEqual(expect.any(String));
    expect(data.sampleSize.quizAttempts).toBe(2);
  });

  it('uses the current achievement catalog instead of raw legacy rows', async () => {
    const knownAchievementId = ALL_ACHIEVEMENTS[0]!.id;
    (mockPrisma.quizAttempt.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      totalPoints: 0,
      achievements: [
        { achievementId: knownAchievementId },
        { achievementId: 'retired-legacy-achievement' },
      ],
      _count: { experiments: 0, quizAttempts: 0, achievements: 29, learningPaths: 0 },
    });

    const response = await GET(new NextRequest('http://localhost/api/analytics/overview', {
      headers: { authorization: 'Bearer valid-token' },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.summary.totalAchievements).toBe(1);
    expect(data.sampleSize.achievementRecords).toBe(1);
    expect(data.sampleSize.achievementRules).toBe(ALL_ACHIEVEMENTS.length);
  });
});
