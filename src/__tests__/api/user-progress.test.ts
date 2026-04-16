import { NextRequest } from 'next/server';

// Mock the auth module
jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

// Mock the prisma module
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userProgress: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  setupAuthMock,
  setupPrismaMock,
  clearAllMocks
} from '../utils/test-mocks';
import { GET, POST, PUT } from '@/app/api/user/progress/route';

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('/api/user/progress API路由', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma as any);
  });

  describe('GET /api/user/progress', () => {
    it('应该返回用户进度数据', async () => {
      // Mock认证用户
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      // Mock数据库响应
      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', {
        id: 'progress123',
        userId: 'user123',
        modulesCompleted: 5,
        totalTimeSpent: 3600,
        averageScore: 85,
        streakDays: 7,
        lastActiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { 'authorization': 'Bearer valid-token' }
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('modulesCompleted', 5);
      expect(data).toHaveProperty('totalTimeSpent', 3600);
      expect(data).toHaveProperty('averageScore', 85);
      expect(data).toHaveProperty('streakDays', 7);
    });

    it('应该处理未认证用户', async () => {
      setupAuthMock(mockVerifyToken, null);

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { 'authorization': 'Bearer invalid-token' }
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('应该处理用户进度不存在的情况', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { 'authorization': 'Bearer valid-token' }
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Progress not found');
    });

    it('应该处理数据库错误', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { 'authorization': 'Bearer valid-token' }
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('POST /api/user/progress', () => {
    it('应该创建新的用户进度', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      const newProgress = {
        modulesCompleted: 1,
        totalTimeSpent: 600,
        averageScore: 90,
        streakDays: 1,
      };

      setupPrismaMock(mockPrisma, 'userProgress', 'create', {
        id: 'progress123',
        userId: 'user123',
        ...newProgress,
        lastActiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        method: 'POST',
        body: JSON.stringify(newProgress),
        headers: { 
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-token'
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('modulesCompleted', 1);
      expect(data).toHaveProperty('totalTimeSpent', 600);
      expect(mockPrisma.userProgress.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          ...newProgress,
        },
      });
    });

    it('应该验证请求数据', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      const invalidData = {
        modulesCompleted: -1, // 无效值
        totalTimeSpent: 'invalid', // 无效类型
      };

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-token'
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('应该处理JSON解析错误', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        method: 'POST',
        body: 'invalid json',
        headers: { 
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-token'
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Invalid JSON');
    });
  });

  describe('PUT /api/user/progress', () => {
    it('应该更新现有的用户进度', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT'
      });

      const updateData = {
        modulesCompleted: 6,
        totalTimeSpent: 4200,
        averageScore: 88,
        streakDays: 8,
      };

      setupPrismaMock(mockPrisma, 'userProgress', 'update', {
        id: 'progress123',
        userId: 'user123',
        ...updateData,
        lastActiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-token'
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('modulesCompleted', 6);
      expect(data).toHaveProperty('totalTimeSpent', 4200);
      expect(mockPrisma.userProgress.update).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        data: updateData,
      });
    });

    it('应该处理部分更新', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123', email: 'test@example.com'
      } as any);

      const partialUpdate = {
        modulesCompleted: 7,
      };

      setupPrismaMock(mockPrisma, 'userProgress', 'update', {
        id: 'progress123',
        userId: 'user123',
        modulesCompleted: 7,
        totalTimeSpent: 3600,
        averageScore: 85,
        streakDays: 7,
        lastActiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        method: 'PUT',
        body: JSON.stringify(partialUpdate),
        headers: { 
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-token'
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('modulesCompleted', 7);
      expect(mockPrisma.userProgress.update).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        data: partialUpdate,
      });
    });

    it('应该处理记录不存在的情况', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123', email: 'test@example.com'
      } as any);

      const updateData = { modulesCompleted: 6 };

      const err: any = new Error('Record not found');
      err.code = 'P2025'; // Prisma record not found error
      (mockPrisma.userProgress.update as jest.Mock).mockRejectedValue(err);

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 
          'Content-Type': 'application/json',
          'authorization': 'Bearer valid-token'
        },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toHaveProperty('error', 'Progress not found');
    });
  });

  describe('并发和性能测试', () => {
    it('应该处理并发请求', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123', email: 'test@example.com'
      } as any);

      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', {
        id: 'progress123',
        userId: 'user123',
        modulesCompleted: 5,
        totalTimeSpent: 3600,
        averageScore: 85,
        streakDays: 7,
        lastActiveDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const requests = Array.from({ length: 10 }, () => 
        GET(new NextRequest('http://localhost:3000/api/user/progress', {
          headers: { authorization: 'Bearer valid-token' }
        }))
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('应该在合理时间内响应', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123', email: 'test@example.com'
      } as any);

      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', {
        id: 'progress123',
        userId: 'user123',
        modulesCompleted: 5,
        totalTimeSpent: 3600,
        averageScore: 85,
        streakDays: 7,
        lastActiveDate: new Date(),
        updatedAt: new Date(),
        createdAt: new Date(),
      });

      const startTime = Date.now();
      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { authorization: 'Bearer valid-token' }
      });
      const response = await GET(request);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内响应
    });
  });

  describe('错误边界测试', () => {
    it('应该处理数据库连接超时', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123', email: 'test@example.com'
      } as any);

      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', new Error('Connection timeout'));

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { authorization: 'Bearer valid-token' }
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error', 'Internal server error');
    });

    it('应该处理内存不足错误', async () => {
      mockVerifyToken.mockResolvedValue({
        userId: 'user123', email: 'test@example.com'
      } as any);

      setupPrismaMock(mockPrisma, 'userProgress', 'findUnique', new Error('Out of memory'));

      const request = new NextRequest('http://localhost:3000/api/user/progress', {
        headers: { authorization: 'Bearer valid-token' }
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toHaveProperty('error', 'Internal server error');
    });
  });
});
