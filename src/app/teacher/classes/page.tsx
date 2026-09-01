'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';

type ClassRow = {
  id: string;
  name: string;
  inviteCode: string;
  courseName: string | null;
  semester: string | null;
  teacherId: string | null;
  status: string;
  createdAt: string;
  teacher?: { id: string; name: string | null; username: string | null; teacherId: string | null } | null;
  _count?: { enrollments: number };
};

type DataProvenance = {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
};

const nullableString = z.string().nullable();
const classRowSchema: z.ZodType<ClassRow> = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  courseName: nullableString,
  semester: nullableString,
  teacherId: nullableString,
  status: z.string(),
  createdAt: z.string(),
  teacher: z.object({
    id: z.string(), name: nullableString, username: nullableString, teacherId: nullableString,
  }).nullish(),
  _count: z.object({ enrollments: z.number().int().nonnegative() }).optional(),
});
const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string().min(1),
  note: z.string().min(1),
});
const classListResponseSchema = z.object({
  success: z.boolean().optional(),
  dataProvenance: dataProvenanceSchema.optional(),
  classes: z.array(classRowSchema).optional(),
  error: z.string().optional(),
});
const createClassResponseSchema = z.object({
  success: z.boolean().optional(),
  class: z.object({ inviteCode: z.string() }).passthrough().optional(),
  duplicate: z.boolean().optional(),
  error: z.string().optional(),
});
const pendingCreateSchema = z.object({
  teacherId: z.string(),
  requestId: z.string(),
  body: z.string(),
  name: z.string(),
  courseName: z.string(),
  semester: z.string(),
  createdAt: z.number(),
});

type PendingCreate = z.infer<typeof pendingCreateSchema>;

const LOGIN_EXPIRED_ERROR = '登录已过期，请重新登录后继续';
const PENDING_CREATE_KEY = 'teacher-class-create-pending-v1';
const PENDING_CREATE_TTL_MS = 24 * 60 * 60 * 1000;

class UncertainClassCreateError extends Error {}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function isUncertainClassCreate(error: unknown): boolean {
  return error instanceof UncertainClassCreateError || isAmbiguousClientFailure(error);
}

