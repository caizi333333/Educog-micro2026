import {
  batchCalculateClassAchievement,
  getGapAnalysis,
  getStudentAchievementView,
} from '@/lib/achievement-evaluation';
import {
  buildOBECalculationScopeRevision,
  buildOBEConfigurationRevision,
  COURSE_OBJECTIVES,
  isValidOBESemester,
  OBE_ASSESSMENT_RESOURCES,
  resolveOBEAssessmentResource,
} from '@/lib/obe-data';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    classGroup: { findUnique: jest.fn() },
    classEnrollment: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    courseObjective: { findMany: jest.fn(), findUnique: jest.fn() },
    indicatorPoint: { findUnique: jest.fn(), findMany: jest.fn() },
    userExperiment: { findMany: jest.fn() },
    quizAttempt: { findFirst: jest.fn() },
    learningProgress: { findMany: jest.fn() },
    courseObjectiveAchievement: { upsert: jest.fn(), groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    graduationRequirementAchievement: { upsert: jest.fn(), groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

describe('OBE calculation revision fingerprints', () => {
  it('accepts only a consecutive academic year and a valid term', () => {
    expect(isValidOBESemester('2025-2026-2')).toBe(true);
    expect(isValidOBESemester('2026-2025-1')).toBe(false);
    expect(isValidOBESemester('2025-2027-1')).toBe(false);
    expect(isValidOBESemester('2025-2026-3')).toBe(false);
  });

  it('is order-independent but changes when an objective version or roster changes', () => {
    const configuration = buildOBEConfigurationRevision([
      { id: 'co-2', version: 3 },
      { id: 'co-1', version: 1 },
    ]);
    expect(configuration).toBe(buildOBEConfigurationRevision([
      { id: 'co-1', version: 1 },
      { id: 'co-2', version: 3 },
    ]));
    expect(configuration).not.toBe(buildOBEConfigurationRevision([
      { id: 'co-1', version: 1 },
      { id: 'co-2', version: 4 },
    ]));
    expect(configuration).not.toBe(buildOBEConfigurationRevision([
      {
        id: 'co-1',
        version: 1,
        indicatorPoint: {
          id: 'ip-1',
          updatedAt: '2026-07-18T09:00:00.000Z',
          achievementThreshold: 0.7,
        },
      },
      { id: 'co-2', version: 3 },
    ]));

    const scope = buildOBECalculationScopeRevision({
      configurationRevision: configuration,
      classId: 'class-1',
      userId: null,
      semester: '2025-2026-2',
      targetUserIds: ['student-2', 'student-1'],
    });
    expect(scope).toBe(buildOBECalculationScopeRevision({
      configurationRevision: configuration,
      classId: 'class-1',
      userId: null,
      semester: '2025-2026-2',
      targetUserIds: ['student-1', 'student-2'],
    }));
    expect(scope).not.toBe(buildOBECalculationScopeRevision({
      configurationRevision: configuration,
      classId: 'class-1',
      userId: null,
      semester: '2025-2026-2',
      targetUserIds: ['student-1', 'student-2', 'student-3'],
    }));
  });
});

describe('student achievement current-configuration view', () => {
  const objectiveUpdatedAt = new Date('2026-07-18T08:00:00.000Z');
  const indicatorUpdatedAt = new Date('2026-07-18T09:00:00.000Z');
  const calculatedAt = new Date('2026-07-18T10:00:00.000Z');
  const activeObjectives = [
    {
      id: 'co-1',
      code: 'CO1',
      name: '课程目标一',
      version: 2,
      updatedAt: objectiveUpdatedAt,
      indicatorPointId: 'ip-1',
      indicatorPoint: {
        id: 'ip-1',
        code: '1-1',
        description: '指标点一',
        achievementThreshold: 0.65,
        updatedAt: indicatorUpdatedAt,
        graduationRequirement: { name: '工程知识' },
      },
      assessmentLinks: [{
        assessmentType: 'QUIZ',
        assessmentTargetId: 'quiz-ch3',
        weight: 1,
        maxScore: 100,
        description: '第3章测评',
        updatedAt: objectiveUpdatedAt,
      }],
    },
    {
      id: 'co-2',
      code: 'CO2',
      name: '课程目标二',
      version: 1,
      updatedAt: objectiveUpdatedAt,
      indicatorPointId: 'ip-2',
      indicatorPoint: {
        id: 'ip-2',
        code: '2-1',
        description: '指标点二',
        achievementThreshold: 0.7,
        updatedAt: indicatorUpdatedAt,
        graduationRequirement: { name: '问题分析' },
      },
      assessmentLinks: [{
        assessmentType: 'EXPERIMENT',
        assessmentTargetId: 'exp02',
        weight: 1,
        maxScore: 100,
        description: 'exp02 仿真实践',
        updatedAt: objectiveUpdatedAt,
      }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue(activeObjectives);
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([{
      classId: 'class-1',
      classGroup: { name: '2024级1班', semester: '2025-2026-2' },
    }]);
    (prisma.courseObjectiveAchievement.findMany as jest.Mock).mockResolvedValue([{
      id: 'coa-1',
      courseObjectiveId: 'co-1',
      achievementDegree: 0.8,
      passed: true,
      breakdown: '[]',
      calculatedAt,
    }]);
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([{
      id: 'gra-1',
      indicatorPointId: 'ip-1',
      achievementDegree: 0.75,
      passed: true,
      contributingObjectives: '[]',
      calculatedAt,
    }]);
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(1);
    (prisma.graduationRequirementAchievement.count as jest.Mock).mockResolvedValue(1);
  });

  it('resolves the active class semester, isolates old records and withholds an incomplete conclusion', async () => {
    const result = await getStudentAchievementView('student-1');

    expect(result.dataStatus).toMatchObject({
      semester: '2025-2026-2',
      semesterSource: 'ACTIVE_CLASS',
      classId: 'class-1',
      className: '2024级1班',
      classScopeSource: 'ACTIVE_CLASS',
      availableClasses: [{
        classId: 'class-1',
        className: '2024级1班',
        semester: '2025-2026-2',
      }],
      expectedCourseObjectiveRecords: 2,
      freshCourseObjectiveRecords: 1,
      staleCourseObjectiveRecords: 1,
      missingCourseObjectiveRecords: 1,
      expectedIndicatorRecords: 2,
      freshIndicatorRecords: 1,
      staleIndicatorRecords: 1,
      missingIndicatorRecords: 1,
      complete: false,
    });
    expect(result.progress).toMatchObject({ overallPassedCount: 0, overallTotalCount: 0 });
    expect(result.progress.courseObjectives.map((objective) => objective.code)).toEqual(['CO1']);
    expect(result.radar).toEqual(expect.arrayContaining([
      expect.objectContaining({ indicatorCode: '1-1', achievementDegree: 0.75 }),
      expect.objectContaining({ indicatorCode: '2-1', achievementDegree: null, passed: null }),
    ]));
    expect(prisma.courseObjectiveAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        semester: '2025-2026-2',
        classId: 'class-1',
        calculatedAt: { gte: indicatorUpdatedAt },
      }),
    }));
  });

  it('uses the explicitly selected class and never mixes another class in the same semester', async () => {
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([
      { classId: 'class-2', classGroup: { name: '2024级2班', semester: '2025-2026-2' } },
      { classId: 'class-1', classGroup: { name: '2024级1班', semester: '2025-2026-2' } },
    ]);

    const result = await getStudentAchievementView('student-1', '2025-2026-2', 'class-1');

    expect(result.dataStatus).toMatchObject({
      semester: '2025-2026-2',
      classId: 'class-1',
      className: '2024级1班',
      classScopeSource: 'REQUEST',
    });
    expect(prisma.courseObjectiveAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ classId: 'class-1', semester: '2025-2026-2' }),
    }));
    expect(prisma.graduationRequirementAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ classId: 'class-1', semester: '2025-2026-2' }),
    }));
  });

  it('does not fall back to unscoped legacy results when no active class semester exists', async () => {
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getStudentAchievementView('student-1');

    expect(result.dataStatus).toMatchObject({
      semester: null,
      semesterSource: 'UNRESOLVED',
      classId: null,
      classScopeSource: 'UNRESOLVED',
      freshCourseObjectiveRecords: 0,
      freshIndicatorRecords: 0,
      complete: false,
    });
    expect(result.progress.courseObjectives).toEqual([]);
    expect(prisma.courseObjectiveAchievement.findMany).not.toHaveBeenCalled();
    expect(prisma.graduationRequirementAchievement.findMany).not.toHaveBeenCalled();
  });
});

