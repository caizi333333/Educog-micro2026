'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  BarChart3,
  BookOpen,
  Clock,
  GraduationCap,
  History,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievements } from '@/hooks/useAchievements';
import { ACHIEVEMENTS_V2, type Achievement, type AchievementProgress } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';

interface ProfileStats {
  totalQuizAttempts?: number;
  averageQuizScore?: number;
  completedModules?: number;
  totalAchievements?: number;
  averageProgress?: number;
  totalLearningTime?: number;
}

interface ProfileActivity {
  action: string;
  createdAt: string;
  details?: {
    score?: number;
    moduleId?: string;
    name?: string;
    [key: string]: unknown;
  };
}

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  studentId?: string | null;
  class?: string | null;
  totalPoints?: number;
  stats?: ProfileStats;
  recentActivity?: ProfileActivity[];
}

type StatItem = [label: string, value: string | number, icon: LucideIcon];

const categoryLabels: Record<string, { label: string; color: string }> = {
  progress: { label: '学习进度', color: '#22d3ee' },
  experiment: { label: '实验实践', color: '#34d399' },
  quiz: { label: '在线测评', color: '#fbbf24' },
  social: { label: '协作习惯', color: '#a78bfa' },
  practice: { label: '代码实践', color: '#fb7185' },
};

function initialOf(name?: string | null) {
  return (name || 'U').trim().charAt(0).toUpperCase() || 'U';
}

function progressFor(progress: AchievementProgress[], id: string) {
  return progress.find((item) => item.achievementId === id);
}

function MedalDisc({ achievement, unlocked, size = 'md' }: { achievement: Achievement; unlocked: boolean; size?: 'sm' | 'md' }) {
  const meta = categoryLabels[achievement.category] || categoryLabels.progress;
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border',
        size === 'sm' ? 'h-12 w-12' : 'h-20 w-20',
        unlocked ? 'border-cyan-300/35 bg-cyan-300/[0.08]' : 'border-white/[0.08] bg-white/[0.035] grayscale',
      )}
      style={{ boxShadow: unlocked ? `0 0 24px ${meta.color}24, inset 0 1px 0 rgba(255,255,255,0.08)` : undefined }}
    >
      <div className="absolute inset-2 rounded-full border border-white/[0.08]" />
      <span className={cn(size === 'sm' ? 'text-xl' : 'text-3xl', !unlocked && 'opacity-40')}>
        {unlocked ? achievement.icon || '🏅' : '🔒'}
      </span>
    </div>
  );
}

function formatDate(value?: string | Date) {
  if (!value) return '暂无日期';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无日期';
  return date.toLocaleDateString('zh-CN');
}

