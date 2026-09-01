import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { LearningPathClient } from '@/app/learning-path/learning-path-client';
import { useAuth } from '@/contexts/AuthContext';

const mockToast = jest.fn();

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/lib/auth-storage', () => ({
  getStoredAccessToken: () => 'student-token',
}));

jest.mock('@/lib/hyper-data', () => ({
  fetchHyperJson: jest.fn(async () => ({ ok: true, status: 200, data: [] })),
  normalizeLearningProgress: jest.fn(() => []),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    AlertCircle: Icon,
    ArrowRight: Icon,
    BarChart3: Icon,
    BookOpen: Icon,
    BrainCircuit: Icon,
    CheckCircle2: Icon,
    ChevronRight: Icon,
    ClipboardCheck: Icon,
    Cpu: Icon,
    Gauge: Icon,
    GitBranch: Icon,
    GraduationCap: Icon,
    Layers3: Icon,
    Loader2: Icon,
    MonitorPlay: Icon,
    RefreshCcw: Icon,
    Route: Icon,
    Search: Icon,
    Sparkles: Icon,
    Target: Icon,
    Timer: Icon,
    Trophy: Icon,
    Zap: Icon,
  };
});

const mockFetch = jest.fn();
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

function configureFetch(serverWeakAreas: string[]): void {
  mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/experiments') return response({ success: false, data: [] });
    if (url.startsWith('/api/knowledge-graph?')) return response({ data: [] });
    if (url.startsWith('/api/user/activities?')) {
      return response({
        success: true,
        activities: [{ details: JSON.stringify({ weakAreas: serverWeakAreas }) }],
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('LearningPathClient weak-area evidence priority', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/learning-path');
    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id', username: 'student', email: 'student@example.com', name: '学生', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    storage.clear();
    localStorageMock.getItem.mockImplementation((key: string) => storage.get(key) ?? null);
    localStorageMock.setItem.mockImplementation((key: string, value: string) => { storage.set(key, value); });
    localStorageMock.removeItem.mockImplementation((key: string) => { storage.delete(key); });
    global.fetch = mockFetch as typeof fetch;
  });

  it('treats a valid weakKAs URL as an untrusted hint and uses the latest server quiz', async () => {
    configureFetch(['3.1.7']);

    render(<LearningPathClient weakKAsParam={encodeURIComponent(JSON.stringify(['3.1.1']))} />);

    expect(await screen.findByText('3.1.7')).toBeInTheDocument();
    expect(screen.queryByText('3.1.1')).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.some(([url]) => String(url).startsWith('/api/user/activities?'))).toBe(true);
  });

  it('does not let an explicit empty weakKAs URL override a non-empty server diagnosis', async () => {
    configureFetch(['3.1.7']);

    render(<LearningPathClient weakKAsParam={encodeURIComponent(JSON.stringify([]))} />);

    expect(await screen.findByText('3.1.7')).toBeInTheDocument();
    expect(screen.queryByText('没有薄弱点，建议进入综合项目训练。')).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.some(([url]) => String(url).startsWith('/api/user/activities?'))).toBe(true);
  });

  it('shows an unverified hint without generating a diagnosis when the server has no quiz record', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/experiments') return response({ success: false, data: [] });
      if (url.startsWith('/api/knowledge-graph?')) return response({ data: [] });
      if (url.startsWith('/api/user/activities?')) return response({ success: true, activities: [] });
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<LearningPathClient weakKAsParam={encodeURIComponent(JSON.stringify(['3.1.1']))} />);

    expect(await screen.findByRole('heading', { name: '还不能生成个人路径' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('收到 1 个网址或本机恢复线索');
    expect(screen.queryByText('3.1.1')).not.toBeInTheDocument();
  });

  it('uses the latest server quiz instead of a local cache', async () => {
    storage.set('assessment-results-test-user-id', JSON.stringify({
      timestamp: new Date().toISOString(),
      weakKAs: ['3.1.7'],
    }));
    configureFetch(['3.1.2']);

    render(<LearningPathClient />);

    expect(await screen.findByText('3.1.2')).toBeInTheDocument();
    expect(screen.queryByText('3.1.7')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockFetch.mock.calls.some(([url]) => String(url).startsWith('/api/user/activities?'))).toBe(true);
    });
  });

  it('does not present a failed server read as an empty assessment history', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/experiments') return response({ success: false, data: [] });
      if (url.startsWith('/api/knowledge-graph?')) return response({ data: [] });
      if (url.startsWith('/api/user/activities?')) return response({ error: 'temporarily unavailable' }, false, 503);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<LearningPathClient />);

    expect(await screen.findByRole('heading', { name: '最近测评记录暂未核验' })).toBeInTheDocument();
    expect(screen.getByText(/不把读取失败解释为“没有测评记录”/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '还不能生成个人路径' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新读取测评记录' })).toBeEnabled();
  });

  it('does not recover cached assessment data while authentication is hydrating', () => {
    storage.set('assessment-results-test-user-id', JSON.stringify({
      timestamp: new Date().toISOString(),
      weakKAs: ['3.1.7'],
    }));
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    render(<LearningPathClient />);

    expect(screen.getByRole('status')).toHaveTextContent('正在确认访问角色');
    expect(screen.queryByText('3.1.7')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['TEACHER', '/teacher', '返回教学仪表板'],
    ['ADMIN', '/admin', '返回管理端'],
  ] as const)('does not read or generate a student plan for a %s direct URL', (role, destination, action) => {
    mockUseAuth.mockReturnValue({
      user: { id: `${role.toLowerCase()}-1`, username: role.toLowerCase(), email: `${role.toLowerCase()}@example.com`, name: role, role },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<LearningPathClient />);

    expect(screen.getByRole('heading', { name: '该页仅生成学生个人学习路径' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', destination);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([401, 403] as const)('keeps the full learning-path context after a %s', async (status) => {
    window.history.replaceState({}, '', '/learning-path?taskPathId=path-1&taskStepId=remediation#plan');
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/experiments') return response({ success: false, data: [] });
      if (url.startsWith('/api/knowledge-graph?')) return response({ data: [] });
      if (url.startsWith('/api/user/activities?')) return response({}, false, status);
      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<LearningPathClient />);

    const heading = status === 403 ? '需要学生账号' : '登录后查看个人学习路径';
    const action = status === 403 ? '切换学生账号' : '前往登录';
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: action })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/learning-path?taskPathId=path-1&taskStepId=remediation#plan')}${status === 403 ? '&reason=student-role' : ''}`,
    );
  });
});
