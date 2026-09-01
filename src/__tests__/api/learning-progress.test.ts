import { NextRequest } from 'next/server';
import { POST as updateProgressHandler, GET as getProgressHandler } from '@/app/api/learning-progress/route';
import { POST as batchProgressHandler } from '@/app/api/learning-progress/batch/route';
import { createMockJWTPayload, setupAuthMock, setupPrismaMock, createMockNextRequest, clearAllMocks } from '@/__tests__/utils/test-mocks';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    learningProgress: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    classEnrollment: {
      findFirst: jest.fn(),
    },
    learningEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    userAchievement: {
      findMany: jest.fn(),
    },
    quizAttempt: {
      findFirst: jest.fn(),
    },
    learningPath: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userPointsTransaction: {
      createMany: jest.fn(),
      create: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
  checkDatabaseConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/points-system', () => ({
  POINTS_CONFIG: {
    timeSpent: { perMinute: 1, maxDaily: 60 },
    quiz: { perfect: 10, good: 7, fair: 5 },
    streak: { daily: 5, weekly: 20, monthly: 50 },
    COMPLETE_CHAPTER: 20,
  },
  calculateTimePoints: jest.fn(),
}));

jest.mock('@/lib/learning-completion', () => ({
  DEFAULT_COMPLETION_CONFIG: {
    minTimeSpent: 300,
    minQuizScore: 70,
    requiredActivities: ['reading', 'quiz'],
  },
  isChapterCompleted: jest.fn(),
  calculateCompletionPercentage: jest.fn(),
}));

jest.mock('@/lib/achievement-checker', () => ({
  checkAchievementsForLearning: jest.fn(),
}));

import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { calculateTimePoints } from '@/lib/points-system';
import { isChapterCompleted, calculateCompletionPercentage } from '@/lib/learning-completion';
import { checkAchievementsForLearning } from '@/lib/achievement-checker';

const mockPrisma = jest.mocked(prisma);
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockCalculateTimePoints = calculateTimePoints as jest.MockedFunction<typeof calculateTimePoints>;
const mockIsChapterCompleted = isChapterCompleted as jest.MockedFunction<typeof isChapterCompleted>;
const mockCalculateCompletionPercentage = calculateCompletionPercentage as jest.MockedFunction<typeof calculateCompletionPercentage>;
const mockCheckAchievementsForLearning = checkAchievementsForLearning as jest.MockedFunction<typeof checkAchievementsForLearning>;

