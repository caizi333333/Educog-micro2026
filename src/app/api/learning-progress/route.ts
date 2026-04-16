import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma, checkDatabaseConnection } from '@/lib/prisma';
import { POINTS_CONFIG } from '@/lib/points-system';
import { 
  CompletionCriteria, 
  isChapterCompleted,
  calculateCompletionPercentage 
} from '@/lib/learning-completion';

// 设置 API 路由超时时间为 25 秒
export const maxDuration = 25;

// 更新学习进度
export async function POST(request: Request) {
  // 添加请求超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时
  
  try {
    // 首先检查数据库连接
    const isDbConnected = await checkDatabaseConnection();
    if (!isDbConnected) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: '数据库连接失败',
        code: 'DATABASE_CONNECTION',
        retryable: true
      }, { status: 503 });
    }
    
    // 支持从header或body中获取token（用于sendBeacon）
    let token: string | null = null;
    let requestData: any = null;
    const authorization = request.headers.get('authorization');
    
    if (authorization && authorization.startsWith('Bearer ')) {
      token = authorization.substring(7);
      requestData = await request.json();
    } else {
      // 尝试从请求体中获取token（用于sendBeacon场景）
      try {
        requestData = await request.json();
        token = requestData.token;
      } catch (error) {
        clearTimeout(timeoutId);
        return NextResponse.json({ error: '请求数据格式错误' }, { status: 400 });
      }
    }
    
    if (!token) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    // 增强的token验证
    if (!token || token.trim() === '') {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '令牌为空' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    
    if (!payload) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: '无效的令牌',
        details: '令牌验证失败，请重新登录'
      }, { status: 401 });
    }

    // 验证payload完整性
    if (!payload.userId) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: '令牌数据不完整',
        details: '用户ID缺失'
      }, { status: 401 });
    }

    const data = requestData;
    
    // 数据验证和清理
    const { pathId, moduleId, chapterId, progress, timeSpent, notes, bookmarks, exercisesCompleted, totalExercises } = data;
    
    // 验证数据类型和范围（优先检查）
    if (timeSpent !== undefined && (typeof timeSpent !== 'number' || timeSpent < 0)) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: '时间必须是非负数'
      }, { status: 400 });
    }
    
    // 验证必需字段
    if (!chapterId) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: '章节ID是必需的'
      }, { status: 400 });
    }
    
    // 如果没有提供moduleId，从chapterId推导或使用默认值
    const finalModuleId = moduleId || 'module-1';
    
    const validatedProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, progress)) : 0;
    const validatedTimeSpent = typeof timeSpent === 'number' ? Math.max(0, timeSpent) : 0;
    const validatedExercisesCompleted = typeof exercisesCompleted === 'number' ? Math.max(0, exercisesCompleted) : 0;
    const validatedTotalExercises = typeof totalExercises === 'number' ? Math.max(0, totalExercises) : 0;
    
    // 优化数据库查询 - 使用并行查询减少等待时间，只选择必要字段
    const [existingProgress, latestQuizAttempt] = await Promise.all([
      prisma.learningProgress.findUnique({
        where: {
          userId_moduleId_chapterId: {
            userId: payload.userId,
            moduleId: finalModuleId,
            chapterId: chapterId
          }
        },
        select: {
          id: true,
          progress: true,
          timeSpent: true,
          status: true,
          completedAt: true,
          notes: true,
          bookmarks: true,
          lastAccessAt: true
        }
      }),
      // 只在需要时查询测验数据
      validatedProgress >= 90 ? prisma.quizAttempt.findFirst({
        where: {
          userId: payload.userId,
          quizId: `${finalModuleId}-${chapterId}`,
        },
        select: {
          score: true,
          completedAt: true
        },
        orderBy: {
          completedAt: 'desc'
        }
      }) : Promise.resolve(null)
    ]);

    // Build completion criteria（使用验证后的数据）
    const completionCriteria: CompletionCriteria = {
      // 进度只增不减：当本次没有提供 progress 时，沿用历史值（避免 0 覆盖）
      readingProgress: (typeof progress === 'number') ? validatedProgress : (existingProgress?.progress ?? 0),
      minimumTimeSpent: (existingProgress?.timeSpent || 0) + validatedTimeSpent,
      quizCompleted: !!latestQuizAttempt,
      quizScore: latestQuizAttempt?.score || 0,
      exercisesCompleted: validatedExercisesCompleted,
      totalExercises: validatedTotalExercises,
      hasNotes: notes !== undefined ? !!notes : !!existingProgress?.notes,
      hasBookmarks: bookmarks !== undefined ? !!bookmarks : !!existingProgress?.bookmarks,
    };

    // Calculate actual completion based on all criteria
    const actualCompletion = calculateCompletionPercentage(completionCriteria);
    const isCompleted = isChapterCompleted(completionCriteria);

    let learningProgress;
    
    if (existingProgress) {
      // 更新现有进度（使用验证后的数据）
      const newTimeSpent = existingProgress.timeSpent + validatedTimeSpent;
      const newProgress = Math.max(existingProgress.progress, actualCompletion);
      
      learningProgress = await prisma.learningProgress.update({
        where: { id: existingProgress.id },
        data: {
          progress: newProgress, // 只增不减：取历史与本次计算值的最大值
          timeSpent: newTimeSpent,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          lastAccessAt: new Date(),
          completedAt: isCompleted && !existingProgress.completedAt ? new Date() : existingProgress.completedAt,
          notes: notes || existingProgress.notes,
          bookmarks: bookmarks || existingProgress.bookmarks,
        }
      });
    } else {
      // 验证用户是否存在（优化：只在创建新记录时检查）
      const existingUser = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true } // 只选择必要字段
      });
      if (!existingUser) {
        console.error(`User ${payload.userId} not found`);
        clearTimeout(timeoutId);
        return NextResponse.json({ error: '用户不存在' }, { status: 404 });
      }
      
      // 简化路径验证 - 直接使用提供的pathId，减少数据库查询
      const finalPathId = pathId || null;
      
      
      
      // 创建新进度记录（使用验证后的数据）
      learningProgress = await prisma.learningProgress.create({
        data: {
          userId: payload.userId,
          pathId: finalPathId,
          moduleId: finalModuleId,
          chapterId: chapterId,
          progress: actualCompletion,
          timeSpent: validatedTimeSpent,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          startedAt: new Date(),
          completedAt: isCompleted ? new Date() : null,
          notes: notes || null,
          bookmarks: bookmarks || null,
        }
      });
    }

    // 简化路径更新逻辑 - 仅在必要时更新
    // 移除复杂的路径状态检查以提高性能

    // 简化积分逻辑 - 仅基本奖励
    let pointsEarned = 0;
    let newAchievements: any[] = [];

    // 仅在完成章节时给予基本积分（使用事务确保数据一致性）
    if (learningProgress.status === 'COMPLETED' && (!existingProgress || existingProgress.status !== 'COMPLETED')) {
      pointsEarned = POINTS_CONFIG.COMPLETE_CHAPTER;
      
      // 使用事务同时更新积分记录和用户总积分
      await prisma.$transaction([
        prisma.userPointsTransaction.create({
          data: {
            userId: payload.userId,
            points: pointsEarned,
            type: 'COMPLETE_CHAPTER',
            description: `完成章节 ${chapterId}`,
            metadata: JSON.stringify({ moduleId: finalModuleId, chapterId })
          }
        }),
        prisma.user.update({
          where: { id: payload.userId },
          data: {
            totalPoints: {
              increment: pointsEarned
            }
          }
        })
      ]);
    }

    // 移除用户活动记录以提高性能

    const achievementPoints = newAchievements.reduce((sum, ach) => sum + ach.points, 0);
    
    // 清除超时定时器
    clearTimeout(timeoutId);
    
    return NextResponse.json({
      success: true,
      progress: {
        ...learningProgress,
        isCompleted
      },
      message: '学习进度已更新',
      pointsEarned,
      completionCriteria,
      completionPercentage: actualCompletion,
      isCompleted,
      newAchievements: newAchievements.length > 0 ? newAchievements : null,
      totalPointsEarned: pointsEarned + achievementPoints
    });

  } catch (error) {
    // 清除超时定时器
    clearTimeout(timeoutId);
    
    console.error('更新学习进度失败:', error);
    console.error('错误类型:', typeof error);
    console.error('错误名称:', error instanceof Error ? error.name : 'Unknown');
    console.error('错误信息:', error instanceof Error ? error.message : String(error));
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
    
    // 增强的错误处理机制
    if (error instanceof SyntaxError) {
      return NextResponse.json({ 
        error: '请求格式错误',
        code: 'INVALID_JSON',
        retryable: false
      }, { status: 400 });
    }
    
    if (error instanceof Error && (error.message.includes('Invalid token') || error.message.includes('令牌'))) {
      return NextResponse.json({ 
        error: '令牌无效',
        code: 'INVALID_TOKEN',
        retryable: false
      }, { status: 401 });
    }
    
    // 数据库连接错误
    if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
      return NextResponse.json({ 
        error: '数据库连接失败',
        code: 'DATABASE_CONNECTION',
        retryable: true
      }, { status: 503 });
    }
    
    // 用户不存在错误
    if (error instanceof Error && error.message.includes('用户不存在')) {
      return NextResponse.json({ 
        error: '用户不存在',
        code: 'USER_NOT_FOUND',
        retryable: false
      }, { status: 404 });
    }
    
    // 网络超时错误
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('TIMEOUT'))) {
      return NextResponse.json({ 
        error: '请求超时',
        code: 'REQUEST_TIMEOUT',
        retryable: true
      }, { status: 408 });
    }
    
    // 所有其他错误都返回500状态码
    return NextResponse.json({ 
      error: '服务器内部错误',
      code: 'INTERNAL_ERROR',
      retryable: true
    }, { status: 500 });
  }
}

