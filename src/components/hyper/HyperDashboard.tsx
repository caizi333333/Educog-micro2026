'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CircuitBoard,
  Clock,
  Cpu,
  GitBranch,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Network,
  Play,
  RadioTower,
  Route,
  Shield,
  Sparkles,
  TerminalSquare,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { knowledgePoints } from '@/lib/knowledge-points';
import {
  EMPTY_ACHIEVEMENT_STATS,
  EMPTY_USER_STATS,
  buildHyperExperiments,
  buildKnowledgeSummary,
  fetchHyperJson,
  getContinueExperiment,
  getNextExperiment,
  normalizeAchievementStats,
  normalizeExperimentRecords,
  normalizeLearningProgress,
  normalizeUserStats,
  type HyperAchievementStats,
  type HyperExperimentCard,
  type HyperKnowledgeSummary,
  type HyperLearningProgressRecord,
  type HyperUserStats,
} from '@/lib/hyper-data';
import { cn } from '@/lib/utils';

interface HyperDashboardState {
  loading: boolean;
  experiments: HyperExperimentCard[];
  progress: HyperLearningProgressRecord[];
  achievementStats: HyperAchievementStats;
  userStats: HyperUserStats;
  teacherDashboard: Record<string, unknown> | null;
  failures: string[];
}

const initialExperiments = buildHyperExperiments(experimentCatalog, []);
const initialKnowledgeSummary = buildKnowledgeSummary(knowledgePoints, []);

