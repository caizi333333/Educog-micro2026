'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { describeLearningTarget } from '@/lib/classroom-sections';
import { cn } from '@/lib/utils';

const classSchema = z.object({
  id: z.string(),
  name: z.string(),
  courseName: z.string().nullable(),
  semester: z.string().nullable(),
});

const targetSchema = z.object({
  targetId: z.string(),
  chapterId: z.string().nullable(),
  eventType: z.string(),
  lastAt: z.string().nullable(),
  durationSeconds: z.number(),
});

const studentSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  studentId: z.string().nullable(),
  lastActiveAt: z.string().nullable(),
  studied: z.boolean(),
  durationSeconds: z.number(),
  quizCompletions: z.number(),
  recentTargets: z.array(targetSchema),
});

const summarySchema = z.object({
  classes: z.array(classSchema),
  class: classSchema.optional(),
  windowDays: z.number(),
  asOf: z.string().optional(),
  rosterCount: z.number().optional(),
  studiedCount: z.number().optional(),
  notStudiedCount: z.number().optional(),
  students: z.array(studentSchema).optional(),
});

type Summary = z.infer<typeof summarySchema>;
type StudentRow = z.infer<typeof studentSchema>;
type StudyFilter = 'all' | 'studied' | 'not-studied';

const CAMPUS_TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatWhen(value: string | null): string {
  if (!value) return '近 7 日没有记录';
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return '时间无效';
  return `${CAMPUS_TIME.format(time)}（北京时间）`;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '刚打开';
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

export default function TeacherClassActivityPage(): React.JSX.Element {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [classId, setClassId] = useState('');
  const [filter, setFilter] = useState<StudyFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextClassId: string) => {
    setLoading(true);
    setError(null);
    const token = getStoredAccessToken();
    const headers: Record<string, string> = {};
    if (token && token !== 'cookie-session' && token.includes('.')) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const query = nextClassId ? `?classId=${encodeURIComponent(nextClassId)}` : '';
      const response = await fetch(`/api/teacher/class-activity${query}`, {
        headers,
        credentials: 'same-origin',
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '班级学情读取失败';
        setError(message);
        setSummary(null);
        return;
      }
      const parsed = summarySchema.safeParse(body);
      if (!parsed.success) {
        setError('班级学情数据格式无效');
        setSummary(null);
        return;
      }
      setSummary(parsed.data);
      if (!nextClassId && parsed.data.classes[0]) setClassId(parsed.data.classes[0].id);
    } catch {
      setError('班级学情读取失败');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(classId);
  }, [classId, load]);

  const students = (summary?.students ?? []).filter((student) => {
    if (filter === 'studied') return student.studied;
    if (filter === 'not-studied') return !student.studied;
    return true;
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/teacher" className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-400 hover:text-cyan-100">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回教学仪表板
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-50">班级学情</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            近 {summary?.windowDays ?? 7} 日谁打开过知识点或交过测评。停留按 15 分钟合并写入，避免整班心跳打满免费额度。
          </p>
        </div>
        {summary && summary.classes.length > 0 && (
          <label className="block min-w-48 text-xs text-slate-400">
            班级
            <select
              value={classId || summary.classes[0]?.id || ''}
              onChange={(event) => setClassId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-md border border-white/10 bg-black/30 px-2 text-sm text-slate-100"
            >
              {summary.classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>}

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在读取班级学情…
        </p>
      )}

      {!loading && summary && !summary.class && summary.classes.length === 0 && (
        <p className="rounded-md border border-white/10 px-3 py-4 text-sm text-slate-300">当前账号没有可查看的班级。</p>
      )}

      {!loading && summary?.class && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="在籍学生" value={summary.rosterCount ?? 0} />
            <Stat label="已学" value={summary.studiedCount ?? 0} />
            <Stat label="未学" value={summary.notStudiedCount ?? 0} />
          </div>
          <div role="group" aria-label="筛选学习状态" className="flex flex-wrap gap-2">
            {([
              ['all', '全部'],
              ['studied', '已学'],
              ['not-studied', '未学'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  'min-h-11 rounded-md border px-3 text-sm',
                  filter === value
                    ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-50'
                    : 'border-white/10 text-slate-300',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {students.length === 0 ? (
            <p className="rounded-md border border-white/10 px-3 py-4 text-sm text-slate-300">
              {summary.rosterCount === 0 ? '这个班还没有在籍学生。' : '这个筛选下没有学生。'}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {students.map((student) => <StudentCard key={student.id} student={student} />)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-3">
      <div className="font-mono text-2xl text-slate-50">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}

function StudentCard({ student }: { student: StudentRow }): React.JSX.Element {
  return (
    <li className="rounded-md border border-white/10 bg-[#0b1118] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-50">{student.name}</p>
          <p className="text-xs text-slate-400">{student.studentId || student.username}</p>
        </div>
        <span className={cn(
          'rounded-md px-2 py-1 text-xs font-semibold',
          student.studied ? 'bg-emerald-300/15 text-emerald-100' : 'bg-amber-300/15 text-amber-100',
        )}>
          {student.studied ? '已学' : '未学'}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">最近活动</dt>
          <dd>{formatWhen(student.lastActiveAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">知识点停留</dt>
          <dd>{formatDuration(student.durationSeconds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">测评完成</dt>
          <dd>{student.quizCompletions} 次</dd>
        </div>
      </dl>
      {student.recentTargets.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-xs text-slate-300">
          {student.recentTargets.map((target) => (
            <li key={`${target.eventType}:${target.targetId}`}>
              {describeLearningTarget(target.targetId)}
              {target.eventType === 'COMPLETE_QUIZ' ? ' · 测评完成' : ''}
              {target.durationSeconds > 0 ? ` · ${formatDuration(target.durationSeconds)}` : ''}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
