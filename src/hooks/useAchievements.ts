import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ACHIEVEMENTS_V2, 
  checkAchievementUnlock,
  shouldShowHiddenAchievement,
  getHiddenAchievementDisplay,
  type AchievementProgress
} from '@/lib/achievements-v2';

interface UserStats extends Record<string, number> {
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

// Utility function to convert UserStats to Record<string, number>
const userStatsToRecord = (stats: UserStats | null): Record<string, number> => {
  return stats || {};
};

interface RecentUnlock {
  achievementId: string;
  message: string;
  timestamp: number;
}

export const useAchievements = (category?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProgress, setUserProgress] = useState<AchievementProgress[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [recentUnlocks, setRecentUnlocks] = useState<RecentUnlock[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAchievements = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('未登录');
      }

      // Fetch achievements progress
      const achievementsRes = await fetch('/api/achievements', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!achievementsRes.ok) {
        const errorText = await achievementsRes.text();
        console.error('Achievements API error:', errorText);
        throw new Error('获取成就失败');
      }

      const achievementsData = await achievementsRes.json();

      // Try to fetch stats but don't fail if it errors
      let statsData = { stats: {} };
      try {
        const statsRes = await fetch('/api/user/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statsRes.ok) {
          statsData = await statsRes.json();
        }
      } catch (statsError) {
        console.error('Failed to fetch stats:', statsError);
      }
      
      interface UserAchievementData {
        achievementId: string;
        unlocked: boolean;
        unlockedAt?: string;
      }

      // Map achievements to progress
      const progress: AchievementProgress[] = ACHIEVEMENTS_V2.map(achievement => {
        const userAchievement = achievementsData.achievements?.find(
          (a: UserAchievementData) => a.achievementId === achievement.id
        );
        
        const stats = statsData.stats || {};
        const unlockInfo = checkAchievementUnlock(achievement, stats);
        
        const result: AchievementProgress = {
          achievementId: achievement.id,
          progress: unlockInfo.progress,
          unlocked: userAchievement?.unlocked || false,
          notified: true,
        };
        
        if (userAchievement?.unlockedAt) {
          result.unlockedAt = new Date(userAchievement.unlockedAt);
        }
        
        return result;
      });
      
      setUserProgress(progress);
      setUserStats(statsData.stats && Object.keys(statsData.stats).length > 0 ? statsData.stats as UserStats : null);
      
    } catch (error) {
      console.error('获取成就失败:', error);
      const errorMessage = error instanceof Error ? error.message : '获取成就失败';
      setError(errorMessage);
      if (error instanceof Error && error.message !== '未登录') {
        toast({
          title: '获取成就失败',
          description: '请稍后重试',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAchievements();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Calculate statistics
  const calculateStats = () => {
    const unlocked = userProgress.filter(p => p.unlocked);
    const totalPoints = unlocked.reduce((sum, p) => {
      const achievement = ACHIEVEMENTS_V2.find(a => a.id === p.achievementId);
      return sum + (achievement?.points || 0);
    }, 0);
    
    const byTier = {
      bronze: unlocked.filter(p => ACHIEVEMENTS_V2.find(a => a.id === p.achievementId)?.tier === 'bronze').length,
      silver: unlocked.filter(p => ACHIEVEMENTS_V2.find(a => a.id === p.achievementId)?.tier === 'silver').length,
      gold: unlocked.filter(p => ACHIEVEMENTS_V2.find(a => a.id === p.achievementId)?.tier === 'gold').length,
      platinum: unlocked.filter(p => {
        const achievement = ACHIEVEMENTS_V2.find(a => a.id === p.achievementId);
        return achievement?.tier === 'platinum';
      }).length,
    };
    
    return {
      unlockedCount: unlocked.length,
      totalCount: ACHIEVEMENTS_V2.length,
      totalPoints,
      byTier,
      completionPercentage: Math.round((unlocked.length / ACHIEVEMENTS_V2.length) * 100),
    };
  };

  // Filter achievements by category with hidden achievement logic
  const getFilteredAchievements = (selectedCategory: string) => {
    let filtered = ACHIEVEMENTS_V2;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }
    
    // Filter out hidden achievements that shouldn't be shown
    const visibleAchievements = filtered.filter(achievement => {
      if (!achievement.hidden) {
        return true;
      }
      return shouldShowHiddenAchievement(achievement, userProgress, userStatsToRecord(userStats));
    });
    
    // Group by unlocked status
    const unlocked = visibleAchievements.filter(a => userProgress.find(p => p.achievementId === a.id)?.unlocked);
    const locked = visibleAchievements.filter(a => !userProgress.find(p => p.achievementId === a.id)?.unlocked);
    
    // Sort unlocked by date, locked by progress
    unlocked.sort((a, b) => {
      const aDate = userProgress.find(p => p.achievementId === a.id)?.unlockedAt?.getTime() || 0;
      const bDate = userProgress.find(p => p.achievementId === b.id)?.unlockedAt?.getTime() || 0;
      return bDate - aDate;
    });
    
    locked.sort((a, b) => {
      const aProgress = userProgress.find(p => p.achievementId === a.id)?.progress || 0;
      const bProgress = userProgress.find(p => p.achievementId === b.id)?.progress || 0;
      return bProgress - aProgress;
    });
    
    return [...unlocked, ...locked];
  };
  
  // Get achievement display info (handles hidden achievements)
  const getAchievementDisplay = (achievementId: string) => {
    const achievement = ACHIEVEMENTS_V2.find(a => a.id === achievementId);
    if (!achievement) return null;
    
    const shouldShow = shouldShowHiddenAchievement(achievement, userProgress, userStatsToRecord(userStats));
    return getHiddenAchievementDisplay(achievement, shouldShow);
  };

  // Check achievements and update unlocked status
  const checkAchievements = (stats: UserStats | any) => {
    if (!stats) return;
    
    try {
      const newUnlocks: string[] = [];
      const newRecentUnlocks: RecentUnlock[] = [];
      
      ACHIEVEMENTS_V2.forEach(achievement => {
        try {
          const unlockInfo = checkAchievementUnlock(achievement, stats);
          const isCurrentlyUnlocked = unlockedAchievements.includes(achievement.id);
          
          if (unlockInfo.unlocked && !isCurrentlyUnlocked) {
            newUnlocks.push(achievement.id);
            newRecentUnlocks.push({
              achievementId: achievement.id,
              message: `解锁成就: ${achievement.title}`,
              timestamp: Date.now()
            });
          }
        } catch (achievementError) {
          console.error(`检查成就 ${achievement.id} 时出错:`, achievementError);
        }
      });
      
      if (newUnlocks.length > 0) {
        try {
          setUnlockedAchievements(prev => [...prev, ...newUnlocks]);
          setRecentUnlocks(prev => {
            const updated = [...newRecentUnlocks, ...prev];
            return updated.slice(0, 10); // 限制为最近10个
          });
        } catch (storageError) {
          console.error('保存成就状态时出错:', storageError);
        }
      }
    } catch (error) {
      console.error('检查成就时出错:', error);
    }
  };

  // Clear recent unlocks
  const clearRecentUnlocks = () => {
    setRecentUnlocks([]);
  };

  // Calculate total points
  const totalPoints = unlockedAchievements.reduce((sum, achievementId) => {
    const achievement = ACHIEVEMENTS_V2.find(a => a.id === achievementId);
    return sum + (achievement?.points || 0);
  }, 0);

  // Format achievement display
  const formatAchievementDisplay = (achievementId: string, progress: AchievementProgress[]) => {
    const achievement = ACHIEVEMENTS_V2.find(a => a.id === achievementId);
    if (!achievement) return { title: '???', icon: '🔒' };
    
    const shouldShow = shouldShowHiddenAchievement(achievement, progress, userStatsToRecord(userStats));
    
    if (achievement.hidden && !shouldShow) {
      return { title: '???', icon: '🔒' };
    }
    
    return {
      title: achievement.title,
      icon: achievement.icon || '🏆'
    };
  };

  // Get achievements by category
  const getAchievementsByCategory = (category: string) => {
    if (category === 'all') {
      return ACHIEVEMENTS_V2;
    }
    return ACHIEVEMENTS_V2.filter(a => a.category === category);
  };







  // Memoized filtered achievements
  const filteredAchievements = useMemo(() => {
    const selectedCategory = category ?? 'all';
    if (selectedCategory === 'all') {
      return ACHIEVEMENTS_V2;
    }
    return ACHIEVEMENTS_V2.filter(a => a.category === selectedCategory);
  }, [category]);

  return {
    loading,
    refreshing,
    userProgress,
    userStats,
    unlockedAchievements,
    recentUnlocks,
    error,
    totalPoints,
    fetchAchievements,
    calculateStats,
    getFilteredAchievements,
    getAchievementDisplay,
    checkAchievements,
    clearRecentUnlocks,
    formatAchievementDisplay,
    getAchievementsByCategory,
    achievements: filteredAchievements,
    progress: userProgress,
    refetch: fetchAchievements
  };
};