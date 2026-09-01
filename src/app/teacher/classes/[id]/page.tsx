'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Check, ClipboardCopy, Link2, Loader2, Plus, RefreshCw, Target, Trash2, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';

const nullableString = z.string().nullable();
const enrollmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  classId: z.string(),
  role: z.string(),
  status: z.string(),
  joinedAt: z.string(),
  user: z.object({
    id: z.string(),
    name: nullableString,
    username: nullableString,
    studentId: nullableString,
    role: z.string(),
    lastLoginAt: nullableString,
  }),
});
const classDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  inviteCode: z.string(),
  courseName: nullableString,
  semester: nullableString,
  status: z.string(),
  teacher: z.object({ id: z.string(), name: nullableString, username: nullableString }).nullish(),
  enrollments: z.array(enrollmentSchema),
});
const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string().min(1),
  note: z.string().min(1),
});
const classDetailResponseSchema = z.object({
  success: z.boolean().optional(),
  dataProvenance: dataProvenanceSchema.optional(),
  class: classDetailSchema.optional(),
  error: z.string().optional(),
});
const mutationResponseSchema = z.object({
  success: z.boolean().optional(),
  duplicate: z.boolean().optional(),
  error: z.string().optional(),
  user: z.object({ name: nullableString, username: nullableString }).optional(),
});

const LOGIN_EXPIRED_ERROR = '登录已过期，请重新登录后继续';

class UncertainClassMutationError extends Error {}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sendClassMutation(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchClientRequest(input, init, CLIENT_WRITE_TIMEOUT_MS);
      if (isRetryableStatus(response.status)) {
        if (attempt === 0) continue;
        throw new UncertainClassMutationError('操作结果暂未确认');
      }
      return response;
    } catch (error) {
      if (error instanceof UncertainClassMutationError) throw error;
      if (attempt === 0 && isAmbiguousClientFailure(error)) continue;
      throw error;
    }
  }
  throw new UncertainClassMutationError('操作结果暂未确认');
}

function isUncertainClassMutation(error: unknown): boolean {
  return error instanceof UncertainClassMutationError || isAmbiguousClientFailure(error);
}

function classDetailResponseError(status: number, fallback: string): string {
  if (status === 401) return LOGIN_EXPIRED_ERROR;
  if (status === 403) return '当前账号无权访问该班级';
  return fallback;
}

function classStatusLabel(status: string | null | undefined): string {
  if (status === 'ACTIVE') return '使用中';
  if (status === 'INACTIVE') return '已停用';
  if (status === 'ARCHIVED') return '已归档';
  return status?.trim() || '待核实';
}

type ClassDetail = z.infer<typeof classDetailSchema>;
type DataProvenance = z.infer<typeof dataProvenanceSchema>;

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

