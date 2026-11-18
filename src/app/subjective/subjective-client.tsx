'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicSubjectiveQuestion } from '@/lib/subjective-data';
import { Button } from '@/components/ui/button';
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ListFilter,
  Loader2,
  PenLine,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getStoredAccessToken } from '@/lib/auth-storage';

type Verdict = 'got' | 'review';
type ProgressEntry = { verdict: Verdict; attempts: number; updatedAt: string };
type ProgressMap = Record<string, ProgressEntry>;
type Revealed = { correctAnswer: string; rubric: string };

const CHAPTER_NAMES: Record<number, string> = {
  1: '绪论编码', 2: '硬件结构', 3: '指令系统', 4: '汇编程序', 5: '中断定时',
  6: '串行通信', 8: '模拟接口', 9: '人机交互', 10: '电机开关', 11: '系统设计',
};

const TYPE_TINT: Record<string, string> = {
  '简答': 'text-sky-300 border-sky-300/25 bg-sky-300/10',
  '指令编写': 'text-cyan-300 border-cyan-300/25 bg-cyan-300/10',
  '读程': 'text-violet-300 border-violet-300/25 bg-violet-300/10',
  '编程': 'text-amber-300 border-amber-300/25 bg-amber-300/10',
  '硬件': 'text-emerald-300 border-emerald-300/25 bg-emerald-300/10',
  '综合': 'text-rose-300 border-rose-300/25 bg-rose-300/10',
};

function typeTint(type: string): string {
  const key = Object.keys(TYPE_TINT).find((name) => type.includes(name));
  return key ? TYPE_TINT[key]! : 'text-slate-300 border-white/[0.15] bg-white/[0.05]';
}

function statusOf(progress: ProgressMap, id: number): Verdict | undefined {
  return progress[String(id)]?.verdict;
}