describe('Learning Progress API Routes', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma as any);
  });

  describe('POST /api/learning-progress', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashed-password',
      name: 'Test User',
      role: 'STUDENT',
      avatar: null,
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
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser);
      
      // Mock all Prisma methods used in the route
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findFirst', null);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', null);
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', null);
      setupPrismaMock(mockPrisma, 'learningPath', 'create', {
        id: 'path-1',
        userId: 'user-1',
        name: '默认学习路径',
        description: '系统自动创建的默认学习路径',
        modules: JSON.stringify([{ moduleId: 'module-1', chapterId: 'ch1' }]),
        totalModules: 1,
        currentModule: 0,
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null
      });
      setupPrismaMock(mockPrisma, 'learningPath', 'update', {
        id: 'path-1',
        userId: 'user-1',
        name: '默认学习路径',
        description: '系统自动创建的默认学习路径',
        modules: JSON.stringify([{ moduleId: 'module-1', chapterId: 'ch1' }]),
        totalModules: 1,
        currentModule: 0,
        status: 'IN_PROGRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null
      });
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'createMany', { count: 0 });
      setupPrismaMock(mockPrisma, 'user', 'update', mockUser);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {
        id: 'activity-1',
        userId: 'user-1',
        action: 'UPDATE_PROGRESS',
        details: '{}',
        createdAt: new Date()
      });
    });

    it('首次无服务器回执时应限制可接受的时长和阅读进度', async () => {
      const mockProgress = {
        id: 'progress-1',
        userId: 'user-1',
        pathId: 'path-1',
        moduleId: 'module-1',
        chapterId: 'ch1',
        status: 'IN_PROGRESS',
        progress: 20,
        timeSpent: 60,
        startedAt: new Date(),
        completedAt: null,
        lastAccessAt: new Date(),
        notes: null,
        bookmarks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'learningProgress', 'create', mockProgress);
      mockCalculateTimePoints.mockReturnValue(10);
      mockIsChapterCompleted.mockReturnValue(false);
      mockCalculateCompletionPercentage.mockReturnValue(60);
      mockCheckAchievementsForLearning.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterId: 'ch1',
          progress: 100,
          timeSpent: 600,
          completedActivities: ['reading'],
          quizScores: [85],
        }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.progress.chapterId).toBe('ch1');
      expect(data.progress.timeSpent).toBe(60);
      expect(data.acceptedIncrement).toEqual({ timeSpent: 60, readingProgress: 20 });
      expect(data.completionPercentage).toBe(60);
      expect(mockPrisma.learningProgress.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timeSpent: 60 }),
      }));
      expect(mockPrisma.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: 'user-1', quizId: 'quiz-ch1' },
      }));
      expect(mockPrisma.learningEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: { startsWith: 'lp_' } }),
      }));
      expect(mockPrisma.learningEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ id: expect.stringMatching(/^lp_[a-f0-9]{28}$/) }),
      }));
    });

    it('事件回执缺失时应使用服务器最后访问时间限幅', async () => {
      const existingProgress = {
        id: 'progress-1',
        userId: 'user-1',
        pathId: 'path-1',
        moduleId: 'module-1',
        chapterId: 'ch1',
        status: 'IN_PROGRESS',
        progress: 40,
        timeSpent: 300,
        startedAt: new Date(),
        completedAt: null,
        lastAccessAt: new Date(),
        notes: null,
        bookmarks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProgress = {
        ...existingProgress,
        timeSpent: 300,
        progress: 80,
        lastAccessAt: new Date(),
        updatedAt: new Date(),
      };

      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', existingProgress);
      setupPrismaMock(mockPrisma, 'learningProgress', 'update', updatedProgress);
      mockCalculateTimePoints.mockReturnValue(10);
      mockIsChapterCompleted.mockReturnValue(false);
      mockCalculateCompletionPercentage.mockReturnValue(80);
      mockCheckAchievementsForLearning.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterId: 'ch1',
          timeSpent: 600, // 增量时间
          completedActivities: ['reading'],
          quizScores: [85],
        }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.progress.timeSpent).toBe(300);
      expect(data.completionPercentage).toBe(80);
      expect(mockPrisma.learningProgress.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timeSpent: { increment: 0 } }),
      }));
    });

    it('应该标记章节为已完成', async () => {
      const mockProgress = {
        id: 'progress-1',
        userId: 'user-1',
        pathId: 'path-1',
        moduleId: 'module-1',
        chapterId: 'ch1',
        status: 'COMPLETED',
        progress: 100,
        timeSpent: 1200,
        startedAt: new Date(),
        completedAt: new Date(),
        lastAccessAt: new Date(),
        notes: null,
        bookmarks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'learningProgress', 'create', mockProgress);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findFirst', { score: 90, completedAt: new Date() });
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {
        id: 'transaction-1',
        userId: 'user-1',
        points: 20,
        type: 'COMPLETE_CHAPTER',
        description: '完成章节 ch1',
        metadata: JSON.stringify({ moduleId: 'module-1', chapterId: 'ch1' }),
        createdAt: new Date(),
      });
      setupPrismaMock(mockPrisma, 'user', 'update', {
        id: 'user-1',
        totalPoints: 120,
      });
      mockCalculateTimePoints.mockReturnValue(20);
      mockIsChapterCompleted.mockReturnValue(true);
      mockCalculateCompletionPercentage.mockReturnValue(100);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterId: 'ch1',
          timeSpent: 1200,
          completedActivities: ['reading', 'quiz'],
          quizScores: [90],
        }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.progress.isCompleted).toBe(true);
      expect(data.completionPercentage).toBe(100);
      expect(data.newAchievements).toBeNull();
    });

    it('应该验证必填字段', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          // 缺少 chapterId
          timeSpent: 600,
        }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('章节ID是必需的');
    });

    it('应该验证时间格式', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterId: 'ch1',
          timeSpent: -100, // 负数时间
        }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('时间必须是非负数');
    });

    it('同一会话重复上报累计时长时不应重复计时', async () => {
      const now = new Date();
      const existingProgress = {
        id: 'progress-1', userId: 'user-1', pathId: null, moduleId: 'module-1', chapterId: 'ch1',
        status: 'IN_PROGRESS', progress: 40, timeSpent: 300, startedAt: now, completedAt: null,
        lastAccessAt: now, notes: null, bookmarks: null,
      };
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', existingProgress);
      setupPrismaMock(mockPrisma, 'learningProgress', 'update', existingProgress);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', {
        duration: 30,
        progress: 40,
        clientTime: new Date(now.getTime() - 30_000),
        createdAt: now,
      });
      mockCalculateCompletionPercentage.mockReturnValue(40);
      mockIsChapterCompleted.mockReturnValue(false);

      const response = await updateProgressHandler(new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ chapterId: 'ch1', timeSpent: 30, progress: 100 }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.acceptedIncrement).toEqual({ timeSpent: 0, readingProgress: 0 });
      expect(mockPrisma.learningProgress.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ timeSpent: { increment: 0 } }),
      }));
      expect(mockCalculateCompletionPercentage).toHaveBeenCalledWith(expect.objectContaining({
        readingProgress: 40,
        minimumTimeSpent: 300,
      }));
    });

    it('近期请求突然上报大额时长和进度时应按服务器经过时间限幅', async () => {
      const now = new Date();
      const existingProgress = {
        id: 'progress-2', userId: 'user-1', pathId: null, moduleId: 'module-1', chapterId: 'ch1',
        status: 'IN_PROGRESS', progress: 40, timeSpent: 300, startedAt: now, completedAt: null,
        lastAccessAt: now, notes: null, bookmarks: null,
      };
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', existingProgress);
      setupPrismaMock(mockPrisma, 'learningProgress', 'update', existingProgress);
      setupPrismaMock(mockPrisma, 'learningEvent', 'findFirst', {
        duration: 30,
        progress: 40,
        clientTime: new Date(now.getTime() - 30_000),
        createdAt: now,
      });
      mockCalculateCompletionPercentage.mockReturnValue(42);
      mockIsChapterCompleted.mockReturnValue(false);

      const response = await updateProgressHandler(new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ chapterId: 'ch1', timeSpent: 900, progress: 100 }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.acceptedIncrement.timeSpent).toBeLessThanOrEqual(31);
      expect(data.acceptedIncrement.readingProgress).toBeLessThanOrEqual(11);
      expect(mockPrisma.learningProgress.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          timeSpent: { increment: expect.any(Number) },
          progress: 42,
        }),
      }));
    });

    it('客户端练习计数只作提示，不应直接进入章节完成条件', async () => {
      const mockProgress = {
        id: 'progress-exercise', userId: 'user-1', pathId: null, moduleId: 'module-1', chapterId: 'ch1',
        status: 'IN_PROGRESS', progress: 60, timeSpent: 300, startedAt: new Date(), completedAt: null,
        lastAccessAt: new Date(), notes: null, bookmarks: null,
      };
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'learningProgress', 'create', mockProgress);
      mockCalculateCompletionPercentage.mockReturnValue(60);
      mockIsChapterCompleted.mockReturnValue(false);

      const response = await updateProgressHandler(new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({
          chapterId: 'ch1', timeSpent: 300, progress: 90,
          exercisesCompleted: 10, totalExercises: 10,
        }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.clientReportedExercises).toEqual({
        completed: 10,
        total: 10,
        authoritativeForCompletion: false,
      });
      const lastCompletionCall = mockCalculateCompletionPercentage.mock.calls[
        mockCalculateCompletionPercentage.mock.calls.length - 1
      ];
      const criteria = lastCompletionCall?.[0];
      expect(criteria).not.toHaveProperty('exercisesCompleted');
      expect(criteria).not.toHaveProperty('totalExercises');
    });

    it('应该拒绝已完成数大于练习总数的客户端计数', async () => {
      const response = await updateProgressHandler(new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ chapterId: 'ch1', exercisesCompleted: 4, totalExercises: 3 }),
      }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('已完成练习数不能超过练习总数');
      expect(mockPrisma.learningProgress.findUnique).not.toHaveBeenCalled();
    });

    it('应该拒绝关联其他用户的学习路径', async () => {
      setupPrismaMock(mockPrisma, 'learningPath', 'findFirst', null);
      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ pathId: 'foreign-path', chapterId: 'ch3', timeSpent: 60 }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('无权关联该学习路径');
      expect(mockPrisma.learningPath.findFirst).toHaveBeenCalledWith({
        where: { id: 'foreign-path', userId: 'user-1' },
        select: { id: true, modules: true },
      });
      expect(mockPrisma.learningProgress.create).not.toHaveBeenCalled();
    });

    it('应该拒绝章节与模块编号不匹配', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ moduleId: 'module-1', chapterId: 'ch4', timeSpent: 60 }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('章节与模块编号不匹配');
    });

    it('应该保持已完成章节状态且不重复奖励', async () => {
      const completedAt = new Date('2026-07-01T00:00:00Z');
      const existingProgress = {
        id: 'progress-completed',
        userId: 'user-1',
        pathId: null,
        moduleId: 'module-1',
        chapterId: 'ch1',
        status: 'COMPLETED',
        progress: 100,
        timeSpent: 1200,
        startedAt: new Date(),
        completedAt,
        lastAccessAt: new Date(),
        notes: null,
        bookmarks: null,
      };
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', existingProgress);
      setupPrismaMock(mockPrisma, 'learningProgress', 'update', { ...existingProgress, timeSpent: 1260 });
      mockIsChapterCompleted.mockReturnValue(false);
      mockCalculateCompletionPercentage.mockReturnValue(20);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ chapterId: 'ch1', timeSpent: 60 }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isCompleted).toBe(true);
      expect(data.pointsEarned).toBe(0);
      expect(mockPrisma.learningProgress.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', completedAt }),
      }));
      expect(mockPrisma.userPointsTransaction.create).not.toHaveBeenCalled();
    });

    it('应该在并发完成奖励重复时保持成功且不重复计分', async () => {
      const completedProgress = {
        id: 'progress-new', userId: 'user-1', pathId: null, moduleId: 'module-1', chapterId: 'ch1',
        status: 'COMPLETED', progress: 100, timeSpent: 1200, startedAt: new Date(), completedAt: new Date(),
        lastAccessAt: new Date(), notes: null, bookmarks: null,
      };
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      setupPrismaMock(mockPrisma, 'learningProgress', 'create', completedProgress);
      mockIsChapterCompleted.mockReturnValue(true);
      mockCalculateCompletionPercentage.mockReturnValue(100);
      (mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ chapterId: 'ch1', timeSpent: 1200 }),
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isCompleted).toBe(true);
      expect(data.pointsEarned).toBe(0);
    });

    it('应该要求授权', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        body: JSON.stringify({
          chapterId: 'ch1',
          timeSpent: 600,
        }) as any,
      });

      const response = await updateProgressHandler(request as unknown as Request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });
  });

  describe('GET /api/learning-progress', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      role: 'STUDENT',
      password: 'hashedpassword',
      name: null,
      avatar: null,
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
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser);
    });

    it('应该返回用户的学习进度', async () => {
      const mockProgressList = [
        {
          id: 'progress-1',
          userId: 'user-1',
          pathId: 'path-1',
          moduleId: 'module-1',
          chapterId: 'ch1',
          status: 'IN_PROGRESS',
          progress: 60,
          timeSpent: 600,
          startedAt: new Date(),
          completedAt: null,
          lastAccessAt: new Date(),
          notes: null,
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'progress-2',
          userId: 'user-1',
          pathId: 'path-1',
          moduleId: 'module-1',
          chapterId: 'ch2',
          status: 'COMPLETED',
          progress: 100,
          timeSpent: 1200,
          startedAt: new Date(),
          completedAt: new Date(),
          lastAccessAt: new Date(),
          notes: null,
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', mockProgressList);
      mockCalculateCompletionPercentage.mockReturnValueOnce(60).mockReturnValueOnce(100);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progress).toHaveLength(2);
      expect(data.progress[0].chapterId).toBe('ch1');
      expect(data.progress[1].chapterId).toBe('ch2');
      expect(data.progress[1].isCompleted).toBe(true);
    });

    it('应该支持章节过滤', async () => {
      const mockProgress = {
        id: 'progress-1',
        userId: 'user-1',
        pathId: 'path-1',
        moduleId: 'module-1',
        chapterId: 'ch1',
        status: 'IN_PROGRESS',
        progress: 60,
        timeSpent: 600,
        startedAt: new Date(),
        completedAt: null,
        lastAccessAt: new Date(),
        notes: null,
        bookmarks: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', [mockProgress]);
      mockCalculateCompletionPercentage.mockReturnValue(60);

      const request = new NextRequest('http://localhost:3000/api/learning-progress?chapterId=ch1', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progress).toHaveLength(1);
      expect(data.progress[0].chapterId).toBe('ch1');
      expect(mockPrisma.learningProgress.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          chapterId: 'ch1',
          lastAccessAt: { lte: expect.any(Date) },
        },
        orderBy: {
          lastAccessAt: 'desc',
        },
      });
    });

    it('应该拒绝无效的查询参数', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-progress?chapterId=ch99', {
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      });

      const response = await getProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('查询参数格式无效');
      expect(mockPrisma.learningProgress.findMany).not.toHaveBeenCalled();
    });

    it('应该返回空数组当没有进度时', async () => {
      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', []);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progress).toHaveLength(0);
    });
  });

  describe('POST /api/learning-progress/batch', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      username: 'testuser',
      role: 'STUDENT',
      password: 'hashedpassword',
      name: null,
      avatar: null,
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
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'user', 'findUnique', mockUser);
    });

    it('应该批量获取多个章节的学习进度', async () => {
      const mockProgressList = [
        {
          id: 'progress-1',
          userId: 'user-1',
          pathId: 'path-1',
          moduleId: 'module-1',
          chapterId: 'ch1',
          status: 'IN_PROGRESS',
          progress: 60,
          timeSpent: 600,
          startedAt: new Date(),
          completedAt: null,
          lastAccessAt: new Date(),
          notes: null,
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'progress-2',
          userId: 'user-1',
          pathId: 'path-1',
          moduleId: 'module-1',
          chapterId: 'ch2',
          status: 'COMPLETED',
          progress: 100,
          timeSpent: 1200,
          startedAt: new Date(),
          completedAt: new Date(),
          lastAccessAt: new Date(),
          notes: null,
          bookmarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', mockProgressList);
      mockCalculateCompletionPercentage.mockReturnValueOnce(60).mockReturnValueOnce(100);

      const request = new NextRequest('http://localhost:3000/api/learning-progress/batch', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterIds: ['ch1', 'ch2'],
        }),
      });

      const response = await batchProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.progress).toHaveLength(2);
      expect(data.progress.find((p: any) => p.chapterId === 'ch1')).toBeDefined();
      expect(data.progress.find((p: any) => p.chapterId === 'ch2')).toBeDefined();
    });

    it('应该验证章节ID数组', async () => {
      const request = new NextRequest('http://localhost:3000/api/learning-progress/batch', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterIds: [], // 空数组
        }),
      });

      const response = await batchProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('章节ID列表不能为空');
    });

    it('应该限制批量查询的数量', async () => {
      const tooManyChapterIds = Array.from({ length: 51 }, (_, i) => `ch${i + 1}`);

      const request = new NextRequest('http://localhost:3000/api/learning-progress/batch', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: JSON.stringify({
          chapterIds: tooManyChapterIds,
        }),
      });

      const response = await batchProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('一次最多查询50个章节');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findMany', new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-token',
        },
      });

      const response = await getProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器内部错误');
    });

    it('应该处理无效的JSON', async () => {
      const mockPayload = createMockJWTPayload({ userId: 'user-1', email: 'test@example.com', role: 'STUDENT' }); setupAuthMock(mockVerifyToken, mockPayload);

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-token',
        },
        body: 'invalid-json',
      });

      const response = await updateProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('请求格式错误');
    });

    it('应该处理令牌验证失败', async () => {
      mockVerifyToken.mockRejectedValue(new Error('Invalid token'));

      const request = new NextRequest('http://localhost:3000/api/learning-progress', {
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      const response = await getProgressHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('令牌无效');
    });
  });
});
