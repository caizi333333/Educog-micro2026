// Remove a student enrollment (soft = set status to 'REMOVED'). TEACHER must
// own the class; ADMIN can remove from any.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canManageTeachingData, getAccessibleClassIds } from '@/lib/classroom';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const { id: classId, userId } = await params;
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

    const enrollment = await prisma.classEnrollment.findUnique({
      where: { classId_userId: { classId, userId } },
    });
    if (!enrollment) {
      return NextResponse.json({ error: '该学生未在此班级' }, { status: 404 });
    }
    if (enrollment.role === 'TEACHER') {
      return NextResponse.json({ error: '不能从班级中移除教师角色，请先变更角色' }, { status: 400 });
    }

    await prisma.classEnrollment.update({
      where: { classId_userId: { classId, userId } },
      data: { status: 'REMOVED' },
    });

    return NextResponse.json({ success: true, removed: { classId, userId } });
  } catch (err) {
    console.error('class enrollment DELETE error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
