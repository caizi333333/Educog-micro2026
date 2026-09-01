import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  GET as getCalculationReview,
  POST as calculateAchievement,
} from '@/app/api/obe/achievement/calculate/route';
import { POST as createCourseObjective } from '@/app/api/obe/course-objectives/route';
import {
  GET as getCourseObjectiveImpact,
  PATCH as updateCourseObjective,
} from '@/app/api/obe/course-objectives/[id]/route';
import {
  POST as createAssessmentLink,
  PUT as replaceAssessmentLinks,
} from '@/app/api/obe/course-objectives/[id]/assessment-links/route';
import { GET as getCourseObjectiveAchievement } from '@/app/api/obe/achievement/course-objective/route';
import { GET as getGraduationRequirementAchievement } from '@/app/api/obe/achievement/graduation-requirement/route';
import { GET as getStudentGraduationProgress } from '@/app/api/obe/student/graduation-progress/route';
import {
  GET as getCqiReports,
  POST as createCqiReport,
} from '@/app/api/obe/cqi/reports/route';
import { PUT as updateCqiReport } from '@/app/api/obe/cqi/reports/[id]/route';
import { POST as createCqiAction } from '@/app/api/obe/cqi/reports/[id]/action-items/route';
import { verifyToken } from '@/lib/auth';
import { canAccessStudentData, getAccessibleClassIds } from '@/lib/classroom';
import {
  batchCalculateClassAchievement,
  batchCalculateUserAchievement,
  getGapAnalysis,
  getStudentProgressSummary,
  type GapAnalysisResult,
} from '@/lib/achievement-evaluation';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/classroom', () => ({
  getAccessibleClassIds: jest.fn(),
  canAccessStudentData: jest.fn(),
}));
jest.mock('@/lib/achievement-evaluation', () => ({
  batchCalculateClassAchievement: jest.fn(),
  batchCalculateUserAchievement: jest.fn(),
  getGapAnalysis: jest.fn(),
  getStudentProgressSummary: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    classGroup: { findUnique: jest.fn() },
    classEnrollment: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
    userActivity: { findUnique: jest.fn(), create: jest.fn() },
    indicatorPoint: { findUnique: jest.fn() },
    courseObjective: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    assessmentLink: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    courseObjectiveAchievement: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    graduationRequirementAchievement: { findMany: jest.fn(), count: jest.fn() },
    cQIReport: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    cQIActionItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockAccessibleClassIds = getAccessibleClassIds as jest.MockedFunction<typeof getAccessibleClassIds>;
const mockCanAccessStudentData = canAccessStudentData as jest.MockedFunction<typeof canAccessStudentData>;
const mockCalculateUser = batchCalculateUserAchievement as jest.MockedFunction<typeof batchCalculateUserAchievement>;
const mockCalculateClass = batchCalculateClassAchievement as jest.MockedFunction<typeof batchCalculateClassAchievement>;
const mockGetGapAnalysis = getGapAnalysis as jest.MockedFunction<typeof getGapAnalysis>;
const mockGetStudentProgress = getStudentProgressSummary as jest.MockedFunction<typeof getStudentProgressSummary>;

const authHeaders = { authorization: 'Bearer valid-token', 'content-type': 'application/json' };

const calculationRequest = (body: Record<string, unknown>) => new NextRequest(
  'http://localhost/api/obe/achievement/calculate',
  {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ requestId: 'calc-request-001', ...body }),
  },
);

const reportUpdateRequest = (body: Record<string, unknown>) => new NextRequest(
  'http://localhost/api/obe/cqi/reports/report-1',
  {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ requestId: 'report-update-001', ...body }),
  },
);

const cqiReportRequest = (body: Record<string, unknown>) => new NextRequest(
  'http://localhost/api/obe/cqi/reports',
  {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      requestId: 'report-create-001',
      classId: 'class-1',
      semester: '2025-2026-2',
      reportType: 'INDICATOR',
      ...body,
    }),
  },
);

const dueDateText = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
};

const baseCqiGap: GapAnalysisResult = {
  classId: 'class-1',
  semester: '2025-2026-2',
  weakPoints: [{ code: '1-1', name: '问题分析', avgAchievement: 0.58, threshold: 0.65, gap: -0.07 }],
  strengths: [{ code: '2-1', name: '方案设计', avgAchievement: 0.8 }],
  totalIndicators: 2,
  passedIndicators: 1,
  averageAchievement: 0.69,
  totalStudents: 2,
  passedStudents: 1,
  passRate: 50,
  expectedRecords: 4,
  actualRecords: 4,
  dataSufficient: true,
  configurationUpdatedAt: null,
};

function cqiSourceDigest(gap: GapAnalysisResult): string {
  const finiteNumber = (value: number | null): number | null => {
    if (value === null || !Number.isFinite(value)) return null;
    const rounded = Math.round(value * 1_000_000) / 1_000_000;
    return Object.is(rounded, -0) ? 0 : rounded;
  };
  const byCode = <T extends { code: string }>(left: T, right: T): number => (
    left.code.localeCompare(right.code, 'en')
  );
  return createHash('sha256').update(JSON.stringify({
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
  })).digest('hex');
}

function cqiSnapshotMetadata(gap: GapAnalysisResult = baseCqiGap): string {
  return JSON.stringify({
    schema: 'CQI_SOURCE_SNAPSHOT_V1',
    sourceDigest: cqiSourceDigest(gap),
    expectedRecords: gap.expectedRecords,
    actualRecords: gap.actualRecords,
    totalIndicators: gap.totalIndicators,
    passedIndicators: gap.passedIndicators,
    configurationUpdatedAt: gap.configurationUpdatedAt,
  });
}

function currentCqiReport(
  status: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'report-1',
    classId: 'class-1',
    semester: '2025-2026-2',
    reportType: 'INDICATOR',
    previousMeasures: cqiSnapshotMetadata(),
    status,
    ...overrides,
  };
}

