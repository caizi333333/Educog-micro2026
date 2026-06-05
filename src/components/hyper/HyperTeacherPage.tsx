'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileDown,
  GitBranch,
  Loader2,
  Medal,
  Search,
  Send,
  Target,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ACHIEVEMENTS_V2, type Achievement } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';

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
  alertStudents: { name: string; avg: number }[];
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
  const [pushClassId, setPushClassId] = useState('all');
  const [pushPathType, setPushPathType] = useState<'BASIC' | 'ADVANCED'>('BASIC');
  const [pushModuleCount, setPushModuleCount] = useState(5);
  // Assign preclass dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignExpId, setAssignExpId] = useState(experimentCatalog[0]?.id || 'exp01');
  const [assignScope, setAssignScope] = useState<'ALL' | 'CLASS'>('ALL');
  const [assignClassId, setAssignClassId] = useState('all');

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
  }, [user]);

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students || []).filter((student) =>
      !q || `${student.name} ${student.studentId || ''} ${student.class || ''}`.toLowerCase().includes(q)
    );
  }, [data?.students, query]);

  const selectedStudent = students.find((student) => (student.id || student.studentId || student.name) === selectedStudentId) || students[0] || null;
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
      if (pushScope === 'CLASS' && pushClassId !== 'all') {
        const cls = (data?.classes || []).find((c) => c.id === pushClassId);
        if (cls) body.targetClass = cls.name;
      }
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
      const body: Record<string, unknown> = { experimentId: assignExpId };
      if (assignScope === 'CLASS' && assignClassId !== 'all') {
        const cls = (data?.classes || []).find((c) => c.id === assignClassId);
        if (cls) body.targetClass = cls.name;
      }
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
      toast({ title: '已布置', description: `已为 ${result.assigned || 0} 名学生分配课前实验。` });
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
    <div className="-m-6 grid min-h-[calc(100vh-3.5rem)] bg-[#070a0d] text-slate-100 xl:grid-cols-[320px_1fr_360px]">
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
            <div className="p-6 text-center text-sm text-slate-500">暂无学生数据</div>
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
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">教师工作台</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              接入现有教师仪表板、课前任务和学习任务接口，不使用原型里的演示学生数据。
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
            <Link href="/knowledge-graph?view=knowledge" className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14]">
              <GitBranch className="h-4 w-4" />
              维护图谱
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {([
            ['学生总数', data?.overview?.totalStudents || 0, Users],
            ['今日活跃', data?.overview?.activeToday || 0, CheckCircle2],
            ['平均测验', `${Math.round(data?.overview?.avgQuizScore || 0)}%`, BarChart3],
            ['实验完成', `${Math.round(data?.overview?.avgExpCompletion || 0)}%`, Target],
            ['平均时长', formatSecondsAsHours(data?.overview?.avgTimeSpent), Clock],
          ] satisfies StatItem[]).map(([label, value, Icon]) => (
            <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <Icon className="h-4 w-4 text-cyan-200" />
              <div className="mt-3 font-mono text-2xl font-semibold text-slate-50">{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          ))}
        </section>

        <section className="mb-6 rounded-md border border-white/[0.08] bg-white/[0.035]">
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
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="text-lg font-semibold text-slate-50">实验完成分布</h2>
              <p className="mt-1 text-xs text-slate-500">来自 `/api/teacher/dashboard` 的 experimentCompletion。</p>
            </div>
            <div className="space-y-3 p-4">
              {(data?.experiments || []).length ? data!.experiments.map((experiment) => (
                <div key={experiment.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-300">{experiment.name}</span>
                    <span className="font-mono text-cyan-100">{experiment.completed}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-sm bg-white/[0.08]">
                    <div className="h-full bg-cyan-300" style={{ width: `${Math.round((experiment.completed / maxExperimentCompleted) * 100)}%` }} />
                  </div>
                </div>
              )) : (
                <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">暂无实验完成数据</div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="text-lg font-semibold text-slate-50">风险学生</h2>
              <p className="mt-1 text-xs text-slate-500">后端返回 alertStudents 时展示。</p>
            </div>
            <div className="p-4">
              {(data?.alertStudents || []).length ? data!.alertStudents.map((student) => (
                <div key={student.name} className="mb-2 flex items-center justify-between rounded-md border border-red-300/20 bg-red-300/[0.08] px-3 py-2 last:mb-0">
                  <span className="text-sm text-red-50">{student.name}</span>
                  <span className="font-mono text-sm text-red-100">{Math.round(student.avg)}</span>
                </div>
              )) : (
                <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">暂无风险提醒</div>
              )}
            </div>
          </div>
        </section>

        {/* Selected Student Detail */}
        {selectedStudent && (
          <section className="mt-5 rounded-md border border-white/[0.08] bg-white/[0.035]">
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
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">平均测验</div>
                <div className="mt-1 font-mono text-xl text-cyan-100">
                  {Math.round(selectedStudent.avgScore ?? selectedStudent.avgQuizScore ?? 0)}%
                </div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">实验完成</div>
                <div className="mt-1 font-mono text-xl text-emerald-100">
                  {selectedStudent.experimentsCompleted ?? 0}/{selectedStudent.experimentsTotal ?? 0}
                </div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">学习时长</div>
                <div className="mt-1 font-mono text-xl text-amber-100">
                  {formatSecondsAsHours(selectedStudent.totalTimeSpent)}
                </div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-black/20 p-3">
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
                      <div className="text-[10px] text-slate-500">{ch}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/[0.08]">
                          <div
                            className={`h-full ${progress >= 80 ? 'bg-emerald-400' : progress >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
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
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
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
                <Select value={pushScope} onValueChange={(v) => setPushScope(v as 'ALL' | 'CLASS')}>
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
                    <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                      {(data?.classes || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              <button type="button" onClick={pushLearningTask} disabled={actionLoading} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:opacity-50">
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
                <Select value={assignScope} onValueChange={(v) => setAssignScope(v as 'ALL' | 'CLASS')}>
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
                    <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                      {(data?.classes || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAssignDialog(false)} className="h-9 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06]">取消</button>
              <button type="button" onClick={assignPreclass} disabled={actionLoading} className="inline-flex h-9 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:opacity-50">
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
