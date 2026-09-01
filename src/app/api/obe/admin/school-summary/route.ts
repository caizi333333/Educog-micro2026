import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getDataProvenance } from '@/lib/env';
import { isValidOBESemester } from '@/lib/obe-data';

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return json({ error: '令牌无效' }, 401);
    }
    if (payload.role !== 'ADMIN') {
      return json({ error: '仅管理员可访问' }, 403);
    }

    const { searchParams } = new URL(request.url);
    const semester = searchParams.get('semester')?.trim() ?? '';
    if (!isValidOBESemester(semester)) {
      return json({ error: '请选择有效学期（起始年-结束年-1或2）' }, 400);
    }

    const classes = await prisma.classGroup.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, semester: true },
    });
    const selectedClasses = classes.filter((cls) => cls.semester === semester);
    const selectedClassIds = selectedClasses.map((cls) => cls.id);
    const availableSemesters = [...new Set(classes
      .map((cls) => cls.semester)
      .filter((value): value is string => isValidOBESemester(value)))]
      .sort()
      .reverse();
    const uniqueStudents = selectedClassIds.length > 0
      ? await prisma.classEnrollment.findMany({
        where: {
          classId: { in: selectedClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      : [];

    const grAchievements = await prisma.graduationRequirementAchievement.findMany({
      where: {
        semester,
        classId: { in: selectedClassIds },
      },
      include: { indicatorPoint: { include: { graduationRequirement: true } } },
    });

    // Aggregate by graduation requirement
    const byGR = new Map<string, { code: string; name: string; total: number; passed: number; sumAch: number }>();
    for (const a of grAchievements) {
      const grCode = a.indicatorPoint.graduationRequirement.code;
      const grName = a.indicatorPoint.graduationRequirement.name;
      const existing = byGR.get(grCode) || { code: grCode, name: grName, total: 0, passed: 0, sumAch: 0 };
      existing.total++;
      if (a.passed) existing.passed++;
      existing.sumAch += a.achievementDegree;
      byGR.set(grCode, existing);
    }

    const passRateByGR = [...byGR.values()].map((v) => ({
      grCode: v.code,
      grName: v.name,
      passRate: v.total > 0 ? Math.round((v.passed / v.total) * 10000) / 100 : 0,
      avgAchievement: v.total > 0 ? Math.round((v.sumAch / v.total) * 10000) / 10000 : 0,
    }));

    const overallAvg = grAchievements.length > 0
      ? grAchievements.reduce((s, a) => s + a.achievementDegree, 0) / grAchievements.length
      : 0;

    return json({
      dataProvenance: getDataProvenance(),
      semester,
      availableSemesters,
      totalClasses: selectedClasses.length,
      totalStudents: uniqueStudents.length,
      averageAchievement: Math.round(overallAvg * 10000) / 10000,
      passRateByGR,
    });
  } catch (error) {
    console.error('GET /api/obe/admin/school-summary error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
