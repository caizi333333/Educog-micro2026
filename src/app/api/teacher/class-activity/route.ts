import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { prisma } from '@/lib/prisma';
import {
  ACTIVITY_EVENT_TYPES,
  buildClassActivity,
  PRESENCE_SUMMARY_WINDOW_DAYS,
  type ClassActivityEventGroup,
} from '@/lib/learning-presence';

const ROSTER_LIMIT = 200;

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
    const classes = accessibleClassIds.length === 0
      ? []
      : await prisma.classGroup.findMany({
        where: { id: { in: accessibleClassIds }, status: 'ACTIVE' },
        select: { id: true, name: true, courseName: true, semester: true },
        orderBy: { name: 'asc' },
        take: 50,
      });

    const requestedClassId = new URL(request.url).searchParams.get('classId');
    if (!requestedClassId) {
      return NextResponse.json({
        classes,
        windowDays: PRESENCE_SUMMARY_WINDOW_DAYS,
      });
    }
    if (!accessibleClassIds.includes(requestedClassId)) {
      return NextResponse.json({ error: '无权查看该班级' }, { status: 403 });
    }

    const classGroup = classes.find((item) => item.id === requestedClassId) ?? null;
    if (!classGroup) return NextResponse.json({ error: '班级不存在' }, { status: 404 });

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        classId: requestedClassId,
        role: 'STUDENT',
        status: 'ACTIVE',
        user: { role: 'STUDENT', status: 'ACTIVE' },
      },
      select: {
        user: {
          select: { id: true, name: true, username: true, studentId: true, lastLoginAt: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
      take: ROSTER_LIMIT,
    });

    const seen = new Set<string>();
    const roster = enrollments.flatMap((enrollment) => {
      if (seen.has(enrollment.user.id)) return [];
      seen.add(enrollment.user.id);
      return [{
        id: enrollment.user.id,
        name: enrollment.user.name ?? enrollment.user.username,
        username: enrollment.user.username,
        studentId: enrollment.user.studentId,
        lastLoginAt: enrollment.user.lastLoginAt,
      }];
    });

    const since = new Date(Date.now() - PRESENCE_SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const grouped = roster.length === 0
      ? []
      : await prisma.learningEvent.groupBy({
        by: ['userId', 'eventType', 'targetId', 'chapterId'],
        where: {
          classId: requestedClassId,
          userId: { in: roster.map((student) => student.id) },
          createdAt: { gte: since },
          eventType: { in: [...ACTIVITY_EVENT_TYPES] },
        },
        _max: { createdAt: true },
        _sum: { duration: true },
        _count: { _all: true },
      });

    const groups: ClassActivityEventGroup[] = grouped.map((row) => ({
      userId: row.userId,
      eventType: row.eventType,
      targetId: row.targetId,
      chapterId: row.chapterId,
      lastAt: row._max.createdAt,
      durationSeconds: row._sum.duration ?? 0,
      count: row._count._all,
    }));
    const summary = buildClassActivity(roster, groups);

    return NextResponse.json({
      classes,
      class: classGroup,
      windowDays: PRESENCE_SUMMARY_WINDOW_DAYS,
      asOf: new Date().toISOString(),
      rosterCount: roster.length,
      studiedCount: summary.studied,
      notStudiedCount: summary.notStudied,
      students: summary.students,
    });
  } catch (error) {
    console.error('读取班级学情失败:', error);
    return NextResponse.json({ error: '读取班级学情失败' }, { status: 500 });
  }
}
