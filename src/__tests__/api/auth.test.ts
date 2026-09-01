import { NextRequest } from 'next/server';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { GET as meHandler } from '@/app/api/auth/me/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { POST as validateHandler } from '@/app/api/auth/validate/route';
import { PUT as passwordHandler } from '@/app/api/auth/password/route';
import { createMockJWTPayload, setupAuthMock, setupPrismaMock, clearAllMocks, createMockPrismaClient, createMockNextRequest } from '@/__tests__/utils/test-mocks';
import { getLoginCookieOptions, getLogoutCookieOptions } from '@/lib/auth-storage';

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
  changePassword: jest.fn(),
}));

// import { prisma } from '@/lib/prisma'; // Unused - using mock
import { hashPassword, verifyPassword, generateTokens, verifyToken, logout, login, register, changePassword } from '@/lib/auth';

const mockPrisma = createMockPrismaClient();
const mockHashPassword = hashPassword as jest.MockedFunction<typeof hashPassword>;
const mockVerifyPassword = verifyPassword as jest.MockedFunction<typeof verifyPassword>;
const mockGenerateTokens = generateTokens as jest.MockedFunction<typeof generateTokens>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;
const mockLogin = login as jest.MockedFunction<typeof login>;
const mockRegister = register as jest.MockedFunction<typeof register>;
const mockChangePassword = changePassword as jest.MockedFunction<typeof changePassword>;

