import {
  ACHIEVEMENTS,
  getAchievementTier,
  calculateAchievementProgress,
  getNextTierThreshold,
  type AchievementTier
} from '@/lib/achievement-system';

describe('achievement-system', () => {
  describe('ACHIEVEMENTS', () => {
    it('should have all required achievement definitions', () => {
      const expectedAchievements = [
        'learning_time',
        'modules_completed',
        'learning_streak',
        'quizzes_completed',
        'perfect_scores',
        'quiz_average',
        'experiments_completed',
        'experiment_time',
        'total_points',
        'achievements_unlocked'
      ];

      expectedAchievements.forEach(id => {
        expect(ACHIEVEMENTS[id]).toBeDefined();
        expect(ACHIEVEMENTS[id].id).toBe(id);
        expect(ACHIEVEMENTS[id].name).toBeTruthy();
        expect(ACHIEVEMENTS[id].description).toBeTruthy();
        expect(ACHIEVEMENTS[id].category).toBeTruthy();
        expect(ACHIEVEMENTS[id].tiers.bronze).toBeDefined();
        expect(ACHIEVEMENTS[id].tiers.silver).toBeDefined();
        expect(ACHIEVEMENTS[id].tiers.gold).toBeDefined();
      });
    });

    it('should have proper tier progression', () => {
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        const { bronze, silver, gold } = achievement.tiers;
        
        expect(bronze.threshold).toBeLessThan(silver.threshold);
        expect(silver.threshold).toBeLessThan(gold.threshold);
        expect(bronze.points).toBeLessThanOrEqual(silver.points);
        expect(silver.points).toBeLessThanOrEqual(gold.points);
      });
    });

    it('should have valid tier descriptions and points', () => {
      Object.values(ACHIEVEMENTS).forEach(achievement => {
        ['bronze', 'silver', 'gold'].forEach(tier => {
          const tierData = achievement.tiers[tier as keyof typeof achievement.tiers];
          if (tierData) {
            expect(tierData.description).toBeTruthy();
            expect(tierData.points).toBeGreaterThan(0);
            expect(tierData.threshold).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('getAchievementTier', () => {
    it('should return null for non-existent achievement', () => {
      const tier = getAchievementTier('non_existent', 100);
      expect(tier).toBeNull();
    });

    it('should return null for values below bronze threshold', () => {
      const tier = getAchievementTier('learning_time', 1000); // Below 3600 (1 hour)
      expect(tier).toBeNull();
    });

    it('should return bronze for values at bronze threshold', () => {
      const tier = getAchievementTier('learning_time', 3600); // Exactly 1 hour
      expect(tier).toBe('bronze');
    });

    it('should return bronze for values between bronze and silver', () => {
      const tier = getAchievementTier('learning_time', 10000); // Between 1 and 10 hours
      expect(tier).toBe('bronze');
    });

    it('should return silver for values at silver threshold', () => {
      const tier = getAchievementTier('learning_time', 36000); // Exactly 10 hours
      expect(tier).toBe('silver');
    });

    it('should return silver for values between silver and gold', () => {
      const tier = getAchievementTier('learning_time', 100000); // Between 10 and 100 hours
      expect(tier).toBe('silver');
    });

    it('should return gold for values at or above gold threshold', () => {
      const tier = getAchievementTier('learning_time', 360000); // Exactly 100 hours
      expect(tier).toBe('gold');
      
      const tierAbove = getAchievementTier('learning_time', 500000); // Above 100 hours
      expect(tierAbove).toBe('gold');
    });

    it('should work with different achievement types', () => {
      // Test with modules_completed
      expect(getAchievementTier('modules_completed', 0)).toBeNull();
      expect(getAchievementTier('modules_completed', 1)).toBe('bronze');
      expect(getAchievementTier('modules_completed', 5)).toBe('silver');
      expect(getAchievementTier('modules_completed', 10)).toBe('gold');
      
      // Test with quiz_average
      expect(getAchievementTier('quiz_average', 69)).toBeNull();
      expect(getAchievementTier('quiz_average', 70)).toBe('bronze');
      expect(getAchievementTier('quiz_average', 85)).toBe('silver');
      expect(getAchievementTier('quiz_average', 95)).toBe('gold');
    });
  });

  describe('calculateAchievementProgress', () => {
    it('should return 0 for non-existent achievement', () => {
      const progress = calculateAchievementProgress('non_existent', 100);
      expect(progress).toBe(0);
    });

    it('should return progress towards bronze tier', () => {
      // learning_time bronze threshold is 3600
      const progress = calculateAchievementProgress('learning_time', 1800); // Half way to bronze
      expect(progress).toBe(50);
    });

    it('should return progress from bronze to silver', () => {
      // learning_time: bronze=3600, silver=36000
      // Progress from bronze (3600) to silver (36000) with current value 19800
      const progress = calculateAchievementProgress('learning_time', 19800);
      const expected = ((19800 - 3600) / (36000 - 3600)) * 100;
      expect(progress).toBeCloseTo(expected, 1);
    });

    it('should return progress from silver to gold', () => {
      // learning_time: silver=36000, gold=360000
      const progress = calculateAchievementProgress('learning_time', 198000);
      const expected = ((198000 - 36000) / (360000 - 36000)) * 100;
      expect(progress).toBeCloseTo(expected, 1);
    });

    it('should return 100 for gold tier', () => {
      const progress = calculateAchievementProgress('learning_time', 360000);
      expect(progress).toBe(100);
      
      const progressAbove = calculateAchievementProgress('learning_time', 500000);
      expect(progressAbove).toBe(100);
    });

    it('should handle edge cases', () => {
      // Exactly at bronze threshold
      const progressAtBronze = calculateAchievementProgress('learning_time', 3600);
      expect(progressAtBronze).toBe(0); // 0% progress towards next tier
      
      // Exactly at silver threshold
      const progressAtSilver = calculateAchievementProgress('learning_time', 36000);
      expect(progressAtSilver).toBe(0); // 0% progress towards next tier
    });

    it('should work with different achievement types', () => {
      // Test with modules_completed (bronze=1, silver=5, gold=10)
      expect(calculateAchievementProgress('modules_completed', 0.5)).toBe(50); // 50% to bronze
      expect(calculateAchievementProgress('modules_completed', 3)).toBe(50); // 50% from bronze to silver
      expect(calculateAchievementProgress('modules_completed', 7.5)).toBe(50); // 50% from silver to gold
      expect(calculateAchievementProgress('modules_completed', 10)).toBe(100); // At gold
    });
  });

  describe('getNextTierThreshold', () => {
    it('should return null for non-existent achievement', () => {
      const threshold = getNextTierThreshold('non_existent', 100);
      expect(threshold).toBeNull();
    });

    it('should return bronze threshold for values below bronze', () => {
      const threshold = getNextTierThreshold('learning_time', 1000);
      expect(threshold).toBe(3600); // Bronze threshold
    });

    it('should return silver threshold for bronze tier', () => {
      const threshold = getNextTierThreshold('learning_time', 3600);
      expect(threshold).toBe(36000); // Silver threshold
      
      const thresholdMid = getNextTierThreshold('learning_time', 10000);
      expect(thresholdMid).toBe(36000); // Silver threshold
    });

    it('should return gold threshold for silver tier', () => {
      const threshold = getNextTierThreshold('learning_time', 36000);
      expect(threshold).toBe(360000); // Gold threshold
      
      const thresholdMid = getNextTierThreshold('learning_time', 100000);
      expect(thresholdMid).toBe(360000); // Gold threshold
    });

    it('should return null for gold tier (no next tier)', () => {
      const threshold = getNextTierThreshold('learning_time', 360000);
      expect(threshold).toBeNull();
      
      const thresholdAbove = getNextTierThreshold('learning_time', 500000);
      expect(thresholdAbove).toBeNull();
    });

    it('should work with different achievement types', () => {
      // Test with modules_completed
      expect(getNextTierThreshold('modules_completed', 0)).toBe(1); // Bronze
      expect(getNextTierThreshold('modules_completed', 1)).toBe(5); // Silver
      expect(getNextTierThreshold('modules_completed', 5)).toBe(10); // Gold
      expect(getNextTierThreshold('modules_completed', 10)).toBeNull(); // No next tier
      
      // Test with quiz_average
      expect(getNextTierThreshold('quiz_average', 60)).toBe(70); // Bronze
      expect(getNextTierThreshold('quiz_average', 70)).toBe(85); // Silver
      expect(getNextTierThreshold('quiz_average', 85)).toBe(95); // Gold
      expect(getNextTierThreshold('quiz_average', 95)).toBeNull(); // No next tier
    });
  });

  describe('achievement categories', () => {
    it('should have proper category distribution', () => {
      const categories = Object.values(ACHIEVEMENTS).map(a => a.category);
      const uniqueCategories = [...new Set(categories)];
      
      expect(uniqueCategories).toContain('学习');
      expect(uniqueCategories).toContain('测验');
      expect(uniqueCategories).toContain('实验');
      expect(uniqueCategories).toContain('综合');
    });

    it('should have learning achievements', () => {
      const learningAchievements = Object.values(ACHIEVEMENTS)
        .filter(a => a.category === '学习');
      
      expect(learningAchievements.length).toBeGreaterThan(0);
      expect(learningAchievements.some(a => a.id === 'learning_time')).toBe(true);
      expect(learningAchievements.some(a => a.id === 'modules_completed')).toBe(true);
    });

    it('should have quiz achievements', () => {
      const quizAchievements = Object.values(ACHIEVEMENTS)
        .filter(a => a.category === '测验');
      
      expect(quizAchievements.length).toBeGreaterThan(0);
      expect(quizAchievements.some(a => a.id === 'quizzes_completed')).toBe(true);
      expect(quizAchievements.some(a => a.id === 'perfect_scores')).toBe(true);
    });

    it('should have experiment achievements', () => {
      const experimentAchievements = Object.values(ACHIEVEMENTS)
        .filter(a => a.category === '实验');
      
      expect(experimentAchievements.length).toBeGreaterThan(0);
      expect(experimentAchievements.some(a => a.id === 'experiments_completed')).toBe(true);
    });
  });
});