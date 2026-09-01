import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function nullableText(
  value: unknown,
  label: string,
  maxLength: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: `${label}格式无效` };
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    return { ok: false, error: `${label}长度不能超过${maxLength}位` };
  }
  return { ok: true, value: normalized || null };
}

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return json({ error: '无效的令牌' }, 401);
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
      return json({ error: '用户不存在' }, 404);
    }

    // 获取最近的学习活动
    const recentActivity = await prisma.userActivity.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 获取学习统计（含已完成模块数）
    const [learningStats, completedModuleCount] = await Promise.all([
      prisma.learningProgress.aggregate({
        where: { userId: payload.userId },
        _sum: { timeSpent: true },
        _avg: { progress: true },
        _count: true
      }),
      prisma.learningProgress.count({
        where: { userId: payload.userId, progress: { gte: 100 } }
      })
    ]);

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
        completedModules: completedModuleCount || 0,
        
        // 测验统计
        averageQuizScore: Math.round(quizStats._avg.score || 0),
        bestQuizScore: quizStats._max.score || 0,
        totalQuizAttempts: quizStats._count || 0
      },
      
      // 最近活动
      recentActivity: recentActivity.map((activity: any) => {
        let details = null;
        if (activity.details) {
          try { details = JSON.parse(activity.details); } catch { details = activity.details; }
        }
        return { action: activity.action, details, createdAt: activity.createdAt };
      })
    };

    return json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('获取用户资料失败:', error);
    return json({
      error: '获取用户资料失败'
    }, 500);
  }
}

export async function PUT(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return json({ error: '无效的令牌' }, 401);
    }

    let data: Record<string, unknown>;
    try {
      const parsed = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return json({ error: '请求格式错误' }, 400);
      }
      data = parsed as Record<string, unknown>;
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const allowedFields = new Set(['name']);
    if (payload.role === 'STUDENT') {
      allowedFields.add('grade');
      allowedFields.add('major');
    } else if (payload.role === 'TEACHER' || payload.role === 'ADMIN') {
      allowedFields.add('department');
      allowedFields.add('title');
    }

    const unsupportedFields = Object.keys(data).filter((key) => !allowedFields.has(key));
    if (unsupportedFields.length > 0) {
      return json({
        error: `以下字段不可自行修改：${unsupportedFields.join('、')}`,
      }, 400);
    }

    const updateData: Record<string, string | null> = {};
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        return json({ error: '姓名不能为空' }, 400);
      }
      const name = data.name.trim();
      if (name.length > 100) return json({ error: '姓名长度不能超过100位' }, 400);
      updateData.name = name;
    }

    const optionalFieldLimits: Record<string, { label: string; maxLength: number }> = {
      grade: { label: '年级', maxLength: 50 },
      major: { label: '专业', maxLength: 100 },
      department: { label: '院系', maxLength: 100 },
      title: { label: '职称', maxLength: 100 },
    };
    for (const [field, config] of Object.entries(optionalFieldLimits)) {
      if (data[field] === undefined) continue;
      const normalized = nullableText(data[field], config.label, config.maxLength);
      if (!normalized.ok) return json({ error: normalized.error }, 400);
      updateData[field] = normalized.value;
    }

    const updatedFields = Object.keys(updateData);
    if (updatedFields.length === 0) {
      return json({ error: '没有可更新的字段' }, 400);
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: payload.userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          avatar: true,
          role: true,
          status: true,
          studentId: true,
          class: true,
          grade: true,
          major: true,
          teacherId: true,
          department: true,
          title: true,
          totalPoints: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
        },
      });

      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'UPDATE_PROFILE',
          details: JSON.stringify({ updated: updatedFields }),
        },
      });
      return user;
    });

    return json({
      success: true,
      user: updatedUser,
      message: '个人资料已更新'
    });

  } catch (error) {
    console.error('更新用户资料失败:', error);
    return json({
      error: '更新用户资料失败'
    }, 500);
  }
}