describe('GET /api/obe/student/graduation-progress class scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'student-1', email: 'student@example.com', role: 'STUDENT' });
    mockGetStudentProgress.mockResolvedValue({
      courseObjectives: [],
      indicatorPoints: [],
      overallPassedCount: 0,
      overallTotalCount: 0,
      dataStatus: {
        semester: '2025-2026-2',
        semesterSource: 'REQUEST',
        classId: 'class-1',
        className: '2025级1班',
        classScopeSource: 'REQUEST',
        availableClasses: [{ classId: 'class-1', className: '2025级1班', semester: '2025-2026-2' }],
        configurationRevision: 'abcdef1234567890abcd',
        configurationUpdatedAt: null,
        expectedCourseObjectiveRecords: 0,
        freshCourseObjectiveRecords: 0,
        staleCourseObjectiveRecords: 0,
        missingCourseObjectiveRecords: 0,
        expectedIndicatorRecords: 0,
        freshIndicatorRecords: 0,
        staleIndicatorRecords: 0,
        missingIndicatorRecords: 0,
        complete: false,
        lastCalculatedAt: null,
      },
    });
  });

  it('rejects a malformed class identifier before reading achievement records', async () => {
    const response = await getStudentGraduationProgress(new NextRequest(
      'http://localhost/api/obe/student/graduation-progress?classId=bad%20class&semester=2025-2026-2',
      { headers: authHeaders },
    ));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '班级编号格式无效' });
    expect(mockGetStudentProgress).not.toHaveBeenCalled();
  });

  it('passes the selected class and semester as one server-side scope', async () => {
    const response = await getStudentGraduationProgress(new NextRequest(
      'http://localhost/api/obe/student/graduation-progress?classId=class-1&semester=2025-2026-2',
      { headers: authHeaders },
    ));

    expect(response.status).toBe(200);
    expect(mockGetStudentProgress).toHaveBeenCalledWith('student-1', '2025-2026-2', 'class-1');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});

