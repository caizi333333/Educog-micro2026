import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { KnowledgePoint } from '@/lib/knowledge-points';
import { fetchKnowledgePoints } from '@/lib/knowledge-source';

interface KnowledgeNodeData {
  id: string;
  title: string;
  type: 'concept' | 'skill' | 'project' | 'theory' | 'practice';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  prerequisites: string[];
  connections: string[];
  learningTime: number;
  tags: string[];
  resources: {
    videos: number;
    exercises: number;
    projects: number;
    documents: number;
  };
  position: { x: number; y: number };
}

function mapLevelToDifficulty(level: 1 | 2 | 3): 'beginner' | 'intermediate' | 'advanced' {
  if (level === 1) return 'beginner';
  if (level === 2) return 'intermediate';
  return 'advanced';
}

function mapLevelToType(level: 1 | 2 | 3): 'concept' | 'skill' | 'project' | 'theory' | 'practice' {
  if (level === 1) return 'concept';
  if (level === 2) return 'theory';
  return 'practice';
}

function countResources(point: KnowledgePoint) {
  const res = point.resources ?? [];
  return {
    videos: res.filter(r => r.type === 'video' || r.type === 'animation').length,
    exercises: res.filter(r => r.type === 'quiz').length,
    projects: res.filter(r => r.type === 'experiment').length,
    documents: res.filter(r => r.type === 'document' || r.type === 'slide').length,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('id');
    const userId = searchParams.get('userId');
    const chapter = searchParams.get('chapter');

    const { points: allPoints } = await fetchKnowledgePoints();

    // Fetch single node by ID
    if (nodeId) {
      const point = allPoints.find((p) => p.id === nodeId);
      if (!point) {
        return NextResponse.json({
          success: false,
          error: 'Node not found'
        }, { status: 404 });
      }

      const children = allPoints.filter((p) => p.parentId === nodeId);
      const siblings = point.parentId
        ? allPoints.filter((p) => p.parentId === point.parentId && p.id !== nodeId)
        : [];

      // Query user mastery from LearningProgress if userId provided
      let mastery = 0;
      let userProgress = null;
      if (userId) {
        userProgress = await prisma.learningProgress.findFirst({
          where: {
            userId,
            moduleId: nodeId,
          },
        });
        mastery = userProgress?.progress ?? 0;
      }

      // Compute popularity: count how many users have progress on this node
      const enrolledCount = await prisma.learningProgress.count({
        where: { moduleId: nodeId },
      });

      // Compute average completion for this node across all users
      const avgResult = await prisma.learningProgress.aggregate({
        where: { moduleId: nodeId },
        _avg: { progress: true },
      });

      const nodeData = {
        id: point.id,
        title: point.name,
        type: mapLevelToType(point.level),
        difficulty: mapLevelToDifficulty(point.level),
        description: point.description ?? '',
        prerequisites: point.prerequisites && point.prerequisites.length > 0
          ? point.prerequisites
          : (point.parentId ? [point.parentId] : []),
        connections: children.map((c) => c.id).concat(siblings.map((s) => s.id)),
        learningTime: point.resources
          ? point.resources.reduce((sum, r) => sum + (r.duration ?? 0), 0) || 60
          : 60,
        completionRate: Math.round(avgResult._avg.progress ?? 0),
        popularity: Math.min(100, enrolledCount * 10),
        tags: [`第${point.chapter}章`, `L${point.level}`],
        resources: countResources(point),
        position: { x: point.chapter * 200, y: point.level * 150 },
        mastery,
        chapter: point.chapter,
        level: point.level,
        graphNodeId: point.graphNodeId ?? null,
        appliedIn: point.appliedIn ?? [],
      };

      return NextResponse.json({
        success: true,
        data: nodeData
      });
    }

    // Fetch all nodes, optionally filtered by chapter
    const points = chapter
      ? allPoints.filter((p) => p.chapter === parseInt(chapter, 10))
      : allPoints;

    // If userId provided, batch-fetch their progress for all relevant modules
    const progressMap = new Map<string, number>();
    if (userId) {
      const moduleIds = points.map(p => p.id);
      const progressRecords = await prisma.learningProgress.findMany({
        where: {
          userId,
          moduleId: { in: moduleIds },
        },
        select: { moduleId: true, progress: true },
      });
      for (const rec of progressRecords) {
        progressMap.set(rec.moduleId, rec.progress);
      }
    }

    const nodes = points.map((point) => {
      const children = allPoints.filter((p) => p.parentId === point.id);
      return {
        id: point.id,
        title: point.name,
        type: mapLevelToType(point.level),
        difficulty: mapLevelToDifficulty(point.level),
        description: point.description ?? '',
        prerequisites: point.prerequisites && point.prerequisites.length > 0
          ? point.prerequisites
          : (point.parentId ? [point.parentId] : []),
        connections: children.map((c) => c.id),
        learningTime: point.resources
          ? point.resources.reduce((sum, r) => sum + (r.duration ?? 0), 0) || 60
          : 60,
        tags: [`第${point.chapter}章`, `L${point.level}`],
        resources: countResources(point),
        position: { x: point.chapter * 200, y: point.level * 150 },
        mastery: progressMap.get(point.id) ?? 0,
        chapter: point.chapter,
        level: point.level,
        graphNodeId: point.graphNodeId ?? null,
        appliedIn: point.appliedIn ?? [],
      };
    });

    return NextResponse.json({
      success: true,
      data: nodes
    });

  } catch (error) {
    console.error('Knowledge graph nodes API error:', error);
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

    const nodeData: KnowledgeNodeData = await request.json();

    // Validate required fields
    if (!nodeData.id || !nodeData.title || !nodeData.type) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // Knowledge nodes are defined in the static knowledge-points file.
    // This endpoint creates a LearningProgress record to track user interaction.
    await prisma.learningProgress.upsert({
      where: {
        userId_moduleId_chapterId: {
          userId: decoded.userId,
          moduleId: nodeData.id,
          chapterId: String(nodeData.tags?.[0] ?? '0'),
        },
      },
      update: {
        lastAccessAt: new Date(),
      },
      create: {
        userId: decoded.userId,
        moduleId: nodeData.id,
        chapterId: String(nodeData.tags?.[0] ?? '0'),
        status: 'NOT_STARTED',
        progress: 0,
        timeSpent: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Node created successfully',
      data: nodeData
    });

  } catch (error) {
    console.error('Knowledge graph nodes POST API error:', error);
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

    const nodeData: KnowledgeNodeData = await request.json();

    if (!nodeData.id) {
      return NextResponse.json({
        success: false,
        error: 'Node ID is required'
      }, { status: 400 });
    }

    // Update the user's progress record for this node
    const existing = await prisma.learningProgress.findFirst({
      where: {
        userId: decoded.userId,
        moduleId: nodeData.id,
      },
    });

    if (existing) {
      await prisma.learningProgress.update({
        where: { id: existing.id },
        data: { lastAccessAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Node updated successfully',
      data: nodeData
    });

  } catch (error) {
    console.error('Knowledge graph nodes PUT API error:', error);
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
    const nodeId = searchParams.get('id');

    if (!nodeId) {
      return NextResponse.json({
        success: false,
        error: 'Node ID is required'
      }, { status: 400 });
    }

    // Delete user's progress records for this node
    await prisma.learningProgress.deleteMany({
      where: {
        userId: decoded.userId,
        moduleId: nodeId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Node deleted successfully'
    });

  } catch (error) {
    console.error('Knowledge graph nodes DELETE API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
