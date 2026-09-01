'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Building2,
  Camera,
  CheckCircle2,
  CircleOff,
  Clock,
  GraduationCap,
  History,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useAchievements } from '@/hooks/useAchievements';
import { ACHIEVEMENTS_V2, type Achievement, type AchievementProgress } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';

const AVATAR_MAX_SIZE = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

interface ProfileStats {
  totalExperiments?: number;
  totalQuizzes?: number;
  totalQuizAttempts?: number;
  averageQuizScore?: number;
  completedModules?: number;
  totalAchievements?: number;
  totalLearningPaths?: number;
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
  username?: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  status?: string;
  studentId?: string | null;
  class?: string | null;
  grade?: string | null;
  major?: string | null;
  teacherId?: string | null;
  department?: string | null;
  title?: string | null;
  createdAt?: string;
  lastLoginAt?: string | null;
  totalPoints?: number;
  stats?: ProfileStats;
  recentActivity?: ProfileActivity[];
}

type StatItem = [label: string, value: string | number, icon: LucideIcon];
type AuthUser = NonNullable<ReturnType<typeof useAuth>['user']>;
type ProfileError = { kind: 'auth' | 'request'; message: string };

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

const actionLabels: Record<string, string> = {
  LOGIN: '登录',
  LOGOUT: '登出',
  REGISTER: '注册',
  UNLOCK_ACHIEVEMENT: '解锁成就',
  EARN_POINTS: '获得积分',
  CHANGE_PASSWORD: '修改密码',
  RESET_PASSWORD: '重置密码',
  UPDATE_PROFILE: '更新个人资料',
  UPDATE_AVATAR: '更新头像',
  COMPLETE_MODULE: '完成模块',
  START_EXPERIMENT: '开始实验',
  COMPLETE_EXPERIMENT: '完成实验',
  VIEW_EXPERIMENT: '查看实验',
  SUBMIT_EXPERIMENT: '提交实验',
  SUBMIT_QUIZ: '提交测验',
  VIEW_CHAPTER: '浏览课程章节',
  VIEW_CONTENT: '浏览内容',
  VIEW_KNOWLEDGE_GRAPH: '查看知识图谱',
  VIEW_LEADERBOARD: '查看排行榜',
  DOWNLOAD_RESOURCE: '下载学习资源',
  COMPLETE_QUIZ: '完成测验',
  QUIZ_COMPLETED: '完成测验',
  ASK_AI_ASSISTANT: '咨询AI助教',
  JOIN_CLASS: '加入班级',
  CREATE_CLASS: '创建班级',
  CREATE_LEARNING_PATH: '生成学习路径',
  START_QUIZ: '开始测验',
  COMPLETE_TASK_STEP: '完成任务步骤',
};

export function getProfileActivityLabel(action: string): string {
  return actionLabels[action] || '学习活动';
}

function progressFor(progress: AchievementProgress[], id: string) {
  return progress.find((item) => item.achievementId === id);
}

const rarityGlow: Record<string, { border: string; bg: string; shadow: string }> = {
  common: { border: 'border-amber-700/40', bg: 'bg-amber-700/[0.08]', shadow: '#b4530920' },
  rare: { border: 'border-slate-300/40', bg: 'bg-slate-300/[0.08]', shadow: '#cbd5e120' },
  epic: { border: 'border-amber-300/50', bg: 'bg-amber-300/[0.10]', shadow: '#fcd34d30' },
  legendary: { border: 'border-purple-300/50', bg: 'bg-purple-300/[0.12]', shadow: '#c4b5fd40' },
};

function getRarityStyle(rarity?: string) {
  return rarityGlow[rarity || 'common'] || rarityGlow.common;
}

