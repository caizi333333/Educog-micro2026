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
        role: 'STUDENT'
      };
      mockJwt.verify.mockReturnValue(mockPayload as any);

      const result = await verifyToken('valid-token');

      expect(result).toEqual(mockPayload);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret');
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

    it('should throw error if email already exists', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser as any); // Email exists

      await expect(register(mockUserData)).rejects.toThrow('邮箱已被注册');
    });

    it('should throw error if username already exists', async () => {
      (mockPrisma.user.findUnique as jest.Mock)
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
      status: 'ACTIVE'
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
        .rejects.toThrow('用户不存在或账号已被禁用');
    });

    it('should throw error if password is incorrect', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('密码错误');
    });
  });

  describe('logout', () => {
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
  });

  describe('refreshTokens', () => {
    const mockSession = {
      id: 'session123',
      token: 'refresh-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      user: {
        id: 'user123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'STUDENT'
      }
    };

    it('should refresh tokens successfully', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user123' } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', mockSession as any);
      setupPrismaMock(mockPrisma, 'session', 'delete', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'create', {} as any);
      mockJwt.sign.mockReturnValue('new-token' as never);

      const result = await refreshTokens('refresh-token');

      expect(result.accessToken).toBe('new-token');
      expect(result.refreshToken).toBe('new-token');
      expect(mockPrisma.session.delete).toHaveBeenCalledWith({
        where: { id: 'session123' }
      });
    });

    it('should throw error if session not found', async () => {
      mockJwt.verify.mockReturnValue({ userId: 'user123' } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', null);

      await expect(refreshTokens('invalid-token'))
        .rejects.toThrow('刷新令牌失败');
    });

    it('should throw error if session expired', async () => {
      const expiredSession = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired
      };
      mockJwt.verify.mockReturnValue({ userId: 'user123' } as any);
      setupPrismaMock(mockPrisma, 'session', 'findUnique', expiredSession as any);

      await expect(refreshTokens('expired-token'))
        .rejects.toThrow('刷新令牌失败');
    });
  });

  describe('changePassword', () => {
    const mockUser = {
      id: 'user123',
      password: 'old-hashed-password'
    };

    it('should change password successfully', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password' as never);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'session', 'deleteMany', { count: 2 } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);

      await changePassword('user123', 'oldpassword', 'newpassword');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user123' },
        data: { password: 'new-hashed-password' }
      });
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user123' }
      });
    });

    it('should throw error if user not found', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', null);

      await expect(changePassword('nonexistent', 'old', 'new'))
        .rejects.toThrow('用户不存在');
    });

    it('should throw error if old password is incorrect', async () => {
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser as any);
      mockBcrypt.compare.mockResolvedValue(false as never);

      await expect(changePassword('user123', 'wrongpassword', 'newpassword'))
        .rejects.toThrow('原密码错误');
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
        data: { password: 'new-hashed-password' }
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
