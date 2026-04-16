import { NextRequest } from 'next/server';
import { POST as submitQuiz } from '@/app/api/quiz/submit/route';
import { GET as getQuizHistory } from '@/app/api/quiz/history/route';
import { verifyToken } from '@/lib/auth';
import { 
  setupAuthMock,
  createMockNextRequest,
  setupPrismaMock
} from '../utils/test-mocks';
import { calculateQuizPoints } from '@/lib/points-system';
import { checkAchievementsForQuiz } from '@/lib/achievement-checker';

// Mock dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    quizAttempt: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    },
    userActivity: {
      create: jest.fn()
    },
    userPointsTransaction: {
      create: jest.fn()
    },
    user: {
      update: jest.fn()
    },
    learningProgress: {
      findUnique: jest.fn()
    }
  }
}));
jest.mock('@/lib/points-system');
jest.mock('@/lib/achievement-checker');

import { prisma } from '@/lib/prisma';

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCalculateQuizPoints = calculateQuizPoints as jest.MockedFunction<typeof calculateQuizPoints>;
const mockCheckAchievementsForQuiz = checkAchievementsForQuiz as jest.MockedFunction<typeof checkAchievementsForQuiz>;

describe('Quiz System API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    mockVerifyToken.mockResolvedValue({
      userId: 'test-user-id',
      email: 'test@example.com',
      role: 'student'
    });
    
    mockCalculateQuizPoints.mockReturnValue(65);
    mockCheckAchievementsForQuiz.mockResolvedValue([]);
  });

  describe('POST /api/quiz/submit', () => {
    const mockQuizData = {
      quizId: 'comprehensive-assessment',
      score: 85,
      totalQuestions: 20,
      correctAnswers: 17,
      timeSpent: 1200,
      answers: { '1': 'A', '2': 'B' },
      weakAreas: ['中断系统', '定时器'],
      scoresByKA: {
        '存储器结构': { correct: 3, total: 4, score: 75 },
        'CPU结构': { correct: 2, total: 2, score: 100 }
      },
      moduleId: 'module-1',
      chapterId: 'chapter-1'
    };

    it('应该成功提交测验结果', async () => {
      const mockQuizAttempt = {
        id: 'attempt-1',
        userId: 'test-user-id',
        quizId: 'comprehensive-assessment',
        score: 85,
        totalQuestions: 20,
        correctAnswers: 17,
        timeSpent: 1200,
        answers: JSON.stringify(mockQuizData.answers),
        startedAt: new Date(),
        completedAt: new Date()
      };

      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', mockQuizAttempt);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(mockQuizData)
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.attemptId).toBe('attempt-1');
      expect(data.message).toBe('测评结果已保存');
      expect(data.pointsEarned).toBe(65);

      // 验证数据库操作
      expect(mockPrisma.quizAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'test-user-id',
          quizId: 'comprehensive-assessment',
          score: 85,
          totalQuestions: 20,
          correctAnswers: 17,
          timeSpent: 1200
        })
      });

      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId: 'test-user-id',
          action: 'COMPLETE_QUIZ',
          details: JSON.stringify({
            quizId: 'comprehensive-assessment',
            score: 85,
            weakAreas: ['中断系统', '定时器'],
            scoresByKA: mockQuizData.scoresByKA
          })
        }
      });

      expect(mockCalculateQuizPoints).toHaveBeenCalledWith(85);
      expect(mockCheckAchievementsForQuiz).toHaveBeenCalledWith('test-user-id', 85, 'comprehensive-assessment');
    });

    it('应该处理满分测验并给予正确的积分类型', async () => {
      const perfectScoreData = { ...mockQuizData, score: 100, correctAnswers: 20 };
      mockCalculateQuizPoints.mockReturnValue(125); // 满分积分

      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'attempt-1' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(perfectScoreData)
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pointsEarned).toBe(125);

      expect(mockPrisma.userPointsTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PERFECT_SCORE',
          points: 125
        })
      });
    });

    it('应该处理及格分数并给予正确的积分类型', async () => {
      const passingScoreData = { ...mockQuizData, score: 70, correctAnswers: 14 };
      mockCalculateQuizPoints.mockReturnValue(65); // 及格积分

      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'attempt-1' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(passingScoreData)
      });

      const response = await submitQuiz(request);
      await response.json();

      expect(mockPrisma.userPointsTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'QUIZ_PASS',
          points: 65
        })
      });
    });

    it('应该处理不及格分数并给予基础积分', async () => {
      const failingScoreData = { ...mockQuizData, score: 45, correctAnswers: 9 };
      mockCalculateQuizPoints.mockReturnValue(25); // 基础积分

      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'attempt-1' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(failingScoreData)
      });

      const response = await submitQuiz(request);
      await response.json();

      expect(mockPrisma.userPointsTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'COMPLETE_QUIZ',
          points: 25
        })
      });
    });

    it('应该处理新成就奖励', async () => {
      const mockAchievements = [
        { id: 'first-quiz', title: '首次测验', points: 50 },
        { id: 'quiz-master', title: '测验大师', points: 100 }
      ];
      
      mockCheckAchievementsForQuiz.mockResolvedValue(mockAchievements as any);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'attempt-1' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(mockQuizData)
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(data.newAchievements).toEqual(mockAchievements);
      expect(data.totalPointsEarned).toBe(215); // 65 + 50 + 100
    });

    it('应该在未授权时返回401', async () => {
      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(mockQuizData)
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('应该在令牌无效时返回401', async () => {
      setupAuthMock(mockVerifyToken, null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer invalid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(mockQuizData)
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('应该在数据库错误时返回500', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer valid-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify(mockQuizData)
      });

      const response = await submitQuiz(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('保存测评结果失败');
      expect(data.details).toBe('Database error');
    });
  });

  describe('GET /api/quiz/history', () => {
    const mockQuizHistory = [
      {
        id: 'attempt-1',
        userId: 'test-user-id',
        quizId: 'comprehensive-assessment',
        score: 85,
        totalQuestions: 20,
        correctAnswers: 17,
        timeSpent: 1200,
        completedAt: new Date('2024-01-15T10:00:00Z')
      },
      {
        id: 'attempt-2',
        userId: 'test-user-id',
        quizId: 'comprehensive-assessment',
        score: 92,
        totalQuestions: 20,
        correctAnswers: 18,
        timeSpent: 1100,
        completedAt: new Date('2024-01-10T14:30:00Z')
      }
    ];

    it('应该成功获取测验历史', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', mockQuizHistory);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'count', 2);

      const request = new NextRequest('http://localhost:3000/api/quiz/history', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      const response = await getQuizHistory(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.history).toEqual(mockQuizHistory);
      expect(data.stats).toEqual({
        totalAttempts: 2,
        averageScore: 89, // (85 + 92) / 2 = 88.5, rounded to 89
        bestScore: 92,
        latestScore: 85,
        totalTimeSpent: 2300 // 1200 + 1100
      });

      expect(mockPrisma.quizAttempt.findMany).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        orderBy: { completedAt: 'desc' },
        take: 20
      });
    });

    it('应该处理空的测验历史', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', []);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'count', 0);

      const request = new NextRequest('http://localhost:3000/api/quiz/history', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      const response = await getQuizHistory(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.history).toEqual([]);
      expect(data.stats).toEqual({
        totalAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        latestScore: 0,
        totalTimeSpent: 0
      });
    });

    it('应该在未授权时返回401', async () => {
      const request = createMockNextRequest('http://localhost:3000/api/quiz/history', {
        method: 'GET'
      }) as any;

      const response = await getQuizHistory(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未授权');
    });

    it('应该在令牌无效时返回401', async () => {
      setupAuthMock(mockVerifyToken, null);

      const request = new NextRequest('http://localhost:3000/api/quiz/history', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer invalid-token'
        }
      });

      const response = await getQuizHistory(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('无效的令牌');
    });

    it('应该在数据库错误时返回500', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/quiz/history', {
        method: 'GET',
        headers: {
          'authorization': 'Bearer valid-token'
        }
      });

      const response = await getQuizHistory(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('获取测验历史失败');
      expect(data.details).toBe('Database connection failed');
    });
  });
});