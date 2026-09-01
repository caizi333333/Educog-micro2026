import React from 'react';
import { NextRequest } from 'next/server';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OBEAdminPage from '@/app/obe/admin/page';
import { GET as getClassComparison } from '@/app/api/obe/admin/class-comparison/route';
import { GET as getSchoolSummary } from '@/app/api/obe/admin/school-summary/route';
import { useAuth } from '@/contexts/AuthContext';
import { fetchClientRequest } from '@/lib/client-fetch';
import { verifyToken } from '@/lib/auth';
import { getClassAchievementStats } from '@/lib/achievement-evaluation';
import { prisma } from '@/lib/prisma';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/auth-storage', () => ({ getStoredAccessToken: () => 'admin-token' }));
jest.mock('@/lib/client-fetch', () => ({
  CLIENT_READ_TIMEOUT_MS: 15_000,
  ClientRequestTimeoutError: class ClientRequestTimeoutError extends Error {},
  fetchClientRequest: jest.fn(),
}));
jest.mock('@/lib/auth', () => ({ verifyToken: jest.fn() }));
jest.mock('@/lib/achievement-evaluation', () => ({ getClassAchievementStats: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    classGroup: { findMany: jest.fn() },
    classEnrollment: { findMany: jest.fn() },
    graduationRequirementAchievement: { findMany: jest.fn() },
  },
}));
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    return <a href={String(href)} {...props}>{children}</a>;
  };
});
jest.mock('lucide-react', () => {
  const ReactRuntime = require('react');
  const Icon = (props: Record<string, unknown>) => ReactRuntime.createElement('svg', props);
  return {
    AlertTriangle: Icon,
    BarChart4: Icon,
    CheckCircle2: Icon,
    GraduationCap: Icon,
    LayoutGrid: Icon,
    Loader2: Icon,
    Shield: Icon,
    Target: Icon,
    Users: Icon,
  };
});
jest.mock('recharts', () => {
  const ReactRuntime = require('react');
  const ChartPart = ({ children }: { children?: React.ReactNode }) => ReactRuntime.createElement('div', null, children);
  return {
    BarChart: ChartPart,
    Bar: ChartPart,
    XAxis: ChartPart,
    YAxis: ChartPart,
    CartesianGrid: ChartPart,
    ResponsiveContainer: ChartPart,
    Tooltip: ChartPart,
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetchClientRequest = fetchClientRequest as jest.MockedFunction<typeof fetchClientRequest>;
const mockVerifyToken = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockGetClassStats = getClassAchievementStats as jest.MockedFunction<typeof getClassAchievementStats>;

const adminUser = {
  id: 'admin-1',
  username: 'admin',
  email: 'admin@example.com',
  name: '管理员',
  role: 'ADMIN' as const,
};

const demoProvenance = {
  mode: 'DEMO',
  label: '演示数据',
  note: '当前为竞赛功能演示环境，不用于证明教学成效。',
} as const;

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function classBody(overrides: Record<string, unknown> = {}) {
  return {
    dataProvenance: demoProvenance,
    semester: '2025-2026-2',
    totalClasses: 1,
    totalStudents: 20,
    classes: [{
      classId: 'class-1',
      className: '微机原理一班',
      studentCount: 20,
      hasCORecords: true,
      hasIPRecords: true,
      avgCOAchievement: 0.72,
      avgIPAchievement: 0.7,
      coPassRate: 50,
      ipPassRate: 75,
    }],
    failedClasses: [],
    partial: false,
    ...overrides,
  };
}

function summaryBody(overrides: Record<string, unknown> = {}) {
  return {
    dataProvenance: demoProvenance,
    semester: '2025-2026-2',
    availableSemesters: ['2025-2026-2'],
    totalClasses: 1,
    totalStudents: 20,
    averageAchievement: 0.7,
    passRateByGR: [],
    ...overrides,
  };
}

describe('OBE admin page data-source states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/obe/admin?semester=2025-2026-2&source=review');
    mockUseAuth.mockReturnValue({ user: adminUser, loading: false } as ReturnType<typeof useAuth>);
    mockFetchClientRequest.mockImplementation(async (input) => {
      const url = String(input);
      return url.includes('class-comparison')
        ? response(classBody())
        : response(summaryBody());
    });
  });

  it('waits for authentication before deciding access or starting requests', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    render(<OBEAdminPage />);

    expect(screen.getByText('正在核验访问权限')).toBeInTheDocument();
    expect(screen.queryByText('仅管理员可访问此页面')).not.toBeInTheDocument();
    expect(mockFetchClientRequest).not.toHaveBeenCalled();
  });

  it('restores one URL semester for both sources and preserves percentage-point pass rates', async () => {
    render(<OBEAdminPage />);

    expect(await screen.findByRole('combobox', { name: '统计学期' })).toHaveValue('2025-2026-2');
    await waitFor(() => expect(mockFetchClientRequest).toHaveBeenCalledTimes(2));
    const urls = mockFetchClientRequest.mock.calls.map(([input]) => String(input));
    expect(urls).toEqual(expect.arrayContaining([
      '/api/obe/admin/class-comparison?semester=2025-2026-2',
      '/api/obe/admin/school-summary?semester=2025-2026-2',
    ]));
    expect(urls.every((url) => url.includes('semester=2025-2026-2'))).toBe(true);
    expect(window.location.search).toContain('source=review');
    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(screen.queryByText('7500%')).not.toBeInTheDocument();
    expect(screen.getByText('演示数据 · DEMO')).toBeInTheDocument();
    expect(screen.getByText(/仅用于验证汇总流程与界面/)).toBeInTheDocument();
  });

  it('keeps a successful empty summary visible when the class source fails', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => {
      if (String(input).includes('class-comparison')) throw new TypeError('network lost');
      return response(summaryBody());
    });

    render(<OBEAdminPage />);

    expect(await screen.findByText('网络连接失败，请检查网络后重试')).toBeInTheDocument();
    expect(screen.getByText('该学期尚无毕业要求达成记录')).toBeInTheDocument();
    expect(screen.getByText('班级数').previousElementSibling).toHaveTextContent('—');
  });

  it('does not convert a malformed successful response into zero metrics', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => (
      String(input).includes('class-comparison')
        ? response({ dataProvenance: demoProvenance, classes: [] })
        : response(summaryBody())
    ));

    render(<OBEAdminPage />);

    expect(await screen.findByText('班级对比返回格式异常，请重试')).toBeInTheDocument();
    expect(screen.getByText('班级数').previousElementSibling).toHaveTextContent('—');
    expect(screen.getByText('该学期尚无毕业要求达成记录')).toBeInTheDocument();
  });

  it('blocks source metrics when the server data identity is missing', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => (
      String(input).includes('class-comparison')
        ? response(classBody({ dataProvenance: undefined }))
        : response(summaryBody())
    ));

    render(<OBEAdminPage />);

    expect(await screen.findByText('班级对比缺少有效的服务端数据身份，已停止展示成效数值')).toBeInTheDocument();
    expect(screen.getByText('班级数').previousElementSibling).toHaveTextContent('—');
    expect(screen.queryByText('微机原理一班')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录核验' })).toHaveAttribute('href', expect.stringContaining('/login?from='));
  });

  it('blocks both sources when their server data identities disagree', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => (
      String(input).includes('class-comparison')
        ? response(classBody())
        : response(summaryBody({
          dataProvenance: {
            mode: 'REAL',
            label: '真实教学数据',
            note: '仅汇总正式教学记录。',
          },
        }))
    ));

    render(<OBEAdminPage />);

    expect(await screen.findByText('两个汇总数据源的身份不一致')).toBeInTheDocument();
    expect(screen.getByText('班级数').previousElementSibling).toHaveTextContent('—');
    expect(screen.queryByText('微机原理一班')).not.toBeInTheDocument();
  });

  it('keeps a genuine empty class result when the school summary fails', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => (
      String(input).includes('class-comparison')
        ? response(classBody({ totalClasses: 0, totalStudents: 0, classes: [] }))
        : response({ error: '毕业要求汇总暂不可用' }, 503)
    ));

    render(<OBEAdminPage />);

    expect(await screen.findByText('该学期暂无启用班级')).toBeInTheDocument();
    expect(screen.getByText('毕业要求汇总暂不可用')).toBeInTheDocument();
    expect(screen.getByText('班级数').previousElementSibling).toHaveTextContent('0');
  });

  it('shows reported class failures instead of folding them into an empty result', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => {
      if (String(input).includes('class-comparison')) {
        return response(classBody({
          totalClasses: 1,
          totalStudents: 18,
          classes: [],
          failedClasses: [{ classId: 'class-2', className: '微机原理二班', reason: '该班级达成度读取失败，请重试' }],
          partial: true,
        }));
      }
      return response(summaryBody());
    });

    render(<OBEAdminPage />);

    expect(await screen.findByText(/1 个班级读取失败/)).toBeInTheDocument();
    expect(screen.getByText(/微机原理二班：该班级达成度读取失败/)).toBeInTheDocument();
    expect(screen.getByText('当前没有班级成功返回，请根据失败原因重试')).toBeInTheDocument();
  });

  it('offers login recovery for a source-level authorization failure', async () => {
    mockFetchClientRequest.mockImplementation(async (input) => (
      String(input).includes('class-comparison')
        ? response({ error: '未授权' }, 401)
        : response(summaryBody())
    ));

    render(<OBEAdminPage />);

    const login = await screen.findByRole('link', { name: '重新登录' });
    expect(login).toHaveAttribute('href', expect.stringContaining('/login?from='));
    expect(screen.getByText('该学期尚无毕业要求达成记录')).toBeInTheDocument();
  });

  it('updates the URL and both requests when the semester changes', async () => {
    render(<OBEAdminPage />);
    const semesterSelect = await screen.findByRole('combobox', { name: '统计学期' });
    await waitFor(() => expect(mockFetchClientRequest).toHaveBeenCalledTimes(2));

    fireEvent.change(semesterSelect, { target: { value: '2025-2026-1' } });

    await waitFor(() => {
      expect(window.location.search).toContain('semester=2025-2026-1');
      expect(mockFetchClientRequest.mock.calls.filter(([input]) => String(input).includes('semester=2025-2026-1'))).toHaveLength(2);
    });
    expect(window.location.search).toContain('source=review');
  });
});

