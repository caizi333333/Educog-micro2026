import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { CAMPUS_TIME_ZONE } from '@/lib/campus-time';
import { STUDY_STREAK_SOURCE, summarizeStudyActivity } from '@/lib/study-activity';
import { applyDailyLoginLedger, describeStudyPoints } from '@/lib/study-points';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }

    const payload = await verifyToken(authorization.substring(7));
    if (!payload?.userId) return json({ error: '令牌无效' }, 401);

    const userId = payload.userId;
    const [modulesCompleted, learningAggregate, quizAggregate, recentAccess] = await Promise.all([
      prisma.learningProgress.count({
        where: {
          userId,
          OR: [{ status: 'COMPLETED' }, { progress: { gte: 100 } }],
        },
      }),
      prisma.learningProgress.aggregate({
        where: { userId },
        _sum: { timeSpent: true },
        _max: { completedAt: true },
        _count: true,
      }),
      prisma.quizAttempt.aggregate({
        where: { userId },
        _avg: { score: true },
        _count: true,
      }),
      prisma.learningProgress.findMany({
        where: { userId },
        select: { lastAccessAt: true },
        orderBy: { lastAccessAt: 'desc' },
        take: 366,
      }),
    ]);

    const learningRecords = typeof learningAggregate._count === 'number'
      ? learningAggregate._count
      : 0;
    const quizAttempts = typeof quizAggregate._count === 'number'
      ? quizAggregate._count
      : 0;
    const totalTimeSpent = learningAggregate._sum.timeSpent ?? 0;
    const study = summarizeStudyActivity(recentAccess.map((item) => item.lastAccessAt));

    return json({
      source: 'SERVER_DERIVED',
      modulesCompleted,
      totalTimeSpent,
      averageScore: quizAggregate._avg.score == null
        ? null
        : Math.round(quizAggregate._avg.score * 100) / 100,
      streakDays: study.streakDays,
      lastActiveDate: study.lastActiveDate?.toISOString() ?? null,
      streakSource: STUDY_STREAK_SOURCE,
      streakTimeZone: CAMPUS_TIME_ZONE,
      studyPoints: await applyDailyLoginLedger(describeStudyPoints(totalTimeSpent), userId, new Date()),
      learningRecords,
      quizAttempts,
      dataSufficient: learningRecords > 0 || quizAttempts > 0,
    });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    return json({ error: '获取学习进度失败' }, 500);
  }
}

function readOnlyResponse(): NextResponse {
  const response = json({ error: '学习进度由服务端学习事件生成，不支持客户端修改' }, 405);
  response.headers.set('Allow', 'GET');
  return response;
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  return readOnlyResponse();
}

export async function PUT(_request: NextRequest): Promise<NextResponse> {
  return readOnlyResponse();
}
