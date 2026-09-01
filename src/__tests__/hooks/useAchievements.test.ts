import { act, renderHook, waitFor } from '@testing-library/react';
import { useAchievements } from '@/hooks/useAchievements';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements-v2';
import { ClientRequestTimeoutError } from '@/lib/client-fetch';

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
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: localStorageMock,
});

const signedInUser = {
  id: 'user-1',
  username: 'student',
  email: 'student@example.com',
  name: 'Student',
  role: 'STUDENT' as const,
};

const achievementEvidence = {
  dataProvenance: { mode: 'DEMO' as const, label: '演示数据', note: '用于测试的数据身份说明' },
  asOf: '2026-08-26T00:00:00.000Z',
  sampleSize: {
    achievementRules: ALL_ACHIEVEMENTS.length,
    unlockedAchievementRecords: 1,
    activityRecords: 2,
    learningProgressRecords: 1,
    quizAttempts: 1,
    experimentRecords: 0,
  },
};

describe('useAchievements', () => {
  const toast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: signedInUser, loading: false } as ReturnType<typeof useAuth>);
    mockUseToast.mockReturnValue({ toast, dismiss: jest.fn(), toasts: [] } as ReturnType<typeof useToast>);
    localStorageMock.getItem.mockReturnValue('valid-token');

    const unlockedId = ALL_ACHIEVEMENTS[0]?.id;
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...achievementEvidence,
          success: true,
          achievements: unlockedId ? [{ achievementId: unlockedId, unlocked: true, progress: 100, unlockedAt: '2026-07-15T00:00:00.000Z' }] : [],
          stats: { totalPoints: 120 },
          userStats: { modules_completed: 3, code_runs: 2 },
        }),
      });
  });

  it('stops loading without requesting data when no user is signed in', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not request data before authentication hydration completes', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAchievements());

    expect(result.current.loading).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each(['TEACHER', 'ADMIN'] as const)('does not request student achievements for a %s account', async (role) => {
    mockUseAuth.mockReturnValue({ user: { ...signedInUser, role }, loading: false } as ReturnType<typeof useAuth>);

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.userProgress).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('ignores a late student response after the account changes role', async () => {
    let resolveAchievements!: (value: unknown) => void;
    mockFetch.mockReset().mockImplementationOnce(() => new Promise((resolve) => {
      resolveAchievements = resolve;
    }));

    const { result, rerender } = renderHook(() => useAchievements());
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    mockUseAuth.mockReturnValue({ user: { ...signedInUser, role: 'TEACHER' }, loading: false } as ReturnType<typeof useAuth>);
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      resolveAchievements({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          achievements: [{ achievementId: ALL_ACHIEVEMENTS[0]?.id, unlocked: true }],
          stats: { totalPoints: 999 },
        }),
      });
    });

    expect(result.current.userProgress).toEqual([]);
    expect(result.current.totalPoints).toBeNull();
  });

  it('maps server unlocks, user stats and the server-owned point total', async () => {
    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetch).toHaveBeenCalledWith('/api/achievements', expect.objectContaining({
      cache: 'no-store',
      headers: { Authorization: 'Bearer valid-token' },
      signal: expect.any(AbortSignal),
    }));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.userProgress.filter((item) => item.unlocked)).toHaveLength(1);
    expect(result.current.userStats).toMatchObject({ modules_completed: 3, code_runs: 2 });
    expect(result.current.totalPoints).toBe(120);
    expect(result.current.calculateStats()).toMatchObject({ unlockedCount: 1, totalPoints: 120 });
  });

  it('filters the unified catalog by category', async () => {
    const { result } = renderHook(() => useAchievements('quiz'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.achievements.length).toBeGreaterThan(0);
    expect(result.current.achievements.every((achievement) => achievement.category === 'quiz')).toBe(true);
    expect(result.current.getAchievementsByCategory('experiment').every((achievement) => achievement.category === 'experiment')).toBe(true);
  });

  it('returns no definitions for an unknown category', async () => {
    const { result } = renderHook(() => useAchievements());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getFilteredAchievements('unknown')).toEqual([]);
  });

  it('reports an authenticated API failure and keeps the page recoverable', async () => {
    mockFetch.mockReset().mockResolvedValueOnce({ ok: false, status: 503 });

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('获取成就失败');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('turns a request timeout into a recoverable, explicit state', async () => {
    mockFetch.mockReset().mockRejectedValueOnce(new ClientRequestTimeoutError());

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('读取成就记录超时，请重试');
    expect(result.current.refetch).toEqual(expect.any(Function));
  });

  it('rejects a malformed 200 response instead of publishing zero-valued progress', async () => {
    mockFetch.mockReset().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ detail: 'Bad Request' }),
    });

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('成就数据响应格式异常');
    expect(result.current.userProgress).toEqual([]);
    expect(result.current.totalPoints).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('supports an explicit refresh and clears a previous error after success', async () => {
    mockFetch.mockReset().mockResolvedValueOnce({ ok: false, status: 503 });
    const { result } = renderHook(() => useAchievements());
    await waitFor(() => expect(result.current.error).toBe('获取成就失败'));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...achievementEvidence,
          sampleSize: { ...achievementEvidence.sampleSize, unlockedAchievementRecords: 0 },
          success: true,
          achievements: [],
          stats: { totalPoints: 0 },
        }),
      });

    await act(async () => {
      await result.current.refetch(true);
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('clears previously confirmed achievement values when the token disappears before refresh', async () => {
    const { result } = renderHook(() => useAchievements());
    await waitFor(() => expect(result.current.totalPoints).toBe(120));

    localStorageMock.getItem.mockReturnValue(null);
    await act(async () => {
      await result.current.refetch(true);
    });

    expect(result.current.accessErrorStatus).toBe(401);
    expect(result.current.userProgress).toEqual([]);
    expect(result.current.userStats).toBeNull();
    expect(result.current.totalPoints).toBeNull();
  });

  it.each([401, 403] as const)('clears stale results and exposes a recoverable %s access state', async (status) => {
    mockFetch.mockReset().mockResolvedValueOnce({ ok: false, status });

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.accessErrorStatus).toBe(status);
    expect(result.current.userProgress).toEqual([]);
    expect(result.current.totalPoints).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
});
