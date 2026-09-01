import React from 'react';
import { createHash, webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { HyperTeacherPage } from '@/components/hyper/HyperTeacherPage';
import { useAuth } from '@/contexts/AuthContext';
import TeacherClassesPage from '@/app/teacher/classes/page';
import TeacherClassDetailPage from '@/app/teacher/classes/[id]/page';
import TeacherPushedPage from '@/app/teacher/pushed/page';
import TeacherReportPage from '@/app/teacher/report/page';
import ObjectivesPage from '@/app/obe/teacher/objectives/page';
import OBETeacherPage from '@/app/obe/teacher/page';
import OBEStudentPage from '@/app/obe/page';
import {
  getDefaultLoginLandingPath,
  getSafeLoginReturnPath,
  HyperLoginPage,
  LOGIN_REQUEST_TIMEOUT_MS,
} from '@/components/hyper/HyperLoginPage';
import { CLIENT_WRITE_TIMEOUT_MS } from '@/lib/client-fetch';
import { clearStoredAuth, getStoredAccessToken, getStoredUser, storeAuth } from '@/lib/auth-storage';
import { ADDRESSING_TOPIC_ID } from '@/lib/lesson-tasks';
import { getVisibleAnalysisItems, getVisibleLearningItems } from '@/components/layout/app-layout';

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
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

const mockToast = jest.fn();

jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('@/components/shared/LabScene', () => ({
  LabScene: () => <div data-testid="lab-scene" />,
}));

const demoProvenance = {
  mode: 'DEMO' as const,
  label: '演示数据',
  note: '当前为竞赛功能演示环境，记录不用于证明教学成效。',
};

const reportScope = {
  asOf: '2026-08-16T08:00:00.000Z',
  basis: 'ACTIVE_CLASS_ENROLLMENT' as const,
  accessibleClassCount: 1,
  enrolledStudentCount: 1,
  includedStudentCount: 1,
  excludedStudentCount: 0,
  exclusions: [],
  metricSamples: {
    quizStudents: 1,
    learningTimeStudents: 1,
    experimentStudents: 1,
    repeatedAttemptStudents: 0,
  },
};

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    AlertCircle: Icon,
    AlertTriangle: Icon,
    ArrowLeft: Icon,
    ArrowRight: Icon,
    Award: Icon,
    BarChart4: Icon,
    BarChart3: Icon,
    BookOpen: Icon,
    Building2: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    Calculator: Icon,
    ChevronDown: Icon,
    ChevronRight: Icon,
    ChevronUp: Icon,
    ClipboardCopy: Icon,
    Clock3: Icon,
    Clock: Icon,
    Database: Icon,
    Eye: Icon,
    EyeOff: Icon,
    FileDown: Icon,
    FileText: Icon,
    GitBranch: Icon,
    GraduationCap: Icon,
    Hash: Icon,
    Loader2: Icon,
    Link2: Icon,
    LayoutGrid: Icon,
    Lock: Icon,
    Medal: Icon,
    Moon: Icon,
    Plus: Icon,
    Pencil: Icon,
    RefreshCcw: Icon,
    RefreshCw: Icon,
    Save: Icon,
    Search: Icon,
    Send: Icon,
    Shield: Icon,
    ShieldCheck: Icon,
    Sun: Icon,
    Target: Icon,
    TrendingUp: Icon,
    Trash2: Icon,
    UserPlus: Icon,
    Users: Icon,
    X: Icon,
    XCircle: Icon,
  };
});

describe('role-aware primary navigation', () => {
  it('keeps student-personal learning entries out of the teacher navigation', () => {
    const labels = [
      ...getVisibleLearningItems('TEACHER'),
      ...getVisibleAnalysisItems('TEACHER'),
    ].map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(['任务回查', '知识图谱', '实验仿真', '在线测评', '学情分析', 'AI 助教']));
    expect(labels).not.toEqual(expect.arrayContaining(['我的任务', '薄弱节点', '个性化学习', '成就徽章']));
  });

  it('keeps the student journey visible without exposing the teacher review entry', () => {
    const labels = [
      ...getVisibleLearningItems('STUDENT'),
      ...getVisibleAnalysisItems('STUDENT'),
    ].map((item) => item.label);

    expect(labels).toEqual(expect.arrayContaining(['我的任务', '薄弱节点', '个性化学习', '成就徽章']));
    expect(labels).not.toContain('任务回查');
  });
});

describe('HyperLoginPage role recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearStoredAuth();
  });

  it('preselects the teacher role for a protected teacher return path', () => {
    mockUseSearchParams.mockReturnValue({ get: jest.fn((key: string) => key === 'from' ? '/teacher/pushed' : null) } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('group', { name: '登录角色' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '教师' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('工号 / 邮箱 / 用户名')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '学校（当前平台）' })).toHaveAttribute('readonly');
  });

  it('honors an explicit teacher login entry on a shared return path', () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'from' ? '/profile' : key === 'role' ? 'teacher' : null),
    } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('button', { name: '教师' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('工号 / 邮箱 / 用户名')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入教师工作台' })).toBeInTheDocument();
  });

  it('does not let an explicit role override a stricter return-path role', () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'from' ? '/tasks' : key === 'role' ? 'teacher' : null),
    } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('button', { name: '学生' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '教师' })).toBeDisabled();
  });

  it('accepts only same-site return paths', () => {
    expect(getSafeLoginReturnPath('/teacher/pushed?batchId=batch_1')).toBe('/teacher/pushed?batchId=batch_1');
    expect(getSafeLoginReturnPath('//malicious.example/teacher')).toBeNull();
    expect(getSafeLoginReturnPath('/\\malicious.example/teacher')).toBeNull();
    expect(getSafeLoginReturnPath('https://malicious.example/teacher')).toBeNull();
    expect(getSafeLoginReturnPath('/login')).toBeNull();
  });

  it('sends each role to its own default workspace when no return path is present', () => {
    expect(getDefaultLoginLandingPath('STUDENT')).toBe('/');
    expect(getDefaultLoginLandingPath('TEACHER')).toBe('/teacher');
    expect(getDefaultLoginLandingPath('ADMIN')).toBe('/admin/users');
  });

  it('uses the write-request timeout window so a cold login is not declared failed at ten seconds', () => {
    expect(LOGIN_REQUEST_TIMEOUT_MS).toBe(CLIENT_WRITE_TIMEOUT_MS);
    expect(LOGIN_REQUEST_TIMEOUT_MS).toBe(20_000);
  });

  it('keeps public recovery routes available from the login form', () => {
    mockUseSearchParams.mockReturnValue({ get: jest.fn(() => null) } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('link', { name: '返回平台介绍' })).toHaveAttribute('href', '/welcome');
    expect(screen.getByRole('link', { name: '返回平台介绍' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(screen.getByRole('link', { name: '创建学生账号' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: '创建学生账号' })).toHaveClass('min-h-11', 'focus-visible:ring-2');
    expect(screen.queryByRole('button', { name: '主题' })).not.toBeInTheDocument();
  });

  it('focuses the first missing login field and marks only that field invalid', () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'from' ? '/teacher' : null),
    } as any);

    render(<HyperLoginPage />);

    const account = screen.getByRole('textbox', { name: '工号 / 邮箱 / 用户名' });
    const password = screen.getByLabelText('密码');
    const submit = screen.getByRole('button', { name: '进入教师工作台' });

    fireEvent.click(submit);
    expect(screen.getByText('请填写账号和密码。')).toHaveAttribute('role', 'alert');
    expect(account).toHaveFocus();
    expect(account).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAttribute('aria-invalid', 'false');

    fireEvent.change(account, { target: { value: 'teacher' } });
    fireEvent.click(submit);
    expect(password).toHaveFocus();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(account).toHaveAttribute('aria-invalid', 'false');
  });

  it('locks every mutable login control while one mobile-sized submission is pending', async () => {
    mockUseSearchParams.mockReturnValue({ get: jest.fn(() => null) } as any);
    let finishRequest: ((response: Response) => void) | undefined;
    mockFetch.mockImplementation(() => new Promise<Response>((resolve) => { finishRequest = resolve; }));
    global.fetch = mockFetch as typeof fetch;

    render(<HyperLoginPage />);
    const account = screen.getByRole('textbox', { name: '学号 / 邮箱 / 用户名' });
    const password = screen.getByLabelText('密码');
    fireEvent.change(account, { target: { value: 'student' } });
    fireEvent.change(password, { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '进入学习空间' }));

    const pendingSubmit = screen.getByRole('button', { name: '正在验证账号…' });
    expect(pendingSubmit).toBeDisabled();
    expect(pendingSubmit).toHaveAttribute('aria-busy', 'true');
    expect(pendingSubmit.closest('form')).toHaveAttribute('aria-busy', 'true');
    expect(account).toBeDisabled();
    expect(account).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-60');
    expect(password).toBeDisabled();
    expect(password).toHaveClass('disabled:cursor-not-allowed', 'disabled:opacity-60');
    expect(screen.getByRole('button', { name: '显示密码' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '在此设备保持登录' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '学生' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '教师' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '管理员' })).toBeDisabled();

    await act(async () => {
      finishRequest?.(jsonResponse(401, { error: '密码错误' }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('密码错误');
  });

  it('explains when a teacher account is required', () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'from' ? '/teacher/classes' : key === 'reason' ? 'teacher-role' : null),
    } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('当前账号没有所需权限');
    expect(screen.getByRole('button', { name: '教师' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '学生' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '进入教师工作台' })).toBeInTheDocument();
  });

  it('allows only an administrator for a strict admin return path', () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'from' ? '/obe/admin' : null),
    } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('button', { name: '管理员' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '学生' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '教师' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('仅限管理员访问');
    expect(screen.getByRole('button', { name: '进入管理后台' })).toBeInTheDocument();
  });

  it('keeps the shared knowledge graph available to teachers and administrators', () => {
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'from' ? '/admin/knowledge-graph' : null),
    } as any);

    render(<HyperLoginPage />);

    expect(screen.getByRole('button', { name: '教师' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '学生' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '管理员' })).toBeEnabled();
  });

  it('sends the selected role to the login service and keeps a mismatch recoverable', async () => {
    mockUseSearchParams.mockReturnValue({ get: jest.fn(() => null) } as any);
    mockFetch.mockResolvedValue(jsonResponse(403, {
      error: '当前账号与所选登录角色不一致，请切换正确的角色或账号',
    }));
    global.fetch = mockFetch as typeof fetch;

    render(<HyperLoginPage />);
    fireEvent.change(screen.getByRole('textbox', { name: '学号 / 邮箱 / 用户名' }), { target: { value: 'student' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '进入学习空间' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('当前账号与所选登录角色不一致');
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      body: JSON.stringify({
        emailOrUsername: 'student',
        password: 'password123',
        expectedRole: 'STUDENT',
        rememberDevice: true,
      }),
    }));
  });

  it('explains and submits session-only login when keeping login is disabled', async () => {
    mockUseSearchParams.mockReturnValue({ get: jest.fn(() => null) } as any);
    mockFetch.mockResolvedValue(jsonResponse(401, { error: '密码错误' }));
    global.fetch = mockFetch as typeof fetch;

    render(<HyperLoginPage />);
    const rememberButton = screen.getByRole('button', { name: '在此设备保持登录' });
    expect(rememberButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('关闭浏览器后仍保持登录，最长 7 天')).toBeInTheDocument();

    fireEvent.click(rememberButton);
    expect(rememberButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('仅保留到本次浏览器会话结束')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: '学号 / 邮箱 / 用户名' }), { target: { value: 'student' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '进入学习空间' }));

    await screen.findByRole('alert');
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      body: JSON.stringify({
        emailOrUsername: 'student',
        password: 'password123',
        expectedRole: 'STUDENT',
        rememberDevice: false,
      }),
    }));
  });

  it('keeps a temporary login-service outage distinct from a wrong account', async () => {
    mockUseSearchParams.mockReturnValue({ get: jest.fn(() => null) } as any);
    mockFetch.mockResolvedValue(jsonResponse(503, {
      error: '登录服务暂时不可用，请稍后重试',
      code: 'AUTH_SERVICE_UNAVAILABLE',
    }));
    global.fetch = mockFetch as typeof fetch;

    render(<HyperLoginPage />);
    fireEvent.change(screen.getByRole('textbox', { name: '学号 / 邮箱 / 用户名' }), { target: { value: 'student' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: '进入学习空间' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('登录服务暂时不可用');
    expect(screen.getByRole('alert')).toHaveTextContent('账号与密码未被修改');
    expect(screen.getByRole('button', { name: '进入学习空间' })).toBeEnabled();
  });
});

describe('auth storage lifetime', () => {
  beforeEach(() => {
    const createStorage = () => {
      const values = new Map<string, string>();
      return {
        getItem: jest.fn((key: string) => values.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => values.set(key, value)),
        removeItem: jest.fn((key: string) => values.delete(key)),
        clear: jest.fn(() => values.clear()),
      };
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: createStorage() });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: createStorage() });
    clearStoredAuth();
  });

  it('keeps session-only credentials out of persistent storage', () => {
    storeAuth('session-token', { id: 'student-1' }, 'session');

    expect(getStoredAccessToken()).toBe('cookie-session');
    expect(JSON.parse(getStoredUser() ?? '{}')).toEqual({ id: 'student-1' });
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.getItem('authSession')).toBe('1');
  });

  it('remembers only a non-sensitive marker and keeps the user summary session-scoped', () => {
    storeAuth('session-token', { id: 'student-1' }, 'session');
    storeAuth('persistent-token', { id: 'student-1' }, 'persistent');

    expect(getStoredAccessToken()).toBe('cookie-session');
    expect(window.localStorage.getItem('accessToken')).toBeNull();
    expect(window.sessionStorage.getItem('accessToken')).toBeNull();
    expect(window.localStorage.getItem('authSession')).toBe('1');
    expect(window.localStorage.getItem('user')).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem('user') ?? '{}')).toEqual({ id: 'student-1' });
  });

  it('falls back to session credentials when persistent storage is restricted', () => {
    window.sessionStorage.setItem('accessToken', 'session-token');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => { throw new DOMException('Blocked', 'SecurityError'); },
    });

    expect(getStoredAccessToken()).toBe('session-token');
  });
});

