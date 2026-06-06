import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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

// Normalize chapterId from various formats: "chapter-1", "1", "ch1" → "ch1"
function normalizeChapterId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits) return `ch${digits}`;
  return raw;
}

// 章节 → 知识点主题映射（基于 knowledge-points.ts 的 10 章结构）
const chapterTopicMap: Record<string, { topic: string; details: string[] }[]> = {
  'ch1': [
    { topic: '单片机概述', details: ['发展历史', '分类选型', '应用领域', '基本结构'] },
    { topic: 'CPU结构', details: ['寄存器', 'ALU', '控制器', '总线'] },
  ],
  'ch2': [
    { topic: '存储器结构', details: ['RAM', 'ROM', '寻址方式', '存储器扩展'] },
    { topic: 'I/O 端口', details: ['端口结构', '端口操作', '位操作', '特殊功能寄存器'] },
  ],
  'ch3': [
    { topic: '指令系统', details: ['数据传送', '算术运算', '逻辑运算', '控制转移', '位操作'] },
    { topic: '寻址方式', details: ['立即寻址', '直接寻址', '寄存器寻址', '间接寻址', '变址寻址'] },
  ],
  'ch4': [
    { topic: '汇编语言程序设计', details: ['顺序结构', '分支结构', '循环结构', '子程序设计'] },
  ],
  'ch5': [
    { topic: '定时器/计数器', details: ['定时器模式', '计数器模式', '中断配置', '应用实例'] },
    { topic: '中断系统', details: ['中断源', '中断优先级', '中断服务', '中断嵌套'] },
  ],
  'ch6': [
    { topic: 'LED动态扫描', details: ['扫描原理', '编程实现', '显示优化', '应用案例'] },
  ],
  'ch7': [
    { topic: '矩阵键盘扫描', details: ['扫描原理', '按键识别', '消抖处理', '应用案例'] },
  ],
  'ch8': [
    { topic: 'ADC 应用', details: ['ADC原理', '采样定理', '转换精度', '接口编程'] },
  ],
  'ch9': [
    { topic: '串行通信', details: ['UART原理', '波特率', '通信协议', '应用实例'] },
  ],
  'ch10': [
    { topic: '系统设计综合', details: ['需求分析', '方案设计', '系统实现', '调试测试'] },
  ],
};

export const useAnalytics = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);
  const [learningProgress, setLearningProgress] = useState<LearningProgressItem[]>([]);
  const [achievements, setAchievements] = useState<AchievementsData>({ stats: {} });
  const [summary, setSummary] = useState<{
    totalPoints: number; totalExperiments: number; totalQuizzes: number;
    totalAchievements: number; completedExperiments: number; completedModules: number;
    totalTimeSpent: number; avgQuizScore: number;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchAnalyticsData();
    }
  }, [user, authLoading]);

  const invalidateCache = () => {
    const cacheKey = `analytics_${user?.id || 'anonymous'}`;
    localStorage.removeItem(cacheKey);
    localStorage.removeItem(`${cacheKey}_time`);
  };

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      // Check cache (5 min)
      const cacheKey = `analytics_${user?.id || 'anonymous'}`;
      const cachedData = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);
      if (cachedData && cacheTime && (Date.now() - parseInt(cacheTime)) < 5 * 60 * 1000) {
        try {
          const parsed = JSON.parse(cachedData);
          setQuizHistory(parsed.quizHistory || []);
          setLearningProgress(parsed.learningProgress || []);
          setAchievements(parsed.achievements || { stats: {} });
          setSummary(parsed.summary || null);
          setLoading(false);
          return;
        } catch { /* cache corrupted, re-fetch */ }
      }

      // Single consolidated API call
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('/api/analytics/overview', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { data } = await response.json();
      const analyticsData = {
        quizHistory: data.quizHistory || [],
        learningProgress: data.learningProgress || [],
        achievements: { stats: {} },
        summary: data.summary || null,
        teacherData: data.teacherData || null,
      };

      localStorage.setItem(cacheKey, JSON.stringify(analyticsData));
      localStorage.setItem(`${cacheKey}_time`, Date.now().toString());

      setQuizHistory(analyticsData.quizHistory);
      setLearningProgress(analyticsData.learningProgress);
      setAchievements(analyticsData.achievements);
      setSummary(analyticsData.summary);
    } catch (error: unknown) {
      console.error('Failed to fetch analytics data:', error);
      toast({
        title: '加载失败',
        description: '无法获取学情分析数据，请刷新页面重试',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 计算知识点掌握度（从 LearningProgress 真实数据映射）
  const calculateKnowledgeMastery = (): { topic: string; mastery: number; details: Record<string, number> }[] => {
    if (learningProgress.length === 0) {
      return Object.values(chapterTopicMap).flat().map(({ topic, details }) => ({
        topic,
        mastery: 0,
        details: details.reduce((acc, d) => ({ ...acc, [d]: 0 }), {} as Record<string, number>),
      }));
    }

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

    const result: { topic: string; mastery: number; details: Record<string, number> }[] = [];
    for (const [chapterId, topics] of Object.entries(chapterTopicMap)) {
      const avgProgress = chapterCount[chapterId]
        ? Math.round(chapterProgress[chapterId] / chapterCount[chapterId])
        : 0;

      for (const { topic, details } of topics) {
        const detailEntries = details.reduce((acc, d) => {
          acc[d] = avgProgress;
          return acc;
        }, {} as Record<string, number>);

        result.push({ topic, mastery: avgProgress, details: detailEntries });
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
      ? Math.round(quizHistory.reduce((sum, q) => sum + (q.score / q.totalQuestions) * 100, 0) / quizHistory.length)
      : 0;

    // 测验分数趋势（真实数据，按时间排序）
    const quizScoreTrend = [...quizHistory]
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .slice(-10)
      .map((quiz, index) => ({
        quiz: `测验${index + 1}`,
        score: Math.round((quiz.score / quiz.totalQuestions) * 100),
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
      .filter(ka => ka.mastery < 70)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);

    const strongAreas = knowledgeMastery
      .filter(ka => ka.mastery >= 80)
      .sort((a, b) => b.mastery - a.mastery)
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
    calculateKnowledgeMastery,
    calculateLearningStats,
    generateLearningAdvice,
    fetchAnalyticsData,
    invalidateCache,
  };
};