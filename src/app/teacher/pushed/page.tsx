'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BarChart3, BookOpen, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { ClientRequestTimeoutError, fetchClientRequest } from '@/lib/client-fetch';

type ExperimentBucket = {
  experimentId: string;
  title: string;
  duration: number | null;
  assigned: number;
  inProgress: number;
  completed: number;
  dataInsufficient: number;
  avgScore: number | null;
  uniqueStudents: number;
  lastActivityAt: string | null;
  students: {
    id: string;
    name: string;
    studentCode: string | null;
    status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'DATA_INSUFFICIENT';
    score: number | null;
    updatedAt: string | null;
  }[];
};

type PathBucket = {
  batchId: string | null;
  name: string;
  description: string | null;
  topicId: string | null;
  stepTitles: string[];
  assignedAt: string;
  totalStudents: number;
  active: number;
  paused: number;
  completed: number;
  dataInsufficient: number;
  avgProgressPct: number;
  latestStartedAt: string | null;
  students: {
    id: string;
    name: string;
    studentCode: string | null;
    status: string;
    currentStep: number;
    totalSteps: number;
    progressPct: number;
  }[];
};

type ClassRow = { id: string; name: string };

type DataProvenance = {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
};

type PushedResponse = {
  success: boolean;
  dataProvenance?: DataProvenance;
  data?: {
    totalStudents: number;
    experiments: ExperimentBucket[];
    paths: PathBucket[];
  };
  error?: string;
};

const classResponseSchema = z.object({
  success: z.boolean().optional(),
  classes: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
});
const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string().min(1),
  note: z.string().min(1),
});
const pushedResponseSchema: z.ZodType<PushedResponse> = z.object({
  success: z.boolean(),
  dataProvenance: dataProvenanceSchema.optional(),
  data: z.object({
    totalStudents: z.number(),
    experiments: z.array(z.object({
      experimentId: z.string(), title: z.string(), duration: z.number().nullable(),
      assigned: z.number(), inProgress: z.number(), completed: z.number(), avgScore: z.number().nullable(),
      dataInsufficient: z.number(), uniqueStudents: z.number(), lastActivityAt: z.string().nullable(),
      students: z.array(z.object({
        id: z.string(), name: z.string(), studentCode: z.string().nullable(),
        status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'DATA_INSUFFICIENT']),
        score: z.number().nullable(), updatedAt: z.string().nullable(),
      })),
    })),
    paths: z.array(z.object({
      batchId: z.string().nullable(), name: z.string(), description: z.string().nullable(), topicId: z.string().nullable(),
      assignedAt: z.string(),
      stepTitles: z.array(z.string()), totalStudents: z.number(), active: z.number(), paused: z.number(),
      completed: z.number(), dataInsufficient: z.number(), avgProgressPct: z.number(), latestStartedAt: z.string().nullable(),
      students: z.array(z.object({
        id: z.string(), name: z.string(), studentCode: z.string().nullable(), status: z.string(),
        currentStep: z.number(), totalSteps: z.number(), progressPct: z.number(),
      })),
    })),
  }).optional(),
  error: z.string().optional(),
});
const apiErrorSchema = z.object({ error: z.string().optional(), message: z.string().optional() });
const PUSHED_CLASS_FILTER_KEY = 'teacher-pushed-class-filter-v1';
const INITIAL_PATH_BATCH_COUNT = 8;

function readSavedClassFilter(): string {
  try {
    return window.sessionStorage.getItem(PUSHED_CLASS_FILTER_KEY)?.trim() || 'all';
  } catch {
    return 'all';
  }
}

function saveClassFilter(value: string): void {
  try {
    window.sessionStorage.setItem(PUSHED_CLASS_FILTER_KEY, value);
  } catch {
    // The filter is optional; restricted storage must not block the page.
  }
}

function currentPagePath(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return `${window.location.pathname}${window.location.search}`;
}

