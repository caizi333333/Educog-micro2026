import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getJwtSecret } from '@/lib/env';
import { getPointsByLevel } from '@/lib/knowledge-points';
import { buildCourseChapterHref, getLessonTaskPreset, getModuleIdForChapter } from '@/lib/lesson-tasks';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

type PathType = 'BASIC' | 'ADVANCED';
type TargetScope = 'ALL' | 'CLASS' | 'STUDENTS';
type ConfirmationState = 'REQUIRED' | 'STALE';

const REPLACEMENT_CONFIRMATION_TTL_MS = 10 * 60 * 1000;
const REPLACEMENT_CONFIRMATION_CLOCK_SKEW_MS = 30 * 1000;

class IdempotencyConflictError extends Error {}
class ActivePathConflictError extends Error {
  constructor(
    readonly activePathCount: number,
    readonly targetCount: number,
    readonly replacementToken: string,
    readonly requestId: string,
    readonly confirmationState: ConfirmationState,
  ) {
    super('ACTIVE_PATH_EXISTS');
  }
}

function isRetryableTransactionError(value: unknown): boolean {
  return typeof value === 'object' && value !== null
    && 'code' in value
    && (value as { code?: unknown }).code === 'P2034';
}

function getStoredRequestFingerprint(details: string | null | undefined): string | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const fingerprint = (parsed as Record<string, unknown>).requestFingerprint;
    return typeof fingerprint === 'string' ? fingerprint : null;
  } catch {
    return null;
  }
}

function replacementConfirmationPayload(
  teacherId: string,
  requestId: string,
  activePathIds: string[],
  issuedAt: number,
): string {
  return JSON.stringify({ teacherId, requestId, activePathIds: activePathIds.slice().sort(), issuedAt });
}

function signReplacementConfirmation(payload: string): string {
  return createHmac('sha256', getJwtSecret()).update(payload).digest('hex');
}

function createReplacementToken(
  teacherId: string,
  requestId: string,
  activePathIds: string[],
  issuedAt = Date.now(),
): string {
  const signature = signReplacementConfirmation(
    replacementConfirmationPayload(teacherId, requestId, activePathIds, issuedAt),
  );
  return `replace_${issuedAt.toString(36)}_${signature}`;
}

