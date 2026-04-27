// Add a student to a class manually (alternative to invite-code self-join).
// TEACHER must own the class; ADMIN can add to any class.
//
// POST body: { username?: string; studentId?: string; userId?: string }
// At least one of the three locator fields is required.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canManageTeachingData, getAccessibleClassIds } from '@/lib/classroom';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: classId } = await params;
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (!canManageTeachingData(payload)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    if (payload.role !== 'ADMIN') {
      const accessible = await getAccessibleClassIds(payload);
      if (!accessible.includes(classId)) {
        return NextResponse.json({ error: '无权管理该班级' }, { status: 403 });
      }
    }

    const classGroup = await prisma.classGroup.findUnique({ where: { id: classId } });
    if (!classGroup || classGroup.status !== 'ACTIVE') {
      return NextResponse.json({ error: '班级不存在或已归档' }, { status: 404 });
    }

    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    if (!username && !studentId && !userId) {
      return NextResponse.json({ error: '请提供 username / studentId / userId 至少一个' }, { status: 400 });
    }

    const orClauses: Array<Record<string, string>> = [];
    if (username) orClauses.push({ username });
    if (studentId) orClauses.push({ studentId });
    if (userId) orClauses.push({ id: userId });

    const user = await prisma.user.findFirst({
      where: { OR: orClauses },
      select: { id: true, name: true, username: true, studentId: true, role: true },
    });
    if (!user) return NextResponse.json({ error: '未找到该用户' }, { status: 404 });
    if (user.role !== 'STUDENT') {
      return NextResponse.json({ error: `${user.name || user.username} 不是学生角色` }, { status: 400 });
    }

    const enrollment = await prisma.classEnrollment.upsert({
      where: { classId_userId: { classId, userId: user.id } },
      update: { role: 'STUDENT', status: 'ACTIVE' },
      create: { classId, userId: user.id, role: 'STUDENT', status: 'ACTIVE' },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { class: classGroup.name },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, enrollment, user });
  } catch (err) {
    console.error('class enrollments POST error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