function MedalDisc({ achievement, unlocked, size = 'md' }: { achievement: Achievement; unlocked: boolean; size?: 'sm' | 'md' }) {
  const meta = categoryLabels[achievement.category] || categoryLabels.progress;
  const rarityStyle = getRarityStyle(achievement.rarity);
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-full border chip-mark',
        size === 'sm' ? 'h-12 w-12' : 'h-20 w-20',
        unlocked ? rarityStyle.border : 'border-white/[0.12]',
        unlocked ? rarityStyle.bg : 'bg-white/[0.05]',
      )}
      style={{ boxShadow: unlocked ? `0 0 24px ${rarityStyle.shadow}, 0 0 10px ${meta.color}18, inset 0 1px 0 rgba(255,255,255,0.08)` : `0 0 12px ${meta.color}10, inset 0 1px 0 rgba(255,255,255,0.06)` }}
    >
      <div className="absolute inset-2 rounded-full border border-white/[0.08]" />
      {unlocked ? (
        <span className={size === 'sm' ? 'text-xl' : 'text-3xl'}>{achievement.icon || '🏅'}</span>
      ) : (
        <div className="relative flex flex-col items-center">
          <span className={cn(size === 'sm' ? 'text-xl' : 'text-3xl', 'opacity-25')}>{achievement.icon || '🏅'}</span>
          <Lock className="absolute h-4 w-4 text-slate-400" />
        </div>
      )}
    </div>
  );
}

function formatDate(value?: string | Date) {
  if (!value) return '暂无日期';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无日期';
  return date.toLocaleDateString('zh-CN');
}

function formatLearningDuration(totalSeconds?: number): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—';
  if (totalSeconds <= 0) return '0m';
  if (totalSeconds < 3600) return `${Math.max(1, Math.round(totalSeconds / 60))}m`;
  const hours = totalSeconds / 3600;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

function roleLabel(role: AuthUser['role']) {
  if (role === 'TEACHER') return '教师账户';
  if (role === 'ADMIN') return '平台管理员';
  if (role === 'STUDENT') return '学生账户';
  return '访客账户';
}

const studentLearningEvidenceActions = new Set([
  'ASK_AI_ASSISTANT',
  'COMPLETE_EXPERIMENT',
  'COMPLETE_MODULE',
  'COMPLETE_QUIZ',
  'COMPLETE_TASK_STEP',
  'CREATE_LEARNING_PATH',
  'DEBUG_SUCCESS',
  'DOWNLOAD_RESOURCE',
  'QUIZ_COMPLETED',
  'RUN_CODE',
  'START_EXPERIMENT',
  'START_QUIZ',
  'SUBMIT_EXPERIMENT',
  'SUBMIT_QUIZ',
  'UPDATE_PROGRESS',
  'VIEW_CHAPTER',
  'VIEW_CONTENT',
  'VIEW_EXPERIMENT',
  'VIEW_KNOWLEDGE_GRAPH',
]);

function hasStudentLearningEvidence(profile: ProfileData, progress: AchievementProgress[]) {
  const stats = profile.stats;
  const positiveStats = [
    profile.totalPoints,
    stats?.totalExperiments,
    stats?.totalQuizzes,
    stats?.totalQuizAttempts,
    stats?.completedModules,
    stats?.totalLearningTime,
  ].some((value) => typeof value === 'number' && value > 0);

  return positiveStats
    || Boolean(profile.recentActivity?.some((activity) => studentLearningEvidenceActions.has(activity.action)))
    || progress.some((item) => item.unlocked);
}

