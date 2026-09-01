import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { resolveOBEAssessmentResource } from '@/lib/obe-data';
import { prisma } from '@/lib/prisma';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

class ConfigurationError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

function signatureOf(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function configurationSummary(objective: {
  updatedAt: Date;
  assessmentLinks: Array<{
    assessmentType: string;
    assessmentTargetId: string;
    weight: number;
    chapter: number | null;
    updatedAt: Date;
  }>;
}) {
  const configurationIssues: string[] = [];
  const totalWeight = objective.assessmentLinks.reduce((sum, link) => sum + link.weight, 0);
  if (objective.assessmentLinks.length === 0) configurationIssues.push('尚未配置考核环节');
  else if (Math.abs(totalWeight - 1) > 1e-6) {
    configurationIssues.push(`考核权重合计为 ${(totalWeight * 100).toFixed(1)}%，应为 100%`);
  }
  for (const link of objective.assessmentLinks) {
    const resolved = resolveOBEAssessmentResource(
      link.assessmentType,
      link.assessmentTargetId,
      link.chapter,
    );
    if (!resolved.valid) configurationIssues.push(`${link.assessmentTargetId}：${resolved.error}`);
  }
  const configurationUpdatedAt = objective.assessmentLinks.reduce(
    (latest, link) => link.updatedAt > latest ? link.updatedAt : latest,
    objective.updatedAt,
  );
  return { totalWeight, configurationIssues, configurationUpdatedAt };
}

async function requireAdmin(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new ConfigurationError('未授权', 401);
  const payload = await verifyToken(authorization.substring(7));
  if (!payload) throw new ConfigurationError('令牌无效', 401);
  if (payload.role !== 'ADMIN') throw new ConfigurationError('仅管理员可操作课程目标配置', 403);
  return payload;
}

async function loadObjectiveImpact(id: string) {
  return prisma.$transaction(async (tx) => {
    const objective = await tx.courseObjective.findUnique({
      where: { id },
      include: {
        indicatorPoint: { include: { graduationRequirement: true } },
        assessmentLinks: { orderBy: [{ assessmentType: 'asc' }, { assessmentTargetId: 'asc' }] },
      },
    });
    if (!objective) throw new ConfigurationError('课程目标不存在', 404);

    const [records, students, classes, semesters] = await Promise.all([
      tx.courseObjectiveAchievement.aggregate({
        where: { courseObjectiveId: id },
        _count: { _all: true },
        _max: { calculatedAt: true },
      }),
      tx.courseObjectiveAchievement.groupBy({
        by: ['userId'],
        where: { courseObjectiveId: id },
      }),
      tx.courseObjectiveAchievement.groupBy({
        by: ['classId'],
        where: { courseObjectiveId: id, classId: { not: null } },
      }),
      tx.courseObjectiveAchievement.groupBy({
        by: ['semester'],
        where: { courseObjectiveId: id, semester: { not: null } },
      }),
    ]);
    const summary = configurationSummary(objective);
    return {
      objective: {
        ...objective,
        totalWeight: summary.totalWeight,
        configurationIssues: summary.configurationIssues,
        configurationUpdatedAt: summary.configurationUpdatedAt,
      },
      impact: {
        achievementRecordCount: records._count._all,
        affectedStudentCount: students.length,
        affectedClassCount: classes.length,
        affectedSemesterCount: semesters.length,
        latestCalculatedAt: records._max.calculatedAt,
        recordsWillBeRetained: true,
        requiresRecalculation: records._count._all > 0,
      },
    };
  }, { isolationLevel: 'RepeatableRead' });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    if (!ID_PATTERN.test(id)) return json({ error: '课程目标编号格式无效' }, 400);
    return json(await loadObjectiveImpact(id));
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ error: error.message, ...error.details }, error.status);
    console.error('GET /api/obe/course-objectives/[id] error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let objectiveId = '';
  let receiptId = '';
  let requestSignature = '';
  try {
    const payload = await requireAdmin(request);
    const { id } = await params;
    objectiveId = id;
    if (!ID_PATTERN.test(id)) return json({ error: '课程目标编号格式无效' }, 400);

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    const expectedVersion = typeof body.expectedVersion === 'number' ? body.expectedVersion : Number.NaN;
    if (!REQUEST_ID_PATTERN.test(requestId)) return json({ error: '请求编号格式无效' }, 400);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return json({ error: '课程目标版本号无效' }, 400);
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
    const hasIndicator = Object.prototype.hasOwnProperty.call(body, 'indicatorPointId');
    const hasSupportWeight = Object.prototype.hasOwnProperty.call(body, 'supportWeight');
    const hasActive = Object.prototype.hasOwnProperty.call(body, 'isActive');
    if (!hasName && !hasDescription && !hasIndicator && !hasSupportWeight && !hasActive) {
      return json({ error: '没有可更新的课程目标字段' }, 400);
    }

    const patch: Record<string, string | number | boolean | null> = {};
    if (hasName) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 200) return json({ error: '课程目标名称格式无效' }, 400);
      patch.name = name;
    }
    if (hasDescription) {
      if (body.description !== null && typeof body.description !== 'string') {
        return json({ error: '课程目标说明格式无效' }, 400);
      }
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (description.length > 2000) return json({ error: '课程目标说明不能超过 2000 字' }, 400);
      patch.description = description || null;
    }
    if (hasIndicator) {
      const indicatorPointId = typeof body.indicatorPointId === 'string' ? body.indicatorPointId.trim() : '';
      if (!ID_PATTERN.test(indicatorPointId)) return json({ error: '指标点编号格式无效' }, 400);
      patch.indicatorPointId = indicatorPointId;
    }
    if (hasSupportWeight) {
      const supportWeight = typeof body.supportWeight === 'number' ? body.supportWeight : Number.NaN;
      if (!Number.isFinite(supportWeight) || supportWeight <= 0 || supportWeight > 1) {
        return json({ error: '支撑权重必须大于 0 且不超过 100%' }, 400);
      }
      patch.supportWeight = supportWeight;
    }
    if (hasActive) {
      if (typeof body.isActive !== 'boolean') return json({ error: '启用状态格式无效' }, 400);
      patch.isActive = body.isActive;
    }

    requestSignature = signatureOf({ objectiveId: id, expectedVersion, patch });
    receiptId = stableId('obe_objective_config', `${payload.userId}:${requestId}`);
    const priorReceipt = await prisma.userActivity.findUnique({
      where: { id: receiptId },
      select: { details: true },
    });
    if (priorReceipt) {
      let receipt: Record<string, unknown>;
      try {
        receipt = JSON.parse(priorReceipt.details ?? '{}') as Record<string, unknown>;
      } catch {
        return json({ error: '请求编号回执损坏，请联系管理员核对' }, 409);
      }
      if (receipt.signature !== requestSignature || receipt.objectiveId !== id) {
        return json({ error: '请求编号已用于其他课程目标配置' }, 409);
      }
      const current = await loadObjectiveImpact(id);
      return json({ ...current, duplicate: true, receiptId });
    }

    const result = await prisma.$transaction(async (tx) => {
      const racedReceipt = await tx.userActivity.findUnique({
        where: { id: receiptId },
        select: { details: true },
      });
      if (racedReceipt) {
        let receipt: Record<string, unknown>;
        try {
          receipt = JSON.parse(racedReceipt.details ?? '{}') as Record<string, unknown>;
        } catch {
          throw new ConfigurationError('请求编号回执损坏，请联系管理员核对', 409);
        }
        if (receipt.signature !== requestSignature || receipt.objectiveId !== id) {
          throw new ConfigurationError('请求编号已用于其他课程目标配置', 409);
        }
        return { duplicate: true };
      }

      const current = await tx.courseObjective.findUnique({
        where: { id },
        include: { assessmentLinks: true },
      });
      if (!current) throw new ConfigurationError('课程目标不存在', 404);
      if (current.version !== expectedVersion) {
        throw new ConfigurationError('课程目标配置已变化，请刷新后重新核对', 409, {
          currentVersion: current.version,
        });
      }
      if (typeof patch.indicatorPointId === 'string') {
        const indicator = await tx.indicatorPoint.findUnique({
          where: { id: patch.indicatorPointId },
          select: { id: true },
        });
        if (!indicator) throw new ConfigurationError('毕业要求指标点不存在', 400);
      }

      const desiredActive = typeof patch.isActive === 'boolean' ? patch.isActive : current.isActive;
      if (desiredActive) {
        const summary = configurationSummary(current);
        if (summary.configurationIssues.length > 0) {
          throw new ConfigurationError('考核映射完整且有效后才能启用课程目标', 409, {
            configurationIssues: summary.configurationIssues,
          });
        }
      }

      const changes = Object.entries(patch).filter(([key, value]) => {
        const currentValue = current[key as keyof typeof current];
        if (typeof value === 'number' && typeof currentValue === 'number') {
          return Math.abs(value - currentValue) > 1e-9;
        }
        return (currentValue ?? null) !== value;
      });
      if (changes.length === 0) return { duplicate: false, unchanged: true };

      const historicalCount = await tx.courseObjectiveAchievement.count({
        where: { courseObjectiveId: id },
      });
      if ((current.isActive || desiredActive || historicalCount > 0)
        && body.confirm !== 'APPLY_OBJECTIVE_CONFIGURATION') {
        throw new ConfigurationError('应用配置前需明确确认现有达成度记录和后续重算影响', 409, {
          confirmationRequired: true,
          affectedAchievementRecords: historicalCount,
        });
      }

      const updated = await tx.courseObjective.updateMany({
        where: { id, version: expectedVersion },
        data: { ...patch, version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConfigurationError('课程目标配置已变化，请刷新后重新核对', 409);
      }
      await tx.userActivity.create({
        data: {
          id: receiptId,
          userId: payload.userId,
          action: 'UPDATE_OBE_COURSE_OBJECTIVE',
          details: JSON.stringify({
            requestId,
            objectiveId: id,
            signature: requestSignature,
            fromVersion: expectedVersion,
            toVersion: expectedVersion + 1,
            changedFields: changes.map(([key]) => key),
            affectedAchievementRecords: historicalCount,
          }),
        },
      });
      return { duplicate: false, unchanged: false };
    }, { isolationLevel: 'Serializable' });

    const current = await loadObjectiveImpact(id);
    return json({ ...current, ...result, receiptId });
  } catch (error: any) {
    if (error instanceof ConfigurationError) return json({ error: error.message, ...error.details }, error.status);
    if (error?.code === 'P2034') return json({ error: '配置正在被其他操作更新，请使用同一请求编号重试' }, 409);
    if (error?.code === 'P2002' && receiptId) {
      const receipt = await prisma.userActivity.findUnique({ where: { id: receiptId }, select: { details: true } });
      if (receipt) {
        try {
          const parsed = JSON.parse(receipt.details ?? '{}') as Record<string, unknown>;
          if (parsed.signature === requestSignature && objectiveId) {
            const current = await loadObjectiveImpact(objectiveId);
            return json({ ...current, duplicate: true, receiptId });
          }
        } catch {
          // Fall through to the stable conflict response below.
        }
      }
      return json({ error: '请求编号已用于其他课程目标配置' }, 409);
    }
    console.error('PATCH /api/obe/course-objectives/[id] error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
