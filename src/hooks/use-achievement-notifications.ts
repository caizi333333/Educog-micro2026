'use client';

import { create } from 'zustand';
import type { AchievementCheck } from '@/lib/achievement-checker';
import { ALL_ACHIEVEMENTS, type Achievement } from '@/lib/achievements-v2';

type QueuedAchievement = {
  id: string;
  achievementId: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  points: number;
  timestamp: number;
};

interface AchievementNotificationStore {
  achievements: QueuedAchievement[];
  currentAchievement: Achievement | null;
  addAchievements: (achievements: AchievementCheck[]) => void;
  showNext: () => void;
  clearCurrent: () => void;
}

export const useAchievementNotifications = create<AchievementNotificationStore>((set, get) => ({
  achievements: [],
  currentAchievement: null,

  addAchievements: (newAchievements: AchievementCheck[]): void => {
    const notifications = newAchievements.map(ach => {
      // Look up achievement definition for icon and title
      const definition = ALL_ACHIEVEMENTS.find(a => a.id === ach.achievementId);
      const tier: 'bronze' | 'silver' | 'gold' | 'platinum' = (definition?.rarity === 'epic' || definition?.rarity === 'legendary') ? 'gold'
        : definition?.rarity === 'rare' ? 'silver' : 'bronze';
      const tierName = tier === 'gold' ? '金章' : tier === 'silver' ? '银章' : '铜章';
      const icon = definition?.icon ?? (tier === 'gold' ? '🥇' : tier === 'silver' ? '🥈' : '🥉');

      return {
        id: `${ach.achievementId}-${Date.now()}`,
        achievementId: ach.achievementId,
        name: definition ? `成就解锁: ${definition.title}` : `成就解锁 - ${tierName}`,
        description: `获得 ${ach.points} 积分`,
        icon,
        tier,
        points: ach.points,
        timestamp: Date.now()
      };
    });

    set(state => ({
      achievements: [...state.achievements, ...notifications]
    }));

    if (!get().currentAchievement && notifications.length > 0) {
      get().showNext();
    }
  },

  showNext: (): void => {
    const { achievements } = get();
    if (achievements.length > 0) {
      const [next, ...rest] = achievements;
      if (!next) return;
      set({
        currentAchievement: {
          id: next.achievementId,
          title: next.name,
          description: next.description,
          icon: next.icon,
          category: 'progress',
          criteria: { type: 'achievement_notification' },
          points: next.points,
          tier: next.tier,
          rarity: next.tier === 'gold' ? 'legendary' : next.tier === 'silver' ? 'epic' : 'rare',
        },
        achievements: rest
      });
    }
  },

  clearCurrent: (): void => {
    set({ currentAchievement: null });
    setTimeout((): void => {
      const { achievements } = get();
      if (achievements.length > 0) {
        get().showNext();
      }
    }, 500);
  }
}));

// Helper function to check and show achievements from API responses
export function processAchievementResponse(response: unknown): void {
  if (typeof response !== 'object' || response === null) return;
  const newAchievements = (response as Record<string, unknown>).newAchievements;
  if (Array.isArray(newAchievements)) {
    const validAchievements = newAchievements.filter((value): value is AchievementCheck => {
      if (typeof value !== 'object' || value === null) return false;
      const achievement = value as Record<string, unknown>;
      return typeof achievement.achievementId === 'string'
        && typeof achievement.points === 'number'
        && typeof achievement.unlocked === 'boolean';
    });
    const store = useAchievementNotifications.getState();
    store.addAchievements(validAchievements);
  }
}