interface ProfileAvatarProps {
  displayName: string;
  avatar?: string | null;
  uploading: boolean;
  completionPercentage?: number;
  badge: string;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function ProfileAvatar({
  displayName,
  avatar,
  uploading,
  completionPercentage,
  badge,
  fileInputRef,
  onChange,
}: ProfileAvatarProps) {
  return (
    <div className="relative h-36 w-36 shrink-0 justify-self-center md:h-40 md:w-40 md:justify-self-start">
      {completionPercentage != null && (
        <svg aria-hidden="true" className="absolute inset-0" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
          <circle
            cx="80"
            cy="80"
            r="72"
            fill="none"
            stroke="#67e8f9"
            strokeLinecap="round"
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 72 * (completionPercentage / 100)} ${2 * Math.PI * 72}`}
            transform="rotate(-90 80 80)"
          />
        </svg>
      )}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading}
        className={cn(
          'absolute group overflow-hidden rounded-full chip-mark bg-gradient-to-br from-cyan-400/80 to-amber-300/80 transition-all hover:ring-2 hover:ring-cyan-300/50 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:cursor-wait disabled:opacity-70',
          completionPercentage != null ? 'inset-3' : 'inset-1 border border-white/[0.12]',
        )}
        title="更换头像"
        aria-label={uploading ? '正在上传头像' : '更换头像，支持 PNG、JPG、GIF、WebP，不超过 2MB'}
      >
        <Avatar className="h-full w-full">
          <AvatarImage src={avatar || undefined} alt={displayName} className="object-cover" />
          <AvatarFallback className="h-full w-full bg-transparent text-5xl font-semibold text-[#061014]">
            {initialOf(displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-cyan-100 motion-reduce:animate-none" />
          ) : (
            <>
              <Camera className="h-6 w-6 text-cyan-100" />
              <span className="mt-1 text-[11px] text-cyan-100">更换头像</span>
            </>
          )}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={onChange}
        className="hidden"
      />
      <div className="absolute bottom-0 right-0 max-w-[132px] truncate rounded-full border-2 border-[#070a0d] bg-cyan-300 px-3 py-1 font-mono text-[10px] font-bold text-[#001014]">
        {badge}
      </div>
    </div>
  );
}

interface CommonProfileViewProps {
  profile: ProfileData;
  user: AuthUser;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAvatarChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLogout: () => Promise<void>;
}

function AccountHeading({ profile, user }: Pick<CommonProfileViewProps, 'profile' | 'user'>) {
  return (
    <div className="min-w-0">
      <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
        <UserRound className="h-3.5 w-3.5" />
        Account Profile · 账户主页
      </div>
      <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
        {profile.name || user.name}
      </h1>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-cyan-200" />{roleLabel(user.role)}
        </span>
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 break-all">
          <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-200" />{profile.email || user.email || '邮箱未设置'}
        </span>
        {(profile.department || user.department) && (
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-cyan-200" />{profile.department || user.department}
          </span>
        )}
      </div>
    </div>
  );
}

function EducatorProfileView(props: CommonProfileViewProps) {
  const { profile, user, uploading, fileInputRef, onAvatarChange } = props;
  const isAdmin = user.role === 'ADMIN';
  const shortcuts: Array<{ title: string; desc: string; href: string; icon: LucideIcon }> = isAdmin ? [
    { title: '管理控制台', desc: '查看平台配置与运行入口', href: '/admin', icon: LayoutDashboard },
    { title: '用户管理', desc: '核对账号、角色与访问范围', href: '/admin/users', icon: Users },
    { title: '知识图谱管理', desc: '检查课程节点与资源配置', href: '/admin/knowledge-graph', icon: BookOpen },
    { title: 'OBE 管理', desc: '配置毕业要求与课程目标', href: '/obe/admin', icon: Target },
  ] : [
    { title: '教学仪表板', desc: '查看当前教学范围与待办', href: '/teacher', icon: LayoutDashboard },
    { title: '班级管理', desc: '管理班级、学生与邀请码', href: '/teacher/classes', icon: Users },
    { title: '学情分析', desc: '复核任务、测评与实验数据', href: '/analytics', icon: BarChart3 },
    { title: '课程目标评价', desc: '查看 OBE 达成与持续改进', href: '/obe/teacher', icon: Target },
  ];

  const detailRows = [
    ['账户角色', roleLabel(user.role)],
    [isAdmin ? '管理员标识' : '教师编号', isAdmin ? (profile.username || user.username) : (profile.teacherId || user.teacherId || '未填写')],
    ['所属院系', profile.department || user.department || '未填写'],
    ['职称', profile.title || user.title || '未填写'],
  ];

  return (
    <>
      <section className="grid gap-6 border-b border-white/[0.08] pb-7 md:grid-cols-[160px_1fr] md:items-center lg:grid-cols-[180px_1fr_auto]">
        <ProfileAvatar
          displayName={profile.name || user.name}
          avatar={profile.avatar || user.avatar}
          uploading={uploading}
          badge={roleLabel(user.role)}
          fileInputRef={fileInputRef}
          onChange={onAvatarChange}
        />
        <AccountHeading profile={profile} user={user} />
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-4 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/[0.12] focus:outline-none focus:ring-2 focus:ring-cyan-300 md:col-span-2 lg:col-span-1"
        >
          <Settings className="h-4 w-4" />账户与安全
        </Link>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <Shield className="h-3.5 w-3.5 text-cyan-200" />账户资料
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <dl className="space-y-3">
            {detailRows.map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="max-w-[65%] break-words text-right text-sm text-slate-200">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-50/90">
            <div className="flex items-center gap-2 font-semibold text-amber-100">
              <CircleOff className="h-4 w-4" />学生学习画像不适用于当前角色
            </div>
            <p className="mt-1 text-amber-50/70">勋章、个人学习时长和分类进度仅用于学生学习反馈，本页不生成教师或管理员的零值记录。</p>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <LayoutDashboard className="h-3.5 w-3.5 text-cyan-200" />{isAdmin ? '管理入口' : '教学入口'}
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {shortcuts.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="glass-hover group flex min-h-28 items-start gap-3 rounded-md border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-cyan-300/35 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <span className="chip-mark flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                  <item.icon className="h-4 w-4 text-cyan-100" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    {item.title}<ArrowRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function StudentAccountHeading({ profile, user }: Pick<CommonProfileViewProps, 'profile' | 'user'>) {
  return (
    <div className="min-w-0">
      <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
        <Sparkles className="h-3.5 w-3.5" />
        Learning Profile · 学习主页
      </div>
      <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">{profile.name || user.name}</h1>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-cyan-200" />{profile.class || '尚未加入班级'}</span>
        {profile.studentId && <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-cyan-200" />{profile.studentId}</span>}
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 break-all"><Mail className="h-3.5 w-3.5 shrink-0 text-cyan-200" />{profile.email || user.email || '邮箱未设置'}</span>
      </div>
    </div>
  );
}

function StudentAccountHero({
  profile,
  user,
  uploading,
  fileInputRef,
  onAvatarChange,
  badge,
}: CommonProfileViewProps & { badge: string }) {
  return (
    <section className="grid gap-6 border-b border-white/[0.08] pb-7 md:grid-cols-[160px_1fr] md:items-center lg:grid-cols-[180px_1fr]">
      <ProfileAvatar
        displayName={profile.name || user.name}
        avatar={profile.avatar || user.avatar}
        uploading={uploading}
        badge={badge}
        fileInputRef={fileInputRef}
        onChange={onAvatarChange}
      />
      <StudentAccountHeading profile={profile} user={user} />
    </section>
  );
}

function StudentProfileView(props: CommonProfileViewProps) {
  const { profile, user, uploading, fileInputRef, onAvatarChange, onLogout } = props;
  const {
    loading: achievementsLoading,
    refreshing: achievementsRefreshing,
    error: achievementsError,
    accessErrorStatus,
    dataProvenance,
    asOf,
    sampleSize,
    userProgress,
    calculateStats,
    refetch: refetchAchievements,
  } = useAchievements();

  const achievementStats = calculateStats();
  const stats = profile.stats || {};
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
    const activityEvents = (profile.recentActivity || []).slice(0, 5).map((activity, index) => ({
      key: `activity-${index}`,
      date: activity.createdAt,
      title: activity.details?.name || getProfileActivityLabel(activity.action),
      desc: activity.details?.score != null ? `得分 ${activity.details.score}` : activity.details?.moduleId || '学习活动',
    }));
    return [...achievementEvents, ...activityEvents].slice(0, 6);
  }, [profile.recentActivity, unlocked]);

  const provenanceNotice = dataProvenance ? (
    <div
      role="status"
      className={cn(
        'mt-5 rounded-md border px-4 py-3 text-xs leading-5',
        dataProvenance.mode === 'REAL'
          ? 'border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100'
          : 'border-amber-300/25 bg-amber-300/[0.07] text-amber-100',
      )}
    >
      <div><span className="font-semibold">{dataProvenance.label}：</span>{dataProvenance.note}</div>
      {asOf && sampleSize && (
        <div className="mt-1 text-[11px] opacity-75">
          截至 {new Date(asOf).toLocaleString('zh-CN', { hour12: false })} ·
          勋章记录 n={sampleSize.unlockedAchievementRecords} · 学习进度 n={sampleSize.learningProgressRecords} ·
          测验作答 n={sampleSize.quizAttempts} · 实验记录 n={sampleSize.experimentRecords}
        </div>
      )}
    </div>
  ) : null;

  if (achievementsLoading) {
    return (
      <>
        <StudentAccountHero {...props} badge="学生账户" />
        <div role="status" aria-live="polite" className="mt-6 flex min-h-48 flex-col items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-cyan-200 motion-reduce:animate-none" />
          <div className="mt-3 text-sm font-semibold text-slate-100">正在读取学习画像</div>
          <p className="mt-1 text-xs text-slate-500">正在核对学习记录、勋章与积分，请稍候。</p>
        </div>
      </>
    );
  }

  if (achievementsError) {
    const needsLogin = accessErrorStatus === 401;
    const forbidden = accessErrorStatus === 403;
    return (
      <>
        <StudentAccountHero {...props} badge={needsLogin ? '登录已失效' : forbidden ? '画像不适用' : '画像读取失败'} />
        <div role="alert" className="mt-6 rounded-md border border-amber-300/25 bg-amber-300/[0.07] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-amber-100">
                {needsLogin ? '需要重新登录以读取学习画像' : forbidden ? '当前账号无权读取学生学习画像' : '学习画像暂时无法读取'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-amber-50/70">当前未展示任何勋章、积分或进度数值，避免把读取失败误写为 0。</p>
              {needsLogin ? (
                <Link
                  href="/login?role=student&from=%2Fprofile"
                  onClick={() => { void onLogout(); }}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] focus:outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  <LogIn className="h-4 w-4" />重新登录并返回
                </Link>
              ) : forbidden ? (
                <Link href="/settings" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-200/30 px-4 text-sm font-semibold text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-200">
                  <Settings className="h-4 w-4" />查看账户与安全
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => void refetchAchievements(true)}
                  disabled={achievementsRefreshing}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-200/30 bg-amber-200/[0.08] px-4 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/[0.12] focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={cn('h-4 w-4', achievementsRefreshing && 'animate-spin motion-reduce:animate-none')} />
                  {achievementsRefreshing ? '正在重试' : '重新读取学习画像'}
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!hasStudentLearningEvidence(profile, userProgress)) {
    return (
      <>
        <StudentAccountHero {...props} badge="画像待建立" />
        {provenanceNotice}
        <div className="mt-6 grid gap-4 rounded-md border border-white/[0.08] bg-white/[0.035] p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Target className="h-5 w-5 text-cyan-200" />尚未产生学习画像数据
            </div>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">资料已读取成功，但尚无可用于计算勋章、学习时长或分类进度的学习记录。完成一次课程任务、测评或实验后，平台会在这里形成反馈。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/tasks" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100">
              查看学习任务<ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/knowledge-graph" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.12] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300">
              浏览知识图谱
            </Link>
          </div>
        </div>
      </>
    );
  }

  const averageProgress = stats.averageProgress == null ? '—' : `${Math.round(stats.averageProgress)}%`;
  const learningDuration = formatLearningDuration(stats.totalLearningTime);

  return (
    <>
      <section className="grid gap-6 border-b border-white/[0.08] pb-7 md:grid-cols-[160px_1fr] md:items-center lg:grid-cols-[180px_1fr_auto]">
        <ProfileAvatar
          displayName={profile.name || user.name}
          avatar={profile.avatar || user.avatar}
          uploading={uploading}
          completionPercentage={achievementStats.completionPercentage}
          badge={`勋章 ${achievementStats.completionPercentage}%`}
          fileInputRef={fileInputRef}
          onChange={onAvatarChange}
        />
        <div>
          <StudentAccountHeading profile={profile} user={user} />
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2.5 py-1 font-mono text-[10px] text-cyan-100">
              {achievementStats.unlockedCount}/{achievementStats.totalCount} 勋章
            </span>
            <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 font-mono text-[10px] text-amber-100">
              平均进度 {averageProgress}
            </span>
            <Link
              href="/tasks"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
            >
              继续学习任务<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center md:col-span-2 lg:col-span-1">
          {([
            ['勋章', achievementStats.unlockedCount, Award],
            ['平台积分', achievementStats.totalPoints, Trophy],
            ['学习时长', learningDuration, Clock],
          ] satisfies StatItem[]).map(([label, value, Icon]) => (
            <div key={label} className="min-w-24 rounded-md border border-white/[0.08] bg-white/[0.035] px-3 py-3 gradient-border">
              <Icon className="mx-auto h-4 w-4 text-cyan-200" />
              <div className="mt-2 font-mono text-2xl font-semibold text-slate-50 stat-glow">{value}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {provenanceNotice}

      <section className="mt-7">
        <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-cyan-200" />精选勋章
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>
        {featured.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {featured.map((achievement) => (
              <Link key={achievement.id} href={`/achievements#${achievement.id}`} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 text-center transition hover:-translate-y-0.5 hover:border-cyan-300/40 glass-hover focus:outline-none focus:ring-2 focus:ring-cyan-300">
                <MedalDisc achievement={achievement} unlocked />
                <div className="mt-3 line-clamp-1 text-sm font-semibold text-slate-100">{achievement.title}</div>
                <div className="mt-1 line-clamp-1 text-[11px] text-slate-500">{achievement.description}</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-7 text-center text-sm text-slate-400">暂无已解锁勋章。完成实验或测评后会同步到这里。</div>
        )}
      </section>

      <section className="mt-7 grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <BarChart3 className="h-3.5 w-3.5 text-cyan-200" />分类进度
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categoryProgress.map((item) => (
              <div key={item.category} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4 glass-hover">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.label}</div>
                  <div className="font-mono text-sm text-cyan-100">{item.earned}/{item.total}</div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-white/[0.1]"><div className="h-full" style={{ width: `${item.pct}%`, background: item.color }} /></div>
                <div className="mt-2 font-mono text-[10px] text-slate-500">{item.pct}% 完成</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
            <History className="h-3.5 w-3.5 text-amber-200" />最近记录
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
              <div className="flex min-h-40 flex-col items-center justify-center text-center text-sm text-slate-500"><Target className="mb-2 h-6 w-6" />暂无学习活动记录</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export function HyperProfilePage() {
  const { user, loading: authLoading, refreshUser, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<ProfileError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileRequestVersion, setProfileRequestVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadLockRef = useRef(false);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setActionError(null);
    setNotice(null);

    if (!AVATAR_TYPES.has(file.type)) {
      setActionError('仅支持 PNG、JPG、GIF、WebP 图片');
      event.currentTarget.value = '';
      return;
    }
    if (file.size === 0 || file.size > AVATAR_MAX_SIZE) {
      setActionError('图片大小应大于 0 且不超过 2MB');
      event.currentTarget.value = '';
      return;
    }
    if (uploadLockRef.current) return;

    try {
      uploadLockRef.current = true;
      setUploading(true);
      const token = getStoredAccessToken();
      if (!token) {
        setActionError('登录状态已失效，请重新登录后再上传头像');
        await logout();
        return;
      }
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetchClientRequest('/api/upload/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }, CLIENT_WRITE_TIMEOUT_MS);

      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setActionError('登录状态已失效，请重新登录后再上传头像');
        await logout();
        return;
      }
      if (!response.ok) throw new Error(data.error || '上传失败');

      await refreshUser();
      setNotice('头像已保存，重新登录后仍会保留。');
    } catch (error) {
      setActionError(isAmbiguousClientFailure(error)
        ? '上传结果暂不确定，请刷新页面核对头像后再决定是否重试。'
        : error instanceof Error ? error.message : '上传失败');
    } finally {
      uploadLockRef.current = false;
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchProfile() {
      setProfileLoading(true);
      setProfileError(null);
      setProfile(null);

      try {
        const token = getStoredAccessToken();
        if (!token) {
          setProfileError({ kind: 'auth', message: '登录状态已失效，请重新登录后继续查看个人资料。' });
          return;
        }

        const response = await fetchClientRequest('/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS);
        const data = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (response.status === 401) {
          setProfileError({ kind: 'auth', message: '登录状态已失效，请重新登录后继续查看个人资料。' });
          return;
        }
        if (!response.ok) {
          setProfileError({
            kind: 'request',
            message: typeof data.error === 'string' ? data.error : '无法加载用户资料',
          });
          return;
        }

        const nextProfile = data.profile && typeof data.profile === 'object'
          ? data.profile as ProfileData
          : null;
        setProfile(nextProfile);
      } catch (error) {
        if (controller.signal.aborted) return;
        setProfileError({
          kind: 'request',
          message: error instanceof Error && error.message !== '请求超时'
            ? error.message
            : '用户资料读取超时，请检查网络后重试。',
        });
      } finally {
        if (!controller.signal.aborted) setProfileLoading(false);
      }
    }

    void fetchProfile();
    return () => controller.abort();
  }, [authLoading, user?.id, profileRequestVersion]);

  if (authLoading || profileLoading) {
    return (
      <div role="status" aria-live="polite" className="-m-4 flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center bg-[#070a0d] text-slate-100 sm:-m-6">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200 motion-reduce:animate-none" />
        <p className="mt-3 text-sm text-slate-400">{authLoading ? '正在核对登录状态' : '正在读取账户资料'}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="w-full max-w-md rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Shield className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">请先登录以查看个人资料。</p>
          <Link href="/login?from=%2Fprofile" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] focus:outline-none focus:ring-2 focus:ring-cyan-100">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (profileError) {
    const loginRole = user.role === 'STUDENT' ? 'student' : user.role === 'TEACHER' ? 'teacher' : '';
    const loginHref = `/login?${loginRole ? `role=${loginRole}&` : ''}from=%2Fprofile`;
    return (
      <div className="-m-4 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div role="alert" className="w-full max-w-lg rounded-md border border-amber-300/25 bg-amber-300/[0.07] p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-amber-200" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-amber-100">
                {profileError.kind === 'auth' ? '需要重新登录' : '无法加载用户资料'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-amber-50/75">{profileError.message}</p>
              <p className="mt-2 text-xs leading-5 text-amber-50/55">本页不会在读取失败时显示学习进度、勋章或时长零值。</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {profileError.kind === 'auth' ? (
                  <Link
                    href={loginHref}
                    onClick={() => { void logout(); }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    <LogIn className="h-4 w-4" />重新登录并返回
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setProfileRequestVersion((version) => version + 1)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    <RefreshCw className="h-4 w-4" />重新读取
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="-m-4 min-h-[calc(100dvh-3.5rem)] overflow-auto bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="mx-auto max-w-3xl rounded-md border border-white/[0.08] bg-white/[0.035] p-6">
          <div className="flex items-start gap-3">
            <CircleOff className="mt-0.5 h-6 w-6 shrink-0 text-cyan-200" />
            <div>
              <h1 className="text-lg font-semibold text-slate-100">账户资料尚未建立</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">接口已成功响应，但没有返回扩展资料。当前仅确认登录账户“{user.name}”及角色“{roleLabel(user.role)}”，学习画像暂不展示。</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setProfileRequestVersion((version) => version + 1)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] focus:outline-none focus:ring-2 focus:ring-cyan-100"
                >
                  <RefreshCw className="h-4 w-4" />重新读取
                </button>
                <Link href="/settings" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.12] px-4 text-sm font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-300">
                  <Settings className="h-4 w-4" />账户设置
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const commonProps: CommonProfileViewProps = {
    profile,
    user,
    uploading,
    fileInputRef,
    onAvatarChange: handleAvatarUpload,
    onLogout: logout,
  };

  return (
    <div className="-m-4 min-h-[calc(100dvh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
        {actionError && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">
            <AlertCircle className="h-4 w-4 shrink-0" />{actionError}
          </div>
        )}
        {notice && (
          <div role="status" aria-live="polite" className="mb-4 flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-3 py-2 text-xs text-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />{notice}
          </div>
        )}

        {user.role === 'STUDENT'
          ? <StudentProfileView {...commonProps} />
          : <EducatorProfileView {...commonProps} />}
      </div>
    </div>
  );
}
