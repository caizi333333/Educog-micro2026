import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 知识图谱节点数据
const knowledgeNodes = [
  {
    id: 'basic-concepts',
    title: '单片机基础概念',
    type: 'concept',
    difficulty: 'beginner',
    description: '了解单片机的基本概念、结构和工作原理',
    prerequisites: [],
    connections: ['8051-architecture', 'programming-basics'],
    learningTime: 45,
    completionRate: 92,
    popularity: 95,
    tags: ['基础', '概念', '入门'],
    resources: { videos: 5, exercises: 8, projects: 2, documents: 12 },
    position: { x: 100, y: 100 },
    mastery: 85
  },
  {
    id: '8051-architecture',
    title: '8051架构详解',
    type: 'theory',
    difficulty: 'intermediate',
    description: '深入了解8051微控制器的内部架构和工作机制',
    prerequisites: ['basic-concepts'],
    connections: ['programming-basics', 'memory-management', 'io-ports'],
    learningTime: 90,
    completionRate: 78,
    popularity: 88,
    tags: ['架构', '8051', '理论'],
    resources: { videos: 10, exercises: 20, projects: 5, documents: 18 },
    position: { x: 100, y: 300 },
    mastery: 68
  },
  {
    id: 'programming-basics',
    title: '汇编语言基础',
    type: 'skill',
    difficulty: 'beginner',
    description: '学习8051汇编语言的基本语法和编程技巧',
    prerequisites: ['basic-concepts'],
    connections: ['8051-architecture', 'io-ports', 'interrupts'],
    learningTime: 120,
    completionRate: 85,
    popularity: 90,
    tags: ['编程', '汇编', '语法'],
    resources: { videos: 15, exercises: 30, projects: 8, documents: 25 },
    position: { x: 400, y: 200 },
    mastery: 72
  }
];

// 学习路径数据
const learningPaths = [
  {
    id: 'beginner-path',
    title: '初学者路径',
    description: '适合零基础学习者的完整学习路径',
    nodes: ['basic-concepts', '8051-architecture', 'programming-basics'],
    estimatedTime: 255,
    difficulty: 'beginner',
    completionRate: 85,
    enrolledUsers: 1250,
    rating: 4.6,
    tags: ['入门', '基础', '完整']
  }
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const userId = searchParams.get('userId');

    // 获取知识图谱节点
    if (type === 'nodes') {
      return NextResponse.json({
        success: true,
        data: knowledgeNodes
      });
    }

    // 获取学习路径
    if (type === 'paths') {
      return NextResponse.json({
        success: true,
        data: learningPaths
      });
    }

    // 获取用户进度
    if (type === 'progress' && userId) {
      try {
        const userProgress = await prisma.userProgress.findUnique({
          where: { userId },
          select: {
            modulesCompleted: true,
            totalTimeSpent: true,
            averageScore: true
          }
        });

        // 基于完成的模块数量估算完成的节点
        const completedNodesCount = userProgress?.modulesCompleted || 0;
        const completedNodes = knowledgeNodes.slice(0, completedNodesCount).map(n => n.id);

        return NextResponse.json({
          success: true,
          data: {
            completedNodes,
            totalNodes: knowledgeNodes.length,
            completionRate: (completedNodes.length / knowledgeNodes.length) * 100
          }
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
        const userProgress = await prisma.userProgress.findUnique({
          where: { userId },
          select: {
            modulesCompleted: true,
            averageScore: true
          }
        });

        // 基于完成的模块数量和平均分数估算完成的节点
        const completedNodesCount = userProgress?.modulesCompleted || 0;
        const completedNodes = knowledgeNodes.slice(0, completedNodesCount).map(n => n.id);

        const recommendations = knowledgeNodes
          .filter(node => {
            // 未完成的节点
            if (completedNodes.includes(node.id)) return false;
            
            // 检查前置条件是否满足
            const prerequisitesMet = node.prerequisites.every(prereq => 
              completedNodes.includes(prereq)
            );
            
            return prerequisitesMet;
          })
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 5);

        return NextResponse.json({
          success: true,
          data: recommendations
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