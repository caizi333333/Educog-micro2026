import { NextRequest } from 'next/server';
import { POST as LoginPOST } from '@/app/api/auth/login/route';
import { POST as RegisterPOST } from '@/app/api/auth/register/route';
import { GET as ProfileGET, PUT as ProfilePUT } from '@/app/api/user/profile/route';
import { GET as UsersGET, POST as UsersPOST } from '@/app/api/users/route';
import { GET as UserGET, PUT as UserPUT } from '@/app/api/users/[id]/route';
import { setupPrismaMock, createMockNextRequest, createMockJWTPayload, setupAuthMock } from '../utils/test-mocks';



jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    },
    userActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    userExperiment: {
      groupBy: jest.fn()
    },
    session: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn()
    },
    userAchievement: {
      create: jest.fn(),
      findUnique: jest.fn()
    },
    learningProgress: {
      aggregate: jest.fn()
    },
    quizAttempt: {
      aggregate: jest.fn()
    }
  }
}));

jest.mock('@/lib/auth', () => ({
  login: jest.fn(),
  register: jest.fn(),
  verifyToken: jest.fn()
}));

jest.mock('@/lib/pagination', () => ({
  getPaginationParams: jest.fn().mockReturnValue({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }),
  createPaginatedResponse: jest.fn().mockImplementation((data, total, params) => ({
    data,
    pagination: {
      page: params.page || 1,
      limit: params.limit || 10,
      total,
      totalPages: Math.ceil(total / (params.limit || 10)),
      hasNext: (params.page || 1) < Math.ceil(total / (params.limit || 10)),
      hasPrev: (params.page || 1) > 1
    }
  })),
  getPrismaSkipTake: jest.fn().mockReturnValue({
    skip: 0,
    take: 10
  })
}));

