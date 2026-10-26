import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { studentHasActiveEnrollment } from '@/lib/classroom';

export const CLASSROOM_FORBIDDEN_MESSAGE = '仅限已加入班级的学生、任课教师或管理员查看课件';

/**
 * Live enrollment check for Node route handlers.
 * Returns a response when access is denied, or null when the caller may continue.
 */
export async function requireClassroomApiAccess(request: Request): Promise<NextResponse | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const payload = await verifyToken(authorization.slice('Bearer '.length).trim());
  if (!payload) {
    return NextResponse.json({ error: '令牌无效' }, { status: 401 });
  }
  if (payload.role === 'ADMIN' || payload.role === 'TEACHER') return null;
  if (payload.role === 'STUDENT' && await studentHasActiveEnrollment(payload.userId)) return null;
  return NextResponse.json({ error: CLASSROOM_FORBIDDEN_MESSAGE }, { status: 403 });
}
