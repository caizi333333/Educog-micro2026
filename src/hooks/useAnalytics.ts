import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { knowledgePoints } from '@/lib/knowledge-points';
import { getStoredAccessToken } from '@/lib/auth-storage';

// Type definitions
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  lastLoginAt: string;
  stats?: {
    totalLearningTime?: number;
    [key: string]: any;
  };
}

export interface QuizHistoryItem {
  id: string;
  score: number;
  totalQuestions: number;
  answers?: string;
  completedAt: string;
}

export interface LearningProgressItem {
  id: string;
  moduleId: string;
  chapterId: string;
  progress: number;
  timeSpent: number;
  lastAccessAt: string;
}

export interface AchievementsData {
  stats: Record<string, number>;
}

interface AnalyticsSummary {
  totalPoints: number;
  totalExperiments: number;
  totalQuizzes: number;
  totalAchievements: number;
  completedExperiments: number;
  completedModules: number;
  totalTimeSpent: number;
  avgQuizScore: number;
}

export interface AnalyticsDataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

export interface AnalyticsSampleSize {
  quizAttempts: number;
  learningProgressRecords: number;
  experimentRecords: number;
  achievementRecords: number;
  achievementRules: number;
}

export interface KnowledgeMasteryItem {
  topic: string;
  mastery: number | null;
  hasRecord: boolean;
  details: Record<string, number | null>;
}

export type AnalyticsDataStatus = 'idle' | 'loading' | 'cached' | 'fresh' | 'stale' | 'error';

const normalizeSummary = (value: unknown): AnalyticsSummary | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const keys: (keyof AnalyticsSummary)[] = [
    'totalPoints',
    'totalExperiments',
    'totalQuizzes',
    'totalAchievements',
    'completedExperiments',
    'completedModules',
    'totalTimeSpent',
    'avgQuizScore',
  ];
  if (!keys.every((key) => typeof source[key] === 'number' && Number.isFinite(source[key]))) return null;
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as unknown as AnalyticsSummary;
};

const normalizeDataProvenance = (value: unknown): AnalyticsDataProvenance | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!['DEMO', 'REAL', 'MIXED'].includes(String(source.mode))
    || typeof source.label !== 'string' || !source.label.trim()
    || typeof source.note !== 'string' || !source.note.trim()) return null;
  return source as unknown as AnalyticsDataProvenance;
};

const normalizeSampleSize = (value: unknown): AnalyticsSampleSize | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const keys: (keyof AnalyticsSampleSize)[] = [
    'quizAttempts',
    'learningProgressRecords',
    'experimentRecords',
    'achievementRecords',
    'achievementRules',
  ];
  if (!keys.every((key) => typeof source[key] === 'number'
    && Number.isInteger(source[key])
    && Number(source[key]) >= 0)) return null;
  return Object.fromEntries(keys.map((key) => [key, source[key]])) as unknown as AnalyticsSampleSize;
};

// Normalize chapterId from various formats: "chapter-1", "1", "ch1" → "ch1"
function normalizeChapterId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits) return `ch${digits}`;
  return raw;
}

// 直接从正式知识图谱生成章节映射，避免课程调整后分析页继续使用旧编号。
const chapterTopicMap = knowledgePoints
  .filter((point) => point.level === 1)
  .reduce<Record<string, { topic: string; details: string[] }[]>>((map, chapter) => {
    map[`ch${chapter.chapter}`] = [{
      topic: chapter.name,
      details: knowledgePoints
        .filter((point) => point.level === 2 && point.parentId === chapter.id)
        .map((point) => point.name),
    }];
    return map;
  }, {});

interface UseAnalyticsOptions {
  enabled?: boolean;
}