function readUrlClassFilter(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('classId')?.trim() || null;
}

function replaceUrlClassFilter(value: string): string {
  if (typeof window === 'undefined') return '/teacher/pushed';
  const next = new URL(window.location.href);
  if (value === 'all') next.searchParams.delete('classId');
  else next.searchParams.set('classId', value);
  window.history.replaceState(window.history.state, '', `${next.pathname}${next.search}${next.hash}`);
  return `${next.pathname}${next.search}`;
}

function loginHref(returnPath: string, roleMismatch = false): string {
  return `/login?from=${encodeURIComponent(returnPath)}${roleMismatch ? '&reason=teacher-role' : ''}`;
}

function pushedLoadError(status: number, raw: unknown): string {
  if (status === 401) return '登录已过期，请重新登录后继续';
  if (status === 403) return '当前账号无权读取该推送数据';
  const parsed = apiErrorSchema.safeParse(raw);
  return parsed.success ? parsed.data.error ?? parsed.data.message ?? '推送数据加载失败' : '推送数据加载失败';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function experimentStatusLabel(status: ExperimentBucket['students'][number]['status']): string {
  if (status === 'COMPLETED') return '已完成';
  if (status === 'IN_PROGRESS') return '进行中';
  if (status === 'ASSIGNED') return '待开始';
  return '数据不足';
}

function PercentBar({ value, accent = 'cyan' }: { value: number; accent?: 'cyan' | 'emerald' | 'amber' }): JSX.Element {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
      <div className={cn('h-full', colorMap[accent])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export default function TeacherPushedPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<PushedResponse['data'] | null>(null);
  const [dataProvenance, setDataProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classFilter, setClassFilter] = useState<string>('all');
  const [classesResolved, setClassesResolved] = useState(false);
  const [classWarning, setClassWarning] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState('/teacher/pushed');
  const [visiblePathCount, setVisiblePathCount] = useState(INITIAL_PATH_BATCH_COUNT);
  const classLoadAbortRef = useRef<AbortController | null>(null);
  const classLoadRequestRef = useRef(0);
  const dataLoadAbortRef = useRef<AbortController | null>(null);
  const dataLoadRequestRef = useRef(0);

  const loadClasses = useCallback(async (): Promise<void> => {
    classLoadAbortRef.current?.abort();
    const controller = new AbortController();
    classLoadAbortRef.current = controller;
    const requestId = ++classLoadRequestRef.current;
    setClassesResolved(false);
    setClassWarning(null);
    try {
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      if (!token) {
        setClasses([]);
        return;
      }
      const res = await fetchClientRequest('/api/classes', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const raw: unknown = await res.json().catch((): null => null);
      if (requestId !== classLoadRequestRef.current) return;
      const parsed = classResponseSchema.safeParse(raw);
      if (!res.ok || !parsed.success || parsed.data.success !== true || !parsed.data.classes) {
        setClasses([]);
        setClassFilter('all');
        setClassWarning(res.status === 401
          ? '登录已过期，班级筛选暂不可用'
          : '班级筛选暂不可用，当前显示全部班级');
        return;
      }
      const nextClasses = parsed.data.classes.map((classRow) => ({ id: classRow.id, name: classRow.name }));
      setClasses(nextClasses);
      const urlFilter = readUrlClassFilter();
      const savedFilter = readSavedClassFilter();
      const requestedFilter = urlFilter ?? savedFilter;
      const nextFilter = requestedFilter === 'all' || nextClasses.some((item) => item.id === requestedFilter)
        ? requestedFilter
        : 'all';
      setClassFilter(nextFilter);
      saveClassFilter(nextFilter);
      setReturnPath(replaceUrlClassFilter(nextFilter));
      if (urlFilter && nextFilter === 'all') {
        setClassWarning('链接中的班级当前不可访问，已恢复为全部班级。');
      }
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setClasses([]);
      setClassFilter('all');
      setClassWarning(loadError instanceof ClientRequestTimeoutError
        ? '班级筛选读取超时，当前显示全部班级'
        : '班级筛选暂不可用，当前显示全部班级');
    } finally {
      if (classLoadAbortRef.current === controller && requestId === classLoadRequestRef.current) setClassesResolved(true);
    }
  }, []);

  const load = useCallback(async (cls: string): Promise<void> => {
    dataLoadAbortRef.current?.abort();
    const controller = new AbortController();
    dataLoadAbortRef.current = controller;
    const requestId = ++dataLoadRequestRef.current;
    setLoading(true);
    setError(null);
    setData(null);
    setDataProvenance(null);
    try {
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      if (!token) {
        setError('登录已过期，请重新登录后继续');
        return;
      }
      const url = cls === 'all' ? '/api/teacher/pushed' : `/api/teacher/pushed?classId=${encodeURIComponent(cls)}`;
      const res = await fetchClientRequest(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const raw: unknown = await res.json().catch((): null => null);
      if (requestId !== dataLoadRequestRef.current) return;
      if (!res.ok) {
        setError(pushedLoadError(res.status, raw));
        return;
      }
      const parsed = pushedResponseSchema.safeParse(raw);
      if (parsed.success && parsed.data.success && parsed.data.data && parsed.data.dataProvenance) {
        setData(parsed.data.data);
        setDataProvenance(parsed.data.dataProvenance);
      }
      else {
        setData(null);
        setDataProvenance(null);
        setError(parsed.success && parsed.data.success && parsed.data.data && !parsed.data.dataProvenance
          ? '推送数据缺少服务端数据身份，已阻止展示'
          : parsed.success ? parsed.data.error ?? '推送数据加载失败' : '推送数据格式异常');
      }
    } catch (loadError) {
      if (controller.signal.aborted || requestId !== dataLoadRequestRef.current) return;
      setData(null);
      setDataProvenance(null);
      setError(loadError instanceof ClientRequestTimeoutError
        ? '推送数据读取超时，请检查网络后重试'
        : '网络异常，推送数据加载失败，请重试');
    } finally {
      if (requestId === dataLoadRequestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setReturnPath(currentPagePath('/teacher/pushed'));
  }, []);

  useEffect(() => {
    if (authLoading || !user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      classLoadAbortRef.current?.abort();
      dataLoadAbortRef.current?.abort();
      return;
    }
    void loadClasses();
    return (): void => classLoadAbortRef.current?.abort();
  }, [authLoading, loadClasses, user]);

  useEffect(() => {
    if (authLoading || !user || (user.role !== 'TEACHER' && user.role !== 'ADMIN') || !classesResolved) return;
    void load(classFilter);
    return (): void => dataLoadAbortRef.current?.abort();
  }, [authLoading, classFilter, classesResolved, load, user]);

  useEffect(() => {
    setVisiblePathCount(INITIAL_PATH_BATCH_COUNT);
  }, [classFilter, data?.paths.length]);

  const totalAssignments = useMemo(() => {
    if (!data) return 0;
    return data.experiments.reduce((sum, e) => sum + e.assigned + e.inProgress + e.completed + e.dataInsufficient, 0);
  }, [data]);
  const visiblePaths = useMemo(
    () => data?.paths.slice(0, visiblePathCount) ?? [],
    [data?.paths, visiblePathCount],
  );

  if (authLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在核验教师权限…
      </div>
    );
  }

  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 p-6 text-center" role="alert">
        <div>
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">推送回查不可用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user ? '当前账号没有教师端权限。' : '请先登录教师账号。'}
          </p>
          <Link href={loginHref(returnPath, Boolean(user))} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {user ? '切换教师账号' : '去登录'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/teacher" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" />
            返回教学仪表板
          </Link>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-cyan-500" />
            我推送了什么
          </h1>
          <p className="text-sm text-muted-foreground">
            学习任务按本教师实际推送批次统计；实验区合并课前布置与任务内实践，并以服务端状态作为完成依据。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="班级筛选"
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              saveClassFilter(e.target.value);
              setReturnPath(replaceUrlClassFilter(e.target.value));
            }}
            disabled={!classesResolved}
            className="min-h-11 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">全部班级</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void load(classFilter)}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={cn('h-4 w-4', loading && 'animate-spin')} />
            {loading ? '刷新中…' : '刷新'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300" role="alert" aria-live="polite">
          <span>{error}</span>
          {error.startsWith('登录已过期') || error.startsWith('当前账号无权') ? (
            <Link href={loginHref(returnPath, error.startsWith('当前账号无权'))} className="ml-auto inline-flex min-h-11 items-center rounded-md border border-red-400/30 px-3 font-medium hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
              {error.startsWith('当前账号无权') ? '切换教师账号' : '重新登录'}
            </Link>
          ) : (
            <button type="button" onClick={() => void load(classFilter)} disabled={loading} aria-busy={loading} className="ml-auto min-h-11 rounded-md border border-red-400/30 px-3 font-medium hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50">
              {loading ? '重新加载中…' : '重新加载'}
            </button>
          )}
        </div>
      )}

      {classWarning && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-200" role="status" aria-live="polite">
          <span>{classWarning}</span>
          <button type="button" onClick={() => void loadClasses()} disabled={!classesResolved} className="ml-auto min-h-11 rounded-md border border-amber-400/30 px-3 font-medium hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:opacity-50">
            重新读取班级筛选
          </button>
        </div>
      )}

      {dataProvenance && (
        <div className={cn(
          'rounded-md border px-4 py-3 text-sm',
          dataProvenance.mode === 'REAL'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
        )} role="status">
          <span className="font-semibold">{dataProvenance.label}：</span>{dataProvenance.note}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取推送回查数据…
        </div>
      )}

      {data?.totalStudents === 0 && classes.length === 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-5 text-sm">
          <div className="font-medium">还没有任何班级</div>
          <p className="mt-1 text-xs text-muted-foreground">
            先去 <Link href="/teacher/classes" className="underline">班级管理</Link> 创建一个班、把学生加进去，再回来看推送状况。
          </p>
        </div>
      )}

      {data?.totalStudents === 0 && classes.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-5 text-sm">
          <div className="font-medium">所选班级里还没有学生</div>
          <p className="mt-1 text-xs text-muted-foreground">
            到 <Link href="/teacher/classes" className="underline">班级管理</Link> 详情页用「复制加入链接」发学生，或直接「手动添加学生」。
          </p>
        </div>
      )}

      {data && data.totalStudents > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-card p-4">
              <div className="text-xs text-muted-foreground">所辖学生</div>
              <div className="mt-1 font-mono text-2xl">{data.totalStudents}</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="text-xs text-muted-foreground">实验任务学生记录</div>
              <div className="mt-1 font-mono text-2xl">{totalAssignments}</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="text-xs text-muted-foreground">学习任务批次数</div>
              <div className="mt-1 font-mono text-2xl">{data.paths.length}</div>
            </div>
          </div>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-500" />
              <h2 className="text-sm font-semibold">本教师布置的实验任务</h2>
              <span className="font-mono text-xs text-muted-foreground">{data.experiments.length} 个</span>
            </div>
            {data.experiments.length === 0 ? (
              <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-5 text-sm text-muted-foreground">
                <span>当前筛选范围内还没有实验任务。布置后，待开始、进行中、已完成和数据不足会在这里统一显示。</span>
                <Link href="/teacher" className="ml-auto inline-flex min-h-11 items-center rounded-md border px-3 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                  返回仪表板布置
                </Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border bg-card">
                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">实验</th>
                        <th className="px-3 py-2 text-right">学生数</th>
                        <th className="px-3 py-2 text-right">已完成</th>
                        <th className="px-3 py-2 text-right">进行中</th>
                        <th className="px-3 py-2 text-right">待开始</th>
                        <th className="px-3 py-2 text-right">数据不足</th>
                        <th className="px-3 py-2 text-right">平均分</th>
                        <th className="px-3 py-2 text-left">完成率</th>
                        <th className="px-3 py-2 text-left">最近活动</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.experiments.map((e) => {
                        const total = e.assigned + e.inProgress + e.completed + e.dataInsufficient;
                        const completedPct = total > 0 ? Math.round((e.completed / total) * 100) : 0;
                        return (
                          <tr key={e.experimentId} className="border-t hover:bg-muted/40">
                            <td className="px-3 py-2">
                              <div className="font-medium">{e.title}</div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {e.experimentId}{e.duration !== null ? ` · ${e.duration} 分钟` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{e.uniqueStudents}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{e.completed}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-amber-600 dark:text-amber-400">{e.inProgress}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{e.assigned}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs text-red-600 dark:text-red-300">{e.dataInsufficient}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{e.avgScore ?? '—'}</td>
                            <td className="px-3 py-2 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <PercentBar value={completedPct} accent="emerald" />
                                <span className="font-mono text-xs text-muted-foreground">{completedPct}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(e.lastActivityAt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-2 border-t p-3">
                  {data.experiments.map((experiment) => (
                    <details key={`students-${experiment.experimentId}`} className="rounded-md border bg-muted/10">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                        查看 {experiment.experimentId} 的 {experiment.students.length} 名学生状态
                      </summary>
                      <div className="overflow-x-auto border-t">
                        <table className="min-w-[680px] w-full text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">学生</th>
                              <th className="px-3 py-2 text-left">学号</th>
                              <th className="px-3 py-2 text-left">状态</th>
                              <th className="px-3 py-2 text-left">得分</th>
                              <th className="px-3 py-2 text-left">最近更新</th>
                              <th className="px-3 py-2 text-left">后续操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {experiment.students.map((student) => (
                              <tr key={`${experiment.experimentId}-${student.id}`} className="border-t">
                                <td className="px-3 py-2 font-medium">{student.name}</td>
                                <td className="px-3 py-2 font-mono text-muted-foreground">{student.studentCode ?? '—'}</td>
                                <td className="px-3 py-2">{experimentStatusLabel(student.status)}</td>
                                <td className="px-3 py-2 font-mono">{student.score ?? '—'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{formatDate(student.updatedAt)}</td>
                                <td className="px-3 py-2">
                                  <Link href={`/teacher?student=${encodeURIComponent(student.id)}`} className="inline-flex min-h-11 items-center rounded-md border px-3 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                                    查看学生
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-semibold">学习路径进度</h2>
              <span className="font-mono text-xs text-muted-foreground">{data.paths.length} 个</span>
            </div>
            {data.paths.length === 0 ? (
              <div className="rounded-md border bg-card px-4 py-5 text-sm text-muted-foreground">
                还没有给学生推送过学习路径。
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePaths.map((p) => (
                  <div key={p.batchId ?? `${p.name}:${p.assignedAt}`} className="rounded-md border bg-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">{p.name}</h3>
                        {p.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                      <div className="text-right text-xs">
                        <div className="font-mono text-base">{p.avgProgressPct}%</div>
                        <div className="text-muted-foreground">平均进度</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <PercentBar value={p.avgProgressPct} accent="emerald" />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">学生数</div>
                        <div className="font-mono">{p.totalStudents}</div>
                      </div>
                      <div>
                        <div className="text-emerald-600 dark:text-emerald-400">已完成</div>
                        <div className="font-mono">{p.completed}</div>
                      </div>
                      <div>
                        <div className="text-cyan-600 dark:text-cyan-400">进行中</div>
                        <div className="font-mono">{p.active}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">已暂停</div>
                        <div className="font-mono">{p.paused}</div>
                      </div>
                    </div>
                    {p.dataInsufficient > 0 && (
                      <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-700 dark:text-amber-300" role="status">
                        {p.dataInsufficient} 名学生仅保留推送回执，任务实例缺失，当前无法判定进度。
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      推送时间：{formatDate(p.assignedAt)} · 最近开始：{formatDate(p.latestStartedAt)}
                    </div>
                    {p.stepTitles.length > 0 && (
                      <div className="mt-3 rounded-md border bg-muted/20 p-3">
                        <div className="mb-2 text-xs font-medium">任务步骤</div>
                        <ol className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          {p.stepTitles.map((title, index) => (
                            <li key={`${p.name}-${index}`} className="flex gap-2">
                              <span className="font-mono text-cyan-600 dark:text-cyan-300">{index + 1}</span>
                              <span>{title}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <details className="mt-3 rounded-md border bg-muted/10">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                        查看 {p.students.length} 名学生明细
                      </summary>
                      <div className="overflow-x-auto border-t">
                        <table className="min-w-[620px] w-full text-xs">
                          <thead className="text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left">学生</th>
                              <th className="px-3 py-2 text-left">学号</th>
                              <th className="px-3 py-2 text-left">状态</th>
                              <th className="px-3 py-2 text-left">当前步骤</th>
                              <th className="px-3 py-2 text-left">进度</th>
                              <th className="px-3 py-2 text-left">后续操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {p.students.map((student) => (
                              <tr key={student.id} className="border-t">
                                <td className="px-3 py-2 font-medium">{student.name}</td>
                                <td className="px-3 py-2 font-mono text-muted-foreground">{student.studentCode ?? '—'}</td>
                                <td className="px-3 py-2">{student.status === 'COMPLETED' ? '已完成' : student.status === 'ACTIVE' ? '进行中' : student.status === 'DATA_INSUFFICIENT' ? '数据不足' : '已暂停'}</td>
                                <td className="px-3 py-2 font-mono">{student.totalSteps > 0 ? `${student.currentStep}/${student.totalSteps}` : '—'}</td>
                                <td className="min-w-[130px] px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <PercentBar value={student.progressPct} accent="cyan" />
                                    <span className="font-mono text-muted-foreground">{student.progressPct}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <Link
                                    href={`/teacher?student=${encodeURIComponent(student.id)}${p.batchId ? `&batchId=${encodeURIComponent(p.batchId)}` : ''}&action=intervene&topic=${encodeURIComponent(p.topicId ?? 'chapter-review')}`}
                                    className="inline-flex min-h-11 items-center text-cyan-600 hover:underline dark:text-cyan-300"
                                  >
                                    查看并补充干预
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                ))}
                <div className="flex flex-col items-center justify-between gap-2 rounded-md border border-dashed bg-card/50 px-4 py-3 text-xs text-muted-foreground sm:flex-row">
                  <span>已显示 {visiblePaths.length}/{data.paths.length} 批学习任务</span>
                  <div className="flex flex-wrap gap-2">
                    {visiblePaths.length < data.paths.length && (
                      <button
                        type="button"
                        onClick={() => setVisiblePathCount((count) => Math.min(count + INITIAL_PATH_BATCH_COUNT, data.paths.length))}
                        className="min-h-11 rounded-md border bg-background px-3 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        再显示 {Math.min(INITIAL_PATH_BATCH_COUNT, data.paths.length - visiblePaths.length)} 批
                      </button>
                    )}
                    {visiblePathCount > INITIAL_PATH_BATCH_COUNT && (
                      <button
                        type="button"
                        onClick={() => setVisiblePathCount(INITIAL_PATH_BATCH_COUNT)}
                        className="min-h-11 rounded-md border bg-background px-3 font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                      >
                        收起到最近 {INITIAL_PATH_BATCH_COUNT} 批
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
