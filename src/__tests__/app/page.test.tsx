import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HyperCoursesPage as HomePage } from '@/components/hyper/HyperCoursesPage';
import CourseRoute from '@/app/page';
import ClearAuthPage from '@/app/clear-auth/page';
import { SidebarInset } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

jest.mock('lucide-react', () => {
  const MockIcon = ({ className, ...props }: any) => <span className={className} {...props}>Icon</span>;
  return new Proxy(
    { __esModule: true },
    {
      get: (_target, prop) => {
        if (prop === '__esModule') return true;
        if (prop === 'default') return MockIcon;
        return MockIcon;
      },
    },
  );
});

describe('HomePage', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    jest.restoreAllMocks();
    (global.fetch as jest.Mock).mockReset();
    (window.localStorage.getItem as jest.Mock).mockReset();
    mockUseAuth.mockReturnValue({
      user: {
        id: 'test-user-id',
        username: 'testuser',
        email: 'test@example.com',
        name: '学生',
        role: 'STUDENT',
      },
      loading: false,
    } as ReturnType<typeof useAuth>);
  });

  it('renders the courses page with chapter section by default', () => {
    render(<HomePage />);

    expect(screen.getByText('课程内容')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索章节、知识点、资源...')).toBeInTheDocument();
  });

  it('renders experiment section when toggled', () => {
    render(<HomePage />);

    const experimentBtn = screen.getByRole('button', { name: /实验工作台/ });
    fireEvent.click(experimentBtn);

    expect(screen.getByText('课程实验工作台')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('搜索实验、主题、编号...')).toBeInTheDocument();
  });

  it('lets users recover from empty chapter and experiment searches in one action', () => {
    render(<HomePage />);

    const chapterSearch = screen.getByPlaceholderText('搜索章节、知识点、资源...');
    fireEvent.change(chapterSearch, { target: { value: '不存在的课程内容' } });
    expect(screen.getByText(/没有找到与“不存在的课程内容”匹配/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(chapterSearch).toHaveValue('');
    expect(screen.getByText('10 / 10 CHAPTERS')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /实验工作台/ }));
    const experimentSearch = screen.getByPlaceholderText('搜索实验、主题、编号...');
    fireEvent.change(experimentSearch, { target: { value: '不存在的实验内容' } });
    expect(screen.getByText('当前搜索与筛选条件下没有匹配的实验。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '清除搜索与筛选' }));
    expect(experimentSearch).toHaveValue('');
    expect(screen.getByText(/13 \/ 13 ITEMS/)).toBeInTheDocument();
  });

  it('restores course section and filters from the URL and keeps later changes shareable', async () => {
    window.history.replaceState({}, '', '/?section=labs&q=exp02&view=completed&topic=%E5%9F%BA%E7%A1%80%E6%8C%87%E4%BB%A4');
    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '课程实验工作台' })).toBeInTheDocument();
    });
    expect(screen.getByLabelText('搜索实验、主题或编号')).toHaveValue('exp02');
    expect(screen.getAllByRole('button', { name: /已完成/ })[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: /基础指令/ })[0]).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText('搜索实验、主题或编号'), { target: { value: '定时器' } });
    await waitFor(() => {
      expect(window.location.search).toContain('q=%E5%AE%9A%E6%97%B6%E5%99%A8');
    });
  });

  it.each([
    ['completed', 'COMPLETED', '已完成'],
    ['in-progress', 'IN_PROGRESS', '进行中'],
  ] as const)('preserves the student %s view through the real auth hydration transition', async (requestedView, recordStatus, viewLabel) => {
    const student = {
      id: 'student-hydration', username: 'student', email: 'student@example.com', name: '学生', role: 'STUDENT' as const,
    };
    let authState = { user: null as typeof student | null, loading: true };
    mockUseAuth.mockImplementation(() => authState as ReturnType<typeof useAuth>);
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) => key === 'accessToken' ? 'student-token' : null);
    (global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/experiments') return { ok: false, status: 503 } as Response;
      if (url === '/api/experiments/save') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            experiments: [{ experimentId: 'exp02', status: recordStatus, completedAt: '2026-08-26T08:00:00.000Z' }],
          }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    window.history.replaceState({}, '', `/?section=labs&view=${requestedView}`);
    const filters = { section: 'labs' as const, query: '', view: requestedView, topic: 'all' };

    const { rerender } = render(<HomePage initialFilters={filters} />);

    expect(window.location.search).toContain(`view=${requestedView}`);
    expect(screen.queryByRole('button', { name: new RegExp(viewLabel) })).not.toBeInTheDocument();

    authState = { user: student, loading: false };
    rerender(<HomePage initialFilters={filters} />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: new RegExp(viewLabel) })[0]).toHaveAttribute('aria-pressed', 'true');
      expect(window.location.search).toContain(`view=${requestedView}`);
    });
    expect((await screen.findAllByText('EXP02')).length).toBeGreaterThan(0);
  });

  it.each([
    ['anonymous', null],
    ['teacher', { id: 'teacher-1', username: 'teacher', email: 'teacher@example.com', name: '教师', role: 'TEACHER' as const }],
  ])('removes personal progress filters for a resolved %s viewer', async (_label, viewer) => {
    mockUseAuth.mockReturnValue({ user: viewer, loading: false } as ReturnType<typeof useAuth>);
    window.history.replaceState({}, '', '/?section=labs&view=in-progress');

    render(<HomePage initialFilters={{ section: 'labs', query: '', view: 'in-progress', topic: 'all' }} />);

    await waitFor(() => expect(window.location.search).not.toContain('view='));
    expect(screen.queryByRole('button', { name: /进行中/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /已完成/ })).not.toBeInTheDocument();
  });

  it('renders a shared course URL with the correct first response state', async () => {
    window.history.replaceState({}, '', '/?section=labs&q=exp02&topic=%E5%9F%BA%E7%A1%80%E6%8C%87%E4%BB%A4');
    const route = await CourseRoute({
      searchParams: Promise.resolve({ section: 'labs', q: 'exp02', topic: '基础指令' }),
    });

    render(route);

    expect(screen.getByRole('heading', { name: '课程实验工作台' })).toBeInTheDocument();
    expect(screen.getByLabelText('搜索实验、主题或编号')).toHaveValue('exp02');
  });

  it('keeps chapter and section context on an executable public course deep link', async () => {
    window.history.replaceState({}, '', '/?section=chapters&chapter=2#item-2');
    const route = await CourseRoute({
      searchParams: Promise.resolve({ section: 'chapters', chapter: '2' }),
    });

    render(route);

    await waitFor(() => {
      expect(window.location.search).toContain('section=chapters');
      expect(window.location.search).toContain('chapter=2');
      expect(window.location.hash).toBe('#item-2');
    });
    expect(await screen.findByRole('button', { name: /收起第2章/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('routes specialized course quizzes to their formal assessment instead of a chapter fallback', () => {
    render(<HomePage />);

    expect(screen.getByRole('link', { name: /寻址方式 练习题/ })).toHaveAttribute(
      'href',
      '/quiz?topic=addressing-modes',
    );
    fireEvent.click(screen.getByRole('button', { name: '展开第10章前沿应用详情' }));
    expect(screen.getByRole('link', { name: /AI素养情境测验/ })).toHaveAttribute(
      'href',
      '/quiz?topic=ai-literacy',
    );
  });

  it('keeps public course actions touch-sized and keyboard-visible on mobile', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
    render(<HomePage />);

    for (const control of [
      screen.getByRole('link', { name: /芯智育才/ }),
      screen.getByRole('link', { name: '教师登录' }),
      screen.getByRole('button', { name: /章节内容/ }),
      screen.getByRole('button', { name: /实验内容/ }),
      screen.getByRole('button', { name: /内嵌预览/ }),
      screen.getByRole('link', { name: /新标签打开/ }),
      screen.getByRole('button', { name: /课程章节/ }),
      screen.getByRole('button', { name: /实验工作台/ }),
      screen.getAllByRole('link', { name: /进入章节测验/ })[0],
      screen.getByRole('link', { name: /寻址方式$/ }),
      screen.getByRole('link', { name: /寻址方式 练习题/ }),
      screen.getAllByRole('link', { name: /知识图谱$/ })[0],
      screen.getAllByRole('link', { name: /章节测验$/ })[0],
    ]) {
      expect(control).toHaveClass('min-h-11', 'focus-visible:ring-2');
    }

    expect(screen.getByPlaceholderText('搜索章节、知识点、资源...')).toHaveClass('min-h-11');
    expect(screen.getByLabelText('课程移动导航')).toHaveClass('min-w-0');
    expect(screen.getByRole('navigation', { name: '章节快捷跳转' })).toHaveClass('max-w-full', 'overflow-x-auto');
  });

  it('places the six-step addressing sample before supporting course materials for public reviewers', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: '3.1 寻址方式专项学习任务' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/样板课第\d步/)).toHaveLength(6);
    expect(screen.getByLabelText(/样板课第1步/)).toHaveAttribute(
      'href',
      '/login?role=student&from=%2Fknowledge-graph%3Fchapter%3D3%26node%3D3.1',
    );
    expect(screen.getByLabelText(/样板课第2步/)).toHaveAttribute(
      'href',
      '/login?role=student&from=%2Fknowledge-graph%3Fchapter%3D3%26node%3D3.1%23addressing-compare',
    );
    expect(screen.getByRole('link', { name: '教师登录复核样板课' })).toHaveAttribute(
      'href',
      '/login?role=teacher&from=%2Fteacher',
    );
    expect(screen.getByRole('link', { name: '教师登录' })).toHaveAttribute(
      'href',
      '/login?role=teacher&from=%2Fteacher',
    );
    expect(screen.getByRole('navigation', { name: '公开课程导航' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('heading', { name: '课程内容' }));
    expect(screen.getByText('非教学成效数据')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看图纸' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '查看图纸' })).toHaveAttribute('aria-controls', 'course-material-diagrams');
    expect(screen.getByRole('button', { name: '内嵌预览' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '内嵌预览' })).toHaveAttribute('aria-controls', 'course-material-pdf');
    expect(screen.getByRole('button', { name: '展开第1章单片机概述详情' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: '收起第3章指令系统详情' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: /实验工作台/ }));
    expect(screen.queryByText('未开始')).not.toBeInTheDocument();
    expect(screen.getAllByText('课程目录')).toHaveLength(13);
    expect(screen.queryByRole('button', { name: /进行中/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /已完成/ })).not.toBeInTheDocument();
  });

  it('keeps teacher reviewers in the teacher workflow after authentication', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'teacher-1', username: 'teacher', email: 'teacher@example.com', name: '教师', role: 'TEACHER' },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<HomePage />);

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回教师工作台' })).toHaveAttribute('href', '/teacher');
    expect(screen.queryByRole('link', { name: /样板课第/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /进入我的任务/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/weak-nodes"]')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /实验工作台/ }));
    expect(screen.queryByText('未开始')).not.toBeInTheDocument();
    expect(screen.getAllByText('课程目录')).toHaveLength(13);
    expect((global.fetch as jest.Mock).mock.calls.some(([url]) => url === '/api/experiments/save')).toBe(false);
  });

  it('does not present a failed personal-progress read as confirmed empty progress', async () => {
    (window.localStorage.getItem as jest.Mock).mockImplementation((key: string) => key === 'accessToken' ? 'valid-token' : null);
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    render(<HomePage />);

    expect(await screen.findByText(/个人实验进度读取失败/)).toBeInTheDocument();
    expect(screen.getByText(/完成状态尚未确认/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重新读取实验进度/ }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url, init]) => (
        url === '/api/experiments/save'
        && init?.headers?.['Content-Type'] === 'application/json'
      ))).toHaveLength(2);
    });
  });
});

