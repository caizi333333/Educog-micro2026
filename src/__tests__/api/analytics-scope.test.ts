import { NextRequest } from 'next/server';
import { GET as getLearningGains } from '@/app/api/analytics/learning-gains/route';
import { GET as getAiUsage } from '@/app/api/analytics/ai-usage/route';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/classroom', () => ({ getAccessibleClassIds: jest.fn() }));

const requestAt = (path: string): NextRequest => ({
  headers: new Headers({ authorization: 'Bearer valid-token' }),
  url: `http://localhost${path}?asOf=2026-08-16T08%3A00%3A00.000Z`,
} as NextRequest);

describe('teacher analytics sample scope', () => {
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
  const mockGetAccessibleClassIds = getAccessibleClassIds as jest.MockedFunction<typeof getAccessibleClassIds>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({
      userId: 'teacher-1',
      email: 'teacher@example.com',
      role: 'TEACHER',
    });
    mockGetAccessibleClassIds.mockResolvedValue(['class-1']);

    const prisma = (globalThis as any).__mockPrisma;
    prisma.classEnrollment.findMany.mockResolvedValue([
      { userId: 'student-1', user: { username: 'student_1' } },
      { userId: 'demo-1', user: { username: 'demo_student' } },
    ]);
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    prisma.userExperiment.findMany.mockResolvedValue([]);
    prisma.learningProgress.findMany.mockResolvedValue([]);
    prisma.learningEvent.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([{ id: 'student-1', name: '学生甲' }]);
  });

  it('reports roster inclusion and keeps missing duration out of the time grouping', async () => {
    const prisma = (globalThis as any).__mockPrisma;
    prisma.quizAttempt.findMany.mockResolvedValue([{
      userId: 'student-1', quizId: 'quiz-addressing', score: 0,
      completedAt: new Date('2026-08-15T08:00:00.000Z'),
    }]);
    prisma.learningProgress.findMany.mockResolvedValue([{
      userId: 'student-1', chapterId: '3', progress: 0, timeSpent: 0,
    }]);

    const response = await getLearningGains(requestAt('/api/analytics/learning-gains'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scope).toMatchObject({
      asOf: '2026-08-16T08:00:00.000Z',
      enrolledStudentCount: 2,
      includedStudentCount: 1,
      excludedStudentCount: 1,
      exclusions: [{ code: 'DEMO_ACCOUNT', count: 1 }],
      metricSamples: {
        quizStudents: 1,
        learningTimeStudents: 0,
        experimentStudents: 0,
        repeatedAttemptStudents: 0,
      },
    });
    expect(data.scoreSummary).toEqual({ avg: 0, total: 1 });
    expect(data.scoreDistribution[0]).toMatchObject({ label: '<60', count: 1 });
    expect(data.timeCorrelation).toEqual([]);
    expect(prisma.quizAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: { in: ['student-1'] } }),
    }));
  });

  it('does not rank an AI user who has no quiz record', async () => {
    const prisma = (globalThis as any).__mockPrisma;
    prisma.learningEvent.findMany.mockResolvedValue([{
      userId: 'student-1', createdAt: new Date('2026-08-15T08:00:00.000Z'),
    }]);

    const response = await getAiUsage(requestAt('/api/analytics/ai-usage'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.scope).toMatchObject({
      enrolledStudentCount: 2,
      includedStudentCount: 1,
      excludedStudentCount: 1,
      metricSamples: {
        quizStudents: 0,
        aiUsageStudents: 1,
        rankedStudents: 0,
      },
    });
    expect(data.summary.avgAiUserScore).toBeNull();
    expect(data.summary.scoreDifference).toBeNull();
    expect(data.topAiStudents).toEqual([]);
    expect(prisma.learningEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: { in: ['student-1'] } }),
    }));
  });

  it('uses the same best-score-per-quiz aggregation for dashboard-facing analyses', async () => {
    const prisma = (globalThis as any).__mockPrisma;
    prisma.quizAttempt.findMany.mockResolvedValue([
      { userId: 'student-1', quizId: 'quiz-1', score: 40, completedAt: new Date('2026-08-14T08:00:00.000Z') },
      { userId: 'student-1', quizId: 'quiz-1', score: 80, completedAt: new Date('2026-08-15T08:00:00.000Z') },
      { userId: 'student-1', quizId: 'quiz-2', score: 60, completedAt: new Date('2026-08-16T07:00:00.000Z') },
    ]);

    const response = await getLearningGains(requestAt('/api/analytics/learning-gains'));
    const data = await response.json();

    expect(data.scoreAggregation).toBe('BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN');
    expect(data.scoreSummary).toEqual({ avg: 70, total: 1 });
    expect(data.prePostComparison).toEqual([
      expect.objectContaining({ name: '学生甲', firstScore: 40, latestScore: 80, gain: 40 }),
    ]);
    expect(data.scope.metricSamples.repeatedAttemptStudents).toBe(1);
  });

  it('rejects an invalid cutoff instead of silently changing the report window', async () => {
    const response = await getLearningGains({
      headers: new Headers({ authorization: 'Bearer valid-token' }),
      url: 'http://localhost/api/analytics/learning-gains?asOf=not-a-date',
    } as NextRequest);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: '数据截止时间格式无效' });
  });
});
