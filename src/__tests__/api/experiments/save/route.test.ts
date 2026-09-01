import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/experiments/save/route';
import { verifyToken } from '@/lib/auth';
import { ADDRESSING_TASK_PRESET } from '@/lib/lesson-tasks';
import { emptyProj04CompletionEvidence, PROJ04_MIN_OBSERVATION_STEPS } from '@/lib/experiment-config';

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

describe('/api/experiments/save', () => {
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;

  function completedProj04Evidence(): ReturnType<typeof emptyProj04CompletionEvidence> {
    const evidence = emptyProj04CompletionEvidence();
    evidence.milestones = evidence.milestones.map((item) => ({
      ...item,
      confirmed: true,
      confirmedAt: '2026-08-16T08:00:00.000Z',
    }));
    evidence.updatedAt = '2026-08-16T08:00:00.000Z';
    return evidence;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    const prisma = (globalThis as any).__mockPrisma;
    prisma.userExperiment.findUnique.mockResolvedValue(null);
    prisma.userExperiment.create.mockResolvedValue({
      id: 1,
      experimentId: 'exp01',
      status: 'COMPLETED',
      attempts: 1,
      timeSpent: 10,
      completedAt: new Date(),
    });
    prisma.userExperiment.update.mockResolvedValue({
      id: 1,
      experimentId: 'exp01',
      status: 'COMPLETED',
      attempts: 2,
      timeSpent: 20,
      completedAt: new Date(),
    });
    prisma.userExperiment.upsert.mockResolvedValue({
      id: 1,
      experimentId: 'exp01',
      status: 'COMPLETED',
      attempts: 2,
      timeSpent: 20,
      completedAt: new Date(),
    });
    prisma.userExperiment.findMany.mockResolvedValue([]);
    prisma.userActivity.findUnique.mockResolvedValue(null);
  });

  describe('POST', () => {
    it('损坏的 JSON 应返回参数错误而不是服务器错误', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: 'invalid json',
      }));
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: '实验记录参数格式无效' });
    });

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

    it('实验任务编号和步骤编号必须成对提交', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02',
          pathId: 'path-addressing',
          status: 'COMPLETED',
          completionKey: 'experiment:path-addressing:missing-step',
        }),
      }));

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('任务上下文不完整') });
      expect(prisma.userExperiment.findUnique).not.toHaveBeenCalled();
    });

    it('非课程正式实验编号不得写入', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ experimentId: 'forged-exp', code: 'abc' }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('实验编号不存在');
      expect(prisma.userExperiment.findUnique).not.toHaveBeenCalled();
      expect(prisma.userExperiment.create).not.toHaveBeenCalled();
      expect(prisma.userExperiment.update).not.toHaveBeenCalled();
      expect(prisma.userExperiment.upsert).not.toHaveBeenCalled();
    });

    it('应创建新实验记录', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'abc', status: 'COMPLETED', timeSpent: 10,
          completionKey: 'experiment:standalone:exp01',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userExperiment.upsert).toHaveBeenCalled();
      expect(data.experiment.experimentId).toBe('exp01');
      const completionActivity = prisma.userActivity.create.mock.calls[0][0].data;
      expect(JSON.parse(completionActivity.details)).toMatchObject({
        experimentId: 'exp01', completionKey: 'experiment:standalone:exp01', requestFingerprint: expect.any(String),
      });
    });

    it('应更新已有实验记录', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 1,
        experimentId: 'exp01',
        status: 'IN_PROGRESS',
        attempts: 1,
        timeSpent: 10,
        completedAt: null,
        results: null,
      });

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'abc', status: 'COMPLETED', timeSpent: 10,
          completionKey: 'experiment:standalone:exp01',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.userExperiment.upsert).toHaveBeenCalled();
    });

    it('草稿保存应使用服务端更新时间执行乐观并发校验', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const baseUpdatedAt = new Date('2026-07-19T08:00:00.000Z');
      const savedUpdatedAt = new Date('2026-07-19T08:01:00.000Z');
      prisma.userExperiment.findUnique
        .mockResolvedValueOnce({
          id: 'draft-exp02', userId: '1', experimentId: 'exp02', status: 'IN_PROGRESS',
          startedAt: baseUpdatedAt, completedAt: null, lastCode: 'OLD', updatedAt: baseUpdatedAt,
        })
        .mockResolvedValueOnce({
          id: 'draft-exp02', userId: '1', experimentId: 'exp02', status: 'IN_PROGRESS',
          startedAt: baseUpdatedAt, completedAt: null, lastCode: 'NEW', updatedAt: savedUpdatedAt,
        });
      prisma.userExperiment.updateMany.mockResolvedValueOnce({ count: 1 });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02', intent: 'DRAFT', status: 'IN_PROGRESS', code: 'NEW',
          baseUpdatedAt: baseUpdatedAt.toISOString(),
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        experiment: { experimentId: 'exp02', status: 'IN_PROGRESS' },
        draft: { code: 'NEW', updatedAt: savedUpdatedAt.toISOString() },
      });
      expect(prisma.userExperiment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: 'draft-exp02',
          updatedAt: baseUpdatedAt,
          status: { not: 'COMPLETED' },
        },
        data: expect.objectContaining({ lastCode: 'NEW', status: 'IN_PROGRESS' }),
      }));
      expect(prisma.userActivity.create).not.toHaveBeenCalled();
      expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    });

    it('过期草稿版本不得覆盖另一页面刚保存的代码', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const staleUpdatedAt = new Date('2026-07-19T08:00:00.000Z');
      const currentUpdatedAt = new Date('2026-07-19T08:02:00.000Z');
      prisma.userExperiment.findUnique
        .mockResolvedValueOnce({
          id: 'draft-exp02', userId: '1', experimentId: 'exp02', status: 'IN_PROGRESS',
          startedAt: staleUpdatedAt, completedAt: null, lastCode: 'OLD', updatedAt: staleUpdatedAt,
        })
        .mockResolvedValueOnce({
          id: 'draft-exp02', userId: '1', experimentId: 'exp02', status: 'IN_PROGRESS',
          startedAt: staleUpdatedAt, completedAt: null, lastCode: 'OTHER TAB', updatedAt: currentUpdatedAt,
        });
      prisma.userExperiment.updateMany.mockResolvedValueOnce({ count: 0 });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02', intent: 'DRAFT', status: 'IN_PROGRESS', code: 'LOCAL',
          baseUpdatedAt: staleUpdatedAt.toISOString(),
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data).toEqual({
        error: '另一个页面已保存更新，请选择要保留的草稿',
        code: 'DRAFT_CONFLICT',
        serverDraft: {
          code: 'OTHER TAB',
          updatedAt: currentUpdatedAt.toISOString(),
          status: 'IN_PROGRESS',
        },
      });
      expect(prisma.userExperiment.update).not.toHaveBeenCalled();
      expect(prisma.userExperiment.upsert).not.toHaveBeenCalled();
    });

    it('已完成实验的提交代码不得被草稿保存改写', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const completedAt = new Date('2026-07-18T01:00:00.000Z');
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'completed-exp02', userId: '1', experimentId: 'exp02', status: 'COMPLETED',
        attempts: 1, timeSpent: 100, startedAt: new Date('2026-07-18T00:00:00.000Z'),
        completedAt, lastCode: 'SUBMITTED', updatedAt: completedAt,
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02', intent: 'DRAFT', status: 'IN_PROGRESS', code: 'EDITED',
          baseUpdatedAt: completedAt.toISOString(),
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({
        success: true,
        readOnly: true,
        experiment: { status: 'COMPLETED' },
        draft: { code: 'SUBMITTED' },
      });
      expect(prisma.userExperiment.updateMany).not.toHaveBeenCalled();
      expect(prisma.userExperiment.update).not.toHaveBeenCalled();
      expect(prisma.userExperiment.upsert).not.toHaveBeenCalled();
    });

    it('课前实验首次进入应幂等迁移为进行中并记录一次开始事件', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'assigned-exp02', userId: '1', experimentId: 'exp02', status: 'ASSIGNED',
        attempts: 0, timeSpent: 0, startedAt: null, completedAt: null, lastCode: null, results: null,
      });
      prisma.userExperiment.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.userActivity.createMany.mockResolvedValueOnce({ count: 1 });
      prisma.learningEvent.createMany.mockResolvedValueOnce({ count: 1 });
      prisma.classEnrollment.findFirst.mockResolvedValueOnce(null);

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ experimentId: 'exp02', status: 'IN_PROGRESS', intent: 'START' }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: false, experiment: { experimentId: 'exp02', status: 'IN_PROGRESS' } });
      expect(prisma.userExperiment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'assigned-exp02', status: { notIn: ['IN_PROGRESS', 'COMPLETED'] } },
        data: expect.objectContaining({ status: 'IN_PROGRESS', startedAt: expect.any(Date), completedAt: null }),
      }));
      expect(prisma.userActivity.createMany).toHaveBeenCalledWith(expect.objectContaining({
        data: [expect.objectContaining({ action: 'START_EXPERIMENT', userId: '1' })],
        skipDuplicates: true,
      }));
      expect(prisma.learningEvent.createMany).toHaveBeenCalledTimes(1);
    });

    it('刷新进行中的课前实验不得重复写开始事件', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'running-exp02', userId: '1', experimentId: 'exp02', status: 'IN_PROGRESS',
        attempts: 0, timeSpent: 0, startedAt: new Date('2026-07-19T00:00:00Z'), completedAt: null,
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ experimentId: 'exp02', status: 'IN_PROGRESS', intent: 'START' }),
      }));
      const data = await res.json();

      expect(data).toMatchObject({ success: true, duplicate: true, experiment: { status: 'IN_PROGRESS' } });
      expect(prisma.userExperiment.updateMany).not.toHaveBeenCalled();
      expect(prisma.userActivity.createMany).not.toHaveBeenCalled();
      expect(prisma.learningEvent.createMany).not.toHaveBeenCalled();
    });

    it('重新进入已完成课前实验不得把记录降级为进行中', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'completed-exp02', userId: '1', experimentId: 'exp02', status: 'COMPLETED',
        attempts: 2, timeSpent: 120, startedAt: new Date('2026-07-18T00:00:00Z'),
        completedAt: new Date('2026-07-18T01:00:00Z'),
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({ experimentId: 'exp02', status: 'IN_PROGRESS', intent: 'START' }),
      }));
      const data = await res.json();

      expect(data).toMatchObject({ success: true, duplicate: true, experiment: { status: 'COMPLETED' } });
      expect(prisma.userExperiment.updateMany).not.toHaveBeenCalled();
      expect(prisma.userExperiment.update).not.toHaveBeenCalled();
      expect(prisma.userActivity.createMany).not.toHaveBeenCalled();
    });

    it('新一次完成不得覆盖旧任务的实验归属记录', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'experiment-1',
        experimentId: 'exp01',
        status: 'COMPLETED',
        attempts: 1,
        timeSpent: 10,
        completedAt: new Date('2026-07-10T00:00:00Z'),
        results: JSON.stringify({
          completionContext: {
            pathId: 'path-old',
            stepId: 'simulation',
          },
        }),
      });

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'abc', status: 'COMPLETED',
          completionKey: 'experiment:standalone:exp01:new-run',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const upsertCall = prisma.userExperiment.upsert.mock.calls[0][0];
      const storedResults = JSON.parse(upsertCall.update.results);
      expect(storedResults.completionContext.completionKey).toBe('experiment:standalone:exp01:new-run');
      expect(storedResults.completionHistory).toEqual(expect.arrayContaining([
        expect.objectContaining({ pathId: 'path-old', stepId: 'simulation' }),
        expect.objectContaining({ completionKey: 'experiment:standalone:exp01:new-run' }),
      ]));
    });

    it('历史完成编号重试应直接恢复且不得增加实验次数', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'experiment-1',
        experimentId: 'exp01',
        status: 'COMPLETED',
        attempts: 3,
        timeSpent: 20,
        completedAt: new Date('2026-07-12T00:00:00Z'),
        results: JSON.stringify({
          completionContext: { completionKey: 'experiment:standalone:exp01:latest' },
          completionHistory: [
            { completionKey: 'experiment:path-old:simulation', pathId: null, stepId: null },
            { completionKey: 'experiment:standalone:exp01:latest', pathId: null, stepId: null },
          ],
        }),
      });

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'abc', status: 'COMPLETED',
          completionKey: 'experiment:path-old:simulation',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });

      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: true, pointsEarned: 0 });
      expect(prisma.userExperiment.update).not.toHaveBeenCalled();
      expect(prisma.userExperiment.create).not.toHaveBeenCalled();
    });

    it('历史数组截断后仍应通过确定性活动回执恢复完成结果', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'experiment-1', experimentId: 'exp01', status: 'COMPLETED', attempts: 25, timeSpent: 200,
        completedAt: new Date('2026-07-12T00:00:00Z'),
        results: JSON.stringify({
          completionContext: { completionKey: 'experiment:latest:exp01' },
          completionHistory: [{ completionKey: 'experiment:latest:exp01' }],
        }),
      });
      prisma.userActivity.findUnique.mockResolvedValueOnce({
        details: JSON.stringify({
          experimentId: 'exp01', completionKey: 'experiment:old:exp01:receipt', pathId: null, stepId: null,
        }),
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'abc', status: 'COMPLETED',
          completionKey: 'experiment:old:exp01:receipt',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: true, pointsEarned: 0 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('确定性活动回执不得接受同一编号对应的不同实验结果', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'experiment-1', experimentId: 'exp01', status: 'COMPLETED', attempts: 1, timeSpent: 10,
        completedAt: new Date('2026-07-12T00:00:00Z'), results: null,
      });
      prisma.userActivity.findUnique.mockResolvedValueOnce({
        details: JSON.stringify({
          experimentId: 'exp01', completionKey: 'experiment:receipt:conflict', pathId: null, stepId: null,
          requestFingerprint: 'different-fingerprint',
        }),
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'changed', status: 'COMPLETED',
          completionKey: 'experiment:receipt:conflict',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('同一完成编号若对应不同实验结果应返回冲突', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'experiment-1', experimentId: 'exp01', status: 'COMPLETED', attempts: 1, timeSpent: 10,
        completedAt: new Date('2026-07-12T00:00:00Z'),
        results: JSON.stringify({
          completionContext: {
            completionKey: 'experiment:standalone:exp01:conflict',
            pathId: null,
            stepId: null,
            requestFingerprint: 'previous-result-fingerprint',
          },
        }),
      });

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'changed-code', status: 'COMPLETED',
          completionKey: 'experiment:standalone:exp01:conflict',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });

      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(409);
      expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('同一完成编号并发触发唯一约束时应恢复原实验回执', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'experiment-existing',
          experimentId: 'exp01',
          status: 'COMPLETED',
          attempts: 1,
          timeSpent: 10,
          completedAt: new Date('2026-07-12T00:00:00Z'),
        });
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
      prisma.userActivity.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          details: JSON.stringify({
            experimentId: 'exp01', completionKey: 'experiment:standalone:exp01:parallel', pathId: null, stepId: null,
          }),
        });

      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', code: 'abc', status: 'COMPLETED',
          completionKey: 'experiment:standalone:exp01:parallel',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });

      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: true });
      expect(data.experiment).toMatchObject({ id: 'experiment-existing', attempts: 1 });
    });

    it('程序未完成时不得保存为已完成', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp01', status: 'COMPLETED', completionKey: 'experiment:standalone:exp01',
          results: { success: false, execution: { terminated: false, traceSteps: 0, faultFree: true } },
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('proj04 里程碑自检应写入现有实验 results 并由服务端补确认时间', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'proj04-record', userId: '1', experimentId: 'proj04', status: 'IN_PROGRESS',
        startedAt: new Date('2026-08-16T07:00:00.000Z'), results: null,
      });
      prisma.userExperiment.update.mockImplementationOnce(async ({ data }: any) => ({
        id: 'proj04-record', experimentId: 'proj04', status: 'IN_PROGRESS', ...data,
      }));
      const milestones = emptyProj04CompletionEvidence().milestones.map((item, index) => ({
        id: item.id,
        confirmed: index === 0,
      }));

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'proj04', intent: 'PROJECT_CHECKLIST', status: 'IN_PROGRESS',
          results: { projectCompletion: { version: 1, milestones } },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: false });
      expect(data.projectCompletion.milestones[0]).toMatchObject({
        id: 'requirements', confirmed: true, confirmedAt: expect.any(String),
      });
      const update = prisma.userExperiment.update.mock.calls[0][0];
      const storedResults = JSON.parse(update.data.results);
      expect(storedResults.projectCompletion.milestones).toHaveLength(5);
      expect(update.data).not.toHaveProperty('attempts');
      expect(prisma.userActivity.create).not.toHaveBeenCalled();
      expect(prisma.learningEvent.create).not.toHaveBeenCalled();
    });

    it('proj04 重复保存相同里程碑状态应直接返回且不重复写入', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const evidence = completedProj04Evidence();
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'proj04-record', userId: '1', experimentId: 'proj04', status: 'COMPLETED',
        startedAt: new Date('2026-08-16T07:00:00.000Z'), results: JSON.stringify({ projectCompletion: evidence }),
        updatedAt: new Date('2026-08-16T08:00:00.000Z'),
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'proj04', intent: 'PROJECT_CHECKLIST', status: 'IN_PROGRESS',
          results: {
            projectCompletion: {
              version: 1,
              milestones: evidence.milestones.map(({ id, confirmed }) => ({ id, confirmed })),
            },
          },
        }),
      }));
      const data = await res.json();

      expect(data).toMatchObject({ success: true, duplicate: true, experiment: { status: 'COMPLETED' } });
      expect(prisma.userExperiment.update).not.toHaveBeenCalled();
      expect(prisma.userExperiment.create).not.toHaveBeenCalled();
    });

    it('proj04 不得只靠持续运行绕过五个已保存的里程碑自检', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'proj04-record', experimentId: 'proj04', status: 'IN_PROGRESS', attempts: 0,
        timeSpent: 0, completedAt: null, results: null,
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'proj04', status: 'COMPLETED', completionKey: 'experiment:standalone:proj04:missing',
          results: {
            success: true,
            execution: { terminated: false, observationComplete: true, traceSteps: PROJ04_MIN_OBSERVATION_STEPS, faultFree: true },
            projectObservation: { uartTail: '{"temp":25,"humi":65}\r\n' },
          },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('五个项目里程碑');
      expect(prisma.userExperiment.upsert).not.toHaveBeenCalled();
    });

    it('proj04 五项证据已保存且观察到完整遥测帧时允许持续循环程序完成', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const evidence = completedProj04Evidence();
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'proj04-record', experimentId: 'proj04', status: 'IN_PROGRESS', attempts: 0,
        timeSpent: 0, completedAt: null, results: JSON.stringify({ projectCompletion: evidence }),
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'proj04', status: 'COMPLETED', completionKey: 'experiment:standalone:proj04:valid',
          results: {
            success: true,
            execution: { terminated: false, observationComplete: true, traceSteps: PROJ04_MIN_OBSERVATION_STEPS, faultFree: true },
            projectObservation: { uartTail: 'noise\r\n{"temp":25,"humi":65}\r\n' },
          },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      const storedResults = JSON.parse(prisma.userExperiment.upsert.mock.calls[0][0].update.results);
      expect(storedResults.projectCompletion).toEqual(evidence);
      expect(storedResults.completionContext).toMatchObject({
        projectMilestones: ['requirements', 'interfaces', 'implementation', 'integration', 'review'],
        executionVerification: {
          mode: 'OBSERVATION', traceSteps: PROJ04_MIN_OBSERVATION_STEPS, telemetryFrameObserved: true,
        },
      });
    });

    it('proj04 即使程序终止，缺少完整 temp/humi 遥测帧仍不得绕过观察门槛', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.userExperiment.findUnique.mockResolvedValueOnce({
        id: 'proj04-record', experimentId: 'proj04', status: 'IN_PROGRESS', attempts: 0,
        timeSpent: 0, completedAt: null,
        results: JSON.stringify({ projectCompletion: completedProj04Evidence() }),
      });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'proj04', status: 'COMPLETED', completionKey: 'experiment:standalone:proj04:no-frame',
          results: {
            success: true,
            execution: { terminated: true, observationComplete: false, traceSteps: PROJ04_MIN_OBSERVATION_STEPS, faultFree: true },
            projectObservation: { uartTail: '{"temp":25}' },
          },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain('完整串口遥测帧');
      expect(prisma.userExperiment.upsert).not.toHaveBeenCalled();
    });

    it('exp02 未覆盖规定的五种寻址方式时不得完成', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02', status: 'COMPLETED', completionKey: 'experiment:standalone:exp02',
          code: 'MOV A,#30H\nEND',
          results: { success: true, execution: { terminated: true, traceSteps: 3, faultFree: true } },
        }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain('五种数据寻址方式');
    });

    it('exp02 观察完成状态不得绕过最小执行记录要求', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02', status: 'COMPLETED', completionKey: 'experiment:standalone:exp02:short',
          code: [
            'MOV A,#30H',
            'MOV 31H,30H',
            'MOV A,R3',
            'MOV A,@R0',
            'MOVC A,@A+DPTR',
          ].join('\n'),
          results: {
            success: true,
            execution: { terminated: false, observationComplete: true, traceSteps: 5, faultFree: true },
          },
        }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toContain('至少执行 20 条指令');
    });

    it('exp02 覆盖五种数据寻址方式且执行记录有效时允许完成', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02', status: 'COMPLETED', completionKey: 'experiment:standalone:exp02:valid',
          code: [
            'MOV A,#30H',
            'MOV 31H,30H',
            'MOV A,R3',
            'MOV A,@R0',
            'MOVC A,@A+DPTR',
          ].join('\n'),
          results: { success: true, execution: { terminated: true, traceSteps: 5, faultFree: true } },
        }),
      });
      const res = await POST(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('自主 exp02 完成不得静默推进同实验的教师任务', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.learningPath.findFirst.mockResolvedValue({
        id: 'active-addressing-task',
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 4,
      });
      prisma.learningPath.updateMany.mockResolvedValue({ count: 1 });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02',
          status: 'COMPLETED',
          completionKey: 'experiment:standalone:exp02:strict-context',
          code: [
            'MOV A,#30H',
            'MOV 31H,30H',
            'MOV A,R3',
            'MOV A,@R0',
            'MOVC A,@A+DPTR',
          ].join('\n'),
          results: { success: true, execution: { terminated: true, traceSteps: 5, faultFree: true } },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.learningPath.findFirst).not.toHaveBeenCalled();
      expect(prisma.learningPath.updateMany).not.toHaveBeenCalled();
      const upsertCall = prisma.userExperiment.upsert.mock.calls[0][0];
      const storedResults = JSON.parse(upsertCall.create.results);
      expect(storedResults.completionContext).toMatchObject({ pathId: null, stepId: null });
    });

    it('从任务入口完成 exp02 时应只推进指定任务步骤', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      prisma.learningPath.findFirst.mockResolvedValue({
        id: 'path-addressing',
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 4,
      });
      prisma.learningPath.updateMany.mockResolvedValue({ count: 1 });

      const res = await POST(new NextRequest('http://localhost/api/experiments/save', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          experimentId: 'exp02',
          pathId: 'path-addressing',
          stepId: 'addressing-exp02',
          status: 'COMPLETED',
          completionKey: 'experiment:path-addressing:addressing-exp02',
          code: [
            'MOV A,#30H',
            'MOV 31H,30H',
            'MOV A,R3',
            'MOV A,@R0',
            'MOVC A,@A+DPTR',
          ].join('\n'),
          results: { success: true, execution: { terminated: true, traceSteps: 5, faultFree: true } },
        }),
      }));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.learningPath.findFirst).toHaveBeenCalledWith({
        where: { id: 'path-addressing', userId: '1', status: 'ACTIVE' },
        select: { id: true, modules: true, currentModule: true },
      });
      expect(prisma.learningPath.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'path-addressing', currentModule: 4 }),
        data: expect.objectContaining({ currentModule: 5, status: 'ACTIVE' }),
      }));
      const upsertCall = prisma.userExperiment.upsert.mock.calls[0][0];
      const storedResults = JSON.parse(upsertCall.create.results);
      expect(storedResults.completionContext).toMatchObject({
        pathId: 'path-addressing',
        stepId: 'addressing-exp02',
      });
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
      prisma.userExperiment.findMany.mockResolvedValueOnce([{ id: 1, experimentId: 'exp01' }]);

      const req = new NextRequest('http://localhost/api/experiments/save?experimentId=exp01', {
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

    it('未指定编号时仅查询课程正式实验', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const req = new NextRequest('http://localhost/api/experiments/save', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(prisma.userExperiment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          userId: '1',
          experimentId: { in: expect.arrayContaining(['exp01', 'exp02']) },
        },
      }));
    });

    it('非课程正式实验编号不得用于查询', async () => {
      mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
      const prisma = (globalThis as any).__mockPrisma;
      const req = new NextRequest('http://localhost/api/experiments/save?experimentId=forged-exp', {
        method: 'GET',
        headers: { Authorization: 'Bearer valid-token' },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('实验编号不存在');
      expect(prisma.userExperiment.findMany).not.toHaveBeenCalled();
    });
  });
});
