'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { CLIENT_READ_TIMEOUT_MS, fetchClientRequest } from '@/lib/client-fetch';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Lock,
  RefreshCw,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// -- Types ------------------------------------------------------------------

interface COBreakdownItem {
  type: string;
  targetId: string;
  description?: string;
  score: number;
  maxScore: number;
  weight: number;
}

interface COProgress {
  id: string;
  code: string;
  name: string;
  achievementDegree: number;
  passed: boolean;
  breakdown: COBreakdownItem[];
}

interface IndicatorProgress {
  id: string;
  code: string;
  description: string;
  graduationReqName: string;
  achievementDegree: number;
  threshold: number;
  passed: boolean;
  contributingCOs: { coCode: string; coAchievement: number; supportWeight: number }[];
}

interface StudentAchievementDataStatus {
  semester: string | null;
  semesterSource: 'REQUEST' | 'ACTIVE_CLASS' | 'UNRESOLVED';
  classId: string | null;
  className: string | null;
  classScopeSource: 'REQUEST' | 'ACTIVE_CLASS' | 'UNRESOLVED';
  availableClasses: StudentClassScope[];
  configurationRevision: string;
  configurationUpdatedAt: string | null;
  expectedCourseObjectiveRecords: number;
  freshCourseObjectiveRecords: number;
  staleCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  expectedIndicatorRecords: number;
  freshIndicatorRecords: number;
  staleIndicatorRecords: number;
  missingIndicatorRecords: number;
  complete: boolean;
  lastCalculatedAt: string | null;
}

interface StudentClassScope {
  classId: string;
  className: string;
  semester: string;
}

interface StudentProgressResponse {
  dataProvenance: {
    mode: 'DEMO' | 'REAL' | 'MIXED';
    label: string;
    note: string;
  };
  asOf: string;
  sampleSize: {
    students: number;
    courseObjectiveRecords: number;
    indicatorRecords: number;
  };
  courseObjectives: COProgress[];
  indicatorPoints: IndicatorProgress[];
  overallPassedCount: number;
  overallTotalCount: number;
  dataStatus: StudentAchievementDataStatus;
}

function isStudentProgressResponse(value: unknown): value is StudentProgressResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StudentProgressResponse>;
  const status = record.dataStatus as Partial<StudentAchievementDataStatus> | undefined;
  const provenance = record.dataProvenance as Partial<StudentProgressResponse['dataProvenance']> | undefined;
  const sampleSize = record.sampleSize as Partial<StudentProgressResponse['sampleSize']> | undefined;
  return Array.isArray(record.courseObjectives)
    && Array.isArray(record.indicatorPoints)
    && typeof record.overallPassedCount === 'number'
    && typeof record.overallTotalCount === 'number'
    && Boolean(provenance)
    && (provenance?.mode === 'DEMO' || provenance?.mode === 'REAL' || provenance?.mode === 'MIXED')
    && typeof provenance?.label === 'string'
    && Boolean(provenance.label.trim())
    && typeof provenance?.note === 'string'
    && Boolean(provenance.note.trim())
    && typeof record.asOf === 'string'
    && Number.isFinite(new Date(record.asOf).getTime())
    && Boolean(sampleSize)
    && typeof sampleSize?.students === 'number'
    && Number.isInteger(sampleSize.students)
    && sampleSize.students >= 0
    && typeof sampleSize?.courseObjectiveRecords === 'number'
    && Number.isInteger(sampleSize.courseObjectiveRecords)
    && sampleSize.courseObjectiveRecords >= 0
    && typeof sampleSize?.indicatorRecords === 'number'
    && Number.isInteger(sampleSize.indicatorRecords)
    && sampleSize.indicatorRecords >= 0
    && Boolean(status)
    && (typeof status?.semester === 'string' || status?.semester === null)
    && (typeof status?.classId === 'string' || status?.classId === null)
    && (typeof status?.className === 'string' || status?.className === null)
    && (status?.classScopeSource === 'REQUEST'
      || status?.classScopeSource === 'ACTIVE_CLASS'
      || status?.classScopeSource === 'UNRESOLVED')
    && Array.isArray(status?.availableClasses)
    && status.availableClasses.every((item) => Boolean(item)
      && typeof item.classId === 'string'
      && typeof item.className === 'string'
      && typeof item.semester === 'string')
    && typeof status?.configurationRevision === 'string'
    && typeof status?.expectedCourseObjectiveRecords === 'number'
    && typeof status?.freshCourseObjectiveRecords === 'number'
    && typeof status?.staleCourseObjectiveRecords === 'number'
    && typeof status?.missingCourseObjectiveRecords === 'number'
    && typeof status?.expectedIndicatorRecords === 'number'
    && typeof status?.freshIndicatorRecords === 'number'
    && typeof status?.staleIndicatorRecords === 'number'
    && typeof status?.missingIndicatorRecords === 'number'
    && typeof status?.complete === 'boolean';
}

