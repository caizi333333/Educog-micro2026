import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getInitialTaskRemediationWeakAreas,
  getTaskEvidenceEventType,
  isManualTaskStep,
  isValidRemediationCompletionEvidence,
  parseLearningTaskSteps,
  validateAddressingAnimationCompletionEvidence,
  validateAddressingGraphCompletionEvidence,
} from '@/lib/lesson-tasks';

class ActivePathConflictError extends Error {
  constructor(readonly activePathId: string) {
    super('ACTIVE_PATH_EXISTS');
  }
}

function isRetryableTransactionError(value: unknown): boolean {
  return typeof value === 'object' && value !== null
    && 'code' in value
    && (value as { code?: unknown }).code === 'P2034';
}

const optionalTrimmedString = (maxLength: number) => z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).max(maxLength).optional());

const saveLearningPathSchema = z.object({
  action: z.literal('COMPLETE_TASK_STEP').optional(),
  pathId: optionalTrimmedString(128),
  stepId: optionalTrimmedString(128),
  name: optionalTrimmedString(200),
  description: optionalTrimmedString(2_000),
  modules: optionalTrimmedString(500_000),
  totalModules: z.preprocess(
    (value) => value === undefined || value === null || value === '' ? undefined : value,
    z.coerce.number().int().min(0).max(1000).optional(),
  ),
  weakAreas: z.array(z.unknown()).max(100).nullish(),
  replaceExisting: z.boolean().nullish().transform((value) => value ?? false),
});

