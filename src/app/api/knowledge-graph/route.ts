import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { type KnowledgePoint } from '@/lib/knowledge-points';
import { fetchKnowledgePoints } from '@/lib/knowledge-source';
import { canAccessStudentData } from '@/lib/classroom';

async function authenticate(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.substring(7)
    : request.cookies?.get('accessToken')?.value;
  return token ? verifyToken(token) : null;
}

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

function toKnowledgeNode(point: KnowledgePoint, all: KnowledgePoint[]) {
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
    popularity: 0,
    popularityDataSufficient: false,
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
      rating: 0,
      ratingDataSufficient: false,
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
      rating: 0,
      ratingDataSufficient: false,
      tags: ['实验', '中断', '接口技术']
    }
  ];
}

export async function GET(request: NextRequest) {
  try {
    const payload = await authenticate(request);
    if (!payload) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const requestedUserId = searchParams.get('userId')?.trim();
    const userId = requestedUserId || payload.userId;
    if ((type === 'progress' || type === 'recommendations') && !(await canAccessStudentData(payload, userId))) {
      return NextResponse.json({ success: false, error: '无权查看该学生数据' }, { status: 403 });
    }

    if (type === 'stats') {
      const { points, source } = await fetchKnowledgePoints();
      const experimentIds = [...new Set(points.flatMap((point) => point.appliedIn ?? []))].sort();
      const response = NextResponse.json({
        success: true,
        data: {
          totalNodes: points.length,
          level1: points.filter((point) => point.level === 1).length,
          level2: points.filter((point) => point.level === 2).length,
          level3: points.filter((point) => point.level === 3).length,
          experimentCount: experimentIds.length,
          experimentIds,
        },
        source,
      });
      response.headers.set('Cache-Control', 'no-store, max-age=0');
      return response;
    }

    // 获取知识图谱节点（原始 KnowledgePoint 格式，供前端知识图谱页面使用）
    if (type === 'raw') {
      const { points, source } = await fetchKnowledgePoints();
      return NextResponse.json({
        success: true,
        data: points,
        source,
      });
    }

    // 获取知识图谱节点（图表可视化格式）
    if (type === 'nodes') {
      const { points, source } = await fetchKnowledgePoints();
      const nodes = points.map((point) => toKnowledgeNode(point, points));
      return NextResponse.json({
        success: true,
        data: nodes,
        source,
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
    if (type === 'progress') {
      try {
        const [sourceResult, completedRecords] = await Promise.all([
          fetchKnowledgePoints(),
          prisma.learningProgress.findMany({
            where: { userId, status: 'COMPLETED' },
            select: { chapterId: true },
          }),
        ]);

        const points = sourceResult.points;
        const chapterNodes = points.filter((point) => point.level === 1);
        const completedChapterIds = new Set(completedRecords.map((record) => record.chapterId.replace(/^ch/i, '')));
        const completedNodes = chapterNodes
          .filter((point) => completedChapterIds.has(point.id))
          .map((point) => point.id);

        return NextResponse.json({
          success: true,
          data: {
            completedNodes,
            totalNodes: chapterNodes.length,
            completionRate: chapterNodes.length > 0 ? (completedNodes.length / chapterNodes.length) * 100 : 0,
            granularity: 'CHAPTER',
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
    if (type === 'recommendations') {
      try {
        const [sourceResult, completedRecords] = await Promise.all([
          fetchKnowledgePoints(),
          prisma.learningProgress.findMany({
            where: { userId, status: 'COMPLETED' },
            select: { chapterId: true },
          }),
        ]);

        const points = sourceResult.points;
        const nodes = points.map((point) => toKnowledgeNode(point, points));
        const completedChapterIds = new Set(completedRecords.map((record) => record.chapterId.replace(/^ch/i, '')));
        const completedNodes = points
          .filter((point) => point.level === 1 && completedChapterIds.has(point.id))
          .map((point) => point.id);

        const recommendations = nodes
          .filter((node) => {
            if (completedNodes.includes(node.id)) return false;
            return node.prerequisites.every((prereq) => completedNodes.includes(prereq));
          })
          .sort((a, b) => a.chapter - b.chapter || a.level - b.level)
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
  const payload = await authenticate(request);
  if (!payload) {
    return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
  }
  return NextResponse.json({
    success: false,
    error: '知识图谱旧写入口已停用，请通过正式学习任务记录进度',
  }, { status: 405, headers: { Allow: 'GET' } });
}
