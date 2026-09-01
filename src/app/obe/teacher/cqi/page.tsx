'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Send,
  ShieldCheck,
  Target,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  CLIENT_READ_TIMEOUT_MS,
  CLIENT_WRITE_TIMEOUT_MS,
  fetchClientRequest,
  isAmbiguousClientFailure,
} from '@/lib/client-fetch';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ActionItem {
  id: string;
  description: string;
  category: string;
  assignedTo?: string | null;
  dueDate?: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | string;
  result?: string | null;
}

interface DataProvenance {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
}

type SnapshotFreshness = 'CURRENT' | 'HISTORICAL' | 'UNAVAILABLE';

interface ReportSourceSummary {
  actualRecords: number | null;
  expectedRecords: number | null;
  totalStudents: number;
  passedStudents: number;
  totalIndicators: number | null;
  passedIndicators: number | null;
  averageAchievement: number | null;
  passRate: number | null;
  configurationUpdatedAt: string | null;
}

interface ReportSnapshot {
  freshness: SnapshotFreshness;
  sourceDigest: string | null;
  currentSourceDigest: string | null;
  sourceCutoff: string | null;
  sourceSummary: ReportSourceSummary;
  currentDataStatus: {
    dataSufficient: boolean;
    actualRecords: number;
    expectedRecords: number;
    totalStudents: number;
    totalIndicators: number;
  } | null;
  note: string;
}

interface CQIReport {
  id: string;
  semester: string;
  classId?: string | null;
  title: string;
  reportType: string;
  targetCode?: string | null;
  averageAchievement?: number | null;
  passRate?: number | null;
  totalStudents: number;
  passedStudents: number;
  weakPoints?: string | null;
  strengths?: string | null;
  improvementMeasures?: string | null;
  status: 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'CLOSED' | string;
  actionItems: ActionItem[];
  createdAt: string;
  snapshot?: unknown;
}

interface TeacherClass {
  id: string;
  name: string;
  semester?: string | null;
  _count?: { enrollments: number };
}

interface TeacherOption {
  id: string;
  name?: string | null;
  username: string;
}

interface ActionDraft {
  description: string;
  category: string;
  dueDate: string;
  assignedTo: string;
}

interface AnalysisPoint {
  code?: string;
  name?: string;
  avgAchievement?: number;
  threshold?: number;
}

interface ImprovementMeasure {
  measure?: string;
}

interface ActionCompletionResult {
  summary: string;
  evidenceReference: string;
  evidenceComplete: boolean;
  legacy: boolean;
}

interface CompletionEvidenceInput {
  resultSummary: string;
  evidenceReference: string;
}

interface WriteRequestSnapshot {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body: string;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  referrerPolicy?: ReferrerPolicy;
  integrity?: string;
  keepalive?: boolean;
  mode?: RequestMode;
}

interface WriteResolutionContext {
  manualRetry: boolean;
}

interface PendingWriteOperation {
  key: string;
  label: string;
  request: WriteRequestSnapshot;
  onResponse: (response: Response, context: WriteResolutionContext) => Promise<void>;
}

type CQIConfirmation =
  | { kind: 'generate'; title: string; description: string; consequence: string }
  | {
    kind: 'complete-action';
    title: string;
    description: string;
    consequence: string;
    report: CQIReport;
    action: ActionItem;
    evidenceOnly: boolean;
    resultSummary: string;
    evidenceReference: string;
  }
  | { kind: 'transition-report'; title: string; description: string; consequence: string; report: CQIReport };

const CATEGORY_LABELS: Record<string, string> = {
  CONTENT: '教学内容',
  METHOD: '教学方法',
  RESOURCE: '教学资源',
  ASSESSMENT: '考核方式',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  REVIEWED: '待批准',
  APPROVED: '执行中',
  CLOSED: '已关闭',
};

const ACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
};

const ACTION_RESULT_SCHEMA = 'CQI_ACTION_RESULT_V1';
const RESULT_SUMMARY_MIN_LENGTH = 5;
const RESULT_SUMMARY_MAX_LENGTH = 1000;
const EVIDENCE_REFERENCE_MAX_LENGTH = 500;
const PLATFORM_RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const GENERIC_RESULT_SUMMARY_PATTERN = /^(完成|已完成|处理完成|任务已完成|改进项已完成)[。！!]?$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function unavailableSnapshot(note = '快照信息缺失或无效，不能确认该报告为当前版本。'): ReportSnapshot {
  return {
    freshness: 'UNAVAILABLE',
    sourceDigest: null,
    currentSourceDigest: null,
    sourceCutoff: null,
    sourceSummary: {
      actualRecords: null,
      expectedRecords: null,
      totalStudents: 0,
      passedStudents: 0,
      totalIndicators: null,
      passedIndicators: null,
      averageAchievement: null,
      passRate: null,
      configurationUpdatedAt: null,
    },
    currentDataStatus: null,
    note,
  };
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function parseReportSnapshot(value: unknown): ReportSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailableSnapshot();
  const source = value as Record<string, unknown>;
  const freshness = source.freshness;
  if (freshness !== 'CURRENT' && freshness !== 'HISTORICAL' && freshness !== 'UNAVAILABLE') {
    return unavailableSnapshot();
  }
  const summaryValue = source.sourceSummary;
  const summary = summaryValue && typeof summaryValue === 'object' && !Array.isArray(summaryValue)
    ? summaryValue as Record<string, unknown>
    : {};
  const actualRecords = nonNegativeInteger(summary.actualRecords);
  const expectedRecords = nonNegativeInteger(summary.expectedRecords);
  const sourceDigest = typeof source.sourceDigest === 'string' && SHA256_PATTERN.test(source.sourceDigest)
    ? source.sourceDigest
    : null;
  const sourceCutoff = typeof source.sourceCutoff === 'string' && !Number.isNaN(Date.parse(source.sourceCutoff))
    ? source.sourceCutoff
    : null;
  if (freshness === 'CURRENT' && (!sourceDigest || !sourceCutoff || actualRecords === null || expectedRecords === null)) {
    return unavailableSnapshot('服务端返回的当前快照缺少有效源摘要或生成截止信息，已降级为只读。');
  }
  const currentStatusValue = source.currentDataStatus;
  const currentStatus = currentStatusValue && typeof currentStatusValue === 'object' && !Array.isArray(currentStatusValue)
    ? currentStatusValue as Record<string, unknown>
    : null;
  const parsedCurrentStatus = currentStatus
    && typeof currentStatus.dataSufficient === 'boolean'
    && nonNegativeInteger(currentStatus.actualRecords) !== null
    && nonNegativeInteger(currentStatus.expectedRecords) !== null
    && nonNegativeInteger(currentStatus.totalStudents) !== null
    && nonNegativeInteger(currentStatus.totalIndicators) !== null
    ? {
      dataSufficient: currentStatus.dataSufficient,
      actualRecords: currentStatus.actualRecords as number,
      expectedRecords: currentStatus.expectedRecords as number,
      totalStudents: currentStatus.totalStudents as number,
      totalIndicators: currentStatus.totalIndicators as number,
    }
    : null;
  return {
    freshness,
    sourceDigest,
    currentSourceDigest: typeof source.currentSourceDigest === 'string'
      && SHA256_PATTERN.test(source.currentSourceDigest) ? source.currentSourceDigest : null,
    sourceCutoff,
    sourceSummary: {
      actualRecords,
      expectedRecords,
      totalStudents: nonNegativeInteger(summary.totalStudents) ?? 0,
      passedStudents: nonNegativeInteger(summary.passedStudents) ?? 0,
      totalIndicators: nonNegativeInteger(summary.totalIndicators),
      passedIndicators: nonNegativeInteger(summary.passedIndicators),
      averageAchievement: nullableNumber(summary.averageAchievement),
      passRate: nullableNumber(summary.passRate),
      configurationUpdatedAt: typeof summary.configurationUpdatedAt === 'string'
        ? summary.configurationUpdatedAt : null,
    },
    currentDataStatus: parsedCurrentStatus,
    note: typeof source.note === 'string' && source.note.trim()
      ? source.note.trim()
      : freshness === 'CURRENT'
        ? '该报告与当前服务端达成度源摘要一致。'
        : '该报告不能作为当前快照继续操作。',
  };
}

