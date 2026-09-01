import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getActiveClassIdForUser, normalizeLearningEventInput, type LearningEventInput } from '@/lib/classroom';
import { createHash } from 'node:crypto';
import {
  getInitialTaskRemediationWeakAreas,
  getTaskEvidenceEventType,
  isValidRemediationCompletionEvidence,
  parseLearningTaskSteps,
  validateAddressingAnimationCompletionEvidence,
  validateAddressingGraphCompletionEvidence,
} from '@/lib/lesson-tasks';

const learningEventSchema = z.object({
  clientEventId: z.string(),
  eventType: z.unknown().optional(),
  targetType: z.unknown().optional(),
  targetId: z.unknown().optional(),
  moduleId: z.unknown().optional(),
  chapterId: z.unknown().optional(),
  experimentId: z.unknown().optional(),
  quizId: z.unknown().optional(),
  duration: z.unknown().optional(),
  progress: z.unknown().optional(),
  clientTime: z.unknown().optional(),
  metadata: z.unknown().optional(),
});

const learningEventBatchSchema = z.object({
  token: z.string().optional(),
  events: z.array(learningEventSchema).max(100),
});

type NormalizedLearningEvent = NonNullable<ReturnType<typeof normalizeLearningEventInput>>;
type TaskPathSnapshot = { id: string; status: string; modules: string; currentModule: number } | null;
type EventRejection = { error: string; code: string; status: number };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function eventFingerprint(event: Record<string, unknown>): string {
  let metadata: unknown = event.metadata ?? null;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { /* keep legacy string */ }
  }
  return createHash('sha256').update(JSON.stringify(canonicalize({
    eventType: event.eventType,
    targetType: event.targetType,
    targetId: event.targetId,
    moduleId: event.moduleId ?? null,
    chapterId: event.chapterId ?? null,
    experimentId: event.experimentId ?? null,
    quizId: event.quizId ?? null,
    duration: event.duration ?? null,
    progress: event.progress ?? null,
    clientTime: event.clientTime instanceof Date ? event.clientTime.toISOString() : event.clientTime ?? null,
    metadata,
  }))).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function taskContextOf(value: unknown): { pathId: string; stepId: string } | null {
  if (!isRecord(value)) return null;
  const pathId = typeof value.pathId === 'string' ? value.pathId.trim() : '';
  const stepId = typeof value.stepId === 'string' ? value.stepId.trim() : '';
  return pathId && stepId ? { pathId, stepId } : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody: unknown = await request.json().catch((): null => null);
    const parsedBody = learningEventBatchSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ error: '学习行为参数格式无效' }, { status: 400 });
    }
    const body = parsedBody.data;
    const authorization = request.headers.get('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.substring(7)
      : typeof body.token === 'string'
        ? body.token
        : '';

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    const events = body.events;
    if (events.length === 0) {
      return NextResponse.json({ error: 'events 不能为空' }, { status: 400 });
    }

    const classId = await getActiveClassIdForUser(payload.userId);
    const normalized: Array<NormalizedLearningEvent & {
      id: string;
      userId: string;
      classId: string | null;
    }> = [];
    const taskPathCache = new Map<string, TaskPathSnapshot>();
    const remediationWeakAreasCache = new Map<string, string[] | null>();
    let taskRejection: EventRejection | null = null;
    for (const rawEvent of events) {
      const eventInput: LearningEventInput = rawEvent;
      const event = normalizeLearningEventInput(eventInput);
      const clientEventId = rawEvent.clientEventId.trim();
      if (!event || !/^[A-Za-z0-9:_-]{8,160}$/.test(clientEventId)) continue;

      const taskContext = (event.eventType === 'RESOURCE_OPENED' || event.eventType === 'RESOURCE_COMPLETED')
        ? taskContextOf(rawEvent.metadata)
        : null;
      const declaresTaskScopedId = /^resource-(?:open|complete):/.test(clientEventId);
      if (declaresTaskScopedId && !taskContext) continue;
      if (taskContext) {
        let path: TaskPathSnapshot | undefined = taskPathCache.get(taskContext.pathId);
        if (path === undefined) {
          path = await prisma.learningPath.findFirst({
            where: { id: taskContext.pathId, userId: payload.userId },
            select: { id: true, status: true, modules: true, currentModule: true },
          });
          taskPathCache.set(taskContext.pathId, path);
        }
        if (path?.status === 'COMPLETED') {
          taskRejection = {
            error: '任务已完成，当前页面仅供回看，无需重复保存学习记录',
            code: 'TASK_PATH_COMPLETED',
            status: 409,
          };
          continue;
        }
        const steps = path ? parseLearningTaskSteps(path.modules) : [];
        const currentStep = path?.status === 'ACTIVE' ? steps[path.currentModule] : undefined;
        const completionEventMatches = event.eventType !== 'RESOURCE_COMPLETED'
          || (currentStep && getTaskEvidenceEventType(currentStep) === 'RESOURCE_COMPLETED');
        if (!currentStep
          || currentStep.stepId !== taskContext.stepId
          || currentStep.targetId !== event.targetId
          || currentStep.type !== event.targetType
          || !completionEventMatches) {
          continue;
        }
        if (event.eventType === 'RESOURCE_COMPLETED' && currentStep.type === 'GRAPH') {
          const graphEvidenceError = validateAddressingGraphCompletionEvidence(rawEvent.metadata);
          if (graphEvidenceError) {
            return NextResponse.json({
              error: graphEvidenceError,
              code: 'GRAPH_REVIEW_INCOMPLETE',
            }, { status: 422 });
          }
        }
        if (event.eventType === 'RESOURCE_COMPLETED' && currentStep.type === 'ANIMATION') {
          const animationEvidenceError = validateAddressingAnimationCompletionEvidence(rawEvent.metadata);
          if (animationEvidenceError) {
            return NextResponse.json({
              error: animationEvidenceError,
              code: 'ANIMATION_REVIEW_INCOMPLETE',
            }, { status: 422 });
          }
        }
        if (event.eventType === 'RESOURCE_COMPLETED' && currentStep.type === 'REMEDIATION') {
          const quizId = currentStep.quizId ?? '';
          const receiptKey = `${taskContext.pathId}:${quizId}`;
          let authoritativeWeakAreas = remediationWeakAreasCache.get(receiptKey);
          if (authoritativeWeakAreas === undefined) {
            const receipts = quizId ? await prisma.userActivity.findMany({
              where: {
                userId: payload.userId,
                action: 'COMPLETE_QUIZ',
                details: { contains: `\"pathId\":\"${taskContext.pathId}\"` },
              },
              select: { details: true },
              orderBy: { createdAt: 'desc' },
              take: 20,
            }) : [];
            authoritativeWeakAreas = receipts.flatMap((receipt) => {
              const weakAreas = getInitialTaskRemediationWeakAreas(receipt.details, taskContext.pathId, quizId);
              return weakAreas === null ? [] : [weakAreas];
            })[0] ?? null;
            remediationWeakAreasCache.set(receiptKey, authoritativeWeakAreas);
          }
          if (authoritativeWeakAreas === null) {
            taskRejection = {
              error: '未找到该任务的专项测评记录，不能保存补学完成状态',
              code: 'REMEDIATION_RECEIPT_MISSING',
              status: 409,
            };
            continue;
          }
          if (!isValidRemediationCompletionEvidence(rawEvent.metadata, authoritativeWeakAreas)) {
            taskRejection = {
              error: authoritativeWeakAreas.length > 0
                ? '请完成并确认本次专项测评列出的全部薄弱项后再保存'
                : '请先确认本次测评未识别到薄弱项后再保存',
              code: 'REMEDIATION_REVIEW_INCOMPLETE',
              status: 409,
            };
            continue;
          }
        }
      }

      const id = `le_${createHash('sha256').update(`${payload.userId}:${clientEventId}`).digest('hex').slice(0, 28)}`;
      normalized.push({ id, userId: payload.userId, classId, ...event });
    }

    if (normalized.length === 0) {
      if (taskRejection) {
        return NextResponse.json({ error: taskRejection.error, code: taskRejection.code }, { status: taskRejection.status });
      }
      return NextResponse.json({ error: '没有可保存的有效事件' }, { status: 400 });
    }

    const uniqueById = new Map<string, typeof normalized[number]>();
    for (const event of normalized) {
      const existing = uniqueById.get(event.id);
      if (existing && eventFingerprint(existing) !== eventFingerprint(event)) {
        return NextResponse.json({
          error: '同一学习事件编号对应了不同内容',
          code: 'IDEMPOTENCY_CONFLICT',
        }, { status: 409 });
      }
      if (!existing) uniqueById.set(event.id, event);
    }
    const uniqueEvents = [...uniqueById.values()];
    const persistedEvents = await prisma.learningEvent.findMany({
      where: { id: { in: uniqueEvents.map((event) => event.id) }, userId: payload.userId },
      select: {
        id: true, eventType: true, targetType: true, targetId: true, moduleId: true, chapterId: true,
        experimentId: true, quizId: true, duration: true, progress: true, clientTime: true, metadata: true,
      },
    }) ?? [];
    for (const persisted of persistedEvents) {
      const incoming = uniqueById.get(persisted.id);
      if (incoming && eventFingerprint(persisted) !== eventFingerprint(incoming)) {
        return NextResponse.json({
          error: '同一学习事件编号已用于其他内容',
          code: 'IDEMPOTENCY_CONFLICT',
        }, { status: 409 });
      }
    }

    const created = await prisma.learningEvent.createMany({ data: uniqueEvents, skipDuplicates: true });
    if (created.count < uniqueEvents.length) {
      // 并发请求可能在首次查询之后才写入同一主键；再次核对内容，避免把冲突误报为普通重复。
      const reconciledEvents = await prisma.learningEvent.findMany({
        where: { id: { in: uniqueEvents.map((event) => event.id) }, userId: payload.userId },
        select: {
          id: true, eventType: true, targetType: true, targetId: true, moduleId: true, chapterId: true,
          experimentId: true, quizId: true, duration: true, progress: true, clientTime: true, metadata: true,
        },
      }) ?? [];
      const reconciledById = new Map(reconciledEvents.map((event) => [event.id, event]));
      for (const incoming of uniqueEvents) {
        const persisted = reconciledById.get(incoming.id);
        if (!persisted) {
          return NextResponse.json({
            error: '学习事件回执暂不可确认，请重试',
            code: 'EVENT_RECEIPT_UNAVAILABLE',
            retryable: true,
          }, { status: 503 });
        }
        if (eventFingerprint(persisted) !== eventFingerprint(incoming)) {
          return NextResponse.json({
            error: '同一学习事件编号已用于其他内容',
            code: 'IDEMPOTENCY_CONFLICT',
          }, { status: 409 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      accepted: created.count,
      duplicates: normalized.length - created.count,
      ignored: events.length - normalized.length,
    });
  } catch (error) {
    console.error('保存学习行为失败:', error);
    return NextResponse.json({ error: '保存学习行为失败' }, { status: 500 });
  }
}
