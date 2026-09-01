'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  ClientRequestTimeoutError,
  fetchClientRequest,
} from '@/lib/client-fetch';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  BarChart4,
  CheckCircle2,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Shield,
  Target,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface DataSourceState<T> {
  status: LoadStatus;
  data: T | null;
  error: string | null;
  authFailure: boolean;
}

interface DataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

interface ClassComparison {
  classId: string;
  className: string;
  studentCount: number;
  hasCORecords: boolean;
  hasIPRecords: boolean;
  avgCOAchievement: number;
  avgIPAchievement: number;
  /** Percentage points, from 0 to 100. */
  coPassRate: number;
  /** Percentage points, from 0 to 100. */
  ipPassRate: number;
}

interface FailedClass {
  classId: string;
  className: string;
  reason: string;
}

interface ClassComparisonResponse {
  dataProvenance: DataProvenance;
  semester: string;
  totalClasses: number;
  totalStudents: number;
  classes: ClassComparison[];
  failedClasses: FailedClass[];
  partial: boolean;
}

interface GRPassRate {
  grCode: string;
  grName: string;
  passRate: number;
  avgAchievement: number;
}

interface SchoolSummaryResponse {
  dataProvenance: DataProvenance;
  semester: string;
  availableSemesters: string[];
  totalClasses: number;
  totalStudents: number;
  averageAchievement: number;
  passRateByGR: GRPassRate[];
}

const EMPTY_CLASS_STATE: DataSourceState<ClassComparisonResponse> = {
  status: 'idle',
  data: null,
  error: null,
  authFailure: false,
};

const EMPTY_SUMMARY_STATE: DataSourceState<SchoolSummaryResponse> = {
  status: 'idle',
  data: null,
  error: null,
  authFailure: false,
};

const MOCHA = {
  teal: '#94e2d5',
  blue: '#89b4fa',
  peach: '#fab387',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  overlay1: '#7f849c',
  surface0: '#313244',
} as const;

function validSemester(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = /^(\d{4})-(\d{4})-([12])$/.exec(value);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return `${year}-${year + 1}-1`;
  if (month === 1) return `${year - 1}-${year}-1`;
  return `${year - 1}-${year}-2`;
}

function recentSemesters(from: string, count = 6): string[] {
  const match = /^(\d{4})-\d{4}-([12])$/.exec(from);
  if (!match) return [currentSemester()];
  const firstIndex = Number(match[1]) * 2 + Number(match[2]) - 1;
  return Array.from({ length: count }, (_, offset) => {
    const index = firstIndex - offset;
    const startYear = Math.floor(index / 2);
    const term = index % 2 === 0 ? 1 : 2;
    return `${startYear}-${startYear + 1}-${term}`;
  });
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // Use the stable local fallback when the server did not return JSON.
  }
  return fallback;
}

