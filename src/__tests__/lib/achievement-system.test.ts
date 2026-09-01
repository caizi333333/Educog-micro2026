import {
  ACHIEVEMENTS,
  calculateAchievementProgress,
  getAchievementTier,
  getNextTierThreshold,
} from '@/lib/achievement-system';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements-v2';

const NON_REWARDING_SYSTEM_ACHIEVEMENT_IDS = new Set(['first_login']);

describe('achievement-system legacy adapter', () => {
  it('re-exports the unified flat achievement catalog', () => {
    expect(ACHIEVEMENTS).toBe(ALL_ACHIEVEMENTS);
    expect(ACHIEVEMENTS.length).toBeGreaterThan(0);
  });

  it('keeps achievement identifiers unique and definitions complete', () => {
    const ids = new Set<string>();

    for (const achievement of ACHIEVEMENTS) {
      expect(ids.has(achievement.id)).toBe(false);
      ids.add(achievement.id);
      expect(achievement.title).toBeTruthy();
      expect(achievement.description).toBeTruthy();
      expect(achievement.icon).toBeTruthy();
      expect(Number.isFinite(achievement.points)).toBe(true);
      expect(achievement.points).toBeGreaterThanOrEqual(0);
      expect(achievement.criteria).toEqual(expect.any(Object));
      expect(achievement.criteria).toHaveProperty('type');
      expect(achievement.criteria).toHaveProperty('target');
    }
  });

  it('keeps only the account-lifecycle badge non-rewarding', () => {
    const nonRewardingIds = ACHIEVEMENTS
      .filter((achievement) => achievement.points === 0)
      .map((achievement) => achievement.id)
      .sort();

    expect(nonRewardingIds).toEqual([...NON_REWARDING_SYSTEM_ACHIEVEMENT_IDS].sort());
    expect(ACHIEVEMENTS.find((achievement) => achievement.id === 'first_login')).toMatchObject({
      title: '初次登录',
      description: '完成账号注册或首次登录',
      points: 0,
    });

    const rewardedAchievements = ACHIEVEMENTS.filter(
      (achievement) => !NON_REWARDING_SYSTEM_ACHIEVEMENT_IDS.has(achievement.id),
    );
    expect(rewardedAchievements.length).toBeGreaterThan(0);
    expect(rewardedAchievements.every((achievement) => achievement.points > 0)).toBe(true);
  });

  it('contains progress, quiz, experiment and social achievements', () => {
    const categories = new Set(ACHIEVEMENTS.map((achievement) => achievement.category));
    expect(categories.size).toBeGreaterThan(0);
    expect(categories.has('progress')).toBe(true);
    expect(categories.has('quiz')).toBe(true);
    expect(categories.has('experiment')).toBe(true);
    expect(categories.has('social')).toBe(true);
  });

  it('keeps removed tier helpers as deterministic safe no-ops', () => {
    expect(getAchievementTier('learning_time', 3600)).toBeNull();
    expect(calculateAchievementProgress('learning_time', 3600)).toBe(0);
    expect(getNextTierThreshold('learning_time', 3600)).toBeNull();
  });
});
