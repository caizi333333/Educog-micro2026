'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Clock, GitBranch, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type AssignedExperiment = {
  experimentId: string;
  title: string;
  duration: number | null;
  assignedAt: string;
  href: string;
};

type ActivePath = {
  id: string;
  name: string;
  description: string | null;
  startedAt: string;
  currentModule: number;
  totalModules: number;
  modules: { chapterId?: string; moduleId?: string; name?: string }[];
};

type TasksResponse = {
  success: boolean;
  data?: {
    assignedExperiments: AssignedExperiment[];
    activePaths: ActivePath[];
    counts: { assignedExperiments: number; activePaths: number };
  };
  error?: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function MyTasksPage() {
  const [data, setData] = useState<TasksResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setError('请先登录');
        setLoading(false);
        return;
      }
      const res = await fetch('/api/me/tasks', { headers: { Authorization: `Bearer ${token}` } });
      const json = (await res.json()) as TasksResponse;
      if (json.success && json.data) {
        setData(json.data);
      } else {
        setError(json.error || '加载失败');
      }
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalCount = (data?.counts.assignedExperiments ?? 0) + (data?.counts.activePaths ?? 0);

  return (
    <div className="-m-6 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] px-4 py-6 text-slate-100 md:px-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-200">My Tasks</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">我的学习任务</h1>
            <p className="mt-1 text-sm text-slate-400">
              老师布置给你的实验和学习路径会自动出现在这里。
              {!loading && data && totalCount === 0 && '当前没有待处理的任务。'}
            </p>
          </div>
          <Link
            href="/classes/join"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14]"
          >
            <KeyRound className="h-4 w-4" />
            加入班级
          </Link>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
            {error === '请先登录' && (
              <Link href="/login?from=%2Ftasks" className="ml-2 underline hover:text-red-200">
                去登录
              </Link>
            )}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中...
          </div>
        )}

        {data && (
          <>
            <section>
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-200" />
                <h2 className="text-sm font-semibold text-slate-100">课前实验任务</h2>
                <span className="font-mono text-xs text-slate-500">{data.counts.assignedExperiments}</span>
              </div>
              {data.assignedExperiments.length === 0 ? (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-5 text-sm text-slate-500">
                  暂无被布置的实验。
                </div>
              ) : (
                <div className="space-y-2">
                  {data.assignedExperiments.map((exp) => (
                    <Link
                      key={exp.experimentId}
                      href={exp.href}
                      className="group flex items-center justify-between gap-3 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-3 hover:border-cyan-300/30 hover:bg-cyan-300/[0.05]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-0.5 font-mono text-[10px] text-cyan-100">
                            {exp.experimentId}
                          </span>
                          <span className="text-sm font-medium text-slate-100 group-hover:text-cyan-100">{exp.title}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          {exp.duration !== null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              建议 {exp.duration} 分钟
                            </span>
                          )}
                          <span>布置于 {formatDate(exp.assignedAt)}</span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-emerald-200" />
                <h2 className="text-sm font-semibold text-slate-100">学习路径</h2>
                <span className="font-mono text-xs text-slate-500">{data.counts.activePaths}</span>
              </div>
              {data.activePaths.length === 0 ? (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-5 text-sm text-slate-500">
                  暂无被推送的学习路径。
                </div>
              ) : (
                <div className="space-y-3">
                  {data.activePaths.map((path) => (
                    <div
                      key={path.id}
                      className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.04] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-emerald-100">{path.name}</h3>
                          {path.description && (
                            <p className="mt-1 text-xs text-slate-400">{path.description}</p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-emerald-300">
                          {path.currentModule} / {path.totalModules}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-emerald-300/10">
                        <div
                          className="h-full bg-emerald-300/70"
                          style={{ width: `${path.totalModules > 0 ? Math.round((path.currentModule / path.totalModules) * 100) : 0}%` }}
                        />
                      </div>
                      {path.modules.length > 0 && (
                        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                          {path.modules.map((m, i) => (
                            <li
                              key={`${path.id}-${i}`}
                              className={cn(
                                'flex items-center gap-2 rounded-md px-2 py-1 text-xs',
                                i < path.currentModule
                                  ? 'text-slate-500 line-through'
                                  : 'text-slate-200',
                              )}
                            >
                              <span className="font-mono text-[10px] text-emerald-300">{m.chapterId || `${i + 1}.`}</span>
                              <span className="truncate">{m.name || `模块 ${i + 1}`}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 text-[11px] text-slate-500">
                        开始于 {formatDate(path.startedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
