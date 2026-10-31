/**
 * Which quiz attempt drives 薄弱点.
 *
 * Default, used by /weak-nodes, /learning-path, /tasks, and the home next-step
 * banner when the page is not opened from a specific receipt:
 * 1. Latest `comprehensive-assessment`, if the student has one.
 * 2. Otherwise the latest initial assessment (assessmentMode is not `retest`).
 * 3. Otherwise the latest attempt of any kind, so a page is not blank.
 *
 * A later chapter quiz or addressing retest must not replace the comprehensive
 * diagnostic. Task links and the quiz report pass quizId (and mode) and then
 * win over the default, and the page says so.
 *
 * Selection looks at the newest {@link DIAGNOSTIC_ACTIVITY_LIMIT} COMPLETE_QUIZ
 * activities, ordered by createdAt then id. Older receipts stay reachable from
 * their task link, which queries that receipt directly.
 */

import { formatCampusDateTime, CAMPUS_TIME_ZONE } from '@/lib/campus-time';
import { FINAL_OBJECTIVE_QUIZ_ID } from '@/lib/final-objective-sample';

export const COMPREHENSIVE_QUIZ_ID = 'comprehensive-assessment';

export const DIAGNOSTIC_ACTIVITY_LIMIT = 50;

export const DIAGNOSTIC_SELECTION_RULE =
  '薄弱点默认采用最近一次综合测评；还没有综合测评时，采用最近一次首测（不含再次作答）。从诊断报告或任务链接进入时，按该次指定试卷对齐，不静默改用其他试卷。';

export type AssessmentMode = 'initial' | 'retest';

export interface DiagnosticAttemptCandidate {
  quizId: string;
  assessmentMode: AssessmentMode;
  completedAt: string;
  score: number | null;
  weakAreas: string[];
  pathId: string | null;
  activityId: string | null;
  scoresByKA?: unknown;
  questionSetVersion?: string;
}

export interface DiagnosticAttemptOption {
  key: string;
  attempt: DiagnosticAttemptCandidate;
  canonical: boolean;
}

