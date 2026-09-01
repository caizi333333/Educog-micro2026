'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  BarChart4,
  BookOpen,
  Calculator,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Target,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ADDRESSING_TOPIC_ID } from '@/lib/lesson-tasks';
import { cn } from '@/lib/utils';

// -- Types ------------------------------------------------------------------

interface COStats {
  coCode: string;
  coName: string;
  avg: number;
  passRate: number;
}

interface IPStats {
  ipCode: string;
  ipName: string;
  avg: number;
  passRate: number;
}

interface DataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

interface ClassStats {
  classId: string;
  className: string;
  semester: string;
  studentCount: number;
  averageAchievementByCO: COStats[];
  averageAchievementByIP: IPStats[];
  students: CalculationStudentReview[];
  dataProvenance: DataProvenance;
  dataStatus: {
    configurationRevision: string;
    configurationUpdatedAt: string | null;
    courseObjectives: AchievementReadStatus;
    indicatorPoints: AchievementReadStatus;
    complete: boolean;
    lastCalculatedAt: string | null;
    configurationError: string | null;
  };
}

interface TeacherClass {
  id: string;
  name: string;
  semester?: string | null;
  _count?: { enrollments: number };
}

interface AchievementReadStatus {
  configurationRevision: string;
  configurationUpdatedAt: string | null;
  targetCount: number | null;
  expectedRecords: number | null;
  freshRecords: number;
  staleRecords: number;
  missingRecords: number | null;
  complete: boolean;
  lastCalculatedAt: string | null;
}

interface CalculationReview {
  requestId: string;
  classId: string;
  className: string;
  semester: string;
  mode: 'class' | 'user';
  targetUserId: string | null;
  targetCount: number;
  objectiveCount: number;
  indicatorPointCount: number;
  expectedCourseObjectiveRecords: number;
  currentCourseObjectiveRecords: number;
  staleCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  expectedIndicatorRecords: number;
  currentIndicatorRecords: number;
  staleIndicatorRecords: number;
  missingIndicatorRecords: number;
  configurationRevision: string;
  configurationUpdatedAt: string;
  scopeRevision: string;
  students: CalculationStudentReview[];
}

interface CalculationStudentReview {
  userId: string;
  name: string;
  studentCode: string | null;
  freshCourseObjectiveRecords: number;
  staleCourseObjectiveRecords: number;
  missingCourseObjectiveRecords: number;
  freshIndicatorRecords: number;
  staleIndicatorRecords: number;
  missingIndicatorRecords: number;
  complete: boolean;
  lastCalculatedAt: string | null;
}

interface PendingCalculation {
  review: CalculationReview;
  body: {
    classId: string;
    userId?: string;
    semester: string;
    requestId: string;
    confirm: 'CALCULATE_CLASS' | 'CALCULATE_USER';
    expectedScopeRevision: string;
  };
}

interface InitialTeacherScope {
  classId: string;
  semester: string;
}

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // Fall through to the stable user-facing fallback.
  }
  return fallback;
}

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) return `${year}-${year + 1}-1`;
  if (month === 1) return `${year - 1}-${year}-1`;
  return `${year - 1}-${year}-2`;
}

function validSemester(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = /^(\d{4})-(\d{4})-([12])$/.exec(value);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

function formatDateTime(value: string | null): string {
  if (!value) return '尚无当前版本结果';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '时间待核实';
  return parsed.toLocaleString('zh-CN', { hour12: false });
}

function formatTeacherExpectedRecordStatus(
  freshRecords: number,
  expectedRecords: number | null,
  missingRecords: number | null,
): { value: string; detail: string } {
  if (expectedRecords === 0) {
    return { value: '尚未配置', detail: '待完成课程目标配置' };
  }
  if (expectedRecords === null) {
    return { value: '待核实', detail: '服务端未返回应生成数量' };
  }
  return {
    value: `${freshRecords}/${expectedRecords}`,
    detail: `缺少 ${missingRecords ?? '待核实'} 条`,
  };
}

function isAchievementReadStatus(value: unknown): value is AchievementReadStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const status = value as Partial<AchievementReadStatus>;
  return typeof status.configurationRevision === 'string'
    && (status.configurationUpdatedAt === null || typeof status.configurationUpdatedAt === 'string')
    && (status.targetCount === null || Number.isInteger(status.targetCount))
    && (status.expectedRecords === null || Number.isInteger(status.expectedRecords))
    && Number.isInteger(status.freshRecords)
    && Number.isInteger(status.staleRecords)
    && (status.missingRecords === null || Number.isInteger(status.missingRecords))
    && typeof status.complete === 'boolean'
    && (status.lastCalculatedAt === null || typeof status.lastCalculatedAt === 'string');
}

function parseDataProvenance(value: unknown): DataProvenance | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const provenance = value as Partial<DataProvenance>;
  if ((provenance.mode !== 'DEMO' && provenance.mode !== 'REAL' && provenance.mode !== 'MIXED')
    || typeof provenance.label !== 'string'
    || !provenance.label.trim()
    || typeof provenance.note !== 'string'
    || !provenance.note.trim()) return null;
  return {
    mode: provenance.mode,
    label: provenance.label.trim(),
    note: provenance.note.trim(),
  };
}

function sameDataProvenance(left: DataProvenance, right: DataProvenance): boolean {
  return left.mode === right.mode && left.label === right.label && left.note === right.note;
}

function dataUseBoundary(mode: DataProvenance['mode']): string {
  if (mode === 'REAL') return '仅限当前授权班级与所选学期使用；超出该范围不得外推。';
  if (mode === 'MIXED') return '须按真实记录与演示记录分别解释，不形成未经区分的总体成效结论。';
  return '仅用于验证教学流程与界面，不用于证明真实教学成效。';
}

