'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, BookOpen, GitBranch, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ExperimentBucket = {
  experimentId: string;
  title: string;
  duration: number | null;
  assigned: number;
  inProgress: number;
  completed: number;
  avgScore: number | null;
  uniqueStudents: number;
  lastActivityAt: string | null;
};

type PathBucket = {
  name: string;
  description: string | null;
  totalStudents: number;
  active: number;
  paused: number;
  completed: number;
  avgProgressPct: number;
  latestStartedAt: string | null;
};

type ClassRow = { id: string; name: string };

type PushedResponse = {
  success: boolean;
  data?: {
    totalStudents: number;
    experiments: ExperimentBucket[];
    paths: PathBucket[];
  };
  error?: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function PercentBar({ value, accent = 'cyan' }: { value: number; accent?: 'cyan' | 'emerald' | 'amber' }) {
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

export default function TeacherPushedPage() {
  const [data, setData] = useState<PushedResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classFilter, setClassFilter] = useState<string>('all');

  const loadClasses = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;
      const res = await fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } });
      const j = await res.json();
      if (j.success && Array.isArray(j.classes)) {
        setClasses(j.classes.map((c: ClassRow) => ({ id: c.id, name: c.name })));
      }
    } catch {
      // tolerate; pushed page still works without filter
    }
  }, []);

  const load = useCallback(async (cls: string) => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setError('请先登录');
        setLoading(false);
        return;
      }
      const url = cls === 'all' ? '/api/teacher/pushed' : `/api/teacher/pushed?classId=${encodeURIComponent(cls)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as PushedResponse;
      if (json.success && json.data) setData(json.data);
      else setError(json.error || '加载失败');
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    load(classFilter);
  }, [classFilter, load]);

  const totalAssignments = useMemo(() => {
    if (!data) return 0;
    return data.experiments.reduce((sum, e) => sum + e.assigned + e.inProgress + e.completed, 0);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/teacher" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            返回教学仪表板
          </Link>
          <h1 className="mt-1 text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-cyan-500" />
            我推送了什么
          </h1>
          <p className="text-sm text-muted-foreground">
            按实验和学习路径聚合，看每个任务在所管班级里学生的提交状况。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="all">全部班级</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => load(classFilter)}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-card p-4">
              <div className="text-xs text-muted-foreground">所辖学生</div>
              <div className="mt-1 font-mono text-2xl">{data.totalStudents}</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="text-xs text-muted-foreground">实验任务记录数</div>
              <div className="mt-1 font-mono text-2xl">{totalAssignments}</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="text-xs text-muted-foreground">学习路径模板数</div>
              <div className="mt-1 font-mono text-2xl">{data.paths.length}</div>
            </div>
          </div>

          <section>
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-cyan-500" />
              <h2 className="text-sm font-semibold">实验任务提交情况</h2>
              <span className="font-mono text-xs text-muted-foreground">{data.experiments.length} 个</span>
            </div>
            {data.experiments.length === 0 ? (
              <div className="rounded-md border bg-card px-4 py-5 text-sm text-muted-foreground">
                还没有学生记录到任何实验任务。
              </div>
            ) : (
              <div className="rounded-md border bg-card">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">实验</th>
                      <th className="px-3 py-2 text-right">学生数</th>
                      <th className="px-3 py-2 text-right">已完成</th>
                      <th className="px-3 py-2 text-right">进行中</th>
                      <th className="px-3 py-2 text-right">待开始</th>
                      <th className="px-3 py-2 text-right">平均分</th>
                      <th className="px-3 py-2 text-left">完成率</th>
                      <th className="px-3 py-2 text-left">最近活动</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.experiments.map((e) => {
                      const total = e.assigned + e.inProgress + e.completed;
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
                {data.paths.map((p) => (
                  <div key={p.name} className="rounded-md border bg-card p-4">
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
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      最近开始：{formatDate(p.latestStartedAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
