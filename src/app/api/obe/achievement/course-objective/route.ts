import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canAccessStudentData, getAccessibleClassIds } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';
import { buildOBEConfigurationRevision } from '@/lib/obe-data';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return json({ error: '权限不足' }, 403);
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId')?.trim() || '';
    const userId = searchParams.get('userId')?.trim() || '';
    const semester = searchParams.get('semester')?.trim() || '';
    if (classId.length > 128 || userId.length > 128 || semester.length > 64) {
      return json({ error: '查询参数无效' }, 400);
    }

    const accessible = payload.role === 'ADMIN' ? [] : await getAccessibleClassIds(payload);
    if (classId && payload.role !== 'ADMIN') {
      if (!accessible.includes(classId)) {
        return json({ error: '无权查看该班级' }, 403);
      }
    }
    if (userId && !(await canAccessStudentData(payload, userId))) {
      return json({ error: '无权查看该学生数据' }, 403);
    }

    const where: Prisma.CourseObjectiveAchievementWhereInput = {};
    if (classId) where.classId = classId;
    if (userId) where.userId = userId;
    if (semester) where.semester = semester;
    if (payload.role !== 'ADMIN' && !classId && !userId) {
      where.classId = { in: accessible };
    }

    const activeObjectives = await prisma.courseObjective.findMany({
      where: { isActive: true },
      select: {
        id: true,
        version: true,
        updatedAt: true,
        indicatorPointId: true,
        indicatorPoint: {
          select: {
            id: true,
            updatedAt: true,
            achievementThreshold: true,
          },
        },
        assessmentLinks: { select: { updatedAt: true } },
      },
      orderBy: { code: 'asc' },
    });
    const configurationTimes = activeObjectives.flatMap((objective) => [
      objective.updatedAt,
      ...(objective.indicatorPoint ? [objective.indicatorPoint.updatedAt] : []),
      ...objective.assessmentLinks.map((link) => link.updatedAt),
    ]);
    const configurationUpdatedAt = configurationTimes.length > 0
      ? new Date(Math.max(...configurationTimes.map((value) => value.getTime())))
      : null;
    const activeObjectiveIds = activeObjectives.map((objective) => objective.id);
    const currentWhere: Prisma.CourseObjectiveAchievementWhereInput = {
      ...where,
      courseObjectiveId: { in: activeObjectiveIds },
      ...(configurationUpdatedAt ? { calculatedAt: { gte: configurationUpdatedAt } } : {}),
    };

    const achievements = await prisma.courseObjectiveAchievement.findMany({
      where: currentWhere,
      include: { courseObjective: true },
      orderBy: { achievementDegree: 'desc' },
    });

    const targetCount = userId
      ? 1
      : classId
        ? await prisma.classEnrollment.count({
          where: {
            classId,
            role: 'STUDENT',
            status: 'ACTIVE',
            user: { role: 'STUDENT', status: 'ACTIVE' },
          },
        })
        : null;
    const staleRecords = configurationUpdatedAt && activeObjectiveIds.length > 0
      ? await prisma.courseObjectiveAchievement.count({
        where: {
          ...where,
          courseObjectiveId: { in: activeObjectiveIds },
          calculatedAt: { lt: configurationUpdatedAt },
        },
      })
      : 0;
    const expectedRecords = targetCount === null || !semester
      ? null
      : targetCount * activeObjectives.length;
    const freshRecords = achievements.length;
    const missingRecords = expectedRecords === null ? null : Math.max(0, expectedRecords - freshRecords);
    const lastCalculatedAt = achievements.reduce<Date | null>((latest, record) => (
      !latest || record.calculatedAt > latest ? record.calculatedAt : latest
    ), null);

    return json({
      dataProvenance: getDataProvenance(),
      achievements,
      dataStatus: {
        configurationRevision: buildOBEConfigurationRevision(activeObjectives),
        configurationUpdatedAt: configurationUpdatedAt?.toISOString() ?? null,
        targetCount,
        expectedRecords,
        freshRecords,
        staleRecords,
        missingRecords,
        complete: expectedRecords !== null && expectedRecords > 0 && freshRecords === expectedRecords,
        lastCalculatedAt: lastCalculatedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/obe/achievement/course-objective error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