describe('Auth API Routes', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma as any);
  });

  describe('PUT /api/auth/password', () => {
    it('应该修改密码并禁止缓存响应', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
      mockChangePassword.mockResolvedValue(undefined);
      const request = new NextRequest('http://localhost:3000/api/auth/password', {
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword: 'old-pass', newPassword: 'new-pass' }),
      });

      const response = await passwordHandler(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
      expect(mockChangePassword).toHaveBeenCalledWith('user-1', 'old-pass', 'new-pass');
    });

    it('应该拒绝相同密码和超过 bcrypt 安全字节上限的密码', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
      const sameResponse = await passwordHandler(new NextRequest('http://localhost:3000/api/auth/password', {
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword: 'same-password', newPassword: 'same-password' }),
      }));
      const longResponse = await passwordHandler(new NextRequest('http://localhost:3000/api/auth/password', {
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword: 'old-password', newPassword: '密'.repeat(25) }),
      }));

      expect(sameResponse.status).toBe(400);
      expect(longResponse.status).toBe(400);
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it('应该把并发修改冲突返回为可理解的400错误', async () => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
      mockChangePassword.mockRejectedValue(new Error('密码已发生变化，请重新登录后再试'));
      const response = await passwordHandler(new NextRequest('http://localhost:3000/api/auth/password', {
        method: 'PUT',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ oldPassword: 'old-password', newPassword: 'new-password' }),
      }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: '密码已发生变化，请重新登录后再试' });
    });
  });

  describe('POST /api/auth/login', () => {
    it('应该仅在选择保持登录时设置持久 Cookie 时长', () => {
      expect(getLoginCookieOptions(true, 3600)).toMatchObject({
        httpOnly: true,
        maxAge: 3600,
        path: '/',
        sameSite: 'lax',
      });
      expect(getLoginCookieOptions(false, 3600)).toEqual(expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      }));
      expect(getLoginCookieOptions(false, 3600)).not.toHaveProperty('maxAge');
      expect(getLogoutCookieOptions()).toMatchObject({
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
      });
    });

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
          progress: 100,
          source: 'SYSTEM',
          points: 10,
          awardedBy: null
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
      expect(data.accessToken).toBeUndefined();
    });

    it('应该拒绝无效的登录凭据', async () => {
      mockLogin.mockRejectedValue(new Error('账号或密码不正确，或账号已停用'));

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
      expect(data.error).toBe('账号或密码不正确，或账号已停用');
    });

    it('应该把共享限流结果返回为可重试的429', async () => {
      mockLogin.mockRejectedValue(new Error('登录尝试过于频繁，请稍后再试'));
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ emailOrUsername: 'test@example.com', password: 'password123' }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('900');
      await expect(response.json()).resolves.toEqual({ error: '登录尝试过于频繁，请稍后再试' });
    });

    it('应该拒绝被禁用的用户', async () => {
      mockLogin.mockRejectedValue(new Error('账号或密码不正确，或账号已停用'));

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
      expect(data.error).toBe('账号或密码不正确，或账号已停用');
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

    it('应该在创建登录会话前拒绝角色不匹配', async () => {
      mockLogin.mockRejectedValue(new Error('当前账号与所选登录角色不一致，请切换正确的角色或账号'));
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': 'role-mismatch-test' },
        body: JSON.stringify({
          emailOrUsername: 'student@example.com',
          password: 'password123',
          expectedRole: 'TEACHER',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('当前账号与所选登录角色不一致，请切换正确的角色或账号');
      expect(mockLogin).toHaveBeenCalledWith(
        'student@example.com',
        'password123',
        'role-mismatch-test',
        undefined,
        'TEACHER',
      );
    });

    it('应该拒绝未知登录角色', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': 'invalid-role-test' },
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123',
          expectedRole: 'SUPERUSER',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('登录角色参数无效');
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('应该拒绝非布尔类型的记住设备参数', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': 'invalid-remember-device-test' },
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123',
          rememberDevice: 'yes',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('记住设备参数无效');
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it.each([
      ['空白角色', '   '],
      ['非字符串角色', 1],
      ['空值角色', null],
    ])('应该拒绝%s', async (_label, expectedRole) => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': `invalid-role-${String(expectedRole)}` },
        body: JSON.stringify({
          emailOrUsername: 'test@example.com',
          password: 'password123',
          expectedRole,
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('登录角色参数无效');
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('应该拒绝非对象请求体', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': 'invalid-body-test' },
        body: JSON.stringify([]),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请求格式错误');
      expect(mockLogin).not.toHaveBeenCalled();
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
      expect(data.accessToken).toBeUndefined();
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

    it('应该拒绝超过 bcrypt 处理上限的密码', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          username: 'newuser',
          password: '密'.repeat(25),
        }),
      }) as unknown as NextRequest;

      const response = await registerHandler(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: '密码不能超过72字节' });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it.each([
      ['数组', []],
      ['空值', null],
      ['字符串', 'invalid'],
    ])('应该拒绝%s类型的请求体', async (_label, body) => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const response = await registerHandler(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: '请求格式错误' });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('应该把字段标准化后再交给注册服务', async () => {
      mockRegister.mockResolvedValue({
        user: { id: 'user-1', email: 'new@example.com', username: 'new-user', role: 'STUDENT' },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        firstLoginAchievement: null,
        classEnrollment: null,
      } as any);
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: '  new@example.com  ',
          username: '  new-user  ',
          password: 'password123',
          displayName: '  新用户  ',
          classInviteCode: '  EDU2401  ',
        }),
      });

      const response = await registerHandler(request);

      expect(response.status).toBe(201);
      expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({
        email: 'new@example.com',
        username: 'new-user',
        name: '新用户',
        classInviteCode: 'EDU2401',
      }));
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
      expect(mockLogout).toHaveBeenCalledWith('user-1', undefined, undefined);
    });

    it('访问令牌失效时仍应使用刷新令牌撤销服务端会话', async () => {
      mockVerifyToken.mockResolvedValue(null);
      mockLogout.mockResolvedValue(undefined);
      const request = {
        headers: new Headers({ authorization: 'Bearer expired-token' }),
        cookies: {
          get: jest.fn((name: string) => name === 'refreshToken'
            ? { name, value: 'refresh-token' }
            : undefined),
        },
      } as unknown as NextRequest;

      const response = await logoutHandler(request);

      expect(response.status).toBe(200);
      expect(mockLogout).toHaveBeenCalledWith(undefined, 'refresh-token', undefined);
    });

    it('没有任何令牌时退出仍保持幂等且不写登出活动', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/logout', { method: 'POST' });

      const response = await logoutHandler(request);

      expect(response.status).toBe(200);
      expect(mockLogout).not.toHaveBeenCalled();
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
    it('数据库暂不可用时返回可重试状态且不暴露内部细节', async () => {
      mockLogin.mockRejectedValue({ code: 'P2022', message: 'missing private column detail' });

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: 'teacher',
          password: 'password123',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('30');
      expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
      expect(data).toEqual({
        error: '登录服务暂时不可用，请稍后重试',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
      expect(JSON.stringify(data)).not.toContain('private column');
    });

    it('Prisma 初始化失败时也返回可重试状态', async () => {
      const initializationError = new Error('cannot reach private database host');
      initializationError.name = 'PrismaClientInitializationError';
      mockLogin.mockRejectedValue(initializationError);

      const request = createMockNextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          emailOrUsername: 'teacher',
          password: 'password123',
        }),
      }) as unknown as NextRequest;

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data).toEqual({
        error: '登录服务暂时不可用，请稍后重试',
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
      expect(JSON.stringify(data)).not.toContain('private database host');
    });

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
      expect(data.error).toBe('服务器内部错误，请稍后重试');
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
