import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessStudentData } from '@/lib/classroom';
import { parseLearningTaskSteps } from '@/lib/lesson-tasks';

function inferDifficulty(modules: readonly unknown[]): 'beginner' | 'intermediate' | 'advanced' {
  // Heuristic: short paths are beginner, medium intermediate, long advanced
  if (modules.length <= 3) return 'beginner';
  if (modules.length <= 6) return 'intermediate';
  return 'advanced';
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.substring(7)
      : request.cookies?.get('accessToken')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const pathId = searchParams.get('id');
    const difficulty = searchParams.get('difficulty');
    if (difficulty && !['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      return NextResponse.json({ success: false, error: '难度筛选值无效' }, { status: 400 });
    }

    // Fetch a single learning path by ID
    if (pathId) {
      const path = await prisma.learningPath.findUnique({
        where: { id: pathId },
        include: {
          progress: true,
          user: { select: { id: true, username: true } },
        },
      });

      if (!path) {
        return NextResponse.json({
          success: false,
          error: 'Learning path not found'
        }, { status: 404 });
      }
      if (!(await canAccessStudentData(payload, path.userId))) {
        return NextResponse.json({ success: false, error: '无权查看该学习路径' }, { status: 403 });
      }

      const steps = parseLearningTaskSteps(path.modules);
      const completedSteps = path.status === 'COMPLETED'
        ? steps.length
        : Math.max(0, Math.min(path.currentModule, steps.length));
      const completionRate = steps.length > 0
        ? Math.round((completedSteps / steps.length) * 100)
        : 0;

      const totalTimeSpent = path.progress.reduce((sum, p) => sum + p.timeSpent, 0);
      const estimatedTime = totalTimeSpent > 0 ? totalTimeSpent : steps.length * 60;

      return NextResponse.json({
        success: true,
        data: {
          id: path.id,
          title: path.name,
          description: path.description ?? '',
          nodes: steps.map((step) => step.targetId),
          steps,
          estimatedTime,
          difficulty: inferDifficulty(steps),
          completionRate,
          enrolledUsers: 1,
          rating: 0,
          ratingDataSufficient: false,
          tags: [path.status.toLowerCase()],
          isPublic: false,
          createdBy: path.user.username,
          status: path.status,
          currentModule: path.currentModule,
          totalModules: path.totalModules,
          startedAt: path.startedAt,
          completedAt: path.completedAt,
        }
      });
    }

    // Fetch all learning paths
    const whereClause: Record<string, unknown> = payload.role === 'ADMIN'
      ? {}
      : { userId: payload.userId };
    if (difficulty) {
      // We filter after query since difficulty is derived, not stored
    }

    const paths = await prisma.learningPath.findMany({
      where: whereClause,
      include: {
        progress: { select: { status: true, timeSpent: true } },
        user: { select: { id: true, username: true } },
        _count: { select: { progress: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let result = paths.map(path => {
      const steps = parseLearningTaskSteps(path.modules);
      const completedSteps = path.status === 'COMPLETED'
        ? steps.length
        : Math.max(0, Math.min(path.currentModule, steps.length));
      const completionRate = steps.length > 0
        ? Math.round((completedSteps / steps.length) * 100)
        : 0;
      const totalTimeSpent = path.progress.reduce((sum, p) => sum + p.timeSpent, 0);

      return {
        id: path.id,
        title: path.name,
        description: path.description ?? '',
        nodes: steps.map((step) => step.targetId),
        steps,
        estimatedTime: totalTimeSpent > 0 ? totalTimeSpent : steps.length * 60,
        difficulty: inferDifficulty(steps),
        completionRate,
        enrolledUsers: 1,
        rating: 0,
        ratingDataSufficient: false,
        tags: [path.status.toLowerCase()],
        isPublic: false,
        createdBy: path.user.username,
      };
    });

    // Filter by difficulty if requested
    if (difficulty) {
      result = result.filter(p => p.difficulty === difficulty);
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Learning paths API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.substring(7)
    : request.cookies?.get('accessToken')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
  }
  return NextResponse.json({
    success: false,
    error: '旧学习路径写入口已停用，请通过正式学习任务接口操作',
  }, { status: 405, headers: { Allow: 'GET' } });
}

export const PUT = POST;
export const DELETE = POST;
