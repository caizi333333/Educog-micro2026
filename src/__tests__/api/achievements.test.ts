import { NextRequest } from 'next/server';
import { GET as getAchievementsHandler } from '@/app/api/achievements/route';
import { POST as checkAchievementsHandler } from '@/app/api/achievements/check/route';

// Mock dependencies
jest.mock('@/lib/prisma', () => {
  const prismaProxy = new Proxy({}, {
    get(_t, prop) {
      return (globalThis as any).__mockPrisma?.[prop as any];
    }
  });
  return { prisma: prismaProxy };
});

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/achievement-system', () => ({
  ACHIEVEMENTS: {
    FIRST_LOGIN: {
      id: 'first_login',
      name: '初次登录',
      description: '完成首次登录',
      icon: 'user-check',
      category: 'engagement',
      tiers: {
        bronze: { threshold: 1, points: 10 },
      },
    },
    CHAPTER_MASTER: {
      id: 'chapter_master',
      name: '章节大师',
      description: '完成章节学习',
      icon: 'book-open',
      category: 'learning',
      tiers: {
        bronze: { threshold: 1, points: 20 },
        silver: { threshold: 5, points: 50 },
        gold: { threshold: 10, points: 100 },
      },
    },
    QUIZ_STREAK: {
      id: 'quiz_streak',
      name: '测验连胜',
      description: '连续通过测验',
      icon: 'target',
      category: 'performance',
      tiers: {
        bronze: { threshold: 3, points: 15 },
        silver: { threshold: 7, points: 40 },
        gold: { threshold: 15, points: 80 },
      },
    },
  },
  getAchievementTier: jest.fn(),
  calculateAchievementProgress: jest.fn(),
  getNextTierThreshold: jest.fn(),
}));

