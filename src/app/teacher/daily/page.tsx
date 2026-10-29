'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { CAMPUS_TIME_LABEL, CAMPUS_TIME_ZONE } from '@/lib/campus-time';
import { cn } from '@/lib/utils';

const studentSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  studentId: z.string().nullable(),
  loggedIn: z.boolean(),
  studied: z.boolean(),
  lastLoginAt: z.string().nullable(),
  lastStudyAt: z.string().nullable(),
  durationSeconds: z.number(),
});

const classSchema = z.object({
  code: z.string(),
  label: z.string(),
  availability: z.enum(['visible', 'out-of-scope', 'missing']),
  classId: z.string().nullable(),
  rosterCount: z.number(),
  loggedInCount: z.number(),
  studiedCount: z.number(),
  students: z.array(studentSchema),
  omittedActiveCount: z.number(),
});

const pulseSchema = z.object({
  dateKey: z.string(),
  timeZone: z.string(),
  asOf: z.string(),
  classes: z.array(classSchema),
  demo: z.object({
    count: z.number(),
    omittedCount: z.number(),
    students: z.array(studentSchema.extend({
      classCode: z.string(),
      classLabel: z.string(),
    })),
  }),
});

type Pulse = z.infer<typeof pulseSchema>;
type PulseStudent = z.infer<typeof studentSchema>;
type PulseClass = z.infer<typeof classSchema>;

const CAMPUS_CLOCK = new Intl.DateTimeFormat('zh-CN', {
  timeZone: CAMPUS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatClock(value: string | null): string | null {
  if (!value) return null;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return null;
  return CAMPUS_CLOCK.format(time);
}

function formatDuration(seconds: number): string | null {
  if (seconds <= 0) return null;
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
}

function latestActivity(student: PulseStudent): string | null {
  const login = student.lastLoginAt ? new Date(student.lastLoginAt).getTime() : 0;
  const study = student.lastStudyAt ? new Date(student.lastStudyAt).getTime() : 0;
  if (study <= 0 && login <= 0) return null;
  if (study >= login) {
    const clock = formatClock(student.lastStudyAt);
    return clock ? `${clock} 学习` : null;
  }
  const clock = formatClock(student.lastLoginAt);
  return clock ? `${clock} 登录` : null;
}

export default function TeacherDailyPulsePage(): React.JSX.Element {
  const [pulse, setPulse] = useState<Pulse | null>(null);
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
      const response = await fetch('/api/teacher/daily-pulse', {
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : '今日动态读取失败';
        setError(response.status === 403 ? '当前账号不能查看今日动态' : message);
        setPulse(null);
        return;
      }
      const parsed = pulseSchema.safeParse(body);
      if (!parsed.success) {
        setError('今日动态数据格式无效');
        setPulse(null);
        return;
      }
      setPulse(parsed.data);
    } catch {
      setError('今日动态读取失败');
      setPulse(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = pulse?.classes.filter((classGroup) => classGroup.availability === 'visible') ?? [];
  const loggedInTotal = visible.reduce((sum, classGroup) => sum + classGroup.loggedInCount, 0);
  const studiedTotal = visible.reduce((sum, classGroup) => sum + classGroup.studiedCount, 0);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div>
        <Link href="/teacher" className="inline-flex min-h-11 items-center gap-1 text-sm text-slate-400 hover:text-cyan-100">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          返回教学仪表板
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-slate-50">今日动态</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
          本学期四个正式班在{CAMPUS_TIME_LABEL}今天的登录和学习。0872 称智工。机电2401 等往期班不在这页。
          登录本身不算学习。近 7 日明细在
          {' '}
          <Link href="/teacher/class-activity" className="text-cyan-100 underline-offset-2 hover:underline">班级学情</Link>
          。
        </p>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>}

      {loading && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          正在读取今日动态…
        </p>
      )}

      {!loading && pulse && (
        <>
          <p className="text-sm text-slate-300">
            {pulse.dateKey}
            {pulse.timeZone === CAMPUS_TIME_ZONE ? ` · ${CAMPUS_TIME_LABEL}` : ''}
            {visible.length > 0
              ? ` · 可见班级今日登录 ${loggedInTotal} 人，今日学习 ${studiedTotal} 人`
              : ' · 当前账号看不到正式班名册'}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {pulse.classes.map((classGroup) => <ClassCard key={classGroup.code} classGroup={classGroup} />)}
          </div>
          <DemoFold demo={pulse.demo} />
        </>
      )}
    </div>
  );
}

function ClassCard({ classGroup }: { classGroup: PulseClass }): React.JSX.Element {
  return (
    <section className="rounded-md border border-white/10 bg-[#0b1118] p-3">
      <h2 className="text-base font-semibold text-slate-50">{classGroup.label}</h2>
      {classGroup.availability !== 'visible' ? (
        <p className="mt-2 text-sm text-slate-400">
          {classGroup.availability === 'missing' ? '尚未建立这个班级。' : '不在当前账号的教学范围。'}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-300">
            今日登录 {classGroup.loggedInCount} 人 · 今日学习 {classGroup.studiedCount} 人 · 正式在籍 {classGroup.rosterCount} 人
          </p>
          {classGroup.students.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">
              {classGroup.rosterCount === 0 ? '这个班还没有正式在籍学生。' : '今日还没有人登录或学习。'}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {classGroup.students.map((student) => <StudentLine key={student.id} student={student} />)}
            </ul>
          )}
          {classGroup.omittedActiveCount > 0 && (
            <p className="mt-2 text-xs text-slate-400">另有 {classGroup.omittedActiveCount} 人今日来过，未全部列出。</p>
          )}
        </>
      )}
    </section>
  );
}

function StudentLine({ student, classLabel }: { student: PulseStudent; classLabel?: string }): React.JSX.Element {
  const when = latestActivity(student);
  const duration = formatDuration(student.durationSeconds);
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-white/10 pt-2 text-sm first:border-t-0 first:pt-0">
      <span className="text-slate-100">
        {classLabel ? <span className="mr-2 text-xs text-slate-500">{classLabel}</span> : null}
        {student.name}
        <span className="ml-2 text-xs text-slate-400">{student.studentId || student.username}</span>
      </span>
      <span className="text-xs text-slate-300">
        {when ?? '今日无记录'}
        {' · '}
        <span className={cn(student.studied ? 'text-emerald-100' : 'text-slate-400')}>
          {student.studied ? '已学习' : '未学习'}
        </span>
        {duration ? ` · ${duration}` : ''}
      </span>
    </li>
  );
}

function DemoFold({ demo }: { demo: Pulse['demo'] }): React.JSX.Element {
  if (demo.count === 0) {
    return (
      <p className="text-xs leading-5 text-slate-500">
        TEST 自测号、demo_ 演示号和「测试-」账号不计入各班人数。
      </p>
    );
  }
  return (
    <details className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2">
      <summary className="min-h-11 cursor-pointer text-sm text-slate-300">
        演示与自测账号 {demo.count} 个，不计入上面的人数
      </summary>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        用户名以 TEST 或 demo_ 开头，或姓名、用户名以「测试-」开头。默认折叠，避免混进正式班。
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {demo.students.map((student) => (
          <StudentLine key={`${student.classCode}:${student.id}`} student={student} classLabel={student.classLabel} />
        ))}
      </ul>
      {demo.omittedCount > 0 && (
        <p className="mt-2 text-xs text-slate-500">另有 {demo.omittedCount} 个演示号未列出。</p>
      )}
    </details>
  );
}
