'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Lock,
  Medal,
  MousePointerClick,
  RefreshCcw,
  Search,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievements } from '@/hooks/useAchievements';
import { ACHIEVEMENTS_V2, type Achievement, type AchievementProgress } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';

const categoryMeta: Record<string, { label: string; color: string }> = {
  progress: { label: '学习进度', color: '#06b6d4' },
  experiment: { label: '实验实践', color: '#10b981' },
  quiz: { label: '在线测评', color: '#f59e0b' },
  social: { label: '协作与习惯', color: '#8b5cf6' },
  practice: { label: '代码实践', color: '#fb7185' },
};

const rarityGlow: Record<string, { border: string; bg: string; shadow: string }> = {
  common: { border: 'border-amber-700/40', bg: 'bg-amber-700/[0.08]', shadow: '#b4530920' },
  rare: { border: 'border-slate-300/40', bg: 'bg-slate-300/[0.08]', shadow: '#cbd5e120' },
  epic: { border: 'border-amber-300/50', bg: 'bg-amber-300/[0.10]', shadow: '#fcd34d30' },
  legendary: { border: 'border-purple-300/50', bg: 'bg-purple-300/[0.12]', shadow: '#c4b5fd40' },
};

function getRarityStyle(rarity?: string) {
  return rarityGlow[rarity || 'common'] || rarityGlow.common;
}

type StatItem = [label: string, value: string | number, icon: LucideIcon];

function progressFor(progress: AchievementProgress[], id: string) {
  return progress.find((item) => item.achievementId === id);
}

function nextActionFor(achievement: Achievement): { href: string; label: string; note: string } {
  if (achievement.category === 'quiz') {
    return {
      href: '/quiz',
      label: '进入专项测评',
      note: '完成并提交测评后，服务端会重新核对相关测评类规则。',
    };
  }
  if (achievement.category === 'experiment' || achievement.category === 'practice') {
    return {
      href: '/simulation',
      label: '进入仿真实践',
      note: '按实验完成条件运行并提交后，服务端会重新核对实践类规则。',
    };
  }
  return {
    href: '/tasks',
    label: '继续学习任务',
    note: '继续完成课程任务与学习步骤，相关记录落盘后会更新勋章进度。',
  };
}