describe('OBE admin aggregation APIs', () => {
  const headers = { authorization: 'Bearer valid-token' };
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockVerifyToken.mockResolvedValue({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    (prisma.classEnrollment.findMany as jest.Mock).mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => ({ userId: `student-${index + 1}` })),
    );
  });

  afterEach(() => consoleError.mockRestore());

  it('requires an explicit valid semester', async () => {
    const responseWithoutSemester = await getClassComparison(new NextRequest(
      'http://localhost/api/obe/admin/class-comparison',
      { headers },
    ));

    expect(responseWithoutSemester.status).toBe(400);
    expect(prisma.classGroup.findMany).not.toHaveBeenCalled();
  });

  it('returns successful classes and explicit failures from one semester', async () => {
    (prisma.classGroup.findMany as jest.Mock).mockResolvedValue([
      { id: 'class-1', name: '一班', _count: { enrollments: 20 } },
      { id: 'class-2', name: '二班', _count: { enrollments: 18 } },
    ]);
    mockGetClassStats.mockImplementation(async (classId) => {
      if (classId === 'class-2') throw new Error('database internals must stay private');
      return {
        classId: 'class-1',
        className: '一班',
        studentCount: 20,
        configurationUpdatedAt: null,
        averageAchievementByCO: [{ coCode: 'CO1', coName: '目标1', avg: 0.7, passRate: 50 }],
        averageAchievementByIP: [{ ipCode: '1.1', ipName: '指标点1', avg: 0.72, passRate: 75 }],
      };
    });

    const apiResponse = await getClassComparison(new NextRequest(
      'http://localhost/api/obe/admin/class-comparison?semester=2025-2026-2',
      { headers },
    ));
    const body = await apiResponse.json();

    expect(apiResponse.status).toBe(200);
    expect(prisma.classGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'ACTIVE', semester: '2025-2026-2' },
    }));
    expect(mockGetClassStats).toHaveBeenCalledTimes(2);
    expect(mockGetClassStats).toHaveBeenNthCalledWith(1, 'class-1', '2025-2026-2');
    expect(mockGetClassStats).toHaveBeenNthCalledWith(2, 'class-2', '2025-2026-2');
    expect(body.classes).toHaveLength(1);
    expect(body.dataProvenance).toEqual(expect.objectContaining({
      mode: expect.stringMatching(/^(DEMO|REAL|MIXED)$/),
      label: expect.any(String),
      note: expect.any(String),
    }));
    expect(body.classes[0]).toEqual(expect.objectContaining({ coPassRate: 50, ipPassRate: 75 }));
    expect(body.failedClasses).toEqual([expect.objectContaining({ classId: 'class-2', className: '二班' })]);
    expect(JSON.stringify(body)).not.toContain('database internals');
    expect(body.partial).toBe(true);
  });

  it('scopes the school summary to selected classes and reports percentage points', async () => {
    (prisma.classGroup.findMany as jest.Mock).mockResolvedValue([
      { id: 'class-1', semester: '2025-2026-2', _count: { enrollments: 20 } },
      { id: 'class-old', semester: '2025-2026-1', _count: { enrollments: 18 } },
    ]);
    (prisma.graduationRequirementAchievement.findMany as jest.Mock).mockResolvedValue([
      {
        achievementDegree: 0.8,
        passed: true,
        indicatorPoint: { graduationRequirement: { code: 'GR1', name: '工程知识' } },
      },
      {
        achievementDegree: 0.6,
        passed: false,
        indicatorPoint: { graduationRequirement: { code: 'GR1', name: '工程知识' } },
      },
    ]);

    const apiResponse = await getSchoolSummary(new NextRequest(
      'http://localhost/api/obe/admin/school-summary?semester=2025-2026-2',
      { headers },
    ));
    const body = await apiResponse.json();

    expect(apiResponse.status).toBe(200);
    expect(prisma.graduationRequirementAchievement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { semester: '2025-2026-2', classId: { in: ['class-1'] } },
    }));
    expect(body).toEqual(expect.objectContaining({
      dataProvenance: expect.objectContaining({
        mode: expect.stringMatching(/^(DEMO|REAL|MIXED)$/),
        label: expect.any(String),
        note: expect.any(String),
      }),
      semester: '2025-2026-2',
      availableSemesters: ['2025-2026-2', '2025-2026-1'],
      totalClasses: 1,
      totalStudents: 20,
      averageAchievement: 0.7,
    }));
    expect(body.passRateByGR).toEqual([
      expect.objectContaining({ grCode: 'GR1', passRate: 50, avgAchievement: 0.7 }),
    ]);
  });
});
