import { NextRequest } from 'next/server';
import { GET } from '@/app/api/teacher/dashboard/route';
import { GET as exportTeacherData } from '@/app/api/teacher/export/route';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

jest.mock('next/server', () => {
  const NextResponse = Object.assign(
    jest.fn().mockImplementation((body, options) => ({
      status: options?.status ?? 200,
      headers: new Headers(options?.headers),
      text: jest.fn().mockResolvedValue(body ?? ''),
      json: jest.fn().mockImplementation(async () => JSON.parse(body ?? '{}')),
    })),
    {
      json: jest.fn().mockImplementation((data, options) => ({
        status: options?.status ?? 200,
        headers: new Headers(options?.headers),
        text: jest.fn().mockResolvedValue(JSON.stringify(data)),
        json: jest.fn().mockResolvedValue(data),
        data,
      })),
    },
  );

  const NextRequest = jest.fn().mockImplementation((url, options) => ({
    url,
    method: options?.method ?? 'GET',
    headers: {
      get: jest.fn().mockImplementation((key: string) => {
        const headers = options?.headers ?? {};
        return headers[key.toLowerCase()] ?? headers[key] ?? null;
      }),
    },
    text: jest.fn().mockResolvedValue(options?.body ?? ''),
    json: jest.fn().mockImplementation(async () => {
      if (!options?.body) return {};
      return typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    }),
  }));

  return { NextResponse, NextRequest };
});

