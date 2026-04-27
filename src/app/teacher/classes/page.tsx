'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function TeacherClassesPage() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [semester, setSemester] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) {
        setMessage({ kind: 'err', text: '请先登录' });
        setLoading(false);
        return;
      }
      const res = await fetch('/api/classes', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success && Array.isArray(data.classes)) setRows(data.classes);
      else setMessage({ kind: 'err', text: data.error || '加载失败' });
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) {
      setMessage({ kind: 'err', text: '班级名称不能为空' });
      return;
    }
    setCreating(true);
    setMessage(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          courseName: courseName.trim() || undefined,
          semester: semester.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setMessage({ kind: 'ok', text: `班级已创建：邀请码 ${data.class.inviteCode}` });
        setName(''); setCourseName(''); setSemester('');
        setShowCreate(false);
        await load();
      } else {
        setMessage({ kind: 'err', text: data.error || '创建失败' });
      }
    } catch (err) {
      setMessage({ kind: 'err', text: String(err) });
    }
    setCreating(false);
  };

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
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {showCreate ? '收起' : '新建班级'}
          </button>
        </div>
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

      {showCreate && (
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">新建班级</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs">
              <span className="text-muted-foreground">班级名称*</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：自动化 2024-1 班"
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">课程名（可选）</span>
              <input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="默认：8051单片机原理与应用"
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
              />
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">学期（可选）</span>
              <input
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="如：2026 春"
                className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              创建
            </button>
          </div>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">班级</th>
              <th className="px-3 py-2 text-left">学期</th>
              <th className="px-3 py-2 text-left">邀请码</th>
              <th className="px-3 py-2 text-left">学生数</th>
              <th className="px-3 py-2 text-left">教师</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.courseName || '—'}</div>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{c.semester || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{c.inviteCode}</td>
                <td className="px-3 py-2 font-mono text-xs">{c._count?.enrollments ?? 0}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{c.teacher?.name || c.teacher?.username || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted"
                  >
                    详情
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
                  还没有班级，点右上「新建班级」开始。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
