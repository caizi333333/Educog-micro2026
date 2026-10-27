'use client';

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { CLIENT_READ_TIMEOUT_MS, fetchClientRequest } from '@/lib/client-fetch';
import { formatCampusDateTime } from '@/lib/campus-time';
import type { TeacherFeedbackItem } from '@/lib/feedback-policy';
import { Button } from '@/components/ui/button';

interface FeedbackListResponse {
  ok?: boolean;
  error?: string;
  items?: TeacherFeedbackItem[];
}

export default function TeacherFeedbackPage(): JSX.Element {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<TeacherFeedbackItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const loadFeedback = useCallback(async (): Promise<void> => {
    const token = getStoredAccessToken();
    if (!token) {
      setError('请先登录');
      setItems([]);
      return;
    }
    setReading(true);
    setError(null);
    try {
      const response = await fetchClientRequest('/api/teacher/feedback', {
        headers: { Authorization: `Bearer ${token}` },
      }, CLIENT_READ_TIMEOUT_MS);
      const payload = await response.json() as FeedbackListResponse;
      if (!response.ok || payload.ok !== true || !Array.isArray(payload.items)) {
        setError(payload.error || '读取失败');
        setItems([]);
        return;
      }
      setItems(payload.items);
    } catch {
      setError('读取失败，请稍后重试');
      setItems([]);
    } finally {
      setReading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user?.role === 'TEACHER' || user?.role === 'ADMIN') {
      void loadFeedback();
    }
  }, [loading, loadFeedback, user?.role]);

  if (loading) {
    return <p className="text-sm text-muted-foreground" role="status">正在核验登录状态…</p>;
  }

  if (user?.role !== 'TEACHER' && user?.role !== 'ADMIN') {
    return <p className="text-sm text-muted-foreground">只有教师或管理员可以查看学生反馈。</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Inbox</p>
          <h1 className="mt-2 text-2xl font-semibold">学生反馈</h1>
          <p className="mt-1 text-sm text-muted-foreground">按提交时间从新到旧排列。匿名反馈不显示姓名和学号。</p>
        </div>
        <Button className="min-h-11" variant="secondary" onClick={() => void loadFeedback()} disabled={reading} aria-busy={reading}>
          {reading ? '正在读取…' : '刷新'}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-red-400/30 bg-red-400/[0.08] px-3 py-2 text-sm text-red-100">{error}</p>
      ) : null}

      {!error && !reading && items.length === 0 ? (
        <p className="rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-8 text-center text-sm text-muted-foreground">还没有学生反馈。</p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium">
                {item.anonymous ? '匿名' : item.displayName}
                {!item.anonymous && item.studentId ? <span className="ml-2 font-normal text-muted-foreground">学号 {item.studentId}</span> : null}
              </p>
              <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>{formatCampusDateTime(item.createdAt)}</time>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {item.categoryLabel} · {item.className} · {item.anonymous ? '匿名' : '实名'}
              {item.pagePath ? ` · ${item.pagePath}` : ''}
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
