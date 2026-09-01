import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/knowledge-graph/route';
import { GET as NodesGET, POST as NodesPOST, PUT as NodesPUT, DELETE as NodesDelete } from '@/app/api/knowledge-graph/nodes/route';
import { GET as PathsGET, POST as PathsPOST, PUT as PathsPUT } from '@/app/api/knowledge-graph/paths/route';
import { GET as ProgressGET, POST as ProgressPOST } from '@/app/api/knowledge-graph/progress/route';
import { verifyToken } from '@/lib/auth';
import { knowledgePoints } from '@/lib/knowledge-points';
import { ADDRESSING_QUIZ_ID, ADDRESSING_TASK_PRESET } from '@/lib/lesson-tasks';
import {
  createMockPrismaClient,
  createMockJWTPayload,
  createMockUserProgress,
  setupAuthMock,
  setupPrismaMock,
  clearAllMocks,
  createMockNextRequest
} from '../utils/test-mocks';

// Mock dependencies
jest.mock('@/lib/auth');

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = createMockPrismaClient();

describe('Knowledge Graph API Routes', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
    setupAuthMock(mockVerifyToken, createMockJWTPayload({
      userId: 'user123', email: 'test@example.com', role: 'STUDENT',
    }));

    // 为本文件的路由调用提供“默认安全返回”，避免未设置 mock 时抛异常导致 500
    mockPrisma.userProgress.findUnique.mockResolvedValue(null);
    mockPrisma.userProgress.upsert.mockResolvedValue({} as any);

    mockPrisma.learningProgress.findFirst.mockResolvedValue(null);
    mockPrisma.learningProgress.findMany.mockResolvedValue([]);
    mockPrisma.learningProgress.count.mockResolvedValue(0);
    mockPrisma.learningProgress.aggregate.mockResolvedValue({ _avg: { progress: 0 } } as any);
    mockPrisma.learningProgress.upsert.mockResolvedValue({
      progress: 0,
      timeSpent: 0,
      status: 'NOT_STARTED',
      lastAccessAt: new Date(),
    } as any);
    mockPrisma.learningProgress.update.mockResolvedValue({} as any);
    mockPrisma.learningProgress.deleteMany.mockResolvedValue({ count: 0 } as any);
    mockPrisma.learningProgress.groupBy.mockResolvedValue([]);

    mockPrisma.learningPath.findUnique.mockResolvedValue(null);
    mockPrisma.learningPath.findFirst.mockResolvedValue(null);
    mockPrisma.learningPath.findMany.mockResolvedValue([]);
    mockPrisma.learningPath.create.mockResolvedValue({ id: 'path_new' } as any);
    mockPrisma.learningPath.update.mockResolvedValue({} as any);

    mockPrisma.quizAttempt.findMany.mockResolvedValue([]);
    mockPrisma.quizAttempt.aggregate.mockResolvedValue({ _avg: { score: 90 } } as any);

    mockPrisma.userAchievement.findMany.mockResolvedValue([]);
  });

  describe('Main Knowledge Graph Route (/api/knowledge-graph)', () => {
    describe('GET', () => {
      it('应该返回知识图谱节点', async () => {
        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=nodes') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(Array.isArray(data.data)).toBe(true);
        // 节点总数跟随静态课程库口径；新增AI素养单元后由静态数据动态决定。
        expect(data.data).toHaveLength(knowledgePoints.length);
      });

      it('应该返回由当前知识库计算的管理概览统计', async () => {
        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=stats') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();
        const experimentIds = [...new Set(knowledgePoints.flatMap((point) => point.appliedIn ?? []))].sort();

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
        expect(data.data).toMatchObject({
          totalNodes: knowledgePoints.length,
          experimentCount: experimentIds.length,
          experimentIds,
        });
      });

      it('应该返回学习路径', async () => {
        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=paths') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(Array.isArray(data.data)).toBe(true);
      });

      it('应该返回用户进度', async () => {
        const mockUserProgressData = createMockUserProgress({
          modulesCompleted: 2,
          totalTimeSpent: 120,
          averageScore: 85
        });
        setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', mockUserProgressData);
        // 图谱进度按正式章节完成记录汇总，避免把模块编号冒充知识点编号。
        setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', [
          { chapterId: 'ch1' },
          { chapterId: 'ch2' },
        ] as any);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=progress&userId=user123') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.completedNodes).toHaveLength(2);
        expect(data.data.totalNodes).toBe(knowledgePoints.filter((point) => point.level === 1).length);
        expect(data.data.granularity).toBe('CHAPTER');
        expect(data.data.completionRate).toBeGreaterThan(0);
      });

      it('应该返回推荐节点', async () => {
        const mockUserProgressData = createMockUserProgress({
          modulesCompleted: 1,
          averageScore: 85
        });
        setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', mockUserProgressData);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=recommendations&userId=user123') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
        expect(data.data.length).toBeLessThanOrEqual(5);
      });

      it('学生不能通过 userId 查看其他学生的进度', async () => {
        const request = createMockNextRequest(
          'http://localhost:3000/api/knowledge-graph?type=progress&userId=other-student',
        ) as unknown as NextRequest;

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('无权查看该学生数据');
        expect(mockPrisma.learningProgress.findMany).not.toHaveBeenCalled();
      });

      it('应该处理无效的请求类型', async () => {
        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=invalid') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid request type');
      });

      it('应该处理数据库错误', async () => {
        setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', new Error('Database error'));

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=progress&userId=user123') as unknown as NextRequest;
        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Failed to fetch user progress');
      });
    });

    describe('POST', () => {
      it('应该处理未授权请求', async () => {
        const request = new NextRequest('http://localhost:3000/api/knowledge-graph', {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_node', nodeId: 'test-node' }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('未授权');
      });

      it('应该处理无效token', async () => {
        // verifyToken 返回 null 才会命中 Invalid token 分支
        mockVerifyToken.mockResolvedValue(null as any);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph', {
          method: 'POST',
          headers: { authorization: 'Bearer invalid-token' },
          body: JSON.stringify({ action: 'complete_node', nodeId: 'test-node' })
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.success).toBe(false);
        expect(data.error).toBe('未授权');
      });

      it('旧入口不应允许直接标记节点完成', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' });
        setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'userProgress', 'upsert', {});

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: { action: 'complete_node', nodeId: 'test-node' }
        }) as unknown as NextRequest;

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
        expect(mockPrisma.userProgress.upsert).not.toHaveBeenCalled();
      });

      it('旧入口不应返回未落盘的路径启动成功', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' });
        setupAuthMock(mockVerifyToken, mockPayload);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: { action: 'start_path', pathId: 'beginner-path' }
        }) as unknown as NextRequest;

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('所有旧写动作都应被关闭', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' });
        setupAuthMock(mockVerifyToken, mockPayload);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: { action: 'invalid_action' }
        }) as unknown as NextRequest;

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });
  });

  describe('Nodes Route (/api/knowledge-graph/nodes)', () => {
    describe('GET', () => {
      it('应该返回单个节点详情', async () => {
        setupPrismaMock(mockPrisma, 'learningProgress', 'findFirst', { progress: 75 } as any);
        setupPrismaMock(mockPrisma, 'learningProgress', 'count', 3);
        setupPrismaMock(mockPrisma, 'learningProgress', 'aggregate', { _avg: { progress: 60 } } as any);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph/nodes?id=1&userId=user123') as unknown as NextRequest;
        const response = await NodesGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe('1');
        expect(data.data.mastery).toBe(75);
      });

      it('应该返回所有节点', async () => {
        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph/nodes') as unknown as NextRequest;
        const response = await NodesGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
      });
    });

    describe('POST', () => {
      it('应关闭伪装为创建节点的学习记录入口', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const nodeData = {
          id: 'new-node',
          title: '新节点',
          type: 'concept' as const,
          difficulty: 'beginner' as const,
          description: '节点描述',
          prerequisites: [],
          connections: [],
          learningTime: 60,
          tags: ['标签'],
          resources: { videos: 1, exercises: 2, projects: 0, documents: 1 },
          position: { x: 100, y: 100 }
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/nodes', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(nodeData)
        });

        const response = await NodesPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('关闭入口不应解析客户端伪节点数据', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/nodes', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify({ title: '缺少ID的节点' })
        });

        const response = await NodesPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });

    describe('PUT', () => {
      it('应关闭旧节点更新入口', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const nodeData = {
          id: 'existing-node',
          title: '更新的节点',
          type: 'concept' as const,
          difficulty: 'intermediate' as const,
          description: '更新的描述',
          prerequisites: [],
          connections: [],
          learningTime: 90,
          tags: ['更新标签'],
          resources: { videos: 2, exercises: 3, projects: 1, documents: 2 },
          position: { x: 200, y: 200 }
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/nodes', {
          method: 'PUT',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(nodeData)
        });

        const response = await NodesPUT(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('关闭入口不应接受无编号更新', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/nodes', {
          method: 'PUT',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify({ title: '没有ID的更新' })
        });

        const response = await NodesPUT(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });

    describe('DELETE', () => {
      it('不应允许删除节点学习记录', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/nodes?id=node-to-delete', {
          method: 'DELETE',
          headers: { authorization: 'Bearer valid-token' }
        });

        const response = await NodesDelete(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('无编号时同样关闭删除入口', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/nodes', {
          method: 'DELETE',
          headers: { authorization: 'Bearer valid-token' }
        });

        const response = await NodesDelete(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });
  });

  describe('Paths Route (/api/knowledge-graph/paths)', () => {
    describe('GET', () => {
      it('应该返回单个学习路径详情', async () => {
        setupPrismaMock(mockPrisma, 'learningPath', 'findUnique', {
          id: 'beginner-path',
          userId: 'user123',
          name: '初学者路径',
          description: 'desc',
          modules: JSON.stringify(['1', '1.1', '1.2']),
          totalModules: 3,
          currentModule: 0,
          status: 'ACTIVE',
          startedAt: new Date(),
          completedAt: null,
          progress: [
            { status: 'COMPLETED', timeSpent: 30, moduleId: '1', completedAt: new Date() },
            { status: 'IN_PROGRESS', timeSpent: 10, moduleId: '1.1', completedAt: null },
          ],
          user: { id: 'user123', username: 'testuser' },
        } as any);
        setupPrismaMock(mockPrisma, 'learningProgress', 'groupBy', [{ userId: 'u1' }]);
        setupPrismaMock(mockPrisma, 'quizAttempt', 'aggregate', { _avg: { score: 80 } } as any);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph/paths?id=beginner-path') as unknown as NextRequest;
        const response = await PathsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.id).toBe('beginner-path');
        expect(data.data.title).toBeDefined();
        expect(Array.isArray(data.data.nodes)).toBe(true);
        expect(data.data.nodes).toEqual(['1', '1.1', '1.2']);
        expect(data.data.isPublic).toBe(false);
        expect(data.data.ratingDataSufficient).toBe(false);
      });

      it('应该返回所有学习路径', async () => {
        setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
          id: 'beginner-path',
          userId: 'user123',
          name: '初学者路径',
          description: 'desc',
          modules: JSON.stringify(['1', '1.1', '1.2']),
          totalModules: 3,
          currentModule: 0,
          status: 'ACTIVE',
          createdAt: new Date(),
          progress: [{ status: 'COMPLETED', timeSpent: 30 }],
          user: { id: 'user123', username: 'testuser' },
          _count: { progress: 1 },
        }] as any);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph/paths') as unknown as NextRequest;
        const response = await PathsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
        expect(data.data.length).toBeGreaterThan(0);
        expect(data.data[0].isPublic).toBe(false);
        expect(mockPrisma.learningPath.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { userId: 'user123' },
        }));
      });

      it('应该根据难度筛选路径', async () => {
        setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [{
          id: 'beginner-path',
          userId: 'user123',
          name: '初学者路径',
          description: 'desc',
          modules: JSON.stringify(['1', '1.1', '1.2']), // <=3 => beginner
          totalModules: 3,
          currentModule: 0,
          status: 'ACTIVE',
          createdAt: new Date(),
          progress: [{ status: 'COMPLETED', timeSpent: 30 }],
          user: { id: 'user123', username: 'testuser' },
          _count: { progress: 1 },
        }] as any);

        const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph/paths?difficulty=beginner') as unknown as NextRequest;
        const response = await PathsGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(Array.isArray(data.data)).toBe(true);
        data.data.forEach((path: any) => {
          expect(path.difficulty).toBe('beginner');
        });
      });
    });

    describe('POST', () => {
      it('应关闭旧学习路径创建入口', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningPath', 'create', { id: 'new-path' } as any);

        const pathData = {
          id: 'new-path',
          title: '新学习路径',
          description: '路径描述',
          nodes: ['node1', 'node2'],
          estimatedTime: 120,
          difficulty: 'intermediate' as const,
          tags: ['标签'],
          isPublic: true
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/paths', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(pathData)
        });

        const response = await PathsPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('关闭入口不应接收不完整路径', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/paths', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify({ title: '缺少必需字段的路径' })
        });

        const response = await PathsPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });

    describe('PUT', () => {
      it('应关闭旧学习路径更新入口', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningPath', 'findUnique', { id: 'existing-path', userId: 'user123', name: 'old', description: 'old', modules: '[]', totalModules: 0 } as any);
        setupPrismaMock(mockPrisma, 'learningPath', 'update', { id: 'existing-path' } as any);

        const pathData = {
          id: 'existing-path',
          title: '更新的路径',
          description: '更新的描述',
          nodes: ['node1', 'node2', 'node3'],
          estimatedTime: 180,
          difficulty: 'advanced' as const,
          tags: ['更新标签'],
          isPublic: false
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/paths', {
          method: 'PUT',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(pathData)
        });

        const response = await PathsPUT(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });
  });

  describe('Progress Route (/api/knowledge-graph/progress)', () => {
    describe('GET', () => {
      it('应该返回特定节点的进度', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningProgress', 'findFirst', {
          moduleId: 'test-node',
          chapterId: '1',
          progress: 50,
          timeSpent: 10,
          status: 'IN_PROGRESS',
          lastAccessAt: new Date(),
        } as any);
        setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', []);
        setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', []);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress?nodeId=test-node', {
          headers: { authorization: 'Bearer valid-token' }
        });

        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.nodeId).toBe('test-node');
        expect(data.data.progress).toBeDefined();
        expect(data.data.mastery).toBeDefined();
      });

      it('应该返回特定路径的进度', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', {
          id: 'beginner-path',
          userId: 'user123',
          name: '初学者路径',
          modules: JSON.stringify(['1', '1.1', '1.2']),
          currentModule: 1,
          status: 'ACTIVE',
          progress: [
            { userId: 'user123', moduleId: '1', progress: 100, status: 'COMPLETED', timeSpent: 20, completedAt: new Date() },
            { userId: 'user123', moduleId: '1.1', progress: 50, status: 'IN_PROGRESS', timeSpent: 10, completedAt: null },
          ],
        } as any);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress?pathId=beginner-path', {
          headers: { authorization: 'Bearer valid-token' }
        });

        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.pathId).toBe('beginner-path');
        expect(data.data.overallProgress).toBeDefined();
        expect(Array.isArray(data.data.nodeProgress)).toBe(true);
        expect(mockPrisma.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'beginner-path', userId: 'user123' },
        }));
      });

      it('应该按结构化任务步骤和当前步骤返回路径进度', async () => {
        setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', {
          id: 'addressing-path',
          userId: 'user123',
          name: ADDRESSING_TASK_PRESET.title,
          modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
          currentModule: 2,
          status: 'ACTIVE',
          progress: [],
        } as any);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress?pathId=addressing-path', {
          headers: { authorization: 'Bearer valid-token' },
        });
        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.overallProgress).toBe(33);
        expect(data.data.completedNodes).toEqual(['addressing-graph', 'addressing-animation']);
        expect(data.data.currentNode).toBe('addressing-pre-quiz');
        expect(data.data.milestones).toHaveLength(6);
      });

      it('不应读取其他用户的学习路径', async () => {
        setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', null);
        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress?pathId=foreign-path', {
          headers: { authorization: 'Bearer valid-token' },
        });

        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Learning path not found');
        expect(mockPrisma.learningPath.findFirst).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'foreign-path', userId: 'user123' },
        }));
      });

      it('应该把 3.1 节点映射到正式章节进度和专项测评', async () => {
        setupPrismaMock(mockPrisma, 'learningProgress', 'findFirst', {
          moduleId: 'module-1', chapterId: 'ch3', progress: 70, timeSpent: 300,
          status: 'IN_PROGRESS', lastAccessAt: new Date(),
        } as any);
        setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', []);
        setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', [{ score: 80 }] as any);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress?nodeId=3.1', {
          headers: { authorization: 'Bearer valid-token' },
        });
        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.mastery).toBe(80);
        expect(mockPrisma.learningProgress.findFirst).toHaveBeenCalledWith({
          where: { userId: 'user123', moduleId: 'module-1', chapterId: 'ch3' },
        });
        expect(mockPrisma.quizAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { userId: 'user123', quizId: { in: expect.arrayContaining([ADDRESSING_QUIZ_ID]) } },
        }));
      });

      it('应该返回用户整体进度概览', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', [{
          userId: 'user123',
          moduleId: '1',
          progress: 100,
          timeSpent: 20,
          status: 'COMPLETED',
          lastAccessAt: new Date(),
        }] as any);
        setupPrismaMock(mockPrisma, 'learningPath', 'findMany', [] as any);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress', {
          headers: { authorization: 'Bearer valid-token' }
        });

        const response = await ProgressGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.totalNodesAccessed).toBeDefined();
        expect(data.data.totalNodesCompleted).toBeDefined();
        expect(Array.isArray(data.data.activePaths)).toBe(true);
        expect(Array.isArray(data.data.achievements)).toBe(true);
      });
    });

    describe('POST', () => {
      it('不应信任客户端直接提交的进度', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningProgress', 'upsert', {
          progress: 75,
          timeSpent: 45,
          status: 'IN_PROGRESS',
          lastAccessAt: new Date(),
        } as any);

        const progressData = {
          nodeId: 'test-node',
          progress: 75,
          timeSpent: 45,
          mastery: 68
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(progressData)
        });

        const response = await ProgressPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('不应允许客户端直接判定节点完成', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'learningProgress', 'upsert', {
          progress: 100,
          timeSpent: 30,
          status: 'COMPLETED',
          lastAccessAt: new Date(),
        } as any);
        setupPrismaMock(mockPrisma, 'learningProgress', 'count', 1);

        const progressData = {
          nodeId: 'test-node',
          progress: 100,
          timeSpent: 30,
          mastery: 95
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(progressData)
        });

        const response = await ProgressPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('关闭入口不接受越界进度', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const progressData = {
          nodeId: 'test-node',
          progress: 150, // 无效值
          timeSpent: 45,
          mastery: 68
        };

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify(progressData)
        });

        const response = await ProgressPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });

      it('关闭入口不接受缺字段进度', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'student' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/knowledge-graph/progress', {
          method: 'POST',
          headers: { authorization: 'Bearer valid-token' },
          body: JSON.stringify({ timeSpent: 45 }) // 缺少nodeId和progress
        });

        const response = await ProgressPOST(request);
        const data = await response.json();

        expect(response.status).toBe(405);
        expect(data.success).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('已关闭的旧写入口不解析请求体', async () => {
      mockVerifyToken.mockResolvedValue(createMockJWTPayload({ userId: 'user123' }));

      const request = new NextRequest('http://localhost:3000/api/knowledge-graph', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(405);
      expect(data.success).toBe(false);
    });

    it('应该处理数据库连接错误', async () => {
      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', new Error('Connection failed'));

      const request = createMockNextRequest('http://localhost:3000/api/knowledge-graph?type=progress&userId=user123') as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
