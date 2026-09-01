'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  Loader2,
  Medal,
  RefreshCw,
  Search,
  Shield,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { EvidenceReadiness } from '@/components/shared/StatusBanner';

interface TeacherStudent {
  id?: string;
  name: string;
  studentId?: string | null;
  class?: string | null;
  avgQuizScore?: number;
  quizAttemptCount?: number;
  chapterMastery?: Record<string, number>;
}

interface TeacherDashboard {
  dataProvenance: DataProvenance;
  students?: TeacherStudent[];
}

interface DataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

interface GainsData {
  dataProvenance: DataProvenance;
  comparisonType?: 'REPEATED_ATTEMPT';
  scoreDistribution: { label: string; count: number }[];
  scoreSummary: { avg: number; total: number };
  experimentCorrelation: { experimentsCompleted: number; avgScore: number; studentCount: number }[];
  timeCorrelation: { timeRange: string; avgScore: number; studentCount: number }[];
  prePostComparison: { name: string; firstScore: number; latestScore: number; gain: number }[];
  chapterMasteryAvg: { chapter: string; avgMastery: number }[];
}

interface AiUsageData {
  dataProvenance: DataProvenance;
  interpretation?: 'CORRELATION_ONLY';
  summary: {
    totalAiUsers: number;
    totalAiEvents: number;
    avgAiPerUser: number;
    avgAiUserScore: number | null;
    avgNonAiUserScore: number | null;
    aiUsageRate: number;
    scoreDifference: number | null;
  };
  usageVsScore: { aiUsageCount: number; avgScore: number; studentCount: number }[];
  weeklyUsage: { week: string; aiEvents: number; activeUsers: number }[];
  topAiStudents: { name: string; aiCount: number; firstScore: number; latestScore: number; gain: number }[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseDataProvenance(value: unknown): DataProvenance | null {
  const record = asRecord(value);
  if (!record
    || !['DEMO', 'REAL', 'MIXED'].includes(String(record.mode))
    || typeof record.label !== 'string'
    || !record.label.trim()
    || typeof record.note !== 'string'
    || !record.note.trim()) return null;
  return record as unknown as DataProvenance;
}

async function apiError(response: Response, fallback: string): Promise<string> {
  const body = asRecord(await response.json().catch(() => null));
  return typeof body?.error === 'string' && body.error.trim() ? body.error : fallback;
}

function parseTeacherDashboard(value: unknown): TeacherDashboard | null {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.students) || !parseDataProvenance(record.dataProvenance)) return null;
  return record as unknown as TeacherDashboard;
}

function parseGainsData(value: unknown): GainsData | null {
  const record = asRecord(value);
  const summary = asRecord(record?.scoreSummary);
  if (!record
    || !summary
    || !parseDataProvenance(record.dataProvenance)
    || typeof summary.avg !== 'number'
    || typeof summary.total !== 'number'
    || !Array.isArray(record.scoreDistribution)
    || !Array.isArray(record.experimentCorrelation)
    || !Array.isArray(record.timeCorrelation)
    || !Array.isArray(record.prePostComparison)
    || !Array.isArray(record.chapterMasteryAvg)) return null;
  return record as unknown as GainsData;
}

function parseAiUsageData(value: unknown): AiUsageData | null {
  const record = asRecord(value);
  const summary = asRecord(record?.summary);
  if (!record
    || !summary
    || !parseDataProvenance(record.dataProvenance)
    || typeof summary.totalAiUsers !== 'number'
    || typeof summary.totalAiEvents !== 'number'
    || typeof summary.avgAiPerUser !== 'number'
    || typeof summary.aiUsageRate !== 'number'
    || !Array.isArray(record.usageVsScore)
    || !Array.isArray(record.weeklyUsage)
    || !Array.isArray(record.topAiStudents)) return null;
  return record as unknown as AiUsageData;
}

function LoadFailure({ message, retryLabel, onRetry }: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-red-300/20 bg-red-300/[0.06] p-5 text-center" role="alert">
      <AlertCircle className="h-5 w-5 text-red-200" />
      <p className="mt-2 text-sm font-semibold text-red-100">读取失败</p>
      <p className="mt-1 max-w-xl text-xs leading-5 text-red-100/70">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-red-200/25 bg-red-200/[0.08] px-4 text-sm text-red-50 hover:bg-red-200/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
      >
        <RefreshCw className="h-4 w-4" />
        {retryLabel}
      </button>
    </div>
  );
}

function SectionLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] text-sm text-slate-400" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function heatColor(value: number | null) {
  if (value === null) return 'border-white/[0.08] bg-white/[0.025] text-slate-400';
  if (value >= 80) return 'border-emerald-300/25 bg-emerald-300/[0.16] text-emerald-100';
  if (value >= 60) return 'border-amber-300/25 bg-amber-300/[0.14] text-amber-100';
  return 'border-red-300/25 bg-red-300/[0.12] text-red-100';
}

