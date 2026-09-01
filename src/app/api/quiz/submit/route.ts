import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateQuizPoints } from '@/lib/points-system';
import { checkAchievementsForQuiz } from '@/lib/achievement-checker';
import { getActiveClassIdForUser, normalizeLearningEventInput } from '@/lib/classroom';
import { getComprehensiveQuestions, quizQuestions } from '@/lib/quiz-data';
import { createHash } from 'node:crypto';
import { getDataProvenance } from '@/lib/env';
import {
  ADDRESSING_QUESTION_SET_VERSION,
  ADDRESSING_QUIZ_ID,
  ADDRESSING_TOPIC_ID,
  AI_LITERACY_QUIZ_ID,
  AI_LITERACY_TOPIC_ID,
  getAddressingQuestionIds,
  getAiLiteracyQuestionIds,
  getModuleIdForChapter,
  parseLearningTaskSteps,
} from '@/lib/lesson-tasks';

const DEDUP_WINDOW_MS = 30_000;

const optionalTrimmedString = (maxLength = 128) => z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).max(maxLength).optional());

const numberLikeSchema = z.union([z.number(), z.string()]);

const quizSubmitSchema = z.object({
  quizId: optionalTrimmedString(128),
  score: numberLikeSchema,
  totalQuestions: numberLikeSchema.nullish(),
  correctAnswers: numberLikeSchema.nullish(),
  timeSpent: numberLikeSchema.nullish(),
  answers: z.record(z.string(), z.unknown()).nullish(),
  weakAreas: z.array(z.unknown()).nullish(),
  scoresByKA: z.record(z.string(), z.unknown()).nullish(),
  moduleId: optionalTrimmedString(64),
  chapterId: optionalTrimmedString(16),
  assessmentMode: z.enum(['initial', 'retest']).nullish(),
  topicId: optionalTrimmedString(64),
  attemptId: optionalTrimmedString(128),
  pathId: optionalTrimmedString(128),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAnswer(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/,\s+/g, ',')
    : '';
}

type StoredQuizAttempt = {
  id: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  answers: string;
};

type SubmissionFingerprintInput = {
  quizId: string;
  assessmentMode: 'initial' | 'retest';
  topicId: string | null;
  moduleId?: string;
  chapterId?: string;
  pathId: string;
  answers: Record<string, unknown>;
};

class QuizTaskContextError extends Error {}

function isUniqueConstraintError(value: unknown): boolean {
  return isRecord(value) && value.code === 'P2002';
}

function createSubmissionFingerprint(input: SubmissionFingerprintInput): string {
  const normalizedAnswers = Object.entries(input.answers)
    .map(([questionId, answer]) => [questionId, normalizeAnswer(answer)] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  return createHash('sha256').update(JSON.stringify({
    quizId: input.quizId,
    assessmentMode: input.assessmentMode,
    topicId: input.topicId,
    moduleId: input.moduleId ?? null,
    chapterId: input.chapterId ?? null,
    pathId: input.pathId || null,
    answers: normalizedAnswers,
  })).digest('hex');
}

function duplicateAttemptResponse(
  attempt: StoredQuizAttempt,
  quizId: string,
  expectedFingerprint: string,
): NextResponse {
  let stored: Record<string, unknown> = {};
  try {
    const parsedStored: unknown = JSON.parse(attempt.answers ?? '{}');
    if (isRecord(parsedStored)) stored = parsedStored;
  } catch { /* legacy row */ }
  if (typeof stored.submissionFingerprint === 'string'
    && stored.submissionFingerprint !== expectedFingerprint) {
    return NextResponse.json(
      { error: '该测评尝试编号已用于另一份答题内容，请开始新一次测评' },
      { status: 409 },
    );
  }
  const storedWeakAreas = Array.isArray(stored.weakAreas)
    ? stored.weakAreas.filter((value): value is string => typeof value === 'string')
    : [];
  const storedScoresByKA = isRecord(stored.scoresByKA) ? stored.scoresByKA : {};
  const storedQuestionResults = isRecord(stored.questionResults) ? stored.questionResults : {};
  const storedTaskProgress = isRecord(stored.taskProgress) ? stored.taskProgress : null;
  const storedQuestionSetVersion = typeof stored.questionSetVersion === 'string'
    ? stored.questionSetVersion
    : null;
  return NextResponse.json({
    success: true,
    dataProvenance: getDataProvenance(),
    asOf: new Date().toISOString(),
    sampleSize: { questions: attempt.totalQuestions, answered: attempt.totalQuestions },
    duplicate: true,
    attemptId: attempt.id,
    quizId,
    score: attempt.score,
    totalQuestions: attempt.totalQuestions,
    correctAnswers: attempt.correctAnswers,
    weakAreas: storedWeakAreas,
    scoresByKA: storedScoresByKA,
    questionResults: storedQuestionResults,
    questionSetVersion: storedQuestionSetVersion,
    taskProgress: storedTaskProgress,
    message: '本次测评已提交，已恢复原提交结果',
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let recoverableAttemptId: string | null = null;
  let recoverableQuizId: string | null = null;
  let recoverableSubmissionFingerprint: string | null = null;
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const rawData: unknown = await request.json().catch((): null => null);
    const parsedData = quizSubmitSchema.safeParse(rawData);
    if (!parsedData.success) {
      return NextResponse.json({ error: '测评提交参数格式无效' }, { status: 400 });
    }
    const {
      quizId,
      score,
      totalQuestions,
      correctAnswers,
      timeSpent,
      answers,
      weakAreas,
      scoresByKA,
      moduleId,
      chapterId,
      attemptId,
      pathId,
    } = parsedData.data;
    const assessmentMode = parsedData.data.assessmentMode === 'retest' ? 'retest' : 'initial';
    const requestedTopicId = parsedData.data.topicId ?? null;
    if (requestedTopicId && requestedTopicId !== ADDRESSING_TOPIC_ID && requestedTopicId !== AI_LITERACY_TOPIC_ID) {
      return NextResponse.json({ error: '不支持的测评主题' }, { status: 400 });
    }
    const topicId = requestedTopicId === ADDRESSING_TOPIC_ID
      ? ADDRESSING_TOPIC_ID
      : requestedTopicId === AI_LITERACY_TOPIC_ID
        ? AI_LITERACY_TOPIC_ID
        : null;
    const attemptKey = attemptId ?? '';
    const requestedPathId = pathId ?? '';

    if (attemptKey && (!/^[A-Za-z0-9_-]{8,128}$/.test(attemptKey))) {
      return NextResponse.json({ error: '测评尝试编号格式无效' }, { status: 400 });
    }

    let numScore = Number(score);
    let numTotal = Number(totalQuestions ?? 0);
    let numCorrect = Number(correctAnswers ?? 0);
    if (!Number.isFinite(numScore) || !Number.isInteger(numTotal) || !Number.isInteger(numCorrect) || numTotal < 0 || numCorrect < 0) {
      return NextResponse.json({ error: '测评结果格式无效' }, { status: 400 });
    }
    if (numScore < 0 || numScore > 100) {
      return NextResponse.json({ error: '分数必须在 0-100 之间' }, { status: 400 });
    }
    // 客户端的总题数和正确题数仅用于兼容旧请求；正式值会在服务端判分后覆盖。
    const parsedTimeSpent = Number(timeSpent ?? 0);
    if (!Number.isFinite(parsedTimeSpent) || !Number.isInteger(parsedTimeSpent) || parsedTimeSpent < 0 || parsedTimeSpent > 24 * 60 * 60) {
      return NextResponse.json({ error: '测评用时格式无效' }, { status: 400 });
    }
    const safeTimeSpent = parsedTimeSpent;

    const resolvedQuizId = quizId ?? 'comprehensive-assessment';
    if (resolvedQuizId !== 'comprehensive-assessment'
      && resolvedQuizId !== ADDRESSING_QUIZ_ID
      && resolvedQuizId !== AI_LITERACY_QUIZ_ID
      && !/^quiz-ch(?:[1-9]|10)$/.test(resolvedQuizId)) {
      return NextResponse.json({ error: '测评资源编号不存在' }, { status: 400 });
    }
    if (topicId === ADDRESSING_TOPIC_ID && resolvedQuizId !== ADDRESSING_QUIZ_ID) {
      return NextResponse.json({ error: '测评主题与资源编号不匹配' }, { status: 400 });
    }
    if (topicId === AI_LITERACY_TOPIC_ID && resolvedQuizId !== AI_LITERACY_QUIZ_ID) {
      return NextResponse.json({ error: 'AI素养测评主题与资源编号不匹配' }, { status: 400 });
    }
    if (assessmentMode === 'retest' && resolvedQuizId !== ADDRESSING_QUIZ_ID) {
      return NextResponse.json({ error: '当前测评不支持再次测评模式' }, { status: 400 });
    }

    const chapterQuizMatch = /^quiz-ch([1-9]|10)$/.exec(resolvedQuizId);
    const chapterQuizNumber = chapterQuizMatch ? Number(chapterQuizMatch[1]) : null;
    if (chapterQuizNumber !== null) {
      const expectedChapterId = `ch${chapterQuizNumber}`;
      const expectedModuleId = getModuleIdForChapter(chapterQuizNumber);
      if (chapterId !== expectedChapterId || moduleId !== expectedModuleId) {
        return NextResponse.json({ error: '章节测评的资源编号不匹配' }, { status: 400 });
      }
    }

    let resolvedWeakAreas = (weakAreas ?? [])
      .filter((value): value is string => typeof value === 'string')
      .slice(0, 100);
    let resolvedScoresByKA: Record<string, unknown> = scoresByKA ?? {};
    const normalizedAnswers = answers ?? {};
    const answerKeys = Object.keys(normalizedAnswers);
    if (answerKeys.length === 0) {
      return NextResponse.json({ error: '答题记录不能为空' }, { status: 400 });
    }
    if (answerKeys.length > 2_000 || JSON.stringify(normalizedAnswers).length > 200_000) {
      return NextResponse.json({ error: '答题记录超出限制' }, { status: 400 });
    }
    const questionResults: Record<string, { correct: boolean; correctAnswer: string }> = {};

    // 专项测评由服务端按固定题集重新判分，客户端分数仅作展示，不参与落盘。
    if (resolvedQuizId === ADDRESSING_QUIZ_ID) {
      if (topicId !== ADDRESSING_TOPIC_ID || moduleId !== 'module-1' || chapterId !== 'ch3') {
        return NextResponse.json({ error: '寻址方式测评的资源编号不匹配' }, { status: 400 });
      }
      const formIds = new Set(getAddressingQuestionIds(assessmentMode));
      const officialQuestions = quizQuestions.filter((question) => formIds.has(question.id));
      const missingCount = officialQuestions.filter((question) => !normalizeAnswer(normalizedAnswers[String(question.id)])).length;
      if (missingCount > 0) {
        return NextResponse.json({ error: `还有 ${missingCount} 道专项题未作答` }, { status: 400 });
      }

      const perKA: Record<string, { correct: number; total: number; score: number }> = {};
      let correctCount = 0;
      for (const question of officialQuestions) {
        if (!perKA[question.ka]) perKA[question.ka] = { correct: 0, total: 0, score: 0 };
        const bucket = perKA[question.ka]!;
        bucket.total += 1;
        const correct = normalizeAnswer(normalizedAnswers[String(question.id)]) === normalizeAnswer(question.correctAnswer);
        questionResults[String(question.id)] = { correct, correctAnswer: question.correctAnswer };
        if (correct) {
          bucket.correct += 1;
          correctCount += 1;
        }
      }
      for (const bucket of Object.values(perKA)) {
        bucket.score = bucket.total > 0 ? (bucket.correct / bucket.total) * 100 : 0;
      }
      numTotal = officialQuestions.length;
      numCorrect = correctCount;
      numScore = numTotal > 0 ? (numCorrect / numTotal) * 100 : 0;
      resolvedScoresByKA = {
        ...perKA,
        '3.1': { correct: numCorrect, total: numTotal, score: numScore },
      };
      resolvedWeakAreas = Object.entries(perKA).filter(([, value]) => value.score < 70).map(([key]) => key);
    } else if (resolvedQuizId === AI_LITERACY_QUIZ_ID) {
      if (topicId !== AI_LITERACY_TOPIC_ID || moduleId !== 'module-5' || chapterId !== 'ch10') {
        return NextResponse.json({ error: 'AI素养测评的资源编号不匹配' }, { status: 400 });
      }
      const formIds = new Set(getAiLiteracyQuestionIds());
      const officialQuestions = quizQuestions.filter((question) => formIds.has(question.id));
      const missingCount = officialQuestions.filter((question) => !normalizeAnswer(normalizedAnswers[String(question.id)])).length;
      if (missingCount > 0) {
        return NextResponse.json({ error: `还有 ${missingCount} 道AI素养情境题未作答` }, { status: 400 });
      }
      const perKA: Record<string, { correct: number; total: number; score: number }> = {};
      let correctCount = 0;
      for (const question of officialQuestions) {
        if (!perKA[question.ka]) perKA[question.ka] = { correct: 0, total: 0, score: 0 };
        const bucket = perKA[question.ka]!;
        bucket.total += 1;
        const correct = normalizeAnswer(normalizedAnswers[String(question.id)]) === normalizeAnswer(question.correctAnswer);
        questionResults[String(question.id)] = { correct, correctAnswer: question.correctAnswer };
        if (correct) {
          bucket.correct += 1;
          correctCount += 1;
        }
      }
      for (const bucket of Object.values(perKA)) {
        bucket.score = bucket.total > 0 ? (bucket.correct / bucket.total) * 100 : 0;
      }
      numTotal = officialQuestions.length;
      numCorrect = correctCount;
      numScore = numTotal > 0 ? (numCorrect / numTotal) * 100 : 0;
      resolvedScoresByKA = {
        ...perKA,
        '10.5': { correct: numCorrect, total: numTotal, score: numScore },
      };
      resolvedWeakAreas = Object.entries(perKA).filter(([, value]) => value.score < 70).map(([key]) => key);
    } else {
      // 普通章节卷和综合卷均由服务端按正式题库判分，客户端分数不参与落盘。
      const answeredIds = new Set(
        answerKeys
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value)),
      );
      const officialQuestions = chapterQuizNumber === null
        ? getComprehensiveQuestions()
        : quizQuestions.filter((question) => question.chapter === chapterQuizNumber);
      if (answeredIds.size === 0 || officialQuestions.length === 0) {
        return NextResponse.json({ error: '没有可判定的正式题目' }, { status: 400 });
      }
      const officialQuestionIds = new Set(officialQuestions.map((question) => question.id));
      if ([...answeredIds].some((id) => !officialQuestionIds.has(id))) {
        return NextResponse.json({ error: '答题记录包含无效题目编号' }, { status: 400 });
      }
      const missingCount = officialQuestions.filter((question) => !normalizeAnswer(normalizedAnswers[String(question.id)])).length;
      if (missingCount > 0) {
        return NextResponse.json({ error: `还有 ${missingCount} 道题未作答` }, { status: 400 });
      }
      const perKA: Record<string, { correct: number; total: number; score: number }> = {};
      let correctCount = 0;
      for (const question of officialQuestions) {
        if (!perKA[question.ka]) perKA[question.ka] = { correct: 0, total: 0, score: 0 };
        const bucket = perKA[question.ka]!;
        bucket.total += 1;
        const correct = normalizeAnswer(normalizedAnswers[String(question.id)]) === normalizeAnswer(question.correctAnswer);
        questionResults[String(question.id)] = { correct, correctAnswer: question.correctAnswer };
        if (correct) {
          bucket.correct += 1;
          correctCount += 1;
        }
      }
      for (const bucket of Object.values(perKA)) {
        bucket.score = bucket.total > 0 ? (bucket.correct / bucket.total) * 100 : 0;
      }
      numTotal = officialQuestions.length;
      numCorrect = correctCount;
      numScore = numTotal > 0 ? (numCorrect / numTotal) * 100 : 0;
      resolvedScoresByKA = perKA;
      resolvedWeakAreas = Object.entries(perKA).filter(([, value]) => value.score < 70).map(([key]) => key).slice(0, 100);
    }

    const submissionFingerprint = createSubmissionFingerprint({
      quizId: resolvedQuizId,
      assessmentMode,
      topicId,
      moduleId,
      chapterId,
      pathId: requestedPathId,
      answers: normalizedAnswers,
    });
    recoverableSubmissionFingerprint = submissionFingerprint;

    // 同一次尝试使用确定性主键；并发重试也只能成功写入一次。
    recoverableAttemptId = attemptKey
      ? `qa_${createHash('sha256').update(`${payload.userId}:${resolvedQuizId}:${attemptKey}`).digest('hex').slice(0, 28)}`
      : null;
    recoverableQuizId = resolvedQuizId;
    const existingAttempt = attemptKey ? await prisma.quizAttempt.findFirst({
      where: {
        userId: payload.userId,
        quizId: resolvedQuizId,
        OR: [
          ...(recoverableAttemptId ? [{ id: recoverableAttemptId }] : []),
          { answers: { contains: `\"attemptId\":\"${attemptKey}\"` } },
        ],
      },
      select: { id: true, score: true, totalQuestions: true, correctAnswers: true, answers: true },
    }) : null;
    if (existingAttempt) return duplicateAttemptResponse(existingAttempt, resolvedQuizId, submissionFingerprint);

    // 旧客户端没有尝试编号时保留短窗口保护。
    if (!attemptKey) {
      const recentAttempt = await prisma.quizAttempt.findFirst({
        where: {
          userId: payload.userId,
          quizId: resolvedQuizId,
          completedAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (recentAttempt) {
        return NextResponse.json(
          { error: '请勿重复提交，请稍后再试', attemptId: recentAttempt.id },
          { status: 429 },
        );
      }
    }

    const points = calculateQuizPoints(numScore);
    const submittedAt = new Date();
    const pointsReceiptId = `qpt_${createHash('sha256')
      .update(`${payload.userId}:${resolvedQuizId}:${submittedAt.toISOString().slice(0, 10)}`)
      .digest('hex')
      .slice(0, 28)}`;

    // 核心写入放入事务
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 只有显式携带任务编号的测评才能推进教师布置的路径。自主测评即使与
      // 某条活动路径的当前试卷相同，也只保存为独立测评记录，不能静默代办任务。
      const activePath = requestedPathId
        ? await tx.learningPath.findFirst({
            where: {
              id: requestedPathId,
              userId: payload.userId,
              status: 'ACTIVE',
            },
            select: { id: true, modules: true, currentModule: true },
          })
        : null;
      const activeSteps = activePath ? parseLearningTaskSteps(activePath.modules) : [];
      const activeStep = activePath ? activeSteps[activePath.currentModule] : undefined;
      const expectedType = assessmentMode === 'retest' ? 'RETEST' : 'QUIZ';
      const canAdvanceTask = Boolean(
        activePath
        && activeStep?.type === expectedType
        && activeStep.quizId === resolvedQuizId,
      );
      if (requestedPathId && !canAdvanceTask) {
        throw new QuizTaskContextError('当前学习任务尚未进入该测评步骤，或任务状态已经变化');
      }

      const attemptPayload = {
        answers: normalizedAnswers,
        moduleId,
        chapterId,
        topicId,
        assessmentMode,
        questionSetVersion: resolvedQuizId === ADDRESSING_QUIZ_ID
          ? ADDRESSING_QUESTION_SET_VERSION
          : undefined,
        attemptId: attemptKey.length > 0 ? attemptKey : undefined,
        pathId: canAdvanceTask ? activePath?.id : undefined,
        stepId: canAdvanceTask ? activeStep?.stepId : undefined,
        submissionFingerprint,
        weakAreas: resolvedWeakAreas,
        scoresByKA: resolvedScoresByKA,
        questionResults,
      };
      const attempt = await tx.quizAttempt.create({
        data: {
          ...(recoverableAttemptId ? { id: recoverableAttemptId } : {}),
          userId: payload.userId,
          quizId: resolvedQuizId,
          score: numScore,
          totalQuestions: numTotal,
          correctAnswers: numCorrect,
          timeSpent: safeTimeSpent,
          answers: JSON.stringify(attemptPayload),
          startedAt: new Date(submittedAt.getTime() - safeTimeSpent * 1000),
          completedAt: submittedAt,
        },
      });

      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'COMPLETE_QUIZ',
          details: JSON.stringify({
            quizId: resolvedQuizId,
            score: numScore,
            weakAreas: resolvedWeakAreas,
            scoresByKA: resolvedScoresByKA,
            topicId,
            assessmentMode,
            ...(resolvedQuizId === ADDRESSING_QUIZ_ID
              ? { questionSetVersion: ADDRESSING_QUESTION_SET_VERSION }
              : {}),
            chapterId,
            ...(attemptKey ? { attemptKey } : {}),
            ...(canAdvanceTask && activePath ? { pathId: activePath.id } : {}),
          }),
        },
      });

      const pointsReceipt = await tx.userPointsTransaction.createMany({
        data: [{
          id: pointsReceiptId,
          userId: payload.userId,
          points,
          type: numScore === 100 ? 'PERFECT_SCORE' : numScore >= 60 ? 'QUIZ_PASS' : 'COMPLETE_QUIZ',
          description: `完成测验获得${points}积分`,
          metadata: JSON.stringify({ quizId: resolvedQuizId, score: numScore, attemptId: attempt.id, topicId, assessmentMode }),
        }],
        skipDuplicates: true,
      });

      if (pointsReceipt.count > 0) {
        await tx.user.update({
          where: { id: payload.userId },
          data: { totalPoints: { increment: points } },
        });
      }

      let taskProgress: { pathId: string; currentModule: number; status: string } | null = null;
      if (activePath && activeStep && canAdvanceTask) {
        const nextModule = Math.min(activePath.currentModule + 1, activeSteps.length);
        const nextStatus = nextModule >= activeSteps.length ? 'COMPLETED' : 'ACTIVE';
        const advanced = await tx.learningPath.updateMany({
          where: { id: activePath.id, userId: payload.userId, status: 'ACTIVE', currentModule: activePath.currentModule },
          data: { currentModule: nextModule, status: nextStatus, completedAt: nextStatus === 'COMPLETED' ? new Date() : null },
        });
        if (advanced.count > 0) {
          await tx.userActivity.create({
            data: {
              userId: payload.userId,
              action: 'COMPLETE_TASK_STEP',
              details: JSON.stringify({ pathId: activePath.id, stepId: activeStep.stepId, stepType: activeStep.type, targetId: resolvedQuizId, attemptId: attempt.id, attemptKey }),
            },
          });
          taskProgress = { pathId: activePath.id, currentModule: nextModule, status: nextStatus };
          await tx.quizAttempt.update({
            where: { id: attempt.id },
            data: { answers: JSON.stringify({ ...attemptPayload, taskProgress }) },
          });
        }
      }

      return { attempt, taskProgress, pointsAwarded: pointsReceipt.count > 0 ? points : 0 };
    });

    // 成就检查失败不能把已经成功落盘的测评伪装成提交失败。
    let newAchievements: Awaited<ReturnType<typeof checkAchievementsForQuiz>> = [];
    try {
      newAchievements = await checkAchievementsForQuiz(payload.userId, numScore, resolvedQuizId);
    } catch (achievementError) {
      console.error('测评已保存，但成就检查失败:', achievementError);
    }

    // 学习事件记录（非事务，失败不影响主流程）
    try {
      const classId = await getActiveClassIdForUser(payload.userId);
      const learningEvent = normalizeLearningEventInput({
        eventType: 'COMPLETE_QUIZ',
        targetType: 'QUIZ',
        targetId: resolvedQuizId,
        moduleId,
        chapterId,
        quizId: resolvedQuizId,
        duration: safeTimeSpent,
        progress: numScore,
        metadata: {
          source: 'quiz-submit-api',
          action: 'COMPLETE_QUIZ',
          score: numScore,
          weakAreas: resolvedWeakAreas,
          scoresByKA: resolvedScoresByKA,
          topicId,
          assessmentMode,
          attemptId: transactionResult.attempt.id,
          attemptKey,
          pathId: transactionResult.taskProgress?.pathId ?? null,
        },
      }, resolvedQuizId);

      if (learningEvent) {
        await prisma.learningEvent.create({
          data: { userId: payload.userId, classId, ...learningEvent },
        });
      }
    } catch (eventError) {
      console.error('记录测评行为失败:', eventError);
    }

    // 章节测验 → 触发学习进度更新
    if (moduleId && chapterId) {
      try {
        const learningProgress = await prisma.learningProgress.findUnique({
          where: { userId_moduleId_chapterId: { userId: payload.userId, moduleId, chapterId } },
        });
        if (learningProgress) {
          const response = await fetch(
            `${request.url.replace('/quiz/submit', '/learning-progress')}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: authorization },
              body: JSON.stringify({
                moduleId, chapterId,
                pathId: learningProgress.pathId,
                progress: learningProgress.progress,
                timeSpent: 0,
                action: 'QUIZ_COMPLETED',
              }),
            },
          );
          if (!response.ok) {
            console.error('Failed to update learning progress after quiz completion');
          }
        }
      } catch (error) {
        console.error('Error updating learning progress:', error);
      }
    }

    return NextResponse.json({
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: new Date().toISOString(),
      sampleSize: { questions: numTotal, answered: Object.keys(normalizedAnswers).length },
      attemptId: transactionResult.attempt.id,
      quizId: resolvedQuizId,
      score: numScore,
      totalQuestions: numTotal,
      correctAnswers: numCorrect,
      weakAreas: resolvedWeakAreas,
      scoresByKA: resolvedScoresByKA,
      questionResults,
      taskProgress: transactionResult.taskProgress,
      message: '测评结果已保存',
      newAchievements: newAchievements.length > 0 ? newAchievements : null,
      pointsEarned: transactionResult.pointsAwarded,
      totalPointsEarned: transactionResult.pointsAwarded + newAchievements.reduce((sum, ach) => sum + ach.points, 0),
    });
  } catch (error) {
    if (error instanceof QuizTaskContextError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (recoverableAttemptId && recoverableQuizId && recoverableSubmissionFingerprint && isUniqueConstraintError(error)) {
      try {
        const existingAttempt = await prisma.quizAttempt.findUnique({
          where: { id: recoverableAttemptId },
          select: { id: true, score: true, totalQuestions: true, correctAnswers: true, answers: true },
        });
        if (existingAttempt) {
          return duplicateAttemptResponse(existingAttempt, recoverableQuizId, recoverableSubmissionFingerprint);
        }
      } catch (recoveryError) {
        console.error('恢复并发测评回执失败:', recoveryError);
      }
    }
    console.error('保存测评结果失败:', error);
    return NextResponse.json({
      error: '保存测评结果失败',
    }, { status: 500 });
  }
}