jest.mock('@/lib/auth', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('@/lib/classroom', () => ({
  getAccessibleClassIds: jest.fn(),
}));

describe('/api/teacher/dashboard', () => {
  const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
  const mockGetAccessibleClassIds = getAccessibleClassIds as jest.MockedFunction<typeof getAccessibleClassIds>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyToken.mockResolvedValue({
      userId: 'teacher-1',
      email: 'teacher@example.com',
      role: 'TEACHER',
    });
    mockGetAccessibleClassIds.mockResolvedValue(['class-1']);

    const prisma = (globalThis as any).__mockPrisma;
    prisma.classEnrollment.findMany.mockResolvedValue([{
      userId: 'student-1',
      classId: 'class-1',
      classGroup: {
        id: 'class-1',
        name: '单片机 1 班',
        courseName: '单片机原理',
        semester: '2026',
      },
      user: {
        id: 'student-1',
        name: '学生甲',
        username: 'student-1',
        studentId: '2026001',
        class: '单片机 1 班',
        lastLoginAt: null,
      },
    }]);
    prisma.quizAttempt.findMany.mockResolvedValue([]);
    prisma.userExperiment.findMany.mockResolvedValue([{
      userId: 'student-1',
      experimentId: 'exp02',
      status: 'COMPLETED',
      score: 90,
    }]);
    prisma.learningProgress.findMany.mockResolvedValue([]);
    prisma.userActivity.findMany.mockResolvedValue([]);
    prisma.learningEvent.findMany.mockResolvedValue([]);
  });

  it('教师学情统计仅纳入课程正式实验', async () => {
    const prisma = (globalThis as any).__mockPrisma;
    const request = {
      headers: new Headers({ authorization: 'Bearer valid-token' }),
      url: 'http://localhost/api/teacher/dashboard',
    } as NextRequest;
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.userExperiment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: { in: ['student-1'] },
        experimentId: { in: expect.arrayContaining(['exp01', 'exp02']) },
      }),
    }));
    expect(data.students[0]).toMatchObject({
      id: 'student-1',
      avgQuizScore: 0,
      quizAttemptCount: 0,
      experimentsCompleted: 1,
      experimentsTotal: 1,
      learningProgressCount: 0,
    });
    expect(data.overview.avgExpCompletion).toBe(100);
    expect(data.overview).toMatchObject({
      quizAttemptCount: 0,
      experimentRecordCount: 1,
      learningProgressCount: 0,
    });
    expect(data.alertStudents).toEqual([]);
    expect(data.dataProvenance).toMatchObject({
      mode: 'DEMO',
      label: '演示数据',
    });
    expect(data.scope).toMatchObject({
      basis: 'ACTIVE_CLASS_ENROLLMENT',
      enrolledStudentCount: 1,
      includedStudentCount: 1,
      excludedStudentCount: 0,
      metricSamples: {
        quizStudents: 0,
        learningTimeStudents: 0,
        experimentStudents: 1,
        repeatedAttemptStudents: 0,
      },
    });
  });

  it('保留真实0分测验并与无测验记录区分', async () => {
    const prisma = (globalThis as any).__mockPrisma;
    prisma.quizAttempt.findMany.mockResolvedValue([{
      userId: 'student-1',
      quizId: 'quiz-ch3-addressing',
      score: 0,
      completedAt: new Date('2026-08-15T00:00:00.000Z'),
    }]);
    const request = {
      headers: new Headers({ authorization: 'Bearer valid-token' }),
      url: 'http://localhost/api/teacher/dashboard',
    } as NextRequest;

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.students[0]).toMatchObject({
      avgQuizScore: 0,
      quizAttemptCount: 1,
    });
    expect(data.alertStudents).toEqual([
      expect.objectContaining({ id: 'student-1', avg: 0, quizAttemptCount: 1 }),
    ]);
  });

  it('保留在册人数并明确排除专用演示账号的分析记录', async () => {
    const prisma = (globalThis as any).__mockPrisma;
    prisma.classEnrollment.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        classId: 'class-1',
        classGroup: { id: 'class-1', name: '单片机 1 班', courseName: '单片机原理', semester: '2026' },
        user: {
          id: 'student-1', name: '学生甲', username: 'student-1', studentId: '2026001',
          class: '单片机 1 班', lastLoginAt: null,
        },
      },
      {
        userId: 'demo-student',
        classId: 'class-1',
        classGroup: { id: 'class-1', name: '单片机 1 班', courseName: '单片机原理', semester: '2026' },
        user: {
          id: 'demo-student', name: '演示学生', username: 'demo_student', studentId: 'DEMO001',
          class: '单片机 1 班', lastLoginAt: null,
        },
      },
    ]);

    const response = await GET({
      headers: new Headers({ authorization: 'Bearer valid-token' }),
      url: 'http://localhost/api/teacher/dashboard?asOf=2026-08-16T08%3A00%3A00.000Z',
    } as NextRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.overview.totalStudents).toBe(2);
    expect(data.scope).toMatchObject({
      asOf: '2026-08-16T08:00:00.000Z',
      enrolledStudentCount: 2,
      includedStudentCount: 1,
      excludedStudentCount: 1,
      exclusions: [{ code: 'DEMO_ACCOUNT', count: 1 }],
    });
    expect(data.students).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'student-1', analysisEligible: true }),
      expect.objectContaining({ id: 'demo-student', analysisEligible: false }),
    ]));
    expect(prisma.quizAttempt.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: { in: ['student-1'] } }),
    }));
  });

  describe('/api/teacher/export', () => {
    const originalResearchSecret = process.env.RESEARCH_EXPORT_SECRET;

    afterEach(() => {
      if (originalResearchSecret === undefined) delete process.env.RESEARCH_EXPORT_SECRET;
      else process.env.RESEARCH_EXPORT_SECRET = originalResearchSecret;
    });

    it('教学管理模式应明确保留实名字段并限定用途', async () => {
      const prisma = (globalThis as any).__mockPrisma;
      prisma.quizAttempt.findMany.mockResolvedValue([{
        userId: 'student-1', quizId: 'quiz-ch1', score: 80,
        totalQuestions: 10, correctAnswers: 8, timeSpent: 300,
        startedAt: new Date('2026-08-15T08:00:00.000Z'),
        completedAt: new Date('2026-08-15T08:05:00.000Z'),
      }]);

      const response = await exportTeacherData(new NextRequest(
        'http://localhost/api/teacher/export?type=quiz-detail&mode=management',
        { headers: { authorization: 'Bearer valid-token' } },
      ));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Export-Mode')).toBe('management-identified');
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(body).toContain('姓名（仅限教学管理）');
      expect(body).toContain('学生甲');
      expect(body).toContain('2026001');
      expect(body).toContain('单片机 1 班');
    });

    it('研究模式应使用稳定HMAC假名并移除直接身份信息', async () => {
      process.env.RESEARCH_EXPORT_SECRET = 'research-export-test-secret-2026-at-least-32-bytes';
      const prisma = (globalThis as any).__mockPrisma;
      prisma.quizAttempt.findMany.mockResolvedValue([{
        userId: 'student-1', quizId: 'quiz-ch1', score: 80,
        totalQuestions: 10, correctAnswers: 8, timeSpent: 300,
        startedAt: new Date('2026-08-15T08:00:00.000Z'),
        completedAt: new Date('2026-08-15T08:05:00.000Z'),
      }]);
      const makeRequest = () => new NextRequest(
        'http://localhost/api/teacher/export?type=quiz-detail&mode=research',
        { headers: { authorization: 'Bearer valid-token' } },
      );

      const first = await exportTeacherData(makeRequest());
      const firstBody = await first.text();
      const second = await exportTeacherData(makeRequest());
      const secondBody = await second.text();

      expect(first.status).toBe(200);
      expect(first.headers.get('X-Export-Mode')).toBe('research-pseudonymized');
      expect(firstBody).toBe(secondBody);
      expect(firstBody).toMatch(/S-[A-F0-9]{16}/);
      expect(firstBody).toMatch(/C-[A-F0-9]{16}/);
      expect(firstBody).not.toContain('学生甲');
      expect(firstBody).not.toContain('2026001');
      expect(firstBody).not.toContain('单片机 1 班');
      expect(firstBody).not.toContain('16:00:00');
      expect(firstBody).toContain('研究编号（稳定不可逆假名）');
    });

    it('研究活动日志应对学生和班级目标编号做稳定假名化', async () => {
      process.env.RESEARCH_EXPORT_SECRET = 'research-export-test-secret-2026-at-least-32-bytes';
      const prisma = (globalThis as any).__mockPrisma;
      prisma.learningEvent.findMany.mockResolvedValue([
        {
          userId: 'student-1', eventType: 'REGISTER', targetType: 'USER', targetId: 'student-1',
          duration: null, progress: null, createdAt: new Date('2026-08-15T08:00:00.000Z'),
        },
        {
          userId: 'student-1', eventType: 'JOIN_CLASS', targetType: 'CLASS', targetId: 'class-1',
          duration: null, progress: null, createdAt: new Date('2026-08-15T08:01:00.000Z'),
        },
      ]);

      const response = await exportTeacherData(new NextRequest(
        'http://localhost/api/teacher/export?type=activity-log&mode=research',
        { headers: { authorization: 'Bearer valid-token' } },
      ));
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(body).not.toContain('student-1');
      expect(body).not.toContain('class-1');
      expect(body).toMatch(/S-[A-F0-9]{16}/);
      expect(body).toMatch(/C-[A-F0-9]{16}/);
    });

    it('研究模式缺少独立高强度密钥时应拒绝导出', async () => {
      delete process.env.RESEARCH_EXPORT_SECRET;
      const response = await exportTeacherData(new NextRequest(
        'http://localhost/api/teacher/export?type=quiz-detail&mode=research',
        { headers: { authorization: 'Bearer valid-token' } },
      ));

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: '研究匿名导出尚未配置独立密钥',
      });
    });

    it('应该拒绝未声明的导出模式', async () => {
      const response = await exportTeacherData(new NextRequest(
        'http://localhost/api/teacher/export?type=quiz-detail&mode=public',
        { headers: { authorization: 'Bearer valid-token' } },
      ));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: '导出模式必须为 management 或 research',
      });
    });
  });
});
