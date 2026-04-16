import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 获取用户证书列表
export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({
        error: '未授权',
        message: '请先登录以查看证书',
      }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json({
        error: '无效的令牌',
        message: '登录已过期，请重新登录',
      }, { status: 401 });
    }

    // 并行查询证书和用户统计数据
    const [certificates, user, learningStats, quizStats, experimentCount, completedModules] = await Promise.all([
      // 用户证书
      prisma.certificate.findMany({
        where: { userId: payload.userId },
        orderBy: { issuedAt: 'desc' },
      }),
      // 用户基本信息
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, name: true, username: true },
      }),
      // 学习时长统计
      prisma.learningProgress.aggregate({
        where: { userId: payload.userId },
        _sum: { timeSpent: true },
      }),
      // 测验最高分
      prisma.quizAttempt.aggregate({
        where: { userId: payload.userId },
        _max: { score: true },
        _count: { _all: true },
      }),
      // 完成的仿真实验数
      prisma.userActivity.count({
        where: {
          userId: payload.userId,
          action: { in: ['COMPLETE_EXPERIMENT', 'RUN_CODE'] },
        },
      }),
      // 已掌握模块数 (status=COMPLETED)
      prisma.learningProgress.count({
        where: {
          userId: payload.userId,
          status: 'COMPLETED',
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({
        error: '用户不存在',
        message: '用户账户不存在',
      }, { status: 404 });
    }

    // 计算学习时长（timeSpent 存储为秒，转换为小时）
    const totalHours = Math.round((learningStats._sum.timeSpent || 0) / 3600);

    return NextResponse.json({
      success: true,
      certificates,
      profile: {
        name: user.name || user.username,
      },
      stats: {
        totalHours,
        quizHighScore: quizStats._max.score ?? 0,
        simulationsCompleted: experimentCount,
        knowledgePointsMastered: completedModules,
      },
    });
  } catch (error) {
    console.error('获取证书失败:', error);
    return NextResponse.json({
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
