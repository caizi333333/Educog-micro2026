import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OBEStudentPage from '@/app/obe/page';
import CQIPage from '@/app/obe/teacher/cqi/page';

const mockFetchClientRequest = jest.fn();
const mockLogout = jest.fn();
const mockUser = {
  id: 'student-1',
  username: 'student-1',
  email: 'student@example.com',
  name: '学生甲',
  role: 'STUDENT',
};
const mockTeacher = {
  id: 'teacher-1',
  username: 'teacher-1',
  email: 'teacher@example.com',
  name: '教师甲',
  role: 'TEACHER',
};
const mockAdmin = {
  id: 'admin-1',
  username: 'admin-1',
  email: 'admin@example.com',
  name: '管理员甲',
  role: 'ADMIN',
};
const demoProvenance = {
  mode: 'DEMO',
  label: '演示数据',
  note: '当前为竞赛功能演示环境，不用于证明教学成效。',
} as const;
const currentCqiSnapshot = {
  freshness: 'CURRENT',
  sourceDigest: 'a'.repeat(64),
  currentSourceDigest: 'a'.repeat(64),
  sourceCutoff: '2026-08-26T00:00:00.000Z',
  sourceSummary: {
    actualRecords: 40,
    expectedRecords: 40,
    totalStudents: 20,
    passedStudents: 11,
    totalIndicators: 2,
    passedIndicators: 1,
    averageAchievement: 0.62,
    passRate: 55,
    configurationUpdatedAt: null,
  },
  currentDataStatus: {
    dataSufficient: true,
    actualRecords: 40,
    expectedRecords: 40,
    totalStudents: 20,
    totalIndicators: 2,
  },
  note: '该报告与当前服务端达成度源摘要一致。',
} as const;
let activeUser: typeof mockUser | typeof mockTeacher | typeof mockAdmin | null = mockUser;
let authLoading = false;
let storedToken: string | null = 'valid-token';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: activeUser,
    loading: authLoading,
    logout: mockLogout,
  }),
}));

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: () => storedToken,
}));

jest.mock('@/lib/client-fetch', () => ({
  CLIENT_READ_TIMEOUT_MS: 10_000,
  CLIENT_WRITE_TIMEOUT_MS: 20_000,
  fetchClientRequest: (...args: unknown[]) => mockFetchClientRequest(...args),
  isAmbiguousClientFailure: (error: unknown) => error instanceof TypeError,
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
    BookOpen: Icon,
    ArrowRight: Icon,
    AlertTriangle: Icon,
    CheckCircle2: Icon,
    ChevronDown: Icon,
    ChevronUp: Icon,
    ClipboardList: Icon,
    FileText: Icon,
    Loader2: Icon,
    Lock: Icon,
    Plus: Icon,
    RefreshCw: Icon,
    RefreshCcw: Icon,
    Send: Icon,
    ShieldCheck: Icon,
    Target: Icon,
    TrendingUp: Icon,
    XCircle: Icon,
  };
});

jest.mock('recharts', () => {
  const ReactRuntime = require('react');
  const ChartPart = ({ children }: { children?: React.ReactNode }) => ReactRuntime.createElement('div', null, children);
  return {
    RadarChart: ChartPart,
    Radar: ChartPart,
    PolarGrid: ChartPart,
    PolarAngleAxis: ChartPart,
    PolarRadiusAxis: ChartPart,
    ResponsiveContainer: ChartPart,
    Tooltip: ChartPart,
  };
});

function progressResponse({
  expectedCourseObjectiveRecords,
  freshCourseObjectiveRecords,
  missingCourseObjectiveRecords,
  expectedIndicatorRecords,
  freshIndicatorRecords,
  missingIndicatorRecords,
}: {
  expectedCourseObjectiveRecords: number;
  freshCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  expectedIndicatorRecords: number;
  freshIndicatorRecords: number;
  missingIndicatorRecords: number;
}) {
  return {
    dataProvenance: { mode: 'DEMO', label: '演示数据', note: '用于测试的数据身份说明' },
    asOf: '2026-08-26T00:00:00.000Z',
    sampleSize: {
      students: 1,
      courseObjectiveRecords: freshCourseObjectiveRecords,
      indicatorRecords: freshIndicatorRecords,
    },
    courseObjectives: [],
    indicatorPoints: [],
    overallPassedCount: 0,
    overallTotalCount: 0,
    dataStatus: {
      semester: '2026-2027-1',
      semesterSource: 'ACTIVE_CLASS',
      classId: 'class-1',
      className: '微机原理1班',
      classScopeSource: 'ACTIVE_CLASS',
      availableClasses: [{ classId: 'class-1', className: '微机原理1班', semester: '2026-2027-1' }],
      configurationRevision: 'revision-1',
      configurationUpdatedAt: null,
      expectedCourseObjectiveRecords,
      freshCourseObjectiveRecords,
      staleCourseObjectiveRecords: 0,
      missingCourseObjectiveRecords,
      expectedIndicatorRecords,
      freshIndicatorRecords,
      staleIndicatorRecords: 0,
      missingIndicatorRecords,
      complete: false,
      lastCalculatedAt: null,
    },
  };
}

