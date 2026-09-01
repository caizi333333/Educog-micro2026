import { NextRequest } from 'next/server';
import { Buffer, File } from 'node:buffer';
import { POST as LoginPOST } from '@/app/api/auth/login/route';
import { POST as RegisterPOST } from '@/app/api/auth/register/route';
import { GET as ProfileGET, PUT as ProfilePUT } from '@/app/api/user/profile/route';
import { GET as UsersGET, POST as UsersPOST } from '@/app/api/users/route';
import { DELETE as UserDELETE, GET as UserGET, PUT as UserPUT } from '@/app/api/users/[id]/route';
import { POST as AvatarPOST } from '@/app/api/upload/avatar/route';
import { setupPrismaMock, createMockNextRequest, createMockJWTPayload, setupAuthMock } from '../utils/test-mocks';



jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
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
    classGroup: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn()
    },
    classEnrollment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn()
    },
    learningEvent: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn()
    },
    learningProgress: {
      aggregate: jest.fn(),
      count: jest.fn()
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
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (operation: unknown) => {
      if (typeof operation === 'function') return operation(mockPrisma);
      return Promise.all(operation as Promise<unknown>[]);
    });
    
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
        mockLogin.mockRejectedValue(new Error('账号或密码不正确，或账号已停用'));

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
        expect(data.error).toBe('账号或密码不正确，或账号已停用');
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
        mockRegister.mockRejectedValue(new Error('邮箱已被注册'));

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
        expect(data.error).toBe('邮箱已被注册');
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
          classEnrollments: [],
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
        setupPrismaMock(mockPrisma, 'learningProgress', 'count', 1);
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
            name: '  更新的用户  '
          })
        });

        const response = await ProfilePUT(request);
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.user.name).toBe('更新的用户');
        expect(data.user.password).toBeUndefined();
        expect(data.message).toBe('个人资料已更新');
        expect(mockPrisma.userActivity.create).toHaveBeenCalled();
        expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
          data: { name: '更新的用户' },
          select: expect.not.objectContaining({ password: true }),
        }));
      });

      it('不得通过个人资料接口修改身份字段或直接写入头像', async () => {
        const mockPayload = createMockJWTPayload({
          userId: 'user123',
          email: 'test@example.com',
          role: 'STUDENT',
        });
        setupAuthMock(mockVerifyToken, mockPayload);

        const request = new NextRequest('http://localhost:3000/api/user/profile', {
          method: 'PUT',
          headers: {
            authorization: 'Bearer valid-token',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ studentId: 'S999', avatar: 'data:image/png;base64,fake' }),
        });

        const response = await ProfilePUT(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toContain('不可自行修改');
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
        expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
      });
    });

    describe('POST /api/upload/avatar', () => {
      function avatarRequest(file: File): Request {
        return {
          headers: new Headers({ authorization: 'Bearer valid-token' }),
          formData: jest.fn().mockResolvedValue({ get: () => file }),
        } as unknown as Request;
      }

      it('应校验图片内容并将头像持久保存到用户资料', async () => {
        setupAuthMock(mockVerifyToken, createMockJWTPayload({
          userId: 'user123',
          email: 'test@example.com',
          role: 'STUDENT',
        }));
        setupPrismaMock(mockPrisma, 'user', 'update', { id: 'user123' } as any);
        setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
        const file = new File([
          Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEElEQVR4nGNgOPH/PxjDGABdggsZvNvWLQAAAABJRU5ErkJggg==', 'base64'),
        ], 'avatar.png', { type: 'image/png' });

        const response = await AvatarPOST(avatarRequest(file));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toContain('no-store');
        expect(data.avatar).toMatch(/^data:image\/webp;base64,/);
        expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'user123' },
          data: { avatar: expect.stringMatching(/^data:image\/webp;base64,/) },
        }));
        expect(mockPrisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ action: 'UPDATE_AVATAR' }),
        }));
      });

      it('声明格式与图片签名不一致时不得写入', async () => {
        setupAuthMock(mockVerifyToken, createMockJWTPayload({
          userId: 'user123',
          email: 'test@example.com',
          role: 'STUDENT',
        }));
        const disguised = new File([
          Uint8Array.from([0xff, 0xd8, 0xff, 0x00]),
        ], 'fake.png', { type: 'image/png' });

        const response = await AvatarPOST(avatarRequest(disguised));

        expect(response.status).toBe(400);
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
        expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
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

      it('不得通过 fields 参数读取密码等敏感字段', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        const request = new NextRequest('http://localhost:3000/api/users?fields=id,password', {
          headers: { authorization: 'Bearer admin-token' }
        });

        const response = await UsersGET(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: '包含不允许返回的用户字段' });
        expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
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

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.user.email).toBe('newuser@example.com');
        expect(mockPrisma.userActivity.create).toHaveBeenCalled();
      });

      it('创建用户必须显式设置符合要求的初始密码', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        const request = new NextRequest('http://localhost:3000/api/users', {
          method: 'POST',
          headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'newuser@example.com',
            username: 'newuser',
            name: '新用户',
            password: '123',
            role: 'STUDENT',
          })
        });

        const response = await UsersPOST(request);

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: '初始密码长度至少为6位' });
        expect(mockPrisma.user.create).not.toHaveBeenCalled();
      });

      it('相同创建请求应返回原账号且不重复写入', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        const existingUser = {
          id: 'existing-user',
          email: 'stable@example.com',
          username: 'stable-user',
          name: '稳健用户',
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: null,
          teacherId: null,
          createdAt: new Date(),
        };
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(existingUser);

        const response = await UsersPOST(new NextRequest('http://localhost:3000/api/users', {
          method: 'POST',
          headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'stable@example.com',
            username: 'stable-user',
            password: 'password123',
            name: '稳健用户',
            requestId: 'request_12345678',
          }),
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, duplicate: true, user: { id: 'existing-user' } });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('并发创建冲突后应按请求标识恢复原回执', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        const existingUser = {
          id: 'concurrent-user',
          email: 'concurrent@example.com',
          username: 'concurrent-user',
          name: '并发用户',
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: null,
          teacherId: null,
          createdAt: new Date(),
        };
        (mockPrisma.user.findUnique as jest.Mock)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingUser);
        (mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });

        const response = await UsersPOST(new NextRequest('http://localhost:3000/api/users', {
          method: 'POST',
          headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
          body: JSON.stringify({
            email: 'concurrent@example.com',
            username: 'concurrent-user',
            password: 'password123',
            name: '并发用户',
            requestId: 'request_87654321',
          }),
        }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, duplicate: true, user: { id: 'concurrent-user' } });
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

      it('管理员不能降低自己的角色', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });

        const response = await UserPUT(
          new NextRequest('http://localhost:3000/api/users/admin123', {
            method: 'PUT',
            headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'STUDENT', name: '管理员' }),
          }),
          { params: Promise.resolve({ id: 'admin123' }) },
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: '不能降低自己的管理员角色' });
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      });

      it('不得移除最后一个可用管理员', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin-a', email: 'a@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ role: 'ADMIN', status: 'ACTIVE' });
        (mockPrisma.user.count as jest.Mock).mockResolvedValueOnce(1);

        const response = await UserPUT(
          new NextRequest('http://localhost:3000/api/users/admin-b', {
            method: 'PUT',
            headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'TEACHER', name: '管理员B' }),
          }),
          { params: Promise.resolve({ id: 'admin-b' }) },
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: '至少需要保留一个可用的管理员账号' });
      });

      it('管理员改变账号角色时应同时撤销旧令牌与刷新会话', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin-a', email: 'a@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({
          role: 'STUDENT', status: 'ACTIVE', email: 'student@example.com',
        });
        (mockPrisma.user.update as jest.Mock).mockResolvedValueOnce({
          id: 'student-1', email: 'student@example.com', username: 'student1', name: '学生', role: 'TEACHER', status: 'ACTIVE',
        });
        (mockPrisma.classEnrollment.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
        (mockPrisma.session.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 2 });
        (mockPrisma.userActivity.create as jest.Mock).mockResolvedValueOnce({});

        const response = await UserPUT(
          new NextRequest('http://localhost:3000/api/users/student-1', {
            method: 'PUT',
            headers: { authorization: 'Bearer admin-token', 'content-type': 'application/json' },
            body: JSON.stringify({ role: 'TEACHER', name: '学生' }),
          }),
          { params: Promise.resolve({ id: 'student-1' }) },
        );

        expect(response.status).toBe(200);
        expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({ role: 'TEACHER', authVersion: { increment: 1 } }),
        }));
        expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
      });
    });

    describe('DELETE /api/users/[id]', () => {
      it('重复删除应返回确认回执且不重复记录活动', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'student-1', role: 'STUDENT', status: 'DELETED' });

        const response = await UserDELETE(
          new NextRequest('http://localhost:3000/api/users/student-1', {
            method: 'DELETE',
            headers: { authorization: 'Bearer admin-token' },
          }),
          { params: Promise.resolve({ id: 'student-1' }) },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, duplicate: true });
        expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
      });

      it('教师仍负责有效班级时拒绝删除', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'teacher-1', role: 'TEACHER', status: 'ACTIVE' });
        (mockPrisma.classGroup.count as jest.Mock).mockResolvedValueOnce(2);

        const response = await UserDELETE(
          new NextRequest('http://localhost:3000/api/users/teacher-1', {
            method: 'DELETE',
            headers: { authorization: 'Bearer admin-token' },
          }),
          { params: Promise.resolve({ id: 'teacher-1' }) },
        );

        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: expect.stringContaining('2 个有效班级') });
        expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
      });

      it('软删除应同时撤销会话和有效班级成员身份', async () => {
        const mockPayload = createMockJWTPayload({ userId: 'admin123', email: 'admin@example.com', role: 'ADMIN' });
        setupAuthMock(mockVerifyToken, mockPayload);
        (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ id: 'student-2', role: 'STUDENT', status: 'ACTIVE' });
        (mockPrisma.user.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
        (mockPrisma.session.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
        (mockPrisma.classEnrollment.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
        (mockPrisma.userActivity.create as jest.Mock).mockResolvedValueOnce({});

        const response = await UserDELETE(
          new NextRequest('http://localhost:3000/api/users/student-2', {
            method: 'DELETE',
            headers: { authorization: 'Bearer admin-token' },
          }),
          { params: Promise.resolve({ id: 'student-2' }) },
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: true, duplicate: false });
        expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
          data: { status: 'DELETED', class: null, authVersion: { increment: 1 } },
        }));
        expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'student-2' } });
        expect(mockPrisma.classEnrollment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { userId: 'student-2', status: 'ACTIVE' },
          data: { status: 'REMOVED' },
        }));
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

      expect(response.status).toBe(500);
      expect(data.error).toBe('获取用户列表失败');
    });
  });
});
