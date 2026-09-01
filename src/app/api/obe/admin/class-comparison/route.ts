import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getClassAchievementStats } from '@/lib/achievement-evaluation';
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
      where: { status: 'ACTIVE', semester },
      select: { id: true, name: true },
    });
    const classIds = classes.map((cls) => cls.id);
    const uniqueStudents = classIds.length > 0
      ? await prisma.classEnrollment.findMany({
        where: {
          classId: { in: classIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      : [];

    const comparisons = [];
    const failedClasses: Array<{ classId: string; className: string; reason: string }> = [];
    for (const cls of classes) {
      try {
        const stats = await getClassAchievementStats(cls.id, semester);
        const coArr = stats.averageAchievementByCO;
        const ipArr = stats.averageAchievementByIP;
        comparisons.push({
          classId: stats.classId,
          className: stats.className,
          studentCount: stats.studentCount,
          hasCORecords: coArr.length > 0,
          hasIPRecords: ipArr.length > 0,
          avgCOAchievement: coArr.length > 0 ? coArr.reduce((s, c) => s + c.avg, 0) / coArr.length : 0,
          avgIPAchievement: ipArr.length > 0 ? ipArr.reduce((s, i) => s + i.avg, 0) / ipArr.length : 0,
          coPassRate: coArr.length > 0 ? coArr.reduce((s, c) => s + c.passRate, 0) / coArr.length : 0,
          ipPassRate: ipArr.length > 0 ? ipArr.reduce((s, i) => s + i.passRate, 0) / ipArr.length : 0,
        });
      } catch (error) {
        console.error('Failed to aggregate OBE class comparison:', { classId: cls.id, error });
        failedClasses.push({
          classId: cls.id,
          className: cls.name,
          reason: '该班级达成度读取失败，请重试',
        });
      }
    }

    return json({
      dataProvenance: getDataProvenance(),
      semester,
      totalClasses: classes.length,
      totalStudents: uniqueStudents.length,
      classes: comparisons,
      failedClasses,
      partial: failedClasses.length > 0,
    });
  } catch (error) {
    console.error('GET /api/obe/admin/class-comparison error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
