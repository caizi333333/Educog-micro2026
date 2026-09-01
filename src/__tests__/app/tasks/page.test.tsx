import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import MyTasksPage from '@/app/tasks/page';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Activity: Icon,
    ArrowRight: Icon,
    BookOpen: Icon,
    CheckCircle2: Icon,
    Circle: Icon,
    Clock: Icon,
    FlaskConical: Icon,
    GitBranch: Icon,
    KeyRound: Icon,
    Loader2: Icon,
    LockKeyhole: Icon,
    PauseCircle: Icon,
    RefreshCw: Icon,
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetch = jest.fn();

function graphTaskSnapshot(completed = false): unknown {
  const path = {
    id: 'path-active', name: '3.1 寻址方式专项学习任务', description: 'active',
    startedAt: '2026-07-16T00:00:00.000Z', completedAt: completed ? '2026-07-16T00:20:00.000Z' : null,
    currentModule: completed ? 1 : 0, totalModules: 1, status: completed ? 'COMPLETED' : 'ACTIVE', dataIssue: null,
    steps: [{
      stepId: 'addressing-graph', type: 'GRAPH', title: '图谱定位',
      purpose: '定位知识点', completionRule: '进入图谱并完成查看',
      href: '/knowledge-graph?node=3.1', targetId: '3.1',
      status: completed ? 'COMPLETED' : 'CURRENT', canMarkComplete: !completed,
    }],
  };
  return {
    success: true,
    data: {
      assignedExperiments: [], pausedPaths: [],
      activePaths: completed ? [] : [path],
      completedPaths: completed ? [path] : [],
      counts: { assignedExperiments: 0, activePaths: completed ? 0 : 1, completedPaths: completed ? 1 : 0, pausedPaths: 0 },
    },
  };
}

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('MyTasksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/tasks');
    mockUseRouter.mockReturnValue({ push: jest.fn() } as any);
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', email: 'student@example.com', username: 'student', name: '学生', role: 'STUDENT' },
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: true,
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => key === 'accessToken' ? 'student-token' : null),
      },
    });
    global.fetch = mockFetch as typeof fetch;
  });

  it('routes a teacher to task management without reading a student task list', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'teacher-1', email: 'teacher@example.com', username: 'teacher', name: '孙延才', role: 'TEACHER' },
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: true,
    });

    render(<MyTasksPage />);

    expect(screen.getByRole('heading', { name: '请从教学仪表板管理学生任务' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回教学仪表板/ })).toHaveAttribute('href', '/teacher');
    expect(screen.getByRole('link', { name: '查看推送记录' })).toHaveAttribute('href', '/teacher/pushed');
    expect(screen.queryByText('加入班级')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('routes an administrator away without reading a student task list', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com', username: 'admin', name: '管理员', role: 'ADMIN' },
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: true,
    });

    render(<MyTasksPage />);

    expect(screen.getByRole('heading', { name: '当前账号不使用学生任务页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /返回管理端/ })).toHaveAttribute('href', '/admin');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps a replaced path visible as paused instead of silently hiding it', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          assignedExperiments: [],
          activePaths: [],
          completedPaths: [],
          pausedPaths: [{
            id: 'path-paused',
            name: '原基础学习路径',
            description: '旧任务',
            startedAt: '2026-07-16T00:00:00.000Z',
            currentModule: 2,
            totalModules: 6,
            status: 'PAUSED',
            completedAt: null,
            dataIssue: null,
            steps: [],
          }],
          counts: {
            assignedExperiments: 0,
            activePaths: 0,
            completedPaths: 0,
            pausedPaths: 1,
          },
        },
      }),
    } as Response);

    render(<MyTasksPage />);

    expect(await screen.findByText('历史暂停路径')).toBeInTheDocument();
    expect(screen.getByText('记录已保留，展开查看')).toBeInTheDocument();
    const pausedDetails = screen.getByText('历史暂停路径').closest('details');
    const pausedSummary = screen.getByText('历史暂停路径').closest('summary');
    expect(pausedDetails).not.toHaveAttribute('open');
    fireEvent.click(pausedSummary!);
    expect(pausedDetails).toHaveAttribute('open');
    expect(screen.getByText('原基础学习路径')).toBeInTheDocument();
    expect(screen.getByText(/已完成记录保留，但当前不能继续推进/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '进入图谱定位' })).not.toBeInTheDocument();
  });

  it('keeps the current learning action ahead of experiments, completed work and paused history', async () => {
    const snapshot = graphTaskSnapshot() as {
      success: true;
      data: {
        assignedExperiments: Array<Record<string, unknown>>;
        activePaths: Array<Record<string, unknown>>;
        completedPaths: Array<Record<string, unknown>>;
        pausedPaths: Array<Record<string, unknown>>;
        counts: {
          assignedExperiments: number;
          activePaths: number;
          completedPaths: number;
          pausedPaths: number;
        };
      };
    };
    snapshot.data.assignedExperiments = [{
      experimentId: 'exp01',
      title: '课前实验',
      duration: 20,
      assignedAt: '2026-07-16T00:00:00.000Z',
      status: 'IN_PROGRESS',
      statusUpdatedAt: '2026-07-16T00:05:00.000Z',
      startedAt: '2026-07-16T00:05:00.000Z',
      completedAt: null,
      completionRule: '无故障运行至正常结束后提交。',
      href: '/simulation?experiment=exp01&from=preclass',
    }];
    snapshot.data.pausedPaths = [{
      id: 'path-paused',
      name: '旧学习路径',
      description: null,
      startedAt: '2026-07-15T00:00:00.000Z',
      currentModule: 1,
      totalModules: 3,
      status: 'PAUSED',
      completedAt: null,
      dataIssue: null,
      steps: [],
    }];
    snapshot.data.counts = {
      assignedExperiments: 1,
      activePaths: 1,
      completedPaths: 0,
      pausedPaths: 1,
    };
    mockFetch.mockResolvedValue(response(200, snapshot));

    render(<MyTasksPage />);

    const currentHeading = await screen.findByRole('heading', { name: '当前学习路径' });
    const experimentHeading = screen.getByRole('heading', { name: '课前实验任务' });
    const completedHeading = screen.getByRole('heading', { name: '完成回执与学习结果' });
    const pausedSummary = screen.getByText('历史暂停路径');
    expect(currentHeading.compareDocumentPosition(experimentHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(experimentHeading.compareDocumentPosition(completedHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(completedHeading.compareDocumentPosition(pausedSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: '进入图谱定位' })).toBeEnabled();
    expect(screen.getByRole('progressbar', { name: '3.1 寻址方式专项学习任务完成进度' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('progressbar', { name: '3.1 寻址方式专项学习任务完成进度' })).toHaveAttribute('aria-valuetext', '0/1 步，完成 0%');
    expect(screen.getByText('当前只需完成')).toBeInTheDocument();
    expect(screen.getByText(/步骤 1 · 图谱定位/)).toBeInTheDocument();
    expect(screen.getByText('图谱定位').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('按“待开始 → 进行中 → 已完成”推进；刷新或重新登录后仍以服务端状态为准。')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('继续实验')).toBeInTheDocument();
    expect(screen.getByText(/无故障运行至正常结束后提交/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /课前实验/ })).toHaveAttribute('href', '/simulation?experiment=exp01&from=preclass');
  });

  it('directs an idle student to the next available task areas', async () => {
    mockFetch.mockResolvedValue(response(200, {
      success: true,
      data: {
        assignedExperiments: [], activePaths: [], completedPaths: [], pausedPaths: [],
        counts: { assignedExperiments: 0, activePaths: 0, completedPaths: 0, pausedPaths: 0 },
      },
    }));

    render(<MyTasksPage />);

    expect(await screen.findByText('当前没有进行中的学习路径。可先完成下方课前实验，或回看最近完成任务。')).toBeInTheDocument();
  });

  it('offers a login recovery action when the task token has expired', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: '令牌无效' }),
    } as Response);

    render(<MyTasksPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('登录已过期'));
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Ftasks');
  });

  it('offers the same login recovery when a step action expires mid-session', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            assignedExperiments: [], completedPaths: [], pausedPaths: [],
            activePaths: [{
              id: 'path-active', name: '3.1 寻址方式专项学习任务', description: 'active',
              startedAt: '2026-07-16T00:00:00.000Z', completedAt: null,
              currentModule: 0, totalModules: 6, status: 'ACTIVE', dataIssue: null,
              steps: [{
                stepId: 'addressing-graph', type: 'GRAPH', title: '图谱定位',
                purpose: '定位知识点', completionRule: '进入图谱并完成查看',
                href: '/knowledge-graph?node=3.1', targetId: '3.1',
                status: 'CURRENT', canMarkComplete: true,
              }],
            }],
            counts: { assignedExperiments: 0, activePaths: 1, completedPaths: 0, pausedPaths: 0 },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: '令牌无效' }),
      } as Response);

    render(<MyTasksPage />);

    fireEvent.click(await screen.findByRole('button', { name: '确认完成本步' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('登录已过期，请重新登录'));
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Ftasks');
    expect(screen.queryByText('3.1 寻址方式专项学习任务')).not.toBeInTheDocument();
  });

  it('preserves task context and requests a student account after a 403', async () => {
    window.history.replaceState({}, '', '/tasks?batch=batch-7&step=addressing-graph#current');
    mockFetch.mockResolvedValue(response(403, { error: '禁止访问' }));

    render(<MyTasksPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('当前账号无权读取学生任务'));
    expect(screen.queryByText('3.1 寻址方式专项学习任务')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '切换学生账号' })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/tasks?batch=batch-7&step=addressing-graph#current')}&reason=student-role`,
    );
  });

  it('does not read student tasks while authentication is hydrating', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    render(<MyTasksPage />);

    expect(screen.getByRole('status')).toHaveTextContent('正在确认访问角色');
    expect(screen.queryByText('我的学习任务')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('suppresses rapid duplicate manual-step confirmations before the button rerenders', async () => {
    let taskReads = 0;
    let resolveCompletion!: (value: Response) => void;
    const pendingCompletion = new Promise<Response>((resolve) => { resolveCompletion = resolve; });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me/tasks') {
        taskReads += 1;
        return response(200, graphTaskSnapshot(taskReads > 1));
      }
      if (url === '/api/learning-path/save') return pendingCompletion;
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<MyTasksPage />);
    const submit = await screen.findByRole('button', { name: '确认完成本步' });
    act(() => {
      submit.click();
      submit.click();
    });

    expect(mockFetch.mock.calls.filter(([input]) => String(input) === '/api/learning-path/save')).toHaveLength(1);
    resolveCompletion(response(200, { success: true, currentModule: 1, status: 'COMPLETED' }));
    expect(await screen.findByRole('status')).toHaveTextContent('本步骤已完成，任务进度已更新');
  });

  it('reconciles an ambiguous completion failure against the server before asking for a retry', async () => {
    let taskReads = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me/tasks') {
        taskReads += 1;
        return response(200, graphTaskSnapshot(taskReads > 1));
      }
      if (url === '/api/learning-path/save') throw new TypeError('Failed to fetch');
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<MyTasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: '确认完成本步' }));

    expect(await screen.findByRole('status')).toHaveTextContent('服务端已确认本步骤完成，任务进度已恢复');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('3.1 寻址方式专项学习任务')).toBeInTheDocument();
  });

  it('suppresses rapid duplicate step-open receipts and keeps required navigation blocked on failure', async () => {
    let resolveOpen!: (value: Response) => void;
    const pendingOpen = new Promise<Response>((resolve) => { resolveOpen = resolve; });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me/tasks') return response(200, graphTaskSnapshot());
      if (url === '/api/learning-events/batch') return pendingOpen;
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<MyTasksPage />);
    const open = await screen.findByRole('button', { name: '进入图谱定位' });
    act(() => {
      open.click();
      open.click();
    });

    expect(mockFetch.mock.calls.filter(([input]) => String(input) === '/api/learning-events/batch')).toHaveLength(1);
    resolveOpen(response(503, { error: '学习事件回执暂不可确认' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('学习事件回执暂不可确认，请再次点击进入');
    expect(screen.getByRole('button', { name: '进入图谱定位' })).toBeEnabled();
  });

  it('rejects an incomplete 200 step-open receipt instead of navigating without evidence', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/me/tasks') return response(200, graphTaskSnapshot());
      if (url === '/api/learning-events/batch') {
        return response(200, { success: true, accepted: 0, duplicates: 0, ignored: 1 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<MyTasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: '进入图谱定位' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('学习步骤回执不完整，尚未进入学习页面，请重试');
    expect(screen.getByRole('button', { name: '进入图谱定位' })).toBeEnabled();
  });

  it('does not write an open receipt or navigate when a task entry is not executable', async () => {
    const snapshot = graphTaskSnapshot() as any;
    snapshot.data.activePaths[0].steps[0] = {
      ...snapshot.data.activePaths[0].steps[0],
      stepId: 'chapter-ch3',
      type: 'CHAPTER',
      title: '第3章 指令系统',
      href: '/courses?chapter=3',
      targetId: 'ch3',
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/me/tasks') return response(200, snapshot);
      throw new Error(`Unexpected request: ${String(input)}`);
    });

    render(<MyTasksPage />);
    fireEvent.click(await screen.findByRole('button', { name: '进入章节学习' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('学习步骤入口无效，未写入打开记录');
    expect(mockFetch.mock.calls.filter(([input]) => String(input) === '/api/learning-events/batch')).toHaveLength(0);
    expect(window.location.pathname).toBe('/tasks');
  });

  it('shows the authoritative exp02 receipt instead of labeling a fresh simulator entry as a record', async () => {
    const baseStep = {
      purpose: 'purpose', completionRule: 'rule', status: 'COMPLETED', canMarkComplete: false,
    } as const;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          assignedExperiments: [], activePaths: [], pausedPaths: [],
          completedPaths: [{
            id: 'path-completed', name: '3.1 寻址方式专项学习任务', description: 'done',
            startedAt: '2026-07-16T00:00:00.000Z', completedAt: '2026-07-16T01:00:00.000Z',
            currentModule: 6, totalModules: 6, status: 'COMPLETED', dataIssue: null,
            steps: [
              {
                ...baseStep, stepId: 'pre', type: 'QUIZ', title: '专项测评', href: '/quiz', targetId: 'quiz-ch3-addressing',
                assessmentReceipt: {
                  submittedAt: '2026-07-16T00:15:00.000Z', score: 60, weakAreas: ['3.1.1', '3.1.2'],
                },
              },
              {
                ...baseStep, stepId: 'exp', type: 'SIMULATION', title: 'exp02', href: '/simulation', targetId: 'exp02',
                receipt: {
                  verifiedAt: '2026-07-16T00:30:00.000Z',
                  coveredModes: ['立即寻址', '直接寻址', '寄存器寻址', '寄存器间接寻址', '变址寻址'],
                },
              },
              {
                ...baseStep, stepId: 'retest', type: 'RETEST', title: '再次测评', href: '/quiz', targetId: 'quiz-ch3-addressing',
                assessmentReceipt: {
                  submittedAt: '2026-07-16T00:50:00.000Z', score: 90, weakAreas: ['3.1.2'],
                },
              },
            ],
          }],
          counts: { assignedExperiments: 0, activePaths: 0, completedPaths: 1, pausedPaths: 0 },
        },
      }),
    } as Response);

    render(<MyTasksPage />);

    expect(await screen.findByText('exp02 服务端复核完成')).toBeInTheDocument();
    expect(screen.getByText('同一专项测验多次作答变化')).toBeInTheDocument();
    expect(screen.getByText('+30 分')).toBeInTheDocument();
    expect(screen.getByText(/本次已解除：/).closest('p')).toHaveTextContent('3.1.1');
    expect(screen.getByText(/仍需关注：/).closest('p')).toHaveTextContent('3.1.2');
    expect(screen.getByText(/不外推为真实教学成效/)).toBeInTheDocument();
    expect(screen.getByText(/演示数据：/)).toBeInTheDocument();
    expect(screen.getByText(/已记录寻址方式：立即寻址、直接寻址/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新进入 exp02' })).toHaveAttribute('href', '/simulation?experiment=exp02');
    expect(screen.queryByRole('link', { name: '查看 exp02 记录' })).not.toBeInTheDocument();
  });

  it('restores an exact completed task card after the async task list is rendered', async () => {
    window.history.replaceState({}, '', '/tasks#task-record-path-active');
    const scrollIntoView = jest.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    mockFetch.mockResolvedValue(response(200, graphTaskSnapshot(true)));

    render(<MyTasksPage />);

    const target = await waitFor(() => {
      const element = document.getElementById('task-record-path-active');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' }));
    expect(target).toHaveFocus();

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it('does not calculate a score change when either authoritative assessment receipt is missing', async () => {
    const baseStep = {
      purpose: 'purpose', completionRule: 'rule', status: 'COMPLETED', canMarkComplete: false,
    } as const;
    mockFetch.mockResolvedValue(response(200, {
      success: true,
      data: {
        assignedExperiments: [], activePaths: [], pausedPaths: [],
        completedPaths: [{
          id: 'path-incomplete-receipt', name: '3.1 寻址方式专项学习任务', description: 'done',
          startedAt: '2026-07-16T00:00:00.000Z', completedAt: '2026-07-16T01:00:00.000Z',
          currentModule: 6, totalModules: 6, status: 'COMPLETED', dataIssue: null,
          steps: [
            {
              ...baseStep, stepId: 'pre', type: 'QUIZ', title: '专项测评', href: '/quiz', targetId: 'quiz-ch3-addressing',
              assessmentReceipt: { submittedAt: '2026-07-16T00:15:00.000Z', score: 60, weakAreas: ['3.1.1'] },
            },
            { ...baseStep, stepId: 'exp', type: 'SIMULATION', title: 'exp02', href: '/simulation', targetId: 'exp02' },
            { ...baseStep, stepId: 'retest', type: 'RETEST', title: '再次测评', href: '/quiz', targetId: 'quiz-ch3-addressing' },
          ],
        }],
        counts: { assignedExperiments: 0, activePaths: 0, completedPaths: 1, pausedPaths: 0 },
      },
    }));

    render(<MyTasksPage />);

    expect(await screen.findByText(/数据不足：未找到同时匹配本任务记录/)).toBeInTheDocument();
    expect(screen.queryByText('分数变化')).not.toBeInTheDocument();
  });
});
