import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDataProvenance } from '@/lib/env';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function receiptContextOf(answers: string): {
  assessmentMode: 'initial' | 'retest';
  pathId: string | null;
  weakAreas: string[];
  scoresByKA: Record<string, { correct: number; total: number; score: number }>;
  questionResults: Record<string, { correct: boolean; correctAnswer: string }>;
} {
  try {
    const parsed: unknown = JSON.parse(answers);
    if (!isRecord(parsed)) {
      return { assessmentMode: 'initial', pathId: null, weakAreas: [], scoresByKA: {}, questionResults: {} };
    }
    const scoresByKA = isRecord(parsed.scoresByKA)
      ? Object.fromEntries(Object.entries(parsed.scoresByKA).flatMap(([key, value]) => {
          if (!isRecord(value)) return [];
          const correct = Number(value.correct);
          const total = Number(value.total);
          const score = Number(value.score);
          return Number.isFinite(correct) && Number.isFinite(total) && Number.isFinite(score)
            ? [[key, { correct, total, score }]]
            : [];
        }))
      : {};
    const questionResults = isRecord(parsed.questionResults)
      ? Object.fromEntries(Object.entries(parsed.questionResults).flatMap(([key, value]) => (
          isRecord(value) && typeof value.correct === 'boolean' && typeof value.correctAnswer === 'string'
            ? [[key, { correct: value.correct, correctAnswer: value.correctAnswer }]]
            : []
        )))
      : {};
    return {
      assessmentMode: parsed.assessmentMode === 'retest' ? 'retest' : 'initial',
      pathId: typeof parsed.pathId === 'string' && parsed.pathId.trim() ? parsed.pathId.trim() : null,
      weakAreas: Array.isArray(parsed.weakAreas)
        ? parsed.weakAreas.filter((value): value is string => typeof value === 'string')
        : [],
      scoresByKA,
      questionResults,
    };
  } catch {
    return { assessmentMode: 'initial', pathId: null, weakAreas: [], scoresByKA: {}, questionResults: {} };
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const attemptId = new URL(request.url).searchParams.get('attemptId')?.trim() ?? '';
    if (attemptId && !/^[A-Za-z0-9_-]{1,128}$/.test(attemptId)) {
      return NextResponse.json({ error: '测评回执编号格式无效' }, { status: 400 });
    }
    const asOf = new Date();

    // 刷新后的本地回执只作为定位线索；是否确已提交必须回到当前用户的服务端记录核对。
    if (attemptId) {
      const attempt = await prisma.quizAttempt.findFirst({
        where: { id: attemptId, userId: payload.userId, completedAt: { lte: asOf } },
        select: {
          id: true,
          quizId: true,
          score: true,
          totalQuestions: true,
          correctAnswers: true,
          timeSpent: true,
          startedAt: true,
          completedAt: true,
          answers: true,
        },
      });
      if (!attempt) {
        return NextResponse.json({ error: '测评回执不存在' }, { status: 404 });
      }
      const context = receiptContextOf(attempt.answers);
      return NextResponse.json({
        success: true,
        dataProvenance: getDataProvenance(),
        asOf: asOf.toISOString(),
        sampleSize: { returnedAttempts: 1, totalAttempts: 1 },
        receipt: {
          attemptId: attempt.id,
          quizId: attempt.quizId,
          score: attempt.score,
          totalQuestions: attempt.totalQuestions,
          correctAnswers: attempt.correctAnswers,
          timeSpent: attempt.timeSpent,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          assessmentMode: context.assessmentMode,
          pathId: context.pathId,
          weakAreas: context.weakAreas,
          scoresByKA: context.scoresByKA,
          questionResults: context.questionResults,
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    // 获取用户的测验历史
    const quizHistoryRows = await prisma.quizAttempt.findMany({
      where: {
        userId: payload.userId,
        completedAt: { lte: asOf },
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 20, // 最近20次测验
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
    // 明确构造公开字段，避免 ORM mock 或后续查询调整意外把 answers、userId 等内部字段返回给学生端。
    const quizHistory = quizHistoryRows.map((attempt) => ({
      id: attempt.id,
      quizId: attempt.quizId,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctAnswers: attempt.correctAnswers,
      timeSpent: attempt.timeSpent,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    }));

    // 计算统计信息
    const stats = {
      totalAttempts: await prisma.quizAttempt.count({
        where: { userId: payload.userId, completedAt: { lte: asOf } }
      }),
      averageScore: quizHistory.length > 0
        ? Math.round(quizHistory.reduce((sum, q) => sum + q.score, 0) / quizHistory.length)
        : 0,
      bestScore: quizHistory.length > 0
        ? Math.max(...quizHistory.map(q => q.score))
        : 0,
      latestScore: quizHistory[0]?.score || 0,
      totalTimeSpent: quizHistory.reduce((sum, q) => sum + q.timeSpent, 0)
    };

    return NextResponse.json({
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: asOf.toISOString(),
      sampleSize: { returnedAttempts: quizHistory.length, totalAttempts: stats.totalAttempts },
      history: quizHistory,
      stats
    }, { headers: { 'Cache-Control': 'private, no-store' } });

  } catch (error) {
    console.error('获取测验历史失败:', error);
    return NextResponse.json({ 
      error: '获取测验历史失败'
    }, { status: 500 });
  }
}
