import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 批量获取学习进度
export async function POST(request: NextRequest) {
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

    const { moduleIds, chapterIds } = await request.json();

    // 验证章节ID数组
    if (chapterIds && Array.isArray(chapterIds)) {
      if (chapterIds.length === 0) {
        return NextResponse.json({ error: '章节ID列表不能为空' }, { status: 400 });
      }
      if (chapterIds.length > 50) {
        return NextResponse.json({ error: '一次最多查询50个章节' }, { status: 400 });
      }
    }

    // 构建查询条件
    const where: any = {
      userId: payload.userId
    };

    if (moduleIds && moduleIds.length > 0) {
      where.moduleId = { in: moduleIds };
    }

    if (chapterIds && chapterIds.length > 0) {
      where.chapterId = { in: chapterIds };
    }

    // 批量查询进度
    const progressList = await prisma.learningProgress.findMany({
      where,
      select: {
        moduleId: true,
        chapterId: true,
        status: true,
        progress: true,
        timeSpent: true,
        startedAt: true,
        completedAt: true,
        lastAccessAt: true
      }
    });

    // 直接返回数组格式
    return NextResponse.json({ progress: progressList });
  } catch (error: any) {
    console.error('批量获取学习进度失败:', error);
    
    // JSON解析错误
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: '请求格式错误'
      }, { status: 400 });
    }
    
    // 令牌验证错误
    if (error instanceof Error && error.message.includes('Invalid token')) {
      return NextResponse.json({ 
        error: '令牌无效'
      }, { status: 401 });
    }
    
    // 所有其他错误都返回500状态码
    return NextResponse.json({ 
      error: '服务器内部错误'
    }, { status: 500 });
  }
}