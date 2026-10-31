import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDataProvenance } from '@/lib/env';
import { isQuestionFigure, isQuestionSource, quizQuestions, toPublicQuestion, type PublicQuestion, type QuestionSource } from '@/lib/quiz-data';
import { knowledgePoints } from '@/lib/knowledge-points';
import { getTeachingContent } from '@/lib/teaching-content';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type QuestionResult = {
  correct: boolean;
  correctAnswer: string;
  explanation?: string;
  source?: QuestionSource;
};

function sourceOf(value: unknown): QuestionSource | undefined {
  if (!isQuestionSource(value)) return undefined;
  if (value.kind === 'guide') {
    return { kind: 'guide', title: value.title, experimentId: value.experimentId, section: value.section, url: value.url };
  }
  return { title: value.title, page: value.page, url: value.url };
}

type ReceiptReview = {
  order: 'recorded' | 'unavailable';
  questions: Array<{
    id: number;
    question: PublicQuestion | null;
    questionSource: 'snapshot' | 'current-bank' | 'unavailable';
    selectedAnswer: string | null;
    supplement?: { explanation: string; source: QuestionSource };
  }>;
};

function publicSnapshotOf(value: unknown): PublicQuestion | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.id) || Number(value.id) < 1
    || typeof value.questionText !== 'string' || typeof value.ka !== 'string'
    || !Number.isSafeInteger(value.chapter)) return null;
  const base = {
    id: Number(value.id),
    questionText: value.questionText,
    ka: value.ka,
    chapter: Number(value.chapter),
    ...(isQuestionFigure(value.figure) ? { figure: value.figure } : {}),
  };
  if (value.type === 'multiple-choice' && Array.isArray(value.options) && value.options.every((option) => typeof option === 'string')) {
    return { ...base, type: 'multiple-choice', options: value.options };
  }
  if (value.type === 'code-completion' && typeof value.code === 'string') return { ...base, type: 'code-completion', code: value.code };
  return null;
}

function reviewOf(parsed: Record<string, unknown>, results: Record<string, QuestionResult>): ReceiptReview {
  // Some older rows stored only a flat selection map. Never infer their selections or grades.
  const selections = isRecord(parsed.answers) ? parsed.answers : parsed;
  const ids = [...new Set([...Object.keys(results), ...Object.keys(selections)]
    .filter((key) => /^[1-9]\d*$/.test(key) && Number.isSafeInteger(Number(key))).map(Number))].sort((a, b) => a - b);
  const recorded = Array.isArray(parsed.questionOrderIds) ? parsed.questionOrderIds : [];
  const validOrder = recorded.length === ids.length && ids.length > 0
    && new Set(recorded).size === ids.length && recorded.every((id) => typeof id === 'number' && ids.includes(id));
  const orderedIds = validOrder ? recorded as number[] : ids;
  const snapshots = new Map((Array.isArray(parsed.questionSnapshots) ? parsed.questionSnapshots : [])
    .map(publicSnapshotOf).filter((question): question is PublicQuestion => question !== null).map((question) => [question.id, question]));
  return {
    order: validOrder ? 'recorded' : 'unavailable',
    questions: orderedIds.map((id) => {
      const snapshot = snapshots.get(id);
      const current = quizQuestions.find((question) => question.id === id);
      const originalResult = results[String(id)];
      const point = current ? knowledgePoints.find((item) => item.id === current.ka) : undefined;
      const guide = getTeachingContent('exp02');
      const addressing = current && /^3\.1\.[1-7]$/.test(current.ka)
        && originalResult?.correctAnswer === current.correctAnswer && !originalResult.explanation
        ? guide.addressingComparison?.find((mode) => point?.name.startsWith(mode.name)) : undefined;
      return {
        id,
        question: snapshot ?? (current ? toPublicQuestion(current) : null),
        questionSource: snapshot ? 'snapshot' : current ? 'current-bank' : 'unavailable',
        selectedAnswer: typeof selections[String(id)] === 'string' ? selections[String(id)] as string : null,
        ...(addressing ? { supplement: {
          explanation: `${addressing.name}：${addressing.note} 示例：${addressing.example}。`,
          source: { kind: 'guide' as const, title: '实验2网页指导', experimentId: 'exp02',
            section: '8051 寻址方式', url: '/simulation?experiment=exp02&view=guide' },
        } } : {}),
      };
    }),
  };
}

function receiptContextOf(answers: string): {
  assessmentMode: 'initial' | 'retest';
  pathId: string | null;
  weakAreas: string[];
  scoresByKA: Record<string, { correct: number; total: number; score: number }>;
  questionResults: Record<string, QuestionResult>;
  review: ReceiptReview;
} {
  try {
    const parsed: unknown = JSON.parse(answers);
    if (!isRecord(parsed)) {
      return { assessmentMode: 'initial', pathId: null, weakAreas: [], scoresByKA: {}, questionResults: {}, review: { order: 'unavailable', questions: [] } };
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
      ? Object.fromEntries(Object.entries(parsed.questionResults).flatMap(([key, value]) => {
          if (!isRecord(value) || typeof value.correct !== 'boolean' || typeof value.correctAnswer !== 'string') return [];
          const source = sourceOf(value.source);
          return [[key, {
            correct: value.correct,
            correctAnswer: value.correctAnswer,
            ...(typeof value.explanation === 'string' ? { explanation: value.explanation } : {}),
            ...(source ? { source } : {}),
          }]];
        }))
      : {};
    return {
      assessmentMode: parsed.assessmentMode === 'retest' ? 'retest' : 'initial',
      pathId: typeof parsed.pathId === 'string' && parsed.pathId.trim() ? parsed.pathId.trim() : null,
      weakAreas: Array.isArray(parsed.weakAreas)
        ? parsed.weakAreas.filter((value): value is string => typeof value === 'string')
        : [],
      scoresByKA,
      questionResults,
      review: reviewOf(parsed, questionResults),
    };
  } catch {
    return { assessmentMode: 'initial', pathId: null, weakAreas: [], scoresByKA: {}, questionResults: {}, review: { order: 'unavailable', questions: [] } };
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

    const searchParams = new URL(request.url).searchParams;
    const attemptId = searchParams.get('attemptId')?.trim() ?? '';
    const expectedUserId = searchParams.get('expectedUserId')?.trim();
    if ((attemptId && !expectedUserId) || (expectedUserId !== undefined && (!expectedUserId || expectedUserId.length > 128))) {
      return NextResponse.json({ error: '请提供当前页面的登录账号', code: 'INVALID_INPUT' }, { status: 400 });
    }
    if (expectedUserId !== undefined && expectedUserId !== payload.userId) {
      return NextResponse.json({ error: '登录账号已变化，请刷新身份后再核对回执', code: 'ACCOUNT_CHANGED' }, { status: 409 });
    }
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
        ownerId: payload.userId,
        dataProvenance: getDataProvenance(),
        asOf: asOf.toISOString(),
        sampleSize: {
          questions: attempt.totalQuestions,
          ...(context.review.questions.length === attempt.totalQuestions && context.review.questions.every((item) => item.selectedAnswer !== null)
            ? { answered: context.review.questions.filter((item) => item.selectedAnswer!.trim()).length } : {}),
          returnedAttempts: 1, totalAttempts: 1,
        },
        receipt: {
          ownerId: payload.userId,
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
          review: context.review,
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
      ownerId: payload.userId,
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
