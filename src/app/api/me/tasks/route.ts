// Aggregates "tasks pushed to me" for the logged-in student:
//   - assignedExperiments: experiments explicitly assigned by a teacher, with
//                          the student's current ASSIGNED/IN_PROGRESS/COMPLETED
//                          server state preserved across refresh and re-entry
//   - activePaths:         LearningPath rows with status='ACTIVE'
//                          (created by /api/teacher/push-learning-task)
//
// Auth: any authenticated user (no role check).

import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getDataProvenance } from '@/lib/env';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { COURSE_CHAPTER_BY_ID } from '@/lib/course-curriculum';
import {
  buildCourseChapterHref,
  getTaskEvidenceEventType,
  isManualTaskStep,
  isValidRemediationCompletionEvidence,
  normalizeRemediationWeakAreas,
  parseLearningTaskSteps,
  validateAddressingAnimationCompletionEvidence,
  validateAddressingGraphCompletionEvidence,
  type LearningTaskStep,
} from '@/lib/lesson-tasks';

const OFFICIAL_EXPERIMENT_IDS = experimentCatalog.map((experiment) => experiment.id);

function isTaskEvidenceMetadata(value: unknown): value is { pathId: string; stepId: string } {
  if (typeof value !== 'object' || value === null) return false;
  const metadata = value as Record<string, unknown>;
  return typeof metadata.pathId === 'string' && typeof metadata.stepId === 'string';
}

function getTaskEvidenceRecordId(userId: string, pathId: string, step: LearningTaskStep): string {
  const action = getTaskEvidenceEventType(step) === 'RESOURCE_COMPLETED' ? 'resource-complete' : 'resource-open';
  const clientEventId = `${action}:${pathId}:${step.stepId}`;
  return `le_${createHash('sha256').update(`${userId}:${clientEventId}`).digest('hex').slice(0, 28)}`;
}

type ExperimentReceipt = {
  verifiedAt: string | null;
  coveredModes: string[];
};

type AssessmentReceipt = {
  submittedAt: string;
  score: number;
  weakAreas: string[];
  questionSetVersion: string | null;
};

type AssignedExperimentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

type CurriculumCompatibility = {
  status: 'CURRENT' | 'LEGACY_9_CHAPTER';
  label: string | null;
  note: string | null;
  missingChapterIds: string[];
};

