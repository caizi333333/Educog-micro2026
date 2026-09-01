import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDataProvenance } from '@/lib/env';

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
    const quizId = searchParams.get('quizId')?.trim() || undefined;
    const pathId = searchParams.get('pathId')?.trim() || undefined;
    const assessmentMode = searchParams.get('assessmentMode')?.trim() || undefined;
    if (quizId && !/^[A-Za-z0-9_-]{1,128}$/.test(quizId)) {
      return NextResponse.json({ error: 'quizId 格式无效' }, { status: 400 });
    }
    if (pathId && !/^[A-Za-z0-9_-]{1,128}$/.test(pathId)) {
      return NextResponse.json({ error: 'pathId 格式无效' }, { status: 400 });
    }
    if (assessmentMode && assessmentMode !== 'initial' && assessmentMode !== 'retest') {
      return NextResponse.json({ error: 'assessmentMode 格式无效' }, { status: 400 });
    }
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 20, 1), 100);
    const detailFilters = [
      ...(quizId ? [`"quizId":"${quizId}"`] : []),
      ...(pathId ? [`"pathId":"${pathId}"`] : []),
      ...(assessmentMode ? [`"assessmentMode":"${assessmentMode}"`] : []),
    ];
    const asOf = new Date();

    const activities = await prisma.userActivity.findMany({
      where: {
        userId: payload.userId,
        createdAt: { lte: asOf },
        ...(action ? { action } : {}),
        ...(detailFilters.length === 1
          ? { details: { contains: detailFilters[0] } }
          : detailFilters.length > 1
            ? { AND: detailFilters.map((contains) => ({ details: { contains } })) }
            : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, action: true, details: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: asOf.toISOString(),
      sampleSize: { activityRecords: activities.length },
      activities,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('获取用户活动失败:', error);
    return NextResponse.json(
      { error: '获取用户活动失败' },
      { status: 500 },
    );
  }
}