function formatDateTime(value: string | null): string {
  if (!value) return '尚无当前版本结果';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '时间待核实' : date.toLocaleString('zh-CN', { hour12: false });
}

function formatExpectedRecordStatus(
  freshRecords: number,
  expectedRecords: number,
  missingRecords: number,
): { value: string; detail: string } {
  if (expectedRecords === 0) {
    return {
      value: 'N/A',
      detail: '尚无当前版本记录（待教师复算）',
    };
  }
  return {
    value: `${freshRecords}/${expectedRecords}`,
    detail: `缺少 ${missingRecords} 条`,
  };
}

type StudentScopeSelection = Pick<StudentClassScope, 'classId' | 'semester'>;

function readScopeFromLocation(): StudentScopeSelection | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const classId = params.get('classId')?.trim();
  const semester = params.get('semester')?.trim();
  return classId && semester ? { classId, semester } : null;
}

function writeScopeToLocation(scope: StudentScopeSelection | null, mode: 'push' | 'replace'): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (scope) {
    url.searchParams.set('classId', scope.classId);
    url.searchParams.set('semester', scope.semester);
  } else {
    url.searchParams.delete('classId');
    url.searchParams.delete('semester');
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (nextUrl === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
  window.history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', nextUrl);
}

function sameScope(left: StudentScopeSelection | null, right: StudentScopeSelection | null): boolean {
  return left?.classId === right?.classId && left?.semester === right?.semester;
}

// -- Constants --------------------------------------------------------------

const MOCHA = {
  blue: '#89b4fa',
  teal: '#94e2d5',
  green: '#a6e3a1',
  peach: '#fab387',
  mauve: '#cba6f7',
  rosewater: '#f5e0dc',
  red: '#f38ba8',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  overlay1: '#7f849c',
  surface0: '#313244',
} as const;

const ASSESSMENT_LABELS: Record<string, string> = {
  QUIZ: '测验',
  EXPERIMENT: '实验',
  LEARNING_PROGRESS: '学习进度',
  COMPREHENSIVE: '综合',
};

// -- Component --------------------------------------------------------------

export default function OBEStudentPage() {
  const { user, loading: authLoading } = useAuth();
  const [progress, setProgress] = useState<StudentProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [returnHref, setReturnHref] = useState('/obe');
  const [expandedCO, setExpandedCO] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<StudentScopeSelection | null>(null);
  const [availableClasses, setAvailableClasses] = useState<StudentClassScope[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const selectedScopeRef = useRef<StudentScopeSelection | null>(null);

  const fetchData = useCallback(async (
    requestedScope: StudentScopeSelection | null = selectedScopeRef.current,
  ) => {
    if (authLoading || !user || user.role !== 'STUDENT') {
      setLoading(false);
      return;
    }
    if (window.location.pathname === '/obe') {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setAccessErrorStatus(null);
    setProgress((current) => {
      const currentScope = current?.dataStatus.classId && current.dataStatus.semester
        ? { classId: current.dataStatus.classId, semester: current.dataStatus.semester }
        : null;
      return sameScope(currentScope, requestedScope) ? current : null;
    });
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setProgress(null);
        setAccessErrorStatus(401);
        setError('登录已过期，请重新登录后查看个人达成结果。');
        setLoading(false);
        return;
      }
      const query = requestedScope
        ? `?${new URLSearchParams({
          classId: requestedScope.classId,
          semester: requestedScope.semester,
        }).toString()}`
        : '';
      const response = await fetchClientRequest(`/api/obe/student/graduation-progress${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: controller.signal,
      }, CLIENT_READ_TIMEOUT_MS);
      if (response.status === 401 || response.status === 403) {
        setProgress(null);
        setAccessErrorStatus(response.status);
        setError(response.status === 401
          ? '登录已过期，请重新登录后查看个人达成结果。'
          : '当前账号无权读取学生个人达成结果，请切换学生账号。');
        return;
      }
      const responseBody = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        const message = responseBody && typeof responseBody === 'object' && 'error' in responseBody
          ? (responseBody as { error?: unknown }).error
          : null;
        throw new Error(typeof message === 'string' ? message : '加载达成度数据失败');
      }
      if (!isStudentProgressResponse(responseBody)) throw new Error('达成度数据格式异常，请重试');
      const resolvedScope = responseBody.dataStatus.classId && responseBody.dataStatus.semester
        ? {
          classId: responseBody.dataStatus.classId,
          semester: responseBody.dataStatus.semester,
        }
        : null;
      selectedScopeRef.current = resolvedScope;
      setSelectedScope(resolvedScope);
      setAvailableClasses(responseBody.dataStatus.availableClasses);
      writeScopeToLocation(resolvedScope, 'replace');
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      setProgress(responseBody);
      setAccessErrorStatus(null);
      setLastCheckedAt(new Date().toISOString());
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch OBE data:', err);
      setProgress(null);
      setError(err instanceof Error ? err.message : '网络错误，请稍后重试');
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (window.location.pathname === '/obe') {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    const initialScope = readScopeFromLocation();
    selectedScopeRef.current = initialScope;
    setSelectedScope(initialScope);
    void fetchData(initialScope);

    const handleHistoryChange = () => {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      const nextScope = readScopeFromLocation();
      selectedScopeRef.current = nextScope;
      setSelectedScope(nextScope);
      setExpandedCO(null);
      void fetchData(nextScope);
    };
    window.addEventListener('popstate', handleHistoryChange);
    return () => {
      window.removeEventListener('popstate', handleHistoryChange);
      requestRef.current?.abort();
    };
  }, [fetchData]);

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] text-sm text-slate-400 sm:-m-6">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在核验访问权限
      </div>
    );
  }

  if (!user) {
    const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}`;
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">请先登录以查看毕业要求达成情况。</p>
          <Link href={loginRecoveryHref} className="mt-4 inline-flex h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014]">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'STUDENT') {
    const destination = user.role === 'TEACHER' ? '/obe/teacher' : '/obe/admin';
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="max-w-md rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-amber-200" />
          <p className="mt-3 text-sm font-medium text-amber-100">该页面展示学生个人达成结果</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">教师和管理员请进入教学达成度看板，避免把个人空记录误判为班级结果。</p>
          <Link href={destination} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014]">
            {user.role === 'TEACHER' ? '前往教学达成度看板' : '前往达成度管理'}
          </Link>
        </div>
      </div>
    );
  }

  const dataComplete = progress?.dataStatus.complete ?? false;
  const overallRate = dataComplete && progress && progress.overallTotalCount > 0
    ? Math.round((progress.overallPassedCount / progress.overallTotalCount) * 100)
    : null;
  const radarData = dataComplete && progress
    ? progress.indicatorPoints.map((indicator) => ({
      indicatorCode: indicator.code,
      indicatorName: indicator.description,
      graduationReqName: indicator.graduationReqName,
      achievementDegree: indicator.achievementDegree,
      threshold: indicator.threshold,
      passed: indicator.passed,
    }))
    : [];
  const selectedClass = availableClasses.find((item) => sameScope(item, selectedScope));
  const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}${accessErrorStatus === 403 ? '&reason=student-role' : ''}`;

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Target className="h-3.5 w-3.5" />
              OBE · 成果导向
            </div>
            <h1 id="obe-student-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">毕业要求达成</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              基于课程考核数据的毕业要求指标点达成度分析
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            {availableClasses.length > 1 && (
              <div className="flex min-w-0 flex-col gap-1">
                <label htmlFor="student-obe-class-scope" className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  当前班级范围
                </label>
                <select
                  id="student-obe-class-scope"
                  value={selectedScope?.classId ?? ''}
                  onChange={(event) => {
                    const next = availableClasses.find((item) => item.classId === event.target.value);
                    if (!next) return;
                    const nextScope = { classId: next.classId, semester: next.semester };
                    if (sameScope(selectedScopeRef.current, nextScope)) return;
                    selectedScopeRef.current = nextScope;
                    setSelectedScope(nextScope);
                    writeScopeToLocation(nextScope, 'push');
                    setExpandedCO(null);
                    void fetchData(nextScope);
                  }}
                  disabled={loading}
                  className="h-11 min-w-[220px] rounded-md border border-white/[0.1] bg-[#111820] px-3 text-sm normal-case tracking-normal text-slate-200 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {availableClasses.map((item) => (
                    <option key={item.classId} value={item.classId}>
                      {item.className} · {item.semester}
                    </option>
                  ))}
                </select>
                {loading && (
                  <span className="text-[11px] text-cyan-200/75" role="status" aria-live="polite">
                    正在载入该班级数据…
                  </span>
                )}
              </div>
            )}
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">达成率</div>
              <div className={cn(
                'font-mono text-2xl font-semibold',
                overallRate === null
                  ? 'text-slate-400'
                  : overallRate >= 65
                    ? 'text-emerald-300'
                    : overallRate >= 40
                      ? 'text-amber-300'
                      : 'text-red-300',
              )}>
                {overallRate === null ? 'N/A' : `${overallRate}%`}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {progress?.dataStatus.className
                  ? `${progress.dataStatus.className} · ${progress.dataStatus.semester ?? '学期待确认'}`
                  : selectedClass
                    ? `${selectedClass.className} · ${selectedClass.semester}`
                    : progress?.dataStatus.semester ?? '班级与学期待确认'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {progress && (
        <div className="px-4 pt-5 md:px-6">
          <div
            role="note"
            className={cn(
              'rounded-md border px-4 py-3',
              progress.dataProvenance.mode === 'REAL'
                ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
                : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
            )}
          >
            <div className="text-sm font-semibold">{progress.dataProvenance.label}</div>
            <p className="mt-1 text-xs leading-5 opacity-80">{progress.dataProvenance.note}</p>
            <p className="mt-1 font-mono text-[10px] leading-5 opacity-70">
              截止 {new Date(progress.asOf).toLocaleString('zh-CN', { hour12: false })}
              {' · '}学生 n={progress.sampleSize.students}
              {' · '}课程目标记录 n={progress.sampleSize.courseObjectiveRecords}
              {' · '}指标点记录 n={progress.sampleSize.indicatorRecords}
              {' · '}0 为已确认零记录，N/A 为班级、配置或同口径记录不足，不能计算
            </p>
          </div>
        </div>
      )}

      <section aria-labelledby="obe-student-page-title" aria-busy={loading} className="grid gap-5 px-4 py-5 xl:grid-cols-[1fr_400px] md:px-6">
        {error && (
          <div className="col-span-full rounded-md border border-red-300/20 bg-red-300/[0.06] p-4 text-center">
            <p className="text-sm text-red-200">{error}</p>
            {accessErrorStatus ? (
              <Link
                href={loginRecoveryHref}
                className="mt-2 inline-flex h-11 items-center rounded-md bg-white/[0.06] px-4 text-sm text-slate-200 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              >
                {accessErrorStatus === 403 ? '切换学生账号' : '重新登录'}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void fetchData()}
                className="mt-2 inline-flex h-11 items-center rounded-md bg-white/[0.06] px-4 text-sm text-slate-300 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
              >
                重试
              </button>
            )}
          </div>
        )}
        {progress && !dataComplete && (
          <section
            role="status"
            aria-live="polite"
            aria-busy={loading}
            className="col-span-full rounded-md border border-amber-300/25 bg-amber-300/[0.055] p-5"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-amber-100">当前学期结果尚未完整，暂不形成个人达成结论</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {progress.dataStatus.classId && progress.dataStatus.semester
                    ? `已按 ${progress.dataStatus.className ?? '当前班级'}、${progress.dataStatus.semester} 和当前课程配置核对。待教师完成本学期复算后，雷达图、达成率和明细会统一更新。`
                    : '尚未找到带有效学期的在读班级。请先确认班级归属，再由教师完成本学期达成度计算。'}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  本页只读取教师已复算的数据；重复刷新不会改写测评、实验或学习记录。
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatusMetric
                    label="课程目标记录"
                    {...formatExpectedRecordStatus(
                      progress.dataStatus.freshCourseObjectiveRecords,
                      progress.dataStatus.expectedCourseObjectiveRecords,
                      progress.dataStatus.missingCourseObjectiveRecords,
                    )}
                  />
                  <StatusMetric
                    label="指标点记录"
                    {...formatExpectedRecordStatus(
                      progress.dataStatus.freshIndicatorRecords,
                      progress.dataStatus.expectedIndicatorRecords,
                      progress.dataStatus.missingIndicatorRecords,
                    )}
                  />
                  <StatusMetric
                    className="col-span-2 lg:col-span-1"
                    label="已隔离旧记录"
                    value={String(progress.dataStatus.staleCourseObjectiveRecords + progress.dataStatus.staleIndicatorRecords)}
                    detail={`最近当前结果：${formatDateTime(progress.dataStatus.lastCalculatedAt)}`}
                  />
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/tasks"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/[0.09] px-4 text-sm text-cyan-100 hover:bg-cyan-300/[0.14] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    查看当前学习任务
                  </Link>
                  <button
                    type="button"
                    onClick={() => void fetchData()}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    {loading ? '正在刷新数据…' : '刷新数据状态'}
                  </button>
                </div>
                <div className="mt-2 text-[11px] leading-5 text-slate-500">
                  页面数据刷新于 {formatDateTime(lastCheckedAt)}。刷新后仍未补齐时，请联系任课教师确认复算范围。
                </div>
              </div>
            </div>
          </section>
        )}
        {/* Left: Radar + Indicators */}
        <div className="space-y-5">
          {/* Radar Chart */}
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <TrendingUp className="h-3.5 w-3.5" />
              能力雷达图
            </div>
            {loading ? (
              <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">加载中...</div>
            ) : !dataComplete ? (
              <div className="flex h-[320px] items-center justify-center px-6 text-center text-sm text-slate-500">
                当前版本记录补齐后显示能力雷达图
              </div>
            ) : radarData.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center text-sm text-slate-500">
                暂无达成数据，请先完成测验和实验
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={360}>
                <RadarChart data={radarData.map((d) => ({
                  name: d.indicatorName,
                  full: d.threshold * 100,
                  value: Math.round(d.achievementDegree * 100),
                  passed: d.passed,
                }))}>
                  <PolarGrid stroke={MOCHA.surface0} />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fill: MOCHA.subtext0, fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fill: MOCHA.overlay1, fontSize: 9 }}
                    tickCount={5}
                  />
                  <Radar
                    name="达成标准"
                    dataKey="full"
                    stroke={MOCHA.overlay1}
                    fill={MOCHA.overlay1}
                    fillOpacity={0.08}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name="达成度"
                    dataKey="value"
                    stroke={MOCHA.teal}
                    fill={MOCHA.teal}
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1e1e2e',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      color: MOCHA.text,
                      fontSize: 12,
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}%`,
                      name === '达成度' ? '当前达成度' : '达成标准',
                    ]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Indicator Points Progress */}
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <BookOpen className="h-3.5 w-3.5" />
              毕业要求指标点
            </div>
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">加载中...</div>
            ) : !dataComplete ? (
              <div className="py-8 text-center text-sm text-slate-500">当前版本记录补齐后显示指标点结论</div>
            ) : !progress?.indicatorPoints.length ? (
              <div className="py-8 text-center text-sm text-slate-500">暂无数据</div>
            ) : (
              <div className="space-y-3">
                {progress.indicatorPoints.map((ip) => {
                  const pct = Math.round(ip.achievementDegree * 100);
                  const thresholdPct = Math.round(ip.threshold * 100);
                  return (
                    <div key={ip.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {ip.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-300/60" />
                          )}
                          <span className="font-mono text-xs text-slate-500">{ip.code}</span>
                          <span className="text-sm text-slate-200">{ip.description}</span>
                        </div>
                        <span className={cn(
                          'font-mono text-sm font-semibold',
                          ip.passed ? 'text-emerald-300' : 'text-red-300',
                        )}>
                          {pct}%
                        </span>
                      </div>
                      <div className="relative mt-2 h-2 overflow-hidden rounded-sm bg-white/[0.08]">
                        {/* Threshold marker */}
                        <div
                          className="absolute top-0 bottom-0 w-px bg-amber-300/50"
                          style={{ left: `${thresholdPct}%` }}
                        />
                        <div
                          className={cn(
                            'h-full rounded-sm transition-all',
                            ip.passed ? 'bg-emerald-300' : 'bg-cyan-300',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      {ip.contributingCOs?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ip.contributingCOs.map((co) => (
                            <span key={co.coCode} className="font-mono text-[10px] text-slate-500">
                              {co.coCode}: {Math.round(co.coAchievement * 100)}%
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Course Objectives Breakdown */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              <Target className="h-3.5 w-3.5" />
              课程目标达成详情
            </div>
            {loading ? (
              <div className="py-8 text-center text-sm text-slate-500">加载中...</div>
            ) : !dataComplete ? (
              <div className="py-8 text-center text-sm text-slate-500">当前版本记录补齐后显示课程目标明细</div>
            ) : !progress?.courseObjectives.length ? (
              <div className="py-8 text-center text-sm text-slate-500">暂无数据</div>
            ) : (
              <div className="space-y-3">
                {progress.courseObjectives.map((co) => {
                  const pct = Math.round(co.achievementDegree * 100);
                  const isExpanded = expandedCO === co.id;
                  return (
                    <div key={co.id} className="rounded-md border border-white/[0.06] bg-white/[0.02]">
                      <button
                        type="button"
                        onClick={() => setExpandedCO(isExpanded ? null : co.id)}
                        aria-expanded={isExpanded}
                        aria-controls={`co-breakdown-${co.id}`}
                        className="flex min-h-11 w-full items-center justify-between gap-3 p-3 text-left transition hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-300/30"
                      >
                        <div className="flex items-center gap-2">
                          {co.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-300/60" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-cyan-200">{co.code}</span>
                              <span className="text-sm text-slate-200">{co.name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-mono text-sm font-semibold',
                            co.passed ? 'text-emerald-300' : 'text-amber-300',
                          )}>
                            {pct}%
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                      </button>
                      {isExpanded && co.breakdown?.length > 0 && (
                        <div
                          id={`co-breakdown-${co.id}`}
                          role="region"
                          aria-label={`${co.code}考核明细`}
                          className="border-t border-white/[0.06] p-3"
                        >
                          <div className="space-y-2">
                            {co.breakdown.map((b, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                                    {ASSESSMENT_LABELS[b.type] || b.type}
                                  </span>
                                  <span className="text-slate-400">{b.description || b.targetId}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-300">
                                    {Math.round(b.score)}/{b.maxScore}
                                  </span>
                                  <span className="text-slate-500">×{b.weight}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function StatusMetric({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-md border border-white/[0.07] bg-black/10 p-3', className)}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg text-slate-100">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}
