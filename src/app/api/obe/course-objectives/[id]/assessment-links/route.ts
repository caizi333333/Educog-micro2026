import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { resolveOBEAssessmentResource } from '@/lib/obe-data';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return json({ error: '权限不足' }, 403);
    }

    const { id } = await params;
    if (!ID_PATTERN.test(id)) return json({ error: '课程目标编号格式无效' }, 400);
    const objective = await prisma.courseObjective.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!objective || (payload.role !== 'ADMIN' && !objective.isActive)) {
      return json({ error: '课程目标不存在' }, 404);
    }
    const links = await prisma.assessmentLink.findMany({
      where: { courseObjectiveId: id },
      orderBy: { weight: 'desc' },
    });

    return json({ links });
  } catch (error) {
    console.error('GET /api/obe/course-objectives/[id]/assessment-links error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'ADMIN') {
      return json({ error: '仅管理员可修改考核映射' }, 403);
    }

    const { id } = await params;
    if (!ID_PATTERN.test(id)) return json({ error: '课程目标编号格式无效' }, 400);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }
    const assessmentType = typeof body.assessmentType === 'string' ? body.assessmentType.trim().toUpperCase() : '';
    const assessmentTargetId = typeof body.assessmentTargetId === 'string' ? body.assessmentTargetId.trim() : '';
    const weight = typeof body.weight === 'number' ? body.weight : Number.NaN;
    const maxScore = typeof body.maxScore === 'number' ? body.maxScore : Number.NaN;
    const chapter = body.chapter === null || body.chapter === undefined ? null : Number(body.chapter);
    if (!assessmentType || !assessmentTargetId || !Number.isFinite(weight) || !Number.isFinite(maxScore)) {
      return json({ error: '缺少必填字段' }, 400);
    }
    if (!['QUIZ', 'EXPERIMENT', 'LEARNING_PROGRESS', 'COMPREHENSIVE'].includes(assessmentType)) {
      return json({ error: '无效的考核类型' }, 400);
    }
    if (assessmentTargetId.length > 128 || weight <= 0 || weight > 1 || maxScore <= 0 || maxScore > 1000) {
      return json({ error: '考核目标、权重或满分值无效' }, 400);
    }
    if (chapter !== null && (!Number.isInteger(chapter) || chapter < 1 || chapter > 10)) {
      return json({ error: '章节编号无效' }, 400);
    }
    if (assessmentType === 'COMPREHENSIVE' && chapter === null) {
      return json({ error: '综合测评必须指定章节' }, 400);
    }

    const resource = resolveOBEAssessmentResource(assessmentType, assessmentTargetId, chapter);
    if (!resource.valid) return json({ error: resource.error }, 400);

    const existing = await prisma.assessmentLink.findUnique({
      where: {
        courseObjectiveId_assessmentType_assessmentTargetId: {
          courseObjectiveId: id,
          assessmentType,
          assessmentTargetId,
        },
      },
    });
    if (existing) {
      const sameLink = Math.abs(existing.weight - weight) <= 1e-9
        && Math.abs(existing.maxScore - maxScore) <= 1e-9
        && (existing.chapter ?? null) === resource.chapter;
      if (!sameLink) return json({ error: '该资源已使用不同权重或满分值，请刷新后核对' }, 409);
      return json({ link: existing, duplicate: true, activated: false });
    }

    const co = await prisma.courseObjective.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!co) return json({ error: '课程目标不存在' }, 404);
    if (co.isActive && body.confirm !== 'UPDATE_ACTIVE_CONFIGURATION') {
      return json({
        error: '该课程目标已参与达成度计算，修改考核映射前需确认影响',
        confirmationRequired: true,
      }, 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      const currentObjective = await tx.courseObjective.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      });
      if (!currentObjective) throw new ConfigurationError('课程目标不存在', 404);
      if (currentObjective.isActive && body.confirm !== 'UPDATE_ACTIVE_CONFIGURATION') {
        throw new ConfigurationError('课程目标状态已变化，请重新确认影响', 409);
      }

      const racedExisting = await tx.assessmentLink.findUnique({
        where: {
          courseObjectiveId_assessmentType_assessmentTargetId: {
            courseObjectiveId: id,
            assessmentType,
            assessmentTargetId,
          },
        },
      });
      if (racedExisting) {
        const sameLink = Math.abs(racedExisting.weight - weight) <= 1e-9
          && Math.abs(racedExisting.maxScore - maxScore) <= 1e-9
          && (racedExisting.chapter ?? null) === resource.chapter;
        if (!sameLink) throw new ConfigurationError('该资源已使用不同配置，请刷新后核对', 409);
        return { link: racedExisting, duplicate: true, activated: false };
      }

      const existingWeight = await tx.assessmentLink.aggregate({
        where: { courseObjectiveId: id },
        _sum: { weight: true },
      });
      const totalWeight = (existingWeight._sum.weight ?? 0) + weight;
      if (totalWeight > 1 + 1e-9) {
        throw new ConfigurationError('该课程目标的考核权重合计不能超过 100%', 400);
      }

      const link = await tx.assessmentLink.create({
        data: {
          courseObjectiveId: id,
          assessmentType,
          assessmentTargetId,
          weight,
          maxScore,
          chapter: resource.chapter,
          description: resource.description,
        },
      });
      const activated = !currentObjective.isActive && Math.abs(totalWeight - 1) <= 1e-9;
      await tx.courseObjective.update({
        where: { id },
        data: {
          ...(activated ? { isActive: true } : {}),
          version: { increment: 1 },
        },
      });
      return { link, duplicate: false, activated };
    }, { isolationLevel: 'Serializable' });

    return json(result, result.duplicate ? 200 : 201);
  } catch (error: any) {
    if (error instanceof ConfigurationError) return json({ error: error.message }, error.status);
    if (error?.code === 'P2002') {
      return json({ error: '该考核映射已存在，请刷新后核对' }, 409);
    }
    if (error?.code === 'P2034') return json({ error: '配置正在被其他操作更新，请刷新后重试' }, 409);
    console.error('POST /api/obe/course-objectives/[id]/assessment-links error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let objectiveId = '';
  let receiptId = '';
  let requestSignature = '';
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'ADMIN') return json({ error: '仅管理员可修改考核映射' }, 403);

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
    if (!Array.isArray(body.links) || body.links.length > 30) {
      return json({ error: '考核映射必须为不超过 30 项的数组' }, 400);
    }

    const normalizedLinks: Array<{
      assessmentType: string;
      assessmentTargetId: string;
      weight: number;
      maxScore: number;
      chapter: number | null;
      description: string;
    }> = [];
    const uniqueResources = new Set<string>();
    for (const raw of body.links) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return json({ error: '考核映射项目格式无效' }, 400);
      }
      const item = raw as Record<string, unknown>;
      const assessmentType = typeof item.assessmentType === 'string' ? item.assessmentType.trim().toUpperCase() : '';
      const assessmentTargetId = typeof item.assessmentTargetId === 'string' ? item.assessmentTargetId.trim() : '';
      const weight = typeof item.weight === 'number' ? item.weight : Number.NaN;
      const maxScore = typeof item.maxScore === 'number' ? item.maxScore : Number.NaN;
      const chapter = item.chapter === null || item.chapter === undefined ? null : Number(item.chapter);
      if (!['QUIZ', 'EXPERIMENT', 'LEARNING_PROGRESS', 'COMPREHENSIVE'].includes(assessmentType)) {
        return json({ error: '无效的考核类型' }, 400);
      }
      if (!assessmentTargetId || assessmentTargetId.length > 128
        || !Number.isFinite(weight) || weight <= 0 || weight > 1
        || !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
        return json({ error: '考核目标、权重或满分值无效' }, 400);
      }
      if (chapter !== null && (!Number.isInteger(chapter) || chapter < 1 || chapter > 10)) {
        return json({ error: '章节编号无效' }, 400);
      }
      const resource = resolveOBEAssessmentResource(assessmentType, assessmentTargetId, chapter);
      if (!resource.valid) return json({ error: resource.error }, 400);
      const resourceKey = `${assessmentType}:${assessmentTargetId}`;
      if (uniqueResources.has(resourceKey)) return json({ error: '同一正式考核资源不能重复配置' }, 400);
      uniqueResources.add(resourceKey);
      normalizedLinks.push({
        assessmentType,
        assessmentTargetId,
        weight,
        maxScore,
        chapter: resource.chapter,
        description: resource.description,
      });
    }
    normalizedLinks.sort((left, right) => (
      left.assessmentType.localeCompare(right.assessmentType)
      || left.assessmentTargetId.localeCompare(right.assessmentTargetId)
    ));

    requestSignature = signatureOf({ objectiveId: id, expectedVersion, links: normalizedLinks });
    receiptId = stableId('obe_assessment_config', `${payload.userId}:${requestId}`);
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
        return json({ error: '请求编号已用于其他考核配置' }, 409);
      }
      const objective = await prisma.courseObjective.findUnique({
        where: { id },
        include: { assessmentLinks: { orderBy: [{ assessmentType: 'asc' }, { assessmentTargetId: 'asc' }] } },
      });
      return json({ objective, duplicate: true, receiptId });
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
          throw new ConfigurationError('请求编号已用于其他考核配置', 409);
        }
        return { duplicate: true, unchanged: false };
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

      const totalWeight = normalizedLinks.reduce((sum, link) => sum + link.weight, 0);
      if (totalWeight > 1 + 1e-9) {
        throw new ConfigurationError('考核权重合计不能超过 100%', 400);
      }
      if (current.isActive && Math.abs(totalWeight - 1) > 1e-9) {
        throw new ConfigurationError('已启用课程目标的考核权重必须保持为 100%', 409);
      }

      const currentSignature = current.assessmentLinks
        .map((link) => ({
          assessmentType: link.assessmentType,
          assessmentTargetId: link.assessmentTargetId,
          weight: link.weight,
          maxScore: link.maxScore,
          chapter: link.chapter,
          description: link.description ?? '',
        }))
        .sort((left, right) => (
          left.assessmentType.localeCompare(right.assessmentType)
          || left.assessmentTargetId.localeCompare(right.assessmentTargetId)
        ));
      if (JSON.stringify(currentSignature) === JSON.stringify(normalizedLinks)) {
        return { duplicate: false, unchanged: true };
      }

      const historicalCount = await tx.courseObjectiveAchievement.count({
        where: { courseObjectiveId: id },
      });
      if ((current.isActive || historicalCount > 0)
        && body.confirm !== 'APPLY_ASSESSMENT_CONFIGURATION') {
        throw new ConfigurationError('替换考核映射前需明确确认现有达成度记录和后续重算影响', 409, {
          confirmationRequired: true,
          affectedAchievementRecords: historicalCount,
        });
      }

      await tx.assessmentLink.deleteMany({ where: { courseObjectiveId: id } });
      if (normalizedLinks.length > 0) {
        await tx.assessmentLink.createMany({
          data: normalizedLinks.map((link) => ({ courseObjectiveId: id, ...link })),
        });
      }
      const updated = await tx.courseObjective.updateMany({
        where: { id, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConfigurationError('课程目标配置已变化，请刷新后重新核对', 409);
      }
      await tx.userActivity.create({
        data: {
          id: receiptId,
          userId: payload.userId,
          action: 'REPLACE_OBE_ASSESSMENT_CONFIGURATION',
          details: JSON.stringify({
            requestId,
            objectiveId: id,
            signature: requestSignature,
            fromVersion: expectedVersion,
            toVersion: expectedVersion + 1,
            previousLinkCount: current.assessmentLinks.length,
            nextLinkCount: normalizedLinks.length,
            affectedAchievementRecords: historicalCount,
          }),
        },
      });
      return { duplicate: false, unchanged: false };
    }, { isolationLevel: 'Serializable' });

    const objective = await prisma.courseObjective.findUnique({
      where: { id },
      include: { assessmentLinks: { orderBy: [{ assessmentType: 'asc' }, { assessmentTargetId: 'asc' }] } },
    });
    return json({ objective, ...result, receiptId });
  } catch (error: any) {
    if (error instanceof ConfigurationError) return json({ error: error.message, ...error.details }, error.status);
    if (error?.code === 'P2034') return json({ error: '配置正在被其他操作更新，请使用同一请求编号重试' }, 409);
    if (error?.code === 'P2002' && receiptId) {
      const receipt = await prisma.userActivity.findUnique({ where: { id: receiptId }, select: { details: true } });
      if (receipt) {
        try {
          const parsed = JSON.parse(receipt.details ?? '{}') as Record<string, unknown>;
          if (parsed.signature === requestSignature && objectiveId) {
            const objective = await prisma.courseObjective.findUnique({
              where: { id: objectiveId },
              include: { assessmentLinks: { orderBy: [{ assessmentType: 'asc' }, { assessmentTargetId: 'asc' }] } },
            });
            return json({ objective, duplicate: true, receiptId });
          }
        } catch {
          // Fall through to the stable conflict response below.
        }
      }
      return json({ error: '请求编号已用于其他考核配置' }, 409);
    }
    console.error('PUT /api/obe/course-objectives/[id]/assessment-links error:', error);
    return json({ error: '服务器错误' }, 500);
  }
}
