import { NextRequest } from 'next/server';
import { POST as submitQuiz } from '@/app/api/quiz/submit/route';
import { GET as getQuizHistory } from '@/app/api/quiz/history/route';
import { GET as getQuizQuestions } from '@/app/api/quiz/questions/route';
import { GET as getUserActivities } from '@/app/api/user/activities/route';
import { verifyToken } from '@/lib/auth';
import { 
  setupAuthMock,
  createMockNextRequest,
  setupPrismaMock
} from '../utils/test-mocks';
import { calculateQuizPoints } from '@/lib/points-system';
import { checkAchievementsForQuiz } from '@/lib/achievement-checker';
import { getComprehensiveQuestions, quizQuestions } from '@/lib/quiz-data';
import {
  ADDRESSING_TASK_PRESET,
  AI_LITERACY_QUESTION_IDS,
  getAddressingQuestionIds,
} from '@/lib/lesson-tasks';

// Mock dependencies
jest.mock('@/lib/auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn((fn) => fn(prisma)),
    quizAttempt: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    },
    userActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    userPointsTransaction: {
      create: jest.fn(),
      createMany: jest.fn()
    },
    user: {
      update: jest.fn()
    },
    learningProgress: {
      findUnique: jest.fn()
    },
    learningPath: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    classEnrollment: {
      findFirst: jest.fn()
    },
    learningEvent: {
      create: jest.fn()
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
  describe('GET /api/quiz/questions', () => {
    it('学生题目接口不得返回答案，且首测复测题目不重复', async () => {
      const initial = await getQuizQuestions(new Request('http://localhost/api/quiz/questions?topic=addressing-modes&mode=initial'));
      const retest = await getQuizQuestions(new Request('http://localhost/api/quiz/questions?topic=addressing-modes&mode=retest'));
      const initialData = (await initial.json()).data;
      const retestData = (await retest.json()).data;
      expect(initialData).toHaveLength(7);
      expect(retestData).toHaveLength(7);
      expect(initialData.every((question: Record<string, unknown>) => !('correctAnswer' in question))).toBe(true);
      expect(retestData.every((question: Record<string, unknown>) => !('correctAnswer' in question))).toBe(true);
      const retestIds = new Set(retestData.map((question: { id: number }) => question.id));
      expect(initialData.some((question: { id: number }) => retestIds.has(question.id))).toBe(false);
    });

    it('综合测评应返回固定章节抽样卷，而不是整套题库', async () => {
      const response = await getQuizQuestions(new Request('http://localhost/api/quiz/questions'));
      const data = (await response.json()).data;
      expect(data).toHaveLength(getComprehensiveQuestions().length);
      expect(data.length).toBeLessThan(quizQuestions.length);
      expect(data.every((question: Record<string, unknown>) => !('correctAnswer' in question))).toBe(true);
    });

    it('AI素养情境测评应只返回五个10.5子节点题且不泄露答案', async () => {
      const response = await getQuizQuestions(new Request('http://localhost/api/quiz/questions?topic=ai-literacy'));
      const data = (await response.json()).data;
      expect(response.status).toBe(200);
      expect(data.map((question: { id: number }) => question.id)).toEqual([...AI_LITERACY_QUESTION_IDS]);
      expect(data.every((question: Record<string, unknown>) => !('correctAnswer' in question))).toBe(true);
      expect(data.every((question: { ka: string }) => question.ka.startsWith('10.5.'))).toBe(true);
    });

    it.each([
      ['http://localhost/api/quiz/questions?topic=unknown', '测评主题不存在'],
      ['http://localhost/api/quiz/questions?mode=retest', '测评阶段必须与专项主题同时使用'],
      ['http://localhost/api/quiz/questions?chapter=11', '章节编号必须为 1-10'],
      ['http://localhost/api/quiz/questions?topic=addressing-modes&chapter=3', '专项测评与章节测评不能同时指定'],
    ])('无效题卷参数应明确拒绝：%s', async (url, expectedError) => {
      const response = await getQuizQuestions(new Request(url));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: expectedError });
    });
  });

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
    (mockPrisma.quizAttempt.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.quizAttempt.findUnique as jest.Mock).mockResolvedValue(null);
    (mockPrisma.learningPath.findFirst as jest.Mock).mockResolvedValue(null);
    (mockPrisma.userPointsTransaction.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  });

  describe('POST /api/quiz/submit', () => {
    const comprehensiveQuestions = getComprehensiveQuestions();
    const comprehensiveTotal = comprehensiveQuestions.length;
    const answersWithCorrectCount = (correctCount: number) => Object.fromEntries(
      comprehensiveQuestions.map((question, index) => [
        String(question.id),
        index < correctCount ? question.correctAnswer : '__incorrect__',
      ]),
    );
    const baseCorrect = Math.floor(comprehensiveTotal * 0.85);
    const baseScore = (baseCorrect / comprehensiveTotal) * 100;
    const mockQuizData = {
      quizId: 'comprehensive-assessment',
      score: 100,
      totalQuestions: 1,
      correctAnswers: 1,
      timeSpent: 1200,
      answers: answersWithCorrectCount(baseCorrect),
      weakAreas: ['客户端伪造薄弱点'],
      scoresByKA: { '客户端伪造知识点': { correct: 1, total: 1, score: 100 } },
    };

    it('损坏的 JSON 应返回参数错误而不是服务器错误', async () => {
      const response = await submitQuiz(new NextRequest('http://localhost/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: 'invalid json',
      }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: '测评提交参数格式无效' });
    });

    it('应该成功提交测验结果', async () => {
      const mockQuizAttempt = {
        id: 'attempt-1',
        userId: 'test-user-id',
        quizId: 'comprehensive-assessment',
        score: baseScore,
        totalQuestions: comprehensiveTotal,
        correctAnswers: baseCorrect,
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
          score: baseScore,
          totalQuestions: comprehensiveTotal,
          correctAnswers: baseCorrect,
          timeSpent: 1200
        })
      });

      const activityDetails = JSON.parse((mockPrisma.userActivity.create as jest.Mock).mock.calls[0][0].data.details);
      expect(activityDetails).toMatchObject({
        quizId: 'comprehensive-assessment',
        score: baseScore,
        topicId: null,
        assessmentMode: 'initial',
      });
      expect(activityDetails.weakAreas).not.toContain('客户端伪造薄弱点');

      expect(mockCalculateQuizPoints).toHaveBeenCalledWith(baseScore);
      expect(mockCheckAchievementsForQuiz).toHaveBeenCalledWith('test-user-id', baseScore, 'comprehensive-assessment');
    });

    it('寻址方式专项测评应由服务端按正式题库重新判分', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const addressingQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(addressingQuestions.map((question) => [String(question.id), question.correctAnswer]));
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'addressing-attempt' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch3-addressing',
          topicId: 'addressing-modes',
          assessmentMode: 'initial',
          moduleId: 'module-1',
          chapterId: 'ch3',
          score: 0,
          totalQuestions: 1,
          correctAnswers: 0,
          timeSpent: 120,
          answers,
          weakAreas: ['伪造薄弱点'],
          scoresByKA: {},
        }),
      });

      const response = await submitQuiz(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.quizId).toBe('quiz-ch3-addressing');
      expect(data.score).toBe(100);
      expect(data.weakAreas).toEqual([]);
      expect(mockPrisma.quizAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quizId: 'quiz-ch3-addressing',
          totalQuestions: addressingQuestions.length,
          correctAnswers: addressingQuestions.length,
          score: 100,
        }),
      });
    });

    it('AI素养情境测评应由服务端按五个10.5子节点判分并落盘', async () => {
      const ids = new Set<number>(AI_LITERACY_QUESTION_IDS);
      const questions = quizQuestions.filter((question) => ids.has(question.id));
      const answers = Object.fromEntries(questions.map((question) => [String(question.id), question.correctAnswer]));
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'ai-literacy-attempt' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch10-ai-literacy',
          topicId: 'ai-literacy',
          assessmentMode: 'initial',
          moduleId: 'module-5',
          chapterId: 'ch10',
          score: 0,
          totalQuestions: 1,
          correctAnswers: 0,
          timeSpent: 90,
          answers,
        }),
      }));

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        quizId: 'quiz-ch10-ai-literacy',
        score: 100,
        totalQuestions: 5,
        correctAnswers: 5,
        weakAreas: [],
      });
      expect(data.scoresByKA['10.5']).toMatchObject({ correct: 5, total: 5, score: 100 });
    });

    it('自主专项测评不得静默推进同试卷的教师任务', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const addressingQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(addressingQuestions.map((question) => [String(question.id), question.correctAnswer]));
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'standalone-addressing-attempt' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      (mockPrisma.learningPath.findFirst as jest.Mock).mockResolvedValue({
        id: 'active-addressing-task',
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 2,
      });
      (mockPrisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch3-addressing',
          topicId: 'addressing-modes',
          assessmentMode: 'initial',
          moduleId: 'module-1',
          chapterId: 'ch3',
          attemptId: 'attempt_standalone_addressing_001',
          score: 0,
          totalQuestions: addressingQuestions.length,
          correctAnswers: 0,
          timeSpent: 90,
          answers,
        }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.taskProgress).toBeNull();
      expect(mockPrisma.learningPath.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.learningPath.updateMany).not.toHaveBeenCalled();
      const activityDetails = JSON.parse((mockPrisma.userActivity.create as jest.Mock).mock.calls[0][0].data.details);
      expect(activityDetails).not.toHaveProperty('pathId');
    });

    it('从任务入口提交专项测评时应只推进指定任务', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const addressingQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(addressingQuestions.map((question) => [String(question.id), question.correctAnswer]));
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'task-addressing-attempt' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      (mockPrisma.learningPath.findFirst as jest.Mock).mockResolvedValue({
        id: 'path-addressing',
        modules: JSON.stringify(ADDRESSING_TASK_PRESET.steps),
        currentModule: 2,
      });
      (mockPrisma.learningPath.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch3-addressing',
          topicId: 'addressing-modes',
          assessmentMode: 'initial',
          moduleId: 'module-1',
          chapterId: 'ch3',
          pathId: 'path-addressing',
          attemptId: 'attempt_task_addressing_001',
          score: 0,
          totalQuestions: addressingQuestions.length,
          correctAnswers: 0,
          timeSpent: 90,
          answers,
        }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.taskProgress).toEqual({ pathId: 'path-addressing', currentModule: 3, status: 'ACTIVE' });
      expect(mockPrisma.learningPath.findFirst).toHaveBeenCalledWith({
        where: { id: 'path-addressing', userId: 'test-user-id', status: 'ACTIVE' },
        select: { id: true, modules: true, currentModule: true },
      });
      expect(mockPrisma.learningPath.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'path-addressing', currentModule: 2 }),
        data: expect.objectContaining({ currentModule: 3, status: 'ACTIVE' }),
      }));
    });

    it('同一 attemptId 重试应返回原结果且不重复写入', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const formQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(formQuestions.map((question) => [String(question.id), question.correctAnswer]));
      (mockPrisma.quizAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'existing-attempt',
        score: 100,
        totalQuestions: 7,
        correctAnswers: 7,
        answers: JSON.stringify({ weakAreas: [], scoresByKA: {}, questionResults: {} }),
      });
      const request = new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch3-addressing', topicId: 'addressing-modes', assessmentMode: 'initial',
          moduleId: 'module-1', chapterId: 'ch3', attemptId: 'attempt_retry_001',
          score: 0, totalQuestions: 7, correctAnswers: 0, timeSpent: 30, answers,
        }),
      });
      const response = await submitQuiz(request);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.duplicate).toBe(true);
      expect(data.attemptId).toBe('existing-attempt');
      expect(mockPrisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('同一 attemptId 不得静默接受不同答题内容', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const formQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(formQuestions.map((question) => [String(question.id), question.correctAnswer]));
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'fingerprinted-attempt' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const requestBody = {
        quizId: 'quiz-ch3-addressing', topicId: 'addressing-modes', assessmentMode: 'initial',
        moduleId: 'module-1', chapterId: 'ch3', attemptId: 'attempt_fingerprint_001',
        score: 0, totalQuestions: 7, correctAnswers: 0, timeSpent: 30, answers,
      };
      const firstResponse = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify(requestBody),
      }));
      expect(firstResponse.status).toBe(200);
      const storedPayload = (mockPrisma.quizAttempt.create as jest.Mock).mock.calls[0][0].data.answers as string;
      (mockPrisma.quizAttempt.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'fingerprinted-attempt', score: 100, totalQuestions: 7, correctAnswers: 7, answers: storedPayload,
      });
      const changedAnswers = { ...answers, [String(formQuestions[0]!.id)]: '__changed__' };

      const secondResponse = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({ ...requestBody, answers: changedAnswers }),
      }));
      expect(secondResponse.status).toBe(409);
      await expect(secondResponse.json()).resolves.toMatchObject({ error: expect.stringContaining('另一份答题内容') });
      expect(mockPrisma.quizAttempt.create).toHaveBeenCalledTimes(1);
    });

    it('带任务上下文的测评必须与当前步骤匹配', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const formQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(formQuestions.map((question) => [String(question.id), question.correctAnswer]));
      (mockPrisma.learningPath.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch3-addressing', topicId: 'addressing-modes', assessmentMode: 'initial',
          moduleId: 'module-1', chapterId: 'ch3', pathId: 'path-not-active', attemptId: 'attempt_task_context_001',
          score: 0, totalQuestions: 7, correctAnswers: 0, timeSpent: 30, answers,
        }),
      }));

      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.error).toContain('尚未进入该测评步骤');
      expect(mockPrisma.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('章节测评必须使用匹配的 chapterId 与 moduleId', async () => {
      const chapter4Question = quizQuestions.find((question) => question.chapter === 4)!;
      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch4', assessmentMode: 'initial', moduleId: 'module-1', chapterId: 'ch4',
          attemptId: 'attempt_chapter_004', score: 0, totalQuestions: 1, correctAnswers: 0,
          answers: { [String(chapter4Question.id)]: chapter4Question.correctAnswer },
        }),
      }));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: '章节测评的资源编号不匹配' });
    });

    it('成就检查失败不得把已保存测评返回为失败', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'attempt-saved' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'userPointsTransaction', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'user', 'update', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);
      mockCheckAchievementsForQuiz.mockRejectedValueOnce(new Error('achievement unavailable'));

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify(mockQuizData),
      }));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toMatchObject({ success: true, attemptId: 'attempt-saved', newAchievements: null });
    });

    it('并发提交触发唯一约束时应恢复同一回执', async () => {
      const addressingIds = new Set(getAddressingQuestionIds('initial'));
      const formQuestions = quizQuestions.filter((question) => addressingIds.has(question.id));
      const answers = Object.fromEntries(formQuestions.map((question) => [String(question.id), question.correctAnswer]));
      (mockPrisma.$transaction as jest.Mock).mockRejectedValueOnce({ code: 'P2002' });
      (mockPrisma.quizAttempt.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'qa-existing', score: 100, totalQuestions: 7, correctAnswers: 7,
        answers: JSON.stringify({ weakAreas: [], scoresByKA: {}, questionResults: {} }),
      });

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify({
          quizId: 'quiz-ch3-addressing', topicId: 'addressing-modes', assessmentMode: 'initial',
          moduleId: 'module-1', chapterId: 'ch3', attemptId: 'attempt_parallel_001',
          score: 0, totalQuestions: 7, correctAnswers: 0, answers,
        }),
      }));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data).toMatchObject({ success: true, duplicate: true, attemptId: 'qa-existing' });
    });

    it('应该处理满分测验并给予正确的积分类型', async () => {
      const perfectScoreData = {
        ...mockQuizData,
        score: 0,
        correctAnswers: 0,
        answers: answersWithCorrectCount(comprehensiveTotal),
      };
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

      expect(mockPrisma.userPointsTransaction.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({
          type: 'PERFECT_SCORE',
          points: 125
        })],
        skipDuplicates: true,
      });
    });

    it('应该处理及格分数并给予正确的积分类型', async () => {
      const passingScoreData = {
        ...mockQuizData,
        score: 0,
        correctAnswers: 0,
        answers: answersWithCorrectCount(Math.ceil(comprehensiveTotal * 0.7)),
      };
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
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.score).toBeGreaterThanOrEqual(60);
      expect(mockPrisma.userPointsTransaction.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({
          type: 'QUIZ_PASS',
          points: 65
        })],
        skipDuplicates: true,
      });
    });

    it('应该处理不及格分数并给予基础积分', async () => {
      const failingScoreData = {
        ...mockQuizData,
        score: 100,
        correctAnswers: comprehensiveTotal,
        answers: answersWithCorrectCount(Math.floor(comprehensiveTotal * 0.45)),
      };
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
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.score).toBeLessThan(60);
      expect(mockPrisma.userPointsTransaction.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({
          type: 'COMPLETE_QUIZ',
          points: 25
        })],
        skipDuplicates: true,
      });
    });

    it('同一测评同一天重复完成时不应重复奖励积分', async () => {
      (mockPrisma.userPointsTransaction.createMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
      setupPrismaMock(mockPrisma, 'quizAttempt', 'create', { id: 'attempt-daily-repeat' } as any);
      setupPrismaMock(mockPrisma, 'userActivity', 'create', {} as any);
      setupPrismaMock(mockPrisma, 'learningProgress', 'findUnique', null);

      const response = await submitQuiz(new NextRequest('http://localhost:3000/api/quiz/submit', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
        body: JSON.stringify(mockQuizData),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pointsEarned).toBe(0);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
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
      expect(data.details).toBeUndefined();
    });
  });

  describe('GET /api/user/activities', () => {
    it('按 quizId 获取正式测评活动时应在服务端过滤', async () => {
      (mockPrisma.userActivity.findMany as jest.Mock).mockResolvedValueOnce([]);
      const response = await getUserActivities(new NextRequest('http://localhost/api/user/activities?action=COMPLETE_QUIZ&quizId=quiz-ch3-addressing&limit=1', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      expect(response.status).toBe(200);
      expect(mockPrisma.userActivity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          userId: 'test-user-id',
          action: 'COMPLETE_QUIZ',
          details: { contains: '"quizId":"quiz-ch3-addressing"' },
        }),
        take: 1,
      }));
    });

    it('任务回执应按 pathId、quizId 和测评阶段精确读取记录', async () => {
      (mockPrisma.userActivity.findMany as jest.Mock).mockResolvedValueOnce([]);
      const response = await getUserActivities(new NextRequest('http://localhost/api/user/activities?action=COMPLETE_QUIZ&quizId=quiz-ch3-addressing&pathId=path_001&assessmentMode=initial&limit=1', {
        headers: { authorization: 'Bearer valid-token' },
      }));
      expect(response.status).toBe(200);
      expect(mockPrisma.userActivity.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          userId: 'test-user-id',
          action: 'COMPLETE_QUIZ',
          AND: [
            { details: { contains: '"quizId":"quiz-ch3-addressing"' } },
            { details: { contains: '"pathId":"path_001"' } },
            { details: { contains: '"assessmentMode":"initial"' } },
          ],
        }),
        take: 1,
      }));
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
      expect(data.history).toEqual(mockQuizHistory.map(({ userId: _userId, ...attempt }) => attempt));
      expect(data.stats).toEqual({
        totalAttempts: 2,
        averageScore: 89, // (85 + 92) / 2 = 88.5, rounded to 89
        bestScore: 92,
        latestScore: 85,
        totalTimeSpent: 2300 // 1200 + 1100
      });

      expect(mockPrisma.quizAttempt.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          completedAt: { lte: expect.any(Date) },
        },
        orderBy: { completedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          quizId: true,
          score: true,
          totalQuestions: true,
          correctAnswers: true,
          timeSpent: true,
          startedAt: true,
          completedAt: true,
        },
      });
    });

    it('历史接口不得返回答题正文、答案或用户内部编号', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findMany', [{
        ...mockQuizHistory[0],
        answers: JSON.stringify({ questionResults: { 1: { correctAnswer: 'secret' } } }),
      }]);
      setupPrismaMock(mockPrisma, 'quizAttempt', 'count', 1);

      const response = await getQuizHistory(new NextRequest('http://localhost:3000/api/quiz/history', {
        method: 'GET',
        headers: { authorization: 'Bearer valid-token' },
      }));
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.history[0]).not.toHaveProperty('answers');
      expect(data.history[0]).not.toHaveProperty('userId');
    });

    it('应该按当前用户精确核对测评回执并只返回提交后的公开结果', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findFirst', {
        ...mockQuizHistory[0],
        startedAt: new Date('2024-01-15T09:40:00Z'),
        answers: JSON.stringify({
          assessmentMode: 'retest',
          pathId: 'path-1',
          weakAreas: ['3.1.2'],
          scoresByKA: { '3.1.2': { correct: 0, total: 1, score: 0 } },
          questionResults: { '49': { correct: false, correctAnswer: 'A' } },
        }),
      });

      const response = await getQuizHistory(new NextRequest(
        'http://localhost:3000/api/quiz/history?attemptId=attempt-1',
        { headers: { authorization: 'Bearer valid-token' } },
      ));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.receipt).toMatchObject({
        attemptId: 'attempt-1',
        quizId: 'comprehensive-assessment',
        assessmentMode: 'retest',
        pathId: 'path-1',
        weakAreas: ['3.1.2'],
        scoresByKA: { '3.1.2': { correct: 0, total: 1, score: 0 } },
        questionResults: { '49': { correct: false, correctAnswer: 'A' } },
      });
      expect(data.receipt).not.toHaveProperty('answers');
      expect(data.receipt).not.toHaveProperty('userId');
      expect(mockPrisma.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          id: 'attempt-1',
          userId: 'test-user-id',
          completedAt: { lte: expect.any(Date) },
        }),
      }));
    });

    it('本地回执编号在服务端不存在时应该返回404', async () => {
      setupPrismaMock(mockPrisma, 'quizAttempt', 'findFirst', null);

      const response = await getQuizHistory(new NextRequest(
        'http://localhost:3000/api/quiz/history?attemptId=attempt-missing',
        { headers: { authorization: 'Bearer valid-token' } },
      ));

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: '测评回执不存在' });
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
      expect(data.details).toBeUndefined();
    });
  });
});
