import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function shanghaiDateKey(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

function calculateStreak(completedAt: Array<Date | null>): number {
  const dates = [...new Set(completedAt
    .filter((value): value is Date => value instanceof Date)
    .map(shanghaiDateKey))]
    .sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return 0;

  const today = shanghaiDateKey(new Date());
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  if (dates[0] !== today && dates[0] !== yesterday) return 0;

  let streak = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const current = dates[index - 1];
    const previous = dates[index];
    if (!current || !previous) continue;
    const days = Math.round(
      (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`))
      / 86_400_000,
    );
    if (days !== 1) break;
    streak += 1;
  }
  return streak;
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
    const [modulesCompleted, learningAggregate, quizAggregate, recentCompletions] = await Promise.all([
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
        where: { userId, completedAt: { not: null } },
        select: { completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 366,
      }),
    ]);

    const learningRecords = typeof learningAggregate._count === 'number'
      ? learningAggregate._count
      : 0;
    const quizAttempts = typeof quizAggregate._count === 'number'
      ? quizAggregate._count
      : 0;

    return json({
      source: 'SERVER_DERIVED',
      modulesCompleted,
      totalTimeSpent: learningAggregate._sum.timeSpent ?? 0,
      averageScore: quizAggregate._avg.score == null
        ? null
        : Math.round(quizAggregate._avg.score * 100) / 100,
      streakDays: calculateStreak(recentCompletions.map((item) => item.completedAt)),
      lastActiveDate: learningAggregate._max.completedAt ?? null,
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