describe('achievement evaluation transaction consistency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([{ userId: 'student-1' }]);
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([
      { id: 'co-1', indicatorPointId: 'ip-1' },
      { id: 'co-2', indicatorPointId: 'ip-1' },
    ]);
  });

  it('reads evidence from one transaction and calculates each CO once', async () => {
    const tx = {
      userExperiment: {
        findMany: jest.fn().mockResolvedValue([
          { experimentId: 'exp02', score: 80, status: 'COMPLETED' },
        ]),
      },
      indicatorPoint: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ip-1',
          code: '1-1',
          achievementThreshold: 0.65,
          graduationRequirement: { id: 'gr-1' },
          courseObjectives: [
            { id: 'co-1', code: 'CO1', supportWeight: 0.5 },
            { id: 'co-2', code: 'CO2', supportWeight: 0.5 },
          ],
        }),
      },
      courseObjective: {
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          indicatorPoint: { achievementThreshold: 0.65 },
          assessmentLinks: where.id === 'co-1'
            ? [{
              assessmentType: 'QUIZ',
              assessmentTargetId: 'quiz-addressing',
              maxScore: 100,
              weight: 1,
              chapter: null,
              description: '寻址方式专项测评',
            }]
            : [{
              assessmentType: 'EXPERIMENT',
              assessmentTargetId: 'exp02',
              maxScore: 100,
              weight: 1,
              chapter: null,
              description: 'exp02 仿真实践',
            }],
        })),
      },
      quizAttempt: {
        findFirst: jest.fn().mockResolvedValue({ score: 90, totalQuestions: 10 }),
      },
      learningProgress: { findMany: jest.fn() },
      courseObjectiveAchievement: { upsert: jest.fn().mockResolvedValue({}) },
      graduationRequirementAchievement: { upsert: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));

    const result = await batchCalculateClassAchievement('class-1', '2025-2026-2');

    expect(result).toEqual({ studentCount: 1, coResults: 2, grResults: 1 });
    expect(tx.userExperiment.findMany).toHaveBeenCalledTimes(1);
    expect(tx.courseObjectiveAchievement.upsert).toHaveBeenCalledTimes(2);
    expect(tx.graduationRequirementAchievement.upsert).toHaveBeenCalledTimes(1);
    expect(tx.quizAttempt.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1', quizId: 'quiz-addressing' },
    }));
    expect(prisma.userExperiment.findMany).not.toHaveBeenCalled();
    expect(prisma.quizAttempt.findFirst).not.toHaveBeenCalled();
    expect(prisma.courseObjectiveAchievement.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 30000,
      timeout: 60000,
    });
    expect(tx.courseObjectiveAchievement.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_courseObjectiveId_semester_classId: expect.objectContaining({
          userId: 'student-1',
          semester: '2025-2026-2',
          classId: 'class-1',
        }),
      },
      create: expect.objectContaining({ classId: 'class-1', semester: '2025-2026-2' }),
    }));
    expect(tx.graduationRequirementAchievement.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId_indicatorPointId_semester_classId: {
          userId: 'student-1',
          indicatorPointId: 'ip-1',
          semester: '2025-2026-2',
          classId: 'class-1',
        },
      },
    }));
  });
});

