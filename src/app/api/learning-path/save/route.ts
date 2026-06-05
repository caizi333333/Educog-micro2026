import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    // 验证用户身份
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
    const { name, description, modules, totalModules, weakAreas } = data;

    // 检查是否已有活跃的学习路径
    const existingPath = await prisma.learningPath.findFirst({
      where: {
        userId: payload.userId,
        status: 'ACTIVE'
      }
    });

    // 如果有活跃路径，将其标记为暂停
    if (existingPath) {
      await prisma.learningPath.update({
        where: { id: existingPath.id },
        data: { status: 'PAUSED' }
      });
    }

    // 创建新的学习路径
    const learningPath = await prisma.learningPath.create({
      data: {
        userId: payload.userId,
        name: name || '个性化学习计划',
        description: description || `基于测评结果的个性化学习计划`,
        modules: modules || '[]',
        currentModule: 0,
        totalModules: totalModules || 0,
        status: 'ACTIVE'
      }
    });

    // 记录用户活动
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'CREATE_LEARNING_PATH',
        details: JSON.stringify({
          pathId: learningPath.id,
          weakAreas: weakAreas || []
        })
      }
    });

    return NextResponse.json({
      success: true,
      pathId: learningPath.id,
      message: '学习路径已保存'
    });

  } catch (error) {
    console.error('保存学习路径失败:', error);
    return NextResponse.json({ 
      error: '保存学习路径失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    // 验证用户身份
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取用户的学习路径
    const learningPaths = await prisma.learningPath.findMany({
      where: {
        userId: payload.userId
      },
      include: {
        progress: {
          orderBy: {
            lastAccessAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      paths: learningPaths
    });

  } catch (error) {
    console.error('获取学习路径失败:', error);
    return NextResponse.json({ 
      error: '获取学习路径失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}