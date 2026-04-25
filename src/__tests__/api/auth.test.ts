import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { POST as validateHandler } from '@/app/api/auth/validate/route';
import { createMockJWTPayload, setupAuthMock, setupPrismaMock, clearAllMocks, createMockPrismaClient, createMockNextRequest } from '@/__tests__/utils/test-mocks';

// Mock Prisma：使用全局 __mockPrisma（由 createMockPrismaClient 注入）
jest.mock('@/lib/prisma', () => {
  const prismaProxy = new Proxy({}, {
    get(_t, prop) {
      return (globalThis as any).__mockPrisma?.[prop as any];
    }
  });
  return { prisma: prismaProxy };
});

// Mock auth functions
jest.mock('@/lib/auth', () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateTokens: jest.fn(),
  verifyToken: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  login: jest.fn(),
  register: jest.fn(),
}));

// import { prisma } from '@/lib/prisma'; // Unused - using mock
import { hashPassword, verifyPassword, generateTokens, verifyToken, logout, login, register } from '@/lib/auth';

const mockPrisma = createMockPrismaClient();
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockGenerateTokens = generateTokens as jest.MockedFunction<typeof generateTokens>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;
const mockLogin = login as jest.MockedFunction<typeof login>;
const mockRegister = register as jest.MockedFunction<typeof register>;

describe('Auth API Routes', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma as any);
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录有效用户', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
        name: 'Test User',
        avatar: null,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: null,
        class: null,
        grade: null,
        major: null,
        teacherId: null,
        department: null,
        title: null,
        totalPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const mockLoginResult = {
        user: { 
          id: mockUser.id, 
          email: mockUser.email, 
          username: mockUser.username,
          name: mockUser.name,
          role: mockUser.role,
          avatar: mockUser.avatar,
          studentId: mockUser.studentId,
          teacherId: null
        },
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        classEnrollment: null,
        firstLoginAchievement: {
          id: 'test-achievement-id',
          name: 'First Login',
          userId: mockUser.id,
          achievementId: 'first-login',
          description: 'First login achievement',
          icon: null,
          category: 'milestone',
          unlockedAt: new Date(),
          progress: 100
        }
      };

      mockLogin.mockResolvedValue(mockLoginResult);
      setupPrismaMock(mockPrisma as any, 'user', 'findUnique', mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockGenerateTokens.mockReturnValue(mockTokens);

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      if (response.status !== 200) {
        console.log('Login test failed:', { status: response.status, data });
      }
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        name: mockUser.name,
        role: mockUser.role,
        avatar: mockUser.avatar,
        studentId: mockUser.studentId,
        teacherId: null
      });
      expect(data.accessToken).toBe(mockTokens.accessToken);
    });

    it('应该拒绝无效的登录凭据', async () => {
      mockLogin.mockRejectedValue(new Error('邮箱/用户名或密码错误'));

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: 'invalid@example.com',
          password: 'wrongpassword',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('邮箱/用户名或密码错误');
    });

    it('应该拒绝被禁用的用户', async () => {
      mockLogin.mockRejectedValue(new Error('账户已被禁用'));

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('账户已被禁用');
    });

    it('应该验证必填字段', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: '',
          password: '',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('邮箱/用户名和密码不能为空');
    });
  });

  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'hashed-password',
        name: 'New User',
        avatar: null,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: null,
        class: null,
        grade: null,
        major: null,
        teacherId: null,
        department: null,
        title: null,
        totalPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      const mockRegisterResult = {
        user: { 
          id: mockUser.id, 
          email: mockUser.email, 
          username: mockUser.username,
          name: mockUser.name,
          role: mockUser.role,
          avatar: mockUser.avatar,
          studentId: mockUser.studentId,
          teacherId: null
        },
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        classEnrollment: null,
        firstLoginAchievement: {
          id: 'test-achievement-id',
          name: 'First Login',
          userId: mockUser.id,
          achievementId: 'first-login',
          description: 'First login achievement',
          icon: null,
          category: 'milestone',
          unlockedAt: new Date(),
          progress: 100
        }
      };

      mockRegister.mockResolvedValue(mockRegisterResult);
      setupPrismaMock(mockPrisma as any, 'user', 'findUnique', null); // 用户不存在
      mockHashPassword.mockResolvedValue('hashed-password');
      setupPrismaMock(mockPrisma as any, 'user', 'create', mockUser);
      mockGenerateTokens.mockReturnValue(mockTokens);

      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123',
          displayName: 'New User',
        }),
      }) as unknown as NextRequest;

      const response = await registerHandler(request);
      const data = await response.json();

      if (response.status !== 201) {
        console.log('Register test failed:', { status: response.status, data });
      }
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(mockUser.email);
      expect(data.user.username).toBe(mockUser.username);
      expect(data.accessToken).toBe(mockTokens.accessToken);
    });

    it('应该拒绝重复的邮箱', async () => {
      mockRegister.mockRejectedValue(new Error('邮箱已被注册'));

      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'existing@example.com',
          username: 'newuser',
          password: 'password123',
          displayName: 'New User',
        }),
      }) as unknown as NextRequest;

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('邮箱已被注册');
    });

    it('应该验证邮箱格式', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          username: 'newuser',
          password: 'password123',
          displayName: 'New User',
        }),
      }) as unknown as NextRequest;

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('邮箱格式不正确');
    });

    it('应该验证密码长度', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          username: 'newuser',
          password: '123', // 太短
          displayName: 'New User',
        }),
      }) as unknown as NextRequest;

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('密码长度至少为6位');
    });
  });

  describe('GET /api/auth/me', () => {
    it('应该返回当前用户信息', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
        name: 'Test User',
        avatar: null,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: null,
        class: null,
        grade: null,
        major: null,
        teacherId: null,
        department: null,
        title: null,
        totalPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      };

      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma as any, 'user', 'findUnique', mockUser);

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await meHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.id).toBe(mockUser.id);
      expect(data.user.email).toBe(mockUser.email);
      expect(data.user.username).toBe(mockUser.username);
    });

    it('应该拒绝无效的令牌', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const response = await meHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('令牌无效');
    });

    it('应该要求授权头', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/me', {
        method: 'GET',
      }) as any;

      const response = await meHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('应该成功登出用户', async () => {
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      mockLogout.mockResolvedValue(undefined);
      setupPrismaMock(mockPrisma as any, 'user', 'update', {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
        name: 'Test User',
        avatar: null,
        role: 'STUDENT',
        status: 'ACTIVE',
        studentId: null,
        class: null,
        grade: null,
        major: null,
        teacherId: null,
        department: null,
        title: null,
        totalPoints: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
      });

      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await logoutHandler(request);
      const data = await response.json();

      if (response.status !== 200) {
        console.log('Logout test failed:', { status: response.status, data });
      }
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('登出成功');
    });
  });

  describe('POST /api/auth/validate', () => {
    it('应该验证有效的令牌', async () => {
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);

      const request = createMockNextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          token: 'valid-token',
        }),
      }) as unknown as NextRequest;

      const response = await validateHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.userId).toBe('user-1');
    });

    it('应该拒绝无效的令牌', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      const request = createMockNextRequest('http://localhost:3000/api/auth/validate', {
        method: 'POST',
        body: JSON.stringify({
          token: 'invalid-token',
        }),
      }) as unknown as NextRequest;

      const response = await validateHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库连接错误', async () => {
      mockLogin.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器内部错误');
    });

    it('应该处理JSON解析错误', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: 'invalid-json',
      }) as any;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请求格式错误');
    });
  });
});
