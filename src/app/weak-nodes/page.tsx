'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { ArrowRight, BookOpen, CheckCircle2, Cpu, Layers, Loader2, RotateCcw, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { knowledgePoints as staticKnowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';
import type { PublicQuestion } from '@/lib/quiz-data';
import { EmptyState } from '@/components/shared/EmptyState';
import { ADDRESSING_QUIZ_ID, ADDRESSING_REMEDIATION_STEP_ID } from '@/lib/lesson-tasks';
import { cn } from '@/lib/utils';

type AssessmentSnapshot = {
  weakKAs?: string[];
  totalScore?: number;
  timestamp?: string;
  quizId?: string;
  scoresByKA?: unknown;
  assessmentMode?: 'initial' | 'retest';
  questionSetVersion?: string;
};

type QuestionCatalogStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string(),
  note: z.string(),
});

const resourceSchema = z.object({
  type: z.enum(['video', 'animation', 'slide', 'quiz', 'document', 'experiment', 'image']),
  title: z.string(),
  url: z.string().optional(),
  refId: z.string().optional(),
  duration: z.number().optional(),
});

const knowledgePointSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  parentId: z.string().optional(),
  chapter: z.number(),
  description: z.string().optional(),
  graphNodeId: z.string().optional(),
  resources: z.array(resourceSchema).optional(),
  tutor: z.object({
    core: z.string(),
    whyImportant: z.string().optional(),
    commonMistake: z.string().optional(),
    takeaway: z.string().optional(),
  }).optional(),
  prerequisites: z.array(z.string()).optional(),
  appliedIn: z.array(z.string()).optional(),
  prerequisiteReasons: z.record(z.string(), z.string()).optional(),
});

const publicQuestionSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.number().int(),
    type: z.literal('multiple-choice'),
    questionText: z.string(),
    options: z.array(z.string()),
    ka: z.string(),
    chapter: z.number().int(),
  }),
  z.object({
    id: z.number().int(),
    type: z.literal('code-completion'),
    questionText: z.string(),
    code: z.string(),
    ka: z.string(),
    chapter: z.number().int(),
  }),
]);

const activitySchema = z.object({
  details: z.string().nullish(),
  createdAt: z.string().optional(),
});

const activitiesResponseSchema = z.object({
  success: z.literal(true),
  dataProvenance: dataProvenanceSchema.optional(),
  activities: z.array(activitySchema).optional(),
  data: z.array(activitySchema).optional(),
});

const quizActivityDetailsSchema = z.object({
  quizId: z.string().optional(),
  weakAreas: z.array(z.string()).optional(),
  scoresByKA: z.unknown().optional(),
  score: z.number().optional(),
  assessmentMode: z.enum(['initial', 'retest']).optional(),
  pathId: z.string().optional(),
  questionSetVersion: z.string().optional(),
});

const learningEventReceiptSchema = z.object({
  success: z.literal(true),
  accepted: z.number().int().min(0),
  duplicates: z.number().int().min(0),
  ignored: z.number().int().min(0),
});

const WEAK_NODES_LOAD_TIMEOUT_MS = 15_000;
const REMEDIATION_SAVE_TIMEOUT_MS = 20_000;

class WeakNodesRequestTimeoutError extends Error {
  constructor() {
    super('请求超时');
    this.name = 'WeakNodesRequestTimeoutError';
  }
}

async function fetchWeakNodesRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new WeakNodesRequestTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isRetryableRemediationStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

const HIERARCHICAL_ID = /^\d+(\.\d+)*$/;

function buildPointById(kps: KnowledgePoint[]): Record<string, KnowledgePoint> {
  const m: Record<string, KnowledgePoint> = {};
  for (const p of kps) m[p.id] = p;
  return m;
}

function buildExpTitleByRef(kps: KnowledgePoint[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of kps) {
    p.resources?.forEach((r) => {
      if (r.type === 'experiment' && r.refId && !m[r.refId]) m[r.refId] = r.title;
    });
  }
  return m;
}

