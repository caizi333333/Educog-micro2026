'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <BarChart3 className="h-3.5 w-3.5" />
              Learning Analytics · 学情分析
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">学情分析工作台</h1>
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
      </div>
    </div>
  );
}