describe('achievement gap data sufficiency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.classGroup.findUnique as jest.Mock).mockResolvedValue({ id: 'class-1', name: '2024级1班' });
    (prisma.classEnrollment.count as jest.Mock).mockResolvedValue(2);
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1' },
      { userId: 'student-2' },
    ]);
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.courseObjectiveAchievement.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.graduationRequirementAchievement.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { indicatorPointId: 'ip-active', _avg: { achievementDegree: 0.6 }, _count: { passed: 2 } },
        { indicatorPointId: 'ip-stale', _avg: { achievementDegree: 1 }, _count: { passed: 2 } },
      ])
      .mockResolvedValueOnce([
        { indicatorPointId: 'ip-active', _count: { passed: 1 } },
        { indicatorPointId: 'ip-stale', _count: { passed: 2 } },
      ]);
    (prisma.indicatorPoint.findMany as jest.Mock).mockImplementation(async (args: { where?: unknown }) => (
      args.where
        ? [{ id: 'ip-active', code: '1-1', achievementThreshold: 0.65 }]
        : [
          { id: 'ip-active', code: '1-1', description: '问题分析' },
          { id: 'ip-stale', code: '9-9', description: '已停用旧指标' },
        ]
    ));
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1', indicatorPointId: 'ip-active', passed: false },
    ]);
  });

  it('marks partial records as insufficient and excludes stale indicators', async () => {
    const result = await getGapAnalysis('class-1', '2025-2026-2');

    expect(result).toMatchObject({
      totalIndicators: 1,
      expectedRecords: 2,
      actualRecords: 1,
      dataSufficient: false,
      averageAchievement: null,
      passRate: null,
      passedStudents: 0,
    });
    expect(result.weakPoints.map((item) => item.code)).toEqual(['1-1']);
    expect(result.strengths).toEqual([]);
  });

  it('does not count achievement records calculated before the current configuration', async () => {
    const configurationUpdatedAt = new Date('2026-07-18T08:00:00.000Z');
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([{
      id: 'co-active',
      code: 'CO1',
      name: '课程目标一',
      updatedAt: configurationUpdatedAt,
      indicatorPointId: 'ip-active',
      indicatorPoint: {
        id: 'ip-active',
        updatedAt: configurationUpdatedAt,
        achievementThreshold: 0.65,
      },
      assessmentLinks: [{ updatedAt: configurationUpdatedAt }],
    }]);
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getGapAnalysis('class-1', '2025-2026-2');

    expect(prisma.graduationRequirementAchievement.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        calculatedAt: { gte: configurationUpdatedAt },
        indicatorPointId: { in: ['ip-active'] },
      }),
    }));
    expect(prisma.graduationRequirementAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ calculatedAt: { gte: configurationUpdatedAt } }),
    }));
    expect(result).toMatchObject({
      actualRecords: 0,
      dataSufficient: false,
      configurationUpdatedAt: configurationUpdatedAt.toISOString(),
    });
  });
});

