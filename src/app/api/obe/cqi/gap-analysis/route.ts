import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getGapAnalysis } from '@/lib/achievement-evaluation';
import { prisma } from '@/lib/prisma';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SEMESTER_PATTERN = /^(\d{4})-(\d{4})-([12])$/;

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
    const semester = searchParams.get('semester')?.trim() || null;

    if (!ID_PATTERN.test(classId)) return json({ error: '班级编号格式无效' }, 400);
    if (semester) {
      const match = SEMESTER_PATTERN.exec(semester);
      if (!match || Number(match[2]) !== Number(match[1]) + 1) {
        return json({ error: '学期格式应为“起始年-结束年-1或2”' }, 400);
      }
    }

    if (payload.role !== 'ADMIN') {
      const accessible = await getAccessibleClassIds(payload);
      if (!accessible.includes(classId)) {
        return json({ error: '无权查看该班级' }, 403);
      }
    }

    const classGroup = await prisma.classGroup.findUnique({
      where: { id: classId },
      select: { status: true },
    });
    if (!classGroup || classGroup.status !== 'ACTIVE') return json({ error: '班级不存在或已归档' }, 404);

    const result = await getGapAnalysis(classId, semester);
    return json(result);
  } catch (error) {
    console.error('GET /api/obe/cqi/gap-analysis error:', error);
    return json({ error: '获取差距分析失败' }, 500);
  }
}
