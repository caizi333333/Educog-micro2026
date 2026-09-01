import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, type JWTPayload } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getGapAnalysis, type GapAnalysisResult } from '@/lib/achievement-evaluation';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const REPORT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['REVIEWED'],
  REVIEWED: ['APPROVED'],
  APPROVED: ['CLOSED'],
};
const ACTION_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
};
const ACTION_RESULT_SCHEMA = 'CQI_ACTION_RESULT_V1';
const RESULT_SUMMARY_MIN_LENGTH = 5;
const RESULT_SUMMARY_MAX_LENGTH = 1000;
const EVIDENCE_REFERENCE_MAX_LENGTH = 500;
const PLATFORM_RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const GENERIC_RESULT_SUMMARY_PATTERN = /^(完成|已完成|处理完成|任务已完成|改进项已完成)[。！!]?$/;
const SOURCE_SNAPSHOT_SCHEMA = 'CQI_SOURCE_SNAPSHOT_V1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

function finiteNumber(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function currentSourceDigest(gap: GapAnalysisResult): string {
  const byCode = <T extends { code: string }>(left: T, right: T): number => (
    left.code.localeCompare(right.code, 'en')
  );
  const canonical = {
    classId: gap.classId,
    semester: gap.semester,
    weakPoints: [...gap.weakPoints].sort(byCode).map((item) => ({
      code: item.code,
      name: item.name,
      avgAchievement: finiteNumber(item.avgAchievement),
      threshold: finiteNumber(item.threshold),
      gap: finiteNumber(item.gap),
    })),
    strengths: [...gap.strengths].sort(byCode).map((item) => ({
      code: item.code,
      name: item.name,
      avgAchievement: finiteNumber(item.avgAchievement),
    })),
    totalIndicators: gap.totalIndicators,
    passedIndicators: gap.passedIndicators,
    averageAchievement: finiteNumber(gap.averageAchievement),
    totalStudents: gap.totalStudents,
    passedStudents: gap.passedStudents,
    passRate: finiteNumber(gap.passRate),
    expectedRecords: gap.expectedRecords,
    actualRecords: gap.actualRecords,
    configurationUpdatedAt: gap.configurationUpdatedAt,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function storedSourceDigest(value: string | null): string | null {
  if (!value?.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const metadata = parsed as Record<string, unknown>;
    return metadata.schema === SOURCE_SNAPSHOT_SCHEMA
      && typeof metadata.sourceDigest === 'string'
      && SHA256_PATTERN.test(metadata.sourceDigest)
      ? metadata.sourceDigest
      : null;
  } catch {
    return null;
  }
}

async function requireCurrentSourceSnapshot(report: {
  classId: string | null;
  semester: string;
  reportType: string;
  previousMeasures: string | null;
}): Promise<NextResponse | null> {
  const storedDigest = storedSourceDigest(report.previousMeasures);
  if (!report.classId || report.reportType !== 'INDICATOR' || !storedDigest) {
    return json({
      error: '该报告缺少可核验的源快照，已设为只读；请基于当前达成度记录重新生成报告',
      freshness: 'UNAVAILABLE',
    }, 409);
  }
  try {
    const gap = await getGapAnalysis(report.classId, report.semester);
    if (!gap.dataSufficient) {
      return json({
        error: '当前达成度记录不足，无法确认该报告为当前快照，已设为只读',
        freshness: 'UNAVAILABLE',
        dataStatus: {
          actualRecords: gap.actualRecords,
          expectedRecords: gap.expectedRecords,
        },
      }, 409);
    }
    if (currentSourceDigest(gap) !== storedDigest) {
      return json({
        error: '该报告已成为历史快照，仅供追溯；请在当前快照中继续改进行动',
        freshness: 'HISTORICAL',
      }, 409);
    }
    return null;
  } catch (error) {
    console.error('Failed to verify CQI report freshness before write:', error);
    return json({
      error: '暂时无法核验报告源快照，已保持只读，请稍后重试',
      freshness: 'UNAVAILABLE',
    }, 409);
  }
}

function isValidEvidenceReference(value: string): boolean {
  if (value.length < 3 || value.length > EVIDENCE_REFERENCE_MAX_LENGTH) return false;
  if (/\s/.test(value)) return false;
  if (PLATFORM_RECORD_ID_PATTERN.test(value)) return true;
  if (value.startsWith('/') && !value.startsWith('//')) {
    try {
      const url = new URL(value, 'https://platform.invalid');
      return url.origin === 'https://platform.invalid';
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function serializeActionResult(summary: string, evidenceReference: string): string {
  return JSON.stringify({
    schema: ACTION_RESULT_SCHEMA,
    summary,
    evidenceReference,
  });
}

function isValidResultSummary(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= RESULT_SUMMARY_MIN_LENGTH
    && normalized.length <= RESULT_SUMMARY_MAX_LENGTH
    && !GENERIC_RESULT_SUMMARY_PATTERN.test(normalized);
}

function hasCompleteActionResult(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    const result = parsed as Record<string, unknown>;
    return result.schema === ACTION_RESULT_SCHEMA
      && typeof result.summary === 'string'
      && isValidResultSummary(result.summary)
      && typeof result.evidenceReference === 'string'
      && isValidEvidenceReference(result.evidenceReference.trim());
  } catch {
    // Plain legacy strings remain readable but are not sufficient closing evidence.
    return false;
  }
}

async function authorizeReport(
  reportId: string,
  payload: JWTPayload,
): Promise<
  | {
    ok: true;
    report: {
      id: string;
      classId: string | null;
      status: string;
      semester: string;
      reportType: string;
      previousMeasures: string | null;
    };
  }
  | { ok: false; response: NextResponse }
> {
  const report = await prisma.cQIReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      classId: true,
      status: true,
      semester: true,
      reportType: true,
      previousMeasures: true,
    },
  });
  if (!report) return { ok: false, response: json({ error: '报告不存在' }, 404) };
  if (payload.role !== 'ADMIN') {
    if (!report.classId) return { ok: false, response: json({ error: '无权访问该报告' }, 403) };
    const accessible = await getAccessibleClassIds(payload);
    if (!accessible.includes(report.classId)) {
      return { ok: false, response: json({ error: '无权访问该报告' }, 403) };
    }
  }
  return { ok: true, report };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') return json({ error: '权限不足' }, 403);

    const { id } = await params;
    const authorizationResult = await authorizeReport(id, payload);
    if (!authorizationResult.ok) return authorizationResult.response;
    const report = await prisma.cQIReport.findUnique({
      where: { id },
      include: { actionItems: { orderBy: { createdAt: 'asc' } } },
    });
    return json({ report });
  } catch (error) {
    console.error('GET /api/obe/cqi/reports/[id] error:', error);
    return json({ error: '获取改进报告失败' }, 500);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') return json({ error: '权限不足' }, 403);

    const { id } = await params;
    const authorizationResult = await authorizeReport(id, payload);
    if (!authorizationResult.ok) return authorizationResult.response;

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    if (!REQUEST_ID_PATTERN.test(requestId)) return json({ error: '请求编号格式无效' }, 400);
    const actionItemId = typeof body.actionItemId === 'string' ? body.actionItemId.trim() : '';
    const actionStatus = typeof body.actionStatus === 'string' ? body.actionStatus.trim().toUpperCase() : '';
    const expectedActionStatus = typeof body.expectedActionStatus === 'string'
      ? body.expectedActionStatus.trim().toUpperCase()
      : '';
    const reportStatus = typeof body.status === 'string' ? body.status.trim().toUpperCase() : '';
    const expectedReportStatus = typeof body.expectedStatus === 'string'
      ? body.expectedStatus.trim().toUpperCase()
      : '';

    const isActionOperation = Boolean(actionItemId || actionStatus || expectedActionStatus);
    const isReportOperation = Boolean(reportStatus || expectedReportStatus);
    if (isActionOperation === isReportOperation) {
      return json({ error: '一次请求只能更新报告状态或一个改进项状态' }, 400);
    }

    const hasResultFields = body.resultSummary !== undefined || body.evidenceReference !== undefined;
    let serializedActionResult: string | null = null;
    let actionResultHash: string | null = null;
    if (isActionOperation && actionStatus === 'COMPLETED') {
      const resultSummary = typeof body.resultSummary === 'string' ? body.resultSummary.trim() : '';
      const evidenceReference = typeof body.evidenceReference === 'string' ? body.evidenceReference.trim() : '';
      if (!isValidResultSummary(resultSummary)) {
        return json({ error: `完成改进项前须填写 ${RESULT_SUMMARY_MIN_LENGTH} 至 ${RESULT_SUMMARY_MAX_LENGTH} 字的具体结果摘要，不能只写“已完成”` }, 400);
      }
      if (!isValidEvidenceReference(evidenceReference)) {
        return json({ error: '完成改进项前须填写有效的证据引用：http(s) 链接、站内链接或平台记录编号' }, 400);
      }
      serializedActionResult = serializeActionResult(resultSummary, evidenceReference);
      actionResultHash = createHash('sha256').update(serializedActionResult).digest('hex');
    } else if (hasResultFields) {
      return json({ error: '结果摘要和证据引用只能在标记完成或补充完成证据时提交' }, 400);
    }

    const eventId = stableId('cqi_update', `${payload.userId}:${requestId}`);
    const priorEvent = await prisma.userActivity.findUnique({ where: { id: eventId }, select: { details: true } });
    if (priorEvent) {
      try {
        const receipt = JSON.parse(priorEvent.details ?? '{}') as Record<string, unknown>;
        const same = receipt.reportId === id
          && receipt.actionItemId === (actionItemId || null)
          && receipt.toStatus === (actionStatus || reportStatus)
          && (typeof receipt.resultHash === 'string' ? receipt.resultHash : null) === actionResultHash;
        if (!same) return json({ error: '请求编号已用于其他状态操作' }, 409);
        const report = await prisma.cQIReport.findUnique({
          where: { id },
          include: { actionItems: { orderBy: { createdAt: 'asc' } } },
        });
        return json({ report, duplicate: true });
      } catch {
        return json({ error: '请求编号回执损坏，请联系管理员核对' }, 409);
      }
    }

    const freshnessFailure = await requireCurrentSourceSnapshot(authorizationResult.report);
    if (freshnessFailure) return freshnessFailure;

    if (isActionOperation) {
      if (!actionItemId || !actionStatus || !expectedActionStatus) {
        return json({ error: '改进项、原状态和目标状态均为必填项' }, 400);
      }
      if (authorizationResult.report.status !== 'APPROVED') {
        return json({ error: '报告批准后才能执行改进行动' }, 409);
      }
      const isEvidenceRepair = expectedActionStatus === 'COMPLETED' && actionStatus === 'COMPLETED';
      if (!isEvidenceRepair && !ACTION_TRANSITIONS[expectedActionStatus]?.includes(actionStatus)) {
        return json({ error: '改进项状态必须按“待处理—进行中—已完成”顺序推进' }, 409);
      }
      const actionItem = await prisma.cQIActionItem.findFirst({
        where: { id: actionItemId, cqiReportId: id },
        select: { id: true, status: true, assignedTo: true, result: true },
      });
      if (!actionItem) return json({ error: '改进项不存在' }, 404);
      if (payload.role === 'TEACHER' && actionItem.assignedTo !== payload.userId) {
        return json({ error: '只能推进分配给自己的改进项' }, 403);
      }
      if (actionItem.status !== expectedActionStatus) {
        return json({ error: '改进项状态已变化，请刷新后重试', currentStatus: actionItem.status }, 409);
      }
      if (isEvidenceRepair && hasCompleteActionResult(actionItem.result)) {
        return json({ error: '该改进项已有完整完成证据，不能用新的请求静默覆盖' }, 409);
      }

      try {
        await prisma.$transaction(async (tx) => {
          const currentReport = await tx.cQIReport.findUnique({
            where: { id },
            select: { status: true },
          });
          if (!currentReport || currentReport.status !== 'APPROVED') {
            throw Object.assign(new Error('report no longer approved'), { code: 'REPORT_NOT_APPROVED' });
          }
          const changed = await tx.cQIActionItem.updateMany({
            where: {
              id: actionItemId,
              cqiReportId: id,
              status: expectedActionStatus,
              ...(isEvidenceRepair ? { result: actionItem.result } : {}),
            },
            data: {
              status: actionStatus,
              ...(serializedActionResult ? { result: serializedActionResult } : {}),
            },
          });
          if (changed.count !== 1) throw Object.assign(new Error('stale action state'), { code: 'STALE_ACTION' });
          await tx.userActivity.create({
            data: {
              id: eventId,
              userId: payload.userId,
              action: 'UPDATE_CQI_ACTION_STATUS',
              details: JSON.stringify({
                requestId,
                reportId: id,
                actionItemId,
                fromStatus: expectedActionStatus,
                toStatus: actionStatus,
                resultHash: actionResultHash,
              }),
            },
          });
        }, { isolationLevel: 'Serializable' });
      } catch (error: any) {
        if (error?.code === 'REPORT_NOT_APPROVED') return json({ error: '报告状态已变化，不能继续执行改进行动' }, 409);
        if (error?.code === 'STALE_ACTION') {
          const current = await prisma.cQIActionItem.findUnique({ where: { id: actionItemId }, select: { status: true } });
          return json({ error: '改进项状态已变化，请刷新后重试', currentStatus: current?.status }, 409);
        }
        if (error?.code === 'P2034') return json({ error: '改进项正在被更新，请使用同一请求编号重试' }, 409);
        if (error?.code === 'P2002') return json({ error: '请求编号已用于其他状态操作' }, 409);
        throw error;
      }

      const updated = await prisma.cQIActionItem.findUnique({ where: { id: actionItemId } });
      return json({ actionItem: updated, duplicate: false });
    }

    if (!reportStatus || !expectedReportStatus) {
      return json({ error: '报告原状态和目标状态均为必填项' }, 400);
    }
    if (authorizationResult.report.status !== expectedReportStatus) {
      return json({
        error: '报告状态已变化，请刷新后重试',
        currentStatus: authorizationResult.report.status,
      }, 409);
    }
    if (!REPORT_TRANSITIONS[expectedReportStatus]?.includes(reportStatus)) {
      return json({ error: '报告状态必须按“草稿—审阅—批准—关闭”顺序推进' }, 409);
    }
    if (payload.role === 'TEACHER' && !(expectedReportStatus === 'DRAFT' && reportStatus === 'REVIEWED')) {
      return json({ error: '教师只能将草稿提交审阅' }, 403);
    }
    if ((reportStatus === 'APPROVED' || reportStatus === 'CLOSED') && payload.role !== 'ADMIN') {
      return json({ error: '仅管理员可批准或关闭报告' }, 403);
    }

    try {
      await prisma.$transaction(async (tx) => {
        const currentReport = await tx.cQIReport.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!currentReport) throw Object.assign(new Error('report missing'), { code: 'REPORT_MISSING' });
        if (currentReport.status !== expectedReportStatus) {
          throw Object.assign(new Error('stale report state'), { code: 'STALE_REPORT' });
        }
        const actionItems = await tx.cQIActionItem.findMany({
          where: { cqiReportId: id },
          select: { id: true, status: true, result: true },
        });
        if ((reportStatus === 'REVIEWED' || reportStatus === 'APPROVED') && actionItems.length === 0) {
          throw Object.assign(new Error('missing action items'), { code: 'NO_ACTIONS' });
        }
        if (reportStatus === 'CLOSED' && actionItems.some((item) => item.status !== 'COMPLETED')) {
          throw Object.assign(new Error('incomplete action items'), { code: 'ACTIONS_INCOMPLETE' });
        }
        if (reportStatus === 'CLOSED' && actionItems.some((item) => !hasCompleteActionResult(item.result))) {
          throw Object.assign(new Error('action evidence incomplete'), { code: 'ACTION_EVIDENCE_INCOMPLETE' });
        }
        const changed = await tx.cQIReport.updateMany({
          where: { id, status: expectedReportStatus },
          data: {
            status: reportStatus,
            reviewedBy: reportStatus === 'REVIEWED' ? payload.userId : undefined,
          },
        });
        if (changed.count !== 1) throw Object.assign(new Error('stale report state'), { code: 'STALE_REPORT' });
        await tx.userActivity.create({
          data: {
            id: eventId,
            userId: payload.userId,
            action: 'UPDATE_CQI_REPORT_STATUS',
            details: JSON.stringify({
              requestId,
              reportId: id,
              actionItemId: null,
              fromStatus: expectedReportStatus,
              toStatus: reportStatus,
            }),
          },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error: any) {
      if (error?.code === 'REPORT_MISSING') return json({ error: '报告不存在' }, 404);
      if (error?.code === 'NO_ACTIONS') {
        return json({ error: '报告至少需要一个明确的改进项才能进入审阅或批准状态' }, 409);
      }
      if (error?.code === 'ACTIONS_INCOMPLETE') return json({ error: '仍有未完成的改进项，不能关闭报告' }, 409);
      if (error?.code === 'ACTION_EVIDENCE_INCOMPLETE') {
        return json({ error: '仍有改进项缺少结果摘要或有效证据引用，不能关闭报告' }, 409);
      }
      if (error?.code === 'STALE_REPORT') {
        const current = await prisma.cQIReport.findUnique({ where: { id }, select: { status: true } });
        return json({ error: '报告状态已变化，请刷新后重试', currentStatus: current?.status }, 409);
      }
      if (error?.code === 'P2034') return json({ error: '报告或改进项正在被更新，请使用同一请求编号重试' }, 409);
      if (error?.code === 'P2002') return json({ error: '请求编号已用于其他状态操作' }, 409);
      throw error;
    }

    const report = await prisma.cQIReport.findUnique({
      where: { id },
      include: { actionItems: { orderBy: { createdAt: 'asc' } } },
    });
    return json({ report, duplicate: false });
  } catch (error: any) {
    if (error?.code === 'P2025') return json({ error: '报告不存在' }, 404);
    console.error('PUT /api/obe/cqi/reports/[id] error:', error);
    return json({ error: '更新改进状态失败' }, 500);
  }
}