function normalizeLegacyChapterPath(steps: LearningTaskStep[]): {
  steps: LearningTaskStep[];
  compatibility: CurriculumCompatibility;
} {
  const isLegacyNineChapterPath = steps.length === 9
    && steps.every((step, index) => (
      step.type === 'CHAPTER'
      && step.stepId === `legacy-step-${index + 1}`
      && step.chapterId === `ch${index + 1}`
    ));
  if (!isLegacyNineChapterPath) {
    return {
      steps,
      compatibility: { status: 'CURRENT', label: null, note: null, missingChapterIds: [] },
    };
  }

  return {
    steps: steps.map((step) => {
      const currentChapter = step.chapterId ? COURSE_CHAPTER_BY_ID.get(step.chapterId) : null;
      return currentChapter
        ? {
            ...step,
            title: currentChapter.name,
            moduleId: currentChapter.moduleId,
            href: buildCourseChapterHref(currentChapter.chapterId),
          }
        : step;
    }),
    compatibility: {
      status: 'LEGACY_9_CHAPTER',
      label: '历史演示路径（旧9章口径）',
      note: '原记录已按当前章节名称重映射，但不含第10章“前沿应用”；平台未补写步骤，也不将9步完成等同于当前10章课程完成。',
      missingChapterIds: ['ch10'],
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  try {
    return asRecord(JSON.parse(value ?? '{}') as unknown) ?? {};
  } catch {
    return {};
  }
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function assignedExperimentCompletionRule(experimentId: string): string {
  if (experimentId === 'exp02') {
    return '无故障执行至少 20 条指令，覆盖立即、直接、寄存器、寄存器间接和变址五种数据寻址方式，再提交完成；以服务端复核结果为准。';
  }
  return '按实验指南完成操作并无故障运行至正常结束，再提交完成；以服务端保存结果为准。';
}

function experimentReceiptForPath(results: string | null, pathId: string): ExperimentReceipt | null {
  if (!results) return null;
  try {
    const parsed = asRecord(JSON.parse(results) as unknown);
    if (!parsed) return null;
    const history = Array.isArray(parsed.completionHistory) ? parsed.completionHistory : [];
    const current = asRecord(parsed.completionContext);
    const candidates = [...history, ...(current ? [current] : [])];
    const matched = candidates.map(asRecord).find((item) => item?.pathId === pathId);
    if (!matched) return null;
    return {
      verifiedAt: typeof matched.verifiedAt === 'string' ? matched.verifiedAt : null,
      coveredModes: Array.isArray(matched.coveredModes)
        ? matched.coveredModes.filter((mode): mode is string => typeof mode === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

function assessmentReceiptFromActivity(details: string | null, createdAt: Date): {
  key: string;
  receipt: AssessmentReceipt;
} | null {
  const parsed = parseJsonRecord(details);
  const pathId = asTrimmedString(parsed.pathId);
  const quizId = asTrimmedString(parsed.quizId);
  const assessmentMode = parsed.assessmentMode === 'retest'
    ? 'retest'
    : parsed.assessmentMode === 'initial'
      ? 'initial'
      : null;
  const score = typeof parsed.score === 'number' && Number.isFinite(parsed.score)
    ? Math.min(100, Math.max(0, parsed.score))
    : null;
  if (!pathId || !quizId || !assessmentMode || score === null) return null;
  return {
    key: `${pathId}:${quizId}:${assessmentMode}`,
    receipt: {
      submittedAt: createdAt.toISOString(),
      score,
      weakAreas: normalizeRemediationWeakAreas(parsed.weakAreas),
      questionSetVersion: asTrimmedString(parsed.questionSetVersion),
    },
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const dataProvenance = getDataProvenance();
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    const [assignmentEventsResult, pathRows] = await Promise.all([
      prisma.userActivity.findMany({
        where: {
          userId: payload.userId,
          action: { in: ['TEACHER_ASSIGN_EXPERIMENT', 'START_EXPERIMENT'] },
        },
        select: { action: true, details: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.learningPath.findMany({
        where: { userId: payload.userId, status: { in: ['ACTIVE', 'COMPLETED', 'PAUSED'] } },
        select: {
          id: true,
          name: true,
          description: true,
          modules: true,
          currentModule: true,
          totalModules: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
        orderBy: { startedAt: 'desc' },
        take: 12,
      }),
    ]);

    const assignmentEvents = assignmentEventsResult ?? [];
    const explicitAssignmentAtByExperiment = new Map<string, Date>();
    const preclassStartAtByExperiment = new Map<string, Date>();
    for (const event of assignmentEvents) {
      const details = parseJsonRecord(event.details);
      const experimentId = asTrimmedString(details.experimentId);
      if (!experimentId || !OFFICIAL_EXPERIMENT_IDS.includes(experimentId)) continue;
      // 历史布置数据可能只有 ASSIGNED 状态、没有教师布置回执。首次从任务页
      // 进入时写入的 START_EXPERIMENT 回执因此也作为后续恢复入口，但只有
      // source=preclass-task 的开始事件可以进入任务列表，避免混入自主练习。
      const isAssignmentReceipt = event.action === 'TEACHER_ASSIGN_EXPERIMENT'
        || asTrimmedString(details.assignedBy) !== null;
      const isPreclassStartReceipt = event.action === 'START_EXPERIMENT'
        && details.source === 'preclass-task';
      // 查询已按时间倒序；同一实验保留最近一次对应回执时间。
      if (isAssignmentReceipt && !explicitAssignmentAtByExperiment.has(experimentId)) {
        explicitAssignmentAtByExperiment.set(experimentId, event.createdAt);
      }
      if (isPreclassStartReceipt && !preclassStartAtByExperiment.has(experimentId)) {
        preclassStartAtByExperiment.set(experimentId, event.createdAt);
      }
    }
    const explicitlyAssignedIds = [...new Set([
      ...explicitAssignmentAtByExperiment.keys(),
      ...preclassStartAtByExperiment.keys(),
    ])];
    const assignmentStatusFilters: Prisma.UserExperimentWhereInput[] = [{ status: 'ASSIGNED' }];
    if (explicitlyAssignedIds.length > 0) {
      assignmentStatusFilters.push({ experimentId: { in: explicitlyAssignedIds } });
    }
    const assignedRowsResult = await prisma.userExperiment.findMany({
      where: {
        userId: payload.userId,
        experimentId: { in: OFFICIAL_EXPERIMENT_IDS },
        OR: assignmentStatusFilters,
      },
      select: {
        experimentId: true,
        status: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const assignedRows = assignedRowsResult ?? [];

    const normalizedPathsById = new Map(pathRows.map((row) => [
      row.id,
      normalizeLegacyChapterPath(parseLearningTaskSteps(row.modules)),
    ]));
    const stepsByPathId = new Map(
      [...normalizedPathsById.entries()].map(([pathId, normalized]) => [pathId, normalized.steps]),
    );
    const taskExperimentIds = [...new Set([...stepsByPathId.values()].flatMap((steps) => (
      steps.flatMap((step) => step.experimentId ? [step.experimentId] : [])
    )))];
    const taskExperimentRows = taskExperimentIds.length > 0
      ? await prisma.userExperiment.findMany({
        where: { userId: payload.userId, experimentId: { in: taskExperimentIds }, status: 'COMPLETED' },
        select: { experimentId: true, results: true },
      })
      : [];
    const assessmentEvents = pathRows.length > 0
      ? await prisma.userActivity.findMany({
        where: {
          userId: payload.userId,
          action: 'COMPLETE_QUIZ',
          OR: pathRows.map((path) => ({ details: { contains: `\"pathId\":\"${path.id}\"` } })),
        },
        select: { details: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })
      : [];
    const assessmentReceiptByPathQuizAndMode = new Map<string, AssessmentReceipt>();
    for (const event of assessmentEvents ?? []) {
      const parsed = assessmentReceiptFromActivity(event.details, event.createdAt);
      // 查询已按时间倒序；重复记录只保留服务端最近一次有效回执。
      if (parsed && !assessmentReceiptByPathQuizAndMode.has(parsed.key)) {
        assessmentReceiptByPathQuizAndMode.set(parsed.key, parsed.receipt);
      }
    }
    const experimentReceiptByPathAndId = new Map<string, ExperimentReceipt>();
    for (const row of taskExperimentRows) {
      for (const path of pathRows) {
        const receipt = experimentReceiptForPath(row.results, path.id);
        if (receipt) experimentReceiptByPathAndId.set(`${path.id}:${row.experimentId}`, receipt);
      }
    }
    const expectedEvidenceIds = pathRows.flatMap((row) => {
      if (row.status !== 'ACTIVE') return [];
      const currentStep = stepsByPathId.get(row.id)?.[row.currentModule];
      return currentStep && isManualTaskStep(currentStep)
        ? [getTaskEvidenceRecordId(payload.userId, row.id, currentStep)]
        : [];
    });
    // 任务凭据使用确定性主键精确读取，避免行为记录增多后因“最近 N 条”截断而丢失已完成状态。
    const resourceEvents = expectedEvidenceIds.length > 0
      ? await prisma.learningEvent.findMany({
        where: { userId: payload.userId, id: { in: expectedEvidenceIds } },
        select: { eventType: true, targetId: true, metadata: true, createdAt: true },
      })
      : [];

    const experimentTitleById = new Map<string, { title: string; duration: number }>();
    for (const exp of experimentCatalog) {
      experimentTitleById.set(exp.id, { title: exp.title, duration: exp.duration });
    }

    const assignedRowByExperiment = new Map(assignedRows.map((row) => [row.experimentId, row]));
    const assignedExperimentIds = [...new Set([
      ...explicitlyAssignedIds,
      ...assignedRows.map((row) => row.experimentId),
    ])];
    const statusPriority: Record<AssignedExperimentStatus, number> = { IN_PROGRESS: 0, ASSIGNED: 1, COMPLETED: 2 };
    const assignedExperiments = assignedExperimentIds.map((experimentId) => {
      const row = assignedRowByExperiment.get(experimentId);
      const rawStatus = row?.status?.toUpperCase() ?? 'ASSIGNED';
      const status: AssignedExperimentStatus = rawStatus === 'COMPLETED'
        ? 'COMPLETED'
        : rawStatus === 'IN_PROGRESS'
          ? 'IN_PROGRESS'
          : 'ASSIGNED';
      const meta = experimentTitleById.get(experimentId);
      const assignedAt = explicitAssignmentAtByExperiment.get(experimentId)
        ?? preclassStartAtByExperiment.get(experimentId)
        ?? row?.updatedAt
        ?? row?.createdAt
        ?? new Date(0);
      return {
        experimentId,
        title: meta?.title ?? experimentId,
        duration: meta?.duration ?? null,
        assignedAt: assignedAt.toISOString(),
        status,
        statusUpdatedAt: (row?.updatedAt ?? assignedAt).toISOString(),
        startedAt: row?.startedAt?.toISOString() ?? null,
        completedAt: row?.completedAt?.toISOString() ?? null,
        completionRule: assignedExperimentCompletionRule(experimentId),
        href: `/simulation?experiment=${encodeURIComponent(experimentId)}&from=preclass`,
      };
    }).sort((left, right) => {
      const priorityDelta = statusPriority[left.status] - statusPriority[right.status];
      return priorityDelta || right.assignedAt.localeCompare(left.assignedAt);
    });

    const appendTaskContext = (href: string, pathId: string, stepId: string): string => {
      const target = new URL(href, 'https://educog.local');
      target.searchParams.set('taskPathId', pathId);
      target.searchParams.set('taskStepId', stepId);
      return `${target.pathname}${target.search}${target.hash}`;
    };
    const hasResourceEvidence = (pathId: string, stepId: string, targetId: string, stepType: LearningTaskStep['type']): boolean => resourceEvents.some((event) => {
      if (event.targetId !== targetId) return false;
      const requiredEventType = getTaskEvidenceEventType({ type: stepType });
      if (event.eventType !== requiredEventType) return false;
      try {
        const metadata: unknown = JSON.parse(event.metadata ?? '{}');
        const contextMatches = isTaskEvidenceMetadata(metadata)
          && metadata.pathId === pathId
          && metadata.stepId === stepId;
        if (!contextMatches) return false;
        if (stepType === 'GRAPH') {
          return validateAddressingGraphCompletionEvidence(metadata) === null;
        }
        if (stepType === 'ANIMATION') {
          return validateAddressingAnimationCompletionEvidence(metadata) === null;
        }
        if (stepType === 'REMEDIATION') {
          const record = asRecord(metadata);
          return isValidRemediationCompletionEvidence(record, record?.weakAreas);
        }
        return true;
      } catch {
        return false;
      }
    });

    const mappedPaths = pathRows.map((row) => {
      const parsedSteps = stepsByPathId.get(row.id) ?? [];
      const curriculumCompatibility = normalizedPathsById.get(row.id)?.compatibility
        ?? { status: 'CURRENT' as const, label: null, note: null, missingChapterIds: [] };
      const dataIssue = parsedSteps.length === 0
        ? '任务步骤数据不完整，请刷新后重试；若仍未恢复，请联系教师重新布置。'
        : row.status === 'ACTIVE' && row.currentModule >= parsedSteps.length
          ? '任务进度与步骤数量不一致，请联系教师复核后重新布置。'
          : null;
      const steps = parsedSteps.map((step, index) => ({
        ...step,
        href: appendTaskContext(step.href, row.id, step.stepId),
        receipt: step.experimentId
          ? experimentReceiptByPathAndId.get(`${row.id}:${step.experimentId}`) ?? null
          : null,
        assessmentReceipt: step.quizId && (step.type === 'QUIZ' || step.type === 'RETEST')
          ? assessmentReceiptByPathQuizAndMode.get(`${row.id}:${step.quizId}:${step.type === 'RETEST' ? 'retest' : 'initial'}`) ?? null
          : null,
        status: row.status === 'COMPLETED' || index < row.currentModule ? 'COMPLETED' : index === row.currentModule ? 'CURRENT' : 'PENDING',
        canMarkComplete: row.status === 'ACTIVE'
          && index === row.currentModule
          && isManualTaskStep(step)
          && hasResourceEvidence(row.id, step.stepId, step.targetId, step.type),
      }));
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        startedAt: row.startedAt.toISOString(),
        currentModule: row.currentModule,
        totalModules: steps.length > 0 ? steps.length : row.totalModules,
        status: row.status,
        completedAt: row.completedAt?.toISOString() ?? null,
        dataIssue,
        curriculumStatus: curriculumCompatibility.status,
        curriculumLabel: curriculumCompatibility.label,
        curriculumNote: curriculumCompatibility.note,
        missingChapterIds: curriculumCompatibility.missingChapterIds,
        steps,
      };
    });
    const activePaths = mappedPaths.filter((path) => path.status === 'ACTIVE');
    const completedPaths = mappedPaths.filter((path) => path.status === 'COMPLETED');
    const pausedPaths = mappedPaths.filter((path) => path.status === 'PAUSED');

    return NextResponse.json({
      success: true,
      data: {
        dataProvenance,
        assignedExperiments,
        activePaths,
        completedPaths,
        pausedPaths,
        counts: {
          assignedExperiments: assignedExperiments.length,
          activePaths: activePaths.length,
          completedPaths: completedPaths.length,
          pausedPaths: pausedPaths.length,
        },
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('me/tasks GET error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
