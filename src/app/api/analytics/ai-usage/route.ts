import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';

const DEMO_ACCOUNT_PREFIX = 'demo_';
const DEMO_ACCOUNT_EXCLUSION = '账号名以 demo_ 开头的专用演示学生不纳入教学分析';

export async function GET(request: NextRequest) {
  try {
    const dataProvenance = getDataProvenance();
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const requestedAsOf = new URL(request.url).searchParams.get('asOf');
    const asOf = requestedAsOf ? new Date(requestedAsOf) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: '数据截止时间格式无效' }, { status: 400 });
    }
    const accessibleClassIds = await getAccessibleClassIds(payload);
    const studentEnrollments = accessibleClassIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: {
          classId: { in: accessibleClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          joinedAt: { lte: asOf },
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: { userId: true, user: { select: { username: true } } },
      });

    const enrollmentByStudent = new Map(
      studentEnrollments.map((enrollment) => [enrollment.userId, enrollment.user.username]),
    );
    const enrolledStudentCount = enrollmentByStudent.size;
    const studentIds = [...enrollmentByStudent.entries()]
      .filter(([, username]) => !username.toLowerCase().startsWith(DEMO_ACCOUNT_PREFIX))
      .map(([userId]) => userId);
    const excludedDemoCount = enrolledStudentCount - studentIds.length;
    const scopeBase = {
      asOf: asOf.toISOString(),
      basis: 'ACTIVE_CLASS_ENROLLMENT',
      accessibleClassCount: accessibleClassIds.length,
      enrolledStudentCount,
      includedStudentCount: studentIds.length,
      excludedStudentCount: excludedDemoCount,
      exclusions: excludedDemoCount > 0
        ? [{ code: 'DEMO_ACCOUNT', label: DEMO_ACCOUNT_EXCLUSION, count: excludedDemoCount }]
        : [],
    };
    if (studentIds.length === 0) {
      return NextResponse.json({
        dataProvenance,
        scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN',
        scope: {
          ...scopeBase,
          metricSamples: {
            quizStudents: 0,
            aiUsageStudents: 0,
            rankedStudents: 0,
          },
        },
        interpretation: 'CORRELATION_ONLY',
        summary: {
          totalAiUsers: 0,
          totalAiEvents: 0,
          avgAiPerUser: 0,
          avgAiUserScore: null,
          avgNonAiUserScore: null,
          aiUsageRate: 0,
          scoreDifference: null,
        },
        usageVsScore: [],
        weeklyUsage: [],
        topAiStudents: [],
      });
    }

    const [aiEvents, quizAttempts] = await Promise.all([
      prisma.learningEvent.findMany({
        where: { userId: { in: studentIds }, eventType: 'AI_CHAT', createdAt: { lte: asOf } },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds }, completedAt: { lte: asOf } },
        select: { userId: true, quizId: true, score: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    // Per-student AI usage count
    const aiCountByStudent = new Map<string, number>();
    for (const e of aiEvents) {
      aiCountByStudent.set(e.userId, (aiCountByStudent.get(e.userId) || 0) + 1);
    }

    // 汇总分与教学看板一致：每名学生先取各测验最高分，再对已作答测验求均值。
    // 同时保留按时间排序的作答序列，仅用于“首次/最近一次”描述。
    const bestScoresByStudent = new Map<string, Map<string, number>>();
    const attemptScoresByStudent = new Map<string, number[]>();
    for (const qa of quizAttempts) {
      const bestByQuiz = bestScoresByStudent.get(qa.userId) ?? new Map<string, number>();
      const currentBest = bestByQuiz.get(qa.quizId);
      if (currentBest === undefined || qa.score > currentBest) bestByQuiz.set(qa.quizId, qa.score);
      bestScoresByStudent.set(qa.userId, bestByQuiz);

      const attempts = attemptScoresByStudent.get(qa.userId) ?? [];
      attempts.push(qa.score);
      attemptScoresByStudent.set(qa.userId, attempts);
    }

    const totalAiUsers = aiCountByStudent.size;
    const totalAiEvents = aiEvents.length;
    const avgAiPerUser = totalAiUsers > 0 ? Math.round(totalAiEvents / totalAiUsers) : 0;

    // Usage vs score correlation (binned)
    const usageBins = new Map<number, { total: number; scoreSum: number }>();
    for (const userId of studentIds) {
      const scores = [...(bestScoresByStudent.get(userId)?.values() ?? [])];
      if (!scores || scores.length === 0) continue;
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const aiCount = aiCountByStudent.get(userId) || 0;
      const bin = Math.min(aiCount, 20); // cap at 20
      const existing = usageBins.get(bin) || { total: 0, scoreSum: 0 };
      existing.total++;
      existing.scoreSum += avgScore;
      usageBins.set(bin, existing);
    }

    const usageVsScore = [...usageBins.entries()]
      .map(([count, { total, scoreSum }]) => ({ aiUsageCount: count, avgScore: Math.round(scoreSum / total), studentCount: total }))
      .sort((a, b) => a.aiUsageCount - b.aiUsageCount);

    // Non-AI users vs AI users comparison
    const aiUserScores: number[] = [];
    const nonAiUserScores: number[] = [];
    for (const userId of studentIds) {
      const scores = [...(bestScoresByStudent.get(userId)?.values() ?? [])];
      if (!scores || scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (aiCountByStudent.has(userId)) {
        aiUserScores.push(avg);
      } else {
        nonAiUserScores.push(avg);
      }
    }

    // 用 null 表示"没有这个群体的数据"，不能当 0 分处理——否则 0 个 AI
    // 用户时会被当成"AI 用户均分 0%"，和"未使用 AI 均分"一减，冒出一个
    // "AI 辅学提升幅度 -80%"这种没有任何 AI 用户支撑的假结论。
    const avgAiUserScore = aiUserScores.length > 0 ? Math.round(aiUserScores.reduce((a, b) => a + b, 0) / aiUserScores.length) : null;
    const avgNonAiUserScore = nonAiUserScores.length > 0 ? Math.round(nonAiUserScores.reduce((a, b) => a + b, 0) / nonAiUserScores.length) : null;

    // Weekly AI usage trend (last 8 weeks)
    const weeklyUsage: { week: string; aiEvents: number; activeUsers: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(asOf.getTime() - i * 7 * 24 * 3600 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
      const weekEvents = aiEvents.filter((e) => e.createdAt >= weekStart && e.createdAt < weekEnd);
      weeklyUsage.push({
        week: weekStart.toISOString().slice(0, 10),
        aiEvents: weekEvents.length,
        activeUsers: new Set(weekEvents.map((e) => e.userId)).size,
      });
    }

    // Students with AI usage records and at least two quiz attempts.
    // This ordering is descriptive only and must not be interpreted as AI-caused improvement.
    const aiImpactStudents: { name: string; aiCount: number; firstScore: number; latestScore: number; gain: number }[] = [];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(students.map((s) => [s.id, s.name]));

    for (const [userId, aiCount] of aiCountByStudent) {
      const scores = attemptScoresByStudent.get(userId);
      if (!scores || scores.length < 2) continue;
      const first = scores[0];
      const latest = scores[scores.length - 1];
      const gain = latest - first;
      aiImpactStudents.push({
        name: nameMap.get(userId) || userId,
        aiCount,
        firstScore: Math.round(first),
        latestScore: Math.round(latest),
        gain: Math.round(gain),
      });
    }
    aiImpactStudents.sort((a, b) => b.gain - a.gain);

    return NextResponse.json({
      dataProvenance,
      scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN',
      scope: {
        ...scopeBase,
        metricSamples: {
          quizStudents: bestScoresByStudent.size,
          aiUsageStudents: aiCountByStudent.size,
          rankedStudents: aiImpactStudents.length,
        },
      },
      interpretation: 'CORRELATION_ONLY',
      summary: {
        totalAiUsers,
        totalAiEvents,
        avgAiPerUser,
        avgAiUserScore,
        avgNonAiUserScore,
        aiUsageRate: studentIds.length > 0 ? Math.round((totalAiUsers / studentIds.length) * 100) : 0,
        scoreDifference: avgAiUserScore !== null && avgNonAiUserScore !== null ? avgAiUserScore - avgNonAiUserScore : null,
      },
      usageVsScore,
      weeklyUsage,
      topAiStudents: aiImpactStudents.slice(0, 10),
    });
  } catch (error) {
    console.error('ai-usage API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
