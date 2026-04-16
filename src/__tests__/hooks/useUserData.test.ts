import { renderHook, act, waitFor } from '@testing-library/react';
import { useUserData } from '@/hooks/useUserData';
import { useAuth } from '@/contexts/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import apiClient from '@/lib/api-client';

// Mock dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/stores/useUserStore', () => ({
  useUserStore: jest.fn(),
}));

jest.mock('@/lib/api-client', () => ({
  get: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseUserStore = useUserStore as jest.MockedFunction<typeof useUserStore>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useUserData Hook', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    role: 'STUDENT' as const,
  };

  const mockUserStats = {
    totalLearningTime: 3600,
    completedModules: 5,
    averageScore: 85,
    streakDays: 7,
  };

  const mockUserAchievements = {
    achievements: [
      {
        id: 'achievement-1',
        name: '第一次完成',
        description: '完成第一个模块',
        unlockedAt: '2024-01-10T00:00:00Z',
      },
      {
        id: 'achievement-2',
        name: '连续学习',
        description: '连续学习7天',
        unlockedAt: '2024-01-15T00:00:00Z',
      },
    ],
    totalPoints: 150,
  };

  let mockSetUserStats: jest.Mock;
  let mockSetUserAchievements: jest.Mock;
  let mockShouldRefetch: jest.Mock;
  let mockClearUserData: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock store functions
    mockSetUserStats = jest.fn();
    mockSetUserAchievements = jest.fn();
    mockShouldRefetch = jest.fn();
    mockClearUserData = jest.fn();
    
    // Mock useAuth
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: false,
    });
    
    // Mock useUserStore
    mockUseUserStore.mockReturnValue({
      userStats: mockUserStats,
      userAchievements: mockUserAchievements,
      setUserStats: mockSetUserStats,
      setUserAchievements: mockSetUserAchievements,
      shouldRefetch: mockShouldRefetch,
      clearUserData: mockClearUserData,
    });
    
    // Mock shouldRefetch to return true by default
    mockShouldRefetch.mockReturnValue(true);
    
    // Mock successful API responses
    (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/users/stats') {
        return Promise.resolve({ data: mockUserStats });
      }
      if (url === '/users/achievements') {
        return Promise.resolve({ data: mockUserAchievements });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  describe('初始化', () => {
    it('应该正确初始化hook状态', async () => {
      const { result } = renderHook(() => useUserData());

      expect(result.current.userStats).toEqual(mockUserStats);
      expect(result.current.userAchievements).toEqual(mockUserAchievements);
      
      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('应该在用户登录时自动获取数据', async () => {
      renderHook(() => useUserData());

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith('/users/stats');
        expect(mockApiClient.get).toHaveBeenCalledWith('/users/achievements');
      });

      expect(mockSetUserStats).toHaveBeenCalledWith(mockUserStats);
      expect(mockSetUserAchievements).toHaveBeenCalledWith(mockUserAchievements);
    });

    it('应该在用户未登录时清除数据', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: false,
      });

      renderHook(() => useUserData());

      expect(mockClearUserData).toHaveBeenCalled();
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('数据获取', () => {
    it('应该并行获取用户统计和成就数据', async () => {
      const { result } = renderHook(() => useUserData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/stats');
      expect(mockApiClient.get).toHaveBeenCalledWith('/users/achievements');
    });

    it('应该在shouldRefetch返回false时跳过获取', async () => {
      mockShouldRefetch.mockReturnValue(false);

      renderHook(() => useUserData());

      // 等待一段时间确保没有API调用
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(mockShouldRefetch).toHaveBeenCalled();
    });

    it('应该能够强制刷新数据', async () => {
      mockShouldRefetch.mockReturnValue(false);

      const { result } = renderHook(() => useUserData());

      // 初始时不应该获取数据
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockApiClient.get).not.toHaveBeenCalled();

      // 强制刷新
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      expect(mockSetUserStats).toHaveBeenCalledWith(mockUserStats);
      expect(mockSetUserAchievements).toHaveBeenCalledWith(mockUserAchievements);
    });

    it('应该正确设置加载状态', async () => {
      let resolveStats: (value: any) => void;
      let resolveAchievements: (value: any) => void;

      const statsPromise = new Promise(resolve => {
        resolveStats = resolve;
      });
      const achievementsPromise = new Promise(resolve => {
        resolveAchievements = resolve;
      });

      (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/users/stats') {
          return statsPromise;
        }
        if (url === '/users/achievements') {
          return achievementsPromise;
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const { result } = renderHook(() => useUserData());

      // 应该立即设置loading为true
      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      // 解决promises
      act(() => {
        resolveStats!({ data: mockUserStats });
        resolveAchievements!({ data: mockUserAchievements });
      });

      // 加载完成后应该设置loading为false
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理API错误', async () => {
      const errorMessage = 'Network error';
      (mockApiClient.get as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useUserData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(errorMessage);
      });
    });

    it('应该处理非Error类型的错误', async () => {
      (mockApiClient.get as jest.Mock).mockRejectedValueOnce('String error');

      const { result } = renderHook(() => useUserData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('String error');
      });
    });

    it('应该在错误发生时清除之前的错误', async () => {
      // 第一次调用失败
      (mockApiClient.get as jest.Mock).mockRejectedValueOnce(new Error('First error'));

      const { result } = renderHook(() => useUserData());

      await waitFor(() => {
        expect(result.current.error).toBe('First error');
      });

      // 第二次调用成功
      (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/users/stats') {
          return Promise.resolve({ data: mockUserStats });
        }
        if (url === '/users/achievements') {
          return Promise.resolve({ data: mockUserAchievements });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
    });

    it('应该处理部分API失败的情况', async () => {
      // stats API成功，achievements API失败
      (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/users/stats') {
          return Promise.resolve({ data: mockUserStats });
        }
        if (url === '/users/achievements') {
          return Promise.reject(new Error('Achievements error'));
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const { result } = renderHook(() => useUserData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Achievements error');
      });

      // 成功的API调用应该仍然设置数据
      expect(mockSetUserStats).toHaveBeenCalledWith(mockUserStats);
      expect(mockSetUserAchievements).not.toHaveBeenCalled();
    });
  });

  describe('数据处理', () => {
    it('应该只在有数据时设置store', async () => {
      (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/users/stats') {
          return Promise.resolve({ data: null });
        }
        if (url === '/users/achievements') {
          return Promise.resolve({ data: mockUserAchievements });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderHook(() => useUserData());

      await waitFor(() => {
        expect(mockSetUserStats).not.toHaveBeenCalled();
        expect(mockSetUserAchievements).toHaveBeenCalledWith(mockUserAchievements);
      });
    });

    it('应该处理空响应数据', async () => {
      (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/users/stats') {
          return Promise.resolve({});
        }
        if (url === '/users/achievements') {
          return Promise.resolve({});
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderHook(() => useUserData());

      await waitFor(() => {
        expect(mockSetUserStats).not.toHaveBeenCalled();
        expect(mockSetUserAchievements).not.toHaveBeenCalled();
      });
    });
  });

  describe('用户状态变化', () => {
    it('应该在用户登录时重新获取数据', async () => {
      // 初始状态：用户未登录
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: false,
      });

      const { rerender } = renderHook(() => useUserData());

      expect(mockClearUserData).toHaveBeenCalled();
      expect(mockApiClient.get).not.toHaveBeenCalled();

      // 用户登录
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: false,
      });

      rerender();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      });
    });

    it('应该在用户登出时清除数据', () => {
      // 初始状态：用户已登录
      const { rerender } = renderHook(() => useUserData());

      // 用户登出
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: false,
      });

      rerender();

      expect(mockClearUserData).toHaveBeenCalledTimes(1); // 登出调用
    });

    it('应该在用户切换时重新获取数据', async () => {
      const { rerender } = renderHook(() => useUserData());

      // 等待初始数据加载
      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      });

      // 切换到不同用户
      const newUser = {
        id: 'user-2',
        username: 'newuser',
        email: 'new@example.com',
        name: 'New User',
        role: 'STUDENT' as const,
      };

      mockUseAuth.mockReturnValue({
        user: newUser,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: false,
      });

      rerender();

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(4); // 初始2次 + 新用户2次
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理快速连续的refetch调用', async () => {
      const { result } = renderHook(() => useUserData());

      // 等待初始加载完成
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 快速连续调用refetch
      const promises = [
        result.current.refetch(),
        result.current.refetch(),
        result.current.refetch(),
      ];

      await act(async () => {
        await Promise.all(promises);
      });

      // 应该有多次API调用（每次refetch都会调用）
      expect(mockApiClient.get).toHaveBeenCalledTimes(8); // 初始2次 + 3次refetch * 2
    });

    it('应该处理在组件卸载后的异步响应', async () => {
      let resolveStats: (value: any) => void;
      const statsPromise = new Promise(resolve => {
        resolveStats = resolve;
      });

      (mockApiClient.get as jest.Mock).mockImplementation((url: string) => {
        if (url === '/users/stats') {
          return statsPromise;
        }
        if (url === '/users/achievements') {
          return Promise.resolve({ data: mockUserAchievements });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      const { unmount } = renderHook(() => useUserData());

      // 卸载组件
      unmount();

      // 解决promise（模拟异步响应）
      act(() => {
        resolveStats!({ data: mockUserStats });
      });

      // 不应该抛出错误或尝试更新已卸载的组件
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该处理空的API响应', async () => {
      (mockApiClient.get as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useUserData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockSetUserStats).not.toHaveBeenCalled();
      expect(mockSetUserAchievements).not.toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });
  });
});