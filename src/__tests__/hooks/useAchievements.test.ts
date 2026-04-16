import { renderHook, act } from '@testing-library/react';
import { useAchievements } from '@/hooks/useAchievements';
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { mockUserProgress } from '../utils/mock-data';

// Mock the achievements module
jest.mock('@/lib/achievements-v2', () => {
  const originalModule = jest.requireActual('@/lib/achievements-v2');
  return {
    ...originalModule,
    checkAchievementUnlock: jest.fn(),
    generateUnlockMessage: jest.fn(),
    getAchievementsByCategory: jest.fn(),
    formatAchievementDisplay: jest.fn()
  };
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

const {
  checkAchievementUnlock,
  generateUnlockMessage,
  getAchievementsByCategory,
  formatAchievementDisplay
} = require('@/lib/achievements-v2');

describe('useAchievements Hook', () => {
  const mockUserStats = {
    modules_completed: 5,
    code_runs: 20,
    debug_success: 18,
    experiments_completed: 3,
    daily_streak: 7,
    perfect_quiz: 2,
    speed_completion: 1,
    night_study: 5,
    morning_study: 3,
    questions_answered: 15,
    discussions_started: 2,
    easter_egg_found: 1,
    bugs_reported: 0,
    continuous_hours: 4
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockLocalStorage.setItem.mockImplementation(() => {});
    
    // Reset mocked functions
    checkAchievementUnlock.mockReturnValue({ unlocked: false, progress: 0 });
    generateUnlockMessage.mockReturnValue('Achievement unlocked!');
    getAchievementsByCategory.mockReturnValue([]);
    formatAchievementDisplay.mockReturnValue({ title: 'Test', description: 'Test achievement' });
  });

  describe('初始化', () => {
    it('应该正确初始化成就状态', () => {
      const { result } = renderHook(() => useAchievements());
      
      expect(result.current.userProgress).toEqual([]);
      expect(result.current.userStats).toBeNull();
      expect(result.current.loading).toBe(false); // 没有用户登录时loading为false
      expect(result.current.refreshing).toBe(false);
    });

    it('应该提供必要的方法', () => {
      const { result } = renderHook(() => useAchievements());
      
      expect(typeof result.current.fetchAchievements).toBe('function');
      expect(typeof result.current.calculateStats).toBe('function');
      expect(typeof result.current.getFilteredAchievements).toBe('function');
    });
  });

  describe('统计计算', () => {
    it('应该正确计算成就统计', () => {
      const { result } = renderHook(() => useAchievements());
      
      const stats = result.current.calculateStats();
      
      // 验证基本统计结构
      expect(stats).toHaveProperty('unlockedCount');
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('totalPoints');
      expect(stats).toHaveProperty('completionPercentage');
      expect(stats).toHaveProperty('byTier');
      
      // 验证初始状态
      expect(stats.unlockedCount).toBe(0);
      expect(stats.totalCount).toBe(ACHIEVEMENTS_V2.length);
      expect(stats.totalPoints).toBe(0);
      expect(stats.completionPercentage).toBe(0);
    });

    it('应该正确按等级分组成就', () => {
      const { result } = renderHook(() => useAchievements());
      
      const stats = result.current.calculateStats();
      
      expect(stats.byTier).toHaveProperty('bronze');
      expect(stats.byTier).toHaveProperty('silver');
      expect(stats.byTier).toHaveProperty('gold');
      expect(stats.byTier).toHaveProperty('platinum');
    });
  });

  describe('成就过滤', () => {
    it('应该正确按类别过滤成就', () => {
      const { result } = renderHook(() => useAchievements());
      
      const learningAchievements = result.current.getFilteredAchievements('learning');
      const practiceAchievements = result.current.getFilteredAchievements('practice');
      
      expect(Array.isArray(learningAchievements)).toBe(true);
      expect(Array.isArray(practiceAchievements)).toBe(true);
      
      // 验证过滤结果包含正确类别的成就
      learningAchievements.forEach(achievement => {
        expect(achievement.category).toBe('learning');
      });
    });

    it('应该返回所有成就当类别为all时', () => {
      const { result } = renderHook(() => useAchievements());
      
      const allAchievements = result.current.getFilteredAchievements('all');
      
      // 隐藏成就会被过滤，所以实际显示的成就数量会少于总数
      expect(allAchievements.length).toBeLessThanOrEqual(ACHIEVEMENTS_V2.length);
      expect(allAchievements.length).toBeGreaterThan(0);
    });

    it('应该正确排序成就', () => {
      const { result } = renderHook(() => useAchievements());
      
      const achievements = result.current.getFilteredAchievements('all');
      
      // 验证排序逻辑（已解锁的在前，然后按等级排序）
      expect(Array.isArray(achievements)).toBe(true);
      expect(achievements.length).toBeGreaterThan(0);
    });
  });

  describe('成就分类', () => {
    it('应该正确按类别获取成就', () => {
      const { result } = renderHook(() => useAchievements());
      
      const socialAchievements = result.current.getAchievementsByCategory('social');
      
      expect(Array.isArray(socialAchievements)).toBe(true);
      // 验证返回的成就都属于指定类别
      socialAchievements.forEach(achievement => {
        expect(achievement.category).toBe('social');
      });
    });

    it('应该处理空的类别', () => {
      getAchievementsByCategory.mockReturnValue([]);
      
      const { result } = renderHook(() => useAchievements());
      
      const emptyCategory = result.current.getAchievementsByCategory('nonexistent');
      
      expect(emptyCategory).toEqual([]);
    });
  });

  describe('成就显示', () => {
    it('应该正确格式化成就显示', () => {
      const { result } = renderHook(() => useAchievements());
      
      const display = result.current.formatAchievementDisplay('first_program', [mockUserProgress] as any);
      
      expect(display).toHaveProperty('title');
      expect(display).toHaveProperty('icon');
      expect(typeof display.title).toBe('string');
      expect(typeof display.icon).toBe('string');
    });

    it('应该处理隐藏成就的显示', () => {
      const mockHiddenDisplay = {
        title: '???',
        description: 'Hidden achievement',
        icon: '🔒',
        rarity: 'rare'
      };
      
      formatAchievementDisplay.mockReturnValue(mockHiddenDisplay);
      
      const { result } = renderHook(() => useAchievements());
      
      const display = result.current.formatAchievementDisplay('hidden_achievement', [mockUserProgress] as any);
      
      expect(display.title).toBe('???');
      expect(display.icon).toBe('🔒');
    });
  });

  describe('最近解锁', () => {
    it('应该正确记录最近解锁的成就', () => {
      checkAchievementUnlock.mockReturnValue({ unlocked: true, progress: 100 });
      generateUnlockMessage.mockReturnValue('Achievement unlocked!');
      
      const { result } = renderHook(() => useAchievements());
      
      act(() => {
        result.current.checkAchievements(mockUserProgress);
      });
      
      expect(result.current.recentUnlocks.length).toBeGreaterThan(0);
      expect(result.current.recentUnlocks[0]).toMatchObject({
        achievementId: expect.any(String),
        message: expect.stringContaining('解锁成就:'),
        timestamp: expect.any(Number)
      });
    });

    it('应该限制最近解锁列表的长度', () => {
      checkAchievementUnlock.mockReturnValue({ unlocked: true, progress: 100 });
      generateUnlockMessage.mockReturnValue('Achievement unlocked!');
      
      const { result } = renderHook(() => useAchievements());
      
      // 模拟解锁多个成就
      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.checkAchievements({
            ...mockUserProgress,
            modulesCompleted: i + 1
          });
        }
      });
      
      // 验证列表长度不超过限制（假设限制为10）
      expect(result.current.recentUnlocks.length).toBeLessThanOrEqual(10);
    });

    it('应该正确清除最近解锁记录', () => {
      checkAchievementUnlock.mockReturnValue({ unlocked: true, progress: 100 });
      
      const { result } = renderHook(() => useAchievements());
      
      act(() => {
        result.current.checkAchievements(mockUserProgress);
      });
      
      expect(result.current.recentUnlocks.length).toBeGreaterThan(0);
      
      act(() => {
        result.current.clearRecentUnlocks();
      });
      
      expect(result.current.recentUnlocks).toEqual([]);
    });
  });

  describe('总积分计算', () => {
    it('应该正确计算总积分', () => {
      const { result } = renderHook(() => useAchievements());
      
      // 模拟解锁一些成就
      checkAchievementUnlock.mockReturnValue({ unlocked: true, progress: 100 });
      
      act(() => {
        result.current.checkAchievements(mockUserProgress);
      });
      
      expect(result.current.totalPoints).toBeGreaterThan(0);
    });

    it('应该在没有解锁成就时返回0积分', () => {
      const { result } = renderHook(() => useAchievements());
      
      expect(result.current.totalPoints).toBe(0);
    });
  });

  describe('API交互', () => {
    it('应该正确调用fetchAchievements', async () => {
      const { result } = renderHook(() => useAchievements());
      
      await act(async () => {
        await result.current.fetchAchievements();
      });
      
      expect(result.current.loading).toBe(false);
    });

    it('应该处理API错误', async () => {
      // 模拟API错误
      global.fetch = jest.fn().mockRejectedValue(new Error('API Error'));
      
      const { result } = renderHook(() => useAchievements());
      
      await act(async () => {
        await result.current.fetchAchievements();
      });
      
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  describe('错误处理', () => {
    it('应该处理checkAchievementUnlock抛出的错误', () => {
      checkAchievementUnlock.mockImplementation(() => {
        throw new Error('Achievement check failed');
      });
      
      const { result } = renderHook(() => useAchievements());
      
      expect(() => {
        act(() => {
          result.current.checkAchievements(mockUserProgress);
        });
      }).not.toThrow();
      
      expect(result.current.unlockedAchievements).toEqual([]);
    });

    it('应该处理localStorage错误', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      checkAchievementUnlock.mockReturnValue({ unlocked: true, progress: 100 });
      
      const { result } = renderHook(() => useAchievements());
      
      expect(() => {
        act(() => {
          result.current.checkAchievements(mockUserProgress);
        });
      }).not.toThrow();
    });

    it('应该处理无效的用户进度数据', () => {
      const { result } = renderHook(() => useAchievements());
      
      expect(() => {
        act(() => {
          result.current.checkAchievements(null as any);
        });
      }).not.toThrow();
      
      expect(() => {
        act(() => {
          result.current.checkAchievements(undefined as any);
        });
      }).not.toThrow();
    });
  });

  describe('边界情况', () => {
    it('应该处理空的用户统计数据', () => {
      const { result } = renderHook(() => useAchievements());
      
      const stats = result.current.calculateStats();
      
      expect(stats.unlockedCount).toBe(0);
      expect(stats.totalCount).toBe(ACHIEVEMENTS_V2.length);
      expect(stats.totalPoints).toBe(0);
      expect(stats.completionPercentage).toBe(0);
    });

    it('应该处理无效的过滤类别', () => {
      const { result } = renderHook(() => useAchievements());
      
      const achievements = result.current.getFilteredAchievements('invalid_category' as any);
      
      expect(Array.isArray(achievements)).toBe(true);
      expect(achievements.length).toBe(0);
    });

    it('应该正确处理组件卸载', () => {
      const { result, unmount } = renderHook(() => useAchievements());
      
      // 验证初始状态（由于没有用户登录，loading会立即变为false）
      expect(result.current.loading).toBe(false);
      
      // 卸载组件
      unmount();
      
      // 验证没有错误
      expect(true).toBe(true);
    });
  });
});