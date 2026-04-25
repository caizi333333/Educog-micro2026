import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageTeachingData, generateUniqueInviteCode, normalizeLearningEventInput } from '@/lib/classroom';

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

    if (!canManageTeachingData(payload)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const where = payload.role === 'ADMIN'
      ? { status }
      : {
        status,
        OR: [
          { teacherId: payload.userId },
          { enrollments: { some: { userId: payload.userId, role: 'TEACHER', status: 'ACTIVE' } } },
        ],
      };

    const classes = await prisma.classGroup.findMany({
      where,
      include: {
        teacher: { select: { id: true, name: true, username: true, teacherId: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, classes });
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

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }

    const teacherId = payload.role === 'TEACHER'
      ? payload.userId
      : (typeof body.teacherId === 'string' && body.teacherId.trim() ? body.teacherId.trim() : null);

    const result = await prisma.$transaction(async (tx: any) => {
      const inviteCode = await generateUniqueInviteCode(tx);
      const classGroup = await tx.classGroup.create({
        data: {
          name,
          inviteCode,
          courseName: typeof body.courseName === 'string' && body.courseName.trim() ? body.courseName.trim() : '8051单片机原理与应用',
          semester: typeof body.semester === 'string' && body.semester.trim() ? body.semester.trim() : null,
          teacherId,
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
          details: JSON.stringify({ classId: classGroup.id, name: classGroup.name }),
        },
      });

      const event = normalizeLearningEventInput({
        eventType: 'CREATE_CLASS',
        targetType: 'CLASS',
        targetId: classGroup.id,
        metadata: { source: 'classes-api', classId: classGroup.id },
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

    return NextResponse.json({ success: true, class: result }, { status: 201 });
  } catch (error) {
    console.error('创建班级失败:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '创建班级失败' }, { status: 500 });
  }
}
