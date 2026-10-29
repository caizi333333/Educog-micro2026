import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { campusDayBounds } from '@/lib/campus-time';
import { prisma } from '@/lib/prisma';
import { isCurrentTermClass } from '@/lib/current-term';
import { resolveTeachingScope } from '@/lib/teaching-scope';
import {
  buildDailyClassPulse,
  DAILY_PULSE_EVENT_TYPES,
  type DailyPulseEvent,
  type DailyPulseRosterRow,
} from '@/lib/daily-class-pulse';

/**
 * 四个正式班的今日登录与学习。
 * 固定本学期范围，忽略调用方传入的 scope / classId，避免往期班混进这一页。
 */
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

    const requestedAsOf = new URL(request.url).searchParams.get('asOf');
    const asOf = requestedAsOf ? new Date(requestedAsOf) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: '数据截止时间格式无效' }, { status: 400 });
    }
    const day = campusDayBounds(asOf);

    const resolvedScope = await resolveTeachingScope(payload, new URLSearchParams('scope=current'));
    if (!resolvedScope.ok) {
      return NextResponse.json({ error: resolvedScope.error }, { status: resolvedScope.status });
    }
    const classes = resolvedScope.value.classes.filter((classGroup) => isCurrentTermClass(classGroup));
    const classIds = classes.map((classGroup) => classGroup.id);

    const loadedEnrollments = classIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: {
          classId: { in: classIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: {
          classId: true,
          user: {
            select: { id: true, name: true, username: true, studentId: true, lastLoginAt: true },
          },
        },
      });

    const roster: DailyPulseRosterRow[] = loadedEnrollments.map((enrollment) => ({
      classId: enrollment.classId,
      userId: enrollment.user.id,
      name: enrollment.user.name,
      username: enrollment.user.username,
      studentId: enrollment.user.studentId,
      lastLoginAt: enrollment.user.lastLoginAt,
    }));
    const userIds = [...new Set(roster.map((student) => student.userId))];
    const grouped = userIds.length === 0
      ? []
      : await prisma.learningEvent.groupBy({
        by: ['userId', 'classId', 'eventType'],
        where: {
          classId: { in: classIds },
          userId: { in: userIds },
          createdAt: { gte: day.start, lte: asOf },
          eventType: { in: [...DAILY_PULSE_EVENT_TYPES] },
        },
        _max: { createdAt: true },
        _sum: { duration: true },
      });

    const events: DailyPulseEvent[] = grouped.map((row) => ({
      classId: row.classId,
      userId: row.userId,
      eventType: row.eventType,
      lastAt: row._max.createdAt,
      durationSeconds: row._sum.duration ?? 0,
    }));

    return NextResponse.json(buildDailyClassPulse({
      asOf,
      viewerSeesAllClasses: payload.role === 'ADMIN',
      classes,
      roster,
      events,
    }));
  } catch (error) {
    console.error('读取今日动态失败:', error);
    return NextResponse.json({ error: '读取今日动态失败' }, { status: 500 });
  }
}
