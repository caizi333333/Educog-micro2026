import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { verifyToken } from '@/lib/auth';
import { prisma, checkDatabaseConnection } from '@/lib/prisma';
import { POINTS_CONFIG } from '@/lib/points-system';
import { getActiveClassIdForUser, normalizeLearningEventInput } from '@/lib/classroom';
import { getModuleIdForChapter, parseLearningTaskSteps } from '@/lib/lesson-tasks';
import { getDataProvenance } from '@/lib/env';
import {
  type CompletionCriteria,
  isChapterCompleted,
  calculateCompletionPercentage 
} from '@/lib/learning-completion';

// 设置 API 路由超时时间为 25 秒
export const maxDuration = 25;

const MAX_SESSION_TIME_INCREMENT_SECONDS = 15 * 60;
const MAX_UNVERIFIED_BOOTSTRAP_SECONDS = 60;
const RECENT_PROGRESS_EVENT_WINDOW_MS = 15 * 60 * 1000;
const PROGRESS_EVENT_CLOCK_TOLERANCE_SECONDS = 30;

type ProgressEventReceipt = {
  duration: number | null;
  progress: number | null;
  clientTime: Date | null;
  createdAt: Date;
};

const optionalTrimmedString = (maxLength: number) => z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().max(maxLength).optional());

const learningProgressRequestSchema = z.object({
  token: optionalTrimmedString(8192),
  pathId: optionalTrimmedString(128),
  moduleId: optionalTrimmedString(64),
  chapterId: optionalTrimmedString(16),
  progress: z.number().finite().min(0).max(100).optional(),
  timeSpent: z.number().finite().int().max(24 * 60 * 60).optional(),
  notes: z.string().max(20_000).nullish(),
  bookmarks: z.string().max(50_000).nullish(),
  exercisesCompleted: z.number().finite().int().min(0).max(10_000).optional(),
  totalExercises: z.number().finite().int().min(0).max(10_000).optional(),
  action: optionalTrimmedString(64),
  metadata: z.unknown().optional(),
});

const learningProgressFilterSchema = z.object({
  pathId: z.string().trim().min(1).max(128).optional(),
  moduleId: z.string().trim().regex(/^module-[1-5]$/).optional(),
  chapterId: z.string().trim().regex(/^ch(?:[1-9]|10)$/i).transform((value) => value.toLowerCase()).optional(),
});

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(value: unknown): boolean {
  return isRecord(value) && value.code === 'P2002';
}

function secondsBetween(later: Date, earlier: Date): number {
  return Math.max(0, Math.round((later.getTime() - earlier.getTime()) / 1000));
}

function calculateAcceptedTimeIncrement(
  reportedSessionSeconds: number,
  receivedAt: Date,
  latestReceipt: ProgressEventReceipt | null,
): number {
  if (reportedSessionSeconds <= 0) return 0;
  if (!latestReceipt) return Math.min(reportedSessionSeconds, MAX_UNVERIFIED_BOOTSTRAP_SECONDS);

  const secondsSinceLastReceipt = secondsBetween(receivedAt, latestReceipt.createdAt);
  if (secondsSinceLastReceipt * 1000 > RECENT_PROGRESS_EVENT_WINDOW_MS) {
    return Math.min(reportedSessionSeconds, MAX_SESSION_TIME_INCREMENT_SECONDS);
  }

  const previousReportedSessionSeconds = latestReceipt.clientTime
    ? secondsBetween(latestReceipt.createdAt, latestReceipt.clientTime)
    : null;
  const sameSessionStart = latestReceipt.clientTime
    ? Math.abs(
      (receivedAt.getTime() - reportedSessionSeconds * 1000) - latestReceipt.clientTime.getTime(),
    ) <= PROGRESS_EVENT_CLOCK_TOLERANCE_SECONDS * 1000
    : false;
  const reportedDelta = sameSessionStart && previousReportedSessionSeconds !== null
    ? Math.max(0, reportedSessionSeconds - previousReportedSessionSeconds)
    : reportedSessionSeconds;

  // 近期连续请求只按服务器两次接收之间的实际经过时间计入。
  const elapsedBound = secondsSinceLastReceipt;
  return Math.min(reportedDelta, elapsedBound, MAX_SESSION_TIME_INCREMENT_SECONDS);
}

