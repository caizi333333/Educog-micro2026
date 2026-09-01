// ============================================================================
// OBE 达成度评价引擎
// 课程目标达成度 = Σ(考核环节实际得分 × 权重) / Σ(考核环节满分 × 权重)
// 指标点达成度 = Σ(支撑课程目标达成度 × 支撑权重) / Σ(支撑权重)
// ============================================================================

import { prisma } from '@/lib/prisma';
import { buildOBEConfigurationRevision } from '@/lib/obe-data';
import type { Prisma } from '@prisma/client';

type AchievementDb = Prisma.TransactionClient | typeof prisma;

function safeJsonParse<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// 数据查询辅助
// ---------------------------------------------------------------------------

async function getBestQuizScore(
  db: AchievementDb,
  userId: string,
  quizId: string,
): Promise<{ score: number; max: number }> {
  const attempt = await db.quizAttempt.findFirst({
    where: { userId, quizId },
    select: { score: true, totalQuestions: true },
    orderBy: { score: 'desc' },
  });
  return { score: attempt?.score ?? 0, max: 100 };
}

async function getChapterProgress(
  db: AchievementDb,
  userId: string,
  chapterId: string,
): Promise<number> {
  const records = await db.learningProgress.findMany({
    where: { userId, chapterId },
    select: { progress: true },
  });
  if (records.length === 0) return 0;
  const avg = records.reduce((s, r) => s + r.progress, 0) / records.length;
  return Math.round(avg);
}

async function getAllExperimentScores(
  db: AchievementDb,
  userId: string,
): Promise<Record<string, number>> {
  const exps = await db.userExperiment.findMany({
    where: { userId },
    select: { experimentId: true, score: true, status: true },
  });
  const map: Record<string, number> = {};
  for (const e of exps) {
    map[e.experimentId] = e.status === 'COMPLETED' ? (e.score ?? 0) : 0;
  }
  return map;
}

// ---------------------------------------------------------------------------
// 核心计算
// ---------------------------------------------------------------------------

export interface COBreakdownItem {
  type: string;
  targetId: string;
  description?: string;
  score: number;
  maxScore: number;
  weight: number;
}

export interface COAchievementResult {
  courseObjectiveId: string;
  weightedScoreSum: number;
  weightedMaxSum: number;
  achievementDegree: number;
  passed: boolean;
  breakdown: COBreakdownItem[];
}

