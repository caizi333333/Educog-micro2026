import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

type TargetScope = 'ALL' | 'CLASS' | 'STUDENTS';

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
    const targetClass: string | undefined = body.targetClass || undefined;
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];

    if (!experimentId || typeof experimentId !== 'string') {
      return NextResponse.json({ error: '缺少 experimentId' }, { status: 400 });
    }

    let students: { id: string }[] = [];
    if (scope === 'ALL') {
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE' },
        select: { id: true },
      });
    } else if (scope === 'CLASS') {
      if (!targetClass) return NextResponse.json({ error: '缺少班级' }, { status: 400 });
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', class: targetClass },
        select: { id: true },
      });
    } else {
      if (!studentIds.length) return NextResponse.json({ error: '缺少学生列表' }, { status: 400 });
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', id: { in: studentIds } },
        select: { id: true },
      });
    }

    let assigned = 0;
    for (const s of students) {
      await prisma.userExperiment.upsert({
        where: {
          userId_experimentId: {
            userId: s.id,
            experimentId,
          },
        },
        update: {
          status: 'ASSIGNED',
          updatedAt: new Date(),
        },
        create: {
          userId: s.id,
          experimentId,
          status: 'ASSIGNED',
        },
      });
      assigned++;
    }

    return NextResponse.json({ success: true, assigned });
  } catch (error) {
    console.error('Assign preclass error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

