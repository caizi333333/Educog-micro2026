'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, BookOpen, CheckCircle2, Circle, Clock, FlaskConical, GitBranch, KeyRound, Loader2, LockKeyhole, PauseCircle, RefreshCw } from 'lucide-react';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { buildTaskNavigationReceipt, requiresTaskOpenReceiptBeforeNavigation } from '@/lib/lesson-tasks';
import { getStoredAccessToken } from '@/lib/auth-storage';
import { useAuth } from '@/contexts/AuthContext';

const TASK_ACTION_TIMEOUT_MS = 20_000;
const TASK_LOAD_TIMEOUT_MS = 15_000;

class TaskActionTimeoutError extends Error {}

async function fetchTaskAction(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TASK_ACTION_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (requestError) {
    if (controller.signal.aborted) throw new TaskActionTimeoutError('请求超时');
    throw requestError;
  } finally {
    clearTimeout(timeoutId);
  }
}

const assignedExperimentSchema = z.object({
  experimentId: z.string(),
  title: z.string(),
  duration: z.number().nullable(),
  assignedAt: z.string(),
  status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']),
  statusUpdatedAt: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  completionRule: z.string(),
  href: z.string(),
});

const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string(),
  note: z.string(),
});

const defaultDemoProvenance = {
  mode: 'DEMO' as const,
  label: '演示数据',
  note: '当前记录用于平台功能与教学流程演示，不作为真实教学成效结论。',
};

const taskStepSchema = z.object({
  stepId: z.string(),
  type: z.enum(['CHAPTER', 'GRAPH', 'ANIMATION', 'QUIZ', 'REMEDIATION', 'SIMULATION', 'RETEST']),
  title: z.string(),
  purpose: z.string(),
  completionRule: z.string(),
  href: z.string(),
  targetId: z.string(),
  status: z.enum(['COMPLETED', 'CURRENT', 'PENDING']),
  canMarkComplete: z.boolean(),
  receipt: z.object({
    verifiedAt: z.string().nullable(),
    coveredModes: z.array(z.string()),
  }).nullable().optional(),
  assessmentReceipt: z.object({
    submittedAt: z.string(),
    score: z.number().min(0).max(100),
    weakAreas: z.array(z.string()),
    questionSetVersion: z.string().nullable().default(null),
  }).nullable().optional(),
});

const activePathSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  startedAt: z.string(),
  currentModule: z.number(),
  totalModules: z.number(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']),
  completedAt: z.string().nullable(),
  dataIssue: z.string().nullable().optional(),
  curriculumStatus: z.enum(['CURRENT', 'LEGACY_9_CHAPTER']).default('CURRENT'),
  curriculumLabel: z.string().nullable().default(null),
  curriculumNote: z.string().nullable().default(null),
  missingChapterIds: z.array(z.string()).default([]),
  steps: z.array(taskStepSchema),
});

const tasksResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    dataProvenance: dataProvenanceSchema.default(defaultDemoProvenance),
    assignedExperiments: z.array(assignedExperimentSchema),
    activePaths: z.array(activePathSchema),
    completedPaths: z.array(activePathSchema),
    pausedPaths: z.array(activePathSchema),
    counts: z.object({
      assignedExperiments: z.number(),
      activePaths: z.number(),
      completedPaths: z.number(),
      pausedPaths: z.number(),
    }),
  }).optional(),
  error: z.string().optional(),
});

const learningEventReceiptSchema = z.object({
  success: z.literal(true),
  accepted: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  ignored: z.number().int().nonnegative(),
});

