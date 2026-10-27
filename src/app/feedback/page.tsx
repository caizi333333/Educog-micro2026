'use client';

import { useState, type FormEvent, type JSX } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { processAchievementResponse } from '@/hooks/use-achievement-notifications';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { CLIENT_WRITE_TIMEOUT_MS, fetchClientRequest } from '@/lib/client-fetch';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX_BODY_LENGTH,
  FEEDBACK_MAX_PER_CAMPUS_DAY,
  FEEDBACK_MIN_BODY_LENGTH,
  resolveFeedbackPagePath,
} from '@/lib/feedback-policy';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface FeedbackResponse {
  ok?: boolean;
  error?: string;
  unlockedAchievements?: Array<{ achievementId: string; points: number; unlocked: boolean }>;
}

export default function FeedbackPage(): JSX.Element {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (submitting) return;
    if (!category) {
      toast({ title: '请选择反馈类别', variant: 'destructive' });
      return;
    }
    const trimmed = body.trim();
    if (trimmed.length < FEEDBACK_MIN_BODY_LENGTH) {
      toast({ title: `请至少写 ${FEEDBACK_MIN_BODY_LENGTH} 个字`, variant: 'destructive' });
      return;
    }
    const token = getStoredAccessToken();
    if (!token) {
      toast({ title: '请先登录', description: '登录后才能提交反馈。', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetchClientRequest('/api/feedback', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          body: trimmed,
          anonymous,
          pagePath: resolveFeedbackPagePath(searchParams.get('from'), window.location.pathname),
        }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      const payload = await response.json() as FeedbackResponse;
      if (!response.ok || payload.ok !== true) {
        toast({
          title: '没有提交成功',
          description: payload.error || '请稍后重试',
          variant: 'destructive',
        });
        return;
      }
      const unlocked = Array.isArray(payload.unlockedAchievements) ? payload.unlockedAchievements : [];
      toast({
        title: '反馈已收到',
        description: unlocked.length > 0
          ? '感谢反馈。新的反馈勋章已解锁，请看弹出的勋章提示。'
          : '感谢你的反馈，老师可以在教师端查看。',
      });
      if (unlocked.length > 0) {
        processAchievementResponse({ newAchievements: unlocked });
      }
      setBody('');
    } catch {
      toast({ title: '提交失败', description: '请检查网络后重试。', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground" role="status">正在核验登录状态…</p>;
  }

  if (!user || user.role !== 'STUDENT') {
    return <p className="text-sm text-muted-foreground">请使用学生账号登录后再提交反馈。</p>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 pb-24">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">Feedback</p>
        <h1 className="mt-2 text-2xl font-semibold">意见反馈</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          第 1、2、3 条有效反馈会分别解锁对应勋章。每天最多 {FEEDBACK_MAX_PER_CAMPUS_DAY} 条，两次提交至少间隔 1 分钟。
        </p>
      </div>

      <form className="space-y-4 rounded-md border border-white/[0.08] bg-white/[0.035] p-4 sm:p-6" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="feedback-category">类别</Label>
          <select
            id="feedback-category"
            className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={submitting}
            required
          >
            <option value="">请选择类别</option>
            {FEEDBACK_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="feedback-body">内容</Label>
          <Textarea
            id="feedback-body"
            className="min-h-32"
            maxLength={FEEDBACK_MAX_BODY_LENGTH}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={`请具体描述你在使用中遇到的情况，至少 ${FEEDBACK_MIN_BODY_LENGTH} 个字。`}
            disabled={submitting}
            required
          />
          <p className="text-xs text-muted-foreground">{body.trim().length}/{FEEDBACK_MAX_BODY_LENGTH}</p>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="feedback-anonymous"
            className="mt-1"
            checked={anonymous}
            onCheckedChange={(value) => setAnonymous(value === true)}
            disabled={submitting}
          />
          <div>
            <Label htmlFor="feedback-anonymous">匿名提交</Label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              不勾选则实名提交，教师可以看到你的姓名和学号。勾选后教师列表只显示「匿名」。
            </p>
          </div>
        </div>

        <Button className="min-h-11 w-full sm:w-auto" type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? '正在提交…' : '提交反馈'}
        </Button>
      </form>
    </div>
  );
}
