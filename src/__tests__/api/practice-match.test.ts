import { POST } from '@/app/api/practice/match/route';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { POINTS_CONFIG } from '@/lib/points-system';
import { ADDRESSING_MODE_BOARD, CPU_STRUCTURE_BOARD, EXTERNAL_BUS_BOARD, INSTRUCTION_TEAMS_BOARD, INTERRUPT_IE_ENABLE_BOARD, INTERRUPT_SOURCE_FLAG_BOARD, INTERRUPT_VECTOR_BOARD, MEMORY_REGION_BOARD, TCON_CONTROL_BITS_BOARD, TIMER_TMOD_BOARD } from '@/lib/practice-match';
import { PRACTICE_DAILY_MEDAL_ID, PRACTICE_STREAK_MEDAL_ID } from '@/lib/practice-medals';

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

function solvedPlacements(board = INTERRUPT_SOURCE_FLAG_BOARD): Record<string, string> {
  return Object.fromEntries(board.pairs.map((pair) => [pair.id, pair.id]));
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
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockImplementation(async (args: { data?: { achievementId: string }[] }) => (
      (args?.data ?? []).map((row) => ({ achievementId: row.achievementId }))
    ));
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
      pointsAwarded: 30,
      totalPoints: 25,
      medal: { id: 'interrupt_source_flags', title: '中断标志对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「中断标志对上了」+10、「今天练过了」+5。');
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
    expect(prisma.userAchievement.createManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({ achievementId: 'interrupt_source_flags', points: 10 }),
        expect.objectContaining({ achievementId: 'practice_daily', points: 5 }),
      ],
    }));
    expect(prisma.userPointsTransaction.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({ type: 'ACHIEVEMENT_UNLOCK', points: 10 }),
        expect.objectContaining({ type: 'ACHIEVEMENT_UNLOCK', points: 5 }),
      ],
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

  it('awards first-clear points and the addressing medal without touching the interrupt medal', async () => {
    const response = await post({
      boardId: ADDRESSING_MODE_BOARD.id,
      placements: solvedPlacements(ADDRESSING_MODE_BOARD),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'addressing_modes', title: '寻址方式对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「寻址方式对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u3-addressing-modes',
        chapterId: '3',
        moduleId: 'u3-overview',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第3章练一练首次对上：指令 ↔ 寻址方式',
      }),
    }));
    const grantedIds = (prisma.userAchievement.createManyAndReturn as jest.Mock).mock.calls[0]?.[0]?.data
      .map((row: { achievementId: string }) => row.achievementId);
    expect(grantedIds).toEqual(['addressing_modes', 'practice_daily']);
  });

  it('does not write points when two addressing modes are swapped', async () => {
    const response = await post({
      boardId: ADDRESSING_MODE_BOARD.id,
      placements: { ...solvedPlacements(ADDRESSING_MODE_BOARD), imm: 'dir', dir: 'imm' },
    });
    const body = await response.json();
    expect(body.correct).toBe(false);
    expect(body.pointsAwarded).toBe(0);
    expect(body.medal).toBeNull();
    expect(body.message).toContain('@Ri');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cools down a second addressing clear and treats a duplicate first write as already recorded', async () => {
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });
    const cooled = await post({
      boardId: ADDRESSING_MODE_BOARD.id,
      placements: solvedPlacements(ADDRESSING_MODE_BOARD),
    });
    expect(await cooled.json()).toMatchObject({ reason: 'cooldown', pointsAwarded: 0, medal: null });
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();

    (prisma.$transaction as jest.Mock).mockRejectedValue({ code: 'P2002' });
    const duplicate = await post({
      boardId: ADDRESSING_MODE_BOARD.id,
      placements: solvedPlacements(ADDRESSING_MODE_BOARD),
    });
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({ reason: 'cooldown', pointsAwarded: 0 });
  });

  it('unlocks 连对三次 on the third recorded clear and does not add practice points', async () => {
    mockClearHistory({
      count: 2,
      lastClearAt: new Date(Date.now() - INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs),
      clearEarlierToday: true,
    });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([
      { achievementId: PRACTICE_STREAK_MEDAL_ID },
    ]);

    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    const body = await response.json();
    expect(body).toMatchObject({
      reason: 'repeat',
      pointsAwarded: POINTS_CONFIG.PRACTICE_MATCH_STREAK,
      medal: { id: 'practice_streak_3', title: '连对三次', points: POINTS_CONFIG.PRACTICE_MATCH_STREAK },
    });
    expect(body.message).toBe('又对上一次。学习记录已记下，解锁勋章「连对三次」+20。');
    expect(requestedMedalIds()).toEqual(['interrupt_source_flags', 'practice_streak_3']);
    expect(prisma.learningEvent.create).toHaveBeenCalled();
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
  });

  it('does not grant 连对三次 again once that medal is already owned', async () => {
    mockClearHistory({
      count: 3,
      lastClearAt: new Date(Date.now() - INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs),
      clearEarlierToday: true,
    });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([]);

    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    const body = await response.json();
    expect(body).toMatchObject({ reason: 'repeat', pointsAwarded: 0, medal: null });
    expect(body.message).toBe('又对上一次。学习记录已记下，这道题的首次积分不再发放。');
    expect(requestedMedalIds()).toEqual(['interrupt_source_flags', 'practice_streak_3']);
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
    expect(prisma.userPointsTransaction.createMany).not.toHaveBeenCalled();
  });

  it('does not count a clear inside the cooldown toward 连对三次', async () => {
    mockClearHistory({
      count: 2,
      lastClearAt: new Date(),
      clearEarlierToday: true,
    });

    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    const body = await response.json();
    expect(body.reason).toBe('cooldown');
    expect(body.pointsAwarded).toBe(0);
    expect(body.medal).toBeNull();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    expect(prisma.userAchievement.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('does not grant 今天练过了 again on another board the same campus day', async () => {
    mockClearHistory({ count: 0, lastClearAt: null, clearEarlierToday: true });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([
      { achievementId: 'addressing_modes' },
    ]);

    const response = await post({
      boardId: ADDRESSING_MODE_BOARD.id,
      placements: solvedPlacements(ADDRESSING_MODE_BOARD),
    });
    const body = await response.json();
    expect(body).toMatchObject({
      reason: 'first_clear',
      pointsAwarded: 25,
      medal: { id: 'addressing_modes', title: '寻址方式对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「寻址方式对上了」+10。');
    expect(requestedMedalIds()).toEqual(['addressing_modes']);
    expect(requestedMedalIds()).not.toContain(PRACTICE_DAILY_MEDAL_ID);
  });

  it('scores the CPU puzzle through the same match route, including a miss with no points', async () => {
    const missed = await post({
      boardId: CPU_STRUCTURE_BOARD.id,
      placements: { ...solvedPlacements(CPU_STRUCTURE_BOARD), pc: 'dptr', dptr: 'pc' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('0000H');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: CPU_STRUCTURE_BOARD.id,
      placements: solvedPlacements(CPU_STRUCTURE_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'cpu_structure_home', title: 'CPU 结构归位', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「CPU 结构归位」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u2-cpu-structure',
        targetType: 'PRACTICE',
        chapterId: '2',
        moduleId: 'u2-cpu-structure',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第2章练一练首次对上：CPU 结构拼图',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['cpu_structure_home', 'practice_daily']);
  });

  it('scores the vector-address match through the same route and pays nothing for a miss', async () => {
    const missed = await post({
      boardId: INTERRUPT_VECTOR_BOARD.id,
      placements: { ...solvedPlacements(INTERRUPT_VECTOR_BOARD), int0: 't0', t0: 'int0' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('8 字节');
    expect(missedBody.message).not.toContain('0003H');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: INTERRUPT_VECTOR_BOARD.id,
      placements: solvedPlacements(INTERRUPT_VECTOR_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'interrupt_vectors', title: '向量地址对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「向量地址对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u5-interrupt-vectors',
        targetType: 'PRACTICE',
        chapterId: '5',
        moduleId: 'u5-overview',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第5章练一练首次对上：中断源 ↔ 向量地址',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['interrupt_vectors', 'practice_daily']);
  });

  it('scores the IE enable match: a miss pays 0, the first clear pays, a cooldown pays 0', async () => {
    const missed = await post({
      boardId: INTERRUPT_IE_ENABLE_BOARD.id,
      placements: { ...solvedPlacements(INTERRUPT_IE_ENABLE_BOARD), ex0: 'et0', et0: 'ex0' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('总开关');
    expect(missedBody.message).not.toContain('EX0');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: INTERRUPT_IE_ENABLE_BOARD.id,
      placements: solvedPlacements(INTERRUPT_IE_ENABLE_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'interrupt_ie_enables', title: '允许位对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「允许位对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u5-interrupt-ie-enables',
        targetType: 'PRACTICE',
        chapterId: '5',
        moduleId: 'u5-overview',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第5章练一练首次对上：IE 允许位 ↔ 中断源',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['interrupt_ie_enables', 'practice_daily']);

    (prisma.learningEvent.create as jest.Mock).mockClear();
    (prisma.userPointsTransaction.create as jest.Mock).mockClear();
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });
    const cooled = await post({
      boardId: INTERRUPT_IE_ENABLE_BOARD.id,
      placements: solvedPlacements(INTERRUPT_IE_ENABLE_BOARD),
    });
    const cooledBody = await cooled.json();
    expect(cooledBody.reason).toBe('cooldown');
    expect(cooledBody.pointsAwarded).toBe(0);
    expect(cooledBody.medal).toBeNull();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
  });

  it('scores the TCON bit match: a miss pays 0, the first clear pays, a cooldown pays 0', async () => {
    const missed = await post({
      boardId: TCON_CONTROL_BITS_BOARD.id,
      placements: { ...solvedPlacements(TCON_CONTROL_BITS_BOARD), tr0: 'tr1', tr1: 'tr0' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('只看 TR');
    expect(missedBody.message).not.toContain('TR0');
    expect(missedBody.message).not.toContain('IE0');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: TCON_CONTROL_BITS_BOARD.id,
      placements: solvedPlacements(TCON_CONTROL_BITS_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'tcon_control_bits', title: 'TCON 对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「TCON 对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u5-tcon-control-bits',
        targetType: 'PRACTICE',
        chapterId: '5',
        moduleId: 'u5-overview',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第5章练一练首次对上：TCON 位 ↔ 含义',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['tcon_control_bits', 'practice_daily']);

    (prisma.learningEvent.create as jest.Mock).mockClear();
    (prisma.userPointsTransaction.create as jest.Mock).mockClear();
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });
    const cooled = await post({
      boardId: TCON_CONTROL_BITS_BOARD.id,
      placements: solvedPlacements(TCON_CONTROL_BITS_BOARD),
    });
    const cooledBody = await cooled.json();
    expect(cooledBody.reason).toBe('cooldown');
    expect(cooledBody.pointsAwarded).toBe(0);
    expect(cooledBody.medal).toBeNull();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
  });

  it('scores the TMOD match through the same route and pays nothing for a miss', async () => {
    const missed = await post({
      boardId: TIMER_TMOD_BOARD.id,
      placements: { ...solvedPlacements(TIMER_TMOD_BOARD), mode0: 'mode1', mode1: 'mode0' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('高 4 位管 T1');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: TIMER_TMOD_BOARD.id,
      placements: solvedPlacements(TIMER_TMOD_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'timer_tmod_modes', title: 'TMOD 对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「TMOD 对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u5-timer-tmod-modes',
        targetType: 'PRACTICE',
        chapterId: '5',
        moduleId: 'u5-overview',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第5章练一练首次对上：TMOD 字段 ↔ 含义',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['timer_tmod_modes', 'practice_daily']);
  });

  it('scores the memory-region match through the same route', async () => {
    const missed = await post({
      boardId: MEMORY_REGION_BOARD.id,
      placements: { ...solvedPlacements(MEMORY_REGION_BOARD), bit: 'sfr', sfr: 'bit' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.message).toContain('MOVX');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: MEMORY_REGION_BOARD.id,
      placements: solvedPlacements(MEMORY_REGION_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'memory_regions', title: '存储区分清了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「存储区分清了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u2-memory-regions',
        targetType: 'PRACTICE',
        chapterId: '2',
        moduleId: 'u2-memory',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第2章练一练首次对上：存储区 ↔ 含义',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['memory_regions', 'practice_daily']);
  });

  it('scores the external-bus match: a miss pays 0, the first clear pays, a cooldown pays 0', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-bus', email: 's@example.com', role: 'STUDENT' });
    const missed = await post({
      boardId: EXTERNAL_BUS_BOARD.id,
      placements: { ...solvedPlacements(EXTERNAL_BUS_BOARD), p0: 'p2', p2: 'p0' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('不分时就不需要锁存');
    expect(missedBody.message).not.toContain('74LS373');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: EXTERNAL_BUS_BOARD.id,
      placements: solvedPlacements(EXTERNAL_BUS_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'external_bus', title: '总线对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「总线对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u2-external-bus',
        targetType: 'PRACTICE',
        chapterId: '2',
        moduleId: 'u2-bus',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第2章练一练首次对上：总线角色 ↔ 含义',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['external_bus', 'practice_daily']);

    (prisma.learningEvent.create as jest.Mock).mockClear();
    (prisma.userPointsTransaction.create as jest.Mock).mockClear();
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });
    const cooled = await post({
      boardId: EXTERNAL_BUS_BOARD.id,
      placements: solvedPlacements(EXTERNAL_BUS_BOARD),
    });
    const cooledBody = await cooled.json();
    expect(cooledBody.reason).toBe('cooldown');
    expect(cooledBody.pointsAwarded).toBe(0);
    expect(cooledBody.medal).toBeNull();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
  });

  it('scores the instruction-team match: a miss pays 0, the first clear pays, a cooldown pays 0', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'student-teams', email: 's@example.com', role: 'STUDENT' });
    const missed = await post({
      boardId: INSTRUCTION_TEAMS_BOARD.id,
      placements: { ...solvedPlacements(INSTRUCTION_TEAMS_BOARD), mov: 'alu', alu: 'mov' },
    });
    const missedBody = await missed.json();
    expect(missedBody.correct).toBe(false);
    expect(missedBody.pointsAwarded).toBe(0);
    expect(missedBody.medal).toBeNull();
    expect(missedBody.message).toContain('只碰一位');
    expect(missedBody.message).not.toContain('MOV A,Rn');
    expect(prisma.$transaction).not.toHaveBeenCalled();

    const cleared = await post({
      boardId: INSTRUCTION_TEAMS_BOARD.id,
      placements: solvedPlacements(INSTRUCTION_TEAMS_BOARD),
    });
    const body = await cleared.json();
    expect(body).toMatchObject({
      correct: true,
      reason: 'first_clear',
      pointsAwarded: 30,
      medal: { id: 'instruction_teams', title: '指令大类对上了', points: 10 },
    });
    expect(body.message).toBe('首次对上：+15 积分，解锁勋章「指令大类对上了」+10、「今天练过了」+5。');
    expect(prisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'PRACTICE_CLEAR',
        targetId: 'u4-instruction-teams',
        targetType: 'PRACTICE',
        chapterId: '4',
        moduleId: 'u4-classroom',
      }),
    }));
    expect(prisma.userPointsTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PRACTICE_CLEAR',
        points: 15,
        description: '第4章练一练首次对上：指令大类 ↔ 代表指令',
      }),
    }));
    expect(requestedMedalIds()).toEqual(['instruction_teams', 'practice_daily']);

    (prisma.learningEvent.create as jest.Mock).mockClear();
    (prisma.userPointsTransaction.create as jest.Mock).mockClear();
    (prisma.learningEvent.count as jest.Mock).mockResolvedValue(1);
    (prisma.learningEvent.findFirst as jest.Mock).mockResolvedValue({ createdAt: new Date() });
    const cooled = await post({
      boardId: INSTRUCTION_TEAMS_BOARD.id,
      placements: solvedPlacements(INSTRUCTION_TEAMS_BOARD),
    });
    const cooledBody = await cooled.json();
    expect(cooledBody.reason).toBe('cooldown');
    expect(cooledBody.pointsAwarded).toBe(0);
    expect(cooledBody.medal).toBeNull();
    expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
  });

  it('does not pay 今天练过了 twice when a later campus day asks again', async () => {
    mockClearHistory({
      count: 1,
      lastClearAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      clearEarlierToday: false,
    });
    (prisma.userAchievement.createManyAndReturn as jest.Mock).mockResolvedValue([]);

    const response = await post({
      boardId: INTERRUPT_SOURCE_FLAG_BOARD.id,
      placements: solvedPlacements(),
    });
    const body = await response.json();
    expect(body).toMatchObject({ reason: 'repeat', pointsAwarded: 0, medal: null });
    expect(requestedMedalIds()).toEqual(['interrupt_source_flags', PRACTICE_DAILY_MEDAL_ID]);
    expect(prisma.userPointsTransaction.create).not.toHaveBeenCalled();
    expect(prisma.userPointsTransaction.createMany).not.toHaveBeenCalled();
  });
});

function mockClearHistory(input: {
  count: number;
  lastClearAt: Date | null;
  clearEarlierToday: boolean;
}): void {
  (prisma.learningEvent.count as jest.Mock).mockResolvedValue(input.count);
  (prisma.learningEvent.findFirst as jest.Mock).mockImplementation(async (args: { where?: { createdAt?: unknown } }) => {
    if (args?.where?.createdAt) return input.clearEarlierToday ? { id: 'earlier-today' } : null;
    return input.lastClearAt ? { createdAt: input.lastClearAt } : null;
  });
}

function requestedMedalIds(): string[] {
  const call = (prisma.userAchievement.createManyAndReturn as jest.Mock).mock.calls.at(-1);
  const data = call?.[0]?.data as { achievementId: string }[] | undefined;
  return (data ?? []).map((row) => row.achievementId);
}
