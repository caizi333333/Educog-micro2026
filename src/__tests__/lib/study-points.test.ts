jest.mock('@/lib/prisma', () => ({
  prisma: {
    userPointsTransaction: { create: jest.fn() },
    user: { update: jest.fn() },
    learningProgress: { aggregate: jest.fn() },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

import { prisma } from '@/lib/prisma';
import { POINTS_CONFIG } from '@/lib/points-system';
import {
  awardDailyLogin,
  awardTimeMilestones,
  describeStudyPoints,
  recordStudySessionPoints,
} from '@/lib/study-points';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('study points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.learningProgress.aggregate as jest.Mock).mockResolvedValue({ _sum: { timeSpent: 480 } });
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  });

  it('explains why a few hundred seconds do not mint a time milestone', () => {
    const status = describeStudyPoints(480);

    expect(status.completedMilestones).toBe(0);
    expect(status.dailyLoginPoints).toBe(POINTS_CONFIG.DAILY_LOGIN);
    expect(status.pointsPerMilestone).toBe(POINTS_CONFIG.TIME_MILESTONE);
    expect(status.note).toContain('每天一次');
    expect(status.note).toContain('时长积分尚未入账');
    expect(describeStudyPoints(3600).note).toContain('已满 1 小时');
  });

  it('awards daily login once per campus day', async () => {
    const now = new Date('2026-10-26T16:30:00.000Z');
    const first = await awardDailyLogin('student-1', now, 'learning-progress');

    expect(first).toMatchObject({ awarded: true, duplicate: false, points: 10, dateKey: '2026-10-27' });
    const created = (mockPrisma.userPointsTransaction.create as jest.Mock).mock.calls[0][0].data;
    expect(created.type).toBe('DAILY_LOGIN');
    expect(created.id).toMatch(/^pt_/);

    (mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });
    const second = await awardDailyLogin('student-1', now, 'login');
    expect(second).toMatchObject({ awarded: false, duplicate: true, points: 0, dateKey: '2026-10-27' });
  });

  it('awards one time milestone per newly completed hour and ignores a short session', async () => {
    expect(await awardTimeMilestones('student-1', 400, 900)).toBe(0);
    expect(mockPrisma.userPointsTransaction.create).not.toHaveBeenCalled();

    const awarded = await awardTimeMilestones('student-1', 3500, 7300);
    expect(awarded).toBe(POINTS_CONFIG.TIME_MILESTONE * 2);
    const hours = (mockPrisma.userPointsTransaction.create as jest.Mock).mock.calls.map((call) => call[0].data.description);
    expect(hours).toEqual(['累计学习满 1 小时', '累计学习满 2 小时']);
  });

  it('records daily login for a student study increment under one hour', async () => {
    const status = await recordStudySessionPoints({
      userId: 'student-1',
      role: 'STUDENT',
      acceptedTimeIncrement: 480,
      now: new Date('2026-10-26T16:30:00.000Z'),
    });

    expect(status.dailyLoginAwarded).toBe(true);
    expect(status.timeMilestoneAwarded).toBe(0);
    expect(status.totalStudySeconds).toBe(480);
    expect(status.note).toContain('时长积分尚未入账');
  });

  it('does not award study points to a non-student', async () => {
    const status = await recordStudySessionPoints({
      userId: 'teacher-1',
      role: 'TEACHER',
      acceptedTimeIncrement: 480,
      now: new Date('2026-10-26T16:30:00.000Z'),
    });

    expect(status.dailyLoginAwarded).toBe(false);
    expect(mockPrisma.userPointsTransaction.create).not.toHaveBeenCalled();
  });
});
