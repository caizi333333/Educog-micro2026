'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  Loader2,
  Medal,
  Search,
  Shield,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import { cn } from '@/lib/utils';

interface TeacherStudent {
  id?: string;
  name: string;
  studentId?: string | null;
  class?: string | null;
  avgQuizScore?: number;
  chapterMastery?: Record<string, number>;
}

interface TeacherDashboard {
  students?: TeacherStudent[];
}

function heatColor(value: number) {
  if (value >= 80) return 'border-emerald-300/25 bg-emerald-300/[0.16] text-emerald-100';
  if (value >= 60) return 'border-amber-300/25 bg-amber-300/[0.14] text-amber-100';
  return 'border-red-300/25 bg-red-300/[0.12] text-red-100';
}

export function HyperAnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const { loading, profile, achievements, calculateKnowledgeMastery, calculateLearningStats } = useAnalytics();
  const [teacherData, setTeacherData] = useState<TeacherDashboard | null>(null);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [gainsData, setGainsData] = useState<{
    scoreDistribution: { label: string; count: number }[];
    scoreSummary: { avg: number; total: number };
    experimentCorrelation: { experimentsCompleted: number; avgScore: number; studentCount: number }[];
    timeCorrelation: { timeRange: string; avgScore: number; studentCount: number }[];
    prePostComparison: { name: string; firstScore: number; latestScore: number; gain: number }[];
    chapterMasteryAvg: { chapter: string; avgMastery: number }[];
  } | null>(null);
  const [aiData, setAiData] = useState<{
    summary: {
      totalAiUsers: number; totalAiEvents: number; avgAiPerUser: number;
      avgAiUserScore: number; avgNonAiUserScore: number;
      aiUsageRate: number; scoreDifference: number;
    };
    usageVsScore: { aiUsageCount: number; avgScore: number; studentCount: number }[];
    weeklyUsage: { week: string; aiEvents: number; activeUsers: number }[];
    topAiStudents: { name: string; aiCount: number; firstScore: number; latestScore: number; gain: number }[];
  } | null>(null);

  const knowledgeMastery = calculateKnowledgeMastery();
  const learningStats = calculateLearningStats();
  const avgMastery = knowledgeMastery.length
    ? Math.round(knowledgeMastery.reduce((sum, item) => sum + item.mastery, 0) / knowledgeMastery.length)
    : 0;

  useEffect(() => {
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;

    async function fetchTeacherDashboard() {
      try {
        setTeacherError(null);
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/teacher/dashboard', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error('无法读取班级排行数据');
        setTeacherData(await response.json());
      } catch (error) {
        setTeacherError(error instanceof Error ? error.message : '无法读取班级排行数据');
      }
    }

    fetchTeacherDashboard();
  }, [user]);

  // Fetch learning gains data (teacher/admin only)
  const fetchGains = useCallback(async () => {
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch('/api/analytics/learning-gains', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setGainsData(await res.json());
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchGains(); }, [fetchGains]);

  // Fetch AI usage data (teacher/admin only)
  const fetchAiUsage = useCallback(async () => {
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch('/api/analytics/ai-usage', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAiData(await res.json());
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchAiUsage(); }, [fetchAiUsage]);

  const rankedStudents = useMemo(() => {
    const students = teacherData?.students || [];
    const q = query.trim().toLowerCase();
    return students
      .map((student) => ({
        ...student,
        score: Math.round(student.avgQuizScore || 0),
      }))
      .filter((student) => !q || `${student.name} ${student.studentId || ''} ${student.class || ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.score - a.score);
  }, [query, teacherData?.students]);

  if (authLoading || loading) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Shield className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">请先登录以查看学情分析。</p>
          <Link href="/login" className="mt-4 inline-flex rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#001014]">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <BarChart3 className="h-3.5 w-3.5" />
              Learning Analytics · 学情分析
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">学情分析工作台</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              汇总真实测评、知识掌握度、成就和教师班级数据；接口暂无数据时只显示空状态。
            </p>
          </div>
          {teacherError && (
            <div className="flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">
              <AlertCircle className="h-4 w-4" />
              {teacherError}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        <section className="mb-6 grid gap-3 md:grid-cols-4">
          {[
            ['累计学习', `${Math.round((profile?.stats?.totalLearningTime || 0) / 3600)}h`, BrainCircuit],
            ['平均测验', `${Math.round(learningStats.averageScore || 0)}%`, ClipboardCheck],
            ['知识掌握', `${avgMastery}%`, BarChart3],
            ['获得成就', `${achievements.stats?.unlockedAchievements || 0}/${achievements.stats?.totalAchievements || 0}`, Trophy],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <Icon className="h-4 w-4 text-cyan-200" />
              <div className="mt-3 font-mono text-2xl font-semibold text-slate-50">{value as string}</div>
              <div className="text-xs text-slate-400">{label as string}</div>
            </div>
          ))}
        </section>

        <main className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-5">
              <h2 className="text-lg font-semibold text-slate-50">知识点掌握度</h2>
              <p className="mt-1 text-xs text-slate-500">来自现有学情 hook 的知识掌握度计算结果。</p>
            </div>
            <div className="p-5">
              {knowledgeMastery.length ? (
                <div className="space-y-4">
                  {knowledgeMastery.map((item) => (
                    <div key={item.topic} className="rounded-md border border-white/[0.08] bg-black/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">{item.topic}</div>
                        <div className="font-mono text-sm text-cyan-100">{Math.round(item.mastery)}%</div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {Object.entries(item.details).map(([detail, score]) => (
                          <div
                            key={detail}
                            className={cn('rounded-md border px-3 py-2 text-xs', heatColor(Number(score) || 0))}
                          >
                            <div className="line-clamp-1">{detail}</div>
                            <div className="mt-1 font-mono text-[11px] opacity-80">{Number(score) || 0}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center text-sm text-slate-500">
                  <BrainCircuit className="mb-3 h-8 w-8" />
                  暂无知识点掌握度数据
                </div>
              )}
            </div>
          </section>

          <section className="rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">班级排行榜</h2>
                  <p className="mt-1 text-xs text-slate-500">教师/管理员账号读取 `/api/teacher/dashboard`。</p>
                </div>
                <Medal className="h-5 w-5 text-amber-200" />
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索学生..."
                  className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
                />
              </div>
            </div>

            <div className="p-5">
              {rankedStudents.length ? (
                <div className="space-y-2">
                  {rankedStudents.slice(0, 10).map((student, index) => (
                    <div key={student.id || student.studentId || student.name} className="grid grid-cols-[42px_1fr_70px] items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className={cn('font-mono text-lg font-semibold', index < 3 ? 'text-amber-200' : 'text-slate-500')}>#{index + 1}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{student.name}</div>
                        <div className="truncate font-mono text-[10px] text-slate-500">{student.studentId || student.class || '未登记学号'}</div>
                      </div>
                      <div className="text-right font-mono text-lg font-semibold text-cyan-100">{student.score}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center text-center text-sm text-slate-500">
                  <Award className="mb-3 h-8 w-8" />
                  暂无可展示的班级排行数据
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Teaching Effectiveness Section */}
        {gainsData && (user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
          <section className="mt-6 space-y-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-slate-50">教学效果分析</h2>
              <span className="text-xs text-slate-500">基于 {gainsData.scoreSummary.total} 名学生的真实数据</span>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Score Distribution */}
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
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
                          <div className="h-5 rounded-sm bg-black/30">
                            <div
                              className="flex h-full items-center rounded-sm bg-cyan-300/20 px-2 text-[10px] font-mono text-cyan-100"
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
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">实验完成数 vs 成绩</h3>
                <p className="mb-3 text-xs text-slate-500">完成实验越多，测验成绩越高？</p>
                {gainsData.experimentCorrelation.length > 0 ? (
                  <div className="space-y-2">
                    {gainsData.experimentCorrelation.slice(0, 6).map((item) => {
                      const maxScore = Math.max(...gainsData.experimentCorrelation.map((x) => x.avgScore), 1);
                      const width = (item.avgScore / maxScore) * 100;
                      return (
                        <div key={item.experimentsCompleted} className="flex items-center gap-2">
                          <div className="w-16 text-right font-mono text-[11px] text-slate-400">{item.experimentsCompleted}个</div>
                          <div className="flex-1">
                            <div className="h-5 rounded-sm bg-black/30">
                              <div
                                className="flex h-full items-center rounded-sm bg-emerald-300/20 px-2 text-[10px] font-mono text-emerald-100"
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
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">学习时长 vs 成绩</h3>
                <p className="mb-3 text-xs text-slate-500">投入时间越多，成绩越好？</p>
                {gainsData.timeCorrelation.length > 0 ? (
                  <div className="space-y-2">
                    {gainsData.timeCorrelation.map((item) => {
                      const maxScore = Math.max(...gainsData.timeCorrelation.map((x) => x.avgScore), 1);
                      const width = (item.avgScore / maxScore) * 100;
                      return (
                        <div key={item.timeRange} className="flex items-center gap-2">
                          <div className="w-12 text-right font-mono text-[11px] text-slate-400">{item.timeRange}</div>
                          <div className="flex-1">
                            <div className="h-5 rounded-sm bg-black/30">
                              <div
                                className="flex h-full items-center rounded-sm bg-amber-300/20 px-2 text-[10px] font-mono text-amber-100"
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

            {/* Pre/Post Quiz Comparison */}
            {gainsData.prePostComparison.length > 0 && (
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">前后测验对比</h3>
                <p className="mb-3 text-xs text-slate-500">多次测验学生的成绩变化（按进步幅度排序）</p>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {gainsData.prePostComparison.slice(0, 12).map((item) => (
                    <div key={item.name} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-200">{item.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {item.firstScore}% → {item.latestScore}%
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
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
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
          </section>
        )}

        {/* AI Usage Effectiveness */}
        {aiData && (user?.role === 'TEACHER' || user?.role === 'ADMIN') && (
          <section className="mt-6 space-y-6">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-slate-50">AI 辅学效果分析</h2>
              <span className="text-xs text-slate-500">AI 助教使用与成绩提升的量化分析</span>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                <div className="font-mono text-2xl font-semibold text-cyan-100">{aiData.summary.aiUsageRate}%</div>
                <div className="text-xs text-slate-400">AI 使用率</div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">{aiData.summary.totalAiUsers} 人使用 / 共提问 {aiData.summary.totalAiEvents} 次</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                <div className="font-mono text-2xl font-semibold text-emerald-200">{aiData.summary.avgAiUserScore}%</div>
                <div className="text-xs text-slate-400">AI 用户均分</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center">
                <div className="font-mono text-2xl font-semibold text-slate-300">{aiData.summary.avgNonAiUserScore}%</div>
                <div className="text-xs text-slate-400">未使用 AI 均分</div>
              </div>
              <div className={`rounded-md border p-4 text-center ${aiData.summary.scoreDifference > 0 ? 'border-emerald-300/25 bg-emerald-300/[0.08]' : 'border-white/[0.08] bg-white/[0.035]'}`}>
                <div className={`font-mono text-2xl font-semibold ${aiData.summary.scoreDifference > 0 ? 'text-emerald-200' : 'text-slate-300'}`}>
                  {aiData.summary.scoreDifference > 0 ? '+' : ''}{aiData.summary.scoreDifference}%
                </div>
                <div className="text-xs text-slate-400">AI 辅学提升幅度</div>
              </div>
            </div>

            {/* Usage vs Score */}
            {aiData.usageVsScore.length > 0 && (
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">AI 使用次数 vs 平均成绩</h3>
                <p className="mb-3 text-xs text-slate-500">使用 AI 助教越多，测验成绩是否越高？</p>
                <div className="space-y-2">
                  {aiData.usageVsScore.slice(0, 8).map((item) => {
                    const maxScore = Math.max(...aiData.usageVsScore.map((x) => x.avgScore), 1);
                    const width = (item.avgScore / maxScore) * 100;
                    return (
                      <div key={item.aiUsageCount} className="flex items-center gap-2">
                        <div className="w-16 text-right font-mono text-[11px] text-slate-400">{item.aiUsageCount}次</div>
                        <div className="flex-1">
                          <div className="h-5 rounded-sm bg-black/30">
                            <div
                              className="flex h-full items-center rounded-sm bg-cyan-300/20 px-2 text-[10px] font-mono text-cyan-100"
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

            {/* Top AI-assisted improvers */}
            {aiData.topAiStudents.length > 0 && (
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">AI 辅学进步显著学生</h3>
                <p className="mb-3 text-xs text-slate-500">使用 AI 助教后成绩提升最多的学生</p>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {aiData.topAiStudents.slice(0, 9).map((s) => (
                    <div key={s.name} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-slate-200">{s.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {s.firstScore}% → {s.latestScore}% · AI {s.aiCount}次
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
          </section>
        )}
      </div>
    </div>
  );
}