function isCurrentReportSnapshot(report: CQIReport): boolean {
  return parseReportSnapshot(report.snapshot).freshness === 'CURRENT';
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatSnapshotCutoff(value: string | null): string {
  if (!value) return '未留存';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '未留存' : date.toLocaleString('zh-CN');
}

function defaultDueDate(): string {
  const due = new Date();
  due.setDate(due.getDate() + 30);
  return formatDateInput(due);
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

function emptyActionDraft(assignedTo = ''): ActionDraft {
  return {
    description: '',
    category: 'METHOD',
    dueDate: defaultDueDate(),
    assignedTo,
  };
}

function parseArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function isValidEvidenceReference(value: string): boolean {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > EVIDENCE_REFERENCE_MAX_LENGTH) return false;
  if (/\s/.test(normalized)) return false;
  if (PLATFORM_RECORD_ID_PATTERN.test(normalized)) return true;
  if (normalized.startsWith('/') && !normalized.startsWith('//')) {
    try {
      const url = new URL(normalized, 'https://platform.invalid');
      return url.origin === 'https://platform.invalid';
    } catch {
      return false;
    }
  }
  try {
    const url = new URL(normalized);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isValidResultSummary(value: string): boolean {
  const normalized = value.trim();
  return normalized.length >= RESULT_SUMMARY_MIN_LENGTH
    && normalized.length <= RESULT_SUMMARY_MAX_LENGTH
    && !GENERIC_RESULT_SUMMARY_PATTERN.test(normalized);
}

function isCompletionEvidenceValid(input: CompletionEvidenceInput): boolean {
  return isValidResultSummary(input.resultSummary)
    && isValidEvidenceReference(input.evidenceReference);
}

function parseActionCompletionResult(value: string | null | undefined): ActionCompletionResult | null {
  const raw = value?.trim() ?? '';
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result = parsed as Record<string, unknown>;
      if (result.schema === ACTION_RESULT_SCHEMA && typeof result.summary === 'string') {
        const summary = result.summary.trim();
        const evidenceReference = typeof result.evidenceReference === 'string'
          ? result.evidenceReference.trim()
          : '';
        return {
          summary,
          evidenceReference,
          evidenceComplete: isValidResultSummary(summary)
            && isValidEvidenceReference(evidenceReference),
          legacy: false,
        };
      }
    }
  } catch {
    // Legacy result values were stored as plain strings. Keep them readable as summaries.
  }
  return {
    summary: raw,
    evidenceReference: '',
    evidenceComplete: false,
    legacy: true,
  };
}

function actionHasCompleteEvidence(action: ActionItem): boolean {
  return action.status === 'COMPLETED'
    && Boolean(parseActionCompletionResult(action.result)?.evidenceComplete);
}

function isEvidenceLink(value: string): boolean {
  return value.startsWith('/') || /^https?:\/\//i.test(value);
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

function dataUseBoundary(mode: DataProvenance['mode']): string {
  if (mode === 'REAL') return '仅限当前授权班级与报告学期使用；未采集项目不得推定为已完成。';
  if (mode === 'MIXED') return '须按真实记录与演示记录分别解释，不形成未经区分的改进成效结论。';
  return '仅用于验证持续改进流程与界面，不用于证明真实教学成效。';
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
            ? '核验通过前不展示报告成效数值，也不开放报告生成。'
            : '报告成效数值已停止展示，报告生成已锁定。请重试，必要时重新登录。'}
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

async function responseError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error.trim()) return body.error;
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // Use the stable fallback when the response is not JSON.
  }
  return fallback;
}

function snapshotWriteRequest(url: string, init: RequestInit): WriteRequestSnapshot {
  if (typeof init.body !== 'string') {
    throw new Error('写操作请求体无法安全重放');
  }
  return {
    url,
    method: init.method ?? 'POST',
    headers: Array.from(new Headers(init.headers).entries()),
    body: init.body,
    credentials: init.credentials,
    cache: init.cache,
    redirect: init.redirect,
    referrer: init.referrer,
    referrerPolicy: init.referrerPolicy,
    integrity: init.integrity,
    keepalive: init.keepalive,
    mode: init.mode,
  };
}

function executeWriteRequest(request: WriteRequestSnapshot): Promise<Response> {
  return fetchClientRequest(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    integrity: request.integrity,
    keepalive: request.keepalive,
    mode: request.mode,
  }, CLIENT_WRITE_TIMEOUT_MS);
}

async function writeWithReplay(request: WriteRequestSnapshot): Promise<Response> {
  const execute = () => executeWriteRequest(request);
  try {
    return await execute();
  } catch (error) {
    if (!isAmbiguousClientFailure(error)) throw error;
    return execute();
  }
}

export default function CQIPage() {
  return <CQIDashboard />;
}

