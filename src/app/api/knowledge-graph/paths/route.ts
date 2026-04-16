import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface LearningPathData {
  id: string;
  title: string;
  description: string;
  nodes: string[];
  estimatedTime: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  isPublic: boolean;
  createdBy?: string;
}

function inferDifficulty(modules: string[]): 'beginner' | 'intermediate' | 'advanced' {
  // Heuristic: short paths are beginner, medium intermediate, long advanced
  if (modules.length <= 3) return 'beginner';
  if (modules.length <= 6) return 'intermediate';
  return 'advanced';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pathId = searchParams.get('id');
    const difficulty = searchParams.get('difficulty');

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

      const modules: string[] = JSON.parse(path.modules);
      const completedModules = path.progress.filter(p => p.status === 'COMPLETED').length;
      const completionRate = modules.length > 0
        ? Math.round((completedModules / modules.length) * 100)
        : 0;

      // Count distinct enrolled users for this path
      const enrolledUsers = await prisma.learningProgress.groupBy({
        by: ['userId'],
        where: { pathId: path.id },
      });

      // Average quiz scores as a proxy for rating
      const avgScore = await prisma.quizAttempt.aggregate({
        where: {
          userId: path.userId,
        },
        _avg: { score: true },
      });

      const totalTimeSpent = path.progress.reduce((sum, p) => sum + p.timeSpent, 0);
      const estimatedTime = totalTimeSpent > 0 ? totalTimeSpent : modules.length * 60;

      return NextResponse.json({
        success: true,
        data: {
          id: path.id,
          title: path.name,
          description: path.description ?? '',
          nodes: modules,
          estimatedTime,
          difficulty: inferDifficulty(modules),
          completionRate,
          enrolledUsers: enrolledUsers.length,
          rating: avgScore._avg.score ? Math.min(5, (avgScore._avg.score / 20)) : 4.5,
          tags: [path.status.toLowerCase()],
          isPublic: true,
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
    const whereClause: Record<string, unknown> = {};
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
      const modules: string[] = JSON.parse(path.modules);
      const completedModules = path.progress.filter(p => p.status === 'COMPLETED').length;
      const completionRate = modules.length > 0
        ? Math.round((completedModules / modules.length) * 100)
        : 0;
      const totalTimeSpent = path.progress.reduce((sum, p) => sum + p.timeSpent, 0);

      return {
        id: path.id,
        title: path.name,
        description: path.description ?? '',
        nodes: modules,
        estimatedTime: totalTimeSpent > 0 ? totalTimeSpent : modules.length * 60,
        difficulty: inferDifficulty(modules),
        completionRate,
        enrolledUsers: path._count.progress,
        rating: 4.5,
        tags: [path.status.toLowerCase()],
        isPublic: true,
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

    const pathData: LearningPathData = await request.json();

    // Validate required fields
    if (!pathData.title || !pathData.nodes || pathData.nodes.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const created = await prisma.learningPath.create({
      data: {
        userId: decoded.userId,
        name: pathData.title,
        description: pathData.description ?? null,
        modules: JSON.stringify(pathData.nodes),
        totalModules: pathData.nodes.length,
        currentModule: 0,
        status: 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Learning path created successfully',
      data: {
        ...pathData,
        id: created.id,
        createdBy: decoded.userId,
      }
    });

  } catch (error) {
    console.error('Learning paths POST API error:', error);
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

    const pathData: LearningPathData = await request.json();

    if (!pathData.id) {
      return NextResponse.json({
        success: false,
        error: 'Path ID is required'
      }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.learningPath.findUnique({
      where: { id: pathData.id },
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Learning path not found'
      }, { status: 404 });
    }

    if (existing.userId !== decoded.userId) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden'
      }, { status: 403 });
    }

    const updated = await prisma.learningPath.update({
      where: { id: pathData.id },
      data: {
        name: pathData.title ?? existing.name,
        description: pathData.description ?? existing.description,
        modules: pathData.nodes ? JSON.stringify(pathData.nodes) : existing.modules,
        totalModules: pathData.nodes ? pathData.nodes.length : existing.totalModules,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Learning path updated successfully',
      data: {
        ...pathData,
        id: updated.id,
      }
    });

  } catch (error) {
    console.error('Learning paths PUT API error:', error);
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
    const pathId = searchParams.get('id');

    if (!pathId) {
      return NextResponse.json({
        success: false,
        error: 'Path ID is required'
      }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.learningPath.findUnique({
      where: { id: pathId },
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: 'Learning path not found'
      }, { status: 404 });
    }

    if (existing.userId !== decoded.userId) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden'
      }, { status: 403 });
    }

    // Cascade delete handles progress records via Prisma schema
    await prisma.learningPath.delete({
      where: { id: pathId },
    });

    return NextResponse.json({
      success: true,
      message: 'Learning path deleted successfully'
    });

  } catch (error) {
    console.error('Learning paths DELETE API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
