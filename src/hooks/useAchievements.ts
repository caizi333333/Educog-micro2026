import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { ClientRequestTimeoutError, fetchClientRequest } from '@/lib/client-fetch';
import {
  ALL_ACHIEVEMENTS,
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

interface UserAchievementData {
  achievementId: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
}

interface AchievementsResponse {
  success: true;
  dataProvenance: AchievementDataProvenance;
  asOf: string;
  sampleSize: AchievementSampleSize;
  achievements: UserAchievementData[];
  stats: { totalPoints: number };
  userStats?: Record<string, number>;
}

export interface AchievementDataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

export interface AchievementSampleSize {
  achievementRules: number;
  unlockedAchievementRecords: number;
  activityRecords: number;
  learningProgressRecords: number;
  quizAttempts: number;
  experimentRecords: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isNonNegativeNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0
);

const isAchievementsResponse = (value: unknown): value is AchievementsResponse => {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.achievements)) return false;
  if (!isRecord(value.stats) || !isNonNegativeNumber(value.stats.totalPoints)) return false;
  const sampleSize = value.sampleSize;
  if (!isRecord(value.dataProvenance)
    || !['DEMO', 'REAL', 'MIXED'].includes(String(value.dataProvenance.mode))
    || typeof value.dataProvenance.label !== 'string'
    || !value.dataProvenance.label.trim()
    || typeof value.dataProvenance.note !== 'string'
    || !value.dataProvenance.note.trim()
    || typeof value.asOf !== 'string'
    || !Number.isFinite(new Date(value.asOf).getTime())
    || !isRecord(sampleSize)) return false;
  const sampleSizeKeys: (keyof AchievementSampleSize)[] = [
    'achievementRules',
    'unlockedAchievementRecords',
    'activityRecords',
    'learningProgressRecords',
    'quizAttempts',
    'experimentRecords',
  ];
  if (!sampleSizeKeys.every((key) => isNonNegativeNumber(sampleSize[key])
    && Number.isInteger(sampleSize[key]))) return false;
  return value.achievements.every((item) => isRecord(item)
    && typeof item.achievementId === 'string'
    && typeof item.unlocked === 'boolean'
    && (item.progress == null || isNonNegativeNumber(item.progress))
    && (item.unlockedAt == null || typeof item.unlockedAt === 'string'));
};

const normalizeEmbeddedUserStats = (value: unknown): UserStats | null => {
  if (!isRecord(value) || Object.keys(value).length === 0) return null;
  if (!Object.values(value).every(isNonNegativeNumber)) return null;
  return value as UserStats;
};

const userStatsToRecord = (stats: UserStats | null): Record<string, number> => {
  return stats || {};
};

