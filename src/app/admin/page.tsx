'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BarChart3, BookOpen, Loader2, Network, RefreshCw, Settings, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { CLIENT_READ_TIMEOUT_MS, fetchClientRequest } from '@/lib/client-fetch';

interface Stats {
  totalUsers: number;
  activeUsers: number;
  totalExperiments: number;
  totalKnowledgeNodes: number;
  knowledgeSource: 'db' | 'static';
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function readTotal(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const pagination = (value as Record<string, unknown>).pagination;
  if (!pagination || typeof pagination !== 'object') return null;
  const total = (pagination as Record<string, unknown>).total;
  return typeof total === 'number' && Number.isFinite(total) ? total : null;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [authError, setAuthError] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);

  const loadStats = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const sequence = ++requestSequenceRef.current;
    const token = getStoredAccessToken();
    setStats(null);
    setCheckedAt(null);
    setAuthError(false);
    if (!token) {
      setLoadState('error');
      setAuthError(true);
      setErrorMessage('登录状态已失效，请重新登录后读取管理概览。');
      return;
    }

    setLoadState('loading');
    setErrorMessage('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [totalResponse, activeResponse, knowledgeResponse] = await Promise.all([
        fetchClientRequest('/api/users?page=1&limit=1&fields=id', { headers, signal }, CLIENT_READ_TIMEOUT_MS),
        fetchClientRequest('/api/users?page=1&limit=1&fields=id&status=ACTIVE', { headers, signal }, CLIENT_READ_TIMEOUT_MS),
        fetchClientRequest('/api/knowledge-graph?type=stats', { headers, signal }, CLIENT_READ_TIMEOUT_MS),
      ]);
      if (sequence !== requestSequenceRef.current || signal?.aborted) return;

      const responses = [totalResponse, activeResponse, knowledgeResponse];
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        setAuthError([401, 403, 404].includes(failed.status));
        throw new Error([401, 403, 404].includes(failed.status)
          ? '登录状态或管理员权限已失效，请重新登录。'
          : `管理概览读取失败（${failed.status}）。`);
      }

      const [totalBody, activeBody, knowledgeBody] = await Promise.all(responses.map((response) => response.json() as Promise<unknown>));
      const totalUsers = readTotal(totalBody);
      const activeUsers = readTotal(activeBody);
      const knowledgeRecord = knowledgeBody && typeof knowledgeBody === 'object'
        ? knowledgeBody as Record<string, unknown>
        : {};
      const knowledgeData = knowledgeRecord.data && typeof knowledgeRecord.data === 'object'
        ? knowledgeRecord.data as Record<string, unknown>
        : {};
      const totalKnowledgeNodes = knowledgeData.totalNodes;
      const totalExperiments = knowledgeData.experimentCount;
      const knowledgeSource = knowledgeRecord.source;
      if (
        totalUsers === null
        || activeUsers === null
        || typeof totalKnowledgeNodes !== 'number'
        || typeof totalExperiments !== 'number'
        || (knowledgeSource !== 'db' && knowledgeSource !== 'static')
      ) {
        throw new Error('管理概览返回的数据结构不完整。');
      }

      setStats({ totalUsers, activeUsers, totalExperiments, totalKnowledgeNodes, knowledgeSource });
      setCheckedAt(new Date().toISOString());
      setLoadState('ready');
    } catch (error) {
      if (sequence !== requestSequenceRef.current || signal?.aborted) return;
      setLoadState('error');
      setErrorMessage(error instanceof Error ? error.message : '管理概览读取失败，请重试。');
    }
  }, []);

  useEffect(() => {
    if (authLoading || user?.role !== 'ADMIN') return;
    const controller = new AbortController();
    void loadStats(controller.signal);
    return () => {
      requestSequenceRef.current += 1;
      controller.abort();
    };
  }, [authLoading, loadStats, user?.role]);

  if (authLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在核验管理员权限…</div>;
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-200" />
          <p className="mt-3 text-sm text-amber-50">仅系统管理员可访问此页面。</p>
          <Link href="/login?from=%2Fadmin&role=admin" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            切换管理员账号
          </Link>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: '用户管理',
      description: stats ? `共 ${stats.totalUsers} 名用户，${stats.activeUsers} 名可用` : '读取用户状态中…',
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-400',
    },
    {
      title: '课程内容',
      description: stats ? `${stats.totalExperiments} 个已关联实验项目` : '读取实验关联中…',
      icon: BookOpen,
      href: '/simulation',
      color: 'text-emerald-400',
    },
    {
      title: '知识图谱维护',
      description: stats ? `${stats.totalKnowledgeNodes} 个节点 · ${stats.knowledgeSource === 'db' ? '数据库' : '静态后备'}来源` : '读取节点状态中…',
      icon: Network,
      href: '/admin/knowledge-graph',
      color: 'text-cyan-400',
    },
    {
      title: '数据统计',
      description: '学情分析与教学报表',
      icon: BarChart3,
      href: '/analytics',
      color: 'text-violet-400',
    },
    {
      title: '账户设置',
      description: '数据导出与密码安全',
      icon: Settings,
      href: '/settings',
      color: 'text-orange-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Platform control</p>
          <h1 className="mt-2 text-2xl font-semibold">系统管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">关键数量均读取当前服务端状态，不使用演示占位值。</p>
        </div>
        <Button className="min-h-11" variant="outline" onClick={() => void loadStats()} disabled={loadState === 'loading'} aria-busy={loadState === 'loading'}>
          {loadState === 'loading' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {loadState === 'loading' ? '正在刷新…' : '刷新概览'}
        </Button>
      </div>

      {loadState === 'error' && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm text-amber-50 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span>{errorMessage}</span>
          {authError ? (
            <Button asChild className="min-h-11" size="sm" variant="outline"><Link href="/login?from=%2Fadmin">重新登录</Link></Button>
          ) : (
            <Button className="min-h-11" size="sm" variant="outline" onClick={() => void loadStats()}>重新读取</Button>
          )}
        </div>
      )}

      {loadState === 'ready' && stats && checkedAt && (
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-50" role="status" aria-live="polite">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-semibold">即时运行状态</span>
              <span className="ml-2 text-xs text-cyan-100/70">仅用于管理复核，不作为教学成效样本。</span>
            </div>
            <span className="font-mono text-[11px] text-cyan-100/70">读取于 {new Date(checkedAt).toLocaleString('zh-CN', { hour12: false })}</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-busy={loadState === 'loading'}>
        {cards.map((card) => (
          <Link key={card.title} href={card.href} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" aria-label={`${card.title}：${card.description}`}>
            <Card className="h-full min-h-32 border-white/10 transition-colors hover:border-cyan-300/30 hover:bg-white/[0.03]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </CardHeader>
              <CardContent><p className="text-xs leading-5 text-muted-foreground">{card.description}</p></CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
