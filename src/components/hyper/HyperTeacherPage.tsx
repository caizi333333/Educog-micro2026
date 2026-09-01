'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { z } from 'zod';
import { getStoredAccessToken } from '@/lib/auth-storage';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  GitBranch,
  GraduationCap,
  Loader2,
  Medal,
  Search,
  Send,
  Target,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { getPointsByLevel } from '@/lib/knowledge-points';
import { ADDRESSING_TASK_PRESET, ADDRESSING_TOPIC_ID } from '@/lib/lesson-tasks';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ACHIEVEMENTS_V2, type Achievement } from '@/lib/achievements-v2';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/shared/EmptyState';
import { EvidenceReadiness, StatusBanner } from '@/components/shared/StatusBanner';
import { DatabaseStatus } from '@/components/DatabaseStatus';

const TEACHER_ACTION_TIMEOUT_MS = 20_000;
const TEACHER_READ_TIMEOUT_MS = 15_000;
const TEACHER_WORKSPACE_STATE_KEY = 'teacher-workspace-state-v1';
const TEACHER_PENDING_ACTION_KEY_PREFIX = 'teacher-pending-action-v1';
const TEACHER_PENDING_ACTION_TTL_MS = 30 * 60 * 1000;

class TeacherActionTimeoutError extends Error {}
class TeacherActionResultUncertainError extends Error {}
class TeacherReadTimeoutError extends Error {}

const teacherWorkspaceStateSchema = z.object({
  teacherId: z.string().min(1).max(128),
  query: z.string().max(120),
  selectedStudentId: z.string().min(1).max(128).nullable(),
});

type TeacherWorkspaceState = z.infer<typeof teacherWorkspaceStateSchema>;

const pendingTargetRangeSchema = z.object({
  scope: z.enum(['ALL', 'CLASS', 'STUDENTS']),
  targetClassId: z.string().min(1).max(128).nullable(),
  studentIds: z.array(z.string().min(1).max(128)).max(500),
  targetCount: z.number().int().positive(),
});
const pendingTeacherActionSchema = z.discriminatedUnion('operation', [
  z.object({
    teacherId: z.string().min(1).max(128),
    requestId: z.string().min(8).max(128),
    operation: z.literal('PUSH_TASK'),
    targetRange: pendingTargetRangeSchema,
    bodySummary: z.object({
      topicId: z.string().min(1).max(128).nullable(),
      pathType: z.enum(['BASIC', 'ADVANCED']),
      moduleCount: z.number().int().min(1).max(20),
      replaceExisting: z.boolean(),
    }),
    createdAt: z.number().int().nonnegative(),
  }),
  z.object({
    teacherId: z.string().min(1).max(128),
    requestId: z.string().min(8).max(128),
    operation: z.literal('ASSIGN_EXPERIMENT'),
    targetRange: pendingTargetRangeSchema,
    bodySummary: z.object({
      experimentId: z.string().min(1).max(128),
    }),
    createdAt: z.number().int().nonnegative(),
  }),
]);

type PendingTeacherAction = z.infer<typeof pendingTeacherActionSchema>;

function pendingTeacherActionStorageKey(teacherId: string): string {
  return `${TEACHER_PENDING_ACTION_KEY_PREFIX}:${encodeURIComponent(teacherId)}`;
}

function readPendingTeacherAction(teacherId: string, now = Date.now()): PendingTeacherAction | null {
  const key = pendingTeacherActionStorageKey(teacherId);
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = pendingTeacherActionSchema.safeParse(JSON.parse(raw) as unknown);
    const record = parsed.success && parsed.data.teacherId === teacherId ? parsed.data : null;
    if (!record || record.createdAt > now || now - record.createdAt >= TEACHER_PENDING_ACTION_TTL_MS) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return record;
  } catch {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Restricted storage remains non-fatal.
    }
    return null;
  }
}

function writePendingTeacherAction(record: PendingTeacherAction): void {
  try {
    window.sessionStorage.setItem(pendingTeacherActionStorageKey(record.teacherId), JSON.stringify(record));
  } catch {
    // In-memory locking still protects the current page when storage is unavailable.
  }
}

function clearPendingTeacherAction(teacherId: string): void {
  try {
    window.sessionStorage.removeItem(pendingTeacherActionStorageKey(teacherId));
  } catch {
    // Restricted storage remains non-fatal.
  }
}

function getTeacherAccessToken(): string | null {
  try {
    return getStoredAccessToken();
  } catch {
    return null;
  }
}

function readTeacherWorkspaceState(teacherId: string): TeacherWorkspaceState | null {
  try {
    const raw = window.sessionStorage.getItem(TEACHER_WORKSPACE_STATE_KEY);
    if (!raw) return null;
    const parsed = teacherWorkspaceStateSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success && parsed.data.teacherId === teacherId ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeTeacherWorkspaceState(state: TeacherWorkspaceState): void {
  try {
    window.sessionStorage.setItem(TEACHER_WORKSPACE_STATE_KEY, JSON.stringify(state));
  } catch {
    // Restricted browser storage must not prevent the teacher page from working.
  }
}

function safeOBETeacherReturnPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try {
    const parsed = new URL(value, 'https://local.invalid');
    if (parsed.origin !== 'https://local.invalid' || parsed.pathname !== '/obe/teacher') return null;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

function markInterventionReturned(path: string): string {
  const parsed = new URL(path, 'https://local.invalid');
  parsed.searchParams.set('intervention', 'sent');
  return `${parsed.pathname}${parsed.search}`;
}

async function fetchTeacherAction(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TEACHER_ACTION_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new TeacherActionTimeoutError('请求超时');
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTeacherRead(
  input: RequestInfo | URL,
  init: RequestInit,
  parentSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = (): void => controller.abort();
  if (parentSignal.aborted) controller.abort();
  else parentSignal.addEventListener('abort', abortFromParent, { once: true });
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TEACHER_READ_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, cache: 'no-store', signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new TeacherReadTimeoutError('请求超时');
    throw error;
  } finally {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener('abort', abortFromParent);
  }
}

function teacherReadFailureMessage(error: unknown, target: string): string {
  if (error instanceof TeacherReadTimeoutError) return `${target}读取超时，请检查网络后重试`;
  if (error instanceof TypeError) return `${target}读取失败，请检查网络后重试`;
  return error instanceof Error ? error.message : `${target}加载失败`;
}

function isTeacherActionResultUncertain(error: unknown): boolean {
  return error instanceof TeacherActionTimeoutError
    || error instanceof TeacherActionResultUncertainError
    || error instanceof TypeError;
}

function teacherActionFailureMessage(error: unknown, action: '推送' | '布置'): string {
  if (isTeacherActionResultUncertain(error)) {
    return `${action}结果暂未确认，可能已经生效。页面已锁定本次内容；请使用原请求核对，平台不会生成新的请求编号。`;
  }
  return error instanceof Error ? error.message : '请稍后重试';
}

const classSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  courseName: z.string().nullable().optional(),
  semester: z.string().nullable().optional(),
});
const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string(),
  note: z.string(),
});
const teacherScopeSchema = z.object({
  asOf: z.string().datetime(),
  basis: z.enum(['ACTIVE_CLASS_ENROLLMENT', 'ACTIVE_STUDENT_ACCOUNT']),
  accessibleClassCount: z.number().int().nonnegative(),
  enrolledStudentCount: z.number().int().nonnegative(),
  includedStudentCount: z.number().int().nonnegative(),
  excludedStudentCount: z.number().int().nonnegative(),
  exclusions: z.array(z.object({
    code: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
  })),
  metricSamples: z.object({
    quizStudents: z.number().int().nonnegative(),
    learningTimeStudents: z.number().int().nonnegative(),
    experimentStudents: z.number().int().nonnegative(),
    repeatedAttemptStudents: z.number().int().nonnegative(),
  }),
});
const teacherStudentSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  studentId: z.string().nullable().optional(),
  class: z.string().nullable().optional(),
  chapterScores: z.array(z.number()).optional(),
  avgScore: z.number().optional(),
  avgQuizScore: z.number().optional(),
  quizAttemptCount: z.number().int().nonnegative().optional(),
  totalTimeSpent: z.number().optional(),
  learningProgressCount: z.number().int().nonnegative().optional(),
  experimentsCompleted: z.number().optional(),
  experimentsTotal: z.number().optional(),
  activityCount: z.number().optional(),
  chapterMastery: z.record(z.string(), z.number()).optional(),
  classes: z.array(classSummarySchema.pick({ id: true, name: true })).optional(),
  analysisEligible: z.boolean().optional(),
});
const dashboardSchema = z.object({
  dataProvenance: dataProvenanceSchema,
  scope: teacherScopeSchema,
  overview: z.object({
    totalStudents: z.number(),
    activeToday: z.number(),
    avgQuizScore: z.number(),
    avgExpCompletion: z.number(),
    totalTimeSpent: z.number().optional(),
    avgTimeSpent: z.number().optional(),
    quizAttemptCount: z.number().int().nonnegative().optional(),
    experimentRecordCount: z.number().int().nonnegative().optional(),
    learningProgressCount: z.number().int().nonnegative().optional(),
  }),
  classes: z.array(classSummarySchema).optional(),
  students: z.array(teacherStudentSchema),
  experiments: z.array(z.object({ id: z.string(), name: z.string(), completed: z.number() })),
  alertStudents: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    studentId: z.string().nullable().optional(),
    avg: z.number(),
    quizAttemptCount: z.number().int().nonnegative().optional(),
    experimentsCompleted: z.number().optional(),
    experimentsTotal: z.number().optional(),
    weakChapters: z.array(z.object({ chapter: z.string(), progress: z.number() })).optional(),
  })),
});
const partialPreClassSchema = z.object({
  totalAssigned: z.number().optional(), completedAssigned: z.number().optional(),
  inProgressAssigned: z.number().optional(), notStartedAssigned: z.number().optional(),
  studentsWithAssigned: z.number().optional(), studentsCompletedAll: z.number().optional(),
  completionRate: z.number().optional(),
});
const partialInClassSchema = z.object({
  totalEvents: z.number().optional(), eventsByType: z.record(z.string(), z.number()).optional(),
  totalDuration: z.number().optional(), avgDurationPerStudent: z.number().optional(),
  durationRecordCount: z.number().int().nonnegative().optional(),
  recentActiveStudents: z.number().optional(),
  dailyActivity: z.array(z.object({ date: z.string(), events: z.number(), activeStudents: z.number() })).optional(),
  participationRate: z.number().optional(),
});
const partialPostClassSchema = z.object({
  totalStudents: z.number().optional(), improvedCount: z.number().optional(),
  declinedCount: z.number().optional(), stableCount: z.number().optional(),
  avgFirstHalfScore: z.number().optional(), avgSecondHalfScore: z.number().optional(),
  comparableStudentCount: z.number().int().nonnegative().optional(),
  quizParticipantCount: z.number().int().nonnegative().optional(),
  chapterMasteryDist: z.record(z.string(), z.object({ high: z.number(), medium: z.number(), low: z.number() })).optional(),
  topStudents: z.array(z.object({
    name: z.string(), avgScore: z.number(), attemptCount: z.number().int().nonnegative().optional(),
  })).optional(),
});
const teachingCycleResponseSchema = z.object({
  preClass: partialPreClassSchema.optional(),
  inClass: partialInClassSchema.optional(),
  postClass: partialPostClassSchema.optional(),
});
const interventionItemSchema = z.object({
  studentId: z.string(), name: z.string(), studentCode: z.string().nullable(), interventionDate: z.string(),
  preAvg: z.number(), postAvg: z.number(), gain: z.number(), preCount: z.number(), postCount: z.number(),
  topicId: z.string().nullable(), comparisonLabel: z.string(), experimentStatus: z.string(),
  taskStatus: z.string(), currentStep: z.number(), totalSteps: z.number(),
});
const interventionResponseSchema = z.object({
  interventions: z.array(interventionItemSchema),
  summary: z.object({
    batchId: z.string().nullable().optional(), totalStudents: z.number().optional(),
    withBothScores: z.number().optional(), improved: z.number().optional(),
    improvementRate: z.number().optional(), avgGain: z.number().optional(),
  }),
});
const errorResponseSchema = z.object({ error: z.string().optional(), message: z.string().optional() });
const pushResponseSchema = errorResponseSchema.extend({
  success: z.boolean().optional(), code: z.string().optional(), activePathCount: z.number().optional(),
  targetCount: z.number().optional(), duplicate: z.boolean().optional(), batchId: z.string().nullable().optional(),
  created: z.number().optional(), paused: z.number().optional(), replacementToken: z.string().optional(),
  confirmationState: z.enum(['REQUIRED', 'STALE']).optional(),
});
const assignResponseSchema = errorResponseSchema.extend({
  success: z.boolean().optional(), assigned: z.number().optional(), skipped: z.number().optional(),
  duplicate: z.boolean().optional(), batchId: z.string().nullable().optional(),
});
const achievementResponseSchema = errorResponseSchema.extend({ success: z.boolean().optional() });
const pushedVerificationResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    experiments: z.array(z.object({
      experimentId: z.string(),
      uniqueStudents: z.number().int().nonnegative(),
      students: z.array(z.object({ id: z.string() })),
    })),
    paths: z.array(z.object({
      batchId: z.string().nullable(),
      totalStudents: z.number().int().nonnegative(),
      students: z.array(z.object({ id: z.string() })),
    })),
  }),
});

type TeacherDashboardData = z.infer<typeof dashboardSchema>;
type TeacherStudent = z.infer<typeof teacherStudentSchema>;

interface TeachingCycleData {
  preClass: {
    totalAssigned: number; completedAssigned: number; inProgressAssigned: number; notStartedAssigned: number;
    studentsWithAssigned: number; studentsCompletedAll: number; completionRate: number;
  };
  inClass: {
    totalEvents: number; eventsByType: Record<string, number>; totalDuration: number;
    avgDurationPerStudent: number; durationRecordCount: number; recentActiveStudents: number;
    dailyActivity: { date: string; events: number; activeStudents: number }[];
    participationRate: number;
  };
  postClass: {
    totalStudents: number; improvedCount: number; declinedCount: number; stableCount: number;
    avgFirstHalfScore: number; avgSecondHalfScore: number; comparableStudentCount: number;
    quizParticipantCount: number;
    chapterMasteryDist: Record<string, { high: number; medium: number; low: number }>;
    topStudents: { name: string; avgScore: number; attemptCount?: number }[];
  };
}

interface InterventionData {
  interventions: z.infer<typeof interventionItemSchema>[];
  summary: {
    batchId?: string | null; totalStudents: number; withBothScores: number;
    improved: number; improvementRate: number; avgGain: number;
  };
}

type PushScope = 'ALL' | 'CLASS' | 'STUDENTS';

interface PushRequestSnapshot {
  readonly requestId: string;
  readonly body: string;
  readonly scope: PushScope;
  readonly targetCount: number;
  readonly targetClassId: string | null;
  readonly targetStudentIds: readonly string[];
  readonly topicId: string | null;
  readonly pathType: 'BASIC' | 'ADVANCED';
  readonly moduleCount: number;
  readonly replaceExisting: boolean;
  readonly createdAt: number;
}

interface AssignRequestSnapshot {
  readonly requestId: string;
  readonly body: string;
  readonly scope: PushScope;
  readonly targetCount: number;
  readonly targetClassId: string | null;
  readonly targetStudentIds: readonly string[];
  readonly experimentId: string;
  readonly createdAt: number;
}