function isReplacementTokenValid(
  token: string | undefined,
  teacherId: string,
  requestId: string,
  activePathIds: string[],
  now = Date.now(),
): boolean {
  const match = token?.match(/^replace_([0-9a-z]+)_([a-f0-9]{64})$/);
  if (!match) return false;
  const issuedAt = Number.parseInt(match[1]!, 36);
  if (!Number.isSafeInteger(issuedAt)) return false;
  if (issuedAt > now + REPLACEMENT_CONFIRMATION_CLOCK_SKEW_MS) return false;
  if (now - issuedAt > REPLACEMENT_CONFIRMATION_TTL_MS) return false;

  const expected = Buffer.from(signReplacementConfirmation(
    replacementConfirmationPayload(teacherId, requestId, activePathIds, issuedAt),
  ), 'hex');
  const received = Buffer.from(match[2]!, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const CHAPTER_SCHEDULE: { chapterId: string; moduleId: string; name: string }[] =
  getPointsByLevel(1)
    .slice()
    .sort((a, b) => a.chapter - b.chapter)
    .map((point) => ({
      chapterId: `ch${point.chapter}`,
      moduleId: getModuleIdForChapter(point.chapter) ?? 'module-5',
      name: `第${point.chapter}章 ${point.name}`,
    }));

const optionalTrimmedString = (maxLength: number) => z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().min(1).max(maxLength).optional());

const pushLearningTaskSchema = z.object({
  scope: z.enum(['ALL', 'CLASS', 'STUDENTS']).nullish().transform((value) => value ?? 'ALL'),
  targetClassId: optionalTrimmedString(128),
  studentIds: z.array(z.string().trim().min(1).max(128)).max(500).nullish().transform((value) => value ?? []),
  pathType: z.enum(['BASIC', 'ADVANCED']).nullish().transform((value) => value ?? 'BASIC'),
  moduleCount: z.preprocess(
    (value) => value === undefined || value === null || value === '' ? 5 : value,
    z.coerce.number().int().min(1).max(CHAPTER_SCHEDULE.length)
  ),
  topicId: optionalTrimmedString(128),
  requestId: optionalTrimmedString(128),
  replacementToken: optionalTrimmedString(128),
  replaceExisting: z.boolean().nullish().transform((value) => value ?? false),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const rawBody: unknown = await request.json().catch((): null => null);
    const parsedBody = pushLearningTaskSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ error: '任务参数格式无效' }, { status: 400 });
    }
    const body = parsedBody.data;
    const scope: TargetScope = body.scope;
    const targetClassId = body.targetClassId;
    const studentIds = Array.from(new Set(body.studentIds.map((id) => id.trim()).filter(Boolean)));
    const pathType: PathType = body.pathType;
    const moduleCount = body.moduleCount;
    const topicId = body.topicId ?? null;
    const preset = topicId ? getLessonTaskPreset(topicId) : null;
    if (topicId && !preset) {
      return NextResponse.json({ error: '不支持的教学主题' }, { status: 400 });
    }
    const rawRequestId = body.requestId ?? '';
    if (rawRequestId && !/^[A-Za-z0-9_-]{8,128}$/.test(rawRequestId)) {
      return NextResponse.json({ error: '推送请求编号格式无效' }, { status: 400 });
    }
    const requestId = rawRequestId
      ? rawRequestId
      : `legacy_${randomUUID().replace(/-/g, '')}`;
    const batchId = `batch_${createHash('sha256').update(`${payload.userId}:${requestId}`).digest('hex').slice(0, 20)}`;

    // ALL 只覆盖本教师可管理班级的在读学生（含明确加入班级的演示账号）。
    const accessibleClassIds = await getAccessibleClassIds(payload);
    const enrollmentUserFilter = {
      role: 'STUDENT', status: 'ACTIVE',
    } as const;

    let students: { id: string }[] = [];
    if (scope === 'ALL' || scope === 'CLASS') {
      let classIds = accessibleClassIds;
      if (scope === 'CLASS') {
        if (!targetClassId) return NextResponse.json({ error: '缺少班级' }, { status: 400 });
        if (!accessibleClassIds.includes(targetClassId)) {
          return NextResponse.json({ error: '无权操作该班级' }, { status: 403 });
        }
        classIds = [targetClassId];
      }
      const enrollments = classIds.length === 0
        ? []
        : await prisma.classEnrollment.findMany({
          where: {
            classId: { in: classIds },
            role: 'STUDENT',
            status: 'ACTIVE',
            user: enrollmentUserFilter,
          },
          select: { userId: true },
        });
      students = [...new Set(enrollments.map((e) => e.userId))].map((id) => ({ id }));
    } else {
      if (!studentIds.length) return NextResponse.json({ error: '缺少学生列表' }, { status: 400 });
      const enrollments = accessibleClassIds.length === 0
        ? []
        : await prisma.classEnrollment.findMany({
          where: {
            classId: { in: accessibleClassIds },
            role: 'STUDENT',
            status: 'ACTIVE',
            userId: { in: studentIds },
            user: enrollmentUserFilter,
          },
          select: { userId: true },
        });
      const allowedIds = [...new Set(enrollments.map((enrollment) => enrollment.userId))];
      if (allowedIds.length !== studentIds.length) {
        return NextResponse.json({ error: '学生不在当前教师可管理的班级范围内' }, { status: 403 });
      }
      students = allowedIds.map((id) => ({ id }));
    }

    const modules = preset?.steps ?? CHAPTER_SCHEDULE.slice(0, moduleCount).map((c) => ({
      stepId: `chapter-${c.chapterId}`,
      type: 'CHAPTER' as const,
      title: c.name,
      purpose: '完成本章核心内容学习与练习。',
      completionRule: '按章节页面要求完成学习。',
      href: buildCourseChapterHref(c.chapterId),
      targetId: c.chapterId,
      moduleId: c.moduleId,
      chapterId: c.chapterId,
    }));

    const name = preset?.title ?? (pathType === 'ADVANCED' ? '进阶学习任务' : '基础强化任务');
    const description = preset?.description ?? (
      pathType === 'ADVANCED'
        ? '面向能力较强的学生，侧重综合应用与项目实践（由教师统一推送）'
        : '面向基础薄弱的学生，强化核心概念理解与基础实验（由教师统一推送）'
    );

    const ids = students.map(s => s.id);
    if (ids.length === 0) {
      return NextResponse.json({ error: '当前范围内没有可推送的学生' }, { status: 400 });
    }
    const sortedTargetIds = ids.slice().sort();
    const requestFingerprint = createHash('sha256').update(JSON.stringify({
      scope,
      targetClassId: targetClassId ?? null,
      targetUserIds: sortedTargetIds,
      pathType,
      topicId: preset?.topicId ?? null,
      name,
      description,
      modules,
    })).digest('hex');
    const receiptId = `ua_${createHash('sha256').update(`${batchId}:receipt`).digest('hex').slice(0, 24)}`;
    const existingReceipt = await prisma.userActivity.findUnique({
      where: { id: receiptId },
      select: { details: true },
    });
    if (existingReceipt) {
      const storedFingerprint = getStoredRequestFingerprint(existingReceipt.details);
      if (storedFingerprint !== requestFingerprint) {
        return NextResponse.json({
          error: '同一推送请求编号已用于不同的任务参数',
          code: 'IDEMPOTENCY_CONFLICT',
        }, { status: 409 });
      }
    }
    const pathIdByUser = new Map(ids.map((userId) => [
      userId,
      `lp_${createHash('sha256').update(`${batchId}:${userId}`).digest('hex').slice(0, 24)}`,
    ]));
    const newPathIds = [...pathIdByUser.values()];

    const existingBatchPaths = await prisma.learningPath.count({ where: { id: { in: newPathIds } } });
    if (existingBatchPaths === newPathIds.length) {
      const storedPaths = await prisma.learningPath.findMany({
        where: { id: { in: newPathIds } },
        select: { id: true, userId: true, name: true, description: true, modules: true },
      });
      const modulesJson = JSON.stringify(modules);
      const storedPathByUser = new Map(storedPaths.map((path) => [path.userId, path]));
      const definitionsMatch = ids.every((userId) => {
        const storedPath = storedPathByUser.get(userId);
        if (!storedPath) return false;
        return storedPath.id === pathIdByUser.get(userId)
          && storedPath.name === name
          && (storedPath.description ?? '') === description
          && storedPath.modules === modulesJson;
      });
      if (!definitionsMatch) {
        return NextResponse.json({
          error: '同一推送请求编号已用于不同的任务参数',
          code: 'IDEMPOTENCY_CONFLICT',
        }, { status: 409 });
      }
      if (!existingReceipt) {
        await prisma.userActivity.createMany({
          data: [{
            id: receiptId,
            userId: payload.userId,
            action: 'TEACHER_PUSH_LEARNING_TASK_BATCH',
            details: JSON.stringify({
              requestId,
              batchId,
              requestFingerprint,
              targetUserIds: sortedTargetIds,
              targetScope: scope,
              targetClassId: targetClassId ?? null,
              topicId: preset?.topicId ?? null,
              moduleCount: modules.length,
              pathType,
            }),
          }],
          skipDuplicates: true,
        });
      }
      return NextResponse.json({
        success: true,
        duplicate: true,
        requestId,
        batchId,
        created: ids.length,
        paused: 0,
        targetCount: ids.length,
        topicId: preset?.topicId ?? null,
        steps: modules,
        targetScope: scope,
        targetClassId: targetClassId ?? null,
      });
    }

    const activePathRows = await prisma.learningPath.findMany({
      // 部分重试时，同一批次已创建的路径不属于“将被替换的旧路径”。
      where: { userId: { in: ids }, status: 'ACTIVE', id: { notIn: newPathIds } },
      select: { id: true },
    });
    const activePathCount = activePathRows.length;
    const replacementToken = createReplacementToken(
      payload.userId,
      requestId,
      activePathRows.map((path) => path.id),
    );
    const replacementConfirmed = body.replaceExisting && isReplacementTokenValid(
      body.replacementToken,
      payload.userId,
      requestId,
      activePathRows.map((path) => path.id),
    );
    // 所有任务都必须显式确认替换；旧参数仍可提交，但不能静默暂停已有学习路径。
    if (activePathCount > 0 && !replacementConfirmed) {
      const confirmationState: ConfirmationState = body.replaceExisting && body.replacementToken ? 'STALE' : 'REQUIRED';
      return NextResponse.json({
        error: confirmationState === 'STALE'
          ? '替换确认已失效或任务状态已变化，请核对后再次确认'
          : '目标学生已有进行中的学习路径',
        code: 'ACTIVE_PATH_EXISTS',
        requiresConfirmation: true,
        confirmationState,
        activePathCount,
        targetCount: ids.length,
        requestId,
        replacementToken,
      }, { status: 409 });
    }

    let result: { created: number; paused: number } | null = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        result = await prisma.$transaction(async (tx) => {
          // 外层提示负责常规冲突；事务内再次检查负责拦住两个教师请求同时到达的竞态。
          const concurrentActivePaths = await tx.learningPath.findMany({
            where: { userId: { in: ids }, status: 'ACTIVE', id: { notIn: newPathIds } },
            select: { id: true },
          });
          const concurrentReplacementToken = createReplacementToken(
            payload.userId,
            requestId,
            concurrentActivePaths.map((path) => path.id),
          );
          const concurrentReplacementConfirmed = body.replaceExisting
            && isReplacementTokenValid(
              body.replacementToken,
              payload.userId,
              requestId,
              concurrentActivePaths.map((path) => path.id),
            );
          if (concurrentActivePaths.length > 0 && !concurrentReplacementConfirmed) {
            const confirmationState: ConfirmationState = body.replaceExisting && body.replacementToken ? 'STALE' : 'REQUIRED';
            throw new ActivePathConflictError(
              concurrentActivePaths.length,
              ids.length,
              concurrentReplacementToken,
              requestId,
              confirmationState,
            );
          }

          const receipt = await tx.userActivity.createMany({
            data: [{
              id: receiptId,
              userId: payload.userId,
              action: 'TEACHER_PUSH_LEARNING_TASK_BATCH',
              details: JSON.stringify({
                requestId,
                batchId,
                requestFingerprint,
                targetUserIds: sortedTargetIds,
                targetScope: scope,
                targetClassId: targetClassId ?? null,
                topicId: preset?.topicId ?? null,
                moduleCount: modules.length,
                pathType,
              }),
            }],
            skipDuplicates: true,
          });
          if (receipt.count === 0) {
            const persistedReceipt = await tx.userActivity.findUnique({
              where: { id: receiptId },
              select: { details: true },
            });
            if (getStoredRequestFingerprint(persistedReceipt?.details) !== requestFingerprint) {
              throw new IdempotencyConflictError();
            }
          }

          // Pause all existing ACTIVE paths for these students in one call
          const paused = await tx.learningPath.updateMany({
            where: { userId: { in: ids }, status: 'ACTIVE', id: { notIn: newPathIds } },
            data: { status: 'PAUSED' },
          });

          // Bulk create new learning paths
          const modulesJson = JSON.stringify(modules);
          const created = await tx.learningPath.createMany({
            data: ids.map(userId => ({
              id: pathIdByUser.get(userId)!,
              userId,
              name,
              description,
              modules: modulesJson,
              currentModule: 0,
              totalModules: modules.length,
              status: 'ACTIVE',
            })),
            skipDuplicates: true,
          });

          // Bulk create activity records
          await tx.userActivity.createMany({
            data: ids.map(userId => ({
              id: `ua_${createHash('sha256').update(`${batchId}:${userId}:push`).digest('hex').slice(0, 24)}`,
              userId,
              action: 'TEACHER_PUSH_LEARNING_TASK',
              details: JSON.stringify({
                pushedBy: payload.userId,
                requestId,
                batchId,
                pathId: pathIdByUser.get(userId),
                pathName: name,
                topicId: preset?.topicId ?? null,
                moduleCount: modules.length,
                targetScope: scope,
                targetClassId: targetClassId ?? null,
                replacedActivePaths: paused.count,
              }),
            })),
            skipDuplicates: true,
          });

          return { created: created.count, paused: paused.count };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (transactionError) {
        if (isRetryableTransactionError(transactionError) && attempt < 3) continue;
        throw transactionError;
      }
    }
    if (!result) throw new Error('推送事务未返回结果');

    return NextResponse.json({
      success: true,
      duplicate: result.created === 0,
      requestId,
      batchId,
      created: result.created === 0 ? ids.length : result.created,
      paused: result.paused,
      targetCount: ids.length,
      topicId: preset?.topicId ?? null,
      steps: modules,
      targetScope: scope,
      targetClassId: targetClassId ?? null,
    });
  } catch (error) {
    if (error instanceof ActivePathConflictError) {
      return NextResponse.json({
        error: error.confirmationState === 'STALE'
          ? '替换确认已失效或任务状态已变化，请核对后再次确认'
          : '目标学生已有进行中的学习路径',
        code: 'ACTIVE_PATH_EXISTS',
        requiresConfirmation: true,
        confirmationState: error.confirmationState,
        activePathCount: error.activePathCount,
        targetCount: error.targetCount,
        requestId: error.requestId,
        replacementToken: error.replacementToken,
      }, { status: 409 });
    }
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json({
        error: '同一推送请求编号已用于不同的任务参数',
        code: 'IDEMPOTENCY_CONFLICT',
      }, { status: 409 });
    }
    console.error('Push learning task error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