function formatAchievementTarget(achievement: Achievement): string {
  const target = typeof achievement.criteria?.target === 'number' ? achievement.criteria.target : 1;
  const criteriaType = typeof achievement.criteria?.type === 'string' ? achievement.criteria.type : '';
  if (criteriaType === 'learning_time' || criteriaType === 'experiment_time') {
    const hours = target / 3600;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}小时`;
  }
  if (criteriaType === 'continuous_hours') return `${target}小时`;
  if (criteriaType === 'quiz_average') return `${target}分`;
  if (criteriaType === 'total_points') return `${target}积分`;
  if (criteriaType === 'modules_completed') return `${target}个模块`;
  if (criteriaType === 'experiments_completed') return `${target}个实验`;
  if (criteriaType === 'learning_streak' || criteriaType === 'daily_streak') return `${target}天`;
  if (criteriaType === 'code_history_viewed') return `${target}行`;
  if (criteriaType === 'achievements_unlocked') return `${target}枚`;
  return `${target}次`;
}

function MedalVisual({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const color = categoryMeta[achievement.category]?.color || '#06b6d4';
  const rarityStyle = getRarityStyle(achievement.rarity);
  return (
    <div
      className={cn(
        'relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] chip-mark',
        unlocked ? rarityStyle.border : 'border-white/[0.12]',
        unlocked ? rarityStyle.bg : 'bg-white/[0.05]',
      )}
      style={{ boxShadow: unlocked ? `0 0 28px ${rarityStyle.shadow}, 0 0 12px ${color}18, inset 0 1px 0 rgba(255,255,255,0.08)` : `0 0 12px ${color}10, inset 0 1px 0 rgba(255,255,255,0.06)` }}
    >
      <div className="absolute inset-2 rounded-full border border-white/[0.08]" />
      {unlocked ? (
        <span className="text-3xl">{achievement.icon || '🏅'}</span>
      ) : (
        <div className="flex flex-col items-center">
          <span className="text-2xl opacity-30">{achievement.icon || '🏅'}</span>
          <Lock className="absolute h-4 w-4 text-slate-400" />
        </div>
      )}
    </div>
  );
}

function AchievementTile({
  achievement,
  progress,
  selected,
  onClick,
}: {
  achievement: Achievement;
  progress?: AchievementProgress;
  selected: boolean;
  onClick: () => void;
}) {
  const unlocked = !!progress?.unlocked;
  const pct = Math.max(0, Math.min(100, Math.round(progress?.progress || 0)));

  return (
    <button
      type="button"
      onClick={onClick}
      aria-controls="achievement-detail"
      aria-pressed={selected}
      aria-label={`${achievement.title}，${unlocked ? '已解锁' : `当前进度 ${pct}%`}`}
      className={cn(
        'relative min-h-11 rounded-md border bg-white/[0.035] p-4 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 glass-hover',
        selected ? 'border-cyan-300/70 shadow-[0_0_0_1px_rgba(103,232,249,0.55)]' : 'border-white/[0.08]',
        !unlocked && 'opacity-90',
      )}
    >
      <MedalVisual achievement={achievement} unlocked={unlocked} />
      <div className="mt-3 line-clamp-1 text-sm font-semibold text-slate-100">{achievement.title}</div>
      <div className="mt-1 line-clamp-1 text-[11px] text-slate-500">{achievement.description}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-sm bg-white/[0.1]">
        <div className={cn('h-full rounded-sm transition-all', unlocked ? 'bg-emerald-300' : 'bg-cyan-300')} style={{ width: `${unlocked ? 100 : pct}%` }} />
      </div>
    </button>
  );
}

function DetailPanel({ achievement, progress }: { achievement: Achievement | null; progress?: AchievementProgress }) {
  if (!achievement) {
    return <EmptyState centered icon={MousePointerClick} title="点击勋章查看详情" />;
  }

  const unlocked = !!progress?.unlocked;
  const pct = Math.max(0, Math.min(100, Math.round(progress?.progress || 0)));
  const criteriaMetWithoutRecord = !unlocked && pct >= 100;
  const meta = categoryMeta[achievement.category] || { label: achievement.category, color: '#06b6d4' };
  const target = formatAchievementTarget(achievement);
  const nextAction = nextActionFor(achievement);

  return (
    <aside
      id="achievement-detail"
      tabIndex={-1}
      aria-live="polite"
      className="scroll-mt-20 rounded-md border border-white/[0.08] bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
    >
      <div className="border-b border-white/[0.08] p-6 text-center">
        <MedalVisual achievement={achievement} unlocked={unlocked} />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          {meta.label}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">{achievement.title}</h2>
        {unlocked && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1 text-xs text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已解锁
          </div>
        )}
        {criteriaMetWithoutRecord && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
            <Target className="h-3.5 w-3.5" />
            条件已达成 · 尚无解锁记录
          </div>
        )}
      </div>

      <div className="border-b border-white/[0.08] p-5">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <Target className="h-3.5 w-3.5" />
          完成条件
        </div>
        <div className="text-sm font-medium leading-6 text-slate-200">{achievement.description}</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">勋章是否解锁以服务端学习、测评或实验记录核对结果为准。</p>
        {!unlocked && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between font-mono text-[11px] text-slate-500">
              <span>当前进度</span>
              <span className="text-cyan-200">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-sm bg-white/[0.1]">
              <div className="h-full rounded-sm bg-cyan-300 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-white/[0.08] p-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">目标值</div>
          <div className="mt-1 font-mono text-xl font-semibold text-slate-50">{target}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">积分</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-amber-200">+{achievement.points}</div>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          解锁记录
        </div>
        <div className="text-sm text-slate-300">
          {progress?.unlockedAt
            ? progress.unlockedAt.toLocaleDateString('zh-CN')
            : criteriaMetWithoutRecord ? '尚未写入服务端解锁记录' : '暂无记录'}
        </div>
      </div>

      <div className="border-t border-white/[0.08] p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">下一步</div>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          {unlocked ? `该勋章已记录；你仍可继续巩固。${nextAction.note}` : nextAction.note}
        </p>
        <Link
          href={nextAction.href}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
        >
          {nextAction.label}<ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

export function HyperAchievementsPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    loading,
    refreshing,
    userProgress,
    fetchAchievements,
    calculateStats,
    getFilteredAchievements,
    error,
    accessErrorStatus,
    dataProvenance,
    asOf,
    sampleSize,
  } = useAchievements();
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(ACHIEVEMENTS_V2[0]?.id || '');
  const [returnHref, setReturnHref] = useState('/achievements');

  const selectAchievement = useCallback((achievementId: string): void => {
    setSelectedId(achievementId);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.hash = achievementId;
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', nextHref);
    setReturnHref(nextHref);
    if (window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        const detail = document.getElementById('achievement-detail');
        if (!detail) return;
        if (typeof detail.scrollIntoView === 'function') {
          detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        detail.focus({ preventScroll: true });
      });
    }
  }, []);

  useEffect(() => {
    const restoreFromHash = (): void => {
      const achievementId = decodeURIComponent(window.location.hash.replace(/^#/, '')).trim();
      if (!achievementId || !ACHIEVEMENTS_V2.some((item) => item.id === achievementId)) return;
      setActive('all');
      setQuery('');
      setSelectedId(achievementId);
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}` || '/achievements');
    };
    restoreFromHash();
    if (window.location.pathname.startsWith('/achievements')) {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
    window.addEventListener('hashchange', restoreFromHash);
    return (): void => window.removeEventListener('hashchange', restoreFromHash);
  }, []);

  const stats = calculateStats();
  const visibleAllAchievements = getFilteredAchievements('all');
  const visibleAllCount = visibleAllAchievements.length;
  const concealedCount = Math.max(0, stats.totalCount - visibleAllCount);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, { total: number; earned: number }> = {};
    Object.keys(categoryMeta).forEach((category) => {
      const list = ACHIEVEMENTS_V2.filter((item) => item.category === category);
      counts[category] = {
        total: list.length,
        earned: list.filter((item) => progressFor(userProgress, item.id)?.unlocked).length,
      };
    });
    return counts;
  }, [userProgress]);

  const achievements = useMemo(() => {
    let list = active === 'all' || active === 'earned' || active === 'locked'
      ? getFilteredAchievements('all')
      : getFilteredAchievements(active);

    if (active === 'earned') list = list.filter((item) => progressFor(userProgress, item.id)?.unlocked);
    if (active === 'locked') list = list.filter((item) => !progressFor(userProgress, item.id)?.unlocked);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => `${item.title} ${item.description} ${item.id}`.toLowerCase().includes(q));
    }
    return list;
  }, [active, getFilteredAchievements, query, userProgress]);

  const selected = achievements.find((item) => item.id === selectedId) || achievements[0] || null;
  const selectedProgress = selected ? progressFor(userProgress, selected.id) : undefined;

  useEffect(() => {
    if (!selected || selected.id === selectedId || typeof window === 'undefined') return;
    setSelectedId(selected.id);
    const url = new URL(window.location.href);
    url.hash = selected.id;
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState({}, '', nextHref);
    setReturnHref(nextHref);
  }, [selected, selectedId]);

  const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}${accessErrorStatus === 403 ? '&reason=student-role' : ''}`;

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#070a0d] text-sm text-slate-400 sm:-m-6" role="status" aria-live="polite">
        <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />
        正在确认访问角色...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">请先登录以查看成就系统。</p>
          <Link href={loginRecoveryHref} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#001014] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'STUDENT') {
    const destination = user.role === 'TEACHER' ? '/teacher' : '/admin';
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="w-full max-w-md rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-amber-200" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-amber-100">该页仅展示学生个人成就</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">当前账号不会读取学生勋章、积分或解锁记录。</p>
          <Link href={destination} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            {user.role === 'TEACHER' ? '返回教学仪表板' : '返回管理端'}
          </Link>
        </div>
      </div>
    );
  }

  if (accessErrorStatus) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="w-full max-w-md rounded-md border border-red-300/20 bg-red-300/[0.05] p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-red-200" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-slate-50">成就记录暂不可用</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{error ?? '需要重新核验学生账号后才能继续。'}</p>
          <Link href={loginRecoveryHref} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            {accessErrorStatus === 403 ? '切换学生账号' : '重新登录'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <Trophy className="h-3.5 w-3.5" />
              Achievement Wall · 勋章墙
            </div>
            <h1 id="achievements-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">成就徽章</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              以勋章墙方式呈现学习、实验、测评和持续学习记录。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {error && <span role="alert" className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">{error}</span>}
            <button
              type="button"
              onClick={() => fetchAchievements(true)}
              disabled={loading || refreshing}
              aria-busy={refreshing}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCcw className="h-4 w-4" />}
              {refreshing ? '正在刷新' : '刷新记录'}
            </button>
          </div>
        </div>
      </div>

      {dataProvenance && asOf && sampleSize && (
        <div className="px-4 pt-5 md:px-6">
          <div
            role="note"
            className={cn(
              'rounded-md border px-4 py-3',
              dataProvenance.mode === 'REAL'
                ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
                : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
            )}
          >
            <div className="text-sm font-semibold">{dataProvenance.label}</div>
            <p className="mt-1 text-xs leading-5 opacity-80">{dataProvenance.note}</p>
            <p className="mt-1 font-mono text-[10px] leading-5 opacity-70">
              截止 {new Date(asOf).toLocaleString('zh-CN', { hour12: false })}
              {' · '}已解锁 n={sampleSize.unlockedAchievementRecords}/{sampleSize.achievementRules}
              {' · '}学习 n={sampleSize.learningProgressRecords}
              {' · '}测评 n={sampleSize.quizAttempts}
              {' · '}实验 n={sampleSize.experimentRecords}
              {' · '}0 为已确认零记录，N/A 为尚未取得可核验结果
            </p>
          </div>
        </div>
      )}

      <section aria-labelledby="achievements-page-title" aria-busy={loading} className="grid gap-5 px-4 py-5 xl:grid-cols-[220px_1fr_360px] md:px-6">
        <aside className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3 xl:sticky xl:top-20 xl:self-start">
          <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">视图</div>
          {[
            ['all', LayoutGrid, '全部可见', `${stats.unlockedCount}/${visibleAllCount}`],
            ['earned', Check, '已获得', String(stats.unlockedCount)],
            ['locked', Lock, '未获得', String(Math.max(0, visibleAllCount - stats.unlockedCount))],
          ].map(([id, Icon, label, count]) => (
            <button
              key={id as string}
              type="button"
              onClick={() => setActive(id as string)}
              aria-pressed={active === id}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                active === id ? 'bg-cyan-300/[0.12] text-cyan-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label as string}
              <span className="ml-auto font-mono text-[10px] text-slate-500">{count as string}</span>
            </button>
          ))}

          {concealedCount > 0 && (
            <p className="mt-3 px-2 text-[10px] leading-4 text-slate-500">
              当前展示 {visibleAllCount} 项；另有 {concealedCount} 项隐藏成就在满足显示条件后出现。
            </p>
          )}

          <div className="mt-4 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">分类</div>
          {Object.entries(categoryMeta).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              aria-pressed={active === id}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200',
                active === id ? 'bg-cyan-300/[0.12] text-cyan-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
              {meta.label}
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                {categoryCounts[id]?.earned || 0}/{categoryCounts[id]?.total || 0}
              </span>
            </button>
          ))}
        </aside>

        <section className="min-w-0">
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {([
              ['已解锁', loading || (error && userProgress.length === 0) ? 'N/A' : stats.unlockedCount, Medal],
              ['规则总数', loading ? 'N/A' : stats.totalCount, Award],
              ['完成率', loading || (error && userProgress.length === 0) ? 'N/A' : `${stats.completionPercentage}%`, Target],
              ['平台积分', loading || (error && userProgress.length === 0) ? 'N/A' : stats.totalPoints, Trophy],
            ] satisfies StatItem[]).map(([label, value, Icon]) => (
              <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 gradient-border">
                <Icon className="h-4 w-4 text-cyan-200" />
                <div className="mt-3 font-mono text-2xl font-semibold text-slate-50 stat-glow">{value}</div>
                <div className="text-xs text-slate-400">{label}</div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索勋章..."
                aria-label="搜索成就勋章"
                className="min-h-11 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
              />
            </div>
            <div className="font-mono text-[11px] text-slate-500">
              {loading ? '正在加载' : `${achievements.length} 项可见`}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] text-sm text-slate-400" role="status">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在同步成就记录…
            </div>
          ) : achievements.length === 0 ? (
            <EmptyState
              centered
              icon={Search}
              title="没有符合条件的勋章"
              description="请清除搜索词或切换到“全部勋章”。"
              action={{ label: '清除筛选', onClick: () => { setQuery(''); setActive('all'); } }}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {achievements.map((achievement) => (
                <AchievementTile
                  key={achievement.id}
                  achievement={achievement}
                  progress={progressFor(userProgress, achievement.id)}
                  selected={selected?.id === achievement.id}
                  onClick={() => selectAchievement(achievement.id)}
                />
              ))}
            </div>
          )}
        </section>

        {loading ? (
          <div className="min-h-[360px] rounded-md border border-white/[0.08] bg-white/[0.035]" aria-hidden="true" />
        ) : (
          <DetailPanel achievement={selected} progress={selectedProgress} />
        )}
      </section>
    </div>
  );
}
