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

    // 获取用户完整信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        classEnrollments: {
          where: { status: 'ACTIVE' },
          select: {
            classId: true,
            role: true,
            status: true,
            joinedAt: true,
            classGroup: {
              select: {
                id: true,
                name: true,
                courseName: true,
                semester: true,
                teacher: { select: { id: true, name: true, username: true } },
              },
            },
          },
        },
        _count: {
          select: {
            sessions: true,
            experiments: true,
            quizAttempts: true,
            achievements: true,
            learningPaths: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 获取最近的学习活动
    const recentActivity = await prisma.userActivity.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 获取学习统计
    const learningStats = await prisma.learningProgress.aggregate({
      where: { userId: payload.userId },
      _sum: { timeSpent: true },
      _avg: { progress: true },
      _count: true
    });

    // 获取测验统计
    const quizStats = await prisma.quizAttempt.aggregate({
      where: { userId: payload.userId },
      _avg: { score: true },
      _max: { score: true },
      _count: true
    });

    // 构建完整的个人资料响应
    const profile = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
      role: user.role,
      status: user.status,
      
      // 学生特有信息
      studentId: user.studentId,
      class: user.class,
      grade: user.grade,
      major: user.major,
      
      // 教师特有信息
      teacherId: user.teacherId,
      department: user.department,
      title: user.title,
      classEnrollments: user.classEnrollments,
      
      // 积分信息
      totalPoints: user.totalPoints,
      
      // 时间信息
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      
      // 统计信息
      stats: {
        totalExperiments: user._count.experiments,
        totalQuizzes: user._count.quizAttempts,
        totalAchievements: user._count.achievements,
        totalLearningPaths: user._count.learningPaths,
        
        // 学习统计
        totalLearningTime: learningStats._sum.timeSpent || 0,
        averageProgress: Math.round(learningStats._avg.progress || 0),
        completedModules: learningStats._count || 0,
        
        // 测验统计
        averageQuizScore: Math.round(quizStats._avg.score || 0),
        bestQuizScore: quizStats._max.score || 0,
        totalQuizAttempts: quizStats._count || 0
      },
      
      // 最近活动
      recentActivity: recentActivity.map((activity: any) => ({
        action: activity.action,
        details: activity.details ? JSON.parse(activity.details) : null,
        createdAt: activity.createdAt
      }))
    };

    return NextResponse.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('获取用户资料失败:', error);
    return NextResponse.json({ 
      error: '获取用户资料失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    if (payload.role === 'STUDENT') {
      if (data.studentId !== undefined) updateData.studentId = data.studentId;
      if (data.grade !== undefined) updateData.grade = data.grade;
      if (data.major !== undefined) updateData.major = data.major;
    }

    if (payload.role === 'TEACHER' || payload.role === 'ADMIN') {
      if (data.department !== undefined) updateData.department = data.department;
      if (data.title !== undefined) updateData.title = data.title;
    }

    updateData.updatedAt = new Date();

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: updateData
    });

    // 记录活动
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'UPDATE_PROFILE',
        details: JSON.stringify({
          updated: Object.keys(data).filter(key => data[key] !== undefined)
        })
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: '个人资料已更新'
    });

  } catch (error) {
    console.error('更新用户资料失败:', error);
    return NextResponse.json({ 
      error: '更新用户资料失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