describe('GET /api/obe/achievement read scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
    mockAccessibleClassIds.mockResolvedValue(['class-1', 'class-2']);
    mockCanAccessStudentData.mockResolvedValue(false);
    (prisma.courseObjectiveAchievement.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(0);
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.graduationRequirementAchievement.count as jest.Mock).mockResolvedValue(0);
    (prisma.classEnrollment.count as jest.Mock).mockResolvedValue(2);
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([{
      id: 'co-1',
      code: 'CO1',
      version: 2,
      updatedAt: new Date('2026-07-18T10:00:00.000Z'),
      indicatorPointId: 'ip-1',
      assessmentLinks: [{ updatedAt: new Date('2026-07-18T10:00:00.000Z') }],
    }]);
  });

  it('limits an unfiltered teacher query to accessible classes', async () => {
    const response = await getCourseObjectiveAchievement(new NextRequest(
      'http://localhost/api/obe/achievement/course-objective?semester=2025-2026-2',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dataProvenance).toEqual(expect.objectContaining({
      mode: expect.stringMatching(/^(DEMO|REAL|MIXED)$/),
      label: expect.any(String),
      note: expect.any(String),
    }));
    expect(prisma.courseObjectiveAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        semester: '2025-2026-2',
        classId: { in: ['class-1', 'class-2'] },
        courseObjectiveId: { in: ['co-1'] },
        calculatedAt: { gte: new Date('2026-07-18T10:00:00.000Z') },
      }),
    }));
  });

  it('returns the server data identity with graduation-requirement reads', async () => {
    const response = await getGraduationRequirementAchievement(new NextRequest(
      'http://localhost/api/obe/achievement/graduation-requirement?classId=class-1&semester=2025-2026-2',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dataProvenance).toEqual(expect.objectContaining({
      mode: expect.stringMatching(/^(DEMO|REAL|MIXED)$/),
      label: expect.any(String),
      note: expect.any(String),
    }));
  });

  it('rejects an inaccessible class before querying results', async () => {
    const response = await getGraduationRequirementAchievement(new NextRequest(
      'http://localhost/api/obe/achievement/graduation-requirement?classId=class-9',
      { headers: { authorization: 'Bearer valid-token' } },
    ));

    expect(response.status).toBe(403);
    expect(prisma.graduationRequirementAchievement.findMany).not.toHaveBeenCalled();
  });

  it('rejects a student outside the teacher scope', async () => {
    const response = await getCourseObjectiveAchievement(new NextRequest(
      'http://localhost/api/obe/achievement/course-objective?userId=student-9',
      { headers: { authorization: 'Bearer valid-token' } },
    ));

    expect(response.status).toBe(403);
    expect(mockCanAccessStudentData).toHaveBeenCalledWith(expect.objectContaining({ userId: 'teacher-1' }), 'student-9');
    expect(prisma.courseObjectiveAchievement.findMany).not.toHaveBeenCalled();
  });

  it('returns only current-configuration records and reports missing and stale results', async () => {
    (prisma.courseObjectiveAchievement.findMany as jest.Mock).mockResolvedValue([{
      id: 'achievement-current',
      courseObjectiveId: 'co-1',
      calculatedAt: new Date('2026-07-18T11:00:00.000Z'),
      achievementDegree: 0.72,
      passed: true,
      courseObjective: { code: 'CO1', name: '目标一' },
    }]);
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(1);

    const response = await getCourseObjectiveAchievement(new NextRequest(
      'http://localhost/api/obe/achievement/course-objective?classId=class-1&semester=2025-2026-2',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(body.achievements).toHaveLength(1);
    expect(body.dataStatus).toMatchObject({
      targetCount: 2,
      expectedRecords: 2,
      freshRecords: 1,
      staleRecords: 1,
      missingRecords: 1,
      complete: false,
      configurationRevision: expect.any(String),
    });
  });
});

describe('POST /api/obe/achievement/calculate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
    mockAccessibleClassIds.mockResolvedValue(['class-1']);
    mockCalculateUser.mockResolvedValue({ coResults: 1, grResults: 1 });
    mockCalculateClass.mockResolvedValue({ studentCount: 2, coResults: 2, grResults: 2 });
    (prisma.userActivity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userActivity.create as jest.Mock).mockResolvedValue({ id: 'receipt-1' });
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'co-1',
        code: 'CO1',
        version: 2,
        updatedAt: new Date('2026-07-18T10:00:00.000Z'),
        indicatorPointId: 'ip-1',
        assessmentLinks: [{
          assessmentType: 'QUIZ',
          assessmentTargetId: 'quiz-ch3',
          weight: 1,
          chapter: 3,
          updatedAt: new Date('2026-07-18T10:00:00.000Z'),
        }],
      },
    ]);
    (prisma.classGroup.findUnique as jest.Mock).mockResolvedValue({
      id: 'class-1',
      status: 'ACTIVE',
      semester: '2025-2026-2',
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'STUDENT', status: 'ACTIVE' });
    (prisma.classEnrollment.findFirst as jest.Mock).mockResolvedValue({ id: 'enrollment-1' });
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1', user: { name: '学生甲', username: 'student-a', studentId: 'S001' } },
      { userId: 'student-2', user: { name: '学生乙', username: 'student-b', studentId: 'S002' } },
    ]);
    (prisma.classEnrollment.count as jest.Mock).mockResolvedValue(2);
    (prisma.courseObjectiveAchievement.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(0);
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.graduationRequirementAchievement.count as jest.Mock).mockResolvedValue(0);
  });

  it('requires a teacher to specify the student class scope', async () => {
    const response = await calculateAchievement(calculationRequest({ userId: 'student-2' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: '计算单个学生时必须同时指定班级' });
    expect(mockCalculateUser).not.toHaveBeenCalled();
  });

  it('rejects a class outside the teacher scope', async () => {
    (prisma.classGroup.findUnique as jest.Mock).mockResolvedValue({
      id: 'class-9',
      status: 'ACTIVE',
      semester: '2025-2026-2',
    });
    const response = await calculateAchievement(calculationRequest({ classId: 'class-9', userId: 'student-2' }));

    expect(response.status).toBe(403);
    expect(mockCalculateUser).not.toHaveBeenCalled();
  });

  it('requires review and explicit confirmation before calculating one active student', async () => {
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1', user: { name: '学生甲', username: 'student-a', studentId: 'S001' } },
    ]);
    const preflight = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      userId: 'student-1',
      semester: '2025-2026-2',
    }));
    const review = await preflight.json();

    expect(preflight.status).toBe(409);
    expect(review).toMatchObject({
      confirmationRequired: true,
      mode: 'user',
      targetUserId: 'student-1',
      targetCount: 1,
      students: [{ userId: 'student-1', name: '学生甲', studentCode: 'S001' }],
    });
    expect(mockCalculateUser).not.toHaveBeenCalled();

    const response = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      userId: 'student-1',
      semester: '2025-2026-2',
      confirm: 'CALCULATE_USER',
      expectedScopeRevision: review.scopeRevision,
    }));

    expect(response.status).toBe(200);
    expect(mockCalculateUser).toHaveBeenCalledWith('student-1', '2025-2026-2', 'class-1');
    expect(prisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CALCULATE_OBE_ACHIEVEMENT' }),
    }));
  });

  it('requires an administrator to retain the student class scope', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const response = await calculateAchievement(calculationRequest({ userId: 'student-1' }));

    expect(response.status).toBe(400);
    expect(prisma.classEnrollment.findFirst).not.toHaveBeenCalled();
    expect(mockCalculateUser).not.toHaveBeenCalled();
  });

  it('returns the server-side target count before a class calculation', async () => {
    const response = await calculateAchievement(calculationRequest({ classId: 'class-1' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      confirmationRequired: true,
      mode: 'class',
      targetUserId: null,
      targetCount: 2,
      objectiveCount: 1,
      indicatorPointCount: 1,
      expectedCourseObjectiveRecords: 2,
      expectedIndicatorRecords: 2,
      currentCourseObjectiveRecords: 0,
      currentIndicatorRecords: 0,
      configurationRevision: expect.any(String),
      scopeRevision: expect.any(String),
      students: [
        expect.objectContaining({ userId: 'student-1', name: '学生甲' }),
        expect.objectContaining({ userId: 'student-2', name: '学生乙' }),
      ],
    });
    expect(mockCalculateClass).not.toHaveBeenCalled();
  });

  it('refuses an unscoped calculation when the class has no valid semester', async () => {
    (prisma.classGroup.findUnique as jest.Mock).mockResolvedValue({
      id: 'class-1',
      status: 'ACTIVE',
      semester: null,
    });

    const response = await calculateAchievement(calculationRequest({ classId: 'class-1' }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '班级未配置有效学期，请先完善班级信息' });
    expect(mockCalculateClass).not.toHaveBeenCalled();
  });

  it('returns a read-only per-student review without calculating or writing', async () => {
    (prisma.courseObjectiveAchievement.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1', calculatedAt: new Date('2026-07-18T11:00:00.000Z') },
      { userId: 'student-2', calculatedAt: new Date('2026-07-18T09:00:00.000Z') },
    ]);
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1', calculatedAt: new Date('2026-07-18T11:05:00.000Z') },
    ]);

    const response = await getCalculationReview(new NextRequest(
      'http://localhost/api/obe/achievement/calculate?classId=class-1&semester=2025-2026-2',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(body.dataProvenance).toEqual(expect.objectContaining({
      mode: expect.stringMatching(/^(DEMO|REAL|MIXED)$/),
      label: expect.any(String),
      note: expect.any(String),
    }));
    expect(body.configurationError).toBeNull();
    expect(body.review).toMatchObject({
      mode: 'class',
      targetCount: 2,
      currentCourseObjectiveRecords: 1,
      staleCourseObjectiveRecords: 1,
      currentIndicatorRecords: 1,
      students: [
        expect.objectContaining({
          userId: 'student-1',
          complete: true,
          freshCourseObjectiveRecords: 1,
          freshIndicatorRecords: 1,
          lastCalculatedAt: '2026-07-18T11:05:00.000Z',
        }),
        expect.objectContaining({
          userId: 'student-2',
          complete: false,
          staleCourseObjectiveRecords: 1,
          missingCourseObjectiveRecords: 1,
          missingIndicatorRecords: 1,
        }),
      ],
    });
    expect(mockCalculateClass).not.toHaveBeenCalled();
    expect(mockCalculateUser).not.toHaveBeenCalled();
    expect(prisma.userActivity.create).not.toHaveBeenCalled();
  });

  it('calculates a class only after explicit confirmation', async () => {
    const preflight = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      semester: '2025-2026-2',
    }));
    const review = await preflight.json();
    const response = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      semester: '2025-2026-2',
      confirm: 'CALCULATE_CLASS',
      expectedScopeRevision: review.scopeRevision,
    }));

    expect(response.status).toBe(200);
    expect(mockCalculateClass).toHaveBeenCalledWith('class-1', '2025-2026-2');
  });

  it('requires a new review when the effective class roster changes after preflight', async () => {
    const preflight = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      semester: '2025-2026-2',
    }));
    const review = await preflight.json();
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue([
      { userId: 'student-1' },
      { userId: 'student-2' },
      { userId: 'student-3' },
    ]);

    const response = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      semester: '2025-2026-2',
      confirm: 'CALCULATE_CLASS',
      expectedScopeRevision: review.scopeRevision,
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      confirmationRequired: true,
      confirmationStale: true,
      targetCount: 3,
      scopeRevision: expect.not.stringMatching(review.scopeRevision),
    });
    expect(mockCalculateClass).not.toHaveBeenCalled();
  });

  it('blocks calculation when an active objective has no assessment link', async () => {
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'co-2',
        code: 'CO2',
        version: 3,
        updatedAt: new Date('2026-07-18T10:00:00.000Z'),
        indicatorPointId: 'ip-1',
        assessmentLinks: [],
      },
    ]);
    const response = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      confirm: 'CALCULATE_CLASS',
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('CO2') });
    expect(mockCalculateClass).not.toHaveBeenCalled();
  });

  it('blocks calculation when weights are incomplete or a resource is invalid', async () => {
    (prisma.courseObjective.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'co-2',
        code: 'CO2',
        version: 3,
        updatedAt: new Date('2026-07-18T10:00:00.000Z'),
        indicatorPointId: 'ip-1',
        assessmentLinks: [
          {
            assessmentType: 'QUIZ',
            assessmentTargetId: 'quiz-ch3',
            weight: 0.7,
            chapter: 4,
            updatedAt: new Date('2026-07-18T10:00:00.000Z'),
          },
        ],
      },
    ]);
    const response = await calculateAchievement(calculationRequest({
      classId: 'class-1',
      confirm: 'CALCULATE_CLASS',
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('70.0%');
    expect(body.error).toContain('资源编号与章节不一致');
    expect(mockCalculateClass).not.toHaveBeenCalled();
  });

  it('restores an exact completed request without recalculating', async () => {
    (prisma.userActivity.findUnique as jest.Mock).mockResolvedValue({
      details: JSON.stringify({
        kind: 'OBE_CALCULATION',
        requestId: 'calc-request-001',
        signature: { mode: 'class', classId: 'class-1', userId: null, semester: '2025-2026-2' },
        result: { mode: 'class', classId: 'class-1', semester: '2025-2026-2', studentCount: 2 },
      }),
    });
    const response = await calculateAchievement(calculationRequest({ classId: 'class-1' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true, studentCount: 2 });
    expect(mockCalculateClass).not.toHaveBeenCalled();
  });
});

