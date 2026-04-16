import { useEffect, useState } from 'react';
import { useUserStore } from '@/stores/useUserStore';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { useApiCall, errorHandlerPresets } from '@/lib/api-error-handler';

export function useUserData() {
  const { user } = useAuth();
  const { 
    userStats, 
    userAchievements, 
    setUserStats, 
    setUserAchievements, 
    shouldRefetch,
    clearUserData 
  } = useUserStore();
  
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  
  const { loading, error, execute } = useApiCall({
    ...errorHandlerPresets.silent, // 用户数据获取失败时不显示toast
    // 测试环境下禁用重试，避免 fake timers/等待导致用例超时
    maxRetries: process.env.NODE_ENV === 'test' ? 0 : 2,
    onError: (apiError) => {
      console.warn('Failed to fetch user data:', apiError);
    },
  });

  const fetchUserData = async (force = false) => {
    if (!user) {
      clearUserData();
      setLastFetchTime(null);
      return;
    }

    if (!force && !shouldRefetch()) {
      return;
    }

    try {
      await execute(async () => {
        const [statsResult, achievementsResult] = await Promise.allSettled([
          apiClient.get('/users/stats'),
          apiClient.get('/users/achievements')
        ]);

        // 处理统计数据
        if (statsResult.status === 'fulfilled' && statsResult.value?.data) {
          setUserStats(statsResult.value.data);
        } else if (statsResult.status === 'rejected') {
          console.warn('Failed to fetch user stats:', statsResult.reason);
        }
        
        // 处理成就数据
        if (achievementsResult.status === 'fulfilled' && achievementsResult.value?.data) {
          setUserAchievements(achievementsResult.value.data);
        } else if (achievementsResult.status === 'rejected') {
          console.warn('Failed to fetch user achievements:', achievementsResult.reason);
        }

        // 检查是否有严重错误（两个请求都失败）
        const firstRejection =
          statsResult.status === 'rejected'
            ? statsResult.reason
            : achievementsResult.status === 'rejected'
              ? achievementsResult.reason
              : null;

        // 约定：任一接口失败即视为错误（但仍保留成功请求的数据更新），便于 UI 做提示与重试
        if (firstRejection) {
          throw firstRejection instanceof Error
            ? firstRejection
            : new Error(String(firstRejection));
        }
        
        setLastFetchTime(new Date());
        return { stats: statsResult, achievements: achievementsResult };
      });
    } catch (err) {
      // Error is already handled by useApiCall
      console.error('User data fetch failed:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      clearUserData();
    }
  }, [user]);

  return {
    userStats,
    userAchievements,
    loading,
    error: error?.message || null,
    lastFetchTime,
    refetch: () => fetchUserData(true),
    hasData: !!(userStats || userAchievements),
  };
}
