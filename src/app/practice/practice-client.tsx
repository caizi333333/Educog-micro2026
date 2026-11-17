'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Cpu,
  Flame,
  Layers,
  Radio,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Target,
  Timer,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { practiceRequest } from '@/lib/practice-cards-client';
import type {
  CardFeedback,
  PracticeMode,
  PracticeQuestion,
} from '@/lib/practice-cards';
import styles from './practice.module.css';

type Chapter = {
  chapter: number;
  title: string;
  total: number;
  answered: number;
  accuracy: number;
  coverage: number;
  stars: number;
};
type Leader = { name: string; best: number };
type Dashboard = {
  name: string;
  classId: string | null;
  classes: { id: string; name: string }[];
  goal: number;
  today: number;
  streak: number;
  xp: number;
  answered: number[];
  due: number[];
  wrong: number[];
  chapters: Chapter[];
  leaderboard: Leader[];
  best: number;
};
type Challenge = {
  id: string;
  deadline: string;
  questions: PracticeQuestion[];
  until: number;
};
type ChallengeResult = {
  score: number;
  total: number;
  best: number;
  leaderboard: Leader[];
};

function Mascot() {
  return (
    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-primary/40 bg-primary/10 text-primary">
      <Cpu className="h-14 w-14" strokeWidth={1.4} />
      <Sparkles className="absolute -right-2 -top-2 h-7 w-7 text-amber-400" />
    </div>
  );
}
function GoalRing({ value, goal }: { value: number; goal: number }) {
  return (
    <div
      className="relative h-24 w-24 shrink-0"
      role="img"
      aria-label={'今日已练 ' + value + ' 题，目标 ' + goal + ' 题'}
    >
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className="text-primary/15"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={264}
          strokeDashoffset={264 * (1 - Math.min(value / goal, 1))}
          className="text-primary"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <strong className="text-2xl">{value}</strong>
        <span className="text-xs text-muted-foreground">/ {goal} 题</span>
      </div>
    </div>
  );
}
function Leaderboard({ rows }: { rows: Leader[] }) {
  return (
    <Card className="rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Trophy className="h-5 w-5 text-amber-400" />
        本班闪电榜
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        个人最佳 · 仅展示姓名 · Top 10
      </p>
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-6 font-mono text-primary">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 truncate">{r.name}</span>
              <b>{r.best} 题</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          第一束闪电，会是你吗？
        </p>
      )}
    </Card>
  );
}
function QuestionFigure({ question }: { question: PracticeQuestion }) {
  const figure = question.figure;
  if (!figure) return null;
  const src = typeof figure === 'string' ? figure : figure.src;
  if (!src?.startsWith('/') || src.startsWith('//')) return null;
  return (
    <figure className="my-4 rounded-xl border bg-muted/30 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={typeof figure === 'string' ? '题目附图' : figure.alt}
        className="mx-auto max-h-64 max-w-full object-contain"
      />
      {typeof figure !== 'string' && figure.caption && (
        <figcaption className="mt-2 text-sm text-muted-foreground">
          {figure.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function PracticeClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [view, setView] = useState<
    'home' | 'quiz' | 'summary' | 'challenge-result' | 'wrong'
  >('home');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pendingAnswers = useRef(
    new Map<string, { requestId: string; answer: string }>(),
  );
  const finishing = useRef(false);
  const finishFailed = useRef(false);
  const [queue, setQueue] = useState<PracticeQuestion[]>([]);
  const [mode, setMode] = useState<PracticeMode | 'challenge'>('all');
  const [position, setPosition] = useState(0);
  const [results, setResults] = useState<Record<number, CardFeedback>>({});
  const [back, setBack] = useState(false);
  const [answer, setAnswer] = useState('');
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [run, setRun] = useState<Challenge | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [challengeResult, setChallengeResult] =
    useState<ChallengeResult | null>(null);
  const [drag, setDrag] = useState(0);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const current = queue[position];
  const feedback = current ? results[current.id] : undefined;
  const completed = Object.values(results);
  const wrong = queue.filter((q) => results[q.id] && !results[q.id].correct);
  const gained = completed.reduce((sum, r) => sum + r.xp, 0);

  const load = useCallback(async (classId?: string | null) => {
    try {
      setDashboard(await practiceRequest<Dashboard>('me', undefined, classId));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (back) resultRef.current?.focus({ preventScroll: true });
  }, [back, position]);

  const home = async () => {
    setView('home');
    setRun(null);
    await load(dashboard?.classId);
    window.scrollTo({ top: 0 });
  };
  const finishChallenge = useCallback(async () => {
    if (!run || finishing.current || busyRef.current) return;
    finishFailed.current = false;
    finishing.current = true;
    setBusy(true);
    try {
      const result = await practiceRequest<ChallengeResult>(
        'challenge/finish',
        { id: run.id },
        dashboard?.classId,
      );
      setChallengeResult(result);
      setView('challenge-result');
      setRun(null);
      setError('');
    } catch (e) {
      finishFailed.current = true;
      setError(e instanceof Error ? e.message : '保存成绩失败，请重试');
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  }, [run, dashboard?.classId]);
  useEffect(() => {
    if (view !== 'quiz' || !run) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((run.until - performance.now()) / 1000),
      );
      setSeconds(remaining);
      if (!remaining && !finishFailed.current) void finishChallenge();
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [run, view, finishChallenge]);

  const start = async (
    nextMode: PracticeMode | 'challenge',
    chapter?: number,
    ids?: number[],
    daily = false,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      let questions: PracticeQuestion[];
      let challenge: Challenge | null = null;
      if (nextMode === 'challenge') {
        const sent = performance.now();
        const response = await practiceRequest<Omit<Challenge, 'until'>>(
          'challenge/start',
          {},
          dashboard?.classId,
        );
        challenge = { ...response, until: sent + 60000 };
        questions = response.questions;
        setSeconds(60);
      } else {
        const params = new URLSearchParams({ mode: nextMode });
        if (daily) params.set('daily', '1');
        if (chapter) params.set('chapter', String(chapter));
        if (ids) params.set('ids', ids.join(','));
        questions = await practiceRequest<PracticeQuestion[]>(
          'questions?' + params,
          undefined,
          dashboard?.classId,
        );
        if (daily) {
          questions = questions.slice(
            0,
            Math.min(
              20,
              Math.max(
                1,
                (dashboard?.goal || 20) - (dashboard?.today || 0) || 20,
              ),
            ),
          );
        }
      }
      setQueue(questions);
      setRun(challenge);
      setMode(nextMode);
      setPosition(0);
      setResults({});
      setBack(false);
      setAnswer('');
      setCombo(0);
      setMaxCombo(0);
      setView('quiz');
      window.scrollTo({ top: 0 });
      finishFailed.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : '开始失败');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const go = (next: number) => {
    if (busyRef.current || run || next < 0) return;
    if (next >= queue.length) {
      setView('summary');
      window.scrollTo({ top: 0 });
      return;
    }
    setPosition(next);
    setBack(Boolean(results[queue[next].id]));
    setAnswer('');
    setDrag(0);
  };
  const submit = async (value: string) => {
    if (
      !current ||
      busyRef.current ||
      feedback ||
      finishing.current ||
      (run && seconds === 0)
    )
      return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (run) {
        const result = await practiceRequest<{ correct: boolean; xp: number }>(
          'challenge/answer',
          { id: run.id, position, answer: value },
          dashboard?.classId,
        );
        setResults((prev) => ({
          ...prev,
          [current.id]: {
            questionId: current.id,
            answer: value,
            correct: result.correct,
            xp: result.xp,
            correctAnswer: '',
            explanation: '',
          },
        }));
        const nextCombo = result.correct ? combo + 1 : 0;
        setCombo(nextCombo);
        setMaxCombo((prev) => Math.max(prev, nextCombo));
        if (position + 1 < queue.length) {
          setPosition(position + 1);
          setAnswer('');
        } else {
          run.until = performance.now();
        }
      } else {
        const key = JSON.stringify([dashboard?.classId, mode, current.id]);
        const pending = pendingAnswers.current.get(key) ?? {
          requestId: crypto.randomUUID(),
          answer: value,
        };
        pendingAnswers.current.set(key, pending);
        const result = await practiceRequest<CardFeedback>(
          'answer',
          {
            questionId: current.id,
            answer: pending.answer,
            mode,
            requestId: pending.requestId,
          },
          dashboard?.classId,
        );
        pendingAnswers.current.delete(key);
        setResults((prev) => ({ ...prev, [current.id]: result }));
        setBack(true);
        const nextCombo = result.correct ? combo + 1 : 0;
        setCombo(nextCombo);
        setMaxCombo((prev) => Math.max(prev, nextCombo));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请重试');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (view !== 'quiz') return;
    const key = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest('input,textarea,select'))
      )
        return;
      if (event.key === 'Enter' && event.target instanceof HTMLButtonElement)
        return;
      if (event.key === 'ArrowRight' || (event.key === 'Enter' && back)) {
        event.preventDefault();
        go(position + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        go(position - 1);
      } else if (!back && current?.type === 'multiple-choice') {
        const index =
          '1234'.indexOf(event.key) >= 0
            ? '1234'.indexOf(event.key)
            : 'abcd'.indexOf(event.key.toLowerCase());
        if (index >= 0 && current.options[index]) {
          event.preventDefault();
          void submit(current.options[index]);
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const browseWrong = async () => {
    setBusy(true);
    try {
      setQueue(
        await practiceRequest<PracticeQuestion[]>(
          'questions?mode=wrong',
          undefined,
          dashboard?.classId,
        ),
      );
      setView('wrong');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        styles.shell,
        'mx-auto w-full max-w-5xl space-y-6 pb-10 text-base',
      )}
    >
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm"
        >
          {error}{' '}
          <Link href="/login" className="underline">
            登录 / 更换账号
          </Link>
          {!dashboard && (
            <Button variant="ghost" onClick={() => void load()}>
              重新加载
            </Button>
          )}
        </div>
      )}
      {!dashboard ? (
        <p role="status" className="py-16 text-center text-muted-foreground">
          {error ? '请确认已加入班级。' : '正在打开你的学习地图…'}
        </p>
      ) : (
        <>
          {view === 'home' && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs font-medium tracking-[.18em] text-primary">
                    DAILY SPARK / 8051
                  </p>
                  <h1 className="text-2xl font-bold sm:text-3xl">
                    嗨，{dashboard.name}。
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    先学一张卡片，再点亮一个知识点。
                  </p>
                </div>
                <div className="hidden sm:block">
                  <Mascot />
                </div>
              </div>
              {!!dashboard.classes.length && (
                <label className="flex items-center gap-3 text-sm text-muted-foreground">
                  当前班级
                  <select
                    aria-label="当前班级"
                    className="min-h-11 max-w-[240px] rounded-lg border bg-background px-3 text-foreground"
                    value={dashboard.classId || ''}
                    onChange={(e) => void load(e.target.value)}
                  >
                    {dashboard.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
                <Card className="rounded-2xl border-primary/30 bg-primary/5 p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-primary">
                        每日充能计划 · 北京时间
                      </span>
                      <h2 className="mt-3 text-2xl font-bold leading-relaxed">
                        小小练习，
                        <br />
                        大大进步。
                      </h2>
                    </div>
                    <GoalRing value={dashboard.today} goal={dashboard.goal} />
                  </div>
                  <p className="my-4 text-sm text-muted-foreground">
                    {dashboard.today >= dashboard.goal
                      ? '今天的目标点亮了，明天也要见面。'
                      : '还差 ' +
                        (dashboard.goal - dashboard.today) +
                        ' 题，完成今天的小目标。'}
                  </p>
                  <Button
                    className={cn(
                      styles.chunky,
                      'h-12 w-full rounded-xl border-primary/40 text-base font-bold',
                    )}
                    disabled={busy}
                    onClick={() =>
                      void start('all', undefined, undefined, true)
                    }
                  >
                    继续学习 <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <label className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    每天目标
                    <select
                      aria-label="每日目标"
                      value={dashboard.goal}
                      className="min-h-9 rounded border bg-background px-2"
                      onChange={async (e) => {
                        try {
                          await practiceRequest('me', {
                            goal: Number(e.target.value),
                          });
                          await load(dashboard.classId);
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : '保存失败',
                          );
                        }
                      }}
                    >
                      {[...new Set([10, 20, 30, 50, dashboard.goal])]
                        .sort((a, b) => a - b)
                        .map((n) => (
                          <option key={n} value={n}>
                            {n} 题
                          </option>
                        ))}
                    </select>
                    <span>按不同题目计数</span>
                  </label>
                </Card>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="rounded-2xl p-4">
                      <Flame className="mb-2 h-5 w-5 text-amber-400" />
                      <strong className="text-2xl">{dashboard.streak}</strong>
                      <span className="ml-2 text-sm text-muted-foreground">
                        天连学
                      </span>
                    </Card>
                    <Card className="rounded-2xl p-4">
                      <Zap className="mb-2 h-5 w-5 text-primary" />
                      <strong className="text-2xl">{dashboard.xp}</strong>
                      <span className="ml-2 text-sm text-muted-foreground">
                        XP
                      </span>
                    </Card>
                  </div>
                  <button
                    disabled={busy}
                    className={cn(
                      styles.chunky,
                      'flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left hover:border-primary/50',
                    )}
                    onClick={() => void start('review')}
                  >
                    <RotateCcw className="h-7 w-7 text-primary" />
                    <span className="flex-1">
                      <b className="block">
                        今日复习 {dashboard.due.length} 题
                      </b>
                      <small className="text-muted-foreground">
                        记得刚刚好，让知识留得更久
                      </small>
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    disabled={busy}
                    className={cn(
                      styles.chunky,
                      'flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left hover:border-amber-400/50',
                    )}
                    onClick={() => void start('challenge')}
                  >
                    <Timer className="h-7 w-7 text-amber-400" />
                    <span className="flex-1">
                      <b className="block">限时挑战</b>
                      <small className="text-muted-foreground">
                        60 秒，看看你的闪电速度
                      </small>
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void start('all')}
                >
                  <Layers className="mr-2 h-4 w-4" />
                  顺序练习
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void start('random')}
                >
                  <Shuffle className="mr-2 h-4 w-4" />
                  随机 20 题
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void browseWrong()}
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  错题本 {dashboard.wrong.length}
                </Button>
              </div>
              <div>
                <h2 className="text-xl font-bold">你的知识星图</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  覆盖更多、答得更准，就能点亮更多星星。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {dashboard.chapters.map((c, i) => {
                  const Icon = [
                    Cpu,
                    Layers,
                    Zap,
                    BookOpen,
                    Activity,
                    Timer,
                    Radio,
                    Target,
                    Layers,
                    Sparkles,
                  ][i];
                  return (
                    <button
                      disabled={busy}
                      key={c.chapter}
                      onClick={() => void start('chapter', c.chapter)}
                      className={cn(
                        styles.chunky,
                        'rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className="h-7 w-7 text-primary" />
                        <small className="font-mono text-muted-foreground">
                          {String(c.chapter).padStart(2, '0')}
                        </small>
                      </div>
                      <h3 className="mb-3 mt-4 text-sm font-semibold">
                        {c.title}
                      </h3>
                      <Progress value={c.coverage} className="h-1.5" />
                      <div className="my-2 text-xs text-muted-foreground">
                        {c.answered} / {c.total} 题 · {c.accuracy}%
                      </div>
                      <span
                        className="flex gap-1"
                        aria-label={c.stars + '颗掌握星'}
                      >
                        {[0, 1, 2].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              'h-3.5 w-3.5',
                              s < c.stars
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/40',
                            )}
                          />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Leaderboard rows={dashboard.leaderboard} />
                <Card className="rounded-2xl p-5">
                  <Sparkles className="mb-3 h-6 w-6 text-primary" />
                  <h2 className="font-semibold">每次进步，都有迹可循。</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    错题 10 分钟后回到复习队列；答对后逐步延长到 1、3、7
                    天。首次答对同一道题每天获得一次 XP，连对还有额外奖励。XP
                    是刷题成长值，不重复发放测验积分。
                  </p>
                </Card>
              </div>
            </>
          )}
          {view === 'wrong' && (
            <>
              <Button variant="ghost" onClick={() => void home()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回知识星图
              </Button>
              <h1 className="text-2xl font-bold">
                错题本 <span className="text-primary">{queue.length}</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                最近一次答错的题，答对后自动移出。
              </p>
              {queue.length > 0 && (
                <Button disabled={busy} onClick={() => void start('wrong')}>
                  开始重练 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              <div className="space-y-3">
                {queue.map((q) => (
                  <button
                    key={q.id}
                    className="flex w-full gap-4 rounded-xl border bg-card p-5 text-left hover:border-primary"
                    onClick={() => void start('retry', undefined, [q.id])}
                  >
                    <span className="text-primary">#{q.id}</span>
                    <span>{q.questionText}</span>
                  </button>
                ))}
              </div>
              {!queue.length && (
                <Card className="p-8 text-center text-muted-foreground">
                  这里空空的，知识正在悄悄扎根。
                </Card>
              )}
            </>
          )}
          {view === 'quiz' && (
            <div className="mx-auto max-w-4xl">
              <div className="mb-5 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={run ? '结束挑战' : '结束练习'}
                  disabled={busy}
                  onClick={() =>
                    run ? void finishChallenge() : setView('summary')
                  }
                >
                  <X className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <Progress
                    value={
                      run
                        ? (seconds / 60) * 100
                        : (completed.length / (queue.length || 1)) * 100
                    }
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {run
                      ? '限时挑战 · 不显示解析'
                      : '第 ' +
                        (queue.length ? position + 1 : 0) +
                        ' / ' +
                        queue.length +
                        ' 张卡片'}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm font-bold text-amber-400">
                  {run
                    ? seconds + ' 秒'
                    : combo > 1
                      ? '连对 ×' + combo
                      : '专注这一张'}
                </span>
              </div>
              <div className="grid items-start gap-6 md:grid-cols-[160px_minmax(0,1fr)]">
                <aside className="hidden rounded-2xl border bg-card p-5 md:block">
                  <Mascot />
                  <h2 className="mt-5 font-semibold">一点一滴，点亮知识</h2>
                  <p className="my-4 text-sm leading-7 text-muted-foreground">
                    想一想，再做选择。
                    <br />
                    犯错也能收获新知识。
                  </p>
                  <strong className="text-2xl text-primary">
                    +{gained} XP
                  </strong>
                  <p className="mt-4 text-xs leading-6 text-muted-foreground">
                    1–4 / A–D 选择
                    <br />
                    Enter 继续
                    <br />← → 切换卡片
                  </p>
                </aside>
                <div className="min-w-0">
                  {!current ? (
                    <Card className="rounded-2xl p-8 text-center">
                      <RotateCcw className="mx-auto mb-4 h-10 w-10 text-primary" />
                      <h1 className="text-xl font-bold">暂时没有待练卡片</h1>
                      <p className="my-4 text-sm text-muted-foreground">
                        知识需要一点时间沉淀，稍后再来复习吧。
                      </p>
                      <Button onClick={() => void home()}>回到知识星图</Button>
                    </Card>
                  ) : (
                    <>
                      <div
                        className={styles.drag}
                        style={{
                          transform:
                            'translateX(' +
                            drag +
                            'px) rotate(' +
                            drag / 35 +
                            'deg)',
                        }}
                        onPointerDown={(e) => {
                          if (
                            run ||
                            (e.target as Element).closest(
                              'button,input,textarea,form',
                            )
                          )
                            return;
                          pointer.current = {
                            x: e.clientX,
                            y: e.clientY,
                            id: e.pointerId,
                          };
                          e.currentTarget.setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (
                            pointer.current &&
                            Math.abs(e.clientY - pointer.current.y) < 60
                          )
                            setDrag(e.clientX - pointer.current.x);
                        }}
                        onPointerCancel={() => {
                          pointer.current = null;
                          setDrag(0);
                        }}
                        onPointerUp={(e) => {
                          if (pointer.current) {
                            const delta = e.clientX - pointer.current.x;
                            if (
                              Math.abs(e.clientY - pointer.current.y) < 60 &&
                              Math.abs(delta) > 70
                            )
                              go(position + (delta < 0 ? 1 : -1));
                          }
                          pointer.current = null;
                          setDrag(0);
                        }}
                      >
                        <div
                          className={cn(styles.flip, back && styles.flipped)}
                        >
                          <Card
                            aria-hidden={back}
                            className={cn(
                              styles.face,
                              'rounded-2xl border-primary/20 p-5 sm:p-7',
                            )}
                          >
                            <div className="mb-5 flex justify-between gap-2 text-xs text-muted-foreground">
                              <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                                {current.type === 'multiple-choice'
                                  ? '选出你的答案'
                                  : '动手补全代码'}
                              </span>
                              <span className="py-1">
                                知识点 {current.ka} · #{current.id}
                              </span>
                            </div>
                            <h1 className="text-lg font-bold leading-8 sm:text-xl">
                              {current.questionText}
                            </h1>
                            <QuestionFigure question={current} />
                            {current.type === 'multiple-choice' ? (
                              <div className="mt-6 space-y-3">
                                {current.options.map((option, i) => (
                                  <button
                                    key={i}
                                    disabled={busy || back || Boolean(feedback)}
                                    tabIndex={back ? -1 : 0}
                                    onClick={() => void submit(option)}
                                    className={cn(
                                      styles.chunky,
                                      'flex w-full items-start gap-3 rounded-xl border bg-background p-4 text-left leading-6 hover:border-primary disabled:opacity-70',
                                    )}
                                  >
                                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs text-muted-foreground">
                                      {String.fromCharCode(65 + i)}
                                    </span>
                                    <span>{option}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <form
                                className="mt-5 space-y-4"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void submit(answer);
                                }}
                              >
                                <pre className="overflow-x-auto whitespace-pre rounded-xl bg-muted p-4 text-sm leading-7">
                                  {current.code}
                                </pre>
                                <label
                                  htmlFor="practice-answer"
                                  className="block text-sm"
                                >
                                  补全 ___ 处的代码
                                </label>
                                <Input
                                  id="practice-answer"
                                  disabled={busy || back || Boolean(feedback)}
                                  value={answer}
                                  onChange={(e) => setAnswer(e.target.value)}
                                  maxLength={4000}
                                  autoComplete="off"
                                  autoCapitalize="off"
                                  spellCheck={false}
                                  required
                                  placeholder="把答案写在这里…"
                                />
                                <Button
                                  disabled={busy || back || Boolean(feedback)}
                                  className="w-full"
                                >
                                  翻开答案
                                </Button>
                              </form>
                            )}
                          </Card>
                          <Card
                            ref={resultRef}
                            tabIndex={-1}
                            aria-hidden={!back}
                            aria-label="作答结果与解析"
                            className={cn(
                              styles.face,
                              styles.back,
                              'relative rounded-2xl p-5 outline-none sm:p-7',
                              feedback?.correct
                                ? 'border-emerald-500/40'
                                : 'border-destructive/30',
                            )}
                          >
                            {feedback && (
                              <div
                                className={cn(
                                  back &&
                                    (feedback.correct
                                      ? styles.result
                                      : styles.shake),
                                )}
                              >
                                <p className="mb-5 text-xs tracking-widest text-muted-foreground">
                                  A LITTLE WISER THAN BEFORE
                                </p>
                                <div
                                  className={cn(
                                    'mb-4 inline-flex rounded-2xl p-3',
                                    feedback.correct
                                      ? 'bg-emerald-500/10 text-emerald-500'
                                      : 'bg-destructive/10 text-destructive',
                                  )}
                                >
                                  {feedback.correct ? (
                                    <Check className="h-7 w-7" />
                                  ) : (
                                    <RotateCcw className="h-7 w-7" />
                                  )}
                                </div>
                                <h2 className="text-xl font-bold">
                                  {feedback.correct
                                    ? '点亮了，真棒！'
                                    : '没关系，再靠近一点。'}
                                </h2>
                                <p className="my-4 break-words text-sm text-muted-foreground">
                                  你的选择：{feedback.answer}
                                </p>
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                  <small className="text-emerald-500">
                                    正确答案
                                  </small>
                                  <p className="mt-2 whitespace-pre-wrap break-words font-semibold">
                                    {feedback.correctAnswer}
                                  </p>
                                </div>
                                <QuestionFigure question={current} />
                                <div className="my-5 border-t pt-4 text-base leading-8">
                                  {feedback.explanation
                                    .split('\n')
                                    .map((line, i) => (
                                      <p
                                        key={i}
                                        className={cn(
                                          'whitespace-pre-wrap break-words',
                                          line.startsWith('[source:') &&
                                            'text-xs text-muted-foreground',
                                        )}
                                      >
                                        {line}
                                      </p>
                                    ))}
                                  {!feedback.explanation && (
                                    <p>记住这个知识点，下次一定可以。</p>
                                  )}
                                </div>
                                <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm text-primary">
                                  {feedback.correct
                                    ? '+' +
                                      feedback.xp +
                                      ' XP · 每一点进步都算数'
                                    : '已放入复习盒，10 分钟后再见一面。'}
                                </p>
                              </div>
                            )}
                            {back && feedback?.correct && (
                              <div className={styles.burst} aria-hidden="true">
                                {Array.from({ length: 8 }, (_, i) => (
                                  <i
                                    key={i}
                                    style={
                                      {
                                        '--x': (i - 3.5) * 35 + 'px',
                                        animationDelay: i * 20 + 'ms',
                                      } as CSSProperties
                                    }
                                  />
                                ))}
                              </div>
                            )}
                          </Card>
                        </div>
                      </div>
                      {!run && (
                        <nav className="mt-5 flex gap-2" aria-label="卡片导航">
                          <Button
                            variant="outline"
                            aria-label="上一题"
                            disabled={busy || position === 0}
                            onClick={() => go(position - 1)}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                          {feedback && (
                            <Button
                              variant="outline"
                              disabled={busy}
                              onClick={() => setBack(!back)}
                            >
                              {back ? '再看题目' : '查看解析'}
                            </Button>
                          )}
                          <Button
                            className={cn(
                              styles.chunky,
                              'h-12 flex-1 rounded-xl font-semibold',
                            )}
                            disabled={busy}
                            onClick={() => go(position + 1)}
                          >
                            {position === queue.length - 1
                              ? '完成练习'
                              : '下一张'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </nav>
                      )}
                      {run ? (
                        <Button
                          variant="outline"
                          disabled={busy}
                          className="mt-5 w-full"
                          onClick={() => void finishChallenge()}
                        >
                          结束挑战，查看成绩
                        </Button>
                      ) : (
                        <p className="mt-4 text-center text-xs text-muted-foreground">
                          ← 左右拖动卡片切题 · 1–4 选择 · Enter 继续 →
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          {view === 'summary' && (
            <div className="mx-auto max-w-xl space-y-6 py-4">
              <div className="flex justify-center">
                <Mascot />
              </div>
              <div className="text-center">
                <p className="mb-3 text-xs tracking-widest text-primary">
                  ONE STEP BRIGHTER
                </p>
                <h1 className="text-2xl font-bold">认真练习的你，超棒的。</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  完成 {completed.length} 张卡片。今天的努力，未来会发光。
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  [
                    completed.length
                      ? Math.round(
                          (completed.filter((r) => r.correct).length /
                            completed.length) *
                            100,
                        ) + '%'
                      : '—',
                    '本次正确率',
                  ],
                  ['+' + gained, 'XP 成长值'],
                  ['×' + maxCombo, '最高连对'],
                ].map(([value, label]) => (
                  <Card key={label} className="rounded-2xl p-4 text-center">
                    <b className="text-2xl text-primary">{value}</b>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {label}
                    </p>
                  </Card>
                ))}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={() => void home()}
                >
                  回到知识星图
                </Button>
                {wrong.length > 0 && (
                  <Button
                    disabled={busy}
                    className="h-12 flex-1"
                    onClick={() =>
                      void start(
                        'retry',
                        undefined,
                        wrong.map((q) => q.id),
                      )
                    }
                  >
                    立即重练 {wrong.length} 题
                  </Button>
                )}
              </div>
              <h2 className="text-lg font-bold">
                {wrong.length
                  ? '再见面时，一定会。'
                  : '今天点亮的知识，都在发光。'}
              </h2>
              {wrong.map((q) => (
                <Card key={q.id} className="flex gap-3 rounded-xl p-4">
                  <small className="text-destructive">#{q.id}</small>
                  <p className="text-sm leading-7">{q.questionText}</p>
                </Card>
              ))}
            </div>
          )}
          {view === 'challenge-result' && challengeResult && (
            <div className="mx-auto max-w-xl space-y-6 py-4">
              <div className="flex justify-center">
                <Mascot />
              </div>
              <div className="text-center">
                <p className="mb-3 text-xs tracking-widest text-amber-400">
                  YOUR LIGHTNING MOMENT
                </p>
                <h1 className="text-2xl font-bold">挑战完成，闪电选手！</h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  反应更快一点，知识更牢一点。
                </p>
              </div>
              <Card className="rounded-2xl border-primary/30 p-7 text-center">
                <span className="text-6xl font-bold text-primary">
                  {challengeResult.score}
                </span>
                <p className="mt-3 text-sm text-muted-foreground">
                  本次答对 / 共作答 {challengeResult.total} 题
                </p>
                <p className="mt-4 font-semibold">
                  个人最佳 {challengeResult.best} 题 · +{gained} XP
                </p>
              </Card>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-12 flex-1"
                  onClick={() => void home()}
                >
                  返回地图
                </Button>
                <Button
                  disabled={busy}
                  className="h-12 flex-1"
                  onClick={() => void start('challenge')}
                >
                  再挑战一次
                </Button>
              </div>
              <Leaderboard rows={challengeResult.leaderboard} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
