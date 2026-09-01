import { act, renderHook, waitFor } from '@testing-library/react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

jest.mock('@/contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/use-toast', () => ({ useToast: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;
const mockFetch = jest.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

const user = {
  id: 'user-1',
  username: 'student',
  email: 'student@example.com',
  name: 'Student',
  role: 'STUDENT' as const,
};

const quizHistory = [
  { id: 'q2', score: 90, totalQuestions: 10, completedAt: '2026-07-12T00:00:00.000Z' },
  { id: 'q1', score: 80, totalQuestions: 10, completedAt: '2026-07-10T00:00:00.000Z' },
];

const learningProgress = [
  { id: 'p1', moduleId: 'm1', chapterId: 'chapter-5', progress: 80, timeSpent: 1800, lastAccessAt: '2026-07-10T00:00:00.000Z' },
  { id: 'p2', moduleId: 'm2', chapterId: '6', progress: 60, timeSpent: 1200, lastAccessAt: '2026-07-11T00:00:00.000Z' },
];

const summary = {
  totalPoints: 100,
  totalExperiments: 2,
  totalQuizzes: 2,
  totalAchievements: 1,
  completedExperiments: 1,
  completedModules: 0,
  totalTimeSpent: 3000,
  avgQuizScore: 85,
};

const zeroSummary = {
  totalPoints: 0,
  totalExperiments: 0,
  totalQuizzes: 0,
  totalAchievements: 0,
  completedExperiments: 0,
  completedModules: 0,
  totalTimeSpent: 0,
  avgQuizScore: 0,
};

const analyticsEvidence = {
  dataProvenance: { mode: 'DEMO' as const, label: '演示数据', note: '用于测试的数据身份说明' },
  asOf: '2026-08-26T00:00:00.000Z',
  sampleSize: {
    quizAttempts: 2,
    learningProgressRecords: 2,
    experimentRecords: 2,
    achievementRecords: 1,
    achievementRules: 55,
  },
};

describe('useAnalytics', () => {
  const toast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user, loading: false } as ReturnType<typeof useAuth>);
    mockUseToast.mockReturnValue({ toast, dismiss: jest.fn(), toasts: [] } as ReturnType<typeof useToast>);
    localStorageMock.getItem.mockImplementation((key: string) => key === 'accessToken' ? 'valid-token' : null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...analyticsEvidence, success: true, data: { quizHistory, learningProgress, summary } }),
    });
  });

  it('stops loading when authentication has finished without a user', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not request personal analytics when the caller disables the personal view', async () => {
    const { result } = renderHook(() => useAnalytics({ enabled: false }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dataStatus).toBe('idle');
    expect(result.current.summary).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('loads all analytics through the consolidated endpoint', async () => {
    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/analytics/overview', expect.objectContaining({
      headers: { Authorization: 'Bearer valid-token' },
      cache: 'no-store',
      signal: expect.any(Object),
    }));
    expect(result.current.quizHistory).toEqual(quizHistory);
    expect(result.current.learningProgress).toEqual(learningProgress);
    expect(result.current.summary).toEqual(summary);
    expect(result.current.dataStatus).toBe('fresh');
  });

  it('shows a fresh user-specific cache immediately and still revalidates it', async () => {
    let resolveRequest!: (response: {
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
    }) => void;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'valid-token';
      if (key === 'analytics_user-1') return JSON.stringify({ ...analyticsEvidence, quizHistory, learningProgress, achievements: { stats: {} }, summary });
      if (key === 'analytics_user-1_time') return Date.now().toString();
      return null;
    });

    const { result } = renderHook(() => useAnalytics());
    await waitFor(() => expect(result.current.dataStatus).toBe('cached'));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.quizHistory).toEqual(quizHistory);
    expect(result.current.summary).toEqual(summary);

    act(() => {
      resolveRequest({
        ok: true,
        status: 200,
        json: async () => ({
          ...analyticsEvidence,
          success: true,
          data: { quizHistory: [], learningProgress: [], summary: zeroSummary },
        }),
      });
    });

    await waitFor(() => expect(result.current.dataStatus).toBe('fresh'));
    expect(result.current.refreshing).toBe(false);
    expect(result.current.summary).toEqual(zeroSummary);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'analytics_user-1',
      expect.stringContaining('"totalAchievements":0'),
    );
  });

  it('retains cached values and marks them stale when revalidation fails', async () => {
    const cachedSummary = { ...summary, totalAchievements: 7 };
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'valid-token';
      if (key === 'analytics_user-1') return JSON.stringify({
        ...analyticsEvidence,
        quizHistory,
        learningProgress,
        achievements: { stats: {} },
        summary: cachedSummary,
      });
      if (key === 'analytics_user-1_time') return Date.now().toString();
      return null;
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.dataStatus).toBe('stale'));
    expect(result.current.summary?.totalAchievements).toBe(7);
    expect(result.current.error).toBe('最新数据校准失败：HTTP 503');
    expect(result.current.loading).toBe(false);
    expect(result.current.refreshing).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '最新数据校准失败' }));
  });

  it('does not retain cached personal data after an authentication failure', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'accessToken') return 'expired-token';
      if (key === 'analytics_user-1') return JSON.stringify({
        ...analyticsEvidence,
        quizHistory,
        learningProgress,
        achievements: { stats: {} },
        summary,
      });
      if (key === 'analytics_user-1_time') return Date.now().toString();
      return null;
    });
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.dataStatus).toBe('error'));
    expect(result.current.summary).toBeNull();
    expect(result.current.quizHistory).toEqual([]);
    expect(result.current.error).toBe('登录状态已失效，请重新登录后查看学情分析');
  });

  it('maps mastery to the formal chapter numbers', async () => {
    const { result } = renderHook(() => useAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const mastery = result.current.calculateKnowledgeMastery();
    const interrupts = mastery.find((item) => item.topic === '中断系统');
    const timers = mastery.find((item) => item.topic === '定时器/计数器');
    const frontier = mastery.find((item) => item.topic === '前沿应用');

    expect(interrupts?.mastery).toBe(80);
    expect(interrupts?.details).toHaveProperty('89C51中断系统', 80);
    expect(timers?.mastery).toBe(60);
    expect(timers?.details).toHaveProperty('定时器基础', 60);
    expect(frontier?.mastery).toBeNull();
    expect(frontier?.hasRecord).toBe(false);
    expect(Object.values(frontier?.details ?? {})).toEqual(expect.arrayContaining([null]));

    const advice = result.current.generateLearningAdvice();
    expect(advice.weakAreas.map((item) => item.topic)).toEqual(['定时器/计数器']);
    expect(advice.strongAreas.map((item) => item.topic)).toEqual(['中断系统']);
  });

  it('calculates learning totals and a chronological quiz trend', async () => {
    const { result } = renderHook(() => useAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.calculateLearningStats()).toEqual({
      totalModules: 2,
      completedModules: 0,
      totalTime: 50,
      averageScore: 85,
      quizCount: 2,
      quizScoreTrend: [
        { quiz: '测验1', score: 80, date: '2026-07-10T00:00:00.000Z' },
        { quiz: '测验2', score: 90, date: '2026-07-12T00:00:00.000Z' },
      ],
    });
  });

  it('normalizes malformed endpoint arrays to empty states', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...analyticsEvidence, success: true, data: { quizHistory: {}, learningProgress: null, summary: zeroSummary } }),
    });
    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quizHistory).toEqual([]);
    expect(result.current.learningProgress).toEqual([]);
    expect(result.current.summary).toEqual(zeroSummary);
    expect(result.current.error).toBeNull();
  });

  it('shows a recoverable error when the endpoint fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
    const { result } = renderHook(() => useAnalytics());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(result.current.error).toBe('HTTP 503');
    expect(result.current.summary).toBeNull();
    expect(result.current.dataStatus).toBe('error');
  });

  it('invalidates only the signed-in user cache', async () => {
    const { result } = renderHook(() => useAnalytics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.invalidateCache());

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('analytics_user-1');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('analytics_user-1_time');
  });
});