function readPendingCreate(teacherId: string): PendingCreate | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_CREATE_KEY);
    if (!raw) return null;
    const parsed = pendingCreateSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success || parsed.data.teacherId !== teacherId || Date.now() - parsed.data.createdAt > PENDING_CREATE_TTL_MS) {
      window.sessionStorage.removeItem(PENDING_CREATE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function savePendingCreate(value: PendingCreate | null): void {
  try {
    if (value) window.sessionStorage.setItem(PENDING_CREATE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(PENDING_CREATE_KEY);
  } catch {
    // Recovery storage is optional; the server request id remains authoritative.
  }
}

function classResponseError(status: number, fallback: string): string {
  if (status === 401) return LOGIN_EXPIRED_ERROR;
  if (status === 403) return '当前账号无权管理班级';
  return fallback;
}

function currentPagePath(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return `${window.location.pathname}${window.location.search}`;
}

function loginHref(returnPath: string, roleMismatch = false): string {
  return `/login?from=${encodeURIComponent(returnPath)}${roleMismatch ? '&reason=teacher-role' : ''}`;
}

export default function TeacherClassesPage() {
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [dataProvenance, setDataProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [semester, setSemester] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<PendingCreate | null>(null);
  const [returnPath, setReturnPath] = useState('/teacher/classes');
  const loadRequestId = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const createInFlightRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async (preserveSuccessMessage = false): Promise<void> => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setRows([]);
    setDataProvenance(null);
    setLoadFailed(false);
    if (!preserveSuccessMessage) setMessage(null);
    try {
      if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
        setLoadFailed(true);
        setMessage({ kind: 'err', text: user ? '当前账号无权管理班级' : LOGIN_EXPIRED_ERROR });
        return;
      }
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      if (!token) {
        setLoadFailed(true);
        setMessage({ kind: 'err', text: LOGIN_EXPIRED_ERROR });
        return;
      }
      const res = await fetchClientRequest('/api/classes', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const raw: unknown = await res.json().catch((): null => null);
      if (requestId !== loadRequestId.current) return;
      const parsed = classListResponseSchema.safeParse(raw);
      if (res.ok && parsed.success && parsed.data.success === true && parsed.data.classes && parsed.data.dataProvenance) {
        setRows(parsed.data.classes);
        setDataProvenance(parsed.data.dataProvenance);
      } else {
        setRows([]);
        setDataProvenance(null);
        setLoadFailed(true);
        setMessage({
          kind: 'err',
          text: classResponseError(res.status, parsed.success && parsed.data.success === true && parsed.data.classes && !parsed.data.dataProvenance
            ? '班级数据缺少服务端数据身份，已阻止展示'
            : parsed.success ? parsed.data.error ?? '班级列表加载失败' : '班级数据格式异常'),
        });
      }
    } catch (loadError) {
      if (controller.signal.aborted) return;
      if (requestId === loadRequestId.current) {
        setRows([]);
        setDataProvenance(null);
        setLoadFailed(true);
        setMessage({
          kind: 'err',
          text: loadError instanceof ClientRequestTimeoutError
            ? '班级列表读取超时，请检查网络后重试'
            : '网络异常，班级列表加载失败，请重试',
        });
      }
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setReturnPath(currentPagePath('/teacher/classes'));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
    return (): void => loadAbortRef.current?.abort();
  }, [authLoading, load]);

  useEffect(() => {
    if (authLoading || !user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) return;
    const restored = readPendingCreate(user.id);
    if (!restored) return;
    setPendingCreate(restored);
    setName(restored.name);
    setCourseName(restored.courseName);
    setSemester(restored.semester);
    setShowCreate(true);
    setMessage({ kind: 'err', text: '发现上次结果未确认的创建请求，请保持内容不变并重新核对。' });
  }, [authLoading, user]);

  const create = async (): Promise<void> => {
    if (createInFlightRef.current) return;
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      setMessage({ kind: 'err', text: LOGIN_EXPIRED_ERROR });
      return;
    }
    if (!name.trim()) {
      const validationMessage = '班级名称不能为空';
      setNameError(validationMessage);
      setMessage({ kind: 'err', text: validationMessage });
      nameInputRef.current?.focus();
      return;
    }
    setNameError(null);
    const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
    if (!token) {
      setRows([]);
      setLoadFailed(true);
      setMessage({ kind: 'err', text: LOGIN_EXPIRED_ERROR });
      return;
    }
    const requestId = pendingCreate?.requestId ?? crypto.randomUUID();
    const requestBody = pendingCreate?.body ?? JSON.stringify({
      name: name.trim(),
      courseName: courseName.trim() || undefined,
      semester: semester.trim() || undefined,
      requestId,
    });
    const requestRecord: PendingCreate = pendingCreate ?? {
      teacherId: user.id,
      requestId,
      body: requestBody,
      name: name.trim(),
      courseName: courseName.trim(),
      semester: semester.trim(),
      createdAt: Date.now(),
    };
    createInFlightRef.current = true;
    setCreating(true);
    setMessage(null);
    try {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          res = await fetchClientRequest('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: requestBody,
          }, CLIENT_WRITE_TIMEOUT_MS);
          if (attempt === 0 && isRetryableStatus(res.status)) continue;
          break;
        } catch (createError) {
          if (attempt === 0 && isAmbiguousClientFailure(createError)) continue;
          throw createError;
        }
      }
      if (!res) throw new Error('创建请求未获得响应');
      const raw: unknown = await res.json().catch((): null => null);
      const parsed = createClassResponseSchema.safeParse(raw);
      if (isRetryableStatus(res.status) || (res.ok && (!parsed.success || !parsed.data.class))) {
        throw new UncertainClassCreateError('创建结果暂未确认');
      }
      if (res.ok && parsed.success && parsed.data.success !== false && parsed.data.class) {
        setPendingCreate(null);
        savePendingCreate(null);
        setMessage({
          kind: 'ok',
          text: `${parsed.data.duplicate ? '已恢复原创建结果' : '班级已创建'}：邀请码 ${parsed.data.class.inviteCode}`,
        });
        setName(''); setCourseName(''); setSemester('');
        setShowCreate(false);
        await load(true);
      } else {
        setPendingCreate(null);
        savePendingCreate(null);
        if (res.status === 401 || res.status === 403) {
          setRows([]);
          setLoadFailed(true);
        }
        setMessage({
          kind: 'err',
          text: classResponseError(res.status, parsed.success ? parsed.data.error ?? '创建失败' : '服务返回格式异常，未能确认创建结果'),
        });
      }
    } catch (createError) {
      if (isUncertainClassCreate(createError)) {
        setPendingCreate(requestRecord);
        savePendingCreate(requestRecord);
        setMessage({ kind: 'err', text: '创建结果暂未确认，可能已经生效。请保持当前内容并重新核对，平台会按同一请求编号恢复结果。' });
      } else {
        setPendingCreate(null);
        savePendingCreate(null);
        setMessage({ kind: 'err', text: createError instanceof Error ? createError.message : '班级创建失败，请重试' });
      }
    } finally {
      createInFlightRef.current = false;
      setCreating(false);
    }
  };

  const refreshPendingCreate = async (): Promise<void> => {
    await load(true);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在核验教师权限…
      </div>
    );
  }

  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    const href = loginHref(returnPath, Boolean(user));
    return (
      <div className="flex min-h-64 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 p-6 text-center" role="alert">
        <div>
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold">班级管理不可用</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user ? '当前账号没有教师端权限。' : '请先登录教师账号。'}
          </p>
          <Link href={href} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
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
          <Link href="/teacher" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            返回教学仪表板
          </Link>
          <h1 className="mt-1 text-2xl font-bold">班级管理</h1>
          <p className="text-sm text-muted-foreground">创建班级、复制邀请码给学生、查看名单。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-busy={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={cn('h-4 w-4', loading && 'animate-spin')} />
            {loading ? '刷新中…' : '刷新'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            disabled={creating || Boolean(pendingCreate)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pendingCreate ? '结果待核对' : showCreate ? '收起' : '新建班级'}
          </button>
        </div>
      </div>

      {message && (
        <div className={cn(
          'rounded-md border px-4 py-2 text-sm',
          message.kind === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
        )} role={message.kind === 'err' ? 'alert' : 'status'} aria-live="polite">
          <span>{message.text}</span>
          {message.kind === 'err' && message.text === LOGIN_EXPIRED_ERROR && (
            <Link href={loginHref(returnPath)} className="ml-2 font-semibold underline underline-offset-2">
              重新登录
            </Link>
          )}
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

      {showCreate && (
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">新建班级</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="text-muted-foreground">班级名称*</span>
              <input
                ref={nameInputRef}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !creating) void create(); }}
                disabled={creating || Boolean(pendingCreate)}
                placeholder="如：自动化 2024-1 班"
                maxLength={100}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'class-name-error' : undefined}
                className={cn(
                  'mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60',
                  nameError && 'border-red-500 focus-visible:ring-red-500/40',
                )}
              />
              {nameError && <span id="class-name-error" className="mt-1 block text-xs text-red-600 dark:text-red-300">{nameError}</span>}
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">课程名（可选）</span>
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                disabled={creating || Boolean(pendingCreate)}
                placeholder="默认：微控制器原理及应用技术"
                maxLength={100}
                className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">学期（可选）</span>
              <input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                disabled={creating || Boolean(pendingCreate)}
                placeholder="如：2025-2026-1"
                maxLength={50}
                className="mt-1 min-h-11 w-full rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">OBE 统计建议使用“起始年-结束年-1或2”格式</span>
            </label>
          </div>
          {pendingCreate && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-200">
              当前内容已锁定，重新提交会核对原请求，不会创建第二个班级。
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {pendingCreate && (
              <button
                type="button"
                onClick={() => void refreshPendingCreate()}
                disabled={creating || loading}
                aria-busy={creating || loading}
                className="inline-flex min-h-11 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                {creating || loading ? '刷新中…' : '刷新列表（保留原请求）'}
              </button>
            )}
            <button
              type="button"
              onClick={create}
              disabled={creating}
              aria-busy={creating}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {creating ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <Plus aria-hidden="true" className="h-3.5 w-3.5" />}
              {creating ? pendingCreate ? '正在核对原创建请求…' : '正在创建…' : pendingCreate ? '核对原创建请求' : '创建'}
            </button>
          </div>
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="flex min-h-40 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground" role="status" aria-live="polite">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          正在加载班级…
        </div>
      )}

      {rows.length > 0 && (
        <section aria-label="可管理班级" className="grid gap-3 lg:grid-cols-2">
          {rows.map((c) => (
            <article key={c.id} className="rounded-md border bg-card p-4 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/[0.025]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{c.name}</h2>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{c.courseName || '未填写课程名称'}</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full border px-2 py-1 text-[11px]',
                  c.status === 'ACTIVE'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200'
                    : 'border-border bg-muted text-muted-foreground',
                )}>
                  {c.status === 'ACTIVE' ? '使用中' : c.status === 'ARCHIVED' ? '已归档' : '已停用'}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">学期</dt>
                  <dd className="mt-1 truncate">{c.semester || '未填写'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">有效学生</dt>
                  <dd className="mt-1 font-mono">{c._count?.enrollments ?? 0} 人</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">邀请码</dt>
                  <dd className="mt-1 truncate font-mono">{c.inviteCode}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">负责教师</dt>
                  <dd className="mt-1 truncate">{c.teacher?.name || c.teacher?.username || '待分配'}</dd>
                </div>
              </dl>
              <div className="mt-4 flex justify-end border-t pt-3">
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md border border-cyan-500/25 bg-cyan-500/[0.07] px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-cyan-200"
                  aria-label={`查看${c.name}的学生名单与邀请码`}
                >
                  查看名单与邀请
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      {rows.length === 0 && !loading && !loadFailed && (
        <div className="flex min-h-40 flex-col items-center justify-center rounded-md border bg-card px-4 text-center text-sm text-muted-foreground">
          <Users className="mb-2 h-6 w-6 opacity-50" />
          <p>还没有班级，点右上「新建班级」开始。</p>
          <p className="mt-1 text-xs">创建后会生成邀请码，学生加入后才进入教师分析范围。</p>
        </div>
      )}
    </div>
  );
}