export async function calculateStudentCOAchievement(
  userId: string,
  courseObjectiveId: string,
  semester?: string | null,
  tx?: Prisma.TransactionClient,
  classId?: string | null,
  experimentScores?: Record<string, number>,
): Promise<COAchievementResult> {
  const db = tx ?? prisma;
  const storedSemester = semester?.trim() ?? '';
  // Optional legacy scope values are normalized so the compound key remains
  // deterministic even on databases where NULL values are not unique.
  const storedClassId = classId?.trim() ?? '';

  const co = await db.courseObjective.findUnique({
    where: { id: courseObjectiveId },
    include: { assessmentLinks: true, indicatorPoint: true },
  });
  if (!co) throw new Error(`CourseObjective ${courseObjectiveId} not found`);

  const threshold = co.indicatorPoint.achievementThreshold;

  // Preload experiment scores for efficiency
  const expScores = experimentScores ?? await getAllExperimentScores(db, userId);

  const breakdown: COBreakdownItem[] = [];
  let weightedScoreSum = 0;
  let weightedMaxSum = 0;

  for (const link of co.assessmentLinks) {
    let score = 0;
    const max = link.maxScore;

    switch (link.assessmentType) {
      case 'QUIZ': {
        const q = await getBestQuizScore(db, userId, link.assessmentTargetId);
        score = (q.score / q.max) * max;
        break;
      }
      case 'EXPERIMENT': {
        score = (expScores[link.assessmentTargetId] ?? 0) / 100 * max;
        break;
      }
      case 'LEARNING_PROGRESS': {
        score = await getChapterProgress(db, userId, link.assessmentTargetId) / 100 * max;
        break;
      }
      case 'COMPREHENSIVE': {
        // Aggregate from chapter quizzes
        if (link.chapter) {
          const q = await getBestQuizScore(db, userId, `quiz-ch${link.chapter}`);
          score = (q.score / q.max) * max;
        }
        break;
      }
    }

    score = Math.max(0, Math.min(max, score));
    weightedScoreSum += score * link.weight;
    weightedMaxSum += max * link.weight;

    breakdown.push({
      type: link.assessmentType,
      targetId: link.assessmentTargetId,
      description: link.description ?? undefined,
      score: Math.round(score * 100) / 100,
      maxScore: max,
      weight: link.weight,
    });
  }

  const achievementDegree = weightedMaxSum > 0 ? weightedScoreSum / weightedMaxSum : 0;
  const passed = achievementDegree >= threshold;

  // Upsert result
  await db.courseObjectiveAchievement.upsert({
    where: {
      userId_courseObjectiveId_semester_classId: {
        userId,
        courseObjectiveId,
        semester: storedSemester,
        classId: storedClassId,
      },
    },
    create: {
      userId,
      courseObjectiveId,
      semester: storedSemester,
      classId: storedClassId,
      weightedScoreSum,
      weightedMaxSum,
      achievementDegree: Math.round(achievementDegree * 10000) / 10000,
      passed,
      breakdown: JSON.stringify(breakdown),
    },
    update: {
      weightedScoreSum,
      weightedMaxSum,
      achievementDegree: Math.round(achievementDegree * 10000) / 10000,
      passed,
      breakdown: JSON.stringify(breakdown),
      calculatedAt: new Date(),
    },
  });

  return {
    courseObjectiveId,
    weightedScoreSum: Math.round(weightedScoreSum * 100) / 100,
    weightedMaxSum: Math.round(weightedMaxSum * 100) / 100,
    achievementDegree: Math.round(achievementDegree * 10000) / 10000,
    passed,
    breakdown,
  };
}

// ---------------------------------------------------------------------------

export interface GRAchievementResult {
  indicatorPointId: string;
  indicatorCode: string;
  achievementDegree: number;
  passed: boolean;
  contributingObjectives: { coId: string; coCode: string; coAchievement: number; supportWeight: number }[];
}

export async function calculateStudentGRAchievement(
  userId: string,
  indicatorPointId: string,
  semester?: string | null,
  tx?: Prisma.TransactionClient,
  classId?: string | null,
  experimentScores?: Record<string, number>,
): Promise<GRAchievementResult> {
  const db = tx ?? prisma;
  const storedSemester = semester?.trim() ?? '';
  const storedClassId = classId?.trim() ?? '';

  const ip = await db.indicatorPoint.findUnique({
    where: { id: indicatorPointId },
    include: {
      courseObjectives: { where: { isActive: true } },
      graduationRequirement: true,
    },
  });
  if (!ip) throw new Error(`IndicatorPoint ${indicatorPointId} not found`);

  const contributingObjectives: GRAchievementResult['contributingObjectives'] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const co of ip.courseObjectives) {
    const coResult = await calculateStudentCOAchievement(
      userId,
      co.id,
      semester,
      tx,
      classId,
      experimentScores,
    );
    contributingObjectives.push({
      coId: co.id,
      coCode: co.code,
      coAchievement: coResult.achievementDegree,
      supportWeight: co.supportWeight,
    });
    weightedSum += coResult.achievementDegree * co.supportWeight;
    weightTotal += co.supportWeight;
  }

  const achievementDegree = weightTotal > 0 ? weightedSum / weightTotal : 0;
  const passed = achievementDegree >= ip.achievementThreshold;

  await db.graduationRequirementAchievement.upsert({
    where: {
      userId_indicatorPointId_semester_classId: {
        userId,
        indicatorPointId,
        semester: storedSemester,
        classId: storedClassId,
      },
    },
    create: {
      userId,
      indicatorPointId,
      semester: storedSemester,
      classId: storedClassId,
      achievementDegree: Math.round(achievementDegree * 10000) / 10000,
      passed,
      contributingObjectives: JSON.stringify(contributingObjectives),
    },
    update: {
      achievementDegree: Math.round(achievementDegree * 10000) / 10000,
      passed,
      contributingObjectives: JSON.stringify(contributingObjectives),
      calculatedAt: new Date(),
    },
  });

  return {
    indicatorPointId,
    indicatorCode: ip.code,
    achievementDegree: Math.round(achievementDegree * 10000) / 10000,
    passed,
    contributingObjectives,
  };
}

