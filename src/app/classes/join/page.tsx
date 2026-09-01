'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_WRITE_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
} from '@/lib/client-fetch';

type JoinClassResult = {
  success?: boolean;
  error?: string;
  classEnrollment?: {
    classGroup?: { name?: string; courseName?: string | null; semester?: string | null };
  };
};

// Newly generated codes use eight characters; seven-character codes remain
// valid for existing classes created by earlier versions of the platform.
const CLASS_INVITE_CODE_PATTERN = /^[A-Z0-9]{7,8}$/;

function parseJoinClassResult(value: unknown): JoinClassResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JoinClassResult;
}

function joinReturnPath(code: string): string {
  if (typeof window === 'undefined') return '/classes/join';
  const current = new URL(window.location.href);
  if (code) current.searchParams.set('code', code);
  return `${current.pathname}${current.search}${current.hash}`;
}

function joinLoginHref(code: string, status: 401 | 403): string {
  const reason = status === 403 ? '&reason=student-role' : '';
  return `/login?role=student&from=${encodeURIComponent(joinReturnPath(code))}${reason}`;
}

function JoinForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [joined, setJoined] = useState<{ name: string; courseName: string | null; semester: string | null } | null>(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [joinUncertain, setJoinUncertain] = useState(false);
  const submitInFlightRef = useRef(false);
  const codeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const c = searchParams?.get('code');
    if (c) setCode(c.trim().toUpperCase());
  }, [searchParams]);

  const submit = async () => {
    if (submitInFlightRef.current || joinUncertain) return;
    const v = code.trim();
    if (!v) {
      setMessage({ kind: 'err', text: '请输入邀请码' });
      codeInputRef.current?.focus();
      return;
    }
    if (!CLASS_INVITE_CODE_PATTERN.test(v)) {
      setMessage({ kind: 'err', text: '邀请码应为7或8位大写字母或数字' });
      codeInputRef.current?.focus();
      return;
    }
    submitInFlightRef.current = true;
    setBusy(true);
    setMessage(null);
    setAccessErrorStatus(null);
    try {
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      if (!token) {
        setAccessErrorStatus(401);
        setMessage({ kind: 'err', text: '登录已过期，请重新登录后继续' });
        return;
      }
      const res = await fetchClientRequest('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classInviteCode: v }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const data = parseJoinClassResult(await res.json().catch((): null => null));
      if (res.ok && data?.success === true) {
        setJoinUncertain(false);
        const cg = data.classEnrollment?.classGroup;
        setJoined({
          name: cg?.name || '班级',
          courseName: cg?.courseName ?? null,
          semester: cg?.semester ?? null,
        });
      } else {
        setAccessErrorStatus(res.status === 401 || res.status === 403 ? res.status : null);
        setMessage({
          kind: 'err',
          text: res.status === 401
            ? '登录已过期，请重新登录后继续'
            : res.status === 403
              ? '只有学生账号可以加入班级'
              : data?.error || (data ? '加入失败，请核对邀请码后重试' : '服务返回格式异常，未能确认加入结果'),
        });
      }
    } catch (error) {
      setJoinUncertain(true);
      setMessage({
        kind: 'err',
        text: error instanceof ClientRequestTimeoutError
          ? '请求超时，加入结果暂未确认。请先刷新“我的任务”核对班级，再决定是否重试。'
          : '网络异常，加入结果暂未确认。请先刷新“我的任务”核对班级，再决定是否重试。',
      });
    } finally {
      submitInFlightRef.current = false;
      setBusy(false);
    }
  };

  const unlockAfterReview = (): void => {
    setJoinUncertain(false);
    setMessage(null);
    window.requestAnimationFrame(() => codeInputRef.current?.focus());
  };

  if (joined) {
    return (
      <div role="status" aria-live="polite" className="rounded-md border border-emerald-300/30 bg-emerald-300/[0.05] p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold">已加入「{joined.name}」</h2>
        {(joined.courseName || joined.semester) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[joined.courseName, joined.semester].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/tasks" className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
            查看我的任务
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-md border bg-background px-4 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
            返回课程
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-6" aria-busy={busy}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4 text-cyan-500" />
        加入班级
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        从老师那里拿到邀请码后输入下面，加入后老师布置的实验和学习任务会出现在「我的任务」里。
      </p>
      <label className="mt-4 block text-xs">
        <span className="text-muted-foreground">邀请码</span>
        <input
          ref={codeInputRef}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (message?.kind === 'err') setMessage(null);
            setAccessErrorStatus(null);
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void submit(); }}
          placeholder="7或8位邀请码，如 XK7M2QPT"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={8}
          pattern="[A-Z0-9]{7,8}"
          aria-invalid={message?.kind === 'err'}
          aria-describedby={message ? 'join-class-message' : undefined}
          disabled={busy || joinUncertain}
          className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 font-mono text-base tracking-widest"
        />
      </label>
      {message && (
        <div className={cn(
          'mt-3 rounded-md border px-3 py-2 text-sm',
          message.kind === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
        )} id="join-class-message" role={message.kind === 'err' ? 'alert' : 'status'} aria-live="polite">
          <span>{message.text}</span>
          {message.kind === 'err' && accessErrorStatus && (
            <Link
              href={joinLoginHref(code.trim(), accessErrorStatus)}
              className="ml-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
            >
              {accessErrorStatus === 403 ? '切换学生账号并保留邀请码' : '重新登录并保留邀请码'}
            </Link>
          )}
          {joinUncertain && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link href="/tasks" className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-300/30 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">
                先去“我的任务”核对
              </Link>
              <button type="button" onClick={unlockAfterReview} className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-300/30 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70">
                已确认未加入，允许重试
              </button>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || joinUncertain}
        aria-busy={busy}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <ArrowRight aria-hidden="true" className="h-4 w-4" />}
        {joinUncertain ? '加入结果待核对' : busy ? '正在加入…' : '加入班级'}
      </button>
    </div>
  );
}

export default function JoinClassPage() {
  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="mb-1 text-2xl font-bold">加入班级</h1>
      <p className="mb-5 text-sm text-muted-foreground">凭邀请码加入老师创建的班级。</p>
      <Suspense fallback={<div className="text-sm text-muted-foreground">加载中…</div>}>
        <JoinForm />
      </Suspense>
    </div>
  );
}