describe('TeacherPushedPage recovery states', () => {
  let pushedToken: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/teacher/pushed');
    mockUseAuth.mockReturnValue({ user: teacher, loading: false } as ReturnType<typeof useAuth>);
    pushedToken = 'teacher-token';
    const sessionValues = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => key === 'accessToken' ? pushedToken : null),
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => sessionValues.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => sessionValues.set(key, value)),
        removeItem: jest.fn((key: string) => sessionValues.delete(key)),
      },
    });
    global.fetch = mockFetch as typeof fetch;
  });

  it('clears loaded push statistics and offers login recovery after a 401 refresh', async () => {
    window.history.replaceState({}, '', '/teacher/pushed?classId=class-2');
    let pushReads = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes') return jsonResponse(200, { success: true, classes: [{ id: 'class-2', name: '二班' }] });
      if (url === '/api/teacher/pushed?classId=class-2') {
        pushReads += 1;
        if (pushReads === 1) {
          return jsonResponse(200, {
            success: true,
            dataProvenance: demoProvenance,
            data: { totalStudents: 1, experiments: [], paths: [] },
          });
        }
        return jsonResponse(401, { error: '令牌无效' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherPushedPage />);

    expect(await screen.findByText('所辖学生')).toBeInTheDocument();
    expect(screen.getByText('演示数据：')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    expect(await screen.findByText('登录已过期，请重新登录后继续')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute(
      'href',
      '/login?from=%2Fteacher%2Fpushed%3FclassId%3Dclass-2',
    );
    expect(screen.queryByText('所辖学生')).not.toBeInTheDocument();
  });

  it('waits for authentication and preserves the direct URL for login recovery', async () => {
    window.history.replaceState({}, '', '/teacher/pushed?classId=class-2');
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);
    const view = render(<TeacherPushedPage />);

    expect(screen.getByText('正在核验教师权限…')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();

    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
    view.rerender(<TeacherPushedPage />);
    expect(await screen.findByText('请先登录教师账号。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去登录' })).toHaveAttribute(
      'href',
      '/login?from=%2Fteacher%2Fpushed%3FclassId%3Dclass-2',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps the selected student, batch and topic in the supplemental-intervention link', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes') return jsonResponse(200, { success: true, classes: [] });
      if (url === '/api/teacher/pushed') {
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: {
            totalStudents: 1,
            experiments: [],
            paths: [{
              batchId: 'batch_1', name: '3.1 寻址方式专项学习任务', description: null,
              topicId: ADDRESSING_TOPIC_ID, stepTitles: ['图谱定位'], assignedAt: '2026-07-16T00:00:00.000Z',
              totalStudents: 1, active: 1, paused: 0, completed: 0, dataInsufficient: 0,
              avgProgressPct: 20, latestStartedAt: '2026-07-16T00:00:00.000Z',
              students: [{
                id: 'student-1', name: '样板学生', studentCode: 'S001', status: 'ACTIVE',
                currentStep: 1, totalSteps: 6, progressPct: 17,
              }],
            }],
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherPushedPage />);

    expect(await screen.findByRole('link', { name: '查看并补充干预' })).toHaveAttribute(
      'href',
      `/teacher?student=student-1&batchId=batch_1&action=intervene&topic=${ADDRESSING_TOPIC_ID}`,
    );
  });

  it('lets the teacher drill from an experiment summary into the target student', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes') return jsonResponse(200, { success: true, classes: [] });
      if (url === '/api/teacher/pushed') {
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: {
            totalStudents: 1,
            experiments: [{
              experimentId: 'exp02', title: '实验二：指令系统实验', duration: 45,
              assigned: 1, inProgress: 0, completed: 0, dataInsufficient: 0,
              avgScore: null, uniqueStudents: 1, lastActivityAt: '2026-07-19T08:00:00.000Z',
              students: [{
                id: 'student-1', name: '样板学生', studentCode: 'S001',
                status: 'ASSIGNED', score: null, updatedAt: '2026-07-19T08:00:00.000Z',
              }],
            }],
            paths: [],
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherPushedPage />);

    expect(await screen.findByText('本教师布置的实验任务')).toBeInTheDocument();
    expect(screen.getAllByText('待开始')).toHaveLength(2);
    fireEvent.click(screen.getByText('查看 exp02 的 1 名学生状态'));
    expect(screen.getByText('样板学生')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看学生' })).toHaveAttribute('href', '/teacher?student=student-1');
  });

  it('cancels an obsolete class-filter request and keeps the latest result', async () => {
    let obsoleteSignal: AbortSignal | undefined;
    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes') {
        return Promise.resolve(jsonResponse(200, {
          success: true,
          classes: [{ id: 'class-1', name: '一班' }, { id: 'class-2', name: '二班' }],
        }));
      }
      if (url === '/api/teacher/pushed') {
        return Promise.resolve(jsonResponse(200, { success: true, dataProvenance: demoProvenance, data: { totalStudents: 1, experiments: [], paths: [] } }));
      }
      if (url === '/api/teacher/pushed?classId=class-1') {
        obsoleteSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          obsoleteSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      if (url === '/api/teacher/pushed?classId=class-2') {
        return Promise.resolve(jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: {
            totalStudents: 1,
            experiments: [],
            paths: [{
              batchId: 'batch-class-2', name: '二班寻址方式任务', description: null, topicId: ADDRESSING_TOPIC_ID,
              stepTitles: ['图谱定位'], assignedAt: '2026-07-18T00:00:00.000Z', totalStudents: 1,
              active: 1, paused: 0, completed: 0, dataInsufficient: 0, avgProgressPct: 10,
              latestStartedAt: null, students: [],
            }],
          },
        }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<TeacherPushedPage />);
    const filter = await screen.findByRole('combobox', { name: '班级筛选' });
    await screen.findByText('所辖学生');
    fireEvent.change(filter, { target: { value: 'class-1' } });
    await waitFor(() => expect(obsoleteSignal).toBeDefined());
    fireEvent.change(filter, { target: { value: 'class-2' } });

    expect(await screen.findByText('二班寻址方式任务')).toBeInTheDocument();
    expect(obsoleteSignal?.aborted).toBe(true);
    expect(window.sessionStorage.setItem).toHaveBeenLastCalledWith('teacher-pushed-class-filter-v1', 'class-2');
  });

  it('restores a still-accessible class filter after returning to push review', async () => {
    window.sessionStorage.setItem('teacher-pushed-class-filter-v1', 'class-2');
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes') {
        return jsonResponse(200, { success: true, classes: [{ id: 'class-2', name: '二班' }] });
      }
      if (url === '/api/teacher/pushed?classId=class-2') {
        return jsonResponse(200, { success: true, dataProvenance: demoProvenance, data: { totalStudents: 1, experiments: [], paths: [] } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherPushedPage />);

    const filter = await screen.findByRole('combobox', { name: '班级筛选' });
    await waitFor(() => expect(filter).toHaveValue('class-2'));
    expect(await screen.findByText('所辖学生')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalledWith('/api/teacher/pushed', expect.anything());
  });

  it('shows recent task batches first and expands the remaining batches on demand', async () => {
    const paths = Array.from({ length: 10 }, (_, index) => ({
      batchId: `batch-${index + 1}`,
      name: `寻址任务批次 ${index + 1}`,
      description: null,
      topicId: ADDRESSING_TOPIC_ID,
      stepTitles: ['图谱定位'],
      assignedAt: `2026-07-${String(18 - index).padStart(2, '0')}T00:00:00.000Z`,
      totalStudents: 1,
      active: 1,
      paused: 0,
      completed: 0,
      dataInsufficient: 0,
      avgProgressPct: 20,
      latestStartedAt: null,
      students: [],
    }));
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/classes') return jsonResponse(200, { success: true, classes: [] });
      if (url === '/api/teacher/pushed') {
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: { totalStudents: 1, experiments: [], paths },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherPushedPage />);

    expect(await screen.findByText('寻址任务批次 1')).toBeInTheDocument();
    expect(screen.getByText('已显示 8/10 批学习任务')).toBeInTheDocument();
    expect(screen.queryByText('寻址任务批次 9')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '再显示 2 批' }));

    expect(screen.getByText('寻址任务批次 10')).toBeInTheDocument();
    expect(screen.getByText('已显示 10/10 批学习任务')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '收起到最近 8 批' }));
    expect(screen.queryByText('寻址任务批次 9')).not.toBeInTheDocument();
  });
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseParams = useParams as jest.MockedFunction<typeof useParams>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>;
const mockFetch = jest.fn();
const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn() };

const teacher = {
  id: 'teacher-1',
  email: 'teacher@example.com',
  username: 'teacher',
  name: '测试教师',
  role: 'TEACHER' as const,
};

const dashboard = {
  dataProvenance: demoProvenance,
  scope: reportScope,
  overview: {
    totalStudents: 1,
    activeToday: 1,
    avgQuizScore: 82,
    avgExpCompletion: 70,
    avgTimeSpent: 3600,
    quizAttemptCount: 1,
    experimentRecordCount: 1,
    learningProgressCount: 1,
  },
  classes: [{ id: 'class-1', name: '样板班' }],
  students: [{
    id: 'student-1',
    name: '样板学生',
    studentId: 'S001',
    class: '样板班',
    classes: [{ id: 'class-1', name: '样板班' }],
    avgQuizScore: 82,
    quizAttemptCount: 1,
    totalTimeSpent: 3600,
    learningProgressCount: 1,
    analysisEligible: true,
    experimentsCompleted: 1,
    experimentsTotal: 1,
  }],
  experiments: [{ id: 'exp02', name: '寻址方式仿真实验', completed: 1 }],
  alertStudents: [],
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const learningGains = {
  dataProvenance: demoProvenance,
  scope: reportScope,
  scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN' as const,
  comparisonType: 'REPEATED_ATTEMPT' as const,
  scoreDistribution: [
    { label: '<60', count: 0 }, { label: '60-69', count: 0 }, { label: '70-79', count: 0 },
    { label: '80-89', count: 1 }, { label: '90-100', count: 0 },
  ],
  scoreSummary: { avg: 82, total: 1 },
  experimentCorrelation: [],
  prePostComparison: [],
  chapterMasteryAvg: [],
};

describe('TeacherReportPage guarded export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/teacher/report');
    mockUseAuth.mockReturnValue({ user: teacher, loading: false } as ReturnType<typeof useAuth>);
    mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: jest.fn(() => 'teacher-token') },
    });
    Object.defineProperty(window, 'print', { configurable: true, value: jest.fn() });
    global.fetch = mockFetch as typeof fetch;
  });

  it('blocks printing when analytical data fails to load', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/teacher/dashboard?asOf=')) return jsonResponse(200, dashboard);
      if (url.startsWith('/api/analytics/learning-gains?asOf=')) return jsonResponse(503, { error: '暂不可用' });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherReportPage />);

    expect(await screen.findByText('报告数据读取失败，请稍后重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打印 / 导出 PDF' })).not.toBeInTheDocument();
    expect(window.print).not.toHaveBeenCalled();
  });

  it('replaces a low-level network error with a retryable Chinese message', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    render(<TeacherReportPage />);

    expect(await screen.findByText('暂时无法读取报告数据，请检查网络后重试')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('keeps an empty but valid report explicit about unavailable analyses', async () => {
    const emptyScope = {
      ...reportScope,
      enrolledStudentCount: 0,
      includedStudentCount: 0,
      metricSamples: {
        quizStudents: 0,
        learningTimeStudents: 0,
        experimentStudents: 0,
        repeatedAttemptStudents: 0,
      },
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/teacher/dashboard?asOf=')) {
        return jsonResponse(200, {
          ...dashboard,
          scope: emptyScope,
          overview: { ...dashboard.overview, totalStudents: 0, activeToday: 0, avgQuizScore: 0, avgExpCompletion: 0, avgTimeSpent: 0 },
          students: [],
        });
      }
      if (url.startsWith('/api/analytics/learning-gains?asOf=')) {
        return jsonResponse(200, {
          ...learningGains,
          scope: emptyScope,
          scoreDistribution: [],
          scoreSummary: { avg: 0, total: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherReportPage />);

    expect(await screen.findByText('暂无测验数据，学生完成测验后此处将展示成绩分布。')).toBeInTheDocument();
    expect(screen.getByText(/当前缺少足够记录/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打印 / 导出 PDF' })).toBeInTheDocument();
  });

  it('shows the cutoff and scope while excluding missing quiz and time records from metrics', async () => {
    const scopedDashboard = {
      ...dashboard,
      scope: {
        ...reportScope,
        enrolledStudentCount: 4,
        includedStudentCount: 3,
        excludedStudentCount: 1,
        exclusions: [{ code: 'DEMO_ACCOUNT', label: '专用演示学生不纳入教学分析', count: 1 }],
        metricSamples: { ...reportScope.metricSamples, quizStudents: 2, learningTimeStudents: 1 },
      },
      overview: { ...dashboard.overview, totalStudents: 4, avgQuizScore: 45, avgTimeSpent: 3600 },
      students: [
        { name: '有记录学生', studentId: 'S001', avgQuizScore: 90, quizAttemptCount: 1, totalTimeSpent: 3600, learningProgressCount: 1, analysisEligible: true },
        { name: '真实零分学生', studentId: 'S002', avgQuizScore: 0, quizAttemptCount: 1, totalTimeSpent: 0, learningProgressCount: 0, analysisEligible: true },
        { name: '未作答学生', studentId: 'S003', avgQuizScore: 0, quizAttemptCount: 0, totalTimeSpent: 0, learningProgressCount: 0, analysisEligible: true },
        { name: '排除学生', studentId: 'D001', avgQuizScore: 100, quizAttemptCount: 1, totalTimeSpent: 7200, learningProgressCount: 1, analysisEligible: false },
      ],
    };
    const scopedGains = {
      ...learningGains,
      scope: scopedDashboard.scope,
      scoreDistribution: [
        { label: '<60', count: 1 }, { label: '60-69', count: 0 }, { label: '70-79', count: 0 },
        { label: '80-89', count: 0 }, { label: '90-100', count: 1 },
      ],
      scoreSummary: { avg: 45, total: 2 },
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/teacher/dashboard?asOf=')) return jsonResponse(200, scopedDashboard);
      if (url.startsWith('/api/analytics/learning-gains?asOf=')) return jsonResponse(200, scopedGains);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherReportPage />);

    expect(await screen.findByText(/数据截止：2026\/08\/16 16:00:00/)).toBeInTheDocument();
    expect(screen.getAllByText('4')).toHaveLength(2);
    expect(screen.getByText(/排除原因/)).toBeInTheDocument();
    expect(screen.getByText(/缺少对应记录的学生不以 0 值代入/)).toBeInTheDocument();
    expect(screen.getByText('有记录学生')).toBeInTheDocument();
    expect(screen.getByText('真实零分学生')).toBeInTheDocument();
    expect(screen.queryByText('未作答学生')).not.toBeInTheDocument();
    expect(screen.queryByText('排除学生')).not.toBeInTheDocument();
    expect(screen.getByText('平均学习时长').parentElement).toHaveTextContent('1h');
  });

  it('turns a stalled report read into a retryable state without reloading the page', async () => {
    jest.useFakeTimers();
    let dashboardReads = 0;
    try {
      mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith('/api/teacher/dashboard?asOf=')) {
          dashboardReads += 1;
          if (dashboardReads === 1) {
            const signal = init?.signal;
            return new Promise<Response>((_resolve, reject) => {
              signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
            });
          }
          return Promise.resolve(jsonResponse(200, dashboard));
        }
        if (url.startsWith('/api/analytics/learning-gains?asOf=')) return Promise.resolve(jsonResponse(200, learningGains));
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      render(<TeacherReportPage />);
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }

    expect(await screen.findByText('报告数据读取超时，请检查网络后重试')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(await screen.findByRole('button', { name: '打印 / 导出 PDF' })).toBeInTheDocument();
    expect(dashboardReads).toBe(2);
  });

  it('marks a report as mixed when its two server data identities differ', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/teacher/dashboard?asOf=')) {
        return jsonResponse(200, {
          ...dashboard,
          dataProvenance: { mode: 'REAL', label: '真实教学数据', note: '已授权班级记录。' },
        });
      }
      if (url.startsWith('/api/analytics/learning-gains?asOf=')) return jsonResponse(200, learningGains);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherReportPage />);

    expect(await screen.findByText('混合数据：')).toBeInTheDocument();
    expect(screen.getByText(/教学看板为真实教学数据，学习分析为演示数据/)).toBeInTheDocument();
  });

  it('rejects a successful payload that omits the server data identity', async () => {
    const { dataProvenance: _omitted, ...dashboardWithoutProvenance } = dashboard;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/teacher/dashboard?asOf=')) return jsonResponse(200, dashboardWithoutProvenance);
      if (url.startsWith('/api/analytics/learning-gains?asOf=')) return jsonResponse(200, learningGains);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherReportPage />);

    expect(await screen.findByText('报告数据格式异常，已阻止导出，请重新加载')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打印 / 导出 PDF' })).not.toBeInTheDocument();
  });

  it('blocks export when the reported sample count disagrees with student records', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/teacher/dashboard?asOf=')) {
        return jsonResponse(200, {
          ...dashboard,
          scope: {
            ...reportScope,
            metricSamples: { ...reportScope.metricSamples, quizStudents: 0 },
          },
        });
      }
      if (url.startsWith('/api/analytics/learning-gains?asOf=')) return jsonResponse(200, learningGains);
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherReportPage />);

    expect(await screen.findByText('报告数据格式异常，已阻止导出，请重新加载')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打印 / 导出 PDF' })).not.toBeInTheDocument();
  });

  it('preserves print intent when a direct visitor must switch to a teacher account', async () => {
    window.history.replaceState({}, '', '/teacher/report?print=1');
    mockUseAuth.mockReturnValue({ user: { ...teacher, role: 'STUDENT' }, loading: false } as ReturnType<typeof useAuth>);

    render(<TeacherReportPage />);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(
      '/login?from=%2Fteacher%2Freport%3Fprint%3D1&reason=teacher-role',
    ));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Teacher class data recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/teacher/classes');
    mockUseParams.mockReturnValue({ id: 'class-1' });
    mockUseAuth.mockReturnValue({ user: teacher, loading: false } as ReturnType<typeof useAuth>);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: jest.fn(() => 'teacher-token') },
    });
    const sessionValues = new Map<string, string>();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => sessionValues.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => sessionValues.set(key, value)),
        removeItem: jest.fn((key: string) => sessionValues.delete(key)),
      },
    });
    global.fetch = mockFetch as typeof fetch;
  });

  it('clears a loaded class list when refresh returns 401', async () => {
    let reads = 0;
    mockFetch.mockImplementation(async () => {
      reads += 1;
      return reads === 1
        ? jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          classes: [{
            id: 'class-1', name: '样板班', inviteCode: 'ABC123', courseName: '微控制器', semester: '2026春',
            teacherId: 'teacher-1', status: 'ACTIVE', createdAt: '2026-07-16T00:00:00.000Z',
            teacher: { id: 'teacher-1', name: '测试教师', username: 'teacher', teacherId: 'T001' },
            _count: { enrollments: 1 },
          }],
        })
        : jsonResponse(401, { error: '令牌无效' });
    });

    render(<TeacherClassesPage />);

    expect(await screen.findByText('样板班')).toBeInTheDocument();
    const classRegion = screen.getByRole('region', { name: '可管理班级' });
    expect(within(classRegion).queryByRole('table')).not.toBeInTheDocument();
    expect(within(classRegion).getByRole('link', { name: '查看样板班的学生名单与邀请码' })).toHaveClass('min-h-11');
    expect(screen.getByText('演示数据：')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    expect(await screen.findByText('登录已过期，请重新登录后继续')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Fteacher%2Fclasses');
    expect(screen.queryByText('样板班')).not.toBeInTheDocument();
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
    expect(screen.queryByText('还没有班级，点右上「新建班级」开始。')).not.toBeInTheDocument();
  });

  it('does not request or expose class data to a student account', async () => {
    window.history.replaceState({}, '', '/teacher/classes?status=active');
    mockUseAuth.mockReturnValue({ user: { ...teacher, role: 'STUDENT' }, loading: false } as ReturnType<typeof useAuth>);

    render(<TeacherClassesPage />);

    expect(await screen.findByText('当前账号没有教师端权限。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '切换教师账号' })).toHaveAttribute(
      'href',
      '/login?from=%2Fteacher%2Fclasses%3Fstatus%3Dactive&reason=teacher-role',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('removes the invite code and roster when class refresh returns 401', async () => {
    let reads = 0;
    mockFetch.mockImplementation(async () => {
      reads += 1;
      return reads === 1
        ? jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          class: {
            id: 'class-1', name: '样板班', inviteCode: 'SECRET1', courseName: '微控制器', semester: '2026春', status: 'ACTIVE',
            teacher: { id: 'teacher-1', name: '测试教师', username: 'teacher' },
            enrollments: [{
              id: 'enrollment-1', userId: 'student-1', classId: 'class-1', role: 'STUDENT', status: 'ACTIVE',
              joinedAt: '2026-07-16T00:00:00.000Z',
              user: { id: 'student-1', name: '样板学生', username: 'student', studentId: 'S001', role: 'STUDENT', lastLoginAt: null },
            }],
          },
        })
        : jsonResponse(401, { error: '令牌无效' });
    });

    render(<TeacherClassDetailPage />);

    expect(await screen.findByText('SECRET1')).toBeInTheDocument();
    expect(screen.getByText('样板学生')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '学生名单 · 1' }).closest('section')).not.toBeNull();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /回查本班任务与实验/ })).toHaveAttribute('href', '/teacher/pushed?classId=class-1');
    expect(screen.getByRole('link', { name: /复核本班达成度/ })).toHaveAttribute('href', '/obe/teacher?classId=class-1&semester=2026%E6%98%A5');
    expect(screen.getByRole('note', { name: '班级数据身份' })).toHaveTextContent('演示数据');
    fireEvent.click(screen.getByRole('button', { name: '刷新' }));

    expect(await screen.findByText('登录已过期，请重新登录后继续')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Fteacher%2Fclasses%2Fclass-1');
    expect(screen.queryByText('SECRET1')).not.toBeInTheDocument();
    expect(screen.queryByText('样板学生')).not.toBeInTheDocument();
  });

  it('blocks a class drill-down when the server omits its data identity', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, {
      success: true,
      class: {
        id: 'class-1', name: '样板班', inviteCode: 'SHOULD_NOT_SHOW', courseName: '微控制器', semester: '2026春', status: 'ACTIVE',
        teacher: { id: 'teacher-1', name: '测试教师', username: 'teacher' },
        enrollments: [],
      },
    }));

    render(<TeacherClassDetailPage />);

    expect(await screen.findByText('班级数据缺少服务端数据身份，已阻止展示')).toBeInTheDocument();
    expect(screen.queryByText('SHOULD_NOT_SHOW')).not.toBeInTheDocument();
  });

  it('previews the exact roster impact before removing a student', async () => {
    const classPayload = {
      success: true,
      dataProvenance: demoProvenance,
      class: {
        id: 'class-1', name: '样板班', inviteCode: 'SAFE001', courseName: '微控制器', semester: '2026春', status: 'ACTIVE',
        teacher: { id: 'teacher-1', name: '测试教师', username: 'teacher' },
        enrollments: [{
          id: 'enrollment-1', userId: 'student-1', classId: 'class-1', role: 'STUDENT', status: 'ACTIVE',
          joinedAt: '2026-07-16T00:00:00.000Z',
          user: { id: 'student-1', name: '样板学生', username: 'student', studentId: 'S001', role: 'STUDENT', lastLoginAt: null },
        }],
      },
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes/class-1' && (!init?.method || init.method === 'GET')) return jsonResponse(200, classPayload);
      if (url === '/api/classes/class-1/enrollments/student-1' && init?.method === 'DELETE') {
        return jsonResponse(200, { success: true, duplicate: false });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherClassDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: '从班级移除样板学生' }));
    const dialog = await screen.findByRole('alertdialog', { name: '确认将学生移出当前班级' });
    expect(dialog).toHaveTextContent(/样板学生（S001）\s*将不再出现在该班级名单及后续班级范围统计中/);
    expect(dialog).toHaveTextContent('既有测验、实验和学习记录不会删除');
    expect(mockFetch).not.toHaveBeenCalledWith('/api/classes/class-1/enrollments/student-1', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: '确认移出班级' }));

    expect(await screen.findByText('已移除 样板学生')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/classes/class-1/enrollments/student-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('replays the exact same class-create request after a lost response', async () => {
    const createBodies: string[] = [];
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(200, { success: true, dataProvenance: demoProvenance, classes: [] });
      }
      if (url === '/api/classes' && init?.method === 'POST') {
        createBodies.push(String(init.body));
        if (createBodies.length === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(200, {
          success: true, duplicate: true,
          class: { id: 'class-1', name: '样板班', inviteCode: 'SAFE001' },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherClassesPage />);
    await screen.findByText('还没有班级，点右上「新建班级」开始。');
    fireEvent.click(screen.getByRole('button', { name: '新建班级' }));
    fireEvent.change(screen.getByPlaceholderText('如：自动化 2024-1 班'), { target: { value: '样板班' } });
    const submit = screen.getByRole('button', { name: '创建' });
    act(() => {
      submit.click();
      submit.click();
    });

    expect(await screen.findByText('已恢复原创建结果：邀请码 SAFE001')).toBeInTheDocument();
    expect(createBodies).toHaveLength(2);
    expect(createBodies[1]).toBe(createBodies[0]);
    expect(JSON.parse(createBodies[0] ?? '{}')).toMatchObject({ name: '样板班', requestId: expect.any(String) });
  });

  it('keeps an uncertain create snapshot locked while refreshing and reuses it for manual recovery', async () => {
    const createBodies: string[] = [];
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(200, { success: true, dataProvenance: demoProvenance, classes: [] });
      }
      if (url === '/api/classes' && init?.method === 'POST') {
        createBodies.push(String(init.body));
        if (createBodies.length <= 2) throw new TypeError('Failed to fetch');
        return jsonResponse(200, {
          success: true,
          duplicate: true,
          class: { id: 'class-1', name: '样板班', inviteCode: 'SAFE002' },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherClassesPage />);
    await screen.findByText('还没有班级，点右上「新建班级」开始。');
    fireEvent.click(screen.getByRole('button', { name: '新建班级' }));
    fireEvent.change(screen.getByPlaceholderText('如：自动化 2024-1 班'), { target: { value: '样板班' } });
    fireEvent.click(screen.getByRole('button', { name: '创建' }));

    expect(await screen.findByText(/创建结果暂未确认/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '结果待核对' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '刷新列表（保留原请求）' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '核对原创建请求' })).toBeEnabled());
    expect(window.sessionStorage.removeItem).not.toHaveBeenCalledWith('teacher-class-create-pending-v1');

    fireEvent.click(screen.getByRole('button', { name: '核对原创建请求' }));
    expect(await screen.findByText('已恢复原创建结果：邀请码 SAFE002')).toBeInTheDocument();
    expect(createBodies).toHaveLength(3);
    expect(new Set(createBodies)).toHaveProperty('size', 1);
  });

  it('replays an add-student request and accepts the duplicate receipt', async () => {
    const addBodies: string[] = [];
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes/class-1' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          class: {
            id: 'class-1', name: '样板班', inviteCode: 'SAFE001', courseName: '微控制器', semester: '2026春', status: 'ACTIVE',
            teacher: { id: 'teacher-1', name: '测试教师', username: 'teacher' }, enrollments: [],
          },
        });
      }
      if (url === '/api/classes/class-1/enrollments' && init?.method === 'POST') {
        addBodies.push(String(init.body));
        if (addBodies.length === 1) throw new TypeError('Failed to fetch');
        return jsonResponse(200, { success: true, duplicate: true, user: { name: '学生甲', username: 'student-a' } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<TeacherClassDetailPage />);
    fireEvent.change(await screen.findByRole('textbox', { name: '学生学号或用户名' }), { target: { value: 'S001' } });
    const submit = screen.getByRole('button', { name: '添加' });
    act(() => {
      submit.click();
      submit.click();
    });

    expect(await screen.findByText('已确认在班学生 学生甲')).toBeInTheDocument();
    expect(addBodies).toHaveLength(2);
    expect(addBodies[1]).toBe(addBodies[0]);
  });

  it('turns a stalled class-list read into a recoverable timeout', async () => {
    jest.useFakeTimers();
    try {
      mockFetch.mockImplementation((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      });

      render(<TeacherClassesPage />);
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }

    expect(await screen.findByText('班级列表读取超时，请检查网络后重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新' })).toBeEnabled();
  });
});

