import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { POINTS_CONFIG, PointsActivity } from '@/lib/points-system';

// Award points to a user
export async function POST(request: Request) {
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

    const data = await request.json();
    const { points, type, description, metadata } = data as PointsActivity;

    // Validate points type
    if (!type || !(type in POINTS_CONFIG)) {
      return NextResponse.json({ error: '无效的积分类型' }, { status: 400 });
    }

    // Create points transaction
    const transaction = await prisma.userPointsTransaction.create({
      data: {
        userId: payload.userId,
        points: points || POINTS_CONFIG[type],
        type,
        description: description || `获得${POINTS_CONFIG[type]}积分`,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });

    // Update user's total points
    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        totalPoints: {
          increment: transaction.points
        }
      }
    });

    // Record activity
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'EARN_POINTS',
        details: JSON.stringify({
          points: transaction.points,
          type,
          totalPoints: user.totalPoints
        })
      }
    });

    return NextResponse.json({
      success: true,
      transaction,
      totalPoints: user.totalPoints,
      message: `成功获得${transaction.points}积分！`
    });

  } catch (error) {
    console.error('奖励积分失败:', error);
    return NextResponse.json({ 
      error: '奖励积分失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

// Get user's points history
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

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's total points
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { totalPoints: true }
    });

    // Get points transactions
    const transactions = await prisma.userPointsTransaction.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // Get statistics
    const stats = await prisma.userPointsTransaction.groupBy({
      by: ['type'],
      where: { userId: payload.userId },
      _sum: {
        points: true
      },
      _count: true
    });

    // Calculate daily points
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyPoints = await prisma.userPointsTransaction.aggregate({
      where: {
        userId: payload.userId,
        createdAt: {
          gte: today
        }
      },
      _sum: {
        points: true
      }
    });

    return NextResponse.json({
      success: true,
      totalPoints: user?.totalPoints || 0,
      dailyPoints: dailyPoints._sum.points || 0,
      transactions: transactions.map(t => ({
        ...t,
        metadata: t.metadata ? JSON.parse(t.metadata) : null
      })),
      stats: stats.map(s => ({
        type: s.type,
        totalPoints: s._sum.points || 0,
        count: s._count
      }))
    });

  } catch (error) {
    console.error('获取积分历史失败:', error);
    return NextResponse.json({ 
      error: '获取积分历史失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}