function CQIDashboard() {
  const { user, loading: authLoading, logout } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [semester, setSemester] = useState(currentSemester());
  const [reports, setReports] = useState<CQIReport[]>([]);
  const [dataProvenance, setDataProvenance] = useState<DataProvenance | null>(null);
  const [scopeReloadKey, setScopeReloadKey] = useState(0);
  const [loadingScope, setLoadingScope] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [newAction, setNewAction] = useState<Record<string, ActionDraft>>({});
  const [busyKeys, setBusyKeys] = useState<string[]>([]);
  const [pendingWrite, setPendingWrite] = useState<{ key: string; label: string } | null>(null);
  const [retryingPendingWrite, setRetryingPendingWrite] = useState(false);
  const [confirmation, setConfirmation] = useState<CQIConfirmation | null>(null);
  const operationLocks = useRef(new Set<string>());
  const pendingWriteRef = useRef<PendingWriteOperation | null>(null);
  const reportsAbortRef = useRef<AbortController | null>(null);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );

  const startOperation = (key: string): boolean => {
    if (operationLocks.current.size > 0) return false;
    operationLocks.current.add(key);
    setBusyKeys((current) => current.includes(key) ? current : [...current, key]);
    return true;
  };

  const endOperation = (key: string): void => {
    operationLocks.current.delete(key);
    setBusyKeys((current) => current.filter((item) => item !== key));
  };

  const executeTrackedWrite = async (operation: PendingWriteOperation): Promise<'RESOLVED' | 'PENDING'> => {
    let response: Response;
    try {
      response = await writeWithReplay(operation.request);
    } catch (writeError) {
      if (!isAmbiguousClientFailure(writeError)) throw writeError;
      pendingWriteRef.current = operation;
      setPendingWrite({ key: operation.key, label: operation.label });
      setError(
        `“${operation.label}”的服务端结果暂未确认，操作可能已经生效。为避免重复创建，其他写操作已锁定；请使用原请求核对/重试。`,
      );
      return 'PENDING';
    }
    await operation.onResponse(response, { manualRetry: false });
    return 'RESOLVED';
  };

  const handleRetryPendingWrite = async (): Promise<void> => {
    const operation = pendingWriteRef.current;
    if (!operation || retryingPendingWrite) return;
    setRetryingPendingWrite(true);
    setError(null);
    setNotice(null);
    try {
      let response: Response;
      try {
        // A manual retry intentionally sends the stored snapshot once. If the
        // result is still ambiguous, the same snapshot remains available.
        response = await executeWriteRequest(operation.request);
      } catch (writeError) {
        if (!isAmbiguousClientFailure(writeError)) throw writeError;
        setError(
          `“${operation.label}”的结果仍未确认。当前操作继续保持锁定，请稍后再次使用原请求核对/重试。`,
        );
        return;
      }

      await operation.onResponse(response, { manualRetry: true });
      pendingWriteRef.current = null;
      setPendingWrite(null);
      endOperation(operation.key);
    } catch (retryError) {
      pendingWriteRef.current = null;
      setPendingWrite(null);
      endOperation(operation.key);
      console.error('Resolve pending CQI write failed:', retryError);
      setError(retryError instanceof Error ? retryError.message : `${operation.label}失败`);
    } finally {
      setRetryingPendingWrite(false);
    }
  };

  useEffect(() => {
    if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      setLoadingScope(false);
      return;
    }
    const controller = new AbortController();
    setLoadingScope(true);
    setError(null);
    void (async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) throw new Error('登录状态已失效，请重新登录');
        const headers = { Authorization: `Bearer ${token}` };
        const requests: Promise<Response>[] = [
          fetchClientRequest('/api/classes?status=ACTIVE', {
            headers,
            signal: controller.signal,
          }, CLIENT_READ_TIMEOUT_MS),
        ];
        if (user.role === 'ADMIN') {
          requests.push(fetchClientRequest(
            '/api/users?role=TEACHER&status=ACTIVE&limit=100&fields=id,name,username&sortBy=name&sortOrder=asc',
            { headers, signal: controller.signal },
            CLIENT_READ_TIMEOUT_MS,
          ));
        }
        const [classesResponse, teachersResponse] = await Promise.all(requests);
        if (classesResponse.status === 401 || teachersResponse?.status === 401) {
          await logout();
          return;
        }
        if (!classesResponse.ok) throw new Error(await responseError(classesResponse, '加载班级失败'));
        if (teachersResponse && !teachersResponse.ok) {
          throw new Error(await responseError(teachersResponse, '加载责任教师失败'));
        }
        const classBody = await classesResponse.json() as { classes?: TeacherClass[] };
        const availableClasses = Array.isArray(classBody.classes) ? classBody.classes : [];
        const teacherBody = teachersResponse
          ? await teachersResponse.json() as { data?: TeacherOption[] }
          : { data: [] };
        const availableTeachers = Array.isArray(teacherBody.data) ? teacherBody.data : [];
        if (controller.signal.aborted) return;
        setClasses(availableClasses);
        setTeachers(availableTeachers);
        setSelectedClassId((current) => {
          if (availableClasses.some((item) => item.id === current)) return current;
          const requestedClassId = new URLSearchParams(window.location.search).get('classId')?.trim() ?? '';
          return availableClasses.some((item) => item.id === requestedClassId)
            ? requestedClassId
            : availableClasses[0]?.id ?? '';
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('Failed to load CQI scope:', err);
        setClasses([]);
        setTeachers([]);
        setSelectedClassId('');
        setReports([]);
        setDataProvenance(null);
        setError(err instanceof Error ? err.message : '加载持续改进范围失败');
      } finally {
        if (!controller.signal.aborted) setLoadingScope(false);
      }
    })();
    return () => controller.abort();
  }, [logout, scopeReloadKey, user]);

  useEffect(() => {
    if (!selectedClass) return;
    const params = new URLSearchParams(window.location.search);
    const requestedSemester = params.get('classId') === selectedClass.id
      ? params.get('semester')
      : null;
    setSemester(validSemester(requestedSemester)
      ? requestedSemester
      : validSemester(selectedClass.semester) ? selectedClass.semester : currentSemester());
    setNotice(null);
    setExpandedReport(null);
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedClassId || !validSemester(semester)) return;
    const url = new URL(window.location.href);
    url.searchParams.set('classId', selectedClassId);
    url.searchParams.set('semester', semester);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState({}, '', nextUrl);
  }, [selectedClassId, semester]);

  const fetchReports = useCallback(async () => {
    if (!user || !selectedClassId) {
      setReports([]);
      setDataProvenance(null);
      setLoadingReports(false);
      return;
    }
    reportsAbortRef.current?.abort();
    const controller = new AbortController();
    reportsAbortRef.current = controller;
    setLoadingReports(true);
    setReports([]);
    setDataProvenance(null);
    setError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const query = new URLSearchParams({ classId: selectedClassId });
      const response = await fetchClientRequest(`/api/obe/cqi/reports?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }, CLIENT_READ_TIMEOUT_MS);
      if (response.status === 401) {
        await logout();
        return;
      }
      if (!response.ok) throw new Error(await responseError(response, '加载改进报告失败'));
      const body = await response.json() as { reports?: CQIReport[]; dataProvenance?: unknown };
      const provenance = parseDataProvenance(body.dataProvenance);
      if (!provenance) {
        throw new Error('持续改进报告缺少有效的服务端数据身份，已停止展示成效数值');
      }
      if (!controller.signal.aborted) {
        setDataProvenance(provenance);
        setReports(Array.isArray(body.reports) ? body.reports : []);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error('Failed to fetch CQI reports:', err);
      setReports([]);
      setDataProvenance(null);
      setError(err instanceof Error ? err.message : '加载改进报告失败');
    } finally {
      if (!controller.signal.aborted) setLoadingReports(false);
    }
  }, [logout, selectedClassId, user]);

  useEffect(() => {
    void fetchReports();
    return () => reportsAbortRef.current?.abort();
  }, [fetchReports]);

  const handleGenerateReport = async (confirmed = false) => {
    if (!selectedClass) return;
    if (!dataProvenance) {
      setError('服务端数据身份尚未通过核验，不能生成持续改进报告');
      return;
    }
    if (!validSemester(semester)) {
      setError('学期格式应为“起始年-结束年-1或2”');
      return;
    }
    if (!confirmed) {
      setConfirmation({
        kind: 'generate',
        title: '确认生成持续改进报告',
        description: `${selectedClass.name} · ${semester} · 指标点达成度报告`,
        consequence: '报告只采用服务端已保存的达成度记录；数据不足时不会生成，也不会用空值补齐结论。',
      });
      return;
    }
    const key = 'create-report';
    if (!startOperation(key)) return;
    let keepLocked = false;
    setError(null);
    setNotice(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const requestId = crypto.randomUUID();
      const request = snapshotWriteRequest('/api/obe/cqi/reports', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          semester,
          classId: selectedClass.id,
          title: `${selectedClass.name} ${semester} 指标点达成度分析报告`,
          reportType: 'INDICATOR',
        }),
      });
      const resolution = await executeTrackedWrite({
        key,
        label: '生成改进报告',
        request,
        onResponse: async (response, context) => {
          if (response.status === 401) {
            await logout();
            return;
          }
          if (!response.ok) throw new Error(await responseError(response, '生成改进报告失败'));
          const body = await response.json() as { duplicate?: boolean; report?: CQIReport };
          if (context.manualRetry) {
            setNotice(body.duplicate
              ? '已使用原请求核对：服务端已有对应源快照报告，未重复创建'
              : '已使用原请求完成报告生成，请补充责任行动后提交审阅');
          } else {
            setNotice(body.duplicate
              ? '当前达成度源摘要已有对应报告，已为你打开该版本'
              : '改进报告已生成，请补充责任行动后提交审阅');
          }
          if (body.report?.id) setExpandedReport(body.report.id);
          await fetchReports();
        },
      });
      keepLocked = resolution === 'PENDING';
    } catch (err) {
      console.error('Generate CQI report failed:', err);
      setError(err instanceof Error ? err.message : '生成改进报告失败');
    } finally {
      if (!keepLocked) endOperation(key);
    }
  };

  const handleAddAction = async (report: CQIReport) => {
    if (!isCurrentReportSnapshot(report)) {
      setError('该报告不是当前快照，已保持只读；请在当前快照中新增改进行动');
      return;
    }
    const key = `add:${report.id}`;
    const draft = newAction[report.id] ?? emptyActionDraft(teachers[0]?.id);
    if (!startOperation(key)) return;
    let keepLocked = false;
    setError(null);
    setNotice(null);
    try {
      const description = draft.description.trim();
      if (!description) throw new Error('请填写具体改进行动');
      if (!draft.dueDate) throw new Error('请选择责任期限');
      if (user?.role === 'ADMIN' && !draft.assignedTo) throw new Error('请选择责任教师');
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const request = snapshotWriteRequest(`/api/obe/cqi/reports/${encodeURIComponent(report.id)}/action-items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          description,
          category: draft.category,
          dueDate: draft.dueDate,
          ...(user?.role === 'ADMIN' ? { assignedTo: draft.assignedTo } : {}),
        }),
      });
      const resolution = await executeTrackedWrite({
        key,
        label: '新增改进项',
        request,
        onResponse: async (response, context) => {
          if (response.status === 401) {
            await logout();
            return;
          }
          if (!response.ok) throw new Error(await responseError(response, '新增改进项失败'));
          const body = await response.json() as { duplicate?: boolean };
          setNewAction((current) => ({
            ...current,
            [report.id]: emptyActionDraft(teachers[0]?.id),
          }));
          if (context.manualRetry) {
            setNotice(body.duplicate
              ? '已使用原请求核对：改进项已保存，未重复创建'
              : '已使用原请求完成改进项保存');
          } else {
            setNotice(body.duplicate ? '已恢复刚才提交的改进项，未重复创建' : '改进项已保存');
          }
          await fetchReports();
        },
      });
      keepLocked = resolution === 'PENDING';
    } catch (err) {
      console.error('Add CQI action failed:', err);
      setError(err instanceof Error ? err.message : '新增改进项失败');
    } finally {
      if (!keepLocked) endOperation(key);
    }
  };

  const handleUpdateActionStatus = async (
    report: CQIReport,
    action: ActionItem,
    confirmed = false,
    completionEvidence?: CompletionEvidenceInput,
  ) => {
    if (!isCurrentReportSnapshot(report)) {
      setError('该报告不是当前快照，已保持只读；请在当前快照中推进改进行动');
      return;
    }
    const storedResult = parseActionCompletionResult(action.result);
    const evidenceOnly = action.status === 'COMPLETED' && !storedResult?.evidenceComplete;
    const nextStatus = action.status === 'PENDING'
      ? 'IN_PROGRESS'
      : action.status === 'IN_PROGRESS' || evidenceOnly ? 'COMPLETED' : null;
    if (!nextStatus) return;
    if (nextStatus === 'COMPLETED' && !confirmed) {
      setConfirmation({
        kind: 'complete-action',
        title: evidenceOnly ? '补充改进行动完成证据' : '确认完成改进行动',
        description: action.description,
        consequence: evidenceOnly
          ? '旧记录的完成说明会保留为结果摘要；补齐有效证据后，管理员才可关闭报告。'
          : '确认后该行动不能退回“进行中”；结果摘要和证据引用将一并保存，供管理员关闭报告前复核。',
        report,
        action,
        evidenceOnly,
        resultSummary: storedResult?.summary ?? '',
        evidenceReference: storedResult?.evidenceReference ?? '',
      });
      return;
    }
    if (nextStatus === 'COMPLETED' && (!completionEvidence || !isCompletionEvidenceValid(completionEvidence))) {
      setError('请填写至少 5 个字的结果摘要，以及有效链接或平台记录编号');
      return;
    }
    const key = `action:${action.id}`;
    if (!startOperation(key)) return;
    let keepLocked = false;
    setError(null);
    setNotice(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const request = snapshotWriteRequest(`/api/obe/cqi/reports/${encodeURIComponent(report.id)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          actionItemId: action.id,
          expectedActionStatus: action.status,
          actionStatus: nextStatus,
          ...(nextStatus === 'COMPLETED' && completionEvidence ? {
            resultSummary: completionEvidence.resultSummary.trim(),
            evidenceReference: completionEvidence.evidenceReference.trim(),
          } : {}),
        }),
      });
      const resolution = await executeTrackedWrite({
        key,
        label: evidenceOnly
          ? '补充改进项完成证据'
          : nextStatus === 'COMPLETED' ? '标记改进项完成' : '开始执行改进项',
        request,
        onResponse: async (response, context) => {
          if (response.status === 401) {
            await logout();
            return;
          }
          if (!response.ok) throw new Error(await responseError(response, '推进改进项失败'));
          const body = await response.json() as { duplicate?: boolean };
          if (context.manualRetry) {
            setNotice(body.duplicate
              ? '已使用原请求核对：改进项状态已生效'
              : `已使用原请求完成操作：${evidenceOnly ? '完成证据已补齐' : nextStatus === 'COMPLETED' ? '改进项已完成' : '改进项已进入执行阶段'}`);
          } else {
            setNotice(body.duplicate
              ? '已恢复原状态操作回执，改进项未重复推进'
              : evidenceOnly ? '完成证据已补齐' : nextStatus === 'COMPLETED' ? '改进项已完成' : '改进项已进入执行阶段');
          }
          await fetchReports();
        },
      });
      keepLocked = resolution === 'PENDING';
    } catch (err) {
      console.error('Update CQI action failed:', err);
      setError(err instanceof Error ? err.message : '推进改进项失败');
    } finally {
      if (!keepLocked) endOperation(key);
    }
  };

  const handleTransitionReport = async (report: CQIReport, confirmed = false) => {
    if (!isCurrentReportSnapshot(report)) {
      setError('该报告不是当前快照，已保持只读；不能继续提交、批准或关闭');
      return;
    }
    const nextStatus = report.status === 'DRAFT'
      ? 'REVIEWED'
      : report.status === 'REVIEWED' && user?.role === 'ADMIN'
        ? 'APPROVED'
        : report.status === 'APPROVED' && user?.role === 'ADMIN' ? 'CLOSED' : null;
    if (!nextStatus) return;
    if (nextStatus === 'CLOSED' && !report.actionItems.every(actionHasCompleteEvidence)) {
      setError('关闭前须确认每项行动均已完成，并填写结果摘要和有效证据引用');
      return;
    }
    const actionName = nextStatus === 'REVIEWED' ? '提交审阅' : nextStatus === 'APPROVED' ? '批准报告' : '关闭报告';
    const consequence = nextStatus === 'REVIEWED'
      ? '提交后不能再新增行动项。'
      : nextStatus === 'APPROVED'
        ? '批准后责任教师可开始执行行动项。'
        : '关闭前将再次核验每项行动的结果摘要与证据引用；关闭后报告不再允许变更。';
    if (!confirmed) {
      setConfirmation({
        kind: 'transition-report',
        title: `确认${actionName}`,
        description: report.title,
        consequence,
        report,
      });
      return;
    }
    const key = `report:${report.id}`;
    if (!startOperation(key)) return;
    let keepLocked = false;
    setError(null);
    setNotice(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('登录状态已失效，请重新登录');
      const request = snapshotWriteRequest(`/api/obe/cqi/reports/${encodeURIComponent(report.id)}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          expectedStatus: report.status,
          status: nextStatus,
        }),
      });
      const resolution = await executeTrackedWrite({
        key,
        label: actionName,
        request,
        onResponse: async (response, context) => {
          if (response.status === 401) {
            await logout();
            return;
          }
          if (!response.ok) throw new Error(await responseError(response, `${actionName}失败`));
          const body = await response.json() as { duplicate?: boolean };
          if (context.manualRetry) {
            setNotice(body.duplicate
              ? `已使用原请求核对：${actionName}状态已生效`
              : `已使用原请求完成${actionName}`);
          } else {
            setNotice(body.duplicate ? `已恢复原${actionName}回执，状态未重复推进` : `${actionName}成功`);
          }
          await fetchReports();
        },
      });
      keepLocked = resolution === 'PENDING';
    } catch (err) {
      console.error('Transition CQI report failed:', err);
      setError(err instanceof Error ? err.message : `${actionName}失败`);
    } finally {
      if (!keepLocked) endOperation(key);
    }
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
            href="/login?from=%2Fobe%2Fteacher%2Fcqi&reason=teacher-role"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
          >
            {!user ? '去登录' : '切换教师账号'}
          </Link>
        </div>
      </div>
    );
  }

  const creating = busyKeys.includes('create-report');
  const creatingPending = pendingWrite?.key === 'create-report';
  const pageBusy = busyKeys.length > 0;
  const completionConfirmationValid = confirmation?.kind !== 'complete-action'
    || isCompletionEvidenceValid({
      resultSummary: confirmation.resultSummary,
      evidenceReference: confirmation.evidenceReference,
    });

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <ClipboardList className="h-3.5 w-3.5" />
              OBE · 持续改进
            </div>
            <h1 id="cqi-page-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">CQI 持续改进</h1>
            <p className="mt-1 text-sm text-slate-400">达成度数据生成报告，明确责任行动，复核后关闭</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_170px_auto]">
            <label className="flex flex-col gap-1.5 text-xs text-slate-400">
              班级范围
              <select
                value={selectedClassId}
                onChange={(event) => setSelectedClassId(event.target.value)}
                disabled={loadingScope || pageBusy || classes.length === 0}
                className="h-11 rounded-md border border-white/[0.1] bg-[#111820] px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-50"
              >
                {classes.length === 0 && <option value="">暂无可管理班级</option>}
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}（{item._count?.enrollments ?? 0} 人）
                  </option>
                ))}
              </select>
              <span className="min-h-4 text-[11px] leading-4 text-slate-500">切换后自动载入该班级学期</span>
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-slate-400">
              报告学期
              <input
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                disabled={pageBusy}
                placeholder="2025-2026-2"
                aria-invalid={semester.length > 0 && !validSemester(semester)}
                aria-describedby="cqi-semester-format"
                className="h-11 rounded-md border border-white/[0.1] bg-[#111820] px-3 text-sm text-slate-200 outline-none focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-50"
              />
              <span
                id="cqi-semester-format"
                className={cn(
                  'min-h-4 text-[11px] leading-4',
                  semester.length > 0 && !validSemester(semester) ? 'text-red-300' : 'text-slate-500',
                )}
              >
                {semester.length > 0 && !validSemester(semester)
                  ? '格式应为连续学年和第 1 或第 2 学期，如 2025-2026-1'
                  : '格式：起始年-结束年-学期'}
              </span>
            </label>
            <div className="flex flex-col gap-1.5">
              <span aria-hidden="true" className="text-xs text-transparent">报告操作</span>
              <button
                type="button"
                onClick={() => void handleGenerateReport()}
                disabled={pageBusy || loadingScope || loadingReports || !dataProvenance || !selectedClassId || !validSemester(semester)}
                title={!dataProvenance ? '服务端数据身份核验通过后才可生成报告' : undefined}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-sm text-cyan-100 transition hover:bg-cyan-300/[0.13] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creatingPending
                  ? <AlertTriangle className="h-4 w-4" />
                  : creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {creatingPending ? '结果待核对' : creating ? '生成中' : '生成报告'}
              </button>
              <span className="min-h-4 text-[11px] leading-4 text-slate-500">数据不足时不会生成</span>
            </div>
          </div>
        </div>
      </div>

      <section aria-labelledby="cqi-page-title" className="px-4 py-5 md:px-6">
        <DataProvenancePanel
          provenance={dataProvenance}
          loading={loadingScope || loadingReports}
        />
        <div aria-live="polite" aria-atomic="true">
          {notice && (
            <div className="mb-5 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm text-emerald-100">
              {notice}
            </div>
          )}
        </div>
        {error && (
          <div role="alert" className="mb-5 rounded-md border border-red-300/20 bg-red-300/[0.06] p-4">
            <p className="text-sm text-red-200">{error}</p>
            {pendingWrite ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => void handleRetryPendingWrite()}
                  disabled={retryingPendingWrite}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white/[0.07] px-4 text-sm text-slate-100 hover:bg-white/[0.11] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-wait disabled:opacity-50"
                >
                  {retryingPendingWrite
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <RefreshCcw className="h-3.5 w-3.5" />}
                  {retryingPendingWrite ? '正在核对原请求' : '使用原请求核对/重试'}
                </button>
                <span className="text-xs text-red-200/70">
                  待核对操作：{pendingWrite.label}；请求编号和请求内容保持不变
                </span>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    if (classes.length === 0) setScopeReloadKey((value) => value + 1);
                    else void fetchReports();
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white/[0.06] px-4 text-sm text-slate-200 hover:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                >
                  <RefreshCcw className="h-3.5 w-3.5" /> 重新加载
                </button>
                <Link
                  href={`/login?from=${encodeURIComponent(`/obe/teacher/cqi?classId=${selectedClassId}&semester=${semester}`)}`}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-4 text-sm text-cyan-100 hover:bg-cyan-300/[0.11] focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                >
                  重新登录
                </Link>
              </div>
            )}
          </div>
        )}

        {loadingScope || loadingReports ? (
          <div className="flex h-[320px] items-center justify-center text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载改进报告
          </div>
        ) : !selectedClassId ? (
          <EmptyState title="暂无可管理班级" detail="请先创建班级并加入有效学生，再生成达成度报告。" />
        ) : reports.length === 0 ? (
          <EmptyState title="该班级暂无改进报告" detail="完成达成度计算后，选择正确学期生成报告。" />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const isExpanded = expandedReport === report.id;
              const snapshot = parseReportSnapshot(report.snapshot);
              const isCurrentSnapshot = snapshot.freshness === 'CURRENT';
              const weakPoints = parseArray<AnalysisPoint>(report.weakPoints);
              const strengths = parseArray<AnalysisPoint>(report.strengths);
              const measures = parseArray<ImprovementMeasure | string>(report.improvementMeasures);
              const draft = newAction[report.id] ?? emptyActionDraft(teachers[0]?.id);
              const canAddAction = isCurrentSnapshot && report.status === 'DRAFT';
              const allActionsComplete = report.actionItems.length > 0
                && report.actionItems.every((item) => item.status === 'COMPLETED');
              const allActionsEvidenceReady = report.actionItems.length > 0
                && report.actionItems.every(actionHasCompleteEvidence);
              const missingEvidenceCount = report.actionItems.filter((item) => (
                item.status === 'COMPLETED' && !actionHasCompleteEvidence(item)
              )).length;
              const reportBusy = busyKeys.includes(`report:${report.id}`);
              const reportPending = pendingWrite?.key === `report:${report.id}`;
              const addActionPending = pendingWrite?.key === `add:${report.id}`;
              const transitionLabel = !isCurrentSnapshot ? null : report.status === 'DRAFT'
                ? '提交审阅'
                : report.status === 'REVIEWED' && user.role === 'ADMIN'
                  ? '批准报告'
                  : report.status === 'APPROVED' && user.role === 'ADMIN' ? '关闭报告' : null;
              const transitionDisabled = pageBusy
                || report.actionItems.length === 0
                || (report.status === 'APPROVED' && !allActionsEvidenceReady);

              return (
                <section key={report.id} className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    className="flex min-h-16 w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-300/30"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'rounded-sm px-2 py-0.5 text-[10px] font-medium',
                          report.status === 'CLOSED' ? 'bg-emerald-300/10 text-emerald-200'
                            : report.status === 'DRAFT' ? 'bg-amber-300/10 text-amber-200'
                              : 'bg-cyan-300/10 text-cyan-200',
                        )}>
                          {STATUS_LABELS[report.status] || report.status}
                        </span>
                        <span className={cn(
                          'rounded-sm px-2 py-0.5 text-[10px] font-medium',
                          snapshot.freshness === 'CURRENT'
                            ? 'bg-emerald-300/10 text-emerald-200'
                            : snapshot.freshness === 'HISTORICAL'
                              ? 'bg-amber-300/10 text-amber-100'
                              : 'bg-red-300/10 text-red-100',
                        )}>
                          {snapshot.freshness === 'CURRENT'
                            ? '当前快照'
                            : snapshot.freshness === 'HISTORICAL' ? '历史快照' : '快照待核验'}
                        </span>
                        <span className="text-xs text-slate-500">{report.semester}</span>
                        <span className="text-xs text-slate-500">{report.totalStudents} 名学生</span>
                      </div>
                      <h2 className="mt-1 truncate text-sm font-medium text-slate-200">{report.title}</h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-slate-500">{report.actionItems.length} 项行动</span>
                      {isExpanded
                        ? <ChevronUp className="h-4 w-4 text-slate-500" />
                        : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-5 border-t border-white/[0.06] p-4">
                      <div className={cn(
                        'rounded-md border px-4 py-3 text-xs leading-5',
                        snapshot.freshness === 'CURRENT'
                          ? 'border-emerald-300/15 bg-emerald-300/[0.04] text-emerald-50'
                          : snapshot.freshness === 'HISTORICAL'
                            ? 'border-amber-300/20 bg-amber-300/[0.05] text-amber-50'
                            : 'border-red-300/20 bg-red-300/[0.05] text-red-50',
                      )} role="note">
                        <div className="font-medium">
                          {snapshot.freshness === 'CURRENT'
                            ? '当前源快照，可继续执行改进行动'
                            : snapshot.freshness === 'HISTORICAL'
                              ? '历史源快照，仅供追溯'
                              : '源快照暂不可核验，仅供只读查看'}
                        </div>
                        <p className="mt-1 opacity-80">{snapshot.note}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 opacity-75">
                          <span>
                            源记录：{snapshot.sourceSummary.actualRecords ?? '未留存'}/
                            {snapshot.sourceSummary.expectedRecords ?? '未留存'}
                          </span>
                          <span>
                            指标点：{snapshot.sourceSummary.passedIndicators ?? '未留存'}/
                            {snapshot.sourceSummary.totalIndicators ?? '未留存'}
                          </span>
                          <span>快照生成截止：{formatSnapshotCutoff(snapshot.sourceCutoff)}</span>
                        </div>
                        {!isCurrentSnapshot && (
                          <p className="mt-2 font-medium">只读边界：不能新增行动、推进完成证据或流转报告状态。</p>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Metric label="平均达成度" value={report.averageAchievement == null ? '数据不足' : `${(report.averageAchievement * 100).toFixed(1)}%`} />
                        <Metric label="全指标达标学生" value={`${report.passedStudents}/${report.totalStudents}`} />
                        <Metric label="学生通过率" value={report.passRate == null ? '数据不足' : `${report.passRate.toFixed(1)}%`} />
                      </div>

                      {weakPoints.length > 0 && (
                        <AnalysisList title={`未达标（${weakPoints.length}）`} tone="weak" points={weakPoints} />
                      )}
                      {strengths.length > 0 && (
                        <AnalysisList title={`已达标（${strengths.length}）`} tone="strong" points={strengths} />
                      )}
                      {measures.length > 0 && (
                        <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.03] p-3">
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cyan-200">
                            <TrendingUp className="h-3.5 w-3.5" /> 数据建议
                          </div>
                          <div className="space-y-1.5">
                            {measures.map((measure, index) => (
                              <div key={index} className="flex items-start gap-2 rounded-sm bg-white/[0.02] px-3 py-2 text-xs">
                                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" />
                                <span className="text-slate-300">{typeof measure === 'string' ? measure : measure.measure || '待明确改进措施'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                            <BookOpen className="h-3.5 w-3.5" /> 责任行动
                          </div>
                          <span className="text-xs text-slate-500">
                            {report.status === 'DRAFT' && '补齐行动后提交审阅'}
                            {report.status === 'REVIEWED' && '等待管理员批准'}
                            {report.status === 'APPROVED' && '按顺序推进并完成行动'}
                            {report.status === 'CLOSED' && '报告已复核关闭'}
                          </span>
                        </div>

                        {report.actionItems.length === 0 ? (
                          <div className="mb-3 rounded-md border border-dashed border-white/[0.1] px-4 py-5 text-center text-xs text-slate-500">
                            尚未设置责任行动，报告不能提交审阅
                          </div>
                        ) : (
                          <div className="mb-3 space-y-2">
                            {report.actionItems.map((action) => {
                              const actionBusy = busyKeys.includes(`action:${action.id}`);
                              const actionPending = pendingWrite?.key === `action:${action.id}`;
                              const completionResult = parseActionCompletionResult(action.result);
                              const needsCompletionEvidence = action.status === 'COMPLETED'
                                && !completionResult?.evidenceComplete;
                              const canAdvance = isCurrentSnapshot
                                && report.status === 'APPROVED'
                                && (action.status !== 'COMPLETED' || needsCompletionEvidence)
                                && (user.role === 'ADMIN' || action.assignedTo === user.id);
                              const advanceLabel = action.status === 'PENDING'
                                ? '开始执行'
                                : needsCompletionEvidence ? '补充完成证据' : '标记完成';
                              return (
                                <div key={action.id} className="flex flex-col gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] p-3 md:flex-row md:items-center md:justify-between">
                                  <div className="min-w-0">
                                    <div className={cn('text-sm', action.status === 'COMPLETED' ? 'text-slate-500 line-through' : 'text-slate-200')}>
                                      {action.description}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                      <span>{CATEGORY_LABELS[action.category] || action.category}</span>
                                      <span>期限：{action.dueDate ? new Date(action.dueDate).toLocaleDateString('zh-CN') : '未设置'}</span>
                                      <span>{ACTION_STATUS_LABELS[action.status] || action.status}</span>
                                    </div>
                                    {action.status === 'COMPLETED' && (
                                      <div className={cn(
                                        'mt-2 rounded-sm border px-3 py-2 text-[11px] leading-5',
                                        completionResult?.evidenceComplete
                                          ? 'border-emerald-300/15 bg-emerald-300/[0.04] text-slate-300'
                                          : 'border-amber-300/20 bg-amber-300/[0.05] text-amber-100',
                                      )}>
                                        <div>
                                          <span className="text-slate-500">结果摘要：</span>
                                          {completionResult?.summary || '旧记录未填写结果摘要'}
                                        </div>
                                        <div className="mt-1">
                                          <span className="text-slate-500">证据引用：</span>
                                          {completionResult?.evidenceComplete ? (
                                            isEvidenceLink(completionResult.evidenceReference) ? (
                                              <a
                                                href={completionResult.evidenceReference}
                                                target={completionResult.evidenceReference.startsWith('/') ? undefined : '_blank'}
                                                rel={completionResult.evidenceReference.startsWith('/') ? undefined : 'noreferrer'}
                                                className="break-all text-cyan-200 underline decoration-cyan-300/40 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-cyan-300/30"
                                              >
                                                {completionResult.evidenceReference}
                                              </a>
                                            ) : <span className="break-all font-mono text-cyan-100">{completionResult.evidenceReference}</span>
                                          ) : (
                                            <span>待补充有效链接或平台记录编号</span>
                                          )}
                                        </div>
                                        {completionResult?.legacy && (
                                          <div className="mt-1 text-amber-100/70">该项来自旧版纯文本记录，保留原说明但须补证后才能关闭报告。</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateActionStatus(report, action)}
                                    disabled={!canAdvance || pageBusy}
                                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {actionPending
                                      ? <AlertTriangle className="h-3.5 w-3.5" />
                                      : actionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    {actionPending
                                      ? '结果待核对'
                                      : action.status === 'COMPLETED' && !needsCompletionEvidence ? '已完成且已补证' : advanceLabel}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {canAddAction && (
                          <div className="grid gap-2 rounded-md border border-white/[0.06] bg-black/10 p-3 lg:grid-cols-[minmax(240px,1fr)_130px_150px_minmax(150px,180px)_auto]">
                            <label className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                              具体行动
                              <input
                                type="text"
                                maxLength={2000}
                                value={draft.description}
                                disabled={pageBusy}
                                onChange={(event) => setNewAction((current) => ({
                                  ...current,
                                  [report.id]: { ...draft, description: event.target.value },
                                }))}
                                placeholder="说明做什么以及如何复核"
                                className="h-11 rounded-md border border-white/[0.08] bg-[#111820] px-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                              />
                            </label>
                            <label className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                              类别
                              <select
                                value={draft.category}
                                disabled={pageBusy}
                                onChange={(event) => setNewAction((current) => ({
                                  ...current,
                                  [report.id]: { ...draft, category: event.target.value },
                                }))}
                                className="h-11 rounded-md border border-white/[0.08] bg-[#111820] px-2 text-xs text-slate-300 outline-none focus:border-cyan-300/40"
                              >
                                {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                              责任期限
                              <input
                                type="date"
                                min={formatDateInput(new Date())}
                                value={draft.dueDate}
                                disabled={pageBusy}
                                onChange={(event) => setNewAction((current) => ({
                                  ...current,
                                  [report.id]: { ...draft, dueDate: event.target.value },
                                }))}
                                className="h-11 rounded-md border border-white/[0.08] bg-[#111820] px-2 text-xs text-slate-300 outline-none focus:border-cyan-300/40"
                              />
                            </label>
                            {user.role === 'ADMIN' ? (
                              <label className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                                责任教师
                                <select
                                  value={draft.assignedTo}
                                  disabled={pageBusy}
                                  onChange={(event) => setNewAction((current) => ({
                                    ...current,
                                    [report.id]: { ...draft, assignedTo: event.target.value },
                                  }))}
                                  className="h-11 rounded-md border border-white/[0.08] bg-[#111820] px-2 text-xs text-slate-300 outline-none focus:border-cyan-300/40"
                                >
                                  <option value="">请选择</option>
                                  {teachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.username}</option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <div className="flex flex-col gap-1.5 text-[11px] text-slate-500">
                                责任教师
                                <div className="flex h-11 items-center rounded-md border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-slate-300">{user.name}</div>
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => void handleAddAction(report)}
                              disabled={pageBusy || !draft.description.trim() || !draft.dueDate || (user.role === 'ADMIN' && !draft.assignedTo)}
                              className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.05] px-4 text-xs text-slate-200 transition hover:bg-white/[0.09] focus:outline-none focus:ring-2 focus:ring-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {addActionPending
                                ? <AlertTriangle className="h-3.5 w-3.5" />
                                : busyKeys.includes(`add:${report.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              {addActionPending ? '结果待核对' : '添加行动'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-500">
                          {!isCurrentSnapshot && report.status !== 'CLOSED'
                            ? '该版本不是当前快照，已停止全部写操作。'
                            : (
                              <>
                                {report.status === 'DRAFT' && '提交前请核对每项行动的责任人和期限。'}
                                {report.status === 'REVIEWED' && (user.role === 'ADMIN' ? '批准前请复核分析结果与行动安排。' : '报告已提交，等待管理员复核。')}
                                {report.status === 'APPROVED' && (
                                  allActionsEvidenceReady
                                    ? '全部行动均已完成并补齐证据，可由管理员关闭报告。'
                                    : allActionsComplete && missingEvidenceCount > 0
                                      ? `仍有 ${missingEvidenceCount} 项行动缺少结果摘要或证据引用，暂不能关闭。`
                                      : '仍有行动未完成，暂不能关闭。'
                                )}
                                {report.status === 'CLOSED' && '本报告已关闭，所有数据保持只读。'}
                              </>
                            )}
                        </p>
                        {transitionLabel && (
                          <button
                            type="button"
                            onClick={() => void handleTransitionReport(report)}
                            disabled={transitionDisabled}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-4 text-sm text-amber-100 transition hover:bg-amber-300/[0.13] focus:outline-none focus:ring-2 focus:ring-amber-300/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {reportPending
                              ? <AlertTriangle className="h-4 w-4" />
                              : reportBusy
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                              : report.status === 'DRAFT' ? <Send className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                            {reportPending ? '结果待核对' : transitionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      <AlertDialog open={confirmation !== null} onOpenChange={(open) => {
        if (!open && !pageBusy) setConfirmation(null);
      }}>
        <AlertDialogContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title ?? '确认操作'}</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {confirmation?.description ?? '请核对本次操作对象。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-sm leading-6 text-amber-100">
            {confirmation?.consequence}
          </div>
          {confirmation?.kind === 'complete-action' && (
            <div className="space-y-4 rounded-md border border-white/[0.08] bg-black/10 p-3">
              <label className="block text-xs text-slate-300">
                结果摘要
                <textarea
                  value={confirmation.resultSummary}
                  onChange={(event) => setConfirmation((current) => (
                    current?.kind === 'complete-action'
                      ? { ...current, resultSummary: event.target.value }
                      : current
                  ))}
                  rows={3}
                  maxLength={RESULT_SUMMARY_MAX_LENGTH}
                  aria-invalid={confirmation.resultSummary.trim().length > 0
                    && confirmation.resultSummary.trim().length < RESULT_SUMMARY_MIN_LENGTH}
                  aria-describedby="cqi-result-summary-help"
                  className="mt-2 w-full rounded-md border border-white/[0.1] bg-[#0a0e13] px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="说明实际完成内容、核验结果及适用范围"
                />
                <span id="cqi-result-summary-help" className="mt-1 block text-[11px] leading-5 text-slate-500">
                  必填，{RESULT_SUMMARY_MIN_LENGTH}—{RESULT_SUMMARY_MAX_LENGTH} 字；不能只写“已完成”。
                </span>
              </label>
              <label className="block text-xs text-slate-300">
                证据引用
                <input
                  type="text"
                  value={confirmation.evidenceReference}
                  onChange={(event) => setConfirmation((current) => (
                    current?.kind === 'complete-action'
                      ? { ...current, evidenceReference: event.target.value }
                      : current
                  ))}
                  maxLength={EVIDENCE_REFERENCE_MAX_LENGTH}
                  aria-invalid={confirmation.evidenceReference.trim().length > 0
                    && !isValidEvidenceReference(confirmation.evidenceReference)}
                  aria-describedby="cqi-evidence-reference-help"
                  className="mt-2 h-11 w-full rounded-md border border-white/[0.1] bg-[#0a0e13] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/20"
                  placeholder="https://…、/simulation/… 或 EXP-2026-001"
                />
                <span id="cqi-evidence-reference-help" className="mt-1 block text-[11px] leading-5 text-slate-500">
                  必填：有效 http(s) 链接、站内链接，或至少 3 位的平台记录编号。
                </span>
              </label>
              {!completionConfirmationValid && (
                <p role="status" className="text-xs text-amber-100">补齐并校验通过后才可提交完成状态。</p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11 border-white/[0.12] bg-transparent text-slate-200 hover:bg-white/[0.06] hover:text-slate-50" disabled={pageBusy}>
              返回核对
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-amber-300 text-[#1b1300] hover:bg-amber-200"
              disabled={pageBusy || confirmation === null || !completionConfirmationValid}
              onClick={(event) => {
                event.preventDefault();
                const current = confirmation;
                if (!current) return;
                setConfirmation(null);
                if (current.kind === 'generate') void handleGenerateReport(true);
                else if (current.kind === 'complete-action') {
                  void handleUpdateActionStatus(current.report, current.action, true, {
                    resultSummary: current.resultSummary,
                    evidenceReference: current.evidenceReference,
                  });
                }
                else void handleTransitionReport(current.report, true);
              }}
            >
              {confirmation?.kind === 'generate'
                ? '确认生成报告'
                : confirmation?.kind === 'complete-action'
                  ? confirmation.evidenceOnly ? '保存完成证据' : '确认标记完成'
                  : '确认并继续'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <FileText className="h-10 w-10 text-slate-600" />
      <div>
        <p className="text-sm text-slate-300">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg text-slate-100">{value}</div>
    </div>
  );
}

function AnalysisList({
  title,
  tone,
  points,
}: {
  title: string;
  tone: 'weak' | 'strong';
  points: AnalysisPoint[];
}) {
  const weak = tone === 'weak';
  return (
    <div className={cn(
      'rounded-md border p-3',
      weak ? 'border-red-300/15 bg-red-300/[0.03]' : 'border-emerald-300/15 bg-emerald-300/[0.03]',
    )}>
      <div className={cn('mb-2 flex items-center gap-2 text-xs font-medium', weak ? 'text-red-200' : 'text-emerald-200')}>
        {weak ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {title}
      </div>
      <div className="space-y-1.5">
        {points.map((point, index) => (
          <div key={`${point.code ?? 'point'}-${index}`} className="flex flex-col gap-1 rounded-sm bg-white/[0.02] px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              {weak ? <XCircle className="h-3 w-3 shrink-0 text-red-300" /> : <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" />}
              <span className="font-mono text-slate-500">{point.code || '—'}</span>
              <span className="truncate text-slate-300">{point.name || '未命名指标点'}</span>
            </div>
            <span className={cn('shrink-0 font-mono', weak ? 'text-red-300' : 'text-emerald-300')}>
              {typeof point.avgAchievement === 'number' ? `${(point.avgAchievement * 100).toFixed(1)}%` : '数据不足'}
              {weak && typeof point.threshold === 'number' ? ` / ${(point.threshold * 100).toFixed(0)}%` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
