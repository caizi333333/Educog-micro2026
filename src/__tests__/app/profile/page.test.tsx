import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievements } from '@/hooks/useAchievements';
import ProfilePage from '@/app/profile/page';
import { getProfileActivityLabel } from '@/components/hyper/HyperProfilePage';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useAchievements', () => ({ useAchievements: jest.fn() }));
jest.mock('next/link', () => function MockLink({
  children,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...props}>{children}</a>;
});
jest.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
  AvatarFallback: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}));
jest.mock('lucide-react', () => {
  const ReactRuntime = require('react');
  const MockIcon = (props: Record<string, unknown>) => ReactRuntime.createElement('svg', props);
  return {
    AlertCircle: MockIcon,
    ArrowRight: MockIcon,
    Award: MockIcon,
    BarChart3: MockIcon,
    BookOpen: MockIcon,
    Building2: MockIcon,
    Camera: MockIcon,
    CheckCircle2: MockIcon,
    CircleOff: MockIcon,
    Clock: MockIcon,
    GraduationCap: MockIcon,
    History: MockIcon,
    LayoutDashboard: MockIcon,
    Loader2: MockIcon,
    Lock: MockIcon,
    LogIn: MockIcon,
    Mail: MockIcon,
    RefreshCw: MockIcon,
    Settings: MockIcon,
    Shield: MockIcon,
    Sparkles: MockIcon,
    Target: MockIcon,
    Trophy: MockIcon,
    UserRound: MockIcon,
    Users: MockIcon,
  };
});

global.fetch = jest.fn();

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAchievements = useAchievements as jest.MockedFunction<typeof useAchievements>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockLogout = jest.fn();
const mockRefreshUser = jest.fn();
const mockRefetchAchievements = jest.fn(async (_showRefreshIndicator?: boolean) => undefined);

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

const users = {
  student: {
    id: 'student-1',
    username: 'student',
    name: '测试学生',
    email: 'student@example.com',
    role: 'STUDENT' as const,
    studentId: '202401001',
    class: '机电2401',
  },
  teacher: {
    id: 'teacher-1',
    username: 'sunyancai',
    name: '孙延才',
    email: 'teacher@example.com',
    role: 'TEACHER' as const,
    teacherId: 'T001',
    department: '智能制造学院',
    title: '副教授',
  },
  admin: {
    id: 'admin-1',
    username: 'admin',
    name: '平台管理员',
    email: 'admin@example.com',
    role: 'ADMIN' as const,
  },
};

const zeroAchievementState: ReturnType<typeof useAchievements> = {
  loading: false,
  refreshing: false,
  error: null,
  accessErrorStatus: null,
  dataProvenance: null,
  asOf: null,
  sampleSize: null,
  userProgress: [],
  userStats: null,
  totalPoints: 0,
  fetchAchievements: mockRefetchAchievements,
  calculateStats: () => ({
    unlockedCount: 0,
    totalCount: 54,
    totalPoints: 0,
    byTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
    completionPercentage: 0,
  }),
  getFilteredAchievements: () => [],
  getAchievementDisplay: () => null,
  clearRecentUnlocks: () => undefined,
  formatAchievementDisplay: () => ({ title: '未解锁', icon: '🔒' }),
  getAchievementsByCategory: () => [],
  achievements: [],
  progress: [],
  refetch: mockRefetchAchievements,
};

function setAuthenticatedUser(user: typeof users.student | typeof users.teacher | typeof users.admin) {
  mockUseAuth.mockReturnValue({
    user,
    loading: false,
    login: jest.fn(),
    logout: mockLogout,
    refreshUser: mockRefreshUser,
    isAuthenticated: true,
  });
}

function profileFor(
  user: typeof users.student | typeof users.teacher | typeof users.admin,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: 'studentId' in user ? user.studentId : null,
    class: 'class' in user ? user.class : null,
    teacherId: 'teacherId' in user ? user.teacherId : null,
    department: 'department' in user ? user.department : null,
    title: 'title' in user ? user.title : null,
    totalPoints: 0,
    stats: {
      totalExperiments: 0,
      totalQuizzes: 0,
      totalQuizAttempts: 0,
      totalAchievements: 0,
      totalLearningPaths: 0,
      completedModules: 0,
      averageProgress: 0,
      totalLearningTime: 0,
    },
    recentActivity: [],
    ...overrides,
  };
}

function respondWithProfile(profile: unknown, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => status === 200 ? ({ profile }) : ({ error: '未授权' }),
  } as Response);
}

describe('profile activity labels', () => {
  it('localizes seeded experiment actions and hides unknown internal codes', () => {
    expect(getProfileActivityLabel('VIEW_EXPERIMENT')).toBe('查看实验');
    expect(getProfileActivityLabel('SUBMIT_EXPERIMENT')).toBe('提交实验');
    expect(getProfileActivityLabel('UNEXPECTED_INTERNAL_CODE')).toBe('学习活动');
  });
});

