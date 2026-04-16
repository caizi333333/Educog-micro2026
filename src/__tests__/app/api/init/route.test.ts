import { GET } from '@/app/api/init/route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { setupPrismaMock } from '../../../utils/test-mocks';

// Mock the dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn()
    }
  }
}));

jest.mock('bcryptjs');
jest.mock('next/server');

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockNextResponse = {
  json: jest.fn()
};

(NextResponse.json as jest.Mock) = mockNextResponse.json;

describe('/api/init', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  describe('GET', () => {
    it('should return 401 when secret is missing', async () => {
      const request = new Request('http://localhost:3000/api/init');
      mockNextResponse.json.mockReturnValue({ status: 401 });

      await GET(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: '未授权' },
        { status: 401 }
      );
    });

    it('should return 401 when secret is incorrect', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=wrong-secret');
      mockNextResponse.json.mockReturnValue({ status: 401 });

      await GET(request);

      expect(mockNextResponse.json).toHaveBeenCalledWith(
        { error: '未授权' },
        { status: 401 }
      );
    });

    it('should return already initialized message when admin exists', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=init-educog-2024');
      
      const mockAdmin = {
        id: '1',
        email: 'admin@educog.com',
        role: 'ADMIN'
      };
      
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockAdmin as any);
      setupPrismaMock(mockPrisma, 'user', 'count', 5);
      mockNextResponse.json.mockReturnValue({ status: 200 });

      await GET(request);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { role: 'ADMIN' }
      });
      expect(mockPrisma.user.count).toHaveBeenCalled();
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        message: '数据库已初始化',
        users: 5
      });
    });

    it('should successfully initialize database with default users', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=init-educog-2024');
      
      setupPrismaMock(mockPrisma, 'user', 'findFirst', null);
      mockBcrypt.hash.mockImplementation(async (password: string) => `hashed_${password}`);
      setupPrismaMock(mockPrisma, 'user', 'create', {} as any);
      mockNextResponse.json.mockReturnValue({ status: 200 });

      await GET(request);

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { role: 'ADMIN' }
      });
      
      // Should hash passwords for all 3 users
      expect(mockBcrypt.hash).toHaveBeenCalledTimes(3);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('admin123456', 10);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('teacher123456', 10);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('student123456', 10);
      
      // Should create 3 users
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(3);
      
      // Check admin user creation
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'admin@educog.com',
          username: 'admin',
          password: 'hashed_admin123456',
          name: '系统管理员',
          role: 'ADMIN',
          status: 'ACTIVE'
        }
      });
      
      // Check teacher user creation
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'teacher@educog.com',
          username: 'teacher',
          password: 'hashed_teacher123456',
          name: '张老师',
          role: 'TEACHER',
          status: 'ACTIVE',
          teacherId: 'T001',
          department: '计算机科学系',
          title: '副教授'
        }
      });
      
      // Check student user creation
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'student@educog.com',
          username: 'student',
          password: 'hashed_student123456',
          name: '李同学',
          role: 'STUDENT',
          status: 'ACTIVE',
          studentId: 'S202301001',
          class: '计科2023-1班',
          grade: '2023级',
          major: '计算机科学与技术'
        }
      });
      
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        success: true,
        message: '初始化成功！',
        users: [
          { username: 'admin', password: 'admin123456', role: '管理员' },
          { username: 'teacher', password: 'teacher123456', role: '教师' },
          { username: 'student', password: 'student123456', role: '学生' }
        ]
      });
    });

    it('should handle database errors during initialization', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=init-educog-2024');
      
      const mockError = new Error('Database connection failed');
      setupPrismaMock(mockPrisma, 'user', 'findFirst', mockError);
      mockNextResponse.json.mockReturnValue({ status: 500 });

      await GET(request);

      expect(console.error).toHaveBeenCalledWith('初始化失败:', mockError);
      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          error: '初始化失败',
          details: 'Database connection failed'
        },
        { status: 500 }
      );
    });

    it('should handle user creation errors', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=init-educog-2024');
      
      setupPrismaMock(mockPrisma, 'user', 'findFirst', null);
      (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      
      const mockError = new Error('User creation failed');
      setupPrismaMock(mockPrisma, 'user', 'create', mockError);
      mockNextResponse.json.mockReturnValue({ status: 500 });

      await GET(request);

      expect(console.error).toHaveBeenCalledWith('初始化失败:', mockError);
      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          error: '初始化失败',
          details: 'User creation failed'
        },
        { status: 500 }
      );
    });

    it('should handle bcrypt hashing errors', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=init-educog-2024');
      
      setupPrismaMock(mockPrisma, 'user', 'findFirst', null);
      
      const mockError = new Error('Hashing failed');
      (mockBcrypt.hash as jest.Mock).mockRejectedValue(mockError);
      mockNextResponse.json.mockReturnValue({ status: 500 });

      await GET(request);

      expect(console.error).toHaveBeenCalledWith('初始化失败:', mockError);
      expect(mockNextResponse.json).toHaveBeenCalledWith(
        {
          error: '初始化失败',
          details: 'Hashing failed'
        },
        { status: 500 }
      );
    });

    it('should handle URL parsing correctly', async () => {
      const request = new Request('http://localhost:3000/api/init?secret=init-educog-2024&extra=param');
      
      setupPrismaMock(mockPrisma, 'user', 'findFirst', { id: '1', role: 'ADMIN' } as any);
      setupPrismaMock(mockPrisma, 'user', 'count', 1);
      mockNextResponse.json.mockReturnValue({ status: 200 });

      await GET(request);

      expect(mockPrisma.user.findFirst).toHaveBeenCalled();
      expect(mockNextResponse.json).toHaveBeenCalledWith({
        message: '数据库已初始化',
        users: 1
      });
    });
  });
});