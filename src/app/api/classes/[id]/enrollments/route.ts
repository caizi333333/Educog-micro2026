// Add a student to a class manually (alternative to invite-code self-join).
// TEACHER must own the class; ADMIN can add to any class.
//
// POST body: { locator?: string; username?: string; studentId?: string; userId?: string }
// locator simultaneously searches username and studentId; old explicit fields remain supported.

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canManageTeachingData, getAccessibleClassIds, normalizeLearningEventInput } from '@/lib/classroom';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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
    if (classGroup?.status !== 'ACTIVE') {
      return NextResponse.json({ error: '班级不存在或已归档' }, { status: 404 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    const body = rawBody as Record<string, unknown>;
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const locator = typeof body.locator === 'string' ? body.locator.trim() : '';
    if (!locator && !username && !studentId && !userId) {
      return NextResponse.json({ error: '请提供 locator / username / studentId / userId 至少一个' }, { status: 400 });
    }
    if (locator.length > 64 || username.length > 64 || studentId.length > 64 || userId.length > 128) {
      return NextResponse.json({ error: '学生标识格式无效' }, { status: 400 });
    }

    const locatorClauses: Array<Record<string, string>> = locator
      ? [{ username: locator }, { studentId: locator }]
      : [];
    const explicitClauses: Array<Record<string, string>> = [];
    if (username) explicitClauses.push({ username });
    if (studentId) explicitClauses.push({ studentId });
    if (userId) explicitClauses.push({ id: userId });
    const selection = { id: true, name: true, username: true, studentId: true, role: true, status: true } as const;
    let user;
    if (locatorClauses.length > 0) {
      const matches = await prisma.user.findMany({ where: { OR: locatorClauses }, select: selection, take: 2 });
      if (matches.length > 1) {
        return NextResponse.json({ error: '该标识同时匹配多个账号，请改用唯一学号或用户名' }, { status: 409 });
      }
      [user] = matches;
    } else {
      user = await prisma.user.findFirst({ where: { AND: explicitClauses }, select: selection });
    }
    if (!user) return NextResponse.json({ error: '未找到该用户' }, { status: 404 });
    if (user.role !== 'STUDENT') {
      return NextResponse.json({ error: `${user.name ?? user.username} 不是学生角色` }, { status: 400 });
    }
    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: '该学生账号未激活，不能加入班级' }, { status: 400 });
    }

    const existingEnrollment = await prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId, userId: user.id } },
    });
    if (existingEnrollment?.role === 'STUDENT' && existingEnrollment.status === 'ACTIVE') {
      return NextResponse.json({ success: true, enrollment: existingEnrollment, user, duplicate: true });
    }

    const enrollment = await prisma.$transaction(async (tx) => {
      const savedEnrollment = await tx.classEnrollment.upsert({
        where: { classId_userId: { classId, userId: user.id } },
        update: { role: 'STUDENT', status: 'ACTIVE' },
        create: { classId, userId: user.id, role: 'STUDENT', status: 'ACTIVE' },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { class: classGroup.name },
      });
      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'ADD_STUDENT_TO_CLASS',
          details: JSON.stringify({ classId, studentUserId: user.id }),
        },
      });
      const event = normalizeLearningEventInput({
        eventType: 'JOIN_CLASS',
        targetType: 'CLASS',
        targetId: classId,
        metadata: { source: 'teacher-enrollment-api', classId },
      }, classId);
      if (event) {
        await tx.learningEvent.create({ data: { userId: user.id, classId, ...event } });
      }
      return savedEnrollment;
    });

    return NextResponse.json({ success: true, enrollment, user, duplicate: false });
  } catch (err) {
    console.error('class enrollments POST error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