function calculateAcceptedReadingProgress(
  reportedProgress: number | undefined,
  previousProgress: number,
  acceptedTimeIncrement: number,
): number {
  if (reportedProgress === undefined) return previousProgress;
  // 阅读进度与可验证时长联动：无可计时长时不接受进度跳变。
  const maximumIncrement = Math.ceil(acceptedTimeIncrement / 3);
  return Math.max(
    previousProgress,
    Math.min(reportedProgress, previousProgress + maximumIncrement, 100),
  );
}

// 更新学习进度
export async function POST(request: Request): Promise<NextResponse> {
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
    const authorization = request.headers.get('authorization');
    const rawRequestData: unknown = await request.json();
    const parsedRequestData = learningProgressRequestSchema.safeParse(rawRequestData);
    if (!parsedRequestData.success) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '请求数据格式错误' }, { status: 400 });
    }
    const requestData = parsedRequestData.data;
    if (requestData.metadata !== undefined && JSON.stringify(requestData.metadata).length > 20_000) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '学习事件附加数据过大' }, { status: 400 });
    }
    const token = authorization?.startsWith('Bearer ')
      ? authorization.substring(7)
      : optionalString(requestData.token) ?? null;
    
    if (!token) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    
    // 增强的token验证
    if (token.trim() === '') {
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
    const pathId = data.pathId;
    const moduleId = data.moduleId;
    const chapterId = data.chapterId;
    const progress = data.progress;
    const timeSpent = data.timeSpent;
    const notes = optionalString(data.notes);
    const bookmarks = optionalString(data.bookmarks);
    const exercisesCompleted = data.exercisesCompleted;
    const totalExercises = data.totalExercises;

    if (timeSpent !== undefined && timeSpent < 0) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '时间必须是非负数' }, { status: 400 });
    }
    
    // 验证必需字段
    if (!chapterId) {
      clearTimeout(timeoutId);
      return NextResponse.json({ 
        error: '章节ID是必需的'
      }, { status: 400 });
    }

    const chapterMatch = /^ch([1-9]|10)$/i.exec(chapterId);
    if (!chapterMatch) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '章节ID无效' }, { status: 400 });
    }
    const normalizedChapterId = `ch${Number(chapterMatch[1])}`;
    const expectedModuleId = getModuleIdForChapter(Number(chapterMatch[1]));
    if (!expectedModuleId || (moduleId && moduleId !== expectedModuleId)) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '章节与模块编号不匹配' }, { status: 400 });
    }
    const finalModuleId = expectedModuleId;

    const validatedTimeSpent = timeSpent ?? 0;
    const validatedExercisesCompleted = exercisesCompleted ?? 0;
    const validatedTotalExercises = totalExercises ?? 0;
    if (validatedTotalExercises > 0 && validatedExercisesCompleted > validatedTotalExercises) {
      clearTimeout(timeoutId);
      return NextResponse.json({ error: '已完成练习数不能超过练习总数' }, { status: 400 });
    }

    let requestedPath: { id: string; modules: string } | null = null;
    if (pathId) {
      requestedPath = await prisma.learningPath.findFirst({
        where: { id: pathId, userId: payload.userId },
        select: { id: true, modules: true },
      });
      if (!requestedPath) {
        clearTimeout(timeoutId);
        return NextResponse.json({ error: '无权关联该学习路径' }, { status: 403 });
      }
      const pathSteps = parseLearningTaskSteps(requestedPath.modules);
      const supportsChapter = pathSteps.length === 0 || pathSteps.some((step) => (
        (!step.moduleId || step.moduleId === finalModuleId)
        && (!step.chapterId || step.chapterId === normalizedChapterId)
      ));
      if (!supportsChapter) {
        clearTimeout(timeoutId);
        return NextResponse.json({ error: '学习路径不包含该章节' }, { status: 409 });
      }
    }
    
    // 优化数据库查询 - 使用并行查询减少等待时间，只选择必要字段
    const receivedAt = new Date();
    const [existingProgress, latestQuizAttempt, latestProgressReceipt] = await Promise.all([
      prisma.learningProgress.findUnique({
        where: {
          userId_moduleId_chapterId: {
            userId: payload.userId,
            moduleId: finalModuleId,
            chapterId: normalizedChapterId
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
      prisma.quizAttempt.findFirst({
        where: {
          userId: payload.userId,
          quizId: `quiz-${normalizedChapterId}`,
        },
        select: {
          score: true,
          completedAt: true
        },
        orderBy: {
          completedAt: 'desc'
        }
      }),
      prisma.learningEvent.findFirst({
        where: {
          // 只使用本路由服务端生成的 lp_ 回执；
          // 通用客户端事件的 le_ 记录不得参与计时和进度判定。
          id: { startsWith: 'lp_' },
          userId: payload.userId,
          eventType: { in: ['UPDATE_PROGRESS', 'COMPLETE_CHAPTER'] },
          targetType: 'CHAPTER',
          targetId: normalizedChapterId,
          createdAt: { gte: new Date(receivedAt.getTime() - RECENT_PROGRESS_EVENT_WINDOW_MS) },
        },
        select: {
          duration: true,
          progress: true,
          clientTime: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const effectiveProgressReceipt: ProgressEventReceipt | null = latestProgressReceipt
      ?? (existingProgress?.lastAccessAt
        ? {
          duration: null,
          progress: null,
          clientTime: null,
          createdAt: existingProgress.lastAccessAt,
        }
        : null);
    const acceptedTimeIncrement = calculateAcceptedTimeIncrement(
      validatedTimeSpent,
      receivedAt,
      effectiveProgressReceipt,
    );
    const previousReadingProgress = Math.max(
      existingProgress?.progress ?? 0,
      latestProgressReceipt?.progress ?? 0,
    );
    const acceptedReadingProgress = calculateAcceptedReadingProgress(
      progress,
      previousReadingProgress,
      acceptedTimeIncrement,
    );

    // Build completion criteria（使用验证后的数据）
    const completionCriteria: CompletionCriteria = {
      // 阅读进度和时长都经服务器增量约束，不直接接受客户端累计值。
      readingProgress: acceptedReadingProgress,
      minimumTimeSpent: (existingProgress?.timeSpent ?? 0) + acceptedTimeIncrement,
      quizCompleted: !!latestQuizAttempt,
      quizScore: latestQuizAttempt?.score ?? 0,
      // 当前尚无服务器习题回执，客户端练习计数只用于界面提示，不参与完成判定。
      hasNotes: notes !== undefined ? !!notes : !!existingProgress?.notes,
      hasBookmarks: bookmarks !== undefined ? !!bookmarks : !!existingProgress?.bookmarks,
    };

    // Calculate actual completion based on all criteria
    const actualCompletion = calculateCompletionPercentage(completionCriteria);
    const isCompleted = isChapterCompleted(completionCriteria);

    let learningProgress;
    
    if (existingProgress) {
      // 更新现有进度（使用验证后的数据）
      const newProgress = Math.max(existingProgress.progress, actualCompletion);
      
      learningProgress = await prisma.learningProgress.update({
        where: { id: existingProgress.id },
        data: {
          progress: newProgress, // 只增不减：取历史与本次计算值的最大值
          // 使用数据库原子累加，避免多个自动保存请求同时到达时丢失学习时长。
          timeSpent: { increment: acceptedTimeIncrement },
          status: existingProgress.status === 'COMPLETED' || isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          lastAccessAt: new Date(),
          completedAt: isCompleted && !existingProgress.completedAt ? new Date() : existingProgress.completedAt,
          notes: notes ?? existingProgress.notes,
          bookmarks: bookmarks ?? existingProgress.bookmarks,
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
      
      // 创建新进度记录（使用验证后的数据）
      learningProgress = await prisma.learningProgress.create({
        data: {
          userId: payload.userId,
          pathId: requestedPath?.id ?? null,
          moduleId: finalModuleId,
          chapterId: normalizedChapterId,
          progress: actualCompletion,
          timeSpent: acceptedTimeIncrement,
          status: isCompleted ? 'COMPLETED' : 'IN_PROGRESS',
          startedAt: new Date(),
          completedAt: isCompleted ? new Date() : null,
          notes: notes ?? null,
          bookmarks: bookmarks ?? null,
        }
      });
    }

    // 简化路径更新逻辑 - 仅在必要时更新
    // 移除复杂的路径状态检查以提高性能

    // 简化积分逻辑 - 仅基本奖励
    let pointsEarned = 0;
    const newAchievements: unknown[] = [];

    // 仅在完成章节时给予基本积分（使用事务确保数据一致性）
    if (learningProgress.status === 'COMPLETED' && existingProgress?.status !== 'COMPLETED') {
      pointsEarned = POINTS_CONFIG.COMPLETE_CHAPTER;

      // 确定性主键保证并发完成同一章节时只奖励一次。
      const pointsTransactionId = `pt_${createHash('sha256')
        .update(`${payload.userId}:${finalModuleId}:${normalizedChapterId}:complete`)
        .digest('hex')
        .slice(0, 28)}`;
      try {
        await prisma.$transaction([
          prisma.userPointsTransaction.create({
            data: {
              id: pointsTransactionId,
              userId: payload.userId,
              points: pointsEarned,
              type: 'COMPLETE_CHAPTER',
              description: `完成章节 ${normalizedChapterId}`,
              metadata: JSON.stringify({ moduleId: finalModuleId, chapterId: normalizedChapterId })
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
      } catch (pointsError) {
        if (!isUniqueConstraintError(pointsError)) throw pointsError;
        pointsEarned = 0;
      }
    }

    // 移除用户活动记录以提高性能

    const achievementPoints = 0;

    try {
      const classId = await getActiveClassIdForUser(payload.userId);
      const learningEvent = normalizeLearningEventInput({
        eventType: isCompleted ? 'COMPLETE_CHAPTER' : 'UPDATE_PROGRESS',
        targetType: 'CHAPTER',
        targetId: normalizedChapterId,
        moduleId: finalModuleId,
        chapterId: normalizedChapterId,
        duration: acceptedTimeIncrement,
        progress: acceptedReadingProgress,
        // 由服务器根据客户端报告的会话累计时长反推会话起点，
        // 用于下一次请求去重；不接受客户端自行提交的时间戳。
        clientTime: new Date(receivedAt.getTime() - validatedTimeSpent * 1000),
        metadata: {
          ...(isRecord(data.metadata) ? data.metadata : {}),
          source: 'learning-progress-api',
          action: data.action,
          resultSummary: `acceptedTimeIncrement=${acceptedTimeIncrement};reportedSessionSeconds=${validatedTimeSpent}`,
        },
      }, normalizedChapterId);

      if (learningEvent) {
        const receiptId = `lp_${createHash('sha256')
          .update([
            payload.userId,
            normalizedChapterId,
            receivedAt.toISOString(),
            String(acceptedTimeIncrement),
            String(acceptedReadingProgress),
          ].join(':'))
          .digest('hex')
          .slice(0, 28)}`;
        await prisma.learningEvent.create({
          data: {
            id: receiptId,
            userId: payload.userId,
            classId,
            ...learningEvent,
          },
        });
      }
    } catch (eventError) {
      console.error('记录学习行为失败:', eventError);
    }
    
    // 清除超时定时器
    clearTimeout(timeoutId);
    
    return NextResponse.json({
      success: true,
      progress: {
        ...learningProgress,
        isCompleted: learningProgress.status === 'COMPLETED'
      },
      message: '学习进度已更新',
      pointsEarned,
      completionCriteria,
      completionPercentage: actualCompletion,
      acceptedIncrement: {
        timeSpent: acceptedTimeIncrement,
        readingProgress: acceptedReadingProgress - previousReadingProgress,
      },
      clientReportedExercises: {
        completed: validatedExercisesCompleted,
        total: validatedTotalExercises,
        authoritativeForCompletion: false,
      },
      isCompleted: learningProgress.status === 'COMPLETED',
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
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsedFilters = learningProgressFilterSchema.safeParse({
      pathId: searchParams.get('pathId') ?? undefined,
      moduleId: searchParams.get('moduleId') ?? undefined,
      chapterId: searchParams.get('chapterId') ?? undefined,
    });
    if (!parsedFilters.success) {
      return NextResponse.json({ error: '查询参数格式无效' }, { status: 400 });
    }
    const { pathId, moduleId, chapterId } = parsedFilters.data;
    const asOf = new Date();

    const where: Prisma.LearningProgressWhereInput = {
      userId: payload.userId,
      lastAccessAt: { lte: asOf },
    };
    if (pathId) where.pathId = pathId;
    if (moduleId) where.moduleId = moduleId;
    if (chapterId) where.chapterId = chapterId;

    // 构建查询选项
    const queryOptions: Prisma.LearningProgressFindManyArgs = {
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
    const progressWithCompletion = progress.map((item) => ({
      ...item,
      isCompleted: item.status === 'COMPLETED'
    }));

    // 计算总体统计
    const stats = {
      totalModules: progress.length,
      completedModules: progress.filter((item) => item.status === 'COMPLETED').length,
      inProgressModules: progress.filter((item) => item.status === 'IN_PROGRESS').length,
      totalTimeSpent: progress.reduce((sum, item) => sum + item.timeSpent, 0),
      averageProgress: progress.length > 0 
        ? Math.round(progress.reduce((sum, item) => sum + item.progress, 0) / progress.length)
        : 0
    };

    return NextResponse.json({
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: asOf.toISOString(),
      sampleSize: { learningProgressRecords: progress.length },
      progress: progressWithCompletion,
      stats
    }, { headers: { 'Cache-Control': 'private, no-store' } });

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