import { login, register, verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const mockLogin = login as jest.MockedFunction<typeof login>;
const mockRegister = register as jest.MockedFunction<typeof register>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('User Management API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // 不要重置Prisma mocks，只清除调用历史
    // 每个测试会单独设置需要的mock返回值
  });

  describe('Authentication Routes', () => {
    describe('POST /api/auth/login', () => {
      it('应该成功登录用户', async () => {
        const mockUser = {
          id: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          name: '测试用户',
          role: 'STUDENT',
          avatar: null,
          studentId: null,
          teacherId: null
        };

        mockLogin.mockResolvedValue({
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          firstLoginAchievement: null
        });

        const request = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '127.0.0.1',
            'user-agent': 'test-agent'
          },
          body: JSON.stringify({
            emailOrUsername: 'test@example.com',
            password: 'password123'
          })
        });

        const response = await LoginPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.email).toBe('test@example.com');
        expect(mockLogin).toHaveBeenCalledWith(
          'test@example.com',
          'password123',
          '127.0.0.1',
          'test-agent'
        );
      });

      it('应该处理登录失败', async () => {
        mockLogin.mockRejectedValue(new Error('用户名或密码错误'));

        const request = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            emailOrUsername: 'wrong@example.com',
            password: 'wrongpassword'
          })
        });

        const response = await LoginPOST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('用户名或密码错误');
      });

      it('应该验证请求体格式', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            password: '123'
            // 缺少emailOrUsername字段
          })
        });

        const response = await LoginPOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('邮箱/用户名和密码不能为空');
      });
    });

    describe('POST /api/auth/register', () => {
      it('应该成功注册用户', async () => {
        const mockUser = {
          id: 'user123',
          email: 'newuser@example.com',
          username: 'newuser',
          name: '新用户',
          role: 'STUDENT',
          avatar: null,
          studentId: null,
          teacherId: null
        };

        mockRegister.mockResolvedValue({
          user: mockUser,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          firstLoginAchievement: { id: 'first-login', name: '首次登录' }
        } as any);

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'newuser@example.com',
            username: 'newuser',
            password: 'password123'
          })
        });

        const response = await RegisterPOST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.user.email).toBe('newuser@example.com');
      });

      it('应该处理注册失败', async () => {
        mockRegister.mockRejectedValue(new Error('邮箱已存在'));

        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'existing@example.com',
            username: 'existinguser',
            password: 'password123'
          })
        });

        const response = await RegisterPOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('邮箱已存在');
      });

      it('应该验证注册数据格式', async () => {
        const request = new NextRequest('http://localhost:3000/api/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'invalid-email',
            username: 'testuser',
            password: 'password123'
          })
        });

        const response = await RegisterPOST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('邮箱格式不正确');
      });
    });
  });

  describe('User Profile Routes', () => {
    describe('GET /api/user/profile', () => {
      it('应该获取用户资料', async () => {
        const mockUser = {
          id: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          name: '测试用户',
          avatar: null,
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'S001',
          teacherId: null,
          class: '计算机1班',
          grade: '2023',
          major: '计算机科学',
          department: null,
          title: null,
          totalPoints: 1500,
          createdAt: new Date(),
          lastLoginAt: new Date(),
          _count: {
            sessions: 5,
            experiments: 10,
            quizAttempts: 8,
            achievements: 3,
            learningPaths: 2
          }
        }

        const mockActivities = [
          { action: 'LOGIN', details: null, createdAt: new Date() },
          { action: 'COMPLETE_QUIZ', details: '{"score": 85}', createdAt: new Date() }
        ];

        const mockLearningStats = {
          _sum: { timeSpent: 300 },
          _avg: { progress: 75 },
          _count: 5
        };

        const mockQuizStats = {
          _avg: { score: 82 },
          _max: { score: 95 },
          _count: 8
        };

        mockVerifyToken.mockResolvedValue({
          userId: 'user123',
          email: 'test@example.com',
          role: 'STUDENT',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        } as any);
        
        // 确保所有Prisma mock都被正确设置
        setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser);
        setupPrismaMock(mockPrisma, 'userActivity', 'findMany', mockActivities);
        setupPrismaMock(mockPrisma, 'learningProgress', 'aggregate', mockLearningStats);
        setupPrismaMock(mockPrisma, 'quizAttempt', 'aggregate', mockQuizStats);
        
        // Setup user lookup - already handled by setupPrismaMock above

        const request = new NextRequest('http://localhost:3000/api/user/profile', {
          headers: { authorization: 'Bearer valid-token' }
        });

        const response = await ProfileGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.profile.email).toBe('test@example.com');
        expect(data.profile.stats.totalExperiments).toBe(10);
        expect(data.profile.stats.averageQuizScore).toBe(82);
        expect(data.profile.recentActivity).toHaveLength(2);
      });

      it('应该处理未授权请求', async () => {
        const request = createMockNextRequest('http://localhost:3000/api/user/profile') as any;

        const response = await ProfileGET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('未授权');
      });
    });

    describe('PUT /api/user/profile', () => {
      it('应该更新用户资料', async () => {
        const mockUpdatedUser = {
          id: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          name: '更新的用户',
          avatar: 'new-avatar.jpg',
          role: 'STUDENT',
          status: 'ACTIVE',
          class: '计算机1班',
          grade: '2023',
          major: '计算机科学',
          department: null,
          title: null,
          updatedAt: new Date()
        };

        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'user', 'update', mockUpdatedUser);
        setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
        
        // User update - already handled by setupPrismaMock above

        const request = new NextRequest('http://localhost:3000/api/user/profile', {
          method: 'PUT',
          headers: {
            authorization: 'Bearer valid-token',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            name: '更新的用户',
            avatar: 'new-avatar.jpg'
          })
        });

        const response = await ProfilePUT(request);
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.name).toBe('更新的用户');
        expect(data.message).toBe('个人资料已更新');
        expect(mockPrisma.userActivity.create).toHaveBeenCalled();
      });
    });
  });

  describe('Users Management Routes', () => {
    describe('GET /api/users', () => {
      it('应该获取用户列表（管理员权限）', async () => {
        const mockUsers = [
          {
            id: 'user1',
            email: 'user1@example.com',
            username: 'user1',
            name: '用户1',
            avatar: null,
            role: 'STUDENT',
            status: 'ACTIVE',
            studentId: 'S001',
            teacherId: null,
            class: '计算机1班',
            grade: '2023',
            major: '计算机科学',
            department: null,
            title: null,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            _count: { quizAttempts: 5, experiments: 3, achievements: 2 }
          },
          {
            id: 'user2',
            email: 'user2@example.com',
            username: 'user2',
            name: '用户2',
            avatar: null,
            role: 'TEACHER',
            status: 'ACTIVE',
            studentId: null,
            teacherId: 'T001',
            class: null,
            grade: null,
            major: null,
            department: '计算机学院',
            title: '副教授',
            createdAt: new Date(),
            lastLoginAt: new Date(),
            _count: { quizAttempts: 3, experiments: 1, achievements: 1 }
          }
        ];

        mockVerifyToken.mockResolvedValue({
          userId: 'admin123',
          email: 'admin@example.com',
          role: 'ADMIN',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        } as any);
        setupPrismaMock(mockPrisma, 'user', 'findMany', mockUsers);
        setupPrismaMock(mockPrisma, 'user', 'count', 2);

        const url = new URL('http://localhost:3000/api/users?page=1&limit=10');
        const request = new NextRequest(url, {
          headers: { authorization: 'Bearer admin-token' }
        });

        const response = await UsersGET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data).toHaveLength(2);
        expect(data.pagination.total).toBe(2);
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(10);
        expect(data.data[0].name).toBe('用户1');
      });

      it('应该拒绝非管理员访问', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/users', {
          headers: { authorization: 'Bearer user-token' }
        });

        const response = await UsersGET(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toBe('权限不足');
      });
    });

    describe('POST /api/users', () => {
      it('应该创建新用户（管理员权限）', async () => {
        const mockNewUser = {
          id: 'newuser123',
          email: 'newuser@example.com',
          username: 'newuser',
          name: '新用户',
          avatar: null,
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'S003',
          teacherId: null,
          class: '计算机1班',
          grade: '2023',
          major: '计算机科学',
          department: null,
          title: null,
          createdAt: new Date(),
          lastLoginAt: null
        };

        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'user', 'create', mockNewUser);
        setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

        const request = new NextRequest('http://localhost:3000/api/users', {
          method: 'POST',
          headers: {
            authorization: 'Bearer admin-token',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            email: 'newuser@example.com',
            username: 'newuser',
            password: 'password123',
            name: '新用户',
            role: 'STUDENT',
            studentId: 'S003',
            class: '计算机1班',
            grade: '2023',
            major: '计算机科学'
          })
        });

        const response = await UsersPOST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.email).toBe('newuser@example.com');
        expect(mockPrisma.userActivity.create).toHaveBeenCalled();
      });
    });

    describe('GET /api/users/[id]', () => {
      it('应该获取用户详情（管理员权限）', async () => {
        const mockUser = {
          id: 'user123',
          email: 'user@example.com',
          username: 'testuser',
          name: '测试用户',
          avatar: null,
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'S001',
          teacherId: null,
          class: '计算机1班',
          grade: '2023',
          major: '计算机科学',
          department: null,
          title: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
          _count: { activities: 5 }
        };

        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser);

        const response = await UserGET(
          new NextRequest('http://localhost:3000/api/users/user123', {
            headers: { authorization: 'Bearer admin-token' }
          }),
          { params: { id: 'user123' } } as any
        );
        
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.email).toBe('user@example.com');
      });

      it('应该允许用户查看自己的信息', async () => {
        const mockUser = {
          id: 'user123',
          email: 'user@example.com',
          username: 'testuser',
          name: '测试用户',
          avatar: null,
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'S001',
          teacherId: null,
          class: '计算机1班',
          grade: '2023',
          major: '计算机科学',
          department: null,
          title: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: new Date(),
          _count: { experiments: 3, activities: 5 }
        };

        const mockStats = [
          { status: 'COMPLETED', _count: 2 },
          { status: 'IN_PROGRESS', _count: 1 }
        ];

        const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
        setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser);
        (mockPrisma as any).userExperiment = {
          groupBy: jest.fn().mockResolvedValue(mockStats)
        };

        const response = await UserGET(
          new NextRequest('http://localhost:3000/api/users/user123', {
            headers: { authorization: 'Bearer user-token' }
          }),
          { params: { id: 'user123' } } as any
        );
        
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.name).toBe('测试用户');
        expect(data.stats.completedExperiments).toBe(2);
        expect(data.stats.inProgressExperiments).toBe(1);
        expect(data.stats.totalActivities).toBe(5);
      });
    });

    describe('PUT /api/users/[id]', () => {
      it('应该更新用户信息（管理员权限）', async () => {
        // 使用原有的mock设置
        mockVerifyToken.mockResolvedValue({
          userId: 'admin123',
          email: 'admin@example.com',
          role: 'ADMIN',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        } as any);
        
        const mockUpdatedUser = {
          id: 'user123',
          email: 'updated@example.com',
          username: 'updateduser',
          name: '更新的用户',
          avatar: null,
          role: 'TEACHER',
          status: 'ACTIVE'
        };
        
        setupPrismaMock(mockPrisma, 'user', 'update', mockUpdatedUser);
        setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

        let response;
        try {
          response = await UserPUT(
            new NextRequest('http://localhost:3000/api/users/user123', {
              method: 'PUT',
              headers: { 
                authorization: 'Bearer admin-token',
                'content-type': 'application/json'
              },
              body: JSON.stringify({
                email: 'updated@example.com',
                role: 'TEACHER',
                name: '更新的用户'
              })
            }),
            { params: { id: 'user123' } } as any
          );
        } catch (error) {
          throw new Error(`UserPUT threw an error: ${error}`);
        }
        
        // Debug: check if response is valid
        if (!response) {
          throw new Error('Response is undefined');
        }
        
        const data = await response.json();
        
        // Debug: throw detailed error if test fails
        if (response.status !== 200) {
          throw new Error(`Test failed with status ${response.status}. Response: ${JSON.stringify(data, null, 2)}. VerifyToken calls: ${JSON.stringify(mockVerifyToken.mock.calls, null, 2)}`);
        }

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.email).toBe('updated@example.com');
        expect(mockPrisma.userActivity.create).toHaveBeenCalled();
      });

      it('应该允许用户更新自己的部分信息', async () => {
        mockVerifyToken.mockResolvedValue({
          userId: 'user123',
          email: 'test@example.com',
          role: 'STUDENT',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        } as any);
        
        const mockUpdatedUser = {
          id: 'user123',
          email: 'user@example.com',
          username: 'testuser',
          name: '更新的姓名',
          avatar: null,
          role: 'STUDENT',
          status: 'ACTIVE'
        };
        
        setupPrismaMock(mockPrisma, 'user', 'update', mockUpdatedUser);
        setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

        const response = await UserPUT(
          new NextRequest('http://localhost:3000/api/users/user123', {
            method: 'PUT',
            headers: { 
              authorization: 'Bearer user-token',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              name: '更新的姓名',
              class: '新班级'
            })
          }),
          { params: { id: 'user123' } } as any
        );
        
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.name).toBe('更新的姓名');
      });

      it('应该正确处理普通用户更新敏感字段', async () => {
        mockVerifyToken.mockResolvedValue({
          userId: 'user123',
          email: 'test@example.com',
          role: 'STUDENT',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        } as any);
        
        // 普通用户尝试更新role字段，应该被忽略
        const mockUpdatedUser = {
          id: 'user123',
          email: 'user@example.com',
          username: 'testuser',
          name: '更新的姓名',
          role: 'STUDENT', // 保持原来的角色
          status: 'ACTIVE'
        };
        
        setupPrismaMock(mockPrisma, 'user', 'update', mockUpdatedUser);
        setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

        const response = await UserPUT(
          new NextRequest('http://localhost:3000/api/users/user123', {
            method: 'PUT',
            headers: { 
              authorization: 'Bearer user-token',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              name: '更新的姓名',
              role: 'ADMIN' // 尝试提升权限
            })
          }),
          { params: { id: 'user123' } } as any
        );
        
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.user.role).toBe('STUDENT'); // 角色没有改变
        
        // 验证update调用中没有包含role字段
        expect(mockPrisma.user.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.not.objectContaining({
              role: 'ADMIN'
            })
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('应该处理JSON解析错误', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: 'invalid json'
      }) as any;

      const response = await LoginPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请求格式错误');
    });

    it('应该处理数据库连接错误', async () => {
      const mockPayload = createMockJWTPayload({ userId: 'user123', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'user', 'findUnique', new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/user/profile', {
        headers: { authorization: 'Bearer valid-token' }
      });

      const response = await ProfileGET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('获取用户资料失败');
    });

    it('应该处理权限验证失败', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Token verification failed'));

      const request = new NextRequest('http://localhost:3000/api/users', {
        headers: { authorization: 'Bearer invalid-token' }
      });

      const response = await UsersGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });
});