describe('HyperTeacherPage recovery states', () => {
  let storedToken: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    storedToken = 'teacher-token';
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    mockUseRouter.mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
    mockUseSearchParams.mockReturnValue({ get: jest.fn(() => null) } as any);
    const sessionValues = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => key === 'accessToken' ? storedToken : null),
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => sessionValues.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => sessionValues.set(key, value)),
        removeItem: jest.fn((key: string) => sessionValues.delete(key)),
        clear: jest.fn(() => sessionValues.clear()),
      },
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: TextEncoder,
    });
    global.fetch = mockFetch as typeof fetch;
  });

  it('directs a signed-out visitor to the teacher login flow', async () => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);

    render(<HyperTeacherPage />);

    expect(await screen.findByText('请先登录教师账号，再进入教师工作台。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '去登录' })).toHaveAttribute('href', '/login?from=%2Fteacher');
  });

  it('does not render false zero statistics when the teacher token is missing', async () => {
    storedToken = null;
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);

    render(<HyperTeacherPage />);

    expect(await screen.findByRole('heading', { name: '教师数据暂不可用' })).toBeInTheDocument();
    expect(screen.getByText('登录已过期，请重新登录后继续')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Fteacher');
    expect(screen.queryByText('学生总数')).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows evidence boundaries and runs the database check only after teacher confirmation', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/health/database') {
        return jsonResponse(200, {
          timestamp: '2026-07-30T08:00:00.000Z', scope: 'INSTANTANEOUS', label: '即时连接探测',
          note: '仅代表本次只读查询结果，不代表历史可用率、持续稳定性或并发容量。',
          database: { isConnected: true, latency: 8 },
          recommendations: ['本次只读查询已完成；如需判断持续表现，请查看独立监测窗口。'],
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    const scope = await screen.findByRole('note', { name: '教师看板数据范围' });
    expect(scope).toHaveTextContent('数据截止');
    expect(scope).toHaveTextContent('名册 n=1 · 纳入 n=1');
    expect(scope).toHaveTextContent('测验 n=1 · 学习 n=1');
    expect(scope).toHaveTextContent('实验 n=1 · 多次作答 n=0');
    const currentStudent = screen.getByRole('region', { name: '当前复核对象' });
    expect(currentStudent).toHaveTextContent('样板学生');
    expect(within(currentStudent).getByRole('button', { name: '为样板学生布置 3.1 专项' })).toBeEnabled();
    expect(await screen.findByText('过程已记录')).toBeInTheDocument();
    expect(screen.getByText('成效证据不足')).toBeInTheDocument();
    expect(screen.getByText('待真实采集')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '执行即时探测' })).toBeEnabled();
    expect(mockFetch).not.toHaveBeenCalledWith('/api/health/database', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: '执行即时探测' }));

    expect(await screen.findByText('本次通过')).toBeInTheDocument();
    expect(screen.getByText('8 ms')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/health/database', expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer teacher-token' },
    }));
  });

  it('requires an explicit data-purpose choice and sends management mode when exporting identified data', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const createObjectURL = jest.fn(() => 'blob:teacher-export');
    const revokeObjectURL = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/export?type=student-summary&mode=management') {
        return {
          ok: true,
          status: 200,
          blob: async () => new Blob(['identified-export']),
          headers: new Headers({ 'Content-Disposition': 'attachment; filename="management.csv"' }),
        } as Response;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    const initialButton = await screen.findByRole('button', { name: '请先选择数据用途' });
    expect(initialButton).toBeDisabled();
    expect(screen.getByRole('note', { name: '数据用途说明' })).toHaveTextContent('实名教学管理文件包含直接身份信息');

    const purpose = screen.getByRole('combobox', { name: '数据用途' });
    fireEvent.keyDown(purpose, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: '实名教学管理' }));
    expect(screen.getByRole('note', { name: '数据用途说明' })).toHaveTextContent('仅用于获授权的教学管理');

    fireEvent.click(screen.getByRole('button', { name: '导出实名教学管理 CSV' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/teacher/export?type=student-summary&mode=management',
      { headers: { Authorization: 'Bearer teacher-token' } },
    ));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('sends research mode and explains when anonymous export is not configured', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/export?type=student-summary&mode=research') {
        return jsonResponse(503, { error: '研究匿名导出尚未配置独立密钥' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    const purpose = await screen.findByRole('combobox', { name: '数据用途' });
    fireEvent.keyDown(purpose, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: '研究匿名' }));
    expect(screen.getByRole('note', { name: '数据用途说明' })).toHaveTextContent('移除姓名、学号等直接标识');

    fireEvent.click(screen.getByRole('button', { name: '导出研究匿名 CSV' }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/teacher/export?type=student-summary&mode=research',
      { headers: { Authorization: 'Bearer teacher-token' } },
    ));
    expect(mockToast).toHaveBeenCalledWith({
      title: '导出失败',
      description: '研究匿名导出暂不可用，请联系管理员完成研究导出配置后重试。',
      variant: 'destructive',
    });
  });

  it('opens a student-scoped intervention dialog from the pushed-task drill-down without submitting it', async () => {
    window.history.replaceState(
      {},
      '',
      `/teacher?student=student-1&batchId=batch_1&action=intervene&topic=chapter-review&returnTo=${encodeURIComponent('/obe/teacher?classId=class-1&semester=2025-2026-2')}`,
    );
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => ({
        student: 'student-1', batchId: 'batch_1', action: 'intervene', topic: 'chapter-review',
        returnTo: '/obe/teacher?classId=class-1&semester=2025-2026-2',
      }[key] ?? null)),
    } as any);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect?batchId=batch_1') {
        return jsonResponse(200, {
          interventions: [{
            studentId: 'student-1', name: '样板学生', studentCode: 'S001', interventionDate: '2026-07-16T00:00:00.000Z',
            preAvg: 0, postAvg: 0, gain: 0, preCount: 0, postCount: 0,
            topicId: ADDRESSING_TOPIC_ID, comparisonLabel: '专项首测 / 再次测评', experimentStatus: 'NOT_STARTED',
            taskStatus: 'ACTIVE', currentStep: 0, totalSteps: 6,
          }],
          summary: { batchId: 'batch_1', totalStudents: 1, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    const dialog = await screen.findByRole('dialog', { name: '推送学习任务' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('当前学生：样板学生')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('样板学生S001样板班');
    expect(dialog).toHaveTextContent('预计推送给 1 名学生。');
    expect(dialog).toHaveTextContent('任务步骤预览');
    expect(dialog).toHaveTextContent('提交成功后，将返回原班级和学期继续复核');
    expect(screen.getByRole('button', { name: '返回达成度复核' })).toBeEnabled();
    expect(mockFetch).not.toHaveBeenCalledWith('/api/teacher/push-learning-task', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: '关闭推送学习任务对话框' }));
    expect(router.replace).toHaveBeenCalledWith('/teacher', { scroll: false });
  });

  it('requires an explicit confirmation before pushing to a whole class', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '推送任务' }));
    const scope = await screen.findByRole('combobox', { name: '推送范围' });
    fireEvent.keyDown(scope, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: '指定班级' }));

    const confirmation = screen.getByRole('checkbox', { name: /我确认本次将向样板班/ });
    expect(confirmation).not.toBeChecked();
    expect(screen.getByRole('button', { name: '确认推送' })).toBeDisabled();
    expect(screen.getByRole('dialog', { name: '推送学习任务' })).toHaveTextContent('样板班');
    expect(screen.getByRole('dialog', { name: '推送学习任务' })).toHaveTextContent('预计推送给 1 名学生。');

    fireEvent.click(confirmation);
    expect(screen.getByRole('button', { name: '确认推送' })).toBeEnabled();
  });

  it('requires a fresh confirmation for a class experiment assignment and explains the student handoff', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '布置课前' }));
    const scope = await screen.findByRole('combobox', { name: '分配范围' });
    fireEvent.keyDown(scope, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: '指定班级' }));

    const dialog = screen.getByRole('dialog', { name: '布置课前实验' });
    const confirmation = screen.getByRole('checkbox', { name: /我确认本次将向样板班的 1 名学生/ });
    expect(confirmation).not.toBeChecked();
    expect(screen.getByRole('button', { name: '确认布置' })).toBeDisabled();
    expect(dialog).toHaveTextContent('目标：样板班 · 1 名学生');
    expect(dialog).toHaveTextContent('我的任务 → 课前实验任务');
    expect(dialog).toHaveTextContent('程序无故障运行至正常结束后点击“完成实验”');
    expect(dialog).toHaveTextContent('推送回查 → 本教师布置的实验任务');

    fireEvent.click(confirmation);
    expect(screen.getByRole('button', { name: '确认布置' })).toBeEnabled();

    const experiment = screen.getByRole('combobox', { name: '选择实验' });
    fireEvent.keyDown(experiment, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: /exp02.*实验二：指令系统实验/ }));
    expect(confirmation).not.toBeChecked();
    expect(screen.getByRole('button', { name: '确认布置' })).toBeDisabled();
    expect(dialog).toHaveTextContent('至少 20 条指令');
    expect(dialog).toHaveTextContent('五种数据寻址方式');
  });

  it('does not open supplemental intervention when the manageable student is outside the requested batch', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => ({
        student: 'student-1', batchId: 'batch_1', action: 'intervene', topic: ADDRESSING_TOPIC_ID,
      }[key] ?? null)),
    } as any);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect?batchId=batch_1') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: 'batch_1', totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    expect(await screen.findByText('目标学生不属于当前回查批次，未打开补充干预。请返回推送回查重新选择。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回推送回查' })).toHaveAttribute('href', '/teacher/pushed');
    expect(screen.queryByRole('dialog', { name: '推送学习任务' })).not.toBeInTheDocument();
  });

  it('does not silently select another student when a drill-down target is no longer manageable', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => ({
        student: 'removed-student', batchId: 'batch_1', action: 'intervene', topic: ADDRESSING_TOPIC_ID,
      }[key] ?? null)),
    } as any);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect?batchId=batch_1') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: 'batch_1', totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    expect(await screen.findByText('目标学生已不在当前教师可管理范围，请返回推送回查重新选择。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回推送回查' })).toHaveAttribute('href', '/teacher/pushed');
    expect(screen.queryByRole('dialog', { name: '推送学习任务' })).not.toBeInTheDocument();
    expect(screen.getByText('未选择学生')).toBeInTheDocument();
  });

  it('suppresses rapid duplicate task pushes before the button rerenders as disabled', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    let resolvePush!: (response: Response) => void;
    const pendingPush = new Promise<Response>((resolve) => { resolvePush = resolve; });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/push-learning-task') return pendingPush;
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '推送任务' }));
    const topic = await screen.findByRole('combobox', { name: '教学内容' });
    fireEvent.keyDown(topic, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('option', { name: '章节强化任务（兼容原任务）' }));
    const submit = await screen.findByRole('button', { name: '确认推送' });
    const studentSearch = screen.getByPlaceholderText('搜索学生...');

    act(() => {
      submit.click();
      fireEvent.change(studentSearch, { target: { value: '不应写入' } });
      fireEvent.keyDown(window, { key: 'Escape' });
      submit.click();
    });

    expect(mockFetch.mock.calls.filter(([input]) => String(input) === '/api/teacher/push-learning-task')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: '推送学习任务' })).toBeInTheDocument();
    expect(studentSearch).toHaveValue('');
    expect(screen.getByRole('combobox', { name: '教学内容' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '推送范围' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '任务类型' })).toBeDisabled();
    expect(screen.getByLabelText('模块数量（1-10 章）')).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭推送学习任务对话框' })).toBeDisabled();
    expect(screen.getByPlaceholderText('搜索学生...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /样板学生 S001 82/ })).toBeDisabled();
    resolvePush(jsonResponse(409, {
      error: '目标学生已有进行中的学习路径', code: 'ACTIVE_PATH_EXISTS', confirmationState: 'REQUIRED',
      activePathCount: 1, targetCount: 1, replacementToken: 'replace_fresh_token',
    }));
    expect(await screen.findByRole('button', { name: '暂停原路径并推送' })).toBeInTheDocument();
  });

  it('requires a second review when the server reports that replacement confirmation is stale', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    let pushCount = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/push-learning-task') {
        pushCount += 1;
        return pushCount === 1
          ? jsonResponse(409, {
            error: '目标学生已有进行中的学习路径', code: 'ACTIVE_PATH_EXISTS', confirmationState: 'REQUIRED',
            activePathCount: 1, targetCount: 1, replacementToken: 'replace_first_token',
          })
          : jsonResponse(409, {
            error: '替换确认已失效或任务状态已变化，请核对后再次确认', code: 'ACTIVE_PATH_EXISTS', confirmationState: 'STALE',
            activePathCount: 2, targetCount: 1, replacementToken: 'replace_second_token',
          });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '推送任务' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认推送' }));
    fireEvent.click(await screen.findByRole('button', { name: '暂停原路径并推送' }));

    expect(await screen.findByText('上一次确认已过期或期间任务状态发生变化，请重新核对本次影响。')).toBeInTheDocument();
    expect(screen.getByText(/有 2 条进行中的学习路径/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停原路径并推送' })).toBeEnabled();
  });

  it('persists an ambiguous push without credentials and confirms it by read-only lookup after refresh', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    let pushCount = 0;
    let requestId = '';
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/push-learning-task') {
        pushCount += 1;
        requestId = String((JSON.parse(String(init?.body)) as Record<string, unknown>).requestId);
        if (pushCount === 1) {
          return jsonResponse(409, {
            error: '目标学生已有进行中的学习路径', code: 'ACTIVE_PATH_EXISTS', confirmationState: 'REQUIRED',
            activePathCount: 1, targetCount: 1, replacementToken: 'replace_retry_token',
          });
        }
        if (pushCount === 2) throw new TypeError('Failed to fetch');
        throw new Error('A pending push must never be replayed automatically');
      }
      if (url === '/api/teacher/pushed') {
        const batchId = `batch_${createHash('sha256')
          .update(`${teacher.id}:${requestId}`)
          .digest('hex')
          .slice(0, 20)}`;
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: {
            totalStudents: 1,
            experiments: [],
            paths: [{ batchId, totalStudents: 1, students: [{ id: 'student-1' }] }],
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const firstView = render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '推送任务' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认推送' }));
    fireEvent.click(await screen.findByRole('button', { name: '暂停原路径并推送' }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '推送失败',
      description: expect.stringContaining('结果暂未确认，可能已经生效'),
    })));
    expect(screen.getByText(/有 1 条进行中的学习路径/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新读取核对' })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: '教学内容' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '推送范围' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭推送学习任务对话框' })).toBeDisabled();
    const bodiesBeforeRetry = mockFetch.mock.calls
      .filter(([input]) => String(input) === '/api/teacher/push-learning-task')
      .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>);
    expect(bodiesBeforeRetry).toHaveLength(2);
    expect(bodiesBeforeRetry[1]?.requestId).toBe(bodiesBeforeRetry[0]?.requestId);
    expect(bodiesBeforeRetry[1]).toMatchObject({ replaceExisting: true, replacementToken: 'replace_retry_token' });

    const pendingKey = 'teacher-pending-action-v1:teacher-1';
    const serialized = window.sessionStorage.getItem(pendingKey);
    expect(serialized).not.toBeNull();
    expect(JSON.parse(serialized ?? '{}')).toMatchObject({
      teacherId: 'teacher-1',
      requestId,
      operation: 'PUSH_TASK',
      targetRange: {
        scope: 'STUDENTS', targetClassId: null, studentIds: ['student-1'], targetCount: 1,
      },
      bodySummary: {
        topicId: ADDRESSING_TOPIC_ID, pathType: 'BASIC', moduleCount: 5, replaceExisting: true,
      },
      createdAt: expect.any(Number),
    });
    expect(serialized).not.toContain('teacher-token');
    expect(serialized).not.toContain('replace_retry_token');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('"body"');

    firstView.unmount();
    render(<HyperTeacherPage />);

    await waitFor(() => expect(mockFetch.mock.calls.filter(([input]) => String(input) === '/api/teacher/pushed')).toHaveLength(1));
    await waitFor(() => expect(window.sessionStorage.getItem(pendingKey)).toBeNull());
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已核对推送结果' })));
    expect(mockFetch.mock.calls.filter(([input]) => String(input) === '/api/teacher/push-learning-task')).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith('/api/teacher/pushed', expect.objectContaining({
      headers: { Authorization: 'Bearer teacher-token' },
      cache: 'no-store',
    }));
    expect(window.sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('persists an ambiguous assignment and confirms it by read-only lookup after refresh', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    let assignCount = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/assign-preclass') {
        assignCount += 1;
        if (assignCount === 1) throw new TypeError('Failed to fetch');
        throw new Error('A pending assignment must never be replayed automatically');
      }
      if (url === '/api/teacher/pushed') {
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: {
            totalStudents: 1,
            experiments: [{
              experimentId: 'exp01', uniqueStudents: 1, students: [{ id: 'student-1' }],
            }],
            paths: [],
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const firstView = render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '布置课前' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认布置' }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: '布置失败',
      description: expect.stringContaining('页面已锁定本次内容'),
    })));
    expect(screen.getByRole('combobox', { name: '选择实验' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: '分配范围' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭布置课前实验对话框' })).toBeDisabled();
    expect(screen.getByPlaceholderText('搜索学生...')).toBeDisabled();
    expect(screen.getByRole('button', { name: '重新读取核对' })).toBeEnabled();
    const pendingKey = 'teacher-pending-action-v1:teacher-1';
    const serialized = window.sessionStorage.getItem(pendingKey);
    expect(JSON.parse(serialized ?? '{}')).toMatchObject({
      teacherId: 'teacher-1',
      operation: 'ASSIGN_EXPERIMENT',
      targetRange: {
        scope: 'STUDENTS', targetClassId: null, studentIds: ['student-1'], targetCount: 1,
      },
      bodySummary: { experimentId: 'exp01' },
      createdAt: expect.any(Number),
    });
    expect(serialized).not.toContain('teacher-token');
    expect(serialized).not.toContain('Authorization');
    expect(serialized).not.toContain('"body"');

    firstView.unmount();
    render(<HyperTeacherPage />);

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已核对布置结果' })));
    expect(mockFetch.mock.calls.filter(([request]) => String(request) === '/api/teacher/assign-preclass')).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/teacher/pushed', expect.objectContaining({
      headers: { Authorization: 'Bearer teacher-token' },
      cache: 'no-store',
    }));
    expect(window.sessionStorage.getItem(pendingKey)).toBeNull();
  });

  it('keeps an unconfirmed restored action locked until an explicit abandon is followed by a successful read', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const pendingKey = 'teacher-pending-action-v1:teacher-1';
    window.sessionStorage.setItem(pendingKey, JSON.stringify({
      teacherId: 'teacher-1',
      requestId: 'pending-push-1234',
      operation: 'PUSH_TASK',
      targetRange: {
        scope: 'STUDENTS', targetClassId: null, studentIds: ['student-1'], targetCount: 1,
      },
      bodySummary: {
        topicId: ADDRESSING_TOPIC_ID, pathType: 'BASIC', moduleCount: 5, replaceExisting: false,
      },
      createdAt: Date.now(),
    }));
    let pushedReads = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/pushed') {
        pushedReads += 1;
        return jsonResponse(200, {
          success: true,
          dataProvenance: demoProvenance,
          data: { totalStudents: 1, experiments: [], paths: [] },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    expect(await screen.findByText(/当前仍保持锁定/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(pendingKey)).not.toBeNull();
    expect(screen.getByRole('button', { name: '关闭推送学习任务对话框' })).toBeDisabled();
    expect(mockFetch.mock.calls.some(([input]) => String(input) === '/api/teacher/push-learning-task')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '放弃待核对并重新读取' }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已放弃待确认操作' })));
    expect(pushedReads).toBe(2);
    expect(window.sessionStorage.getItem(pendingKey)).toBeNull();
    expect(mockFetch.mock.calls.some(([input]) => String(input) === '/api/teacher/push-learning-task')).toBe(false);
  });

  it('expires a restored pending action after thirty minutes without reading or replaying it', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const pendingKey = 'teacher-pending-action-v1:teacher-1';
    window.sessionStorage.setItem(pendingKey, JSON.stringify({
      teacherId: 'teacher-1',
      requestId: 'expired-push-1234',
      operation: 'PUSH_TASK',
      targetRange: {
        scope: 'STUDENTS', targetClassId: null, studentIds: ['student-1'], targetCount: 1,
      },
      bodySummary: {
        topicId: ADDRESSING_TOPIC_ID, pathType: 'BASIC', moduleCount: 5, replaceExisting: false,
      },
      createdAt: Date.now() - (30 * 60 * 1000),
    }));
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    await screen.findByText('教师工作台');
    expect(window.sessionStorage.getItem(pendingKey)).toBeNull();
    expect(window.sessionStorage.removeItem).toHaveBeenCalledWith(pendingKey);
    expect(screen.queryByRole('dialog', { name: '推送学习任务' })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.some(([input]) => String(input) === '/api/teacher/pushed')).toBe(false);
    expect(mockFetch.mock.calls.some(([input]) => String(input) === '/api/teacher/push-learning-task')).toBe(false);
  });

  it('binds award reasons to each student and confirms the exact student and reason before writing', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const dashboardWithTwoStudents = {
      ...dashboard,
      overview: { ...dashboard.overview, totalStudents: 2 },
      students: [
        ...dashboard.students,
        { id: 'student-2', name: '学生乙', studentId: 'S002', class: '样板班', classes: [{ id: 'class-1', name: '样板班' }], avgScore: 76 },
      ],
    };
    let rejectAward!: (reason?: unknown) => void;
    let awardCount = 0;
    const firstAward = new Promise<Response>((_resolve, reject) => { rejectAward = reject; });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboardWithTwoStudents);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/achievements') {
        awardCount += 1;
        if (awardCount === 1) return firstAward;
        return jsonResponse(200, { success: false, message: '成就已解锁' });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    const reason = screen.getByRole('textbox', { name: '表彰理由' });
    const firstStudent = screen.getByRole('button', { name: /样板学生 S001 82/ });
    const secondStudent = screen.getByRole('button', { name: /学生乙 S002 76/ });

    fireEvent.change(reason, { target: { value: '学生甲完成了课堂演示。' } });
    fireEvent.click(secondStudent);
    expect(reason).toHaveValue('');
    fireEvent.change(reason, { target: { value: '学生乙独立核对了寻址结果。' } });
    fireEvent.click(firstStudent);
    expect(reason).toHaveValue('学生甲完成了课堂演示。');
    fireEvent.click(secondStudent);
    expect(reason).toHaveValue('学生乙独立核对了寻址结果。');

    fireEvent.click(screen.getByRole('button', { name: '核对并授予徽章' }));
    const confirmation = await screen.findByRole('alertdialog', { name: '确认课堂表彰' });
    expect(confirmation).toHaveTextContent('学生：学生乙');
    expect(confirmation).toHaveTextContent('学生乙独立核对了寻址结果。');
    expect(mockFetch).not.toHaveBeenCalledWith('/api/achievements', expect.anything());
    expect(reason).toBeDisabled();
    expect(firstStudent).toBeDisabled();
    expect(secondStudent).toBeDisabled();

    const confirm = screen.getByRole('button', { name: '确认授予' });
    const cancel = screen.getByRole('button', { name: '返回修改' });
    act(() => {
      confirm.click();
      cancel.click();
      confirm.click();
    });
    expect(mockFetch.mock.calls.filter(([request]) => String(request) === '/api/achievements')).toHaveLength(1);
    expect(screen.getByRole('alertdialog', { name: '确认课堂表彰' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '正在授予' })).toBeDisabled();

    await act(async () => {
      rejectAward(new TypeError('Failed to fetch'));
      await Promise.resolve();
    });
    expect(await screen.findByText('上一次授予结果尚未确认。学生、徽章和理由已锁定，只能使用原请求核对。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回修改' })).toBeDisabled();
    const retry = screen.getByRole('button', { name: '核对原授予请求' });
    const firstBody = String((mockFetch.mock.calls.find(([request]) => String(request) === '/api/achievements')?.[1] as RequestInit).body);

    fireEvent.click(retry);

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '已核对授予结果' })));
    const awardBodies = mockFetch.mock.calls
      .filter(([request]) => String(request) === '/api/achievements')
      .map(([, init]) => String((init as RequestInit).body));
    expect(awardBodies).toEqual([firstBody, firstBody]);
    expect(screen.queryByRole('alertdialog', { name: '确认课堂表彰' })).not.toBeInTheDocument();
    fireEvent.click(firstStudent);
    expect(reason).toHaveValue('学生甲完成了课堂演示。');
  });

  it('clears stale dashboard data and offers login recovery when a push returns 401', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      if (url === '/api/teacher/push-learning-task') return jsonResponse(401, { error: '令牌无效' });
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);
    await screen.findByText('教师工作台');
    fireEvent.click(screen.getByRole('button', { name: '推送任务' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认推送' }));

    expect(await screen.findByRole('heading', { name: '教师数据暂不可用' })).toBeInTheDocument();
    expect(screen.getByText('登录已过期，请重新登录后继续')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', '/login?from=%2Fteacher');
    expect(screen.queryByText('样板学生')).not.toBeInTheDocument();
  });

  it('clears previously loaded student data when a retry finds an expired token', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboard);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期数据加载失败' });
      if (url.startsWith('/api/teacher/intervention-effect')) {
        return jsonResponse(200, {
          interventions: [{
            studentId: 'student-1', name: '样板学生', studentCode: 'S001', interventionDate: '2026-07-16T00:00:00.000Z',
            preAvg: 82, postAvg: 78, gain: -4, preCount: 1, postCount: 1,
            topicId: '3.1', comparisonLabel: '前测 → 后测', experimentStatus: 'COMPLETED',
            taskStatus: 'ACTIVE', currentStep: 5, totalSteps: 6,
          }],
          summary: { totalStudents: 1, withBothScores: 1, improved: 0, improvementRate: 0, avgGain: -4 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    expect((await screen.findAllByText('样板学生')).length).toBeGreaterThan(0);
    expect(screen.getByText('平均变化（可比较）')).toBeInTheDocument();
    const retryButton = await screen.findByRole('button', { name: '重新读取教学周期' });

    storedToken = null;
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByRole('heading', { name: '教师数据暂不可用' })).toBeInTheDocument());
    expect(screen.getByText('登录已过期，请重新登录后继续')).toBeInTheDocument();
    expect(screen.queryAllByText('样板学生')).toHaveLength(0);
  });

  it('retries teaching-cycle data without refetching healthy dashboard or review data', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    let dashboardReads = 0;
    let cycleReads = 0;
    let interventionReads = 0;
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') {
        dashboardReads += 1;
        return jsonResponse(200, dashboard);
      }
      if (url === '/api/teacher/teaching-cycle') {
        cycleReads += 1;
        return cycleReads === 1
          ? jsonResponse(503, { error: '教学周期暂不可用' })
          : jsonResponse(200, { postClass: { totalStudents: 1 } });
      }
      if (url === '/api/teacher/intervention-effect') {
        interventionReads += 1;
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    fireEvent.click(await screen.findByRole('button', { name: '重新读取教学周期' }));
    await waitFor(() => expect(cycleReads).toBe(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: '重新读取教学周期' })).not.toBeInTheDocument());
    expect(dashboardReads).toBe(1);
    expect(interventionReads).toBe(1);
  });

  it('cancels an obsolete review request when the requested batch changes', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    let requestedBatch = 'batch_1';
    let dashboardReads = 0;
    let obsoleteSignal: AbortSignal | undefined;
    mockUseSearchParams.mockReturnValue({
      get: jest.fn((key: string) => key === 'batchId' ? requestedBatch : null),
    } as any);
    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') {
        dashboardReads += 1;
        return Promise.resolve(jsonResponse(200, dashboard));
      }
      if (url === '/api/teacher/teaching-cycle') {
        return Promise.resolve(jsonResponse(503, { error: '教学周期暂不可用' }));
      }
      if (url === '/api/teacher/intervention-effect?batchId=batch_1') {
        obsoleteSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          obsoleteSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
        });
      }
      if (url === '/api/teacher/intervention-effect?batchId=batch_2') {
        return Promise.resolve(jsonResponse(200, {
          interventions: [{
            studentId: 'student-1', name: '样板学生', studentCode: 'S001', interventionDate: '2026-07-16T00:00:00.000Z',
            preAvg: 60, postAvg: 80, gain: 20, preCount: 1, postCount: 1,
            topicId: ADDRESSING_TOPIC_ID, comparisonLabel: '专项首测 / 再次测评', experimentStatus: 'COMPLETED',
            taskStatus: 'COMPLETED', currentStep: 6, totalSteps: 6,
          }],
          summary: { batchId: 'batch_2', totalStudents: 1, withBothScores: 1, improved: 1, improvementRate: 100, avgGain: 20 },
        }));
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const view = render(<HyperTeacherPage />);
    expect(await screen.findByText('正在读取批次 batch_1 的任务复核数据…')).toBeInTheDocument();

    requestedBatch = 'batch_2';
    view.rerender(<HyperTeacherPage />);

    expect(await screen.findByText('批次 batch_2')).toBeInTheDocument();
    expect(obsoleteSignal?.aborted).toBe(true);
    expect(dashboardReads).toBe(1);
  });

  it('turns a stalled dashboard read into a recoverable timeout state', async () => {
    jest.useFakeTimers();
    try {
      mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
      mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === '/api/teacher/dashboard') {
          const signal = init?.signal;
          return new Promise<Response>((_resolve, reject) => {
            signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
          });
        }
        if (url === '/api/teacher/teaching-cycle') {
          return Promise.resolve(jsonResponse(503, { error: '教学周期暂不可用' }));
        }
        if (url === '/api/teacher/intervention-effect') {
          return Promise.resolve(jsonResponse(200, {
            interventions: [],
            summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
          }));
        }
        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      render(<HyperTeacherPage />);
      await act(async () => {
        jest.advanceTimersByTime(15_000);
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }

    expect(await screen.findByRole('heading', { name: '教师数据暂不可用' })).toBeInTheDocument();
    expect(screen.getByText('教师仪表板数据读取超时，请检查网络后重试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('restores the search and selected student after returning in the same browser session', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const dashboardWithTwoStudents = {
      ...dashboard,
      overview: { ...dashboard.overview, totalStudents: 2 },
      students: [
        ...dashboard.students,
        { id: 'student-2', name: '学生乙', studentId: 'S002', avgScore: 76 },
      ],
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboardWithTwoStudents);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期暂不可用' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const firstView = render(<HyperTeacherPage />);
    fireEvent.click(await screen.findByRole('button', { name: /学生乙/ }));
    fireEvent.change(screen.getByPlaceholderText('搜索学生...'), { target: { value: '学生乙' } });
    await waitFor(() => expect(window.sessionStorage.setItem).toHaveBeenCalled());
    firstView.unmount();

    render(<HyperTeacherPage />);

    await waitFor(() => expect(screen.getByPlaceholderText('搜索学生...')).toHaveValue('学生乙'));
    expect(screen.getByRole('heading', { name: /学生乙/ })).toBeInTheDocument();
  });

  it('keeps missing records distinct from real zero values and exposes student selection at the mobile entry', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const dashboardWithRecordStates = {
      ...dashboard,
      overview: {
        ...dashboard.overview,
        totalStudents: 2,
        avgQuizScore: 0,
        avgExpCompletion: 0,
        avgTimeSpent: 0,
        quizAttemptCount: 1,
        experimentRecordCount: 1,
        learningProgressCount: 1,
      },
      students: [{
        id: 'student-empty', name: '未作答学生', studentId: 'S001', class: '样板班',
        avgQuizScore: 0, quizAttemptCount: 0,
        experimentsCompleted: 0, experimentsTotal: 0,
        totalTimeSpent: 0, learningProgressCount: 0, activityCount: 0,
      }, {
        id: 'student-zero', name: '真实零分', studentId: 'S002', class: '样板班',
        avgQuizScore: 0, quizAttemptCount: 1,
        experimentsCompleted: 0, experimentsTotal: 1,
        totalTimeSpent: 0, learningProgressCount: 1, activityCount: 0,
      }],
      alertStudents: [{
        id: 'student-zero', name: '真实零分', studentId: 'S002', avg: 0, quizAttemptCount: 1,
        experimentsCompleted: 0, experimentsTotal: 1, weakChapters: [],
      }],
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboardWithRecordStates);
      if (url === '/api/teacher/teaching-cycle') {
        return jsonResponse(200, {
          inClass: {
            totalEvents: 1, totalDuration: 0, avgDurationPerStudent: 0, durationRecordCount: 1,
            recentActiveStudents: 1, dailyActivity: [], participationRate: 50,
          },
          postClass: {
            totalStudents: 2, comparableStudentCount: 0, quizParticipantCount: 1,
            topStudents: [{ name: '真实零分', avgScore: 0, attemptCount: 1 }],
          },
        });
      }
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    const emptyStudentButton = await screen.findByRole('button', { name: /未作答学生 S001 未作答/ });
    expect(emptyStudentButton).toBeInTheDocument();
    const emptyDetail = screen.getByRole('heading', { name: /未作答学生/ }).closest('section');
    expect(emptyDetail).not.toBeNull();
    expect(within(emptyDetail as HTMLElement).getAllByText('暂无记录')).toHaveLength(3);
    expect(screen.getByText('暂无可比较的分阶段作答记录。每名学生至少完成 2 次测验后，才计算较早与较晚记录变化。')).toBeInTheDocument();
    expect(screen.getByText('已作答学生排名')).toBeInTheDocument();
    expect(screen.getAllByText('0% · 1次').length).toBeGreaterThan(0);
    expect(screen.getByText('实验 0/1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '选择学生，当前为未作答学生' }));
    expect(await screen.findByRole('dialog', { name: '选择学生' })).toBeInTheDocument();
    expect(screen.getByLabelText('搜索学生')).toBeInTheDocument();
    const zeroStudentButtons = screen.getAllByRole('button', { name: /真实零分 S002 0%/ });
    fireEvent.click(zeroStudentButtons[zeroStudentButtons.length - 1]!);

    const zeroDetail = screen.getByRole('heading', { name: /真实零分/ }).closest('section');
    expect(zeroDetail).not.toBeNull();
    expect(within(zeroDetail as HTMLElement).getByText('0%')).toBeInTheDocument();
    expect(within(zeroDetail as HTMLElement).getByText('0/1')).toBeInTheDocument();
    expect(within(zeroDetail as HTMLElement).getByText('0 min')).toBeInTheDocument();
  });

  it('states that warning evidence is unavailable when nobody has submitted a quiz', async () => {
    mockUseAuth.mockReturnValue({ user: teacher } as ReturnType<typeof useAuth>);
    const dashboardWithoutQuizRecords = {
      ...dashboard,
      overview: {
        ...dashboard.overview,
        avgQuizScore: 0,
        quizAttemptCount: 0,
      },
      students: dashboard.students.map((student) => ({
        ...student,
        avgQuizScore: 0,
        quizAttemptCount: 0,
      })),
      alertStudents: [],
    };
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/teacher/dashboard') return jsonResponse(200, dashboardWithoutQuizRecords);
      if (url === '/api/teacher/teaching-cycle') return jsonResponse(503, { error: '教学周期暂不可用' });
      if (url === '/api/teacher/intervention-effect') {
        return jsonResponse(200, {
          interventions: [],
          summary: { batchId: null, totalStudents: 0, withBothScores: 0, improved: 0, improvementRate: 0, avgGain: 0 },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<HyperTeacherPage />);

    expect(await screen.findByText('暂无测验作答记录，当前无法判断低分预警')).toBeInTheDocument();
    expect(screen.queryByText('全班成绩良好，暂无预警')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /样板学生 S001 未作答/ })).toBeInTheDocument();
  });
});

describe('OBE objective administration recovery states', () => {
  const admin = {
    id: 'admin-1',
    email: 'admin@example.com',
    username: 'admin',
    name: '测试管理员',
    role: 'ADMIN' as const,
  };
  const logout = jest.fn(async () => undefined);
  const indicator = {
    id: 'ip-1',
    code: '1-3',
    description: '运用计算知识和工具',
    achievementThreshold: 0.65,
    graduationRequirement: { code: 'GR01', name: '工程知识' },
  };
  const objective = {
    id: 'co-2',
    code: 'CO2',
    name: '具备8051指令系统与程序设计能力',
    description: '掌握指令系统',
    supportWeight: 0.4,
    version: 3,
    isActive: true,
    indicatorPoint: indicator,
    assessmentLinks: [{
      id: 'link-1',
      assessmentType: 'EXPERIMENT',
      assessmentTargetId: 'exp02',
      weight: 1,
      maxScore: 100,
      chapter: null,
      description: '实验二：指令系统实验',
      resolvedDescription: '实验二：指令系统实验',
      resourceValid: true,
    }],
    totalWeight: 1,
    configurationIssues: [],
  };
  const resources = [{
    type: 'EXPERIMENT',
    targetId: 'exp02',
    chapter: null,
    description: '实验二：指令系统实验',
  }];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: admin,
      loading: false,
      logout,
    } as unknown as ReturnType<typeof useAuth>);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => key === 'accessToken' ? 'admin-token' : null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
    });
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => '11111111-2222-4333-8444-555555555555'),
    });
    global.fetch = mockFetch as typeof fetch;
  });

  function installObjectiveReads(writeHandler?: (url: string, init?: RequestInit) => Promise<Response>) {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/obe/course-objectives' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(200, { objectives: [objective], assessmentResources: resources });
      }
      if (url === '/api/obe/graduation-requirements') {
        return jsonResponse(200, {
          graduationRequirements: [{
            code: 'GR01',
            name: '工程知识',
            indicatorPoints: [{
              id: indicator.id,
              code: indicator.code,
              description: indicator.description,
              achievementThreshold: indicator.achievementThreshold,
            }],
          }],
        });
      }
      if (url === '/api/obe/course-objectives/co-2' && (!init?.method || init.method === 'GET')) {
        return jsonResponse(200, {
          objective,
          impact: {
            achievementRecordCount: 8,
            affectedStudentCount: 2,
            affectedClassCount: 1,
            affectedSemesterCount: 1,
            latestCalculatedAt: '2026-07-18T10:00:00.000Z',
            recordsWillBeRetained: true,
            requiresRecalculation: true,
          },
        });
      }
      if (writeHandler) return writeHandler(url, init);
      throw new Error(`Unexpected request: ${url}`);
    });
  }

  async function openObjectiveEditor() {
    render(<ObjectivesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /具备8051指令系统与程序设计能力/ }));
    fireEvent.click(screen.getByRole('button', { name: '管理此目标' }));
    expect(await screen.findByText('受控配置 · CO2')).toBeInTheDocument();
  }

  it('shows retained-record impact before exposing any administrator write action', async () => {
    installObjectiveReads();
    await openObjectiveEditor();

    expect(screen.getByText('达成度记录').parentElement).toHaveTextContent('8');
    expect(screen.getByText('涉及学生').parentElement).toHaveTextContent('2');
    expect(screen.getByText('涉及班级').parentElement).toHaveTextContent('1');
    expect(screen.getByText('涉及学期').parentElement).toHaveTextContent('1');
    expect(screen.getByText(/历史记录会保留/)).toBeInTheDocument();
    expect(screen.getByText(/当前版本 v3/)).toBeInTheDocument();
    expect(document.querySelectorAll('main')).toHaveLength(0);
    expect(document.querySelector('section[aria-labelledby="obe-objectives-page-title"]')).toBeInTheDocument();
  });

  it('blocks deactivation until the administrator explicitly confirms the displayed impact', async () => {
    installObjectiveReads();
    await openObjectiveEditor();

    fireEvent.click(screen.getByRole('button', { name: '确认停用此目标' }));

    expect(screen.getByRole('alert')).toHaveTextContent('请先核对并确认下方影响范围');
    expect(mockFetch).not.toHaveBeenCalledWith('/api/obe/course-objectives/co-2', expect.objectContaining({ method: 'PATCH' }));
  });

  it('reuses the same request after an ambiguous deactivation response', async () => {
    const submittedBodies: Array<Record<string, unknown>> = [];
    let writes = 0;
    installObjectiveReads(async (url, init) => {
      if (url !== '/api/obe/course-objectives/co-2' || init?.method !== 'PATCH') {
        throw new Error(`Unexpected request: ${url}`);
      }
      submittedBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      writes += 1;
      if (writes === 1) throw new TypeError('Failed to fetch');
      return jsonResponse(200, { objective: { ...objective, isActive: false, version: 4 }, duplicate: true });
    });
    await openObjectiveEditor();

    fireEvent.click(screen.getByRole('checkbox', { name: /我已核对当前版本/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认停用此目标' }));
    const retryButton = await screen.findByRole('button', { name: '使用原请求重试' });
    await waitFor(() => expect(retryButton).toBeEnabled());
    expect(screen.getByRole('button', { name: '关闭配置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消编辑' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '确认停用此目标' })).toBeDisabled();
    const protectedExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(protectedExit);
    expect(protectedExit.defaultPrevented).toBe(true);

    fireEvent.click(retryButton);
    expect(await screen.findByText('已恢复同一配置请求并核对服务端结果')).toBeInTheDocument();
    expect(submittedBodies).toHaveLength(2);
    expect(submittedBodies[0]).toEqual(submittedBodies[1]);
    expect(submittedBodies[0]).toMatchObject({
      expectedVersion: 3,
      isActive: false,
      confirm: 'APPLY_OBJECTIVE_CONFIGURATION',
    });
    const settledExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(settledExit);
    expect(settledExit.defaultPrevented).toBe(false);
  });

  it('keeps the editor locked until the administrator explicitly abandons an uncertain request', async () => {
    installObjectiveReads(async (url, init) => {
      if (url === '/api/obe/course-objectives/co-2' && init?.method === 'PATCH') {
        throw new TypeError('Failed to fetch');
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await openObjectiveEditor();

    fireEvent.click(screen.getByRole('checkbox', { name: /我已核对当前版本/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认停用此目标' }));
    const abandon = await screen.findByRole('button', { name: '明确放弃原请求' });
    await waitFor(() => expect(abandon).toBeEnabled());
    expect(screen.getByRole('button', { name: '关闭配置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消编辑' })).toBeDisabled();

    fireEvent.click(abandon);
    expect(screen.getByText(/服务端可能已经执行该请求/).closest('[role="alert"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭配置' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消编辑' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '确认放弃并重新读取' }));
    expect(await screen.findByText(/已明确放弃原请求，正在重新读取服务端版本/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '关闭配置' })).toBeEnabled());
    expect(screen.getByRole('button', { name: '取消编辑' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '使用原请求重试' })).not.toBeInTheDocument();
    const releasedExit = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(releasedExit);
    expect(releasedExit.defaultPrevented).toBe(false);
  });

  it('does not submit an incomplete assessment weight set for an active objective', async () => {
    installObjectiveReads();
    await openObjectiveEditor();

    fireEvent.change(screen.getByRole('spinbutton', { name: '权重（%）' }), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /我已核对当前版本/ }));
    fireEvent.click(screen.getByRole('button', { name: '保存考核映射' }));

    expect(screen.getByRole('alert')).toHaveTextContent('考核权重合计必须保持为 100%');
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/obe/course-objectives/co-2/assessment-links',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('OBE teacher calculation freshness and recovery states', () => {
  const teacher = {
    id: 'teacher-1',
    email: 'teacher@example.com',
    username: 'teacher',
    name: '测试教师',
    role: 'TEACHER' as const,
  };
  const logout = jest.fn(async () => undefined);
  const demoProvenance = {
    mode: 'DEMO',
    label: '演示数据',
    note: '当前为竞赛功能演示环境，不用于证明教学成效。',
  } as const;
  const configurationRevision = 'abcdef1234567890abcd';
  const scopeRevision = '0123456789abcdef01234567';
  const status = {
    configurationRevision,
    configurationUpdatedAt: '2026-07-18T10:00:00.000Z',
    targetCount: 2,
    expectedRecords: 2,
    freshRecords: 1,
    staleRecords: 1,
    missingRecords: 1,
    complete: false,
    lastCalculatedAt: '2026-07-18T11:00:00.000Z',
  };
  const studentReviews = [
    {
      userId: 'student-1',
      name: '学生甲',
      studentCode: 'S001',
      freshCourseObjectiveRecords: 1,
      staleCourseObjectiveRecords: 0,
      missingCourseObjectiveRecords: 0,
      freshIndicatorRecords: 1,
      staleIndicatorRecords: 0,
      missingIndicatorRecords: 0,
      complete: true,
      lastCalculatedAt: '2026-07-18T11:00:00.000Z',
    },
    {
      userId: 'student-2',
      name: '学生乙',
      studentCode: 'S002',
      freshCourseObjectiveRecords: 0,
      staleCourseObjectiveRecords: 1,
      missingCourseObjectiveRecords: 1,
      freshIndicatorRecords: 0,
      staleIndicatorRecords: 1,
      missingIndicatorRecords: 1,
      complete: false,
      lastCalculatedAt: null,
    },
  ];
  const classReview = {
    confirmationRequired: true,
    mode: 'class',
    targetUserId: null,
    targetCount: 2,
    objectiveCount: 1,
    indicatorPointCount: 1,
    expectedCourseObjectiveRecords: 2,
    currentCourseObjectiveRecords: 1,
    staleCourseObjectiveRecords: 1,
    missingCourseObjectiveRecords: 1,
    expectedIndicatorRecords: 2,
    currentIndicatorRecords: 1,
    staleIndicatorRecords: 1,
    missingIndicatorRecords: 1,
    configurationRevision,
    configurationUpdatedAt: '2026-07-18T10:00:00.000Z',
    scopeRevision,
    students: studentReviews,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/obe/teacher');
    mockUseAuth.mockReturnValue({
      user: teacher,
      loading: false,
      logout,
    } as unknown as ReturnType<typeof useAuth>);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: jest.fn((key: string) => key === 'accessToken' ? 'teacher-token' : null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    });
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() },
    });
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => '22222222-3333-4444-8555-666666666666'),
    });
    global.fetch = mockFetch as typeof fetch;
  });

  function installTeacherOBEReads(
    calculationHandler?: (body: Record<string, unknown>) => Promise<Response>,
    omitProvenanceFrom?: 'course-objective' | 'graduation-requirement' | 'review',
  ) {
    mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/classes?status=ACTIVE') {
        return jsonResponse(200, {
          classes: [{ id: 'class-1', name: '2025级1班', semester: '2025-2026-2', _count: { enrollments: 2 } }],
        });
      }
      if (url.startsWith('/api/obe/achievement/course-objective?')) {
        return jsonResponse(200, {
          ...(omitProvenanceFrom === 'course-objective' ? {} : { dataProvenance: demoProvenance }),
          achievements: [{
            courseObjectiveId: 'co-1',
            achievementDegree: 0.72,
            passed: true,
            courseObjective: { code: 'CO1', name: '课程目标一' },
          }],
          dataStatus: status,
        });
      }
      if (url.startsWith('/api/obe/achievement/graduation-requirement?')) {
        return jsonResponse(200, {
          ...(omitProvenanceFrom === 'graduation-requirement' ? {} : { dataProvenance: demoProvenance }),
          achievements: [{
            indicatorPointId: 'ip-1',
            achievementDegree: 0.7,
            passed: true,
            indicatorPoint: { code: '1-3', description: '运用计算知识和工具' },
          }],
          dataStatus: status,
        });
      }
      if (url.startsWith('/api/obe/achievement/calculate?') && (!init?.method || init.method === 'GET')) {
        return jsonResponse(200, {
          ...(omitProvenanceFrom === 'review' ? {} : { dataProvenance: demoProvenance }),
          review: classReview,
          configurationError: null,
        });
      }
      if (url === '/api/obe/achievement/calculate' && init?.method === 'POST' && calculationHandler) {
        return calculationHandler(JSON.parse(String(init.body)) as Record<string, unknown>);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
  }

  const calculationReviewResponse = () => jsonResponse(409, {
    error: '请核对计算范围',
    ...classReview,
  });

  it('isolates stale results and withholds class conclusions until current records are complete', async () => {
    installTeacherOBEReads();
    render(<OBETeacherPage />);

    expect(await screen.findByText('当前配置结果待补齐')).toBeInTheDocument();
    expect(screen.getByText('课程目标记录').parentElement).toHaveTextContent('1/2');
    expect(screen.getByText('指标点记录').parentElement).toHaveTextContent('1/2');
    expect(screen.getByText('已隔离旧记录').parentElement).toHaveTextContent('2');
    expect(screen.getByRole('heading', { name: '学生复核状态' })).toBeInTheDocument();
    expect(screen.getByText('已完整 1/2 人')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '仅重算 学生乙' })).toBeEnabled();
    const interventionLink = screen.getByRole('link', { name: '为 学生甲 补充干预' });
    const interventionUrl = new URL(interventionLink.getAttribute('href') ?? '', 'https://local.invalid');
    expect(interventionUrl.pathname).toBe('/teacher');
    expect(interventionUrl.searchParams.get('student')).toBe('student-1');
    expect(interventionUrl.searchParams.get('action')).toBe('intervene');
    expect(interventionUrl.searchParams.get('topic')).toBe(ADDRESSING_TOPIC_ID);
    expect(interventionUrl.searchParams.get('returnTo')).toBe('/obe/teacher?classId=class-1&semester=2025-2026-2');
    expect(screen.queryByRole('link', { name: '为 学生乙 补充干预' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '学生乙 的记录待补齐，暂不能补充干预' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '学生乙 的记录待补齐，暂不能补充干预' })).toHaveAttribute(
      'title',
      '先重算并补齐该学生当前记录，再根据达成结果决定是否干预',
    );
    expect(screen.getByText('当前版本记录尚不完整，暂不形成班级达成结论')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '总览' })).not.toBeInTheDocument();
    expect(screen.getByText('演示数据 · DEMO')).toBeInTheDocument();
    expect(screen.getByText(/仅用于验证教学流程与界面/)).toBeInTheDocument();
    const achievementReads = mockFetch.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.startsWith('/api/obe/achievement/'));
    expect(achievementReads).toHaveLength(3);
    expect(achievementReads.every((url) => url.includes('semester=2025-2026-2'))).toBe(true);
  });

  it('withholds all achievement values when any read source omits server data identity', async () => {
    installTeacherOBEReads(undefined, 'course-objective');
    render(<OBETeacherPage />);

    expect(await screen.findByText('达成度数据缺少有效的服务端数据身份，已停止展示成效数值')).toBeInTheDocument();
    expect(screen.getByText('数据身份未通过核验')).toBeInTheDocument();
    expect(screen.queryByText('课程目标记录')).not.toBeInTheDocument();
    expect(screen.queryByText('学生甲')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录' })).toHaveAttribute('href', expect.stringContaining('/login?from='));
  });

  it('filters the student review list by status, name and student code', async () => {
    installTeacherOBEReads();
    render(<OBETeacherPage />);

    const search = await screen.findByRole('searchbox', { name: '搜索学生姓名或学号' });
    fireEvent.click(screen.getByRole('button', { name: '待补齐 1' }));
    expect(screen.queryByText('学生甲')).not.toBeInTheDocument();
    expect(screen.getByText('学生乙')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'S001' } });
    expect(screen.getByText('没有符合当前搜索和状态筛选的学生')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '全部 2' }));
    expect(screen.getByText('学生甲')).toBeInTheDocument();
    expect(screen.queryByText('学生乙')).not.toBeInTheDocument();
  });

  it('distinguishes the read-only confirmation preflight from the confirmed calculation write', async () => {
    let resolvePreflight!: (response: Response) => void;
    const preflight = new Promise<Response>((resolve) => { resolvePreflight = resolve; });
    installTeacherOBEReads(async () => preflight);
    render(<OBETeacherPage />);

    const calculate = await screen.findByRole('button', { name: '核对并重新计算' });
    await waitFor(() => expect(calculate).toBeEnabled());
    fireEvent.click(calculate);
    expect(screen.getByRole('button', { name: '正在生成确认清单…' })).toBeDisabled();

    await act(async () => {
      resolvePreflight(calculationReviewResponse());
      await Promise.resolve();
    });
    expect(await screen.findByRole('dialog', { name: '提交前核对计算范围' })).toBeInTheDocument();
  });

  it('restores the originating class and semester after a supplemental intervention', async () => {
    window.history.replaceState(
      {},
      '',
      '/obe/teacher?classId=class-1&semester=2024-2025-1&intervention=sent',
    );
    installTeacherOBEReads();
    render(<OBETeacherPage />);

    expect(await screen.findByText('补充学习任务已提交，已返回原班级与学期继续复核。')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('2024-2025-1')).toBeInTheDocument();
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('classId=class-1&semester=2024-2025-1'),
      expect.anything(),
    ));
  });

  it('reviews and confirms only the selected student before a single-student recalculation', async () => {
    const submitted: Array<Record<string, unknown>> = [];
    installTeacherOBEReads(async (body) => {
      submitted.push(body);
      if (!body.confirm) {
        return jsonResponse(409, {
          error: '请核对单名学生',
          ...classReview,
          mode: 'user',
          targetUserId: 'student-2',
          targetCount: 1,
          expectedCourseObjectiveRecords: 1,
          currentCourseObjectiveRecords: 0,
          expectedIndicatorRecords: 1,
          currentIndicatorRecords: 0,
          students: [studentReviews[1]],
        });
      }
      return jsonResponse(200, { duplicate: false, mode: 'user', userId: 'student-2' });
    });
    render(<OBETeacherPage />);

    const recalculate = await screen.findByRole('button', { name: '仅重算 学生乙' });
    fireEvent.click(recalculate);

    expect(await screen.findByRole('dialog', { name: '提交前核对单名学生' })).toBeInTheDocument();
    expect(screen.getByText('目标学生').parentElement).toHaveTextContent('学生乙');
    expect(screen.getByText(/本次只更新所选学生/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认按此范围计算' }));

    expect(await screen.findByText('已完成 学生乙 在 2025-2026-2 的达成度计算')).toBeInTheDocument();
    expect(submitted).toHaveLength(2);
    expect(submitted[0]).toMatchObject({ classId: 'class-1', userId: 'student-2' });
    expect(submitted[0]).not.toHaveProperty('confirm');
    expect(submitted[1]).toMatchObject({
      classId: 'class-1',
      userId: 'student-2',
      confirm: 'CALCULATE_USER',
      expectedScopeRevision: scopeRevision,
    });
  });

  it('shows a server-derived class, semester, record and configuration review before calculation', async () => {
    installTeacherOBEReads(async () => calculationReviewResponse());
    render(<OBETeacherPage />);

    const calculate = await screen.findByRole('button', { name: '核对并重新计算' });
    await waitFor(() => expect(calculate).toBeEnabled());
    fireEvent.click(calculate);

    expect(await screen.findByRole('dialog', { name: '提交前核对计算范围' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: '提交前核对计算范围' })).toHaveFocus());
    expect(screen.getByText('2025级1班').parentElement).toHaveTextContent('2025-2026-2');
    expect(screen.getByText('有效学生').parentElement).toHaveTextContent('2');
    expect(screen.getByText(/当前版本已有课程目标记录 1\/2 条/)).toBeInTheDocument();
    expect(screen.getByText(/旧配置记录 2 条/)).toBeInTheDocument();
  });

  it('keeps the exact confirmed request available after an ambiguous response', async () => {
    const submitted: Array<Record<string, unknown>> = [];
    let confirmedWrites = 0;
    installTeacherOBEReads(async (body) => {
      submitted.push(body);
      if (!body.confirm) return calculationReviewResponse();
      confirmedWrites += 1;
      if (confirmedWrites === 1) throw new TypeError('Failed to fetch');
      return jsonResponse(200, { duplicate: true, studentCount: 2, scopeStale: false });
    });
    render(<OBETeacherPage />);

    const calculate = await screen.findByRole('button', { name: '核对并重新计算' });
    await waitFor(() => expect(calculate).toBeEnabled());
    fireEvent.click(calculate);
    fireEvent.click(await screen.findByRole('button', { name: '确认按此范围计算' }));
    const retry = await screen.findByRole('button', { name: '使用原请求重试' });
    fireEvent.click(retry);

    expect(await screen.findByText('已恢复同一计算请求，未重复写入')).toBeInTheDocument();
    expect(submitted).toHaveLength(3);
    expect(submitted[1]).toEqual(submitted[2]);
    expect(submitted[1]).toMatchObject({
      classId: 'class-1',
      semester: '2025-2026-2',
      confirm: 'CALCULATE_CLASS',
      expectedScopeRevision: scopeRevision,
    });
  });
});