describe('ProfilePage role-aware states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockImplementation((key: string) => key === 'accessToken' ? 'valid-token' : null);
    mockUseAchievements.mockReturnValue(zeroAchievementState as ReturnType<typeof useAchievements>);
  });

  it('shows a named auth-loading state before any data request', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      login: jest.fn(),
      logout: mockLogout,
      refreshUser: mockRefreshUser,
      isAuthenticated: false,
    });

    render(<ProfilePage />);

    expect(screen.getByRole('status')).toHaveTextContent('正在核对登录状态');
    expect(screen.getByRole('status')).toHaveClass('min-h-[calc(100dvh-3.5rem)]');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows a login entry when no account is authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      login: jest.fn(),
      logout: mockLogout,
      refreshUser: mockRefreshUser,
      isAuthenticated: false,
    });

    render(<ProfilePage />);

    expect(await screen.findByText('请先登录以查看个人资料。')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '前往登录' })).toHaveAttribute('href', '/login?from=%2Fprofile');
  });

  it('renders a teacher account workspace without invoking or displaying student metrics', async () => {
    setAuthenticatedUser(users.teacher);
    respondWithProfile(profileFor(users.teacher));

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '孙延才' })).toBeInTheDocument();
    expect(screen.getAllByText('教师账户').length).toBeGreaterThan(0);
    expect(screen.getByText('学生学习画像不适用于当前角色')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /教学仪表板/ })).toHaveAttribute('href', '/teacher');
    expect(screen.getByRole('link', { name: /班级管理/ })).toHaveAttribute('href', '/teacher/classes');
    expect(screen.getByText('teacher@example.com').closest('span')).toHaveClass('break-all');
    expect(screen.getByRole('button', { name: /更换头像/ }).parentElement).toHaveClass('justify-self-center');
    expect(screen.queryByText(/0\/54 勋章/)).not.toBeInTheDocument();
    expect(screen.queryByText(/平均进度 0%/)).not.toBeInTheDocument();
    expect(screen.queryByText('学习时长')).not.toBeInTheDocument();
    expect(screen.queryByText('分类进度')).not.toBeInTheDocument();
    expect(mockUseAchievements).not.toHaveBeenCalled();
  });

  it('renders administrator-specific shortcuts without student learning imagery', async () => {
    setAuthenticatedUser(users.admin);
    respondWithProfile(profileFor(users.admin));

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '平台管理员' })).toBeInTheDocument();
    expect(screen.getAllByText('平台管理员').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /用户管理/ })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: /OBE 管理/ })).toHaveAttribute('href', '/obe/admin');
    expect(screen.queryByText('精选勋章')).not.toBeInTheDocument();
    expect(mockUseAchievements).not.toHaveBeenCalled();
  });

  it('separates student learning-image loading from zero-valued success', async () => {
    setAuthenticatedUser(users.student);
    mockUseAchievements.mockReturnValue({
      ...zeroAchievementState,
      loading: true,
    } as ReturnType<typeof useAchievements>);
    respondWithProfile(profileFor(users.student));

    render(<ProfilePage />);

    expect(await screen.findByText('正在读取学习画像')).toBeInTheDocument();
    expect(screen.queryByText(/0\/54 勋章/)).not.toBeInTheDocument();
    expect(screen.queryByText(/平均进度 0%/)).not.toBeInTheDocument();
  });

  it('shows a successful-empty student state instead of a dashboard of zeroes', async () => {
    setAuthenticatedUser(users.student);
    mockUseAchievements.mockReturnValue({
      ...zeroAchievementState,
      userProgress: [{ achievementId: 'daily_streak_7', progress: 14, unlocked: false }],
      progress: [{ achievementId: 'daily_streak_7', progress: 14, unlocked: false }],
    } as ReturnType<typeof useAchievements>);
    respondWithProfile(profileFor(users.student, {
      stats: { totalAchievements: 1, averageProgress: 0, totalLearningTime: 0 },
      recentActivity: [
        { action: 'REGISTER', createdAt: '2026-08-15T08:00:00.000Z' },
        { action: 'LOGIN', createdAt: '2026-08-15T08:01:00.000Z' },
      ],
    }));

    render(<ProfilePage />);

    expect(await screen.findByText('尚未产生学习画像数据')).toBeInTheDocument();
    expect(screen.getByText(/资料已读取成功/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /查看学习任务/ })).toHaveAttribute('href', '/tasks');
    expect(screen.getByRole('link', { name: /查看学习任务/ })).toHaveClass('min-h-11');
    expect(screen.getByRole('link', { name: '浏览知识图谱' })).toHaveClass('min-h-11');
    expect(screen.queryByText(/0\/54 勋章/)).not.toBeInTheDocument();
    expect(screen.queryByText('学习时长')).not.toBeInTheDocument();
    expect(screen.queryByText('分类进度')).not.toBeInTheDocument();
  });

  it('does not collapse an achievement read failure to zero and supports in-place retry', async () => {
    setAuthenticatedUser(users.student);
    mockUseAchievements.mockReturnValue({
      ...zeroAchievementState,
      error: '获取成就失败',
    } as ReturnType<typeof useAchievements>);
    respondWithProfile(profileFor(users.student, {
      stats: { totalQuizAttempts: 1, averageProgress: 80, totalLearningTime: 3600 },
    }));

    render(<ProfilePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('学习画像暂时无法读取');
    expect(screen.getByText(/避免把读取失败误写为 0/)).toBeInTheDocument();
    expect(screen.queryByText(/平均进度 80%/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新读取学习画像' }));
    expect(mockRefetchAchievements).toHaveBeenCalledWith(true);
  });

  it('turns an achievement 401 into role-preserving login recovery without exposing profile metrics', async () => {
    setAuthenticatedUser(users.student);
    mockUseAchievements.mockReturnValue({
      ...zeroAchievementState,
      error: '登录已过期，请重新登录',
      accessErrorStatus: 401,
    } as ReturnType<typeof useAchievements>);
    respondWithProfile(profileFor(users.student, {
      stats: { totalQuizAttempts: 1, averageProgress: 80, totalLearningTime: 3600 },
    }));

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '需要重新登录以读取学习画像' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录并返回' }))
      .toHaveAttribute('href', '/login?role=student&from=%2Fprofile');
    expect(screen.queryByText(/平均进度 80%/)).not.toBeInTheDocument();
    expect(screen.queryByText('学习时长')).not.toBeInTheDocument();
  });

  it('keeps an achievement 403 distinct from a retryable read failure', async () => {
    setAuthenticatedUser(users.student);
    mockUseAchievements.mockReturnValue({
      ...zeroAchievementState,
      error: '当前账号无权读取学生个人成就',
      accessErrorStatus: 403,
    } as ReturnType<typeof useAchievements>);
    respondWithProfile(profileFor(users.student, {
      stats: { totalQuizAttempts: 1, averageProgress: 80, totalLearningTime: 3600 },
    }));

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '当前账号无权读取学生学习画像' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看账户与安全' })).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('button', { name: '重新读取学习画像' })).not.toBeInTheDocument();
    expect(screen.queryByText(/平均进度 80%/)).not.toBeInTheDocument();
  });

  it('renders student metrics only after successful non-empty evidence is available', async () => {
    setAuthenticatedUser(users.student);
    mockUseAchievements.mockReturnValue({
      ...zeroAchievementState,
      dataProvenance: {
        mode: 'DEMO',
        label: '演示数据',
        note: '当前为竞赛功能演示环境，不用于证明教学成效。',
      },
      asOf: '2026-08-25T07:12:59.892Z',
      sampleSize: {
        achievementRules: 54,
        unlockedAchievementRecords: 1,
        activityRecords: 1,
        learningProgressRecords: 2,
        quizAttempts: 1,
        experimentRecords: 0,
      },
      calculateStats: () => ({
        unlockedCount: 1,
        totalCount: 54,
        totalPoints: 120,
        byTier: { bronze: 1, silver: 0, gold: 0, platinum: 0 },
        completionPercentage: 2,
      }),
    } as ReturnType<typeof useAchievements>);
    respondWithProfile(profileFor(users.student, {
      stats: {
        totalQuizAttempts: 1,
        averageQuizScore: 88,
        averageProgress: 50,
        totalLearningTime: 7200,
      },
      recentActivity: [{
        action: 'SUBMIT_QUIZ',
        createdAt: '2026-08-15T08:00:00.000Z',
        details: { score: 88 },
      }],
    }));

    render(<ProfilePage />);

    expect(await screen.findByText('1/54 勋章')).toBeInTheDocument();
    expect(screen.getByText('平均进度 50%')).toBeInTheDocument();
    expect(screen.getByText('学习时长')).toBeInTheDocument();
    expect(screen.getByText('2h')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /继续学习任务/ })).toHaveAttribute('href', '/tasks');
    expect(screen.getByText('提交测验')).toBeInTheDocument();
    expect(screen.getByText('演示数据：')).toBeInTheDocument();
    expect(screen.getByText(/学习进度 n=2 · 测验作答 n=1 · 实验记录 n=0/)).toBeInTheDocument();
  });

  it('shows a recoverable profile request error and retries without rendering student zeroes', async () => {
    setAuthenticatedUser(users.student);
    mockFetch
      .mockRejectedValueOnce(new Error('网络暂不可用'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ profile: profileFor(users.student) }),
      } as Response);

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '无法加载用户资料' })).toBeInTheDocument();
    expect(screen.queryByText(/0\/54 勋章/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重新读取' }));
    expect(await screen.findByText('尚未产生学习画像数据')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('offers role-preserving login recovery for a 401 response', async () => {
    setAuthenticatedUser(users.student);
    respondWithProfile(null, 401);

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '需要重新登录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '重新登录并返回' }))
      .toHaveAttribute('href', '/login?role=student&from=%2Fprofile');
    expect(screen.queryByText('学习时长')).not.toBeInTheDocument();
  });

  it('treats a successful null profile as an explicit empty account state', async () => {
    setAuthenticatedUser(users.student);
    respondWithProfile(null);

    render(<ProfilePage />);

    expect(await screen.findByRole('heading', { name: '账户资料尚未建立' })).toBeInTheDocument();
    expect(screen.getByText(/学习画像暂不展示/)).toBeInTheDocument();
    expect(mockUseAchievements).not.toHaveBeenCalled();
  });
});