describe('Application shell', () => {
  it('allows wide teaching tools to shrink within a narrow viewport', () => {
    render(
      <SidebarInset data-testid="app-content">
        <div className="min-w-[850px]">wide teaching tool</div>
      </SidebarInset>,
    );

    expect(screen.getByTestId('app-content')).toHaveClass('min-w-0');
  });
});

describe('Public auth cleanup', () => {
  it('preserves a safe full return path in the manual recovery link', async () => {
    window.history.replaceState(
      {},
      '',
      '/clear-auth?from=%2Fsettings%3Fpanel%3Dsecurity%23password&role=student&reason=student-role',
    );
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const { unmount } = render(<ClearAuthPage />);

    expect(await screen.findByRole('link', { name: '若未自动返回，点击这里' })).toHaveAttribute(
      'href',
      '/login?from=%2Fsettings%3Fpanel%3Dsecurity%23password&role=student&reason=student-role',
    );
    unmount();
  });

  it('rejects external and looping manual recovery destinations', async () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => undefined));
    window.history.replaceState({}, '', '/clear-auth?from=https%3A%2F%2Fevil.example%2Faccount');
    const external = render(<ClearAuthPage />);
    expect(await screen.findByRole('link', { name: '若未自动返回，点击这里' })).toHaveAttribute('href', '/welcome');
    external.unmount();

    window.history.replaceState({}, '', '/clear-auth?from=%2Fclear-auth%3Ffrom%3D%252Fsettings');
    const loop = render(<ClearAuthPage />);
    expect(await screen.findByRole('link', { name: '若未自动返回，点击这里' })).toHaveAttribute('href', '/welcome');
    loop.unmount();
  });

  it('expires the readable access cookie before waiting for server logout', () => {
    document.cookie = 'accessToken=stale-token; path=/';
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => undefined));

    const { unmount } = render(<ClearAuthPage />);

    expect(document.cookie).not.toContain('accessToken=');
    unmount();
  });
});
