import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/learning-path/save/route';
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
    });

    it('should pause existing active path and create new one', async () => {
      const existingPath = {
        id: 'existing-path',
        userId: 'user123',
        status: 'ACTIVE'
      };
      
      mockVerifyToken.mockResolvedValue(mockPayload);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', existingPath as any);
      setupPrismaMock(mockPrisma, 'learningPath', 'update', { ...existingPath, status: 'PAUSED' } as any);
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
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pathId).toBe('new-path');
      expect(mockPrisma.learningPath.update).toHaveBeenCalledWith({
        where: { id: 'existing-path' },
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
      expect(data.details).toBe('Database connection failed');
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

      expect(response.status).toBe(500);
      expect(data.error).toBe('保存学习路径失败');
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
      expect(data.details).toBe('Database query failed');
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
});