function safeTaskReturnHref(value: string | null): string {
  if (!value || value.startsWith('//') || !/^\/tasks(?:[?#]|$)/.test(value)) return '/tasks';
  return value;
}

function appendTaskReturnContext(href: string, returnHref: string): string {
  if (returnHref === '/tasks') return href;
  const target = new URL(href, 'https://educog.local');
  target.searchParams.set('from', 'task-receipt');
  target.searchParams.set('returnTo', returnHref);
  return `${target.pathname}${target.search}${target.hash}`;
}

function formatTaskRecordId(pathId: string): string {
  return pathId.length > 8 ? pathId.slice(-8).toUpperCase() : pathId.toUpperCase();
}

export default function WeakNodesPage(): React.JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedQuizId = searchParams?.get('quizId') ?? null;
  const requestedMode = searchParams?.get('mode') === 'initial'
    ? 'initial'
    : searchParams?.get('mode') === 'retest'
      ? 'retest'
      : null;
  const taskPathId = searchParams?.get('taskPathId') ?? null;
  const taskStepId = searchParams?.get('taskStepId') ?? null;
  const recordPathId = searchParams?.get('pathId') ?? taskPathId;
  const taskReturnHref = safeTaskReturnHref(searchParams?.get('returnTo') ?? null);
  const currentSearchParams = searchParams?.toString() ?? '';
  const currentWeakNodesHref = `/weak-nodes${currentSearchParams ? `?${currentSearchParams}` : ''}`;
  const hasAnyTaskContext = Boolean(taskPathId || taskStepId);
  const taskLinkValidationError = hasAnyTaskContext && (
    requestedQuizId !== ADDRESSING_QUIZ_ID
    || requestedMode !== 'initial'
    || !taskPathId
    || recordPathId !== taskPathId
    || taskStepId !== ADDRESSING_REMEDIATION_STEP_ID
  )
    ? '补学任务链接与专项首测记录不匹配，请返回任务页重新进入。'
    : null;
  const hasExactReceiptContext = Boolean(requestedQuizId && requestedMode && recordPathId);
  const isTaskRemediation = !taskLinkValidationError
    && requestedQuizId === ADDRESSING_QUIZ_ID
    && requestedMode === 'initial'
    && Boolean(taskPathId && taskStepId === ADDRESSING_REMEDIATION_STEP_ID);
  const [snapshot, setSnapshot] = useState<AssessmentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [returnHref, setReturnHref] = useState(currentWeakNodesHref);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  const [reviewedWeakAreas, setReviewedWeakAreas] = useState<Set<string>>(() => new Set());
  const [confirmedNoWeakNodes, setConfirmedNoWeakNodes] = useState(false);
  const [reviewStateHydrated, setReviewStateHydrated] = useState(false);
  const completionRequestRef = useRef(false);
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>(staticKnowledgePoints);
  const [recordProvenance, setRecordProvenance] = useState<z.infer<typeof dataProvenanceSchema> | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<PublicQuestion[]>([]);
  const [questionCatalogStatus, setQuestionCatalogStatus] = useState<QuestionCatalogStatus>('idle');
  const remediationReviewRef = useRef<HTMLElement | null>(null);

  // Fetch knowledge points from API (DB-first) with static fallback
  useEffect(() => {
    if (authLoading || !user || user.role !== 'STUDENT') return;
    let active = true;
    async function load(): Promise<void> {
      try {
        const res = await fetchWeakNodesRequest(
          '/api/knowledge-graph?type=raw',
          { cache: 'no-store' },
          WEAK_NODES_LOAD_TIMEOUT_MS,
        );
        if (res.ok) {
          const rawJson: unknown = await res.json();
          const parsedJson = z.object({ data: z.array(knowledgePointSchema) }).safeParse(rawJson);
          if (active && parsedJson.success && parsedJson.data.data.length > 0) {
            setKnowledgePoints(parsedJson.data.data);
            return;
          }
        }
      } catch { /* fallback to static */ }
    }
    void load();
    return (): void => { active = false; };
  }, [authLoading, user]);

  useEffect(() => {
    if (window.location.pathname.startsWith('/weak-nodes')) {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    } else {
      setReturnHref(currentWeakNodesHref);
    }
  }, [currentWeakNodesHref]);

  useEffect(() => {
    let active = true;
    async function loadSnapshot(): Promise<void> {
      if (authLoading) return;
      if (!user || user.role !== 'STUDENT') {
        setSnapshot(null);
        setLoadError(null);
        setAccessErrorStatus(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(null);
      setAccessErrorStatus(null);
      setRecordProvenance(null);

      if (taskLinkValidationError) {
        setSnapshot(null);
        setLoadError(taskLinkValidationError);
        setLoading(false);
        return;
      }

      if (user && typeof window !== 'undefined') {
        const token = getStoredAccessToken();
        if (token) {
          try {
            const activityParams = new URLSearchParams({
              action: 'COMPLETE_QUIZ',
              limit: requestedQuizId || requestedMode || recordPathId ? '1' : '20',
            });
            if (requestedQuizId) activityParams.set('quizId', requestedQuizId);
            if (requestedMode) activityParams.set('assessmentMode', requestedMode);
            if (recordPathId) activityParams.set('pathId', recordPathId);
            const response = await fetchWeakNodesRequest(`/api/user/activities?${activityParams.toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
            }, WEAK_NODES_LOAD_TIMEOUT_MS);
            const rawData: unknown = await response.json().catch((): Record<string, never> => ({}));
            if (!response.ok) {
              if (active) {
                if (response.status === 401 || response.status === 403) {
                  setSnapshot(null);
                  setAccessErrorStatus(response.status);
                }
                setLoadError(response.status === 401
                  ? '登录已过期，请重新登录后查看正式诊断。'
                  : response.status === 403
                    ? '当前账号无权读取学生补学记录，请切换学生账号。'
                    : '正式测评记录加载失败，请稍后重试。');
              }
              setLoading(false);
              return;
            }
            const validatedData = activitiesResponseSchema.safeParse(rawData);
            if (!validatedData.success) {
              if (active) setLoadError('正式测评记录格式异常，请刷新后重试。');
              setLoading(false);
              return;
            }
            const activities = validatedData.data.activities ?? validatedData.data.data ?? [];
            if (active) setRecordProvenance(validatedData.data.dataProvenance ?? null);
            if (response.ok) {
              const parsed = activities.flatMap((activity) => {
                try {
                  const rawDetails: unknown = JSON.parse(activity.details ?? '{}');
                  const details = quizActivityDetailsSchema.safeParse(rawDetails);
                  return details.success ? [{ activity, details: details.data }] : [];
                } catch {
                  return [];
                }
              });
              const matched = parsed.find((item: { details: { quizId?: string; assessmentMode?: 'initial' | 'retest'; pathId?: string } }) => (
                (!requestedQuizId || item.details.quizId === requestedQuizId)
                && (!requestedMode || item.details.assessmentMode === requestedMode)
                && (!recordPathId || item.details.pathId === recordPathId)
              ));
              if (matched && active) {
                if (matched.details.score === undefined) {
                  setLoadError('正式测评记录不完整，请返回任务页后重试。');
                  setLoading(false);
                  return;
                }
                setSnapshot({
                  weakKAs: Array.isArray(matched.details.weakAreas) ? matched.details.weakAreas : [],
                  totalScore: matched.details.score,
                  scoresByKA: matched.details.scoresByKA,
                  quizId: matched.details.quizId,
                  assessmentMode: matched.details.assessmentMode,
                  questionSetVersion: matched.details.questionSetVersion,
                  timestamp: matched.activity.createdAt,
                });
                setAccessErrorStatus(null);
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            if (active) setLoadError(error instanceof WeakNodesRequestTimeoutError
              ? '正式测评记录加载超时，请重试。'
              : '网络异常，暂时无法读取正式测评记录。');
          }
        } else if (active) {
          setAccessErrorStatus(401);
          setLoadError('登录已过期，请重新登录后查看正式诊断。');
        }
      }

      if (active) {
        setSnapshot(null);
        setLoading(false);
      }
    }
    void loadSnapshot();
    return (): void => { active = false; };
  }, [authLoading, loadAttempt, recordPathId, requestedMode, requestedQuizId, taskLinkValidationError, user]);

  const isAddressingSnapshot = requestedQuizId === ADDRESSING_QUIZ_ID || snapshot?.quizId === ADDRESSING_QUIZ_ID;
  const snapshotModeLabel = snapshot?.assessmentMode === 'retest'
    ? '最近一次作答'
    : snapshot?.assessmentMode === 'initial' ? '首次作答' : '专项测评';
  const snapshotScoreLabel = snapshot?.assessmentMode === 'retest'
    ? '最近一次得分'
    : snapshot?.assessmentMode === 'initial' ? '首次作答得分' : '本次得分';

  const pointById = useMemo(() => buildPointById(knowledgePoints), [knowledgePoints]);
  const expTitleByRef = useMemo(() => buildExpTitleByRef(knowledgePoints), [knowledgePoints]);

  const weakNodes = useMemo((): KnowledgePoint[] => {
    const ids = (snapshot?.weakKAs ?? []).filter((ka) => HIERARCHICAL_ID.test(ka));
    return ids
      .map((id) => pointById[id])
      .filter((p): p is KnowledgePoint => Boolean(p));
  }, [snapshot, pointById]);
  const weakChapterKey = useMemo(
    () => [...new Set(weakNodes.map((node) => node.chapter))].sort((left, right) => left - right).join(','),
    [weakNodes],
  );

  useEffect(() => {
    if (authLoading || !user || user.role !== 'STUDENT' || !snapshot) {
      setAvailableQuestions([]);
      setQuestionCatalogStatus('idle');
      return;
    }
    let active = true;
    async function loadAvailableQuestions(): Promise<void> {
      setQuestionCatalogStatus('loading');
      const endpoints = isAddressingSnapshot
        ? [
            '/api/quiz/questions?topic=addressing-modes&mode=initial',
            '/api/quiz/questions?topic=addressing-modes&mode=retest',
          ]
        : weakChapterKey.split(',').filter(Boolean).map((chapterId) => `/api/quiz/questions?chapter=${chapterId}`);
      if (endpoints.length === 0) {
        setAvailableQuestions([]);
        setQuestionCatalogStatus('ready');
        return;
      }
      try {
        const responses = await Promise.all(endpoints.map((endpoint) => fetchWeakNodesRequest(
          endpoint,
          { cache: 'no-store' },
          WEAK_NODES_LOAD_TIMEOUT_MS,
        )));
        if (responses.some((response) => !response.ok)) throw new Error('题库暂不可用');
        const payloads: unknown[] = await Promise.all(responses.map((response) => response.json()));
        const parsed = payloads.map((payload) => z.object({ data: z.array(publicQuestionSchema) }).safeParse(payload));
        if (parsed.some((result) => !result.success)) throw new Error('题库格式异常');
        const deduplicated = new Map<number, PublicQuestion>();
        parsed.forEach((result) => {
          if (!result.success) return;
          result.data.data.forEach((question) => deduplicated.set(question.id, question));
        });
        if (active) {
          setAvailableQuestions([...deduplicated.values()]);
          setQuestionCatalogStatus('ready');
        }
      } catch {
        if (active) {
          setAvailableQuestions([]);
          setQuestionCatalogStatus('unavailable');
        }
      }
    }
    void loadAvailableQuestions();
    return (): void => { active = false; };
  }, [authLoading, isAddressingSnapshot, snapshot, user, weakChapterKey]);

  const otherWeakKAs = useMemo((): string[] => {
    return (snapshot?.weakKAs ?? []).filter((ka) => !HIERARCHICAL_ID.test(ka) || !pointById[ka]);
  }, [snapshot, pointById]);

  const requiredWeakAreas = useMemo(
    () => [...new Set((snapshot?.weakKAs ?? []).filter((item): item is string => typeof item === 'string' && item.trim().length > 0))].sort(),
    [snapshot?.weakKAs],
  );
  const remediationReviewStorageKey = isTaskRemediation && taskPathId && taskStepId
    ? `task-remediation-review:${taskPathId}:${taskStepId}`
    : null;
  const remediationReady = Boolean(snapshot) && (requiredWeakAreas.length > 0
    ? requiredWeakAreas.every((weakArea) => reviewedWeakAreas.has(weakArea))
    : confirmedNoWeakNodes);
  const reviewedCount = requiredWeakAreas.filter((weakArea) => reviewedWeakAreas.has(weakArea)).length;
  const remediationReviewProgress = requiredWeakAreas.length > 0
    ? Math.round((reviewedCount / requiredWeakAreas.length) * 100)
    : confirmedNoWeakNodes ? 100 : 0;

  const focusRemediationReview = (): void => {
    const target = remediationReviewRef.current;
    if (!target) return;
    target.scrollIntoView({ block: 'start', behavior: 'smooth' });
    window.setTimeout(() => target.focus({ preventScroll: true }), 250);
  };

  useEffect(() => {
    setReviewStateHydrated(false);
    setReviewedWeakAreas(new Set());
    setConfirmedNoWeakNodes(false);
    if (!remediationReviewStorageKey || typeof window === 'undefined') {
      setReviewStateHydrated(true);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(remediationReviewStorageKey) ?? '{}') as unknown;
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
        const record = stored as Record<string, unknown>;
        const reviewed = Array.isArray(record.reviewedWeakAreas)
          ? record.reviewedWeakAreas.filter((item): item is string => typeof item === 'string')
          : [];
        setReviewedWeakAreas(new Set(reviewed));
        setConfirmedNoWeakNodes(record.confirmedNoWeakNodes === true);
      }
    } catch {
      localStorage.removeItem(remediationReviewStorageKey);
    }
    setReviewStateHydrated(true);
  }, [remediationReviewStorageKey]);

  useEffect(() => {
    if (!remediationReviewStorageKey || !reviewStateHydrated || typeof window === 'undefined') return;
    localStorage.setItem(remediationReviewStorageKey, JSON.stringify({
      reviewedWeakAreas: [...reviewedWeakAreas].sort(),
      confirmedNoWeakNodes,
    }));
  }, [confirmedNoWeakNodes, remediationReviewStorageKey, reviewStateHydrated, reviewedWeakAreas]);

  const toggleReviewedWeakArea = (weakArea: string): void => {
    setReviewedWeakAreas((previous) => {
      const next = new Set(previous);
      if (next.has(weakArea)) next.delete(weakArea);
      else next.add(weakArea);
      return next;
    });
    setTaskActionError(null);
  };

  const goToReview = (): void => {
    if (!snapshot?.weakKAs?.length) return;
    // 薄弱点已经由服务端测评记录保存；学习路径重新读取服务端记录，
    // 不把可修改的 URL 参数当作正式诊断依据。
    router.push('/learning-path');
  };

  const completeTaskRemediation = async (): Promise<void> => {
    if (completionRequestRef.current) return;
    if (!taskPathId || !taskStepId) {
      router.push('/tasks');
      return;
    }
    if (!snapshot || !remediationReady) {
      setTaskActionError(requiredWeakAreas.length > 0
        ? '请逐项确认本次专项测评列出的全部薄弱项后再保存。'
        : '请先确认已核对本次无薄弱项诊断。');
      return;
    }
    completionRequestRef.current = true;
    setIsCompletingTask(true);
    setTaskActionError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setAccessErrorStatus(401);
        throw new Error('登录已过期，请重新登录后保存补学记录。');
      }
      const requestBody = JSON.stringify({
          events: [{
            clientEventId: `resource-complete:${taskPathId}:${taskStepId}`,
            eventType: 'RESOURCE_COMPLETED',
            targetType: 'REMEDIATION',
            targetId: '3.1',
            progress: 100,
            metadata: {
              source: 'weak-nodes',
              pathId: taskPathId,
              stepId: taskStepId,
              quizId: requestedQuizId,
              weakAreas: requiredWeakAreas,
              reviewedWeakAreas: [...reviewedWeakAreas].sort(),
              confirmedNoWeakNodes: requiredWeakAreas.length === 0 && confirmedNoWeakNodes,
            },
          }],
      });
      let saved = false;
      let lastError = '补学记录暂未确认，请保持当前页面后重试。';
      for (let requestAttempt = 0; requestAttempt < 2 && !saved; requestAttempt += 1) {
        let response: Response;
        try {
          response = await fetchWeakNodesRequest('/api/learning-events/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: requestBody,
          }, REMEDIATION_SAVE_TIMEOUT_MS);
        } catch (error) {
          const ambiguous = error instanceof TypeError || error instanceof WeakNodesRequestTimeoutError;
          if (ambiguous && requestAttempt === 0) continue;
          lastError = ambiguous
            ? '网络异常，补学记录暂未确认；再次保存会沿用同一编号。'
            : '补学记录保存失败，请重试。';
          break;
        }
        const result: unknown = await response.json().catch((): Record<string, never> => ({}));
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            setAccessErrorStatus(response.status);
          }
          if (isRetryableRemediationStatus(response.status) && requestAttempt === 0) continue;
          lastError = response.status === 401
            ? '登录已过期，请重新登录后保存补学记录。'
            : response.status === 403
              ? '当前账号无权保存学生补学记录，请切换学生账号。'
              : typeof result === 'object' && result !== null && typeof (result as Record<string, unknown>).error === 'string'
                ? String((result as Record<string, unknown>).error)
                : '补学记录保存失败，请重试。';
          break;
        }
        const receipt = learningEventReceiptSchema.safeParse(result);
        if (receipt.success && receipt.data.accepted + receipt.data.duplicates >= 1) {
          saved = true;
          break;
        }
        lastError = '补学记录回执不完整，完成状态暂未确认；请重试。';
        if (requestAttempt === 0) continue;
      }
      if (!saved) throw new Error(lastError);
      if (remediationReviewStorageKey) localStorage.removeItem(remediationReviewStorageKey);
      router.push('/tasks');
    } catch (error) {
      setTaskActionError(error instanceof Error ? error.message : '补学记录保存失败，请重试。');
    } finally {
      completionRequestRef.current = false;
      setIsCompletingTask(false);
    }
  };

  const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}${accessErrorStatus === 403 ? '&reason=student-role' : ''}`;

  if (authLoading) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-400 sm:-m-6" role="status">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在确认访问角色...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="w-full max-w-md rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <Target className="mx-auto h-6 w-6 text-cyan-200" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold">登录后查看个人补学诊断</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">登录后将返回当前任务步骤，保留测评、路径和阶段参数。</p>
          <Link href={loginRecoveryHref} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">前往登录</Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'STUDENT') {
    const destination = user.role === 'TEACHER' ? '/teacher' : '/admin';
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="w-full max-w-md rounded-md border border-amber-300/20 bg-amber-300/[0.04] p-6 text-center">
          <Target className="mx-auto h-6 w-6 text-amber-200" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-amber-100">该页仅展示学生个人薄弱点</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">当前账号不会读取或写入学生补学记录。</p>
          <Link href={destination} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
            {user.role === 'TEACHER' ? '返回教学仪表板' : '返回管理端'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <Target className="h-3.5 w-3.5" />
              Weak Nodes · 薄弱节点复习
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">薄弱点补学与完成确认</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              从服务端已提交的测评记录中读取薄弱节点，并汇总对应说明、关联实验和补学入口。
              {snapshot?.timestamp && ` 测验于 ${new Date(snapshot.timestamp).toLocaleString('zh-CN')}。`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {recordPathId && (
              <Link
                href={taskReturnHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] px-3 text-sm font-medium text-cyan-100 hover:bg-cyan-300/[0.12]"
              >
                返回本次任务记录
              </Link>
            )}
            {isTaskRemediation ? (
              <button
                type="button"
                onClick={focusRemediationReview}
                disabled={loading || Boolean(loadError) || !snapshot}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm font-medium text-cyan-100 hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                {loading ? '正在读取补学清单…' : '查看补学确认清单'}
              </button>
            ) : snapshot ? (
              <Link
                href={isAddressingSnapshot ? '/quiz?topic=addressing-modes&mode=retest' : '/quiz'}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08]"
              >
                <RotateCcw className="h-4 w-4" />
                {isAddressingSnapshot ? '专项巩固测验' : '重新测验'}
              </Link>
            ) : null}
            {snapshot?.weakKAs?.length && requestedQuizId !== ADDRESSING_QUIZ_ID ? (
              <button
                type="button"
                onClick={goToReview}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-[#001014] hover:bg-cyan-200"
              >
                生成学习路径
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 md:px-6">

        {loading && (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-6 text-sm text-slate-400" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            正在核对服务端测评回执与薄弱点…
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-col gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between" role="alert" aria-live="polite">
            <span>{loadError}</span>
            {accessErrorStatus ? (
              <Link
                href={loginRecoveryHref}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-red-300/30 px-3 font-medium text-red-100 transition hover:border-red-200/50 hover:bg-red-400/10"
              >
                {accessErrorStatus === 403 ? '切换学生账号并返回' : '重新登录并返回'}
              </Link>
            ) : loadError !== taskLinkValidationError ? (
              <button
                type="button"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-red-300/30 px-3 font-medium text-red-100 transition hover:border-red-200/50 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/70"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                重新读取正式记录
              </button>
            ) : null}
          </div>
        )}

        {taskActionError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert" aria-live="polite">
            <span>{taskActionError}</span>
            {accessErrorStatus && (
              <Link href={loginRecoveryHref} className="inline-flex min-h-11 items-center rounded-md border border-red-300/30 px-3 font-medium text-red-100 hover:bg-red-400/10">
                {accessErrorStatus === 403 ? '切换学生账号' : '重新登录'}
              </Link>
            )}
          </div>
        )}

        {!loading && snapshot && hasExactReceiptContext && (
          <section className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.045] px-4 py-3" aria-label="测评诊断上下文">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <span className="font-semibold text-cyan-100">诊断阶段：{snapshotModeLabel}</span>
              {recordPathId && (
                <span className="font-mono text-slate-300">任务记录号 #{formatTaskRecordId(recordPathId)}</span>
              )}
              <span className="font-mono text-slate-500">{snapshot.quizId ?? requestedQuizId}</span>
              {snapshot.timestamp && <span className="text-slate-500">服务端回执 {new Date(snapshot.timestamp).toLocaleString('zh-CN')}</span>}
            </div>
            {recordProvenance && (
              <p className="mt-2 text-[11px] leading-5 text-amber-100">
                <span className="font-semibold">{recordProvenance.label}：</span>{recordProvenance.note}
              </p>
            )}
            <p className={cn(
              'mt-2 text-[11px] leading-5',
              snapshot.questionSetVersion ? 'text-slate-500' : 'text-amber-100',
            )}>
              {snapshot.questionSetVersion
                ? `题面版本 ${snapshot.questionSetVersion}；本页按该服务端回执展示。`
                : '历史作答未保存题面版本：这里只回看已落盘的分数与薄弱点，不能用当前题面复现该次作答。'}
            </p>
          </section>
        )}

        {!loading && snapshot && recordProvenance && !hasExactReceiptContext && (
          <div
            role="note"
            className={cn(
              'rounded-md border px-4 py-3 text-xs leading-5',
              recordProvenance.mode === 'REAL'
                ? 'border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-100'
                : 'border-amber-300/25 bg-amber-300/[0.06] text-amber-100',
            )}
          >
            <span className="font-semibold">{recordProvenance.label}：</span>{recordProvenance.note}
          </div>
        )}

        {!loading && !snapshot && !loadError && (
          <EmptyState
            centered
            icon={Target}
            title={hasExactReceiptContext ? '未找到该任务的测评回执' : '还没有测验记录'}
            description={hasExactReceiptContext
              ? '当前任务状态仍然保留，但没有找到同时匹配任务编号、测评资源和测评阶段的服务端记录。请返回任务页，必要时由教师复核或补充干预。'
              : requestedQuizId === ADDRESSING_QUIZ_ID
                ? '先完成“3.1 寻址方式”专项测评。交卷成功后，系统会按本卷覆盖的七个子知识点生成补学清单。'
                : '先去做一次综合测验（或某章测验）。系统会自动识别得分低于 70% 的知识原子，作为薄弱节点出现在这里。'}
            action={{
              label: hasExactReceiptContext
                ? '返回任务查看完成状态'
                : requestedQuizId === ADDRESSING_QUIZ_ID ? '开始寻址方式专项测评' : '开始测验',
              href: hasExactReceiptContext
                ? '/tasks'
                : requestedQuizId === ADDRESSING_QUIZ_ID ? '/quiz?topic=addressing-modes' : '/quiz',
            }}
          />
        )}

        {!loading && snapshot && !snapshot.weakKAs?.length && (
          <EmptyState
            centered
            icon={Target}
            title={`${snapshotModeLabel}未识别到薄弱节点`}
            description={`服务端记录得分为 ${snapshot.totalScore === undefined ? '—' : `${Math.round(snapshot.totalScore)} 分`}。该结论只覆盖本次已提交的题目范围，不代表其他章节已经掌握。`}
            action={isTaskRemediation
              ? undefined
              : { label: isAddressingSnapshot ? '返回任务查看完成回执' : '返回我的任务', href: '/tasks' }}
          />
        )}

        {!loading && snapshot?.weakKAs?.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">薄弱节点</div>
                <div className="mt-1 font-mono text-2xl text-slate-50">{weakNodes.length}</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">综合薄弱项</div>
                <div className="mt-1 font-mono text-2xl text-slate-50">{otherWeakKAs.length}</div>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-4">
                <div className="text-xs text-slate-500">{snapshotScoreLabel}</div>
                <div className="mt-1 font-mono text-2xl text-slate-50">
                  {snapshot.totalScore !== undefined ? `${Math.round(snapshot.totalScore)} 分` : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {weakNodes.map((node) => (
                <WeakNodeCard
                  key={node.id}
                  node={node}
                  allKnowledgePoints={knowledgePoints}
                  pointById={pointById}
                  expTitleByRef={expTitleByRef}
                  lockFormalRetest={isTaskRemediation}
                  availableQuestions={availableQuestions}
                  questionCatalogStatus={questionCatalogStatus}
                />
              ))}
            </div>

            {otherWeakKAs.length > 0 && (
              <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <div className="mb-2 text-xs font-semibold text-amber-200">未对齐到知识图谱节点的薄弱项</div>
                <p className="text-xs text-slate-400">
                  以下薄弱项属于跨章节的综合应用类内容，暂不对应单个图谱节点，建议结合相关章节整体复习。
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {otherWeakKAs.map((ka) => (
                    <span
                      key={ka}
                      className="rounded-md border border-amber-300/15 bg-black/20 px-2 py-1 font-mono text-[11px] text-amber-100"
                    >
                      {ka}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {!loading && snapshot && isTaskRemediation && (
          <section
            ref={remediationReviewRef}
            tabIndex={-1}
            className="scroll-mt-20 rounded-md border border-cyan-300/25 bg-cyan-300/[0.055] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70"
            aria-labelledby="remediation-review-title"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="remediation-review-title" className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                  <CheckCircle2 className="h-4 w-4" />
                  补学完成确认
                </h2>
                <p id="remediation-review-help" className="mt-1 text-xs leading-5 text-slate-400">
                  {requiredWeakAreas.length > 0
                    ? '完成相关节点和推荐资源学习后逐项确认；全部确认后才能保存补学记录。'
                    : '本次未识别到薄弱项，仍需确认已核对服务端诊断，再进入后续实验。'}
                </p>
              </div>
              <span className="rounded-md border border-cyan-300/20 bg-black/20 px-2 py-1 font-mono text-[10px] text-cyan-200" role="status" aria-live="polite">
                {requiredWeakAreas.length > 0
                  ? `${reviewedCount}/${requiredWeakAreas.length} 已确认`
                  : confirmedNoWeakNodes ? '已确认' : '待确认'}
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="补学确认进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={remediationReviewProgress}
              aria-valuetext={requiredWeakAreas.length > 0 ? `${reviewedCount}/${requiredWeakAreas.length} 项已确认` : confirmedNoWeakNodes ? '范围已确认' : '范围待确认'}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
            >
              <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${remediationReviewProgress}%` }} />
            </div>

            <div className="mt-3 space-y-2" role="group" aria-describedby="remediation-review-help">
              {requiredWeakAreas.length > 0 ? requiredWeakAreas.map((weakArea, index) => {
                const point = pointById[weakArea];
                const checked = reviewedWeakAreas.has(weakArea);
                return (
                  <label
                    key={weakArea}
                    htmlFor={`remediation-review-${index}`}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/25"
                  >
                    <input
                      id={`remediation-review-${index}`}
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleReviewedWeakArea(weakArea)}
                      className="h-4 w-4 shrink-0 accent-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                    />
                    <span className="min-w-0">
                      <span className="font-mono text-[10px] text-cyan-300">#{weakArea}</span>
                      <span className="ml-2">{point?.name ?? '综合薄弱项'}</span>
                    </span>
                  </label>
                );
              }) : (
                <label
                  htmlFor="remediation-no-weak-confirmation"
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-xs leading-5 text-slate-300 hover:border-cyan-300/25"
                >
                  <input
                    id="remediation-no-weak-confirmation"
                    type="checkbox"
                    checked={confirmedNoWeakNodes}
                    onChange={(event) => {
                      setConfirmedNoWeakNodes(event.target.checked);
                      setTaskActionError(null);
                    }}
                    className="h-4 w-4 shrink-0 accent-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                  />
                  我已核对本次专项测评结果及适用范围，确认进入 exp02 实践步骤。
                </label>
              )}
            </div>

            <button
              type="button"
              onClick={() => { void completeTaskRemediation(); }}
              disabled={!remediationReady || isCompletingTask}
              aria-busy={isCompletingTask}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isCompletingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              {isCompletingTask ? '保存补学记录...' : remediationReady ? '保存并返回任务确认' : '完成全部确认后可保存'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function WeakNodeCard({
  node,
  allKnowledgePoints,
  pointById,
  expTitleByRef,
  lockFormalRetest,
  availableQuestions,
  questionCatalogStatus,
}: {
  node: KnowledgePoint;
  allKnowledgePoints: KnowledgePoint[];
  pointById: Record<string, KnowledgePoint>;
  expTitleByRef: Record<string, string>;
  lockFormalRetest: boolean;
  availableQuestions: PublicQuestion[];
  questionCatalogStatus: QuestionCatalogStatus;
}): React.JSX.Element {
  const parent = node.parentId ? pointById[node.parentId] : null;
  const children = allKnowledgePoints.filter((p) => p.parentId === node.id);
  const supportTutor = node.tutor ?? parent?.tutor;
  const supportResources = (node.resources?.length ? node.resources : parent?.resources ?? [])
    .filter((resource) => ['video', 'animation', 'slide', 'document'].includes(resource.type));
  const prereqs = (node.prerequisites ?? [])
    .map((id) => pointById[id])
    .filter((p): p is KnowledgePoint => Boolean(p));
  const appliedRefs = [...new Set([
    ...(node.appliedIn ?? []),
    ...(node.id === '3.1' || node.id.startsWith('3.1.') ? ['exp02'] : []),
  ])];
  const applied = appliedRefs.map((refId) => ({
    refId,
    title: expTitleByRef[refId] ?? refId,
  }));
  // L3 节点按 question.ka 精确计数；L2 节点汇总其子节点题目。
  // 只展示前三道公开题干，但标题保留完整题数，避免把“预览3题”误写成题库总量。
  const matchingQuestions = availableQuestions.filter((question) => (
    question.ka === node.id || (node.level < 3 && question.ka.startsWith(`${node.id}.`))
  ));
  const previewQuestions = matchingQuestions.slice(0, 3);

  return (
    <article className="overflow-hidden rounded-md border border-white/[0.08] bg-white/[0.035]">
      <div className="border-b border-white/[0.08] bg-[#0c1117] p-4">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-cyan-200">
          <span>NODE · CH{node.chapter}</span>
          <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-300">L{node.level}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-500">#{node.id}</span>
          <Link
            href={`/knowledge-graph?node=${encodeURIComponent(node.id)}`}
            className="ml-auto inline-flex min-h-11 items-center rounded-md px-2 text-[11px] text-cyan-300 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
          >
            在知识图谱查看 →
          </Link>
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-50">{node.name}</h3>
        {node.description && (
          <p className="mt-2 text-sm leading-6 text-slate-400">{node.description}</p>
        )}
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {supportTutor && (
            <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.035] p-3">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200">学习解释 · 仅作辅助</div>
              <p className="text-xs leading-5 text-slate-300">{supportTutor.core}</p>
              {supportTutor.commonMistake && (
                <p className="mt-2 text-xs leading-5 text-amber-100"><span className="font-medium">常见误区：</span>{supportTutor.commonMistake}</p>
              )}
              {supportTutor.takeaway && (
                <p className="mt-2 text-xs leading-5 text-slate-400"><span className="text-slate-300">学习要点：</span>{supportTutor.takeaway}</p>
              )}
              <p className="mt-2 text-[10px] text-slate-500">薄弱点与完成状态仍以服务端测评和任务记录为准。</p>
            </div>
          )}

          {supportResources.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <BookOpen className="h-3 w-3" />
                图谱推荐资源
              </div>
              <div className="flex flex-wrap gap-1.5">
                {supportResources.map((resource) => {
                  const addressingGraphHref = '/knowledge-graph?chapter=3&node=3.1';
                  const href = resource.url
                    ?? (resource.refId === 'anim-addressing-modes' ? `${addressingGraphHref}#addressing-compare` : addressingGraphHref);
                  return (
                    <Link
                      key={`${resource.type}-${resource.refId ?? resource.title}`}
                      href={href}
                      className="inline-flex min-h-11 items-center rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2 text-[11px] text-cyan-100 hover:border-cyan-300/35 hover:bg-cyan-300/[0.08]"
                    >
                      {resource.title}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {(parent !== null || prereqs.length > 0) && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <Layers className="h-3 w-3" />
                先修与上下文
              </div>
              <div className="flex flex-wrap gap-1.5">
                {parent && (
                  <Link
                    href={`/knowledge-graph?node=${encodeURIComponent(parent.id)}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    上级 / {parent.name}
                  </Link>
                )}
                {prereqs.map((p) => (
                  <Link
                    key={p.id}
                    href={`/knowledge-graph?node=${encodeURIComponent(p.id)}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    前置 / #{p.id} {p.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {applied.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <Cpu className="h-3 w-3" />
                配套实验
              </div>
              <div className="flex flex-wrap gap-1.5">
                {applied.map((exp) => lockFormalRetest && exp.refId === 'exp02' ? (
                  <span
                    key={exp.refId}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md border border-white/[0.08] bg-black/20 px-3 py-2 text-[11px] text-slate-500"
                    title="返回任务确认补学步骤后解锁实验"
                  >
                    <span className="font-mono text-[10px]">{exp.refId}</span>
                    <span>下一步：完成本步后解锁</span>
                  </span>
                ) : (
                  <Link
                    key={exp.refId}
                    href={`/simulation?experiment=${encodeURIComponent(exp.refId)}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md border border-emerald-300/15 bg-emerald-300/[0.04] px-3 py-2 text-[11px] text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-300/[0.08]"
                  >
                    <span className="font-mono text-[10px] text-emerald-300">{exp.refId}</span>
                    <span>{exp.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                <BookOpen className="h-3 w-3" />
                下级展开 · {children.length}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/knowledge-graph?node=${encodeURIComponent(c.id)}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-white/[0.06] bg-black/20 px-3 py-2 text-[11px] text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-cyan-200">本节自测 · {matchingQuestions.length}</div>
            {matchingQuestions.length > 0 && <span className="text-[10px] text-slate-500">答案在正式交卷后反馈</span>}
          </div>
          {questionCatalogStatus === 'loading' ? (
            <p className="text-[11px] text-slate-500" role="status">正在核对当前题集…</p>
          ) : questionCatalogStatus === 'unavailable' ? (
            <p className="text-[11px] text-amber-100" role="status">题目目录暂不可用；不影响节点补学，稍后可返回测评页核对。</p>
          ) : matchingQuestions.length === 0 ? (
            <p className="text-[11px] text-slate-500">当前题集未覆盖该节点，显示 0 题，不以 N/A 或其他节点题目代替。</p>
          ) : (
            <ul className="space-y-2">
              {previewQuestions.map((q, i) => (
                <li key={q.id} className="rounded-sm border border-white/[0.06] bg-black/30 p-2">
                  <div className="text-[11px] leading-5 text-slate-200">
                    Q{i + 1}. {q.questionText}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {matchingQuestions.length > previewQuestions.length && (
            <p className="mt-2 text-[10px] leading-4 text-slate-500">
              当前预览 {previewQuestions.length}/{matchingQuestions.length} 题；完整题集在正式测评页作答。
            </p>
          )}
          <Link
            href={lockFormalRetest
              ? `/knowledge-graph?node=${encodeURIComponent(node.id)}`
              : node.id === '3.1' || node.id.startsWith('3.1.')
                ? '/quiz?topic=addressing-modes&mode=retest'
                : `/quiz?chapter=${node.chapter}`}
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/[0.10] text-[11px] text-cyan-100 hover:bg-cyan-300/[0.18]"
          >
            {lockFormalRetest
              ? '返回图谱学习此节点'
              : node.id === '3.1' || node.id.startsWith('3.1.')
                ? '再次测评寻址方式'
                : '做本章 quiz'}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </article>
  );
}
