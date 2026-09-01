import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { ADDRESSING_QUIZ_ID, ADDRESSING_TOPIC_ID } from '@/lib/lesson-tasks';

type PushRecord = {
  userId: string;
  date: Date;
  topicId: string | null;
  pathId: string | null;
  batchId: string | null;
};

type QuizMetadata = {
  mode: 'initial' | 'retest';
  pathId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function quizMetadataOf(answers: string): QuizMetadata {
  const parsed = parseJsonRecord(answers);
  return {
    mode: parsed.assessmentMode === 'retest' ? 'retest' : 'initial',
    pathId: asString(parsed.pathId),
  };
}

function experimentMatchesPath(results: string | null, pathId: string): boolean {
  const parsed = parseJsonRecord(results);
  const completionContext = parsed.completionContext;
  if (isRecord(completionContext) && completionContext.pathId === pathId) return true;
  return Array.isArray(parsed.completionHistory)
    && parsed.completionHistory.some((item) => isRecord(item) && item.pathId === pathId);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const accessibleClassIds = await getAccessibleClassIds(payload);
    const studentEnrollments = accessibleClassIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: {
          classId: { in: accessibleClassIds },
          role: 'STUDENT', status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: { userId: true },
      });
    const studentIds = [...new Set(studentEnrollments.map(e => e.userId))];
    if (studentIds.length === 0) {
      return NextResponse.json({
        interventions: [],
        summary: {
          batchId: null, totalInterventions: 0, totalStudents: 0,
          withBothScores: 0, improved: 0, avgGain: 0, improvementRate: 0,
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    // Find all push-learning-task events for these students
    const pushEvents = await prisma.userActivity.findMany({
      where: {
        userId: { in: studentIds },
        action: 'TEACHER_PUSH_LEARNING_TASK',
      },
      select: { userId: true, createdAt: true, details: true },
      orderBy: { createdAt: 'desc' },
    });

    if (pushEvents.length === 0) {
      return NextResponse.json({
        interventions: [],
        summary: {
          batchId: null, totalInterventions: 0, totalStudents: 0,
          withBothScores: 0, improved: 0, avgGain: 0, improvementRate: 0,
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const parsedPushes: PushRecord[] = [];
    for (const event of pushEvents) {
      const details = parseJsonRecord(event.details);
      const pushedBy = asString(details.pushedBy);
      // 没有明确教师归属的历史事件不得归入当前教师统计。
      if (pushedBy !== payload.userId) continue;
      parsedPushes.push({
        userId: event.userId,
        date: event.createdAt,
        topicId: asString(details.topicId),
        pathId: asString(details.pathId),
        batchId: asString(details.batchId),
      });
    }
    const requestedBatchId = asString(new URL(request.url).searchParams.get('batchId'));
    if (requestedBatchId && !/^batch_[A-Za-z0-9_-]{1,64}$/.test(requestedBatchId)) {
      return NextResponse.json({ error: '批次编号格式无效' }, { status: 400 });
    }
    if (requestedBatchId && !parsedPushes.some((push) => push.batchId === requestedBatchId)) {
      return NextResponse.json({ error: '任务批次不存在或无权查看' }, { status: 404 });
    }
    const latestBatchId = requestedBatchId ?? parsedPushes.find((push) => push.batchId)?.batchId ?? null;
    const scopedPushes = latestBatchId ? parsedPushes.filter((push) => push.batchId === latestBatchId) : parsedPushes;

    // 同一批次每名学生只保留一条任务实例记录。
    const latestPushByStudent = new Map<string, typeof scopedPushes[number]>();
    for (const push of scopedPushes) {
      if (!latestPushByStudent.has(push.userId)) latestPushByStudent.set(push.userId, push);
    }

    const intervenedIds = [...latestPushByStudent.keys()];

    // 获取任务相关记录。只有固定专项测评编号、任务实例和首测/再次测评口径同时匹配时，
    // 才形成可比较结果；普通任务不得把任意两次测验静默包装成前后测。
    const pathIds = [...latestPushByStudent.values()].flatMap((push) => push.pathId ? [push.pathId] : []);
    const [quizAttempts, experiments, learningPaths, experimentReceipts] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { userId: { in: intervenedIds } },
        select: { userId: true, quizId: true, score: true, answers: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.userExperiment.findMany({
        where: { userId: { in: intervenedIds }, experimentId: 'exp02' },
        select: { userId: true, status: true, completedAt: true, results: true },
      }),
      prisma.learningPath.findMany({
        where: pathIds.length > 0 ? { id: { in: pathIds } } : { userId: { in: intervenedIds } },
        select: { id: true, userId: true, name: true, modules: true, currentModule: true, totalModules: true, status: true, startedAt: true },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.userActivity.findMany({
        where: {
          userId: { in: intervenedIds },
          action: 'COMPLETE_EXPERIMENT',
          details: { contains: `\"experimentId\":\"exp02\"` },
        },
        select: { userId: true, createdAt: true, details: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Get student names
    const students = await prisma.user.findMany({
      where: { id: { in: intervenedIds } },
      select: { id: true, name: true, studentId: true },
    });
    const nameMap = new Map(students.map(s => [s.id, s]));

    // Calculate pre/post intervention scores per student
    const interventions: {
      studentId: string; name: string; studentCode: string | null;
      interventionDate: string;
      preAvg: number; postAvg: number; gain: number;
      preCount: number; postCount: number;
      topicId: string | null; comparisonLabel: string;
      experimentStatus: string; taskStatus: string; currentStep: number; totalSteps: number;
    }[] = [];

    for (const [userId, push] of latestPushByStudent) {
      const studentQuizzes = quizAttempts.filter(q => q.userId === userId);
      let preQuizzes: typeof studentQuizzes = [];
      let postQuizzes: typeof studentQuizzes = [];
      let comparisonLabel = '未配置同口径首测 / 再次测评';

      if (push.topicId === ADDRESSING_TOPIC_ID) {
        const scoped = studentQuizzes.filter((quiz) => {
          if (quiz.quizId !== ADDRESSING_QUIZ_ID || quiz.completedAt < push.date) return false;
          const meta = quizMetadataOf(quiz.answers);
          return push.pathId ? meta.pathId === push.pathId : true;
        });
        preQuizzes = scoped.filter((quiz) => quizMetadataOf(quiz.answers).mode === 'initial').slice(0, 1);
        postQuizzes = scoped.filter((quiz) => quizMetadataOf(quiz.answers).mode === 'retest').slice(0, 1);
        comparisonLabel = '专项首测 / 再次测评';
      }

      const preAvg = preQuizzes.length > 0
        ? Math.round(preQuizzes.reduce((s, q) => s + q.score, 0) / preQuizzes.length)
        : null;
      const postAvg = postQuizzes.length > 0
        ? Math.round(postQuizzes.reduce((s, q) => s + q.score, 0) / postQuizzes.length)
        : null;

      const experimentReceipt = experimentReceipts.find((item) => {
        if (item.userId !== userId) return false;
        const details = parseJsonRecord(item.details);
        if (asString(details.experimentId) !== 'exp02') return false;
        return push.pathId
          ? asString(details.pathId) === push.pathId
          : item.createdAt >= push.date;
      });
      const experiment = experiments.find((item) => {
        if (item.userId !== userId) return false;
        if (!push.pathId) return Boolean(item.completedAt && item.completedAt >= push.date);
        return experimentMatchesPath(item.results, push.pathId);
      });
      const path = learningPaths.find((item) => push.pathId ? item.id === push.pathId : item.userId === userId && item.startedAt >= push.date);

      interventions.push({
        studentId: userId,
        name: nameMap.get(userId)?.name ?? userId,
        studentCode: nameMap.get(userId)?.studentId ?? null,
        interventionDate: push.date.toISOString(),
        preAvg: preAvg ?? 0,
        postAvg: postAvg ?? 0,
        gain: (preAvg !== null && postAvg !== null) ? postAvg - preAvg : 0,
        preCount: preQuizzes.length,
        postCount: postQuizzes.length,
        topicId: push.topicId,
        comparisonLabel,
        experimentStatus: experimentReceipt ? 'COMPLETED' : experiment?.status ?? 'NOT_STARTED',
        taskStatus: path?.status ?? 'NO_DATA',
        currentStep: path?.currentModule ?? 0,
        totalSteps: path?.totalModules ?? 0,
      });
    }

    // Sort by gain descending
    interventions.sort((a, b) => b.gain - a.gain);

    // Summary statistics
    const withBothScores = interventions.filter(i => i.preCount > 0 && i.postCount > 0);
    const improved = withBothScores.filter(i => i.gain > 0).length;
    const avgGain = withBothScores.length > 0
      ? Math.round(withBothScores.reduce((s, i) => s + i.gain, 0) / withBothScores.length)
      : 0;

    return NextResponse.json({
      interventions,
      summary: {
        batchId: latestBatchId,
        totalInterventions: latestPushByStudent.size,
        totalStudents: intervenedIds.length,
        withBothScores: withBothScores.length,
        improved,
        improvementRate: withBothScores.length > 0 ? Math.round(improved / withBothScores.length * 100) : 0,
        avgGain,
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('intervention-effect API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