export const useAchievements = (category?: string) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProgress, setUserProgress] = useState<AchievementProgress[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [serverTotalPoints, setServerTotalPoints] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [dataProvenance, setDataProvenance] = useState<AchievementDataProvenance | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState<AchievementSampleSize | null>(null);
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const fetchAchievements = useCallback(async (showRefreshIndicator = false) => {
    if (!user || user.role !== 'STUDENT') return;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    const isLatestRequest = (): boolean => requestIdRef.current === requestId;
    if (showRefreshIndicator) setRefreshing(true);
    setError(null);
    setAccessErrorStatus(null);

    try {
      const token = getStoredAccessToken();
      if (!token) {
        setUserProgress([]);
        setUserStats(null);
        setServerTotalPoints(null);
        setDataProvenance(null);
        setAsOf(null);
        setSampleSize(null);
        setAccessErrorStatus(401);
        throw new Error('登录已过期，请重新登录');
      }

      const achievementsRes = await fetchClientRequest('/api/achievements', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });

      if (achievementsRes.status === 401 || achievementsRes.status === 403) {
        if (!isLatestRequest()) return;
        setUserProgress([]);
        setUserStats(null);
        setServerTotalPoints(null);
        setDataProvenance(null);
        setAsOf(null);
        setSampleSize(null);
        setAccessErrorStatus(achievementsRes.status);
        throw new Error(achievementsRes.status === 401
          ? '登录已过期，请重新登录'
          : '当前账号无权读取学生个人成就');
      }
      if (!achievementsRes.ok) throw new Error('获取成就失败');
      const achievementsData: unknown = await achievementsRes.json();
      if (!isLatestRequest()) return;
      if (!isAchievementsResponse(achievementsData)) throw new Error('成就数据响应格式异常');

      const progress: AchievementProgress[] = ALL_ACHIEVEMENTS.map(achievement => {
        const userAchievement = achievementsData.achievements?.find(
          (a: UserAchievementData) => a.achievementId === achievement.id
        );

        const result: AchievementProgress = {
          achievementId: achievement.id,
          progress: userAchievement?.unlocked ? 100 : (userAchievement?.progress || 0),
          unlocked: userAchievement?.unlocked || false,
          notified: true,
        };

        if (userAchievement?.unlockedAt) {
          result.unlockedAt = new Date(userAchievement.unlockedAt);
        }

        return result;
      });

      if (!isLatestRequest()) return;
      setUserProgress(progress);
      setUserStats(normalizeEmbeddedUserStats(achievementsData.userStats));
      setServerTotalPoints(achievementsData.stats.totalPoints);
      setDataProvenance(achievementsData.dataProvenance);
      setAsOf(achievementsData.asOf);
      setSampleSize(achievementsData.sampleSize);
      setAccessErrorStatus(null);

    } catch (err) {
      if (!isLatestRequest()) return;
      console.error('获取成就失败:', err);
      const errorMessage = err instanceof ClientRequestTimeoutError
        ? '读取成就记录超时，请重试'
        : err instanceof Error ? err.message : '获取成就失败';
      setError(errorMessage);
      const isAccessError = err instanceof Error
        && (err.message.includes('登录') || err.message.includes('无权'));
      if (!isAccessError) {
        toast({ title: '获取成就失败', description: '请稍后重试', variant: 'destructive' });
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
        setRefreshing(false);
      }
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [toast, user]);

  useEffect(() => {
    if (authLoading) return;
    if (user?.role === 'STUDENT') {
      setLoading(true);
      void fetchAchievements();
      return;
    }
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    requestIdRef.current += 1;
    setUserProgress([]);
    setUserStats(null);
    setServerTotalPoints(null);
    setDataProvenance(null);
    setAsOf(null);
    setSampleSize(null);
    setError(null);
    setAccessErrorStatus(null);
    setLoading(false);
    setRefreshing(false);
  }, [authLoading, fetchAchievements, user]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  }, []);

  const calculateStats = () => {
    const unlocked = userProgress.filter(p => p.unlocked);

    const byTier = {
      bronze: unlocked.filter(p => {
        const a = ALL_ACHIEVEMENTS.find(x => x.id === p.achievementId);
        return a?.rarity === 'common';
      }).length,
      silver: unlocked.filter(p => {
        const a = ALL_ACHIEVEMENTS.find(x => x.id === p.achievementId);
        return a?.rarity === 'rare' || a?.rarity === 'uncommon';
      }).length,
      gold: unlocked.filter(p => {
        const a = ALL_ACHIEVEMENTS.find(x => x.id === p.achievementId);
        return a?.rarity === 'epic';
      }).length,
      platinum: unlocked.filter(p => {
        const a = ALL_ACHIEVEMENTS.find(x => x.id === p.achievementId);
        return a?.rarity === 'legendary';
      }).length,
    };

    return {
      unlockedCount: unlocked.length,
      totalCount: ALL_ACHIEVEMENTS.length,
      totalPoints: serverTotalPoints ?? 0,
      byTier,
      completionPercentage: Math.round((unlocked.length / ALL_ACHIEVEMENTS.length) * 100),
    };
  };

  const getFilteredAchievements = (selectedCategory: string) => {
    let filtered = ALL_ACHIEVEMENTS;
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === selectedCategory);
    }

    const visibleAchievements = filtered.filter(achievement => {
      if (!achievement.hidden) return true;
      return shouldShowHiddenAchievement(achievement, userProgress, userStatsToRecord(userStats));
    });

    const unlocked = visibleAchievements.filter(a => userProgress.find(p => p.achievementId === a.id)?.unlocked);
    const locked = visibleAchievements.filter(a => !userProgress.find(p => p.achievementId === a.id)?.unlocked);

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

  const getAchievementDisplay = (achievementId: string) => {
    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return null;
    const shouldShow = shouldShowHiddenAchievement(achievement, userProgress, userStatsToRecord(userStats));
    return getHiddenAchievementDisplay(achievement, shouldShow);
  };

  const formatAchievementDisplay = (achievementId: string, progress: AchievementProgress[]) => {
    const achievement = ALL_ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return { title: '???', icon: '🔒' };
    const shouldShow = shouldShowHiddenAchievement(achievement, progress, userStatsToRecord(userStats));
    if (achievement.hidden && !shouldShow) return { title: '???', icon: '🔒' };
    return { title: achievement.title, icon: achievement.icon || '🏆' };
  };

  const getAchievementsByCategory = (cat: string) => {
    if (cat === 'all') return ALL_ACHIEVEMENTS;
    return ALL_ACHIEVEMENTS.filter(a => a.category === cat);
  };

  const filteredAchievements = useMemo(() => {
    const selectedCategory = category ?? 'all';
    if (selectedCategory === 'all') return ALL_ACHIEVEMENTS;
    return ALL_ACHIEVEMENTS.filter(a => a.category === selectedCategory);
  }, [category]);

  const accessState: { accessErrorStatus?: 401 | 403 | null } = { accessErrorStatus };

  return {
    loading,
    refreshing,
    userProgress,
    userStats,
    error,
    ...accessState,
    dataProvenance,
    asOf,
    sampleSize,
    totalPoints: serverTotalPoints,
    fetchAchievements,
    calculateStats,
    getFilteredAchievements,
    getAchievementDisplay,
    clearRecentUnlocks: () => {},
    formatAchievementDisplay,
    getAchievementsByCategory,
    achievements: filteredAchievements,
    progress: userProgress,
    refetch: fetchAchievements
  };
};
