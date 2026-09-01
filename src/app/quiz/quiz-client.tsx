
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import type { PublicQuestion } from '@/lib/quiz-data';
import { knowledgePoints } from '@/lib/knowledge-points';
import {
  ADDRESSING_QUIZ_ID,
  ADDRESSING_REMEDIATION_STEP_ID,
  ADDRESSING_TOPIC_ID,
  AI_LITERACY_QUIZ_ID,
  AI_LITERACY_TOPIC_ID,
  getModuleIdForChapter,
} from '@/lib/lesson-tasks';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Activity,
  ArrowRight,
  BarChart4,
  BookCopy,
  CheckCircle,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  FileText,
  GitBranch,
  Lightbulb,
  ListChecks,
  Loader2,
  RotateCcw,
  Target,
  TerminalSquare,
  Timer,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { processAchievementResponse } from '@/hooks/use-achievement-notifications';
import { getStoredAccessToken } from '@/lib/auth-storage';

type AnswersState = Record<string, string>;
type ScorePerKa = { [ka: string]: { correct: number; total: number; score: number } };
type QuestionResult = { correct: boolean; correctAnswer: string };
type QuizDataProvenance = {
  mode: 'DEMO' | 'REAL' | 'MIXED';
  label: string;
  note: string;
};
type QuizEvidence = {
  dataProvenance: QuizDataProvenance;
  asOf: string;
  sampleSize: { questions: number; answered?: number };
};
type SubmissionResult = {
  attemptId: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  weakAreas: string[];
  scoresByKA: ScorePerKa;
  questionResults: Record<string, QuestionResult>;
  duplicate?: boolean;
};

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

const dataProvenanceSchema = z.object({
  mode: z.enum(['DEMO', 'REAL', 'MIXED']),
  label: z.string().min(1),
  note: z.string().min(1),
});

const quizEvidenceSchema = z.object({
  dataProvenance: dataProvenanceSchema,
  asOf: z.string().datetime(),
  sampleSize: z.object({
    questions: z.number().int().nonnegative(),
    answered: z.number().int().nonnegative().optional(),
  }),
});

const questionsResponseSchema = quizEvidenceSchema.extend({
  data: z.array(publicQuestionSchema),
});

const scorePerKaSchema = z.record(z.string(), z.object({
  correct: z.number().int().min(0),
  total: z.number().int().min(0),
  score: z.number().min(0).max(100),
}));

const submissionResultSchema = z.object({
  attemptId: z.string().min(1).max(128),
  quizId: z.string().min(1).max(128),
  score: z.number().min(0).max(100),
  totalQuestions: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  weakAreas: z.array(z.string()),
  scoresByKA: scorePerKaSchema,
  questionResults: z.record(z.string(), z.object({
    correct: z.boolean(),
    correctAnswer: z.string(),
  })),
  duplicate: z.boolean().optional(),
});

const submissionResponseSchema = submissionResultSchema.merge(quizEvidenceSchema).extend({
  success: z.literal(true),
});

const verifiedReceiptResponseSchema = quizEvidenceSchema.extend({
  success: z.literal(true),
  receipt: submissionResultSchema.extend({
    assessmentMode: z.enum(['initial', 'retest']),
    pathId: z.string().nullable(),
  }),
});

const pendingSubmissionSchema = z.object({
  attemptId: z.string().min(8).max(128),
  quizId: z.string(),
  assessmentMode: z.enum(['initial', 'retest']),
  pathId: z.string().nullable(),
  body: z.string().min(1),
  createdAt: z.string(),
});

type PendingSubmission = z.infer<typeof pendingSubmissionSchema>;

const QUIZ_SUBMIT_TIMEOUT_MS = 20_000;
const QUIZ_RECEIPT_TIMEOUT_MS = 15_000;
const QUIZ_QUESTIONS_TIMEOUT_MS = 15_000;
const PENDING_SUBMISSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

class QuizRequestTimeoutError extends Error {
  constructor() {
    super('测评请求超时');
    this.name = 'QuizRequestTimeoutError';
  }
}

async function fetchQuizRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new QuizRequestTimeoutError();
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function isRetryableSubmissionStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function getAccessTokenSafely(): string | null {
  try {
    return getStoredAccessToken();
  } catch {
    return null;
  }
}

const savedProgressSchema = z.object({
  currentQuestionIndex: z.number().int().optional(),
  answerStatus: z.record(z.string(), z.enum(['correct', 'incorrect'])).optional(),
  questionOrderIds: z.array(z.number().int()).optional(),
  timestamp: z.string().optional(),
});

function errorMessageOf(value: unknown, fallback: string): string {
  if (typeof value !== 'object' || value === null) return fallback;
  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : fallback;
}

const HIERARCHICAL_ID = /^\d+(\.\d+)*$/;
const KP_NAME_BY_ID: Record<string, { name: string; chapter: number; level: number }> = ((): Record<string, { name: string; chapter: number; level: number }> => {
  const m: Record<string, { name: string; chapter: number; level: number }> = {};
  for (const p of knowledgePoints) m[p.id] = { name: p.name, chapter: p.chapter, level: p.level };
  return m;
})();

// Render the `ka` field. If it matches a knowledge-graph node id (e.g. '7.4.3'),
// surface as a clickable chip linking to /knowledge-graph?node=id and prefix
// the chip text with the resolved node name. Otherwise render as plain text.
function KaChip({ ka, className }: { ka: string; className?: string }): React.JSX.Element {
  if (!HIERARCHICAL_ID.test(ka)) {
    return <span className={cn('font-medium text-slate-100', className)}>{ka}</span>;
  }
  const node = KP_NAME_BY_ID[ka];
  return (
    <Link
      href={`/knowledge-graph?node=${encodeURIComponent(ka)}`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex min-h-11 items-center gap-1 rounded-md border border-cyan-300/30 bg-cyan-300/[0.08] px-3 py-2 text-xs text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-300/[0.14]',
        className,
      )}
      title={node ? `CH${node.chapter} · L${node.level} · 点击在知识图谱中查看` : `节点 ${ka}`}
    >
      <span className="font-mono opacity-70">#{ka}</span>
      {node && <span>{node.name}</span>}
    </Link>
  );
}

function QuizEvidenceBanner({ evidence }: { evidence: QuizEvidence | null }): React.JSX.Element {
  if (!evidence) {
    return (
      <div role="status" className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-3 text-xs text-cyan-50/75">
        正在核验题集身份、截止时间和样本量…
      </div>
    );
  }
  const { dataProvenance, asOf, sampleSize } = evidence;
  return (
    <div
      role="note"
      className={cn(
        'rounded-md border px-4 py-3',
        dataProvenance.mode === 'REAL'
          ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-50'
          : 'border-amber-300/25 bg-amber-300/[0.08] text-amber-50',
      )}
    >
      <div className="text-sm font-semibold">{dataProvenance.label}</div>
      <p className="mt-1 text-xs leading-5 opacity-80">{dataProvenance.note}</p>
      <p className="mt-1 font-mono text-[10px] leading-5 opacity-70">
        截止 {new Date(asOf).toLocaleString('zh-CN', { hour12: false })}
        {' · '}题目 n={sampleSize.questions}
        {sampleSize.answered !== undefined ? ` · 已提交 n=${sampleSize.answered}` : ''}
        {' · '}0题=接口确认无题，0作答=当前试卷尚未选择答案，N/A=题集或回执尚未核验
      </p>
    </div>
  );
}

// 判定前归一化：忽略大小写、压缩空白（含换行）为单空格、去掉逗号后的空格，
// 使 "MOVC A, @A+DPTR" 与 "MOVC A,@A+DPTR" 等价
// Fisher-Yates shuffle algorithm
const shuffleArray = (array: PublicQuestion[]): PublicQuestion[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
};

function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeStorageRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function safeStorageGetWithMigration(targetKey: string, anonymousKey?: string): string | null {
  const stored = safeStorageGet(targetKey);
  if (stored !== null) {
    if (anonymousKey && anonymousKey !== targetKey) safeStorageRemove(anonymousKey);
    return stored;
  }
  if (!anonymousKey || anonymousKey === targetKey) return null;
  const anonymousDraft = safeStorageGet(anonymousKey);
  if (anonymousDraft === null) return null;
  if (safeStorageSet(targetKey, anonymousDraft)) safeStorageRemove(anonymousKey);
  return anonymousDraft;
}