// ---------------------------------------------------------------------------
// 批量计算
// ---------------------------------------------------------------------------

export async function batchCalculateClassAchievement(
  classId: string,
  semester?: string | null,
): Promise<{ studentCount: number; coResults: number; grResults: number }> {
  const scopedSemester = semester?.trim();
  if (!scopedSemester) {
    throw new Error('A semester scope is required for a class achievement calculation');
  }
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      classId,
      role: 'STUDENT',
      status: 'ACTIVE',
      user: { role: 'STUDENT', status: 'ACTIVE' },
    },
    select: { userId: true },
  });

  const courseObjectives = await prisma.courseObjective.findMany({
    where: { isActive: true },
    select: { id: true, indicatorPointId: true },
  });

  const indicatorPointIds = [...new Set(courseObjectives.map((co) => co.indicatorPointId))];

  for (const { userId } of enrollments) {
    // Calculate each student in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      const expScores = await getAllExperimentScores(tx, userId);

      for (const ipId of indicatorPointIds) {
        await calculateStudentGRAchievement(userId, ipId, scopedSemester, tx, classId, expScores);
      }
    }, { maxWait: 30000, timeout: 60000 });
  }

  return {
    studentCount: enrollments.length,
    coResults: enrollments.length * courseObjectives.length,
    grResults: enrollments.length * indicatorPointIds.length,
  };
}

export async function batchCalculateUserAchievement(
  userId: string,
  semester?: string | null,
  classId?: string | null,
): Promise<{ coResults: number; grResults: number }> {
  const scopedClassId = classId?.trim();
  if (!scopedClassId) {
    throw new Error('A class scope is required for a student achievement calculation');
  }
  const scopedSemester = semester?.trim();
  if (!scopedSemester) {
    throw new Error('A semester scope is required for a student achievement calculation');
  }
  const courseObjectives = await prisma.courseObjective.findMany({
    where: { isActive: true },
    select: { id: true, indicatorPointId: true },
  });

  const indicatorPointIds = [...new Set(courseObjectives.map((co) => co.indicatorPointId))];

  await prisma.$transaction(async (tx) => {
    const expScores = await getAllExperimentScores(tx, userId);
    for (const ipId of indicatorPointIds) {
      await calculateStudentGRAchievement(userId, ipId, scopedSemester, tx, scopedClassId, expScores);
    }
  }, { maxWait: 30000, timeout: 60000 });

  return { coResults: courseObjectives.length, grResults: indicatorPointIds.length };
}

// ---------------------------------------------------------------------------
// 查询接口
// ---------------------------------------------------------------------------

export interface RadarDataPoint {
  indicatorCode: string;
  indicatorName: string;
  graduationReqName: string;
  achievementDegree: number | null;
  threshold: number;
  passed: boolean | null;
}

export interface StudentAchievementDataStatus {
  semester: string | null;
  semesterSource: 'REQUEST' | 'ACTIVE_CLASS' | 'UNRESOLVED';
  classId: string | null;
  className: string | null;
  classScopeSource: 'REQUEST' | 'ACTIVE_CLASS' | 'UNRESOLVED';
  availableClasses: {
    classId: string;
    className: string;
    semester: string;
  }[];
  configurationRevision: string;
  configurationUpdatedAt: string | null;
  expectedCourseObjectiveRecords: number;
  freshCourseObjectiveRecords: number;
  staleCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  expectedIndicatorRecords: number;
  freshIndicatorRecords: number;
  staleIndicatorRecords: number;
  missingIndicatorRecords: number;
  complete: boolean;
  lastCalculatedAt: string | null;
}