interface ActivityRow {
  id?: string | null;
  createdAt?: string | null;
  details?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function completedAtValue(attempt: DiagnosticAttemptCandidate): number {
  const parsed = Date.parse(attempt.completedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Turn one COMPLETE_QUIZ activity into a candidate. Returns null when the
 * payload is not a JSON object. Missing quizId is kept as `unknown-quiz` so
 * older rows still count; missing assessmentMode counts as initial.
 */
export function parseQuizActivityDetails(activity: ActivityRow): DiagnosticAttemptCandidate | null {
  if (!activity.details) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(activity.details);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const weakSource = Array.isArray(raw.weakAreas) ? raw.weakAreas : raw.weakKAs;
  const weakAreas = Array.isArray(weakSource)
    ? weakSource.filter((value): value is string => typeof value === 'string')
    : [];
  const quizId = typeof raw.quizId === 'string' && raw.quizId.trim() ? raw.quizId.trim() : 'unknown-quiz';
  const pathId = typeof raw.pathId === 'string' && raw.pathId.trim() ? raw.pathId.trim() : null;
  const questionSetVersion = typeof raw.questionSetVersion === 'string' ? raw.questionSetVersion : undefined;
  return {
    quizId,
    assessmentMode: raw.assessmentMode === 'retest' ? 'retest' : 'initial',
    completedAt: typeof activity.createdAt === 'string' ? activity.createdAt : '',
    score: typeof raw.score === 'number' && Number.isFinite(raw.score) ? raw.score : null,
    weakAreas,
    pathId,
    activityId: typeof activity.id === 'string' ? activity.id : null,
    ...(raw.scoresByKA !== undefined ? { scoresByKA: raw.scoresByKA } : {}),
    ...(questionSetVersion ? { questionSetVersion } : {}),
  };
}

/** Newest first. Equal timestamps break ties by activity id. */
export function rankDiagnosticAttempts<T extends DiagnosticAttemptCandidate>(attempts: readonly T[]): T[] {
  return [...attempts].sort((left, right) => {
    const delta = completedAtValue(right) - completedAtValue(left);
    if (delta !== 0) return delta;
    return (right.activityId ?? '').localeCompare(left.activityId ?? '');
  });
}

/** Default 薄弱点 source. See the module comment. */
export function selectDiagnosticAttempt<T extends DiagnosticAttemptCandidate>(attempts: readonly T[]): T | null {
  const ranked = rankDiagnosticAttempts(attempts);
  return ranked.find((attempt) => attempt.quizId === COMPREHENSIVE_QUIZ_ID)
    ?? ranked.find((attempt) => attempt.assessmentMode !== 'retest')
    ?? ranked[0]
    ?? null;
}

/**
 * Receipt pinned by the page URL. Every provided field must match.
 * Among matches, the newest one wins.
 */
export function selectExplicitAttempt<T extends DiagnosticAttemptCandidate>(
  attempts: readonly T[],
  filter: { quizId?: string | null; assessmentMode?: AssessmentMode | null; pathId?: string | null },
): T | null {
  return rankDiagnosticAttempts(attempts).find((attempt) => (
    (!filter.quizId || attempt.quizId === filter.quizId)
    && (!filter.assessmentMode || attempt.assessmentMode === filter.assessmentMode)
    && (!filter.pathId || attempt.pathId === filter.pathId)
  )) ?? null;
}

/**
 * One row per quiz + mode (the newest of that pair), canonical row first.
 * The selector uses this so two attempts of the same paper do not look like
 * two different sources when the URL can only pin quizId and mode.
 */
export function listDiagnosticOptions(attempts: readonly DiagnosticAttemptCandidate[]): DiagnosticAttemptOption[] {
  const canonical = selectDiagnosticAttempt(attempts);
  const seen = new Set<string>();
  const options: DiagnosticAttemptOption[] = [];
  for (const attempt of rankDiagnosticAttempts(attempts)) {
    const key = `${attempt.quizId}|${attempt.assessmentMode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({
      key,
      attempt,
      canonical: canonical?.quizId === attempt.quizId && canonical.assessmentMode === attempt.assessmentMode,
    });
  }
  return options.sort((left, right) => Number(right.canonical) - Number(left.canonical) || left.key.localeCompare(right.key));
}

export function quizDisplayName(quizId: string): string {
  if (quizId === COMPREHENSIVE_QUIZ_ID) return '综合测评';
  if (quizId === FINAL_OBJECTIVE_QUIZ_ID) return '期末客观模拟';
  if (quizId === 'quiz-ch3-addressing') return '3.1 寻址方式专项';
  const chapter = /^quiz-ch(\d+)$/.exec(quizId);
  if (chapter) return `第${chapter[1]}章测验`;
  return quizId;
}

export function describeDiagnosticSource(
  attempt: DiagnosticAttemptCandidate,
  kind: 'canonical' | 'explicit',
): string {
  const when = attempt.completedAt
    ? `${formatCampusDateTime(attempt.completedAt)}（${CAMPUS_TIME_ZONE}）`
    : '时间待核实';
  const score = attempt.score === null ? '分数未记录' : `${Math.round(attempt.score)}分`;
  const name = quizDisplayName(attempt.quizId);
  if (kind === 'explicit') {
    return `指定试卷「${name}」${score}，交卷于 ${when}`;
  }
  if (attempt.quizId === COMPREHENSIVE_QUIZ_ID) {
    return `默认口径：最近一次综合测评「${name}」${score}，交卷于 ${when}`;
  }
  if (attempt.assessmentMode !== 'retest') {
    return `默认口径：尚无综合测评，使用最近一次首测「${name}」${score}，交卷于 ${when}`;
  }
  return `默认口径：使用最近一次测评「${name}」${score}，交卷于 ${when}`;
}

export function attemptOptionLabel(attempt: DiagnosticAttemptCandidate, canonical: boolean): string {
  const score = attempt.score === null ? '—' : `${Math.round(attempt.score)}分`;
  const when = attempt.completedAt ? formatCampusDateTime(attempt.completedAt) : '时间待核实';
  const stage = attempt.quizId === COMPREHENSIVE_QUIZ_ID
    ? '综合卷'
    : attempt.assessmentMode === 'retest' ? '再次作答' : '首测';
  return `${canonical ? '默认 · ' : ''}${quizDisplayName(attempt.quizId)} · ${stage} · ${score} · ${when}`;
}

/** Activity list used to resolve 薄弱点. Pass a filter only for a pinned task receipt. */
export function diagnosticActivitiesQuery(explicit?: {
  quizId?: string | null;
  assessmentMode?: AssessmentMode | null;
  pathId?: string | null;
} | null): string {
  const params = new URLSearchParams({
    action: 'COMPLETE_QUIZ',
    limit: String(explicit ? 1 : DIAGNOSTIC_ACTIVITY_LIMIT),
  });
  if (explicit?.quizId) params.set('quizId', explicit.quizId);
  if (explicit?.assessmentMode) params.set('assessmentMode', explicit.assessmentMode);
  if (explicit?.pathId) params.set('pathId', explicit.pathId);
  return `/api/user/activities?${params.toString()}`;
}
