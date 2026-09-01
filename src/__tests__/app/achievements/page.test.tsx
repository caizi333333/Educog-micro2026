import React from 'react';
import { render, screen } from '@testing-library/react';
import AchievementsPage from '@/app/achievements/page';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievements } from '@/hooks/useAchievements';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useAchievements', () => ({ useAchievements: jest.fn() }));

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('lucide-react', () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowRight: Icon,
    Award: Icon,
    Calendar: Icon,
    Check: Icon,
    CheckCircle2: Icon,
    LayoutGrid: Icon,
    Loader2: Icon,
    Lock: Icon,
    Medal: Icon,
    MousePointerClick: Icon,
    RefreshCcw: Icon,
    Search: Icon,
    Target: Icon,
    Trophy: Icon,
    Users: Icon,
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAchievements = useAchievements as jest.MockedFunction<typeof useAchievements>;
const mockFetchAchievements = jest.fn();

function achievementHookResult(overrides: Record<string, unknown> = {}): ReturnType<typeof useAchievements> {
  return {
    loading: false,
    refreshing: false,
    userProgress: [],
    userStats: null,
    error: null,
    accessErrorStatus: null,
    dataProvenance: null,
    asOf: null,
    sampleSize: null,
    totalPoints: 0,
    fetchAchievements: mockFetchAchievements,
    calculateStats: () => ({
      unlockedCount: 0,
      totalCount: 0,
      totalPoints: 0,
      byTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
      completionPercentage: 0,
    }),
    getFilteredAchievements: () => [],
    getAchievementDisplay: () => null,
    clearRecentUnlocks: () => {},
    formatAchievementDisplay: () => ({ title: '???', icon: '🔒' }),
    getAchievementsByCategory: () => [],
    achievements: [],
    progress: [],
    refetch: mockFetchAchievements,
    ...overrides,
  } as ReturnType<typeof useAchievements>;
}

describe('AchievementsPage student access boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/achievements');
    mockUseAuth.mockReturnValue({
      user: { id: 'student-1', username: 'student', email: 'student@example.com', name: '学生', role: 'STUDENT' },
      loading: false,
    } as ReturnType<typeof useAuth>);
    mockUseAchievements.mockReturnValue(achievementHookResult());
  });

  it('renders the student achievement wall only after the role is known', () => {
    render(<AchievementsPage />);

    expect(screen.getByRole('heading', { name: '成就徽章' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '成就徽章' })).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('shows only an authentication status while auth is hydrating', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    render(<AchievementsPage />);

    expect(screen.getByRole('status')).toHaveTextContent('正在确认访问角色');
    expect(screen.queryByRole('heading', { name: '成就徽章' })).not.toBeInTheDocument();
  });

  it('preserves query and hash for signed-out login recovery', () => {
    window.history.replaceState({}, '', '/achievements?source=profile#first-step');
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);

    render(<AchievementsPage />);

    expect(screen.getByRole('link', { name: '前往登录' })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/achievements?source=profile#first-step')}`,
    );
  });

  it.each([
    ['TEACHER', '/teacher', '返回教学仪表板'],
    ['ADMIN', '/admin', '返回管理端'],
  ] as const)('routes a %s direct URL away from student records', (role, destination, action) => {
    mockUseAuth.mockReturnValue({
      user: { id: role.toLowerCase(), username: role.toLowerCase(), email: `${role.toLowerCase()}@example.com`, name: role, role },
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<AchievementsPage />);

    expect(screen.getByRole('heading', { name: '该页仅展示学生个人成就' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: action })).toHaveAttribute('href', destination);
  });

  it('preserves context and requests a student account after a 403', () => {
    window.history.replaceState({}, '', '/achievements?source=profile#first-step');
    mockUseAchievements.mockReturnValue(achievementHookResult({
      error: '当前账号无权读取学生个人成就',
      accessErrorStatus: 403,
    }));

    render(<AchievementsPage />);

    expect(screen.getByRole('link', { name: '切换学生账号' })).toHaveAttribute(
      'href',
      `/login?from=${encodeURIComponent('/achievements?source=profile#first-step')}&reason=student-role`,
    );
    expect(screen.queryByRole('heading', { name: '成就徽章' })).not.toBeInTheDocument();
  });

  it('explains the completion condition and gives the selected badge a next action', () => {
    const quizAchievement = {
      id: 'quiz-follow-up',
      title: '专项测评入门',
      description: '完成 1 次专项测评',
      icon: '🎯',
      category: 'quiz',
      criteria: { type: 'quizzes_completed', target: 1 },
      points: 50,
      rarity: 'common',
    };
    mockUseAchievements.mockReturnValue(achievementHookResult({
      userProgress: [{ achievementId: 'quiz-follow-up', progress: 40, unlocked: false }],
      getFilteredAchievements: () => [quizAchievement],
      calculateStats: () => ({
        unlockedCount: 0,
        totalCount: 1,
        totalPoints: 0,
        byTier: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
        completionPercentage: 0,
      }),
    }));

    render(<AchievementsPage />);

    expect(screen.getByRole('button', { name: '专项测评入门，当前进度 40%' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('完成 1 次专项测评')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /进入专项测评/ })).toHaveAttribute('href', '/quiz');
    expect(screen.getByRole('button', { name: /全部可见/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
