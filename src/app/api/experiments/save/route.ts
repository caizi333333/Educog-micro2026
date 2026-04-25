import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getActiveClassIdForUser, normalizeLearningEventInput } from '@/lib/classroom';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证令牌' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const data = await request.json();
    const { 
      experimentId, 
      code, 
      results, 
      timeSpent,
      status = 'COMPLETED'
    } = data;

    // 验证必要参数
    if (!experimentId) {
      return NextResponse.json({ 
        error: '缺少实验ID' 
      }, { status: 400 });
    }

    // 查找或创建实验记录
    let experiment = await prisma.userExperiment.findUnique({
      where: {
        userId_experimentId: {
          userId: payload.userId,
          experimentId: experimentId
        }
      }
    });

    const now = new Date();
    
    if (experiment) {
      // 更新现有记录
      experiment = await prisma.userExperiment.update({
        where: { id: experiment.id },
        data: {
          status,
          lastCode: code,
          results: results ? JSON.stringify(results) : experiment.results,
          completedAt: status === 'COMPLETED' ? now : experiment.completedAt,
          timeSpent: timeSpent ? (experiment.timeSpent || 0) + timeSpent : experiment.timeSpent,
          attempts: experiment.attempts + 1,
          updatedAt: now
        }
      });
    } else {
      // 创建新记录
      experiment = await prisma.userExperiment.create({
        data: {
          userId: payload.userId,
          experimentId,
          status,
          lastCode: code,
          results: results ? JSON.stringify(results) : null,
          startedAt: now,
          completedAt: status === 'COMPLETED' ? now : null,
          timeSpent: timeSpent || 0,
          attempts: 1
        }
      });
    }

    try {
      const action = status === 'COMPLETED' ? 'COMPLETE_EXPERIMENT' : 'SAVE_EXPERIMENT';
      const classId = await getActiveClassIdForUser(payload.userId);

      await prisma.userActivity.create({
        data: {
          userId: payload.userId,
          action,
          details: JSON.stringify({ experimentId, status }),
        },
      });

      const learningEvent = normalizeLearningEventInput({
        eventType: action,
        targetType: 'EXPERIMENT',
        targetId: experimentId,
        experimentId,
        duration: timeSpent,
        metadata: {
          source: 'experiments-save-api',
          action,
          resultSummary: results ? { hasResults: true } : { hasResults: false },
        },
      }, experimentId);

      if (learningEvent) {
        await prisma.learningEvent.create({
          data: {
            userId: payload.userId,
            classId,
            ...learningEvent,
          },
        });
      }
    } catch (eventError) {
      console.error('记录实验行为失败:', eventError);
    }

    // 简化处理逻辑 - 保留积分/成就接口字段，避免破坏前端合约
    const basePoints = 0;
    const achievementPoints = 0;
    const newAchievements: any[] = [];
    
    return NextResponse.json({
      success: true,
      experiment: {
        id: experiment.id,
        experimentId: experiment.experimentId,
        status: experiment.status,
        attempts: experiment.attempts,
        timeSpent: experiment.timeSpent,
        completedAt: experiment.completedAt
      },
      message: status === 'COMPLETED' ? '实验已完成' : '实验进度已保存',
      pointsEarned: basePoints,
      newAchievements: newAchievements.length > 0 ? newAchievements : null,
      totalPointsEarned: basePoints + achievementPoints
    });

  } catch (error) {
    console.error('保存实验记录失败:', error);
    return NextResponse.json({ 
      error: '保存实验记录失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

// 获取用户的实验记录
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证令牌' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('experimentId');

    // 构建查询条件
    const where: any = {
      userId: payload.userId
    };

    if (experimentId) {
      where.experimentId = experimentId;
    }

    // 简化查询 - 仅获取基本实验记录
    const experiments = await prisma.userExperiment.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50 // 限制返回数量
    });

    return NextResponse.json({
      success: true,
      experiments: experiments.map((exp: any) => ({
        ...exp,
        results: exp.results ? JSON.parse(exp.results) : null
      }))
    });

  } catch (error) {
    console.error('获取实验记录失败:', error);
    return NextResponse.json({ 
      error: '获取实验记录失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
