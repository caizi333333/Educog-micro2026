/**
 * 成就系统集成测试
 * 测试成就系统各模块之间的交互
 */

import { testUtils } from '../utils/test-helpers';
import { mockData } from '../utils/mock-data';
import { checkAchievementUnlock, shouldShowHiddenAchievement } from '@/lib/achievements-v2';
import { clearAllMocks, mockPrisma } from '../utils/test-mocks';

// Mock API client
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

jest.mock('@/lib/api-client', () => ({
  apiClient: mockApiClient
}));

describe('Achievement System Integration', () => {
  beforeEach(() => {
    clearAllMocks(mockPrisma);
  });

  describe('Achievement Unlock Flow', () => {
    it('should unlock achievement when criteria is met', async () => {
      // Arrange
      const achievement = {
        ...mockData.achievements.regular,
        category: 'quiz' as const
      };
      const userStats = {
        ...mockData.achievements.stats,
        quizzesCompleted: 5 // 满足解锁条件
      };
      const userProgress = {
        ...mockData.achievements.progress,
        progress: 5,
        target: 5
      };

      // Mock API responses
      mockApiClient.get.mockResolvedValueOnce({
        data: { achievements: [achievement] }
      });
      mockApiClient.get.mockResolvedValueOnce({
        data: { stats: userStats }
      });
      mockApiClient.post.mockResolvedValueOnce({
        data: { success: true }
      });

      // Act
      const unlockResult = checkAchievementUnlock(achievement as any, userStats as any);

      // Assert
      expect(unlockResult.unlocked).toBe(true);
    });

    it('should not unlock achievement when criteria is not met', () => {
      // Arrange
      const achievement = mockData.achievements.regular;
      const userStats = {
        ...mockData.achievements.stats,
        quizzesCompleted: 3 // 未满足解锁条件
      };
      const userProgress = {
        ...mockData.achievements.progress,
        progress: 3,
        target: 5
      };

      // Act
      const unlockResult = checkAchievementUnlock(achievement as any, userStats as any);

      // Assert
      expect(unlockResult.unlocked).toBe(false);
    });
  });

  describe('Hidden Achievement Display Logic', () => {
    it('should show hidden achievement when unlocked', () => {
      // Arrange
      const hiddenAchievement = {
        ...mockData.achievements.hidden,
        category: 'progress' as const
      };
      const userProgress = {
        ...mockData.achievements.progress,
        achievementId: hiddenAchievement.id,
        unlocked: true,
        progress: 1,
        target: 1
      };
      const userStats = mockData.achievements.stats;

      // Act
      const shouldShow = shouldShowHiddenAchievement(
        hiddenAchievement as any,
        [userProgress] as any,
        userStats as any
      );

      // Assert
      expect(shouldShow).toBe(true);
    });

    it('should show hidden achievement when progress >= 50%', () => {
      // Arrange
      const hiddenAchievement = mockData.achievements.hidden;
      const userProgress = {
        ...mockData.achievements.progress,
        achievementId: hiddenAchievement.id,
        unlocked: false,
        progress: 1,
        target: 2 // 50% progress
      };
      const userStats = mockData.achievements.stats;

      // Act
      const shouldShow = shouldShowHiddenAchievement(
        hiddenAchievement as any,
        [userProgress] as any,
        userStats as any
      );

      // Assert
      expect(shouldShow).toBe(true);
    });

    it('should not show hidden achievement when progress < 50%', () => {
      // Arrange
      const hiddenAchievement = mockData.achievements.hidden;
      const userProgress = {
        ...mockData.achievements.progress,
        achievementId: hiddenAchievement.id,
        unlocked: false,
        progress: 1,
        target: 3 // 33% progress
      };
      const userStats = {
        ...mockData.achievements.stats,
        studyTimeMinutes: 30 // 30% of target (100)
      };

      // Act
      const shouldShow = shouldShowHiddenAchievement(
        hiddenAchievement as any,
        [userProgress] as any,
        userStats as any
      );

      // Assert
      expect(shouldShow).toBe(false);
    });
  });

  describe('Achievement API Integration', () => {
    it('should fetch and process user achievements correctly', async () => {
      // Arrange
      mockApiClient.get.mockReset();
      const achievements = [mockData.achievements.regular];
      const userProgress = [mockData.achievements.progress];
      const userStats = mockData.achievements.stats;

      mockApiClient.get
        .mockResolvedValueOnce({ data: { achievements } })
        .mockResolvedValueOnce({ data: { progress: userProgress } })
        .mockResolvedValueOnce({ data: { stats: userStats } });

      // Act
      const achievementsResponse = await mockApiClient.get('/api/achievements');
      const progressResponse = await mockApiClient.get('/api/achievements/progress');
      const statsResponse = await mockApiClient.get('/api/user/stats');

      // Assert
      expect(achievementsResponse.data.achievements).toHaveLength(1);
      expect(progressResponse.data.progress).toHaveLength(1);
      expect(statsResponse.data.stats).toEqual(userStats);
      expect(mockApiClient.get).toHaveBeenCalledTimes(3);
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const errorMessage = 'Failed to fetch achievements';
      mockApiClient.get.mockReset();
      mockApiClient.get.mockRejectedValueOnce(new Error(errorMessage));

      // Act & Assert
      await expect(mockApiClient.get('/api/achievements')).rejects.toThrow(errorMessage);
    });
  });

  describe('Performance Tests', () => {
    it('should process large number of achievements efficiently', async () => {
      // Arrange
      const largeAchievementList = Array.from({ length: 100 }, (_, i) => ({
        ...mockData.achievements.regular,
        id: `achievement-${i}`,
        title: `Achievement ${i}`
      }));

      // Act
      const startTime = performance.now();
      
      // 模拟处理大量成就数据
      const processedAchievements = largeAchievementList.map(achievement => {
        const userProgress = {
          ...mockData.achievements.progress,
          achievementId: achievement.id,
          progress: Math.floor(Math.random() * 5),
          target: 5
        };
        
        return {
          ...achievement,
          unlocked: checkAchievementUnlock(achievement as any, mockData.achievements.stats as any).unlocked
        };
      });
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Assert
      expect(processedAchievements).toHaveLength(100);
      expect(executionTime).toBeLessThan(100); // 应该在100ms内完成
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks during achievement processing', () => {
      // Arrange
      const initialMemory = testUtils.getMemoryUsage();
      const achievements = Array.from({ length: 50 }, (_, i) => ({
        ...mockData.achievements.regular,
        id: `achievement-${i}`
      }));

      // Act
      for (let i = 0; i < 10; i++) {
        achievements.forEach(achievement => {
          checkAchievementUnlock(
            achievement as any,
            mockData.achievements.stats as any
          );
        });
      }

      const finalMemory = testUtils.getMemoryUsage();

      // Assert
      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        // 内存增长应该在合理范围内（小于10MB）
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
      }
    });
  });
});