export function HyperProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { loading: achievementsLoading, userProgress, calculateStats } = useAchievements();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/user/profile', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error('无法加载用户资料');
        const data = await response.json();
        setProfile(data.profile || null);
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : '无法加载用户资料');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [authLoading, user]);

  const achievementStats = calculateStats();
  const displayName = profile?.name || user?.name || '用户';
  const stats = profile?.stats || {};
  const unlocked = userProgress.filter((item) => item.unlocked);
  const featured = unlocked
    .map((item) => ACHIEVEMENTS_V2.find((achievement) => achievement.id === item.achievementId))
    .filter((achievement): achievement is Achievement => Boolean(achievement))
    .slice(0, 6);

  const categoryProgress = useMemo(() => Object.entries(categoryLabels).map(([category, meta]) => {
    const list = ACHIEVEMENTS_V2.filter((achievement) => achievement.category === category);
    const earned = list.filter((achievement) => progressFor(userProgress, achievement.id)?.unlocked).length;
    return {
      category,
      ...meta,
      earned,
      total: list.length,
      pct: list.length ? Math.round((earned / list.length) * 100) : 0,
    };
  }).filter((item) => item.total > 0), [userProgress]);

  const timeline = useMemo(() => {
    const achievementEvents = unlocked
      .filter((item) => item.unlockedAt)
      .slice(0, 5)
      .map((item) => {
        const achievement = ACHIEVEMENTS_V2.find((entry) => entry.id === item.achievementId);
        return {
          key: `achievement-${item.achievementId}`,
          date: item.unlockedAt,
          title: achievement ? `解锁 ${achievement.title}` : '解锁成就',
          desc: achievement?.description || '成就记录已同步',
        };
      });
    const activityEvents = (profile?.recentActivity || []).slice(0, 5).map((activity, index) => ({
      key: `activity-${index}`,
      date: activity.createdAt,
      title: activity.details?.name || activity.action,
      desc: activity.details?.score != null ? `得分 ${activity.details.score}` : activity.details?.moduleId || '学习活动',
    }));
    return [...achievementEvents, ...activityEvents].slice(0, 6);
  }, [profile?.recentActivity, unlocked]);

  if (authLoading || loading || achievementsLoading) {
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
          <p className="mt-3 text-sm text-slate-300">请先登录以查看个人主页。</p>
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
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <section className="grid gap-8 border-b border-white/[0.08] pb-8 lg:grid-cols-[190px_1fr_auto] lg:items-center">
          <div className="relative h-40 w-40">
            <svg className="absolute inset-0" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="none"
                stroke="#67e8f9"
                strokeLinecap="round"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 72 * (achievementStats.completionPercentage / 100)} ${2 * Math.PI * 72}`}
                transform="rotate(-90 80 80)"
              />
            </svg>
            <div className="absolute inset-3 flex items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/80 to-amber-300/80 text-5xl font-semibold text-[#061014]">
              {initialOf(displayName)}
            </div>
            <div className="absolute bottom-0 right-0 rounded-full border-2 border-[#070a0d] bg-cyan-300 px-3 py-1 font-mono text-[11px] font-bold text-[#001014]">
              {achievementStats.completionPercentage}%
            </div>
          </div>

          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Medal Profile · 我的主页
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">{displayName}</h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" />{profile?.class || profile?.role || user.role}</span>
              {profile?.studentId && <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{profile.studentId}</span>}
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{profile?.email || user.email}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 font-mono text-[10px] text-cyan-100">
                {achievementStats.unlockedCount}/{achievementStats.totalCount} 勋章
              </span>
              <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 font-mono text-[10px] text-amber-100">
                平均进度 {Math.round(stats.averageProgress || 0)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            {([
              ['勋章', achievementStats.unlockedCount, Award],
              ['积分', achievementStats.totalPoints, Trophy],
              ['学习小时', Math.round((stats.totalLearningTime || 0) / 3600), Clock],
            ] satisfies StatItem[]).map(([label, value, Icon]) => (
              <div key={label} className="min-w-24 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-3">
                <Icon className="mx-auto h-4 w-4 text-cyan-200" />
                <div className="mt-2 font-mono text-2xl font-semibold text-slate-50">{value}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            精选勋章
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          {featured.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {featured.map((achievement) => (
                <Link
                  key={achievement.id}
                  href={`/achievements#${achievement.id}`}
                  className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/40"
                >
                  <MedalDisc achievement={achievement} unlocked />
                  <div className="mt-3 line-clamp-1 text-sm font-semibold text-slate-100">{achievement.title}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">{achievement.id}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-8 text-center text-sm text-slate-400">
              暂无已解锁勋章。完成实验或测评后会同步到这里。
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <BarChart3 className="h-3.5 w-3.5 text-cyan-200" />
              分类进度
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {categoryProgress.map((item) => (
                <div key={item.category} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                      {item.label}
                    </div>
                    <div className="font-mono text-sm text-cyan-100">{item.earned}/{item.total}</div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-white/[0.1]">
                    <div className="h-full" style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                  <div className="mt-2 font-mono text-[10px] text-slate-500">{item.pct}% 完成</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <History className="h-3.5 w-3.5 text-amber-200" />
              最近记录
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              {timeline.length ? timeline.map((item) => (
                <div key={item.key} className="border-l border-white/[0.10] pb-5 pl-4 last:pb-0">
                  <div className="-ml-[21px] h-2.5 w-2.5 rounded-full border-2 border-[#070a0d] bg-cyan-300" />
                  <div className="mt-[-14px] font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">{formatDate(item.date)}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400">{item.desc}</div>
                </div>
              )) : (
                <div className="flex min-h-40 flex-col items-center justify-center text-center text-sm text-slate-500">
                  <Target className="mb-2 h-6 w-6" />
                  暂无学习活动记录
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
