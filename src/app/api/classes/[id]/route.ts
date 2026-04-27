// Single class detail (with roster) + rename. TEACHER must own the class
// (or have TEACHER enrollment in it); ADMIN can access any.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canManageTeachingData, getAccessibleClassIds } from '@/lib/classroom';

async function authorize(request: NextRequest, classId: string) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false as const, status: 401, error: '未授权' };
  }
  const payload = await verifyToken(authorization.substring(7));
  if (!payload) return { ok: false as const, status: 401, error: '令牌无效' };
  if (!canManageTeachingData(payload)) return { ok: false as const, status: 403, error: '权限不足' };
  if (payload.role !== 'ADMIN') {
    const accessible = await getAccessibleClassIds(payload);
    if (!accessible.includes(classId)) {
      return { ok: false as const, status: 403, error: '无权访问该班级' };
    }
  }
  return { ok: true as const, payload };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authorize(request, id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const classGroup = await prisma.classGroup.findUnique({
      where: { id },
      include: {
        teacher: { select: { id: true, name: true, username: true, teacherId: true } },
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                studentId: true,
                role: true,
                lastLoginAt: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!classGroup) return NextResponse.json({ error: '班级不存在' }, { status: 404 });

    return NextResponse.json({ success: true, class: classGroup });
  } catch (err) {
    console.error('class detail GET error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authorize(request, id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const data: { name?: string; courseName?: string | null; semester?: string | null; status?: string } = {};
    if (typeof body.name === 'string') {
      const trimmed = body.name.trim();
      if (!trimmed) return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
      data.name = trimmed;
    }
    if (body.courseName !== undefined) data.courseName = typeof body.courseName === 'string' && body.courseName.trim() ? body.courseName.trim() : null;
    if (body.semester !== undefined) data.semester = typeof body.semester === 'string' && body.semester.trim() ? body.semester.trim() : null;
    if (typeof body.status === 'string' && ['ACTIVE', 'ARCHIVED'].includes(body.status)) data.status = body.status;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: '没有需要更新的字段' }, { status: 400 });
    }

    const updated = await prisma.classGroup.update({ where: { id }, data });
    return NextResponse.json({ success: true, class: updated });
  } catch (err) {
    console.error('class detail PATCH error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
