'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  GitBranch,
  GraduationCap,
  Loader2,
  Medal,
  Search,
  Send,
  Target,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { getPointsByLevel } from '@/lib/knowledge-points';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ACHIEVEMENTS_V2, type Achievement } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBanner } from '@/components/shared/StatusBanner';

interface TeacherStudent {
  id?: string;
  name: string;
  studentId?: string | null;
  class?: string | null;
  chapterScores?: number[];
  avgScore?: number;
  avgQuizScore?: number;
  totalTimeSpent?: number;
  experimentsCompleted?: number;
  experimentsTotal?: number;
  activityCount?: number;
  chapterMastery?: Record<string, number>;
  classes?: { id: string; name: string }[];
}

interface TeacherExperiment {
  id: string;
  name: string;
  completed: number;
}

interface TeacherDashboardData {
  overview: {
    totalStudents: number;
    activeToday: number;
    avgQuizScore: number;
    avgExpCompletion: number;
    totalTimeSpent?: number;
    avgTimeSpent?: number;
  };
  classes?: { id: string; name: string; courseName?: string; semester?: string }[];
  students: TeacherStudent[];
  experiments: TeacherExperiment[];
  alertStudents: { id?: string; name: string; studentId?: string | null; avg: number; experimentsCompleted?: number; experimentsTotal?: number; weakChapters?: { chapter: string; progress: number }[] }[];
}

type StatItem = [label: string, value: string | number, icon: LucideIcon];

const EXPORT_TYPES = [
  { value: 'student-summary', label: '学生综合报告' },
  { value: 'quiz-detail', label: '测验详细记录' },
  { value: 'activity-log', label: '学习活动日志' },
  { value: 'experiment-detail', label: '实验详细记录' },
] as const;

const teacherMedals = ACHIEVEMENTS_V2
  .filter((achievement) => achievement.category === 'social' || achievement.category === 'progress')
  .slice(0, 5);

function initialOf(name?: string | null) {
  return (name || 'U').trim().charAt(0).toUpperCase() || 'U';
}

// 章节号 → "第N章 名称"；'0' 或未知章节归入"未分类"
const CHAPTER_NAME_MAP = new Map(
  getPointsByLevel(1).map((p) => [String(p.chapter), `第${p.chapter}章 ${p.name}`]),
);
function chapterLabel(chapterId?: string | null) {
  if (!chapterId) return '未分类';
  const key = String(chapterId).trim().replace(/^ch/i, '');
  return CHAPTER_NAME_MAP.get(key) || '未分类';
}

function achievementColor(achievement?: Achievement) {
  if (!achievement) return '#67e8f9';
  if (achievement.rarity === 'legendary') return '#fbbf24';
  if (achievement.rarity === 'epic') return '#c084fc';
  if (achievement.rarity === 'rare') return '#60a5fa';
  return '#67e8f9';
}

