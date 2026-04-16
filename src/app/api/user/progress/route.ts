import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// 获取用户进度
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取认证令牌
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 查找用户进度
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId: payload.userId }
    });

    if (!userProgress) {
      return NextResponse.json({ error: 'Progress not found' }, { status: 404 });
    }

    return NextResponse.json(userProgress);
  } catch (error) {
    console.error('Error fetching user progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 创建用户进度
export async function POST(request: NextRequest) {
  try {
    // 从请求头获取认证令牌
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 验证数据
    const { modulesCompleted, totalTimeSpent, averageScore, streakDays } = body;
    if (
      typeof modulesCompleted !== 'number' || modulesCompleted < 0 ||
      typeof totalTimeSpent !== 'number' || totalTimeSpent < 0 ||
      (averageScore !== undefined && (typeof averageScore !== 'number' || averageScore < 0 || averageScore > 100)) ||
      (streakDays !== undefined && (typeof streakDays !== 'number' || streakDays < 0))
    ) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // 创建用户进度
    const userProgress = await prisma.userProgress.create({
      data: {
        userId: payload.userId,
        modulesCompleted,
        totalTimeSpent,
        averageScore,
        streakDays
      }
    });

    return NextResponse.json(userProgress, { status: 201 });
  } catch (error) {
    console.error('Error creating user progress:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 更新用户进度
export async function PUT(request: NextRequest) {
  try {
    // 从请求头获取认证令牌
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 验证数据
    const { modulesCompleted, totalTimeSpent, averageScore, streakDays } = body;
    const updateData: any = {};
    
    if (modulesCompleted !== undefined) {
      if (typeof modulesCompleted !== 'number' || modulesCompleted < 0) {
        return NextResponse.json({ error: 'Invalid modulesCompleted' }, { status: 400 });
      }
      updateData.modulesCompleted = modulesCompleted;
    }
    
    if (totalTimeSpent !== undefined) {
      if (typeof totalTimeSpent !== 'number' || totalTimeSpent < 0) {
        return NextResponse.json({ error: 'Invalid totalTimeSpent' }, { status: 400 });
      }
      updateData.totalTimeSpent = totalTimeSpent;
    }
    
    if (averageScore !== undefined) {
      if (typeof averageScore !== 'number' || averageScore < 0 || averageScore > 100) {
        return NextResponse.json({ error: 'Invalid averageScore' }, { status: 400 });
      }
      updateData.averageScore = averageScore;
    }
    
    if (streakDays !== undefined) {
      if (typeof streakDays !== 'number' || streakDays < 0) {
        return NextResponse.json({ error: 'Invalid streakDays' }, { status: 400 });
      }
      updateData.streakDays = streakDays;
    }

    // 更新用户进度
    const userProgress = await prisma.userProgress.update({
      where: { userId: payload.userId },
      data: updateData
    });

    return NextResponse.json(userProgress);
  } catch (error: any) {
    console.error('Error updating user progress:', error);
    
    // 处理 Prisma 记录不存在错误
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Progress not found' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}