interface AwardRequestSnapshot {
  readonly body: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly achievementId: string;
  readonly achievementTitle: string;
  readonly reason: string;
}

type PendingVerificationResult = {
  status: 'confirmed' | 'unconfirmed';
  message: string;
};

async function expectedPushBatchId(teacherId: string, requestId: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`${teacherId}:${requestId}`));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `batch_${hex.slice(0, 20)}`;
}

function includesPendingTargets(
  actualStudentIds: string[],
  expectedStudentIds: string[],
  expectedCount: number,
): boolean {
  if (expectedStudentIds.length > 0) {
    const actual = new Set(actualStudentIds);
    return actual.size >= expectedCount && expectedStudentIds.every((studentId) => actual.has(studentId));
  }
  return actualStudentIds.length >= expectedCount;
}

async function readPendingTeacherActionStatus(
  record: PendingTeacherAction,
  token: string,
  signal: AbortSignal,
): Promise<PendingVerificationResult> {
  const response = await fetchTeacherRead('/api/teacher/pushed', {
    headers: { Authorization: `Bearer ${token}` },
  }, signal);
  const raw: unknown = await response.json().catch((): null => null);
  if (!response.ok) {
    throw new Error(teacherDataError(response.status, raw, '待确认结果读取失败'));
  }
  const parsed = pushedVerificationResponseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('待确认结果读取格式异常');

  const expectedStudentIds = [...new Set(record.targetRange.studentIds)];
  if (record.operation === 'PUSH_TASK') {
    const batchId = await expectedPushBatchId(record.teacherId, record.requestId);
    if (!batchId) {
      return { status: 'unconfirmed', message: '当前浏览器无法计算批次校验值，未自动重放推送请求。' };
    }
    const path = parsed.data.data.paths.find((item) => item.batchId === batchId);
    if (path && includesPendingTargets(path.students.map((student) => student.id), expectedStudentIds, record.targetRange.targetCount)) {
      return { status: 'confirmed', message: `已在推送回查中找到批次 ${batchId}，目标范围与原请求一致。` };
    }
    return { status: 'unconfirmed', message: '推送回查暂未找到与原请求编号及目标范围一致的批次。' };
  }

  const experiment = parsed.data.data.experiments.find(
    (item) => item.experimentId === record.bodySummary.experimentId,
  );
  if (
    experiment
    && includesPendingTargets(
      experiment.students.map((student) => student.id),
      expectedStudentIds,
      record.targetRange.targetCount,
    )
  ) {
    return { status: 'confirmed', message: `推送回查已覆盖原目标范围中的实验 ${record.bodySummary.experimentId}。` };
  }
  return { status: 'unconfirmed', message: '推送回查暂未覆盖原请求的实验及目标范围。' };
}

type StatItem = [label: string, value: string | number, icon: LucideIcon];

const EXPORT_TYPES = [
  { value: 'student-summary', label: '学生综合报告' },
  { value: 'quiz-detail', label: '测验详细记录' },
  { value: 'activity-log', label: '学习活动日志' },
  { value: 'experiment-detail', label: '实验详细记录' },
] as const;

const EXPORT_MODES = [
  { value: 'management', label: '实名教学管理' },
  { value: 'research', label: '研究匿名' },
] as const;

type ExportMode = (typeof EXPORT_MODES)[number]['value'];

const teacherMedals = ACHIEVEMENTS_V2
  .filter((achievement) => achievement.category === 'social' || achievement.category === 'progress')
  .slice(0, 5);

function initialOf(name?: string | null): string {
  const initial = (name ?? 'U').trim().charAt(0).toUpperCase();
  return initial.length > 0 ? initial : 'U';
}

// 章节号 → "第N章 名称"；'0' 或未知章节归入"未分类"
const CHAPTER_NAME_MAP = new Map(
  getPointsByLevel(1).map((p) => [String(p.chapter), `第${p.chapter}章 ${p.name}`]),
);
function chapterLabel(chapterId?: string | null): string {
  if (!chapterId) return '未分类';
  const key = String(chapterId).trim().replace(/^ch/i, '');
  return CHAPTER_NAME_MAP.get(key) ?? '未分类';
}

function achievementColor(achievement?: Achievement): string {
  if (!achievement) return '#67e8f9';
  if (achievement.rarity === 'legendary') return '#fbbf24';
  if (achievement.rarity === 'epic') return '#c084fc';
  if (achievement.rarity === 'rare') return '#60a5fa';
  return '#67e8f9';
}

