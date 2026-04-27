// Aggregates "tasks pushed to me" for the logged-in student:
//   - assignedExperiments: UserExperiment rows with status='ASSIGNED'
//                          (created by /api/teacher/assign-preclass)
//   - activePaths:         LearningPath rows with status='ACTIVE'
//                          (created by /api/teacher/push-learning-task)
//
// Auth: any authenticated user (no role check).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { experiments as experimentCatalog } from '@/lib/experiment-config';

export async function GET(request: NextRequest) {
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

    const [assignedRows, pathRows] = await Promise.all([
      prisma.userExperiment.findMany({
        where: { userId: payload.userId, status: 'ASSIGNED' },
        select: { experimentId: true, status: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.learningPath.findMany({
        where: { userId: payload.userId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          description: true,
          modules: true,
          currentModule: true,
          totalModules: true,
          startedAt: true,
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const experimentTitleById = new Map<string, { title: string; duration: number }>();
    for (const exp of experimentCatalog) {
      experimentTitleById.set(exp.id, { title: exp.title, duration: exp.duration });
    }

    const assignedExperiments = assignedRows.map((row) => {
      const meta = experimentTitleById.get(row.experimentId);
      return {
        experimentId: row.experimentId,
        title: meta?.title ?? row.experimentId,
        duration: meta?.duration ?? null,
        assignedAt: row.updatedAt.toISOString(),
        href: `/simulation?experiment=${encodeURIComponent(row.experimentId)}`,
      };
    });

    const activePaths = pathRows.map((row) => {
      let modules: { chapterId?: string; moduleId?: string; name?: string }[] = [];
      try {
        const parsed = JSON.parse(row.modules);
        if (Array.isArray(parsed)) modules = parsed;
      } catch {
        // tolerate legacy non-JSON modules field
      }
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        startedAt: row.startedAt.toISOString(),
        currentModule: row.currentModule,
        totalModules: row.totalModules,
        modules,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        assignedExperiments,
        activePaths,
        counts: {
          assignedExperiments: assignedExperiments.length,
          activePaths: activePaths.length,
        },
      },
    });
  } catch (err) {
    console.error('me/tasks GET error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
