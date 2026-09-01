import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getStudentAchievementView } from '@/lib/achievement-evaluation';
import { isValidOBESemester } from '@/lib/obe-data';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);

    const { searchParams } = new URL(request.url);
    const requestedSemester = searchParams.get('semester');
    const requestedClassId = searchParams.get('classId')?.trim() || null;
    if (requestedSemester && !isValidOBESemester(requestedSemester)) {
      return json({ error: '学期格式应为“起始年-结束年-1或2”' }, 400);
    }
    if (requestedClassId && !ID_PATTERN.test(requestedClassId)) {
      return json({ error: '班级编号格式无效' }, 400);
    }
    const view = await getStudentAchievementView(payload.userId, requestedSemester, requestedClassId);
    return json({ breakdown: view.breakdown, dataStatus: view.dataStatus });
  } catch (error) {
    console.error('GET /api/obe/student/objective-breakdown error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
