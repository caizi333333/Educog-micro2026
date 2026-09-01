import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getModuleIdForChapter, parseLearningTaskSteps } from '@/lib/lesson-tasks';
import { knowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';

function getNodeQuizIds(point: KnowledgePoint | undefined): string[] {
  const quizIds = new Set<string>();
  let current = point;
  while (current) {
    current.resources?.forEach((resource) => {
      if (resource.type === 'quiz' && resource.refId) quizIds.add(resource.refId);
    });
    const parentId = current.parentId;
    current = parentId
      ? knowledgePoints.find((candidate) => candidate.id === parentId)
      : undefined;
  }
  return [...quizIds];
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const decoded = await verifyToken(authorization.substring(7));
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const pathId = searchParams.get('pathId');
    const userId = decoded.userId;
    if ((nodeId && !/^[A-Za-z0-9._-]{1,128}$/.test(nodeId)) || (pathId && !/^[A-Za-z0-9._-]{1,128}$/.test(pathId))) {
      return NextResponse.json({ success: false, error: 'Invalid query parameter' }, { status: 400 });
    }

    // Get progress for a specific node
    if (nodeId) {
      const point = knowledgePoints.find((candidate) => candidate.id === nodeId);
      const resolvedModuleId = point ? getModuleIdForChapter(point.chapter) : nodeId;
      const resolvedChapterId = point ? `ch${point.chapter}` : undefined;
      const record = await prisma.learningProgress.findFirst({
        where: {
          userId,
          moduleId: resolvedModuleId ?? nodeId,
          ...(resolvedChapterId ? { chapterId: resolvedChapterId } : {}),
        },
      });

      // Fetch quiz attempts for this node to derive mastery
      const quizIds = getNodeQuizIds(point);
      const quizAttempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          quizId: point ? { in: quizIds } : { startsWith: nodeId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const mastery = quizAttempts.length > 0
        ? Math.round(quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length)
        : (record?.progress ?? 0);

      // Find related nodes the user hasn't started yet as recommendations
      // Simple recommendation: suggest chapter-adjacent modules not yet started
      const chapterId = resolvedChapterId ?? record?.chapterId ?? 'ch1';
      const chapterMatch = /^ch([1-9]|10)$/i.exec(chapterId);
      const normalizedChapterId = chapterMatch ? `ch${Number(chapterMatch[1])}` : 'ch1';
      const recommendations = await prisma.learningProgress.findMany({
        where: {
          userId,
          chapterId: normalizedChapterId,
          status: 'NOT_STARTED',
        },
        select: { moduleId: true },
        take: 2,
      });

      const progressData = {
        userId,
        nodeId,
        progress: record?.progress ?? 0,
        timeSpent: record?.timeSpent ?? 0,
        lastAccessed: record?.lastAccessAt?.toISOString() ?? new Date().toISOString(),
        completed: record?.status === 'COMPLETED',
        mastery,
        achievements: [] as string[],
        nextRecommendations: recommendations.map(r => r.moduleId),
      };

      // Check achievements
      if (record?.status === 'COMPLETED') {
        progressData.achievements.push('node-completed');
      }
      if (record && record.timeSpent > 0 && record.timeSpent <= 30) {
        progressData.achievements.push('quick-learner');
      }

      return NextResponse.json({
        success: true,
        data: progressData
      });
    }

    // Get progress for a specific learning path
    if (pathId) {
      const path = await prisma.learningPath.findFirst({
        where: { id: pathId, userId },
        include: {
          progress: {
            where: { userId },
            orderBy: { lastAccessAt: 'desc' },
          },
        },
      });

      if (!path) {
        return NextResponse.json({
          success: false,
          error: 'Learning path not found'
        }, { status: 404 });
      }

      const steps = parseLearningTaskSteps(path.modules);
      const completedStepCount = path.status === 'COMPLETED'
        ? steps.length
        : Math.max(0, Math.min(path.currentModule, steps.length));
      const completedNodes = steps.slice(0, completedStepCount).map((step) => step.stepId);
      const nodeProgressList = steps.map((step, index) => {
        const record = path.progress.find((item) => (
          item.moduleId === step.moduleId
          && (!step.chapterId || item.chapterId === step.chapterId)
        ));
        const completed = index < completedStepCount;
        const progress = completed ? 100 : record?.progress ?? 0;
        return {
          nodeId: step.stepId,
          targetId: step.targetId,
          title: step.title,
          progress,
          mastery: progress,
          completed,
        };
      });

      const totalTimeSpent = path.progress.reduce((sum, p) => sum + p.timeSpent, 0);
      const overallProgress = steps.length > 0
        ? Math.round((completedStepCount / steps.length) * 100)
        : 0;

      const currentNode = path.status === 'COMPLETED'
        ? null
        : steps[completedStepCount]?.stepId ?? null;

      // Estimated remaining time based on average pace
      const avgTimePerNode = completedNodes.length > 0
        ? totalTimeSpent / completedNodes.length
        : 60;
      const remainingNodes = steps.length - completedStepCount;
      const estimatedTimeRemaining = Math.round(avgTimePerNode * remainingNodes);

      const milestones = steps.map((step, index) => {
        const prog = path.progress.find((item) => (
          item.moduleId === step.moduleId
          && (!step.chapterId || item.chapterId === step.chapterId)
        ));
        return {
          name: step.title,
          stepId: step.stepId,
          completed: index < completedStepCount,
          date: index < completedStepCount
            ? prog?.completedAt?.toISOString().split('T')[0] ?? null
            : null,
        };
      });

      const pathProgress = {
        userId,
        pathId,
        overallProgress,
        completedNodes,
        currentNode,
        totalTimeSpent,
        estimatedTimeRemaining,
        nodeProgress: nodeProgressList,
        achievements: [] as string[],
        milestones,
      };

      if (completedNodes.length > 0) {
        pathProgress.achievements.push('path-starter');
      }
      if (overallProgress >= 100) {
        pathProgress.achievements.push('path-completed');
      }

      return NextResponse.json({
        success: true,
        data: pathProgress
      });
    }

    // Get overall progress summary for the user
    const allProgress = await prisma.learningProgress.findMany({
      where: { userId },
      orderBy: { lastAccessAt: 'desc' },
    });

    const totalNodesAccessed = allProgress.length;
    const totalNodesCompleted = allProgress.filter(p => p.status === 'COMPLETED').length;
    const totalTimeSpent = allProgress.reduce((sum, p) => sum + p.timeSpent, 0);
    const averageMastery = totalNodesAccessed > 0
      ? Math.round(allProgress.reduce((sum, p) => sum + p.progress, 0) / totalNodesAccessed)
      : 0;

    // Active learning paths
    const activePaths = await prisma.learningPath.findMany({
      where: { userId, status: 'ACTIVE' },
      include: {
        progress: { where: { userId }, select: { status: true } },
      },
    });

    const activePathData = activePaths.map(path => {
      const steps = parseLearningTaskSteps(path.modules);
      const completed = Math.max(0, Math.min(path.currentModule, steps.length));
      return {
        pathId: path.id,
        progress: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0,
        title: path.name,
      };
    });

    // Recent activity: last 10 progress updates
    const recentRecords = allProgress.slice(0, 10);
    const recentActivity = recentRecords.map(r => ({
      nodeId: r.moduleId,
      action: r.status === 'COMPLETED' ? 'completed' : r.status === 'IN_PROGRESS' ? 'in-progress' : 'started',
      timestamp: r.lastAccessAt.toISOString(),
    }));

    // Compute streak: count consecutive days with activity
    const activityDays = new Set(
      allProgress.map(p => p.lastAccessAt.toISOString().split('T')[0])
    );
    let streakDays = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (activityDays.has(dateStr)) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    // Achievements from UserAchievement table
    const achievements = await prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });

    // Simple level calculation based on completed nodes
    const level = Math.max(1, Math.floor(totalNodesCompleted / 5) + 1);
    const experiencePoints = totalNodesCompleted * 100 + totalTimeSpent;

    const overallProgress = {
      userId,
      totalNodesAccessed,
      totalNodesCompleted,
      totalTimeSpent,
      averageMastery,
      activePaths: activePathData,
      recentActivity,
      achievements: achievements.map(a => a.achievementId),
      streakDays,
      level,
      experiencePoints,
    };

    return NextResponse.json({
      success: true,
      data: overallProgress
    });

  } catch (error) {
    console.error('User progress API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
async function rejectLegacyProgressWrite(request: NextRequest) {
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
    error: '旧进度写入口已停用，请通过正式学习进度或任务接口操作',
  }, { status: 405, headers: { Allow: 'GET' } });
}

export const POST = rejectLegacyProgressWrite;
export const PUT = rejectLegacyProgressWrite;
export const DELETE = rejectLegacyProgressWrite;
