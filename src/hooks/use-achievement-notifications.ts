'use client';

import { create } from 'zustand';
import { AchievementCheck } from '@/lib/achievement-checker';

interface AchievementNotificationStore {
  achievements: Array<{
    id: string;
    achievementId: string;
    name: string;
    description: string;
    icon: string;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    points: number;
    timestamp: number;
  }>;
  currentAchievement: any | null;
  addAchievements: (achievements: AchievementCheck[]) => void;
  showNext: () => void;
  clearCurrent: () => void;
}

export const useAchievementNotifications = create<AchievementNotificationStore>((set, get) => ({
  achievements: [],
  currentAchievement: null,
  
  addAchievements: (newAchievements) => {
    // Convert AchievementCheck to notification format
    const notifications = newAchievements.map(ach => {
      const [, tier] = ach.achievementId.split('_');
      const tierName = tier === 'bronze' ? '铜章' : tier === 'silver' ? '银章' : '金章';
      const icon = tier === 'bronze' ? '🥉' : tier === 'silver' ? '🥈' : '🥇';
      
      return {
        id: `${ach.achievementId}-${Date.now()}`,
        achievementId: ach.achievementId,
        name: `成就解锁 - ${tierName}`,
        description: `获得 ${ach.points} 积分`,
        icon,
        tier: ach.tier as 'bronze' | 'silver' | 'gold' | 'platinum',
        points: ach.points,
        timestamp: Date.now()
      };
    });
    
    set(state => ({
      achievements: [...state.achievements, ...notifications]
    }));
    
    // If no current achievement is showing, show the first one
    if (!get().currentAchievement && notifications.length > 0) {
      get().showNext();
    }
  },
  
  showNext: () => {
    const { achievements } = get();
    if (achievements.length > 0) {
      const [next, ...rest] = achievements;
      set({
        currentAchievement: {
          ...next,
          rarity: next?.tier === 'gold' ? 'legendary' : next?.tier === 'silver' ? 'epic' : 'rare'
        },
        achievements: rest
      });
    }
  },
  
  clearCurrent: () => {
    set({ currentAchievement: null });
    // Show next achievement after a short delay
    setTimeout(() => {
      const { achievements } = get();
      if (achievements.length > 0) {
        get().showNext();
      }
    }, 500);
  }
}));

// Helper function to check and show achievements from API responses
export function processAchievementResponse(response: any) {
  if (response.newAchievements && Array.isArray(response.newAchievements)) {
    const store = useAchievementNotifications.getState();
    store.addAchievements(response.newAchievements);
  }
}