function respondWith(body: unknown): void {
  mockFetchClientRequest.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  });
}

describe('OBE student incomplete-result states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeUser = mockUser;
    authLoading = false;
    storedToken = 'valid-token';
    window.history.replaceState({}, '', '/obe');
  });

  it('does not describe an unconfigured zero expectation as missing zero records', async () => {
    respondWith(progressResponse({
      expectedCourseObjectiveRecords: 0,
      freshCourseObjectiveRecords: 0,
      missingCourseObjectiveRecords: 0,
      expectedIndicatorRecords: 0,
      freshIndicatorRecords: 0,
      missingIndicatorRecords: 0,
    }));

    render(<OBEStudentPage />);

    const courseStatus = (await screen.findByText('课程目标记录')).parentElement;
    const indicatorStatus = screen.getByText('指标点记录').parentElement;
    expect(courseStatus).toHaveTextContent('N/A');
    expect(courseStatus).toHaveTextContent('尚无当前版本记录（待教师复算）');
    expect(indicatorStatus).toHaveTextContent('N/A');
    expect(indicatorStatus).toHaveTextContent('尚无当前版本记录（待教师复算）');
    expect(screen.queryByText('缺少 0 条')).not.toBeInTheDocument();
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();
  });

  it('keeps the missing-record count when a positive expectation is configured', async () => {
    respondWith(progressResponse({
      expectedCourseObjectiveRecords: 2,
      freshCourseObjectiveRecords: 1,
      missingCourseObjectiveRecords: 1,
      expectedIndicatorRecords: 3,
      freshIndicatorRecords: 2,
      missingIndicatorRecords: 1,
    }));

    render(<OBEStudentPage />);

    const courseStatus = (await screen.findByText('课程目标记录')).parentElement;
    const indicatorStatus = screen.getByText('指标点记录').parentElement;
    expect(courseStatus).toHaveTextContent('1/2');
    expect(courseStatus).toHaveTextContent('缺少 1 条');
    expect(indicatorStatus).toHaveTextContent('2/3');
    expect(indicatorStatus).toHaveTextContent('缺少 1 条');
  });

  it('does not request or render student outcomes while authentication is hydrating', () => {
    authLoading = true;

    render(<OBEStudentPage />);

    expect(screen.getByText('正在核验访问权限')).toBeInTheDocument();
    expect(screen.queryByText('毕业要求达成')).not.toBeInTheDocument();
    expect(mockFetchClientRequest).not.toHaveBeenCalled();
  });

  it('preserves class scope and hash when a signed-out user goes to login', () => {
    activeUser = null;
    window.history.replaceState({}, '', '/obe?classId=class-1&semester=2026-2027-1#co-1');

    render(<OBEStudentPage />);

    expect(screen.getByRole('link', { name: '前往登录' })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/obe?classId=class-1&semester=2026-2027-1#co-1')}`,
    );
    expect(mockFetchClientRequest).not.toHaveBeenCalled();
  });

  it.each([
    ['TEACHER', '/obe/teacher', '前往教学达成度看板'],
    ['ADMIN', '/obe/admin', '前往达成度管理'],
  ] as const)('routes a %s direct URL without requesting student outcomes', (role, destination, action) => {
    activeUser = role === 'TEACHER' ? mockTeacher : mockAdmin;

    render(<OBEStudentPage />);

    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', destination);
    expect(mockFetchClientRequest).not.toHaveBeenCalled();
  });

  it.each([401, 403] as const)('clears outcomes and preserves the full URL after a %s', async (status) => {
    window.history.replaceState({}, '', '/obe?classId=class-1&semester=2026-2027-1#co-1');
    mockFetchClientRequest.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error: status === 401 ? '令牌失效' : '越权访问' }),
    } as Response);

    render(<OBEStudentPage />);

    const action = status === 401 ? '重新登录' : '切换学生账号';
    expect(await screen.findByRole('link', { name: action })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/obe?classId=class-1&semester=2026-2027-1#co-1')}${status === 403 ? '&reason=student-role' : ''}`,
    );
    expect(mockLogout).not.toHaveBeenCalled();
    expect(screen.queryByText('毕业要求达成率')).not.toBeInTheDocument();
  });
});