describe('OBE student current-result states', () => {
  const student = {
    id: 'student-1',
    email: 'student@example.com',
    username: 'student',
    name: '样板学生',
    role: 'STUDENT' as const,
  };
  const baseStatus = {
    semester: '2025-2026-2',
    semesterSource: 'ACTIVE_CLASS',
    classId: 'class-1',
    className: '2025级1班',
    classScopeSource: 'ACTIVE_CLASS',
    availableClasses: [{ classId: 'class-1', className: '2025级1班', semester: '2025-2026-2' }],
    configurationRevision: 'abcdef1234567890abcd',
    configurationUpdatedAt: '2026-07-18T09:00:00.000Z',
    expectedCourseObjectiveRecords: 2,
    freshCourseObjectiveRecords: 1,
    staleCourseObjectiveRecords: 1,
    missingCourseObjectiveRecords: 1,
    expectedIndicatorRecords: 2,
    freshIndicatorRecords: 1,
    staleIndicatorRecords: 1,
    missingIndicatorRecords: 1,
    complete: false,
    lastCalculatedAt: '2026-07-18T10:00:00.000Z',
  };
  const withStudentEvidence = <T extends Record<string, unknown>>(body: T) => ({
    dataProvenance: demoProvenance,
    asOf: '2026-07-18T10:05:00.000Z',
    sampleSize: {
      students: 1,
      courseObjectiveRecords: Array.isArray(body.courseObjectives) ? body.courseObjectives.length : 0,
      indicatorRecords: Array.isArray(body.indicatorPoints) ? body.indicatorPoints.length : 0,
    },
    ...body,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/obe');
    global.fetch = mockFetch as typeof fetch;
    const createStorage = () => {
      const values = new Map<string, string>();
      return {
        getItem: jest.fn((key: string) => values.get(key) ?? null),
        setItem: jest.fn((key: string, value: string) => values.set(key, value)),
        removeItem: jest.fn((key: string) => values.delete(key)),
        clear: jest.fn(() => values.clear()),
      };
    };
    Object.defineProperty(window, 'localStorage', { configurable: true, value: createStorage() });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: createStorage() });
    storeAuth('student-token', student, 'persistent');
    mockUseAuth.mockReturnValue({
      user: student,
      loading: false,
      logout: jest.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it('restores an explicitly selected class and semester from the URL', async () => {
    window.history.replaceState({}, '', '/obe?classId=class-2&semester=2025-2026-2');
    mockFetch.mockResolvedValue(jsonResponse(200, withStudentEvidence({
      courseObjectives: [],
      indicatorPoints: [],
      overallPassedCount: 0,
      overallTotalCount: 0,
      dataStatus: {
        ...baseStatus,
        classId: 'class-2',
        className: '2025级2班',
        classScopeSource: 'REQUEST',
        availableClasses: [
          { classId: 'class-1', className: '2025级1班', semester: '2025-2026-2' },
          { classId: 'class-2', className: '2025级2班', semester: '2025-2026-2' },
        ],
      },
    })));

    render(<OBEStudentPage />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/obe/student/graduation-progress?classId=class-2&semester=2025-2026-2',
      expect.objectContaining({ cache: 'no-store' }),
    ));
    expect(await screen.findByRole('combobox', { name: '当前班级范围' })).toHaveValue('class-2');
    expect(window.location.search).toBe('?classId=class-2&semester=2025-2026-2');
  });

  it('withholds the rate, radar and detail conclusions when current records are incomplete', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, withStudentEvidence({
      courseObjectives: [{
        id: 'coa-1', code: 'CO1', name: '课程目标一', achievementDegree: 0.8, passed: true, breakdown: [],
      }],
      indicatorPoints: [{
        id: 'ip-1', code: '1-1', description: '指标点一', graduationReqName: '工程知识',
        achievementDegree: 0.75, threshold: 0.65, passed: true, contributingCOs: [],
      }],
      overallPassedCount: 0,
      overallTotalCount: 0,
      dataStatus: baseStatus,
    })));

    render(<OBEStudentPage />);

    expect(await screen.findByText('当前学期结果尚未完整，暂不形成个人达成结论')).toBeInTheDocument();
    expect(screen.getByText('课程目标记录').parentElement).toHaveTextContent('1/2');
    expect(screen.getByText('指标点记录').parentElement).toHaveTextContent('1/2');
    expect(screen.getByText('已隔离旧记录').parentElement).toHaveTextContent('2');
    expect(screen.getByText('本页只读取教师已复算的数据；重复刷新不会改写测评、实验或学习记录。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新数据状态' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '重新核对结果' })).not.toBeInTheDocument();
    expect(screen.getByText(/页面数据刷新于/)).toBeInTheDocument();
    expect(screen.getByText('当前版本记录补齐后显示能力雷达图')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/obe/student/graduation-progress', expect.objectContaining({
      cache: 'no-store',
    }));
  });

  it('keeps the incomplete-state explanation visible while safely refreshing server data', async () => {
    const incompleteResponse = withStudentEvidence({
      courseObjectives: [],
      indicatorPoints: [],
      overallPassedCount: 0,
      overallTotalCount: 0,
      dataStatus: baseStatus,
    });
    let resolveRefresh!: (response: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => { resolveRefresh = resolve; });
    mockFetch
      .mockResolvedValueOnce(jsonResponse(200, incompleteResponse))
      .mockReturnValueOnce(pendingRefresh);

    render(<OBEStudentPage />);

    const refresh = await screen.findByRole('button', { name: '刷新数据状态' });
    fireEvent.click(refresh);

    expect(screen.getByText('当前学期结果尚未完整，暂不形成个人达成结论')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '正在刷新数据…' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '查看当前学习任务' })).toBeInTheDocument();

    await act(async () => { resolveRefresh(jsonResponse(200, incompleteResponse)); });
    expect(await screen.findByRole('button', { name: '刷新数据状态' })).toBeEnabled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('shows the overall conclusion only when both current record sets are complete', async () => {
    mockFetch.mockResolvedValue(jsonResponse(200, withStudentEvidence({
      courseObjectives: [{
        id: 'coa-1', code: 'CO1', name: '课程目标一', achievementDegree: 0.8, passed: true, breakdown: [],
      }],
      indicatorPoints: [{
        id: 'ip-1', code: '1-1', description: '指标点一', graduationReqName: '工程知识',
        achievementDegree: 0.75, threshold: 0.65, passed: true, contributingCOs: [],
      }],
      overallPassedCount: 1,
      overallTotalCount: 1,
      dataStatus: {
        ...baseStatus,
        expectedCourseObjectiveRecords: 1,
        freshCourseObjectiveRecords: 1,
        staleCourseObjectiveRecords: 0,
        missingCourseObjectiveRecords: 0,
        expectedIndicatorRecords: 1,
        freshIndicatorRecords: 1,
        staleIndicatorRecords: 0,
        missingIndicatorRecords: 0,
        complete: true,
      },
    })));

    render(<OBEStudentPage />);

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0);
    expect(screen.queryByText('当前学期结果尚未完整，暂不形成个人达成结论')).not.toBeInTheDocument();
  });

  it('switches the visible result scope when the student belongs to two active classes', async () => {
    const classes = [
      { classId: 'class-1', className: '2025级1班', semester: '2025-2026-2' },
      { classId: 'class-2', className: '2025级2班', semester: '2025-2026-2' },
    ];
    let resolveSecondClass!: (response: Response) => void;
    const secondClassResponse = new Promise<Response>((resolve) => { resolveSecondClass = resolve; });
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const selectedSecondClass = url.includes('classId=class-2');
      if (selectedSecondClass) return secondClassResponse;
      return jsonResponse(200, withStudentEvidence({
        courseObjectives: [],
        indicatorPoints: [],
        overallPassedCount: 0,
        overallTotalCount: 0,
        dataStatus: {
          ...baseStatus,
          classId: 'class-1',
          className: '2025级1班',
          classScopeSource: 'ACTIVE_CLASS',
          availableClasses: classes,
        },
      }));
    });

    render(<OBEStudentPage />);
    const selector = await screen.findByRole('combobox', { name: '当前班级范围' });
    fireEvent.change(selector, { target: { value: 'class-2' } });

    expect(selector).toHaveValue('class-2');
    expect(selector).toBeDisabled();
    expect(window.location.search).toBe('?classId=class-2&semester=2025-2026-2');
    expect(screen.getByRole('status')).toHaveTextContent('正在载入该班级数据');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/obe/student/graduation-progress?classId=class-2&semester=2025-2026-2',
      expect.objectContaining({ cache: 'no-store' }),
    ));
    await act(async () => {
      resolveSecondClass(jsonResponse(200, withStudentEvidence({
        courseObjectives: [],
        indicatorPoints: [],
        overallPassedCount: 0,
        overallTotalCount: 0,
        dataStatus: {
          ...baseStatus,
          classId: 'class-2',
          className: '2025级2班',
          classScopeSource: 'REQUEST',
          availableClasses: classes,
        },
      })));
    });
    await waitFor(() => expect(selector).toBeEnabled());
    expect(selector).toHaveValue('class-2');
    expect(selector).toBeEnabled();
  });

  it('restores the matching class when browser history changes', async () => {
    const classes = [
      { classId: 'class-1', className: '2025级1班', semester: '2025-2026-2' },
      { classId: 'class-2', className: '2025级2班', semester: '2025-2026-1' },
    ];
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const selectedSecondClass = String(input).includes('classId=class-2');
      return jsonResponse(200, withStudentEvidence({
        courseObjectives: [],
        indicatorPoints: [],
        overallPassedCount: 0,
        overallTotalCount: 0,
        dataStatus: {
          ...baseStatus,
          semester: selectedSecondClass ? '2025-2026-1' : '2025-2026-2',
          semesterSource: selectedSecondClass ? 'REQUEST' : 'ACTIVE_CLASS',
          classId: selectedSecondClass ? 'class-2' : 'class-1',
          className: selectedSecondClass ? '2025级2班' : '2025级1班',
          classScopeSource: selectedSecondClass ? 'REQUEST' : 'ACTIVE_CLASS',
          availableClasses: classes,
        },
      }));
    });

    render(<OBEStudentPage />);
    const selector = await screen.findByRole('combobox', { name: '当前班级范围' });

    act(() => {
      window.history.pushState({}, '', '/obe?classId=class-2&semester=2025-2026-1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(selector).toHaveValue('class-2');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/obe/student/graduation-progress?classId=class-2&semester=2025-2026-1',
      expect.objectContaining({ cache: 'no-store' }),
    ));
    await waitFor(() => expect(selector).toBeEnabled());
    expect(window.location.search).toBe('?classId=class-2&semester=2025-2026-1');
  });
});
