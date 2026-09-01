import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const indicatorPointId = searchParams.get('indicatorPointId');

    if (!classId || !indicatorPointId) {
      return NextResponse.json({ error: '请指定 classId 和 indicatorPointId' }, { status: 400 });
    }

    if (payload.role !== 'ADMIN') {
      const accessible = await getAccessibleClassIds(payload);
      if (!accessible.includes(classId)) {
        return NextResponse.json({ error: '无权查看该班级' }, { status: 403 });
      }
    }

    const achievements = await prisma.graduationRequirementAchievement.groupBy({
      by: ['semester'],
      where: { classId, indicatorPointId },
      _avg: { achievementDegree: true },
      _count: { passed: true },
    });

    const passedCounts = await prisma.graduationRequirementAchievement.groupBy({
      by: ['semester'],
      where: { classId, indicatorPointId, passed: true },
      _count: { passed: true },
    });

    const trend = achievements.map((a) => {
      const passed = passedCounts.find((p) => p.semester === a.semester);
      return {
        semester: a.semester,
        averageAchievement: Math.round((a._avg.achievementDegree ?? 0) * 10000) / 10000,
        passRate: a._count.passed > 0 ? Math.round(((passed?._count.passed ?? 0) / a._count.passed) * 10000) / 100 : 0,
        studentCount: a._count.passed,
      };
    }).sort((a, b) => (a.semester ?? '').localeCompare(b.semester ?? ''));

    return NextResponse.json({ trend });
  } catch (error) {
    console.error('GET /api/obe/cqi/trend error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
