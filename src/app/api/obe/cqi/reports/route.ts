import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';
import { getGapAnalysis, type GapAnalysisResult } from '@/lib/achievement-evaluation';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const SEMESTER_PATTERN = /^(\d{4})-(\d{4})-([12])$/;
const SOURCE_SNAPSHOT_SCHEMA = 'CQI_SOURCE_SNAPSHOT_V1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

type SnapshotFreshness = 'CURRENT' | 'HISTORICAL' | 'UNAVAILABLE';

interface SnapshotMetadata {
  schema: typeof SOURCE_SNAPSHOT_SCHEMA;
  sourceDigest: string;
  expectedRecords: number;
  actualRecords: number;
  totalIndicators: number;
  passedIndicators: number;
  configurationUpdatedAt: string | null;
}

interface CurrentSourceSnapshot {
  digest: string;
  metadata: SnapshotMetadata;
}

function finiteNumber(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function canonicalGapSource(gap: GapAnalysisResult): Record<string, unknown> {
  const byCode = <T extends { code: string }>(left: T, right: T): number => (
    left.code.localeCompare(right.code, 'en')
  );
  return {
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
}

function buildCurrentSourceSnapshot(gap: GapAnalysisResult): CurrentSourceSnapshot {
  const sourceDigest = createHash('sha256')
    .update(JSON.stringify(canonicalGapSource(gap)))
    .digest('hex');
  return {
    digest: sourceDigest,
    metadata: {
      schema: SOURCE_SNAPSHOT_SCHEMA,
      sourceDigest,
      expectedRecords: gap.expectedRecords,
      actualRecords: gap.actualRecords,
      totalIndicators: gap.totalIndicators,
      passedIndicators: gap.passedIndicators,
      configurationUpdatedAt: gap.configurationUpdatedAt,
    },
  };
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseSnapshotMetadata(value: unknown): SnapshotMetadata | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const metadata = parsed as Record<string, unknown>;
    if (metadata.schema !== SOURCE_SNAPSHOT_SCHEMA
      || typeof metadata.sourceDigest !== 'string'
      || !SHA256_PATTERN.test(metadata.sourceDigest)
      || !isNonNegativeInteger(metadata.expectedRecords)
      || !isNonNegativeInteger(metadata.actualRecords)
      || !isNonNegativeInteger(metadata.totalIndicators)
      || !isNonNegativeInteger(metadata.passedIndicators)
      || (metadata.configurationUpdatedAt !== null && typeof metadata.configurationUpdatedAt !== 'string')) {
      return null;
    }
    return {
      schema: SOURCE_SNAPSHOT_SCHEMA,
      sourceDigest: metadata.sourceDigest,
      expectedRecords: metadata.expectedRecords,
      actualRecords: metadata.actualRecords,
      totalIndicators: metadata.totalIndicators,
      passedIndicators: metadata.passedIndicators,
      configurationUpdatedAt: metadata.configurationUpdatedAt,
    };
  } catch {
    return null;
  }
}

function sourceScopeKey(classId: string | null, semester: string, reportType: string): string {
  return `${classId ?? ''}\u0000${semester}\u0000${reportType}`;
}

function asIsoString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function snapshotView(
  report: {
    previousMeasures: string | null;
    averageAchievement: number | null;
    passRate: number | null;
    totalStudents: number;
    passedStudents: number;
    createdAt: Date;
  },
  current: { snapshot: CurrentSourceSnapshot | null; gap: GapAnalysisResult | null; failed: boolean },
): {
  freshness: SnapshotFreshness;
  sourceDigest: string | null;
  currentSourceDigest: string | null;
  sourceCutoff: string | null;
  sourceSummary: Record<string, number | string | null>;
  currentDataStatus: Record<string, number | boolean> | null;
  note: string;
} {
  const stored = parseSnapshotMetadata(report.previousMeasures);
  const freshness: SnapshotFreshness = !stored || !current.snapshot
    ? 'UNAVAILABLE'
    : stored.sourceDigest === current.snapshot.digest ? 'CURRENT' : 'HISTORICAL';
  const currentDataStatus = current.gap ? {
    dataSufficient: current.gap.dataSufficient,
    actualRecords: current.gap.actualRecords,
    expectedRecords: current.gap.expectedRecords,
    totalStudents: current.gap.totalStudents,
    totalIndicators: current.gap.totalIndicators,
  } : null;
  const note = freshness === 'CURRENT'
    ? '该报告与当前服务端达成度源摘要一致。'
    : freshness === 'HISTORICAL'
      ? '当前达成度源摘要已变化；此版本保留用于追溯，只读展示。'
      : !stored
        ? '旧报告缺少可核验的源摘要，不能标记为当前版本，已按只读展示。'
        : current.failed
          ? '当前源数据核验失败，不能确认报告为当前版本，已按只读展示。'
          : '当前达成度记录不足，不能确认报告为当前版本，已按只读展示。';
  return {
    freshness,
    sourceDigest: stored?.sourceDigest ?? null,
    currentSourceDigest: current.snapshot?.digest ?? null,
    sourceCutoff: asIsoString(report.createdAt),
    sourceSummary: {
      actualRecords: stored?.actualRecords ?? null,
      expectedRecords: stored?.expectedRecords ?? null,
      totalStudents: report.totalStudents,
      passedStudents: report.passedStudents,
      totalIndicators: stored?.totalIndicators ?? null,
      passedIndicators: stored?.passedIndicators ?? null,
      averageAchievement: report.averageAchievement,
      passRate: report.passRate,
      configurationUpdatedAt: stored?.configurationUpdatedAt ?? null,
    },
    currentDataStatus,
    note,
  };
}

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

function validSemester(value: string): boolean {
  const match = SEMESTER_PATTERN.exec(value);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return json({ error: '权限不足' }, 403);
    }

    const { searchParams } = new URL(request.url);
    const semester = searchParams.get('semester')?.trim() || '';
    const reportType = searchParams.get('reportType')?.trim().toUpperCase() || '';
    const classId = searchParams.get('classId')?.trim() || '';
    if (semester && !validSemester(semester)) return json({ error: '学期格式无效' }, 400);
    if (reportType && reportType !== 'INDICATOR') return json({ error: '报告类型无效' }, 400);
    if (classId && !ID_PATTERN.test(classId)) return json({ error: '班级编号格式无效' }, 400);

    const where: Record<string, unknown> = {};
    if (semester) where.semester = semester;
    if (reportType) where.reportType = reportType;
    if (classId) where.classId = classId;

    if (payload.role !== 'ADMIN') {
      const classIds = await getAccessibleClassIds(payload);
      if (classIds.length === 0) return json({ dataProvenance: getDataProvenance(), reports: [] });
      if (classId && !classIds.includes(classId)) return json({ error: '无权查看该班级报告' }, 403);
      if (!classId) where.classId = { in: classIds };
    }

    const reports = await prisma.cQIReport.findMany({
      where,
      include: { actionItems: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const sourceScopes = new Map<string, { classId: string; semester: string; reportType: string }>();
    for (const report of reports) {
      if (!report.classId) continue;
      const key = sourceScopeKey(report.classId, report.semester, report.reportType);
      if (!sourceScopes.has(key)) {
        sourceScopes.set(key, {
          classId: report.classId,
          semester: report.semester,
          reportType: report.reportType,
        });
      }
    }
    const currentByScope = new Map<string, {
      snapshot: CurrentSourceSnapshot | null;
      gap: GapAnalysisResult | null;
      failed: boolean;
    }>();
    await Promise.all(Array.from(sourceScopes.entries()).map(async ([key, scope]) => {
      if (scope.reportType !== 'INDICATOR') {
        currentByScope.set(key, { snapshot: null, gap: null, failed: false });
        return;
      }
      try {
        const gap = await getGapAnalysis(scope.classId, scope.semester);
        currentByScope.set(key, {
          snapshot: gap.dataSufficient ? buildCurrentSourceSnapshot(gap) : null,
          gap,
          failed: false,
        });
      } catch (snapshotError) {
        console.error('Failed to verify CQI report source snapshot:', snapshotError);
        currentByScope.set(key, { snapshot: null, gap: null, failed: true });
      }
    }));
    const reportsWithFreshness = reports.map((report) => {
      const current = report.classId
        ? currentByScope.get(sourceScopeKey(report.classId, report.semester, report.reportType))
        : undefined;
      return {
        ...report,
        snapshot: snapshotView(report, current ?? { snapshot: null, gap: null, failed: false }),
      };
    });

    return json({ dataProvenance: getDataProvenance(), reports: reportsWithFreshness });
  } catch (error) {
    console.error('GET /api/obe/cqi/reports error:', error);
    return json({ error: '获取改进报告失败' }, 500);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return json({ error: '权限不足' }, 403);
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const semester = typeof body.semester === 'string' ? body.semester.trim() : '';
    const classId = typeof body.classId === 'string' ? body.classId.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const reportType = typeof body.reportType === 'string' ? body.reportType.trim().toUpperCase() : '';
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';

    if (!classId || !semester || !requestId) return json({ error: '缺少班级、学期或请求编号' }, 400);
    if (!ID_PATTERN.test(classId) || !REQUEST_ID_PATTERN.test(requestId)) {
      return json({ error: '班级或请求编号格式无效' }, 400);
    }
    if (!validSemester(semester)) return json({ error: '学期格式应为“起始年-结束年-1或2”' }, 400);
    if (reportType !== 'INDICATOR') {
      return json({ error: '当前仅支持生成班级指标点达成度报告' }, 400);
    }
    if (title.length > 200) return json({ error: '报告标题不能超过200位' }, 400);
    const clientOwnedAnalysisFields = [
      'averageAchievement',
      'passRate',
      'totalStudents',
      'passedStudents',
      'weakPoints',
      'strengths',
      'improvementMeasures',
    ].filter((field) => body[field] !== undefined);
    if (clientOwnedAnalysisFields.length > 0) {
      return json({ error: '报告分析内容必须由服务端达成度记录生成' }, 400);
    }

    const classGroup = await prisma.classGroup.findUnique({
      where: { id: classId },
      select: { id: true, name: true, status: true },
    });
    if (!classGroup || classGroup.status !== 'ACTIVE') return json({ error: '班级不存在或已归档' }, 404);
    if (payload.role !== 'ADMIN') {
      const accessible = await getAccessibleClassIds(payload);
      if (!accessible.includes(classId)) return json({ error: '无权操作该班级' }, 403);
    }

    const requestReceiptId = stableId('cqi_req', `${payload.userId}:${requestId}`);
    const requestReceipt = await prisma.userActivity.findUnique({
      where: { id: requestReceiptId },
      select: { details: true },
    });
    if (requestReceipt) {
      try {
        const receipt = JSON.parse(requestReceipt.details ?? '{}') as Record<string, unknown>;
        const sameScope = receipt.requestId === requestId
          && receipt.classId === classId
          && receipt.semester === semester
          && receipt.reportType === reportType
          && typeof receipt.reportId === 'string';
        if (!sameScope) return json({ error: '请求编号已用于其他报告' }, 409);
        const restored = await prisma.cQIReport.findUnique({
          where: { id: receipt.reportId as string },
          include: { actionItems: { orderBy: { createdAt: 'asc' } } },
        });
        if (!restored) return json({ error: '报告生成回执存在，但对应报告缺失，请联系管理员核对' }, 409);
        return json({ report: restored, duplicate: true });
      } catch {
        return json({ error: '报告生成回执损坏，请联系管理员核对' }, 409);
      }
    }

    const gap = await getGapAnalysis(classId, semester);
    if (!gap.dataSufficient) {
      return json({
        error: '当前达成度记录不足，不能生成正式改进报告',
        dataStatus: {
          actualRecords: gap.actualRecords,
          expectedRecords: gap.expectedRecords,
          totalStudents: gap.totalStudents,
          totalIndicators: gap.totalIndicators,
        },
      }, 409);
    }
    const sourceSnapshot = buildCurrentSourceSnapshot(gap);
    const reportId = stableId(
      'cqi',
      `${classId}:${semester}:${reportType}:${sourceSnapshot.digest}`,
    );
    const existing = await prisma.cQIReport.findUnique({
      where: { id: reportId },
      include: { actionItems: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) return json({ report: existing, duplicate: true });

    const improvementMeasures = gap.weakPoints.map((item) => ({
      target: item.code,
      measure: `围绕“${item.name}”安排针对性补学、实践和复测，并在下一轮达成度计算后复核。`,
      baseline: item.avgAchievement,
      threshold: item.threshold,
    }));
    const effectiveTitle = title || `${classGroup.name} ${semester} 指标点达成度分析报告`;

    try {
      const report = await prisma.$transaction(async (tx) => {
        const created = await tx.cQIReport.create({
          data: {
            id: reportId,
            semester,
            classId,
            title: effectiveTitle,
            reportType,
            averageAchievement: gap.averageAchievement,
            passRate: gap.passRate,
            totalStudents: gap.totalStudents,
            passedStudents: gap.passedStudents,
            weakPoints: JSON.stringify(gap.weakPoints),
            strengths: JSON.stringify(gap.strengths),
            improvementMeasures: JSON.stringify(improvementMeasures),
            // No schema change: this unused optional legacy field stores a
            // versioned CQI source descriptor. Older array/string values stay readable.
            previousMeasures: JSON.stringify(sourceSnapshot.metadata),
          },
        });
        await tx.userActivity.create({
          data: {
            id: requestReceiptId,
            userId: payload.userId,
            action: 'CREATE_CQI_REPORT',
            details: JSON.stringify({
              requestId,
              reportId,
              classId,
              semester,
              reportType,
              sourceDigest: sourceSnapshot.digest,
            }),
          },
        });
        return created;
      });
      return json({ report: { ...report, actionItems: [] }, duplicate: false }, 201);
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const raced = await prisma.cQIReport.findUnique({
        where: { id: reportId },
        include: { actionItems: { orderBy: { createdAt: 'asc' } } },
      });
      if (raced) return json({ report: raced, duplicate: true });
      return json({ error: '请求编号已用于其他报告' }, 409);
    }
  } catch (error) {
    console.error('POST /api/obe/cqi/reports error:', error);
    return json({ error: '生成改进报告失败' }, 500);
  }
}