// 获取学习进度
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
    const pathId = searchParams.get('pathId');
    const moduleId = searchParams.get('moduleId');
    const chapterId = searchParams.get('chapterId');

    const where: any = { userId: payload.userId };
    if (pathId) where.pathId = pathId;
    if (moduleId) where.moduleId = moduleId;
    if (chapterId) where.chapterId = chapterId;

    // 构建查询选项
    const queryOptions: any = {
      where,
      orderBy: {
        lastAccessAt: 'desc'
      }
    };

    // 只有在没有特定章节查询时才包含learningPath
    if (!chapterId) {
      queryOptions.include = {
        learningPath: {
          select: {
            name: true,
            description: true,
            status: true
          }
        }
      };
    }

    const progress = await prisma.learningProgress.findMany(queryOptions);

    // 为每个进度记录添加isCompleted字段
    const progressWithCompletion = progress.map(p => ({
      ...p,
      isCompleted: p.status === 'COMPLETED'
    }));

    // 计算总体统计
    const stats = {
      totalModules: progress.length,
      completedModules: progress.filter(p => p.status === 'COMPLETED').length,
      inProgressModules: progress.filter(p => p.status === 'IN_PROGRESS').length,
      totalTimeSpent: progress.reduce((sum, p) => sum + p.timeSpent, 0),
      averageProgress: progress.length > 0 
        ? Math.round(progress.reduce((sum, p) => sum + p.progress, 0) / progress.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      progress: progressWithCompletion,
      stats
    });

  } catch (error) {
    console.error('获取学习进度失败:', error);
    
    if (error instanceof Error && error.message.includes('Invalid token')) {
      return NextResponse.json({ 
        error: '令牌无效'
      }, { status: 401 });
    }
    
    return NextResponse.json({ 
      error: '服务器内部错误'
    }, { status: 500 });
  }
}
