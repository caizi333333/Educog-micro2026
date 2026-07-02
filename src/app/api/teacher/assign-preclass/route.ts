import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

type TargetScope = 'ALL' | 'CLASS' | 'STUDENTS';

// 按 ClassEnrollment 关系取班级内在读学生（排除 demo 账号）
async function getEnrolledStudentIds(classIds: string[]) {
  if (classIds.length === 0) return [];
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      classId: { in: classIds },
      role: 'STUDENT',
      status: 'ACTIVE',
      user: { role: 'STUDENT', status: 'ACTIVE', username: { not: { startsWith: 'demo_' } } },
    },
    select: { userId: true },
  });
  return [...new Set(enrollments.map((e) => e.userId))];
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const experimentId: string = body.experimentId;
    const scope: TargetScope = body.scope || 'ALL';
    const targetClassId: string | undefined = body.targetClassId || undefined;
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];

    if (!experimentId || typeof experimentId !== 'string') {
      return NextResponse.json({ error: '缺少 experimentId' }, { status: 400 });
    }

    // ALL 只覆盖本教师可管理班级的学生，不再作用于全平台
    const accessibleClassIds = await getAccessibleClassIds(payload);

    let targetIds: string[] = [];
    if (scope === 'ALL') {
      targetIds = await getEnrolledStudentIds(accessibleClassIds);
    } else if (scope === 'CLASS') {
      if (!targetClassId) return NextResponse.json({ error: '缺少班级' }, { status: 400 });
      if (!accessibleClassIds.includes(targetClassId)) {
        return NextResponse.json({ error: '无权操作该班级' }, { status: 403 });
      }
      targetIds = await getEnrolledStudentIds([targetClassId]);
    } else {
      if (!studentIds.length) return NextResponse.json({ error: '缺少学生列表' }, { status: 400 });
      const students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', id: { in: studentIds } },
        select: { id: true },
      });
      targetIds = students.map(s => s.id);
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, assigned: 0, skipped: 0 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 已有记录一律不降级：进行中/已完成保持原状，已布置的幂等跳过
      const existing = await tx.userExperiment.findMany({
        where: { userId: { in: targetIds }, experimentId },
        select: { userId: true, status: true },
      });
      const existingIds = new Set(existing.map(e => e.userId));

      // 仅把未开始的旧记录标记为已布置（不动进度）
      const { count: marked } = await tx.userExperiment.updateMany({
        where: { userId: { in: targetIds }, experimentId, status: 'NOT_STARTED' },
        data: { status: 'ASSIGNED', updatedAt: new Date() },
      });

      // 没有记录的学生新建 ASSIGNED
      const newIds = targetIds.filter(id => !existingIds.has(id));
      if (newIds.length > 0) {
        await tx.userExperiment.createMany({
          data: newIds.map(id => ({ userId: id, experimentId, status: 'ASSIGNED' })),
        });
      }

      return { assigned: newIds.length + marked, skipped: existingIds.size - marked };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Assign preclass error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

