// Reverse view for teachers: "what tasks have I pushed and how are students
// doing on them?". Aggregates UserExperiment + LearningPath rows across the
// students enrolled in classes the teacher manages.
//
// Optional ?classId= narrows to a single class. Without it, the response
// covers every class the teacher (or admin) has access to.

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canManageTeachingData, getAccessibleClassIds } from '@/lib/classroom';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { ADDRESSING_QUIZ_ID, ADDRESSING_TOPIC_ID, parseLearningTaskSteps } from '@/lib/lesson-tasks';
import { getDataProvenance } from '@/lib/env';

const OFFICIAL_EXPERIMENT_IDS = new Set(experimentCatalog.map((experiment) => experiment.id));

type PushReceipt = {
  userId: string;
  batchId: string | null;
  pathId: string | null;
  pathName: string | null;
  topicId: string | null;
  assignedAt: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (!canManageTeachingData(payload)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    const dataProvenance = getDataProvenance();

    const { searchParams } = new URL(request.url);
    const requestedClassId = searchParams.get('classId');
    const accessibleClassIds = await getAccessibleClassIds(payload);

    if (requestedClassId && payload.role !== 'ADMIN' && !accessibleClassIds.includes(requestedClassId)) {
      return NextResponse.json({ error: '无权查看该班级' }, { status: 403 });
    }

    const activeClassIds = requestedClassId ? [requestedClassId] : accessibleClassIds;

    // Resolve student userIds the teacher cares about. Same shape used by
    // /api/teacher/dashboard so the two stay consistent.
    const studentEnrollments = activeClassIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: {
          classId: { in: activeClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: {
          userId: true,
          classId: true,
          user: { select: { id: true, name: true, username: true, studentId: true } },
        },
      });

    const studentIds = Array.from(new Set(studentEnrollments.map((e) => e.userId)));
    const totalStudents = studentIds.length;
    const studentById = new Map(studentEnrollments.map((enrollment) => [enrollment.userId, enrollment.user]));

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        dataProvenance,
        data: {
          totalStudents,
          experiments: [],
          paths: [],
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const pushEvents = await prisma.userActivity.findMany({
      where: {
        userId: { in: studentIds },
        action: 'TEACHER_PUSH_LEARNING_TASK',
      },
      select: { userId: true, createdAt: true, details: true },
      orderBy: { createdAt: 'desc' },
    });
    const pushReceipts: PushReceipt[] = [];
    for (const event of pushEvents) {
      const details = parseJsonRecord(event.details);
      if (asString(details.pushedBy) !== payload.userId) continue;
      pushReceipts.push({
        userId: event.userId,
        batchId: asString(details.batchId),
        pathId: asString(details.pathId),
        pathName: asString(details.pathName),
        topicId: asString(details.topicId),
        assignedAt: event.createdAt,
      });
    }

    // 重试或历史脏数据可能留下重复事件；同一批次每名学生只保留最新回执。
    const dedupedPushes = new Map<string, PushReceipt>();
    for (const push of pushReceipts) {
      const batchKey = push.batchId ?? push.pathId ?? `legacy:${push.assignedAt.toISOString()}`;
      const key = `${batchKey}:${push.userId}`;
      if (!dedupedPushes.has(key)) dedupedPushes.set(key, push);
    }
    const taskPushes = [...dedupedPushes.values()];
    const pushedPathIds = [...new Set(taskPushes.flatMap((push) => push.pathId ? [push.pathId] : []))];

    const learningPaths = await prisma.learningPath.findMany({
      where: { id: { in: pushedPathIds }, userId: { in: studentIds } },
      select: {
        id: true,
        name: true,
        description: true,
        modules: true,
        totalModules: true,
        currentModule: true,
        status: true,
        startedAt: true,
        completedAt: true,
        userId: true,
      },
    });
    const pathById = new Map(learningPaths.map((path) => [path.id, path]));

    const assignmentEvents = await prisma.userActivity.findMany({
      where: {
        userId: { in: studentIds },
        action: 'TEACHER_ASSIGN_EXPERIMENT',
      },
      select: { userId: true, createdAt: true, details: true },
      orderBy: { createdAt: 'desc' },
    });
    const assignedExperimentPairs = new Set<string>();
    const taskAssignmentPairs = new Set<string>();
    const pairAssignedAt = new Map<string, Date>();
    for (const event of assignmentEvents) {
      const details = parseJsonRecord(event.details);
      const assignedBy = asString(details.assignedBy);
      const experimentId = asString(details.experimentId);
      if (assignedBy === payload.userId && experimentId && OFFICIAL_EXPERIMENT_IDS.has(experimentId)) {
        const pair = `${event.userId}:${experimentId}`;
        assignedExperimentPairs.add(pair);
        if (!pairAssignedAt.has(pair)) pairAssignedAt.set(pair, event.createdAt);
      }
    }
    // 学习任务中的仿真实践同样属于教师已布置内容。即使没有单独调用
    // “课前实验布置”接口，也应在推送回查中展示待开始状态。
    for (const push of taskPushes) {
      const path = push.pathId ? pathById.get(push.pathId) : undefined;
      if (!path) continue;
      for (const step of parseLearningTaskSteps(path.modules)) {
        if (step.experimentId && OFFICIAL_EXPERIMENT_IDS.has(step.experimentId)) {
          const pair = `${push.userId}:${step.experimentId}`;
          assignedExperimentPairs.add(pair);
          taskAssignmentPairs.add(pair);
          const previous = pairAssignedAt.get(pair);
          if (!previous || push.assignedAt > previous) pairAssignedAt.set(pair, push.assignedAt);
        }
      }
    }
    const assignedExperimentFilters = [...assignedExperimentPairs].map((pair) => {
      const separator = pair.indexOf(':');
      return { userId: pair.slice(0, separator), experimentId: pair.slice(separator + 1) };
    });

    const userExperiments = assignedExperimentFilters.length === 0 ? [] : await prisma.userExperiment.findMany({
        where: { OR: assignedExperimentFilters },
        select: {
          experimentId: true,
          status: true,
          score: true,
          userId: true,
          updatedAt: true,
        },
    });

    const experimentTitleById = new Map<string, { title: string; duration: number }>();
    for (const exp of experimentCatalog) {
      experimentTitleById.set(exp.id, { title: exp.title, duration: exp.duration });
    }

    type ExperimentBucket = {
      experimentId: string;
      title: string;
      duration: number | null;
      assigned: number;
      inProgress: number;
      completed: number;
      dataInsufficient: number;
      avgScore: number | null;
      uniqueStudents: number;
      lastActivityAt: string | null;
      students: {
        id: string;
        name: string;
        studentCode: string | null;
        status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DATA_INSUFFICIENT';
        score: number | null;
        updatedAt: string | null;
      }[];
    };
    const expBuckets = new Map<string, ExperimentBucket>();
    const expScoreSums = new Map<string, { sum: number; count: number }>();
    const userExperimentByPair = new Map(
      userExperiments.map((experiment) => [`${experiment.userId}:${experiment.experimentId}`, experiment]),
    );

    for (const pair of assignedExperimentPairs) {
      const separator = pair.indexOf(':');
      const userId = pair.slice(0, separator);
      const experimentId = pair.slice(separator + 1);
      const ue = userExperimentByPair.get(pair);
      let bucket = expBuckets.get(experimentId);
      if (!bucket) {
        const meta = experimentTitleById.get(experimentId);
        bucket = {
          experimentId,
          title: meta?.title ?? experimentId,
          duration: meta?.duration ?? null,
          assigned: 0,
          inProgress: 0,
          completed: 0,
          dataInsufficient: 0,
          avgScore: null,
          uniqueStudents: 0,
          lastActivityAt: null,
          students: [],
        };
        expBuckets.set(experimentId, bucket);
      }
      const rawStatus = (ue?.status || '').toUpperCase();
      let status: ExperimentBucket['students'][number]['status'];
      if (!ue) {
        status = taskAssignmentPairs.has(pair) ? 'ASSIGNED' : 'DATA_INSUFFICIENT';
      } else if (rawStatus === 'ASSIGNED' || rawStatus === 'NOT_STARTED') {
        status = 'ASSIGNED';
      } else if (rawStatus === 'COMPLETED') {
        status = 'COMPLETED';
      } else {
        status = 'IN_PROGRESS';
      }
      if (status === 'ASSIGNED') bucket.assigned++;
      else if (status === 'COMPLETED') bucket.completed++;
      else if (status === 'DATA_INSUFFICIENT') bucket.dataInsufficient++;
      else bucket.inProgress++;

      if (typeof ue?.score === 'number' && !Number.isNaN(ue.score)) {
        const cur = expScoreSums.get(experimentId) ?? { sum: 0, count: 0 };
        cur.sum += ue.score;
        cur.count++;
        expScoreSums.set(experimentId, cur);
      }

      const ts = ue?.updatedAt?.toISOString() ?? pairAssignedAt.get(pair)?.toISOString() ?? null;
      if (ts && (!bucket.lastActivityAt || ts > bucket.lastActivityAt)) {
        bucket.lastActivityAt = ts;
      }
      const student = studentById.get(userId);
      bucket.students.push({
        id: userId,
        name: student?.name ?? userId,
        studentCode: student?.studentId ?? null,
        status,
        score: typeof ue?.score === 'number' && !Number.isNaN(ue.score) ? ue.score : null,
        updatedAt: ts,
      });
    }
    const experimentStatusPriority: Record<ExperimentBucket['students'][number]['status'], number> = {
      DATA_INSUFFICIENT: 0,
      ASSIGNED: 1,
      IN_PROGRESS: 2,
      COMPLETED: 3,
    };
    for (const [id, b] of expBuckets) {
      b.uniqueStudents = b.students.length;
      b.students.sort((left, right) => (
        experimentStatusPriority[left.status] - experimentStatusPriority[right.status]
        || left.name.localeCompare(right.name, 'zh-CN')
      ));
      const score = expScoreSums.get(id);
      if (score && score.count > 0) {
        b.avgScore = Math.round((score.sum / score.count) * 10) / 10;
      }
    }

    const experiments = Array.from(expBuckets.values()).sort((a, b) => {
      if (a.lastActivityAt && b.lastActivityAt) {
        return b.lastActivityAt.localeCompare(a.lastActivityAt);
      }
      return a.experimentId.localeCompare(b.experimentId);
    });

    type PathBucket = {
      batchId: string | null;
      name: string;
      description: string | null;
      topicId: string | null;
      stepTitles: string[];
      assignedAt: string;
      totalStudents: number;
      active: number;
      paused: number;
      completed: number;
      dataInsufficient: number;
      avgProgressPct: number;
      latestStartedAt: string | null;
      students: {
        id: string;
        name: string;
        studentCode: string | null;
        status: string;
        currentStep: number;
        totalSteps: number;
        progressPct: number;
      }[];
    };
    const pathBuckets = new Map<string, PathBucket & { progressSum: number; progressCount: number }>();

    for (const push of taskPushes) {
      const p = push.pathId ? pathById.get(push.pathId) : undefined;
      const batchKey = push.batchId ?? push.pathId ?? `legacy:${push.assignedAt.toISOString()}`;
      let bucket = pathBuckets.get(batchKey);
      if (!bucket) {
        const steps = p ? parseLearningTaskSteps(p.modules) : [];
        bucket = {
          batchId: push.batchId,
          name: p?.name ?? push.pathName ?? '历史学习任务',
          description: p?.description ?? null,
          topicId: push.topicId ?? (steps.some((step) => step.quizId === ADDRESSING_QUIZ_ID) ? ADDRESSING_TOPIC_ID : null),
          stepTitles: steps.map((step) => step.title),
          assignedAt: push.assignedAt.toISOString(),
          totalStudents: 0,
          active: 0,
          paused: 0,
          completed: 0,
          dataInsufficient: 0,
          avgProgressPct: 0,
          latestStartedAt: null,
          students: [],
          progressSum: 0,
          progressCount: 0,
        };
        pathBuckets.set(batchKey, bucket);
      }
      bucket.totalStudents++;
      if (push.assignedAt.toISOString() > bucket.assignedAt) {
        bucket.assignedAt = push.assignedAt.toISOString();
      }
      const student = studentById.get(push.userId);
      if (!p) {
        bucket.dataInsufficient++;
        bucket.students.push({
          id: push.userId,
          name: student?.name ?? push.userId,
          studentCode: student?.studentId ?? null,
          status: 'DATA_INSUFFICIENT',
          currentStep: 0,
          totalSteps: 0,
          progressPct: 0,
        });
        continue;
      }
      const status = (p.status || '').toUpperCase();
      const parsedSteps = parseLearningTaskSteps(p.modules);
      const pathDataInvalid = parsedSteps.length === 0
        || p.currentModule < 0
        || (status === 'ACTIVE' && p.currentModule >= parsedSteps.length);
      if (pathDataInvalid) {
        bucket.dataInsufficient++;
        bucket.students.push({
          id: push.userId,
          name: student?.name ?? push.userId,
          studentCode: student?.studentId ?? null,
          status: 'DATA_INSUFFICIENT',
          currentStep: Math.max(0, p.currentModule),
          totalSteps: parsedSteps.length,
          progressPct: 0,
        });
        continue;
      }
      if (bucket.stepTitles.length === 0) {
        bucket.stepTitles = parsedSteps.map((step) => step.title);
      }
      if (status === 'ACTIVE') bucket.active++;
      else if (status === 'PAUSED') bucket.paused++;
      else if (status === 'COMPLETED') bucket.completed++;

      if (parsedSteps.length > 0) {
        bucket.progressSum += (Math.min(p.currentModule, parsedSteps.length) / parsedSteps.length) * 100;
        bucket.progressCount++;
      }

      bucket.students.push({
        id: push.userId,
        name: student?.name ?? push.userId,
        studentCode: student?.studentId ?? null,
        status: p.status,
        currentStep: p.currentModule,
        totalSteps: parsedSteps.length,
        progressPct: Math.round((Math.min(p.currentModule, parsedSteps.length) / parsedSteps.length) * 100),
      });

      const ts = p.startedAt?.toISOString() ?? null;
      if (ts && (!bucket.latestStartedAt || ts > bucket.latestStartedAt)) {
        bucket.latestStartedAt = ts;
      }
    }

    const paths = Array.from(pathBuckets.values()).map((b) => ({
      batchId: b.batchId,
      name: b.name,
      description: b.description,
      topicId: b.topicId,
      stepTitles: b.stepTitles,
      assignedAt: b.assignedAt,
      totalStudents: b.totalStudents,
      active: b.active,
      paused: b.paused,
      completed: b.completed,
      dataInsufficient: b.dataInsufficient,
      avgProgressPct: b.progressCount > 0 ? Math.round(b.progressSum / b.progressCount) : 0,
      latestStartedAt: b.latestStartedAt,
      students: b.students.sort((a, c) => a.name.localeCompare(c.name, 'zh-CN')),
    })).sort((a, b) => {
      return b.assignedAt.localeCompare(a.assignedAt);
    });

    return NextResponse.json({
      success: true,
      dataProvenance,
      data: { totalStudents, experiments, paths },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    console.error('teacher/pushed GET error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