describe('OBE configuration writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.courseObjective.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'co-new',
      ...data,
    }));
    (prisma.assessmentLink.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.assessmentLink.aggregate as jest.Mock).mockResolvedValue({ _sum: { weight: 0.6 } });
    (prisma.assessmentLink.create as jest.Mock).mockImplementation(async ({ data }) => ({ id: 'link-new', ...data }));
    (prisma.assessmentLink.createMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.assessmentLink.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.courseObjective.update as jest.Mock).mockResolvedValue({ id: 'co-new', isActive: true });
    (prisma.courseObjective.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.courseObjectiveAchievement.aggregate as jest.Mock).mockResolvedValue({
      _count: { _all: 0 },
      _max: { calculatedAt: null },
    });
    (prisma.courseObjectiveAchievement.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(0);
    (prisma.userActivity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userActivity.create as jest.Mock).mockResolvedValue({ id: 'receipt-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
  });

  it('creates a new objective as a draft until assessment weights are complete', async () => {
    (prisma.indicatorPoint.findUnique as jest.Mock).mockResolvedValue({ id: 'ip-1' });
    const request = new NextRequest('http://localhost/api/obe/course-objectives', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        code: 'CO6',
        name: '验证接口应用方案',
        indicatorPointId: 'ip-1',
        supportWeight: 0.3,
      }),
    });
    const response = await createCourseObjective(request);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ draft: true, duplicate: false });
    expect(prisma.courseObjective.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: 'CO6', isActive: false }),
    });
  });

  it('rejects an assessment target that is not in the formal resource catalog', async () => {
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-new/assessment-links', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        assessmentType: 'EXPERIMENT',
        assessmentTargetId: 'exp99',
        weight: 0.4,
        maxScore: 100,
      }),
    });
    const response = await createAssessmentLink(request, { params: Promise.resolve({ id: 'co-new' }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('不存在') });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before changing an active objective', async () => {
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({ id: 'co-1', isActive: true });
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-1/assessment-links', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        assessmentType: 'EXPERIMENT',
        assessmentTargetId: 'exp02',
        weight: 0.4,
        maxScore: 100,
      }),
    });
    const response = await createAssessmentLink(request, { params: Promise.resolve({ id: 'co-1' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ confirmationRequired: true });
    expect(prisma.assessmentLink.create).not.toHaveBeenCalled();
  });

  it('activates a draft atomically when its formal resource weights reach 100%', async () => {
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({ id: 'co-new', isActive: false });
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-new/assessment-links', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        assessmentType: 'EXPERIMENT',
        assessmentTargetId: 'exp02',
        weight: 0.4,
        maxScore: 100,
      }),
    });
    const response = await createAssessmentLink(request, { params: Promise.resolve({ id: 'co-new' }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ activated: true, duplicate: false });
    expect(prisma.assessmentLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assessmentTargetId: 'exp02',
        chapter: null,
        description: '实验二：指令系统实验',
      }),
    });
    expect(prisma.courseObjective.update).toHaveBeenCalledWith({
      where: { id: 'co-new' },
      data: { isActive: true, version: { increment: 1 } },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('previews the exact retained-record impact before an administrator changes an objective', async () => {
    const updatedAt = new Date('2026-07-18T10:00:00.000Z');
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({
      id: 'co-2',
      code: 'CO2',
      version: 3,
      isActive: true,
      updatedAt,
      indicatorPoint: { code: '1-3', graduationRequirement: { code: 'GR01' } },
      assessmentLinks: [{
        id: 'link-1',
        assessmentType: 'EXPERIMENT',
        assessmentTargetId: 'exp02',
        weight: 1,
        maxScore: 100,
        chapter: null,
        updatedAt,
      }],
    });
    (prisma.courseObjectiveAchievement.aggregate as jest.Mock).mockResolvedValue({
      _count: { _all: 8 },
      _max: { calculatedAt: new Date('2026-07-17T10:00:00.000Z') },
    });
    (prisma.courseObjectiveAchievement.groupBy as jest.Mock)
      .mockResolvedValueOnce([{ userId: 'student-1' }, { userId: 'student-2' }])
      .mockResolvedValueOnce([{ classId: 'class-1' }])
      .mockResolvedValueOnce([{ semester: '2025-2026-2' }]);

    const response = await getCourseObjectiveImpact(
      new NextRequest('http://localhost/api/obe/course-objectives/co-2', { headers: authHeaders }),
      { params: Promise.resolve({ id: 'co-2' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      objective: { version: 3, totalWeight: 1, configurationIssues: [] },
      impact: {
        achievementRecordCount: 8,
        affectedStudentCount: 2,
        affectedClassCount: 1,
        affectedSemesterCount: 1,
        recordsWillBeRetained: true,
        requiresRecalculation: true,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
  });

  it('requires a version-bound confirmation before changing an active objective with records', async () => {
    const updatedAt = new Date('2026-07-18T10:00:00.000Z');
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({
      id: 'co-2',
      version: 3,
      isActive: true,
      name: '原目标',
      description: null,
      indicatorPointId: 'ip-1',
      supportWeight: 0.4,
      updatedAt,
      assessmentLinks: [{
        assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 1,
        maxScore: 100, chapter: null, updatedAt,
      }],
    });
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(8);
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-2', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'objective-edit-001',
        expectedVersion: 3,
        supportWeight: 0.35,
      }),
    });

    const response = await updateCourseObjective(request, { params: Promise.resolve({ id: 'co-2' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      confirmationRequired: true,
      affectedAchievementRecords: 8,
    });
    expect(prisma.courseObjective.updateMany).not.toHaveBeenCalled();
  });

  it('updates objective metadata and its audit receipt in one confirmed transaction', async () => {
    const updatedAt = new Date('2026-07-18T10:00:00.000Z');
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({
      id: 'co-2',
      code: 'CO2',
      version: 3,
      isActive: true,
      name: '原目标',
      description: null,
      indicatorPointId: 'ip-1',
      supportWeight: 0.4,
      updatedAt,
      indicatorPoint: { code: '1-3', graduationRequirement: { code: 'GR01' } },
      assessmentLinks: [{
        assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 1,
        maxScore: 100, chapter: null, updatedAt,
      }],
    });
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(8);
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-2', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'objective-edit-002',
        expectedVersion: 3,
        supportWeight: 0.35,
        confirm: 'APPLY_OBJECTIVE_CONFIGURATION',
      }),
    });

    const response = await updateCourseObjective(request, { params: Promise.resolve({ id: 'co-2' }) });

    expect(response.status).toBe(200);
    expect(prisma.courseObjective.updateMany).toHaveBeenCalledWith({
      where: { id: 'co-2', version: 3 },
      data: { supportWeight: 0.35, version: { increment: 1 } },
    });
    expect(prisma.userActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'UPDATE_OBE_COURSE_OBJECTIVE',
        userId: 'admin-1',
      }),
    });
  });

  it('rejects a stale objective version before changing configuration', async () => {
    const updatedAt = new Date('2026-07-18T10:00:00.000Z');
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({
      id: 'co-2',
      version: 4,
      isActive: true,
      name: '原目标',
      description: null,
      indicatorPointId: 'ip-1',
      supportWeight: 0.4,
      updatedAt,
      assessmentLinks: [{
        assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 1,
        maxScore: 100, chapter: null, updatedAt,
      }],
    });
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-2', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'objective-edit-stale',
        expectedVersion: 3,
        supportWeight: 0.35,
        confirm: 'APPLY_OBJECTIVE_CONFIGURATION',
      }),
    });

    const response = await updateCourseObjective(request, { params: Promise.resolve({ id: 'co-2' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ currentVersion: 4 });
    expect(prisma.courseObjective.updateMany).not.toHaveBeenCalled();
  });

  it('restores an exact objective update request without writing a second time', async () => {
    const updatedAt = new Date('2026-07-18T10:00:00.000Z');
    const current = {
      id: 'co-2',
      code: 'CO2',
      version: 3,
      isActive: true,
      name: '原目标',
      description: null,
      indicatorPointId: 'ip-1',
      supportWeight: 0.4,
      updatedAt,
      indicatorPoint: { id: 'ip-1', code: '1-3', graduationRequirement: { code: 'GR01' } },
      assessmentLinks: [{
        assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 1,
        maxScore: 100, chapter: null, updatedAt,
      }],
    };
    let storedReceipt: { details: string } | null = null;
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue(current);
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(2);
    (prisma.userActivity.findUnique as jest.Mock).mockImplementation(async () => storedReceipt);
    (prisma.userActivity.create as jest.Mock).mockImplementation(async ({ data }) => {
      storedReceipt = { details: data.details };
      return data;
    });
    const body = {
      requestId: 'objective-edit-replay',
      expectedVersion: 3,
      supportWeight: 0.35,
      confirm: 'APPLY_OBJECTIVE_CONFIGURATION',
    };

    const first = await updateCourseObjective(new NextRequest('http://localhost/api/obe/course-objectives/co-2', {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: 'co-2' }) });
    const replay = await updateCourseObjective(new NextRequest('http://localhost/api/obe/course-objectives/co-2', {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id: 'co-2' }) });

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ duplicate: true });
    expect(prisma.courseObjective.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.userActivity.create).toHaveBeenCalledTimes(1);
  });

  it('replaces a complete active assessment configuration atomically', async () => {
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({
      id: 'co-2',
      version: 4,
      isActive: true,
      assessmentLinks: [{
        assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 1,
        maxScore: 100, chapter: null, description: '实验二：指令系统实验',
      }],
    });
    (prisma.courseObjectiveAchievement.count as jest.Mock).mockResolvedValue(8);
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-2/assessment-links', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'assessment-edit-001',
        expectedVersion: 4,
        confirm: 'APPLY_ASSESSMENT_CONFIGURATION',
        links: [
          { assessmentType: 'QUIZ', assessmentTargetId: 'quiz-ch3', chapter: 3, weight: 0.6, maxScore: 100 },
          { assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 0.4, maxScore: 100 },
        ],
      }),
    });

    const response = await replaceAssessmentLinks(request, { params: Promise.resolve({ id: 'co-2' }) });

    expect(response.status).toBe(200);
    expect(prisma.assessmentLink.deleteMany).toHaveBeenCalledWith({ where: { courseObjectiveId: 'co-2' } });
    expect(prisma.assessmentLink.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ courseObjectiveId: 'co-2', assessmentTargetId: 'quiz-ch3', chapter: 3 }),
        expect.objectContaining({ courseObjectiveId: 'co-2', assessmentTargetId: 'exp02', chapter: null }),
      ]),
    });
    expect(prisma.courseObjective.updateMany).toHaveBeenCalledWith({
      where: { id: 'co-2', version: 4 },
      data: { version: { increment: 1 } },
    });
    expect(prisma.userActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'REPLACE_OBE_ASSESSMENT_CONFIGURATION' }),
    });
  });

  it('refuses to leave an active objective with incomplete assessment weights', async () => {
    (prisma.courseObjective.findUnique as jest.Mock).mockResolvedValue({
      id: 'co-2', version: 4, isActive: true, assessmentLinks: [],
    });
    const request = new NextRequest('http://localhost/api/obe/course-objectives/co-2/assessment-links', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'assessment-edit-002',
        expectedVersion: 4,
        confirm: 'APPLY_ASSESSMENT_CONFIGURATION',
        links: [{ assessmentType: 'EXPERIMENT', assessmentTargetId: 'exp02', weight: 0.9, maxScore: 100 }],
      }),
    });

    const response = await replaceAssessmentLinks(request, { params: Promise.resolve({ id: 'co-2' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('必须保持为 100%') });
    expect(prisma.assessmentLink.deleteMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/obe/cqi/reports data identity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
    mockAccessibleClassIds.mockResolvedValue(['class-1']);
    (prisma.cQIReport.findMany as jest.Mock).mockResolvedValue([]);
    mockGetGapAnalysis.mockResolvedValue(baseCqiGap);
  });

  it('returns the server data identity even when the authorized report list is empty', async () => {
    const response = await getCqiReports(new NextRequest(
      'http://localhost/api/obe/cqi/reports?classId=class-1',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reports).toEqual([]);
    expect(body.dataProvenance).toEqual(expect.objectContaining({
      mode: expect.stringMatching(/^(DEMO|REAL|MIXED)$/),
      label: expect.any(String),
      note: expect.any(String),
    }));
  });

  it('classifies stored reports as current, historical or unavailable without rewriting them', async () => {
    const changedGap = { ...baseCqiGap, averageAchievement: 0.71 };
    (prisma.cQIReport.findMany as jest.Mock).mockResolvedValue([
      {
        ...currentCqiReport('DRAFT'),
        id: 'report-current',
        averageAchievement: 0.69,
        passRate: 50,
        totalStudents: 2,
        passedStudents: 1,
        createdAt: new Date('2026-08-26T01:00:00.000Z'),
        actionItems: [],
      },
      {
        ...currentCqiReport('CLOSED', { previousMeasures: cqiSnapshotMetadata(changedGap) }),
        id: 'report-historical',
        averageAchievement: 0.71,
        passRate: 50,
        totalStudents: 2,
        passedStudents: 1,
        createdAt: new Date('2026-08-25T01:00:00.000Z'),
        actionItems: [],
      },
      {
        ...currentCqiReport('CLOSED', { previousMeasures: '["旧版措施"]' }),
        id: 'report-legacy',
        averageAchievement: 0.6,
        passRate: 45,
        totalStudents: 2,
        passedStudents: 0,
        createdAt: new Date('2026-08-24T01:00:00.000Z'),
        actionItems: [],
      },
    ]);

    const response = await getCqiReports(new NextRequest(
      'http://localhost/api/obe/cqi/reports?classId=class-1',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.reports.map((report: { snapshot: { freshness: string } }) => report.snapshot.freshness))
      .toEqual(['CURRENT', 'HISTORICAL', 'UNAVAILABLE']);
    expect(body.reports[0].snapshot).toMatchObject({
      sourceDigest: cqiSourceDigest(baseCqiGap),
      sourceCutoff: '2026-08-26T01:00:00.000Z',
      sourceSummary: { actualRecords: 4, expectedRecords: 4, totalIndicators: 2 },
    });
    expect(body.reports[2].snapshot.note).toContain('旧报告缺少可核验的源摘要');
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
    expect(mockGetGapAnalysis).toHaveBeenCalledTimes(1);
  });

  it('does not label a stored report current when the live source is incomplete', async () => {
    (prisma.cQIReport.findMany as jest.Mock).mockResolvedValue([{
      ...currentCqiReport('DRAFT'),
      averageAchievement: 0.69,
      passRate: 50,
      totalStudents: 2,
      passedStudents: 1,
      createdAt: new Date('2026-08-26T01:00:00.000Z'),
      actionItems: [],
    }]);
    mockGetGapAnalysis.mockResolvedValue({
      ...baseCqiGap,
      actualRecords: 3,
      dataSufficient: false,
    });

    const response = await getCqiReports(new NextRequest(
      'http://localhost/api/obe/cqi/reports?classId=class-1',
      { headers: { authorization: 'Bearer valid-token' } },
    ));
    const body = await response.json();

    expect(body.reports[0].snapshot).toMatchObject({
      freshness: 'UNAVAILABLE',
      currentDataStatus: { dataSufficient: false, actualRecords: 3, expectedRecords: 4 },
    });
  });
});

describe('POST /api/obe/cqi/reports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
    mockAccessibleClassIds.mockResolvedValue(['class-1']);
    (prisma.classGroup.findUnique as jest.Mock).mockResolvedValue({ id: 'class-1', name: '2024级1班', status: 'ACTIVE' });
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.userActivity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.cQIReport.create as jest.Mock).mockImplementation(async ({ data }) => ({ ...data, status: 'DRAFT' }));
    (prisma.userActivity.create as jest.Mock).mockResolvedValue({ id: 'event-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    mockGetGapAnalysis.mockResolvedValue(baseCqiGap);
  });

  it('rejects client-supplied analysis values', async () => {
    const response = await createCqiReport(cqiReportRequest({ passedStudents: 99 }));

    expect(response.status).toBe(400);
    expect(mockGetGapAnalysis).not.toHaveBeenCalled();
  });

  it('does not generate a formal report with incomplete records', async () => {
    mockGetGapAnalysis.mockResolvedValue({
      ...(await mockGetGapAnalysis('class-1', '2025-2026-2')),
      actualRecords: 3,
      expectedRecords: 4,
      dataSufficient: false,
    });
    const response = await createCqiReport(cqiReportRequest({}));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      dataStatus: { actualRecords: 3, expectedRecords: 4 },
    });
    expect(prisma.cQIReport.create).not.toHaveBeenCalled();
  });

  it('persists server-derived class statistics and an audit receipt atomically', async () => {
    const response = await createCqiReport(cqiReportRequest({ title: '' }));

    expect(response.status).toBe(201);
    expect(prisma.cQIReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^cqi_[a-f0-9]{32}$/),
        classId: 'class-1',
        averageAchievement: 0.69,
        passRate: 50,
        totalStudents: 2,
        passedStudents: 1,
        previousMeasures: expect.any(String),
      }),
    });
    const createData = (prisma.cQIReport.create as jest.Mock).mock.calls[0]?.[0]?.data;
    expect(JSON.parse(createData.previousMeasures)).toEqual({
      schema: 'CQI_SOURCE_SNAPSHOT_V1',
      sourceDigest: cqiSourceDigest(baseCqiGap),
      expectedRecords: 4,
      actualRecords: 4,
      totalIndicators: 2,
      passedIndicators: 1,
      configurationUpdatedAt: null,
    });
    expect(prisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CREATE_CQI_REPORT' }),
    }));
  });

  it('returns the existing report for the same source snapshot even with a new request id', async () => {
    const existing = {
      ...currentCqiReport('DRAFT'),
      id: 'existing-current-snapshot',
      actionItems: [],
    };
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(existing);

    const response = await createCqiReport(cqiReportRequest({ requestId: 'report-create-002' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      duplicate: true,
      report: { id: 'existing-current-snapshot' },
    });
    expect(prisma.cQIReport.create).not.toHaveBeenCalled();
  });

  it('restores the original report for an exact request retry even if the live source later changes', async () => {
    (prisma.userActivity.findUnique as jest.Mock).mockResolvedValue({
      details: JSON.stringify({
        requestId: 'report-create-001',
        reportId: 'original-report',
        classId: 'class-1',
        semester: '2025-2026-2',
        reportType: 'INDICATOR',
        sourceDigest: cqiSourceDigest(baseCqiGap),
      }),
    });
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue({
      ...currentCqiReport('DRAFT'),
      id: 'original-report',
      actionItems: [],
    });
    mockGetGapAnalysis.mockResolvedValue({ ...baseCqiGap, averageAchievement: 0.8 });

    const response = await createCqiReport(cqiReportRequest({}));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      duplicate: true,
      report: { id: 'original-report' },
    });
    expect(mockGetGapAnalysis).not.toHaveBeenCalled();
    expect(prisma.cQIReport.create).not.toHaveBeenCalled();
  });

  it('creates a new immutable report id when the source summary changes', async () => {
    const first = await createCqiReport(cqiReportRequest({ requestId: 'report-create-101' }));
    const changedGap: GapAnalysisResult = {
      ...baseCqiGap,
      averageAchievement: 0.72,
      weakPoints: [{ ...baseCqiGap.weakPoints[0], avgAchievement: 0.61, gap: -0.04 }],
    };
    mockGetGapAnalysis.mockResolvedValue(changedGap);
    const second = await createCqiReport(cqiReportRequest({ requestId: 'report-create-102' }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const createdIds = (prisma.cQIReport.create as jest.Mock).mock.calls
      .map(([input]) => input.data.id as string);
    expect(createdIds).toHaveLength(2);
    expect(createdIds[0]).not.toBe(createdIds[1]);
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
  });

  it('keeps the report id stable when gap points arrive in a different order', async () => {
    const expandedGap: GapAnalysisResult = {
      ...baseCqiGap,
      weakPoints: [
        ...baseCqiGap.weakPoints,
        { code: '1-2', name: '实验验证', avgAchievement: 0.6, threshold: 0.65, gap: -0.05 },
      ],
    };
    mockGetGapAnalysis.mockResolvedValue(expandedGap);
    await createCqiReport(cqiReportRequest({ requestId: 'report-create-201' }));
    mockGetGapAnalysis.mockResolvedValue({
      ...expandedGap,
      weakPoints: [...expandedGap.weakPoints].reverse(),
    });
    await createCqiReport(cqiReportRequest({ requestId: 'report-create-202' }));

    const createdIds = (prisma.cQIReport.create as jest.Mock).mock.calls
      .map(([input]) => input.data.id as string);
    expect(createdIds).toHaveLength(2);
    expect(createdIds[0]).toBe(createdIds[1]);
  });
});