function requestFailure(error: unknown, fallback: string): string {
  if (error instanceof ClientRequestTimeoutError) return '请求超时，请检查网络后重试';
  if (error instanceof TypeError) return '网络连接失败，请检查网络后重试';
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseDataProvenance(value: unknown): DataProvenance | null {
  if (!isRecord(value)) return null;
  if ((value.mode !== 'DEMO' && value.mode !== 'REAL' && value.mode !== 'MIXED')
    || typeof value.label !== 'string'
    || !value.label.trim()
    || typeof value.note !== 'string'
    || !value.note.trim()) return null;
  return {
    mode: value.mode,
    label: value.label.trim(),
    note: value.note.trim(),
  };
}

function sameDataProvenance(left: DataProvenance, right: DataProvenance): boolean {
  return left.mode === right.mode && left.label === right.label && left.note === right.note;
}

function dataUseBoundary(mode: DataProvenance['mode']): string {
  if (mode === 'REAL') return '仅限当前授权范围与所选学期使用；不得外推到未纳入班级。';
  if (mode === 'MIXED') return '须按真实记录与演示记录分别解释，不形成未经区分的总体成效结论。';
  return '仅用于验证汇总流程与界面，不用于证明真实教学成效。';
}

function isClassComparison(value: unknown): value is ClassComparison {
  if (!isRecord(value)) return false;
  return typeof value.classId === 'string'
    && typeof value.className === 'string'
    && isNonNegativeInteger(value.studentCount)
    && typeof value.hasCORecords === 'boolean'
    && typeof value.hasIPRecords === 'boolean'
    && isFiniteInRange(value.avgCOAchievement, 0, 1)
    && isFiniteInRange(value.avgIPAchievement, 0, 1)
    && isFiniteInRange(value.coPassRate, 0, 100)
    && isFiniteInRange(value.ipPassRate, 0, 100);
}

function isFailedClass(value: unknown): value is FailedClass {
  if (!isRecord(value)) return false;
  return typeof value.classId === 'string'
    && typeof value.className === 'string'
    && typeof value.reason === 'string';
}

function parseClassResponse(value: unknown, semester: string): ClassComparisonResponse | null {
  const dataProvenance = isRecord(value) ? parseDataProvenance(value.dataProvenance) : null;
  if (!isRecord(value)
    || !dataProvenance
    || value.semester !== semester
    || !isNonNegativeInteger(value.totalClasses)
    || !isNonNegativeInteger(value.totalStudents)
    || !Array.isArray(value.classes)
    || !value.classes.every(isClassComparison)
    || !Array.isArray(value.failedClasses)
    || !value.failedClasses.every(isFailedClass)
    || typeof value.partial !== 'boolean') {
    return null;
  }
  return { ...(value as unknown as ClassComparisonResponse), dataProvenance };
}

function isGRPassRate(value: unknown): value is GRPassRate {
  if (!isRecord(value)) return false;
  return typeof value.grCode === 'string'
    && typeof value.grName === 'string'
    && isFiniteInRange(value.passRate, 0, 100)
    && isFiniteInRange(value.avgAchievement, 0, 1);
}

function parseSchoolSummary(value: unknown, semester: string): SchoolSummaryResponse | null {
  const dataProvenance = isRecord(value) ? parseDataProvenance(value.dataProvenance) : null;
  if (!isRecord(value)
    || !dataProvenance
    || value.semester !== semester
    || !Array.isArray(value.availableSemesters)
    || !value.availableSemesters.every(validSemester)
    || !isNonNegativeInteger(value.totalClasses)
    || !isNonNegativeInteger(value.totalStudents)
    || !isFiniteInRange(value.averageAchievement, 0, 1)
    || !Array.isArray(value.passRateByGR)
    || !value.passRateByGR.every(isGRPassRate)) {
    return null;
  }
  return { ...(value as unknown as SchoolSummaryResponse), dataProvenance };
}

function DataProvenancePanel({
  provenance,
  loading,
  mismatch,
}: {
  provenance: DataProvenance | null;
  loading: boolean;
  mismatch: boolean;
}) {
  if (!provenance || mismatch) {
    const pending = loading && !mismatch;
    return (
      <div
        role={pending ? 'status' : 'alert'}
        className={cn(
          'mb-5 rounded-md border px-4 py-3',
          pending
            ? 'border-white/[0.08] bg-white/[0.035] text-slate-300'
            : 'border-red-300/20 bg-red-300/[0.06] text-red-100',
        )}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          {pending
            ? '正在核验服务端数据身份'
            : mismatch ? '两个汇总数据源的身份不一致' : '数据身份未通过核验'}
        </div>
        <p className="mt-1 text-xs leading-5 opacity-80">
          {pending
            ? '核验通过前不展示全校、班级或毕业要求成效数值。'
            : '相关成效数值已停止展示。请在对应区域重试，必要时重新登录。'}
        </p>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label={`数据身份：${provenance.label}`}
      className={cn(
        'mb-5 rounded-md border px-4 py-3',
        provenance.mode === 'REAL'
          ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
          : provenance.mode === 'MIXED'
            ? 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-50'
            : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
      )}
    >
      <div className="text-sm font-semibold">{provenance.label} · {provenance.mode}</div>
      <p className="mt-1 text-xs leading-5 opacity-85">{provenance.note}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">用途边界：{dataUseBoundary(provenance.mode)}</p>
    </div>
  );
}

function SourceFailure({
  message,
  authFailure,
  loginHref,
  onRetry,
}: {
  message: string;
  authFailure: boolean;
  loginHref: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="rounded-md border border-red-300/20 bg-red-300/[0.06] p-5 text-center">
      <AlertTriangle className="mx-auto h-5 w-5 text-red-200" />
      <p className="mt-2 text-sm text-red-100">{message}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
        >
          重试此项
        </button>
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 text-xs text-cyan-100 transition hover:bg-cyan-300/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
        >
          {authFailure ? '重新登录' : '重新登录核验'}
        </Link>
      </div>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status" className="flex min-h-48 items-center justify-center text-sm text-slate-400">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export default function OBEAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [scopeReady, setScopeReady] = useState(false);
  const [semester, setSemester] = useState(currentSemester);
  const [classSource, setClassSource] = useState<DataSourceState<ClassComparisonResponse>>(EMPTY_CLASS_STATE);
  const [summarySource, setSummarySource] = useState<DataSourceState<SchoolSummaryResponse>>(EMPTY_SUMMARY_STATE);
  const classAbortRef = useRef<AbortController | null>(null);
  const summaryAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const applyUrlSemester = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('semester')?.trim() ?? '';
      const nextSemester = validSemester(requested) ? requested : currentSemester();
      setSemester(nextSemester);
      if (!validSemester(requested)) {
        const url = new URL(window.location.href);
        url.searchParams.set('semester', nextSemester);
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
      setScopeReady(true);
    };

    applyUrlSemester();
    window.addEventListener('popstate', applyUrlSemester);
    return () => window.removeEventListener('popstate', applyUrlSemester);
  }, []);

  const loginHref = `/login?from=${encodeURIComponent(`/obe/admin?semester=${semester}`)}`;

  const loadClassComparison = useCallback(async () => {
    if (!scopeReady || !user || user.role !== 'ADMIN') return;
    classAbortRef.current?.abort();
    const controller = new AbortController();
    classAbortRef.current = controller;
    setClassSource({ status: 'loading', data: null, error: null, authFailure: false });

    const token = getStoredAccessToken();
    if (!token) {
      setClassSource({
        status: 'error',
        data: null,
        error: '登录状态已失效，请重新登录',
        authFailure: true,
      });
      return;
    }

    try {
      const query = new URLSearchParams({ semester });
      const response = await fetchClientRequest(`/api/obe/admin/class-comparison?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }, CLIENT_READ_TIMEOUT_MS);
      if (response.status === 401 || response.status === 403) {
        setClassSource({
          status: 'error',
          data: null,
          error: '登录状态无效或管理员权限已变更，请重新登录',
          authFailure: true,
        });
        return;
      }
      if (!response.ok) throw new Error(await responseError(response, '班级对比读取失败'));
      const rawBody = await response.json() as unknown;
      if (!isRecord(rawBody) || !parseDataProvenance(rawBody.dataProvenance)) {
        throw new Error('班级对比缺少有效的服务端数据身份，已停止展示成效数值');
      }
      const body = parseClassResponse(rawBody, semester);
      if (!body) throw new Error('班级对比返回格式异常，请重试');
      setClassSource({
        status: 'success',
        data: body,
        error: null,
        authFailure: false,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch OBE class comparison:', error);
      setClassSource({
        status: 'error',
        data: null,
        error: requestFailure(error, '班级对比读取失败，请稍后重试'),
        authFailure: false,
      });
    }
  }, [scopeReady, semester, user]);

  const loadSchoolSummary = useCallback(async () => {
    if (!scopeReady || !user || user.role !== 'ADMIN') return;
    summaryAbortRef.current?.abort();
    const controller = new AbortController();
    summaryAbortRef.current = controller;
    setSummarySource({ status: 'loading', data: null, error: null, authFailure: false });

    const token = getStoredAccessToken();
    if (!token) {
      setSummarySource({
        status: 'error',
        data: null,
        error: '登录状态已失效，请重新登录',
        authFailure: true,
      });
      return;
    }

    try {
      const query = new URLSearchParams({ semester });
      const response = await fetchClientRequest(`/api/obe/admin/school-summary?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }, CLIENT_READ_TIMEOUT_MS);
      if (response.status === 401 || response.status === 403) {
        setSummarySource({
          status: 'error',
          data: null,
          error: '登录状态无效或管理员权限已变更，请重新登录',
          authFailure: true,
        });
        return;
      }
      if (!response.ok) throw new Error(await responseError(response, '毕业要求汇总读取失败'));
      const rawBody = await response.json() as unknown;
      if (!isRecord(rawBody) || !parseDataProvenance(rawBody.dataProvenance)) {
        throw new Error('毕业要求汇总缺少有效的服务端数据身份，已停止展示成效数值');
      }
      const body = parseSchoolSummary(rawBody, semester);
      if (!body) throw new Error('毕业要求汇总返回格式异常，请重试');
      setSummarySource({
        status: 'success',
        data: body,
        error: null,
        authFailure: false,
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch OBE school summary:', error);
      setSummarySource({
        status: 'error',
        data: null,
        error: requestFailure(error, '毕业要求汇总读取失败，请稍后重试'),
        authFailure: false,
      });
    }
  }, [scopeReady, semester, user]);

  useEffect(() => {
    if (authLoading || !scopeReady || !user || user.role !== 'ADMIN') return;
    void loadClassComparison();
    void loadSchoolSummary();
    return () => {
      classAbortRef.current?.abort();
      summaryAbortRef.current?.abort();
    };
  }, [authLoading, loadClassComparison, loadSchoolSummary, scopeReady, user]);

  const classProvenance = classSource.data?.dataProvenance ?? null;
  const summaryProvenance = summarySource.data?.dataProvenance ?? null;
  const provenanceMismatch = Boolean(
    classProvenance
      && summaryProvenance
      && !sameDataProvenance(classProvenance, summaryProvenance),
  );
  const pageProvenance = provenanceMismatch ? null : classProvenance ?? summaryProvenance;
  const provenanceLoading = classSource.status === 'idle'
    || classSource.status === 'loading'
    || summarySource.status === 'idle'
    || summarySource.status === 'loading';

  const semesterOptions = useMemo(() => {
    const available = provenanceMismatch ? [] : summarySource.data?.availableSemesters ?? [];
    return [...new Set([semester, ...available, ...recentSemesters(semester)])].sort().reverse();
  }, [provenanceMismatch, semester, summarySource.data?.availableSemesters]);

  const classData = provenanceMismatch ? null : classSource.data;
  const classes = classData?.classes ?? [];
  const failedClasses = classData?.failedClasses ?? [];
  const coClasses = classes.filter((item) => item.hasCORecords);
  const ipClasses = classes.filter((item) => item.hasIPRecords);
  const classResultComplete = classSource.status === 'success' && failedClasses.length === 0;
  const avgCO = classResultComplete && coClasses.length > 0
    ? coClasses.reduce((sum, item) => sum + item.avgCOAchievement, 0) / coClasses.length
    : null;
  const avgIPPassRate = classResultComplete && ipClasses.length > 0
    ? ipClasses.reduce((sum, item) => sum + item.ipPassRate, 0) / ipClasses.length
    : null;
  const chartClasses = classes.filter((item) => item.hasCORecords || item.hasIPRecords);
  const grPassRates = provenanceMismatch ? [] : summarySource.data?.passRateByGR ?? [];

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] text-sm text-slate-400 sm:-m-6">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在核验访问权限
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Shield className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">仅管理员可访问此页面</p>
          <Link
            href="/login?from=%2Fobe%2Fadmin&reason=admin-role"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
          >
            {!user ? '去登录' : '切换管理员账号'}
          </Link>
        </div>
      </div>
    );
  }

  const classMetric = (value: string): string => {
    if (provenanceMismatch) return '—';
    if (classSource.status === 'loading' || classSource.status === 'idle') return '…';
    if (classSource.status === 'error') return '—';
    return value;
  };

  const metricCards = [
    {
      label: '班级数',
      value: classMetric(String(classData?.totalClasses ?? 0)),
      color: 'text-cyan-200',
      Icon: LayoutGrid,
    },
    {
      label: '学生总数',
      value: classMetric(String(classData?.totalStudents ?? 0)),
      color: 'text-emerald-300',
      Icon: Users,
    },
    {
      label: 'CO 平均达成度',
      value: classMetric(avgCO === null ? '—' : `${Math.round(avgCO * 100)}%`),
      color: avgCO !== null && avgCO >= 0.65 ? 'text-emerald-300' : 'text-amber-300',
      Icon: BarChart4,
    },
    {
      label: 'IP 平均通过率',
      value: classMetric(avgIPPassRate === null ? '—' : `${Math.round(avgIPPassRate)}%`),
      color: avgIPPassRate !== null && avgIPPassRate >= 60 ? 'text-emerald-300' : 'text-amber-300',
      Icon: Target,
    },
  ];

  const selectSemester = (nextSemester: string) => {
    if (!validSemester(nextSemester) || nextSemester === semester) return;
    const url = new URL(window.location.href);
    url.searchParams.set('semester', nextSemester);
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    setSemester(nextSemester);
  };

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-rose-300/20 bg-rose-300/[0.08] px-3 py-1 text-xs text-rose-100">
              <Shield className="h-3.5 w-3.5" />
              OBE · 管理员
            </div>
            <h1 id="obe-admin-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">全校达成度汇总</h1>
            <p className="mt-1 text-sm text-slate-400">跨班级 OBE 达成度对比分析；所有结果按所选学期独立读取</p>
          </div>
          <label className="flex min-w-52 flex-col gap-1.5 text-xs text-slate-400">
            统计学期
            <select
              aria-label="统计学期"
              value={semester}
              onChange={(event) => selectSemester(event.target.value)}
              disabled={!scopeReady}
              className="h-10 rounded-md border border-white/[0.1] bg-[#111821] px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {semesterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      <section aria-labelledby="obe-admin-page-title" className="px-4 py-5 md:px-6">
        <DataProvenancePanel
          provenance={pageProvenance}
          loading={provenanceLoading}
          mismatch={provenanceMismatch}
        />
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {metricCards.map(({ label, value, color, Icon }) => (
            <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <Icon className="h-4 w-4 text-cyan-200" />
              <div className={cn('mt-3 font-mono text-2xl font-semibold', color)}>{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          ))}
        </div>

        <section aria-labelledby="class-comparison-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="class-comparison-title" className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <BarChart4 className="h-4 w-4 text-cyan-200" /> 班级达成度对比
            </h2>
            <span className="font-mono text-[10px] text-slate-500">{semester}</span>
          </div>

          {provenanceMismatch ? (
            <SourceFailure
              message="两个汇总数据源的数据身份不一致，班级成效数值已停止展示"
              authFailure={false}
              loginHref={loginHref}
              onRetry={() => {
                void loadClassComparison();
                void loadSchoolSummary();
              }}
            />
          ) : classSource.status === 'loading' || classSource.status === 'idle' ? (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <LoadingPanel label="正在读取班级对比" />
            </div>
          ) : classSource.status === 'error' ? (
            <SourceFailure
              message={classSource.error ?? '班级对比读取失败'}
              authFailure={classSource.authFailure}
              loginHref={loginHref}
              onRetry={() => { void loadClassComparison(); }}
            />
          ) : (
            <>
              {failedClasses.length > 0 && (
                <div role="status" className="mb-4 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
                  <div className="flex items-center gap-2 text-sm text-amber-100">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {failedClasses.length} 个班级读取失败，以下班级未计入平均值
                  </div>
                  <ul className="mt-2 space-y-1 pl-6 text-xs text-amber-100/80">
                    {failedClasses.map((item) => (
                      <li key={item.classId} className="list-disc">{item.className}：{item.reason}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => { void loadClassComparison(); }}
                    className="mt-3 rounded-md border border-amber-200/20 px-3 py-1.5 text-xs text-amber-100 transition hover:bg-amber-200/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
                  >
                    重试班级对比
                  </button>
                </div>
              )}

              {classes.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] px-5 text-center text-sm text-slate-400">
                  {failedClasses.length > 0 ? '当前没有班级成功返回，请根据失败原因重试' : '该学期暂无启用班级'}
                </div>
              ) : (
                <>
                  <div className="mb-5 rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
                    <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">班级指标点达成度对比</div>
                    {chartClasses.length === 0 ? (
                      <div className="flex h-60 items-center justify-center text-sm text-slate-400">班级已加载，尚无当前学期达成度记录</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartClasses.map((item) => ({
                          name: item.className,
                          co: item.hasCORecords ? Math.round(item.avgCOAchievement * 100) : null,
                          ip: item.hasIPRecords ? Math.round(item.avgIPAchievement * 100) : null,
                          passRate: item.hasIPRecords ? Math.round(item.ipPassRate) : null,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke={MOCHA.surface0} />
                          <XAxis dataKey="name" tick={{ fill: MOCHA.subtext0, fontSize: 11 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: MOCHA.overlay1, fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: MOCHA.text, fontSize: 12 }}
                            formatter={(value: number, name: string) => [`${value}%`, name === 'co' ? 'CO达成度' : name === 'ip' ? 'IP达成度' : 'IP通过率']}
                          />
                          <Bar dataKey="co" radius={[3, 3, 0, 0]} maxBarSize={48} fill={MOCHA.blue} fillOpacity={0.8} />
                          <Bar dataKey="ip" radius={[3, 3, 0, 0]} maxBarSize={48} fill={MOCHA.teal} fillOpacity={0.8} />
                          <Bar dataKey="passRate" radius={[3, 3, 0, 0]} maxBarSize={48} fill={MOCHA.peach} fillOpacity={0.5} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
                    <div className="p-4">
                      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                        <Users className="h-3.5 w-3.5" /> 班级详情
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-t border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-slate-600">
                            <th className="px-4 py-3">班级</th>
                            <th className="px-4 py-3">学生数</th>
                            <th className="px-4 py-3">CO 平均</th>
                            <th className="px-4 py-3">IP 平均</th>
                            <th className="px-4 py-3">CO 通过率</th>
                            <th className="px-4 py-3">IP 通过率</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classes.map((item) => (
                            <tr key={item.classId} className="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
                              <td className="px-4 py-3 font-medium text-slate-200">{item.className}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">{item.studentCount}</td>
                              <td className="px-4 py-3 font-mono text-slate-300">{item.hasCORecords ? `${Math.round(item.avgCOAchievement * 100)}%` : '—'}</td>
                              <td className="px-4 py-3 font-mono text-slate-300">{item.hasIPRecords ? `${Math.round(item.avgIPAchievement * 100)}%` : '—'}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">{item.hasCORecords ? `${Math.round(item.coPassRate)}%` : '—'}</td>
                              <td className="px-4 py-3 font-mono text-slate-400">{item.hasIPRecords ? `${Math.round(item.ipPassRate)}%` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <section aria-labelledby="school-summary-title" className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="school-summary-title" className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <GraduationCap className="h-4 w-4 text-cyan-200" /> 毕业要求达成概览
            </h2>
            <span className="font-mono text-[10px] text-slate-500">独立数据源</span>
          </div>

          {provenanceMismatch ? (
            <SourceFailure
              message="两个汇总数据源的数据身份不一致，毕业要求成效数值已停止展示"
              authFailure={false}
              loginHref={loginHref}
              onRetry={() => {
                void loadClassComparison();
                void loadSchoolSummary();
              }}
            />
          ) : summarySource.status === 'loading' || summarySource.status === 'idle' ? (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <LoadingPanel label="正在读取毕业要求汇总" />
            </div>
          ) : summarySource.status === 'error' ? (
            <SourceFailure
              message={summarySource.error ?? '毕业要求汇总读取失败'}
              authFailure={summarySource.authFailure}
              loginHref={loginHref}
              onRetry={() => { void loadSchoolSummary(); }}
            />
          ) : grPassRates.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.035] px-5 text-center text-sm text-slate-400">
              该学期尚无毕业要求达成记录
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                      <th className="px-4 py-3">编号</th>
                      <th className="px-4 py-3">毕业要求</th>
                      <th className="px-4 py-3">平均达成度</th>
                      <th className="px-4 py-3">通过率</th>
                      <th className="px-4 py-3">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grPassRates.map((item) => (
                      <tr key={item.grCode} className="border-t border-white/[0.04] transition hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-slate-400">{item.grCode}</td>
                        <td className="px-4 py-3 text-slate-200">{item.grName}</td>
                        <td className="px-4 py-3 font-mono text-slate-300">{Math.round(item.avgAchievement * 100)}%</td>
                        <td className="px-4 py-3 font-mono text-slate-400">{Math.round(item.passRate)}%</td>
                        <td className="px-4 py-3">
                          {item.avgAchievement >= 0.65 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-3 w-3" /> 达标</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-300"><AlertTriangle className="h-3 w-3" /> 待改进</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
