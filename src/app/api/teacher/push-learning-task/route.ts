import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getPointsByLevel } from '@/lib/knowledge-points';

type PathType = 'BASIC' | 'ADVANCED';
type TargetScope = 'ALL' | 'CLASS' | 'STUDENTS';

// Derived from the canonical 10-chapter syllabus in src/lib/knowledge-points.ts
// Chapters 1-3 → module-1 基础, 4-5 → module-2 编程, 6-7 → module-3 内核外设,
// 8-9 → module-4 接口与系统, 10 → module-5 前沿
function moduleIdForChapter(chapter: number): string {
  if (chapter <= 3) return 'module-1';
  if (chapter <= 5) return 'module-2';
  if (chapter <= 7) return 'module-3';
  if (chapter <= 9) return 'module-4';
  return 'module-5';
}

const CHAPTER_SCHEDULE: { chapterId: string; moduleId: string; name: string }[] =
  getPointsByLevel(1)
    .slice()
    .sort((a, b) => a.chapter - b.chapter)
    .map((point) => ({
      chapterId: `ch${point.chapter}`,
      moduleId: moduleIdForChapter(point.chapter),
      name: `第${point.chapter}章 ${point.name}`,
    }));

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
    const moduleCount: number = Math.max(1, Math.min(CHAPTER_SCHEDULE.length, Number(body.moduleCount || 5)));

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