describe('CQI ambiguous write recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activeUser = mockTeacher;
    authLoading = false;
    storedToken = 'valid-token';
    window.history.replaceState({}, '', '/obe/teacher/cqi');
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'cqi-request-fixed'),
    });
  });

  it('locks writes after two ambiguous attempts and manually replays the exact original request', async () => {
    let writeCount = 0;
    mockFetchClientRequest.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            classes: [{ id: 'class-1', name: '微机原理一班', semester: '2025-2026-2', _count: { enrollments: 20 } }],
          }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports?classId=class-1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ dataProvenance: demoProvenance, reports: [] }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports') {
        writeCount += 1;
        if (writeCount <= 3) throw new TypeError('Failed to fetch');
        return {
          ok: true,
          status: 200,
          json: async () => ({ duplicate: true, report: { id: 'report-existing' } }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CQIPage />);

    const generateButton = await screen.findByRole('button', { name: '生成报告' });
    await waitFor(() => expect(generateButton).toBeEnabled());
    expect(screen.getByText('演示数据 · DEMO')).toBeInTheDocument();
    expect(screen.getByText(/仅用于验证持续改进流程与界面/)).toBeInTheDocument();
    fireEvent.click(generateButton);

    const confirmation = await screen.findByRole('alertdialog', { name: '确认生成持续改进报告' });
    expect(confirmation).toHaveTextContent('微机原理一班 · 2025-2026-2 · 指标点达成度报告');
    expect(confirmation).toHaveTextContent('数据不足时不会生成');
    expect(mockFetchClientRequest.mock.calls.filter(([input]) => String(input) === '/api/obe/cqi/reports')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '确认生成报告' }));

    const retryButton = await screen.findByRole('button', { name: '使用原请求核对/重试' });
    expect(screen.getByText(/请求编号和请求内容保持不变/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^班级范围/ })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /^报告学期/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '结果待核对' })).toBeDisabled();

    const writeCallsBeforeRetry = mockFetchClientRequest.mock.calls
      .filter(([input]) => String(input) === '/api/obe/cqi/reports');
    expect(writeCallsBeforeRetry).toHaveLength(2);
    expect(writeCallsBeforeRetry[1]?.[1]).toEqual(writeCallsBeforeRetry[0]?.[1]);
    const originalBody = String((writeCallsBeforeRetry[0]?.[1] as RequestInit).body);
    expect(JSON.parse(originalBody)).toMatchObject({ requestId: 'cqi-request-fixed', classId: 'class-1' });

    fireEvent.click(retryButton);

    expect(await screen.findByText(/结果仍未确认/)).toBeInTheDocument();
    const writesAfterUncertainRetry = mockFetchClientRequest.mock.calls
      .filter(([input]) => String(input) === '/api/obe/cqi/reports');
    expect(writesAfterUncertainRetry).toHaveLength(3);
    expect(writesAfterUncertainRetry[2]?.[1]).toEqual(writesAfterUncertainRetry[0]?.[1]);
    expect(String((writesAfterUncertainRetry[2]?.[1] as RequestInit).body)).toBe(originalBody);

    fireEvent.click(screen.getByRole('button', { name: '使用原请求核对/重试' }));

    expect(await screen.findByText('已使用原请求核对：服务端已有对应源快照报告，未重复创建')).toBeInTheDocument();
    const allWriteCalls = mockFetchClientRequest.mock.calls
      .filter(([input]) => String(input) === '/api/obe/cqi/reports');
    expect(allWriteCalls).toHaveLength(4);
    expect(allWriteCalls[3]?.[1]).toEqual(allWriteCalls[0]?.[1]);
    expect(String((allWriteCalls[3]?.[1] as RequestInit).body)).toBe(originalBody);
    expect(screen.queryByRole('button', { name: '使用原请求核对/重试' })).not.toBeInTheDocument();
    await waitFor(() => expect(generateButton).toBeEnabled());
  });

  it('blocks report values and generation when the read response omits data identity', async () => {
    mockFetchClientRequest.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            classes: [{ id: 'class-1', name: '微机原理一班', semester: '2025-2026-2', _count: { enrollments: 20 } }],
          }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports?classId=class-1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            reports: [{
              id: 'report-1',
              semester: '2025-2026-2',
              title: '不得显示的成效报告',
              reportType: 'INDICATOR',
              averageAchievement: 0.91,
              passRate: 90,
              totalStudents: 20,
              passedStudents: 18,
              status: 'DRAFT',
              actionItems: [],
              createdAt: '2026-08-26T00:00:00.000Z',
            }],
          }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CQIPage />);

    expect(await screen.findByText('持续改进报告缺少有效的服务端数据身份，已停止展示成效数值')).toBeInTheDocument();
    expect(screen.getByText('数据身份未通过核验')).toBeInTheDocument();
    expect(screen.queryByText('不得显示的成效报告')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成报告' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', expect.stringContaining('/login?from='));
  });

  it('labels historical and unverifiable reports explicitly and keeps both read-only', async () => {
    const historicalSnapshot = {
      ...currentCqiSnapshot,
      freshness: 'HISTORICAL',
      currentSourceDigest: 'b'.repeat(64),
      note: '当前达成度源摘要已变化；此版本保留用于追溯，只读展示。',
    } as const;
    mockFetchClientRequest.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ classes: [{ id: 'class-1', name: '微机原理一班', semester: '2025-2026-2' }] }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports?classId=class-1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dataProvenance: demoProvenance,
            reports: [
              {
                id: 'report-history',
                semester: '2025-2026-2',
                classId: 'class-1',
                title: '历史版本报告',
                reportType: 'INDICATOR',
                averageAchievement: 0.62,
                passRate: 55,
                totalStudents: 20,
                passedStudents: 11,
                status: 'DRAFT',
                snapshot: historicalSnapshot,
                actionItems: [],
                createdAt: '2026-08-25T00:00:00.000Z',
              },
              {
                id: 'report-unavailable',
                semester: '2025-2026-2',
                classId: 'class-1',
                title: '旧版未留存源摘要报告',
                reportType: 'INDICATOR',
                averageAchievement: 0.6,
                passRate: 50,
                totalStudents: 20,
                passedStudents: 10,
                status: 'DRAFT',
                actionItems: [],
                createdAt: '2026-08-24T00:00:00.000Z',
              },
            ],
          }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CQIPage />);

    expect(await screen.findByText('历史快照')).toBeInTheDocument();
    expect(screen.getByText('快照待核验')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /历史版本报告/ }));
    expect(screen.getByText('历史源快照，仅供追溯')).toBeInTheDocument();
    expect(screen.getByText(/不能新增行动、推进完成证据或流转报告状态/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加行动' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提交审阅' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /旧版未留存源摘要报告/ }));
    expect(screen.getByText('源快照暂不可核验，仅供只读查看')).toBeInTheDocument();
    expect(screen.getByText(/快照信息缺失或无效/)).toBeInTheDocument();
  });

  it('requires and submits a result summary plus evidence before marking an action complete', async () => {
    const submitted: Array<Record<string, unknown>> = [];
    const report = {
      id: 'report-1',
      semester: '2025-2026-2',
      classId: 'class-1',
      title: '寻址方式专项改进报告',
      reportType: 'INDICATOR',
      averageAchievement: 0.62,
      passRate: 55,
      totalStudents: 20,
      passedStudents: 11,
      status: 'APPROVED',
      snapshot: currentCqiSnapshot,
      actionItems: [{
        id: 'action-1',
        description: '完成 exp02 补弱实践并复核结果',
        category: 'METHOD',
        assignedTo: 'teacher-1',
        dueDate: '2026-09-30T00:00:00.000Z',
        status: 'IN_PROGRESS',
        result: null,
      }],
      createdAt: '2026-08-26T00:00:00.000Z',
    };
    mockFetchClientRequest.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ classes: [{ id: 'class-1', name: '微机原理一班', semester: '2025-2026-2' }] }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports?classId=class-1') {
        return { ok: true, status: 200, json: async () => ({ dataProvenance: demoProvenance, reports: [report] }) } as Response;
      }
      if (url === '/api/obe/cqi/reports/report-1' && init?.method === 'PUT') {
        submitted.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return { ok: true, status: 200, json: async () => ({ duplicate: false, actionItem: { id: 'action-1' } }) } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CQIPage />);

    fireEvent.click(await screen.findByRole('button', { name: /寻址方式专项改进报告/ }));
    expect(screen.getByText('当前快照')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '标记完成' }));
    const dialog = await screen.findByRole('alertdialog', { name: '确认完成改进行动' });
    const confirm = screen.getByRole('button', { name: '确认标记完成' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: /^结果摘要/ }), {
      target: { value: '已完成 exp02 补弱实践并复核全部测试记录' },
    });
    expect(confirm).toBeDisabled();
    const evidenceInput = screen.getByRole('textbox', { name: /^证据引用/ });
    fireEvent.change(evidenceInput, { target: { value: 'javascript:alert(1)' } });
    expect(confirm).toBeDisabled();
    expect(evidenceInput).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(evidenceInput, {
      target: { value: 'EXP-2026-0001' },
    });
    expect(confirm).toBeEnabled();
    expect(dialog).toHaveTextContent('结果摘要和证据引用将一并保存');
    fireEvent.click(confirm);

    expect(await screen.findByText('改进项已完成')).toBeInTheDocument();
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      actionItemId: 'action-1',
      expectedActionStatus: 'IN_PROGRESS',
      actionStatus: 'COMPLETED',
      resultSummary: '已完成 exp02 补弱实践并复核全部测试记录',
      evidenceReference: 'EXP-2026-0001',
    });
    expect(document.querySelectorAll('main')).toHaveLength(0);
    expect(document.querySelector('section[aria-labelledby="cqi-page-title"]')).toBeInTheDocument();
  });

  it('keeps a legacy plain result readable and requires evidence supplementation', async () => {
    mockFetchClientRequest.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ classes: [{ id: 'class-1', name: '微机原理一班', semester: '2025-2026-2' }] }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports?classId=class-1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dataProvenance: demoProvenance,
            reports: [{
              id: 'report-legacy',
              semester: '2025-2026-2',
              classId: 'class-1',
              title: '旧版改进报告',
              reportType: 'INDICATOR',
              averageAchievement: 0.62,
              passRate: 55,
              totalStudents: 20,
              passedStudents: 11,
              status: 'APPROVED',
              snapshot: currentCqiSnapshot,
              actionItems: [{
                id: 'action-legacy',
                description: '旧版行动项',
                category: 'METHOD',
                assignedTo: 'teacher-1',
                dueDate: '2026-09-30T00:00:00.000Z',
                status: 'COMPLETED',
                result: '旧版完成说明',
              }],
              createdAt: '2026-08-26T00:00:00.000Z',
            }],
          }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CQIPage />);

    fireEvent.click(await screen.findByRole('button', { name: /旧版改进报告/ }));
    expect(screen.getByText(/旧版完成说明/)).toBeInTheDocument();
    expect(screen.getByText(/来自旧版纯文本记录/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '补充完成证据' }));
    expect(await screen.findByRole('alertdialog', { name: '补充改进行动完成证据' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^结果摘要/ })).toHaveValue('旧版完成说明');
    expect(screen.getByRole('button', { name: '保存完成证据' })).toBeDisabled();
  });

  it('keeps report closing disabled for an administrator until every completed action is evidenced', async () => {
    activeUser = mockAdmin;
    mockFetchClientRequest.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ classes: [{ id: 'class-1', name: '微机原理一班', semester: '2025-2026-2' }] }),
        } as Response;
      }
      if (url.startsWith('/api/users?')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: [{ id: 'teacher-1', name: '教师甲', username: 'teacher-1' }] }),
        } as Response;
      }
      if (url === '/api/obe/cqi/reports?classId=class-1') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dataProvenance: demoProvenance,
            reports: [{
              id: 'report-admin',
              semester: '2025-2026-2',
              classId: 'class-1',
              title: '待关闭报告',
              reportType: 'INDICATOR',
              averageAchievement: 0.7,
              passRate: 65,
              totalStudents: 20,
              passedStudents: 13,
              status: 'APPROVED',
              snapshot: currentCqiSnapshot,
              actionItems: [{
                id: 'action-legacy',
                description: '已完成但未补证的行动',
                category: 'METHOD',
                assignedTo: 'teacher-1',
                dueDate: '2026-09-30T00:00:00.000Z',
                status: 'COMPLETED',
                result: '旧版完成说明',
              }],
              createdAt: '2026-08-26T00:00:00.000Z',
            }],
          }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<CQIPage />);

    fireEvent.click(await screen.findByRole('button', { name: /待关闭报告/ }));
    expect(screen.getByText(/仍有 1 项行动缺少结果摘要或证据引用/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭报告' })).toBeDisabled();
  });
});
