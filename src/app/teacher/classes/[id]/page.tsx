'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ClipboardCopy, Loader2, Plus, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

type Enrollment = {
  id: string;
  userId: string;
  classId: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    studentId: string | null;
    role: string;
    lastLoginAt: string | null;
  };
};

type ClassDetail = {
  id: string;
  name: string;
  inviteCode: string;
  courseName: string | null;
  semester: string | null;
  status: string;
  teacher?: { id: string; name: string | null; username: string | null } | null;
  enrollments: Enrollment[];
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function TeacherClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [addLocator, setAddLocator] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setMessage({ kind: 'err', text: '请先登录' });
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/classes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success && json.class) setData(json.class);
      else setMessage({ kind: 'err', text: json.error || '加载失败' });
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addStudent = async () => {
    const v = addLocator.trim();
    if (!v) {
      setMessage({ kind: 'err', text: '请填用户名或学号' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;
      // Try studentId first if it looks numeric/alnum, else username
      const looksLikeStudentId = /^[0-9A-Za-z]{4,}$/.test(v) && !/^[a-z]+$/i.test(v);
      const body = looksLikeStudentId ? { studentId: v } : { username: v };
      const res = await fetch(`/api/classes/${id}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        setMessage({ kind: 'ok', text: `已添加 ${json.user?.name || json.user?.username || v}` });
        setAddLocator('');
        await load();
      } else {
        setMessage({ kind: 'err', text: json.error || '添加失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setBusy(false);
  };

  const removeStudent = async (userId: string, label: string) => {
    if (!confirm(`确认从班级移除 ${label}？`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;
      const res = await fetch(`/api/classes/${id}/enrollments/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok && json.success !== false) {
        setMessage({ kind: 'ok', text: `已移除 ${label}` });
        await load();
      } else {
        setMessage({ kind: 'err', text: json.error || '移除失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setBusy(false);
  };

  const copyInviteCode = async () => {
    if (!data?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(data.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const students = (data?.enrollments ?? []).filter((e) => e.role === 'STUDENT');
  const teachers = (data?.enrollments ?? []).filter((e) => e.role === 'TEACHER');

  return (
    <div className="space-y-4">
      <div>
        <Link href="/teacher/classes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" />
          返回班级列表
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{data?.name || '班级详情'}</h1>
        <p className="text-sm text-muted-foreground">
          {data?.courseName || '—'} · {data?.semester || '—'} · 状态：{data?.status || '—'}
        </p>
      </div>

      {message && (
        <div className={cn(
          'rounded-md border px-4 py-2 text-sm',
          message.kind === 'ok'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            : 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300',
        )}>
          {message.text}
        </div>
      )}

      {data && (
        <div className="rounded-md border border-cyan-500/30 bg-cyan-500/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-300">邀请码</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-md border bg-background px-3 py-1.5 font-mono text-base">{data.inviteCode}</code>
                <button
                  type="button"
                  onClick={copyInviteCode}
                  className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-muted"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                  {copied ? '已复制' : '复制'}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                学生在 <Link href="/classes/join" className="underline">/classes/join</Link> 输入此码即可加入；或老师下面手动添加。
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 text-xs hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              刷新
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          手动添加学生
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          按学号或用户名添加。学生须已在系统注册（角色 STUDENT）。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={addLocator}
            onChange={(e) => setAddLocator(e.target.value)}
            placeholder="学号 或 用户名"
            className="h-9 flex-1 min-w-[200px] rounded-md border bg-background px-3 text-sm"
          />
          <button
            type="button"
            onClick={addStudent}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            添加
          </button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <div className="border-b p-3 text-sm font-semibold flex items-center justify-between">
          <span>学生名单 · {students.length}</span>
          {teachers.length > 0 && <span className="text-xs text-muted-foreground">教师 {teachers.length}</span>}
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">姓名</th>
              <th className="px-3 py-2 text-left">用户名</th>
              <th className="px-3 py-2 text-left">学号</th>
              <th className="px-3 py-2 text-left">最近登录</th>
              <th className="px-3 py-2 text-left">加入时间</th>
              <th className="px-3 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {students.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2">{e.user.name || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.user.username || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.user.studentId || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(e.user.lastLoginAt)}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(e.joinedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeStudent(e.userId, e.user.name || e.user.username || e.userId)}
                    disabled={busy}
                    className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  班级里还没有学生。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
