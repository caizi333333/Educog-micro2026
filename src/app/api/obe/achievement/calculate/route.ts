import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';
import { batchCalculateClassAchievement, batchCalculateUserAchievement } from '@/lib/achievement-evaluation';
import {
  buildOBECalculationScopeRevision,
  buildOBEConfigurationRevision,
  resolveOBEAssessmentResource,
} from '@/lib/obe-data';
import { prisma } from '@/lib/prisma';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const SEMESTER_PATTERN = /^(\d{4})-(\d{4})-([12])$/;
const SCOPE_REVISION_PATTERN = /^[a-f0-9]{24}$/;

interface CalculationSignature {
  mode: 'class' | 'user';
  classId: string | null;
  userId: string | null;
  semester: string | null;
  scopeRevision: string | null;
}

interface CalculationReceipt {
  kind: 'OBE_CALCULATION';
  requestId: string;
  signature: CalculationSignature;
  result: Record<string, unknown>;
}

interface ActiveConfigurationState {
  revision: string;
  updatedAt: Date;
  objectiveIds: string[];
  indicatorPointIds: string[];
  objectiveCount: number;
  indicatorPointCount: number;
  error: string | null;
}

interface CalculationReview {
  confirmationRequired: true;
  mode: 'class' | 'user';
  targetUserId: string | null;
  targetCount: number;
  objectiveCount: number;
  indicatorPointCount: number;
  expectedCourseObjectiveRecords: number;
  currentCourseObjectiveRecords: number;
  staleCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  expectedIndicatorRecords: number;
  currentIndicatorRecords: number;
  staleIndicatorRecords: number;
  missingIndicatorRecords: number;
  configurationRevision: string;
  configurationUpdatedAt: string;
  scopeRevision: string;
  students: CalculationStudentReview[];
}

interface CalculationStudentReview {
  userId: string;
  name: string;
  studentCode: string | null;
  freshCourseObjectiveRecords: number;
  staleCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  freshIndicatorRecords: number;
  staleIndicatorRecords: number;
  missingIndicatorRecords: number;
  complete: boolean;
  lastCalculatedAt: string | null;
}

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function receiptId(actorId: string, requestId: string): string {
  return `obe_calc_${createHash('sha256').update(`${actorId}:${requestId}`).digest('hex').slice(0, 32)}`;
}

function parseReceipt(details: string | null): CalculationReceipt | null {
  if (!details) return null;
  try {
    const value = JSON.parse(details) as Partial<CalculationReceipt>;
    if (value.kind !== 'OBE_CALCULATION' || !value.signature || !value.result) return null;
    return value as CalculationReceipt;
  } catch {
    return null;
  }
}

function sameSignature(left: CalculationSignature, right: CalculationSignature): boolean {
  return left.mode === right.mode
    && left.classId === right.classId
    && left.userId === right.userId
    && left.semester === right.semester
    && (!left.scopeRevision || !right.scopeRevision || left.scopeRevision === right.scopeRevision);
}

