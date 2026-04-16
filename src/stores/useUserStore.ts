import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserStats {
  modules_completed: number;
  code_runs: number;
  debug_success: number;
  experiments_completed: number;
  daily_streak: number;
  perfect_quiz: number;
  speed_completion: number;
  night_study: number;
  morning_study: number;
  questions_answered: number;
  discussions_started: number;
  easter_egg_found: number;
  bugs_reported: number;
  continuous_hours: number;
}

interface UserAchievement {
  achievementId: string;
  unlockedAt: Date;
  progress: number;
}

interface UserStore {
  // User data
  userStats: UserStats | null;
  userAchievements: UserAchievement[];
  lastFetchTime: number | null;
  
  // Actions
  setUserStats: (stats: UserStats) => void;
  setUserAchievements: (achievements: UserAchievement[]) => void;
  clearUserData: () => void;
  
  // Helper functions
  shouldRefetch: () => boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      userStats: null,
      userAchievements: [],
      lastFetchTime: null,
      
      setUserStats: (stats) => set({ 
        userStats: stats,
        lastFetchTime: Date.now()
      }),
      
      setUserAchievements: (achievements) => set({ 
        userAchievements: achievements 
      }),
      
      clearUserData: () => set({ 
        userStats: null, 
        userAchievements: [],
        lastFetchTime: null
      }),
      
      shouldRefetch: () => {
        const { lastFetchTime } = get();
        if (!lastFetchTime) return true;
        return Date.now() - lastFetchTime > CACHE_DURATION;
      }
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        userStats: state.userStats,
        userAchievements: state.userAchievements,
        lastFetchTime: state.lastFetchTime
      })
    }
  )
);