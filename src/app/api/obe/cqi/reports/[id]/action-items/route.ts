import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, type JWTPayload } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getGapAnalysis, type GapAnalysisResult } from '@/lib/achievement-evaluation';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
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
    console.error('Failed to verify CQI report freshness before adding an action:', error);
    return json({
      error: '暂时无法核验报告源快照，已保持只读，请稍后重试',
      freshness: 'UNAVAILABLE',
    }, 409);
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

    const actionItems = await prisma.cQIActionItem.findMany({
      where: { cqiReportId: id },
      orderBy: { createdAt: 'asc' },
    });
    return json({ actionItems });
  } catch (error) {
    console.error('GET /api/obe/cqi/reports/[id]/action-items error:', error);
    return json({ error: '获取改进项失败' }, 500);
  }
}

export async function POST(
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

    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim().toUpperCase() : '';
    const requestedAssignee = typeof body.assignedTo === 'string' ? body.assignedTo.trim() : '';
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    const dueDateText = typeof body.dueDate === 'string' ? body.dueDate.trim() : '';
    const dueDate = dueDateText ? new Date(`${dueDateText}T23:59:59+08:00`) : null;

    if (!description || !category || !dueDateText || !requestId) {
      return json({ error: '改进内容、类别、责任期限和请求编号均为必填项' }, 400);
    }
    if (description.length > 2000 || !REQUEST_ID_PATTERN.test(requestId)) {
      return json({ error: '改进内容或请求编号格式无效' }, 400);
    }
    if (!['CONTENT', 'METHOD', 'RESOURCE', 'ASSESSMENT'].includes(category)) {
      return json({ error: '无效的改进类别' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateText) || !dueDate || Number.isNaN(dueDate.getTime())) {
      return json({ error: '责任期限格式无效' }, 400);
    }
    const now = Date.now();
    if (dueDate.getTime() < now || dueDate.getTime() > now + 2 * 366 * 86_400_000) {
      return json({ error: '责任期限应在今天至两年内' }, 400);
    }

    const assignedTo = payload.role === 'TEACHER' ? payload.userId : requestedAssignee;
    if (!assignedTo) return json({ error: '管理员必须指定责任教师' }, 400);
    if (payload.role === 'TEACHER' && requestedAssignee && requestedAssignee !== payload.userId) {
      return json({ error: '教师只能将改进项指派给自己' }, 403);
    }

    const actionId = stableId('cqi_action', `${payload.userId}:${requestId}`);
    const existing = await prisma.cQIActionItem.findUnique({ where: { id: actionId } });
    if (existing) {
      const same = existing.cqiReportId === id
        && existing.description === description
        && existing.category === category
        && existing.assignedTo === assignedTo
        && existing.dueDate?.getTime() === dueDate.getTime();
      return same
        ? json({ actionItem: existing, duplicate: true })
        : json({ error: '请求编号已用于其他改进项' }, 409);
    }

    const freshnessFailure = await requireCurrentSourceSnapshot(authorizationResult.report);
    if (freshnessFailure) return freshnessFailure;

    if (authorizationResult.report.status !== 'DRAFT') {
      return json({ error: '报告提交审阅后不能再新增改进项' }, 409);
    }
    const assignee = await prisma.user.findUnique({
      where: { id: assignedTo },
      select: { role: true, status: true },
    });
    if (!assignee || assignee.role !== 'TEACHER' || assignee.status !== 'ACTIVE') {
      return json({ error: '责任教师不存在或未激活' }, 400);
    }

    try {
      const actionItem = await prisma.$transaction(async (tx) => {
        const currentReport = await tx.cQIReport.findUnique({
          where: { id },
          select: { status: true },
        });
        if (!currentReport) throw Object.assign(new Error('report missing'), { code: 'REPORT_MISSING' });
        if (currentReport.status !== 'DRAFT') {
          throw Object.assign(new Error('report locked'), { code: 'REPORT_LOCKED' });
        }
        const created = await tx.cQIActionItem.create({
          data: {
            id: actionId,
            cqiReportId: id,
            description,
            category,
            assignedTo,
            dueDate,
          },
        });
        await tx.userActivity.create({
          data: {
            id: stableId('cqi_action_evt', `${payload.userId}:${requestId}`),
            userId: payload.userId,
            action: 'CREATE_CQI_ACTION_ITEM',
            details: JSON.stringify({ requestId, reportId: id, actionItemId: actionId, assignedTo, dueDate: dueDateText }),
          },
        });
        return created;
      }, { isolationLevel: 'Serializable' });
      return json({ actionItem, duplicate: false }, 201);
    } catch (error: any) {
      if (error?.code === 'REPORT_MISSING') return json({ error: '报告不存在' }, 404);
      if (error?.code === 'REPORT_LOCKED') return json({ error: '报告提交审阅后不能再新增改进项' }, 409);
      if (error?.code === 'P2034') return json({ error: '报告状态正在变化，请使用同一请求编号重试' }, 409);
      if (error?.code !== 'P2002') throw error;
      const raced = await prisma.cQIActionItem.findUnique({ where: { id: actionId } });
      const same = raced?.cqiReportId === id
        && raced.description === description
        && raced.category === category
        && raced.assignedTo === assignedTo
        && raced.dueDate?.getTime() === dueDate.getTime();
      if (same) return json({ actionItem: raced, duplicate: true });
      return json({ error: '请求编号已用于其他改进项' }, 409);
    }
  } catch (error: any) {
    if (error?.code === 'P2025') return json({ error: '报告不存在' }, 404);
    console.error('POST /api/obe/cqi/reports/[id]/action-items error:', error);
    return json({ error: '新增改进项失败' }, 500);
  }
}