describe('POST /api/obe/cqi/reports/[id]/action-items', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
    mockAccessibleClassIds.mockResolvedValue(['class-1']);
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('DRAFT'));
    mockGetGapAnalysis.mockResolvedValue(baseCqiGap);
    (prisma.cQIActionItem.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ role: 'TEACHER', status: 'ACTIVE' });
    (prisma.cQIActionItem.create as jest.Mock).mockImplementation(async ({ data }) => ({ ...data, status: 'PENDING' }));
    (prisma.userActivity.create as jest.Mock).mockResolvedValue({ id: 'event-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
  });

  it('requires a concrete due date', async () => {
    const request = new NextRequest('http://localhost/api/obe/cqi/reports/report-1/action-items', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'action-create-001',
        description: '组织寻址方式专项补学',
        category: 'METHOD',
      }),
    });
    const response = await createCqiAction(request, { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(400);
    expect(prisma.cQIActionItem.create).not.toHaveBeenCalled();
  });

  it('assigns a teacher-created action to that teacher', async () => {
    const request = new NextRequest('http://localhost/api/obe/cqi/reports/report-1/action-items', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'action-create-001',
        description: '组织寻址方式专项补学',
        category: 'METHOD',
        dueDate: dueDateText(),
      }),
    });
    const response = await createCqiAction(request, { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(201);
    expect(prisma.cQIActionItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedTo: 'teacher-1' }),
    });
  });

  it('keeps a historical report read-only when adding an action directly through the API', async () => {
    mockGetGapAnalysis.mockResolvedValue({ ...baseCqiGap, averageAchievement: 0.72 });
    const request = new NextRequest('http://localhost/api/obe/cqi/reports/report-1/action-items', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'action-create-002',
        description: '不得写入历史快照的行动',
        category: 'METHOD',
        dueDate: dueDateText(),
      }),
    });

    const response = await createCqiAction(request, { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      freshness: 'HISTORICAL',
      error: expect.stringContaining('历史快照'),
    });
    expect(prisma.cQIActionItem.create).not.toHaveBeenCalled();
  });

  it('restores an exact action request even after the report is submitted', async () => {
    const dueDate = dueDateText();
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('REVIEWED'));
    (prisma.cQIActionItem.findUnique as jest.Mock).mockResolvedValue({
      id: 'existing-action',
      cqiReportId: 'report-1',
      description: '组织寻址方式专项补学',
      category: 'METHOD',
      assignedTo: 'teacher-1',
      dueDate: new Date(`${dueDate}T23:59:59+08:00`),
    });
    const request = new NextRequest('http://localhost/api/obe/cqi/reports/report-1/action-items', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestId: 'action-create-001',
        description: '组织寻址方式专项补学',
        category: 'METHOD',
        dueDate,
      }),
    });
    const response = await createCqiAction(request, { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ duplicate: true });
    expect(prisma.cQIActionItem.create).not.toHaveBeenCalled();
    expect(mockGetGapAnalysis).not.toHaveBeenCalled();
  });
});