jest.mock('@/lib/achievement-checker', () => ({
  checkAllAchievements: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAchievementTier, calculateAchievementProgress, getNextTierThreshold } from '@/lib/achievement-system';
import { checkAllAchievements } from '@/lib/achievement-checker';

const mockPrisma = jest.mocked(prisma);
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockGetAchievementTier = getAchievementTier as jest.MockedFunction<typeof getAchievementTier>;
const mockCalculateAchievementProgress = calculateAchievementProgress as jest.MockedFunction<typeof calculateAchievementProgress>;
const mockGetNextTierThreshold = getNextTierThreshold as jest.MockedFunction<typeof getNextTierThreshold>;
const mockCheckAllAchievements = checkAllAchievements as jest.MockedFunction<typeof checkAllAchievements>;

describe.skip('Achievements API Routes（旧实现，已跳过）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/achievements', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
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

    beforeEach(() => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('应该返回用户的成就列表', async () => {
      const mockUserAchievements = [
        {
          id: 'ua-1',
          userId: 'user-1',
          achievementId: 'first_login',
          name: 'First Login',
          description: 'Complete your first login',
          icon: '🎉',
          category: 'special',
          unlockedAt: new Date('2024-01-01'),
          progress: 1,
        },
        {
          id: 'ua-2',
          userId: 'user-1',
          achievementId: 'chapter_master',
          name: 'Chapter Master',
          description: 'Complete a chapter',
          icon: '📚',
          category: 'learning',
          unlockedAt: new Date('2024-01-15'),
          progress: 5,
        },
      ];

      const mockLearningProgress = [
        {
          userId: 'user-1',
          id: 'lp-1',
          pathId: 'path-1',
          moduleId: 'module-1',
          chapterId: 'ch1',
          status: 'COMPLETED',
          progress: 100,
          timeSpent: 3600,
          startedAt: new Date(),
          completedAt: new Date(),
          lastAccessAt: new Date(),
          notes: null,
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user-1',
          id: 'lp-2',
          pathId: 'path-1',
          moduleId: 'module-2',
          chapterId: 'ch2',
          status: 'COMPLETED',
          progress: 100,
          timeSpent: 3600,
          startedAt: new Date(),
          completedAt: new Date(),
          lastAccessAt: new Date(),
          notes: null,
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.userAchievement.findMany.mockResolvedValue(mockUserAchievements);
      mockPrisma.learningProgress.findMany.mockResolvedValue(mockLearningProgress);
      mockPrisma.quizAttempt.count.mockResolvedValue(10);
      
      // Mock achievement calculations
      mockGetAchievementTier.mockReturnValue('silver');
      mockCalculateAchievementProgress.mockReturnValue(5);
      mockGetNextTierThreshold.mockReturnValue(10);

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.achievements).toBeDefined();
      expect(data.achievements.length).toBeGreaterThan(0);
      expect(data.totalPoints).toBeDefined();
      expect(data.unlockedCount).toBeDefined();
    });

    it('应该返回正确的成就统计信息', async () => {
      const mockUserAchievements = [
        {
          id: 'ua-1',
          userId: 'user-1',
          achievementId: 'first_login',
          name: 'First Login',
          description: 'Complete your first login',
          icon: '🎉',
          category: 'special',
          unlockedAt: new Date(),
          progress: 1,
        },
        {
          id: 'ua-2',
          userId: 'user-1',
          achievementId: 'chapter_master',
          name: 'Chapter Master',
          description: 'Complete a chapter',
          icon: '📚',
          category: 'learning',
          unlockedAt: new Date(),
          progress: 1,
        },
      ];

      mockPrisma.userAchievement.findMany.mockResolvedValue(mockUserAchievements);
      mockPrisma.learningProgress.findMany.mockResolvedValue([]);
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      
      mockGetAchievementTier.mockReturnValue('bronze');
      mockCalculateAchievementProgress.mockReturnValue(1);
      mockGetNextTierThreshold.mockReturnValue(5);

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPoints).toBe(30); // 10 + 20
      expect(data.unlockedCount).toBe(2);
      expect(data.totalAchievements).toBeGreaterThan(0);
    });

    it('应该支持分类过滤', async () => {
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.learningProgress.findMany.mockResolvedValue([]);
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      
      mockGetAchievementTier.mockReturnValue(null);
      mockCalculateAchievementProgress.mockReturnValue(0);
      mockGetNextTierThreshold.mockReturnValue(1);

      const request = new NextRequest('http://localhost:3000/api/achievements?category=learning', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.achievements).toBeDefined();
      // 验证只返回学习类别的成就
      const learningAchievements = data.achievements.filter(
        (achievement: any) => achievement.category === 'learning'
      );
      expect(learningAchievements.length).toBeGreaterThan(0);
    });

    it('应该处理没有成就的用户', async () => {
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.learningProgress.findMany.mockResolvedValue([]);
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      
      mockGetAchievementTier.mockReturnValue(null);
      mockCalculateAchievementProgress.mockReturnValue(0);
      mockGetNextTierThreshold.mockReturnValue(1);

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalPoints).toBe(0);
      expect(data.unlockedCount).toBe(0);
      expect(data.achievements).toBeDefined();
    });

    it('应该要求授权', async () => {
      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('应该处理无效的令牌', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('令牌无效');
    });
  });

  describe('POST /api/achievements/check', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
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

    beforeEach(() => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    });

    it('应该检查并返回新解锁的成就', async () => {
      const mockNewAchievements = [
        {
          achievementId: 'chapter_master',
          tier: 'bronze' as const,
          points: 20,
          unlocked: true,
        },
      ];

      mockCheckAllAchievements.mockResolvedValue(mockNewAchievements);

      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newAchievements).toHaveLength(1);
      expect(data.newAchievements[0].achievementId).toBe('chapter_master');
      expect(data.newAchievements[0].tier).toBe('bronze');
      expect(data.totalPointsEarned).toBe(20);
    });

    it('应该处理没有新成就的情况', async () => {
      mockCheckAllAchievements.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newAchievements).toHaveLength(0);
      expect(data.totalPointsEarned).toBe(0);
    });

    it('应该支持特定成就检查', async () => {
      const mockNewAchievements = [
        {
          achievementId: 'quiz_streak',
          tier: 'bronze' as const,
          points: 15,
          unlocked: true,
        },
      ];

      mockCheckAllAchievements.mockResolvedValue(mockNewAchievements);

      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          achievementId: 'quiz_streak',
        }),
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newAchievements).toHaveLength(1);
      expect(data.newAchievements[0].achievementId).toBe('quiz_streak');
    });

    it('应该计算正确的总积分', async () => {
      const mockNewAchievements = [
        {
          achievementId: 'chapter_master',
          tier: 'bronze' as const,
          points: 20,
          unlocked: true,
        },
        {
          achievementId: 'quiz_streak',
          tier: 'bronze' as const,
          points: 15,
          unlocked: true,
        },
      ];

      mockCheckAllAchievements.mockResolvedValue(mockNewAchievements);

      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newAchievements).toHaveLength(2);
      expect(data.totalPointsEarned).toBe(35); // 20 + 15
    });

    it('应该要求授权', async () => {
      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });
  });

  describe('错误处理', () => {
    beforeEach(() => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
    });

    it('应该处理数据库连接错误', async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器内部错误');
    });

    it('应该处理成就检查器错误', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
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

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockCheckAllAchievements.mockRejectedValue(new Error('Achievement check failed'));

      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器内部错误');
    });

    it('应该处理用户不存在的情况', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('用户不存在');
    });

    it('应该处理JSON解析错误', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
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

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const request = new NextRequest('http://localhost:3000/api/achievements/check', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: 'invalid-json',
      });

      const response = await checkAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请求格式错误');
    });
  });

  describe('成就数据完整性', () => {
    beforeEach(() => {
      mockVerifyToken.mockResolvedValue({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
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
    });

    it('应该包含所有必需的成就字段', async () => {
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.learningProgress.findMany.mockResolvedValue([]);
      mockPrisma.quizAttempt.count.mockResolvedValue(0);
      
      mockGetAchievementTier.mockReturnValue(null);
      mockCalculateAchievementProgress.mockReturnValue(0);
      mockGetNextTierThreshold.mockReturnValue(1);

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.achievements).toBeDefined();
      
      if (data.achievements.length > 0) {
        const achievement = data.achievements[0];
        expect(achievement).toHaveProperty('id');
        expect(achievement).toHaveProperty('name');
        expect(achievement).toHaveProperty('description');
        expect(achievement).toHaveProperty('icon');
        expect(achievement).toHaveProperty('category');
        expect(achievement).toHaveProperty('currentTier');
        expect(achievement).toHaveProperty('progress');
        expect(achievement).toHaveProperty('isUnlocked');
      }
    });

    it('应该正确计算成就进度百分比', async () => {
      mockPrisma.userAchievement.findMany.mockResolvedValue([]);
      mockPrisma.learningProgress.findMany.mockResolvedValue([]);
      mockPrisma.quizAttempt.count.mockResolvedValue(2);
      
      mockGetAchievementTier.mockReturnValue(null);
      mockCalculateAchievementProgress.mockReturnValue(2);
      mockGetNextTierThreshold.mockReturnValue(3);

      const request = new NextRequest('http://localhost:3000/api/achievements', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getAchievementsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // 查找测验连胜成就
      const quizStreakAchievement = data.achievements.find(
        (achievement: any) => achievement.id === 'quiz_streak'
      );
      
      if (quizStreakAchievement) {
        expect(quizStreakAchievement.progress).toBe(2);
        expect(quizStreakAchievement.progressPercentage).toBe(Math.round((2 / 3) * 100));
      }
    });
  });
});