function DataProvenancePanel({
  provenance,
  loading,
}: {
  provenance: DataProvenance | null;
  loading: boolean;
}) {
  if (!provenance) {
    return (
      <div
        role={loading ? 'status' : 'alert'}
        className={cn(
          'mb-5 rounded-md border px-4 py-3',
          loading
            ? 'border-white/[0.08] bg-white/[0.035] text-slate-300'
            : 'border-red-300/20 bg-red-300/[0.06] text-red-100',
        )}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
          {loading ? '正在核验服务端数据身份' : '数据身份未通过核验'}
        </div>
        <p className="mt-1 text-xs leading-5 opacity-80">
          {loading
            ? '核验通过前不展示班级、课程目标或指标点成效数值。'
            : '当前成效数值已停止展示。请使用下方入口重试，必要时重新登录。'}
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

function parseCalculationReview(
  value: unknown,
  scope: Pick<CalculationReview, 'requestId' | 'classId' | 'className' | 'semester'>,
): CalculationReview | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Partial<CalculationReview>;
  const integerKeys: Array<keyof CalculationReview> = [
    'targetCount',
    'objectiveCount',
    'indicatorPointCount',
    'expectedCourseObjectiveRecords',
    'currentCourseObjectiveRecords',
    'staleCourseObjectiveRecords',
    'missingCourseObjectiveRecords',
    'expectedIndicatorRecords',
    'currentIndicatorRecords',
    'staleIndicatorRecords',
    'missingIndicatorRecords',
  ];
  if (integerKeys.some((key) => !Number.isInteger(body[key]) || Number(body[key]) < 0)) return null;
  if ((body.mode !== 'class' && body.mode !== 'user')
    || (body.targetUserId !== null && typeof body.targetUserId !== 'string')
    || typeof body.configurationRevision !== 'string'
    || typeof body.configurationUpdatedAt !== 'string'
    || typeof body.scopeRevision !== 'string') return null;
  const students = Array.isArray(body.students)
    ? body.students.flatMap((student) => {
      if (!student || typeof student !== 'object' || Array.isArray(student)) return [];
      const item = student as Partial<CalculationStudentReview>;
      const counts = [
        item.freshCourseObjectiveRecords,
        item.staleCourseObjectiveRecords,
        item.missingCourseObjectiveRecords,
        item.freshIndicatorRecords,
        item.staleIndicatorRecords,
        item.missingIndicatorRecords,
      ];
      if (typeof item.userId !== 'string'
        || typeof item.name !== 'string'
        || (item.studentCode !== null && typeof item.studentCode !== 'string')
        || counts.some((count) => !Number.isInteger(count) || Number(count) < 0)
        || typeof item.complete !== 'boolean'
        || (item.lastCalculatedAt !== null && typeof item.lastCalculatedAt !== 'string')) return [];
      return [{
        userId: item.userId,
        name: item.name,
        studentCode: item.studentCode,
        freshCourseObjectiveRecords: item.freshCourseObjectiveRecords as number,
        staleCourseObjectiveRecords: item.staleCourseObjectiveRecords as number,
        missingCourseObjectiveRecords: item.missingCourseObjectiveRecords as number,
        freshIndicatorRecords: item.freshIndicatorRecords as number,
        staleIndicatorRecords: item.staleIndicatorRecords as number,
        missingIndicatorRecords: item.missingIndicatorRecords as number,
        complete: item.complete,
        lastCalculatedAt: item.lastCalculatedAt,
      }];
    })
    : [];
  return {
    ...scope,
    mode: body.mode,
    targetUserId: body.targetUserId,
    targetCount: body.targetCount as number,
    objectiveCount: body.objectiveCount as number,
    indicatorPointCount: body.indicatorPointCount as number,
    expectedCourseObjectiveRecords: body.expectedCourseObjectiveRecords as number,
    currentCourseObjectiveRecords: body.currentCourseObjectiveRecords as number,
    staleCourseObjectiveRecords: body.staleCourseObjectiveRecords as number,
    missingCourseObjectiveRecords: body.missingCourseObjectiveRecords as number,
    expectedIndicatorRecords: body.expectedIndicatorRecords as number,
    currentIndicatorRecords: body.currentIndicatorRecords as number,
    staleIndicatorRecords: body.staleIndicatorRecords as number,
    missingIndicatorRecords: body.missingIndicatorRecords as number,
    configurationRevision: body.configurationRevision,
    configurationUpdatedAt: body.configurationUpdatedAt,
    scopeRevision: body.scopeRevision,
    students,
  };
}

// -- Constants --------------------------------------------------------------

const MOCHA = {
  teal: '#94e2d5',
  blue: '#89b4fa',
  green: '#a6e3a1',
  peach: '#fab387',
  mauve: '#cba6f7',
  red: '#f38ba8',
  amber: '#f9e2af',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  overlay1: '#7f849c',
  surface0: '#313244',
} as const;

// -- Component --------------------------------------------------------------

export default function OBETeacherPage() {
  return <OBETeacherDashboard />;
}

function OBETeacherDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [initialScopeLoaded, setInitialScopeLoaded] = useState(false);
  const [initialScope, setInitialScope] = useState<InitialTeacherScope | null>(null);
  const [classStats, setClassStats] = useState<ClassStats | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [classesReloadKey, setClassesReloadKey] = useState(0);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [scopeReady, setScopeReady] = useState(false);
  const [semester, setSemester] = useState(currentSemester());
  const [semesterDraft, setSemesterDraft] = useState(currentSemester());
  const [classesLoading, setClassesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calculationStage, setCalculationStage] = useState<'review' | 'execute' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [calculationReview, setCalculationReview] = useState<CalculationReview | null>(null);
  const [pendingCalculation, setPendingCalculation] = useState<PendingCalculation | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'co' | 'ip'>('overview');
  const calculationLockRef = useRef(false);
  const calculationButtonRef = useRef<HTMLButtonElement>(null);
  const calculationReturnFocusRef = useRef<HTMLElement | null>(null);
  const statsAbortRef = useRef<AbortController | null>(null);
  const appliedClassIdRef = useRef<string | null>(null);
  const initialScopeConsumedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedClassId = params.get('classId')?.trim() ?? '';
    const requestedSemester = params.get('semester')?.trim() ?? '';
    if (/^[A-Za-z0-9_-]{1,128}$/.test(requestedClassId) && validSemester(requestedSemester)) {
      setInitialScope({ classId: requestedClassId, semester: requestedSemester });
    }
    if (params.get('intervention') === 'sent') {
      setNotice('补充学习任务已提交，已返回原班级与学期继续复核。');
    }
    setInitialScopeLoaded(true);
  }, []);

  useEffect(() => {
    if (!initialScopeLoaded) return;
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      setClassesLoading(false);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setClassesLoading(true);
    setError(null);
    void (async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) throw new Error('登录状态已失效，请重新登录');
        const res = await fetchClientRequest('/api/classes?status=ACTIVE', {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS);
        if (res.status === 401) {
          await logout();
          return;
        }
        if (!res.ok) throw new Error(await responseError(res, '加载班级失败'));
        const json = await res.json() as { classes?: TeacherClass[] };
        const classes = Array.isArray(json.classes) ? json.classes : [];
        setTeacherClasses(classes);
        setSelectedClassId((current) => {
          if (classes.some((item) => item.id === current)) return current;
          if (initialScope && classes.some((item) => item.id === initialScope.classId)) {
            return initialScope.classId;
          }
          return classes[0]?.id ?? null;
        });
        if (classes.length === 0) setClassStats(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load classes:', err);
        setTeacherClasses([]);
        setSelectedClassId(null);
        setClassStats(null);
        setError(err instanceof Error ? err.message : '加载班级失败');
      } finally {
        if (!controller.signal.aborted) setClassesLoading(false);
      }
    })();
    return () => controller.abort();
  }, [classesReloadKey, initialScope, initialScopeLoaded, logout, user]);

  useEffect(() => {
    const selected = teacherClasses.find((item) => item.id === selectedClassId);
    if (!selected) return;
    if (appliedClassIdRef.current === selected.id) return;
    appliedClassIdRef.current = selected.id;
    const selectedSemester = !initialScopeConsumedRef.current
      && initialScope?.classId === selected.id
      && validSemester(initialScope.semester)
      ? initialScope.semester
      : validSemester(selected.semester)
        ? selected.semester
        : currentSemester();
    initialScopeConsumedRef.current = true;
    setSemester(selectedSemester);
    setSemesterDraft(selectedSemester);
    setCalculationReview(null);
    setPendingCalculation(null);
    setScopeReady(true);
  }, [initialScope, selectedClassId, teacherClasses]);

  useEffect(() => {
    if (!scopeReady || !selectedClassId || !validSemester(semester)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('classId', selectedClassId);
    url.searchParams.set('semester', semester);
    url.searchParams.delete('intervention');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState({}, '', nextUrl);
  }, [scopeReady, selectedClassId, semester]);

  const fetchStats = useCallback(async () => {
    if (!user || !selectedClassId) {
      setClassStats(null);
      setLoading(false);
      return;
    }
    if (!scopeReady) {
      setLoading(true);
      return;
    }
    statsAbortRef.current?.abort();
    const controller = new AbortController();
    statsAbortRef.current = controller;
    setLoading(true);
    setClassStats(null);
    setError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const headers = { Authorization: `Bearer ${token}` };
      const cls = teacherClasses.find((c) => c.id === selectedClassId);
      const query = new URLSearchParams({ classId: selectedClassId, semester });
      const [grRes, coRes, reviewRes] = await Promise.all([
        fetchClientRequest(`/api/obe/achievement/graduation-requirement?${query.toString()}`, {
          headers,
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS),
        fetchClientRequest(`/api/obe/achievement/course-objective?${query.toString()}`, {
          headers,
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS),
        fetchClientRequest(`/api/obe/achievement/calculate?${query.toString()}`, {
          headers,
          signal: controller.signal,
        }, CLIENT_READ_TIMEOUT_MS),
      ]);
      if (grRes.status === 401 || coRes.status === 401 || reviewRes.status === 401) {
        await logout();
        return;
      }
      if (!grRes.ok) throw new Error(await responseError(grRes, '加载指标点达成度失败'));
      if (!coRes.ok) throw new Error(await responseError(coRes, '加载课程目标达成度失败'));
      if (!reviewRes.ok) throw new Error(await responseError(reviewRes, '加载学生复核状态失败'));
      const [grJson, coJson, reviewJson] = await Promise.all([
        grRes.json() as Promise<{ achievements?: unknown; dataStatus?: unknown; dataProvenance?: unknown }>,
        coRes.json() as Promise<{ achievements?: unknown; dataStatus?: unknown; dataProvenance?: unknown }>,
        reviewRes.json() as Promise<{ review?: unknown; configurationError?: unknown; dataProvenance?: unknown }>,
      ]);
      if (controller.signal.aborted) return;
      const grProvenance = parseDataProvenance(grJson.dataProvenance);
      const coProvenance = parseDataProvenance(coJson.dataProvenance);
      const reviewProvenance = parseDataProvenance(reviewJson.dataProvenance);
      if (!grProvenance || !coProvenance || !reviewProvenance) {
        throw new Error('达成度数据缺少有效的服务端数据身份，已停止展示成效数值');
      }
      if (!sameDataProvenance(grProvenance, coProvenance)
        || !sameDataProvenance(grProvenance, reviewProvenance)) {
        throw new Error('达成度数据身份不一致，已停止展示成效数值，请重新加载');
      }
      if (!isAchievementReadStatus(grJson.dataStatus) || !isAchievementReadStatus(coJson.dataStatus)) {
        throw new Error('达成度状态信息不完整，请重试');
      }
      if (grJson.dataStatus.configurationRevision !== coJson.dataStatus.configurationRevision) {
        throw new Error('读取期间课程目标配置发生变化，请重新加载');
      }
      const readReview = parseCalculationReview(reviewJson.review, {
        requestId: 'read-only-review',
        classId: selectedClassId,
        className: cls?.name ?? '未命名班级',
        semester,
      });
      if (!readReview) throw new Error('学生复核状态信息不完整，请重试');
      if (readReview.mode !== 'class'
        || readReview.configurationRevision !== coJson.dataStatus.configurationRevision
        || readReview.targetCount !== coJson.dataStatus.targetCount
        || readReview.targetCount !== grJson.dataStatus.targetCount) {
        throw new Error('读取期间课程配置或有效学生名单发生变化，请重新加载');
      }
      const configurationError = reviewJson.configurationError;
      if (configurationError !== null && typeof configurationError !== 'string') {
        throw new Error('课程配置检查状态异常，请重试');
      }
      const normalizedConfigurationError = typeof configurationError === 'string'
        ? configurationError
        : null;
      if (readReview.students.length !== readReview.targetCount) {
        throw new Error('学生复核名单不完整，请重新加载');
      }
      const grAchievements = Array.isArray(grJson.achievements) ? grJson.achievements : [];
      const coAchievements = Array.isArray(coJson.achievements) ? coJson.achievements : [];
      const targetCount = Math.max(
        grJson.dataStatus.targetCount ?? 0,
        coJson.dataStatus.targetCount ?? 0,
      );
      const complete = grJson.dataStatus.complete
        && coJson.dataStatus.complete
        && !normalizedConfigurationError;
      const lastCalculatedAt = [
        grJson.dataStatus.lastCalculatedAt,
        coJson.dataStatus.lastCalculatedAt,
      ].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
      setClassStats({
        classId: selectedClassId,
        className: cls?.name ?? '未命名班级',
        semester,
        studentCount: targetCount,
        averageAchievementByCO: aggregateCO(coAchievements),
        averageAchievementByIP: aggregateGR(grAchievements),
        students: readReview.students,
        dataProvenance: grProvenance,
        dataStatus: {
          configurationRevision: coJson.dataStatus.configurationRevision,
          configurationUpdatedAt: coJson.dataStatus.configurationUpdatedAt,
          courseObjectives: coJson.dataStatus,
          indicatorPoints: grJson.dataStatus,
          complete,
          lastCalculatedAt,
          configurationError: normalizedConfigurationError,
        },
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch OBE teacher data:', err);
      setClassStats(null);
      setError(err instanceof Error ? err.message : '加载达成度数据失败');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [logout, scopeReady, selectedClassId, semester, teacherClasses, user]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => () => statsAbortRef.current?.abort(), []);

  const executeCalculation = async (pending: PendingCalculation) => {
    if (calculating || calculationLockRef.current) return;
    calculationLockRef.current = true;
    setCalculating(true);
    setCalculationStage('execute');
    setError(null);
    setNotice(null);
    const token = getStoredAccessToken();
    try {
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      let response: Response;
      try {
        response = await fetchClientRequest('/api/obe/achievement/calculate', {
          method: 'POST',
          headers,
          body: JSON.stringify(pending.body),
        }, CLIENT_WRITE_TIMEOUT_MS);
      } catch (err) {
        if (!isAmbiguousClientFailure(err)) throw err;
        setPendingCalculation(pending);
        setError('计算请求已发出，但结果暂时无法确认。请使用原请求重试，或刷新后核对当前结果。');
        return;
      }
      if (response.status === 401) {
        await logout();
        return;
      }
      let body: Record<string, unknown> = {};
      try {
        body = await response.json() as Record<string, unknown>;
      } catch {
        // Keep a stable fallback for malformed upstream responses.
      }
      if (response.status === 409 && body.confirmationRequired) {
        const nextRequestId = crypto.randomUUID();
        const nextReview = parseCalculationReview(body, {
          requestId: nextRequestId,
          classId: pending.review.classId,
          className: pending.review.className,
          semester: pending.review.semester,
        });
        setPendingCalculation(null);
        if (nextReview) {
          setCalculationReview(nextReview);
          setError(typeof body.error === 'string' ? body.error : '计算范围已变化，请重新核对');
          return;
        }
      }
      if (!response.ok) {
        const message = typeof body.error === 'string' ? body.error : '达成度计算失败';
        if (response.status >= 500 || body.retrySameRequest === true) {
          setPendingCalculation(pending);
          setError(`${message}。请使用原请求重试，避免生成重复计算。`);
          return;
        }
        throw new Error(message);
      }
      setPendingCalculation(null);
      setCalculationReview(null);
      const duplicate = body.duplicate === true;
      const scopeStale = body.scopeStale === true;
      const studentCount = Number.isInteger(body.studentCount)
        ? Number(body.studentCount)
        : pending.review.targetCount;
      const targetStudent = pending.review.students[0];
      setNotice(scopeStale
        ? '已恢复上一次计算回执，但当前配置或班级名单已变化；旧结果不会展示，请重新核对后计算'
        : duplicate
          ? '已恢复同一计算请求，未重复写入'
          : pending.review.mode === 'user'
            ? `已完成 ${targetStudent?.name ?? '目标学生'} 在 ${pending.review.semester} 的达成度计算`
            : `已完成 ${studentCount} 名学生在 ${pending.review.semester} 的达成度计算`);
      await fetchStats();
    } catch (err) {
      console.error('Calculate failed:', err);
      setError(err instanceof Error ? err.message : '达成度计算失败');
    } finally {
      calculationLockRef.current = false;
      setCalculating(false);
      setCalculationStage(null);
    }
  };

  const handleCalculate = async (targetUserId?: string) => {
    if (!classStats || calculating || calculationLockRef.current || calculationReview || pendingCalculation) return;
    if (classStats.dataStatus.configurationError) {
      setError(classStats.dataStatus.configurationError);
      return;
    }
    const targetStudent = targetUserId
      ? classStats.students.find((student) => student.userId === targetUserId)
      : null;
    if (targetUserId && !targetStudent) {
      setError('该学生已不在当前有效名单中，请重新加载');
      return;
    }
    calculationReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : calculationButtonRef.current;
    calculationLockRef.current = true;
    setCalculating(true);
    setCalculationStage('review');
    setError(null);
    setNotice(null);
    const requestId = crypto.randomUUID();
    const token = getStoredAccessToken();
    try {
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const preflight = await fetchClientRequest('/api/obe/achievement/calculate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classStats.classId,
          ...(targetUserId ? { userId: targetUserId } : {}),
          semester: classStats.semester,
          requestId,
        }),
      }, CLIENT_WRITE_TIMEOUT_MS);
      if (preflight.status === 401) {
        await logout();
        return;
      }
      const preflightBody = await preflight.json() as Record<string, unknown>;
      if (preflight.status !== 409 || preflightBody.confirmationRequired !== true) {
        throw new Error(typeof preflightBody.error === 'string' ? preflightBody.error : '无法确认本次计算范围');
      }
      const review = parseCalculationReview(preflightBody, {
        requestId,
        classId: classStats.classId,
        className: classStats.className,
        semester: classStats.semester,
      });
      if (!review) {
        throw new Error('服务端返回的计算范围不完整，请刷新后重试');
      }
      if (targetUserId
        ? review.mode !== 'user'
          || review.targetUserId !== targetUserId
          || review.targetCount !== 1
          || review.students.length !== 1
        : review.mode !== 'class' || review.targetUserId !== null) {
        throw new Error('服务端返回的计算对象与当前选择不一致，请刷新后重试');
      }
      setCalculationReview(review);
    } catch (err) {
      console.error('Calculation preflight failed:', err);
      setError(err instanceof Error ? err.message : '无法核对计算范围');
    } finally {
      calculationLockRef.current = false;
      setCalculating(false);
      setCalculationStage(null);
    }
  };

  const confirmCalculation = () => {
    if (!calculationReview) return;
    const pending: PendingCalculation = {
      review: calculationReview,
      body: {
        classId: calculationReview.classId,
        ...(calculationReview.mode === 'user' && calculationReview.targetUserId
          ? { userId: calculationReview.targetUserId }
          : {}),
        semester: calculationReview.semester,
        requestId: calculationReview.requestId,
        confirm: calculationReview.mode === 'user' ? 'CALCULATE_USER' : 'CALCULATE_CLASS',
        expectedScopeRevision: calculationReview.scopeRevision,
      },
    };
    setCalculationReview(null);
    void executeCalculation(pending);
  };

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] text-sm text-slate-400 sm:-m-6">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在核验访问权限
      </div>
    );
  }

  if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 sm:-m-6">
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Target className="mx-auto h-6 w-6 text-cyan-200" />
          <p className="mt-3 text-sm text-slate-300">仅教师和管理员可访问此页面</p>
          <Link
            href="/login?from=%2Fobe%2Fteacher&reason=teacher-role"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
          >
            {!user ? '去登录' : '切换教师账号'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      {/* Header */}
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <BarChart4 className="h-3.5 w-3.5" />
              OBE · 达成度看板
            </div>
            <h1 id="obe-teacher-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">教学达成度分析</h1>
            <p className="mt-1 text-sm text-slate-400">
              {classStats
                ? `${classStats.className} · ${classStats.studentCount} 名有效学生`
                : teacherClasses.length === 0 ? '暂无可管理班级' : '请选择班级查看'}
            </p>
            {teacherClasses.length > 0 && (
              <div className="mt-3 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-slate-400">
                  当前分析班级
                  <select
                    value={selectedClassId ?? ''}
                    onChange={(e) => {
                      setNotice(null);
                      setClassStats(null);
                      setScopeReady(false);
                      setSelectedClassId(e.target.value);
                    }}
                    disabled={classesLoading || loading || calculating || Boolean(calculationReview) || Boolean(pendingCalculation)}
                    className="h-11 rounded-md border border-white/[0.1] bg-[#111820] px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {teacherClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}（{c._count?.enrollments ?? 0} 人）
                      </option>
                    ))}
                  </select>
                  <span className="min-h-4 text-[11px] leading-4 text-slate-500">切换后自动载入该班级学期</span>
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs text-slate-400">
                  分析学期
                  <input
                    value={semesterDraft}
                    onChange={(event) => setSemesterDraft(event.target.value.trim())}
                    placeholder="2025-2026-2"
                    aria-invalid={semesterDraft.length > 0 && !validSemester(semesterDraft)}
                    aria-describedby="obe-semester-format"
                    disabled={classesLoading || loading || calculating || Boolean(calculationReview) || Boolean(pendingCalculation)}
                    className="h-11 rounded-md border border-white/[0.1] bg-[#111820] px-3 text-sm text-slate-200 outline-none transition focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span
                    id="obe-semester-format"
                    className={cn(
                      'min-h-4 text-[11px] leading-4',
                      semesterDraft.length > 0 && !validSemester(semesterDraft) ? 'text-red-300' : 'text-slate-500',
                    )}
                  >
                    {semesterDraft.length > 0 && !validSemester(semesterDraft)
                      ? '格式应为连续学年和第 1 或第 2 学期，如 2025-2026-1'
                      : '格式：起始年-结束年-学期'}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!validSemester(semesterDraft)) {
                      setError('学期格式应为“起始年-结束年-1或2”');
                      return;
                    }
                    setError(null);
                    setNotice(null);
                    setSemester(semesterDraft);
                  }}
                  disabled={!validSemester(semesterDraft) || semesterDraft === semester || loading || calculating || Boolean(calculationReview) || Boolean(pendingCalculation)}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-sm text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  应用学期
                </button>
              </div>
            )}
          </div>
          <button
            ref={calculationButtonRef}
            type="button"
            onClick={() => void handleCalculate()}
            disabled={calculating || classesLoading || loading || !classStats || classStats.studentCount === 0 || Boolean(classStats?.dataStatus.configurationError) || Boolean(calculationReview) || Boolean(pendingCalculation)}
            title={classStats?.dataStatus.configurationError ?? undefined}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            {calculationStage === 'review'
              ? '正在生成确认清单…'
              : calculationStage === 'execute'
                ? '正在计算并写入…'
                : '核对并重新计算'}
          </button>
        </div>
      </div>

      <section aria-labelledby="obe-teacher-page-title" className="px-4 py-5 md:px-6">
        <DataProvenancePanel
          provenance={classStats?.dataProvenance ?? null}
          loading={classesLoading || loading}
        />
        <div aria-live="polite" aria-atomic="true">
          {notice && (
            <div className="mb-5 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100">
              {notice}
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="mb-5 rounded-md border border-red-300/20 bg-red-300/[0.06] p-4 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
              {pendingCalculation ? (
                <>
                  <button
                    type="button"
                    onClick={() => void executeCalculation(pendingCalculation)}
                    disabled={calculating}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-white/[0.08] px-4 text-sm text-slate-100 hover:bg-white/[0.12] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-40"
                  >
                    使用原请求重试
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingCalculation(null);
                      setError(null);
                      void fetchStats();
                    }}
                    disabled={calculating}
                    className="inline-flex h-11 items-center justify-center rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-40"
                  >
                    放弃重试并刷新结果
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (teacherClasses.length === 0) setClassesReloadKey((value) => value + 1);
                      else void fetchStats();
                    }}
                    className="inline-flex h-11 items-center justify-center rounded-md bg-white/[0.06] px-4 text-sm text-slate-200 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    重新加载
                  </button>
                  <Link
                    href={`/login?from=${encodeURIComponent(`/obe/teacher?classId=${selectedClassId ?? ''}&semester=${semester}`)}`}
                    className="inline-flex h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-4 text-sm text-cyan-100 hover:bg-cyan-300/[0.11] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    重新登录
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {calculationReview && (
          <CalculationReviewPanel
            review={calculationReview}
            calculating={calculating}
            onCancel={() => {
              setCalculationReview(null);
              setError(null);
              setNotice('已取消计算，现有达成度结果未改变');
              setTimeout(() => calculationReturnFocusRef.current?.focus(), 0);
            }}
            onConfirm={confirmCalculation}
          />
        )}

        {classesLoading || loading ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载达成度数据
          </div>
        ) : !classStats ? (
          <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
            <Target className="h-8 w-8 text-slate-600" />
            <span>暂无可分析数据</span>
            <span className="text-xs text-slate-500">请先创建班级并加入有效学生，再执行达成度计算</span>
          </div>
        ) : (
          <div className="space-y-5">
            <AchievementDataStatusPanel stats={classStats} />
            <StudentAchievementStatusPanel
              stats={classStats}
              busy={calculating || Boolean(calculationReview) || Boolean(pendingCalculation)}
              onCalculate={(userId) => void handleCalculate(userId)}
            />
            {classStats.dataStatus.complete ? (
              <>
                <div className="flex gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] p-1">
                  {([
                    ['overview', LayoutGrid, '总览'],
                    ['co', BookOpen, '课程目标'],
                    ['ip', Target, '指标点'],
                  ] as const).map(([id, Icon, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedTab(id)}
                      className={cn(
                        'flex h-11 flex-1 items-center justify-center gap-2 rounded-sm px-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-cyan-300/30',
                        selectedTab === id
                          ? 'bg-cyan-300/[0.12] text-cyan-100'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
                {selectedTab === 'overview' && <OverviewTab stats={classStats} />}
                {selectedTab === 'co' && <COTab stats={classStats} />}
                {selectedTab === 'ip' && <IPTab stats={classStats} />}
              </>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border border-dashed border-amber-300/20 bg-amber-300/[0.025] px-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-200" />
                <p className="mt-3 text-sm font-medium text-amber-100">
                  {classStats.dataStatus.configurationError
                    ? '课程配置尚未就绪，暂不形成班级达成结论'
                    : '当前版本记录尚不完整，暂不形成班级达成结论'}
                </p>
                <p className="mt-1 max-w-xl text-xs leading-5 text-slate-400">
                  {classStats.dataStatus.configurationError
                    ? '请先完成课程目标配置；配置检查通过后，系统才会开放“核对并重新计算”。'
                    : '旧配置结果已隔离。请核对上方班级和学期，再使用“核对并重新计算”补齐当前版本记录。'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {classStats.dataStatus.configurationError && (
                    <Link
                      href="/obe/teacher/objectives"
                      className="inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-xs text-cyan-100 hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                    >
                      检查课程目标配置
                    </Link>
                  )}
                  <Link
                    href="/teacher/classes"
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-xs text-slate-200 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                  >
                    核对班级与学生
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function AchievementDataStatusPanel({ stats }: { stats: ClassStats }) {
  const { dataStatus } = stats;
  const course = dataStatus.courseObjectives;
  const indicators = dataStatus.indicatorPoints;
  const staleRecords = course.staleRecords + indicators.staleRecords;
  const courseStatus = formatTeacherExpectedRecordStatus(
    course.freshRecords,
    course.expectedRecords,
    course.missingRecords,
  );
  const indicatorStatus = formatTeacherExpectedRecordStatus(
    indicators.freshRecords,
    indicators.expectedRecords,
    indicators.missingRecords,
  );
  return (
    <section
      aria-label="当前达成度数据状态"
      className={cn(
        'rounded-md border p-4',
        dataStatus.configurationError
          ? 'border-red-300/20 bg-red-300/[0.04]'
          : dataStatus.complete
          ? 'border-emerald-300/20 bg-emerald-300/[0.04]'
          : 'border-amber-300/20 bg-amber-300/[0.04]',
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className={cn(
            'flex items-center gap-2 text-sm font-medium',
            dataStatus.configurationError
              ? 'text-red-100'
              : dataStatus.complete ? 'text-emerald-100' : 'text-amber-100',
          )}>
            {dataStatus.configurationError
              ? <XCircle className="h-4 w-4" />
              : dataStatus.complete
              ? <CheckCircle2 className="h-4 w-4" />
              : <AlertTriangle className="h-4 w-4" />}
            {dataStatus.configurationError
              ? '课程配置暂不可计算'
              : dataStatus.complete ? '当前配置结果完整' : '当前配置结果待补齐'}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {stats.className} · {stats.semester} · {stats.studentCount} 名有效学生
          </p>
          {dataStatus.configurationError && (
            <p role="alert" className="mt-2 max-w-3xl text-xs leading-5 text-red-200">
              {dataStatus.configurationError}。修正课程目标配置后重新加载，系统才会开放重算。
            </p>
          )}
        </div>
        <div className="text-left text-[11px] leading-5 text-slate-500 md:text-right">
          <div>数据版本 {dataStatus.configurationRevision.slice(0, 10)}</div>
          <div>最近当前版本计算：{formatDateTime(dataStatus.lastCalculatedAt)}</div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <StatusMetric
          label="课程目标记录"
          value={courseStatus.value}
          detail={courseStatus.detail}
        />
        <StatusMetric
          label="指标点记录"
          value={indicatorStatus.value}
          detail={indicatorStatus.detail}
        />
        <StatusMetric
          label="已隔离旧记录"
          value={String(staleRecords)}
          detail={staleRecords > 0 ? '不参与当前结果' : '当前没有旧版本记录'}
        />
      </div>
    </section>
  );
}

function StudentAchievementStatusPanel({
  stats,
  busy,
  onCalculate,
}: {
  stats: ClassStats;
  busy: boolean;
  onCalculate: (userId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
  const completedCount = stats.students.filter((student) => student.complete).length;
  const incompleteCount = stats.students.length - completedCount;
  const configurationBlocked = Boolean(stats.dataStatus.configurationError);
  const visibleStudents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return stats.students.filter((student) => {
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'complete' ? student.complete : !student.complete);
      const matchesQuery = !normalizedQuery
        || `${student.name} ${student.studentCode ?? ''}`.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, stats.students, statusFilter]);

  return (
    <section aria-labelledby="student-review-title" className="rounded-md border border-white/[0.08] bg-white/[0.025] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="student-review-title" className="text-sm font-medium text-slate-100">学生复核状态</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            逐人核对当前配置记录；单人重算只影响所选学生，提交前仍需再次确认。
          </p>
        </div>
        <div className="text-xs text-slate-500">
          已完整 {completedCount}/{stats.students.length} 人
        </div>
      </div>
      {stats.students.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-slate-500">
          当前班级没有可复核的有效学生
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 rounded-md border border-white/[0.07] bg-black/10 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="student-review-search" className="mb-1.5 block text-xs text-slate-400">搜索学生姓名或学号</label>
              <input
                id="student-review-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入姓名或学号"
                className="h-11 w-full rounded-md border border-white/[0.1] bg-black/20 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/20"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="学生记录状态筛选">
              {([
                ['all', `全部 ${stats.students.length}`],
                ['incomplete', `${configurationBlocked ? '配置待处理' : '待补齐'} ${incompleteCount}`],
                ['complete', `已完整 ${completedCount}`],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    'min-h-11 rounded-md border px-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-cyan-300/30',
                    statusFilter === value
                      ? 'border-cyan-300/30 bg-cyan-300/[0.12] text-cyan-100'
                      : 'border-white/[0.1] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visibleStudents.length === 0 && (
            <div className="rounded-md border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-slate-500" role="status">
              没有符合当前搜索和状态筛选的学生
            </div>
          )}
          {visibleStudents.map((student) => {
            const expectedCO = student.freshCourseObjectiveRecords + student.missingCourseObjectiveRecords;
            const expectedIP = student.freshIndicatorRecords + student.missingIndicatorRecords;
            const staleRecords = student.staleCourseObjectiveRecords + student.staleIndicatorRecords;
            return (
              <article
                key={student.userId}
                className={cn(
                  'rounded-md border p-3',
                  student.complete
                    ? 'border-emerald-300/15 bg-emerald-300/[0.025]'
                    : 'border-amber-300/20 bg-amber-300/[0.035]',
                )}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-100">{student.name}</span>
                      {student.studentCode && (
                        <span className="font-mono text-[11px] text-slate-500">{student.studentCode}</span>
                      )}
                      <span className={cn(
                        'rounded-sm border px-2 py-0.5 text-[10px]',
                        student.complete
                          ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200'
                          : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-200',
                      )}>
                        {student.complete ? '当前记录完整' : configurationBlocked ? '等待课程配置' : '当前记录待补齐'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-5 text-slate-400">
                      <span>课程目标 {expectedCO === 0 ? '尚未配置' : `${student.freshCourseObjectiveRecords}/${expectedCO}`}</span>
                      <span>指标点 {expectedIP === 0 ? '尚未配置' : `${student.freshIndicatorRecords}/${expectedIP}`}</span>
                      <span>{staleRecords > 0 ? `已隔离旧记录 ${staleRecords} 条` : '无旧版本记录'}</span>
                      <span>最近计算：{formatDateTime(student.lastCalculatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      aria-label={`仅重算 ${student.name}`}
                      onClick={() => onCalculate(student.userId)}
                      disabled={busy || Boolean(stats.dataStatus.configurationError)}
                      title={stats.dataStatus.configurationError ?? undefined}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-3 text-xs text-cyan-100 transition hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Calculator className="h-3.5 w-3.5" />
                      仅重算该学生
                    </button>
                    {student.complete ? (
                      <Link
                        href={`/teacher?${new URLSearchParams({
                          student: student.userId,
                          action: 'intervene',
                          topic: ADDRESSING_TOPIC_ID,
                          returnTo: `/obe/teacher?${new URLSearchParams({
                            classId: stats.classId,
                            semester: stats.semester,
                          }).toString()}`,
                        }).toString()}`}
                        aria-label={`为 ${student.name} 补充干预`}
                        className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.1] px-3 text-xs text-slate-300 transition hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                      >
                        补充干预
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        aria-label={`${student.name} 的记录待补齐，暂不能补充干预`}
                        title="先重算并补齐该学生当前记录，再根据达成结果决定是否干预"
                        className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-md border border-amber-300/15 bg-amber-300/[0.035] px-3 text-xs text-amber-100/60"
                      >
                        记录补齐后再干预
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-black/10 p-3">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg text-slate-100">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{detail}</div>
    </div>
  );
}

function CalculationReviewPanel({
  review,
  calculating,
  onCancel,
  onConfirm,
}: {
  review: CalculationReview;
  calculating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const targetStudent = review.mode === 'user' ? review.students[0] : null;

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      role="dialog"
      aria-labelledby="calculation-review-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !calculating) {
          event.preventDefault();
          onCancel();
        }
      }}
      className="mb-5 rounded-md border border-cyan-300/25 bg-[#0b151b] p-4 shadow-2xl shadow-black/30"
    >
      <div className="flex items-start gap-3">
        <Calculator className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <h2
            ref={titleRef}
            id="calculation-review-title"
            tabIndex={-1}
            className="text-sm font-semibold text-slate-100 outline-none"
          >
            {review.mode === 'user' ? '提交前核对单名学生' : '提交前核对计算范围'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            本次范围已绑定当前课程目标配置和有效学生名单；确认后若任一范围发生变化，服务端会停止沿用本次确认。
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatusMetric label="班级" value={review.className} detail={review.semester} />
        <StatusMetric
          label={review.mode === 'user' ? '目标学生' : '有效学生'}
          value={targetStudent?.name ?? String(review.targetCount)}
          detail={targetStudent?.studentCode ?? `名单范围 ${review.scopeRevision.slice(0, 10)}`}
        />
        <StatusMetric label="课程目标" value={String(review.objectiveCount)} detail={`需写入 ${review.expectedCourseObjectiveRecords} 条`} />
        <StatusMetric label="指标点" value={String(review.indicatorPointCount)} detail={`需写入 ${review.expectedIndicatorRecords} 条`} />
      </div>
      <div className="mt-3 rounded-md border border-white/[0.07] bg-white/[0.025] p-3 text-xs leading-5 text-slate-400">
        <p>
          当前版本已有课程目标记录 {review.currentCourseObjectiveRecords}/{review.expectedCourseObjectiveRecords} 条，
          指标点记录 {review.currentIndicatorRecords}/{review.expectedIndicatorRecords} 条。
        </p>
        <p className="mt-1">
          已识别旧配置记录 {review.staleCourseObjectiveRecords + review.staleIndicatorRecords} 条；这些记录不会参与当前看板。
          {review.mode === 'user'
            ? '本次只更新所选学生在当前班级、当前学期的结果，不影响其他学生。'
            : '本次计算将按服务端测评、实验和学习记录更新同班级、同学期结果。'}
        </p>
        <p className="mt-1 text-slate-500">
          配置更新时间：{formatDateTime(review.configurationUpdatedAt)} · 数据版本 {review.configurationRevision.slice(0, 10)}
        </p>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={calculating}
          className="inline-flex h-11 items-center justify-center rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-40"
        >
          取消，不改变现有结果
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={calculating}
          aria-busy={calculating}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.1] px-4 text-sm text-cyan-100 hover:bg-cyan-300/[0.16] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:opacity-40"
        >
          {calculating ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Calculator aria-hidden="true" className="h-4 w-4" />}
          {calculating ? '正在按此范围计算…' : '确认按此范围计算'}
        </button>
      </div>
    </section>
  );
}

// -- Overview Tab -----------------------------------------------------------

function OverviewTab({ stats }: { stats: ClassStats }) {
  const totalCOs = stats.averageAchievementByCO.length;
  const passedCOs = stats.averageAchievementByCO.filter((c) => c.avg >= 0.65).length;
  const totalIPs = stats.averageAchievementByIP.length;
  const passedIPs = stats.averageAchievementByIP.filter((i) => i.avg >= 0.65).length;

  return (
    <div className="space-y-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([
          ['课程目标', `${passedCOs}/${totalCOs}`, passedCOs >= totalCOs * 0.6 ? 'text-emerald-300' : 'text-amber-300', BookOpen],
          ['指标点', `${passedIPs}/${totalIPs}`, passedIPs >= totalIPs * 0.6 ? 'text-emerald-300' : 'text-amber-300', Target],
          ['学生数', String(stats.studentCount), 'text-cyan-200', BarChart4],
          ['CO达成率', `${totalCOs > 0 ? Math.round((passedCOs / totalCOs) * 100) : 0}%`, 'text-slate-50', CheckCircle2],
        ] as const).map(([label, value, color, Icon]) => (
          <div key={label} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
            <Icon className="h-4 w-4 text-cyan-200" />
            <div className={cn('mt-3 font-mono text-2xl font-semibold', color)}>{value}</div>
            <div className="text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Bar Chart: CO Achievement */}
      {stats.averageAchievementByCO.length > 0 && (
        <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <BarChart4 className="h-3.5 w-3.5" />
            课程目标平均达成度
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.averageAchievementByCO.map((c) => ({
              name: c.coCode,
              value: Math.round(c.avg * 100),
              passRate: Math.round(c.passRate * 100),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={MOCHA.surface0} />
              <XAxis dataKey="name" tick={{ fill: MOCHA.subtext0, fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: MOCHA.overlay1, fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: MOCHA.text, fontSize: 12 }}
                formatter={(v: number, n: string) => [`${v}%`, n === 'value' ? '平均达成度' : '通过率']}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={48}>
                {stats.averageAchievementByCO.map((c, i) => (
                  <Cell key={i} fill={c.avg >= 0.65 ? MOCHA.green : c.avg >= 0.4 ? MOCHA.amber : MOCHA.red} />
                ))}
              </Bar>
              <Bar dataKey="passRate" radius={[3, 3, 0, 0]} maxBarSize={48} fillOpacity={0.4}>
                {stats.averageAchievementByCO.map((_, i) => (
                  <Cell key={i} fill={MOCHA.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// -- CO Tab -----------------------------------------------------------------

function COTab({ stats }: { stats: ClassStats }) {
  return (
    <div className="space-y-3">
      {stats.averageAchievementByCO.length === 0 ? (
        <div className="py-12 text-center text-sm text-slate-500">暂无数据，请先计算达成度</div>
      ) : (
        stats.averageAchievementByCO.map((co) => (
          <div key={co.coCode} className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {co.avg >= 0.65 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-cyan-200">{co.coCode}</span>
                    <span className="text-sm font-medium text-slate-200">{co.coName}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  'font-mono text-lg font-semibold',
                  co.avg >= 0.65 ? 'text-emerald-300' : co.avg >= 0.4 ? 'text-amber-300' : 'text-red-300',
                )}>
                  {Math.round(co.avg * 100)}%
                </div>
                <div className="text-[10px] text-slate-500">通过率 {Math.round(co.passRate * 100)}%</div>
              </div>
            </div>
            <div className="relative mt-3 h-2 overflow-hidden rounded-sm bg-white/[0.08]">
              <div
                className={cn(
                  'h-full rounded-sm transition-all',
                  co.avg >= 0.65 ? 'bg-emerald-300' : co.avg >= 0.4 ? 'bg-amber-300' : 'bg-red-300',
                )}
                style={{ width: `${Math.round(co.avg * 100)}%` }}
              />
              <div className="absolute top-0 h-2 w-px bg-amber-300/60" style={{ left: '65%' }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// -- IP Tab -----------------------------------------------------------------

function IPTab({ stats }: { stats: ClassStats }) {
  const weakIPs = stats.averageAchievementByIP.filter((ip) => ip.avg < 0.65);
  const strongIPs = stats.averageAchievementByIP.filter((ip) => ip.avg >= 0.65);

  return (
    <div className="space-y-5">
      {weakIPs.length > 0 && (
        <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            未达标指标点 ({weakIPs.length})
          </div>
          <div className="space-y-2">
            {weakIPs.map((ip) => (
              <div key={ip.ipCode} className="flex items-center justify-between rounded-sm bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-300" />
                  <span className="font-mono text-xs text-slate-500">{ip.ipCode}</span>
                  <span className="text-sm text-slate-300">{ip.ipName}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-red-300">{Math.round(ip.avg * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {strongIPs.length > 0 && (
        <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.04] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            已达标指标点 ({strongIPs.length})
          </div>
          <div className="space-y-2">
            {strongIPs.map((ip) => (
              <div key={ip.ipCode} className="flex items-center justify-between rounded-sm bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="font-mono text-xs text-slate-500">{ip.ipCode}</span>
                  <span className="text-sm text-slate-300">{ip.ipName}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-emerald-300">{Math.round(ip.avg * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.averageAchievementByIP.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500">暂无数据</div>
      )}
    </div>
  );
}

// -- Helpers ----------------------------------------------------------------

function aggregateCO(achievements: any[]): COStats[] {
  const map = new Map<string, { code: string; name: string; sum: number; passed: number; total: number }>();
  for (const a of achievements) {
    const key = a.courseObjectiveId;
    const ex = map.get(key) || {
      code: a.courseObjective?.code ?? '',
      name: a.courseObjective?.name ?? '',
      sum: 0,
      passed: 0,
      total: 0,
    };
    ex.sum += a.achievementDegree ?? 0;
    if (a.passed) ex.passed++;
    ex.total++;
    map.set(key, ex);
  }
  return [...map.values()].map((v) => ({
    coCode: v.code,
    coName: v.name,
    avg: v.total > 0 ? v.sum / v.total : 0,
    passRate: v.total > 0 ? v.passed / v.total : 0,
  }));
}

function aggregateGR(achievements: any[]): IPStats[] {
  const map = new Map<string, { code: string; name: string; sum: number; passed: number; total: number }>();
  for (const a of achievements) {
    const key = a.indicatorPointId;
    const ex = map.get(key) || {
      code: a.indicatorPoint?.code ?? '',
      name: a.indicatorPoint?.description ?? '',
      sum: 0,
      passed: 0,
      total: 0,
    };
    ex.sum += a.achievementDegree ?? 0;
    if (a.passed) ex.passed++;
    ex.total++;
    map.set(key, ex);
  }
  return [...map.values()].map((v) => ({
    ipCode: v.code,
    ipName: v.name,
    avg: v.total > 0 ? v.sum / v.total : 0,
    passRate: v.total > 0 ? v.passed / v.total : 0,
  }));
}
