import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
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
    const targetClassId: string | undefined = body.targetClassId || undefined;
    const studentIds: string[] = Array.isArray(body.studentIds) ? body.studentIds : [];
    const pathType: PathType = body.pathType || 'BASIC';
    const moduleCount: number = Math.max(1, Math.min(CHAPTER_SCHEDULE.length, Number(body.moduleCount || 5)));

    // ALL 只覆盖本教师可管理班级的学生（按 ClassEnrollment 关系，排除 demo 账号）
    const accessibleClassIds = await getAccessibleClassIds(payload);
    const enrollmentUserFilter = {
      role: 'STUDENT', status: 'ACTIVE', username: { not: { startsWith: 'demo_' } },
    } as const;

    let students: { id: string }[] = [];
    if (scope === 'ALL' || scope === 'CLASS') {
      let classIds = accessibleClassIds;
      if (scope === 'CLASS') {
        if (!targetClassId) return NextResponse.json({ error: '缺少班级' }, { status: 400 });
        if (!accessibleClassIds.includes(targetClassId)) {
          return NextResponse.json({ error: '无权操作该班级' }, { status: 403 });
        }
        classIds = [targetClassId];
      }
      const enrollments = classIds.length === 0
        ? []
        : await prisma.classEnrollment.findMany({
          where: {
            classId: { in: classIds },
            role: 'STUDENT',
            status: 'ACTIVE',
            user: enrollmentUserFilter,
          },
          select: { userId: true },
        });
      students = [...new Set(enrollments.map((e) => e.userId))].map((id) => ({ id }));
    } else {
      if (!studentIds.length) return NextResponse.json({ error: '缺少学生列表' }, { status: 400 });
      students = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', id: { in: studentIds } },
        select: { id: true },
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

    const ids = students.map(s => s.id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, created: 0, targetScope: scope, targetClassId: targetClassId || null });
    }

    const created = await prisma.$transaction(async (tx) => {
      // Pause all existing ACTIVE paths for these students in one call
      await tx.learningPath.updateMany({
        where: { userId: { in: ids }, status: 'ACTIVE' },
        data: { status: 'PAUSED' },
      });

      // Bulk create new learning paths
      const modulesJson = JSON.stringify(modules);
      await tx.learningPath.createMany({
        data: ids.map(userId => ({
          userId,
          name,
          description,
          modules: modulesJson,
          currentModule: 0,
          totalModules: modules.length,
          status: 'ACTIVE',
        })),
      });

      // Bulk create activity records
      const detailsJson = JSON.stringify({
        pushedBy: payload.userId,
        pathName: name,
        moduleCount: modules.length,
      });
      await tx.userActivity.createMany({
        data: ids.map(userId => ({
          userId,
          action: 'TEACHER_PUSH_LEARNING_TASK',
          details: detailsJson,
        })),
      });

      return ids.length;
    });

    return NextResponse.json({
      success: true,
      created,
      targetScope: scope,
      targetClassId: targetClassId || null,
    });
  } catch (error) {
    console.error('Push learning task error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