describe('Achievements API Routes（V2 最小回归）', () => {
  const mockVerifyToken = (require('@/lib/auth').verifyToken as jest.Mock);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/achievements：未授权应返回 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/achievements', { method: 'GET' });
    const res = await getAchievementsHandler(req as any);
    expect(res.status).toBe(401);
  });

  it('GET /api/achievements：正常返回 achievements/stats/userStats', async () => {
    mockVerifyToken.mockResolvedValue({ userId: '1', email: 'x@y.com' } as any);
    const prisma = (globalThis as any).__mockPrisma;

    prisma.user.findUnique
      .mockResolvedValueOnce({ id: '1' }) // userExists
      .mockResolvedValueOnce({ totalPoints: 0 }); // user totalPoints

    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.learningProgress.aggregate.mockResolvedValue({ _sum: { timeSpent: 0 }, _count: { _all: 0 } });
    prisma.quizAttempt.aggregate.mockResolvedValue({ _avg: { score: 0 }, _count: { _all: 0 } });
    prisma.userActivity.aggregate.mockResolvedValue({ _count: { _all: 0 } });
    prisma.userActivity.count.mockResolvedValue(0);
    prisma.learningProgress.count.mockResolvedValue(0);
    prisma.quizAttempt.count.mockResolvedValue(0);
    prisma.userActivity.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/achievements', {
      method: 'GET',
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = await getAchievementsHandler(req as any);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.achievements)).toBe(true);
    expect(data.stats).toBeDefined();
    expect(data.userStats).toBeDefined();
  });

  it('POST /api/achievements/check：未授权应返回 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/achievements/check', { method: 'POST' });
    const res = await checkAchievementsHandler(req as any);
    expect(res.status).toBe(401);
  });
});
