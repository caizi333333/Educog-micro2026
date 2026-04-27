'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function JoinForm() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [joined, setJoined] = useState<{ name: string; courseName: string | null; semester: string | null } | null>(null);

  useEffect(() => {
    const c = searchParams?.get('code');
    if (c) setCode(c.trim().toUpperCase());
  }, [searchParams]);

  const submit = async () => {
    const v = code.trim();
    if (!v) {
      setMessage({ kind: 'err', text: '请输入邀请码' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setMessage({ kind: 'err', text: '请先登录' });
        setBusy(false);
        return;
      }
      const res = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classInviteCode: v }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const cg = data.classEnrollment?.classGroup;
        setJoined({
          name: cg?.name || '班级',
          courseName: cg?.courseName ?? null,
          semester: cg?.semester ?? null,
        });
      } else {
        setMessage({ kind: 'err', text: data.error || '加入失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setBusy(false);
  };

  if (joined) {
    return (
      <div className="rounded-md border border-emerald-300/30 bg-emerald-300/[0.05] p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h2 className="mt-3 text-lg font-semibold">已加入「{joined.name}」</h2>
        {(joined.courseName || joined.semester) && (
          <p className="mt-1 text-sm text-muted-foreground">
            {[joined.courseName, joined.semester].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/tasks" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">
            查看我的任务
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/" className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-4 text-sm hover:bg-muted">
            返回课程
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card p-6">
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
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="如 EDU-A8C2"
          autoComplete="off"
          autoCapitalize="characters"
          className="mt-1 h-10 w-full rounded-md border bg-background px-3 font-mono text-base tracking-widest"
        />
      </label>
      {message && (
        <div className={cn(
          'mt-3 rounded-md border px-3 py-2 text-sm',
          message.kind === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
        )}>
          {message.text}
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        加入班级
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
