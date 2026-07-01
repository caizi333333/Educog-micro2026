import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 返回当前登录用户的行为记录（UserActivity），可按 action 过滤、按 limit 截取。
// 学习路径/薄弱节点页据此跨会话恢复最近一次测验的薄弱点（details 内含 weakAreas）。
export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || undefined;
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);

    const activities = await prisma.userActivity.findMany({
      where: { userId: payload.userId, ...(action ? { action } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, action: true, details: true, createdAt: true },
    });

    return NextResponse.json({ success: true, activities });
  } catch (error) {
    console.error('获取用户活动失败:', error);
    return NextResponse.json(
      { error: '获取用户活动失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 },
    );
  }
}
