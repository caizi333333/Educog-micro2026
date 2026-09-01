'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  Activity,
  AlertCircle,
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
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { experiments as staticExperimentCatalog, type ExperimentConfig } from '@/lib/experiment-config';
import { knowledgePoints as staticKnowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';
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
  type HyperExperimentRecord,
  type HyperKnowledgeSummary,
  type HyperLearningProgressRecord,
  type HyperUserStats,
} from '@/lib/hyper-data';
import { cn } from '@/lib/utils';
import type { DataProvenance } from '@/lib/env';
import { WelcomeOnboarding } from '@/components/onboarding/NextStepBanner';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBanner } from '@/components/shared/StatusBanner';

type HyperDataSource = 'experimentRecords' | 'learningProgress' | 'userStats' | 'achievements' | 'teacherDashboard';
type HyperSourceStatus = 'idle' | 'loading' | 'success' | 'error';

interface HyperSourceState {
  status: HyperSourceStatus;
  hasResolved: boolean;
  message: string | null;
}

interface HyperDashboardState {
  experimentRecords: HyperExperimentRecord[];
  progress: HyperLearningProgressRecord[];
  achievementStats: HyperAchievementStats;
  userStats: HyperUserStats;
  teacherDashboard: Record<string, unknown> | null;
  dataProvenance: DataProvenance | null;
  asOf: string | null;
  sources: Record<HyperDataSource, HyperSourceState>;
  accessErrorStatus: 401 | 403 | null;
}

interface EducatorOverview {
  totalStudents: number;
  activeToday: number;
  averageQuiz: number | null;
  averageExperimentCompletion: number | null;
  provenanceLabel: string;
  provenanceNote: string;
}

const initialKnowledgeSummary = buildKnowledgeSummary(staticKnowledgePoints, []);

const sourceLabels: Record<HyperDataSource, string> = {
  experimentRecords: '实验记录',
  learningProgress: '学习进度',
  userStats: '用户统计',
  achievements: '成就数据',
  teacherDashboard: '教师数据',
};

const sourceEndpoints: Record<HyperDataSource, string> = {
  experimentRecords: '/api/experiments/save',
  learningProgress: '/api/learning-progress',
  userStats: '/api/user/stats',
  achievements: '/api/achievements',
  teacherDashboard: '/api/teacher/dashboard',
};

const studentSources: HyperDataSource[] = ['experimentRecords', 'learningProgress', 'userStats', 'achievements'];
const educatorSources: HyperDataSource[] = ['teacherDashboard'];

function createSourceState(): Record<HyperDataSource, HyperSourceState> {
  return {
    experimentRecords: { status: 'idle', hasResolved: false, message: null },
    learningProgress: { status: 'idle', hasResolved: false, message: null },
    userStats: { status: 'idle', hasResolved: false, message: null },
    achievements: { status: 'idle', hasResolved: false, message: null },
    teacherDashboard: { status: 'idle', hasResolved: false, message: null },
  };
}

