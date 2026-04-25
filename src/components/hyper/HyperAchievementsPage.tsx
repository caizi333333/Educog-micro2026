'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
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

const categoryMeta: Record<string, { label: string; color: string }> = {
  progress: { label: '学习进度', color: '#06b6d4' },
  experiment: { label: '实验实践', color: '#10b981' },
  quiz: { label: '在线测评', color: '#f59e0b' },
  social: { label: '协作与习惯', color: '#8b5cf6' },
};

type StatItem = [label: string, value: string | number, icon: LucideIcon];

function progressFor(progress: AchievementProgress[], id: string) {
  return progress.find((item) => item.achievementId === id);
}

function MedalVisual({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const color = categoryMeta[achievement.category]?.color || '#06b6d4';
  return (
    <div
      className={cn(
        'relative mx-auto flex h-20 w-20 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
        unlocked ? 'border-cyan-300/30 bg-cyan-300/[0.08]' : 'border-white/[0.09] bg-white/[0.035] grayscale',
      )}
      style={{ boxShadow: unlocked ? `0 0 28px ${color}22, inset 0 1px 0 rgba(255,255,255,0.08)` : undefined }}
    >
      <div className="absolute inset-2 rounded-full border border-white/[0.08]" />
      <span className={cn('text-3xl', !unlocked && 'opacity-40')}>{unlocked ? achievement.icon || '🏅' : '🔒'}</span>
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
      className={cn(
        'relative rounded-md border bg-white/[0.035] p-4 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/[0.05]',
        selected ? 'border-cyan-300/70 shadow-[0_0_0_1px_rgba(103,232,249,0.55)]' : 'border-white/[0.08]',
        !unlocked && 'opacity-70',
      )}
    >
      <MedalVisual achievement={achievement} unlocked={unlocked} />
      <div className="mt-3 line-clamp-1 text-sm font-semibold text-slate-100">{achievement.title}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">{achievement.id}</div>
      <div className="mt-3 h-1 overflow-hidden rounded-sm bg-white/[0.1]">
        <div className={cn('h-full', unlocked ? 'bg-emerald-300' : 'bg-cyan-300')} style={{ width: `${unlocked ? 100 : pct}%` }} />
      </div>
    </button>
  );
}

function DetailPanel({ achievement, progress }: { achievement: Achievement | null; progress?: AchievementProgress }) {
  if (!achievement) {
    return (
      <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] p-8 text-center text-slate-500">
        <MousePointerClick className="h-7 w-7" />
        <div className="mt-3 text-sm">点击勋章查看详情</div>
      </div>
    );
  }

  const unlocked = !!progress?.unlocked;
  const pct = Math.max(0, Math.min(100, Math.round(progress?.progress || 0)));
  const meta = categoryMeta[achievement.category] || { label: achievement.category, color: '#06b6d4' };
  const target = typeof achievement.criteria?.target === 'number' ? achievement.criteria.target : 1;

  return (
    <aside className="rounded-md border border-white/[0.08] bg-white/[0.035]">
      <div className="border-b border-white/[0.08] p-6 text-center">
        <MedalVisual achievement={achievement} unlocked={unlocked} />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: meta.color }}>
          {achievement.id} · {meta.label}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">{achievement.title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{achievement.description}</p>
        {unlocked && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-1 text-xs text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已解锁
          </div>
        )}
      </div>

      <div className="border-b border-white/[0.08] p-5">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
          <Target className="h-3.5 w-3.5" />
          解锁条件
        </div>
        <div className="text-sm text-slate-200">{achievement.description}</div>
        {!unlocked && (
          <div className="mt-4">
            <div className="mb-2 flex justify-between font-mono text-[11px] text-slate-500">
              <span>当前进度</span>
              <span className="text-cyan-200">{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-sm bg-white/[0.1]">
              <div className="h-full bg-cyan-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 border-b border-white/[0.08] p-5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">目标值</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-slate-50">{target}</div>
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
          {progress?.unlockedAt ? progress.unlockedAt.toLocaleDateString('zh-CN') : '暂无记录'}
        </div>
      </div>
    </aside>
  );
}

export function HyperAchievementsPage() {
  const { user } = useAuth();
  const { loading, refreshing, userProgress, fetchAchievements, calculateStats, getFilteredAchievements, error } = useAchievements();
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(ACHIEVEMENTS_V2[0]?.id || '');

  const stats = calculateStats();
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

  if (!user) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">请先登录以查看成就系统。</p>
          <Link href="/login" className="mt-4 inline-flex rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#001014]">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <Trophy className="h-3.5 w-3.5" />
              Achievement Wall · 勋章墙
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">成就徽章</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              以勋章墙方式呈现学习、实验、测评和持续学习记录。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {error && <span className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">{error}</span>}
            <button
              type="button"
              onClick={() => fetchAchievements(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              刷新
            </button>
          </div>
        </div>
      </div>

      <main className="grid gap-5 px-4 py-5 xl:grid-cols-[220px_1fr_360px] md:px-6">
        <aside className="rounded-md border border-white/[0.08] bg-white/[0.035] p-3 xl:sticky xl:top-20 xl:self-start">
          <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">视图</div>
          {[
            ['all', LayoutGrid, '全部勋章', `${stats.unlockedCount}/${stats.totalCount}`],
            ['earned', Check, '已获得', String(stats.unlockedCount)],
            ['locked', Lock, '未获得', String(stats.totalCount - stats.unlockedCount)],
          ].map(([id, Icon, label, count]) => (
            <button
              key={id as string}
              type="button"
              onClick={() => setActive(id as string)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition',
                active === id ? 'bg-cyan-300/[0.12] text-cyan-100' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label as string}
              <span className="ml-auto font-mono text-[10px] text-slate-500">{count as string}</span>
            </button>
          ))}

          <div className="mt-4 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">分类</div>
          {Object.entries(categoryMeta).map(([id, meta]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActive(id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition',
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
              ['已解锁', stats.unlockedCount, Medal],
              ['总勋章', stats.totalCount, Award],
              ['完成率', `${stats.completionPercentage}%`, Target],
              ['积分', stats.totalPoints, Trophy],
            ] satisfies StatItem[]).map(([label, value, Icon]) => (
              <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <Icon className="h-4 w-4 text-cyan-200" />
                <div className="mt-3 font-mono text-2xl font-semibold text-slate-50">{value}</div>
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
                className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
              />
            </div>
            <div className="font-mono text-[11px] text-slate-500">
              {loading ? 'LOADING' : `${achievements.length} ITEMS`}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {achievements.map((achievement) => (
              <AchievementTile
                key={achievement.id}
                achievement={achievement}
                progress={progressFor(userProgress, achievement.id)}
                selected={selected?.id === achievement.id}
                onClick={() => setSelectedId(achievement.id)}
              />
            ))}
          </div>
        </section>

        <DetailPanel achievement={selected} progress={selectedProgress} />
      </main>
    </div>
  );
}
