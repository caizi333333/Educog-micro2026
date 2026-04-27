import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { type KnowledgePoint } from '@/lib/knowledge-points';
import { fetchKnowledgePoints } from '@/lib/knowledge-source';

function mapLevelToDifficulty(level: KnowledgePoint['level']) {
  if (level === 1) return 'beginner';
  if (level === 2) return 'intermediate';
  return 'advanced';
}

function mapLevelToType(level: KnowledgePoint['level']) {
  if (level === 1) return 'concept';
  if (level === 2) return 'theory';
  return 'practice';
}

function resourceCounts(point: KnowledgePoint) {
  const resources = point.resources ?? [];
  return {
    videos: resources.filter((item) => item.type === 'video' || item.type === 'animation').length,
    exercises: resources.filter((item) => item.type === 'quiz').length,
    projects: resources.filter((item) => item.type === 'experiment').length,
    documents: resources.filter((item) => item.type === 'document' || item.type === 'slide').length,
  };
}

function toKnowledgeNode(point: KnowledgePoint, index: number, all: KnowledgePoint[]) {
  const children = all.filter((p) => p.parentId === point.id);
  const learningTime = point.resources?.reduce((sum, item) => sum + (item.duration ?? 0), 0) || 30 + point.level * 15;

  return {
    id: point.id,
    title: point.name,
    type: mapLevelToType(point.level),
    difficulty: mapLevelToDifficulty(point.level),
    description: point.description ?? '',
    prerequisites: point.prerequisites && point.prerequisites.length > 0
      ? point.prerequisites
      : (point.parentId ? [point.parentId] : []),
    connections: children.map((child) => child.id),
    learningTime,
    completionRate: 0,
    popularity: Math.max(20, 100 - Math.floor(index / 8)),
    tags: [`第${point.chapter}章`, `L${point.level}`],
    resources: resourceCounts(point),
    position: {
      x: 140 + ((point.chapter - 1) % 5) * 260,
      y: 100 + point.level * 130 + Math.floor((point.chapter - 1) / 5) * 520,
    },
    mastery: 0,
    chapter: point.chapter,
    level: point.level,
    graphNodeId: point.graphNodeId ?? null,
    appliedIn: point.appliedIn ?? [],
  };
}

function buildLearningPaths(points: KnowledgePoint[]) {
  return [
    {
      id: 'beginner-path',
      title: '8051基础入门路径',
      description: '覆盖单片机概述、硬件结构和指令系统的基础学习路径',
      nodes: points.filter((point) => point.chapter <= 3 && point.level <= 2).map((point) => point.id),
      estimatedTime: 360,
      difficulty: 'beginner',
      completionRate: 0,
      enrolledUsers: 0,
      rating: 4.5,
      tags: ['入门', '硬件结构', '指令系统']
    },
    {
      id: 'practice-path',
      title: '实验应用强化路径',
      description: '面向定时器、中断、串口和接口技术的实验应用路径',
      nodes: points.filter((point) => point.chapter >= 5 && point.chapter <= 8 && point.level <= 2).map((point) => point.id),
      estimatedTime: 420,
      difficulty: 'intermediate',
      completionRate: 0,
      enrolledUsers: 0,
      rating: 4.5,
      tags: ['实验', '中断', '接口技术']
    }
  ];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');

    // 获取知识图谱节点
    if (type === 'nodes') {
      const { points } = await fetchKnowledgePoints();
      const nodes = points.map((p, i) => toKnowledgeNode(p, i, points));
      return NextResponse.json({
        success: true,
        data: nodes,
      });
    }

    // 获取学习路径
    if (type === 'paths') {
      const { points } = await fetchKnowledgePoints();
      return NextResponse.json({
        success: true,
        data: buildLearningPaths(points),
      });
    }

    // 获取用户进度
    if (type === 'progress' && userId) {
      try {
        const [userProgress, sourceResult] = await Promise.all([
          prisma.userProgress.findUnique({
            where: { userId },
            select: {
              modulesCompleted: true,
              totalTimeSpent: true,
              averageScore: true,
            },
          }),
          fetchKnowledgePoints(),
        ]);

        const points = sourceResult.points;
        const completedNodesCount = userProgress?.modulesCompleted || 0;
        const completedNodes = points.slice(0, completedNodesCount).map((n) => n.id);

        return NextResponse.json({
          success: true,
          data: {
            completedNodes,
            totalNodes: points.length,
            completionRate: points.length > 0 ? (completedNodes.length / points.length) * 100 : 0,
          },
        });
      } catch (error) {
        console.error('Error fetching user progress:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch user progress'
        }, { status: 500 });
      }
    }

    // 获取推荐节点
    if (type === 'recommendations' && userId) {
      try {
        const [userProgress, sourceResult] = await Promise.all([
          prisma.userProgress.findUnique({
            where: { userId },
            select: {
              modulesCompleted: true,
              averageScore: true,
            },
          }),
          fetchKnowledgePoints(),
        ]);

        const points = sourceResult.points;
        const nodes = points.map((p, i) => toKnowledgeNode(p, i, points));
        const completedNodesCount = userProgress?.modulesCompleted || 0;
        const completedNodes = nodes.slice(0, completedNodesCount).map((n) => n.id);

        const recommendations = nodes
          .filter((node) => {
            if (completedNodes.includes(node.id)) return false;
            return node.prerequisites.every((prereq) => completedNodes.includes(prereq));
          })
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 5);

        return NextResponse.json({
          success: true,
          data: recommendations,
        });
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch recommendations'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request type'
    }, { status: 400 });

  } catch (error) {
    console.error('Knowledge graph API error:', error);
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

    const body = await request.json();
    const { action, nodeId, pathId } = body;

    // 标记节点为已完成
    if (action === 'complete_node' && nodeId) {
      try {
        // 更新用户进度统计
        await prisma.userProgress.upsert({
          where: {
            userId: decoded.userId
          },
          update: {
            modulesCompleted: {
              increment: 1
            },
            lastActiveDate: new Date()
          },
          create: {
            userId: decoded.userId,
            modulesCompleted: 1,
            totalTimeSpent: 0,
            streakDays: 1,
            lastActiveDate: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Node marked as completed'
        });
      } catch (error) {
        console.error('Error updating node progress:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to update progress'
        }, { status: 500 });
      }
    }

    // 开始学习路径
    if (action === 'start_path' && pathId) {
      try {
        // 这里可以记录用户开始学习路径的信息
        // 暂时返回成功响应
        return NextResponse.json({
          success: true,
          message: 'Learning path started'
        });
      } catch (error) {
        console.error('Error starting learning path:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to start learning path'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Knowledge graph POST API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}
