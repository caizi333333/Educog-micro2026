import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { HyperDashboard } from '@/components/hyper/HyperDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { experiments as experimentCatalog } from '@/lib/experiment-config';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/lib/auth-storage', () => ({ getStoredAccessToken: jest.fn() }));
jest.mock('@/components/onboarding/NextStepBanner', () => ({
  WelcomeOnboarding: ({ hasLearningEvidence }: { hasLearningEvidence?: boolean }) => (
    hasLearningEvidence ? null : <div data-testid="welcome-onboarding" />
  ),
}));
jest.mock('lucide-react', () => {
  const ReactRuntime = require('react');
  const MockIcon = (props: Record<string, unknown>) => ReactRuntime.createElement('svg', props);
  return new Proxy({ __esModule: true }, {
    get: (target, property) => property in target ? target[property as keyof typeof target] : MockIcon,
  });
});
jest.mock('next/link', () => function MockLink({
  children,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockGetStoredAccessToken = getStoredAccessToken as jest.MockedFunction<typeof getStoredAccessToken>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockLogout = jest.fn(async () => undefined);

const student = {
  id: 'student-1',
  username: 'student',
  name: '测试学生',
  email: 'student@example.com',
  role: 'STUDENT' as const,
};

const teacher = {
  id: 'teacher-1',
  username: 'sunyancai',
  name: '孙延才',
  email: 'teacher@example.com',
  role: 'TEACHER' as const,
};

function setAuth(user: typeof student | typeof teacher | null, loading = false): void {
  mockUseAuth.mockReturnValue({
    user,
    loading,
    login: jest.fn(),
    logout: mockLogout,
    refreshUser: jest.fn(),
    isAuthenticated: Boolean(user),
  });
}

function response(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'ERROR',
    json: async () => data,
  } as Response;
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

const validPayloads: Record<string, unknown> = {
  '/api/knowledge-graph?type=raw': { data: [] },
  '/api/experiments': { data: [] },
  '/api/experiments/save': {
    success: true,
    experiments: [{ experimentId: 'exp01', status: 'COMPLETED', timeSpent: 300 }],
  },
  '/api/learning-progress': {
    success: true,
    dataProvenance: { mode: 'DEMO', label: '演示数据', note: '竞赛功能演示记录，不用于证明教学成效。' },
    asOf: '2026-08-25T07:12:59.892Z',
    progress: [{ moduleId: 'module-1', chapterId: 'ch1', progress: 100, timeSpent: 600, status: 'COMPLETED' }],
  },
  '/api/user/stats': {
    stats: { modules_completed: 1, experiments_completed: 1, daily_streak: 3, code_runs: 2 },
  },
  '/api/achievements': {
    dataProvenance: { mode: 'DEMO', label: '演示数据', note: '竞赛功能演示记录，不用于证明教学成效。' },
    asOf: '2026-08-25T07:12:59.892Z',
    achievements: [],
    stats: { totalAchievements: 54, unlockedAchievements: 2, completionRate: 4, totalPoints: 120 },
  },
  '/api/teacher/dashboard': {
    dataProvenance: { mode: 'DEMO', label: '演示数据', note: '竞赛演示环境。' },
    overview: { totalStudents: 2, activeToday: 1, avgQuizScore: 86, avgExpCompletion: 50 },
    students: [{ quizAttemptCount: 1, experimentsTotal: 2 }],
  },
};

function installSuccessfulFetches(): void {
  mockFetch.mockImplementation(async (input) => {
    const url = requestUrl(input);
    return response(validPayloads[url]);
  });
}

function protectedUrls(): string[] {
  return mockFetch.mock.calls
    .map(([input]) => requestUrl(input))
    .filter((url) => !url.startsWith('/api/knowledge-graph') && url !== '/api/experiments');
}

describe('HyperDashboard source-owned states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoredAccessToken.mockReturnValue('valid-token');
    setAuth(student);
    installSuccessfulFetches();
  });

  it('waits for authentication hydration without painting student zero values', async () => {
    setAuth(null, true);

    render(<HyperDashboard />);

    expect(screen.getByRole('status')).toHaveTextContent('正在核对登录状态');
    expect(screen.getByRole('status')).toHaveTextContent('不显示学习或教学统计');
    expect(screen.queryByText('已完成实验')).not.toBeInTheDocument();
    await waitFor(() => expect(protectedUrls()).toEqual([]));
  });

  it('loads only student sources and renders confirmed student values', async () => {
    render(<HyperDashboard />);

    expect(await screen.findByRole('heading', { name: 'EduCog Hyper 工作台' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'EduCog Hyper 工作台' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('已完成实验').parentElement).toHaveTextContent(`1/${experimentCatalog.length}`);
    expect(screen.getByText('完成模块').parentElement).toHaveTextContent('1');
    expect(screen.getByText('连续学习').parentElement).toHaveTextContent('3 天');
    expect(screen.getByText('2/54')).toBeInTheDocument();
    expect(screen.getByText('演示数据：')).toBeInTheDocument();
    expect(screen.getByText(/当前工作台数据核对截至/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '从任务开始，按证据完成每一步' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /我的任务|查看我的学习任务/ }).some((link) => link.getAttribute('href') === '/tasks')).toBe(true);
    expect(screen.queryByTestId('welcome-onboarding')).not.toBeInTheDocument();
    expect(protectedUrls()).toEqual(expect.arrayContaining([
      '/api/experiments/save',
      '/api/learning-progress',
      '/api/user/stats',
      '/api/achievements',
    ]));
    expect(protectedUrls()).not.toContain('/api/teacher/dashboard');
  });

  it('loads only the teacher aggregate for an educator account', async () => {
    setAuth(teacher);

    render(<HyperDashboard />);

    expect(await screen.findByRole('heading', { name: '教学总览工作台' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '教学总览工作台' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('可管理学生').parentElement).toHaveTextContent('2');
    expect(screen.getByText('演示数据')).toBeInTheDocument();
    expect(protectedUrls()).toEqual(['/api/teacher/dashboard']);
    expect(screen.queryByText('已完成实验')).not.toBeInTheDocument();
  });

  it('keeps healthy sources visible and retries only the failed achievement source', async () => {
    let achievementReads = 0;
    mockFetch.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === '/api/achievements') {
        achievementReads += 1;
        return achievementReads === 1
          ? response({ error: '暂不可用' }, 503)
          : response(validPayloads[url]);
      }
      return response(validPayloads[url]);
    });

    render(<HyperDashboard />);

    expect(await screen.findByText('成就记录读取失败')).toBeInTheDocument();
    expect(screen.getByText('完成模块').parentElement).toHaveTextContent('1');
    expect(screen.queryByText('0/0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新读取成就数据' }));

    expect(await screen.findByText('2/54')).toBeInTheDocument();
    expect(protectedUrls().filter((url) => url === '/api/achievements')).toHaveLength(2);
    expect(protectedUrls().filter((url) => url === '/api/user/stats')).toHaveLength(1);
    expect(protectedUrls().filter((url) => url === '/api/learning-progress')).toHaveLength(1);
    expect(protectedUrls().filter((url) => url === '/api/experiments/save')).toHaveLength(1);
  });

  it('rejects a malformed success payload instead of normalizing it to zero', async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === '/api/user/stats') return response({ detail: 'Bad Request' });
      return response(validPayloads[url]);
    });

    render(<HyperDashboard />);

    expect(await screen.findByRole('button', { name: '重新读取用户统计' })).toBeInTheDocument();
    expect(screen.getByText('完成模块').parentElement).toHaveTextContent('—');
    expect(screen.getByText('连续学习').parentElement).toHaveTextContent('—');
    expect(screen.getByRole('button', { name: '重新读取用户统计' })).toHaveAttribute('title', '响应格式异常');
  });

  it('turns a protected-source 401 into login recovery and suppresses late data', async () => {
    let releaseExperiment!: (value: Response) => void;
    mockFetch.mockImplementation(async (input) => {
      const url = requestUrl(input);
      if (url === '/api/experiments/save') {
        return new Promise<Response>((resolve) => { releaseExperiment = resolve; });
      }
      if (url === '/api/achievements') return response({ error: '登录已过期' }, 401);
      return response(validPayloads[url]);
    });

    render(<HyperDashboard />);

    expect(await screen.findByRole('heading', { name: '需要重新登录' })).toBeInTheDocument();
    const recovery = screen.getByRole('link', { name: '重新登录并返回' });
    expect(recovery).toHaveAttribute('href', '/login?role=student&from=%2Fhyper');
    expect(screen.queryByText('已完成实验')).not.toBeInTheDocument();

    releaseExperiment(response(validPayloads['/api/experiments/save']));
    await waitFor(() => expect(screen.queryByText('已完成实验')).not.toBeInTheDocument());
    expect(within(screen.getByRole('alert')).getByText(/未展示任何用户统计/)).toBeInTheDocument();
  });
});