function isValidSemester(value: string): boolean {
  const match = SEMESTER_PATTERN.exec(value);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

async function loadAssessmentConfiguration(): Promise<ActiveConfigurationState> {
  const objectives = await prisma.courseObjective.findMany({
    where: { isActive: true },
    select: {
      id: true,
      code: true,
      version: true,
      updatedAt: true,
      indicatorPointId: true,
      indicatorPoint: {
        select: {
          id: true,
          updatedAt: true,
          achievementThreshold: true,
        },
      },
      assessmentLinks: {
        select: {
          assessmentType: true,
          assessmentTargetId: true,
          weight: true,
          chapter: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { code: 'asc' },
  });

  const errors: string[] = [];
  if (objectives.length === 0) errors.push('尚未配置有效课程目标，不能生成达成度结果');
  for (const objective of objectives) {
    if (objective.assessmentLinks.length === 0) {
      errors.push(`${objective.code} 没有考核环节`);
      continue;
    }

    const totalWeight = objective.assessmentLinks.reduce((sum, link) => sum + link.weight, 0);
    if (Math.abs(totalWeight - 1) > 1e-6) {
      errors.push(`${objective.code} 考核权重合计为 ${(totalWeight * 100).toFixed(1)}%，应为 100%`);
    }

    for (const link of objective.assessmentLinks) {
      const resource = resolveOBEAssessmentResource(
        link.assessmentType,
        link.assessmentTargetId,
        link.chapter,
      );
      if (!resource.valid) errors.push(`${objective.code}：${resource.error}`);
    }
  }

  const timestamps = objectives.flatMap((objective) => [
    objective.updatedAt,
    ...(objective.indicatorPoint ? [objective.indicatorPoint.updatedAt] : []),
    ...objective.assessmentLinks.map((link) => link.updatedAt),
  ]);
  const updatedAt = timestamps.length > 0
    ? new Date(Math.max(...timestamps.map((value) => value.getTime())))
    : new Date(0);
  const indicatorPointIds = [...new Set(objectives.map((objective) => objective.indicatorPointId))];

  return {
    revision: buildOBEConfigurationRevision(objectives),
    updatedAt,
    objectiveIds: objectives.map((objective) => objective.id),
    indicatorPointIds,
    objectiveCount: objectives.length,
    indicatorPointCount: indicatorPointIds.length,
    error: errors.length > 0 ? `课程目标配置未通过检查：${errors.join('；')}` : null,
  };
}

async function buildClassReview(
  classId: string,
  semester: string | null,
  configuration: ActiveConfigurationState,
  targetUserId: string | null = null,
): Promise<CalculationReview> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      classId,
      role: 'STUDENT',
      status: 'ACTIVE',
      user: { role: 'STUDENT', status: 'ACTIVE' },
      ...(targetUserId ? { userId: targetUserId } : {}),
    },
    select: {
      userId: true,
      user: { select: { name: true, username: true, studentId: true } },
    },
    orderBy: { userId: 'asc' },
  });
  const targetUserIds = enrollments.map((item) => item.userId);
  const storedSemester = semester ?? '';
  const courseObjectiveScope = {
    classId,
    semester: storedSemester,
    userId: { in: targetUserIds },
    courseObjectiveId: { in: configuration.objectiveIds },
  };
  const indicatorScope = {
    classId,
    semester: storedSemester,
    userId: { in: targetUserIds },
    indicatorPointId: { in: configuration.indicatorPointIds },
  };
  const [courseObjectiveRecords, indicatorRecords] = targetUserIds.length > 0
    ? await Promise.all([
      prisma.courseObjectiveAchievement.findMany({
        where: courseObjectiveScope,
        select: { userId: true, calculatedAt: true },
      }),
      prisma.graduationRequirementAchievement.findMany({
        where: indicatorScope,
        select: { userId: true, calculatedAt: true },
      }),
    ])
    : [[], []];
  const currentCORecords = courseObjectiveRecords.filter((record) => record.calculatedAt >= configuration.updatedAt);
  const staleCORecords = courseObjectiveRecords.filter((record) => record.calculatedAt < configuration.updatedAt);
  const currentIPRecords = indicatorRecords.filter((record) => record.calculatedAt >= configuration.updatedAt);
  const staleIPRecords = indicatorRecords.filter((record) => record.calculatedAt < configuration.updatedAt);
  const currentCO = currentCORecords.length;
  const staleCO = staleCORecords.length;
  const currentIP = currentIPRecords.length;
  const staleIP = staleIPRecords.length;
  const expectedCO = targetUserIds.length * configuration.objectiveCount;
  const expectedIP = targetUserIds.length * configuration.indicatorPointCount;
  const countByUser = (records: Array<{ userId: string }>): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const record of records) counts.set(record.userId, (counts.get(record.userId) ?? 0) + 1);
    return counts;
  };
  const freshCOByUser = countByUser(currentCORecords);
  const staleCOByUser = countByUser(staleCORecords);
  const freshIPByUser = countByUser(currentIPRecords);
  const staleIPByUser = countByUser(staleIPRecords);
  const latestByUser = new Map<string, Date>();
  for (const record of [...currentCORecords, ...currentIPRecords]) {
    const previous = latestByUser.get(record.userId);
    if (!previous || record.calculatedAt > previous) latestByUser.set(record.userId, record.calculatedAt);
  }
  const students = enrollments.map((enrollment) => {
    const freshCourseObjectiveRecords = freshCOByUser.get(enrollment.userId) ?? 0;
    const freshIndicatorRecords = freshIPByUser.get(enrollment.userId) ?? 0;
    return {
      userId: enrollment.userId,
      name: enrollment.user?.name?.trim() || enrollment.user?.username?.trim() || enrollment.userId,
      studentCode: enrollment.user?.studentId?.trim() || null,
      freshCourseObjectiveRecords,
      staleCourseObjectiveRecords: staleCOByUser.get(enrollment.userId) ?? 0,
      missingCourseObjectiveRecords: Math.max(0, configuration.objectiveCount - freshCourseObjectiveRecords),
      freshIndicatorRecords,
      staleIndicatorRecords: staleIPByUser.get(enrollment.userId) ?? 0,
      missingIndicatorRecords: Math.max(0, configuration.indicatorPointCount - freshIndicatorRecords),
      complete: configuration.objectiveCount > 0
        && configuration.indicatorPointCount > 0
        && freshCourseObjectiveRecords === configuration.objectiveCount
        && freshIndicatorRecords === configuration.indicatorPointCount,
      lastCalculatedAt: latestByUser.get(enrollment.userId)?.toISOString() ?? null,
    };
  });

  return {
    confirmationRequired: true,
    mode: targetUserId ? 'user' : 'class',
    targetUserId,
    targetCount: targetUserIds.length,
    objectiveCount: configuration.objectiveCount,
    indicatorPointCount: configuration.indicatorPointCount,
    expectedCourseObjectiveRecords: expectedCO,
    currentCourseObjectiveRecords: currentCO,
    staleCourseObjectiveRecords: staleCO,
    missingCourseObjectiveRecords: Math.max(0, expectedCO - currentCO),
    expectedIndicatorRecords: expectedIP,
    currentIndicatorRecords: currentIP,
    staleIndicatorRecords: staleIP,
    missingIndicatorRecords: Math.max(0, expectedIP - currentIP),
    configurationRevision: configuration.revision,
    configurationUpdatedAt: configuration.updatedAt.toISOString(),
    scopeRevision: buildOBECalculationScopeRevision({
      configurationRevision: configuration.revision,
      classId,
      userId: targetUserId,
      semester,
      targetUserIds,
    }),
    students,
  };
}

