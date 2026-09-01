'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Database, RefreshCw, ShieldCheck } from 'lucide-react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { cn } from '@/lib/utils';

interface DatabaseHealth {
  timestamp: string;
  scope: 'INSTANTANEOUS';
  label: string;
  note: string;
  database: {
    isConnected: boolean;
    latency?: number;
    error?: string;
  };
  recommendations: string[];
}

type HealthState = 'idle' | 'loading' | 'ready' | 'error';

function parseHealthPayload(value: unknown): DatabaseHealth {
  if (!value || typeof value !== 'object') throw new Error('健康接口返回格式不完整。');
  const record = value as Record<string, unknown>;
  const database = record.database;
  if (!database || typeof database !== 'object' || typeof (database as Record<string, unknown>).isConnected !== 'boolean') {
    throw new Error('健康接口缺少连接状态。');
  }
  return value as DatabaseHealth;
}

/**
 * 评委可见的按需健康探测。组件不自动轮询，避免页面浏览本身增加数据库压力；
 * 单次结果只回答“此刻能否完成只读查询”，不代表历史或长期可用率。
 */
export function DatabaseStatus() {
  const [health, setHealth] = useState<DatabaseHealth | null>(null);
  const [state, setState] = useState<HealthState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const requestRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const checkHealth = useCallback(async () => {
    const requestId = ++requestRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
    setState('loading');
    setErrorMessage('');

    try {
      const token = getStoredAccessToken();
      const response = await fetch('/api/health/database', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      });
      const body = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('登录状态已失效，请重新登录后检查。');
        const publicError = body && typeof body === 'object'
          ? (body as { database?: { error?: unknown } }).database?.error
          : null;
        throw new Error(typeof publicError === 'string' ? publicError : `即时探测失败（${response.status}）。`);
      }
      const parsed = parseHealthPayload(body);
      if (requestId !== requestRef.current) return;
      setHealth(parsed);
      setState('ready');
    } catch (error) {
      if (requestId !== requestRef.current) return;
      setHealth(null);
      setState('error');
      setErrorMessage(controller.signal.aborted ? '即时探测超时，请稍后重试。' : error instanceof Error ? error.message : '即时探测失败。');
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === requestRef.current) controllerRef.current = null;
    }
  }, []);

  const connected = state === 'ready' && health?.database.isConnected === true;
  const statusLabel = state === 'idle' ? '尚未执行' : state === 'loading' ? '检查中' : connected ? '本次通过' : '本次失败';
  const statusStyle = state === 'idle'
    ? 'border-white/[0.1] bg-white/[0.04] text-slate-300'
    : connected
      ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100'
      : state === 'loading'
        ? 'border-cyan-300/25 bg-cyan-300/[0.07] text-cyan-100'
        : 'border-red-300/25 bg-red-300/[0.08] text-red-100';

  return (
    <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0c1117] text-slate-100">
      <div className="flex flex-col gap-3 border-b border-white/[0.07] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.07]">
            <Database className="h-4 w-4 text-cyan-100" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">数据库即时连接探测</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">执行一条只读查询；不展示主机、端口、库名或凭据状态。</p>
          </div>
        </div>
        <span role="status" aria-live="polite" className={cn('inline-flex w-fit items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px]', statusStyle)}>
          {state === 'loading' ? <RefreshCw className="h-3 w-3 animate-spin" /> : connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-px bg-white/[0.06] sm:grid-cols-3">
        <div className="bg-[#0c1117] px-4 py-3">
          <div className="font-mono text-[9px] tracking-[0.14em] text-slate-600">SCOPE</div>
          <div className="mt-1 text-xs font-semibold text-slate-200">即时 · 只读</div>
        </div>
        <div className="bg-[#0c1117] px-4 py-3">
          <div className="font-mono text-[9px] tracking-[0.14em] text-slate-600">DB LATENCY</div>
          <div className="mt-1 font-mono text-xs font-semibold text-slate-200">
            {health?.database.latency === undefined ? '—' : `${health.database.latency} ms`}
          </div>
        </div>
        <div className="bg-[#0c1117] px-4 py-3">
          <div className="font-mono text-[9px] tracking-[0.14em] text-slate-600">CHECKED AT</div>
          <div className="mt-1 text-xs font-semibold text-slate-200">
            {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString('zh-CN', { hour12: false }) : '—'}
          </div>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.07] px-4 py-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-300/18 bg-amber-300/[0.055] px-3 py-2.5 text-xs leading-5 text-amber-100">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{health?.note ?? '单次通过只说明当前请求成功；长期稳定性须依据独立监测窗口判断。'}</span>
        </div>

        {state === 'error' && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300/20 bg-red-300/[0.07] px-3 py-2.5 text-xs leading-5 text-red-100">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {health?.recommendations?.length ? (
          <div className="flex items-start gap-2 text-xs leading-5 text-slate-500">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{health.recommendations.join('；')}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void checkHealth()}
          disabled={state === 'loading'}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', state === 'loading' && 'animate-spin')} aria-hidden="true" />
          {state === 'idle' ? '执行即时探测' : state === 'loading' ? '正在探测…' : '重新探测'}
        </button>
      </div>
    </div>
  );
}
