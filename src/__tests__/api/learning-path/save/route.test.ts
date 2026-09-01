import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { POST, GET } from '@/app/api/learning-path/save/route';
import { POST as pushLearningTask } from '@/app/api/teacher/push-learning-task/route';
import { GET as getInterventionEffect } from '@/app/api/teacher/intervention-effect/route';
import { GET as getPushedTasks } from '@/app/api/teacher/pushed/route';
import { GET as getMyTasks } from '@/app/api/me/tasks/route';
import { POST as assignPreclass } from '@/app/api/teacher/assign-preclass/route';
import { GET as getTeachingCycle } from '@/app/api/teacher/teaching-cycle/route';
import { verifyToken } from '@/lib/auth';
import { 
  createMockPrismaClient,
  createMockJWTPayload,
  createMockLearningPath,
  createMockUserActivity,
  setupAuthMock,
  setupPrismaMock,
  clearAllMocks,
  createMockNextRequest
} from '../../../utils/test-mocks';
import {
  ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_CHILD_NODE_IDS,
  ADDRESSING_GRAPH_EVIDENCE_SOURCE,
  ADDRESSING_GRAPH_ROOT_NODE_ID,
  ADDRESSING_QUIZ_ID,
  ADDRESSING_TASK_PRESET,
  ADDRESSING_TOPIC_ID,
  buildTaskNavigationReceipt,
  parseLearningTaskSteps,
  requiresTaskOpenReceiptBeforeNavigation,
} from '@/lib/lesson-tasks';

function addressingGraphEvidenceMetadata(pathId = 'addressing-path') {
  return {
    source: ADDRESSING_GRAPH_EVIDENCE_SOURCE,
    rootNodeId: ADDRESSING_GRAPH_ROOT_NODE_ID,
    visitedNodeIds: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
    pathId,
    stepId: 'addressing-graph',
  };
}

function addressingAnimationEvidenceMetadata(pathId = 'addressing-path') {
  return {
    source: ADDRESSING_ANIMATION_EVIDENCE_SOURCE,
    visitedModes: [...ADDRESSING_GRAPH_CHILD_NODE_IDS],
    pathId,
    stepId: 'addressing-animation',
  };
}

function replacementTokenForTest(
  teacherId: string,
  requestId: string,
  activePathIds: string[],
  issuedAt = Date.now(),
): string {
  const payload = JSON.stringify({ teacherId, requestId, activePathIds: activePathIds.slice().sort(), issuedAt });
  const signature = createHmac('sha256', process.env.JWT_SECRET!).update(payload).digest('hex');
  return `replace_${issuedAt.toString(36)}_${signature}`;
}

// Mock dependencies
jest.mock('@/lib/auth');

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = createMockPrismaClient();

