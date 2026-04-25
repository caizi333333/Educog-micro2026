import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

type PathType = 'BASIC' | 'ADVANCED';
type TargetScope = 'ALL' | 'CLASS' | 'STUDENTS';

const CHAPTER_SCHEDULE: { chapterId: string; moduleId: string; name: string }[] = [
  { chapterId: 'ch1', moduleId: 'module-1', name: '第1章 单片机概述' },
  { chapterId: 'ch2', moduleId: 'module-1', name: '第2章 89C51硬件结构' },
  { chapterId: 'ch3', moduleId: 'module-1', name: '第3章 I/O端口' },
  { chapterId: 'ch4', moduleId: 'module-2', name: '第4章 指令系统与寻址' },
  { chapterId: 'ch5', moduleId: 'module-2', name: '第5章 C51程序设计' },
  { chapterId: 'ch6', moduleId: 'module-3', name: '第6章 中断系统' },
  { chapterId: 'ch7', moduleId: 'module-3', name: '第7章 定时器/计数器' },
  { chapterId: 'ch8', moduleId: 'module-4', name: '第8章 串行通信' },
  { chapterId: 'ch9', moduleId: 'module-4', name: '第9章 系统扩展与接口' },
];

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
    const scope: TargetScope = body.scope || 'ALL';
    const targetClass: string | undefined = body.targetClass || undefined;
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];
    const pathType: PathType = body.pathType || 'BASIC';
    const moduleCount: number = Math.max(1, Math.min(9, Number(body.moduleCount || 5)));

    let students = [];
    if (scope === 'ALL') {
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE' },
        select: { id: true, name: true, class: true, studentId: true },
      });
    } else if (scope === 'CLASS') {
      if (!targetClass) return NextResponse.json({ error: '缺少班级' }, { status: 400 });
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', class: targetClass },
        select: { id: true, name: true, class: true, studentId: true },
      });
    } else {
      if (!studentIds.length) return NextResponse.json({ error: '缺少学生列表' }, { status: 400 });
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', id: { in: studentIds } },
        select: { id: true, name: true, class: true, studentId: true },
      });
    }

    const modules = CHAPTER_SCHEDULE.slice(0, moduleCount).map((c) => ({
      moduleId: c.moduleId,
      chapterId: c.chapterId,
      name: c.name,
    }));

    const name = pathType === 'ADVANCED' ? '进阶学习任务' : '基础强化任务';
    const description =
      pathType === 'ADVANCED'
        ? '面向能力较强的学生，侧重综合应用与项目实践（由教师统一推送）'
        : '面向基础薄弱的学生，强化核心概念理解与基础实验（由教师统一推送）';

    let created = 0;
    // 为每个学生创建一条新的 ACTIVE 路径，并将原 ACTIVE 置为 PAUSED（若存在）
    for (const s of students) {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.learningPath.findFirst({
          where: { userId: s.id, status: 'ACTIVE' },
          select: { id: true },
        });
        if (existing) {
          await tx.learningPath.update({
            where: { id: existing.id },
            data: { status: 'PAUSED' },
          });
        }

        await tx.learningPath.create({
          data: {
            userId: s.id,
            name,
            description,
            modules: JSON.stringify(modules),
            currentModule: 0,
            totalModules: modules.length,
            status: 'ACTIVE',
          },
        });

        await tx.userActivity.create({
          data: {
            userId: s.id,
            action: 'TEACHER_PUSH_LEARNING_TASK',
            details: JSON.stringify({
              pushedBy: payload.userId,
              pathName: name,
              moduleCount: modules.length,
            }),
          },
        });
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      targetScope: scope,
      targetClass: targetClass || null,
    });
  } catch (error) {
    console.error('Push learning task error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
