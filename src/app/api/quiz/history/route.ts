import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取用户的测验历史
    const quizHistory = await prisma.quizAttempt.findMany({
      where: {
        userId: payload.userId
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 20 // 最近20次测验
    });

    // 计算统计信息
    const stats = {
      totalAttempts: await prisma.quizAttempt.count({
        where: { userId: payload.userId }
      }),
      averageScore: quizHistory.length > 0
        ? Math.round(quizHistory.reduce((sum, q) => sum + q.score, 0) / quizHistory.length)
        : 0,
      bestScore: quizHistory.length > 0
        ? Math.max(...quizHistory.map(q => q.score))
        : 0,
      latestScore: quizHistory[0]?.score || 0,
      totalTimeSpent: quizHistory.reduce((sum, q) => sum + q.timeSpent, 0)
    };

    return NextResponse.json({
      success: true,
      history: quizHistory,
      stats
    });

  } catch (error) {
    console.error('获取测验历史失败:', error);
    return NextResponse.json({ 
      error: '获取测验历史失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}