describe('/api/learning-path/save', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  describe('POST', () => {
    const mockPayload = createMockJWTPayload({ userId: 'user123' });
    const mockLearningPathData = {
      name: '个性化学习计划',
      description: '基于测评结果的个性化学习计划',
      modules: '[{"id":1,"name":"基础知识"}]',
      totalModules: 5,
      weakAreas: ['timer', 'interrupt']
    };

    it('should create learning path successfully', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', null);
      
      const mockCreatedPath = createMockLearningPath({
        id: 'path123',
        userId: 'user123',
        name: '个性化学习计划',
        description: '基于测评结果的个性化学习计划',
        modules: '[{"id":1,"name":"基础知识"}]',
        currentModule: 0,
        totalModules: 5,
        status: 'ACTIVE'
      });
      setupPrismaMock(mockPrisma, 'learningPath', 'create', mockCreatedPath);
      
      const mockActivity = createMockUserActivity({
        id: 'activity123',
        userId: 'user123',
        action: 'CREATE_LEARNING_PATH',
        details: JSON.stringify({
          pathId: 'path123',
          weakAreas: ['timer', 'interrupt']
        })
      });
      setupPrismaMock(mockPrisma, 'userActivity', 'create', mockActivity);

      const request = createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: mockLearningPathData,
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pathId).toBe('path123');
      expect(data.message).toBe('学习路径已保存');
      expect(mockPrisma.learningPath.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          name: '个性化学习计划',
          description: '基于测评结果的个性化学习计划',
          modules: '[{"id":1,"name":"基础知识"}]',
          currentModule: 0,
          totalModules: 5,
          status: 'ACTIVE'
        }
      });
      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          action: 'CREATE_LEARNING_PATH',
          details: JSON.stringify({
            pathId: 'path123',
            weakAreas: ['timer', 'interrupt']
          })
        }
      });
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
        isolationLevel: 'Serializable',
      }));
    });

    it('should pause existing active path and create new one', async () => {
      const existingPath = {
        id: 'existing-path',
        userId: 'user123',
        status: 'ACTIVE'
      };
      
      mockVerifyToken.mockResolvedValue(mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', existingPath as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'updateMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'create', {
        id: 'new-path',
        userId: 'user123',
        name: '个性化学习计划',
        description: '基于测评结果的个性化学习计划',
        modules: '[]',
        currentModule: 0,
        totalModules: 0,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {
        id: 'activity123',
        userId: 'user123',
        action: 'CREATE_LEARNING_PATH',
        details: JSON.stringify({
          pathId: 'new-path',
          weakAreas: []
        }),
        createdAt: new Date()
      });

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ replaceExisting: true }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pathId).toBe('new-path');
      expect(mockPrisma.learningPath.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user123', status: 'ACTIVE' },
        data: { status: 'PAUSED' }
      });
      expect(mockPrisma.learningPath.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          name: '个性化学习计划',
          description: '基于测评结果的个性化学习计划',
          modules: '[]',
          currentModule: 0,
          totalModules: 0,
          status: 'ACTIVE'
        }
      });
    });

    it('should require confirmation before replacing an active path', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', { id: 'existing-path', userId: 'user123', status: 'ACTIVE' } as any);

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ name: '新学习路径' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toMatchObject({ code: 'ACTIVE_PATH_EXISTS', requiresConfirmation: true, activePathId: 'existing-path' });
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.create).not.toHaveBeenCalled();
    });

    it('should reject an unknown action instead of creating a new path', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'COMPLETE_TASK_STPE', pathId: 'path123', stepId: 'step1' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: '学习路径参数格式无效' });
      expect(mockPrisma.learningPath.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.create).not.toHaveBeenCalled();
    });

    it('should reject an active path created after the initial confirmation check', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      mockPrisma.learningPath.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'concurrent-path', userId: 'user123', status: 'ACTIVE' } as any);

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ name: '并发创建的学习路径' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toMatchObject({
        code: 'ACTIVE_PATH_EXISTS', requiresConfirmation: true, activePathId: 'concurrent-path',
      });
      expect(mockPrisma.learningPath.create).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
        isolationLevel: 'Serializable',
      }));
    });

    it('should advance only the current manual task step and persist an activity', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', {
        id: 'addressing-path',
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 0,
        totalModules: 6,
        status: 'ACTIVE',
        startedAt: new Date('2026-01-01T00:00:00Z'),
      } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', {
        metadata: JSON.stringify(addressingGraphEvidenceMetadata()),
      } as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'updateMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      const request = createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: { action: 'COMPLETE_TASK_STEP', pathId: 'addressing-path', stepId: 'addressing-graph' },
      }) as any;

      const response = await POST(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.currentModule).toBe(1);
      expect(mockPrisma.learningPath.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'addressing-path', currentModule: 0 }),
        data: expect.objectContaining({ currentModule: 1, status: 'ACTIVE' }),
      }));
      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'COMPLETE_TASK_STEP' }),
      });
      expect(mockPrisma.learningEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: expect.stringMatching(/^le_/),
          userId: 'user123',
          eventType: 'RESOURCE_COMPLETED',
          targetId: '3.1',
        }),
      }));
    });

    it('并发重复确认同一步骤时应恢复已完成状态而不是返回冲突', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      mockPrisma.learningPath.findFirst
        .mockResolvedValueOnce({
          id: 'addressing-path', modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps), currentModule: 0,
          totalModules: 6, status: 'ACTIVE', startedAt: new Date('2026-01-01T00:00:00Z'),
        } as any)
        .mockResolvedValueOnce({ currentModule: 1, status: 'ACTIVE' } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', {
        metadata: JSON.stringify(addressingGraphEvidenceMetadata()),
      } as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'updateMany', { count: 0 } as any);

      const response = await POST(createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: { action: 'COMPLETE_TASK_STEP', pathId: 'addressing-path', stepId: 'addressing-graph' },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({ success: true, alreadyCompleted: true, currentModule: 1, status: 'ACTIVE' });
      expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
    });

    it('图谱步骤只有页面打开回执时不能完成', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', {
        id: 'addressing-path', modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps), currentModule: 0,
        totalModules: 6, status: 'ACTIVE', startedAt: new Date('2026-01-01T00:00:00Z'),
      } as any);
      // 数据库中即使存在任务页写入的 RESOURCE_OPENED，完成接口也只查询
      // 内容页显式确认产生的 RESOURCE_COMPLETED，因此这里应返回未命中。
      mockPrisma.learningEvent.findFirst.mockImplementation(async (args: any) => (
        args?.where?.eventType === 'RESOURCE_OPENED'
          ? { metadata: JSON.stringify({ source: 'tasks-page', pathId: 'addressing-path', stepId: 'addressing-graph' }) }
          : null
      ));
      const request = createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: { action: 'COMPLETE_TASK_STEP', pathId: 'addressing-path', stepId: 'addressing-graph' },
      }) as any;
      const response = await POST(request);
      expect(response.status).toBe(409);
      expect(mockPrisma.learningEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ eventType: 'RESOURCE_COMPLETED', targetId: '3.1' }),
      }));
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
    });

    it('动画步骤只有七种方式的完整内容页凭据才能完成', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', {
        id: 'addressing-path', modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps), currentModule: 1,
        totalModules: 6, status: 'ACTIVE', startedAt: new Date('2026-01-01T00:00:00Z'),
      } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', {
        metadata: JSON.stringify({
          ...addressingAnimationEvidenceMetadata(),
          visitedModes: ADDRESSING_GRAPH_CHILD_NODE_IDS.slice(0, -1),
        }),
      } as any);

      const incomplete = await POST(createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: { action: 'COMPLETE_TASK_STEP', pathId: 'addressing-path', stepId: 'addressing-animation' },
      }) as any);
      expect(incomplete.status).toBe(422);
      await expect(incomplete.json()).resolves.toMatchObject({ code: 'ANIMATION_REVIEW_INCOMPLETE' });
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
    });

    it('补学步骤必须使用内容页完成事件，不能只凭进入页面推进', async () => {
      setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', {
        id: 'addressing-path', modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps), currentModule: 3,
        totalModules: 6, status: 'ACTIVE', startedAt: new Date('2026-01-01T00:00:00Z'),
      } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', {
        metadata: JSON.stringify({
          pathId: 'addressing-path', stepId: 'addressing-remediation',
          weakAreas: ['3.1.1'], reviewedWeakAreas: ['3.1.1'], confirmedNoWeakNodes: false,
        }),
      } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findMany', [{
        details: JSON.stringify({
          pathId: 'addressing-path', quizId: ADDRESSING_QUIZ_ID,
          assessmentMode: 'initial', weakAreas: ['3.1.1'],
        }),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'updateMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      const request = createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: { action: 'COMPLETE_TASK_STEP', pathId: 'addressing-path', stepId: 'addressing-remediation' },
      }) as any;
      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockPrisma.learningEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ eventType: 'RESOURCE_COMPLETED', targetId: '3.1' }),
      }));
    });

    it('should return 401 when no authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockLearningPathData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('should return 401 when authorization header is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'authorization': 'Invalid token',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockLearningPathData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('should return 401 when token is invalid', async () => {
      setupAuthMock(mockVerifyToken, null);

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockLearningPathData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('should handle database error', async () => {
      mockVerifyToken.mockResolvedValue(mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify(mockLearningPathData),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('保存学习路径失败');
      expect(data.details).toBeUndefined();
    });

    it('should handle JSON parsing error', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json',
        },
        body: 'invalid json',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('学习路径参数格式无效');
    });
  });

  describe('GET', () => {
    const mockPayload = createMockJWTPayload({ userId: 'user123' });
    const mockLearningPaths = [
      {
        id: 'path1',
        userId: 'user123',
        name: '学习路径1',
        description: '描述1',
        modules: '[]',
        currentModule: 0,
        totalModules: 5,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: [
          {
            id: 'progress1',
            lastAccessAt: new Date()
          }
        ]
      },
      {
        id: 'path2',
        userId: 'user123',
        name: '学习路径2',
        description: '描述2',
        modules: '[]',
        currentModule: 2,
        totalModules: 3,
        status: 'COMPLETED',
        createdAt: new Date(),
        updatedAt: new Date(),
        progress: []
      }
    ];

    it('should get learning paths successfully', async () => {
      mockVerifyToken.mockResolvedValue(mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', mockLearningPaths as any);

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.paths).toEqual(mockLearningPaths);
      expect(mockPrisma.learningPath.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123'
        },
        include: {
          progress: {
            orderBy: {
              lastAccessAt: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
    });

    it('should return 401 when no authorization header', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'GET',
      }) as any;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('should return 401 when token is invalid', async () => {
      setupAuthMock(mockVerifyToken, null);

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer invalid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('should handle database error', async () => {
      mockVerifyToken.mockResolvedValue(mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', new Error('Database query failed'));

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('获取学习路径失败');
      expect(data.details).toBeUndefined();
    });

    it('should return empty array when no paths found', async () => {
      mockVerifyToken.mockResolvedValue(mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', []);

      const request = new NextRequest('http://localhost:3000/api/learning-path/save', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer valid-token',
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.paths).toEqual([]);
    });
  });

  describe('teacher addressing task push', () => {
    it('should reject malformed task JSON as a client error', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      const response = await pushLearningTask(new NextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: 'invalid json',
      }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: '任务参数格式无效' });
    });

    it('should keep legacy string modules executable after task schema expansion', () => {
      expect(parseLearningTaskSteps(JSON.stringify(['ch3', 'module-2']))).toEqual([
        expect.objectContaining({
          stepId: 'legacy-step-1',
          type: 'CHAPTER',
          targetId: 'ch3',
          chapterId: 'ch3',
          href: '/?section=chapters&chapter=3#item-3',
        }),
        expect.objectContaining({
          stepId: 'legacy-step-2',
          type: 'CHAPTER',
          targetId: 'module-2',
          moduleId: 'module-2',
          href: '/?section=chapters',
        }),
      ]);
      expect(parseLearningTaskSteps(JSON.stringify([{
        stepId: 'unsafe-link', type: 'CHAPTER', title: '异常入口', href: 'javascript:alert(1)', targetId: 'ch3',
      }]))[0]?.href).toBe('/?section=chapters&chapter=3#item-3');
      expect(parseLearningTaskSteps(JSON.stringify([{
        stepId: 'external-link', type: 'CHAPTER', title: '站外入口', href: '//example.com/path', targetId: 'ch3',
      }]))[0]?.href).toBe('/?section=chapters&chapter=3#item-3');
      expect(parseLearningTaskSteps(JSON.stringify([{
        stepId: 'old-course-link', type: 'CHAPTER', title: '旧章节入口', href: '/courses?chapter=3',
        targetId: 'ch3', chapterId: 'ch3',
      }]))[0]?.href).toBe('/?section=chapters&chapter=3#item-3');
      expect(parseLearningTaskSteps(JSON.stringify([{
        stepId: 'unknown-link', type: 'CHAPTER', title: '未知入口', href: '/missing-course-route',
        targetId: 'ch3', chapterId: 'ch3',
      }]))[0]?.href).toBe('/missing-course-route');
    });

    it('should create an open receipt only for a supported executable task entry', () => {
      const validStep = parseLearningTaskSteps(JSON.stringify([{
        stepId: 'chapter-ch3', type: 'CHAPTER', title: '第3章 指令系统', targetId: 'ch3', chapterId: 'ch3',
      }]))[0]!;
      expect(buildTaskNavigationReceipt(validStep, 'path-1')).toMatchObject({
        eventType: 'RESOURCE_OPENED', targetType: 'CHAPTER', targetId: 'ch3',
      });
      expect(buildTaskNavigationReceipt({ ...validStep, href: '/missing-course-route' }, 'path-1')).toBeNull();
    });

    it('should block only steps whose completion depends on a persisted open receipt', () => {
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'GRAPH' })).toBe(true);
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'CHAPTER' })).toBe(true);
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'ANIMATION' })).toBe(false);
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'REMEDIATION' })).toBe(false);
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'QUIZ' })).toBe(false);
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'SIMULATION' })).toBe(false);
      expect(requiresTaskOpenReceiptBeforeNavigation({ type: 'RETEST' })).toBe(false);
    });

    it('should require an explicit replacement confirmation when active paths exist', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.learningPath.count.mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany.mockResolvedValueOnce([{ id: 'old-path-1' }] as any);

      const request = createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: false,
        },
      }) as any;

      const response = await pushLearningTask(request);
      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.code).toBe('ACTIVE_PATH_EXISTS');
      expect(data.confirmationState).toBe('REQUIRED');
      expect(data.activePathCount).toBe(1);
      expect(data.replacementToken).toMatch(/^replace_/);
      expect(mockPrisma.learningPath.findMany).toHaveBeenLastCalledWith({
        where: expect.objectContaining({
          userId: { in: ['student1'] },
          status: 'ACTIVE',
          id: { notIn: expect.arrayContaining([expect.stringMatching(/^lp_/)]) },
        }),
        select: { id: true },
      });
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
    });

    it('should also require confirmation for a modern chapter-review request', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.learningPath.count.mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany.mockResolvedValueOnce([{ id: 'old-path-1' }] as any);

      const request = createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'chapter_review_request_001',
          scope: 'STUDENTS',
          studentIds: ['student1'],
          pathType: 'BASIC',
          moduleCount: 5,
          replaceExisting: false,
        },
      }) as any;

      const response = await pushLearningTask(request);
      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.code).toBe('ACTIVE_PATH_EXISTS');
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
    });

    it('should persist chapter tasks with the executable public course root and chapter context', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findUnique', null as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'createMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'count', 0 as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'updateMany', { count: 0 } as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'createMany', { count: 1 } as any);

      const response = await pushLearningTask(createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'chapter_route_001', scope: 'STUDENTS', studentIds: ['student1'], moduleCount: 3,
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.steps.map((step: { href: string }) => step.href)).toEqual([
        '/?section=chapters&chapter=1#item-1',
        '/?section=chapters&chapter=2#item-2',
        '/?section=chapters&chapter=3#item-3',
      ]);
      const persisted = mockPrisma.learningPath.createMany.mock.calls[0]?.[0].data[0];
      expect(JSON.parse(persisted.modules)[2]).toMatchObject({
        type: 'CHAPTER', targetId: 'ch3', chapterId: 'ch3',
        href: '/?section=chapters&chapter=3#item-3',
      });
    });

    it('should never silently replace an active path for a legacy request without a request id', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.learningPath.count.mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany.mockResolvedValueOnce([{ id: 'old-path-1' }] as any);

      const response = await pushLearningTask(createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          scope: 'STUDENTS',
          studentIds: ['student1'],
          pathType: 'BASIC',
          moduleCount: 3,
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toMatchObject({
        code: 'ACTIVE_PATH_EXISTS',
        requiresConfirmation: true,
        activePathCount: 1,
        targetCount: 1,
        requestId: expect.stringMatching(/^legacy_[A-Za-z0-9_-]+$/),
        replacementToken: expect.stringMatching(/^replace_/),
      });
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.createMany).not.toHaveBeenCalled();
    });

    it('should recheck active paths inside the transaction when another push arrives concurrently', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.learningPath.count
        .mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'concurrent-path' }] as any);

      const response = await pushLearningTask(createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'concurrent_push_001',
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: false,
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toMatchObject({
        code: 'ACTIVE_PATH_EXISTS', requiresConfirmation: true, activePathCount: 1, targetCount: 1,
        replacementToken: expect.stringMatching(/^replace_/),
      });
      expect(mockPrisma.learningPath.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
        isolationLevel: 'Serializable',
      }));
    });

    it('should create the six-step task after replacement is confirmed', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      const requestId = 'confirmed_replace_001';
      const activePathId = 'old-path-1';
      const replacementToken = replacementTokenForTest('teacher1', requestId, [activePathId]);
      mockPrisma.learningPath.count.mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany
        .mockResolvedValueOnce([{ id: activePathId }] as any)
        .mockResolvedValueOnce([{ id: activePathId }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'updateMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'createMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'createMany', { count: 1 } as any);

      const request = createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId,
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: true,
          replacementToken,
        },
      }) as any;

      const response = await pushLearningTask(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.created).toBe(1);
      expect(data.paused).toBe(1);
      expect(data.steps).toHaveLength(6);
      expect(data.steps.map((step: { type: string }) => step.type)).toEqual([
        'GRAPH', 'ANIMATION', 'QUIZ', 'REMEDIATION', 'SIMULATION', 'RETEST',
      ]);
    });

    it('should require confirmation again when the active path set changes before replacement', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      const requestId = 'changed_replace_001';
      const originalToken = replacementTokenForTest('teacher1', requestId, ['old-path-1']);
      mockPrisma.learningPath.count.mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany
        .mockResolvedValueOnce([{ id: 'old-path-1' }] as any)
        .mockResolvedValueOnce([{ id: 'newer-path-2' }] as any);

      const response = await pushLearningTask(createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId,
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: true,
          replacementToken: originalToken,
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toMatchObject({
        code: 'ACTIVE_PATH_EXISTS', activePathCount: 1, targetCount: 1,
        confirmationState: 'STALE',
        replacementToken: expect.stringMatching(/^replace_/),
      });
      expect(data.replacementToken).not.toBe(originalToken);
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.createMany).not.toHaveBeenCalled();
    });

    it('should reject an expired replacement confirmation and issue a fresh one', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      const requestId = 'expired_replace_001';
      const activePathId = 'old-path-1';
      const expiredToken = replacementTokenForTest(
        'teacher1',
        requestId,
        [activePathId],
        Date.now() - 10 * 60 * 1000 - 1,
      );
      mockPrisma.learningPath.count.mockResolvedValueOnce(0);
      mockPrisma.learningPath.findMany.mockResolvedValueOnce([{ id: activePathId }] as any);

      const response = await pushLearningTask(createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId,
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: true,
          replacementToken: expiredToken,
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data).toMatchObject({
        code: 'ACTIVE_PATH_EXISTS',
        confirmationState: 'STALE',
        error: '替换确认已失效或任务状态已变化，请核对后再次确认',
        activePathCount: 1,
        targetCount: 1,
      });
      expect(data.replacementToken).toMatch(/^replace_/);
      expect(data.replacementToken).not.toBe(expiredToken);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
    });

    it('should return the original batch receipt when the same request is retried', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.learningPath.count.mockResolvedValueOnce(1);
      mockPrisma.learningPath.findMany.mockImplementationOnce(async (args: any) => [{
        id: args.where.id.in[0],
        userId: 'student1',
        name: ADDRESSING_TASK_PRESET.title,
        description: ADDRESSING_TASK_PRESET.description,
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
      }]);

      const request = createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'request_retry_001',
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: true,
        },
      }) as any;

      const response = await pushLearningTask(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(data.created).toBe(1);
      expect(data.batchId).toMatch(/^batch_/);
      expect(mockPrisma.learningPath.createMany).not.toHaveBeenCalled();
    });

    it('should reject a reused request id when the effective task parameters changed', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findUnique', {
        details: JSON.stringify({ requestFingerprint: 'different-task-fingerprint' }),
      } as any);

      const request = createMockNextRequest('http://localhost:3000/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'request_conflict_001',
          scope: 'STUDENTS',
          studentIds: ['student1'],
          topicId: 'addressing-modes',
          replaceExisting: true,
        },
      }) as any;

      const response = await pushLearningTask(request);
      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(mockPrisma.learningPath.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('teacher experiment assignment receipts', () => {
    it('should reject an empty assignment scope instead of returning a zero-person success', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [] as any);

      const response = await assignPreclass(createMockNextRequest('http://localhost:3000/api/teacher/assign-preclass', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: { requestId: 'assign_empty_001', experimentId: 'exp02', scope: 'ALL' },
      }) as any);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: '当前范围内没有可布置的学生' });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should persist the assigning teacher so reverse views do not claim unrelated experiments', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findUnique', null as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'updateMany', { count: 0 } as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'createMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'createMany', { count: 1 } as any);

      const response = await assignPreclass(createMockNextRequest('http://localhost:3000/api/teacher/assign-preclass', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'assign_exp02_001',
          experimentId: 'exp02',
          scope: 'STUDENTS',
          studentIds: ['student1'],
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: false, assigned: 1, skipped: 0 });
      expect(data.batchId).toMatch(/^expbatch_/);
      expect(mockPrisma.userExperiment.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
      const receiptCall = mockPrisma.userActivity.createMany.mock.calls.find((call: any[]) => (
        call[0].data.some((item: { action: string }) => item.action === 'TEACHER_ASSIGN_EXPERIMENT')
      ));
      const receipt = receiptCall?.[0].data[0];
      expect(receipt).toMatchObject({ userId: 'student1', action: 'TEACHER_ASSIGN_EXPERIMENT' });
      expect(JSON.parse(receipt.details)).toMatchObject({ assignedBy: 'teacher1', experimentId: 'exp02' });
    });

    it('should restore the original experiment assignment receipt on retry', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findUnique', null as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'updateMany', { count: 0 } as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'createMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'createMany', { count: 1 } as any);

      const makeRequest = () => createMockNextRequest('http://localhost:3000/api/teacher/assign-preclass', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'assign_retry_001', experimentId: 'exp02', scope: 'STUDENTS', studentIds: ['student1'],
        },
      }) as any;
      const first = await assignPreclass(makeRequest());
      expect(first.status).toBe(200);
      const persistedDetails = mockPrisma.userActivity.update.mock.calls[0][0].data.details;
      const createCount = mockPrisma.userExperiment.createMany.mock.calls.length;
      mockPrisma.userActivity.findUnique.mockResolvedValue({ details: persistedDetails } as any);

      const retried = await assignPreclass(makeRequest());
      const data = await retried.json();
      expect(retried.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: true, assigned: 1, skipped: 0 });
      expect(mockPrisma.userExperiment.createMany).toHaveBeenCalledTimes(createCount);
    });

    it('should reject an experiment request id reused with different parameters', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.userActivity.findUnique.mockResolvedValue({
        details: JSON.stringify({ requestFingerprint: 'different-fingerprint', assigned: 1, skipped: 0 }),
      } as any);

      const response = await assignPreclass(createMockNextRequest('http://localhost:3000/api/teacher/assign-preclass', {
        method: 'POST', headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: {
          requestId: 'assign_conflict_001', experimentId: 'exp02', scope: 'STUDENTS', studentIds: ['student1'],
        },
      }) as any);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(mockPrisma.userExperiment.createMany).not.toHaveBeenCalled();
    });
  });

  describe('student task receipts', () => {
    it('should keep an explicitly assigned experiment visible after it becomes in progress', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany.mockResolvedValueOnce([{
        userId: 'student1', createdAt: new Date('2026-07-19T08:00:00Z'),
        details: JSON.stringify({ assignedBy: 'teacher1', experimentId: 'exp02', batchId: 'batch_exp02' }),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [] as any);
      mockPrisma.userExperiment.findMany.mockReset();
      mockPrisma.userExperiment.findMany.mockResolvedValueOnce([{
        experimentId: 'exp02', status: 'IN_PROGRESS',
        startedAt: new Date('2026-07-19T08:05:00Z'), completedAt: null,
        createdAt: new Date('2026-07-19T08:00:00Z'), updatedAt: new Date('2026-07-19T08:05:00Z'),
      }] as any);

      const response = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.assignedExperiments).toEqual([
        expect.objectContaining({
          experimentId: 'exp02',
          status: 'IN_PROGRESS',
          startedAt: '2026-07-19T08:05:00.000Z',
          href: '/simulation?experiment=exp02&from=preclass',
          completionRule: expect.stringContaining('五种数据寻址方式'),
        }),
      ]);
      expect(mockPrisma.userExperiment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          userId: 'student1',
          OR: expect.arrayContaining([{ status: 'ASSIGNED' }, { experimentId: { in: ['exp02'] } }]),
        }),
      }));
      expect(mockPrisma.userActivity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          userId: 'student1',
          action: { in: ['TEACHER_ASSIGN_EXPERIMENT', 'START_EXPERIMENT'] },
        },
      }));
    });

    it('should recover a legacy preclass assignment from its durable start receipt', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany.mockResolvedValueOnce([{
        userId: 'student1', action: 'START_EXPERIMENT', createdAt: new Date('2026-07-19T08:05:00Z'),
        details: JSON.stringify({ experimentId: 'exp05', status: 'IN_PROGRESS', source: 'preclass-task' }),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [] as any);
      mockPrisma.userExperiment.findMany.mockReset();
      mockPrisma.userExperiment.findMany.mockResolvedValueOnce([{
        experimentId: 'exp05', status: 'IN_PROGRESS',
        startedAt: new Date('2026-07-19T08:05:00Z'), completedAt: null,
        createdAt: new Date('2026-06-04T13:56:00Z'), updatedAt: new Date('2026-07-19T08:05:00Z'),
      }] as any);

      const response = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.assignedExperiments).toEqual([
        expect.objectContaining({
          experimentId: 'exp05',
          status: 'IN_PROGRESS',
          assignedAt: '2026-07-19T08:05:00.000Z',
          href: '/simulation?experiment=exp05&from=preclass',
        }),
      ]);
    });

    it('should not treat a standalone experiment start as a teacher task', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany.mockResolvedValueOnce([{
        userId: 'student1', action: 'START_EXPERIMENT', createdAt: new Date('2026-07-19T08:05:00Z'),
        details: JSON.stringify({ experimentId: 'exp05', status: 'IN_PROGRESS', source: 'standalone' }),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [] as any);
      mockPrisma.userExperiment.findMany.mockReset();
      mockPrisma.userExperiment.findMany.mockResolvedValueOnce([] as any);

      const response = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.assignedExperiments).toEqual([]);
    });

    it('should expose an actionable data issue when an active path has no executable steps', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'broken-path', userId: 'student1', name: '损坏任务', description: null, modules: 'not-json',
        currentModule: 0, totalModules: 6, status: 'ACTIVE',
        startedAt: new Date('2026-07-01T00:00:00Z'), completedAt: null,
      }] as any);

      const response = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(data.data.activePaths[0]).toMatchObject({
        id: 'broken-path', steps: [], dataIssue: expect.stringContaining('任务步骤数据不完整'),
      });
    });

    it('should remap an old nine-chapter path without inventing the missing tenth step', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'legacy-nine-path', userId: 'student1', name: '进阶学习路径', description: '历史演示路径',
        modules: JSON.stringify([
          { moduleId: 'module-1', chapterId: 'ch1', name: '第1章 单片机概述' },
          { moduleId: 'module-1', chapterId: 'ch2', name: '第2章 89C51硬件结构' },
          { moduleId: 'module-1', chapterId: 'ch3', name: '第3章 I/O端口' },
          { moduleId: 'module-2', chapterId: 'ch4', name: '第4章 指令系统与寻址' },
          { moduleId: 'module-2', chapterId: 'ch5', name: '第5章 C51程序设计' },
          { moduleId: 'module-3', chapterId: 'ch6', name: '第6章 中断系统' },
          { moduleId: 'module-3', chapterId: 'ch7', name: '第7章 定时器/计数器' },
          { moduleId: 'module-4', chapterId: 'ch8', name: '第8章 串行通信' },
          { moduleId: 'module-4', chapterId: 'ch9', name: '第9章 系统扩展与接口' },
        ]),
        currentModule: 8, totalModules: 9, status: 'COMPLETED',
        startedAt: new Date('2025-09-01T00:00:00Z'), completedAt: new Date('2026-01-01T00:00:00Z'),
      }] as any);

      const response = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();
      const path = data.data.completedPaths[0];

      expect(response.status).toBe(200);
      expect(path).toMatchObject({
        curriculumStatus: 'LEGACY_9_CHAPTER',
        curriculumLabel: '历史演示路径（旧9章口径）',
        missingChapterIds: ['ch10'],
        totalModules: 9,
      });
      expect(path.curriculumNote).toContain('未补写步骤');
      expect(path.steps).toHaveLength(9);
      expect(path.steps[1]).toMatchObject({ title: '第2章 硬件结构', moduleId: 'module-1' });
      expect(path.steps[1].href).toBe(
        '/?section=chapters&chapter=2&taskPathId=legacy-nine-path&taskStepId=legacy-step-2#item-2',
      );
      expect(path.steps[2]).toMatchObject({ title: '第3章 指令系统', moduleId: 'module-1' });
      expect(path.steps[8]).toMatchObject({ title: '第9章 系统设计', moduleId: 'module-4' });
      expect(path.steps.some((step: { chapterId?: string }) => step.chapterId === 'ch10')).toBe(false);
    });

    it('任务页只有图谱完成回执才能开放手动确认，页面打开回执不能替代', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'active-path', userId: 'student1', name: ADDRESSING_TASK_PRESET.title,
        description: ADDRESSING_TASK_PRESET.description, modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 0, totalModules: 6, status: 'ACTIVE',
        startedAt: new Date('2026-07-01T00:00:00Z'), completedAt: null,
      }] as any);
      mockPrisma.learningEvent.findMany
        .mockResolvedValueOnce([{
          eventType: 'RESOURCE_OPENED', targetId: '3.1',
          metadata: JSON.stringify({ source: 'tasks-page', pathId: 'active-path', stepId: 'addressing-graph' }),
          createdAt: new Date('2026-07-01T00:05:00Z'),
        }] as any)
        .mockResolvedValueOnce([{
          eventType: 'RESOURCE_COMPLETED', targetId: '3.1',
          metadata: JSON.stringify(addressingGraphEvidenceMetadata('active-path')),
          createdAt: new Date('2026-07-01T00:10:00Z'),
        }] as any);

      const openedOnlyResponse = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const openedOnlyData = await openedOnlyResponse.json();
      const completedResponse = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const completedData = await completedResponse.json();

      expect(openedOnlyResponse.status).toBe(200);
      expect(openedOnlyData.data.activePaths[0].steps[0]).toMatchObject({ status: 'CURRENT', canMarkComplete: false });
      expect(completedResponse.status).toBe(200);
      expect(completedData.data.activePaths[0].steps[0]).toMatchObject({ status: 'CURRENT', canMarkComplete: true });
      expect(mockPrisma.learningEvent.findMany).toHaveBeenCalledWith({
        where: { userId: 'student1', id: { in: [expect.stringMatching(/^le_/)] } },
        select: { eventType: true, targetId: true, metadata: true, createdAt: true },
      });
    });

    it('任务页只有七种寻址方式完整动画回执才能开放确认', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'active-path', userId: 'student1', name: ADDRESSING_TASK_PRESET.title,
        description: ADDRESSING_TASK_PRESET.description, modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 1, totalModules: 6, status: 'ACTIVE',
        startedAt: new Date('2026-07-01T00:00:00Z'), completedAt: null,
      }] as any);
      mockPrisma.learningEvent.findMany
        .mockResolvedValueOnce([{
          eventType: 'RESOURCE_COMPLETED', targetId: 'anim-addressing-modes',
          metadata: JSON.stringify({
            ...addressingAnimationEvidenceMetadata('active-path'),
            visitedModes: ADDRESSING_GRAPH_CHILD_NODE_IDS.slice(0, -1),
          }),
          createdAt: new Date('2026-07-01T00:05:00Z'),
        }] as any)
        .mockResolvedValueOnce([{
          eventType: 'RESOURCE_COMPLETED', targetId: 'anim-addressing-modes',
          metadata: JSON.stringify(addressingAnimationEvidenceMetadata('active-path')),
          createdAt: new Date('2026-07-01T00:10:00Z'),
        }] as any);

      const incompleteResponse = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const incompleteData = await incompleteResponse.json();
      const completeResponse = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const completeData = await completeResponse.json();

      expect(incompleteData.data.activePaths[0].steps[1]).toMatchObject({ status: 'CURRENT', canMarkComplete: false });
      expect(completeData.data.activePaths[0].steps[1]).toMatchObject({ status: 'CURRENT', canMarkComplete: true });
    });

    it('should return recently completed paths instead of hiding them', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'student1', role: 'STUDENT' }));
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([
          {
            createdAt: new Date('2026-07-01T13:00:00.000Z'),
            details: JSON.stringify({
              pathId: 'completed-path', quizId: ADDRESSING_QUIZ_ID, assessmentMode: 'retest',
              score: 90, weakAreas: ['3.1.2'],
            }),
          },
          {
            createdAt: new Date('2026-07-01T10:00:00.000Z'),
            details: JSON.stringify({
              pathId: 'completed-path', quizId: ADDRESSING_QUIZ_ID, assessmentMode: 'initial',
              score: 60, weakAreas: ['3.1.1', '3.1.2'],
            }),
          },
        ] as any);
      mockPrisma.userExperiment.findMany
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([{
          experimentId: 'exp02',
          results: JSON.stringify({
            completionHistory: [{
              pathId: 'completed-path', stepId: 'addressing-exp02',
              verifiedAt: '2026-07-01T12:00:00.000Z',
              coveredModes: ['立即寻址', '直接寻址', '寄存器寻址', '寄存器间接寻址', '变址寻址'],
            }],
          }),
        }] as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'completed-path', userId: 'student1', name: ADDRESSING_TASK_PRESET.title,
        description: ADDRESSING_TASK_PRESET.description, modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 6, totalModules: 6, status: 'COMPLETED',
        startedAt: new Date('2026-07-01T00:00:00Z'), completedAt: new Date('2026-07-02T00:00:00Z'),
      }] as any);
      const response = await getMyTasks(new NextRequest('http://localhost:3000/api/me/tasks', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.data.activePaths).toHaveLength(0);
      expect(data.data.completedPaths).toHaveLength(1);
      expect(data.data.completedPaths[0].steps.every((step: { status: string }) => step.status === 'COMPLETED')).toBe(true);
      expect(data.data.completedPaths[0].steps.find((step: { stepId: string }) => step.stepId === 'addressing-exp02')).toMatchObject({
        receipt: {
          verifiedAt: '2026-07-01T12:00:00.000Z',
          coveredModes: expect.arrayContaining(['立即寻址', '变址寻址']),
        },
      });
      expect(data.data.completedPaths[0].steps.find((step: { stepId: string }) => step.stepId === 'addressing-pre-quiz')).toMatchObject({
        assessmentReceipt: {
          submittedAt: '2026-07-01T10:00:00.000Z',
          score: 60,
          weakAreas: ['3.1.1', '3.1.2'],
        },
      });
      expect(data.data.completedPaths[0].steps.find((step: { stepId: string }) => step.stepId === 'addressing-retest')).toMatchObject({
        assessmentReceipt: {
          submittedAt: '2026-07-01T13:00:00.000Z',
          score: 90,
          weakAreas: ['3.1.2'],
        },
      });
      expect(data.data.dataProvenance).toMatchObject({ mode: 'DEMO', label: '演示数据' });
    });
  });

  describe('teacher intervention review', () => {
    it('should show a task experiment as waiting to start before an execution row exists', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{
        userId: 'student1', classId: 'class1',
        user: { id: 'student1', name: '学生甲', username: 'student1', studentId: 'S001' },
      }] as any);
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany
        .mockResolvedValueOnce([{
          userId: 'student1', createdAt: new Date('2026-07-19T08:00:00Z'),
          details: JSON.stringify({
            pushedBy: 'teacher1', batchId: 'batch_waiting', pathId: 'path_waiting',
            pathName: ADDRESSING_TASK_PRESET.title, topicId: ADDRESSING_TOPIC_ID,
          }),
        }] as any)
        .mockResolvedValueOnce([] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'path_waiting', userId: 'student1', name: ADDRESSING_TASK_PRESET.title,
        description: ADDRESSING_TASK_PRESET.description, modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 0, totalModules: 6, status: 'ACTIVE',
        startedAt: new Date('2026-07-19T08:00:00Z'), completedAt: null,
      }] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);

      const response = await getPushedTasks(new NextRequest('http://localhost:3000/api/teacher/pushed', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dataProvenance).toMatchObject({ mode: 'DEMO', label: '演示数据' });
      expect(data.data.experiments).toEqual([expect.objectContaining({
        experimentId: 'exp02', uniqueStudents: 1, assigned: 1, inProgress: 0,
        completed: 0, dataInsufficient: 0,
        students: [expect.objectContaining({
          id: 'student1', name: '学生甲', studentCode: 'S001', status: 'ASSIGNED',
        })],
      })]);
    });

    it('should list only the current teacher push batches without merging tasks by name', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{
        userId: 'student1', classId: 'class1',
        user: { id: 'student1', name: '学生甲', username: 'student1', studentId: 'S001' },
      }] as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findMany', [{
        userId: 'student1', createdAt: new Date('2026-07-12T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher1', batchId: 'batch_b', pathId: 'path_b', pathName: '寻址方式' }),
      }, {
        userId: 'student1', createdAt: new Date('2026-07-10T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher1', batchId: 'batch_a', pathId: 'path_a', pathName: '寻址方式' }),
      }, {
        userId: 'student1', createdAt: new Date('2026-07-09T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher2', batchId: 'batch_other', pathId: 'path_other', pathName: '寻址方式' }),
      }] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [{
        experimentId: 'exp02', status: 'COMPLETED', score: 100, userId: 'student1',
        updatedAt: new Date('2026-07-12T00:00:00Z'),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'path_b', userId: 'student1', name: '寻址方式', description: '损坏的六步学习任务',
        modules: '[]', currentModule: 2, totalModules: 6,
        status: 'ACTIVE', startedAt: new Date('2026-07-12T00:00:00Z'), completedAt: null,
      }, {
        id: 'path_a', userId: 'student1', name: '寻址方式', description: '六步学习任务',
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps), currentModule: 3, totalModules: 6,
        status: 'ACTIVE', startedAt: new Date('2026-07-10T00:00:00Z'), completedAt: null,
      }] as any);

      const response = await getPushedTasks(new NextRequest('http://localhost:3000/api/teacher/pushed', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(data.data.paths).toHaveLength(2);
      expect(data.data.paths.map((path: { batchId: string }) => path.batchId)).toEqual(['batch_b', 'batch_a']);
      expect(data.data.paths[0]).toMatchObject({ batchId: 'batch_b', dataInsufficient: 1, totalStudents: 1 });
      expect(data.data.paths[0].students[0]).toMatchObject({ status: 'DATA_INSUFFICIENT', totalSteps: 0 });
      expect(data.data.paths[1]).toMatchObject({ batchId: 'batch_a', dataInsufficient: 0, active: 1 });
      expect(data.data.experiments).toEqual([expect.objectContaining({
        experimentId: 'exp02', uniqueStudents: 1, completed: 1, avgScore: 100,
      })]);
      expect(mockPrisma.userExperiment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { OR: [{ userId: 'student1', experimentId: 'exp02' }] },
      }));
      expect(mockPrisma.learningPath.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: { in: ['path_b', 'path_a'] }, userId: { in: ['student1'] } },
      }));
    });

    it('should compare only the initial and retest records from the requested task instance', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany.mockResolvedValueOnce([{
        userId: 'student1',
        createdAt: new Date('2026-07-10T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher1', batchId: 'batch_b', pathId: 'path_b', topicId: ADDRESSING_TOPIC_ID }),
      }, {
        userId: 'student1',
        createdAt: new Date('2026-07-10T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher1', batchId: 'batch_b', pathId: 'path_b', topicId: ADDRESSING_TOPIC_ID }),
      }, {
        userId: 'student1',
        createdAt: new Date('2026-07-09T00:00:00Z'),
        details: JSON.stringify({ batchId: 'batch_b', pathId: 'legacy-path', topicId: ADDRESSING_TOPIC_ID }),
      }, {
        userId: 'student1',
        createdAt: new Date('2026-07-01T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher1', batchId: 'batch_a', pathId: 'path_a', topicId: ADDRESSING_TOPIC_ID }),
      }] as any).mockResolvedValueOnce([{
        userId: 'student1', createdAt: new Date('2026-07-12T00:00:00Z'),
        details: JSON.stringify({ experimentId: 'exp02', pathId: 'path_b', completionKey: 'experiment:path_b:simulation' }),
      }] as any);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', [
        { userId: 'student1', quizId: ADDRESSING_QUIZ_ID, score: 40, answers: JSON.stringify({ assessmentMode: 'initial', pathId: 'path_b' }), completedAt: new Date('2026-07-11T00:00:00Z') },
        { userId: 'student1', quizId: ADDRESSING_QUIZ_ID, score: 80, answers: JSON.stringify({ assessmentMode: 'retest', pathId: 'path_b' }), completedAt: new Date('2026-07-12T00:00:00Z') },
        { userId: 'student1', quizId: ADDRESSING_QUIZ_ID, score: 100, answers: JSON.stringify({ assessmentMode: 'retest', pathId: 'path_a' }), completedAt: new Date('2026-07-13T00:00:00Z') },
      ] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [{
        userId: 'student1', status: 'IN_PROGRESS', completedAt: new Date('2026-07-12T00:00:00Z'),
        results: JSON.stringify({
          completionContext: { completionKey: 'experiment:path_c:simulation', pathId: 'path_c' },
          completionHistory: [
            { completionKey: 'experiment:path_c:simulation', pathId: 'path_c' },
          ],
        }),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'path_b', userId: 'student1', name: '寻址方式', modules: '[]', currentModule: 6,
        totalModules: 6, status: 'COMPLETED', startedAt: new Date('2026-07-10T00:00:00Z'),
      }] as any);
      setupPrismaMock(mockPrisma, 'user', 'findMany', [{ id: 'student1', name: '学生甲', studentId: 'S001' }] as any);

      const response = await getInterventionEffect(new NextRequest('http://localhost:3000/api/teacher/intervention-effect?batchId=batch_b', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
      expect(data.summary.batchId).toBe('batch_b');
      expect(data.summary.totalInterventions).toBe(1);
      expect(data.summary.withBothScores).toBe(1);
      expect(data.interventions[0]).toMatchObject({
        studentId: 'student1', preAvg: 40, postAvg: 80, gain: 40,
        preCount: 1, postCount: 1, experimentStatus: 'COMPLETED', taskStatus: 'COMPLETED',
      });
    });

    it('should not turn unrelated quizzes around a generic task into a pre/post comparison', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [{ userId: 'student1' }] as any);
      mockPrisma.userActivity.findMany.mockReset();
      mockPrisma.userActivity.findMany.mockResolvedValueOnce([{
        userId: 'student1',
        createdAt: new Date('2026-07-10T00:00:00Z'),
        details: JSON.stringify({ pushedBy: 'teacher1', batchId: 'batch_generic', pathId: 'path_generic', topicId: 'chapter-review' }),
      }] as any).mockResolvedValueOnce([] as any);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', [
        { userId: 'student1', quizId: 'quiz-ch2', score: 50, answers: '{}', completedAt: new Date('2026-07-09T00:00:00Z') },
        { userId: 'student1', quizId: 'quiz-ch8', score: 90, answers: '{}', completedAt: new Date('2026-07-11T00:00:00Z') },
      ] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
        id: 'path_generic', userId: 'student1', name: '章节复习', modules: '[]', currentModule: 1,
        totalModules: 2, status: 'ACTIVE', startedAt: new Date('2026-07-10T00:00:00Z'),
      }] as any);
      setupPrismaMock(mockPrisma, 'user', 'findMany', [{ id: 'student1', name: '学生甲', studentId: 'S001' }] as any);

      const response = await getInterventionEffect(new NextRequest('http://localhost:3000/api/teacher/intervention-effect?batchId=batch_generic', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.withBothScores).toBe(0);
      expect(data.interventions[0]).toMatchObject({
        preCount: 0, postCount: 0, preAvg: 0, postAvg: 0, gain: 0,
        comparisonLabel: '未配置同口径首测 / 再次测评',
      });
    });
  });

  describe('teacher teaching cycle', () => {
    it('counts only experiments explicitly assigned by the current teacher', async () => {
      setupAuthMock(mockVerifyToken, createMockJWTPayload({ userId: 'teacher1', role: 'TEACHER' }));
      setupPrismaMock(mockPrisma, 'classGroup', 'findMany', [{ id: 'class1' }] as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'findMany', [
        { userId: 'student1' },
        { userId: 'student2' },
      ] as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findMany', [{
        userId: 'student1',
        details: JSON.stringify({ assignedBy: 'teacher1', experimentId: 'exp02' }),
      }, {
        userId: 'student1',
        details: JSON.stringify({ assignedBy: 'teacher1', experimentId: 'forged-exp' }),
      }, {
        userId: 'student2',
        details: JSON.stringify({ assignedBy: 'teacher2', experimentId: 'exp03' }),
      }] as any);
      setupPrismaMock(mockPrisma, 'userExperiment', 'findMany', [{
        userId: 'student1', experimentId: 'exp02', status: 'COMPLETED',
        completedAt: new Date('2026-07-12T00:00:00Z'), startedAt: new Date('2026-07-10T00:00:00Z'),
      }, {
        userId: 'student2', experimentId: 'exp03', status: 'COMPLETED',
        completedAt: new Date('2026-07-12T00:00:00Z'), startedAt: new Date('2026-07-10T00:00:00Z'),
      }] as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', [] as any);
      setupPrismaMock(mockPrisma, 'user', 'findMany', [] as any);

      const response = await getTeachingCycle(new NextRequest('http://localhost:3000/api/teacher/teaching-cycle', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.preClass).toMatchObject({ totalAssigned: 1, completedAssigned: 1, completionRate: 100 });
      expect(data.inClass).toMatchObject({ totalEvents: 0, avgDurationPerStudent: 0, durationRecordCount: 0 });
      expect(data.postClass).toMatchObject({ comparableStudentCount: 0, quizParticipantCount: 0, topStudents: [] });
      expect(mockPrisma.userActivity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ action: 'TEACHER_ASSIGN_EXPERIMENT' }),
      }));
      expect(mockPrisma.userExperiment.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ experimentId: { in: ['exp02'] } }),
      }));
    });
  });
});
