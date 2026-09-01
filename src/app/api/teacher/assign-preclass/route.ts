import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { createHash, randomUUID } from 'node:crypto';

class AssignmentIdempotencyConflictError extends Error {}

type AssignmentReceipt = {
  requestFingerprint: string;
  assigned: number | null;
  skipped: number | null;
};

function parseAssignmentReceipt(details: string | null | undefined): AssignmentReceipt | null {
  if (!details) return null;
  try {
    const parsed: unknown = JSON.parse(details);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.requestFingerprint !== 'string') return null;
    return {
      requestFingerprint: record.requestFingerprint,
      assigned: typeof record.assigned === 'number' ? record.assigned : null,
      skipped: typeof record.skipped === 'number' ? record.skipped : null,
    };
  } catch {
    return null;
  }
}

const assignPreclassSchema = z.object({
  experimentId: z.string().trim().min(1).max(128),
  scope: z.enum(['ALL', 'CLASS', 'STUDENTS']).default('ALL'),
  targetClassId: z.string().trim().min(1).max(128).optional(),
  studentIds: z.array(z.string().trim().min(1).max(128)).max(500).default([]),
  requestId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,128}$/).optional(),
});

// 按 ClassEnrollment 关系取班级内全部在读学生。
async function getEnrolledStudentIds(classIds: string[]): Promise<string[]> {
  if (classIds.length === 0) return [];
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      classId: { in: classIds },
      role: 'STUDENT',
      status: 'ACTIVE',
      user: { role: 'STUDENT', status: 'ACTIVE' },
    },
    select: { userId: true },
  });
  return [...new Set(enrollments.map((e) => e.userId))];
}

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
    const parsedBody = assignPreclassSchema.safeParse(rawBody);
    if (!parsedBody.success) return NextResponse.json({ error: '请求参数无效' }, { status: 400 });
    const { experimentId, scope, targetClassId } = parsedBody.data;
    const requestId = parsedBody.data.requestId
      ?? `legacy_${randomUUID().replace(/-/g, '')}`;
    const batchId = `expbatch_${createHash('sha256').update(`${payload.userId}:${requestId}`).digest('hex').slice(0, 20)}`;
    const studentIds = Array.from(new Set(parsedBody.data.studentIds));
    if (!experimentCatalog.some((experiment) => experiment.id === experimentId)) {
      return NextResponse.json({ error: '实验编号不存在' }, { status: 400 });
    }

    // ALL 只覆盖本教师可管理班级的学生，不再作用于全平台
    const accessibleClassIds = await getAccessibleClassIds(payload);

    let targetIds: string[] = [];
    if (scope === 'ALL') {
      targetIds = await getEnrolledStudentIds(accessibleClassIds);
    } else if (scope === 'CLASS') {
      if (!targetClassId) return NextResponse.json({ error: '缺少班级' }, { status: 400 });
      if (!accessibleClassIds.includes(targetClassId)) {
        return NextResponse.json({ error: '无权操作该班级' }, { status: 403 });
      }
      targetIds = await getEnrolledStudentIds([targetClassId]);
    } else {
      if (!studentIds.length) return NextResponse.json({ error: '缺少学生列表' }, { status: 400 });
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          classId: { in: accessibleClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          userId: { in: studentIds },
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: { userId: true },
      });
      targetIds = [...new Set(enrollments.map((enrollment) => enrollment.userId))];
      if (targetIds.length !== studentIds.length) {
        return NextResponse.json({ error: '学生不在当前教师可管理的班级范围内' }, { status: 403 });
      }
    }

    targetIds = [...new Set(targetIds)].sort();
    if (targetIds.length === 0) {
      return NextResponse.json({ error: '当前范围内没有可布置的学生' }, { status: 400 });
    }
    const requestFingerprint = createHash('sha256').update(JSON.stringify({
      experimentId,
      scope,
      targetClassId: targetClassId ?? null,
      targetUserIds: targetIds,
    })).digest('hex');
    const receiptId = `ua_${createHash('sha256').update(`${batchId}:receipt`).digest('hex').slice(0, 24)}`;
    const existingReceipt = await prisma.userActivity.findUnique({
      where: { id: receiptId },
      select: { details: true },
    });
    const parsedExistingReceipt = parseAssignmentReceipt(existingReceipt?.details);
    if (parsedExistingReceipt) {
      if (parsedExistingReceipt.requestFingerprint !== requestFingerprint) {
        return NextResponse.json({
          error: '同一布置请求编号已用于不同参数',
          code: 'IDEMPOTENCY_CONFLICT',
        }, { status: 409 });
      }
      if (parsedExistingReceipt.assigned !== null && parsedExistingReceipt.skipped !== null) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          requestId,
          batchId,
          assigned: parsedExistingReceipt.assigned,
          skipped: parsedExistingReceipt.skipped,
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 先认领请求编号；并发重试会等待首个事务提交，然后直接恢复原回执。
      const receipt = await tx.userActivity.createMany({
        data: [{
          id: receiptId,
          userId: payload.userId,
          action: 'TEACHER_ASSIGN_EXPERIMENT_BATCH',
          details: JSON.stringify({
            requestId,
            batchId,
            requestFingerprint,
            experimentId,
            targetScope: scope,
            targetClassId: targetClassId ?? null,
            targetUserIds: targetIds,
            assigned: null,
            skipped: null,
          }),
        }],
        skipDuplicates: true,
      });
      if (receipt.count === 0) {
        const persisted = await tx.userActivity.findUnique({
          where: { id: receiptId },
          select: { details: true },
        });
        const restored = parseAssignmentReceipt(persisted?.details);
        if (!restored || restored.requestFingerprint !== requestFingerprint) {
          throw new AssignmentIdempotencyConflictError();
        }
        if (restored.assigned === null || restored.skipped === null) {
          throw new Error('实验布置回执不完整');
        }
        return { duplicate: true, assigned: restored.assigned, skipped: restored.skipped };
      }

      // 已有记录一律不降级：进行中/已完成保持原状，已布置的幂等跳过
      const existing = await tx.userExperiment.findMany({
        where: { userId: { in: targetIds }, experimentId },
        select: { userId: true, status: true },
      });
      const existingIds = new Set(existing.map(e => e.userId));

      // 仅把未开始的旧记录标记为已布置（不动进度）
      const { count: marked } = await tx.userExperiment.updateMany({
        where: { userId: { in: targetIds }, experimentId, status: 'NOT_STARTED' },
        data: { status: 'ASSIGNED', updatedAt: new Date() },
      });

      // 没有记录的学生新建 ASSIGNED
      const newIds = targetIds.filter(id => !existingIds.has(id));
      const created = newIds.length > 0
        ? await tx.userExperiment.createMany({
          data: newIds.map(id => ({ userId: id, experimentId, status: 'ASSIGNED' })),
          skipDuplicates: true,
        })
        : { count: 0 };
      const assigned = created.count + marked;
      const skipped = Math.max(0, targetIds.length - assigned);

      await tx.userActivity.createMany({
        data: targetIds.map((userId) => ({
          id: `ua_${createHash('sha256').update(`${batchId}:${userId}:${experimentId}`).digest('hex').slice(0, 24)}`,
          userId,
          action: 'TEACHER_ASSIGN_EXPERIMENT',
          details: JSON.stringify({
            assignedBy: payload.userId,
            requestId,
            batchId,
            experimentId,
            targetScope: scope,
            targetClassId: targetClassId ?? null,
          }),
        })),
        skipDuplicates: true,
      });

      await tx.userActivity.update({
        where: { id: receiptId },
        data: {
          details: JSON.stringify({
            requestId,
            batchId,
            requestFingerprint,
            experimentId,
            targetScope: scope,
            targetClassId: targetClassId ?? null,
            targetUserIds: targetIds,
            assigned,
            skipped,
          }),
        },
      });

      return { duplicate: false, assigned, skipped };
    });

    return NextResponse.json({ success: true, requestId, batchId, ...result });
  } catch (error) {
    if (error instanceof AssignmentIdempotencyConflictError) {
      return NextResponse.json({
        error: '同一布置请求编号已用于不同参数',
        code: 'IDEMPOTENCY_CONFLICT',
      }, { status: 409 });
    }
    console.error('Assign preclass error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
