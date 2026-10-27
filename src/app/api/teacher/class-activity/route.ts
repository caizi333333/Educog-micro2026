import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { filterClassesByTeachingScope, filterTeachingRoster, parseTeachingScope, shouldCapSmokeTests } from '@/lib/current-term';
import { resolveTeachingScope } from '@/lib/teaching-scope';
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

    const searchParams = new URL(request.url).searchParams;
    const resolvedScope = await resolveTeachingScope(payload, searchParams);
    if (!resolvedScope.ok) {
      return NextResponse.json({ error: resolvedScope.error }, { status: resolvedScope.status });
    }
    const teachingScope = parseTeachingScope(searchParams.get('scope'));
    const requestedClassId = resolvedScope.value.explicitClassId;
    const scopedClasses = filterClassesByTeachingScope(resolvedScope.value.accessibleClasses, teachingScope);

    if (!requestedClassId) {
      return NextResponse.json({
        classes: scopedClasses,
        scope: teachingScope,
        windowDays: PRESENCE_SUMMARY_WINDOW_DAYS,
      });
    }

    const classGroup = resolvedScope.value.classes[0]
      ?? resolvedScope.value.accessibleClasses.find((item) => item.id === requestedClassId)
      ?? null;
    if (!classGroup) return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    const classes = scopedClasses.some((item) => item.id === classGroup.id)
      ? scopedClasses
      : [classGroup, ...scopedClasses];

    const loadedEnrollments = await prisma.classEnrollment.findMany({
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
    const enrollments = filterTeachingRoster(
      loadedEnrollments,
      (enrollment) => ({
        userId: enrollment.user.id,
        classId: requestedClassId,
        username: enrollment.user.username,
      }),
      shouldCapSmokeTests([classGroup]),
    ).rows;

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

    const asOf = new Date(Date.now());
    const since = new Date(asOf.getTime() - PRESENCE_SUMMARY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const grouped = roster.length === 0
      ? []
      : await prisma.learningEvent.groupBy({
        by: ['userId', 'eventType', 'targetId', 'chapterId'],
        where: {
          classId: requestedClassId,
          userId: { in: roster.map((student) => student.id) },
          createdAt: { gte: since, lte: asOf },
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
    const summary = buildClassActivity(roster, groups, { since, asOf });

    return NextResponse.json({
      classes,
      class: classGroup,
      windowDays: PRESENCE_SUMMARY_WINDOW_DAYS,
      asOf: asOf.toISOString(),
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
