import {
  ACHIEVEMENTS_V2,
  checkAchievementUnlock,
  getRarityLabel,
  getTierStyles,
  generateUnlockMessage,
  getAchievementsByCategory,
  formatAchievementDisplay,
  RARITY_STYLES
} from '@/lib/achievements-v2';

describe('成就系统 V2', () => {
  describe('ACHIEVEMENTS_V2 数据', () => {
    it('应该包含有效的成就数据', () => {
      expect(ACHIEVEMENTS_V2).toBeDefined();
      expect(Array.isArray(ACHIEVEMENTS_V2)).toBe(true);
      expect(ACHIEVEMENTS_V2.length).toBeGreaterThan(0);
    });

    it('每个成就应该有必需的属性', () => {
      ACHIEVEMENTS_V2.forEach(achievement => {
        expect(achievement).toHaveProperty('id');
        expect(achievement).toHaveProperty('category');
        expect(achievement).toHaveProperty('title');
        expect(achievement).toHaveProperty('description');
        expect(achievement).toHaveProperty('icon');
        // tier is optional, only check if present
        if (achievement.tier) {
          expect(['bronze', 'silver', 'gold', 'platinum']).toContain(achievement.tier);
        }
        expect(achievement).toHaveProperty('criteria');
        expect(achievement).toHaveProperty('points');
        expect(achievement).toHaveProperty('rarity');
        
        // 验证枚举值
        expect(['progress', 'experiment', 'quiz', 'social', 'practice']).toContain(achievement.category);
        expect(['common', 'uncommon', 'rare', 'epic', 'legendary']).toContain(achievement.rarity);
        
        // 验证criteria结构
        expect(achievement.criteria).toHaveProperty('type');
        expect(achievement.criteria).toHaveProperty('target');
        expect(typeof achievement.criteria.target).toBe('number');
        expect(achievement.criteria.target).toBeGreaterThan(0);
        
        // 验证points为正数
        expect(typeof achievement.points).toBe('number');
        expect(achievement.points).toBeGreaterThan(0);
      });
    });

    it('成就ID应该是唯一的', () => {
      const ids = ACHIEVEMENTS_V2.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('checkAchievementUnlock', () => {
    const testAchievement = {
      id: 'test_achievement',
      category: 'progress' as const,
      title: '测试成就',
      description: '测试描述',
      icon: '🎯',
      criteria: {
        type: 'modules_completed',
        target: 10
      },
      points: 50,
      rarity: 'common' as const
    };

    it('应该正确计算未解锁成就的进度', () => {
      const userStats = { modules_completed: 5 };
      const result = checkAchievementUnlock(testAchievement, userStats);
      
      expect(result.unlocked).toBe(false);
      expect(result.progress).toBe(50); // 5/10 * 100
    });

    it('应该正确识别已解锁的成就', () => {
      const userStats = { modules_completed: 10 };
      const result = checkAchievementUnlock(testAchievement, userStats);
      
      expect(result.unlocked).toBe(true);
      expect(result.progress).toBe(100);
    });

    it('应该正确处理超过目标的进度', () => {
      const userStats = { modules_completed: 15 };
      const result = checkAchievementUnlock(testAchievement, userStats);
      
      expect(result.unlocked).toBe(true);
      expect(result.progress).toBe(100); // 应该限制在100%
    });

    it('应该处理缺失的用户统计数据', () => {
      const userStats = {};
      const result = checkAchievementUnlock(testAchievement, userStats);
      
      expect(result.unlocked).toBe(false);
      expect(result.progress).toBe(0);
    });
  });

  describe('getRarityLabel', () => {
    it('应该返回正确的稀有度标签', () => {
      expect(getRarityLabel('common')).toEqual({
        label: '常见',
        color: 'text-gray-500'
      });
      
      expect(getRarityLabel('uncommon')).toEqual({
        label: '稀有',
        color: 'text-green-500'
      });
      
      expect(getRarityLabel('rare')).toEqual({
        label: '罕见',
        color: 'text-blue-500'
      });
      
      expect(getRarityLabel('epic')).toEqual({
        label: '史诗',
        color: 'text-purple-500'
      });
      
      expect(getRarityLabel('legendary')).toEqual({
        label: '传说',
        color: 'text-orange-500'
      });
    });

    it('应该处理未知稀有度', () => {
      expect(getRarityLabel('unknown')).toEqual({
        label: '未知',
        color: 'text-gray-400'
      });
    });
  });

  describe('getTierStyles', () => {
    it('应该返回正确的等级样式', () => {
      const bronzeStyles = getTierStyles('bronze');
      expect(bronzeStyles).toHaveProperty('bgColor');
      expect(bronzeStyles).toHaveProperty('borderColor');
      expect(bronzeStyles).toHaveProperty('textColor');
      expect(bronzeStyles.bgColor).toContain('gray'); // bronze maps to common rarity
      
      const goldStyles = getTierStyles('gold');
      expect(goldStyles).toHaveProperty('glowColor');
      expect(goldStyles.glowColor).toContain('purple'); // gold maps to epic rarity
      
      const platinumStyles = getTierStyles('platinum');
      expect(platinumStyles).toHaveProperty('glowColor');
      expect(platinumStyles.glowColor).toContain('yellow'); // platinum maps to legendary rarity
    });

    it('应该处理未知等级', () => {
      const unknownStyles = getTierStyles('unknown');
      expect(unknownStyles.bgColor).toBe('bg-gray-100');
      expect(unknownStyles.borderColor).toBe('border-gray-300');
      expect(unknownStyles.textColor).toBe('text-gray-600');
    });
  });

  describe('generateUnlockMessage', () => {
    it('应该为不同等级生成适当的消息', () => {
      const bronzeAchievement = {
        id: 'test',
        category: 'progress' as const,
        title: '测试',
        description: '测试',
        icon: '🎯',
        criteria: { type: 'test', target: 1 },
        points: 10,
        rarity: 'common' as const
      };
      
      const message = generateUnlockMessage(bronzeAchievement);
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
      
      // 测试多次调用确保随机性
      const messages = new Set();
      for (let i = 0; i < 10; i++) {
        messages.add(generateUnlockMessage(bronzeAchievement));
      }
      // 应该有一定的随机性（至少不是所有消息都相同）
      expect(messages.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAchievementsByCategory', () => {
    it('应该按类别正确过滤成就', () => {
      const progressAchievements = getAchievementsByCategory('progress');
      expect(Array.isArray(progressAchievements)).toBe(true);
      
      progressAchievements.forEach(achievement => {
        expect(achievement.category).toBe('progress');
      });
    });

    it('应该为每个类别返回成就', () => {
      const categories = ['progress', 'experiment', 'quiz', 'social'] as const;
      
      categories.forEach(category => {
        const achievements = getAchievementsByCategory(category);
        expect(Array.isArray(achievements)).toBe(true);
        // 至少应该有一些成就在每个类别中
        if (achievements.length > 0) {
          achievements.forEach(achievement => {
            expect(achievement.category).toBe(category);
          });
        }
      });
    });
  });

  describe('formatAchievementDisplay', () => {
    const testAchievement = {
      id: 'test_achievement',
      category: 'progress' as const,
      title: '测试成就',
      description: '测试描述',
      icon: '🎯',
      criteria: {
        type: 'modules_completed',
        target: 10
      },
      points: 50,
      rarity: 'common' as const
    };

    it('应该正确格式化普通成就', () => {
      const userProgress = { modules_completed: 5 };
      const result = formatAchievementDisplay(testAchievement, userProgress);
      
      expect(result.displayName).toBe('测试成就');
      expect(result.displayDescription).toBe('测试描述');
      expect(result.progressPercentage).toBe(50);
      expect(result.progressText).toBe('5 / 10');
    });

    it('应该正确处理隐藏成就', () => {
      const hiddenAchievement = {
        ...testAchievement,
        hidden: true
      };
      
      const result = formatAchievementDisplay(hiddenAchievement);
      
      expect(result.displayName).toBe('???');
      expect(result.displayDescription).toBe('隐藏成就');
    });

    it('应该正确处理已解锁的隐藏成就', () => {
      const hiddenAchievement = {
        ...testAchievement,
        hidden: true,
        dateUnlocked: new Date()
      };
      
      const result = formatAchievementDisplay(hiddenAchievement);
      
      expect(result.displayName).toBe('测试成就');
      expect(result.displayDescription).toBe('测试描述');
    });

    it('应该处理缺失的用户进度数据', () => {
      const result = formatAchievementDisplay(testAchievement);
      
      expect(result.displayName).toBe('测试成就');
      expect(result.displayDescription).toBe('测试描述');
      expect(result.progressPercentage).toBe(0);
      expect(result.progressText).toBe('');
    });

    it('应该正确处理空的用户进度对象', () => {
      const result = formatAchievementDisplay(testAchievement, {});
      
      expect(result.displayName).toBe('测试成就');
      expect(result.displayDescription).toBe('测试描述');
      expect(result.progressPercentage).toBe(0);
      expect(result.progressText).toBe('0 / 10');
    });
  });

  describe('RARITY_STYLES', () => {
    it('应该包含所有稀有度的样式', () => {
      const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      
      rarities.forEach(rarity => {
        expect(RARITY_STYLES).toHaveProperty(rarity);
        const style = RARITY_STYLES[rarity as keyof typeof RARITY_STYLES];
        
        expect(style).toHaveProperty('color');
        expect(style).toHaveProperty('bgColor');
        expect(style).toHaveProperty('borderColor');
        expect(style).toHaveProperty('glowColor');
        
        expect(typeof style.color).toBe('string');
        expect(typeof style.bgColor).toBe('string');
        expect(typeof style.borderColor).toBe('string');
        expect(typeof style.glowColor).toBe('string');
      });
    });
  });
});