describe('PUT /api/obe/cqi/reports/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({ userId: 'teacher-1', email: 'teacher@example.com', role: 'TEACHER' });
    mockAccessibleClassIds.mockResolvedValue(['class-1']);
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('DRAFT'));
    mockGetGapAnalysis.mockResolvedValue(baseCqiGap);
    (prisma.userActivity.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.cQIActionItem.findMany as jest.Mock).mockResolvedValue([{ id: 'action-1', status: 'PENDING' }]);
    (prisma.cQIActionItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.cQIActionItem.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.cQIReport.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.userActivity.create as jest.Mock).mockResolvedValue({ id: 'event-1' });
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
  });

  it('prevents a teacher from approving a report', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('REVIEWED'));
    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'REVIEWED',
      status: 'APPROVED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(403);
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
  });

  it('submits a draft with at least one action and writes the transition receipt', async () => {
    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'DRAFT',
      status: 'REVIEWED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(200);
    expect(prisma.cQIReport.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-1', status: 'DRAFT' },
      data: { status: 'REVIEWED', reviewedBy: 'teacher-1' },
    });
    expect(prisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'UPDATE_CQI_REPORT_STATUS' }),
    }));
  });

  it('blocks status transitions on a historical report at the direct API boundary', async () => {
    mockGetGapAnalysis.mockResolvedValue({ ...baseCqiGap, passRate: 75 });

    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'DRAFT',
      status: 'REVIEWED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      freshness: 'HISTORICAL',
      error: expect.stringContaining('历史快照'),
    });
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
  });

  it('keeps a legacy report without a source descriptor unavailable and read-only', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('DRAFT', {
      previousMeasures: '["旧版改进措施"]',
    }));

    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'DRAFT',
      status: 'REVIEWED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      freshness: 'UNAVAILABLE',
      error: expect.stringContaining('缺少可核验的源快照'),
    });
    expect(mockGetGapAnalysis).not.toHaveBeenCalled();
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
  });

  it('does not allow an action item from another report to be updated', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'item-from-other-report',
      expectedActionStatus: 'PENDING',
      actionStatus: 'IN_PROGRESS',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(404);
    expect(prisma.cQIActionItem.updateMany).not.toHaveBeenCalled();
  });

  it('advances an assigned action by one state while the report is approved', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    (prisma.cQIActionItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'action-1',
      status: 'PENDING',
      assignedTo: 'teacher-1',
    });
    (prisma.cQIActionItem.findUnique as jest.Mock).mockResolvedValue({ id: 'action-1', status: 'IN_PROGRESS' });
    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'action-1',
      expectedActionStatus: 'PENDING',
      actionStatus: 'IN_PROGRESS',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(200);
    expect(prisma.cQIActionItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'action-1', cqiReportId: 'report-1', status: 'PENDING' },
      data: { status: 'IN_PROGRESS' },
    });
    expect(prisma.userActivity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'UPDATE_CQI_ACTION_STATUS' }),
    }));
  });

  it('requires a result summary and evidence reference before completing an action', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));

    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'action-1',
      expectedActionStatus: 'IN_PROGRESS',
      actionStatus: 'COMPLETED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('结果摘要') });
    expect(prisma.cQIActionItem.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ['任务已完成', 'EXP-2026-0001', '结果摘要'],
    ['已完成补弱实践并复核记录', 'javascript:alert(1)', '证据引用'],
  ])('rejects a non-verifiable completion payload: %s / %s', async (resultSummary, evidenceReference, errorPart) => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));

    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'action-1',
      expectedActionStatus: 'IN_PROGRESS',
      actionStatus: 'COMPLETED',
      resultSummary,
      evidenceReference,
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining(errorPart) });
    expect(prisma.cQIActionItem.updateMany).not.toHaveBeenCalled();
  });

  it('stores a structured completion result with a validated platform record reference', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    (prisma.cQIActionItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'action-1',
      status: 'IN_PROGRESS',
      assignedTo: 'teacher-1',
      result: null,
    });
    (prisma.cQIActionItem.findUnique as jest.Mock).mockResolvedValue({ id: 'action-1', status: 'COMPLETED' });

    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'action-1',
      expectedActionStatus: 'IN_PROGRESS',
      actionStatus: 'COMPLETED',
      resultSummary: '已完成寻址方式补弱练习并复核全部测试记录',
      evidenceReference: 'EXP-2026-0001',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(200);
    const update = (prisma.cQIActionItem.updateMany as jest.Mock).mock.calls[0]?.[0];
    expect(update).toMatchObject({
      where: { id: 'action-1', cqiReportId: 'report-1', status: 'IN_PROGRESS' },
      data: { status: 'COMPLETED', result: expect.any(String) },
    });
    expect(JSON.parse(update.data.result)).toEqual({
      schema: 'CQI_ACTION_RESULT_V1',
      summary: '已完成寻址方式补弱练习并复核全部测试记录',
      evidenceReference: 'EXP-2026-0001',
    });
  });

  it('lets an authorized owner supplement evidence for a legacy completed result', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    (prisma.cQIActionItem.findFirst as jest.Mock).mockResolvedValue({
      id: 'action-1',
      status: 'COMPLETED',
      assignedTo: 'teacher-1',
      result: '旧版完成说明',
    });
    (prisma.cQIActionItem.findUnique as jest.Mock).mockResolvedValue({ id: 'action-1', status: 'COMPLETED' });

    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'action-1',
      expectedActionStatus: 'COMPLETED',
      actionStatus: 'COMPLETED',
      resultSummary: '旧版完成说明，现已补充复核范围',
      evidenceReference: '/simulation/exp02?record=legacy-1',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(200);
    expect(prisma.cQIActionItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'COMPLETED', result: '旧版完成说明' }),
      data: expect.objectContaining({ status: 'COMPLETED', result: expect.stringContaining('CQI_ACTION_RESULT_V1') }),
    }));
  });

  it('refuses to close a report when a completed legacy action lacks explicit evidence', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    (prisma.cQIActionItem.findMany as jest.Mock).mockResolvedValue([
      { id: 'action-1', status: 'COMPLETED', result: '旧版完成说明' },
    ]);

    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'APPROVED',
      status: 'CLOSED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: '仍有改进项缺少结果摘要或有效证据引用，不能关闭报告' });
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
  });

  it('closes a report only when every completed action has structured evidence', async () => {
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    (prisma.cQIActionItem.findMany as jest.Mock).mockResolvedValue([{
      id: 'action-1',
      status: 'COMPLETED',
      result: JSON.stringify({
        schema: 'CQI_ACTION_RESULT_V1',
        summary: '已完成专项补弱并核对仿真实验记录',
        evidenceReference: 'EXP-2026-0001',
      }),
    }]);

    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'APPROVED',
      status: 'CLOSED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(200);
    expect(prisma.cQIReport.updateMany).toHaveBeenCalledWith({
      where: { id: 'report-1', status: 'APPROVED' },
      data: { status: 'CLOSED', reviewedBy: undefined },
    });
  });

  it('rejects a backward action transition', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('APPROVED'));
    const response = await updateCqiReport(reportUpdateRequest({
      actionItemId: 'action-1',
      expectedActionStatus: 'COMPLETED',
      actionStatus: 'PENDING',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(409);
    expect(prisma.cQIActionItem.updateMany).not.toHaveBeenCalled();
  });

  it('prevents a teacher from changing a classless report', async () => {
    (prisma.cQIReport.findUnique as jest.Mock).mockResolvedValue(currentCqiReport('DRAFT', { classId: null }));
    const response = await updateCqiReport(reportUpdateRequest({
      expectedStatus: 'DRAFT',
      status: 'REVIEWED',
    }), { params: Promise.resolve({ id: 'report-1' }) });

    expect(response.status).toBe(403);
    expect(prisma.cQIReport.updateMany).not.toHaveBeenCalled();
  });
});