async function findReceipt(id: string): Promise<CalculationReceipt | null> {
  const record = await prisma.userActivity.findUnique({
    where: { id },
    select: { details: true },
  });
  return parseReceipt(record?.details ?? null);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') return json({ error: '权限不足' }, 403);

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId')?.trim() || '';
    let semester = searchParams.get('semester')?.trim() || '';
    if (!ID_PATTERN.test(classId)) return json({ error: '班级编号格式无效' }, 400);
    if (semester && !isValidSemester(semester)) {
      return json({ error: '学期格式应为“起始年-结束年-1或2”' }, 400);
    }

    const classGroup = await prisma.classGroup.findUnique({
      where: { id: classId },
      select: { id: true, status: true, semester: true },
    });
    if (!classGroup || classGroup.status !== 'ACTIVE') return json({ error: '班级不存在或已归档' }, 404);
    if (!semester) {
      const classSemester = classGroup.semester?.trim() || '';
      if (!isValidSemester(classSemester)) {
        return json({ error: '班级未配置有效学期，请先完善班级信息' }, 400);
      }
      semester = classSemester;
    }
    if (payload.role !== 'ADMIN') {
      const accessible = await getAccessibleClassIds(payload);
      if (!accessible.includes(classId)) return json({ error: '无权查看该班级' }, 403);
    }

    const configuration = await loadAssessmentConfiguration();
    const review = await buildClassReview(classId, semester, configuration);
    return json({
      dataProvenance: getDataProvenance(),
      review,
      configurationError: configuration.error,
    });
  } catch (error) {
    console.error('GET /api/obe/achievement/calculate error:', error);
    return json({ error: '服务器错误' }, 500);
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

    const classId = typeof body.classId === 'string' ? body.classId.trim() : '';
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    let semester = typeof body.semester === 'string' && body.semester.trim()
      ? body.semester.trim()
      : null;
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    const expectedScopeRevision = typeof body.expectedScopeRevision === 'string'
      ? body.expectedScopeRevision.trim()
      : '';

    if (!classId && !userId) return json({ error: '请指定班级或学生' }, 400);
    if ((classId && !ID_PATTERN.test(classId)) || (userId && !ID_PATTERN.test(userId))) {
      return json({ error: '班级或学生编号格式无效' }, 400);
    }
    if (!REQUEST_ID_PATTERN.test(requestId)) {
      return json({ error: '请求编号格式无效' }, 400);
    }
    if (expectedScopeRevision && !SCOPE_REVISION_PATTERN.test(expectedScopeRevision)) {
      return json({ error: '计算范围版本格式无效' }, 400);
    }
    if (semester && !isValidSemester(semester)) {
      return json({ error: '学期格式应为“起始年-结束年-1或2”' }, 400);
    }

    const deterministicReceiptId = receiptId(payload.userId, requestId);
    if (classId) {
      const classGroup = await prisma.classGroup.findUnique({
        where: { id: classId },
        select: { id: true, status: true, semester: true },
      });
      if (!classGroup || classGroup.status !== 'ACTIVE') {
        return json({ error: '班级不存在或已归档' }, 404);
      }
      if (payload.role !== 'ADMIN') {
        const accessible = await getAccessibleClassIds(payload);
        if (!accessible.includes(classId)) return json({ error: '无权操作该班级' }, 403);
      }
      if (!semester) {
        const classSemester = classGroup.semester?.trim() || '';
        if (!isValidSemester(classSemester)) {
          return json({ error: '班级未配置有效学期，请先完善班级信息' }, 400);
        }
        semester = classSemester;
      }
    }

    if (userId) {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      });
      if (!target || target.role !== 'STUDENT' || target.status !== 'ACTIVE') {
        return json({ error: '目标学生不存在或未激活' }, 404);
      }
      if (!classId) {
        return json({ error: '计算单个学生时必须同时指定班级' }, 400);
      }
      if (classId) {
        const enrollment = await prisma.classEnrollment.findFirst({
          where: { userId, classId, role: 'STUDENT', status: 'ACTIVE' },
          select: { id: true },
        });
        if (!enrollment) return json({ error: '该学生不在指定班级的有效名单中' }, 404);
      }
    }

    const configuration = await loadAssessmentConfiguration();
    const review = classId
      ? await buildClassReview(classId, semester, configuration, userId || null)
      : null;
    const currentScopeRevision = review?.scopeRevision ?? buildOBECalculationScopeRevision({
      configurationRevision: configuration.revision,
      classId: classId || null,
      userId: userId || null,
      semester,
      targetUserIds: userId ? [userId] : [],
    });
    const mode: CalculationSignature['mode'] = userId ? 'user' : 'class';
    const signature: CalculationSignature = {
      mode,
      classId: classId || null,
      userId: userId || null,
      semester,
      scopeRevision: expectedScopeRevision || currentScopeRevision,
    };

    const existingReceipt = await findReceipt(deterministicReceiptId);
    if (existingReceipt) {
      if (!sameSignature(existingReceipt.signature, signature)) {
        return json({ error: '请求编号已用于不同的计算范围' }, 409);
      }
      const completedScopeRevision = existingReceipt.signature.scopeRevision
        || (typeof existingReceipt.result.scopeRevision === 'string'
          ? existingReceipt.result.scopeRevision
          : null);
      return json({
        ...existingReceipt.result,
        duplicate: true,
        scopeStale: Boolean(completedScopeRevision && completedScopeRevision !== currentScopeRevision),
        currentScopeRevision,
      });
    }

    if (configuration.error) return json({ error: configuration.error }, 409);

    let result: Record<string, unknown>;
    if (userId) {
      if (classId) {
        if (!review || review.targetCount !== 1) {
          return json({ error: '该学生不在当前有效名单中' }, 409);
        }
        if (body.confirm !== 'CALCULATE_USER' || !expectedScopeRevision) {
          return json({
            error: `本次将按当前配置重新计算 ${review.students[0]?.name ?? '目标学生'} 的达成度，请核对计算范围`,
            ...review,
          }, 409);
        }
        if (expectedScopeRevision !== review.scopeRevision) {
          return json({
            error: '课程目标配置或学生班级状态已变化，请重新核对计算范围',
            confirmationStale: true,
            ...review,
          }, 409);
        }
      }
      const calculated = await batchCalculateUserAchievement(userId, semester, classId || null);
      const currentConfiguration = await loadAssessmentConfiguration();
      const scopeAfterCalculation = classId
        ? (await buildClassReview(classId, semester, currentConfiguration, userId)).scopeRevision
        : buildOBECalculationScopeRevision({
          configurationRevision: currentConfiguration.revision,
          classId: null,
          userId,
          semester,
          targetUserIds: [userId],
        });
      if (currentConfiguration.error || scopeAfterCalculation !== currentScopeRevision) {
        return json({
          error: '计算期间课程目标配置发生变化，本次结果不会作为当前版本结果使用，请重新核对后计算',
          confirmationRequired: true,
          confirmationStale: true,
          currentScopeRevision: scopeAfterCalculation,
        }, 409);
      }
      result = {
        mode: 'user',
        classId: classId || null,
        userId,
        semester,
        configurationRevision: configuration.revision,
        configurationUpdatedAt: configuration.updatedAt.toISOString(),
        scopeRevision: currentScopeRevision,
        ...calculated,
      };
    } else {
      if (!review || review.targetCount === 0) {
        return json({ error: '该班级没有可计算的有效学生' }, 409);
      }
      if (body.confirm !== 'CALCULATE_CLASS' || !expectedScopeRevision) {
        return json({
          error: `本次将按当前配置重新计算 ${review.targetCount} 名学生的达成度，请核对计算范围`,
          ...review,
        }, 409);
      }
      if (expectedScopeRevision !== review.scopeRevision) {
        return json({
          error: '课程目标配置或班级有效名单已变化，请重新核对计算范围',
          confirmationStale: true,
          ...review,
        }, 409);
      }

      const calculated = await batchCalculateClassAchievement(classId, semester);
      const currentConfiguration = await loadAssessmentConfiguration();
      const currentReview = await buildClassReview(classId, semester, currentConfiguration);
      if (currentConfiguration.error || currentReview.scopeRevision !== review.scopeRevision) {
        return json({
          error: '计算期间课程目标配置或班级有效名单发生变化，旧范围结果不会展示，请按新范围重新计算',
          confirmationStale: true,
          ...currentReview,
        }, 409);
      }
      result = {
        mode: 'class',
        classId,
        semester,
        configurationRevision: configuration.revision,
        configurationUpdatedAt: configuration.updatedAt.toISOString(),
        scopeRevision: review.scopeRevision,
        ...calculated,
      };
    }

    const receipt: CalculationReceipt = {
      kind: 'OBE_CALCULATION',
      requestId,
      signature,
      result,
    };
    try {
      await prisma.userActivity.create({
        data: {
          id: deterministicReceiptId,
          userId: payload.userId,
          action: 'CALCULATE_OBE_ACHIEVEMENT',
          details: JSON.stringify(receipt),
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const racedReceipt = await findReceipt(deterministicReceiptId);
      if (!racedReceipt || !sameSignature(racedReceipt.signature, signature)) {
        return json({ error: '请求编号冲突，请刷新后核对' }, 409);
      }
      return json({ ...racedReceipt.result, duplicate: true });
    }

    return json({ ...result, duplicate: false });
  } catch (error: any) {
    if (error?.code === 'P2025') return json({ error: '计算所需记录不存在' }, 404);
    if (error?.code === 'P2034') {
      return json({
        error: '数据正在被其他操作更新，请稍后使用同一请求编号重试',
        retrySameRequest: true,
      }, 409);
    }
    console.error('POST /api/obe/achievement/calculate error:', error);
    return json({ error: '达成度计算失败' }, 500);
  }
}