function isTaskEvidenceMetadata(value: unknown): value is { pathId: string; stepId: string } {
  if (typeof value !== 'object' || value === null) return false;
  const metadata = value as Record<string, unknown>;
  return typeof metadata.pathId === 'string' && typeof metadata.stepId === 'string';
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // 验证用户身份
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const rawData: unknown = await request.json().catch((): null => null);
    const parsedData = saveLearningPathSchema.safeParse(rawData);
    if (!parsedData.success) {
      return NextResponse.json({ error: '学习路径参数格式无效' }, { status: 400 });
    }
    const data = parsedData.data;
    if (data.action === 'COMPLETE_TASK_STEP') {
      const pathId = data.pathId ?? '';
      const stepId = data.stepId ?? '';
      if (!pathId || !stepId) {
        return NextResponse.json({ error: '缺少学习路径或步骤编号' }, { status: 400 });
      }

      const path = await prisma.learningPath.findFirst({
        where: { id: pathId, userId: payload.userId },
        select: { id: true, modules: true, currentModule: true, totalModules: true, status: true, startedAt: true },
      });
      if (!path) return NextResponse.json({ error: '学习路径不存在' }, { status: 404 });

      const steps = parseLearningTaskSteps(path.modules);
      const requestedIndex = steps.findIndex((step) => step.stepId === stepId);
      if (requestedIndex < 0) return NextResponse.json({ error: '学习步骤不存在' }, { status: 404 });
      if (requestedIndex < path.currentModule) {
        return NextResponse.json({ success: true, alreadyCompleted: true, currentModule: path.currentModule, status: path.status });
      }
      if (path.status !== 'ACTIVE' || requestedIndex !== path.currentModule) {
        return NextResponse.json({ error: '请先完成当前学习步骤' }, { status: 409 });
      }

      const currentStep = steps[path.currentModule];
      if (!currentStep || !isManualTaskStep(currentStep)) {
        return NextResponse.json({ error: '本步骤需由测评或实验结果自动判定，不能手动完成' }, { status: 409 });
      }

      const evidenceAction = getTaskEvidenceEventType(currentStep) === 'RESOURCE_COMPLETED'
        ? 'resource-complete'
        : 'resource-open';
      const evidenceId = `le_${createHash('sha256')
        .update(`${payload.userId}:${evidenceAction}:${path.id}:${currentStep.stepId}`)
        .digest('hex')
        .slice(0, 28)}`;
      const resourceEvent = await prisma.learningEvent.findFirst({
        where: {
          id: evidenceId,
          userId: payload.userId,
          eventType: getTaskEvidenceEventType(currentStep),
          targetId: currentStep.targetId,
          createdAt: { gte: path.startedAt },
        },
        select: { metadata: true },
      });
      let resourceMetadata: unknown = null;
      const hasVisitEvidence = (() => {
        if (!resourceEvent) return false;
        try {
          const metadata: unknown = JSON.parse(resourceEvent.metadata ?? '{}');
          resourceMetadata = metadata;
          return isTaskEvidenceMetadata(metadata)
            && metadata.pathId === path.id
            && metadata.stepId === currentStep.stepId;
        } catch {
          return false;
        }
      })();
      if (!hasVisitEvidence) {
        return NextResponse.json({ error: '请先进入本步骤并完成必要学习后再确认' }, { status: 409 });
      }
      if (currentStep.type === 'GRAPH') {
        const graphEvidenceError = validateAddressingGraphCompletionEvidence(resourceMetadata);
        if (graphEvidenceError) {
          return NextResponse.json({
            error: graphEvidenceError,
            code: 'GRAPH_REVIEW_INCOMPLETE',
          }, { status: 422 });
        }
      }
      if (currentStep.type === 'ANIMATION') {
        const animationEvidenceError = validateAddressingAnimationCompletionEvidence(resourceMetadata);
        if (animationEvidenceError) {
          return NextResponse.json({
            error: animationEvidenceError,
            code: 'ANIMATION_REVIEW_INCOMPLETE',
          }, { status: 422 });
        }
      }
      if (currentStep.type === 'REMEDIATION') {
        const quizId = currentStep.quizId ?? '';
        const receipts = quizId ? await prisma.userActivity.findMany({
          where: {
            userId: payload.userId,
            action: 'COMPLETE_QUIZ',
            details: { contains: `\"pathId\":\"${path.id}\"` },
          },
          select: { details: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }) : [];
        const authoritativeWeakAreas = receipts.flatMap((receipt) => {
          const weakAreas = getInitialTaskRemediationWeakAreas(receipt.details, path.id, quizId);
          return weakAreas === null ? [] : [weakAreas];
        })[0] ?? null;
        if (authoritativeWeakAreas === null) {
          return NextResponse.json({ error: '未找到该任务的专项测评记录，不能确认补学步骤' }, { status: 409 });
        }
        if (!isValidRemediationCompletionEvidence(resourceMetadata, authoritativeWeakAreas)) {
          return NextResponse.json({ error: '补学确认记录与本次专项测评薄弱项不一致，请返回补学页重新确认' }, { status: 409 });
        }
      }

      const nextModule = Math.min(path.currentModule + 1, steps.length);
      const nextStatus = nextModule >= steps.length ? 'COMPLETED' : 'ACTIVE';
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.learningPath.updateMany({
          where: { id: path.id, userId: payload.userId, status: 'ACTIVE', currentModule: path.currentModule },
          data: { currentModule: nextModule, status: nextStatus, completedAt: nextStatus === 'COMPLETED' ? new Date() : null },
        });
        if (result.count === 0) return null;
        await tx.userActivity.create({
          data: {
            userId: payload.userId,
            action: 'COMPLETE_TASK_STEP',
            details: JSON.stringify({ pathId: path.id, stepId: currentStep.stepId, stepType: currentStep.type, targetId: currentStep.targetId }),
          },
        });
        return { currentModule: nextModule, status: nextStatus };
      });
      if (!updated) {
        const latestPath = await prisma.learningPath.findFirst({
          where: { id: path.id, userId: payload.userId },
          select: { currentModule: true, status: true },
        });
        if (latestPath && latestPath.currentModule > requestedIndex) {
          return NextResponse.json({
            success: true,
            alreadyCompleted: true,
            currentModule: latestPath.currentModule,
            status: latestPath.status,
          });
        }
        return NextResponse.json({ error: '步骤状态已变化，请刷新后重试' }, { status: 409 });
      }
      return NextResponse.json({ success: true, ...updated });
    }

    const { name, description, modules, totalModules, weakAreas } = data;
    const normalizedWeakAreas = (weakAreas ?? [])
      .filter((value): value is string => typeof value === 'string')
      .slice(0, 100);

    // 检查是否已有活跃的学习路径
    const existingPath = await prisma.learningPath.findFirst({
      where: {
        userId: payload.userId,
        status: 'ACTIVE'
      }
    });

    if (existingPath && !data.replaceExisting) {
      return NextResponse.json({
        error: '已有进行中的学习路径，请确认替换后重试',
        code: 'ACTIVE_PATH_EXISTS',
        requiresConfirmation: true,
        activePathId: existingPath.id,
      }, { status: 409 });
    }

    let learningPath: Awaited<ReturnType<typeof prisma.learningPath.create>> | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        learningPath = await prisma.$transaction(async (tx) => {
          // 事务内再次检查，避免两个请求同时通过外层检查后创建多个 ACTIVE 路径。
          const concurrentPath = await tx.learningPath.findFirst({
            where: { userId: payload.userId, status: 'ACTIVE' },
            select: { id: true },
          });
          if (concurrentPath && !data.replaceExisting) {
            throw new ActivePathConflictError(concurrentPath.id);
          }
          if (concurrentPath) {
            await tx.learningPath.updateMany({
              where: { userId: payload.userId, status: 'ACTIVE' },
              data: { status: 'PAUSED' },
            });
          }
          const createdPath = await tx.learningPath.create({
            data: {
              userId: payload.userId,
              name: name ?? '个性化学习计划',
              description: description ?? '基于测评结果的个性化学习计划',
              modules: modules ?? '[]',
              currentModule: 0,
              totalModules: totalModules ?? 0,
              status: 'ACTIVE',
            },
          });
          await tx.userActivity.create({
            data: {
              userId: payload.userId,
              action: 'CREATE_LEARNING_PATH',
              details: JSON.stringify({ pathId: createdPath.id, weakAreas: normalizedWeakAreas }),
            },
          });
          return createdPath;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (transactionError) {
        if (isRetryableTransactionError(transactionError) && attempt < 3) continue;
        throw transactionError;
      }
    }
    if (!learningPath) throw new Error('学习路径事务未返回结果');

    return NextResponse.json({
      success: true,
      pathId: learningPath.id,
      message: '学习路径已保存'
    });

  } catch (error) {
    if (error instanceof ActivePathConflictError) {
      return NextResponse.json({
        error: '已有进行中的学习路径，请确认替换后重试',
        code: 'ACTIVE_PATH_EXISTS',
        requiresConfirmation: true,
        activePathId: error.activePathId,
      }, { status: 409 });
    }
    console.error('保存学习路径失败:', error);
    return NextResponse.json({ 
      error: '保存学习路径失败'
    }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    // 验证用户身份
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
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
      error: '获取学习路径失败'
    }, { status: 500 });
  }
}