function formatSecondsAsHours(value?: number): string {
  if (!value) return '0 min';
  const totalMinutes = Math.round(value / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatScopeDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '时间待核实';
  return parsed.toLocaleString('zh-CN', { hour12: false });
}

function hasQuizRecord(student: TeacherStudent): boolean {
  if (student.quizAttemptCount !== undefined) return student.quizAttemptCount > 0;
  // 仅兼容仍返回旧 avgScore 字段的历史接口；新版接口必须以计数字段判定数据是否存在。
  return student.avgScore !== undefined;
}

function hasLearningTimeRecord(student: TeacherStudent): boolean {
  if (student.learningProgressCount !== undefined) return student.learningProgressCount > 0;
  return (student.totalTimeSpent ?? 0) > 0;
}

function studentQuizLabel(student: TeacherStudent, compact = false): string {
  if (!hasQuizRecord(student)) return compact ? '未作答' : '暂无记录';
  return `${Math.round(student.avgScore ?? student.avgQuizScore ?? 0)}%`;
}

function teacherDataError(status: number, raw: unknown, fallback: string): string {
  if (status === 401) return '登录已过期，请重新登录后继续';
  if (status === 403) return '当前账号无权读取该教学数据';
  const parsed = errorResponseSchema.safeParse(raw);
  return parsed.success ? parsed.data.error ?? parsed.data.message ?? fallback : fallback;
}

function requiresTeacherLogin(message?: string | null): boolean {
  return message?.startsWith('登录已过期') ?? false;
}

export function HyperTeacherPage(): JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBatchId = searchParams?.get('batchId')?.trim() || null;
  const requestedStudentId = searchParams?.get('student')?.trim() || null;
  const requestedStudentAction = searchParams?.get('action')?.trim() || null;
  const requestedTopicId = searchParams?.get('topic')?.trim() || null;
  const requestedReturnTo = safeOBETeacherReturnPath(searchParams?.get('returnTo') ?? null);
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [interventionData, setInterventionData] = useState<InterventionData | null>(null);
  const [interventionError, setInterventionError] = useState<string | null>(null);
  const [interventionLoading, setInterventionLoading] = useState(true);
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [cycleLoading, setCycleLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardReloadToken, setDashboardReloadToken] = useState(0);
  const [interventionReloadToken, setInterventionReloadToken] = useState(0);
  const [cycleReloadToken, setCycleReloadToken] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [workspaceStateOwner, setWorkspaceStateOwner] = useState<string | null>(null);
  const [studentSelectionError, setStudentSelectionError] = useState<string | null>(null);
  const [selectedMedalId, setSelectedMedalId] = useState(teacherMedals[0]?.id ?? ACHIEVEMENTS_V2[0]?.id ?? '');
  const [awardReasonsByStudent, setAwardReasonsByStudent] = useState<Record<string, string>>({});
  const [awardConfirmation, setAwardConfirmation] = useState<AwardRequestSnapshot | null>(null);
  const [pendingAwardRequest, setPendingAwardRequest] = useState<AwardRequestSnapshot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const actionInFlightRef = useRef(false);
  const awardDialogRef = useRef<HTMLDivElement>(null);
  const awardCancelButtonRef = useRef<HTMLButtonElement>(null);
  const awardTriggerRef = useRef<HTMLButtonElement>(null);
  const [exportType, setExportType] = useState('student-summary');
  const [exportClassId, setExportClassId] = useState('all');
  const [exportMode, setExportMode] = useState<ExportMode | ''>('');
  const [exportLoading, setExportLoading] = useState(false);
  // Push task dialog state
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushScope, setPushScope] = useState<'ALL' | 'CLASS' | 'STUDENTS'>('CLASS');
  const [pushClassId, setPushClassId] = useState('');
  const [pushTopicId, setPushTopicId] = useState<typeof ADDRESSING_TOPIC_ID | 'chapter-review'>(ADDRESSING_TOPIC_ID);
  const [pushPathType, setPushPathType] = useState<'BASIC' | 'ADVANCED'>('BASIC');
  const [pushModuleCount, setPushModuleCount] = useState(5);
  const [pushConflict, setPushConflict] = useState<{
    activePathCount: number;
    targetCount: number;
    replacementToken: string;
    confirmationState: 'REQUIRED' | 'STALE';
  } | null>(null);
  const [pushRequestId, setPushRequestId] = useState('');
  const [pendingPushRequest, setPendingPushRequest] = useState<PushRequestSnapshot | null>(null);
  const [confirmAllStudents, setConfirmAllStudents] = useState(false);
  const pushDialogRef = useRef<HTMLDivElement>(null);
  const pushCloseButtonRef = useRef<HTMLButtonElement>(null);
  const pushTriggerRef = useRef<HTMLButtonElement>(null);
  const handledInterventionLinkRef = useRef<string | null>(null);
  // Assign preclass dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignExpId, setAssignExpId] = useState(experimentCatalog[0]?.id ?? 'exp01');
  const [assignScope, setAssignScope] = useState<'ALL' | 'CLASS' | 'STUDENTS'>('CLASS');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignRequestId, setAssignRequestId] = useState('');
  const [pendingAssignRequest, setPendingAssignRequest] = useState<AssignRequestSnapshot | null>(null);
  const [pendingTeacherAction, setPendingTeacherAction] = useState<PendingTeacherAction | null>(null);
  const [pendingVerificationLoading, setPendingVerificationLoading] = useState(false);
  const [pendingVerificationMessage, setPendingVerificationMessage] = useState<string | null>(null);
  const [confirmAssignBulk, setConfirmAssignBulk] = useState(false);
  const assignDialogRef = useRef<HTMLDivElement>(null);
  const assignCloseButtonRef = useRef<HTMLButtonElement>(null);
  const assignTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingVerificationRef = useRef(false);
  const restoredPendingOwnerRef = useRef<string | null>(null);

  const pushControlsLocked = actionLoading || pendingVerificationLoading || pendingPushRequest !== null;
  const assignControlsLocked = actionLoading || pendingVerificationLoading || pendingAssignRequest !== null;
  const awardControlsLocked = actionLoading || awardConfirmation !== null || pendingAwardRequest !== null;
  const teacherSelectionLocked = actionLoading
    || pendingVerificationLoading
    || pendingPushRequest !== null
    || pendingAssignRequest !== null
    || awardConfirmation !== null
    || pendingAwardRequest !== null;

  useEffect(() => {
    if (!showPushDialog) return;
    window.requestAnimationFrame(() => pushCloseButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !actionInFlightRef.current && !pushControlsLocked) {
        setPushConflict(null);
        setShowPushDialog(false);
        window.requestAnimationFrame(() => pushTriggerRef.current?.focus());
        return;
      }
      if (event.key === 'Tab' && pushDialogRef.current) {
        const focusable = Array.from(pushDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [pushControlsLocked, showPushDialog]);

  useEffect(() => {
    if (!showAssignDialog) return;
    window.requestAnimationFrame(() => assignCloseButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !actionInFlightRef.current && !assignControlsLocked) {
        setShowAssignDialog(false);
        window.requestAnimationFrame(() => assignTriggerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab' || !assignDialogRef.current) return;
      const focusable = Array.from(assignDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [assignControlsLocked, showAssignDialog]);

  useEffect(() => {
    if (!awardConfirmation) return;
    window.requestAnimationFrame(() => awardCancelButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !actionInFlightRef.current && !actionLoading && pendingAwardRequest === null) {
        setAwardConfirmation(null);
        window.requestAnimationFrame(() => awardTriggerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab' || !awardDialogRef.current) return;
      const focusable = Array.from(awardDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => window.removeEventListener('keydown', onKeyDown);
  }, [actionLoading, awardConfirmation, pendingAwardRequest]);

  // Teaching cycle state
  const [cycleData, setCycleData] = useState<TeachingCycleData | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function fetchCycle(): Promise<void> {
      if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
        setCycleData(null);
        setCycleError(null);
        setCycleLoading(false);
        return;
      }
      try {
        if (active) {
          setCycleLoading(true);
          setCycleError(null);
        }
        const token = getTeacherAccessToken();
        if (!token) throw new Error('登录已过期，无法读取教学周期数据');
        const res = await fetchTeacherRead('/api/teacher/teaching-cycle', {
          headers: { Authorization: `Bearer ${token}` },
        }, controller.signal);
        const raw: unknown = await res.json().catch((): null => null);
        if (!res.ok) {
          throw new Error(teacherDataError(res.status, raw, '教学周期数据加载失败'));
        }
        const parsed = teachingCycleResponseSchema.safeParse(raw);
        if (!parsed.success) throw new Error('教学周期数据格式异常');
        if (!active) return;
        setCycleData({
          preClass: {
            totalAssigned: 0, completedAssigned: 0, inProgressAssigned: 0, notStartedAssigned: 0,
            studentsWithAssigned: 0, studentsCompletedAll: 0, completionRate: 0,
            ...(parsed.data.preClass ?? {}),
          },
          inClass: {
            totalEvents: 0, eventsByType: {}, totalDuration: 0, avgDurationPerStudent: 0,
            durationRecordCount: 0, recentActiveStudents: 0, dailyActivity: [], participationRate: 0,
            ...(parsed.data.inClass ?? {}),
          },
          postClass: {
            totalStudents: 0, improvedCount: 0, declinedCount: 0, stableCount: 0,
            avgFirstHalfScore: 0, avgSecondHalfScore: 0, comparableStudentCount: 0,
            quizParticipantCount: 0, chapterMasteryDist: {}, topStudents: [],
            ...(parsed.data.postClass ?? {}),
          },
        });
      } catch (cycleLoadError) {
        if (active) {
          const message = teacherReadFailureMessage(cycleLoadError, '教学周期数据');
          setCycleData(null);
          setCycleError(message);
          if (requiresTeacherLogin(message)) {
            setData(null);
            setError('登录已过期，请重新登录后继续');
          }
        }
      } finally {
        if (active) setCycleLoading(false);
      }
    }
    void fetchCycle();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [cycleReloadToken, user]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function fetchDashboard(): Promise<void> {
      if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
        setData(null);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = getTeacherAccessToken();
        if (!token) throw new Error('登录已过期，请重新登录后继续');
        const response = await fetchTeacherRead('/api/teacher/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        }, controller.signal);
        if (!response.ok) {
          const rawError: unknown = await response.json().catch((): null => null);
          throw new Error(teacherDataError(response.status, rawError, '无法加载教师仪表板数据'));
        }
        const raw: unknown = await response.json();
        const parsed = dashboardSchema.safeParse(raw);
        if (!parsed.success) throw new Error('教师仪表板数据格式异常');
        if (active) setData(parsed.data);
      } catch (dashboardError) {
        if (active) {
          setData(null);
          setError(teacherReadFailureMessage(dashboardError, '教师仪表板数据'));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchDashboard();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [dashboardReloadToken, user]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function fetchInterventions(): Promise<void> {
      if (!user || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
        setInterventionData(null);
        setInterventionError(null);
        setInterventionLoading(false);
        return;
      }
      try {
        if (active) {
          setInterventionLoading(true);
          setInterventionData(null);
          setInterventionError(null);
        }
        const token = getTeacherAccessToken();
        if (!token) throw new Error('登录已过期，无法读取任务复核数据');
        const interventionUrl = requestedBatchId
          ? `/api/teacher/intervention-effect?batchId=${encodeURIComponent(requestedBatchId)}`
          : '/api/teacher/intervention-effect';
        const res = await fetchTeacherRead(interventionUrl, {
          headers: { Authorization: `Bearer ${token}` },
        }, controller.signal);
        const raw: unknown = await res.json().catch((): null => null);
        if (!res.ok) {
          throw new Error(teacherDataError(res.status, raw, '任务复核数据加载失败'));
        }
        const parsed = interventionResponseSchema.safeParse(raw);
        if (!parsed.success) throw new Error('任务复核数据格式异常');
        if (active) {
          setInterventionData({
            interventions: parsed.data.interventions,
            summary: {
              batchId: parsed.data.summary.batchId,
              totalStudents: parsed.data.summary.totalStudents ?? 0,
              withBothScores: parsed.data.summary.withBothScores ?? 0,
              improved: parsed.data.summary.improved ?? 0,
              improvementRate: parsed.data.summary.improvementRate ?? 0,
              avgGain: parsed.data.summary.avgGain ?? 0,
            },
          });
        }
      } catch (interventionLoadError) {
        if (active) {
          const message = teacherReadFailureMessage(interventionLoadError, '任务复核数据');
          setInterventionData(null);
          setInterventionError(message);
          if (requiresTeacherLogin(message)) {
            setData(null);
            setError('登录已过期，请重新登录后继续');
          }
        }
      } finally {
        if (active) setInterventionLoading(false);
      }
    }
    void fetchInterventions();
    return (): void => {
      active = false;
      controller.abort();
    };
  }, [interventionReloadToken, requestedBatchId, user]);

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.students ?? []).filter((student) =>
      !q || `${student.name} ${student.studentId ?? ''} ${student.class ?? ''}`.toLowerCase().includes(q)
    );
  }, [data?.students, query]);

  useEffect(() => {
    if (!data) return;
    const availableStudents = data.students;
    if (requestedStudentId) {
      if (workspaceStateOwner !== null) setWorkspaceStateOwner(null);
      if (availableStudents.some((student) => student.id === requestedStudentId)) {
        setStudentSelectionError(null);
        if (selectedStudentId !== requestedStudentId) setSelectedStudentId(requestedStudentId);
      } else {
        setSelectedStudentId(null);
        setStudentSelectionError('目标学生已不在当前教师可管理范围，请返回推送回查重新选择。');
      }
      return;
    }
    setStudentSelectionError(null);
    if (user?.id && workspaceStateOwner !== user.id) {
      const restored = readTeacherWorkspaceState(user.id);
      setWorkspaceStateOwner(user.id);
      setQuery(restored?.query ?? '');
      const restoredStudentExists = restored?.selectedStudentId
        ? availableStudents.some((student) => (
          (student.id ?? student.studentId ?? student.name) === restored.selectedStudentId
        ))
        : false;
      if (restoredStudentExists) {
        setSelectedStudentId(restored?.selectedStudentId ?? null);
        return;
      }
      const firstStudent = availableStudents[0];
      setSelectedStudentId(firstStudent?.id ?? firstStudent?.studentId ?? firstStudent?.name ?? null);
      return;
    }
    if (availableStudents.length === 0) {
      if (selectedStudentId !== null) setSelectedStudentId(null);
      return;
    }
    const currentSelectionExists = selectedStudentId !== null && availableStudents.some((student) => (
      (student.id ?? student.studentId ?? student.name) === selectedStudentId
    ));
    if (!currentSelectionExists) {
      const firstStudent = availableStudents[0];
      setSelectedStudentId(firstStudent?.id ?? firstStudent?.studentId ?? firstStudent?.name ?? null);
    }
  }, [data, requestedStudentId, selectedStudentId, user?.id, workspaceStateOwner]);

  useEffect(() => {
    if (!user?.id || !data || requestedStudentId || workspaceStateOwner !== user.id) return;
    writeTeacherWorkspaceState({
      teacherId: user.id,
      query,
      selectedStudentId,
    });
  }, [data, query, requestedStudentId, selectedStudentId, user?.id, workspaceStateOwner]);

  const selectedStudent = (data?.students ?? []).find(
    (student) => (student.id ?? student.studentId ?? student.name) === selectedStudentId,
  ) ?? null;

  useEffect(() => {
    if (requestedStudentAction !== 'intervene' || !requestedStudentId || selectedStudent?.id !== requestedStudentId) return;
    const linkKey = `${requestedBatchId ?? 'latest'}:${requestedStudentId}:${requestedTopicId ?? ADDRESSING_TOPIC_ID}`;
    let verifiedTopicId = requestedTopicId;

    if (requestedBatchId) {
      if (interventionError || !interventionData) {
        if (interventionError && handledInterventionLinkRef.current === linkKey) {
          handledInterventionLinkRef.current = null;
          setShowPushDialog(false);
        }
        return;
      }
      const matchedIntervention = interventionData.summary.batchId === requestedBatchId
        ? interventionData.interventions.find((item) => item.studentId === requestedStudentId)
        : undefined;
      if (!matchedIntervention) {
        if (handledInterventionLinkRef.current === linkKey) handledInterventionLinkRef.current = null;
        setShowPushDialog(false);
        setStudentSelectionError('目标学生不属于当前回查批次，未打开补充干预。请返回推送回查重新选择。');
        return;
      }
      verifiedTopicId = matchedIntervention.topicId;
    }

    setStudentSelectionError(null);
    if (handledInterventionLinkRef.current === linkKey) return;
    handledInterventionLinkRef.current = linkKey;
    setPushScope('STUDENTS');
    setPushTopicId(verifiedTopicId === ADDRESSING_TOPIC_ID ? ADDRESSING_TOPIC_ID : 'chapter-review');
    setPushConflict(null);
    setPendingPushRequest(null);
    setConfirmAllStudents(false);
    setPushRequestId(crypto.randomUUID());
    setShowPushDialog(true);
  }, [
    interventionData,
    interventionError,
    requestedBatchId,
    requestedStudentAction,
    requestedStudentId,
    requestedTopicId,
    selectedStudent?.id,
  ]);

  const pushTargetCount = useMemo(() => {
    if (pushScope === 'STUDENTS') return selectedStudent?.id ? 1 : 0;
    if (pushScope === 'CLASS') {
      if (!pushClassId) return 0;
      return (data?.students ?? []).filter((student) => student.classes?.some((item) => item.id === pushClassId)).length;
    }
    return data?.students?.length ?? 0;
  }, [data?.students, pushClassId, pushScope, selectedStudent?.id]);
  const pushClassName = useMemo(
    () => (data?.classes ?? []).find((item) => item.id === pushClassId)?.name ?? '所选班级',
    [data?.classes, pushClassId],
  );
  const selectedStudentClasses = useMemo(() => {
    if (!selectedStudent) return '未标注班级';
    const classNames = selectedStudent.classes?.map((item) => item.name).filter(Boolean) ?? [];
    return classNames.length > 0 ? classNames.join('、') : selectedStudent.class?.trim() || '未标注班级';
  }, [selectedStudent]);
  const assignTargetCount = useMemo(() => {
    if (assignScope === 'STUDENTS') return selectedStudentId && selectedStudent?.id ? 1 : 0;
    if (assignScope === 'CLASS') {
      if (!assignClassId) return 0;
      return (data?.students ?? []).filter((student) => student.classes?.some((item) => item.id === assignClassId)).length;
    }
    return data?.students?.length ?? 0;
  }, [assignClassId, assignScope, data?.students, selectedStudent?.id, selectedStudentId]);
  const selectedAssignExperiment = useMemo(
    () => experimentCatalog.find((item) => item.id === assignExpId) ?? null,
    [assignExpId],
  );
  const assignClassName = useMemo(
    () => (data?.classes ?? []).find((item) => item.id === assignClassId)?.name ?? '所选班级',
    [assignClassId, data?.classes],
  );
  const assignTargetSummary = useMemo(() => {
    if (assignScope === 'STUDENTS') {
      return selectedStudent
        ? `${selectedStudent.name} · ${selectedStudent.studentId?.trim() || '未登记学号'} · ${selectedStudentClasses}`
        : '尚未选择学生';
    }
    if (assignScope === 'CLASS') return `${assignClassName} · ${assignTargetCount} 名学生`;
    return `全部所辖学生 · ${assignTargetCount} 名学生`;
  }, [assignClassName, assignScope, assignTargetCount, selectedStudent, selectedStudentClasses]);
  // 仅专项任务的明确首测/再次测评可用于干预复核；其余保留为可下钻的数据不足记录。
  const interventionsWithBoth = (interventionData?.interventions ?? []).filter((iv) => iv.preCount > 0 && iv.postCount > 0);
  const interventionsInsufficient = (interventionData?.interventions ?? []).filter((iv) => iv.preCount === 0 || iv.postCount === 0);
  const selectedMedal = ACHIEVEMENTS_V2.find((achievement) => achievement.id === selectedMedalId) ?? teacherMedals[0] ?? ACHIEVEMENTS_V2[0];
  const selectedAwardReason = selectedStudent?.id ? awardReasonsByStudent[selectedStudent.id] ?? '' : '';
  const overviewHasQuizRecords = (data?.overview.quizAttemptCount ?? 0) > 0;
  const overviewHasExperimentRecords = (data?.overview.experimentRecordCount ?? 0) > 0;
  const overviewHasLearningTimeRecords = (data?.overview.learningProgressCount ?? 0) > 0;
  const maxExperimentCompleted = Math.max(...(data?.experiments ?? []).map((experiment) => experiment.completed), 1);

  const reloadAllTeacherData = useCallback((): void => {
    setDashboardReloadToken((value) => value + 1);
    setInterventionReloadToken((value) => value + 1);
    setCycleReloadToken((value) => value + 1);
  }, []);

  const clearRequestedIntervention = (): void => {
    if (requestedStudentAction !== 'intervene' || typeof window === 'undefined') return;
    const next = new URLSearchParams(window.location.search);
    ['action', 'student', 'batchId', 'topic', 'returnTo'].forEach((key) => next.delete(key));
    const nextQuery = next.toString();
    router.replace(nextQuery ? `/teacher?${nextQuery}` : '/teacher', { scroll: false });
  };

  const closePushDialog = (): void => {
    if (actionInFlightRef.current || pushControlsLocked) return;
    setPushConflict(null);
    setPendingPushRequest(null);
    setConfirmAllStudents(false);
    setShowPushDialog(false);
    clearRequestedIntervention();
    window.requestAnimationFrame(() => pushTriggerRef.current?.focus());
  };

  const closeAssignDialog = (force = false): void => {
    if ((actionInFlightRef.current || assignControlsLocked) && !force) return;
    setPendingAssignRequest(null);
    setConfirmAssignBulk(false);
    setShowAssignDialog(false);
    window.requestAnimationFrame(() => assignTriggerRef.current?.focus());
  };

  const clearStoredPendingResult = useCallback((): void => {
    if (user?.id) clearPendingTeacherAction(user.id);
    setPendingTeacherAction(null);
    setPendingVerificationMessage(null);
  }, [user?.id]);

  const buildPushRequestSnapshot = (replaceExisting: boolean): PushRequestSnapshot | null => {
    if (!pushRequestId) return null;
    const targetStudentIds = (data?.students ?? []).flatMap((student) => {
      if (!student.id) return [];
      if (pushScope === 'STUDENTS') return selectedStudent?.id === student.id ? [student.id] : [];
      if (pushScope === 'CLASS') return student.classes?.some((item) => item.id === pushClassId) ? [student.id] : [];
      return [student.id];
    });
    const body: Record<string, unknown> = {
      scope: pushScope,
      pathType: pushPathType,
      moduleCount: pushModuleCount,
      replaceExisting,
      requestId: pushRequestId,
    };
    if (replaceExisting && pushConflict?.replacementToken) body.replacementToken = pushConflict.replacementToken;
    if (pushTopicId === ADDRESSING_TOPIC_ID) body.topicId = ADDRESSING_TOPIC_ID;
    if (pushScope === 'CLASS') body.targetClassId = pushClassId;
    if (pushScope === 'STUDENTS' && selectedStudent?.id) body.studentIds = [selectedStudent.id];
    return Object.freeze({
      requestId: pushRequestId,
      body: JSON.stringify(body),
      scope: pushScope,
      targetCount: pushTargetCount,
      targetClassId: pushScope === 'CLASS' ? pushClassId : null,
      targetStudentIds,
      topicId: pushTopicId === ADDRESSING_TOPIC_ID ? ADDRESSING_TOPIC_ID : null,
      pathType: pushPathType,
      moduleCount: pushModuleCount,
      replaceExisting,
      createdAt: Date.now(),
    });
  };

  const rememberPendingPush = (snapshot: PushRequestSnapshot): void => {
    if (!user?.id) return;
    const record: PendingTeacherAction = {
      teacherId: user.id,
      requestId: snapshot.requestId,
      operation: 'PUSH_TASK',
      targetRange: {
        scope: snapshot.scope,
        targetClassId: snapshot.targetClassId,
        studentIds: [...snapshot.targetStudentIds],
        targetCount: snapshot.targetCount,
      },
      bodySummary: {
        topicId: snapshot.topicId,
        pathType: snapshot.pathType,
        moduleCount: snapshot.moduleCount,
        replaceExisting: snapshot.replaceExisting,
      },
      createdAt: snapshot.createdAt,
    };
    setPendingTeacherAction(record);
    setPendingVerificationMessage('结果待确认；刷新页面后仍会保持锁定并进行只读核对。');
    writePendingTeacherAction(record);
  };

  const pushLearningTask = async (request?: PushRequestSnapshot): Promise<void> => {
    if (actionInFlightRef.current) return;
    const snapshot = request ?? buildPushRequestSnapshot(Boolean(pushConflict));
    if (!snapshot) return;
    actionInFlightRef.current = true;
    setPendingPushRequest(snapshot);
    try {
      setActionLoading(true);
      const token = getTeacherAccessToken();
      if (!token) {
        const message = '登录已过期，请重新登录后继续';
        setData(null);
        setError(message);
        setPushConflict(null);
        setPendingPushRequest(null);
        clearStoredPendingResult();
        setShowPushDialog(false);
        throw new Error(message);
      }
      const response = await fetchTeacherAction('/api/teacher/push-learning-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: snapshot.body,
      });
      const raw: unknown = await response.json().catch((): null => null);
      if (response.status === 401 || response.status === 403) {
        const message = teacherDataError(response.status, raw, '当前账号无法继续推送');
        setData(null);
        setError(message);
        setPushConflict(null);
        setPendingPushRequest(null);
        clearStoredPendingResult();
        setShowPushDialog(false);
        throw new Error(message);
      }
      const parsed = pushResponseSchema.safeParse(raw);
      if (!parsed.success) throw new TeacherActionResultUncertainError('推送服务返回格式异常');
      const result = parsed.data;
      if (response.status === 409 && result.code === 'ACTIVE_PATH_EXISTS') {
        setPendingPushRequest(null);
        clearStoredPendingResult();
        setPushRequestId(snapshot.requestId);
        setPushConflict({
          activePathCount: result.activePathCount ?? 0,
          targetCount: result.targetCount ?? snapshot.targetCount,
          replacementToken: result.replacementToken ?? '',
          confirmationState: result.confirmationState ?? 'REQUIRED',
        });
        return;
      }
      if (!response.ok) {
        if (response.status >= 500) throw new TeacherActionResultUncertainError(result.error ?? '推送服务暂不可用');
        setPendingPushRequest(null);
        clearStoredPendingResult();
        throw new Error(result.error ?? '推送失败');
      }
      if (result.success !== true) throw new TeacherActionResultUncertainError('推送服务未返回明确成功回执');
      setPendingPushRequest(null);
      clearStoredPendingResult();
      toast({
        title: result.duplicate ? '已恢复原推送回执' : '已推送',
        description: `批次 ${result.batchId ?? '—'}：已为 ${result.created ?? 0} 名学生创建学习路径${result.paused ? `，并暂停 ${result.paused} 条原路径` : ''}。`,
      });
      setShowPushDialog(false);
      setConfirmAllStudents(false);
      if (requestedReturnTo && snapshot.scope === 'STUDENTS') {
        window.location.assign(markInterventionReturned(requestedReturnTo));
        return;
      }
      clearRequestedIntervention();
      reloadAllTeacherData();
      window.requestAnimationFrame(() => pushTriggerRef.current?.focus());
    } catch (pushError) {
      if (isTeacherActionResultUncertain(pushError)) {
        rememberPendingPush(snapshot);
      } else {
        setPendingPushRequest(null);
        clearStoredPendingResult();
      }
      toast({
        title: '推送失败',
        description: teacherActionFailureMessage(pushError, '推送'),
        variant: 'destructive',
      });
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const buildAssignRequestSnapshot = (): AssignRequestSnapshot | null => {
    if (!assignRequestId) return null;
    const targetStudentIds = (data?.students ?? []).flatMap((student) => {
      if (!student.id) return [];
      if (assignScope === 'STUDENTS') return selectedStudent?.id === student.id ? [student.id] : [];
      if (assignScope === 'CLASS') return student.classes?.some((item) => item.id === assignClassId) ? [student.id] : [];
      return [student.id];
    });
    const body: Record<string, unknown> = {
      experimentId: assignExpId,
      scope: assignScope,
      requestId: assignRequestId,
    };
    if (assignScope === 'CLASS') body.targetClassId = assignClassId;
    if (assignScope === 'STUDENTS' && selectedStudentId && selectedStudent?.id) body.studentIds = [selectedStudent.id];
    return Object.freeze({
      requestId: assignRequestId,
      body: JSON.stringify(body),
      scope: assignScope,
      targetCount: assignTargetCount,
      targetClassId: assignScope === 'CLASS' ? assignClassId : null,
      targetStudentIds,
      experimentId: assignExpId,
      createdAt: Date.now(),
    });
  };

  const rememberPendingAssignment = (snapshot: AssignRequestSnapshot): void => {
    if (!user?.id) return;
    const record: PendingTeacherAction = {
      teacherId: user.id,
      requestId: snapshot.requestId,
      operation: 'ASSIGN_EXPERIMENT',
      targetRange: {
        scope: snapshot.scope,
        targetClassId: snapshot.targetClassId,
        studentIds: [...snapshot.targetStudentIds],
        targetCount: snapshot.targetCount,
      },
      bodySummary: { experimentId: snapshot.experimentId },
      createdAt: snapshot.createdAt,
    };
    setPendingTeacherAction(record);
    setPendingVerificationMessage('结果待确认；刷新页面后仍会保持锁定并进行只读核对。');
    writePendingTeacherAction(record);
  };

  const assignPreclass = async (request?: AssignRequestSnapshot): Promise<void> => {
    if (actionInFlightRef.current) return;
    const snapshot = request ?? buildAssignRequestSnapshot();
    if (!snapshot) return;
    actionInFlightRef.current = true;
    setPendingAssignRequest(snapshot);
    try {
      setActionLoading(true);
      const token = getTeacherAccessToken();
      if (!token) {
        const message = '登录已过期，请重新登录后继续';
        setData(null);
        setError(message);
        setPendingAssignRequest(null);
        clearStoredPendingResult();
        setShowAssignDialog(false);
        throw new Error(message);
      }
      const response = await fetchTeacherAction('/api/teacher/assign-preclass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: snapshot.body,
      });
      const raw: unknown = await response.json().catch((): null => null);
      if (response.status === 401 || response.status === 403) {
        const message = teacherDataError(response.status, raw, '当前账号无法继续布置');
        setData(null);
        setError(message);
        setPendingAssignRequest(null);
        clearStoredPendingResult();
        setShowAssignDialog(false);
        throw new Error(message);
      }
      const parsed = assignResponseSchema.safeParse(raw);
      if (!parsed.success) throw new TeacherActionResultUncertainError('布置服务返回格式异常');
      if (!response.ok) {
        if (response.status >= 500) throw new TeacherActionResultUncertainError(parsed.data.error ?? '布置服务暂不可用');
        setPendingAssignRequest(null);
        clearStoredPendingResult();
        throw new Error(parsed.data.error ?? '布置失败');
      }
      if (parsed.data.success !== true) throw new TeacherActionResultUncertainError('布置服务未返回明确成功回执');
      setPendingAssignRequest(null);
      clearStoredPendingResult();
      const skipped = parsed.data.skipped ?? 0;
      toast({
        title: parsed.data.duplicate ? '已恢复原布置回执' : '已布置',
        description: `批次 ${parsed.data.batchId ?? '—'}：新分配 ${parsed.data.assigned ?? 0} 名学生${skipped ? `，${skipped} 名已有该实验进度未重复布置` : ''}。学生可从“我的任务”进入，教师可在“推送回查”查看状态。`,
      });
      closeAssignDialog(true);
      reloadAllTeacherData();
    } catch (assignError) {
      if (isTeacherActionResultUncertain(assignError)) {
        rememberPendingAssignment(snapshot);
      } else {
        setPendingAssignRequest(null);
        clearStoredPendingResult();
      }
      toast({
        title: '布置失败',
        description: teacherActionFailureMessage(assignError, '布置'),
        variant: 'destructive',
      });
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const verifyPendingResult = useCallback(async (
    record: PendingTeacherAction,
    options: { abandonIfUnconfirmed?: boolean; signal?: AbortSignal; automatic?: boolean } = {},
  ): Promise<void> => {
    if (pendingVerificationRef.current) return;
    const token = getTeacherAccessToken();
    if (!token) {
      setPendingVerificationMessage('登录已过期，待确认记录仍保留；重新登录后再核对。');
      setData(null);
      setError('登录已过期，请重新登录后继续');
      return;
    }

    pendingVerificationRef.current = true;
    setPendingVerificationLoading(true);
    setPendingVerificationMessage(options.automatic ? '已恢复待确认操作，正在只读核对服务器记录…' : '正在只读核对服务器记录…');
    const localController = options.signal ? null : new AbortController();
    const signal = options.signal ?? localController!.signal;
    try {
      const result = await readPendingTeacherActionStatus(record, token, signal);
      if (signal.aborted) return;
      if (result.status === 'confirmed') {
        clearPendingTeacherAction(record.teacherId);
        setPendingTeacherAction(null);
        setPendingPushRequest(null);
        setPendingAssignRequest(null);
        setPendingVerificationMessage(null);
        setShowPushDialog(false);
        setShowAssignDialog(false);
        setConfirmAllStudents(false);
        setConfirmAssignBulk(false);
        reloadAllTeacherData();
        toast({
          title: record.operation === 'PUSH_TASK' ? '已核对推送结果' : '已核对布置结果',
          description: `${result.message} 核对过程未重复提交写请求。`,
        });
        return;
      }

      if (options.abandonIfUnconfirmed) {
        clearPendingTeacherAction(record.teacherId);
        setPendingTeacherAction(null);
        setPendingPushRequest(null);
        setPendingAssignRequest(null);
        setPendingVerificationMessage(null);
        setShowPushDialog(false);
        setShowAssignDialog(false);
        setConfirmAllStudents(false);
        setConfirmAssignBulk(false);
        reloadAllTeacherData();
        toast({
          title: '已放弃待确认操作',
          description: `${result.message} 已按你的明确选择解除锁定；平台没有自动补发原写请求。`,
        });
        return;
      }

      setPendingVerificationMessage(`${result.message} 当前仍保持锁定，可稍后重新读取，或明确放弃后重新读取。`);
      if (!options.automatic) {
        toast({
          title: '结果仍待确认',
          description: `${result.message} 未重复提交写请求。`,
          variant: 'destructive',
        });
      }
    } catch (verificationError) {
      if (signal.aborted) return;
      const message = teacherReadFailureMessage(verificationError, '待确认结果');
      setPendingVerificationMessage(`${message}。待确认记录未清除，也未重复提交写请求。`);
      if (!options.automatic) {
        toast({ title: '核对失败', description: message, variant: 'destructive' });
      }
    } finally {
      pendingVerificationRef.current = false;
      if (!signal.aborted) setPendingVerificationLoading(false);
    }
  }, [reloadAllTeacherData, toast]);

  useEffect(() => {
    if (!user?.id || (user.role !== 'TEACHER' && user.role !== 'ADMIN')) {
      restoredPendingOwnerRef.current = null;
      setPendingTeacherAction(null);
      setPendingPushRequest(null);
      setPendingAssignRequest(null);
      return;
    }
    if (restoredPendingOwnerRef.current === user.id) return;
    restoredPendingOwnerRef.current = user.id;
    const record = readPendingTeacherAction(user.id);
    if (!record) return;

    setPendingTeacherAction(record);
    setPendingVerificationMessage('已恢复待确认操作，所有相关写入控件保持锁定。');
    if (record.targetRange.scope === 'STUDENTS' && record.targetRange.studentIds[0]) {
      setWorkspaceStateOwner(user.id);
      setSelectedStudentId(record.targetRange.studentIds[0]);
    }
    if (record.operation === 'PUSH_TASK') {
      setPushScope(record.targetRange.scope);
      setPushClassId(record.targetRange.targetClassId ?? '');
      setPushTopicId(record.bodySummary.topicId === ADDRESSING_TOPIC_ID ? ADDRESSING_TOPIC_ID : 'chapter-review');
      setPushPathType(record.bodySummary.pathType);
      setPushModuleCount(record.bodySummary.moduleCount);
      setPushRequestId(record.requestId);
      setPushConflict(null);
      setPendingPushRequest(Object.freeze({
        requestId: record.requestId,
        body: '',
        scope: record.targetRange.scope,
        targetCount: record.targetRange.targetCount,
        targetClassId: record.targetRange.targetClassId,
        targetStudentIds: record.targetRange.studentIds,
        topicId: record.bodySummary.topicId,
        pathType: record.bodySummary.pathType,
        moduleCount: record.bodySummary.moduleCount,
        replaceExisting: record.bodySummary.replaceExisting,
        createdAt: record.createdAt,
      }));
      setShowPushDialog(true);
    } else {
      setAssignExpId(record.bodySummary.experimentId);
      setAssignScope(record.targetRange.scope);
      setAssignClassId(record.targetRange.targetClassId ?? '');
      setAssignRequestId(record.requestId);
      setPendingAssignRequest(Object.freeze({
        requestId: record.requestId,
        body: '',
        scope: record.targetRange.scope,
        targetCount: record.targetRange.targetCount,
        targetClassId: record.targetRange.targetClassId,
        targetStudentIds: record.targetRange.studentIds,
        experimentId: record.bodySummary.experimentId,
        createdAt: record.createdAt,
      }));
      setShowAssignDialog(true);
    }

    const controller = new AbortController();
    void verifyPendingResult(record, { automatic: true, signal: controller.signal });
    return (): void => controller.abort();
  }, [user?.id, user?.role, verifyPendingResult]);

  const prepareAwardConfirmation = (): void => {
    const reason = selectedAwardReason.trim();
    if (!selectedStudent?.id || !selectedMedal?.id || !reason) {
      toast({ title: '无法授予', description: '请先选择学生、徽章并填写具体表彰理由。', variant: 'destructive' });
      return;
    }
    setPendingAwardRequest(null);
    setAwardConfirmation(Object.freeze({
      body: JSON.stringify({ achievementId: selectedMedal.id, targetUserId: selectedStudent.id, reason }),
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      achievementId: selectedMedal.id,
      achievementTitle: selectedMedal.title,
      reason,
    }));
  };

  const awardMedal = async (snapshot: AwardRequestSnapshot): Promise<void> => {
    if (actionInFlightRef.current) return;
    actionInFlightRef.current = true;
    setPendingAwardRequest(snapshot);
    try {
      setActionLoading(true);
      const token = getTeacherAccessToken();
      if (!token) {
        setPendingAwardRequest(null);
        throw new Error('登录已过期，请重新登录后继续');
      }
      const response = await fetchTeacherAction('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: snapshot.body,
      });
      const raw: unknown = await response.json().catch((): null => null);
      const parsed = achievementResponseSchema.safeParse(raw);
      if (!parsed.success) throw new TeacherActionResultUncertainError('成就服务返回格式异常');
      const result = parsed.data;
      if (!response.ok) {
        if (response.status >= 500) throw new TeacherActionResultUncertainError(result.message ?? result.error ?? '授予服务暂不可用');
        setPendingAwardRequest(null);
        throw new Error(result.message ?? result.error ?? '授予失败');
      }
      setPendingAwardRequest(null);
      setAwardConfirmation(null);
      toast({
        title: result.success === false ? '已核对授予结果' : '已授予徽章',
        description: result.success === false
          ? `${snapshot.studentName} 已经获得“${snapshot.achievementTitle}”，未重复授予。`
          : `${snapshot.studentName} 已获得“${snapshot.achievementTitle}”。`,
      });
      setAwardReasonsByStudent((current) => {
        const next = { ...current };
        delete next[snapshot.studentId];
        return next;
      });
      window.requestAnimationFrame(() => awardTriggerRef.current?.focus());
    } catch (awardError) {
      if (!isTeacherActionResultUncertain(awardError)) setPendingAwardRequest(null);
      toast({
        title: '授予失败',
        description: isTeacherActionResultUncertain(awardError)
          ? '授予结果暂未确认，学生、徽章和理由已锁定；请使用原请求核对。'
          : awardError instanceof Error ? awardError.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      actionInFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (!exportMode) {
      toast({
        title: '请选择数据用途',
        description: '导出前请选择实名教学管理或研究匿名。',
        variant: 'destructive',
      });
      return;
    }
    try {
      setExportLoading(true);
      const token = getTeacherAccessToken();
      const params = new URLSearchParams({ type: exportType, mode: exportMode });
      if (exportClassId && exportClassId !== 'all') params.set('classId', exportClassId);
      const response = await fetch(`/api/teacher/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) {
        const raw: unknown = await response.json().catch((): null => null);
        const parsed = errorResponseSchema.safeParse(raw);
        const message = parsed.success ? parsed.data.error ?? '导出失败' : '导出服务返回格式异常';
        if (exportMode === 'research' && response.status === 503 && /研究匿名导出.*密钥/.test(message)) {
          throw new Error('研究匿名导出暂不可用，请联系管理员完成研究导出配置后重试。');
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      anchor.download = match ? decodeURIComponent(match[1].replace(/['"]/g, '')) : `${exportType}_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast({ title: '导出已开始', description: `正在下载 ${anchor.download}` });
    } catch (exportError) {
      toast({
        title: '导出失败',
        description: exportError instanceof Error ? exportError.message : '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center gap-3 bg-[#070a0d] text-slate-100 sm:-m-6">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
        <span className="text-sm text-slate-400">正在读取教师工作台数据…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="max-w-md rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center" role="alert">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-200" />
          <p className="mt-3 text-sm text-amber-50">请先登录教师账号，再进入教师工作台。</p>
          <Link href="/login?from=%2Fteacher" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            去登录
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center" role="alert">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-200" />
          <p className="mt-3 text-sm text-amber-50">仅教师和管理员可访问此页面。</p>
          <Link href="/login?from=%2Fteacher&reason=teacher-role" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
            切换教师账号
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    const loginRequired = requiresTeacherLogin(error);
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="max-w-md rounded-md border border-amber-300/25 bg-amber-300/[0.08] p-6 text-center" role="alert" aria-live="polite">
          <AlertTriangle className="mx-auto h-6 w-6 text-amber-200" />
          <h1 className="mt-3 text-lg font-semibold text-amber-50">教师数据暂不可用</h1>
          <p className="mt-2 text-sm leading-6 text-amber-100">{error ?? '无法加载教师工作台数据，请稍后重试。'}</p>
          {loginRequired ? (
            <Link href="/login?from=%2Fteacher" className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100">
              重新登录
            </Link>
          ) : (
            <button type="button" onClick={() => setDashboardReloadToken((value) => value + 1)} className="mt-4 min-h-11 rounded-md border border-amber-200/25 px-4 text-sm text-amber-50 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">
              重新加载
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 grid min-h-[calc(100vh-3.5rem)] animate-fade-in bg-[#070a0d] text-slate-100 sm:-m-6 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <aside aria-label="学生列表" className="order-2 hidden border-b border-white/[0.08] bg-[#0c1117] xl:sticky xl:top-0 xl:order-1 xl:block xl:h-[calc(100dvh-3.5rem)] xl:self-start xl:overflow-hidden xl:border-b-0 xl:border-r">
        <div className="border-b border-white/[0.08] p-4">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">学生 · {data?.dataProvenance.label}</div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => {
                if (actionInFlightRef.current || teacherSelectionLocked) return;
                setQuery(event.target.value);
              }}
              disabled={teacherSelectionLocked}
              placeholder="搜索学生..."
              className="h-10 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-auto xl:max-h-[calc(100vh-8rem)]">
          {students.length ? students.map((student) => {
            const key = student.id ?? student.studentId ?? student.name;
            const active = selectedStudent === student;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (actionInFlightRef.current || teacherSelectionLocked) return;
                  setSelectedStudentId(key);
                }}
                disabled={teacherSelectionLocked}
                aria-pressed={active}
                aria-label={`${student.name} ${student.studentId ?? student.class ?? '未登记'} ${hasQuizRecord(student) ? studentQuizLabel(student) : '未作答'}，平均测验`}
                className={cn(
                  'flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-55',
                  active && 'border-l-2 border-l-cyan-300 bg-cyan-300/[0.08] pl-[14px]',
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-sm font-semibold text-[#061014]">
                  {initialOf(student.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{student.name}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{student.studentId ?? student.class ?? '未登记'}</div>
                </div>
                <div
                  className={cn('shrink-0 font-mono', hasQuizRecord(student) ? 'text-sm text-cyan-100' : 'text-[10px] text-slate-500')}
                  title={hasQuizRecord(student) ? '平均测验成绩' : '尚无测验作答记录'}
                >
                  {studentQuizLabel(student, true)}
                </div>
              </button>
            );
          }) : (
            <EmptyState title="暂无学生数据" className="text-center" />
          )}
        </div>
      </aside>

      <section aria-labelledby="teacher-workspace-title" className="order-1 min-w-0 overflow-auto p-5 md:p-7 xl:order-2">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Users className="h-3.5 w-3.5" />
              Teacher Console · 教学仪表板
            </div>
            <h1 id="teacher-workspace-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">教师工作台</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              汇聚班级学情、预警干预与任务推送；所有统计均保留数据身份与样本边界。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Sheet
              open={studentPickerOpen}
              onOpenChange={(open) => {
                if (!open || !teacherSelectionLocked) setStudentPickerOpen(open);
              }}
            >
              <SheetTrigger asChild>
                <button
                  type="button"
                  disabled={teacherSelectionLocked || data.students.length === 0}
                  aria-label={selectedStudent ? `选择学生，当前为${selectedStudent.name}` : '选择学生'}
                  className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50 xl:hidden"
                >
                  <Users className="h-4 w-4" />
                  <span className="max-w-[12rem] truncate">{selectedStudent ? `学生：${selectedStudent.name}` : '选择学生'}</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[min(92vw,380px)] border-white/[0.1] bg-[#0c1117] p-0 text-slate-100 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:text-slate-300 [&>button]:opacity-100 [&>button]:ring-offset-[#0c1117]"
              >
                <SheetHeader className="border-b border-white/[0.08] px-5 pb-4 pt-5 text-left">
                  <SheetTitle className="pr-10 text-lg text-slate-50">选择学生</SheetTitle>
                  <SheetDescription className="text-xs leading-5 text-slate-400">
                    切换后，工作台详情与后续单人操作将同步到所选学生。
                  </SheetDescription>
                  <div className="relative pt-2">
                    <Search className="absolute left-3 top-[calc(50%+0.25rem)] h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      aria-label="搜索学生"
                      value={query}
                      onChange={(event) => {
                        if (actionInFlightRef.current || teacherSelectionLocked) return;
                        setQuery(event.target.value);
                      }}
                      disabled={teacherSelectionLocked}
                      placeholder="按姓名、学号或班级搜索"
                      className="h-11 border-white/[0.09] bg-black/25 pl-10 text-slate-100 placeholder:text-slate-500 focus-visible:ring-cyan-300/70"
                    />
                  </div>
                </SheetHeader>
                <div className="max-h-[calc(100dvh-10.5rem)] overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {students.length > 0 ? students.map((student) => {
                    const key = student.id ?? student.studentId ?? student.name;
                    const active = selectedStudent === student;
                    return (
                      <button
                        key={`mobile-${key}`}
                        type="button"
                        onClick={() => {
                          if (actionInFlightRef.current || teacherSelectionLocked) return;
                          setSelectedStudentId(key);
                          setStudentPickerOpen(false);
                        }}
                        disabled={teacherSelectionLocked}
                        aria-pressed={active}
                        aria-label={`${student.name} ${student.studentId ?? student.class ?? '未登记'} ${hasQuizRecord(student) ? studentQuizLabel(student) : '未作答'}，平均测验`}
                        className={cn(
                          'flex min-h-16 w-full items-center gap-3 border-b border-white/[0.06] px-5 py-3 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/70 disabled:cursor-not-allowed disabled:opacity-55',
                          active && 'border-l-2 border-l-cyan-300 bg-cyan-300/[0.08] pl-[18px]',
                        )}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-sm font-semibold text-[#061014]">
                          {initialOf(student.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-100">{student.name}</div>
                          <div className="truncate font-mono text-[10px] text-slate-500">{student.studentId ?? student.class ?? '未登记'}</div>
                        </div>
                        <div className={cn('shrink-0 font-mono', hasQuizRecord(student) ? 'text-sm text-cyan-100' : 'text-[10px] text-slate-500')}>
                          {studentQuizLabel(student, true)}
                        </div>
                      </button>
                    );
                  }) : (
                    <EmptyState title="没有匹配的学生" description="请调整搜索关键词后重试。" className="min-h-48 text-center" />
                  )}
                </div>
              </SheetContent>
            </Sheet>
            <button
              type="button"
              onClick={() => document.getElementById('teacher-data-export')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              <FileDown className="h-4 w-4" />
              选择用途并导出
            </button>
            <button ref={assignTriggerRef} type="button" onClick={() => {
              if (actionInFlightRef.current || teacherSelectionLocked) return;
              setPendingAssignRequest(null);
              setConfirmAssignBulk(false);
              setAssignRequestId(crypto.randomUUID());
              if (selectedStudentId && selectedStudent?.id) {
                setAssignScope('STUDENTS');
              } else {
                setAssignScope('CLASS');
                setAssignClassId(data?.classes?.[0]?.id ?? '');
              }
              setShowAssignDialog(true);
            }} disabled={teacherSelectionLocked} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50">
              <BookOpen className="h-4 w-4" />
              布置课前
            </button>
            <button ref={pushTriggerRef} onClick={() => {
              if (actionInFlightRef.current || teacherSelectionLocked) return;
              setPushConflict(null);
              setPendingPushRequest(null);
              setConfirmAllStudents(false);
              setPushRequestId(crypto.randomUUID());
              if (selectedStudentId && selectedStudent?.id) {
                setPushScope('STUDENTS');
              } else {
                setPushScope('CLASS');
                setPushClassId(data?.classes?.[0]?.id ?? '');
              }
              setShowPushDialog(true);
            }} disabled={teacherSelectionLocked} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
              <Send className="h-4 w-4" />
              推送任务
            </button>
            <a
              href="#teacher-award-panel"
              onClick={() => requestAnimationFrame(() => document.getElementById('teacher-award-panel')?.focus())}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-amber-200/25 bg-amber-200/[0.06] px-3 text-sm text-amber-100 hover:bg-amber-200/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 2xl:hidden"
            >
              <Award className="h-4 w-4" />
              课堂表彰
            </a>
            <Link href="/teacher/classes" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <Users className="h-4 w-4" />
              班级管理
            </Link>
            <Link href="/teacher/pushed" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]">
              <BarChart3 className="h-4 w-4" />
              推送回查
            </Link>
            <Link href="/teacher/report" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14]">
              <FileText className="h-4 w-4" />
              教学报告
            </Link>
            <Link href="/admin/knowledge-graph" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14]">
              <GitBranch className="h-4 w-4" />
              维护图谱
            </Link>
          </div>
        </div>

        <div
          role="note"
          aria-label="教师看板数据范围"
          className={cn(
            'mb-5 rounded-md border px-4 py-3',
            data.dataProvenance.mode === 'REAL'
              ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
              : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{data.dataProvenance.label}</div>
              <p className="mt-1 text-xs leading-5 opacity-80">{data.dataProvenance.note}</p>
            </div>
          </div>
          <dl className="mt-3 grid gap-x-4 gap-y-2 border-t border-current/10 pt-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <dt className="opacity-60">数据截止</dt>
              <dd className="mt-0.5 font-mono">{formatScopeDateTime(data.scope.asOf)}</dd>
            </div>
            <div>
              <dt className="opacity-60">名册与分析范围</dt>
              <dd className="mt-0.5 font-mono">名册 n={data.scope.enrolledStudentCount} · 纳入 n={data.scope.includedStudentCount}</dd>
            </div>
            <div>
              <dt className="opacity-60">过程指标样本</dt>
              <dd className="mt-0.5 font-mono">测验 n={data.scope.metricSamples.quizStudents} · 学习 n={data.scope.metricSamples.learningTimeStudents}</dd>
            </div>
            <div>
              <dt className="opacity-60">实践与比较样本</dt>
              <dd className="mt-0.5 font-mono">实验 n={data.scope.metricSamples.experimentStudents} · 多次作答 n={data.scope.metricSamples.repeatedAttemptStudents}</dd>
            </div>
          </dl>
          {data.scope.exclusions.length > 0 && (
            <p className="mt-2 border-t border-current/10 pt-2 text-[11px] leading-5 opacity-70">
              排除说明：{data.scope.exclusions.map((item) => `${item.label} n=${item.count}`).join('；')}
            </p>
          )}
        </div>

        {selectedStudent && (
          <section aria-label="当前复核对象" className="mb-5 overflow-hidden rounded-md border border-cyan-300/20 bg-gradient-to-r from-cyan-300/[0.08] via-white/[0.035] to-transparent">
            <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 font-semibold text-[#061014]">
                  {initialOf(selectedStudent.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.14em] text-cyan-200">当前复核对象</span>
                    {selectedStudent.analysisEligible === false && (
                      <span className="rounded border border-amber-300/25 bg-amber-300/[0.08] px-1.5 py-0.5 text-[10px] text-amber-100">仅名册展示 · 不纳入分析</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="truncate text-base font-semibold text-slate-50">{selectedStudent.name}</span>
                    <span className="font-mono text-[11px] text-slate-400">{selectedStudent.studentId?.trim() || '未登记学号'}</span>
                    <span className="text-xs text-slate-400">{selectedStudentClasses}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                    <span>测验 <strong className="font-mono font-medium text-cyan-100">{studentQuizLabel(selectedStudent, true)}</strong></span>
                    <span>实验 <strong className="font-mono font-medium text-emerald-100">{(selectedStudent.experimentsTotal ?? 0) > 0 ? `${selectedStudent.experimentsCompleted ?? 0}/${selectedStudent.experimentsTotal}` : '暂无记录'}</strong></span>
                    <span>学习 <strong className="font-mono font-medium text-amber-100">{hasLearningTimeRecord(selectedStudent) ? formatSecondsAsHours(selectedStudent.totalTimeSpent) : '暂无记录'}</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <a href="#selected-student-evidence" className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/[0.1] bg-black/20 px-3 text-xs text-slate-200 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60">
                  查看完整证据
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (actionInFlightRef.current || teacherSelectionLocked) return;
                    setPushScope('STUDENTS');
                    setPushTopicId(ADDRESSING_TOPIC_ID);
                    setPushConflict(null);
                    setPendingPushRequest(null);
                    setConfirmAllStudents(false);
                    setPushRequestId(crypto.randomUUID());
                    setShowPushDialog(true);
                  }}
                  disabled={teacherSelectionLocked || !selectedStudent.id}
                  aria-label={`为${selectedStudent.name}布置 3.1 专项`}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-cyan-300 px-3 text-xs font-semibold text-[#001014] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  布置 3.1 专项
                </button>
              </div>
            </div>
          </section>
        )}

        <EvidenceReadiness mode={data.dataProvenance.mode} className="mb-5" />

        {error && (
          <StatusBanner variant="warning" className="mb-5 items-center py-2 text-xs">
            <span>{error}</span>
            <button type="button" onClick={() => setDashboardReloadToken((value) => value + 1)} className="ml-auto min-h-11 rounded-md border border-amber-200/25 px-3 text-amber-100 hover:bg-amber-200/10">
              重新加载
            </button>
          </StatusBanner>
        )}

        {interventionLoading && (
          <div role="status" aria-live="polite" className="mb-5 flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-2 text-xs text-cyan-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{requestedBatchId ? `正在读取批次 ${requestedBatchId} 的任务复核数据…` : '正在读取最近一次任务复核数据…'}</span>
          </div>
        )}

        {interventionError && !interventionLoading && (
          <StatusBanner variant="warning" className="mb-5 items-center py-2 text-xs">
            <span>{interventionError}</span>
            {requiresTeacherLogin(interventionError) ? (
              <Link href="/login?from=%2Fteacher" className="ml-auto inline-flex min-h-11 items-center rounded-md border border-amber-200/25 px-3 text-amber-100 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">重新登录</Link>
            ) : (
              <button type="button" onClick={() => setInterventionReloadToken((value) => value + 1)} className="ml-auto min-h-11 rounded-md border border-amber-200/25 px-3 text-amber-100 hover:bg-amber-200/10">
                重新读取复核数据
              </button>
            )}
          </StatusBanner>
        )}

        {studentSelectionError && (
          <StatusBanner variant="warning" className="mb-5 items-center py-2 text-xs">
            <span>{studentSelectionError}</span>
            <Link href="/teacher/pushed" className="ml-auto inline-flex min-h-11 items-center rounded-md border border-amber-200/25 px-3 text-amber-100 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">
              返回推送回查
            </Link>
          </StatusBanner>
        )}

        {cycleLoading && (
          <div role="status" aria-live="polite" className="mb-5 flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/15 bg-cyan-300/[0.05] px-4 py-2 text-xs text-cyan-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在读取教学周期数据…</span>
          </div>
        )}

        {cycleError && !cycleLoading && (
          <StatusBanner variant="warning" className="mb-5 items-center py-2 text-xs">
            <span>{cycleError}</span>
            {requiresTeacherLogin(cycleError) ? (
              <Link href="/login?from=%2Fteacher" className="ml-auto inline-flex min-h-11 items-center rounded-md border border-amber-200/25 px-3 text-amber-100 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">重新登录</Link>
            ) : (
              <button type="button" onClick={() => setCycleReloadToken((value) => value + 1)} className="ml-auto min-h-11 rounded-md border border-amber-200/25 px-3 text-amber-100 hover:bg-amber-200/10">
                重新读取教学周期
              </button>
            )}
          </StatusBanner>
        )}

        <section className="stagger-children mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {([
            ['学生总数', data?.overview?.totalStudents ?? 0, Users],
            ['今日活跃', data?.overview?.activeToday ?? 0, CheckCircle2],
            ['平均测验', overviewHasQuizRecords ? `${Math.round(data?.overview?.avgQuizScore ?? 0)}%` : '暂无记录', BarChart3],
            ['实验完成', overviewHasExperimentRecords ? `${Math.round(data?.overview?.avgExpCompletion ?? 0)}%` : '暂无记录', Target],
            ['平均时长', overviewHasLearningTimeRecords ? formatSecondsAsHours(data?.overview?.avgTimeSpent) : '暂无记录', Clock],
          ] satisfies StatItem[]).map(([label, value, Icon]) => (
            <div key={label} className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="chip-mark flex h-8 w-8 items-center justify-center rounded-md"><Icon className="h-4 w-4 text-cyan-100" /></div>
              <div className="mt-3 font-mono text-2xl font-semibold text-slate-50 stat-glow">{value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          ))}
        </section>

        {/* Teaching Cycle: Pre-class → In-class → Post-class */}
        {cycleData && (
          <section className="mb-6">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-slate-50">教学周期闭环</h2>
              <span className="text-xs text-slate-500">课前 → 课中 → 课后</span>
            </div>
            {cycleData.postClass.totalStudents === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="暂无班级学生数据"
                description="创建班级并邀请学生加入后，这里会展示课前-课中-课后的闭环数据。"
                action={{ label: '去班级管理', href: '/teacher/classes' }}
              />
            ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {/* Pre-class */}
              <div className="glass-hover transition-all rounded-md border border-cyan-300/20 bg-cyan-300/[0.04]">
                <div className="border-b border-cyan-300/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <BookOpen className="h-4 w-4" />
                    课前 · 预习任务
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-3xl font-semibold text-slate-50">{cycleData.preClass.completionRate}%</div>
                    <div className="text-xs text-slate-500">完成率</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${cycleData.preClass.completionRate}%` }} />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">已布置实验</span>
                      <span className="font-mono text-cyan-100">{cycleData.preClass.totalAssigned}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">已完成</span>
                      <span className="font-mono text-emerald-200">{cycleData.preClass.completedAssigned}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">进行中</span>
                      <span className="font-mono text-amber-200">{cycleData.preClass.inProgressAssigned}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">未开始</span>
                      <span className="font-mono text-red-200">{cycleData.preClass.notStartedAssigned}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* In-class */}
              <div className="glass-hover transition-all rounded-md border border-emerald-300/20 bg-emerald-300/[0.04]">
                <div className="border-b border-emerald-300/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                    <TrendingUp className="h-4 w-4" />
                    课中 · 学习互动
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="font-mono text-3xl font-semibold text-slate-50">{cycleData.inClass.participationRate}%</div>
                    <div className="text-xs text-slate-500">近7日参与率</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${cycleData.inClass.participationRate}%` }} />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">累计学习事件</span>
                      <span className="font-mono text-emerald-100">{cycleData.inClass.totalEvents}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">近7日活跃学生</span>
                      <span className="font-mono text-emerald-100">{cycleData.inClass.recentActiveStudents}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">人均学习时长</span>
                      <span className="font-mono text-amber-200">
                        {cycleData.inClass.durationRecordCount > 0
                          ? formatSecondsAsHours(cycleData.inClass.avgDurationPerStudent)
                          : '暂无时长记录'}
                      </span>
                    </div>
                  </div>
                  {/* Daily activity spark */}
                  {cycleData.inClass.dailyActivity.length > 0 && (
                    <div className="mt-3 flex items-end gap-1">
                      {cycleData.inClass.dailyActivity.map((day) => {
                        const maxEvents = Math.max(...cycleData.inClass.dailyActivity.map((d) => d.events), 1);
                        const h = Math.max(4, (day.events / maxEvents) * 32);
                        return (
                          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                            <div className="w-full rounded-sm bg-emerald-300/30" style={{ height: `${h}px` }} />
                            <div className="font-mono text-[9px] text-slate-500">{day.date.slice(5)}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Post-class */}
              <div className="glass-hover transition-all rounded-md border border-amber-300/20 bg-amber-300/[0.04]">
                <div className="border-b border-amber-300/15 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                    <Award className="h-4 w-4" />
                    课后 · 分阶段作答记录
                  </div>
                </div>
                <div className="p-4">
                  {cycleData.postClass.comparableStudentCount > 0 ? (
                    <>
                      <div className="mb-3 flex items-center gap-3">
                        <div>
                          <div className="font-mono text-[10px] text-slate-500">较早记录均值</div>
                          <div className="font-mono text-lg font-semibold text-slate-300">{cycleData.postClass.avgFirstHalfScore}%</div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                        <div>
                          <div className="font-mono text-[10px] text-slate-500">较晚记录均值</div>
                          <div className="font-mono text-lg font-semibold text-amber-200">{cycleData.postClass.avgSecondHalfScore}%</div>
                        </div>
                        <div className="ml-auto">
                          <div className="font-mono text-[10px] text-slate-500">均值变化</div>
                          <div className={`font-mono text-lg font-semibold ${cycleData.postClass.avgSecondHalfScore >= cycleData.postClass.avgFirstHalfScore ? 'text-emerald-200' : 'text-red-200'}`}>
                            {cycleData.postClass.avgSecondHalfScore >= cycleData.postClass.avgFirstHalfScore ? '+' : ''}{cycleData.postClass.avgSecondHalfScore - cycleData.postClass.avgFirstHalfScore}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-200">记录上升</span>
                          <span className="font-mono text-emerald-200">{cycleData.postClass.improvedCount} 人</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">基本稳定</span>
                          <span className="font-mono text-slate-300">{cycleData.postClass.stableCount} 人</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-red-200">有所下滑</span>
                          <span className="font-mono text-red-200">{cycleData.postClass.declinedCount} 人</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div role="note" className="rounded-md border border-amber-300/15 bg-amber-300/[0.05] px-3 py-3 text-xs leading-5 text-amber-100">
                      暂无可比较的分阶段作答记录。每名学生至少完成 2 次测验后，才计算较早与较晚记录变化。
                    </div>
                  )}
                  {cycleData.postClass.topStudents.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">已作答学生排名</div>
                      {cycleData.postClass.topStudents.map((s, i) => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{i + 1}. {s.name}</span>
                          <span className="font-mono text-amber-100">
                            {s.avgScore}%{s.attemptCount !== undefined ? ` · ${s.attemptCount}次` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {cycleData.postClass.topStudents.length === 0 && (
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">暂无已作答学生，暂不生成成绩排名。</p>
                  )}
                </div>
              </div>
            </div>
            )}
          </section>
        )}

        <section id="teacher-data-export" className="mb-6 scroll-mt-20 glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
          <div className="border-b border-white/[0.08] p-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
              <FileDown className="h-5 w-5 text-cyan-200" />
              数据导出
            </h2>
            <p className="mt-1 text-xs text-slate-500">按类型和用途导出学生学习数据为 CSV，可用 Excel 或 SPSS 打开分析。</p>
          </div>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1.5 block text-xs text-slate-400">导出类型</label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                  {EXPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="focus:bg-cyan-300/10 focus:text-cyan-100">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1.5 block text-xs text-slate-400">班级筛选</label>
              <Select value={exportClassId} onValueChange={setExportClassId}>
                <SelectTrigger className="border-white/[0.09] bg-black/25 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                  <SelectItem value="all" className="focus:bg-cyan-300/10 focus:text-cyan-100">全部班级</SelectItem>
                  {(data?.classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="focus:bg-cyan-300/10 focus:text-cyan-100">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1.5 block text-xs text-slate-400">数据用途</label>
              <Select
                value={exportMode}
                onValueChange={(value) => {
                  if (value === 'management' || value === 'research') setExportMode(value);
                }}
              >
                <SelectTrigger
                  aria-label="数据用途"
                  aria-describedby="teacher-export-mode-note"
                  className="border-white/[0.09] bg-black/25 text-slate-100"
                >
                  <SelectValue placeholder="请选择数据用途" />
                </SelectTrigger>
                <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                  {EXPORT_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value} className="focus:bg-cyan-300/10 focus:text-cyan-100">
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p id="teacher-export-mode-note" role="note" aria-label="数据用途说明" className="w-full text-xs leading-5 text-slate-400">
              {exportMode === 'management'
                ? '实名教学管理：包含姓名、学号和班级等直接标识，仅用于获授权的教学管理，请妥善保存。'
                : exportMode === 'research'
                  ? '研究匿名：移除姓名、学号等直接标识并生成稳定研究编号，仅用于研究分析；需管理员预先完成研究导出配置。'
                  : '请先选择数据用途。实名教学管理文件包含直接身份信息；研究匿名文件移除直接标识，仅用于研究分析。'}
            </p>
            <button
              type="button"
              onClick={handleExport}
              disabled={exportLoading || !exportMode}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-5 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:opacity-50"
            >
              {exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {exportLoading
                ? '正在导出…'
                : exportMode === 'management'
                  ? '导出实名教学管理 CSV'
                  : exportMode === 'research'
                    ? '导出研究匿名 CSV'
                    : '请先选择数据用途'}
            </button>
            {/* 打开报告页自动唤起浏览器打印，另存为 PDF 中文不乱码 */}
            <button
              type="button"
              onClick={() => window.open('/teacher/report?print=1', '_blank', 'noopener,noreferrer')}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-300 px-5 text-sm font-semibold text-[#001014] hover:bg-emerald-200"
            >
              <FileText className="h-4 w-4" />
              打印 / 导出PDF
            </button>
          </div>
        </section>

        <section id="platform-health" className="mb-6 scroll-mt-20" aria-labelledby="platform-health-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="platform-health-title" className="text-lg font-semibold text-slate-50">技术状态复核</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">由教师主动发起一次只读连接探测；不自动轮询，也不将单次结果解释为长期可用率。</p>
            </div>
            <span className="font-mono text-[10px] tracking-[0.12em] text-slate-600">ON-DEMAND · READ ONLY</span>
          </div>
          <DatabaseStatus />
        </section>

        <section className="grid gap-5 2xl:grid-cols-[1fr_0.9fr]">
          <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="text-lg font-semibold text-slate-50">实验完成分布</h2>
              <p className="mt-1 text-xs text-slate-500">各实验与项目的班级完成人数分布。</p>
            </div>
            <div className="space-y-3 p-4">
              {(data?.experiments ?? []).length ? (data?.experiments ?? []).map((experiment) => (
                <div key={experiment.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-300">{experiment.name}</span>
                    <span className="font-mono text-cyan-100">{experiment.completed}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.round((experiment.completed / maxExperimentCompleted) * 100)}%` }} />
                  </div>
                </div>
              )) : (
                <EmptyState centered title="暂无实验完成数据" className="min-h-44" />
              )}
            </div>
          </div>

          <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                预警学生 · 干预中心
              </h2>
              <p className="mt-1 text-xs text-slate-500">仅纳入已有测验作答且平均分低于60的学生；无作答记录不按0分预警。</p>
            </div>
            <div className="p-4">
              {(data?.alertStudents ?? []).length ? (
                <div className="space-y-3">
                  {(data?.alertStudents ?? []).map((student) => (
                    <div key={student.id ?? student.name} className="hover:bg-white/[0.04] transition-colors rounded-md border border-red-300/20 bg-red-300/[0.06]">
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-300/20 text-xs font-semibold text-red-100">
                            {initialOf(student.name)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-red-50">{student.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">{student.studentId ?? '未登记'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono text-lg font-semibold text-red-100">{Math.round(student.avg)}%</div>
                            <div className="font-mono text-[10px] text-slate-500">
                              实验 {(student.experimentsTotal ?? 0) > 0
                                ? `${student.experimentsCompleted ?? 0}/${student.experimentsTotal}`
                                : '暂无记录'}
                            </div>
                          </div>
                          {student.id && (
                            <button
                              type="button"
                              onClick={() => {
                                if (actionInFlightRef.current || teacherSelectionLocked) return;
                                setSelectedStudentId(student.id ?? null);
                                setPushScope('STUDENTS');
                                setPushTopicId(ADDRESSING_TOPIC_ID);
                                setPushConflict(null);
                                setPendingPushRequest(null);
                                setConfirmAllStudents(false);
                                setPushRequestId(crypto.randomUUID());
                                setShowPushDialog(true);
                              }}
                              disabled={teacherSelectionLocked}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-red-300/20 px-3 text-xs font-semibold text-red-100 hover:bg-red-300/30 disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" />
                              布置 3.1 专项
                            </button>
                          )}
                        </div>
                      </div>
                      {student.weakChapters && student.weakChapters.length > 0 && (
                        <div className="border-t border-red-300/10 px-3 py-2">
                          <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">薄弱章节</div>
                          <div className="flex flex-wrap gap-2">
                            {student.weakChapters.map((ch) => (
                              <div key={ch.chapter} className="flex items-center gap-1.5 rounded-md border border-red-300/15 bg-red-300/[0.08] px-2 py-1">
                                <span className="text-xs text-red-200">{chapterLabel(ch.chapter)}</span>
                                <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.08]">
                                  <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-amber-400" style={{ width: `${ch.progress}%` }} />
                                </div>
                                <span className="font-mono text-[10px] text-red-100">{ch.progress}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-44 items-center justify-center text-sm text-slate-500">
                  {overviewHasQuizRecords ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-300" />
                      已作答学生中暂无低分预警
                    </>
                  ) : (
                    <>
                      <BarChart3 className="mr-2 h-4 w-4 text-slate-400" />
                      暂无测验作答记录，当前无法判断低分预警
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Intervention Effect Tracking */}
          {interventionData && interventionData.summary.totalStudents > 0 && (
            <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="border-b border-white/[0.08] p-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                  <TrendingUp className="h-5 w-5 text-emerald-300" />
                  任务后续复核
                </h2>
                <p className="mt-1 text-xs text-slate-500">核对任务进度、固定专项首测/再次测评与 exp02 实验记录；普通测验不拼接为前后测。</p>
                {interventionData.summary.batchId && (
                  <p className="mt-1 font-mono text-[10px] text-slate-600">批次 {interventionData.summary.batchId}</p>
                )}
              </div>
              <div className="p-4">
                {/* Summary cards */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-slate-50">{interventionData.summary.totalStudents}</div>
                    <div className="text-[10px] text-slate-500">任务覆盖学生</div>
                  </div>
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-emerald-200">{interventionData.summary.withBothScores}/{interventionData.summary.totalStudents}</div>
                    <div className="text-[10px] text-slate-500">可比较样本</div>
                  </div>
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-cyan-200">{interventionData.summary.avgGain > 0 ? '+' : ''}{interventionData.summary.avgGain}</div>
                    <div className="text-[10px] text-slate-500">平均变化（可比较）</div>
                  </div>
                  <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                    <div className="font-mono text-2xl font-semibold text-amber-200">{interventionData.summary.improved}/{interventionData.summary.withBothScores}</div>
                    <div className="text-[10px] text-slate-500">记录上升（可比较）</div>
                  </div>
                </div>
                {/* Per-student comparison */}
                {interventionsWithBoth.length > 0 && (
                  <div className="space-y-2">
                    {interventionsWithBoth.slice(0, 10).map((iv) => (
                      <button
                        type="button"
                        key={iv.studentId}
                        onClick={() => {
                          if (actionInFlightRef.current || teacherSelectionLocked) return;
                          setSelectedStudentId(iv.studentId);
                        }}
                        disabled={teacherSelectionLocked}
                        className="grid min-h-11 w-full gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-3 text-left transition-colors hover:border-cyan-300/25 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60 disabled:cursor-not-allowed disabled:opacity-55 md:grid-cols-[120px_minmax(180px,1fr)_auto] md:items-center"
                      >
                        <div>
                          <div className="truncate text-sm font-medium text-slate-200">{iv.name}</div>
                          <div className="font-mono text-[10px] text-slate-600">{iv.studentCode ?? '未登记学号'}</div>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] text-slate-500">{iv.comparisonLabel}</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-300">{iv.preAvg}%</span>
                            <span className="text-slate-600">→</span>
                            <span className={cn('font-mono text-xs', iv.gain > 0 ? 'text-emerald-200' : iv.gain < 0 ? 'text-red-200' : 'text-slate-400')}>{iv.postAvg}%</span>
                            <span className={cn('ml-1 inline-flex h-5 items-center rounded px-1.5 font-mono text-[10px] font-semibold', iv.gain > 0 ? 'bg-emerald-300/15 text-emerald-200' : iv.gain < 0 ? 'bg-red-300/15 text-red-200' : 'bg-white/[0.06] text-slate-400')}>
                              {iv.gain > 0 ? '+' : ''}{iv.gain}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded bg-cyan-300/[0.08] px-2 py-1 text-cyan-100">
                            {iv.totalSteps > 0 ? `任务 ${iv.currentStep}/${iv.totalSteps}` : '任务数据不足'}
                          </span>
                          <span className={cn('rounded px-2 py-1', iv.experimentStatus === 'COMPLETED' ? 'bg-emerald-300/[0.1] text-emerald-100' : 'bg-white/[0.05] text-slate-500')}>
                            exp02 {iv.experimentStatus === 'COMPLETED' ? '已完成' : '未完成'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {interventionsInsufficient.length > 0 && (
                  <div className="mt-4 rounded-md border border-amber-300/15 bg-amber-300/[0.04] p-3">
                    <p className="mb-2 text-xs text-amber-100">
                      {interventionsInsufficient.length} 名学生缺少同任务、同测评编号的完整首测/再次测评记录；可选择学生查看缺项并补充教学安排。
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {interventionsInsufficient.slice(0, 10).map((iv) => {
                        const missing = iv.preCount === 0 && iv.postCount === 0
                          ? '缺专项首测与再次测评'
                          : iv.preCount === 0 ? '缺专项首测' : '缺再次测评';
                        return (
                          <button
                            type="button"
                            key={`insufficient-${iv.studentId}`}
                            onClick={() => {
                              if (actionInFlightRef.current || teacherSelectionLocked) return;
                              setSelectedStudentId(iv.studentId);
                            }}
                            disabled={teacherSelectionLocked}
                            className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-white/[0.06] bg-black/15 px-3 py-2 text-left transition-colors hover:border-amber-200/25 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-slate-200">{iv.name}</span>
                              <span className="block text-[10px] text-slate-500">{missing}</span>
                            </span>
                            <span className="shrink-0 text-[10px] text-amber-100">查看学生</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Selected Student Detail */}
        {selectedStudent && (
          <section id="selected-student-evidence" className="mt-5 scroll-mt-20 glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035]">
            <div className="border-b border-white/[0.08] p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-50">
                <Users className="h-5 w-5 text-cyan-200" />
                {selectedStudent.name}
                <span className="font-mono text-xs text-slate-500">
                  {selectedStudent.studentId ?? '未登记学号'}
                </span>
              </h2>
            </div>
            <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">平均测验</div>
                <div className="mt-1 font-mono text-xl text-cyan-100">
                  {studentQuizLabel(selectedStudent)}
                </div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">实验完成</div>
                <div className="mt-1 font-mono text-xl text-emerald-100">
                  {(selectedStudent.experimentsTotal ?? 0) > 0
                    ? `${selectedStudent.experimentsCompleted ?? 0}/${selectedStudent.experimentsTotal}`
                    : '暂无记录'}
                </div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">学习时长</div>
                <div className="mt-1 font-mono text-xl text-amber-100">
                  {hasLearningTimeRecord(selectedStudent)
                    ? formatSecondsAsHours(selectedStudent.totalTimeSpent)
                    : '暂无记录'}
                </div>
              </div>
              <div className="glass-hover transition-all rounded-md border border-white/[0.06] bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500">今日活动</div>
                <div className="mt-1 font-mono text-xl text-slate-100">
                  {selectedStudent.activityCount ?? 0} 次
                </div>
              </div>
            </div>
            {Object.keys(selectedStudent.chapterMastery ?? {}).length > 0 && (
              <div className="border-t border-white/[0.06] p-4">
                <div className="mb-2 text-xs font-semibold text-slate-400">章节掌握度</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {Object.entries(selectedStudent.chapterMastery ?? {}).map(([ch, progress]) => (
                    <div key={ch} className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2">
                      <div className="text-[10px] text-slate-500">{chapterLabel(ch)}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full ${progress >= 80 ? 'bg-gradient-to-r from-cyan-400 to-emerald-400' : progress >= 50 ? 'bg-gradient-to-r from-cyan-300 to-amber-300' : 'bg-gradient-to-r from-red-400 to-amber-400'}`}
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-300">{Math.round(progress)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(selectedStudent.classes ?? []).length > 0 && (
              <div className="border-t border-white/[0.06] p-4">
                <div className="mb-1 text-xs text-slate-500">所属班级</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedStudent.classes ?? []).map((c) => (
                    <span key={c.id} className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-0.5 text-xs text-slate-300">{c.name}</span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </section>

      <aside id="teacher-award-panel" tabIndex={-1} className="order-3 scroll-mt-20 border-t border-white/[0.08] bg-[#0c1117] p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200/60 xl:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">课堂表彰 · 写入成就记录</div>
        <div className="glass-hover transition-all rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-amber-200 text-lg font-semibold text-[#061014]">
              {initialOf(selectedStudent?.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-100">{selectedStudent?.name ?? '未选择学生'}</div>
              <div className="truncate font-mono text-[10px] text-slate-500">{selectedStudent?.studentId ?? selectedStudent?.class ?? '暂无学生信息'}</div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {teacherMedals.map((achievement) => (
              <button
                key={achievement.id}
                type="button"
                onClick={() => {
                  if (actionInFlightRef.current || awardControlsLocked) return;
                  setSelectedMedalId(achievement.id);
                }}
                disabled={awardControlsLocked}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition hover:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-55',
                  selectedMedal?.id === achievement.id ? 'border-cyan-300/60 bg-cyan-300/[0.08]' : 'border-white/[0.08] bg-black/20',
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08]" style={{ color: achievementColor(achievement) }}>
                  <Award className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-100">{achievement.title}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{achievement.id}</div>
                </div>
              </button>
            ))}
          </div>

          <textarea
            aria-label="表彰理由"
            value={selectedAwardReason}
            onChange={(event) => {
              if (!selectedStudent?.id || actionInFlightRef.current || awardControlsLocked) return;
              const value = event.target.value;
              setAwardReasonsByStudent((current) => ({ ...current, [selectedStudent.id!]: value }));
            }}
            disabled={!selectedStudent?.id || awardControlsLocked}
            maxLength={500}
            rows={4}
            placeholder="记录课堂表现、实验报告或答疑依据..."
            className="mt-4 w-full resize-none rounded-md border border-white/[0.09] bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-55"
          />
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>理由按当前学生单独保存，提交前还需确认。</span>
            <span className="font-mono">{selectedAwardReason.length}/500</span>
          </div>

          <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/[0.08] p-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/[0.08] text-amber-100">
              <Medal className="h-7 w-7" />
            </div>
            <div className="mt-3 text-base font-semibold text-slate-50">{selectedMedal?.title ?? '课堂表彰'}</div>
            <div className="mt-1 font-mono text-[10px] text-slate-500">{selectedMedal?.id ?? 'ACHIEVEMENT'} · 预览</div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{selectedAwardReason.length > 0 ? selectedAwardReason : selectedMedal?.description ?? '填写理由后用于课堂记录。'}</p>
          </div>

          <button
            ref={awardTriggerRef}
            type="button"
            onClick={prepareAwardConfirmation}
            disabled={awardControlsLocked || !selectedStudent?.id || selectedAwardReason.trim().length === 0}
            title={!selectedStudent?.id ? '请先在左侧选择一名学生' : selectedAwardReason.trim().length === 0 ? '请填写具体表彰理由' : undefined}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-semibold text-[#1b1300] hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Medal className="h-4 w-4" />}
            核对并授予徽章
          </button>
          {!selectedStudent?.id && (
            <p className="mt-2 text-center text-[11px] text-slate-500">请先在左侧学生列表中选择一名学生再授予徽章</p>
          )}
        </div>
      </aside>

      {awardConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4" role="presentation">
          <div
            ref={awardDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="award-confirmation-title"
            aria-describedby="award-confirmation-description"
            className="w-full max-w-md rounded-lg border border-amber-300/25 bg-[#161b22] p-5 text-slate-100 shadow-2xl sm:p-6"
          >
            <h2 id="award-confirmation-title" className="text-lg font-semibold">确认课堂表彰</h2>
            <div id="award-confirmation-description" className="mt-4 space-y-3 text-sm leading-6">
              <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                <div><span className="text-slate-500">学生：</span><span className="font-semibold text-slate-100">{awardConfirmation.studentName}</span></div>
                <div className="mt-1"><span className="text-slate-500">徽章：</span><span className="text-amber-100">{awardConfirmation.achievementTitle}</span></div>
              </div>
              <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-3">
                <div className="text-xs text-amber-100/70">写入课堂记录的理由</div>
                <p className="mt-1 whitespace-pre-wrap break-words text-amber-50">{awardConfirmation.reason}</p>
              </div>
              {pendingAwardRequest && !actionLoading && (
                <div role="alert" className="rounded-md border border-red-300/25 bg-red-300/[0.06] p-3 text-xs text-red-100">
                  上一次授予结果尚未确认。学生、徽章和理由已锁定，只能使用原请求核对。
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={awardCancelButtonRef}
                type="button"
                onClick={() => {
                  if (actionInFlightRef.current || actionLoading || pendingAwardRequest) return;
                  setAwardConfirmation(null);
                  window.requestAnimationFrame(() => awardTriggerRef.current?.focus());
                }}
                disabled={actionLoading || pendingAwardRequest !== null}
                className="min-h-11 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={() => void awardMedal(pendingAwardRequest ?? awardConfirmation)}
                disabled={actionLoading}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-semibold text-[#1b1300] hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Medal className="h-4 w-4" />}
                {actionLoading ? '正在授予' : pendingAwardRequest ? '核对原授予请求' : '确认授予'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push Task Dialog */}
      {showPushDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closePushDialog} role="presentation">
          <div
            ref={pushDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="push-task-title"
            className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/[0.12] bg-[#161b22] p-5 text-slate-100 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h2 id="push-task-title" className="text-lg font-semibold">推送学习任务</h2>
              <button ref={pushCloseButtonRef} type="button" onClick={closePushDialog} disabled={pushControlsLocked} aria-label="关闭推送学习任务对话框" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {requestedReturnTo && pushScope === 'STUDENTS' && (
                <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2.5 text-xs leading-5 text-cyan-100">
                  本次补充任务提交成功后，将返回原班级和学期继续复核。
                </div>
              )}
              <div>
                <label id="push-topic-label" className="mb-1.5 block text-xs text-slate-400">教学内容</label>
                <Select
                  value={pushTopicId}
                  disabled={pushControlsLocked}
                  onValueChange={(value) => {
                    if (actionInFlightRef.current || pushControlsLocked) return;
                    setPushTopicId(value as typeof ADDRESSING_TOPIC_ID | 'chapter-review');
                    setPushConflict(null);
                    setPushRequestId(crypto.randomUUID());
                  }}
                >
                  <SelectTrigger aria-labelledby="push-topic-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                    <SelectItem value={ADDRESSING_TOPIC_ID}>3.1 寻址方式专项学习</SelectItem>
                    <SelectItem value="chapter-review">章节强化任务（兼容原任务）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label id="push-scope-label" className="mb-1.5 block text-xs text-slate-400">推送范围</label>
                <Select
                  value={pushScope}
                  disabled={pushControlsLocked}
                  onValueChange={(v) => {
                    if (actionInFlightRef.current || pushControlsLocked) return;
                    setPushScope(v as 'ALL' | 'CLASS' | 'STUDENTS');
                    setPushConflict(null);
                    setConfirmAllStudents(false);
                    setPushRequestId(crypto.randomUUID());
                    // 切到指定班级时默认选中第一个真实班级，避免空白选项
                    if (v === 'CLASS' && !(data?.classes ?? []).some((c) => c.id === pushClassId)) {
                      setPushClassId(data?.classes?.[0]?.id ?? '');
                    }
                  }}
                >
                  <SelectTrigger aria-labelledby="push-scope-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                    <SelectItem value="ALL">全部学生</SelectItem>
                    <SelectItem value="CLASS">指定班级</SelectItem>
                    <SelectItem value="STUDENTS" disabled={!selectedStudent?.id}>
                      当前学生{selectedStudent ? `：${selectedStudent.name}` : '（请先选择）'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pushScope === 'CLASS' && (
                <div>
                  <label id="push-class-label" className="mb-1.5 block text-xs text-slate-400">目标班级</label>
                  <Select value={pushClassId} disabled={pushControlsLocked} onValueChange={(value) => {
                    if (actionInFlightRef.current || pushControlsLocked) return;
                    setPushClassId(value);
                    setPushConflict(null);
                    setConfirmAllStudents(false);
                    setPushRequestId(crypto.randomUUID());
                  }}>
                    <SelectTrigger aria-labelledby="push-class-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue placeholder="选择班级" /></SelectTrigger>
                    <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                      {(data?.classes ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(data?.classes ?? []).length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-200">还没有可选班级，请先到「班级管理」创建班级。</p>
                  )}
                </div>
              )}
              {pushScope !== 'STUDENTS' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-100">
                  <input
                    type="checkbox"
                    checked={confirmAllStudents}
                    onChange={(event) => {
                      if (actionInFlightRef.current || pushControlsLocked) return;
                      setConfirmAllStudents(event.target.checked);
                    }}
                    disabled={pushControlsLocked}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-amber-300"
                  />
                  <span>
                    我确认本次将向{pushScope === 'ALL' ? '全部学生' : pushClassName}
                    （{pushTargetCount} 名）推送，并已核对已有学习路径的影响。
                  </span>
                </label>
              )}
              {pushTopicId === 'chapter-review' ? (
                <>
                  <div>
                    <label id="push-path-type-label" className="mb-1.5 block text-xs text-slate-400">任务类型</label>
                    <Select value={pushPathType} disabled={pushControlsLocked} onValueChange={(v) => {
                      if (actionInFlightRef.current || pushControlsLocked) return;
                      setPushPathType(v as 'BASIC' | 'ADVANCED');
                      setPushConflict(null);
                      setPushRequestId(crypto.randomUUID());
                    }}>
                      <SelectTrigger aria-labelledby="push-path-type-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                      <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                        <SelectItem value="BASIC">基础强化 — 面向基础薄弱学生</SelectItem>
                        <SelectItem value="ADVANCED">进阶提升 — 面向能力较强学生</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="push-module-count" className="mb-1.5 block text-xs text-slate-400">模块数量（1-10 章）</label>
                    <input id="push-module-count" type="range" min={1} max={10} value={pushModuleCount} disabled={pushControlsLocked} onChange={(e) => {
                      if (actionInFlightRef.current || pushControlsLocked) return;
                      setPushModuleCount(Number(e.target.value));
                      setPushConflict(null);
                      setPushRequestId(crypto.randomUUID());
                    }} className="w-full accent-cyan-400" />
                    <div className="text-center font-mono text-sm text-cyan-200">{pushModuleCount} 章</div>
                  </div>
                </>
              ) : (
                <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.05] p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-cyan-100">任务步骤预览</span>
                    <span className="font-mono text-cyan-200">{ADDRESSING_TASK_PRESET.steps.length} 步</span>
                  </div>
                  <ol className="mt-2 space-y-1.5">
                    {ADDRESSING_TASK_PRESET.steps.map((step, index) => (
                      <li key={step.stepId} className="flex gap-2 text-xs leading-5 text-slate-300">
                        <span className="font-mono text-cyan-300">{index + 1}</span>
                        <span>{step.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="rounded-md border border-white/[0.09] bg-black/20 px-3 py-2.5 text-xs leading-5 text-slate-300">
                <div className="text-[11px] text-slate-500">目标范围</div>
                {pushScope === 'STUDENTS' && selectedStudent ? (
                  <div className="mt-0.5">
                    <span className="font-semibold text-slate-100">{selectedStudent.name}</span>
                    <span className="ml-2 font-mono text-slate-400">{selectedStudent.studentId?.trim() || '未登记学号'}</span>
                    <span className="ml-2 text-slate-400">{selectedStudentClasses}</span>
                  </div>
                ) : (
                  <div className="mt-0.5 font-semibold text-slate-100">
                    {pushScope === 'ALL' ? '全部可管理学生' : pushClassName}
                  </div>
                )}
                <div className="mt-1">
                  预计推送给 <span className="font-mono font-semibold text-cyan-200">{pushTargetCount}</span> 名学生。
                </div>
                {pushTargetCount === 0 && <span className="ml-2 text-amber-200">当前范围没有可推送学生。</span>}
              </div>
              {pushConflict && (
                <div role="alert" className="rounded-md border border-amber-300/30 bg-amber-300/[0.09] p-3 text-xs leading-5 text-amber-100">
                  {pushConflict.confirmationState === 'STALE' && (
                    <span className="mb-1 block font-semibold">上一次确认已过期或期间任务状态发生变化，请重新核对本次影响。</span>
                  )}
                  目标 {pushConflict.targetCount} 名学生中有 {pushConflict.activePathCount} 条进行中的学习路径。继续后将暂停原路径，再创建“{pushTopicId === ADDRESSING_TOPIC_ID ? '3.1 寻址方式专项学习' : '章节强化任务'}”；原记录不会删除。
                  {!pushConflict.replacementToken && <span className="mt-1 block">确认信息未完整返回，请取消后重新打开。</span>}
                </div>
              )}
              {pendingPushRequest && !actionLoading && (
                <div role="alert" className="rounded-md border border-red-300/25 bg-red-300/[0.06] p-3 text-xs leading-5 text-red-100">
                  <span className="block font-semibold">推送结果待确认</span>
                  教学内容、范围和步骤已锁定。原请求编号 <span className="font-mono">{pendingPushRequest.requestId}</span>；
                  目标范围 {pendingPushRequest.scope} · {pendingPushRequest.targetCount} 名学生；记录时间 {new Date(pendingPushRequest.createdAt).toLocaleString('zh-CN', { hour12: false })}。
                  <span className="mt-1 block">{pendingVerificationMessage ?? '只会重新读取服务器记录，不会自动重复推送。'}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-white/[0.08] pt-4">
              {pendingPushRequest && pendingTeacherAction?.operation === 'PUSH_TASK' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void verifyPendingResult(pendingTeacherAction, { abandonIfUnconfirmed: true })}
                    disabled={pendingVerificationLoading}
                    className="min-h-11 rounded-md border border-red-300/25 px-4 text-sm text-red-100 hover:bg-red-300/[0.08] disabled:cursor-wait disabled:opacity-50"
                  >
                    放弃待核对并重新读取
                  </button>
                  <button
                    type="button"
                    onClick={() => void verifyPendingResult(pendingTeacherAction)}
                    disabled={pendingVerificationLoading}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"
                  >
                    {pendingVerificationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {pendingVerificationLoading ? '正在重新读取' : '重新读取核对'}
                  </button>
                </>
              ) : (
                <>
                  {requestedReturnTo && pushScope === 'STUDENTS' ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (actionInFlightRef.current || pushControlsLocked) return;
                        window.location.assign(requestedReturnTo);
                      }}
                      disabled={pushControlsLocked}
                      className="min-h-11 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      返回达成度复核
                    </button>
                  ) : (
                    <button type="button" onClick={closePushDialog} disabled={pushControlsLocked} className="min-h-11 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06] disabled:opacity-50">取消</button>
                  )}
                  <button
                    type="button"
                    onClick={() => void pushLearningTask()}
                    disabled={actionLoading || !pushRequestId || pushTargetCount === 0 || Boolean(pushConflict && !pushConflict.replacementToken) || (pushScope !== 'STUDENTS' && !confirmAllStudents) || (pushScope === 'CLASS' && !pushClassId) || (pushScope === 'STUDENTS' && !selectedStudent?.id)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50',
                      pushConflict ? 'bg-amber-300 text-[#1b1300] hover:bg-amber-200' : 'bg-cyan-300 text-[#001014] hover:bg-cyan-200',
                    )}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {actionLoading ? '正在推送' : pushConflict ? '暂停原路径并推送' : '确认推送'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Preclass Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => closeAssignDialog()} role="presentation">
          <div ref={assignDialogRef} role="dialog" aria-modal="true" aria-labelledby="assign-preclass-title" className="flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-lg border border-white/[0.12] bg-[#161b22] p-5 text-slate-100 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex shrink-0 items-center justify-between">
              <h2 id="assign-preclass-title" className="text-lg font-semibold">布置课前实验</h2>
              <button ref={assignCloseButtonRef} type="button" onClick={() => closeAssignDialog()} disabled={assignControlsLocked} aria-label="关闭布置课前实验对话框" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div>
                <label id="assign-experiment-label" className="mb-1.5 block text-xs text-slate-400">选择实验</label>
                <Select value={assignExpId} disabled={assignControlsLocked} onValueChange={(value) => {
                  if (actionInFlightRef.current || assignControlsLocked) return;
                  setAssignExpId(value);
                  setConfirmAssignBulk(false);
                  setAssignRequestId(crypto.randomUUID());
                }}>
                  <SelectTrigger aria-labelledby="assign-experiment-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100 max-h-[240px]">
                    {experimentCatalog.map((exp) => (
                      <SelectItem key={exp.id} value={exp.id}>
                        <span className="font-mono text-xs text-slate-500">{exp.id}</span> {exp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label id="assign-scope-label" className="mb-1.5 block text-xs text-slate-400">分配范围</label>
                <Select
                  value={assignScope}
                  disabled={assignControlsLocked}
                  onValueChange={(v) => {
                    if (actionInFlightRef.current || assignControlsLocked) return;
                    setAssignScope(v as 'ALL' | 'CLASS' | 'STUDENTS');
                    setConfirmAssignBulk(false);
                    setAssignRequestId(crypto.randomUUID());
                    // 切到指定班级时默认选中第一个真实班级，避免空白选项
                    if (v === 'CLASS' && !(data?.classes ?? []).some((c) => c.id === assignClassId)) {
                      setAssignClassId(data?.classes?.[0]?.id ?? '');
                    }
                  }}
                >
                  <SelectTrigger aria-labelledby="assign-scope-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue /></SelectTrigger>
                  <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                    <SelectItem value="ALL">全部学生</SelectItem>
                    <SelectItem value="CLASS">指定班级</SelectItem>
                    <SelectItem value="STUDENTS" disabled={!selectedStudentId || !selectedStudent?.id}>
                      当前学生{selectedStudentId && selectedStudent ? `：${selectedStudent.name}` : '（请先选择）'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {assignScope === 'CLASS' && (
                <div>
                  <label id="assign-class-label" className="mb-1.5 block text-xs text-slate-400">目标班级</label>
                  <Select value={assignClassId} disabled={assignControlsLocked} onValueChange={(value) => {
                    if (actionInFlightRef.current || assignControlsLocked) return;
                    setAssignClassId(value);
                    setConfirmAssignBulk(false);
                    setAssignRequestId(crypto.randomUUID());
                  }}>
                    <SelectTrigger aria-labelledby="assign-class-label" className="border-white/[0.09] bg-black/25 text-slate-100"><SelectValue placeholder="选择班级" /></SelectTrigger>
                    <SelectContent className="border-white/[0.12] bg-[#161b22] text-slate-100">
                      {(data?.classes ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(data?.classes ?? []).length === 0 && (
                    <p className="mt-1.5 text-xs text-amber-200">还没有可选班级，请先到「班级管理」创建班级。</p>
                  )}
                </div>
              )}
              {assignScope !== 'STUDENTS' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-300/25 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-100">
                  <input
                    type="checkbox"
                    checked={confirmAssignBulk}
                    onChange={(event) => {
                      if (actionInFlightRef.current || assignControlsLocked) return;
                      setConfirmAssignBulk(event.target.checked);
                    }}
                    disabled={assignControlsLocked}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-amber-300"
                  />
                  <span>
                    我确认本次将向{assignScope === 'CLASS' ? `${assignClassName}的` : '全部'} {assignTargetCount} 名学生布置“{selectedAssignExperiment?.title ?? assignExpId}”。
                  </span>
                </label>
              )}
              <div className="space-y-2 rounded-md border border-white/[0.09] bg-black/20 px-3 py-3 text-xs leading-5 text-slate-300">
                <div>
                  <span className="text-slate-500">目标：</span>
                  <span className="font-medium text-slate-100">{assignTargetSummary}</span>
                </div>
                <div>
                  <span className="text-slate-500">学生入口：</span>
                  我的任务 → 课前实验任务 → {selectedAssignExperiment?.title ?? assignExpId}
                </div>
                <div>
                  <span className="text-slate-500">完成条件：</span>
                  {assignExpId === 'exp02'
                    ? '无故障执行至少 20 条指令并覆盖规定的五种数据寻址方式，再点击“完成实验”；以服务端保存结果为准。'
                    : '程序无故障运行至正常结束后点击“完成实验”；以服务端保存结果为准。'}
                </div>
                <div>
                  <span className="text-slate-500">教师回查：</span>
                  推送回查 → 本教师布置的实验任务
                  {selectedAssignExperiment?.duration ? ` · 建议 ${selectedAssignExperiment.duration} 分钟` : ''}
                </div>
                <div>
                  预计布置给 <span className="font-mono font-semibold text-cyan-200">{assignTargetCount}</span> 名学生。
                </div>
                {assignTargetCount === 0 && <span className="ml-2 text-amber-200">当前范围没有可布置学生。</span>}
              </div>
              {pendingAssignRequest && !actionLoading && (
                <div role="alert" className="rounded-md border border-red-300/25 bg-red-300/[0.06] p-3 text-xs leading-5 text-red-100">
                  <span className="block font-semibold">布置结果待确认</span>
                  实验和目标范围已锁定。原请求编号 <span className="font-mono">{pendingAssignRequest.requestId}</span>；
                  目标范围 {pendingAssignRequest.scope} · {pendingAssignRequest.targetCount} 名学生；记录时间 {new Date(pendingAssignRequest.createdAt).toLocaleString('zh-CN', { hour12: false })}。
                  <span className="mt-1 block">{pendingVerificationMessage ?? '只会重新读取服务器记录，不会自动重复布置。'}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-white/[0.08] pt-4">
              {pendingAssignRequest && pendingTeacherAction?.operation === 'ASSIGN_EXPERIMENT' ? (
                <>
                  <button
                    type="button"
                    onClick={() => void verifyPendingResult(pendingTeacherAction, { abandonIfUnconfirmed: true })}
                    disabled={pendingVerificationLoading}
                    className="min-h-11 rounded-md border border-red-300/25 px-4 text-sm text-red-100 hover:bg-red-300/[0.08] disabled:cursor-wait disabled:opacity-50"
                  >
                    放弃待核对并重新读取
                  </button>
                  <button
                    type="button"
                    onClick={() => void verifyPendingResult(pendingTeacherAction)}
                    disabled={pendingVerificationLoading}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"
                  >
                    {pendingVerificationLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {pendingVerificationLoading ? '正在重新读取' : '重新读取核对'}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => closeAssignDialog()} disabled={assignControlsLocked} className="min-h-11 rounded-md border border-white/[0.1] px-4 text-sm text-slate-300 hover:bg-white/[0.06] disabled:opacity-50">取消</button>
                  <button type="button" onClick={() => void assignPreclass()} disabled={actionLoading || !assignRequestId || assignTargetCount === 0 || (assignScope !== 'STUDENTS' && !confirmAssignBulk) || (assignScope === 'CLASS' && !assignClassId) || (assignScope === 'STUDENTS' && (!selectedStudentId || !selectedStudent?.id))} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                    {actionLoading ? '正在布置' : '确认布置'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
