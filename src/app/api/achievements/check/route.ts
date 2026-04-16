import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { checkDailyAchievements } from '@/lib/achievement-checker';
import { prisma } from '@/lib/prisma';

// Daily achievement check endpoint
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: '未授权',
        message: '请先登录'
      }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ 
        error: '无效的令牌',
        message: '登录已过期，请重新登录'
      }, { status: 401 });
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });
    
    if (!user) {
      return NextResponse.json({ 
        error: '用户不存在',
        message: '用户账户不存在'
      }, { status: 404 });
    }

    // Check for any achievements that might have been missed
    const newAchievements = await checkDailyAchievements(payload.userId);
    
    // 计算总积分
    const totalPointsEarned = newAchievements.reduce((total, achievement) => {
      return total + (achievement.points || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      newAchievements: newAchievements || [],
      totalPointsEarned,
      message: newAchievements.length > 0 
        ? `恭喜！您解锁了 ${newAchievements.length} 个新成就`
        : '暂无新成就解锁'
    });

  } catch (error) {
    console.error('检查成就失败:', error);
    
    // 检查是否是数据库连接错误
    if (error instanceof Error && error.message.includes('Database connection')) {
      return NextResponse.json({ 
        error: '服务器内部错误',
        details: '数据库连接失败'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}