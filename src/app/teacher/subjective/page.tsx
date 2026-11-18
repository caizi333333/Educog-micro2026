'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Loader2, PenSquare, Users } from 'lucide-react';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { cn } from '@/lib/utils';

const weakQuestionSchema = z.object({
  questionId: z.number(),
  origId: z.string(),
  title: z.string(),
  type: z.string(),
  chapter: z.number(),
  points: z.number(),
  reviewCount: z.number(),
  gotCount: z.number(),
});

const weakStudentSchema = z.object({
  userId: z.string(),
  name: z.string(),
  username: z.string(),
  studentId: z.string().nullable(),
  reviewCount: z.number(),
  attemptCount: z.number(),
  lastActivityAt: z.string(),
});

const summarySchema = z.object({
  totals: z.object({
    rosterCount: z.number(),
    practicedCount: z.number(),
    reviewMarkedCount: z.number(),
    reviewVerdictCount: z.number(),
  }),
  weakQuestions: z.array(weakQuestionSchema),
  byChapter: z.array(z.object({ chapter: z.number(), reviewCount: z.number() })),
  weakStudents: z.array(weakStudentSchema),
});

type Summary = z.infer<typeof summarySchema>;

const CHAPTER_NAMES: Record<number, string> = {
  1: '数制编码', 2: '硬件结构', 3: '指令系统', 4: '汇编程序', 5: '中断定时',
  6: '串行通信', 8: '模拟接口', 9: '人机交互', 10: '电机开关', 11: '系统设计',
};

export default function TeacherSubjectiveWeaknessPage(): React.JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = getStoredAccessToken();
    const headers: Record<string, string> = {};
    if (token && token !== 'cookie-session' && token.includes('.')) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const response = await fetch('/api/teacher/subjective-weakness', {
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '大题薄弱数据读取失败';
        setError(response.status === 403 ? '当前账号不能查看教师看板' : message);
        setSummary(null);
        return;
      }
      const parsed = summarySchema.safeParse(body);
      if (!parsed.success) {
        setError('大题薄弱数据格式无效');
        setSummary(null);
        return;
      }
      setSummary(parsed.data);
    } catch {
      setError('大题薄弱数据读取失败');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div>
        <Link href="/teacher" className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-400 hover:text-cyan-100">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回教学仪表板
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">大题薄弱看板</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          本学期正式班学生在「大题特训」里的自评汇总：哪些题最多人标"还不熟"、哪些章最薄弱、
          哪些学生最需要个别帮扶。学生作答入口在
          {' '}
          <Link href="/subjective" className="text-cyan-100 underline-offset-2 hover:underline">大题特训</Link>
          。
        </p>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>}

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在汇总大题自评…
        </p>
      )}

      {!loading && summary && (
        <>
          <p className="text-sm text-slate-300">
            在册 {summary.totals.rosterCount} 人 · 练过大题 {summary.totals.practicedCount} 人 ·
            有待巩固 {summary.totals.reviewMarkedCount} 人 · 累计待巩固标记 {summary.totals.reviewVerdictCount} 次
          </p>

          {summary.totals.practicedCount === 0 ? (
            <section className="rounded-md border border-white/10 bg-[#0b1118] p-5 text-sm text-slate-400">
              本学期还没有学生做大题特训。学生从左侧「大题特训」进入，写草稿、翻评分细则、自评会做或不熟之后，这里才会出现数据。
            </section>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-md border border-white/10 bg-[#0b1118] p-4 lg:col-span-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50">
                  <PenSquare className="h-4 w-4 text-amber-200" aria-hidden="true" />
                  薄弱大题排行
                </h2>
                <p className="mt-1 text-xs text-slate-500">按"还不熟"最新自评人数排序，前 15 题。</p>
                {summary.weakQuestions.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">暂无待巩固标记——学生要么全会，要么还没练。</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {summary.weakQuestions.map((question) => (
                      <li key={question.questionId} className="rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-slate-100">
                            <span className="mr-2 font-mono text-xs text-slate-500">{question.origId}</span>
                            {question.title}
                          </span>
                          <span className="shrink-0 text-xs text-amber-200">{question.reviewCount} 人待巩固</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          第{question.chapter}章{CHAPTER_NAMES[question.chapter] ? ` · ${CHAPTER_NAMES[question.chapter]}` : ''} · {question.type} · {question.points}分
                          {question.gotCount > 0 ? ` · 另有 ${question.gotCount} 人标会做` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex flex-col gap-4 lg:col-span-2">
                <section className="rounded-md border border-white/10 bg-[#0b1118] p-4">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50">
                    <BookOpen className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                    按章薄弱分布
                  </h2>
                  {summary.byChapter.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">暂无数据。</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {summary.byChapter.map((row) => (
                        <li key={row.chapter} className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">第{row.chapter}章 {CHAPTER_NAMES[row.chapter] ?? ''}</span>
                          <span className="text-amber-200">{row.reviewCount} 人次待巩固</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-md border border-white/10 bg-[#0b1118] p-4">
                  <h2 className="flex items-center gap-2 text-base font-semibold text-slate-50">
                    <Users className="h-4 w-4 text-amber-200" aria-hidden="true" />
                    需要帮扶的学生
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">按待巩固题数排序，前 15 人。</p>
                  {summary.weakStudents.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">暂无待巩固学生。</p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-1.5">
                      {summary.weakStudents.map((student) => (
                        <li key={student.userId} className="flex items-baseline justify-between gap-3 text-sm">
                          <span className="text-slate-100">
                            {student.name}
                            <span className="ml-2 text-xs text-slate-500">{student.studentId || student.username}</span>
                          </span>
                          <span className={cn('shrink-0 text-xs', student.reviewCount >= 5 ? 'text-amber-200' : 'text-slate-300')}>
                            待巩固 {student.reviewCount} 题 · 共练 {student.attemptCount} 次
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
