import { POST } from '@/app/api/practice/match/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { INTERRUPT_SOURCE_FLAG_BOARD } from '@/lib/practice-match';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/classroom', () => ({
  getActiveClassIdForUser: jest.fn().mockResolvedValue('class-1'),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    learningEvent: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    userPointsTransaction: { create: jest.fn(), createMany: jest.fn() },
    user: { update: jest.fn(), findUnique: jest.fn() },
    userAchievement: { createManyAndReturn: jest.fn() },
    userActivity: { createMany: jest.fn() },
    achievementAuditLog: { createMany: jest.fn() },
  },
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

function solvedPlacements(): Record<string, string> {
  return Object.fromEntries(INTERRUPT_SOURCE_FLAG_BOARD.pairs.map((pair) => [pair.id, pair.id]));
}

function post(body: unknown, authorization = 'Bearer token'): Promise<Response> {
  return POST(new Request('http://localhost/api/practice/match', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  }));
}

describe('POST /api/practice/match', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 's@example.com', role: 'STUDENT' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(0);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.learningEvent.create as jest.Mock).mockResolvedValue({ id: 'event-1' });
    (prisma.userPointsTransaction.create as jest.Mock).mockResolvedValue({ id: 'points-1' });
    (prisma.userPointsTransaction.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ totalPoints: 25 });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([
      { achievementId: 'interrupt_source_flags' },
    ]);
    (prisma.userActivity.createMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.achievementAuditLog.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  it('rejects a missing token', async () => {
    const response = await POST(new Request('http://localhost/api/practice/match', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401);
  });

  it('does not write points when a flag is on the wrong source', async () => {
    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: { ...solvedPlacements(), int0: 'uart', uart: 'int0' },
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.correct).toBe(false);
    expect(body.pointsAwarded).toBe(0);
    expect(body.medal).toBeNull();
    expect(body.message).toContain('SCON');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('awards first-clear points and the catalog medal for a student', async () => {
    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 25,
      totalPoints: 25,
      medal: { id: 'interrupt_source_flags', title: '中断标志对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「中断标志对上了」+10。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u5-interrupt-source-flags',
        chapterId: '5',
        userId: 'student-1',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'PRACTICE_CLEAR', points: 15 }),
    }));
    expect(prisma.userPointsTransaction.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ type: 'ACHIEVEMENT_UNLOCK', points: 10 })],
    }));
  });

  it('keeps a second clear inside the cooldown from writing another event', async () => {
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });

    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    const body = await response.json();
    expect(body.reason).toBe('cooldown');
    expect(body.pointsAwarded).toBe(0);
    expect(body.medal).toBeNull();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
  });

  it('lets a teacher play without a student ledger row', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 't@example.com', role: 'TEACHER' });
    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    const body = await response.json();
    expect(body.reason).toBe('preview');
    expect(body.pointsAwarded).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('treats a repeated first-clear write as already recorded', async () => {
    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2002' });
    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reason: 'cooldown', pointsAwarded: 0 });
  });

  it('returns 404 for an unknown board', async () => {
    const response = await post({ boardId: 'not-a-board', placements: {} });
    expect(response.status).toBe(404);
  });
});
