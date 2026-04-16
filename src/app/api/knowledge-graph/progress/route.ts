import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface UserProgressData {
  userId: string;
  nodeId: string;
  pathId?: string;
  progress: number; // 0-100
  timeSpent: number; // minutes
  lastAccessed: string;
  completed: boolean;
  mastery: number; // 0-100
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
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

    // Get progress for a specific node
    if (nodeId) {
      const record = await prisma.learningProgress.findFirst({
        where: { userId, moduleId: nodeId },
      });

      // Fetch quiz attempts for this node to derive mastery
      const quizAttempts = await prisma.quizAttempt.findMany({
        where: {
          userId,
          quizId: { startsWith: nodeId },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const mastery = quizAttempts.length > 0
        ? Math.round(quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length)
        : (record?.progress ?? 0);

      // Find related nodes the user hasn't started yet as recommendations
      const allProgress = await prisma.learningProgress.findMany({
        where: { userId },
        select: { moduleId: true },
      });
      const completedModules = new Set(allProgress.map(p => p.moduleId));

      // Simple recommendation: suggest chapter-adjacent modules not yet started
      const chapterId = record?.chapterId ?? '1';
      const chapterNum = parseInt(chapterId, 10) || 1;
      const recommendations = await prisma.learningProgress.findMany({
        where: {
          userId,
          chapterId: String(chapterNum),
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
      const path = await prisma.learningPath.findUnique({
        where: { id: pathId },
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

      const modules: string[] = JSON.parse(path.modules);
      const nodeProgressList = path.progress.map(p => ({
        nodeId: p.moduleId,
        progress: p.progress,
        mastery: p.progress, // Use progress as mastery proxy
        completed: p.status === 'COMPLETED',
      }));

      const completedNodes = nodeProgressList
        .filter(p => p.completed)
        .map(p => p.nodeId);

      const totalTimeSpent = path.progress.reduce((sum, p) => sum + p.timeSpent, 0);
      const overallProgress = modules.length > 0
        ? Math.round((completedNodes.length / modules.length) * 100)
        : 0;

      // Find current node: first module not yet completed
      const completedSet = new Set(completedNodes);
      const currentNode = modules.find(m => !completedSet.has(m)) ?? modules[modules.length - 1] ?? null;

      // Estimated remaining time based on average pace
      const avgTimePerNode = completedNodes.length > 0
        ? totalTimeSpent / completedNodes.length
        : 60;
      const remainingNodes = modules.length - completedNodes.length;
      const estimatedTimeRemaining = Math.round(avgTimePerNode * remainingNodes);

      // Build milestones from modules
      const milestones = modules.map(moduleId => {
        const prog = path.progress.find(p => p.moduleId === moduleId);
        return {
          name: moduleId,
          completed: prog?.status === 'COMPLETED',
          date: prog?.completedAt?.toISOString().split('T')[0] ?? null,
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
      const modules: string[] = JSON.parse(path.modules);
      const completed = path.progress.filter(p => p.status === 'COMPLETED').length;
      return {
        pathId: path.id,
        progress: modules.length > 0 ? Math.round((completed / modules.length) * 100) : 0,
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

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401 });
    }

    const progressData: UserProgressData = await request.json();
    progressData.userId = decoded.userId;

    // Validate required fields
    if (!progressData.nodeId || progressData.progress === undefined) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Validate progress range
    if (progressData.progress < 0 || progressData.progress > 100) {
      return NextResponse.json({
        success: false,
        error: 'Progress must be between 0 and 100'
      }, { status: 400 });
    }

    const isCompleted = progressData.progress >= 100;
    const status = isCompleted ? 'COMPLETED' : progressData.progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

    // Derive chapterId from nodeId (e.g., "1.2.3" -> chapter "1")
    const chapterId = progressData.nodeId.split('.')[0] || '0';

    // Upsert the progress record
    const record = await prisma.learningProgress.upsert({
      where: {
        userId_moduleId_chapterId: {
          userId: decoded.userId,
          moduleId: progressData.nodeId,
          chapterId,
        },
      },
      update: {
        progress: progressData.progress,
        timeSpent: { increment: progressData.timeSpent ?? 0 },
        status,
        lastAccessAt: new Date(),
        completedAt: isCompleted ? new Date() : undefined,
        pathId: progressData.pathId ?? undefined,
      },
      create: {
        userId: decoded.userId,
        moduleId: progressData.nodeId,
        chapterId,
        pathId: progressData.pathId ?? undefined,
        progress: progressData.progress,
        timeSpent: progressData.timeSpent ?? 0,
        status,
        startedAt: new Date(),
        lastAccessAt: new Date(),
        completedAt: isCompleted ? new Date() : undefined,
      },
    });

    // If this progress is part of a path, update the path's currentModule
    if (progressData.pathId) {
      const path = await prisma.learningPath.findUnique({
        where: { id: progressData.pathId },
      });
      if (path) {
        const modules: string[] = JSON.parse(path.modules);
        const nodeIndex = modules.indexOf(progressData.nodeId);
        if (nodeIndex >= 0 && nodeIndex >= path.currentModule) {
          await prisma.learningPath.update({
            where: { id: progressData.pathId },
            data: {
              currentModule: isCompleted ? Math.min(nodeIndex + 1, modules.length) : nodeIndex,
              completedAt: isCompleted && nodeIndex === modules.length - 1 ? new Date() : undefined,
              status: isCompleted && nodeIndex === modules.length - 1 ? 'COMPLETED' : undefined,
            },
          });
        }
      }
    }

    // Check for new achievements
    const achievements: string[] = [];
    if (isCompleted) {
      achievements.push('node-completed');

      // Check if this is their first completed node
      const completedCount = await prisma.learningProgress.count({
        where: { userId: decoded.userId, status: 'COMPLETED' },
      });
      if (completedCount === 1) {
        achievements.push('first-steps');
      }
    }
    if (progressData.timeSpent && progressData.timeSpent <= 30 && isCompleted) {
      achievements.push('quick-learner');
    }

    const responseData: Record<string, unknown> = {
      userId: decoded.userId,
      nodeId: progressData.nodeId,
      pathId: progressData.pathId ?? null,
      progress: record.progress,
      timeSpent: record.timeSpent,
      lastAccessed: record.lastAccessAt.toISOString(),
      completed: record.status === 'COMPLETED',
      mastery: record.progress,
    };

    if (achievements.length > 0) {
      responseData.newAchievements = achievements;
    }

    return NextResponse.json({
      success: true,
      message: 'Progress updated successfully',
      data: responseData
    });

  } catch (error) {
    console.error('User progress POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401 });
    }

    const progressData: UserProgressData = await request.json();
    progressData.userId = decoded.userId;

    if (!progressData.nodeId) {
      return NextResponse.json({
        success: false,
        error: 'Node ID is required'
      }, { status: 400 });
    }

    // Find existing record
    const existing = await prisma.learningProgress.findFirst({
      where: {
        userId: decoded.userId,
        moduleId: progressData.nodeId,
      },
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Progress record not found'
      }, { status: 404 });
    }

    const isCompleted = (progressData.progress ?? existing.progress) >= 100;
    const status = isCompleted ? 'COMPLETED' : (progressData.progress ?? existing.progress) > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

    const updated = await prisma.learningProgress.update({
      where: { id: existing.id },
      data: {
        progress: progressData.progress ?? existing.progress,
        timeSpent: progressData.timeSpent != null
          ? existing.timeSpent + progressData.timeSpent
          : existing.timeSpent,
        status,
        lastAccessAt: new Date(),
        completedAt: isCompleted && !existing.completedAt ? new Date() : existing.completedAt,
        pathId: progressData.pathId ?? existing.pathId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Progress updated successfully',
      data: {
        userId: decoded.userId,
        nodeId: progressData.nodeId,
        pathId: updated.pathId,
        progress: updated.progress,
        timeSpent: updated.timeSpent,
        lastAccessed: updated.lastAccessAt.toISOString(),
        completed: updated.status === 'COMPLETED',
        mastery: updated.progress,
      }
    });

  } catch (error) {
    console.error('User progress PUT API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({
        success: false,
        error: 'Invalid token'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const pathId = searchParams.get('pathId');

    if (!nodeId && !pathId) {
      return NextResponse.json({
        success: false,
        error: 'Node ID or Path ID is required'
      }, { status: 400 });
    }

    const whereClause: Record<string, string> = { userId: decoded.userId };
    if (nodeId) whereClause.moduleId = nodeId;
    if (pathId) whereClause.pathId = pathId;

    const deleted = await prisma.learningProgress.deleteMany({
      where: whereClause,
    });

    return NextResponse.json({
      success: true,
      message: `${deleted.count} progress record(s) deleted successfully`
    });

  } catch (error) {
    console.error('User progress DELETE API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
