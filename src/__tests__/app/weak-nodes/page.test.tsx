import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import WeakNodesPage from '@/app/weak-nodes/page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
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
    ArrowRight: Icon,
    BookOpen: Icon,
    CheckCircle2: Icon,
    Cpu: Icon,
    Layers: Icon,
    Loader2: Icon,
    RotateCcw: Icon,
    Target: Icon,
  };
});

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockFetch = jest.fn();
const routerPush = jest.fn();

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return { ok, status, json: async () => body } as Response;
}

function configureFetch(weakAreas: string[], score: number): void {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('/api/knowledge-graph?')) return response({}, false, 503);
    if (url.startsWith('/api/user/activities?')) {
      return response({
        success: true,
        activities: [{
          createdAt: '2026-07-16T01:00:00.000Z',
          details: JSON.stringify({
            quizId: 'quiz-ch3-addressing', assessmentMode: 'initial', score,
            weakAreas, scoresByKA: {}, pathId: 'path-addressing',
          }),
        }],
      });
    }
    if (url.startsWith('/api/quiz/questions?')) return response({ data: [] });
    if (url === '/api/learning-events/batch' && init?.method === 'POST') {
      return response({ success: true, accepted: 1, duplicates: 0, ignored: 0 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('WeakNodesPage task remediation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/');
    const storage = new Map<string, string>([['accessToken', 'student-token']]);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => storage.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => { storage.set(key, value); }),
        removeItem: jest.fn((key: string) => { storage.delete(key); }),
      },
    });
    mockUseRouter.mockReturnValue({ push: routerPush } as any);
    mockUseSearchParams.mockReturnValue(new URLSearchParams(
      'quizId=quiz-ch3-addressing&mode=initial&pathId=path-addressing&taskPathId=path-addressing&taskStepId=addressing-remediation',
    ) as any);
    mockUseAuth.mockReturnValue({ user: { id: 'student-1', role: 'STUDENT' }, loading: false } as any);
    global.fetch = mockFetch as typeof fetch;
  });

  it('requires every authoritative weak area to be confirmed before saving', async () => {
    configureFetch(['3.1.1'], 86);
    render(<WeakNodesPage />);

    const checkbox = await screen.findByRole('checkbox', { name: /3\.1\.1.*立即寻址/ });
    expect(screen.getByText('首次作答得分')).toBeInTheDocument();
    expect(screen.queryByText('最近总分')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看补学确认清单' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '完成全部确认后可保存' })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: '补学确认进度' })).toHaveAttribute('aria-valuenow', '0');

    fireEvent.click(checkbox);
    expect(screen.getByRole('progressbar', { name: '补学确认进度' })).toHaveAttribute('aria-valuenow', '100');
    const saveButton = await screen.findByRole('button', { name: '保存并返回任务确认' });
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/tasks'));
    const eventCalls = mockFetch.mock.calls.filter(([url]) => String(url) === '/api/learning-events/batch');
    expect(eventCalls).toHaveLength(1);
    const body = JSON.parse(String((eventCalls[0]?.[1] as RequestInit).body));
    expect(body.events[0].metadata).toMatchObject({
      pathId: 'path-addressing', stepId: 'addressing-remediation',
      weakAreas: ['3.1.1'], reviewedWeakAreas: ['3.1.1'], confirmedNoWeakNodes: false,
    });
  });

  it('rejects a remediation link that points to a retest instead of the task initial assessment', async () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams(
      'quizId=quiz-ch3-addressing&mode=retest&pathId=path-addressing&taskPathId=path-addressing&taskStepId=addressing-remediation',
    ) as any);
    configureFetch(['3.1.1'], 86);

    render(<WeakNodesPage />);

    expect(await screen.findByText('补学任务链接与专项首测记录不匹配，请返回任务页重新进入。')).toBeInTheDocument();
    expect(mockFetch.mock.calls.some(([url]) => String(url).startsWith('/api/user/activities?'))).toBe(false);
    expect(screen.queryByRole('button', { name: /保存/ })).not.toBeInTheDocument();
  });

  it('retries the same completion event once when the first response is lost', async () => {
    configureFetch(['3.1.1'], 86);
    const baseImplementation = mockFetch.getMockImplementation();
    const savedBodies: string[] = [];
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/learning-events/batch') {
        savedBodies.push(String(init?.body));
        if (savedBodies.length === 1) throw new TypeError('response lost');
        return response({ success: true, accepted: 0, duplicates: 1, ignored: 0 });
      }
      if (!baseImplementation) throw new Error('Missing base fetch implementation');
      return baseImplementation(input, init);
    });
    render(<WeakNodesPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /3\.1\.1.*立即寻址/ }));
    fireEvent.click(await screen.findByRole('button', { name: '保存并返回任务确认' }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/tasks'));
    expect(savedBodies).toHaveLength(2);
    expect(savedBodies[1]).toBe(savedBodies[0]);
  });

  it('does not leave the page when both completion receipts are incomplete', async () => {
    configureFetch(['3.1.1'], 86);
    const baseImplementation = mockFetch.getMockImplementation();
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/learning-events/batch') return response({ success: true });
      if (!baseImplementation) throw new Error('Missing base fetch implementation');
      return baseImplementation(input, init);
    });
    render(<WeakNodesPage />);

    fireEvent.click(await screen.findByRole('checkbox', { name: /3\.1\.1.*立即寻址/ }));
    fireEvent.click(await screen.findByRole('button', { name: '保存并返回任务确认' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('补学记录回执不完整');
    expect(routerPush).not.toHaveBeenCalledWith('/tasks');
    expect(mockFetch.mock.calls.filter(([url]) => String(url) === '/api/learning-events/batch')).toHaveLength(2);
  });

  it('requires an explicit scope confirmation when the assessment has no weak areas', async () => {
    configureFetch([], 100);
    render(<WeakNodesPage />);

    const checkbox = await screen.findByRole('checkbox', { name: /我已核对本次专项测评结果及适用范围/ });
    const lockedButton = screen.getByRole('button', { name: '完成全部确认后可保存' });
    expect(lockedButton).toBeDisabled();

    fireEvent.click(checkbox);
    fireEvent.click(await screen.findByRole('button', { name: '保存并返回任务确认' }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/tasks'));
    const eventCall = mockFetch.mock.calls.find(([url]) => String(url) === '/api/learning-events/batch');
    const body = JSON.parse(String((eventCall?.[1] as RequestInit).body));
    expect(body.events[0].metadata).toMatchObject({
      weakAreas: [], reviewedWeakAreas: [], confirmedNoWeakNodes: true,
    });
  });

  it('retries a failed formal-record read without losing the task receipt context', async () => {
    configureFetch(['3.1.1'], 86);
    const baseImplementation = mockFetch.getMockImplementation();
    let activityAttempts = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/user/activities?')) {
        activityAttempts += 1;
        if (activityAttempts === 1) return response({}, false, 503);
      }
      if (!baseImplementation) throw new Error('Missing base fetch implementation');
      return baseImplementation(input, init);
    });

    render(<WeakNodesPage />);

    fireEvent.click(await screen.findByRole('button', { name: '重新读取正式记录' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /3\.1\.1.*立即寻址/ }));
    fireEvent.click(await screen.findByRole('button', { name: '保存并返回任务确认' }));

    await waitFor(() => expect(routerPush).toHaveBeenCalledWith('/tasks'));
    expect(activityAttempts).toBe(2);
    const eventCall = mockFetch.mock.calls.find(([url]) => String(url) === '/api/learning-events/batch');
    const body = JSON.parse(String((eventCall?.[1] as RequestInit).body));
    expect(body.events[0]).toMatchObject({
      targetId: '3.1',
      metadata: {
        pathId: 'path-addressing',
        stepId: 'addressing-remediation',
        quizId: 'quiz-ch3-addressing',
      },
    });
  });

  it('preserves the complete weak-node URL when login recovery is required', async () => {
    const search = 'quizId=quiz-ch3-addressing&mode=initial&pathId=path-addressing&taskPathId=path-addressing&taskStepId=addressing-remediation';
    mockUseSearchParams.mockReturnValue(new URLSearchParams(search) as any);
    configureFetch(['3.1.1'], 86);
    const baseImplementation = mockFetch.getMockImplementation();
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/user/activities?')) return response({}, false, 401);
      if (!baseImplementation) throw new Error('Missing base fetch implementation');
      return baseImplementation(input, init);
    });

    render(<WeakNodesPage />);

    const loginLink = await screen.findByRole('link', { name: '重新登录并返回' });
    expect(loginLink).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent(`/weak-nodes?${search}`)}`,
    );
  });

  it('preserves query and hash and requests a student account after a 403', async () => {
    const search = 'quizId=quiz-ch3-addressing&mode=initial&pathId=path-addressing&taskPathId=path-addressing&taskStepId=addressing-remediation';
    window.history.replaceState({}, '', `/weak-nodes?${search}#review-3.1.1`);
    mockUseSearchParams.mockReturnValue(new URLSearchParams(search) as any);
    configureFetch(['3.1.1'], 86);
    const baseImplementation = mockFetch.getMockImplementation();
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith('/api/user/activities?')) return response({}, false, 403);
      if (!baseImplementation) throw new Error('Missing base fetch implementation');
      return baseImplementation(input, init);
    });

    render(<WeakNodesPage />);

    const loginLink = await screen.findByRole('link', { name: '切换学生账号并返回' });
    expect(loginLink).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent(`/weak-nodes?${search}#review-3.1.1`)}&reason=student-role`,
    );
  });

  it('does not read diagnostics while authentication is hydrating', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as any);

    render(<WeakNodesPage />);

    expect(screen.getByRole('status')).toHaveTextContent('正在确认访问角色');
    expect(screen.queryByText('一站式复习薄弱知识点')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['TEACHER', '/teacher', '返回教学仪表板'],
    ['ADMIN', '/admin', '返回管理端'],
  ] as const)('does not read student remediation records for a %s direct URL', (role, destination, action) => {
    mockUseAuth.mockReturnValue({ user: { id: role.toLowerCase(), role }, loading: false } as any);

    render(<WeakNodesPage />);

    expect(screen.getByRole('heading', { name: '该页仅展示学生个人薄弱点' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', destination);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
