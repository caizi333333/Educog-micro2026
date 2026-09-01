import { NextRequest, NextResponse } from 'next/server';
import type { ClassGroup } from '@prisma/client';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageTeachingData, generateUniqueInviteCode, normalizeLearningEventInput } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function publicClassGroup(value: ClassGroup): Omit<ClassGroup, 'creationRequestKey'> {
  const result: Partial<ClassGroup> = { ...value };
  delete result.creationRequestKey;
  return result as Omit<ClassGroup, 'creationRequestKey'>;
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    let where: any;
    if (payload.role === 'ADMIN') {
      where = { status };
    } else if (payload.role === 'TEACHER') {
      where = {
        status,
        OR: [
          { teacherId: payload.userId },
          { enrollments: { some: { userId: payload.userId, role: 'TEACHER', status: 'ACTIVE' } } },
        ],
      };
    } else {
      // STUDENT: show enrolled classes
      where = {
        status,
        enrollments: { some: { userId: payload.userId, status: 'ACTIVE' } },
      };
    }

    const classes = await prisma.classGroup.findMany({
      where,
      select: {
        id: true,
        name: true,
        inviteCode: true,
        courseName: true,
        semester: true,
        teacherId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        teacher: { select: { id: true, name: true, username: true, teacherId: true } },
        // 学生数只计在读学生，不含教师本人和已移除记录
        _count: { select: { enrollments: { where: { role: 'STUDENT', status: 'ACTIVE' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, dataProvenance: getDataProvenance(), classes });
  } catch (error) {
    console.error('获取班级失败:', error);
    return NextResponse.json({ error: '获取班级失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    if (!canManageTeachingData(payload)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }
    if (name.length > 100) {
      return NextResponse.json({ error: '班级名称不能超过100个字符' }, { status: 400 });
    }

    const courseName = typeof body.courseName === 'string' && body.courseName.trim()
      ? body.courseName.trim()
      : '微控制器原理及应用技术';
    const semester = typeof body.semester === 'string' && body.semester.trim()
      ? body.semester.trim()
      : null;
    if (courseName.length > 100 || (semester && semester.length > 50)) {
      return NextResponse.json({ error: '课程名称或学期信息过长' }, { status: 400 });
    }

    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    if (requestId && !/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) {
      return NextResponse.json({ error: '创建请求编号格式无效' }, { status: 400 });
    }

    const teacherId = payload.role === 'TEACHER'
      ? payload.userId
      : (typeof body.teacherId === 'string' && body.teacherId.trim() ? body.teacherId.trim() : null);

    const creationRequestKey = requestId ? `${payload.userId}:${requestId}` : null;
    if (creationRequestKey) {
      const existing = await prisma.classGroup.findUnique({ where: { creationRequestKey } });
      if (existing) {
        return NextResponse.json({ success: true, class: publicClassGroup(existing), duplicate: true });
      }
    }

    let result: ClassGroup;
    try {
      result = await prisma.$transaction(async (tx: any) => {
        const inviteCode = await generateUniqueInviteCode(tx);
        const classGroup = await tx.classGroup.create({
          data: {
            name,
            inviteCode,
            courseName,
            semester,
            teacherId,
            ...(creationRequestKey ? { creationRequestKey } : {}),
            status: 'ACTIVE',
          },
        });

        if (teacherId) {
          await tx.classEnrollment.upsert({
            where: { classId_userId: { classId: classGroup.id, userId: teacherId } },
            update: { role: 'TEACHER', status: 'ACTIVE' },
            create: { classId: classGroup.id, userId: teacherId, role: 'TEACHER', status: 'ACTIVE' },
          });
        }

        await tx.userActivity.create({
          data: {
            userId: payload.userId,
            action: 'CREATE_CLASS',
            details: JSON.stringify({ classId: classGroup.id, name: classGroup.name, requestId: requestId || undefined }),
          },
        });

        const event = normalizeLearningEventInput({
          eventType: 'CREATE_CLASS',
          targetType: 'CLASS',
          targetId: classGroup.id,
          metadata: { source: 'classes-api', classId: classGroup.id, requestId: requestId || undefined },
        }, classGroup.id);

        if (event) {
          await tx.learningEvent.create({
            data: {
              userId: payload.userId,
              classId: classGroup.id,
              ...event,
            },
          });
        }

        return classGroup;
      });
    } catch (error) {
      if (!creationRequestKey || !isUniqueConstraintError(error)) throw error;
      const restored = await prisma.classGroup.findUnique({ where: { creationRequestKey } });
      if (!restored) throw error;
      return NextResponse.json({ success: true, class: publicClassGroup(restored), duplicate: true });
    }

    return NextResponse.json({ success: true, class: publicClassGroup(result), duplicate: false }, { status: 201 });
  } catch (error) {
    console.error('创建班级失败:', error);
    return NextResponse.json({ error: '创建班级失败，请稍后重试' }, { status: 500 });
  }
}