function formatSecondsAsHours(value?: number): string {
  if (!value) return '0 min';
  const totalMinutes = Math.round(value / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function HyperTeacherPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [interventionData, setInterventionData] = useState<{
    interventions: { studentId: string; name: string; studentCode: string | null; interventionDate: string; preAvg: number; postAvg: number; gain: number; preCount: number; postCount: number }[];
    summary: { totalStudents: number; withBothScores: number; improved: number; improvementRate: number; avgGain: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedMedalId, setSelectedMedalId] = useState(teacherMedals[0]?.id || ACHIEVEMENTS_V2[0]?.id || '');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [exportType, setExportType] = useState('student-summary');
  const [exportClassId, setExportClassId] = useState('all');
  const [exportLoading, setExportLoading] = useState(false);
  // Push task dialog state
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushScope, setPushScope] = useState<'ALL' | 'CLASS'>('ALL');
  const [pushClassId, setPushClassId] = useState('');
  const [pushPathType, setPushPathType] = useState<'BASIC' | 'ADVANCED'>('BASIC');
  const [pushModuleCount, setPushModuleCount] = useState(5);
  // Assign preclass dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignExpId, setAssignExpId] = useState(experimentCatalog[0]?.id || 'exp01');
  const [assignScope, setAssignScope] = useState<'ALL' | 'CLASS'>('ALL');
  const [assignClassId, setAssignClassId] = useState('');

  // Teaching cycle state
  const [cycleData, setCycleData] = useState<{
    preClass: {
      totalAssigned: number; completedAssigned: number; inProgressAssigned: number; notStartedAssigned: number;
      studentsWithAssigned: number; studentsCompletedAll: number; completionRate: number;
    };
    inClass: {
      totalEvents: number; eventsByType: Record<string, number>; totalDuration: number;
      avgDurationPerStudent: number; recentActiveStudents: number;
      dailyActivity: { date: string; events: number; activeStudents: number }[];
      participationRate: number;
    };
    postClass: {
      totalStudents: number; improvedCount: number; declinedCount: number; stableCount: number;
      avgFirstHalfScore: number; avgSecondHalfScore: number;
      chapterMasteryDist: Record<string, { high: number; medium: number; low: number }>;
      topStudents: { name: string; avgScore: number }[];
    };
  } | null>(null);

  useEffect(() => {
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;
    async function fetchCycle() {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const res = await fetch('/api/teacher/teaching-cycle', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          // 空班级/旧接口可能缺字段，统一补默认值防止渲染崩溃
          setCycleData({
            preClass: {
              totalAssigned: 0, completedAssigned: 0, inProgressAssigned: 0, notStartedAssigned: 0,
              studentsWithAssigned: 0, studentsCompletedAll: 0, completionRate: 0,
              ...(json?.preClass || {}),
            },
            inClass: {
              totalEvents: 0, eventsByType: {}, totalDuration: 0, avgDurationPerStudent: 0,
              recentActiveStudents: 0, dailyActivity: [], participationRate: 0,
              ...(json?.inClass || {}),
            },
            postClass: {
              totalStudents: 0, improvedCount: 0, declinedCount: 0, stableCount: 0,
              avgFirstHalfScore: 0, avgSecondHalfScore: 0, chapterMasteryDist: {}, topStudents: [],
              ...(json?.postClass || {}),
            },
          });
        }
      } catch { /* ignore */ }
    }
    fetchCycle();
  }, [user]);

  useEffect(() => {
    async function fetchDashboard() {
      if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/teacher/dashboard', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error('无法加载教师仪表板数据');
        const json = await response.json();
        setData(json);
      } catch (dashboardError) {
        setError(dashboardError instanceof Error ? dashboardError.message : '无法加载教师仪表板数据');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();

    // Fetch intervention effect data
    async function fetchInterventions() {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        const res = await fetch('/api/teacher/intervention-effect', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setInterventionData(json);
        }
      } catch { /* non-critical */ }
    }
    fetchInterventions();
  }, [user]);

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students || []).filter((student) =>
      !q || `${student.name} ${student.studentId || ''} ${student.class || ''}`.toLowerCase().includes(q)
    );
  }, [data?.students, query]);

  const selectedStudent = students.find((student) => (student.id || student.studentId || student.name) === selectedStudentId) || students[0] || null;
  // 干预明细只列推送前后都有测验数据的学生，其余归入"数据不足"
  const interventionsWithBoth = (interventionData?.interventions || []).filter((iv) => iv.preCount > 0 && iv.postCount > 0);
  const interventionsInsufficient = (interventionData?.interventions.length || 0) - interventionsWithBoth.length;
  const selectedMedal = ACHIEVEMENTS_V2.find((achievement) => achievement.id === selectedMedalId) || teacherMedals[0] || ACHIEVEMENTS_V2[0];
  const maxExperimentCompleted = Math.max(...(data?.experiments || []).map((experiment) => experiment.completed), 1);

  const exportGradesCsv = () => {
    if (!data?.students?.length) {
      toast({ title: '暂无可导出数据', description: '教师仪表板未返回学生成绩。' });
      return;
    }

    const headers = ['姓名', '学号', '班级', '平均分'];
    const rows = data.students.map((student) => [
      student.name,
      student.studentId || '',
      student.class || '',
      String(student.avgScore ?? student.avgQuizScore ?? 0),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `grades_${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const pushLearningTask = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      const body: Record<string, unknown> = {
        scope: pushScope,
        pathType: pushPathType,
        moduleCount: pushModuleCount,
      };
      // 指定班级时按班级 ID 传给后端（走 ClassEnrollment 关系）
      if (pushScope === 'CLASS') body.targetClassId = pushClassId;
      const response = await fetch('/api/teacher/push-learning-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('推送失败');
      const result = await response.json();
      toast({ title: '已推送', description: `已为 ${result.created || 0} 名学生创建学习路径。` });
      setShowPushDialog(false);
    } catch (pushError) {
      toast({
        title: '推送失败',
        description: pushError instanceof Error ? pushError.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const assignPreclass = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      const body: Record<string, unknown> = { experimentId: assignExpId, scope: assignScope };
      // 指定班级时按班级 ID 传给后端（走 ClassEnrollment 关系）
      if (assignScope === 'CLASS') body.targetClassId = assignClassId;
      const response = await fetch('/api/teacher/assign-preclass', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('布置失败');
      const result = await response.json();
      const skipped = result.skipped || 0;
      toast({
        title: '已布置',
        description: `新分配 ${result.assigned || 0} 名学生${skipped ? `，${skipped} 名已有该实验进度未重复布置` : ''}。`,
      });
      setShowAssignDialog(false);
    } catch (assignError) {
      toast({
        title: '布置失败',
        description: assignError instanceof Error ? assignError.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const awardMedal = async () => {
    if (!selectedStudent?.id || !selectedMedal?.id) {
      toast({ title: '无法授予', description: '请先选择学生和徽章。', variant: 'destructive' });
      return;
    }

    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/achievements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          achievementId: selectedMedal.id,
          targetUserId: selectedStudent.id,
          reason,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || result.error || '授予失败');
      }
      if (result.success === false) {
        // 后端用 success:false 表示「成就已解锁」，不算错误，提示更友好
        toast({ title: '已授予过', description: `${selectedStudent.name} 已经获得过“${selectedMedal.title}”，不重复授予。` });
        return;
      }
      toast({ title: '已授予徽章', description: `${selectedStudent.name} 已获得“${selectedMedal.title}”。` });
      setReason('');
    } catch (awardError) {
      toast({
        title: '授予失败',
        description: awardError instanceof Error ? awardError.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({ type: exportType });
      if (exportClassId && exportClassId !== 'all') params.set('classId', exportClassId);
      const response = await fetch(`/api/teacher/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || '导出失败');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      anchor.download = match ? decodeURIComponent(match[1].replace(/['"]/g, '')) : `${exportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      toast({
        title: '导出失败',
        description: exportError instanceof Error ? exportError.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
      </div>
    );
  }

  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    return (
      <div className="-m-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100">
        <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-200" />
          <p className="mt-3 text-sm text-amber-50">仅教师和管理员可访问此页面。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-6 grid min-h-[calc(100vh-3.5rem)] animate-fade-in bg-[#070a0d] text-slate-100 xl:grid-cols-[320px_1fr_360px]">
      <aside className="border-b border-white/[0.08] bg-[#0c1117] xl:border-b-0 xl:border-r">
        <div className="border-b border-white/[0.08] p-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">学生 · 真实班级数据</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索学生..."
              className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-auto xl:max-h-[calc(100vh-8rem)]">
          {students.length ? students.map((student) => {
            const key = student.id || student.studentId || student.name;
            const active = selectedStudent === student;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedStudentId(key)}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.05]',
                  active && 'border-l-2 border-l-cyan-300 bg-cyan-300/[0.08] pl-[14px]',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-sm font-semibold text-[#061014]">
                  {initialOf(student.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{student.name}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{student.studentId || student.class || '未登记'}</div>
                </div>
                <div className="font-mono text-sm text-cyan-100">{Math.round(student.avgScore ?? student.avgQuizScore ?? 0)}</div>
              </button>
            );
          }) : (
            <EmptyState title="暂无学生数据" className="text-center" />
          )}
        </div>
      </aside>

      <main className="min-w-0 overflow-auto p-5 md:p-7">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Users className="h-3.5 w-3.5" />
              Teacher Console · 教学仪表板
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">教师工作台</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              汇聚班级学情、预警干预与任务推送，数据实时来自平台学习记录。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportGradesCsv} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <FileDown className="h-4 w-4" />
              导出
            </button>
            <button onClick={() => setShowAssignDialog(true)} className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <BookOpen className="h-4 w-4" />
              布置课前
            </button>
            <button onClick={() => setShowPushDialog(true)} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
              <Send className="h-4 w-4" />
              推送任务
            </button>
            <Link href="/teacher/classes" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <Users className="h-4 w-4" />
              班级管理
            </Link>
            <Link href="/teacher/pushed" className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <BarChart3 className="h-4 w-4" />
              推送回查
            </Link>
            <Link href="/teacher/report" className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14]">
              <FileText className="h-4 w-4" />
              教学报告
            </Link>
            <Link href="/admin/knowledge-graph" className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14]">
              <GitBranch className="h-4 w-4" />
              维护图谱
            </Link>
          </div>
        </div>

        {error && (
          <StatusBanner variant="warning" className="mb-5 items-center py-2 text-xs">
            {error}
          </StatusBanner>
        )}

        <section className="stagger-children mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {([
            ['学生总数', data?.overview?.totalStudents || 0, Users],
            ['今日活跃', data?.overview?.activeToday || 0, CheckCircle2],
            ['平均测验', `${Math.round(data?.overview?.avgQuizScore || 0)}%`, BarChart3],
            ['实验完成', `${Math.round(data?.overview?.avgExpCompletion || 0)}%`, Target],
            ['平均时长', formatSecondsAsHours(data?.overview?.avgTimeSpent), Clock],
          ] satisfies StatItem[]).map(([label, value, Icon]) => (
            <div key={label} className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md"><Icon className="h-4 w-4 text-cyan-100" /></div>
              <div className="mt-3 font-mono text-2xl font-semibold text-slate-50 stat-glow">{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          ))}
        </section>

        {/* Teaching Cycle: Pre-class → In-class → Post-class */}
        {cycleData && (
          <section className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-slate-50">教学周期闭环</h2>
              <span className="text-xs text-slate-500">课前 → 课中 → 课后</span>
            </div>
            {cycleData.postClass.totalStudents === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="暂无班级学生数据"
                description="创建班级并邀请学生加入后，这里会展示课前-课中-课后的闭环数据。"
                action={{ label: '去班级管理', href: '/teacher/classes' }}
              />
            ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {/* Pre-class */}
              <div className="glass-hover transition-all rounded-md border border-cyan-300/20 bg-cyan-300/[0.04]">
                <div className="border-b border-cyan-300/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <BookOpen className="h-4 w-4" />
                    课前 · 预习任务
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-3xl font-semibold text-slate-50">{cycleData.preClass.completionRate}%</div>
                    <div className="text-xs text-slate-500">完成率</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${cycleData.preClass.completionRate}%` }} />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">已布置实验</span>
                      <span className="font-mono text-cyan-100">{cycleData.preClass.totalAssigned}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">已完成</span>
                      <span className="font-mono text-emerald-200">{cycleData.preClass.completedAssigned}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">进行中</span>
                      <span className="font-mono text-amber-200">{cycleData.preClass.inProgressAssigned}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">未开始</span>
                      <span className="font-mono text-red-200">{cycleData.preClass.notStartedAssigned}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* In-class */}
              <div className="glass-hover transition-all rounded-md border border-emerald-300/20 bg-emerald-300/[0.04]">
                <div className="border-b border-emerald-300/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                    <TrendingUp className="h-4 w-4" />
                    课中 · 学习互动
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-3xl font-semibold text-slate-50">{cycleData.inClass.participationRate}%</div>
                    <div className="text-xs text-slate-500">近7日参与率</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${cycleData.inClass.participationRate}%` }} />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">累计学习事件</span>
                      <span className="font-mono text-emerald-100">{cycleData.inClass.totalEvents}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">近7日活跃学生</span>
                      <span className="font-mono text-emerald-100">{cycleData.inClass.recentActiveStudents}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">人均学习时长</span>
                      <span className="font-mono text-amber-200">{formatSecondsAsHours(cycleData.inClass.avgDurationPerStudent)}</span>
                    </div>
                  </div>
                  {/* Daily activity spark */}
                  {cycleData.inClass.dailyActivity.length > 0 && (
                    <div className="mt-3 flex items-end gap-1">
                      {cycleData.inClass.dailyActivity.map((day) => {
                        const maxEvents = Math.max(...cycleData.inClass.dailyActivity.map((d) => d.events), 1);
                        const h = Math.max(4, (day.events / maxEvents) * 32);
                        return (
                          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                            <div className="w-full rounded-sm bg-emerald-300/30" style={{ height: `${h}px` }} />
                            <div className="font-mono text-[9px] text-slate-500">{day.date.slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Post-class */}
              <div className="glass-hover transition-all rounded-md border border-amber-300/20 bg-amber-300/[0.04]">
                <div className="border-b border-amber-300/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                    <Award className="h-4 w-4" />
                    课后 · 测评提升
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div>
                      <div className="font-mono text-[10px] text-slate-500">前期平均</div>
                      <div className="font-mono text-lg font-semibold text-slate-300">{cycleData.postClass.avgFirstHalfScore}%</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                    <div>
                      <div className="font-mono text-[10px] text-slate-500">后期平均</div>
                      <div className="font-mono text-lg font-semibold text-amber-200">{cycleData.postClass.avgSecondHalfScore}%</div>
                    </div>
                    <div className="ml-auto">
                      <div className="font-mono text-[10px] text-slate-500">提升</div>
                      <div className={`font-mono text-lg font-semibold ${cycleData.postClass.avgSecondHalfScore >= cycleData.postClass.avgFirstHalfScore ? 'text-emerald-200' : 'text-red-200'}`}>
                        {cycleData.postClass.avgSecondHalfScore >= cycleData.postClass.avgFirstHalfScore ? '+' : ''}{cycleData.postClass.avgSecondHalfScore - cycleData.postClass.avgFirstHalfScore}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-200">成绩提升</span>
                      <span className="font-mono text-emerald-200">{cycleData.postClass.improvedCount} 人</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">基本稳定</span>
                      <span className="font-mono text-slate-300">{cycleData.postClass.stableCount} 人</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-red-200">有所下滑</span>
                      <span className="font-mono text-red-200">{cycleData.postClass.declinedCount} 人</span>
                    </div>
                  </div>
                  {cycleData.postClass.topStudents.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Top Students</div>
                      {cycleData.postClass.topStudents.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{i + 1}. {s.name}</span>
                          <span className="font-mono text-amber-100">{s.avgScore}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            )}
          </section>
        )}

        <section className="mb-6 glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="border-b border-white/[0.08] p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
              <FileDown className="h-5 w-5 text-cyan-200" />
              数据导出
            </h2>
            <p className="mt-1 text-xs text-slate-500">按类型导出学生学习数据为 CSV，可用 Excel 或 SPSS 打开分析。</p>
          </div>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1.5 block text-xs text-slate-400">导出类型</label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                  {EXPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="focus:bg-cyan-300/10 focus:text-cyan-100">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1.5 block text-xs text-slate-400">班级筛选</label>
              <Select value={exportClassId} onValueChange={setExportClassId}>
                <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                  <SelectItem value="all" className="focus:bg-cyan-300/10 focus:text-cyan-100">全部班级</SelectItem>
                  {(data?.classes || []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="focus:bg-cyan-300/10 focus:text-cyan-100">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportLoading}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-5 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:opacity-50"
            >
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              导出 CSV
            </button>
            {/* 打开报告页自动唤起浏览器打印，另存为 PDF 中文不乱码 */}
            <button
              type="button"
              onClick={() => window.open('/teacher/report?print=1', '_blank')}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-300 px-5 text-sm font-semibold text-[#001014] hover:bg-emerald-200"
            >
              <FileText className="h-4 w-4" />
              打印 / 导出PDF
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="text-lg font-semibold text-slate-50">实验完成分布</h2>
              <p className="mt-1 text-xs text-slate-500">各实验与项目的班级完成人数分布。</p>
            </div>
            <div className="space-y-3 p-4">
              {(data?.experiments || []).length ? data!.experiments.map((experiment) => (
                <div key={experiment.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-300">{experiment.name}</span>
                    <span className="font-mono text-cyan-100">{experiment.completed}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.round((experiment.completed / maxExperimentCompleted) * 100)}%` }} />
                  </div>
                </div>
              )) : (
                <EmptyState centered title="暂无实验完成数据" className="min-h-44" />
              )}
            </div>
          </div>

          <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                预警学生 · 干预中心
              </h2>
              <p className="mt-1 text-xs text-slate-500">平均分低于60的学生，含薄弱章节与一键推送。</p>
            </div>
            <div className="p-4">
              {(data?.alertStudents || []).length ? (
                <div className="space-y-3">
                  {data!.alertStudents.map((student) => (
                    <div key={student.id || student.name} className="hover:bg-white/[0.04] transition-colors rounded-md border border-red-300/20 bg-red-300/[0.06]">
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-300/20 text-xs font-semibold text-red-100">
                            {(student.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-red-50">{student.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{student.studentId || '未登记'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono text-lg font-semibold text-red-100">{Math.round(student.avg)}%</div>
                            <div className="font-mono text-[10px] text-slate-500">实验 {student.experimentsCompleted ?? 0}/{student.experimentsTotal ?? 0}</div>
                          </div>
                          {student.id && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  setActionLoading(true);
                                  const token = localStorage.getItem('accessToken');
                                  const res = await fetch('/api/teacher/push-learning-task', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                    },
                                    body: JSON.stringify({ scope: 'STUDENTS', studentIds: [student.id], pathType: 'BASIC', moduleCount: 5 }),
                                  });
                                  if (!res.ok) throw new Error('推送失败');
                                  const result = await res.json();
                                  toast({ title: '已推送', description: `已为 ${student.name} 创建基础强化学习路径。` });
                                } catch (err) {
                                  toast({ title: '推送失败', description: err instanceof Error ? err.message : '请稍后重试', variant: 'destructive' });
                                } finally {
                                  setActionLoading(false);
                                }
                              }}
                              disabled={actionLoading}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-300/20 px-3 text-xs font-semibold text-red-100 hover:bg-red-300/30 disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" />
                              推送基础路径
                            </button>
                          )}
                        </div>
                      </div>
                      {student.weakChapters && student.weakChapters.length > 0 && (
                        <div className="border-t border-red-300/10 px-3 py-2">
                          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">薄弱章节</div>
                          <div className="flex flex-wrap gap-2">
                            {student.weakChapters.map((ch) => (
                              <div key={ch.chapter} className="flex items-center gap-1.5 rounded-md border border-red-300/15 bg-red-300/[0.08] px-2 py-1">
                                <span className="text-xs text-red-200">{chapterLabel(ch.chapter)}</span>
                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.08]">
                                  <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-amber-400" style={{ width: `${ch.progress}%` }} />
                                </div>
                                <span className="font-mono text-[10px] text-red-100">{ch.progress}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">
                  <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-300" />
                  全班成绩良好，暂无预警
                </div>
              )}
            </div>
          </div>

          {/* Intervention Effect Tracking */}
          {interventionData && interventionData.summary.totalStudents > 0 && (
            <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="border-b border-white/[0.08] p-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                  <TrendingUp className="h-5 w-5 text-emerald-300" />
                  干预效果追踪
                </h2>
                <p className="mt-1 text-xs text-slate-500">推送学习任务后，学生测验成绩变化对比。</p>
              </div>
              <div className="p-4">
                {/* Summary cards */}
                <div className="mb-4 grid grid-cols-4 gap-3">
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-slate-50">{interventionData.summary.totalStudents}</div>
                    <div className="text-[10px] text-slate-500">干预学生</div>
                  </div>
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-emerald-200">{interventionData.summary.improvementRate}%</div>
                    <div className="text-[10px] text-slate-500">改善率</div>
                  </div>
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-cyan-200">{interventionData.summary.avgGain > 0 ? '+' : ''}{interventionData.summary.avgGain}</div>
                    <div className="text-[10px] text-slate-500">平均提升</div>
                  </div>
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-amber-200">{interventionData.summary.improved}/{interventionData.summary.withBothScores}</div>
                    <div className="text-[10px] text-slate-500">提升人数</div>
                  </div>
                </div>
                {/* Per-student comparison */}
                {interventionsWithBoth.length > 0 && (
                  <div className="space-y-2">
                    {interventionsWithBoth.slice(0, 10).map((iv) => (
                      <div key={iv.studentId} className="flex items-center gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:bg-white/[0.04] transition-colors">
                        <div className="w-20 truncate text-sm font-medium text-slate-200">{iv.name}</div>
                        <div className="flex flex-1 items-center gap-2">
                          <span className="font-mono text-xs text-red-200">{iv.preAvg}%</span>
                          <span className="text-slate-600">→</span>
                          <span className={cn('font-mono text-xs', iv.gain > 0 ? 'text-emerald-200' : iv.gain < 0 ? 'text-red-200' : 'text-slate-400')}>{iv.postAvg}%</span>
                          <span className={cn('ml-1 inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-semibold', iv.gain > 0 ? 'bg-emerald-300/15 text-emerald-200' : iv.gain < 0 ? 'bg-red-300/15 text-red-200' : 'bg-white/[0.06] text-slate-400')}>
                            {iv.gain > 0 ? '+' : ''}{iv.gain}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-600">前 {iv.preCount} 次 / 后 {iv.postCount} 次</div>
                      </div>
                    ))}
                  </div>
                )}
                {interventionsInsufficient > 0 && (
                  <p className="mt-3 text-xs text-slate-500">
                    另有 {interventionsInsufficient} 名学生推送前后测验数据不足，暂未列入对比。
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Selected Student Detail */}
        {selectedStudent && (
          <section className="mt-5 glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                <Users className="h-5 w-5 text-cyan-200" />
                {selectedStudent.name}
                <span className="font-mono text-xs text-slate-500">
                  {selectedStudent.studentId || '未登记学号'}
                </span>
              </h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">平均测验</div>
                <div className="mt-1 font-mono text-xl text-cyan-100">
                  {Math.round(selectedStudent.avgScore ?? selectedStudent.avgQuizScore ?? 0)}%
                </div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">实验完成</div>
                <div className="mt-1 font-mono text-xl text-emerald-100">
                  {selectedStudent.experimentsCompleted ?? 0}/{selectedStudent.experimentsTotal ?? 0}
                </div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">学习时长</div>
                <div className="mt-1 font-mono text-xl text-amber-100">
                  {formatSecondsAsHours(selectedStudent.totalTimeSpent)}
                </div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">今日活动</div>
                <div className="mt-1 font-mono text-xl text-slate-100">
                  {(selectedStudent as any).activityCount ?? 0} 次
                </div>
              </div>
            </div>
            {Object.keys((selectedStudent as any).chapterMastery || {}).length > 0 && (
              <div className="border-t border-white/[0.06] p-4">
                <div className="mb-2 text-xs font-semibold text-slate-400">章节掌握度</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {Object.entries((selectedStudent as any).chapterMastery as Record<string, number>).map(([ch, progress]) => (
                    <div key={ch} className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="text-[10px] text-slate-500">{chapterLabel(ch)}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full ${progress >= 80 ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : progress >= 50 ? 'bg-gradient-to-r from-cyan-300 to-amber-300' : 'bg-gradient-to-r from-red-400 to-amber-400'}`}
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-300">{Math.round(progress)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {((selectedStudent as any).classes || []).length > 0 && (
              <div className="border-t border-white/[0.06] p-4">
                <div className="mb-1 text-xs text-slate-500">所属班级</div>
                <div className="flex flex-wrap gap-1.5">
                  {((selectedStudent as any).classes as { id: string; name: string }[]).map((c) => (
                    <span key={c.id} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-0.5 text-xs text-slate-300">{c.name}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <aside className="border-t border-white/[0.08] bg-[#0c1117] p-5 xl:border-l xl:border-t-0">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">课堂表彰 · 写入成就记录</div>
        <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-lg font-semibold text-[#061014]">
              {initialOf(selectedStudent?.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-100">{selectedStudent?.name || '未选择学生'}</div>
              <div className="truncate font-mono text-[10px] text-slate-500">{selectedStudent?.studentId || selectedStudent?.class || '暂无学生信息'}</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {teacherMedals.map((achievement) => (
              <button
                key={achievement.id}
                type="button"
                onClick={() => setSelectedMedalId(achievement.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition hover:border-cyan-300/40',
                  selectedMedal?.id === achievement.id ? 'border-cyan-300/60 bg-cyan-300/[0.08]' : 'border-white/[0.08] bg-black/20',
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08]" style={{ color: achievementColor(achievement) }}>
                  <Award className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-100">{achievement.title}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{achievement.id}</div>
                </div>
              </button>
            ))}
          </div>

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="记录课堂表现、实验报告或答疑依据..."
            className="mt-4 w-full resize-none rounded-md border border-white/[0.09] bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
          />

          <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/[0.08] p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/[0.08] text-amber-100">
              <Medal className="h-7 w-7" />
            </div>
            <div className="mt-3 text-base font-semibold text-slate-50">{selectedMedal?.title || '课堂表彰'}</div>
            <div className="mt-1 font-mono text-[10px] text-slate-500">{selectedMedal?.id || 'ACHIEVEMENT'} · 预览</div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{reason || selectedMedal?.description || '填写理由后用于课堂记录。'}</p>
          </div>

          <button
            type="button"
            onClick={awardMedal}
            disabled={actionLoading || !selectedStudent?.id}
            title={!selectedStudent?.id ? '请先在左侧选择一名学生' : undefined}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-semibold text-[#1b1300] hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Medal className="h-4 w-4" />}
            授予徽章
          </button>
          {!selectedStudent?.id && (
            <p className="mt-2 text-center text-[11px] text-slate-500">请先在左侧学生列表中选择一名学生再授予徽章</p>
          )}
        </div>
      </aside>

      {/* Push Task Dialog */}
      {showPushDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPushDialog(false)}>
          <div className="w-full max-w-md rounded-lg border border-white/[0.12] bg-[#161b22] p-6 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">推送学习任务</h2>
              <button type="button" onClick={() => setShowPushDialog(false)} className="text-slate-400 hover:text-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">推送范围</label>
                <Select
                  value={pushScope}
                  onValueChange={(v) => {
                    setPushScope(v as 'ALL' | 'CLASS');
                    // 切到指定班级时默认选中第一个真实班级，避免空白选项
                    if (v === 'CLASS' && !(data?.classes || []).some((c) => c.id === pushClassId)) {
                      setPushClassId(data?.classes?.[0]?.id || '');
                    }
                  }}
                >
                  <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                    <SelectItem value="ALL">全部学生</SelectItem>
                    <SelectItem value="CLASS">指定班级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pushScope === 'CLASS' && (
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">目标班级</label>
                  <Select value={pushClassId} onValueChange={setPushClassId}>
                    <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue placeholder="选择班级" /></SelectTrigger>
                    <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                      {(data?.classes || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(data?.classes || []).length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-200">还没有可选班级，请先到「班级管理」创建班级。</p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">任务类型</label>
                <Select value={pushPathType} onValueChange={(v) => setPushPathType(v as 'BASIC' | 'ADVANCED')}>
                  <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                    <SelectItem value="BASIC">基础强化 — 面向基础薄弱学生</SelectItem>
                    <SelectItem value="ADVANCED">进阶提升 — 面向能力较强学生</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">模块数量（1-10 章）</label>
                <input type="range" min={1} max={10} value={pushModuleCount} onChange={(e) => setPushModuleCount(Number(e.target.value))} className="w-full accent-cyan-400" />
                <div className="text-center font-mono text-sm text-cyan-200">{pushModuleCount} 章</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowPushDialog(false)} className="h-9 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06]">取消</button>
              <button type="button" onClick={pushLearningTask} disabled={actionLoading || (pushScope === 'CLASS' && !pushClassId)} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:opacity-50">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                确认推送
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Preclass Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAssignDialog(false)}>
          <div className="w-full max-w-md rounded-lg border border-white/[0.12] bg-[#161b22] p-6 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">布置课前实验</h2>
              <button type="button" onClick={() => setShowAssignDialog(false)} className="text-slate-400 hover:text-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">选择实验</label>
                <Select value={assignExpId} onValueChange={setAssignExpId}>
                  <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100 max-h-[240px]">
                    {experimentCatalog.map((exp) => (
                      <SelectItem key={exp.id} value={exp.id}>
                        <span className="font-mono text-xs text-slate-500">{exp.id}</span> {exp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">分配范围</label>
                <Select
                  value={assignScope}
                  onValueChange={(v) => {
                    setAssignScope(v as 'ALL' | 'CLASS');
                    // 切到指定班级时默认选中第一个真实班级，避免空白选项
                    if (v === 'CLASS' && !(data?.classes || []).some((c) => c.id === assignClassId)) {
                      setAssignClassId(data?.classes?.[0]?.id || '');
                    }
                  }}
                >
                  <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                    <SelectItem value="ALL">全部学生</SelectItem>
                    <SelectItem value="CLASS">指定班级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assignScope === 'CLASS' && (
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">目标班级</label>
                  <Select value={assignClassId} onValueChange={setAssignClassId}>
                    <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue placeholder="选择班级" /></SelectTrigger>
                    <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                      {(data?.classes || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(data?.classes || []).length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-200">还没有可选班级，请先到「班级管理」创建班级。</p>
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAssignDialog(false)} className="h-9 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06]">取消</button>
              <button type="button" onClick={assignPreclass} disabled={actionLoading || (assignScope === 'CLASS' && !assignClassId)} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:opacity-50">
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                确认布置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