function createDashboardState(): HyperDashboardState {
  return {
    experimentRecords: [],
    progress: [],
    achievementStats: { ...EMPTY_ACHIEVEMENT_STATS },
    userStats: { ...EMPTY_USER_STATS },
    teacherDashboard: null,
    dataProvenance: null,
    asOf: null,
    sources: createSourceState(),
    accessErrorStatus: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function readStudentProvenance(value: unknown): { dataProvenance: DataProvenance; asOf: string | null } | null {
  if (!isRecord(value) || !isRecord(value.dataProvenance)) return null;
  const provenance = value.dataProvenance;
  if (!['DEMO', 'REAL', 'MIXED'].includes(String(provenance.mode))
    || typeof provenance.label !== 'string' || !provenance.label.trim()
    || typeof provenance.note !== 'string' || !provenance.note.trim()) return null;
  const asOf = typeof value.asOf === 'string' && Number.isFinite(Date.parse(value.asOf)) ? value.asOf : null;
  return {
    dataProvenance: {
      mode: provenance.mode as DataProvenance['mode'],
      label: provenance.label,
      note: provenance.note,
    },
    asOf,
  };
}

function isValidSourcePayload(source: HyperDataSource, value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (source === 'experimentRecords') {
    return value.success === true
      && Array.isArray(value.experiments)
      && value.experiments.every((item) => isRecord(item) && typeof item.experimentId === 'string');
  }
  if (source === 'learningProgress') {
    return value.success === true
      && Array.isArray(value.progress)
      && value.progress.every((item) => isRecord(item)
        && typeof item.moduleId === 'string'
        && isNonNegativeNumber(item.progress)
        && isNonNegativeNumber(item.timeSpent));
  }
  if (source === 'userStats') {
    const stats = value.stats;
    return isRecord(stats)
      && ['modules_completed', 'experiments_completed', 'daily_streak', 'code_runs']
        .every((key) => isNonNegativeNumber(stats[key]));
  }
  if (source === 'achievements') {
    const stats = value.stats;
    return isRecord(stats)
      && Array.isArray(value.achievements)
      && ['totalAchievements', 'unlockedAchievements', 'completionRate', 'totalPoints']
        .every((key) => isNonNegativeNumber(stats[key]));
  }
  return normalizeEducatorOverview(value) !== null;
}

function normalizeEducatorOverview(value: Record<string, unknown> | null): EducatorOverview | null {
  if (!value) return null;
  const overview = value.overview;
  const students = Array.isArray(value.students) ? value.students : [];
  if (!overview || typeof overview !== 'object' || Array.isArray(overview)) return null;
  const rawOverview = overview as Record<string, unknown>;
  const totalStudents = Number(rawOverview.totalStudents);
  const activeToday = Number(rawOverview.activeToday);
  if (!Number.isFinite(totalStudents) || !Number.isFinite(activeToday)) return null;
  const hasQuizEvidence = students.some((student) => student && typeof student === 'object'
    && Number((student as Record<string, unknown>).quizAttemptCount) > 0);
  const hasExperimentEvidence = students.some((student) => student && typeof student === 'object'
    && Number((student as Record<string, unknown>).experimentsTotal) > 0);
  const provenance = value.dataProvenance && typeof value.dataProvenance === 'object' && !Array.isArray(value.dataProvenance)
    ? value.dataProvenance as Record<string, unknown>
    : {};
  return {
    totalStudents: Math.max(0, Math.round(totalStudents)),
    activeToday: Math.max(0, Math.round(activeToday)),
    averageQuiz: hasQuizEvidence && Number.isFinite(Number(rawOverview.avgQuizScore))
      ? Math.round(Number(rawOverview.avgQuizScore))
      : null,
    averageExperimentCompletion: hasExperimentEvidence && Number.isFinite(Number(rawOverview.avgExpCompletion))
      ? Math.round(Number(rawOverview.avgExpCompletion))
      : null,
    provenanceLabel: typeof provenance.label === 'string' ? provenance.label : '数据身份待核实',
    provenanceNote: typeof provenance.note === 'string' ? provenance.note : '服务端未返回数据身份说明。',
  };
}

function formatSecondsAsHours(value: number): string {
  if (!value) return '0 min';
  const totalMinutes = Math.round(value / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
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
    <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="chip-mark flex h-7 w-7 items-center justify-center rounded-md">
          <Icon className="h-3.5 w-3.5 text-cyan-100" />
        </div>
        <span className="font-mono text-[11px] text-slate-500">{hint}</span>
      </div>
      <div className="mt-4 text-2xl font-semibold text-slate-50 stat-glow">{value}</div>
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

function ExperimentRow({
  experiment,
  recordsAvailable,
}: {
  experiment: HyperExperimentCard;
  recordsAvailable: boolean;
}) {
  return (
    <Link
      href={experiment.href}
      className="group grid gap-3 rounded-md border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] md:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-slate-500">{experiment.id.toUpperCase()}</span>
          {recordsAvailable ? (
            <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', stateTone(experiment.state))}>{experiment.stateLabel}</span>
          ) : (
            <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-0.5 text-[11px] text-amber-100">状态待读取</span>
          )}
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

function ContinuePanel({
  current,
  next,
  recordsAvailable,
}: {
  current: HyperExperimentCard | null;
  next: HyperExperimentCard | null;
  recordsAvailable: boolean;
}) {
  const target = current || next;
  return (
    <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.055] p-4">
      <SectionHeader
        icon={Play}
        title={recordsAvailable ? (current ? '继续上次实验' : '推荐开始实验') : '课程实验入口'}
      />
      {target ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-cyan-200">{target.id.toUpperCase()}</span>
            {recordsAvailable ? (
              <span className={cn('rounded-md border px-2 py-0.5 text-[11px]', stateTone(target.state))}>{target.stateLabel}</span>
            ) : (
              <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-0.5 text-[11px] text-amber-100">状态待读取</span>
            )}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-50">{target.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{target.objectives[0] || target.description}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
            <div className="text-xs text-slate-400">
              {recordsAvailable ? '上次记录：' : '进度记录：'}
              <span className="text-slate-200">
                {recordsAvailable ? formatDate(target.updatedAt) : '读取失败，当前仅提供实验入口'}
              </span>
            </div>
            <Link href={target.href} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
              打开实验
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState title="暂无可继续实验" description="实验配置仍可从下方课程实验列表进入。" />
      )}
    </div>
  );
}

function LearningLoopPanel(): React.JSX.Element {
  const stages = [
    { label: '接收任务', detail: '确认目标与完成条件', Icon: Route },
    { label: '图谱定位', detail: '找到知识节点与关系', Icon: Network },
    { label: '专项测评', detail: '提交后生成服务端诊断', Icon: GraduationCap },
    { label: '薄弱补学', detail: '逐项核对薄弱知识原子', Icon: Target },
    { label: '仿真实践', detail: '用实验验证理解', Icon: CircuitBoard },
    { label: '再次测评', detail: '回到任务查看完成回执', Icon: CheckCircle2 },
  ];

  return (
    <section
      aria-labelledby="student-learning-loop-title"
      className="relative mb-4 overflow-hidden rounded-md border border-cyan-300/20 bg-[#0a1218] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:p-5"
    >
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-30" aria-hidden="true" />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">Student learning loop</div>
          <h2 id="student-learning-loop-title" className="mt-2 text-lg font-semibold text-slate-50">从任务开始，按证据完成每一步</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            平台会保留测评、补学和实验回执；AI仅提供解释，完成状态与成绩仍以服务端记录为准。
          </p>
        </div>
        <Link
          href="/tasks"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
        >
          查看我的学习任务
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <ol className="relative mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        {stages.map((stage, index) => (
          <li key={stage.label} className="group relative min-w-0 rounded-md border border-white/[0.08] bg-black/20 p-3 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04]">
            {index < stages.length - 1 && (
              <span className="absolute -right-2.5 top-6 z-10 hidden h-px w-5 bg-cyan-300/25 xl:block" aria-hidden="true" />
            )}
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08]">
                <stage.Icon className="h-3.5 w-3.5 text-cyan-100" aria-hidden="true" />
              </span>
              <span className="font-mono text-[10px] text-cyan-300/70">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="mt-3 text-sm font-medium text-slate-100">{stage.label}</div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">{stage.detail}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function KnowledgePanel({ summary, progressAvailable }: { summary: HyperKnowledgeSummary; progressAvailable: boolean }) {
  return (
    <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
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
          <div className="font-mono text-2xl font-semibold text-slate-50 stat-glow">{summary.total}</div>
          <div className="text-xs text-slate-400">知识点</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-semibold text-slate-50 stat-glow">
            {progressAvailable ? `${summary.averageProgress}%` : '—'}
          </div>
          <div className="text-xs text-slate-400">平均进度</div>
        </div>
      </div>
      <div className="mt-4 space-y-2 text-xs text-slate-400">
        <div className="flex justify-between"><span>一级 / 二级 / 三级</span><span className="text-slate-200">{summary.levelOne} / {summary.levelTwo} / {summary.levelThree}</span></div>
        <div className="flex justify-between"><span>章节覆盖</span><span className="text-slate-200">{progressAvailable ? summary.completedChapters : '—'} / {summary.chapters}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500" style={{ width: `${progressAvailable && summary.chapters > 0 ? (summary.completedChapters / summary.chapters) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between"><span>累计学习</span><span className="text-slate-200">{progressAvailable ? formatSecondsAsHours(summary.totalTimeSpent) : '读取失败'}</span></div>
      </div>
    </div>
  );
}

function AchievementPanel({
  stats,
  available,
  loading,
  onRetry,
}: {
  stats: HyperAchievementStats;
  available: boolean;
  loading: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition-all">
      <SectionHeader
        icon={Award}
        title="成就与勋章"
        action={
          <Link href="/achievements" className="inline-flex items-center gap-1 text-xs text-cyan-200 hover:text-cyan-100">
            查看全部 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      {!available ? (
        <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3">
          <div className="text-sm font-medium text-amber-100">成就记录读取失败</div>
          <div className="mt-1 text-xs leading-5 text-slate-400">当前不能确认已解锁数量和积分，未将失败结果显示为 0。</div>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="mt-3 inline-flex min-h-9 items-center rounded-md border border-amber-200/25 px-3 text-xs font-medium text-amber-100 hover:bg-amber-200/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            {loading ? '正在读取…' : '重新读取成就数据'}
          </button>
        </div>
      ) : <><div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-semibold text-slate-50 stat-glow">{stats.unlockedAchievements}/{stats.totalAchievements}</div>
          <div className="text-xs text-slate-400">已解锁</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold text-amber-200 stat-glow-amber">{stats.totalPoints}</div>
          <div className="text-xs text-slate-400">积分</div>
        </div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-amber-300 transition-all duration-500" style={{ width: `${stats.completionRate}%` }} />
      </div>
      <div className="mt-3 text-xs leading-5 text-slate-400">
        最新：{stats.latestAchievement ? stats.latestAchievement.name : '暂无解锁记录'}
      </div>
      </>}
    </div>
  );
}

function EducatorHyperDashboard({
  loading,
  failed,
  overview,
  onRetry,
}: {
  loading: boolean;
  failed: boolean;
  overview: EducatorOverview | null;
  onRetry: () => void;
}) {
  const shortcuts = [
    { href: '/teacher', icon: Shield, title: '教学仪表板', desc: '布置任务、查看学生并执行补充干预' },
    { href: '/teacher/pushed', icon: Route, title: '任务回查', desc: '核对任务批次、学生步骤和实验结果' },
    { href: '/teacher/classes', icon: GraduationCap, title: '班级管理', desc: '管理班级范围、邀请码和学生名单' },
    { href: '/obe/teacher', icon: Trophy, title: '达成度看板', desc: '按班级与学期复核当前版本结果' },
    { href: '/analytics', icon: BarChart3, title: '学情分析', desc: '查看过程指标、数据身份和证据边界' },
    { href: '/knowledge-graph', icon: GitBranch, title: '知识图谱', desc: '核对课程节点、问题诊断和育人主题' },
  ];

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 animate-fade-in sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
              <Shield className="h-4 w-4 text-cyan-100" />
            </div>
            <div>
              <h1 id="educator-dashboard-title" className="text-lg font-semibold text-slate-50">教学总览工作台</h1>
              <p className="text-xs text-slate-400">班级、任务、学情与达成度的教师入口</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loading && (
              <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs text-cyan-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在同步教师数据
              </span>
            )}
            <Link href="/teacher" className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              <LayoutGrid className="h-4 w-4" /> 进入教学仪表板
            </Link>
          </div>
        </div>
      </div>

      <section aria-labelledby="educator-dashboard-title" className="mx-auto max-w-[1400px] px-4 py-5 md:px-6">
        {failed && (
          <StatusBanner variant="warning" className="mb-4">
            <span>教师数据暂未同步，当前不展示推测值。</span>
            <button type="button" onClick={onRetry} disabled={loading} className="ml-3 min-h-9 rounded-md px-2 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-50">
              {loading ? '正在读取…' : '重新读取教师数据'}
            </button>
          </StatusBanner>
        )}
        {overview && (
          <div role="note" className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
            <div className="text-sm font-medium text-amber-100">{overview.provenanceLabel}</div>
            <p className="mt-1 text-xs leading-5 text-slate-400">{overview.provenanceNote}</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={GraduationCap} label="可管理学生" value={overview ? String(overview.totalStudents) : '—'} hint="STUDENTS" />
          <StatTile icon={Activity} label="近24小时活跃" value={overview ? String(overview.activeToday) : '—'} hint="ACTIVE" />
          <StatTile icon={BarChart3} label="有记录学生测验均分" value={overview?.averageQuiz == null ? '—' : `${overview.averageQuiz}%`} hint="QUIZ" />
          <StatTile icon={CheckCircle2} label="有记录实验完成率" value={overview?.averageExperimentCompletion == null ? '—' : `${overview.averageExperimentCompletion}%`} hint="LAB" />
        </div>
        {!loading && !overview && !failed && (
          <div className="mt-4 rounded-md border border-dashed border-white/[0.1] px-5 py-8 text-center text-sm text-slate-400">
            教师接口已返回，但数据结构不完整；请重新读取后再判定。
          </div>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <Link key={item.title} href={item.href} className="glass-hover group rounded-md border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-cyan-300/30">
              <div className="flex items-start justify-between gap-3">
                <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md"><item.icon className="h-4 w-4 text-cyan-100" /></div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
              </div>
              <div className="mt-4 font-semibold text-slate-100">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">{item.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export function HyperDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>(staticKnowledgePoints);
  const [experimentCatalog, setExperimentCatalog] = useState<ExperimentConfig[]>(staticExperimentCatalog);
  const [state, setState] = useState<HyperDashboardState>(createDashboardState);
  const sessionGenerationRef = useRef(0);

  const isEducator = user?.role === 'TEACHER' || user?.role === 'ADMIN';
  const applicableSources = isEducator ? educatorSources : studentSources;

  const loadSource = useCallback(async (
    source: HyperDataSource,
    generation = sessionGenerationRef.current,
  ): Promise<void> => {
    if (!user?.id || generation !== sessionGenerationRef.current) return;

    setState((previous) => ({
      ...previous,
      sources: {
        ...previous.sources,
        [source]: {
          ...previous.sources[source],
          status: 'loading',
          message: null,
        },
      },
    }));

    const token = getStoredAccessToken();
    if (!token) {
      if (generation !== sessionGenerationRef.current) return;
      sessionGenerationRef.current += 1;
      const nextState = createDashboardState();
      for (const applicableSource of applicableSources) {
        nextState.sources[applicableSource] = {
          status: 'error',
          hasResolved: true,
          message: '未检测到登录令牌',
        };
      }
      nextState.accessErrorStatus = 401;
      setState(nextState);
      return;
    }

    const result = await fetchHyperJson<unknown>(sourceEndpoints[source], token);
    if (generation !== sessionGenerationRef.current) return;

    if (result.status === 401 || result.status === 403) {
      sessionGenerationRef.current += 1;
      const nextState = createDashboardState();
      for (const applicableSource of applicableSources) {
        nextState.sources[applicableSource] = {
          status: 'error',
          hasResolved: true,
          message: result.status === 401 ? '登录状态已失效' : '当前角色无权读取此数据',
        };
      }
      nextState.accessErrorStatus = result.status;
      setState(nextState);
      return;
    }

    if (!result.ok || !isValidSourcePayload(source, result.data)) {
      setState((previous) => ({
        ...previous,
        sources: {
          ...previous.sources,
          [source]: {
            status: 'error',
            hasResolved: true,
            message: result.ok ? '响应格式异常' : `读取失败${result.status ? `（${result.status}）` : ''}`,
          },
        },
      }));
      return;
    }

    setState((previous) => {
      const next: HyperDashboardState = {
        ...previous,
        accessErrorStatus: null,
        sources: {
          ...previous.sources,
          [source]: { status: 'success', hasResolved: true, message: null },
        },
      };

      if (source === 'experimentRecords') next.experimentRecords = normalizeExperimentRecords(result.data);
      if (source === 'learningProgress') next.progress = normalizeLearningProgress(result.data);
      if (source === 'userStats') next.userStats = normalizeUserStats(result.data);
      if (source === 'achievements') next.achievementStats = normalizeAchievementStats(result.data);
      if (source === 'teacherDashboard') next.teacherDashboard = result.data as Record<string, unknown>;
      const provenance = readStudentProvenance(result.data);
      if (provenance) {
        next.dataProvenance = provenance.dataProvenance;
        next.asOf = provenance.asOf ?? next.asOf;
      }
      return next;
    });
  }, [applicableSources, user?.id]);

  useEffect(() => {
    let active = true;
    async function loadKnowledgePoints() {
      try {
        const token = getStoredAccessToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const [kgRes, expRes] = await Promise.all([
          fetch('/api/knowledge-graph?type=raw', { headers }),
          fetch('/api/experiments'),
        ]);
        if (kgRes.ok) {
          const json = await kgRes.json();
          if (active && Array.isArray(json.data) && json.data.length > 0) {
            setKnowledgePoints(json.data);
          }
        }
        if (expRes.ok) {
          const json = await expRes.json();
          if (active && Array.isArray(json.data) && json.data.length > 0) {
            setExperimentCatalog(json.data);
          }
        }
      } catch { /* fallback */ }
    }
    loadKnowledgePoints();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const generation = sessionGenerationRef.current + 1;
    sessionGenerationRef.current = generation;
    setState(createDashboardState());

    if (authLoading || !user) return;
    for (const source of applicableSources) void loadSource(source, generation);

    return () => {
      if (sessionGenerationRef.current === generation) sessionGenerationRef.current += 1;
    };
  }, [applicableSources, authLoading, loadSource, user?.id]);

  const experiments = useMemo(
    () => buildHyperExperiments(experimentCatalog, state.experimentRecords),
    [experimentCatalog, state.experimentRecords],
  );
  const knowledgeSummary = useMemo(() => buildKnowledgeSummary(knowledgePoints, state.progress), [knowledgePoints, state.progress]);
  const continueExperiment = useMemo(() => getContinueExperiment(experiments), [experiments]);
  const nextExperiment = useMemo(() => getNextExperiment(experiments), [experiments]);
  const completedCount = experiments.filter((item) => item.state === 'completed').length;
  const inProgressCount = experiments.filter((item) => item.state === 'in-progress').length;
  const featuredExperiments = experiments
    .filter((item) => item.state !== 'completed')
    .slice(0, 5);
  const initialLoading = authLoading || Boolean(user && applicableSources.some((source) => !state.sources[source].hasResolved));
  const anySourceLoading = applicableSources.some((source) => state.sources[source].status === 'loading');
  const failedSources = applicableSources.filter((source) => state.sources[source].status === 'error');
  const experimentRecordsAvailable = state.sources.experimentRecords.status === 'success';
  const learningProgressAvailable = state.sources.learningProgress.status === 'success';
  const userStatsAvailable = state.sources.userStats.status === 'success';
  const achievementsAvailable = state.sources.achievements.status === 'success';
  const educatorOverview = useMemo(
    () => normalizeEducatorOverview(state.teacherDashboard),
    [state.teacherDashboard],
  );

  if (initialLoading) {
    return (
      <div role="status" aria-live="polite" className="-m-4 flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-[#070a0d] text-slate-100 sm:-m-6">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200 motion-reduce:animate-none" />
        <p className="mt-3 text-sm font-semibold text-slate-200">{authLoading ? '正在核对登录状态' : '正在读取工作台数据'}</p>
        <p className="mt-1 text-xs text-slate-500">完成服务端核对前不显示学习或教学统计。</p>
      </div>
    );
  }

  if (!user || state.accessErrorStatus) {
    const isUnauthorized = !user || state.accessErrorStatus === 401;
    const role = user?.role === 'STUDENT' ? 'student' : user?.role === 'TEACHER' ? 'teacher' : '';
    const loginHref = `/login?${role ? `role=${role}&` : ''}from=%2Fhyper`;
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div role="alert" className="w-full max-w-lg rounded-md border border-amber-300/25 bg-amber-300/[0.07] p-6">
          <AlertCircle className="h-6 w-6 text-amber-200" />
          <h1 className="mt-3 text-lg font-semibold text-amber-100">{isUnauthorized ? '需要重新登录' : '当前角色无权读取工作台数据'}</h1>
          <p className="mt-2 text-sm leading-6 text-amber-50/70">当前未展示任何用户统计，避免将身份校验失败误写为 0。</p>
          {isUnauthorized ? (
            <Link href={loginHref} onClick={() => { void logout(); }} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
              重新登录并返回
            </Link>
          ) : (
            <Link href="/profile" className="mt-5 inline-flex min-h-11 items-center rounded-md border border-amber-200/25 px-4 text-sm font-semibold text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
              返回账户资料
            </Link>
          )}
        </div>
      </div>
    );
  }

  if (isEducator) {
    return (
      <EducatorHyperDashboard
        loading={state.sources.teacherDashboard.status === 'loading'}
        failed={state.sources.teacherDashboard.status === 'error'}
        overview={educatorOverview}
        onRetry={() => { void loadSource('teacherDashboard'); }}
      />
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 animate-fade-in sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-3 backdrop-blur-xl md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="chip-mark flex h-9 w-9 items-center justify-center rounded-md">
              <Sparkles className="h-4 w-4 text-cyan-100" />
            </div>
            <div>
              <h1 id="student-dashboard-title" className="text-lg font-semibold text-slate-50">EduCog Hyper 工作台</h1>
              <p className="text-xs text-slate-400">从学习任务进入，完成图谱、测评、补学、实验与复核</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {anySourceLoading && (
              <span className="inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-xs text-cyan-100">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                正在重读单项数据
              </span>
            )}
            <Link href="/ai-assistant" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
              <RadioTower className="h-4 w-4" />
              AI 助教
            </Link>
            <Link href="/tasks" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
              <Route className="h-4 w-4" />
              我的任务
            </Link>
          </div>
        </div>
      </div>

      <section aria-labelledby="student-dashboard-title" className="mx-auto max-w-[1500px] px-4 py-5 md:px-6">
        {failedSources.length > 0 && (
          <StatusBanner variant="warning" className="mb-4 flex-wrap">
            <span>部分数据暂未同步。对应指标显示为“—”或“读取失败”，不会按 0 计算。</span>
            <div className="ml-auto flex flex-wrap gap-2">
              {failedSources.filter((source) => source !== 'achievements').map((source) => {
                const sourceLoading = state.sources[source].status === 'loading';
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => { void loadSource(source); }}
                    disabled={sourceLoading}
                    title={state.sources[source].message ?? undefined}
                    className="inline-flex min-h-9 items-center rounded-md border border-amber-200/25 px-3 text-xs font-medium text-amber-100 hover:bg-amber-200/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
                  >
                    {sourceLoading ? `正在读取${sourceLabels[source]}…` : `重新读取${sourceLabels[source]}`}
                  </button>
                );
              })}
            </div>
          </StatusBanner>
        )}

        {state.dataProvenance && (
          <div
            role="note"
            className={cn(
              'mb-4 rounded-md border px-4 py-3 text-xs leading-5',
              state.dataProvenance.mode === 'REAL'
                ? 'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'
                : 'border-amber-300/20 bg-amber-300/[0.06] text-amber-100',
            )}
          >
            <div><span className="font-semibold">{state.dataProvenance.label}：</span>{state.dataProvenance.note}</div>
            {state.asOf && <div className="mt-1 opacity-70">当前工作台数据核对截至 {new Date(state.asOf).toLocaleString('zh-CN', { hour12: false })}</div>}
          </div>
        )}

        <WelcomeOnboarding
          className="mb-4"
          hasLearningEvidence={completedCount > 0
            || state.progress.length > 0
            || state.userStats.modulesCompleted > 0
            || state.achievementStats.unlockedAchievements > 0}
        />

        <LearningLoopPanel />

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <HeroVisual />
          <div className="grid gap-3 sm:grid-cols-2 stagger-children">
            <StatTile icon={CheckCircle2} label="已完成实验" value={experimentRecordsAvailable ? `${completedCount}/${experiments.length}` : `—/${experiments.length}`} hint="LAB" />
            <StatTile icon={Activity} label="进行中实验" value={experimentRecordsAvailable ? `${inProgressCount}` : '—'} hint="RUN" />
            <StatTile icon={BookOpen} label="完成模块" value={userStatsAvailable ? `${state.userStats.modulesCompleted}` : '—'} hint="LEARN" />
            <StatTile icon={Trophy} label="连续学习" value={userStatsAvailable ? `${state.userStats.dailyStreak} 天` : '—'} hint="STREAK" />
          </div>
        </div>

        <div className="mt-4 grid items-start gap-4 xl:grid-cols-[0.95fr_1.05fr_0.75fr]">
          <ContinuePanel current={continueExperiment} next={nextExperiment} recordsAvailable={experimentRecordsAvailable} />

          <div className="glass-hover rounded-md border border-white/[0.08] bg-white/[0.025] p-4 transition-all">
            <SectionHeader
              icon={LayoutGrid}
              title="课程实验"
              action={<span className="font-mono text-[11px] text-slate-500">{experiments.length} ITEMS</span>}
            />
            <div className="space-y-2">
              {featuredExperiments.length > 0 ? (
                featuredExperiments.map((experiment) => (
                  <ExperimentRow key={experiment.id} experiment={experiment} recordsAvailable={experimentRecordsAvailable} />
                ))
              ) : (
                <EmptyState title="当前没有待推进实验。" />
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <KnowledgePanel summary={knowledgeSummary} progressAvailable={learningProgressAvailable} />
            <AchievementPanel
              stats={state.achievementStats}
              available={achievementsAvailable}
              loading={state.sources.achievements.status === 'loading'}
              onRetry={() => { void loadSource('achievements'); }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3 stagger-children">
          {[
            { href: '/tasks', icon: Route, title: '我的任务', desc: '按教师布置顺序完成学习闭环' },
            { href: '/learning-path', icon: Route, title: '个性化学习', desc: '学习路径、推荐模块、进度保存' },
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
              className="glass-hover animate-scale-in group rounded-md border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-cyan-300/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md">
                  <item.icon className="h-4 w-4 text-cyan-100" />
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" />
              </div>
              <div className="mt-4 font-semibold text-slate-100">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-slate-400">{item.desc}</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