function formatUpdatedAt(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '更新时间未知';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatLearningMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0m';
  if (totalMinutes < 60) return `${Math.round(totalMinutes)}m`;
  const hours = totalMinutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function HyperAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const isTeacherView = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const {
    loading,
    refreshing: overviewRefreshing,
    dataStatus: overviewDataStatus,
    lastUpdatedAt: overviewUpdatedAt,
    dataProvenance: overviewProvenance,
    asOf: overviewAsOf,
    sampleSize: overviewSampleSize,
    error: overviewError,
    summary,
    quizHistory,
    learningProgress,
    calculateKnowledgeMastery,
    calculateLearningStats,
    fetchAnalyticsData,
  } = useAnalytics({ enabled: !isTeacherView });
  const [teacherData, setTeacherData] = useState<TeacherDashboard | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [gainsData, setGainsData] = useState<GainsData | null>(null);
  const [gainsError, setGainsError] = useState<string | null>(null);
  const [gainsLoading, setGainsLoading] = useState(false);
  const [aiData, setAiData] = useState<AiUsageData | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const teacherRequestIdRef = useRef(0);
  const teacherControllerRef = useRef<AbortController | null>(null);
  const gainsRequestIdRef = useRef(0);
  const gainsControllerRef = useRef<AbortController | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiControllerRef = useRef<AbortController | null>(null);

  const knowledgeMastery = calculateKnowledgeMastery();
  const learningStats = calculateLearningStats();
  const recordedKnowledgeMastery = knowledgeMastery.filter((item) => item.mastery !== null);
  const avgMastery = recordedKnowledgeMastery.length
    ? Math.round(recordedKnowledgeMastery.reduce((sum, item) => sum + (item.mastery ?? 0), 0) / recordedKnowledgeMastery.length)
    : null;

  const fetchTeacherDashboard = useCallback(async () => {
    if (!isTeacherView || !user?.id) return;
    const requestId = ++teacherRequestIdRef.current;
    teacherControllerRef.current?.abort();
    const controller = new AbortController();
    teacherControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    setTeacherLoading(true);
    setTeacherError(null);
    setTeacherData(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const response = await fetch('/api/teacher/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(await apiError(response, '无法读取班级排行数据'));
      const parsed = parseTeacherDashboard(await response.json());
      if (!parsed) throw new Error('班级排行数据格式异常，请重试');
      if (requestId !== teacherRequestIdRef.current) return;
      setTeacherData(parsed);
    } catch (error) {
      if (requestId !== teacherRequestIdRef.current) return;
      setTeacherError(error instanceof DOMException && error.name === 'AbortError'
        ? '班级排行请求超时，请重试'
        : error instanceof Error ? error.message : '无法读取班级排行数据');
    } finally {
      clearTimeout(timeoutId);
      if (requestId === teacherRequestIdRef.current) {
        teacherControllerRef.current = null;
        setTeacherLoading(false);
      }
    }
  }, [isTeacherView, user?.id]);

  useEffect(() => {
    if (!isTeacherView) {
      teacherRequestIdRef.current += 1;
      teacherControllerRef.current?.abort();
      teacherControllerRef.current = null;
      setTeacherData(null);
      setTeacherError(null);
      setTeacherLoading(false);
      return;
    }
    void fetchTeacherDashboard();
    return () => {
      teacherRequestIdRef.current += 1;
      teacherControllerRef.current?.abort();
      teacherControllerRef.current = null;
    };
  }, [fetchTeacherDashboard, isTeacherView]);

  // Fetch learning gains data (teacher/admin only)
  const fetchGains = useCallback(async () => {
    if (!isTeacherView || !user?.id) return;
    const requestId = ++gainsRequestIdRef.current;
    gainsControllerRef.current?.abort();
    const controller = new AbortController();
    gainsControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    setGainsLoading(true);
    setGainsError(null);
    setGainsData(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const res = await fetch('/api/analytics/learning-gains', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await apiError(res, '无法读取教学效果数据'));
      const parsed = parseGainsData(await res.json());
      if (!parsed) throw new Error('教学效果数据格式异常，请重试');
      if (requestId !== gainsRequestIdRef.current) return;
      setGainsData(parsed);
    } catch (error) {
      if (requestId !== gainsRequestIdRef.current) return;
      setGainsError(error instanceof DOMException && error.name === 'AbortError'
        ? '教学效果请求超时，请重试'
        : error instanceof Error ? error.message : '无法读取教学效果数据');
    } finally {
      clearTimeout(timeoutId);
      if (requestId === gainsRequestIdRef.current) {
        gainsControllerRef.current = null;
        setGainsLoading(false);
      }
    }
  }, [isTeacherView, user?.id]);

  useEffect(() => {
    if (!isTeacherView) {
      gainsRequestIdRef.current += 1;
      gainsControllerRef.current?.abort();
      gainsControllerRef.current = null;
      setGainsData(null);
      setGainsError(null);
      setGainsLoading(false);
      return;
    }
    void fetchGains();
    return () => {
      gainsRequestIdRef.current += 1;
      gainsControllerRef.current?.abort();
      gainsControllerRef.current = null;
    };
  }, [fetchGains, isTeacherView]);

  // Fetch AI usage data (teacher/admin only)
  const fetchAiUsage = useCallback(async () => {
    if (!isTeacherView || !user?.id) return;
    const requestId = ++aiRequestIdRef.current;
    aiControllerRef.current?.abort();
    const controller = new AbortController();
    aiControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    setAiLoading(true);
    setAiError(null);
    setAiData(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const res = await fetch('/api/analytics/ai-usage', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(await apiError(res, '无法读取AI使用统计'));
      const parsed = parseAiUsageData(await res.json());
      if (!parsed) throw new Error('AI使用统计格式异常，请重试');
      if (requestId !== aiRequestIdRef.current) return;
      setAiData(parsed);
    } catch (error) {
      if (requestId !== aiRequestIdRef.current) return;
      setAiError(error instanceof DOMException && error.name === 'AbortError'
        ? 'AI使用统计请求超时，请重试'
        : error instanceof Error ? error.message : '无法读取AI使用统计');
    } finally {
      clearTimeout(timeoutId);
      if (requestId === aiRequestIdRef.current) {
        aiControllerRef.current = null;
        setAiLoading(false);
      }
    }
  }, [isTeacherView, user?.id]);

  useEffect(() => {
    if (!isTeacherView) {
      aiRequestIdRef.current += 1;
      aiControllerRef.current?.abort();
      aiControllerRef.current = null;
      setAiData(null);
      setAiError(null);
      setAiLoading(false);
      return;
    }
    void fetchAiUsage();
    return () => {
      aiRequestIdRef.current += 1;
      aiControllerRef.current?.abort();
      aiControllerRef.current = null;
    };
  }, [fetchAiUsage, isTeacherView]);

  const rankedStudents = useMemo(() => {
    const students = teacherData?.students || [];
    const q = query.trim().toLowerCase();
    return students
      .map((student) => ({
        ...student,
        score: (typeof student.quizAttemptCount === 'number' && student.quizAttemptCount > 0)
          ? Math.round(student.avgQuizScore ?? 0)
          : null,
      }))
      .filter((student) => !q || `${student.name} ${student.studentId || ''} ${student.class || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }, [query, teacherData?.students]);

  const dataProvenance = isTeacherView
    ? gainsData?.dataProvenance ?? teacherData?.dataProvenance ?? aiData?.dataProvenance
    : overviewProvenance;
  const overviewHasData = summary !== null;
  const overviewReady = !loading && overviewHasData;
  const overviewUnavailable = !loading && !overviewHasData;
  const hasLearningRecords = overviewReady && learningProgress.length > 0;
  const hasQuizRecords = overviewReady && ((summary?.totalQuizzes ?? 0) > 0 || quizHistory.length > 0);
  const hasKnowledgeRecords = overviewReady && recordedKnowledgeMastery.length > 0;
  const freshnessNote = overviewDataStatus === 'cached'
    ? ' · 缓存值，正在校准'
    : overviewDataStatus === 'stale'
      ? ' · 上次已确认值，校准失败'
      : '';
  const metricCards = [
    {
      label: '累计学习',
      value: loading && !overviewHasData ? '…' : overviewUnavailable ? 'N/A' : hasLearningRecords ? formatLearningMinutes(summary?.totalTimeSpent ?? 0) : 'N/A',
      note: loading && !overviewHasData ? '正在读取' : overviewUnavailable ? '读取失败' : `${hasLearningRecords ? '按已记录学习时长汇总' : '无学习记录'}${freshnessNote}`,
      icon: BrainCircuit,
    },
    {
      label: '平均测验',
      value: loading && !overviewHasData ? '…' : overviewUnavailable ? 'N/A' : hasQuizRecords ? `${Math.round(learningStats.averageScore)}%` : 'N/A',
      note: loading && !overviewHasData ? '正在读取' : overviewUnavailable ? '读取失败' : `${hasQuizRecords ? '按已提交测验计算' : '无测验记录'}${freshnessNote}`,
      icon: ClipboardCheck,
    },
    {
      label: '知识掌握',
      value: loading && !overviewHasData ? '…' : overviewUnavailable ? 'N/A' : hasKnowledgeRecords && avgMastery !== null ? `${avgMastery}%` : 'N/A',
      note: loading && !overviewHasData ? '正在读取' : overviewUnavailable ? '读取失败' : `${hasKnowledgeRecords ? `按 ${recordedKnowledgeMastery.length} 个有记录章节计算` : '无可计算章节记录'}${freshnessNote}`,
      icon: BarChart3,
    },
    {
      label: '获得成就',
      value: loading && !overviewHasData ? '…' : overviewUnavailable ? 'N/A' : overviewReady ? `${summary?.totalAchievements ?? 0}` : 'N/A',
      note: loading && !overviewHasData ? '正在读取' : overviewUnavailable ? '读取失败' : overviewReady ? `当前账户累计${freshnessNote}` : '暂无汇总记录',
      icon: Trophy,
    },
  ];
  const teacherMetricCards = [
    {
      label: '所辖学生',
      value: teacherLoading ? '…' : teacherError || !teacherData ? '—' : `${teacherData.students?.length ?? 0}`,
      note: teacherLoading ? '正在读取' : teacherError || !teacherData ? '读取失败' : '当前教师可管理范围',
      icon: Award,
    },
    {
      label: '有测评记录',
      value: gainsLoading ? '…' : gainsError || !gainsData ? '—' : `${gainsData.scoreSummary.total}`,
      note: gainsLoading ? '正在读取' : gainsError || !gainsData ? '读取失败' : '纳入当前统计口径',
      icon: ClipboardCheck,
    },
    {
      label: '测验均分',
      value: gainsLoading
        ? '…'
        : gainsError || !gainsData
          ? '—'
          : gainsData.scoreSummary.total > 0 ? `${gainsData.scoreSummary.avg}%` : '—',
      note: gainsLoading
        ? '正在读取'
        : gainsError || !gainsData
          ? '读取失败'
          : gainsData.scoreSummary.total > 0 ? '按已提交测验计算' : '当前范围无测评记录',
      icon: BarChart3,
    },
    {
      label: 'AI 问答记录',
      value: aiLoading ? '…' : aiError || !aiData ? '—' : `${aiData.summary.totalAiEvents}`,
      note: aiLoading ? '正在读取' : aiError || !aiData ? '读取失败' : '接口已确认的事件数',
      icon: BrainCircuit,
    },
  ];
  const visibleMetricCards = isTeacherView ? teacherMetricCards : metricCards;
  const studentNextAction = !overviewReady
    ? {
        href: '/tasks',
        label: '查看学习任务',
        summary: '个人学情尚未形成可用结果，先回到任务页确认当前学习步骤。',
      }
    : !hasQuizRecords
      ? {
          href: '/tasks',
          label: '查看学习任务',
          summary: '尚无已提交测评记录，先按任务顺序完成学习与专项测评。',
        }
      : !hasKnowledgeRecords
        ? {
            href: '/tasks',
            label: '继续当前任务',
            summary: '已有测评记录，但尚无可计算的章节掌握记录；继续完成任务中的学习步骤。',
          }
        : avgMastery !== null && avgMastery < 70
          ? {
              href: '/weak-nodes',
              label: '查看薄弱点',
              summary: `已记录章节的平均掌握度为 ${avgMastery}%，可先复核薄弱点及对应补学资源。`,
            }
          : {
              href: '/tasks',
              label: '继续当前任务',
              summary: `已记录章节的平均掌握度为 ${avgMastery ?? 'N/A'}%，继续按任务要求完成实践与复测。`,
            };
  const studentSecondaryAction = !hasQuizRecords
    ? { href: '/quiz', label: '进入自主测评' }
    : { href: '/simulation', label: '进入仿真实践' };
  const retryOverview = (): void => {
    void fetchAnalyticsData(true);
  };

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-[#070a0d] text-slate-100 sm:-m-6" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200 motion-reduce:animate-none" aria-hidden="true" />
        <p className="mt-3 text-sm text-slate-400">正在确认学情分析访问范围</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Shield className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">请先登录以查看学情分析。</p>
          <Link href="/login?from=%2Fanalytics" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            登录并返回
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 animate-fade-in sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <BarChart3 className="h-3.5 w-3.5" />
              Learning Analytics · 学情分析
            </div>
            <h1 id="analytics-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
              {isTeacherView ? '学情分析工作台' : '我的学习反馈'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {isTeacherView
                ? '汇总当前教师范围内的班级测评、学习过程、重复作答和AI使用记录；所有结果均显示数据身份与可解释边界。'
                : '汇总你的测评、知识掌握度和成就记录；班级排行与教师专属分析不会在学生视图展示。'}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        {dataProvenance && (
          <div
            role="note"
            className={cn(
              'mb-5 flex items-start gap-3 rounded-md border px-4 py-3',
              dataProvenance.mode === 'REAL'
                ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
                : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
            )}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-sm font-semibold">{dataProvenance.label}</div>
              <p className="mt-1 text-xs leading-5 opacity-80">{dataProvenance.note}</p>
              {!isTeacherView && overviewAsOf && overviewSampleSize && (
                <p className="mt-1 font-mono text-[10px] leading-5 opacity-70">
                  截止 {new Date(overviewAsOf).toLocaleString('zh-CN', { hour12: false })}
                  {' · '}测评 n={overviewSampleSize.quizAttempts}
                  {' · '}学习 n={overviewSampleSize.learningProgressRecords}
                  {' · '}实验 n={overviewSampleSize.experimentRecords}
                  {' · '}成就 n={overviewSampleSize.achievementRecords}/{overviewSampleSize.achievementRules}
                  {' · '}0 为已确认零记录，N/A 为无可计算记录或读取失败
                </p>
              )}
            </div>
          </div>
        )}
        {dataProvenance && (user.role === 'TEACHER' || user.role === 'ADMIN') && (
          <EvidenceReadiness mode={dataProvenance.mode} className="mb-5" />
        )}
        {!isTeacherView && overviewDataStatus === 'cached' && overviewHasData && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-cyan-50" role="status">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">正在校准服务端最新记录</p>
              <p className="mt-1 text-xs leading-5 text-cyan-50/70">
                当前暂显示 {formatUpdatedAt(overviewUpdatedAt)} 保存的数据；校准完成后将自动更新。
              </p>
            </div>
          </div>
        )}
        {!isTeacherView && overviewDataStatus === 'stale' && overviewHasData && overviewError && (
          <div className="mb-5 flex flex-col gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-amber-50 sm:flex-row sm:items-center" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">最新数据尚未校准</p>
              <p className="mt-1 text-xs leading-5 text-amber-50/75">
                {overviewError}。当前仍显示 {formatUpdatedAt(overviewUpdatedAt)} 的上次已确认数据，不代表此刻最新状态。
              </p>
            </div>
            <button
              type="button"
              onClick={retryOverview}
              disabled={overviewRefreshing}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-amber-200/25 bg-amber-200/[0.08] px-4 text-sm text-amber-50 hover:bg-amber-200/[0.14] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', overviewRefreshing && 'animate-spin')} aria-hidden="true" />
              {overviewRefreshing ? '正在校准' : '重试校准'}
            </button>
          </div>
        )}
        {!isTeacherView && loading && !overviewHasData && <SectionLoading label="正在读取个人学情数据…" />}
        {!isTeacherView && !loading && overviewError && !overviewHasData && (
          <LoadFailure message={overviewError} retryLabel="重试个人统计" onRetry={retryOverview} />
        )}
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 stagger-children">
          {visibleMetricCards.map(({ label, value, note, icon: Icon }) => (
            <div key={label} className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md"><Icon className="h-4 w-4 text-cyan-100" /></div>
              <div className="mt-3 font-mono text-2xl font-semibold text-slate-50 stat-glow">{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
              <div className="mt-1 text-[10px] text-slate-500">{note}</div>
            </div>
          ))}
        </section>

        <section aria-labelledby="analytics-page-title" className={cn('grid items-start gap-6', !isTeacherView && 'xl:grid-cols-[1.15fr_0.85fr]')}>
          {!isTeacherView && <section className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="text-lg font-semibold text-slate-50">知识点掌握度</h2>
              <p className="mt-1 text-xs text-slate-500">基于已落盘学习进度计算；没有该章记录时显示 N/A，且不纳入平均值。</p>
            </div>
            <div className="p-5">
              {loading && !overviewHasData ? (
                <SectionLoading label="正在读取知识点掌握度…" />
              ) : overviewError && !overviewHasData ? (
                <LoadFailure message={overviewError} retryLabel="重试知识点统计" onRetry={retryOverview} />
              ) : hasKnowledgeRecords ? (
                <div className="space-y-4">
                  {knowledgeMastery.map((item) => (
                    <div key={item.topic} className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">{item.topic}</div>
                        <div className={cn('font-mono text-sm', item.mastery === null ? 'text-slate-400' : 'text-cyan-100')}>
                          {item.mastery === null ? 'N/A' : `${Math.round(item.mastery)}%`}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(item.details).map(([detail, score]) => (
                          <div
                            key={detail}
                            className={cn('rounded-md border px-3 py-2 text-xs', heatColor(score))}
                          >
                            <div className="line-clamp-1">{detail}</div>
                            <div className="mt-1 font-mono text-[11px] opacity-80">
                              {score === null ? 'N/A · 未形成记录' : `${Math.round(score)}%`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState centered icon={BrainCircuit} title="暂无学习进度记录" description="接口读取成功；形成学习进度记录后，这里会生成知识点掌握度" className="min-h-64" />
              )}
            </div>
          </section>}

          {!isTeacherView && (
            <section className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.055]" aria-labelledby="student-next-action-title">
              <div className="border-b border-cyan-300/15 p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">Next action · 下一步</div>
                <h2 id="student-next-action-title" className="mt-2 text-lg font-semibold text-slate-50">根据当前记录继续学习</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{studentNextAction.summary}</p>
              </div>
              <div className="p-5">
                <div className="rounded-md border border-white/[0.08] bg-black/20 px-3 py-3 text-xs leading-5 text-slate-400">
                  本页只解释已落盘记录，不会直接改变测验得分、任务进度或实验完成状态；最终结果以各步骤提交后的服务端回执为准。
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row xl:flex-col 2xl:flex-row">
                  <Link
                    href={studentNextAction.href}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                  >
                    {studentNextAction.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={studentSecondaryAction.href}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-white/[0.12] bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  >
                    {studentSecondaryAction.label}
                  </Link>
                </div>
              </div>
            </section>
          )}

          {isTeacherView && <section className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">班级排行榜</h2>
                  <p className="mt-1 text-xs text-slate-500">班级整体测验表现一览（教师视图）。</p>
                </div>
                <Medal className="h-5 w-5 text-amber-200" />
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索学生..."
                  aria-label="搜索班级学生"
                  className="min-h-11 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 hover:border-cyan-300/30 transition-all focus-visible:ring-cyan-300/70"
                />
              </div>
            </div>

            <div className="p-5">
              {teacherLoading ? (
                <SectionLoading label="正在读取班级排行…" />
              ) : teacherError ? (
                <LoadFailure message={teacherError} retryLabel="重试班级排行" onRetry={() => void fetchTeacherDashboard()} />
              ) : rankedStudents.length ? (
                <div className="space-y-2">
                  {rankedStudents.slice(0, 10).map((student, index) => (
                    <div key={student.id || student.studentId || student.name} className="grid grid-cols-[42px_1fr_70px] items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className={cn('font-mono text-lg font-semibold', index < 3 ? 'text-amber-200' : 'text-slate-500')}>#{index + 1}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{student.name}</div>
                        <div className="truncate font-mono text-[10px] text-slate-500">
                          {typeof student.quizAttemptCount !== 'number'
                            ? '测验记录状态未知'
                            : student.quizAttemptCount === 0
                              ? '无测验记录'
                              : student.studentId || student.class || '未登记学号'}
                        </div>
                      </div>
                      <div className="text-right font-mono text-lg font-semibold text-cyan-100">{student.score === null ? '—' : `${student.score}%`}</div>
                    </div>
                  ))}
                </div>
              ) : (teacherData?.students?.length ?? 0) > 0 ? (
                <EmptyState centered icon={Search} title="没有匹配的学生" description="请调整姓名、学号或班级关键词" className="min-h-64" />
              ) : (
                <EmptyState centered icon={Award} title="暂无班级学生记录" description="接口读取成功；当前账号所辖范围没有学生记录" className="min-h-64" />
              )}
            </div>
          </section>}
        </section>

        {/* Teaching Effectiveness Section */}
        {isTeacherView && (
          <section className="mt-6 space-y-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-slate-50">教学过程数据</h2>
              <span className="text-xs text-slate-500">
                {gainsData
                  ? `${gainsData.dataProvenance?.label ?? '数据身份未标注'} · ${gainsData.scoreSummary.total} 名学生有测评记录`
                  : '教师专属分析'}
              </span>
            </div>

            {gainsLoading ? (
              <SectionLoading label="正在读取教学效果数据…" />
            ) : gainsError ? (
              <LoadFailure message={gainsError} retryLabel="重试教学效果" onRetry={() => void fetchGains()} />
            ) : !gainsData ? (
              <LoadFailure message="教学效果数据未返回，请重试" retryLabel="重试教学效果" onRetry={() => void fetchGains()} />
            ) : gainsData.scoreSummary.total === 0 ? (
              <EmptyState
                centered
                icon={ClipboardCheck}
                title="当前范围暂无测评记录"
                description="接口读取成功；当前范围没有可用于成绩分布和重复作答比较的记录"
                className="min-h-64 rounded-md border border-white/[0.08] bg-white/[0.035]"
              />
            ) : <>
            <div className="grid gap-4 md:grid-cols-3">
              {/* Score Distribution */}
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">成绩分布</h3>
                <p className="mb-3 text-xs text-slate-500">平均分 {gainsData.scoreSummary.avg}%</p>
                <div className="space-y-2">
                  {gainsData.scoreDistribution.map((r) => {
                    const maxCount = Math.max(...gainsData.scoreDistribution.map((x) => x.count), 1);
                    const width = (r.count / maxCount) * 100;
                    return (
                      <div key={r.label} className="flex items-center gap-2">
                        <div className="w-12 text-right font-mono text-[11px] text-slate-400">{r.label}</div>
                        <div className="flex-1">
                          <div className="h-5 rounded-full bg-black/30">
                            <div
                              className="flex h-full items-center rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400/60 px-2 text-[10px] font-mono text-cyan-100"
                              style={{ width: `${Math.max(width, 8)}%` }}
                            >
                              {r.count}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Experiment vs Score Correlation */}
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">按实验完成数分组的测验均分</h3>
                <p className="mb-3 text-xs text-slate-500">描述性分组结果；未控制基础水平、学习时长等因素，不用于因果判断。</p>
                {gainsData.experimentCorrelation.length > 0 ? (
                  <div className="space-y-2">
                    {gainsData.experimentCorrelation.slice(0, 6).map((item) => {
                      const maxScore = Math.max(...gainsData.experimentCorrelation.map((x) => x.avgScore), 1);
                      const width = (item.avgScore / maxScore) * 100;
                      return (
                        <div key={item.experimentsCompleted} className="flex items-center gap-2">
                          <div className="w-16 text-right font-mono text-[11px] text-slate-400">{item.experimentsCompleted}个</div>
                          <div className="flex-1">
                            <div className="h-5 rounded-full bg-black/30">
                              <div
                                className="flex h-full items-center rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400/60 px-2 text-[10px] font-mono text-emerald-100"
                                style={{ width: `${Math.max(width, 8)}%` }}
                              >
                                {item.avgScore}%
                              </div>
                            </div>
                          </div>
                          <div className="w-8 text-right font-mono text-[10px] text-slate-500">×{item.studentCount}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">暂无实验关联数据</p>
                )}
              </div>

              {/* Time vs Score Correlation */}
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">按学习时长分组的测验均分</h3>
                <p className="mb-3 text-xs text-slate-500">描述性分组结果；未控制基础水平、任务难度等因素，不用于因果判断。</p>
                {gainsData.timeCorrelation.length > 0 ? (
                  <div className="space-y-2">
                    {gainsData.timeCorrelation.map((item) => {
                      const maxScore = Math.max(...gainsData.timeCorrelation.map((x) => x.avgScore), 1);
                      const width = (item.avgScore / maxScore) * 100;
                      return (
                        <div key={item.timeRange} className="flex items-center gap-2">
                          <div className="w-12 text-right font-mono text-[11px] text-slate-400">{item.timeRange}</div>
                          <div className="flex-1">
                            <div className="h-5 rounded-full bg-black/30">
                              <div
                                className="flex h-full items-center rounded-full bg-gradient-to-r from-cyan-300 to-amber-300/60 px-2 text-[10px] font-mono text-amber-100"
                                style={{ width: `${Math.max(width, 8)}%` }}
                              >
                                {item.avgScore}%
                              </div>
                            </div>
                          </div>
                          <div className="w-8 text-right font-mono text-[10px] text-slate-500">×{item.studentCount}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">暂无时长关联数据</p>
                )}
              </div>
            </div>

            {/* Repeated-attempt comparison; not a controlled pre/post study. */}
            {gainsData.prePostComparison.length > 0 && (
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">同一测验多次作答变化</h3>
                <p className="mb-3 text-xs text-slate-500">仅比较同一测验的首次与最近一次作答，不等同于受控前测/后测。</p>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {gainsData.prePostComparison.slice(0, 12).map((item) => (
                    <div key={item.name} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-200">{item.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          首次 {item.firstScore}% → 最近 {item.latestScore}%
                        </div>
                      </div>
                      <div className={`font-mono text-sm font-semibold ${item.gain > 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                        {item.gain > 0 ? '+' : ''}{item.gain}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chapter Mastery Overview */}
            {gainsData.chapterMasteryAvg.length > 0 && (
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">各章平均掌握度</h3>
                <p className="mb-3 text-xs text-slate-500">全体学生各章节 LearningProgress 均值</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {gainsData.chapterMasteryAvg.map((item) => (
                    <div key={item.chapter} className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="font-mono text-[11px] text-slate-400">{item.chapter}</div>
                      <div className={`ml-auto font-mono text-sm font-semibold ${item.avgMastery >= 80 ? 'text-emerald-200' : item.avgMastery >= 60 ? 'text-amber-200' : 'text-red-200'}`}>
                        {item.avgMastery}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>}
          </section>
        )}

        {/* AI Usage Effectiveness */}
        {isTeacherView && (
          <section className="mt-6 space-y-6">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-slate-50">AI 使用与成绩的描述性统计</h2>
              <span className="text-xs text-slate-500">仅展示同期记录的相关性，不据此推断AI造成成绩变化</span>
            </div>

            {aiLoading ? (
              <SectionLoading label="正在读取AI使用统计…" />
            ) : aiError ? (
              <LoadFailure message={aiError} retryLabel="重试AI统计" onRetry={() => void fetchAiUsage()} />
            ) : !aiData ? (
              <LoadFailure message="AI使用统计未返回，请重试" retryLabel="重试AI统计" onRetry={() => void fetchAiUsage()} />
            ) : aiData.summary.totalAiEvents === 0 ? (
              <EmptyState
                centered
                icon={BrainCircuit}
                title="当前范围暂无AI问答记录"
                description="接口读取成功；AI使用人数与事件数均为0，不等同于读取失败"
                className="min-h-64 rounded-md border border-white/[0.08] bg-white/[0.035]"
              />
            ) : <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                <div className="font-mono text-2xl font-semibold text-cyan-100">{aiData.summary.aiUsageRate}%</div>
                <div className="text-xs text-slate-400">AI 使用率</div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">{aiData.summary.totalAiUsers} 人使用 / 共提问 {aiData.summary.totalAiEvents} 次</div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                <div className="font-mono text-2xl font-semibold text-emerald-200">
                  {aiData.summary.avgAiUserScore === null ? 'N/A' : `${aiData.summary.avgAiUserScore}%`}
                </div>
                <div className="text-xs text-slate-400">AI 用户均分</div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                <div className="font-mono text-2xl font-semibold text-slate-300">
                  {aiData.summary.avgNonAiUserScore === null ? 'N/A' : `${aiData.summary.avgNonAiUserScore}%`}
                </div>
                <div className="text-xs text-slate-400">未使用 AI 均分</div>
              </div>
              <div className={`glass-hover transition-all rounded-md border p-4 text-center ${aiData.summary.scoreDifference !== null && aiData.summary.scoreDifference > 0 ? 'border-emerald-300/25 bg-emerald-300/[0.08]' : 'border-white/[0.08] bg-white/[0.035]'}`}>
                <div className={`font-mono text-2xl font-semibold ${aiData.summary.scoreDifference !== null && aiData.summary.scoreDifference > 0 ? 'text-emerald-200' : 'text-slate-300'}`}>
                  {aiData.summary.scoreDifference === null ? 'N/A' : `${aiData.summary.scoreDifference > 0 ? '+' : ''}${aiData.summary.scoreDifference}%`}
                </div>
                <div className="text-xs text-slate-400">两组均分差</div>
                {aiData.summary.scoreDifference === null && (
                  <div className="mt-1 font-mono text-[10px] text-slate-500">任一组缺少数据，无法计算</div>
                )}
              </div>
            </div>

            {/* Usage vs Score */}
            {aiData.usageVsScore.length > 0 && (
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">AI 使用次数 vs 平均成绩</h3>
                <p className="mb-3 text-xs text-slate-500">按使用次数分组的描述性结果；未控制基础水平、学习时长等因素。</p>
                <div className="space-y-2">
                  {aiData.usageVsScore.slice(0, 8).map((item) => {
                    const maxScore = Math.max(...aiData.usageVsScore.map((x) => x.avgScore), 1);
                    const width = (item.avgScore / maxScore) * 100;
                    return (
                      <div key={item.aiUsageCount} className="flex items-center gap-2">
                        <div className="w-16 text-right font-mono text-[11px] text-slate-400">{item.aiUsageCount}次</div>
                        <div className="flex-1">
                          <div className="h-5 rounded-full bg-black/30">
                            <div
                              className="flex h-full items-center rounded-full bg-gradient-to-r from-cyan-300 to-amber-300/60 px-2 text-[10px] font-mono text-cyan-100"
                              style={{ width: `${Math.max(width, 8)}%` }}
                            >
                              {item.avgScore}%
                            </div>
                          </div>
                        </div>
                        <div className="w-8 text-right font-mono text-[10px] text-slate-500">×{item.studentCount}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Students with AI records and multiple quiz attempts; correlation only. */}
            {aiData.topAiStudents.length > 0 && (
              <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">有AI记录学生的重复作答变化</h3>
                <p className="mb-3 text-xs text-slate-500">展示首次与最近一次测验记录；不能归因于AI使用。</p>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {aiData.topAiStudents.slice(0, 9).map((s) => (
                    <div key={s.name} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-200">{s.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          首次 {s.firstScore}% → 最近 {s.latestScore}% · AI {s.aiCount}次
                        </div>
                      </div>
                      <div className={`font-mono text-sm font-semibold ${s.gain > 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                        {s.gain > 0 ? '+' : ''}{s.gain}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>}
          </section>
        )}
      </div>
    </div>
  );
}
