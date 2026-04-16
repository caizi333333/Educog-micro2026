import { renderHook, act, waitFor } from '@testing-library/react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('useAnalytics Hook', () => {
  let mockToast: jest.Mock;
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    name: 'Test User',
    role: 'STUDENT' as const,
  };

  const mockProfileData = {
    profile: {
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      createdAt: '2024-01-01T00:00:00Z',
      lastLoginAt: '2024-01-15T00:00:00Z',
      stats: {
        totalLearningTime: 3600,
      },
    },
  };

  const mockQuizData = {
    history: [
      {
        id: 'quiz-1',
        score: 8,
        totalQuestions: 10,
        answers: JSON.stringify({ q1: 'A', q2: 'B' }),
        completedAt: '2024-01-10T00:00:00Z',
      },
      {
        id: 'quiz-2',
        score: 9,
        totalQuestions: 10,
        answers: JSON.stringify({ q1: 'C', q2: 'D' }),
        completedAt: '2024-01-12T00:00:00Z',
      },
    ],
  };

  const mockProgressData = {
    progress: [
      {
        id: 'progress-1',
        moduleId: 'module-1',
        chapterId: 'chapter-1',
        progress: 100,
        timeSpent: 1800,
        lastAccessAt: '2024-01-10T00:00:00Z',
      },
      {
        id: 'progress-2',
        moduleId: 'module-2',
        chapterId: 'chapter-2',
        progress: 75,
        timeSpent: 1200,
        lastAccessAt: '2024-01-12T00:00:00Z',
      },
    ],
  };

  const mockAchievementsData = {
    stats: {
      totalQuizzes: 10,
      averageScore: 85,
      streakDays: 5,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock useAuth
    mockUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      isAuthenticated: true,
    });
    
    // Mock useToast
    mockToast = jest.fn();
    mockUseToast.mockReturnValue({
      toast: mockToast,
      dismiss: jest.fn(),
      toasts: [],
    });
    
    // Mock localStorage
    mockLocalStorage.getItem.mockReturnValue('valid-token');
    
    // Mock successful API responses
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url.includes('/api/user/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProfileData),
          } as Response);
        }
        if (url.includes('/api/quiz/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockQuizData),
          } as Response);
        }
        if (url.includes('/api/learning-progress')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProgressData),
          } as Response);
        }
        if (url.includes('/api/achievements')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockAchievementsData),
          } as Response);
        }
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  describe('初始化', () => {
    it('应该正确初始化hook状态', () => {
      const { result } = renderHook(() => useAnalytics());

      expect(result.current.loading).toBe(true);
      expect(result.current.profile).toBeNull();
      expect(result.current.quizHistory).toEqual([]);
      expect(result.current.learningProgress).toEqual([]);
      expect(result.current.achievements).toEqual({ stats: {} });
    });

    it('应该在用户登录时获取数据', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(result.current.profile).toEqual(mockProfileData.profile);
      expect(result.current.quizHistory).toEqual(mockQuizData.history);
      expect(result.current.learningProgress).toEqual(mockProgressData.progress);
      expect(result.current.achievements).toEqual(mockAchievementsData);
    });

    it('应该在用户未登录时不获取数据', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        loading: false,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: false,
      });

      renderHook(() => useAnalytics());

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('应该在认证加载中时等待', () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        loading: true,
        login: jest.fn(),
        logout: jest.fn(),
        refreshUser: jest.fn(),
        isAuthenticated: true,
      });

      renderHook(() => useAnalytics());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('数据获取', () => {
    it('应该并行获取所有API数据', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // useAnalytics 内部会增加 AbortController.signal，这里只断言 headers
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user/profile',
        expect.objectContaining({ headers: { 'Authorization': 'Bearer valid-token' } })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/quiz/history',
        expect.objectContaining({ headers: { 'Authorization': 'Bearer valid-token' } })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/learning-progress',
        expect.objectContaining({ headers: { 'Authorization': 'Bearer valid-token' } })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/achievements',
        expect.objectContaining({ headers: { 'Authorization': 'Bearer valid-token' } })
      );
    });

    it('应该能够手动刷新数据', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 清除之前的调用
      mockFetch.mockClear();

      await act(async () => {
        await result.current.fetchAnalyticsData();
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('错误处理', () => {
    it('应该处理API请求失败', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 单个接口失败会走 fallback，不应导致整体崩溃
      expect(result.current.profile).toBeNull();
    });

    it('应该处理API响应错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response);

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 非 ok 响应会走 fallback
      expect(result.current.profile).toBeNull();
    });

    it('应该处理JSON解析错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('JSON parse error')),
      } as Response);

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // json 解析错误会走 fallback
      expect(result.current.profile).toBeNull();
    });
  });

  describe('知识点掌握度计算', () => {
    it('应该在没有测验历史时返回零掌握度', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/quiz/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ history: [] }),
          } as Response);
        }
        return mockFetch.getMockImplementation()!(url);
      });

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mastery = result.current.calculateKnowledgeMastery();
      expect(mastery).toHaveLength(11); // kaMapping中有11个知识点
      expect(mastery[0]).toEqual({
        topic: 'CPU结构',
        mastery: 0,
        details: {
          '寄存器': 0,
          'ALU': 0,
          '控制器': 0,
          '总线': 0,
        },
      });
    });

    it('应该基于测验历史计算掌握度', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const mastery = result.current.calculateKnowledgeMastery();
      expect(mastery).toHaveLength(11);
      expect(mastery[0]?.topic).toBe('CPU结构');
      expect(mastery[0]?.mastery).toBeGreaterThanOrEqual(0);
      expect(mastery[0]?.mastery).toBeLessThanOrEqual(100);
      expect(mastery[0]?.details).toHaveProperty('寄存器');
    });

    it('应该处理无效的测验答案JSON', async () => {
      const invalidQuizData = {
        history: [
          {
            id: 'quiz-1',
            score: 8,
            totalQuestions: 10,
            answers: 'invalid json',
            completedAt: '2024-01-10T00:00:00Z',
          },
        ],
      };

      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/quiz/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(invalidQuizData),
          } as Response);
        }
        return mockFetch.getMockImplementation()!(url);
      });

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 应该不抛出错误，并返回有效的掌握度数据
      expect(() => result.current.calculateKnowledgeMastery()).not.toThrow();
      const mastery = result.current.calculateKnowledgeMastery();
      expect(mastery).toHaveLength(11);
    });
  });

  describe('学习统计计算', () => {
    it('应该正确计算学习统计', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const stats = result.current.calculateLearningStats();
      
      expect(stats.totalModules).toBe(2);
      expect(stats.completedModules).toBe(1); // 只有一个模块进度为100%
      expect(stats.totalTime).toBe(50); // (1800 + 1200) / 60 = 50分钟
      expect(stats.averageScore).toBe(85); // (80 + 90) / 2 = 85
      expect(stats.quizCount).toBe(2);
      expect(stats.weeklyProgress).toHaveLength(7);
      expect(stats.quizScoreTrend).toHaveLength(2);
    });

    it('应该处理空数据', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/quiz/history')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ history: [] }),
            } as Response);
          }
          if (url.includes('/api/learning-progress')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ progress: [] }),
            } as Response);
          }
        }
        return mockFetch.getMockImplementation()!(url);
      });

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const stats = result.current.calculateLearningStats();
      
      expect(stats.totalModules).toBe(0);
      expect(stats.completedModules).toBe(0);
      expect(stats.totalTime).toBe(0);
      expect(stats.averageScore).toBe(0);
      expect(stats.quizCount).toBe(0);
    });

    it('应该正确计算测验分数趋势', async () => {
      // 创建超过10个测验的数据
      const manyQuizzes = Array.from({ length: 15 }, (_, i) => ({
        id: `quiz-${i + 1}`,
        score: 8 + (i % 3),
        totalQuestions: 10,
        answers: '{}',
        completedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      }));

      // 重置所有mock
      mockFetch.mockReset();
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/user/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ profile: { id: '1', username: 'test' } }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/api/quiz/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ history: manyQuizzes }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/api/learning-progress')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ progress: [] }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/api/achievements')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ stats: {} }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const stats = result.current.calculateLearningStats();
      
      // 应该只显示最近10次测验
      expect(stats.quizScoreTrend).toHaveLength(10);
      expect(stats.quizScoreTrend[0]?.quiz).toBe('测验1');
      expect(stats.quizScoreTrend[9]?.quiz).toBe('测验10');
    });
  });

  describe('学习建议生成', () => {
    it('应该生成学习建议', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const advice = result.current.generateLearningAdvice();
      
      expect(advice).toHaveProperty('weakAreas');
      expect(advice).toHaveProperty('strongAreas');
      expect(advice).toHaveProperty('suggestions');
      expect(advice.weakAreas.length).toBeLessThanOrEqual(3);
      expect(advice.strongAreas.length).toBeLessThanOrEqual(3);
      expect(advice.suggestions).toBeInstanceOf(Array);
    });

    it('应该根据掌握度排序薄弱和强项领域', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const advice = result.current.generateLearningAdvice();
      
      // 薄弱领域应该按掌握度从低到高排序
      if (advice.weakAreas.length > 1) {
        for (let i = 1; i < advice.weakAreas.length; i++) {
          expect(advice.weakAreas[i]?.mastery).toBeGreaterThanOrEqual(
            advice.weakAreas[i - 1]?.mastery ?? 0
          );
        }
      }
      
      // 强项领域应该按掌握度从高到低排序
      if (advice.strongAreas.length > 1) {
        for (let i = 1; i < advice.strongAreas.length; i++) {
          expect(advice.strongAreas[i]?.mastery).toBeLessThanOrEqual(
            advice.strongAreas[i - 1]?.mastery ?? 100
          );
        }
      }
    });

    it('应该为薄弱领域生成建议', async () => {
      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const advice = result.current.generateLearningAdvice();
      
      expect(advice.suggestions.length).toBe(advice.weakAreas.length);
      advice.suggestions.forEach((suggestion, index) => {
        expect(suggestion).toContain(advice.weakAreas[index]?.topic ?? '');
        expect(suggestion).toContain('加强');
        expect(suggestion).toContain('学习和练习');
      });
    });
  });

  describe('边界情况', () => {
    it('应该处理缺少token的情况', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 缺少 token 会直接 return，不应触发 fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('应该处理部分API失败的情况', async () => {
      let callCount = 0;
      const baseImpl = mockFetch.getMockImplementation();
      mockFetch.mockImplementation((url) => {
        callCount++;
        if (callCount === 1) {
          // 第一个API调用失败
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({}),
          } as Response);
        }
        // 其他API调用成功
        return baseImpl!(url as any);
      });

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 部分失败应走 fallback，且不影响其它数据
      expect(result.current.profile).toBeNull();
      expect(result.current.quizHistory).toEqual(mockQuizData.history);
      expect(mockToast).not.toHaveBeenCalled();
    });

    it('应该处理极端的测验分数', async () => {
      const extremeQuizData = {
        history: [
          {
            id: 'quiz-1',
            score: 0,
            totalQuestions: 10,
            answers: '{}',
            completedAt: '2024-01-10T00:00:00Z',
          },
          {
            id: 'quiz-2',
            score: 10,
            totalQuestions: 10,
            answers: '{}',
            completedAt: '2024-01-12T00:00:00Z',
          },
        ],
      };

      // 重置所有mock
      mockFetch.mockReset();
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/user/profile')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ profile: { id: '1', username: 'test' } }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/api/quiz/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(extremeQuizData),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/api/learning-progress')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ progress: [] }),
          } as Response);
        }
        if (typeof url === 'string' && url.includes('/api/achievements')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ stats: {} }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);
      });

      const { result } = renderHook(() => useAnalytics());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const stats = result.current.calculateLearningStats();
      expect(stats.averageScore).toBe(50); // (0 + 100) / 2 = 50
    });
  });
});