export default function TeacherClassDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const id = params?.id?.trim() ?? '';
  const [data, setData] = useState<ClassDetail | null>(null);
  const [dataProvenance, setDataProvenance] = useState<DataProvenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<{ kind: 'add' | 'remove'; userId?: string } | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [addLocator, setAddLocator] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const loadRequestId = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const addStudentInputRef = useRef<HTMLInputElement | null>(null);
  const [addLocatorError, setAddLocatorError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    userId: string;
    label: string;
    studentId: string | null;
  } | null>(null);

  const load = useCallback(async (preserveSuccessMessage = false): Promise<void> => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setData(null);
    setDataProvenance(null);
    if (!preserveSuccessMessage) setMessage(null);
    setCopied(false);
    setLinkCopied(false);
    try {
      if (!id) {
        setMessage({ kind: 'err', text: '班级参数无效，请返回班级列表后重试' });
        return;
      }
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      if (!token) {
        setMessage({ kind: 'err', text: LOGIN_EXPIRED_ERROR });
        return;
      }
      const res = await fetchClientRequest(`/api/classes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const raw: unknown = await res.json().catch((): null => null);
      if (requestId !== loadRequestId.current) return;
      const parsed = classDetailResponseSchema.safeParse(raw);
      if (res.ok && parsed.success && parsed.data.success === true && parsed.data.class && parsed.data.dataProvenance) {
        setData(parsed.data.class);
        setDataProvenance(parsed.data.dataProvenance);
      } else {
        setData(null);
        setDataProvenance(null);
        setMessage({
          kind: 'err',
          text: classDetailResponseError(res.status, parsed.success && parsed.data.success === true && parsed.data.class && !parsed.data.dataProvenance
            ? '班级数据缺少服务端数据身份，已阻止展示'
            : parsed.success ? parsed.data.error ?? '班级信息加载失败' : '班级数据格式异常'),
        });
      }
    } catch (loadError) {
      if (controller.signal.aborted) return;
      if (requestId === loadRequestId.current) {
        setData(null);
        setDataProvenance(null);
        setMessage({
          kind: 'err',
          text: loadError instanceof ClientRequestTimeoutError
            ? '班级信息读取超时，请检查网络后重试'
            : '网络异常，班级信息加载失败，请重试',
        });
      }
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
    return (): void => loadAbortRef.current?.abort();
  }, [load]);

  const addStudent = async (): Promise<void> => {
    if (busyRef.current) return;
    const v = addLocator.trim();
    if (!v) {
      const validationMessage = '请填写学生用户名或学号';
      setAddLocatorError(validationMessage);
      setMessage({ kind: 'err', text: validationMessage });
      addStudentInputRef.current?.focus();
      return;
    }
    setAddLocatorError(null);
    const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
    if (!token) {
      setData(null);
      setDataProvenance(null);
      setMessage({ kind: 'err', text: LOGIN_EXPIRED_ERROR });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setBusyAction({ kind: 'add' });
    setMessage(null);
    try {
      const requestBody = JSON.stringify({ locator: v });
      const res = await sendClassMutation(`/api/classes/${id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: requestBody,
      });
      const raw: unknown = await res.json().catch((): null => null);
      const parsed = mutationResponseSchema.safeParse(raw);
      if (res.ok && !parsed.success) throw new UncertainClassMutationError('添加结果暂未确认');
      if (res.ok && parsed.success && parsed.data.success !== false) {
        setMessage({
          kind: 'ok',
          text: `${parsed.data.duplicate ? '已确认在班学生' : '已添加'} ${parsed.data.user?.name ?? parsed.data.user?.username ?? v}`,
        });
        setAddLocator('');
        await load(true);
      } else {
        if (res.status === 401 || res.status === 403) {
          setData(null);
          setDataProvenance(null);
        }
        setMessage({
          kind: 'err',
          text: classDetailResponseError(res.status, parsed.success ? parsed.data.error ?? '添加失败' : '服务返回格式异常，未能确认添加结果'),
        });
      }
    } catch (addError) {
      setMessage({
        kind: 'err',
        text: isUncertainClassMutation(addError)
          ? '添加结果暂未确认，可能已经生效。请先刷新学生名单核对，再决定是否重试。'
          : addError instanceof Error ? addError.message : '学生添加失败，请重试',
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyAction(null);
    }
  };

  const removeStudent = async (userId: string, label: string): Promise<void> => {
    if (busyRef.current) return;
    const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
    if (!token) {
      setRemoveTarget(null);
      setData(null);
      setDataProvenance(null);
      setMessage({ kind: 'err', text: LOGIN_EXPIRED_ERROR });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setBusyAction({ kind: 'remove', userId });
    setMessage(null);
    try {
      const res = await sendClassMutation(`/api/classes/${id}/enrollments/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw: unknown = await res.json().catch((): null => null);
      const parsed = mutationResponseSchema.safeParse(raw);
      if (res.ok && !parsed.success) throw new UncertainClassMutationError('移除结果暂未确认');
      if (res.ok && parsed.success && parsed.data.success !== false) {
        setMessage({ kind: 'ok', text: `${parsed.data.duplicate ? '已确认移除' : '已移除'} ${label}` });
        setRemoveTarget(null);
        await load(true);
      } else {
        setRemoveTarget(null);
        if (res.status === 401 || res.status === 403) {
          setData(null);
          setDataProvenance(null);
        }
        setMessage({
          kind: 'err',
          text: classDetailResponseError(res.status, parsed.success ? parsed.data.error ?? '移除失败' : '服务返回格式异常，未能确认移除结果'),
        });
      }
    } catch (removeError) {
      setRemoveTarget(null);
      setMessage({
        kind: 'err',
        text: isUncertainClassMutation(removeError)
          ? '移除结果暂未确认，可能已经生效。请先刷新学生名单核对，再决定是否重试。'
          : removeError instanceof Error ? removeError.message : '移除操作失败，请重试',
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyAction(null);
    }
  };

  const copyInviteCode = async (): Promise<void> => {
    if (!data?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(data.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMessage({ kind: 'err', text: '复制失败，请手动选择邀请码' });
    }
  };

  const copyJoinLink = async (): Promise<void> => {
    if (!data?.inviteCode) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/classes/join?code=${encodeURIComponent(data.inviteCode)}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      setMessage({ kind: 'err', text: '复制失败，请手动复制加入链接' });
    }
  };

  const students = (data?.enrollments ?? []).filter((e) => e.role === 'STUDENT');
  const teachers = (data?.enrollments ?? []).filter((e) => e.role === 'TEACHER');

  return (
    <div className="space-y-4">
      <div>
        <Link href="/teacher/classes" className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          返回班级列表
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{data?.name ?? '班级详情'}</h1>
        <p className="text-sm text-muted-foreground">
          {data?.courseName ?? '—'} · {data?.semester ?? '—'} · 状态：{classStatusLabel(data?.status)}
        </p>
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
            <Link
              href={`/login?from=${encodeURIComponent(`/teacher/classes/${id}`)}`}
              className="ml-2 font-semibold underline underline-offset-2"
            >
              重新登录
            </Link>
          )}
        </div>
      )}

      {data && dataProvenance && (
        <div
          className={cn(
            'rounded-md border px-4 py-3 text-sm',
            dataProvenance.mode === 'REAL'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
              : dataProvenance.mode === 'MIXED'
                ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
          )}
          role="note"
          aria-label="班级数据身份"
        >
          <div className="font-semibold">{dataProvenance.label}</div>
          <p className="mt-1 text-xs leading-5 opacity-80">{dataProvenance.note}</p>
        </div>
      )}

      {data && (
        <nav aria-label="班级后续教学操作" className="grid gap-2 sm:grid-cols-2">
          <Link
            href={`/teacher/pushed?classId=${encodeURIComponent(data.id)}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-cyan-500/25 bg-cyan-500/[0.06] px-3 text-sm text-cyan-700 hover:bg-cyan-500/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-cyan-200"
          >
            <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" />回查本班任务与实验</span>
            <span className="text-xs opacity-70">下一步</span>
          </Link>
          <Link
            href={`/obe/teacher?classId=${encodeURIComponent(data.id)}${data.semester ? `&semester=${encodeURIComponent(data.semester)}` : ''}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/10 bg-card px-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
          >
            <span className="inline-flex items-center gap-2"><Target className="h-4 w-4" />复核本班达成度</span>
            <span className="text-xs text-muted-foreground">数据不足时不生成结论</span>
          </Link>
        </nav>
      )}

      {loading && !data && (
        <div className="flex min-h-32 items-center justify-center rounded-md border bg-card text-sm text-muted-foreground" role="status">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          正在加载班级信息…
        </div>
      )}

      {!loading && !data && (
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-11 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          重新加载
        </button>
      )}

      {data && (
        <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-300">邀请码</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="rounded-md border bg-background px-3 py-1.5 font-mono text-base">{data.inviteCode}</code>
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md border bg-background px-3 text-xs hover:bg-muted"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  {copied ? '已复制' : '复制邀请码'}
                </button>
                <button
                  type="button"
                  onClick={copyJoinLink}
                  className="inline-flex min-h-11 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/[0.08] px-3 text-xs text-cyan-700 hover:bg-cyan-500/[0.14] dark:text-cyan-200"
                >
                  {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />}
                  {linkCopied ? '已复制链接' : '复制加入链接'}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                把链接发给学生即可一键加入；或学生在 <Link href="/classes/join" className="underline">/classes/join</Link> 手动输码。
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-busy={loading}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-3 text-xs hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              {loading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>
      )}

      {data && <div className="rounded-md border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          手动添加学生
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          按学号或用户名添加。学生须已在系统注册（角色 STUDENT）。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={addStudentInputRef}
            value={addLocator}
            onChange={(e) => {
              setAddLocator(e.target.value);
              if (addLocatorError) setAddLocatorError(null);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void addStudent(); }}
            placeholder="学号 或 用户名"
            aria-label="学生学号或用户名"
            aria-invalid={Boolean(addLocatorError)}
            aria-describedby={addLocatorError ? 'add-student-error' : undefined}
            maxLength={64}
            className={cn(
              'min-h-11 min-w-[200px] flex-1 rounded-md border bg-background px-3 text-sm',
              addLocatorError && 'border-red-500 focus-visible:ring-red-500/40',
            )}
          />
          <button
            type="button"
            onClick={addStudent}
            disabled={busy}
            aria-busy={busyAction?.kind === 'add'}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busyAction?.kind === 'add' ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
            {busyAction?.kind === 'add' ? '正在添加…' : '添加'}
          </button>
        </div>
        {addLocatorError && <p id="add-student-error" className="mt-2 text-xs text-red-600 dark:text-red-300">{addLocatorError}</p>}
      </div>}

      {data && <section className="rounded-md border bg-card" aria-labelledby="class-roster-title">
        <div className="flex items-center justify-between border-b p-3 text-sm font-semibold">
          <h2 id="class-roster-title">学生名单 · {students.length}</h2>
          {teachers.length > 0 && <span className="text-xs text-muted-foreground">教师 {teachers.length}</span>}
        </div>
        {students.length > 0 ? (
          <div className="divide-y">
            {students.map((e) => {
              const studentLabel = e.user.name ?? e.user.username ?? e.userId;
              const removingThisStudent = busyAction?.kind === 'remove' && busyAction.userId === e.userId;
              return (
                <article key={e.id} className="grid gap-3 p-4 transition-colors hover:bg-muted/30 lg:grid-cols-[minmax(150px,1.1fr)_minmax(120px,0.8fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{e.user.name ?? '未填写姓名'}</div>
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{e.user.username ?? '未登记用户名'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground lg:hidden">学号</div>
                    <div className="font-mono text-xs">{e.user.studentId ?? '未登记'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">最近登录</div>
                    <div className="mt-1 text-xs">{formatDate(e.user.lastLoginAt)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">加入班级</div>
                    <div className="mt-1 text-xs">{formatDate(e.joinedAt)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveTarget({ userId: e.userId, label: studentLabel, studentId: e.user.studentId })}
                    disabled={busy}
                    aria-busy={removingThisStudent}
                    aria-label={removingThisStudent ? `正在从班级移除${studentLabel}` : `从班级移除${studentLabel}`}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-red-500/20 px-3 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50 lg:min-w-11 lg:px-2"
                  >
                    {removingThisStudent
                      ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />}
                    <span className="lg:sr-only">移出班级</span>
                  </button>
                </article>
              );
            })}
          </div>
        ) : !loading && (
          <div className="px-3 py-10 text-center text-sm text-muted-foreground">
            班级里还没有学生。请复制加入链接，或在上方按学号手动添加。
          </div>
        )}
      </section>}

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => {
        if (!open && !busy) setRemoveTarget(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认将学生移出当前班级</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget
                ? `${removeTarget.label}${removeTarget.studentId ? `（${removeTarget.studentId}）` : ''} 将不再出现在该班级名单及后续班级范围统计中。`
                : '请核对本次操作对象。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            既有测验、实验和学习记录不会删除；学生之后仍可通过邀请码重新加入。
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" disabled={busy}>返回名单</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy || removeTarget === null}
              onClick={(event) => {
                event.preventDefault();
                if (removeTarget) void removeStudent(removeTarget.userId, removeTarget.label);
              }}
            >
              {busyAction?.kind === 'remove' ? '正在移出…' : '确认移出班级'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