export interface StudentObjectiveBreakdown {
  courseObjectiveId: string;
  code: string;
  name: string;
  indicatorPointCode: string;
  indicatorPointName: string;
  graduationReqName: string;
  achievementDegree: number;
  passed: boolean;
  breakdown: COBreakdownItem[];
  assessmentLinks: {
    type: string;
    targetId: string;
    weight: number;
    maxScore: number;
    description: string | null;
  }[];
}

export interface StudentProgressSummary {
  courseObjectives: {
    id: string;
    code: string;
    name: string;
    achievementDegree: number;
    passed: boolean;
    breakdown: COBreakdownItem[];
  }[];
  indicatorPoints: {
    id: string;
    code: string;
    description: string;
    graduationReqName: string;
    achievementDegree: number;
    threshold: number;
    passed: boolean;
    contributingCOs: { coCode: string; coAchievement: number; supportWeight: number }[];
  }[];
  overallPassedCount: number;
  overallTotalCount: number;
  dataStatus: StudentAchievementDataStatus;
}

export interface StudentAchievementView {
  radar: RadarDataPoint[];
  progress: StudentProgressSummary;
  breakdown: StudentObjectiveBreakdown[];
  dataStatus: StudentAchievementDataStatus;
}

export async function getStudentAchievementView(
  userId: string,
  requestedSemester?: string | null,
  requestedClassId?: string | null,
): Promise<StudentAchievementView> {
  const requested = requestedSemester?.trim() || null;
  const requestedClass = requestedClassId?.trim() || null;
  const [activeObjectives, enrollments] = await Promise.all([
    prisma.courseObjective.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        version: true,
        updatedAt: true,
        indicatorPointId: true,
        indicatorPoint: {
          select: {
            id: true,
            code: true,
            description: true,
            achievementThreshold: true,
            updatedAt: true,
            graduationRequirement: { select: { name: true } },
          },
        },
        assessmentLinks: {
          select: {
            assessmentType: true,
            assessmentTargetId: true,
            weight: true,
            maxScore: true,
            description: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    }),
    prisma.classEnrollment.findMany({
      where: {
        userId,
        role: 'STUDENT',
        status: 'ACTIVE',
        classGroup: { status: 'ACTIVE', semester: { not: null } },
      },
      select: {
        classId: true,
        classGroup: { select: { name: true, semester: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { classId: 'asc' }],
    }),
  ]);

  const eligibleEnrollments = enrollments.filter((enrollment) => {
    const enrolledSemester = enrollment.classGroup.semester?.trim() || null;
    if (!enrolledSemester) return false;
    if (requestedClass && enrollment.classId !== requestedClass) return false;
    if (requested && enrolledSemester !== requested) return false;
    return true;
  });
  const enrollment = eligibleEnrollments[0] ?? null;
  const enrolledSemester = enrollment?.classGroup.semester?.trim() || null;
  const semester = requested ?? enrolledSemester;
  const classId = enrollment?.classId ?? null;
  const className = enrollment?.classGroup.name?.trim() || null;
  const semesterSource: StudentAchievementDataStatus['semesterSource'] = requested
    ? 'REQUEST'
    : enrolledSemester
      ? 'ACTIVE_CLASS'
      : 'UNRESOLVED';
  const classScopeSource: StudentAchievementDataStatus['classScopeSource'] = classId
    ? requestedClass
      ? 'REQUEST'
      : 'ACTIVE_CLASS'
    : 'UNRESOLVED';
  const availableClasses = enrollments.flatMap((item) => {
    const itemSemester = item.classGroup.semester?.trim();
    if (!itemSemester) return [];
    return [{
      classId: item.classId,
      className: item.classGroup.name?.trim() || '未命名班级',
      semester: itemSemester,
    }];
  });
  const activeIndicators = [...new Map(activeObjectives.map((objective) => [
    objective.indicatorPoint.id,
    objective.indicatorPoint,
  ])).values()].sort((left, right) => left.code.localeCompare(right.code));
  const configurationTimes = activeObjectives.flatMap((objective) => [
    objective.updatedAt,
    objective.indicatorPoint.updatedAt,
    ...objective.assessmentLinks.map((link) => link.updatedAt),
  ]);
  const configurationUpdatedAt = configurationTimes.length > 0
    ? new Date(Math.max(...configurationTimes.map((value) => value.getTime())))
    : null;
  const configurationRevision = buildOBEConfigurationRevision(activeObjectives);
  const objectiveIds = activeObjectives.map((objective) => objective.id);
  const indicatorIds = activeIndicators.map((indicator) => indicator.id);

  const emptyResults = [[], [], 0, 0] as const;
  const [coAchievements, grAchievements, staleCourseObjectiveRecords, staleIndicatorRecords] = (
    semester && classId && configurationUpdatedAt && objectiveIds.length > 0
      ? await Promise.all([
        prisma.courseObjectiveAchievement.findMany({
          where: {
            userId,
            semester,
            classId,
            courseObjectiveId: { in: objectiveIds },
            calculatedAt: { gte: configurationUpdatedAt },
          },
          select: {
            id: true,
            courseObjectiveId: true,
            achievementDegree: true,
            passed: true,
            breakdown: true,
            calculatedAt: true,
          },
        }),
        prisma.graduationRequirementAchievement.findMany({
          where: {
            userId,
            semester,
            classId,
            indicatorPointId: { in: indicatorIds },
            calculatedAt: { gte: configurationUpdatedAt },
          },
          select: {
            id: true,
            indicatorPointId: true,
            achievementDegree: true,
            passed: true,
            contributingObjectives: true,
            calculatedAt: true,
          },
        }),
        prisma.courseObjectiveAchievement.count({
          where: {
            userId,
            semester,
            classId,
            courseObjectiveId: { in: objectiveIds },
            calculatedAt: { lt: configurationUpdatedAt },
          },
        }),
        prisma.graduationRequirementAchievement.count({
          where: {
            userId,
            semester,
            classId,
            indicatorPointId: { in: indicatorIds },
            calculatedAt: { lt: configurationUpdatedAt },
          },
        }),
      ])
      : emptyResults
  );

  const coByObjectiveId = new Map(coAchievements.map((achievement) => [achievement.courseObjectiveId, achievement]));
  const grByIndicatorId = new Map(grAchievements.map((achievement) => [achievement.indicatorPointId, achievement]));
  const courseObjectives = activeObjectives.flatMap((objective) => {
    const achievement = coByObjectiveId.get(objective.id);
    return achievement ? [{
      id: achievement.id,
      code: objective.code,
      name: objective.name,
      achievementDegree: achievement.achievementDegree,
      passed: achievement.passed,
      breakdown: safeJsonParse<COBreakdownItem[]>(achievement.breakdown, []),
    }] : [];
  });
  const indicatorPoints = activeIndicators.flatMap((indicator) => {
    const achievement = grByIndicatorId.get(indicator.id);
    return achievement ? [{
      id: indicator.id,
      code: indicator.code,
      description: indicator.description,
      graduationReqName: indicator.graduationRequirement.name,
      achievementDegree: achievement.achievementDegree,
      threshold: indicator.achievementThreshold,
      passed: achievement.passed,
      contributingCOs: safeJsonParse<{ coCode: string; coAchievement: number; supportWeight: number }[]>(achievement.contributingObjectives, []),
    }] : [];
  });
  const calculatedTimes = [
    ...coAchievements.map((achievement) => achievement.calculatedAt),
    ...grAchievements.map((achievement) => achievement.calculatedAt),
  ];
  const lastCalculatedAt = calculatedTimes.length > 0
    ? new Date(Math.max(...calculatedTimes.map((value) => value.getTime()))).toISOString()
    : null;
  const expectedCourseObjectiveRecords = activeObjectives.length;
  const expectedIndicatorRecords = activeIndicators.length;
  const dataStatus: StudentAchievementDataStatus = {
    semester,
    semesterSource,
    classId,
    className,
    classScopeSource,
    availableClasses,
    configurationRevision,
    configurationUpdatedAt: configurationUpdatedAt?.toISOString() ?? null,
    expectedCourseObjectiveRecords,
    freshCourseObjectiveRecords: coAchievements.length,
    staleCourseObjectiveRecords,
    missingCourseObjectiveRecords: Math.max(0, expectedCourseObjectiveRecords - coAchievements.length),
    expectedIndicatorRecords,
    freshIndicatorRecords: grAchievements.length,
    staleIndicatorRecords,
    missingIndicatorRecords: Math.max(0, expectedIndicatorRecords - grAchievements.length),
    complete: Boolean(
      semester
      && classId
      && expectedCourseObjectiveRecords > 0
      && expectedIndicatorRecords > 0
      && coAchievements.length === expectedCourseObjectiveRecords
      && grAchievements.length === expectedIndicatorRecords
    ),
    lastCalculatedAt,
  };
  const radar: RadarDataPoint[] = activeIndicators.map((indicator) => {
    const achievement = grByIndicatorId.get(indicator.id);
    return {
      indicatorCode: indicator.code,
      indicatorName: indicator.description,
      graduationReqName: indicator.graduationRequirement.name,
      achievementDegree: achievement?.achievementDegree ?? null,
      threshold: indicator.achievementThreshold,
      passed: achievement?.passed ?? null,
    };
  });
  const breakdown: StudentObjectiveBreakdown[] = activeObjectives.flatMap((objective) => {
    const achievement = coByObjectiveId.get(objective.id);
    return achievement ? [{
      courseObjectiveId: objective.id,
      code: objective.code,
      name: objective.name,
      indicatorPointCode: objective.indicatorPoint.code,
      indicatorPointName: objective.indicatorPoint.description,
      graduationReqName: objective.indicatorPoint.graduationRequirement.name,
      achievementDegree: achievement.achievementDegree,
      passed: achievement.passed,
      breakdown: safeJsonParse<COBreakdownItem[]>(achievement.breakdown, []),
      assessmentLinks: objective.assessmentLinks.map((link) => ({
        type: link.assessmentType,
        targetId: link.assessmentTargetId,
        weight: link.weight,
        maxScore: link.maxScore,
        description: link.description,
      })),
    }] : [];
  });
  const progress: StudentProgressSummary = {
    courseObjectives,
    indicatorPoints,
    overallPassedCount: dataStatus.complete ? indicatorPoints.filter((indicator) => indicator.passed).length : 0,
    overallTotalCount: dataStatus.complete ? indicatorPoints.length : 0,
    dataStatus,
  };

  return { radar, progress, breakdown, dataStatus };
}

export async function getStudentRadarData(
  userId: string,
  semester?: string | null,
  classId?: string | null,
): Promise<RadarDataPoint[]> {
  return (await getStudentAchievementView(userId, semester, classId)).radar;
}

export async function getStudentProgressSummary(
  userId: string,
  semester?: string | null,
  classId?: string | null,
): Promise<StudentProgressSummary> {
  return (await getStudentAchievementView(userId, semester, classId)).progress;
}

// ---------------------------------------------------------------------------
// 教师/管理员聚合
// ---------------------------------------------------------------------------

export interface ClassAchievementStats {
  classId: string;
  className: string;
  studentCount: number;
  configurationUpdatedAt: Date | null;
  averageAchievementByCO: { coCode: string; coName: string; avg: number; passRate: number }[];
  averageAchievementByIP: { ipCode: string; ipName: string; avg: number; passRate: number }[];
}

export async function getClassAchievementStats(
  classId: string,
  semester?: string | null,
): Promise<ClassAchievementStats> {
  const semWhere = semester === undefined || semester === null
    ? { OR: [{ semester: '' }, { semester: null }] }
    : { semester };
  const [cls, allCOs] = await Promise.all([
    prisma.classGroup.findUnique({ where: { id: classId } }),
    prisma.courseObjective.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        updatedAt: true,
        indicatorPointId: true,
        indicatorPoint: {
          select: {
            id: true,
            updatedAt: true,
            achievementThreshold: true,
          },
        },
        assessmentLinks: { select: { updatedAt: true } },
      },
    }),
  ]);
  const configurationTimes = allCOs.flatMap((objective) => [
    objective.updatedAt,
    objective.indicatorPoint.updatedAt,
    ...objective.assessmentLinks.map((link) => link.updatedAt),
  ]);
  const configurationUpdatedAt = configurationTimes.length > 0
    ? new Date(Math.max(...configurationTimes.map((value) => value.getTime())))
    : null;
  const freshnessWhere = configurationUpdatedAt
    ? { calculatedAt: { gte: configurationUpdatedAt } }
    : {};
  const activeCourseObjectiveIds = allCOs.map((objective) => objective.id);
  const activeIndicatorPointIds = [...new Set(allCOs.map((objective) => objective.indicatorPointId))];

  const coStats = await prisma.courseObjectiveAchievement.groupBy({
    by: ['courseObjectiveId'],
    where: {
      classId,
      courseObjectiveId: { in: activeCourseObjectiveIds },
      ...semWhere,
      ...freshnessWhere,
    },
    _avg: { achievementDegree: true },
    _count: { passed: true },
  });

  const coPassedStats = await prisma.courseObjectiveAchievement.groupBy({
    by: ['courseObjectiveId'],
    where: {
      classId,
      courseObjectiveId: { in: activeCourseObjectiveIds },
      ...semWhere,
      ...freshnessWhere,
      passed: true,
    },
    _count: { passed: true },
  });

  const grStats = await prisma.graduationRequirementAchievement.groupBy({
    by: ['indicatorPointId'],
    where: {
      classId,
      indicatorPointId: { in: activeIndicatorPointIds },
      ...semWhere,
      ...freshnessWhere,
    },
    _avg: { achievementDegree: true },
    _count: { passed: true },
  });

  const grPassedStats = await prisma.graduationRequirementAchievement.groupBy({
    by: ['indicatorPointId'],
    where: {
      classId,
      indicatorPointId: { in: activeIndicatorPointIds },
      ...semWhere,
      ...freshnessWhere,
      passed: true,
    },
    _count: { passed: true },
  });

  // Enrich with names
  const allIPs = await prisma.indicatorPoint.findMany({
    where: { id: { in: activeIndicatorPointIds } },
  });

  const coMap = new Map(allCOs.map((c) => [c.id, c]));
  const ipMap = new Map(allIPs.map((i) => [i.id, i]));

  const studentCount = await prisma.classEnrollment.count({
    where: {
      classId,
      role: 'STUDENT',
      status: 'ACTIVE',
      user: { role: 'STUDENT', status: 'ACTIVE' },
    },
  });

  return {
    classId,
    className: cls?.name ?? '',
    studentCount,
    configurationUpdatedAt,
    averageAchievementByCO: coStats.map((s) => {
      const co = coMap.get(s.courseObjectiveId);
      const passed = coPassedStats.find((p) => p.courseObjectiveId === s.courseObjectiveId);
      return {
        coCode: co?.code ?? '',
        coName: co?.name ?? '',
        avg: Math.round((s._avg.achievementDegree ?? 0) * 10000) / 10000,
        passRate: s._count.passed > 0 ? Math.round(((passed?._count.passed ?? 0) / s._count.passed) * 10000) / 100 : 0,
      };
    }),
    averageAchievementByIP: grStats.map((s) => {
      const ip = ipMap.get(s.indicatorPointId);
      const passed = grPassedStats.find((p) => p.indicatorPointId === s.indicatorPointId);
      return {
        ipCode: ip?.code ?? '',
        ipName: ip?.description ?? '',
        avg: Math.round((s._avg.achievementDegree ?? 0) * 10000) / 10000,
        passRate: s._count.passed > 0 ? Math.round(((passed?._count.passed ?? 0) / s._count.passed) * 10000) / 100 : 0,
      };
    }),
  };
}