export function SubjectiveClient() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [questions, setQuestions] = useState<PublicSubjectiveQuestion[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [selectedId, setSelectedId] = useState(1);
  const [chapterFilter, setChapterFilter] = useState<number | 'all' | 'review'>('all');
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, Revealed>>({});
  const [loading, setLoading] = useState(true);
  const [revealing, setRevealing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const authHeaders = useCallback((): Record<string, string> => {
    const token = getStoredAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/subjective/questions');
        if (!response.ok) throw new Error('题库加载失败');
        const payload = (await response.json()) as { data: PublicSubjectiveQuestion[] };
        if (cancelled) return;
        setQuestions(payload.data);
        setSelectedId(payload.data[0]?.id ?? 1);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '题库加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) { setProgress({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/subjective/progress', { headers: authHeaders() });
        if (!response.ok) return;
        const payload = (await response.json()) as { data: ProgressMap };
        if (!cancelled) setProgress(payload.data);
      } catch { /* 进度缺失不阻塞做题 */ }
    })();
    return () => { cancelled = true; };
  }, [user, authHeaders]);

  const stats = useMemo(() => {
    let got = 0, review = 0;
    for (const entry of Object.values(progress)) {
      if (entry.verdict === 'got') got += 1;
      else review += 1;
    }
    return { got, review, total: questions.length };
  }, [progress, questions.length]);

  const filteredQuestions = useMemo(() => {
    if (chapterFilter === 'all') return questions;
    if (chapterFilter === 'review') return questions.filter((q) => statusOf(progress, q.id) === 'review');
    return questions.filter((q) => q.chapter === chapterFilter);
  }, [questions, progress, chapterFilter]);

  const chapters = useMemo(() => [...new Set(questions.map((q) => q.chapter))].sort((a, b) => a - b), [questions]);
  const question = questions.find((q) => q.id === selectedId);
  const revealedAnswer = question ? revealed[question.id] : undefined;
  const position = filteredQuestions.findIndex((q) => q.id === selectedId);

  const pick = (id: number) => {
    setSelectedId(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reveal = async () => {
    if (!question || revealedAnswer || revealing) return;
    if (!user) {
      toast({ title: '登录后才能查看参考答案', variant: 'destructive' });
      router.push(`/login?from=${encodeURIComponent('/subjective')}`);
      return;
    }
    setRevealing(true);
    try {
      const response = await fetch(`/api/subjective/reveal?id=${question.id}`, { headers: authHeaders() });
      if (!response.ok) throw new Error('参考答案加载失败');
      const payload = (await response.json()) as Revealed;
      setRevealed((prev) => ({ ...prev, [question.id]: payload }));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : '参考答案加载失败', variant: 'destructive' });
    } finally {
      setRevealing(false);
    }
  };

  const judge = async (verdict: Verdict) => {
    if (!question || submitting) return;
    if (!user) {
      toast({ title: '请先登录再记录自评', variant: 'destructive' });
      router.push(`/login?from=${encodeURIComponent('/subjective')}`);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/subjective/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ questionId: question.id, verdict, draft: drafts[question.id] }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? '自评提交失败');
      }
      const entry: ProgressEntry = { verdict, attempts: (progress[String(question.id)]?.attempts ?? 0) + 1, updatedAt: new Date().toISOString() };
      setProgress((prev) => ({ ...prev, [String(question.id)]: entry }));
      const next = filteredQuestions.find((q) => q.id !== question.id && statusOf({ ...progress, [String(question.id)]: entry }, q.id) !== 'got');
      if (next) pick(next.id);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : '自评提交失败', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> 加载主观题库…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col items-center justify-center gap-4 text-slate-300">
        <p role="alert">{error}</p>
        <Button type="button" onClick={() => window.location.reload()} className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">重新加载</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-6 sm:px-4">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">3084 · 主观题训练</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-50">大题特训：先动笔，再对照评分细则</h1>
          <p className="mt-1 text-sm text-slate-400">简答、指令编写、完整汇编编程与综合设计共 {stats.total} 题。翻牌后自评，草稿随自评一并保存。</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-emerald-200">会做 {stats.got}</span>
          <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-amber-200">待巩固 {stats.review}</span>
          <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-slate-300">共 {stats.total} 题</span>
        </div>
      </header>

      {!authLoading && !user && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100">
          <span>未登录可以浏览题干，查看参考答案和记录自评需要登录。</span>
          <Button asChild className="min-h-10 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
            <Link href={`/login?from=${encodeURIComponent('/subjective')}`}>登录本人账号</Link>
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ListFilter className="h-4 w-4 text-slate-500" aria-hidden />
        <Button type="button" aria-pressed={chapterFilter === 'all'} onClick={() => setChapterFilter('all')} className="min-h-9 border border-white/[0.12] bg-white/[0.04] px-3 text-xs text-slate-200 hover:bg-white/[0.08]">全部（{questions.length}）</Button>
        <Button type="button" aria-pressed={chapterFilter === 'review'} onClick={() => setChapterFilter('review')} className="min-h-9 border border-amber-300/25 bg-amber-300/[0.07] px-3 text-xs text-amber-200 hover:bg-amber-300/[0.12]">待巩固（{stats.review}）</Button>
        {chapters.map((chapter) => (
          <Button key={chapter} type="button" aria-pressed={chapterFilter === chapter} onClick={() => setChapterFilter(chapter)} className="min-h-9 border border-white/[0.12] bg-white/[0.04] px-3 text-xs text-slate-200 hover:bg-white/[0.08]">
            第{chapter}章 {CHAPTER_NAMES[chapter] ?? ''}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="max-h-[70vh] overflow-y-auto rounded-md border border-white/[0.08] bg-[#0c1117] p-2">
          {filteredQuestions.length === 0 && <p className="p-4 text-center text-sm text-slate-500">该筛选下暂无题目。</p>}
          {filteredQuestions.map((item) => {
            const status = statusOf(progress, item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item.id)}
                aria-current={item.id === selectedId}
                className={cn(
                  'mb-1 flex w-full items-start gap-2 rounded px-2.5 py-2 text-left transition-colors',
                  item.id === selectedId ? 'bg-cyan-300/[0.12] ring-1 ring-inset ring-cyan-300/30' : 'hover:bg-white/[0.05]',
                )}
              >
                <span className={cn('mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center',
                  status === 'got' ? 'text-emerald-300' : status === 'review' ? 'text-amber-300' : 'text-slate-600')}>
                  {status === 'got' ? <CheckCircle2 className="h-4 w-4" /> : status === 'review' ? <RotateCcw className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-5 text-slate-200">{item.origId} · {item.title}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">{item.type} · {item.points}分 · 第{item.chapter}章</span>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="rounded-md border border-white/[0.08] bg-[#0c1117] p-5 shadow-2xl shadow-black/30">
          {question ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-2.5 py-0.5 text-xs', typeTint(question.type))}>{question.type}</span>
                  <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-300">{question.points} 分</span>
                  <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-0.5 text-xs text-slate-400">第{question.chapter}章 · {question.section} · {question.level}</span>
                </div>
                <span className="text-xs text-slate-500">{question.origId}{position >= 0 ? ` · ${position + 1} / ${filteredQuestions.length}` : ''}</span>
              </div>

              <h2 className="mt-4 text-lg font-medium leading-7 text-slate-100">{question.title}</h2>
              <pre className="mt-3 whitespace-pre-wrap break-words rounded-md border border-white/[0.08] bg-black/30 p-4 font-mono text-[13px] leading-6 text-slate-300">{question.questionText}</pre>

              <label className="mt-4 block text-sm font-medium text-slate-200" htmlFor="subj-draft">
                <PenLine className="mr-1 inline h-4 w-4 text-cyan-300" aria-hidden /> 先动笔写一写（草稿随自评保存）
              </label>
              <textarea
                id="subj-draft"
                rows={6}
                maxLength={8000}
                value={drafts[question.id] ?? ''}
                onChange={(event) => setDrafts((prev) => ({ ...prev, [question.id]: event.target.value }))}
                placeholder="把思路、指令序列或计算过程写在这里…"
                className="mt-2 w-full rounded-md border border-white/[0.12] bg-white/[0.03] p-3 font-mono text-[13px] leading-6 text-slate-200 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none"
              />

              {!revealedAnswer ? (
                <Button type="button" onClick={reveal} disabled={revealing} className="mt-3 min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                  {revealing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  翻开参考答案与评分细则
                </Button>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-md border border-emerald-300/25 bg-emerald-300/[0.06] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300">参考答案</p>
                    <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-6 text-emerald-100">{revealedAnswer.correctAnswer}</pre>
                  </div>
                  {revealedAnswer.rubric && (
                    <div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">评分细则</p>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{revealedAnswer.rubric}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.08] pt-4">
                    <span className="text-sm text-slate-400">对照评分点，这道题你给自己判：</span>
                    <Button type="button" onClick={() => judge('review')} disabled={submitting} variant="outline" className="min-h-11 border-amber-300/40 bg-amber-300/[0.08] text-amber-200 hover:bg-amber-300/[0.15]">
                      <RotateCcw className="mr-2 h-4 w-4" /> 还不熟，待巩固
                    </Button>
                    <Button type="button" onClick={() => judge('got')} disabled={submitting} className="min-h-11 bg-emerald-400 text-[#00140a] hover:bg-emerald-300">
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      会做，掌握它
                    </Button>
                    {statusOf(progress, question.id) && (
                      <span className="text-xs text-slate-500">上次自评：{statusOf(progress, question.id) === 'got' ? '会做' : '待巩固'}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4">
                <Button type="button" variant="outline" disabled={position <= 0} onClick={() => pick(filteredQuestions[position - 1]!.id)} className="min-h-10 border-white/[0.12] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]">
                  <ChevronLeft className="mr-1 h-4 w-4" /> 上一题
                </Button>
                <BookOpenCheck className="h-5 w-5 text-slate-600" aria-hidden />
                <Button type="button" variant="outline" disabled={position < 0 || position >= filteredQuestions.length - 1} onClick={() => pick(filteredQuestions[position + 1]!.id)} className="min-h-10 border-white/[0.12] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]">
                  下一题 <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <p className="p-8 text-center text-slate-500">从左侧列表选择一道题开始练习。</p>
          )}
        </section>
      </div>
    </div>
  );
}