export const useAnalytics = ({ enabled = true }: UseAnalyticsOptions = {}) => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const toastRef = useRef(toast);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [loading, setLoading] = useState(true);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgressItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementsData>({ stats: {} });
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dataStatus, setDataStatus] = useState<AnalyticsDataStatus>('idle');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [dataProvenance, setDataProvenance] = useState<AnalyticsDataProvenance | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState<AnalyticsSampleSize | null>(null);
  const displayedUserIdRef = useRef<string | null>(null);
  const hasDisplayedDataRef = useRef(false);
  const requestIdRef = useRef(0);
  const requestControllerRef = useRef<AbortController | null>(null);

  const invalidateCache = () => {
    const cacheKey = `analytics_${user?.id || 'anonymous'}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_time`);
  };

  const fetchAnalyticsData = useCallback(async (bypassCache = false) => {
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const requestId = ++requestIdRef.current;
    const userId = user?.id ?? null;
    let discardDisplayedData = false;

    const clearDisplayedData = () => {
      setQuizHistory([]);
      setLearningProgress([]);
      setAchievements({ stats: {} });
      setSummary(null);
      setLastUpdatedAt(null);
      setDataProvenance(null);
      setAsOf(null);
      setSampleSize(null);
      hasDisplayedDataRef.current = false;
    };

    try {
      setError(null);
      if (!userId) {
        discardDisplayedData = true;
        throw new Error('请先登录以查看学情分析');
      }

      if (displayedUserIdRef.current !== userId) {
        displayedUserIdRef.current = userId;
        clearDisplayedData();
      }

      const token = getStoredAccessToken();
      if (!token) {
        discardDisplayedData = true;
        throw new Error('登录状态已失效，请重新登录后查看学情分析');
      }

      const cacheKey = `analytics_${userId}`;
      let cachedData: string | null = null;
      let cacheTime: string | null = null;
      try {
        cachedData = localStorage.getItem(cacheKey);
        cacheTime = localStorage.getItem(`${cacheKey}_time`);
      } catch {
        // Storage can be restricted; the authoritative request remains usable.
      }
      const cachedAt = cacheTime ? Number(cacheTime) : Number.NaN;
      const hasFreshCache = Number.isFinite(cachedAt) && Date.now() - cachedAt < 5 * 60 * 1000;

      // Stale-while-revalidate: a valid cache may paint immediately, but never
      // skips the authoritative server read.
      if (!bypassCache && cachedData && hasFreshCache) {
        try {
          const parsed = JSON.parse(cachedData);
          const cachedSummary = normalizeSummary(parsed.summary);
          const cachedProvenance = normalizeDataProvenance(parsed.dataProvenance);
          const cachedSampleSize = normalizeSampleSize(parsed.sampleSize);
          const cachedAsOf = typeof parsed.asOf === 'string' && Number.isFinite(new Date(parsed.asOf).getTime())
            ? parsed.asOf
            : null;
          if (!cachedSummary || !cachedProvenance || !cachedSampleSize || !cachedAsOf) {
            throw new Error('缓存中的概览数据格式异常');
          }
          setQuizHistory(Array.isArray(parsed.quizHistory) ? parsed.quizHistory : []);
          setLearningProgress(Array.isArray(parsed.learningProgress) ? parsed.learningProgress : []);
          setAchievements(parsed.achievements || { stats: {} });
          setSummary(cachedSummary);
          setDataProvenance(cachedProvenance);
          setAsOf(cachedAsOf);
          setSampleSize(cachedSampleSize);
          setLastUpdatedAt(cachedAt);
          setDataStatus('cached');
          hasDisplayedDataRef.current = true;
          setLoading(false);
        } catch {
          try {
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(`${cacheKey}_time`);
          } catch { /* storage unavailable */ }
        }
      }

      if (hasDisplayedDataRef.current) {
        setLoading(false);
        setRefreshing(true);
        setDataStatus('cached');
      } else {
        setLoading(true);
        setRefreshing(false);
        setDataStatus('loading');
      }

      // Single consolidated API call
      requestControllerRef.current?.abort();
      const controller = new AbortController();
      requestControllerRef.current = controller;
      timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('/api/analytics/overview', {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) discardDisplayedData = true;
        throw new Error(response.status === 401 || response.status === 403
          ? '登录状态已失效，请重新登录后查看学情分析'
          : `HTTP ${response.status}`);
      }

      const payload = await response.json() as {
        success?: unknown;
        data?: unknown;
        dataProvenance?: unknown;
        asOf?: unknown;
        sampleSize?: unknown;
      };
      if (payload.success !== true || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
        throw new Error('学情概览响应格式异常，请重试');
      }
      const data = payload.data as Record<string, unknown>;
      const normalizedSummary = normalizeSummary(data.summary);
      const normalizedProvenance = normalizeDataProvenance(payload.dataProvenance);
      const normalizedSampleSize = normalizeSampleSize(payload.sampleSize);
      const normalizedAsOf = typeof payload.asOf === 'string' && Number.isFinite(new Date(payload.asOf).getTime())
        ? payload.asOf
        : null;
      if (!normalizedSummary || !normalizedProvenance || !normalizedSampleSize || !normalizedAsOf) {
        throw new Error('学情概览数据身份或统计口径缺失，请重试');
      }
      const analyticsData = {
        quizHistory: Array.isArray(data.quizHistory) ? data.quizHistory as QuizHistoryItem[] : [],
        learningProgress: Array.isArray(data.learningProgress) ? data.learningProgress as LearningProgressItem[] : [],
        achievements: { stats: {} },
        summary: normalizedSummary,
        dataProvenance: normalizedProvenance,
        asOf: normalizedAsOf,
        sampleSize: normalizedSampleSize,
        teacherData: data.teacherData && typeof data.teacherData === 'object' ? data.teacherData : null,
      };

      if (requestId !== requestIdRef.current || displayedUserIdRef.current !== userId) return;

      const updatedAt = Date.now();
      try {
        localStorage.setItem(cacheKey, JSON.stringify(analyticsData));
        localStorage.setItem(`${cacheKey}_time`, updatedAt.toString());
      } catch {
        // A storage quota/privacy restriction must not discard confirmed server data.
      }

      setQuizHistory(analyticsData.quizHistory);
      setLearningProgress(analyticsData.learningProgress);
      setAchievements(analyticsData.achievements);
      setSummary(analyticsData.summary);
      setDataProvenance(analyticsData.dataProvenance);
      setAsOf(analyticsData.asOf);
      setSampleSize(analyticsData.sampleSize);
      setLastUpdatedAt(updatedAt);
      setDataStatus('fresh');
      setError(null);
      hasDisplayedDataRef.current = true;
    } catch (error: unknown) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to fetch analytics data:', error);
      const errorMessage = error instanceof DOMException && error.name === 'AbortError'
        ? '学情数据请求超时，请重试'
        : error instanceof Error ? error.message : '无法获取学情分析数据，请重试';
      const canRetainDisplayedData = hasDisplayedDataRef.current && !discardDisplayedData;

      if (canRetainDisplayedData) {
        setDataStatus('stale');
        setError(`最新数据校准失败：${errorMessage}`);
      } else {
        clearDisplayedData();
        setDataStatus('error');
        setError(errorMessage);
      }
      toastRef.current({
        title: canRetainDisplayedData ? '最新数据校准失败' : '加载失败',
        description: canRetainDisplayedData
          ? '当前保留上次已确认数据，并已在页面标注；请稍后重试校准'
          : '无法获取学情分析数据，请刷新页面重试',
        variant: 'destructive'
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (requestControllerRef.current?.signal.aborted || requestId === requestIdRef.current) {
        requestControllerRef.current = null;
      }
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    if (enabled && !authLoading && user) {
      void fetchAnalyticsData();
    } else if (!authLoading || !enabled) {
      requestIdRef.current += 1;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      displayedUserIdRef.current = null;
      hasDisplayedDataRef.current = false;
      setQuizHistory([]);
      setLearningProgress([]);
      setAchievements({ stats: {} });
      setSummary(null);
      setError(null);
      setRefreshing(false);
      setDataStatus('idle');
      setLastUpdatedAt(null);
      setDataProvenance(null);
      setAsOf(null);
      setSampleSize(null);
      setLoading(false);
    }
    return () => {
      requestIdRef.current += 1;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
    };
  }, [authLoading, enabled, fetchAnalyticsData, user?.id]);

  // 计算知识点掌握度：没有该章进度记录时返回 null，不能把“未采集”写成 0%。
  const calculateKnowledgeMastery = (): KnowledgeMasteryItem[] => {
    // 按 chapterId 聚合进度
    const chapterProgress: Record<string, number> = {};
    const chapterCount: Record<string, number> = {};
    for (const lp of learningProgress) {
      const ch = lp.chapterId;
      if (!ch) continue;
      const norm = normalizeChapterId(ch);
      chapterProgress[norm] = (chapterProgress[norm] || 0) + lp.progress;
      chapterCount[norm] = (chapterCount[norm] || 0) + 1;
    }

    const result: KnowledgeMasteryItem[] = [];
    for (const [chapterId, topics] of Object.entries(chapterTopicMap)) {
      const avgProgress = chapterCount[chapterId]
        ? Math.round(chapterProgress[chapterId] / chapterCount[chapterId])
        : null;

      for (const { topic, details } of topics) {
        const detailEntries = details.reduce((acc, d) => {
          acc[d] = avgProgress;
          return acc;
        }, {} as Record<string, number | null>);

        result.push({ topic, mastery: avgProgress, hasRecord: avgProgress !== null, details: detailEntries });
      }
    }

    return result;
  };

  // 计算学习统计
  const calculateLearningStats = () => {
    const totalModules = learningProgress.length;
    const completedModules = learningProgress.filter(p => p.progress >= 100).length;
    const totalTime = learningProgress.reduce((sum, p) => sum + p.timeSpent, 0);
    const avgScore = quizHistory.length > 0
      ? Math.round(quizHistory.reduce((sum, q) => sum + q.score, 0) / quizHistory.length)
      : 0;

    // 测验分数趋势（真实数据，按时间排序）
    const quizScoreTrend = [...quizHistory]
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .slice(-10)
      .map((quiz, index) => ({
        quiz: `测验${index + 1}`,
        score: Math.round(quiz.score),
        date: quiz.completedAt,
      }));

    return {
      totalModules,
      completedModules,
      totalTime: Math.round(totalTime / 60),
      averageScore: avgScore,
      quizCount: quizHistory.length,
      quizScoreTrend,
    };
  };

  // 生成学习建议
  const generateLearningAdvice = () => {
    const knowledgeMastery = calculateKnowledgeMastery();
    const weakAreas = knowledgeMastery
      .filter(ka => ka.mastery !== null && ka.mastery < 70)
      .sort((a, b) => (a.mastery ?? Infinity) - (b.mastery ?? Infinity))
      .slice(0, 3);

    const strongAreas = knowledgeMastery
      .filter(ka => ka.mastery !== null && ka.mastery >= 80)
      .sort((a, b) => (b.mastery ?? -Infinity) - (a.mastery ?? -Infinity))
      .slice(0, 3);

    return {
      weakAreas,
      strongAreas,
      suggestions: weakAreas.map(area => `加强 ${area.topic} 的学习和练习`)
    };
  };

  return {
    loading,
    quizHistory,
    learningProgress,
    achievements,
    summary,
    error,
    refreshing,
    dataStatus,
    lastUpdatedAt,
    dataProvenance,
    asOf,
    sampleSize,
    calculateKnowledgeMastery,
    calculateLearningStats,
    generateLearningAdvice,
    fetchAnalyticsData,
    invalidateCache,
  };
};