export function QuizClient(): React.JSX.Element {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [quizQuestions, setQuizQuestions] = useState<PublicQuestion[]>([]);
  const [shuffledQuestions, setShuffledQuestions] = useState<PublicQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersState>({});
  const [answerStatus, setAnswerStatus] = useState<{ [key: number]: 'correct' | 'incorrect' }>({});
  const [showResults, setShowResults] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<SubmissionResult | null>(null);
  const [receiptVerificationStatus, setReceiptVerificationStatus] = useState<'checking' | 'ready' | 'error'>('checking');
  const [receiptVerificationError, setReceiptVerificationError] = useState<string | null>(null);
  const [receiptVerificationAttempt, setReceiptVerificationAttempt] = useState(0);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);
  const [quizEvidence, setQuizEvidence] = useState<QuizEvidence | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isSavingResults, setIsSavingResults] = useState(false);
  const [hasPendingSubmission, setHasPendingSubmission] = useState(false);
  const startedAtRef = useRef(Date.now());
  const skipNextAnswerSaveRef = useRef(true);
  const attemptIdRef = useRef<string | null>(null);
  const submissionInFlightRef = useRef(false);
  const pendingSubmissionRef = useRef<PendingSubmission | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // ?chapter=N filters the quiz to that chapter only. Preserved across the
  // session so navigation between questions doesn't drop the filter.
  const rawTopicFilter = searchParams?.get('topic') ?? null;
  const rawModeFilter = searchParams?.get('mode') ?? null;
  const rawChapterFilter = searchParams?.get('chapter') ?? null;
  const filterValidationError = useMemo((): string | null => {
    if (rawTopicFilter !== null && rawTopicFilter !== ADDRESSING_TOPIC_ID && rawTopicFilter !== AI_LITERACY_TOPIC_ID) {
      return '测评链接中的主题参数无效，请返回任务页重新进入。';
    }
    if (rawModeFilter !== null && rawModeFilter !== 'initial' && rawModeFilter !== 'retest') {
      return '测评链接中的阶段参数无效，请返回任务页重新进入。';
    }
    if (rawModeFilter !== null && rawTopicFilter !== ADDRESSING_TOPIC_ID) {
      return '测评阶段必须与专项主题同时使用，请返回任务页重新进入。';
    }
    if (rawTopicFilter !== null && rawChapterFilter !== null) {
      return '专项测评与章节测评不能同时进入，请返回任务页重新选择。';
    }
    if (rawChapterFilter !== null) {
      const chapter = Number(rawChapterFilter);
      if (!Number.isInteger(chapter) || chapter < 1 || chapter > 10) {
        return '测评链接中的章节编号无效，请返回课程页重新进入。';
      }
    }
    return null;
  }, [rawChapterFilter, rawModeFilter, rawTopicFilter]);

  const chapterFilter = useMemo((): number | null => {
    const raw = rawChapterFilter;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
  }, [rawChapterFilter]);

  const topicFilter = rawTopicFilter === ADDRESSING_TOPIC_ID
    ? ADDRESSING_TOPIC_ID
    : rawTopicFilter === AI_LITERACY_TOPIC_ID
      ? AI_LITERACY_TOPIC_ID
      : null;
  const assessmentMode = rawModeFilter === 'retest' ? 'retest' : 'initial';
  const taskPathId = searchParams?.get('taskPathId') ?? undefined;
  const resolvedQuizId = topicFilter === ADDRESSING_TOPIC_ID
    ? ADDRESSING_QUIZ_ID
    : topicFilter === AI_LITERACY_TOPIC_ID
      ? AI_LITERACY_QUIZ_ID
    : chapterFilter !== null
      ? `quiz-ch${chapterFilter}`
      : 'comprehensive-assessment';
  const requiresCompleteSubmission = true;

  const sourceQuestions = useMemo(
    () => {
      if (topicFilter === ADDRESSING_TOPIC_ID) {
        return quizQuestions.filter((question) => question.ka === '3.1' || question.ka.startsWith('3.1.'));
      }
      if (topicFilter === AI_LITERACY_TOPIC_ID) {
        return quizQuestions.filter((question) => question.ka === '10.5' || question.ka.startsWith('10.5.'));
      }
      return chapterFilter !== null ? quizQuestions.filter((question) => question.chapter === chapterFilter) : quizQuestions;
    },
    [chapterFilter, quizQuestions, topicFilter],
  );

  // 首测、再次测评和其他试卷分别保存草稿，刷新后可恢复且不会串卷。
  const quizSessionKey = taskPathId
    ? `${resolvedQuizId}-${assessmentMode}-task-${taskPathId}`
    : `${resolvedQuizId}-${assessmentMode}`;
  const anonymousProgressKey = `quiz-progress-${quizSessionKey}`;
  const anonymousAnswerStorageKey = `quiz-answers-${quizSessionKey}`;
  const anonymousAttemptStorageKey = `quiz-attempt-${quizSessionKey}`;
  const anonymousPendingStorageKey = `quiz-pending-${quizSessionKey}`;
  const progressKey = user ? `quiz-progress-${user.id}-${quizSessionKey}` : `quiz-progress-${quizSessionKey}`;
  const answerStorageKey = user ? `quiz-answers-${user.id}-${quizSessionKey}` : `quiz-answers-${quizSessionKey}`;
  const attemptStorageKey = user ? `quiz-attempt-${user.id}-${quizSessionKey}` : `quiz-attempt-${quizSessionKey}`;
  const pendingStorageKey = user ? `quiz-pending-${user.id}-${quizSessionKey}` : `quiz-pending-${quizSessionKey}`;
  const receiptStorageKey = user ? `quiz-receipt-${user.id}-${quizSessionKey}` : `quiz-receipt-${quizSessionKey}`;

  useEffect(() => {
    let attemptId = safeStorageGetWithMigration(
      attemptStorageKey,
      user ? anonymousAttemptStorageKey : undefined,
    );
    pendingSubmissionRef.current = null;
    setHasPendingSubmission(false);
    const rawPending = safeStorageGetWithMigration(
      pendingStorageKey,
      user ? anonymousPendingStorageKey : undefined,
    );
    if (rawPending) {
      try {
        const parsedPending: unknown = JSON.parse(rawPending);
        const validatedPending = pendingSubmissionSchema.safeParse(parsedPending);
        const pending = validatedPending.success ? validatedPending.data : null;
        const createdAt = pending ? new Date(pending.createdAt).getTime() : NaN;
        const contextMatches = Boolean(pending
          && pending.quizId === resolvedQuizId
          && pending.assessmentMode === assessmentMode
          && pending.pathId === (taskPathId ?? null)
          && Number.isFinite(createdAt)
          && Date.now() - createdAt < PENDING_SUBMISSION_MAX_AGE_MS);
        if (pending && contextMatches) {
          pendingSubmissionRef.current = pending;
          setHasPendingSubmission(true);
          attemptId = pending.attemptId;
          safeStorageSet(attemptStorageKey, pending.attemptId);
        } else {
          safeStorageRemove(pendingStorageKey);
        }
      } catch {
        safeStorageRemove(pendingStorageKey);
      }
    }
    attemptIdRef.current = attemptId;
  }, [
    anonymousAttemptStorageKey,
    anonymousPendingStorageKey,
    assessmentMode,
    attemptStorageKey,
    pendingStorageKey,
    resolvedQuizId,
    taskPathId,
    user,
  ]);

  // 题目接口只返回学生作答所需字段；正确答案仅在交卷成功后随本次结果返回。
  useEffect(() => {
    let active = true;
    async function loadQuestions(): Promise<void> {
      setQuestionLoadError(null);
      setQuizEvidence(null);
      if (filterValidationError) {
        setQuizQuestions([]);
        setQuestionLoadError(filterValidationError);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (topicFilter) params.set('topic', topicFilter);
        if (chapterFilter !== null) params.set('chapter', String(chapterFilter));
        if (topicFilter === ADDRESSING_TOPIC_ID) params.set('mode', assessmentMode);
        const query = params.toString();
        const res = await fetchQuizRequest(
          `/api/quiz/questions${query ? `?${query}` : ''}`,
          { cache: 'no-store' },
          QUIZ_QUESTIONS_TIMEOUT_MS,
        );
        if (res.ok) {
          const rawJson: unknown = await res.json();
          const parsedJson = questionsResponseSchema.safeParse(rawJson);
          if (active && parsedJson.success && parsedJson.data.data.length > 0) {
            setQuizQuestions(parsedJson.data.data);
            setQuizEvidence({
              dataProvenance: parsedJson.data.dataProvenance,
              asOf: parsedJson.data.asOf,
              sampleSize: parsedJson.data.sampleSize,
            });
            return;
          }
        }
        if (active) setQuestionLoadError('题目加载失败，请刷新后重试。');
      } catch (error) {
        if (active) setQuestionLoadError(error instanceof QuizRequestTimeoutError
          ? '正式题目加载超时，请重试。'
          : '网络异常，暂时无法加载正式题目。');
      }
    }
    setQuizQuestions([]);
    void loadQuestions();
    return (): void => { active = false; };
  }, [assessmentMode, chapterFilter, filterValidationError, topicFilter]);

  useEffect(() => {
    let active = true;
    async function verifyStoredReceipt(): Promise<void> {
      setSubmittedReceipt(null);
      setReceiptVerificationError(null);
      if (filterValidationError) {
        setReceiptVerificationStatus('ready');
        return;
      }
      const raw = safeStorageGet(receiptStorageKey);
      if (!raw) {
        setReceiptVerificationStatus('ready');
        return;
      }
      let localReceipt: SubmissionResult | null = null;
      try {
        const parsedReceipt: unknown = JSON.parse(raw);
        const receipt = submissionResultSchema.safeParse(parsedReceipt);
        localReceipt = receipt.success ? receipt.data : null;
      } catch { /* invalid local receipt */ }
      if (!localReceipt) {
        safeStorageRemove(receiptStorageKey);
        setReceiptVerificationStatus('ready');
        return;
      }
      if (!user) {
        // 未登录时不使用任何本地提交结论；答案草稿仍可继续编辑。
        setReceiptVerificationStatus('ready');
        return;
      }
      const accessToken = getAccessTokenSafely();
      if (!accessToken) {
        setReceiptVerificationStatus('error');
        setReceiptVerificationError('登录状态已失效，暂时无法核对已有测评回执。');
        return;
      }

      setReceiptVerificationStatus('checking');
      try {
        const response = await fetchQuizRequest(`/api/quiz/history?attemptId=${encodeURIComponent(localReceipt.attemptId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }, QUIZ_RECEIPT_TIMEOUT_MS);
        const rawResponse: unknown = await response.json().catch((): Record<string, never> => ({}));
        if (!active) return;
        if (response.status === 404) {
          safeStorageRemove(receiptStorageKey);
          setReceiptVerificationStatus('ready');
          return;
        }
        if (!response.ok) {
          throw new Error(response.status === 401
            ? '登录状态已失效，暂时无法核对已有测评回执。'
            : errorMessageOf(rawResponse, '已有测评回执核对失败，请重试。'));
        }
        const verified = verifiedReceiptResponseSchema.safeParse(rawResponse);
        const verifiedPayload = verified.success ? verified.data : null;
        const receipt = verifiedPayload?.receipt ?? null;
        const contextMatches = Boolean(receipt
          && receipt.quizId === resolvedQuizId
          && receipt.assessmentMode === assessmentMode
          && receipt.pathId === (taskPathId ?? null));
        if (!receipt || !contextMatches) {
          safeStorageRemove(receiptStorageKey);
          setReceiptVerificationStatus('ready');
          return;
        }
        setQuizEvidence({
          dataProvenance: verifiedPayload!.dataProvenance,
          asOf: verifiedPayload!.asOf,
          sampleSize: verifiedPayload!.sampleSize,
        });
        setSubmittedReceipt(receipt);
        setReceiptVerificationStatus('ready');
      } catch (error) {
        if (!active) return;
        setReceiptVerificationStatus('error');
        setReceiptVerificationError(error instanceof Error ? error.message : '已有测评回执核对失败，请重试。');
      }
    }
    void verifyStoredReceipt();
    return (): void => { active = false; };
  }, [assessmentMode, filterValidationError, receiptStorageKey, receiptVerificationAttempt, resolvedQuizId, taskPathId, user]);

  useEffect(() => {
    // Shuffling is done on the client-side to avoid hydration mismatch
    // 章节参数或题库变化时重建题集，保证按章练习只出该章题目
    let next = shuffleArray(sourceQuestions);
    let savedProgress: z.infer<typeof savedProgressSchema> | null = null;

    if (typeof window !== 'undefined') {
      try {
        const rawProgress = safeStorageGetWithMigration(
          progressKey,
          user ? anonymousProgressKey : undefined,
        );
        const parsedProgress: unknown = rawProgress ? JSON.parse(rawProgress) : null;
        const validatedProgress = savedProgressSchema.safeParse(parsedProgress);
        savedProgress = validatedProgress.success ? validatedProgress.data : null;
        const savedIds = savedProgress?.questionOrderIds;
        if (Array.isArray(savedIds) && savedIds.length === sourceQuestions.length) {
          const byId = new Map(sourceQuestions.map((question) => [question.id, question]));
          const restoredOrder = savedIds.map((id) => byId.get(id)).filter((question): question is PublicQuestion => Boolean(question));
          if (restoredOrder.length === sourceQuestions.length) next = restoredOrder;
        }
      } catch (error) {
        console.warn('Failed to parse quiz progress:', error);
      }
    }
    setShuffledQuestions(next);
    setCurrentQuestionIndex(0);
    // 报告只在当次交卷后展示，不从存储恢复
    setShowResults(false);

    // 尝试恢复测评进度
    if (typeof window !== 'undefined') {
      try {
        if (savedProgress) {
          // 检查是否在24小时内
          const isRecent = typeof savedProgress.timestamp === 'string'
            && new Date().getTime() - new Date(savedProgress.timestamp).getTime() < 24 * 60 * 60 * 1000;
          if (isRecent && typeof savedProgress.currentQuestionIndex === 'number') {
            // 越界时收敛到合法范围，避免"题目加载错误"死页
            const clamped = Math.min(Math.max(savedProgress.currentQuestionIndex, 0), Math.max(next.length - 1, 0));
            setCurrentQuestionIndex(clamped);
            setAnswerStatus({});
          }
        }
      } catch (error) {
        console.warn('Failed to load quiz progress:', error);
      }
    }
  }, [anonymousProgressKey, progressKey, sourceQuestions, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 切卷时先跳过本轮保存，避免旧试卷的闭包状态覆盖待恢复草稿。
    skipNextAnswerSaveRef.current = true;
    try {
      const saved = safeStorageGetWithMigration(
        answerStorageKey,
        user ? anonymousAnswerStorageKey : undefined,
      );
      const parsedAnswers: unknown = saved ? JSON.parse(saved) : {};
      const validatedAnswers = z.record(z.string(), z.string()).safeParse(parsedAnswers);
      setAnswers(validatedAnswers.success ? validatedAnswers.data : {});
    } catch (error) {
      console.warn('Failed to load saved quiz answers:', error);
      setAnswers({});
    }
  }, [anonymousAnswerStorageKey, answerStorageKey, user]);

  // 保存答案到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (skipNextAnswerSaveRef.current) {
        skipNextAnswerSaveRef.current = false;
        return;
      }
      try {
        localStorage.setItem(answerStorageKey, JSON.stringify(answers));
      } catch (error) {
        console.warn('Failed to save quiz answers:', error);
      }
    }
  }, [answerStorageKey, answers]);

  // 保存测评进度，index 传入最新题号避免闭包里的旧值
  const saveQuizProgress = (
    index = currentQuestionIndex,
    statuses: { [key: number]: 'correct' | 'incorrect' } = answerStatus,
  ): void => {
    if (typeof window !== 'undefined') {
      try {
        const progress = {
          currentQuestionIndex: index,
          answerStatus: statuses,
          questionOrderIds: shuffledQuestions.map((question) => question.id),
          timestamp: new Date().toISOString()
        };
        localStorage.setItem(progressKey, JSON.stringify(progress));
      } catch (error) {
        console.warn('Failed to save quiz progress:', error);
      }
    }
  };

  const handleAnswerChange = (questionId: number, answer: string): void => {
    if (pendingSubmissionRef.current || submissionInFlightRef.current) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const goToQuestion = (index: number): void => {
    if (!Number.isInteger(index) || index < 0 || index >= shuffledQuestions.length) return;
    setCurrentQuestionIndex(index);
    saveQuizProgress(index);
    window.requestAnimationFrame(() => questionHeadingRef.current?.focus({ preventScroll: true }));
  };

  const handleNext = (): void => {
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = (): void => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async (): Promise<void> => {
    if (submissionInFlightRef.current) return;
    const isRetryingPendingSubmission = pendingSubmissionRef.current !== null;
    if (!isRetryingPendingSubmission && requiresCompleteSubmission && answeredCount !== shuffledQuestions.length) {
      toast({
        title: '还有题目未作答',
        description: `请完成剩余 ${shuffledQuestions.length - answeredCount} 道题后再交卷。`,
        variant: 'destructive',
      });
      return;
    }
    if (!user) {
      toast({
        title: '请先登录再交卷',
        description: '答案草稿已保留，登录后可以继续提交。',
        variant: 'destructive',
      });
      router.push(`/login?from=${encodeURIComponent(`/quiz?${searchParams?.toString() ?? ''}`)}`);
      return;
    }

    const accessToken = getAccessTokenSafely();
    if (!accessToken) {
      toast({
        title: '登录已过期',
        description: '答案草稿仍在，重新登录后可以继续交卷。',
        variant: 'destructive',
      });
      router.push(`/login?from=${encodeURIComponent(`/quiz?${searchParams?.toString() ?? ''}`)}`);
      return;
    }

    submissionInFlightRef.current = true;
    setIsSavingResults(true);
    try {
      let attemptId = attemptIdRef.current ?? safeStorageGet(attemptStorageKey);
      if (!attemptId) {
        attemptId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `attempt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      }
      attemptIdRef.current = attemptId;
      safeStorageSet(attemptStorageKey, attemptId);
      let pendingSubmission = pendingSubmissionRef.current;
      if (!pendingSubmission || pendingSubmission.attemptId !== attemptId) {
        const scopedAnswers = Object.fromEntries(
          shuffledQuestions
            .map((question) => [String(question.id), answers[String(question.id)] ?? ''] as const)
            .filter(([, answer]) => answer.trim().length > 0),
        );
        pendingSubmission = {
          attemptId,
          quizId: resolvedQuizId,
          assessmentMode,
          pathId: taskPathId ?? null,
          createdAt: new Date().toISOString(),
          body: JSON.stringify({
            quizId: resolvedQuizId,
            assessmentMode,
            topicId: topicFilter,
            moduleId: topicFilter === ADDRESSING_TOPIC_ID
              ? 'module-1'
              : topicFilter === AI_LITERACY_TOPIC_ID
                ? 'module-5'
              : chapterFilter !== null
                ? getModuleIdForChapter(chapterFilter) ?? undefined
                : undefined,
            chapterId: topicFilter === ADDRESSING_TOPIC_ID
              ? 'ch3'
              : topicFilter === AI_LITERACY_TOPIC_ID
                ? 'ch10'
                : chapterFilter ? `ch${chapterFilter}` : undefined,
            pathId: taskPathId,
            attemptId,
            score: 0,
            totalQuestions: shuffledQuestions.length,
            correctAnswers: 0,
            timeSpent: Math.round((Date.now() - startedAtRef.current) / 1000),
            answers: scopedAnswers,
          }),
        };
        pendingSubmissionRef.current = pendingSubmission;
        setHasPendingSubmission(true);
        safeStorageSet(pendingStorageKey, JSON.stringify(pendingSubmission));
      }

      let acceptedResult: SubmissionResult | null = null;
      let achievementPayload: unknown = null;
      let finalError = '测评结果暂未确认，答案和本次交卷编号已保留，请稍后重试。';
      let shouldRedirectToLogin = false;

      // 首次请求发生超时、网络中断、可重试服务错误或回执不完整时，
      // 使用完全相同的请求体自动恢复一次；服务端按 attemptId 幂等处理。
      for (let requestAttempt = 0; requestAttempt < 2 && !acceptedResult; requestAttempt += 1) {
        let response: Response;
        try {
          response = await fetchQuizRequest('/api/quiz/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: pendingSubmission.body,
          }, QUIZ_SUBMIT_TIMEOUT_MS);
        } catch (error) {
          const ambiguous = error instanceof TypeError || error instanceof QuizRequestTimeoutError;
          if (ambiguous && requestAttempt === 0) continue;
          finalError = ambiguous
            ? '网络异常，测评结果暂未确认；答案和本次交卷编号已保留，重试不会重复计分。'
            : '交卷请求失败，答案草稿仍在，请稍后重试。';
          break;
        }

        const data: unknown = await response.json().catch((): Record<string, never> => ({}));
        if (!response.ok) {
          if (isRetryableSubmissionStatus(response.status) && requestAttempt === 0) continue;
          finalError = response.status === 401
            ? '登录已过期，答案和本次交卷编号仍已保留。重新登录后可继续交卷。'
            : errorMessageOf(data, '测评结果未保存，请检查网络后重试。');
          shouldRedirectToLogin = response.status === 401;
          if (!isRetryableSubmissionStatus(response.status) && response.status !== 401) {
            pendingSubmissionRef.current = null;
            setHasPendingSubmission(false);
            safeStorageRemove(pendingStorageKey);
            if (response.status === 409) {
              attemptIdRef.current = null;
              safeStorageRemove(attemptStorageKey);
            }
          }
          break;
        }

        const parsedResult = submissionResponseSchema.safeParse(data);
        const result = parsedResult.success ? parsedResult.data : null;
        if (result?.quizId === resolvedQuizId) {
          setQuizEvidence({
            dataProvenance: result.dataProvenance,
            asOf: result.asOf,
            sampleSize: result.sampleSize,
          });
          acceptedResult = result;
          achievementPayload = data;
          break;
        }
        finalError = '服务端已响应，但测评回执与当前试卷不一致；本次交卷编号已保留，请重试核对。';
        if (requestAttempt === 0) continue;
      }

      if (!acceptedResult) {
        toast({ title: '交卷未完成', description: finalError, variant: 'destructive' });
        if (shouldRedirectToLogin) {
          router.push(`/login?from=${encodeURIComponent(`/quiz?${searchParams?.toString() ?? ''}`)}`);
        }
        return;
      }

      const result = acceptedResult;
      pendingSubmissionRef.current = null;
      setHasPendingSubmission(false);
      safeStorageRemove(pendingStorageKey);
      setSubmissionResult(result);
      setSubmittedReceipt(result);
      setAnswerStatus(Object.fromEntries(
        Object.entries(result.questionResults).map(([id, value]) => [Number(id), value.correct ? 'correct' : 'incorrect']),
      ));
      setShowResults(true);
      safeStorageRemove(answerStorageKey);
      safeStorageRemove(progressKey);
      safeStorageSet(receiptStorageKey, JSON.stringify(result));
      safeStorageSet(
        `assessment-results-${user.id}`,
        JSON.stringify({
          saved: true,
          attemptId: result.attemptId,
          weakKAs: result.weakAreas,
          totalScore: result.score,
          scores: result.scoresByKA,
          quizId: result.quizId,
          assessmentMode,
          timestamp: new Date().toISOString(),
        }),
      );
      safeStorageRemove(`analytics_${user.id}`);
      safeStorageRemove(`analytics_${user.id}_time`);
      try {
        processAchievementResponse(achievementPayload);
      } catch (achievementError) {
        console.warn('测评已保存，但成就提示处理失败:', achievementError);
      }
      toast({
        title: result.duplicate ? '已恢复原提交结果' : '测评结果已保存',
        description: result.duplicate ? '本次尝试没有重复计分。' : '报告使用服务端判定结果。',
      });
    } catch (error) {
      console.error('Failed to save quiz results to server:', error);
      toast({
        title: '交卷未完成',
        description: '网络异常，答案草稿仍在，请恢复网络后重试。',
        variant: 'destructive',
      });
    } finally {
      submissionInFlightRef.current = false;
      setIsSavingResults(false);
    }
  };

  const handleRestart = (): void => {
    setShuffledQuestions(shuffleArray(sourceQuestions));
    setCurrentQuestionIndex(0);
    setAnswers({});
    setAnswerStatus({});
    setShowResults(false);
    setSubmissionResult(null);
    setSubmittedReceipt(null);
    setReceiptVerificationStatus('ready');
    setReceiptVerificationError(null);
    startedAtRef.current = Date.now();
    attemptIdRef.current = null;
    pendingSubmissionRef.current = null;
    setHasPendingSubmission(false);
    // 清除保存的数据
    safeStorageRemove(answerStorageKey);
    safeStorageRemove(progressKey);
    safeStorageRemove(attemptStorageKey);
    safeStorageRemove(pendingStorageKey);
    safeStorageRemove(receiptStorageKey);
  };

  const handleGeneratePlan = async (): Promise<void> => {
    setIsGeneratingPlan(true);
    
    try {
      // 验证薄弱知识点
      if (weakKAs.length === 0) {
        // 如果没有薄弱点，仍然可以生成一个通用的学习计划
        // No weak areas found, generating general learning plan
      }

      // 学习路径从服务端最近一次测评记录恢复薄弱点。不要把可篡改的
      // weakKAs 放进 URL，避免导航参数被误当作正式诊断依据。
      router.push('/learning-path');
    } catch (error) {
      console.error('Error generating learning plan:', error);
      alert(error instanceof Error ? error.message : '生成学习计划时发生错误，请稍后重试');
    } finally {
      setIsGeneratingPlan(false);
    }
  };
  
  const scores = submissionResult?.scoresByKA ?? {};
  const totalScore = submissionResult?.score ?? 0;
  const weakKAs = submissionResult?.weakAreas ?? [];
  const totalCorrect = submissionResult?.correctAnswers ?? 0;
  const addressingRemediationHref = ((): string => {
    const params = new URLSearchParams({
      quizId: ADDRESSING_QUIZ_ID,
      mode: 'initial',
    });
    if (taskPathId) {
      params.set('pathId', taskPathId);
      params.set('taskPathId', taskPathId);
      params.set('taskStepId', ADDRESSING_REMEDIATION_STEP_ID);
    }
    return `/weak-nodes?${params.toString()}`;
  })();

  // 章节参数没有对应题目时给出返回入口，避免一直停在加载态
  if (quizQuestions.length > 0 && sourceQuestions.length === 0) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 bg-[#070a0d] px-4 text-center text-slate-100 sm:-m-6" role="status">
        <p className="text-sm text-slate-400">该章节暂无题目，不以其他章节题目代替。</p>
        <Button asChild className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
          <Link href="/quiz">返回全部题目</Link>
        </Button>
      </div>
    );
  }

  if (questionLoadError) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 bg-[#070a0d] px-4 text-center text-slate-100 sm:-m-6" role="alert">
        <XCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-slate-400">{questionLoadError}</p>
        {filterValidationError ? (
          <Button asChild className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
            <Link href="/tasks">返回我的任务</Link>
          </Button>
        ) : (
          <Button type="button" onClick={() => window.location.reload()} className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">重新加载题集</Button>
        )}
      </div>
    );
  }

  if (receiptVerificationStatus === 'checking') {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 bg-[#070a0d] px-4 text-center text-slate-100 sm:-m-6" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
        <p className="text-sm text-slate-400">正在核对已有测评回执…</p>
        <p className="text-xs text-slate-600">核对完成前不会开放重复交卷。</p>
      </div>
    );
  }

  if (receiptVerificationStatus === 'error') {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-4 bg-[#070a0d] px-4 text-center text-slate-100 sm:-m-6">
        <XCircle className="h-8 w-8 text-amber-400" />
        <p className="max-w-md text-sm text-slate-400" role="alert">{receiptVerificationError ?? '已有测评回执核对失败，请重试。'}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => setReceiptVerificationAttempt((value) => value + 1)} className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
            重新核对
          </Button>
          <Button asChild variant="outline" className="min-h-11 border-white/[0.12] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]">
            <Link href="/tasks">返回我的任务</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (shuffledQuestions.length === 0) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 text-slate-100 sm:-m-6" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-200" />
        <p className="ml-4 text-sm text-slate-400">正在准备当前题集…</p>
      </div>
    );
  }

  const currentQuestion = shuffledQuestions[currentQuestionIndex];
  if (!currentQuestion) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 text-center text-slate-100 sm:-m-6" role="alert">
        <p className="text-sm text-amber-100">当前题目索引与题集不一致，请刷新页面重新核对。</p>
      </div>
    );
  }
  
  const isCurrentQuestionChecked = !!answerStatus[currentQuestion.id];
  const isCurrentAnswerCorrect = answerStatus[currentQuestion.id] === 'correct';
  const isAnswerInputLocked = isCurrentQuestionChecked || isSavingResults || hasPendingSubmission;
  // 各项计数只在当前题集范围内统计，保证章节卷分母正确
  const answeredCount = shuffledQuestions.filter((question) => (answers[question.id] ?? '').trim() !== '').length;
  const checkedCount = shuffledQuestions.filter((question) => answerStatus[question.id]).length;
  const correctCheckedCount = shuffledQuestions.filter((question) => answerStatus[question.id] === 'correct').length;
  const correctAnsweredCount = totalCorrect;
  const answerProgress = shuffledQuestions.length > 0 ? (answeredCount / shuffledQuestions.length) * 100 : 0;
  const currentAnswer = answers[currentQuestion.id] ?? '';
  const scoreEntries = Object.entries(scores).sort(([, a], [, b]) => a.score - b.score);
  const missedQuestions = shuffledQuestions.filter(
    (question) => submissionResult?.questionResults?.[String(question.id)]?.correct === false,
  );
  const chapterQuestionCount = shuffledQuestions.filter(question => question.chapter === currentQuestion.chapter).length;


  if (showResults && submissionResult) {
    return (
      <div className="-m-4 min-h-[calc(100vh-3.5rem)] animate-fade-in overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
        <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
                <BarChart4 className="h-3.5 w-3.5" />
                Diagnostic Report · 8051
              </div>
              <h1 id="quiz-report-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
                {topicFilter === ADDRESSING_TOPIC_ID
                  ? assessmentMode === 'retest' ? '3.1 寻址方式 · 再次作答报告' : '3.1 寻址方式 · 首次作答报告'
                  : topicFilter === AI_LITERACY_TOPIC_ID
                    ? 'AI素养情境测评报告'
                    : '测试诊断报告'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                得分、知识原子掌握度和薄弱项均来自本次服务端交卷回执；请按右侧“下一步”继续完成学习闭环。
              </p>
              <span className="sr-only">测试完成！</span>
              <span className="sr-only">这是您的诊断报告。</span>
              <span className="sr-only">您回答了 {answeredCount} 道题，答对 {correctAnsweredCount} 道题。</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleRestart}
                className="min-h-11 border border-white/[0.1] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-slate-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                重新测试
                <span className="sr-only">再试一次</span>
              </Button>
              {assessmentMode === 'retest' ? (
                <Button asChild className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                  <Link href="/tasks">继续：返回任务回执<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              ) : topicFilter === ADDRESSING_TOPIC_ID ? (
                <Button asChild className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                  <Link href={addressingRemediationHref}>继续：查看补学清单<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              ) : topicFilter === AI_LITERACY_TOPIC_ID ? (
                <Button asChild className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                  <Link href="/knowledge-graph?chapter=10&node=10.5">继续：核对责任使用清单<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              ) : weakKAs.length > 0 ? (
                <Button onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                  {isGeneratingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isGeneratingPlan ? '正在生成路径…' : '继续：生成补学路径'}
                  {!isGeneratingPlan && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              ) : (
                <Button asChild className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                  <Link href="/simulation">继续：进入仿真实践<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 md:px-6">
          <QuizEvidenceBanner evidence={quizEvidence} />
        </div>

        <section aria-labelledby="quiz-report-title" className="grid items-start gap-5 px-4 py-5 xl:grid-cols-[minmax(0,1fr)_360px] md:px-6">
          <section className="space-y-5">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                <div className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-cyan-100">本次服务端得分</div>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="font-mono text-6xl font-semibold text-slate-50 stat-glow">{totalScore.toFixed(0)}</span>
                    <span className="pb-2 font-mono text-xl text-slate-400">%</span>
                  </div>
                  <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/30">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, totalScore))}%` }} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
                  <div className="glass-hover animate-slide-up rounded-md border border-white/[0.08] bg-black/20 p-4 transition-all">
                    <div className="chip-mark mb-3 flex h-7 w-7 items-center justify-center rounded-md"><ClipboardCheck className="h-3.5 w-3.5 text-cyan-100" /></div>
                    <div className="font-mono text-2xl text-slate-50 stat-glow">{answeredCount}</div>
                    <div className="text-xs text-slate-500">已答题</div>
                  </div>
                  <div className="glass-hover animate-slide-up rounded-md border border-white/[0.08] bg-black/20 p-4 transition-all">
                    <div className="chip-mark mb-3 flex h-7 w-7 items-center justify-center rounded-md"><CheckCircle className="h-3.5 w-3.5 text-emerald-100" /></div>
                    <div className="font-mono text-2xl text-slate-50 stat-glow">{correctAnsweredCount}</div>
                    <div className="text-xs text-slate-500">答对题</div>
                  </div>
                  <div className="glass-hover animate-slide-up rounded-md border border-white/[0.08] bg-black/20 p-4 transition-all">
                    <div className="chip-mark mb-3 flex h-7 w-7 items-center justify-center rounded-md"><Target className="h-3.5 w-3.5 text-amber-100" /></div>
                    <div className="font-mono text-2xl text-slate-50 stat-glow">{weakKAs.length}</div>
                    <div className="text-xs text-slate-500">待加强原子</div>
                  </div>
                  <div className="glass-hover animate-slide-up rounded-md border border-white/[0.08] bg-black/20 p-4 transition-all">
                    <div className="chip-mark mb-3 flex h-7 w-7 items-center justify-center rounded-md"><ListChecks className="h-3.5 w-3.5 text-slate-200" /></div>
                    <div className="font-mono text-2xl text-slate-50 stat-glow">{shuffledQuestions.length}</div>
                    <div className="text-xs text-slate-500">题目总数</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">知识原子掌握度</h2>
                  <span className="sr-only">知识原子掌握度分析</span>
                  <p className="mt-1 text-xs text-slate-500">仅统计已作答的题目，按得分从低到高排列；未作答的知识原子视为未测评。</p>
                </div>
                <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[10px] text-slate-500">
                  {scoreEntries.length} KA
                </span>
              </div>
              <div className="grid gap-3 p-5 lg:grid-cols-2">
                {scoreEntries.map(([ka, result]) => (
                  <div key={ka} className="glass-hover animate-slide-up rounded-md border border-white/[0.08] bg-black/20 p-4 transition-all">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <KaChip ka={ka} />
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-sm font-semibold',
                          result.score < 50 ? 'text-red-300' : result.score < 80 ? 'text-amber-300' : 'text-emerald-300'
                        )}
                      >
                        {result.score.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          result.score < 50 ? 'bg-gradient-to-r from-red-400 to-amber-400' : result.score < 80 ? 'bg-gradient-to-r from-amber-300 to-yellow-300' : 'bg-gradient-to-r from-cyan-300 to-emerald-300'
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, result.score))}%` }}
                      />
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-slate-500">答对 {result.correct}/{result.total} 题</div>
                  </div>
                ))}
                {scoreEntries.length === 0 && (
                  <div className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100 lg:col-span-2" role="status">
                    数据不足：服务端回执尚未提供可核验的知识原子分项，本区不以总分推算。
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">错题回看</h2>
                  <p className="mt-1 text-xs text-slate-500">只列出已作答且答错的题，保留正确答案和对应章节入口，便于回到课程实验复习。</p>
                </div>
                <span className="rounded-md border border-red-300/20 bg-red-300/[0.08] px-2 py-1 font-mono text-[10px] text-red-100">
                  {missedQuestions.length} 项
                </span>
              </div>
              <div className="space-y-3 p-5">
                {missedQuestions.map((question) => (
                  <div key={question.id} className="rounded-md border border-red-300/15 bg-red-300/[0.06] p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-6 text-slate-100">
                          第 {shuffledQuestions.findIndex(item => item.id === question.id) + 1} 题：{question.questionText}
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                          <div className="rounded border border-white/[0.08] bg-black/20 p-2">
                            <span className="text-slate-500">你的答案：</span>
                            <span className={cn('ml-1 font-semibold text-slate-200', question.type === 'code-completion' && 'font-code')}>
                              {answers[question.id] || '未作答'}
                            </span>
                          </div>
                          <div className="rounded border border-emerald-300/15 bg-emerald-300/[0.06] p-2">
                            <span className="text-slate-500">正确答案：</span>
                            <span className={cn('ml-1 font-semibold text-emerald-200', question.type === 'code-completion' && 'font-code')}>
                              {submissionResult.questionResults[String(question.id)]?.correctAnswer || '以教师复核结果为准'}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Button asChild variant="link" size="sm" className="h-auto p-0 text-cyan-200 hover:text-cyan-100">
                            <Link href={`/#item-${question.chapter}`}>
                              <BookCopy className="mr-2 h-4 w-4" />
                              复习第 {question.chapter} 章
                            </Link>
                          </Button>
                          <KaChip ka={question.ka} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {missedQuestions.length === 0 && (
                  <div className="flex items-center gap-3 rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-4 text-sm text-emerald-100">
                    <CheckCircle className="h-4 w-4" />
                    本次测试没有错题。
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
                <Lightbulb className="h-4 w-4 text-amber-300" />
                下一步
              </div>
              {assessmentMode === 'retest' ? (
                <div className="space-y-3">
                  {weakKAs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {weakKAs.slice(0, 8).map((ka) => (
                        <KaChip key={ka} ka={ka} className="border-amber-300/20 bg-amber-300/[0.08] text-amber-100" />
                      ))}
                    </div>
                  )}
                  <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100">
                    再次测评结果已保存。返回任务页查看完成回执；如仍有薄弱项，可按教师后续安排继续补学。
                  </div>
                  <Button asChild className="w-full bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                    <Link href="/tasks">
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      返回任务查看完成回执
                    </Link>
                  </Button>
                </div>
              ) : topicFilter === ADDRESSING_TOPIC_ID ? (
                <div className="space-y-4">
                  {weakKAs.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {weakKAs.slice(0, 8).map((ka) => (
                        <KaChip key={ka} ka={ka} className="border-amber-300/20 bg-amber-300/[0.08] text-amber-100" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100">
                      本次专项测评未识别到薄弱节点。仍需进入补学确认页核对本次诊断，再按任务顺序继续实验。
                    </div>
                  )}
                  <Button asChild className="w-full bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                    <Link href={addressingRemediationHref}>
                      <GitBranch className="mr-2 h-4 w-4" />
                      {weakKAs.length > 0 ? '按测评记录补学' : '确认本次诊断并继续'}
                    </Link>
                  </Button>
                </div>
              ) : topicFilter === AI_LITERACY_TOPIC_ID ? (
                <div className="space-y-4">
                  {weakKAs.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {weakKAs.map((ka) => (
                        <KaChip key={ka} ka={ka} className="border-amber-300/20 bg-amber-300/[0.08] text-amber-100" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100">
                      五个AI素养情境均已通过。后续使用AI时仍需保留核验、引用和修改记录。
                    </div>
                  )}
                  <Button asChild className="w-full bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                    <Link href="/knowledge-graph?chapter=10&node=10.5">
                      <GitBranch className="mr-2 h-4 w-4" />
                      返回10.5查看责任使用清单
                    </Link>
                  </Button>
                </div>
              ) : weakKAs.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {weakKAs.slice(0, 8).map((ka) => (
                      <KaChip key={ka} ka={ka} className="border-amber-300/20 bg-amber-300/[0.08] text-amber-100" />
                    ))}
                  </div>
                  <Button
                    onClick={handleGeneratePlan}
                    className="w-full bg-cyan-300 text-[#001014] hover:bg-cyan-200"
                    disabled={isGeneratingPlan}
                  >
                    {isGeneratingPlan ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <GitBranch className="mr-2 h-4 w-4" />
                        生成学习计划
                        <span className="sr-only">获取个性化学习计划</span>
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300/20 bg-emerald-300/[0.08] p-3 text-sm text-emerald-100">
                  当前没有明显薄弱项，可以继续进入仿真实验。
                </div>
              )}
            </div>

            <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
                <Activity className="h-4 w-4 text-cyan-200" />
                记录状态
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="text-slate-500">已答进度</span>
                  <span className="font-mono text-slate-100">{answerProgress.toFixed(0)}%</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="text-slate-500">已核对题</span>
                  <span className="font-mono text-slate-100">{checkedCount}/{shuffledQuestions.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-white/[0.08] bg-black/20 px-3 py-2">
                  <span className="text-slate-500">核对正确</span>
                  <span className="font-mono text-slate-100">{correctCheckedCount}/{checkedCount || 0}</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    );
  }

  if (submittedReceipt) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#070a0d] px-4 text-slate-100 sm:-m-6">
        <div className="w-full max-w-xl rounded-md border border-emerald-300/25 bg-[#0c1117] p-6 shadow-2xl shadow-black/30">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-300/[0.1]">
              <CheckCircle className="h-5 w-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-200">Submitted</div>
              <h1 className="mt-2 text-xl font-semibold text-slate-50">
                {assessmentMode === 'retest' ? '再次测评已经提交' : '本次测评已经提交'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                服务端已保存本次结果，刷新和重新登录不会再次交卷。成绩为
                <span className="mx-1 font-mono font-semibold text-emerald-200">{submittedReceipt.score.toFixed(0)}%</span>。
              </p>
            </div>
          </div>
          <div className="mt-5">
            <QuizEvidenceBanner evidence={quizEvidence} />
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {topicFilter === ADDRESSING_TOPIC_ID
              && assessmentMode !== 'retest' && (
              <Button asChild className="bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                <Link href={addressingRemediationHref}>
                  {submittedReceipt.weakAreas.length > 0 ? '查看薄弱点与补学入口' : '确认本次诊断并继续'}
                </Link>
              </Button>
            )}
            {topicFilter === AI_LITERACY_TOPIC_ID && (
              <Button asChild className="bg-cyan-300 text-[#001014] hover:bg-cyan-200">
                <Link href="/knowledge-graph?chapter=10&node=10.5">返回10.5责任使用清单</Link>
              </Button>
            )}
            <Button
              asChild
              className={assessmentMode === 'retest'
                ? 'bg-cyan-300 text-[#001014] hover:bg-cyan-200'
                : 'border border-white/[0.1] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}
            >
              <Link href="/tasks">{assessmentMode === 'retest' ? '返回任务查看完成回执' : '返回我的任务'}</Link>
            </Button>
            {!taskPathId && (
              <Button type="button" onClick={handleRestart} variant="ghost" className="text-slate-400 hover:text-slate-100">
                开始新一次测评
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-3.5rem)] animate-fade-in overflow-auto bg-[#070a0d] text-slate-100 sm:-m-6">
      <div className="border-b border-white/[0.07] bg-[#0c1117]/95 px-4 py-4 backdrop-blur-xl md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-xs text-cyan-100">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Assessment Console · Quiz
            </div>
            <h1 id="quiz-assessment-title" className="text-2xl font-semibold tracking-tight text-slate-50 md:text-3xl">
              {topicFilter === ADDRESSING_TOPIC_ID
                ? assessmentMode === 'retest' ? '3.1 寻址方式 · 再次测评' : '3.1 寻址方式 · 专项测评'
                : topicFilter === AI_LITERACY_TOPIC_ID
                  ? '10.5 AI素养与责任使用 · 情境测评'
                : chapterFilter ? `第 ${chapterFilter} 章 测验` : '综合测评'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {topicFilter === ADDRESSING_TOPIC_ID
                ? `本卷仅含 3.1 及其子节点的 ${shuffledQuestions.length} 道题，交卷结果将以 ${ADDRESSING_QUIZ_ID} 保存。`
                : topicFilter === AI_LITERACY_TOPIC_ID
                  ? `本卷包含 ${shuffledQuestions.length} 道责任使用情境题，交卷结果将以 ${AI_LITERACY_QUIZ_ID} 保存并按 10.5 子节点记录。`
                : chapterFilter
                ? `本卷只含第 ${chapterFilter} 章的 ${shuffledQuestions.length} 道题。系统仍按知识原子记录掌握度。`
                : `本卷按章节固定抽取 ${shuffledQuestions.length} 道题。全部作答后统一交卷，系统按服务端记录生成知识原子掌握度。`}
            </p>
            {(chapterFilter !== null || topicFilter !== null) && (
              <Link
                href="/quiz"
                className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.08]"
              >
                <ChevronsLeft className="h-3 w-3" />
                返回综合测评
              </Link>
            )}
            {!chapterFilter && !topicFilter && (
              <details className="group mt-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:hidden">
                  <span>按章练习</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="mt-2 hidden flex-wrap gap-1.5 group-open:flex sm:mt-3 sm:flex">
                  <span className="self-center text-xs text-slate-500">按章练习：</span>
                  {[...new Set(quizQuestions.map((q) => q.chapter))].sort((a, b) => a - b).map((ch) => (
                    <Link
                      key={ch}
                      href={`/quiz?chapter=${ch}`}
                      className="inline-flex min-h-11 items-center rounded-md border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
                    >
                      第{ch}章
                    </Link>
                  ))}
                </div>
              </details>
            )}
          </div>
          <div className="grid min-w-[240px] gap-2">
            <div className="flex items-center justify-between font-mono text-[11px] text-slate-500">
              <span>已作答</span>
              <span>{answeredCount}/{shuffledQuestions.length}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full bg-cyan-300" style={{ width: `${answerProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 md:px-6">
        <QuizEvidenceBanner evidence={quizEvidence} />
      </div>

      <details className="group px-4 pt-3 md:px-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:hidden">
          <span>查看测评说明</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <section aria-label="测评步骤说明" className="mt-2 hidden gap-2 group-open:grid sm:mt-0 sm:grid sm:grid-cols-3">
          <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-slate-200">本步目的：</span>
            {topicFilter === ADDRESSING_TOPIC_ID ? '判断 3.1 及其子节点的当前掌握情况。' : '按当前题集识别已掌握内容和待补强知识原子。'}
          </div>
          <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-slate-200">完成条件：</span>全部题目作答并成功取得服务端交卷回执。
          </div>
          <div className="rounded-md border border-cyan-300/15 bg-cyan-300/[0.04] px-3 py-2.5 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-cyan-100">交卷后：</span>
            {assessmentMode === 'retest'
              ? '返回任务查看完成回执。'
              : topicFilter === ADDRESSING_TOPIC_ID
                ? '按服务端薄弱点进入补学确认。'
                : '查看诊断并进入对应学习路径。'}
          </div>
        </section>
      </details>

      <section aria-labelledby="quiz-assessment-title" className="grid items-start gap-5 px-4 py-4 xl:grid-cols-[260px_minmax(0,1fr)_300px] md:px-6">
        <aside className="order-2 rounded-md border border-white/[0.08] bg-white/[0.035] p-3 xl:order-1 xl:sticky xl:top-20 xl:self-start">
          <details className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-md px-2 py-2 text-sm font-semibold text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 xl:hidden">
              <span>题目导航 · 第 {currentQuestionIndex + 1}/{shuffledQuestions.length} 题</span>
              <span className="flex items-center gap-2 font-mono text-[10px] font-normal text-slate-500">
                已答 {answeredCount} 题
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="mb-3 hidden items-center justify-between px-2 xl:flex">
              <div className="text-sm font-semibold text-slate-100">题目导航</div>
              <div className="font-mono text-[10px] text-slate-500">已答 {answeredCount} 题</div>
            </div>
            <div className="mt-2 hidden max-h-[280px] grid-cols-5 gap-2 overflow-y-auto pr-1 group-open:grid md:max-h-[460px] xl:mt-0 xl:grid xl:grid-cols-4">
            {shuffledQuestions.map((question, index) => {
              const status = answerStatus[question.id];
              const hasAnswer = !!answers[question.id]?.trim();
              const isCurrent = index === currentQuestionIndex;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => goToQuestion(index)}
                  className={cn(
                    'flex aspect-square min-h-11 items-center justify-center rounded-md border font-mono text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100',
                    isCurrent && 'border-cyan-300/60 bg-cyan-300/[0.14] text-cyan-100',
                    !isCurrent && status === 'correct' && 'border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200',
                    !isCurrent && status === 'incorrect' && 'border-red-300/30 bg-red-300/[0.08] text-red-200',
                    !isCurrent && !status && hasAnswer && 'border-amber-300/30 bg-amber-300/[0.08] text-amber-200',
                    !isCurrent && !status && !hasAnswer && 'border-white/[0.08] bg-black/20 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200',
                  )}
                  aria-label={`第 ${index + 1} 题`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {status === 'correct' ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : status === 'incorrect' ? (
                    <XCircle className="h-3.5 w-3.5" />
                  ) : hasAnswer ? (
                    <FileText className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </button>
              );
            })}
            </div>
            <div className="mt-4 hidden space-y-2 text-xs text-slate-500 group-open:block xl:block">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-cyan-300" /> 当前题</div>
              <div className="mt-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /> 已作答</div>
              <div className="mt-2 text-[11px] leading-5 text-slate-600">正确答案将在交卷成功后由服务端统一返回。</div>
            </div>
          </details>
        </aside>

        <section className="order-1 rounded-md border border-white/[0.08] bg-white/[0.035] xl:order-2">
          <div className="border-b border-white/[0.08] p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 font-mono text-[11px] text-cyan-100">
                    Q{currentQuestionIndex + 1}/{shuffledQuestions.length}
                  </span>
                  <span className="sr-only">
                    第 {currentQuestionIndex + 1} / {shuffledQuestions.length} 题
                  </span>
              <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-400">
                CH{currentQuestion.chapter}
              </span>
              <span className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1 font-mono text-[11px] text-slate-400">
                {currentQuestion.type === 'code-completion' ? 'CODE' : 'CHOICE'}
              </span>
            </div>
            <h2
              ref={questionHeadingRef}
              tabIndex={-1}
              className="text-xl font-semibold leading-8 text-slate-50 focus-visible:outline-none md:text-2xl"
            >
              {currentQuestion.questionText}
            </h2>
          </div>

          <div className="space-y-5 p-5">
            {hasPendingSubmission && (
              <div
                className="rounded-md border border-amber-300/25 bg-amber-300/[0.08] px-4 py-3 text-sm leading-6 text-amber-100"
                role="status"
              >
                原交卷结果尚待确认，答案已锁定。再次提交将按原答题内容核对，不会改写本次尝试。
              </div>
            )}
            {currentQuestion.type === 'multiple-choice' && (
              <RadioGroup
                value={currentAnswer}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-3"
                disabled={isAnswerInputLocked}
              >
                {currentQuestion.options.map((option, index) => {
                  const correctAnswer = submissionResult?.questionResults[String(currentQuestion.id)]?.correctAnswer;
                  const isCorrectOption = option === correctAnswer;
                  const isSelectedOption = currentAnswer === option;
                  return (
                    <Label
                      key={option}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-md border p-4 transition',
                        'border-white/[0.08] bg-black/20 text-slate-200 hover:bg-white/[0.06]',
                        isAnswerInputLocked && 'cursor-default hover:bg-black/20',
                        !isAnswerInputLocked && 'has-[input:checked]:border-cyan-300/50 has-[input:checked]:bg-cyan-300/[0.08]',
                        isCurrentQuestionChecked && isCorrectOption && 'border-emerald-300/40 bg-emerald-300/[0.08] text-emerald-100',
                        isCurrentQuestionChecked && !isCorrectOption && isSelectedOption && 'border-red-300/40 bg-red-300/[0.08] text-red-100',
                      )}
                    >
                      <RadioGroupItem value={option} id={`${currentQuestion.id}-${index}`} aria-label={option} className="mt-1" />
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/[0.12] font-mono text-xs text-slate-400">
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm leading-6 md:text-base">{option}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            )}

            {currentQuestion.type === 'code-completion' && ((): React.JSX.Element => {
              const codeCompletionQuestion = currentQuestion as Extract<PublicQuestion, { type: 'code-completion' }>;
              const codeParts = codeCompletionQuestion.code.split('___');
              return (
                <div className="space-y-3">
                  {codeParts[0] && (
                    <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070a] p-4">
                      <pre className="font-code text-sm leading-6 text-slate-300"><code>{codeParts[0]}</code></pre>
                    </div>
                  )}
                  <Input
                    className={cn(
                      'h-12 border-white/[0.1] bg-black/30 font-code text-base text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-300/70',
                      isCurrentQuestionChecked && isCurrentAnswerCorrect && 'border-emerald-300/50 focus-visible:ring-emerald-300/70',
                      isCurrentQuestionChecked && !isCurrentAnswerCorrect && 'border-red-300/50 focus-visible:ring-red-300/70'
                    )}
                    placeholder="在此处输入代码..."
                    aria-label={`第 ${currentQuestionIndex + 1} 题代码答案`}
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    disabled={isAnswerInputLocked}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {codeParts[1] && (
                    <div className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#05070a] p-4">
                      <pre className="font-code text-sm leading-6 text-slate-300"><code>{codeParts[1]}</code></pre>
                    </div>
                  )}
                </div>
              );
            })()}

            {isCurrentQuestionChecked && (
              <div
                className={cn(
                  'rounded-md border p-4',
                  isCurrentAnswerCorrect ? 'border-emerald-300/25 bg-emerald-300/[0.08]' : 'border-red-300/25 bg-red-300/[0.08]'
                )}
              >
                <div className="flex items-start gap-3">
                  {isCurrentAnswerCorrect ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                  )}
                  <div className="min-w-0">
                    <div className={cn('text-sm font-semibold', isCurrentAnswerCorrect ? 'text-emerald-100' : 'text-red-100')}>
                      {isCurrentAnswerCorrect ? '回答正确！' : '回答错误'}
                    </div>
                    {!isCurrentAnswerCorrect && (
                      <div className="mt-2 text-sm text-slate-300">
                        正确答案：
                        <span className="font-code font-semibold text-slate-50">
                          {submissionResult?.questionResults[String(currentQuestion.id)]?.correctAnswer ?? '以服务端结果为准'}
                        </span>
                      </div>
                    )}
                    <Button asChild variant="link" size="sm" className="mt-2 h-auto p-0 text-cyan-200 hover:text-cyan-100">
                      <Link href={`/#item-${currentQuestion.chapter}`}>
                        <BookCopy className="mr-2 h-4 w-4" />
                        复习第 {currentQuestion.chapter} 章的相关知识点
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="min-h-11 border border-white/[0.1] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-slate-50"
            >
              <ChevronsLeft className="mr-2 h-4 w-4" />
              上一题
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={handleNext}
                disabled={currentQuestionIndex >= shuffledQuestions.length - 1}
                className="min-h-11 bg-cyan-300 text-[#001014] hover:bg-cyan-200"
              >
                下一题
                <ChevronsRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={handleSubmitQuiz}
                disabled={isSavingResults || (!hasPendingSubmission && (answeredCount === 0 || (requiresCompleteSubmission && answeredCount !== shuffledQuestions.length)))}
                aria-busy={isSavingResults}
                title={hasPendingSubmission
                  ? '按原答题内容重新核对本次交卷'
                  : requiresCompleteSubmission && answeredCount !== shuffledQuestions.length
                    ? `还有 ${shuffledQuestions.length - answeredCount} 道题未作答`
                    : undefined}
                className="min-h-11 border border-amber-300/25 bg-amber-300/[0.12] text-amber-100 hover:bg-amber-300/[0.18] hover:text-amber-50"
              >
                {isSavingResults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {hasPendingSubmission
                  ? isSavingResults ? '正在核对原交卷...' : '重新核对原交卷'
                  : requiresCompleteSubmission && answeredCount !== shuffledQuestions.length
                    ? `还需完成 ${shuffledQuestions.length - answeredCount} 题`
                    : '完成并查看报告'}
              </Button>
            </div>
          </div>
        </section>

        <aside className="order-3 space-y-5 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
              <Target className="h-4 w-4 text-cyan-200" />
              当前知识原子
            </div>
            <div className="glass-hover animate-slide-up rounded-md border border-white/[0.08] bg-black/20 p-4 transition-all">
              <div className="text-base font-semibold text-slate-50">
                <KaChip ka={currentQuestion.ka} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>{topicFilter ? '本专项题量' : '章节内题量'}</span>
                <span className="font-mono text-slate-300">{chapterQuestionCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>本卷作答进度</span>
                <span className="font-mono text-slate-300">{answerProgress.toFixed(0)}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.min(100, Math.max(0, answerProgress))}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
              <Timer className="h-4 w-4 text-amber-300" />
              作答状态
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between font-mono text-[11px] text-slate-500">
                  <span>已作答</span>
                  <span>{answeredCount}/{shuffledQuestions.length}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]">
                  <div className="h-full rounded-full bg-amber-300" style={{ width: `${answerProgress}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">{answeredCount}</div>
                  <div className="text-xs text-slate-500">已完成作答</div>
                </div>
                <div className="rounded-md border border-white/[0.08] bg-black/20 p-3">
                  <div className="font-mono text-lg text-slate-50">—</div>
                  <div className="text-xs text-slate-500">交卷后诊断</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-white/[0.08] bg-white/[0.035] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-50">
              <TerminalSquare className="h-4 w-4 text-cyan-200" />
              待关注
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-sm leading-6 text-slate-500">完成交卷后，系统将在此显示需要补学的子知识点。</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
