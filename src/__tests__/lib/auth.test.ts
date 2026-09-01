import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import {
  register,
  login,
  logout,
  verifyToken,
  refreshTokens,
  changePassword,
  resetPassword,
  hashPassword,
  verifyPassword,
  generateTokens,
  prisma
} from '@/lib/auth';
import { getJwtSecret, getJwtRefreshSecret } from '@/lib/env';
import { createMockPrismaClient, setupPrismaMock, clearAllMocks } from '@/__tests__/utils/test-mocks';

// Mock dependencies
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('@/lib/env');

// Mock prisma
jest.mock('@/lib/prisma', () => {
  const prismaProxy = new Proxy({}, {
    get(_t, prop) {
      return (globalThis as any).__mockPrisma?.[prop as any];
    }
  });
  return { prisma: prismaProxy };
});

const mockPrisma = createMockPrismaClient();

const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockGetJwtSecret = getJwtSecret as jest.MockedFunction<typeof getJwtSecret>;
const mockGetJwtRefreshSecret = getJwtRefreshSecret as jest.MockedFunction<typeof getJwtRefreshSecret>;

describe('auth', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma as any);
    mockGetJwtSecret.mockReturnValue('test-jwt-secret');
    mockGetJwtRefreshSecret.mockReturnValue('test-refresh-secret');
  });

  describe('verifyToken', () => {
    it('should verify valid token successfully', async () => {
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'STUDENT',
        sid: 'session123',
      };
      mockJwt.verify.mockReturnValue(mockPayload as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', {
        userId: mockPayload.userId,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          email: mockPayload.email,
          role: mockPayload.role,
          status: 'ACTIVE',
          authVersion: 0,
        },
      } as any);

      const result = await verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
    });

    it('should reject a signed token after the account auth version changes', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user123', email: 'test@example.com', role: 'STUDENT', sid: 'session123', authVersion: 1,
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 60_000),
        user: { email: 'test@example.com', role: 'STUDENT', status: 'ACTIVE', authVersion: 2 },
      } as any);

      await expect(verifyToken('old-signed-token')).resolves.toBeNull();
    });

    it('should reject a signed token when the current role or account status no longer matches', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user123', email: 'test@example.com', role: 'TEACHER', sid: 'session123', authVersion: 0,
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 60_000),
        user: { email: 'test@example.com', role: 'STUDENT', status: 'INACTIVE', authVersion: 0 },
      } as any);

      await expect(verifyToken('stale-role-token')).resolves.toBeNull();
    });

    it('should surface a database outage instead of misclassifying it as an invalid token', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user123', email: 'test@example.com', role: 'STUDENT', sid: 'session123', authVersion: 0,
      } as any);
      mockPrisma.session.findUnique.mockRejectedValueOnce(new Error('database offline'));

      await expect(verifyToken('valid-signed-token')).rejects.toThrow('database offline');
    });

    it('should return null for empty token', async () => {
      const result = await verifyToken('');
      expect(result).toBeNull();
    });

    it('should return null for whitespace token', async () => {
      const result = await verifyToken('   ');
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      const result = await verifyToken('expired-token');
      expect(result).toBeNull();
    });

    it('should return null for invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const result = await verifyToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return null for token with missing required fields', async () => {
      const mockPayload = {
        userId: 'user123',
        // missing email
        role: 'STUDENT'
      };
      mockJwt.verify.mockReturnValue(mockPayload as any);

      const result = await verifyToken('incomplete-token');
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    const mockUserData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      name: 'Test User',
      role: 'STUDENT' as const
    };

    const mockUser = {
      id: 'user123',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      role: 'STUDENT',
      password: 'hashed-password',
      studentId: null,
      teacherId: null,
      class: null,
      grade: null,
      major: null,
      department: null,
      title: null
    };

    it('should register user successfully', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', null); // No existing user
      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'create', mockUser as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userAchievement', 'create', {
        id: 'achievement123',
        achievementId: 'first_login',
        name: '初次登录'
      } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('mock-token' as never);

      const result = await register(mockUserData);

      expect(result.user.id).toBe('user123');
      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.firstLoginAchievement).toBeDefined();
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should force public registration to student role', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', null);
      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'create', mockUser as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userAchievement', 'create', {
        id: 'achievement123',
        achievementId: 'first_login',
        name: '初次登录'
      } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('mock-token' as never);

      await register({
        ...mockUserData,
        role: 'TEACHER',
        teacherId: 'T001',
        department: '自动化学院',
        title: '讲师',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          role: 'STUDENT',
          teacherId: null,
          department: null,
          title: null,
        }),
      });
    });

    it('should join class by valid invite code during registration', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'classGroup', 'findUnique', {
        id: 'class-1',
        name: '机电2401',
        inviteCode: 'EDU2401',
        status: 'ACTIVE',
      } as any);
      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'create', mockUser as any);
      setupPrismaMock(mockPrisma, 'classEnrollment', 'create', {
        id: 'enrollment-1',
        classId: 'class-1',
        role: 'STUDENT',
        status: 'ACTIVE',
        joinedAt: new Date(),
        classGroup: { id: 'class-1', name: '机电2401' },
      } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userAchievement', 'create', {
        id: 'achievement123',
        achievementId: 'first_login',
        name: '初次登录'
      } as any);
      setupPrismaMock(mockPrisma, 'learningEvent', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('mock-token' as never);

      const result = await register({ ...mockUserData, classInviteCode: 'EDU2401' });

      expect(result.classEnrollment?.classId).toBe('class-1');
      expect(mockPrisma.classEnrollment.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user123',
          classId: 'class-1',
          role: 'STUDENT',
        }),
      }));
    });

    it('should reject invalid class invite code during registration', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'classGroup', 'findUnique', null);
      mockBcrypt.hash.mockResolvedValue('hashed-password' as never);

      await expect(register({ ...mockUserData, classInviteCode: 'BADCODE' }))
        .rejects.toThrow('班级邀请码无效或已停用');
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      (mockPrisma.user.findUnique as unknown as jest.Mock).mockResolvedValueOnce(mockUser as any); // Email exists

      await expect(register(mockUserData)).rejects.toThrow('邮箱已被注册');
    });

    it('should throw error if username already exists', async () => {
      (mockPrisma.user.findUnique as unknown as jest.Mock)
        .mockResolvedValueOnce(null) // Email doesn't exist
        .mockResolvedValueOnce(mockUser as any); // Username exists

      await expect(register(mockUserData)).rejects.toThrow('用户名已被使用');
    });
  });

  describe('login', () => {
    const mockUser = {
      id: 'user123',
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      role: 'STUDENT',
      password: 'hashed-password',
      avatar: null,
      studentId: null,
      teacherId: null,
      status: 'ACTIVE',
      authVersion: 0
    };

    it('should login user successfully', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      setupPrismaMock(mockPrisma, 'userActivity', 'count', 0); // First login
      setupPrismaMock(mockPrisma, 'user', 'update', mockUser as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userAchievement', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'userAchievement', 'create', {
        id: 'achievement123',
        achievementId: 'first_login'
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('mock-token' as never);

      const result = await login('test@example.com', 'password123');

      expect(result.user.id).toBe('user123');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: 'test@example.com' },
            { username: 'test@example.com' }
          ],
          status: 'ACTIVE'
        },
        select: {
          id: true,
          email: true,
          username: true,
          password: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          studentId: true,
          teacherId: true,
          authVersion: true
        }
      });
      expect(result.accessToken).toBe('mock-token');
      expect(result.firstLoginAchievement).toBeDefined();
    });

    it('should login user without first login achievement if not first time', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      setupPrismaMock(mockPrisma, 'userActivity', 'count', 5); // Not first login
      setupPrismaMock(mockPrisma, 'user', 'update', mockUser as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('mock-token' as never);

      const result = await login('test@example.com', 'password123');

      expect(result.user.id).toBe('user123');
      expect(result.firstLoginAchievement).toBeNull();
    });

    it('should throw error if user not found', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', null);

      await expect(login('nonexistent@example.com', 'password123'))
        .rejects.toThrow('账号或密码不正确，或账号已停用');
    });

    it('should throw error if password is incorrect', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('账号或密码不正确，或账号已停用');
      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user123',
          action: 'LOGIN_FAILED',
        }),
      });
    });

    it('should enforce the shared database failure limit per account and source', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockUser as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'findFirst', null);
      (mockPrisma.userActivity.count as unknown as jest.Mock)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(8);

      await expect(login('test@example.com', 'password123', '203.0.113.5'))
        .rejects.toThrow('登录尝试过于频繁，请稍后再试');
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should reject a role mismatch before writing login activity or a session', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);

      await expect(login('test@example.com', 'password123', undefined, undefined, 'TEACHER'))
        .rejects.toThrow('当前账号与所选登录角色不一致，请切换正确的角色或账号');

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should revoke the session referenced by the access token', async () => {
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await logout('user123', undefined, 'session123');

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session123', userId: 'user123' },
      });
    });

    it('should logout user successfully with refresh token', async () => {
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await logout('user123', 'refresh-token');

      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          token: 'refresh-token'
        }
      });
      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          action: 'LOGOUT'
        }
      });
    });

    it('should logout user successfully without refresh token', async () => {
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await logout('user123');

      expect(mockPrisma.session.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.userActivity.create).toHaveBeenCalled();
    });

    it('should revoke the refresh session when the access token is no longer valid', async () => {
      setupPrismaMock(mockPrisma, 'session', 'findUnique', {
        id: 'session123',
        userId: 'user123',
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await logout(undefined, 'refresh-token');

      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { token: 'refresh-token' },
        select: { id: true, userId: true },
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session123', token: 'refresh-token' },
      });
      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: { userId: 'user123', action: 'LOGOUT' },
      });
    });

    it('should not write an activity for an unknown refresh token', async () => {
      setupPrismaMock(mockPrisma, 'session', 'findUnique', null);

      await logout(undefined, 'unknown-refresh-token');

      expect(mockPrisma.session.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.userActivity.create).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    const mockSession = {
      id: 'session123',
      token: 'refresh-token',
      userId: 'user123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      user: {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'STUDENT',
        status: 'ACTIVE',
        authVersion: 0
      }
    };

    it('should refresh tokens successfully', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user123', type: 'refresh', sid: 'session123', authVersion: 0,
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', mockSession as any);
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('new-token' as never);

      const result = await refreshTokens('refresh-token');

      expect(result.accessToken).toBe('new-token');
      expect(result.refreshToken).toBe('new-token');
      expect(mockPrisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'session123' },
        select: {
          id: true,
          token: true,
          userId: true,
          expiresAt: true,
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              authVersion: true,
            }
          }
        }
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session123', token: 'refresh-token' },
      });
    });

    it('should throw error if session not found', async () => {
      mockJwt.verify.mockReturnValue({
        userId: 'user123', type: 'refresh', sid: 'session123', authVersion: 0,
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', null);

      await expect(refreshTokens('invalid-token'))
        .rejects.toThrow('刷新令牌失败');
    });

    it('should throw error if session expired', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
      };
      mockJwt.verify.mockReturnValue({
        userId: 'user123', type: 'refresh', sid: 'session123', authVersion: 0,
      } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', expiredSession as any);

      await expect(refreshTokens('expired-token'))
        .rejects.toThrow('刷新令牌失败');
    });
  });

  describe('changePassword', () => {
    const mockUser = {
      id: 'user123',
      password: 'old-hashed-password',
      status: 'ACTIVE',
    };

    it('should change password successfully', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'updateMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 2 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await changePassword('user123', 'oldpassword', 'newpassword');

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user123', password: 'old-hashed-password', status: 'ACTIVE' },
        data: { password: 'new-hashed-password', authVersion: { increment: 1 } }
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user123' }
      });
    });

    it('should throw error if user not found', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', null);

      await expect(changePassword('nonexistent', 'oldpassword', 'newpassword'))
        .rejects.toThrow('用户不存在');
    });

    it('should throw error if old password is incorrect', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(changePassword('user123', 'wrongpassword', 'newpassword'))
        .rejects.toThrow('原密码错误');
    });

    it('should allow only one concurrent request to replace the same password hash', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'updateMany', { count: 0 } as any);

      await expect(changePassword('user123', 'oldpassword', 'newpassword'))
        .rejects.toThrow('密码已发生变化，请重新登录后再试');
      expect(mockPrisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      mockBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 1 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await resetPassword('user123', 'newpassword', 'admin123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: { password: 'new-hashed-password', authVersion: { increment: 1 } }
      });
      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin123',
          action: 'RESET_PASSWORD',
          details: JSON.stringify({ targetUserId: 'user123' })
        }
      });
    });
  });

  describe('utility functions', () => {
    describe('hashPassword', () => {
      it('should hash password successfully', async () => {
        mockBcrypt.hash.mockResolvedValue('hashed-password' as never);

        const result = await hashPassword('password123');

        expect(result).toBe('hashed-password');
        expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);
      });
    });

    describe('verifyPassword', () => {
      it('should verify password successfully', async () => {
        mockBcrypt.compare.mockResolvedValue(true as never);

        const result = await verifyPassword('password123', 'hashed-password');

        expect(result).toBe(true);
        expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', 'hashed-password');
      });

      it('should return false for incorrect password', async () => {
        mockBcrypt.compare.mockResolvedValue(false as never);

        const result = await verifyPassword('wrongpassword', 'hashed-password');

        expect(result).toBe(false);
      });

      it('should return false on error', async () => {
        (mockBcrypt.compare as jest.Mock).mockRejectedValue(new Error('Comparison failed'));

        const result = await verifyPassword('password123', 'hashed-password');

        expect(result).toBe(false);
      });
    });

    describe('generateTokens', () => {
      it('should generate tokens successfully', () => {
        const mockUser = {
          id: 'user123',
          email: 'test@example.com',
          role: 'STUDENT'
        } as any;
        mockJwt.sign.mockReturnValue('mock-token' as never);

        const result = generateTokens(mockUser);

        expect(result.accessToken).toBe('mock-token');
        expect(result.refreshToken).toBe('mock-token');
        expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      });
    });
  });
});