const stepCompletionReceiptSchema = z.object({
  success: z.literal(true),
  alreadyCompleted: z.boolean().optional(),
  currentModule: z.number().int().nonnegative(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']),
});

type ActivePath = z.infer<typeof activePathSchema>;
type AssignedExperiment = z.infer<typeof assignedExperimentSchema>;
type TasksResponse = z.infer<typeof tasksResponseSchema>;
type TasksData = NonNullable<TasksResponse['data']>;

function getErrorMessage(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

function getActionErrorMessage(response: Response, value: unknown, fallback: string): string {
  if (response.status === 401) return '登录已过期，请重新登录';
  if (response.status === 403) return '当前账号无权执行学生任务操作，请切换学生账号';
  return getErrorMessage(value, fallback);
}

function taskStepIsCompleted(data: TasksData, pathId: string, stepId: string): boolean {
  const path = [...data.activePaths, ...data.completedPaths, ...data.pausedPaths]
    .find((candidate) => candidate.id === pathId);
  return path?.steps.some((step) => step.stepId === stepId && step.status === 'COMPLETED') ?? false;
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatScore(score: number): string {
  return `${Math.round(score)} 分`;
}

function formatRecordId(pathId: string): string {
  return pathId.length > 8 ? pathId.slice(-8).toUpperCase() : pathId.toUpperCase();
}

function taskRecordAnchorId(pathId: string): string {
  return `task-record-${pathId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function CurriculumCompatibilityNotice({ path }: { path: ActivePath }): JSX.Element | null {
  if (path.curriculumStatus !== 'LEGACY_9_CHAPTER' || !path.curriculumNote) return null;
  return (
    <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-100" role="note">
      <div className="font-semibold">{path.curriculumLabel ?? '历史课程口径'}</div>
      <p className="mt-1 text-amber-100/80">{path.curriculumNote}</p>
    </div>
  );
}

function getStepActionLabel(step: ActivePath['steps'][number]): string {
  switch (step.type) {
    case 'GRAPH':
      return '进入图谱定位';
    case 'ANIMATION':
      return '开始动画学习';
    case 'QUIZ':
      return '开始专项测评';
    case 'REMEDIATION':
      return '进入薄弱点补学';
    case 'SIMULATION':
      return step.targetId === 'exp02' ? '进入 exp02 实践' : '进入仿真实践';
    case 'RETEST':
      return '开始再次测评';
    case 'CHAPTER':
      return '进入章节学习';
  }
}

function getAssignedExperimentPresentation(status: AssignedExperiment['status']): {
  label: string;
  action: string;
  detail: string;
  className: string;
} {
  if (status === 'COMPLETED') {
    return {
      label: '已完成',
      action: '查看完成记录',
      detail: '完成结果已由服务端保存；重新进入不会把状态改回进行中。',
      className: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100',
    };
  }
  if (status === 'IN_PROGRESS') {
    return {
      label: '进行中',
      action: '继续实验',
      detail: '开始状态已保存，刷新或重新登录后可继续。',
      className: 'border-amber-300/25 bg-amber-300/[0.08] text-amber-100',
    };
  }
  return {
    label: '待开始',
    action: '开始实验',
    detail: '进入实验后，平台会先确认“进行中”状态，再开放后续完成动作。',
    className: 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100',
  };
}

export default function MyTasksPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<TasksResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessErrorStatus, setAccessErrorStatus] = useState<401 | 403 | null>(null);
  const [returnHref, setReturnHref] = useState('/tasks');
  const [notice, setNotice] = useState<string | null>(null);
  const [completingStep, setCompletingStep] = useState<string | null>(null);
  const [openingStep, setOpeningStep] = useState<string | null>(null);
  const loadRequestRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const stepActionInFlightRef = useRef(false);

  const load = useCallback(async (): Promise<TasksData | null> => {
    const requestId = ++loadRequestRef.current;
    const isLatestRequest = (): boolean => loadRequestRef.current === requestId;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TASK_LOAD_TIMEOUT_MS);
    setLoading(true);
    setError(null);
    setAccessErrorStatus(null);
    try {
      const token = typeof window !== 'undefined' ? getStoredAccessToken() : null;
      if (!token) {
        if (isLatestRequest()) {
          setData(null);
          setAccessErrorStatus(401);
          setError('请先登录');
        }
        return null;
      }
      const res = await fetch('/api/me/tasks', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const rawJson: unknown = await res.json().catch((): null => null);
      if (!isLatestRequest()) return null;
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setData(null);
          setAccessErrorStatus(res.status);
        }
        setError(res.status === 401
          ? '登录已过期，请重新登录'
          : res.status === 403
            ? '当前账号无权读取学生任务'
            : getErrorMessage(rawJson, '任务服务暂时不可用，请稍后重试'));
        return null;
      }
      const parsedJson = tasksResponseSchema.safeParse(rawJson);
      if (!parsedJson.success) {
        setError('学习任务数据格式异常，请刷新重试');
        return null;
      }
      const json = parsedJson.data;
      if (res.ok && json.success && json.data) {
        setAccessErrorStatus(null);
        setData(json.data);
        return json.data;
      } else {
        if (res.status === 401) setData(null);
        setError(res.status === 401
          ? '登录已过期，请重新登录'
          : json.error?.trim() ? json.error : '加载失败');
        return null;
      }
    } catch {
      if (isLatestRequest()) {
        setError(timedOut
          ? '学习任务加载超时，请检查网络后重试'
          : '网络异常，学习任务加载失败，请重试');
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
      if (isLatestRequest()) setLoading(false);
    }
  }, []);

  const openTaskStep = async (pathId: string, step: ActivePath['steps'][number]): Promise<void> => {
    if (stepActionInFlightRef.current) return;
    stepActionInFlightRef.current = true;
    const stepKey = `${pathId}-${step.stepId}`;
    const mustPersistOpenReceipt = requiresTaskOpenReceiptBeforeNavigation(step);
    setOpeningStep(stepKey);
    setError(null);
    setNotice(null);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setData(null);
        setAccessErrorStatus(401);
        throw new Error('请先登录');
      }
      const navigationReceipt = buildTaskNavigationReceipt(step, pathId);
      if (!navigationReceipt) {
        throw new Error('学习步骤入口无效，未写入打开记录；请刷新后重试或联系教师重新布置');
      }
      let response: Response;
      try {
        response = await fetchTaskAction('/api/learning-events/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            events: [navigationReceipt],
          }),
        });
      } catch (requestError) {
        if (!mustPersistOpenReceipt) {
          window.location.assign(step.href);
          return;
        }
        if (requestError instanceof TaskActionTimeoutError || requestError instanceof TypeError) {
          throw new Error('学习步骤记录结果暂未确认，请再次点击进入；平台会按同一事件编号核对，不会重复记录');
        }
        throw new Error('网络异常，学习步骤记录未保存，请重试');
      }
      const result: unknown = await response.json().catch((): Record<string, never> => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setData(null);
          setAccessErrorStatus(response.status);
        }
        const retryable = response.status === 408
          || response.status === 425
          || response.status === 429
          || response.status >= 500;
        if (retryable && !mustPersistOpenReceipt) {
          window.location.assign(step.href);
          return;
        }
        const message = getActionErrorMessage(response, result, '学习步骤打开失败');
        throw new Error(retryable && mustPersistOpenReceipt ? `${message}，请再次点击进入` : message);
      }
      const receipt = learningEventReceiptSchema.safeParse(result);
      if (!receipt.success || receipt.data.accepted + receipt.data.duplicates < 1) {
        if (!mustPersistOpenReceipt) {
          window.location.assign(step.href);
          return;
        }
        throw new Error('学习步骤回执不完整，尚未进入学习页面，请重试');
      }
      window.location.assign(step.href);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : '学习步骤打开失败');
      setOpeningStep(null);
      stepActionInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (window.location.pathname.startsWith('/tasks')) {
      setReturnHref(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'STUDENT') {
      loadRequestRef.current += 1;
      loadAbortRef.current?.abort();
      setData(null);
      setError(null);
      setAccessErrorStatus(null);
      setLoading(false);
      return;
    }
    void load();
    return (): void => {
      loadRequestRef.current += 1;
      loadAbortRef.current?.abort();
    };
  }, [authLoading, load, user]);

  useEffect(() => {
    if (loading || !data) return;
    let firstFrame = 0;
    let secondFrame = 0;
    const scrollToTaskRecord = (): void => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith('task-record-')) return;
      const target = document.getElementById(hash);
      if (!target) return;
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => {
          target.scrollIntoView({ block: 'start', behavior: 'auto' });
          target.focus({ preventScroll: true });
        });
      });
    };
    scrollToTaskRecord();
    window.addEventListener('hashchange', scrollToTaskRecord);
    return (): void => {
      window.removeEventListener('hashchange', scrollToTaskRecord);
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [data, loading]);

  const completeManualStep = async (pathId: string, stepId: string): Promise<void> => {
    if (stepActionInFlightRef.current) return;
    stepActionInFlightRef.current = true;
    const stepKey = `${pathId}-${stepId}`;
    setCompletingStep(stepKey);
    setError(null);
    setNotice(null);
    const reconcileCompletion = async (): Promise<boolean> => {
      const refreshed = await load();
      if (refreshed && taskStepIsCompleted(refreshed, pathId, stepId)) {
        setError(null);
        setNotice('服务端已确认本步骤完成，任务进度已恢复。');
        return true;
      }
      return false;
    };
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setData(null);
        setAccessErrorStatus(401);
        throw new Error('请先登录');
      }
      let response: Response;
      try {
        response = await fetchTaskAction('/api/learning-path/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'COMPLETE_TASK_STEP', pathId, stepId }),
        });
      } catch (requestError) {
        if (requestError instanceof TaskActionTimeoutError || requestError instanceof TypeError) {
          const recovered = await reconcileCompletion();
          if (!recovered) {
            setError('完成结果暂未确认。可再次点击确认，服务端会核对当前步骤，不会重复推进。');
          }
          return;
        }
        throw requestError;
      }
      const result: unknown = await response.json().catch((): Record<string, never> => ({}));
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setData(null);
          setAccessErrorStatus(response.status);
          throw new Error(getActionErrorMessage(response, result, '步骤状态更新失败'));
        }
        const retryable = response.status === 408
          || response.status === 425
          || response.status === 429
          || response.status === 409
          || response.status >= 500;
        if (retryable) {
          const recovered = await reconcileCompletion();
          if (recovered) return;
          const message = getActionErrorMessage(response, result, '步骤状态更新失败');
          setError(response.status === 409 ? message : `${message}；当前结果未确认，可安全重试`);
          return;
        }
        throw new Error(getActionErrorMessage(response, result, '步骤状态更新失败'));
      }
      const receipt = stepCompletionReceiptSchema.safeParse(result);
      if (!receipt.success) {
        const recovered = await reconcileCompletion();
        if (!recovered) setError('步骤完成回执格式异常，当前结果未确认，请刷新后重试。');
        return;
      }
      const refreshed = await load();
      if (refreshed) {
        setNotice(receipt.data.alreadyCompleted ? '本步骤此前已完成，任务进度已恢复。' : '本步骤已完成，任务进度已更新。');
      } else {
        setError('服务端已确认本步骤完成，但最新任务状态加载失败，请刷新重试。');
      }
    } catch (stepError) {
      setError(stepError instanceof Error ? stepError.message : '步骤状态更新失败');
    } finally {
      stepActionInFlightRef.current = false;
      setCompletingStep(null);
    }
  };

  useEffect(() => {
    if (authLoading || !user || user.role !== 'STUDENT') return;
    const onFocus = (): void => { void load(); };
    window.addEventListener('focus', onFocus);
    const onVisible = (): void => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return (): void => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [authLoading, load, user]);

  if (authLoading) {
    return (
      <div className="-m-4 min-h-[calc(100vh-3.5rem)] bg-[#070a0d] px-4 py-8 text-slate-100 sm:-m-6 md:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-6 text-sm text-slate-400" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在确认访问角色...
        </div>
      </div>
    );
  }

  const loginRecoveryHref = `/login?from=${encodeURIComponent(returnHref)}${accessErrorStatus === 403 ? '&reason=student-role' : ''}`;

  if (!user) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] p-6 text-slate-100 sm:-m-6">
        <div className="w-full max-w-md rounded-md border border-white/[0.08] bg-white/[0.035] p-6 text-center">
          <LockKeyhole className="mx-auto h-6 w-6 text-cyan-200" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold text-slate-50">登录后查看个人学习任务</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">登录成功后将返回当前任务链接，保留批次、步骤和页面位置。</p>
          <Link href={loginRecoveryHref} className="mt-4 inline-flex min-h-11 items-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-[#001014] hover:bg-cyan-200">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (user && user.role !== 'STUDENT') {
    const isTeacher = user.role === 'TEACHER';
    return (
      <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
        <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-xs text-amber-100">
              <Activity className="h-3.5 w-3.5" />
              {isTeacher ? 'Teacher · 教师任务管理' : 'Admin · 管理入口'}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
              {isTeacher ? '请从教学仪表板管理学生任务' : '当前账号不使用学生任务页'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              “我的学习任务”用于学生查看个人学习路径。{isTeacher ? '教师应先选择教学内容和目标学生，再推送并回查任务状态。' : '请返回管理端选择相应功能。'}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-6 md:px-6">
          <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.045] p-5">
            <div className="flex items-start gap-3">
              <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
              <div>
                <h2 className="text-sm font-semibold text-slate-100">下一步</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {isTeacher
                    ? '在教学仪表板完成定向布置；推送后进入回查页核对目标、步骤和学生进度。'
                    : '返回管理端继续处理账号、课程与平台配置。'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={isTeacher ? '/teacher' : '/admin'}
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                {isTeacher ? '返回教学仪表板' : '返回管理端'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {isTeacher && (
                <Link
                  href="/teacher/pushed"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-sm text-slate-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
                >
                  查看推送记录
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalCount = (data?.counts.assignedExperiments ?? 0) + (data?.counts.activePaths ?? 0);

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <Clock className="h-3.5 w-3.5" />
              Tasks · 我的任务
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">我的学习任务</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              老师布置给你的实验和学习路径会自动出现在这里。
              {!loading && data && totalCount === 0 && '当前没有待处理的任务。'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/classes/join"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 text-sm text-cyan-100 hover:bg-cyan-300/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
            >
              <KeyRound className="h-4 w-4" />
              加入班级
            </Link>
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                void load();
              }}
              disabled={loading}
              aria-busy={loading}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-slate-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              {loading ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 md:px-6">

        {notice && (
          <div className="rounded-md border border-emerald-300/25 bg-emerald-300/[0.08] px-4 py-3 text-sm text-emerald-100" role="status" aria-live="polite">
            {notice}
          </div>
        )}

        {data && (
          <div className={cn(
            'rounded-md border px-4 py-3 text-xs leading-5',
            data.dataProvenance.mode === 'REAL'
              ? 'border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-100'
              : 'border-amber-300/25 bg-amber-300/[0.06] text-amber-100',
          )} data-testid="task-data-provenance">
            <span className="font-semibold">{data.dataProvenance.label}：</span>
            {data.dataProvenance.note}
          </div>
        )}

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert" aria-live="polite">
            <span>{error}</span>
            {accessErrorStatus ? (
              <Link href={loginRecoveryHref} className="inline-flex min-h-11 items-center rounded-md border border-red-300/25 px-3 font-medium underline-offset-2 hover:bg-red-300/10 hover:text-red-200">
                {accessErrorStatus === 403 ? '切换学生账号' : '重新登录'}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                aria-busy={loading}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-red-300/25 px-3 font-medium hover:bg-red-300/10 disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
                {loading ? '重试中…' : '重试'}
              </button>
            )}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-6 text-sm text-slate-400" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            正在读取任务、步骤和完成回执…
          </div>
        )}

        {data && (
          <>
            <section>
              <div className="mb-2 flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-emerald-200" />
                <h2 className="text-sm font-semibold text-slate-100">当前学习路径</h2>
                <span className="font-mono text-xs text-slate-500">{data.counts.activePaths}</span>
              </div>
              {data.activePaths.length > 0 && (
                <p className="mb-3 text-xs leading-5 text-slate-500">
                  只推进标记为“当前步骤”的动作；后续步骤会在服务端确认完成后依次解锁。
                </p>
              )}
              {data.activePaths.length === 0 ? (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm leading-6 text-slate-500">
                  当前没有进行中的学习路径。可先完成下方课前实验，或回看最近完成任务。
                </div>
              ) : (
                <div className="space-y-3">
                  {data.activePaths.map((path) => {
                    const currentStepIndex = path.steps.findIndex((step) => step.status === 'CURRENT');
                    const currentStep = currentStepIndex >= 0 ? path.steps[currentStepIndex] : null;
                    const progressPercent = path.totalModules > 0
                      ? Math.min(100, Math.round((path.currentModule / path.totalModules) * 100))
                      : 0;
                    return (
                    <div
                      key={path.id}
                      className="overflow-hidden rounded-md border border-emerald-300/20 bg-emerald-300/[0.04] shadow-[0_18px_50px_rgba(0,0,0,0.16)]"
                    >
                      <div className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-emerald-100">{path.name}</h3>
                          {path.description && (
                            <p className="mt-1 text-xs text-slate-400">{path.description}</p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-md border border-emerald-300/15 bg-black/20 px-2 py-1 font-mono text-[11px] text-emerald-200">
                          {path.currentModule}/{path.totalModules} 步 · {progressPercent}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${path.name}完成进度`}
                        aria-valuemin={0}
                        aria-valuemax={path.totalModules}
                        aria-valuenow={Math.min(path.currentModule, path.totalModules)}
                        aria-valuetext={`${path.currentModule}/${path.totalModules} 步，完成 ${progressPercent}%`}
                        className="mt-2 h-1.5 w-full overflow-hidden rounded-sm bg-emerald-300/10"
                      >
                        <div
                          className="h-full bg-emerald-300/70"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      {currentStep && (
                        <div className="mt-3 flex flex-col gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/75">当前只需完成</div>
                            <div className="mt-1 text-sm font-semibold text-cyan-50">步骤 {currentStepIndex + 1} · {currentStep.title}</div>
                            <div className="mt-1 text-xs leading-5 text-slate-400">完成标志：{currentStep.completionRule}</div>
                          </div>
                          <span className="shrink-0 text-xs text-cyan-200">完成后自动解锁下一步</span>
                        </div>
                      )}
                      {path.dataIssue && (
                        <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-100" role="alert">
                          {path.dataIssue}
                        </div>
                      )}
                      <CurriculumCompatibilityNotice path={path} />
                      {path.steps.length > 0 && (
                        <ol className="mt-4 space-y-2">
                          {path.steps.map((step, index) => {
                            const isCurrent = step.status === 'CURRENT';
                            const isCompleted = step.status === 'COMPLETED';
                            const stepKey = `${path.id}-${step.stepId}`;
                            return (
                              <li
                                key={stepKey}
                                aria-current={isCurrent ? 'step' : undefined}
                                className={cn(
                                  'rounded-md border p-3',
                                  isCurrent && 'border-cyan-300/35 bg-cyan-300/[0.06]',
                                  isCompleted && 'border-emerald-300/15 bg-emerald-300/[0.025]',
                                  step.status === 'PENDING' && 'border-white/[0.06] bg-black/15 opacity-70',
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 shrink-0" aria-hidden="true">
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                                    ) : isCurrent ? (
                                      <Circle className="h-5 w-5 fill-cyan-300/20 text-cyan-300" />
                                    ) : (
                                      <LockKeyhole className="h-5 w-5 text-slate-600" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-[10px] text-cyan-300">步骤 {index + 1}</span>
                                      <span className={cn('text-sm font-medium', isCompleted ? 'text-slate-400' : 'text-slate-100')}>{step.title}</span>
                                      <span className={cn(
                                        'rounded-sm px-1.5 py-0.5 text-[10px]',
                                        isCompleted ? 'bg-emerald-300/10 text-emerald-200' : isCurrent ? 'bg-cyan-300/10 text-cyan-100' : 'bg-white/[0.04] text-slate-500',
                                      )}>
                                        {isCompleted ? '已完成' : isCurrent ? '当前步骤' : '待解锁'}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-slate-400"><span className="text-slate-300">目的：</span>{step.purpose}</p>
                                    <p className="text-xs leading-5 text-slate-500"><span className="text-slate-400">完成条件：</span>{step.completionRule}</p>
                                    {isCurrent && (
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => openTaskStep(path.id, step)}
                                          disabled={openingStep !== null || completingStep !== null}
                                          aria-busy={openingStep === stepKey}
                                          className="inline-flex min-h-11 items-center gap-2 rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#001014] hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {openingStep === stepKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                                          {openingStep === stepKey ? '正在打开…' : getStepActionLabel(step)}
                                        </button>
                                        {step.canMarkComplete && (
                                          <button
                                            type="button"
                                            onClick={() => completeManualStep(path.id, step.stepId)}
                                            disabled={openingStep !== null || completingStep !== null}
                                            aria-busy={completingStep === stepKey}
                                            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/[0.07] px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            {completingStep === stepKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                            {completingStep === stepKey ? '正在确认...' : '确认完成本步'}
                                          </button>
                                        )}
                                        {!step.canMarkComplete && (
                                          <span className="inline-flex min-h-11 items-center rounded-md border border-white/[0.08] px-3 py-2 text-[11px] text-slate-500">
                                            {['GRAPH', 'ANIMATION', 'REMEDIATION', 'CHAPTER'].includes(step.type)
                                              ? '进入并完成学习后可确认'
                                              : '完成结果由服务端自动判定'}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                      <div className="mt-3 text-[11px] text-slate-500">
                        开始于 {formatDate(path.startedAt)}
                      </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-200" />
                <h2 className="text-sm font-semibold text-slate-100">课前实验任务</h2>
                <span className="font-mono text-xs text-slate-500">{data.counts.assignedExperiments}</span>
              </div>
              {data.assignedExperiments.length > 0 && (
                <p className="mb-2 text-[11px] leading-5 text-slate-500">
                  按“待开始 → 进行中 → 已完成”推进；刷新或重新登录后仍以服务端状态为准。
                </p>
              )}
              {data.assignedExperiments.length === 0 ? (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-5 text-sm text-slate-500">
                  暂无被布置的实验。
                </div>
              ) : (
                <div className="space-y-2">
                  {data.assignedExperiments.map((exp) => {
                    const presentation = getAssignedExperimentPresentation(exp.status);
                    return (
                      <Link
                        key={exp.experimentId}
                        href={exp.href}
                        className="group block rounded-md border border-white/[0.08] bg-white/[0.035] px-4 py-3 hover:border-cyan-300/30 hover:bg-cyan-300/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-2 py-0.5 font-mono text-[10px] text-cyan-100">
                              {exp.experimentId}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-medium text-slate-100 group-hover:text-cyan-100">{exp.title}</span>
                          <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', presentation.className)}>
                            {presentation.label}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          {exp.duration !== null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              建议 {exp.duration} 分钟
                            </span>
                          )}
                          <span>布置于 {formatDate(exp.assignedAt)}</span>
                          {exp.status === 'IN_PROGRESS' && exp.startedAt && <span>开始于 {formatDate(exp.startedAt)}</span>}
                          {exp.status === 'COMPLETED' && exp.completedAt && <span>完成于 {formatDate(exp.completedAt)}</span>}
                        </div>
                        <div className="mt-2 rounded-md border border-white/[0.06] bg-black/15 px-3 py-2 text-[11px] leading-5 text-slate-400">
                          <span className="font-medium text-slate-300">完成条件：</span>{exp.completionRule}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">{presentation.detail}</span>
                          <span className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-cyan-200">
                            {presentation.action}
                            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                <h2 className="text-sm font-semibold text-slate-100">完成回执与学习结果</h2>
                <span className="font-mono text-xs text-slate-500">{data.counts.completedPaths}</span>
              </div>
              {data.completedPaths.length > 1 && (
                <p className="mb-2 text-[11px] leading-5 text-slate-500">
                  每张卡对应一次独立布置；同名任务按记录号保留，不合并覆盖。
                </p>
              )}
              {data.completedPaths.length === 0 ? (
                <div className="rounded-md border border-white/[0.08] bg-white/[0.025] px-4 py-4 text-sm text-slate-500">尚无已完成的学习路径。</div>
              ) : (
                <div className="space-y-2">
                  {data.completedPaths.map((path) => {
                    const initialQuiz = path.steps.find((step) => step.type === 'QUIZ' && step.targetId === 'quiz-ch3-addressing');
                    const experiment = path.steps.find((step) => step.type === 'SIMULATION' && step.targetId === 'exp02');
                    const retestQuiz = path.steps.find((step) => step.type === 'RETEST' && step.targetId === 'quiz-ch3-addressing');
                    const isAddressingTask = Boolean(initialQuiz && experiment && retestQuiz);
                    const initialReceipt = initialQuiz?.assessmentReceipt ?? null;
                    const retestReceipt = retestQuiz?.assessmentReceipt ?? null;
                    const scoreDelta = initialReceipt && retestReceipt
                      ? Math.round(retestReceipt.score - initialReceipt.score)
                      : null;
                    const resolvedWeakAreas = initialReceipt && retestReceipt
                      ? initialReceipt.weakAreas.filter((weakArea) => !retestReceipt.weakAreas.includes(weakArea))
                      : [];
                    const hasUnversionedAssessmentReceipt = Boolean(
                      (initialReceipt && !initialReceipt.questionSetVersion)
                      || (retestReceipt && !retestReceipt.questionSetVersion),
                    );
                    const recordReturnHref = `/tasks#${taskRecordAnchorId(path.id)}`;
                    return (
                    <article
                      key={path.id}
                      id={taskRecordAnchorId(path.id)}
                      tabIndex={-1}
                      className="scroll-mt-20 rounded-md border border-emerald-300/15 bg-emerald-300/[0.035] p-4 target:border-cyan-300/45 target:ring-2 target:ring-cyan-300/15"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-emerald-100">{path.name}</h3>
                          <p className="mt-1 text-xs text-slate-500">
                            {path.completedAt ? `完成于 ${formatDate(path.completedAt)}` : '已完成'} · {path.totalModules}/{path.totalModules} 步
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-slate-600">
                            记录号 #{formatRecordId(path.id)} · 开始于 {formatDate(path.startedAt)}
                          </p>
                        </div>
                        <span className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] px-2 py-1 text-[10px] text-emerald-200">完成回执</span>
                      </div>
                      <CurriculumCompatibilityNotice path={path} />
                      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                        {path.steps.map((step, index) => (
                          <li key={step.stepId} className="flex items-center gap-2 rounded border border-white/[0.06] bg-black/20 px-2.5 py-2 text-[11px] text-slate-400">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                            <span className="font-mono text-slate-600">{index + 1}</span>
                            <span className="truncate">{step.title}</span>
                          </li>
                        ))}
                      </ol>
                      {isAddressingTask && (
                        <div className="mt-4 border-t border-emerald-300/10 pt-4">
                          <div className="mb-2 text-[11px] text-slate-500">完成结果可回看；打开记录不会改变已完成状态。自主巩固会生成新的练习记录。</div>
                          {initialReceipt && retestReceipt ? (
                            <div className="mb-3 rounded-md border border-cyan-300/20 bg-cyan-300/[0.045] p-3" aria-label="同一专项测验多次作答变化">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs font-semibold text-cyan-100">同一专项测验多次作答变化</div>
                                <span className="font-mono text-[10px] text-slate-500">服务端任务回执</span>
                              </div>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                <div className="rounded border border-white/[0.07] bg-black/20 px-2.5 py-2">
                                  <div className="text-[10px] text-slate-500">首次作答</div>
                                  <div className="mt-1 font-mono text-sm text-slate-100">{formatScore(initialReceipt.score)}</div>
                                </div>
                                <div className="rounded border border-white/[0.07] bg-black/20 px-2.5 py-2">
                                  <div className="text-[10px] text-slate-500">最近一次作答</div>
                                  <div className="mt-1 font-mono text-sm text-slate-100">{formatScore(retestReceipt.score)}</div>
                                </div>
                                <div className="rounded border border-white/[0.07] bg-black/20 px-2.5 py-2">
                                  <div className="text-[10px] text-slate-500">分数变化</div>
                                  <div className={cn(
                                    'mt-1 font-mono text-sm',
                                    scoreDelta !== null && scoreDelta > 0
                                      ? 'text-emerald-200'
                                      : scoreDelta !== null && scoreDelta < 0 ? 'text-amber-200' : 'text-slate-100',
                                  )}>
                                    {scoreDelta !== null && scoreDelta > 0 ? '+' : ''}{scoreDelta ?? 0} 分
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-400">
                                {resolvedWeakAreas.length > 0 && (
                                  <p><span className="text-emerald-200">本次已解除：</span>{resolvedWeakAreas.join('、')}</p>
                                )}
                                <p>
                                  <span className={retestReceipt.weakAreas.length > 0 ? 'text-amber-200' : 'text-emerald-200'}>
                                    {retestReceipt.weakAreas.length > 0 ? '仍需关注：' : '最近一次诊断：'}
                                  </span>
                                  {retestReceipt.weakAreas.length > 0
                                    ? retestReceipt.weakAreas.join('、')
                                    : '本次已提交题目范围内未识别到薄弱点'}
                                </p>
                              </div>
                              <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] leading-4 text-slate-500">
                                该变化仅表示同一任务、同一专项测验的首次与最近一次作答结果，不外推为真实教学成效。
                              </p>
                              {hasUnversionedAssessmentReceipt && (
                                <p className="mt-2 rounded border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-100">
                                  历史作答未保存题面版本：这里只回看已落盘的分数与薄弱点，不能用当前题面复现该次作答。
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="mb-3 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100" role="status">
                              数据不足：未找到同时匹配本任务记录、专项测验编号和作答阶段的两次服务端回执，暂不计算分数变化。
                            </div>
                          )}
                          {experiment?.receipt ? (
                            <div className="mb-3 rounded-md border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-xs leading-5 text-emerald-100" role="status">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="inline-flex items-center gap-1.5 font-medium">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  exp02 服务端复核完成
                                </span>
                                {experiment.receipt.verifiedAt && <span className="text-emerald-200/70">复核于 {formatDate(experiment.receipt.verifiedAt)}</span>}
                              </div>
                              <div className="mt-1 text-emerald-200/75">
                                {experiment.receipt.coveredModes.length > 0
                                  ? `已记录寻址方式：${experiment.receipt.coveredModes.join('、')}`
                                  : '实验完成回执已保存；早期记录未包含寻址方式明细。'}
                              </div>
                            </div>
                          ) : (
                            <div className="mb-3 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100" role="status">
                              exp02 已计入任务完成状态，但当前缺少可下钻的服务端实验明细；重新进入实验不会改写原完成回执。
                            </div>
                          )}
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <Link
                              href={`/weak-nodes?quizId=quiz-ch3-addressing&mode=initial&pathId=${encodeURIComponent(path.id)}&from=task-receipt&returnTo=${encodeURIComponent(recordReturnHref)}`}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.09] bg-black/20 px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                            >
                              <Activity className="h-3.5 w-3.5" />
                              查看首次作答诊断
                            </Link>
                            <Link
                              href="/simulation?experiment=exp02"
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.09] bg-black/20 px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"
                            >
                              <FlaskConical className="h-3.5 w-3.5" />
                              重新进入 exp02
                            </Link>
                            <Link
                              href={`/weak-nodes?quizId=quiz-ch3-addressing&mode=retest&pathId=${encodeURIComponent(path.id)}&from=task-receipt&returnTo=${encodeURIComponent(recordReturnHref)}`}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/[0.09] bg-black/20 px-3 py-2 text-xs text-slate-300 hover:border-emerald-300/30 hover:text-emerald-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              查看最近一次作答诊断
                            </Link>
                            <Link
                              href="/quiz?topic=addressing-modes&mode=retest"
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-xs text-cyan-100 hover:bg-cyan-300/[0.14]"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              开始自主巩固测评
                            </Link>
                          </div>
                        </div>
                      )}
                    </article>
                    );
                  })}
                </div>
              )}
            </section>

            {data.pausedPaths.length > 0 && (
              <details className="group rounded-md border border-amber-300/15 bg-amber-300/[0.025]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-4 py-3 text-sm text-amber-100 marker:content-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300/30">
                  <PauseCircle className="h-4 w-4 text-amber-200" />
                  <span className="font-semibold">历史暂停路径</span>
                  <span className="font-mono text-xs text-amber-200/70">{data.counts.pausedPaths}</span>
                  <span className="ml-auto text-[11px] text-slate-500">
                    <span className="group-open:hidden">记录已保留，展开查看</span>
                    <span className="hidden group-open:inline">收起历史记录</span>
                  </span>
                </summary>
                <div className="space-y-2 border-t border-amber-300/10 p-3">
                  {data.pausedPaths.map((path) => (
                    <article key={path.id} className="rounded-md border border-amber-300/15 bg-amber-300/[0.035] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-amber-100">{path.name}</h3>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            新学习路径启用后，本路径已暂停；已完成记录保留，但当前不能继续推进。
                          </p>
                        </div>
                        <span className="rounded-md border border-amber-300/20 bg-amber-300/[0.08] px-2 py-1 font-mono text-[10px] text-amber-200">
                          {path.currentModule}/{path.totalModules} 步
                        </span>
                      </div>
                      {path.dataIssue && (
                        <div className="mt-3 rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs leading-5 text-amber-100" role="alert">
                          {path.dataIssue}
                        </div>
                      )}
                      <CurriculumCompatibilityNotice path={path} />
                      <div className="mt-3 text-[11px] text-slate-600">开始于 {formatDate(path.startedAt)}</div>
                    </article>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