function formatMinutes(value: number): string {
  if (!value) return '0 min';
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatDate(value: string | null): string {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无记录';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function stateTone(state: HyperExperimentCard['state']) {
  if (state === 'completed') return 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200';
  if (state === 'in-progress') return 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-200';
  return 'border-white/[0.09] bg-white/[0.035] text-slate-300';
}

function HeroVisual() {
  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-md border border-white/[0.08] bg-[#080d11]">
      <div className="absolute inset-0 circuit-grid opacity-80" />
      <svg viewBox="0 0 560 320" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hyper-chip" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#0b0f13" />
            <stop offset="1" stopColor="#171c22" />
          </linearGradient>
        </defs>
        <rect x="182" y="74" width="196" height="170" rx="6" fill="url(#hyper-chip)" stroke="#33404a" />
        <circle cx="206" cy="98" r="5" fill="none" stroke="#475569" />
        <text x="280" y="150" textAnchor="middle" fill="#e6faff" fontFamily="monospace" fontSize="22" fontWeight="700">AT89C52</text>
        <text x="280" y="174" textAnchor="middle" fill="#7dd3fc" fontFamily="monospace" fontSize="11">8051 HYPER WORKBENCH</text>
        <text x="280" y="194" textAnchor="middle" fill="#64748b" fontFamily="monospace" fontSize="10">11.0592 MHz · P0-P3 · SFR</text>
        {Array.from({ length: 10 }).map((_, i) => (
          <g key={i}>
            <rect x="154" y={92 + i * 14} width="28" height="7" fill={i < 4 ? '#06b6d4' : '#94a3b8'} opacity={i < 4 ? 1 : 0.55} />
            <rect x="378" y={92 + i * 14} width="28" height="7" fill={i % 3 === 0 ? '#f59e0b' : '#94a3b8'} opacity={i % 3 === 0 ? 1 : 0.55} />
          </g>
        ))}
        <path d="M406 103 C462 103 462 54 512 54" stroke="#06b6d4" strokeWidth="2" fill="none" />
        <path d="M406 131 C456 131 466 166 522 166" stroke="#f59e0b" strokeWidth="2" fill="none" strokeDasharray="5 5" />
        <path d="M154 117 C102 117 96 198 42 198" stroke="#10b981" strokeWidth="2" fill="none" />
        <rect x="416" y="34" width="104" height="42" rx="4" fill="#0a0d11" stroke="#164e63" />
        <polyline points="426,56 438,56 438,45 456,45 456,64 474,64 474,50 492,50 492,58 510,58" stroke="#22d3ee" fill="none" strokeWidth="1.6" />
        <rect x="26" y="178" width="96" height="42" rx="4" fill="#0a0d11" stroke="#14532d" />
        <text x="74" y="203" textAnchor="middle" fill="#34d399" fontFamily="monospace" fontSize="12">READY</text>
        <g transform="translate(402 236)">
          {Array.from({ length: 8 }).map((_, i) => (
            <circle key={i} cx={i * 15} cy="0" r="5" fill={i < 3 ? '#ef4444' : '#351515'} stroke="#7f1d1d" />
          ))}
        </g>
      </svg>
      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1.5 text-xs text-cyan-100">
        <Cpu className="h-3.5 w-3.5" />
        EDUCOG MICRO · HYPER
      </div>
      <div className="absolute bottom-5 left-5 right-5 grid grid-cols-3 gap-2 text-xs">
        {[
          ['P1', 'LED BUS'],
          ['T0', 'TIMER'],
          ['SFR', 'LIVE'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/[0.08] bg-black/35 px-3 py-2">
            <div className="font-mono text-slate-500">{label}</div>
            <div className="mt-1 font-semibold text-slate-100">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-4 w-4 text-cyan-200" />
        <span className="font-mono text-[11px] text-slate-500">{hint}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold text-slate-50">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-200" />
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ExperimentRow({ experiment }: { experiment: HyperExperimentCard }) {
  return (
    <Link
      href={experiment.href}
      className="group grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] md:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">{experiment.id.toUpperCase()}</span>
          <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', stateTone(experiment.state))}>{experiment.stateLabel}</span>
          <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[11px] text-slate-400">L{experiment.level}</span>
        </div>
        <div className="truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-100">{experiment.title}</div>
        <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{experiment.description}</div>
      </div>
      <div className="flex items-end justify-between gap-4 md:flex-col md:items-end">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {experiment.duration} min
        </div>
        <div className="flex items-center gap-2 text-xs text-cyan-200">
          进入仿真
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function ContinuePanel({ current, next }: { current: HyperExperimentCard | null; next: HyperExperimentCard | null }) {
  const target = current || next;
  return (
    <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.055] p-4">
      <SectionHeader icon={Play} title={current ? '继续上次实验' : '推荐开始实验'} />
      {target ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-cyan-200">{target.id.toUpperCase()}</span>
            <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', stateTone(target.state))}>{target.stateLabel}</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-50">{target.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{target.objectives[0] || target.description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <div className="text-xs text-slate-400">
              上次记录：<span className="text-slate-200">{formatDate(target.updatedAt)}</span>
            </div>
            <Link href={target.href} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              打开实验
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-sm text-slate-400">
          暂无可继续实验。实验配置仍可从下方课程实验列表进入。
        </div>
      )}
    </div>
  );
}

function KnowledgePanel({ summary }: { summary: HyperKnowledgeSummary }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
      <SectionHeader
        icon={Network}
        title="知识图谱摘要"
        action={
          <Link href="/knowledge-graph" className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100">
            打开图谱 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="font-mono text-2xl font-semibold text-slate-50">{summary.total}</div>
          <div className="text-xs text-slate-400">知识点</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold text-slate-50">{summary.averageProgress}%</div>
          <div className="text-xs text-slate-400">平均进度</div>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs text-slate-400">
        <div className="flex justify-between"><span>一级 / 二级 / 三级</span><span className="text-slate-200">{summary.levelOne} / {summary.levelTwo} / {summary.levelThree}</span></div>
        <div className="flex justify-between"><span>章节覆盖</span><span className="text-slate-200">{summary.completedChapters} / {summary.chapters}</span></div>
        <div className="flex justify-between"><span>累计学习</span><span className="text-slate-200">{formatMinutes(summary.totalTimeSpent)}</span></div>
      </div>
    </div>
  );
}

function AchievementPanel({ stats }: { stats: HyperAchievementStats }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
      <SectionHeader
        icon={Award}
        title="成就与勋章"
        action={
          <Link href="/achievements" className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100">
            查看全部 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-semibold text-slate-50">{stats.unlockedAchievements}/{stats.totalAchievements}</div>
          <div className="text-xs text-slate-400">已解锁</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold text-amber-200">{stats.totalPoints}</div>
          <div className="text-xs text-slate-400">积分</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-sm bg-white/[0.08]">
        <div className="h-full bg-amber-300" style={{ width: `${stats.completionRate}%` }} />
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-400">
        最新：{stats.latestAchievement ? stats.latestAchievement.name : '暂无解锁记录'}
      </div>
    </div>
  );
}

export function HyperDashboard() {
  const { user } = useAuth();
  const [state, setState] = useState<HyperDashboardState>({
    loading: true,
    experiments: initialExperiments,
    progress: [],
    achievementStats: EMPTY_ACHIEVEMENT_STATS,
    userStats: EMPTY_USER_STATS,
    teacherDashboard: null,
    failures: [],
  });

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setState((prev) => ({ ...prev, loading: false, failures: ['未检测到登录令牌'] }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true }));

      const shouldLoadTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';
      const [experimentsResult, progressResult, userStatsResult, achievementsResult, teacherResult] = await Promise.all([
        fetchHyperJson<unknown>('/api/experiments/save', token),
        fetchHyperJson<unknown>('/api/learning-progress', token),
        fetchHyperJson<unknown>('/api/user/stats', token),
        fetchHyperJson<unknown>('/api/achievements', token),
        shouldLoadTeacher ? fetchHyperJson<Record<string, unknown>>('/api/teacher/dashboard', token) : Promise.resolve({ ok: true, data: null }),
      ]);

      if (!active) return;

      const failures = [
        !experimentsResult.ok ? '实验记录' : null,
        !progressResult.ok ? '学习进度' : null,
        !userStatsResult.ok ? '用户统计' : null,
        !achievementsResult.ok ? '成就数据' : null,
        !teacherResult.ok ? '教师数据' : null,
      ].filter((item): item is string => Boolean(item));

      const experimentRecords = normalizeExperimentRecords(experimentsResult.data);
      const progress = normalizeLearningProgress(progressResult.data);

      setState({
        loading: false,
        experiments: buildHyperExperiments(experimentCatalog, experimentRecords),
        progress,
        achievementStats: normalizeAchievementStats(achievementsResult.data),
        userStats: normalizeUserStats(userStatsResult.data),
        teacherDashboard: teacherResult.data,
        failures,
      });
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [user?.role]);

  const knowledgeSummary = useMemo(() => buildKnowledgeSummary(knowledgePoints, state.progress), [state.progress]);
  const continueExperiment = useMemo(() => getContinueExperiment(state.experiments), [state.experiments]);
  const nextExperiment = useMemo(() => getNextExperiment(state.experiments), [state.experiments]);
  const completedCount = state.experiments.filter((item) => item.state === 'completed').length;
  const inProgressCount = state.experiments.filter((item) => item.state === 'in-progress').length;
  const featuredExperiments = state.experiments
    .filter((item) => item.state !== 'completed')
    .slice(0, 5);

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
              <Sparkles className="h-4 w-4 text-cyan-100" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-50">EduCog Hyper 工作台</h1>
              <p className="text-xs text-slate-400">课程、实验、图谱、成就和教学数据的统一入口</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.loading && (
              <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs text-cyan-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                同步数据
              </span>
            )}
            <Link href="/simulation" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <TerminalSquare className="h-4 w-4" />
              仿真器
            </Link>
            <Link href="/ai-assistant" className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              <RadioTower className="h-4 w-4" />
              AI 助教
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1500px] px-4 py-5 md:px-6">
        {state.failures.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-sm text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>以下数据暂未同步：{state.failures.join('、')}。页面已降级为本地课程配置和空状态。</span>
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <HeroVisual />
          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile icon={CheckCircle2} label="已完成实验" value={`${completedCount}/${state.experiments.length}`} hint="LAB" />
            <StatTile icon={Activity} label="进行中实验" value={`${inProgressCount}`} hint="RUN" />
            <StatTile icon={BookOpen} label="完成模块" value={`${state.userStats.modulesCompleted}`} hint="LEARN" />
            <StatTile icon={Trophy} label="连续学习" value={`${state.userStats.dailyStreak} 天`} hint="STREAK" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr_0.75fr]">
          <ContinuePanel current={continueExperiment} next={nextExperiment} />

          <div className="rounded-md border border-white/[0.08] bg-white/[0.025] p-4">
            <SectionHeader
              icon={LayoutGrid}
              title="课程实验"
              action={<span className="font-mono text-[11px] text-slate-500">{state.experiments.length} ITEMS</span>}
            />
            <div className="space-y-2">
              {featuredExperiments.length > 0 ? (
                featuredExperiments.map((experiment) => <ExperimentRow key={experiment.id} experiment={experiment} />)
              ) : (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-sm text-slate-400">
                  当前没有待推进实验。
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <KnowledgePanel summary={knowledgeSummary} />
            <AchievementPanel stats={state.achievementStats} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {[
            { href: '/', icon: BookOpen, title: '课程内容', desc: '章节正文、重点难点、代码示例' },
            { href: '/learning-path', icon: Route, title: '个性教学', desc: '学习路径、推荐模块、进度保存' },
            { href: '/analytics', icon: BarChart3, title: '学情分析', desc: '测验、实验和学习行为概览' },
            { href: '/knowledge-graph', icon: GitBranch, title: '知识图谱', desc: '节点、依赖关系和掌握度' },
            { href: '/quiz', icon: GraduationCap, title: '在线测评', desc: '练习、提交和成绩记录' },
            {
              href: user?.role === 'TEACHER' || user?.role === 'ADMIN' ? '/teacher' : '/profile',
              icon: user?.role === 'TEACHER' || user?.role === 'ADMIN' ? Shield : Cpu,
              title: user?.role === 'TEACHER' || user?.role === 'ADMIN' ? '教师数据' : '个人主页',
              desc: user?.role === 'TEACHER' || user?.role === 'ADMIN'
                ? state.teacherDashboard ? '已接入教师仪表板数据' : '教师接口暂未返回数据'
                : '资料、成就和学习记录',
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-md border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]"
            >
              <div className="flex items-start justify-between gap-3">
                <item.icon className="h-5 w-5 text-cyan-200" />
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
              </div>
              <div className="mt-4 font-semibold text-slate-100">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">{item.desc}</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