describe('official OBE assessment mapping', () => {
  it('publishes a unique administrator catalog containing only resolvable formal resources', () => {
    const keys = OBE_ASSESSMENT_RESOURCES.map((resource) => `${resource.type}:${resource.targetId}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const resource of OBE_ASSESSMENT_RESOURCES) {
      expect(resolveOBEAssessmentResource(
        resource.type,
        resource.targetId,
        resource.chapter,
      )).toEqual({
        valid: true,
        chapter: resource.chapter,
        description: resource.description,
      });
    }
  });

  it('uses existing resources, matching chapter numbers and complete weights', () => {
    for (const objective of COURSE_OBJECTIVES) {
      const totalWeight = objective.assessmentLinks.reduce((sum, link) => sum + link.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 8);

      for (const link of objective.assessmentLinks) {
        const resource = resolveOBEAssessmentResource(link.type, link.targetId, link.chapter);
        expect(resource).toMatchObject({ valid: true });
        if (resource.valid) {
          expect(link.description).toBe(resource.description);
          expect(link.chapter ?? null).toBe(resource.chapter);
        }
      }
    }
  });

  it('rejects nonexistent resources and chapter mismatches', () => {
    expect(resolveOBEAssessmentResource('EXPERIMENT', 'exp99')).toMatchObject({ valid: false });
    expect(resolveOBEAssessmentResource('QUIZ', 'quiz-ch3', 4)).toMatchObject({ valid: false });
    expect(resolveOBEAssessmentResource('LEARNING_PROGRESS', 'chapter-3', 3)).toMatchObject({ valid: false });
  });
});