export interface GapAnalysisResult {
  classId: string;
  semester: string;
  weakPoints: { code: string; name: string; avgAchievement: number; threshold: number; gap: number }[];
  strengths: { code: string; name: string; avgAchievement: number }[];
  totalIndicators: number;
  passedIndicators: number;
  averageAchievement: number | null;
  totalStudents: number;
  passedStudents: number;
  passRate: number | null;
  expectedRecords: number;
  actualRecords: number;
  dataSufficient: boolean;
  configurationUpdatedAt: string | null;
}

export async function getGapAnalysis(classId: string, semester?: string | null): Promise<GapAnalysisResult> {
  const semWhere = semester === undefined || semester === null
    ? { OR: [{ semester: '' }, { semester: null }] }
    : { semester };
  const [stats, allIPs, enrollments] = await Promise.all([
    getClassAchievementStats(classId, semester),
    prisma.indicatorPoint.findMany({
      where: { courseObjectives: { some: { isActive: true } } },
      select: { id: true, code: true, achievementThreshold: true },
    }),
    prisma.classEnrollment.findMany({
      where: {
        classId,
        role: 'STUDENT',
        status: 'ACTIVE',
        user: { role: 'STUDENT', status: 'ACTIVE' },
      },
      select: { userId: true },
    }),
  ]);
  const indicatorIds = allIPs.map((item) => item.id);
  const records = indicatorIds.length > 0 && enrollments.length > 0
    ? await prisma.graduationRequirementAchievement.findMany({
      where: {
        classId,
        indicatorPointId: { in: indicatorIds },
        userId: { in: enrollments.map((item) => item.userId) },
        ...semWhere,
        ...(stats.configurationUpdatedAt
          ? { calculatedAt: { gte: stats.configurationUpdatedAt } }
          : {}),
      },
      select: { userId: true, indicatorPointId: true, passed: true },
    })
    : [];
  const semKey = semester ?? '';
  const ipThresholds = new Map(allIPs.map((ip) => [ip.code, ip.achievementThreshold]));

  const all = stats.averageAchievementByIP.filter((ip) => ipThresholds.has(ip.ipCode)).map((ip) => {
    const threshold = ipThresholds.get(ip.ipCode) ?? 0.65;
    return { code: ip.ipCode, name: ip.ipName, avgAchievement: ip.avg, threshold, gap: ip.avg - threshold };
  });

  const weakPoints = all.filter((a) => a.gap < 0).sort((a, b) => a.gap - b.gap);
  const strengths = all.filter((a) => a.gap >= 0).sort((a, b) => b.avgAchievement - a.avgAchievement);
  const passedIndicators = all.filter((a) => a.gap >= 0).length;
  const expectedRecords = enrollments.length * allIPs.length;
  const actualRecords = records.length;
  const dataSufficient = expectedRecords > 0 && actualRecords === expectedRecords;
  const recordsByUser = new Map<string, typeof records>();
  for (const record of records) {
    const userRecords = recordsByUser.get(record.userId) ?? [];
    userRecords.push(record);
    recordsByUser.set(record.userId, userRecords);
  }
  const passedStudents = dataSufficient
    ? enrollments.filter(({ userId }) => {
      const userRecords = recordsByUser.get(userId) ?? [];
      return userRecords.length === allIPs.length && userRecords.every((item) => item.passed);
    }).length
    : 0;
  const averageAchievement = dataSufficient && all.length > 0
    ? Math.round((all.reduce((sum, item) => sum + item.avgAchievement, 0) / all.length) * 10000) / 10000
    : null;
  const passRate = dataSufficient && enrollments.length > 0
    ? Math.round((passedStudents / enrollments.length) * 10000) / 100
    : null;

  return {
    classId,
    semester: semKey,
    weakPoints,
    strengths,
    totalIndicators: allIPs.length,
    passedIndicators,
    averageAchievement,
    totalStudents: enrollments.length,
    passedStudents,
    passRate,
    expectedRecords,
    actualRecords,
    dataSufficient,
    configurationUpdatedAt: stats.configurationUpdatedAt?.toISOString() ?? null,
  };
}
