import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeLearningEventInput } from '@/lib/classroom';

// New class codes are eight characters, while the shipped demo classes use
// seven-character legacy codes (for example EDU2401). Keep those existing
// classes joinable without weakening the character whitelist.
const CLASS_INVITE_CODE_PATTERN = /^[A-Z0-9]{7,8}$/;

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

    if (payload.role !== 'STUDENT') {
      return NextResponse.json({ error: '只有学生账号可以加入班级' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
    const inviteCode = typeof body.classInviteCode === 'string'
      ? body.classInviteCode.trim().toUpperCase()
      : '';
    if (!inviteCode) {
      return NextResponse.json({ error: '班级邀请码不能为空' }, { status: 400 });
    }
    if (!CLASS_INVITE_CODE_PATTERN.test(inviteCode)) {
      return NextResponse.json({ error: '班级邀请码格式无效' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const classGroup = await tx.classGroup.findUnique({
        where: { inviteCode },
        select: {
          id: true,
          name: true,
          courseName: true,
          semester: true,
          status: true,
        },
      });

      if (!classGroup || classGroup.status !== 'ACTIVE') {
        throw new Error('班级邀请码无效或已停用');
      }

      const enrollment = await tx.classEnrollment.upsert({
        where: { classId_userId: { classId: classGroup.id, userId: payload.userId } },
        update: { role: 'STUDENT', status: 'ACTIVE' },
        create: { classId: classGroup.id, userId: payload.userId, role: 'STUDENT', status: 'ACTIVE' },
      });

      await tx.user.update({
        where: { id: payload.userId },
        data: { class: classGroup.name },
      });

      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'JOIN_CLASS',
          details: JSON.stringify({ classId: classGroup.id, className: classGroup.name }),
        },
      });

      const event = normalizeLearningEventInput({
        eventType: 'JOIN_CLASS',
        targetType: 'CLASS',
        targetId: classGroup.id,
        metadata: { source: 'classes-join-api', classId: classGroup.id },
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

      return { enrollment, classGroup };
    });

    return NextResponse.json({
      success: true,
      classEnrollment: {
        ...result.enrollment,
        classGroup: result.classGroup,
      },
    });
  } catch (error) {
    console.error('加入班级失败:', error);
    if (error instanceof Error && error.message === '班级邀请码无效或已停用') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: '加入班级失败，请稍后重试' }, { status: 500 });
  }
}
