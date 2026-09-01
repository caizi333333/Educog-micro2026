import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getActiveClassIdForUser, normalizeLearningEventInput } from '@/lib/classroom';
import { parseLearningTaskSteps } from '@/lib/lesson-tasks';
import {
  experiments as experimentCatalog,
  getExperimentConfig,
  hasProj04TelemetryFrame,
  isProj04MilestoneEvidenceComplete,
  normalizeProj04CompletionEvidence,
  PROJ04_MILESTONE_IDS,
  PROJ04_MIN_OBSERVATION_STEPS,
  type Proj04CompletionEvidence,
} from '@/lib/experiment-config';

const OFFICIAL_EXPERIMENT_IDS = experimentCatalog.map((experiment) => experiment.id);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUniqueConstraintError(value: unknown): boolean {
  return isRecord(value) && value.code === 'P2002';
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function completionRequestFingerprint(input: {
  experimentId: string;
  pathId: string;
  stepId: string;
  code: unknown;
  results: unknown;
}): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(input))).digest('hex');
}

function completionContextsOf(results: Record<string, unknown>): Record<string, unknown>[] {
  const contexts: Record<string, unknown>[] = [];
  if (Array.isArray(results.completionHistory)) {
    for (const item of results.completionHistory) {
      if (isRecord(item)) contexts.push(item);
    }
  }
  // 历史数组按完成时间递增；当前上下文放在最后，避免截断时误删最近一次完成。
  if (isRecord(results.completionContext)) contexts.push(results.completionContext);
  const seen = new Set<string>();
  return contexts.filter((context) => {
    const completionKey = typeof context.completionKey === 'string' ? context.completionKey : '';
    const pathId = typeof context.pathId === 'string' ? context.pathId : '';
    const stepId = typeof context.stepId === 'string' ? context.stepId : '';
    const key = completionKey || (pathId ? `legacy:${pathId}:${stepId}` : '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function completionReceiptOf(details: string | null | undefined): Record<string, unknown> | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function completionReceiptMatches(receipt: Record<string, unknown> | null, expected: {
  experimentId: string;
  completionKey: string;
  pathId: string;
  stepId: string;
  requestFingerprint: string;
}): boolean {
  if (!receipt) return false;
  const receiptFingerprint = typeof receipt.requestFingerprint === 'string' ? receipt.requestFingerprint : '';
  return receipt.experimentId === expected.experimentId
    && receipt.completionKey === expected.completionKey
    && (typeof receipt.pathId === 'string' ? receipt.pathId : '') === expected.pathId
    && (typeof receipt.stepId === 'string' ? receipt.stepId : '') === expected.stepId
    && (!receiptFingerprint || receiptFingerprint === expected.requestFingerprint);
}

type CompletionValidation = {
  ok: true;
  coveredModes: string[];
  projectCompletion: Proj04CompletionEvidence | null;
} | {
  ok: false;
  error: string;
};

function validateCompletion(
  experimentId: string,
  code: unknown,
  results: unknown,
  persistedResults: Record<string, unknown>,
): CompletionValidation {
  const result = isRecord(results) ? results : null;
  const execution = isRecord(result?.execution) ? result.execution : null;
  const exp02ObservationComplete = experimentId === 'exp02' && execution?.observationComplete === true;
  const proj04ObservationComplete = experimentId === 'proj04' && execution?.observationComplete === true;
  if (result?.success !== true
    || (execution?.terminated !== true && !exp02ObservationComplete && !proj04ObservationComplete)
    || execution?.faultFree !== true) {
    return {
      ok: false,
      error: experimentId === 'proj04'
        ? 'proj04 必须无故障运行并形成有效观测记录；持续循环无需执行到 END'
        : '程序必须无故障运行至正常结束后才能完成实验',
    };
  }
  if (typeof execution.traceSteps !== 'number' || !Number.isInteger(execution.traceSteps) || execution.traceSteps < 1) {
    return { ok: false, error: '缺少可复核的指令执行记录' };
  }
  if (exp02ObservationComplete && execution.traceSteps < 20) {
    return { ok: false, error: 'exp02 至少执行 20 条指令后才能形成有效观察记录' };
  }
  if (experimentId === 'proj04') {
    if (execution.traceSteps < PROJ04_MIN_OBSERVATION_STEPS) {
      return { ok: false, error: `proj04 至少执行 ${PROJ04_MIN_OBSERVATION_STEPS} 条指令后才能形成有效观察记录` };
    }
    const projectObservation = isRecord(result?.projectObservation) ? result.projectObservation : null;
    if (!hasProj04TelemetryFrame(projectObservation?.uartTail)) {
      return { ok: false, error: 'proj04 尚未观察到同时包含 temp 与 humi 的完整串口遥测帧' };
    }
    const projectCompletion = normalizeProj04CompletionEvidence(persistedResults.projectCompletion);
    if (!isProj04MilestoneEvidenceComplete(projectCompletion)) {
      return { ok: false, error: '请先在教程中完成五个项目里程碑的证据自检并确认保存' };
    }
    return { ok: true, coveredModes: [], projectCompletion };
  }
  if (experimentId !== 'exp02') return { ok: true, coveredModes: [], projectCompletion: null };

  const source = typeof code === 'string' ? code.toUpperCase().replace(/;.*$/gm, '') : '';
  const checks: Array<[string, RegExp]> = [
    ['立即寻址', /#[0-9A-F]+H?\b/],
    ['直接寻址', /\bMOV\s+(?:A|R[0-7]|[0-9A-F]+H)\s*,\s*(?!#|@|R[0-7]\b)[0-9A-F]+H\b/],
    ['寄存器寻址', /\b(?:MOV|ADD|SUBB|ANL|ORL|XRL)\s+(?:A|R[0-7])\s*,\s*R[0-7]\b/],
    ['寄存器间接寻址', /@(?:R0|R1|DPTR)\b/],
    ['变址寻址', /\bMOVC\s+A\s*,\s*@A\+(?:DPTR|PC)\b/],
  ];
  const coveredModes = checks.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
  if (coveredModes.length < checks.length) {
    const missing = checks.map(([name]) => name).filter((name) => !coveredModes.includes(name));
    return { ok: false, error: `exp02 尚未覆盖规定的五种数据寻址方式：${missing.join('、')}` };
  }
  return { ok: true, coveredModes, projectCompletion: null };
}

type SimulationTaskContext = {
  pathId: string;
  stepId: string;
  currentModule: number;
  totalSteps: number;
};

async function advanceSimulationTask(
  client: Pick<Prisma.TransactionClient, 'learningPath' | 'userActivity'>,
  userId: string,
  experimentId: string,
  completionKey: string,
  taskContext: SimulationTaskContext,
  completedAt: Date,
): Promise<number> {
  const nextModule = Math.min(taskContext.currentModule + 1, taskContext.totalSteps);
  const nextStatus = nextModule >= taskContext.totalSteps ? 'COMPLETED' : 'ACTIVE';
  const changed = await client.learningPath.updateMany({
    where: {
      id: taskContext.pathId,
      userId,
      status: 'ACTIVE',
      currentModule: taskContext.currentModule,
    },
    data: {
      currentModule: nextModule,
      status: nextStatus,
      completedAt: nextStatus === 'COMPLETED' ? completedAt : null,
    },
  });
  if (changed.count > 0) {
    await client.userActivity.create({
      data: {
        userId,
        action: 'COMPLETE_TASK_STEP',
        details: JSON.stringify({
          pathId: taskContext.pathId,
          stepId: taskContext.stepId,
          stepType: 'SIMULATION',
          targetId: experimentId,
          completionKey,
        }),
      },
    });
  }
  return changed.count;
}

const optionalTrimmedString = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).optional());

const experimentSaveSchema = z.object({
  experimentId: optionalTrimmedString,
  intent: z.enum(['SAVE', 'START', 'DRAFT', 'PROJECT_CHECKLIST']).optional().default('SAVE'),
  code: z.string().max(500_000).nullish(),
  results: z.unknown().optional(),
  timeSpent: z.preprocess(
    (value) => value === undefined || value === null || value === '' ? undefined : value,
    z.coerce.number().int().min(0).max(24 * 60 * 60).optional(),
  ),
  status: z.enum(['IN_PROGRESS', 'COMPLETED']).nullish().transform((value) => value ?? 'IN_PROGRESS'),
  pathId: optionalTrimmedString,
  stepId: optionalTrimmedString,
  completionKey: optionalTrimmedString,
  baseUpdatedAt: z.string().datetime({ offset: true }).optional(),
});

const projectChecklistInputSchema = z.object({
  version: z.literal(1),
  milestones: z.array(z.object({
    id: z.enum(PROJ04_MILESTONE_IDS),
    confirmed: z.boolean(),
  }).strict()).length(PROJ04_MILESTONE_IDS.length),
}).strict().superRefine((value, context) => {
  const ids = value.milestones.map((item) => item.id);
  if (new Set(ids).size !== PROJ04_MILESTONE_IDS.length
    || PROJ04_MILESTONE_IDS.some((id) => !ids.includes(id))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: '项目里程碑编号不完整' });
  }
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证令牌' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const rawData: unknown = await request.json().catch((): null => null);
    const parsedData = experimentSaveSchema.safeParse(rawData);
    if (!parsedData.success) {
      return NextResponse.json({ error: '实验记录参数格式无效' }, { status: 400 });
    }
    const data = parsedData.data;
    if (!data.experimentId) {
      return NextResponse.json({ error: '缺少实验ID' }, { status: 400 });
    }
    if (data.experimentId.length > 128) {
      return NextResponse.json({ error: '实验ID超出长度限制' }, { status: 400 });
    }
    if (!getExperimentConfig(data.experimentId)) {
      return NextResponse.json({ error: '实验编号不存在' }, { status: 400 });
    }
    const { 
      experimentId, 
      intent,
      code, 
      results, 
      timeSpent,
      status = 'IN_PROGRESS'
    } = data;
    const requestedPathId = data.pathId ?? '';
    const requestedStepId = data.stepId ?? '';
    const completionKey = data.completionKey ?? '';

    if (Boolean(requestedPathId) !== Boolean(requestedStepId)) {
      return NextResponse.json({ error: '实验任务上下文不完整，请从任务页重新进入' }, { status: 400 });
    }

    if (status === 'COMPLETED' && !/^[A-Za-z0-9:_-]{12,200}$/.test(completionKey)) {
      return NextResponse.json({ error: '实验完成请求缺少有效的幂等编号' }, { status: 400 });
    }
    const requestFingerprint = status === 'COMPLETED'
      ? completionRequestFingerprint({
          experimentId,
          pathId: requestedPathId,
          stepId: requestedStepId,
          code: code ?? null,
          results: results ?? null,
        })
      : '';
    const completionActivityId = status === 'COMPLETED'
      ? `ea_${createHash('sha256')
        .update(`${payload.userId}:${experimentId}:${completionKey}`)
        .digest('hex')
        .slice(0, 28)}`
      : '';

    // 查找或创建实验记录
    let experiment = await prisma.userExperiment.findUnique({
      where: {
        userId_experimentId: {
          userId: payload.userId,
          experimentId: experimentId
        }
      }
    });

    // proj04 的五个里程碑是学生对既有证据的显式自检。每次只把标准化
    // 状态合并进 UserExperiment.results，不改变已完成记录、代码或尝试次数。
    if (intent === 'PROJECT_CHECKLIST') {
      if (experimentId !== 'proj04') {
        return NextResponse.json({ error: '项目里程碑自检仅适用于 proj04' }, { status: 400 });
      }
      const resultRecord = isRecord(results) ? results : null;
      const checklistInput = projectChecklistInputSchema.safeParse(resultRecord?.projectCompletion);
      if (!checklistInput.success) {
        return NextResponse.json({ error: '项目里程碑自检数据不完整' }, { status: 400 });
      }

      let previousResults: Record<string, unknown> = {};
      try {
        const parsedResults: unknown = experiment?.results ? JSON.parse(experiment.results) : {};
        if (isRecord(parsedResults)) previousResults = parsedResults;
      } catch { /* legacy result */ }
      const previousCompletion = normalizeProj04CompletionEvidence(previousResults.projectCompletion);
      const incomingById = new Map(checklistInput.data.milestones.map((item) => [item.id, item.confirmed]));
      const unchanged = PROJ04_MILESTONE_IDS.every((id) =>
        previousCompletion.milestones.find((item) => item.id === id)?.confirmed === incomingById.get(id));
      if (experiment && unchanged) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          experiment: {
            id: experiment.id,
            experimentId,
            status: experiment.status,
            updatedAt: experiment.updatedAt.toISOString(),
          },
          projectCompletion: previousCompletion,
          message: '项目里程碑自检状态已保存',
        }, { headers: { 'Cache-Control': 'private, no-store' } });
      }

      const now = new Date();
      const timestamp = now.toISOString();
      const projectCompletion: Proj04CompletionEvidence = {
        version: 1,
        milestones: PROJ04_MILESTONE_IDS.map((id) => {
          const confirmed = incomingById.get(id) === true;
          const previous = previousCompletion.milestones.find((item) => item.id === id);
          return {
            id,
            confirmed,
            confirmedAt: confirmed
              ? previous?.confirmed && previous.confirmedAt ? previous.confirmedAt : timestamp
              : null,
          };
        }),
        updatedAt: timestamp,
      };
      const mergedResults = JSON.stringify({ ...previousResults, projectCompletion });
      if (experiment) {
        experiment = await prisma.userExperiment.update({
          where: { id: experiment.id },
          data: {
            results: mergedResults,
            ...(experiment.status === 'COMPLETED' ? {} : { status: 'IN_PROGRESS' }),
            startedAt: experiment.startedAt ?? now,
            updatedAt: now,
          },
        });
      } else {
        experiment = await prisma.userExperiment.create({
          data: {
            userId: payload.userId,
            experimentId,
            status: 'IN_PROGRESS',
            results: mergedResults,
            startedAt: now,
            completedAt: null,
            timeSpent: 0,
            attempts: 0,
          },
        });
      }
      return NextResponse.json({
        success: true,
        duplicate: false,
        experiment: {
          id: experiment.id,
          experimentId,
          status: experiment.status,
          updatedAt: experiment.updatedAt.toISOString(),
        },
        projectCompletion,
        message: '项目里程碑自检状态已保存',
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    // 草稿保存使用 updatedAt 作为乐观并发版本。两个页面从同一版本开始编辑时，
    // 只有首个保存能够命中；后续请求返回服务端草稿供学生明确选择，不能静默覆盖。
    if (intent === 'DRAFT') {
      if (code === undefined || code === null) {
        return NextResponse.json({ error: '草稿内容不能为空' }, { status: 400 });
      }
      if (experiment?.status === 'COMPLETED') {
        return NextResponse.json({
          success: true,
          readOnly: true,
          experiment: {
            id: experiment.id,
            experimentId,
            status: experiment.status,
          },
          draft: {
            code: experiment.lastCode ?? '',
            updatedAt: experiment.updatedAt.toISOString(),
          },
          message: '实验已完成，已提交代码不会被草稿改写',
        });
      }

      const baseUpdatedAt = data.baseUpdatedAt ? new Date(data.baseUpdatedAt) : null;
      if (experiment) {
        if (!baseUpdatedAt) {
          return NextResponse.json({
            error: '服务端已有草稿，请先核对最新版本',
            code: 'DRAFT_CONFLICT',
            serverDraft: {
              code: experiment.lastCode ?? '',
              updatedAt: experiment.updatedAt.toISOString(),
              status: experiment.status,
            },
          }, { status: 409 });
        }
        const now = new Date();
        const changed = await prisma.userExperiment.updateMany({
          where: {
            id: experiment.id,
            updatedAt: baseUpdatedAt,
            status: { not: 'COMPLETED' },
          },
          data: {
            status: 'IN_PROGRESS',
            startedAt: experiment.startedAt ?? now,
            lastCode: code,
            updatedAt: now,
          },
        });
        if (changed.count === 0) {
          const current = await prisma.userExperiment.findUnique({
            where: { userId_experimentId: { userId: payload.userId, experimentId } },
          });
          if (!current) {
            return NextResponse.json({
              error: '草稿状态暂时不可用，请重新加载',
              code: 'DRAFT_STATE_UNAVAILABLE',
              retryable: true,
            }, { status: 503 });
          }
          if (current.status === 'COMPLETED') {
            return NextResponse.json({
              success: true,
              readOnly: true,
              experiment: { id: current.id, experimentId, status: current.status },
              draft: { code: current.lastCode ?? '', updatedAt: current.updatedAt.toISOString() },
              message: '实验已完成，已提交代码不会被草稿改写',
            });
          }
          return NextResponse.json({
            error: '另一个页面已保存更新，请选择要保留的草稿',
            code: 'DRAFT_CONFLICT',
            serverDraft: {
              code: current.lastCode ?? '',
              updatedAt: current.updatedAt.toISOString(),
              status: current.status,
            },
          }, { status: 409 });
        }
        const saved = await prisma.userExperiment.findUnique({
          where: { userId_experimentId: { userId: payload.userId, experimentId } },
        });
        if (!saved) {
          return NextResponse.json({
            error: '草稿已写入但回执暂时不可用，请重新加载',
            code: 'DRAFT_RECEIPT_UNAVAILABLE',
            retryable: true,
          }, { status: 503 });
        }
        return NextResponse.json({
          success: true,
          experiment: { id: saved.id, experimentId, status: saved.status },
          draft: { code: saved.lastCode ?? '', updatedAt: saved.updatedAt.toISOString() },
          message: '实验草稿已保存',
        }, { headers: { 'Cache-Control': 'private, no-store' } });
      }

      const now = new Date();
      try {
        const created = await prisma.userExperiment.create({
          data: {
            userId: payload.userId,
            experimentId,
            status: 'IN_PROGRESS',
            startedAt: now,
            completedAt: null,
            lastCode: code,
            timeSpent: 0,
            attempts: 0,
          },
        });
        return NextResponse.json({
          success: true,
          experiment: { id: created.id, experimentId, status: created.status },
          draft: { code: created.lastCode ?? '', updatedAt: created.updatedAt.toISOString() },
          message: '实验草稿已保存',
        }, { headers: { 'Cache-Control': 'private, no-store' } });
      } catch (draftCreateError) {
        if (!isUniqueConstraintError(draftCreateError)) throw draftCreateError;
        const current = await prisma.userExperiment.findUnique({
          where: { userId_experimentId: { userId: payload.userId, experimentId } },
        });
        if (!current) throw draftCreateError;
        return NextResponse.json({
          error: '另一个页面已先保存草稿，请选择要保留的版本',
          code: 'DRAFT_CONFLICT',
          serverDraft: {
            code: current.lastCode ?? '',
            updatedAt: current.updatedAt.toISOString(),
            status: current.status,
          },
        }, { status: 409 });
      }
    }

    // 已完成记录不可被“重新进入”或普通进度保存降级。学生可以回看和
    // 自主练习，但教师端与任务页仍以既有服务端完成回执为准。
    if (status === 'IN_PROGRESS' && experiment?.status === 'COMPLETED') {
      return NextResponse.json({
        success: true,
        duplicate: true,
        experiment: {
          id: experiment.id,
          experimentId,
          status: experiment.status,
          attempts: experiment.attempts,
          timeSpent: experiment.timeSpent,
          completedAt: experiment.completedAt,
        },
        message: '实验已完成，本次进入不会改变完成状态',
        pointsEarned: 0,
        newAchievements: null,
        totalPointsEarned: 0,
      });
    }

    // 从“我的任务”进入课前实验时只执行一次可恢复的状态迁移。
    // 重复刷新不会重复写行为事件，也不会增加实验完成次数。
    if (intent === 'START') {
      if (experiment?.status === 'IN_PROGRESS') {
        return NextResponse.json({
          success: true,
          duplicate: true,
          experiment: {
            id: experiment.id,
            experimentId,
            status: experiment.status,
            attempts: experiment.attempts,
            timeSpent: experiment.timeSpent,
            completedAt: experiment.completedAt,
          },
          message: '实验已处于进行中，可继续完成',
          pointsEarned: 0,
          newAchievements: null,
          totalPointsEarned: 0,
        });
      }

      const startedAt = experiment?.startedAt ?? new Date();
      let transitioned = false;
      if (experiment) {
        const changed = await prisma.userExperiment.updateMany({
          where: {
            id: experiment.id,
            status: { notIn: ['IN_PROGRESS', 'COMPLETED'] },
          },
          data: {
            status: 'IN_PROGRESS',
            startedAt,
            completedAt: null,
            ...(code !== undefined && code !== null ? { lastCode: code } : {}),
            updatedAt: new Date(),
          },
        });
        transitioned = changed.count > 0;
        if (transitioned) {
          experiment = {
            ...experiment,
            status: 'IN_PROGRESS',
            startedAt,
            completedAt: null,
            ...(code !== undefined && code !== null ? { lastCode: code } : {}),
          };
        } else {
          experiment = await prisma.userExperiment.findUnique({
            where: { userId_experimentId: { userId: payload.userId, experimentId } },
          });
        }
      } else {
        try {
          experiment = await prisma.userExperiment.create({
            data: {
              userId: payload.userId,
              experimentId,
              status: 'IN_PROGRESS',
              startedAt,
              completedAt: null,
              lastCode: code ?? null,
              timeSpent: timeSpent ?? 0,
              attempts: 0,
            },
          });
          transitioned = true;
        } catch (startError) {
          if (!isUniqueConstraintError(startError)) throw startError;
          experiment = await prisma.userExperiment.findUnique({
            where: { userId_experimentId: { userId: payload.userId, experimentId } },
          });
        }
      }

      if (!experiment) {
        return NextResponse.json({
          error: '实验开始状态暂未确认，请返回任务页后重试',
          code: 'EXPERIMENT_START_UNCONFIRMED',
          retryable: true,
        }, { status: 503 });
      }
      if (experiment.status === 'COMPLETED') {
        return NextResponse.json({
          success: true,
          duplicate: true,
          experiment: {
            id: experiment.id,
            experimentId,
            status: experiment.status,
            attempts: experiment.attempts,
            timeSpent: experiment.timeSpent,
            completedAt: experiment.completedAt,
          },
          message: '实验已完成，本次进入不会改变完成状态',
          pointsEarned: 0,
          newAchievements: null,
          totalPointsEarned: 0,
        });
      }
      if (transitioned) {
        const startEventId = `ea_${createHash('sha256')
          .update(`${payload.userId}:${experimentId}:start`)
          .digest('hex')
          .slice(0, 28)}`;
        await prisma.userActivity.createMany({
          data: [{
            id: startEventId,
            userId: payload.userId,
            action: 'START_EXPERIMENT',
            details: JSON.stringify({ experimentId, status: 'IN_PROGRESS', source: 'preclass-task' }),
          }],
          skipDuplicates: true,
        });
        const classId = await getActiveClassIdForUser(payload.userId);
        const learningEvent = normalizeLearningEventInput({
          eventType: 'START_EXPERIMENT',
          targetType: 'EXPERIMENT',
          targetId: experimentId,
          experimentId,
          metadata: { source: 'preclass-task', action: 'START_EXPERIMENT' },
        }, experimentId);
        if (learningEvent) {
          await prisma.learningEvent.createMany({
            data: [{
              id: `le_${createHash('sha256')
                .update(`${payload.userId}:${experimentId}:start`)
                .digest('hex')
                .slice(0, 28)}`,
              userId: payload.userId,
              classId,
              ...learningEvent,
            }],
            skipDuplicates: true,
          });
        }
      }
      return NextResponse.json({
        success: true,
        duplicate: !transitioned,
        experiment: {
          id: experiment.id,
          experimentId,
          status: experiment.status,
          attempts: experiment.attempts,
          timeSpent: experiment.timeSpent,
          completedAt: experiment.completedAt,
        },
        message: transitioned ? '实验已开始，刷新后可继续' : '实验开始状态已恢复',
        pointsEarned: 0,
        newAchievements: null,
        totalPointsEarned: 0,
      });
    }

    let previousResults: Record<string, unknown> = {};
    try {
      const parsedResults: unknown = experiment?.results ? JSON.parse(experiment.results) : {};
      if (isRecord(parsedResults)) previousResults = parsedResults;
    } catch { /* legacy result */ }
    const previousContexts = completionContextsOf(previousResults);
    const duplicateContext = status === 'COMPLETED'
      ? previousContexts.find((context) => context.completionKey === completionKey) ?? null
      : null;
    if (duplicateContext) {
      const previousPathId = typeof duplicateContext.pathId === 'string' ? duplicateContext.pathId : '';
      const previousStepId = typeof duplicateContext.stepId === 'string' ? duplicateContext.stepId : '';
      const previousFingerprint = typeof duplicateContext.requestFingerprint === 'string'
        ? duplicateContext.requestFingerprint
        : '';
      if (previousPathId !== requestedPathId || previousStepId !== requestedStepId
        || (previousFingerprint && previousFingerprint !== requestFingerprint)) {
        return NextResponse.json({
          error: '同一实验完成编号已用于其他任务或实验结果',
          code: 'IDEMPOTENCY_CONFLICT',
        }, { status: 409 });
      }
      if (previousPathId && previousStepId) {
        const path = await prisma.learningPath.findFirst({
          where: { id: previousPathId, userId: payload.userId },
          select: { id: true, status: true, modules: true, currentModule: true },
        });
        if (path?.status === 'ACTIVE') {
          const steps = parseLearningTaskSteps(path.modules);
          const currentStep = steps[path.currentModule];
          if (currentStep?.stepId === previousStepId && currentStep.type === 'SIMULATION' && currentStep.experimentId === experimentId) {
            await prisma.$transaction((tx) => advanceSimulationTask(tx, payload.userId, experimentId, completionKey, {
                pathId: path.id,
                stepId: currentStep.stepId,
                currentModule: path.currentModule,
                totalSteps: steps.length,
              }, new Date()));
          }
        }
      }
      return NextResponse.json({
        success: true,
        duplicate: true,
        experiment: {
          id: experiment?.id,
          experimentId,
          status: experiment?.status,
          attempts: experiment?.attempts,
          timeSpent: experiment?.timeSpent,
          completedAt: experiment?.completedAt,
        },
        message: '本次实验结果已保存，无需重复提交',
        pointsEarned: 0,
        newAchievements: null,
        totalPointsEarned: 0,
      });
    }

    // completionHistory 只保留最近记录；确定性活动回执用于恢复更早的完成请求。
    if (status === 'COMPLETED' && completionActivityId) {
      const storedReceiptRow = await prisma.userActivity.findUnique({
        where: { id: completionActivityId },
        select: { details: true },
      });
      if (storedReceiptRow) {
        const storedReceipt = completionReceiptOf(storedReceiptRow.details);
        if (!completionReceiptMatches(storedReceipt, {
          experimentId,
          completionKey,
          pathId: requestedPathId,
          stepId: requestedStepId,
          requestFingerprint,
        })) {
          return NextResponse.json({
            error: '同一实验完成编号已用于其他任务或实验结果',
            code: 'IDEMPOTENCY_CONFLICT',
          }, { status: 409 });
        }
        if (!experiment) {
          return NextResponse.json({
            error: '实验完成回执存在，但实验记录暂不可用，请稍后重试',
            code: 'EXPERIMENT_RECEIPT_UNAVAILABLE',
            retryable: true,
          }, { status: 503 });
        }
        return NextResponse.json({
          success: true,
          duplicate: true,
          experiment: {
            id: experiment.id,
            experimentId,
            status: experiment.status,
            attempts: experiment.attempts,
            timeSpent: experiment.timeSpent,
            completedAt: experiment.completedAt,
          },
          message: '本次实验结果已保存，无需重复提交',
          pointsEarned: 0,
          newAchievements: null,
          totalPointsEarned: 0,
        });
      }
    }

    const completionValidation = status === 'COMPLETED'
      ? validateCompletion(experimentId, code, results, previousResults)
      : null;
    if (completionValidation && !completionValidation.ok) {
      return NextResponse.json({ error: completionValidation.error }, { status: 400 });
    }

    let taskContext: SimulationTaskContext | null = null;
    if (status === 'COMPLETED') {
      // 自主实验只保存独立实验结果；只有任务页明确传入路径和步骤时，才允许
      // 绑定并推进教师任务，避免同一实验编号误命中最近的活动路径。
      const activePath = requestedPathId
        ? await prisma.learningPath.findFirst({
            where: {
              id: requestedPathId,
              userId: payload.userId,
              status: 'ACTIVE',
            },
            select: { id: true, modules: true, currentModule: true },
          })
        : null;
      if (activePath) {
        const steps = parseLearningTaskSteps(activePath.modules);
        const currentStep = steps[activePath.currentModule];
        if (currentStep?.type === 'SIMULATION' && currentStep.experimentId === experimentId) {
          if (requestedStepId && requestedStepId !== currentStep.stepId) {
            return NextResponse.json({ error: '实验步骤与当前任务不匹配' }, { status: 409 });
          }
          taskContext = { pathId: activePath.id, stepId: currentStep.stepId, currentModule: activePath.currentModule, totalSteps: steps.length };
        } else if (requestedPathId) {
          return NextResponse.json({ error: '当前任务尚未进入该实验步骤' }, { status: 409 });
        }
      } else if (requestedPathId) {
        return NextResponse.json({ error: '指定的学习任务不存在或状态已变化' }, { status: 409 });
      }
    }

    const now = new Date();
    const hasResults = results !== undefined && results !== null;
    const newCompletionContext = status === 'COMPLETED' ? {
      completionKey,
      pathId: taskContext?.pathId ?? null,
      stepId: taskContext?.stepId ?? null,
      verifiedAt: now.toISOString(),
      coveredModes: completionValidation?.ok ? completionValidation.coveredModes : [],
      projectMilestones: completionValidation?.ok && completionValidation.projectCompletion
        ? completionValidation.projectCompletion.milestones.map((item) => item.id)
        : [],
      executionVerification: experimentId === 'proj04' && isRecord(results) && isRecord(results.execution)
        ? {
            mode: 'OBSERVATION',
            traceSteps: results.execution.traceSteps,
            telemetryFrameObserved: hasProj04TelemetryFrame(
              isRecord(results.projectObservation) ? results.projectObservation.uartTail : null,
            ),
          }
        : null,
      requestFingerprint,
    } : null;
    const completionHistory = newCompletionContext
      ? [...previousContexts.filter((context) => context.completionKey !== completionKey), newCompletionContext].slice(-20)
      : previousContexts.slice(-20);
    const storedResults = hasResults ? {
      ...previousResults,
      ...(isRecord(results) ? results : { value: results }),
      ...(completionValidation?.ok && completionValidation.projectCompletion
        ? { projectCompletion: completionValidation.projectCompletion }
        : {}),
      ...(newCompletionContext ? { completionContext: newCompletionContext } : {}),
      ...(completionHistory.length > 0 ? { completionHistory } : {}),
    } : null;
    
    if (status === 'COMPLETED') {
      // 完成活动使用确定性主键并与实验记录、任务推进放在同一事务中。
      // 同一 completionKey 即使并发到达，也只有一个事务能累计实验次数。
      try {
        experiment = await prisma.$transaction(async (tx) => {
          await tx.userActivity.create({
            data: {
              id: completionActivityId,
              userId: payload.userId,
              action: 'COMPLETE_EXPERIMENT',
              details: JSON.stringify({
                experimentId,
                status,
                pathId: taskContext?.pathId ?? null,
                stepId: taskContext?.stepId ?? null,
                completionKey,
                requestFingerprint,
              }),
            },
          });
          const savedExperiment = await tx.userExperiment.upsert({
            where: { userId_experimentId: { userId: payload.userId, experimentId } },
            create: {
              userId: payload.userId,
              experimentId,
              status,
              lastCode: code,
              results: storedResults ? JSON.stringify(storedResults) : null,
              startedAt: now,
              completedAt: now,
              timeSpent: timeSpent ?? 0,
              attempts: 1,
            },
            update: {
              status,
              lastCode: code,
              results: storedResults ? JSON.stringify(storedResults) : experiment?.results,
              completedAt: now,
              ...(timeSpent !== undefined && timeSpent > 0
                ? { timeSpent: experiment?.timeSpent == null ? timeSpent : { increment: timeSpent } }
                : {}),
              attempts: { increment: 1 },
              updatedAt: now,
            },
          });
          if (taskContext) {
            await advanceSimulationTask(tx, payload.userId, experimentId, completionKey, taskContext, now);
          }
          return savedExperiment;
        });
      } catch (completionError) {
        if (!isUniqueConstraintError(completionError)) throw completionError;
        const [recoveredExperiment, recoveredReceiptRow] = await Promise.all([
          prisma.userExperiment.findUnique({
            where: { userId_experimentId: { userId: payload.userId, experimentId } },
          }),
          prisma.userActivity.findUnique({
            where: { id: completionActivityId },
            select: { details: true },
          }),
        ]);
        if (!recoveredExperiment) throw completionError;
        let recoveredContext: Record<string, unknown> | null = null;
        try {
          const recoveredResults: unknown = recoveredExperiment.results ? JSON.parse(recoveredExperiment.results) : null;
          if (isRecord(recoveredResults)) {
            recoveredContext = completionContextsOf(recoveredResults)
              .find((context) => context.completionKey === completionKey) ?? null;
          }
        } catch { /* legacy row */ }
        const recoveredFingerprint = recoveredContext && typeof recoveredContext.requestFingerprint === 'string'
          ? recoveredContext.requestFingerprint
          : '';
        const recoveredReceipt = completionReceiptOf(recoveredReceiptRow?.details);
        const receiptMatches = completionReceiptMatches(recoveredReceipt, {
          experimentId,
          completionKey,
          pathId: requestedPathId,
          stepId: requestedStepId,
          requestFingerprint,
        });
        if (!receiptMatches || (recoveredFingerprint && recoveredFingerprint !== requestFingerprint)) {
          return NextResponse.json({
            error: '同一实验完成编号已用于其他任务或实验结果',
            code: 'IDEMPOTENCY_CONFLICT',
          }, { status: 409 });
        }
        return NextResponse.json({
          success: true,
          duplicate: true,
          experiment: {
            id: recoveredExperiment.id,
            experimentId: recoveredExperiment.experimentId,
            status: recoveredExperiment.status,
            attempts: recoveredExperiment.attempts,
            timeSpent: recoveredExperiment.timeSpent,
            completedAt: recoveredExperiment.completedAt,
          },
          message: '本次实验结果已保存，无需重复提交',
          pointsEarned: 0,
          newAchievements: null,
          totalPointsEarned: 0,
        });
      }
    } else if (experiment) {
      experiment = await prisma.userExperiment.update({
        where: { id: experiment.id },
        data: {
          status,
          lastCode: code,
          results: storedResults ? JSON.stringify(storedResults) : experiment.results,
          timeSpent: timeSpent !== undefined && timeSpent > 0
            ? (experiment.timeSpent ?? 0) + timeSpent
            : experiment.timeSpent,
          updatedAt: now,
        },
      });
    } else {
      experiment = await prisma.userExperiment.create({
        data: {
          userId: payload.userId,
          experimentId,
          status,
          lastCode: code,
          results: storedResults ? JSON.stringify(storedResults) : null,
          startedAt: now,
          completedAt: null,
          timeSpent: timeSpent ?? 0,
          attempts: 1,
        },
      });
    }

    try {
      const action = status === 'COMPLETED' ? 'COMPLETE_EXPERIMENT' : 'SAVE_EXPERIMENT';
      const classId = await getActiveClassIdForUser(payload.userId);

      if (status !== 'COMPLETED') await prisma.userActivity.create({
          data: {
            userId: payload.userId,
            action,
            details: JSON.stringify({ experimentId, status, pathId: taskContext?.pathId ?? null, stepId: taskContext?.stepId ?? null, completionKey }),
          },
        });

      const learningEvent = normalizeLearningEventInput({
        eventType: action,
        targetType: 'EXPERIMENT',
        targetId: experimentId,
        experimentId,
        duration: timeSpent,
        metadata: {
          source: 'experiments-save-api',
          action,
          resultSummary: hasResults ? { hasResults: true } : { hasResults: false },
          pathId: taskContext?.pathId ?? null,
          stepId: taskContext?.stepId ?? null,
          completionKey,
        },
      }, experimentId);

      if (learningEvent) {
        await prisma.learningEvent.create({
          data: {
            userId: payload.userId,
            classId,
            ...learningEvent,
          },
        });
      }
    } catch (eventError) {
      console.error('记录实验行为失败:', eventError);
    }

    // 简化处理逻辑 - 保留积分/成就接口字段，避免破坏前端合约
    const basePoints = 0;
    const achievementPoints = 0;
    const newAchievements: unknown[] = [];
    
    return NextResponse.json({
      success: true,
      experiment: {
        id: experiment.id,
        experimentId: experiment.experimentId,
        status: experiment.status,
        attempts: experiment.attempts,
        timeSpent: experiment.timeSpent,
        completedAt: experiment.completedAt
      },
      message: status === 'COMPLETED' ? '实验已完成' : '实验进度已保存',
      pointsEarned: basePoints,
      newAchievements: newAchievements.length > 0 ? newAchievements : null,
      totalPointsEarned: basePoints + achievementPoints
    });

  } catch (error) {
    console.error('保存实验记录失败:', error);
    return NextResponse.json({ 
      error: '保存实验记录失败'
    }, { status: 500 });
  }
}

// 获取用户的实验记录
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '缺少认证令牌' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('experimentId');

    if (experimentId && !getExperimentConfig(experimentId)) {
      return NextResponse.json({ error: '实验编号不存在' }, { status: 400 });
    }

    // 构建查询条件
    const where: Prisma.UserExperimentWhereInput = {
      userId: payload.userId,
      experimentId: experimentId ?? { in: OFFICIAL_EXPERIMENT_IDS },
    };

    // 简化查询 - 仅获取基本实验记录
    const experiments = await prisma.userExperiment.findMany({
      where,
      orderBy: {
        updatedAt: 'desc'
      },
      take: 50 // 限制返回数量
    });

    return NextResponse.json({
      success: true,
      experiments: experiments.map((exp) => {
        let parsed: unknown = null;
        if (exp.results) {
          try {
            parsed = JSON.parse(exp.results) as unknown;
          } catch {
            parsed = exp.results;
          }
        }
        return { ...exp, results: parsed };
      })
    });

  } catch (error) {
    console.error('获取实验记录失败:', error);
    return NextResponse.json({ 
      error: '获取实验记录失败'
    }, { status: 500 });
  }
}
