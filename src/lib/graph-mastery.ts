/**
 * Knowledge-graph mastery coloring.
 *
 * The graph uses the same default receipt as 薄弱点
 * ({@link selectDiagnosticAttempt}): the latest comprehensive assessment, otherwise
 * the latest initial assessment. A later chapter quiz or retest must not wipe
 * that receipt. Node color comes from that receipt's per-atom scores when they
 * exist, and from its weak-atom list when a score was not stored. Scores roll
 * up to parents. They never smear sideways onto an unscored sibling, and a
 * strong sibling average must not paint a chapter as mastered while a weak
 * atom is still listed.
 */

import {
  describeDiagnosticSource,
  parseQuizActivityDetails,
  quizDisplayName,
  selectDiagnosticAttempt,
  type DiagnosticAttemptCandidate,
} from '@/lib/diagnostic-attempt';
import { CAMPUS_TIME_ZONE, formatCampusDateTime } from '@/lib/campus-time';

export type GraphMasteryBand = 'strong' | 'developing' | 'weak' | 'contains-weak';

export interface GraphNodeMastery {
  /** Null when the receipt listed the atom but did not store a percent. */
  score: number | null;
  band: GraphMasteryBand;
}

export interface GraphPointRef {
  id: string;
  parentId?: string;
}

export interface GraphDiagnosticSnapshot {
  weakKAs: string[];
  totalScore?: number;
  scores?: Record<string, { score: number }>;
}

export interface GraphDiagnosticView {
  attempt: DiagnosticAttemptCandidate | null;
  snapshot: GraphDiagnosticSnapshot | null;
  masteryById: Record<string, GraphNodeMastery>;
  sourceLabel: string | null;
}

interface ActivityRow {
  id?: string | null;
  createdAt?: string | null;
  details?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/** Read `{ score }` buckets or bare numbers. Ignores anything that is not a finite percent. */
export function readKaScores(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const scores: Record<string, number> = {};
  for (const [id, entry] of Object.entries(value)) {
    const raw = typeof entry === 'number'
      ? entry
      : isRecord(entry) && typeof entry.score === 'number'
        ? entry.score
        : null;
    if (raw === null || !Number.isFinite(raw)) continue;
    scores[id] = clampScore(raw);
  }
  return scores;
}

export function bandForScore(score: number): GraphMasteryBand {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'developing';
  return 'weak';
}

/**
 * Label shown on a colored node. A weak atom without a stored percent is not
 * given a fake 0%.
 */
export function graphMasteryLabel(mastery: GraphNodeMastery): string {
  if (mastery.score !== null) return `掌握 ${Math.round(mastery.score)}%`;
  if (mastery.band === 'weak') return '诊断薄弱';
  return '含薄弱点';
}

function masteryForNode(score: number | null, selfWeak: boolean, childWeak: boolean): GraphNodeMastery | null {
  if (score !== null && selfWeak) {
    const band = bandForScore(score);
    return { score, band: band === 'strong' ? 'developing' : band };
  }
  if (score !== null && childWeak && bandForScore(score) === 'strong') {
    return { score: null, band: 'contains-weak' };
  }
  if (score !== null) return { score, band: bandForScore(score) };
  if (selfWeak) return { score: null, band: 'weak' };
  if (childWeak) return { score: null, band: 'contains-weak' };
  return null;
}

/**
 * Map one diagnostic receipt onto course nodes.
 *
 * Direct scores win. Otherwise a parent shows the mean of scored descendants.
 * An unscored weak atom stays weak, and its ancestors say they contain a weak
 * point instead of inheriting a sibling's percent.
 */
export function buildGraphMastery(
  points: readonly GraphPointRef[],
  scoresByKA: unknown,
  weakAreas: readonly string[],
): Record<string, GraphNodeMastery> {
  const pointIds = new Set(points.map((point) => point.id));
  const directScores = new Map<string, number>();
  for (const [id, score] of Object.entries(readKaScores(scoresByKA))) {
    if (pointIds.has(id)) directScores.set(id, score);
  }
  const weakIds = new Set(weakAreas.filter((id) => pointIds.has(id)));
  const childrenByParent = new Map<string, string[]>();
  for (const point of points) {
    if (!point.parentId || !pointIds.has(point.parentId)) continue;
    const children = childrenByParent.get(point.parentId) ?? [];
    children.push(point.id);
    childrenByParent.set(point.parentId, children);
  }

  const scoreMemo = new Map<string, number | null>();
  const scoreVisiting = new Set<string>();
  const resolveScore = (id: string): number | null => {
    if (scoreMemo.has(id)) return scoreMemo.get(id) ?? null;
    if (scoreVisiting.has(id)) return null;
    scoreVisiting.add(id);
    let resolved = directScores.get(id) ?? null;
    if (resolved === null) {
      const childScores = (childrenByParent.get(id) ?? [])
        .map((childId) => resolveScore(childId))
        .filter((value): value is number => value !== null);
      resolved = childScores.length > 0
        ? childScores.reduce((sum, value) => sum + value, 0) / childScores.length
        : null;
    }
    scoreVisiting.delete(id);
    scoreMemo.set(id, resolved);
    return resolved;
  };

  const weakMemo = new Map<string, boolean>();
  const weakVisiting = new Set<string>();
  const subtreeWeak = (id: string): boolean => {
    if (weakMemo.has(id)) return weakMemo.get(id) === true;
    if (weakVisiting.has(id)) return false;
    weakVisiting.add(id);
    const value = weakIds.has(id)
      || (childrenByParent.get(id) ?? []).some((childId) => subtreeWeak(childId));
    weakVisiting.delete(id);
    weakMemo.set(id, value);
    return value;
  };

  const masteryById: Record<string, GraphNodeMastery> = {};
  for (const point of points) {
    const score = resolveScore(point.id);
    const selfWeak = weakIds.has(point.id);
    const childWeak = (childrenByParent.get(point.id) ?? []).some((childId) => subtreeWeak(childId));
    const mastery = masteryForNode(score, selfWeak, childWeak);
    if (mastery) masteryById[point.id] = mastery;
  }
  return masteryById;
}

function localSourceLabel(attempt: DiagnosticAttemptCandidate): string {
  const when = attempt.completedAt
    ? `${formatCampusDateTime(attempt.completedAt)}（${CAMPUS_TIME_ZONE}）`
    : '时间待核实';
  const score = attempt.score === null ? '分数未记录' : `${Math.round(attempt.score)}分`;
  return `本机最近一份测评回执「${quizDisplayName(attempt.quizId)}」${score}，记录于 ${when}`;
}

export function graphViewFromAttempt(
  attempt: DiagnosticAttemptCandidate | null,
  points: readonly GraphPointRef[],
  source: 'canonical' | 'local' = 'canonical',
): GraphDiagnosticView {
  if (!attempt) {
    return { attempt: null, snapshot: null, masteryById: {}, sourceLabel: null };
  }
  const scores = readKaScores(attempt.scoresByKA);
  return {
    attempt,
    snapshot: {
      weakKAs: attempt.weakAreas,
      ...(attempt.score !== null ? { totalScore: attempt.score } : {}),
      ...(Object.keys(scores).length > 0
        ? { scores: Object.fromEntries(Object.entries(scores).map(([id, score]) => [id, { score }])) }
        : {}),
    },
    masteryById: buildGraphMastery(points, attempt.scoresByKA, attempt.weakAreas),
    sourceLabel: source === 'local' ? localSourceLabel(attempt) : describeDiagnosticSource(attempt, 'canonical'),
  };
}

/** Turn COMPLETE_QUIZ rows into the graph's default diagnostic view. */
export function resolveGraphMasteryFromActivities(
  activities: readonly ActivityRow[],
  points: readonly GraphPointRef[],
): GraphDiagnosticView {
  const attempts = activities.flatMap((activity) => {
    const parsed = parseQuizActivityDetails(activity);
    return parsed ? [parsed] : [];
  });
  return graphViewFromAttempt(selectDiagnosticAttempt(attempts), points, 'canonical');
}

/**
 * Browser copy of the last paper the quiz page saved. This is not the shared
 * diagnostic rule — callers must prefer {@link resolveGraphMasteryFromActivities}
 * whenever the server answered.
 */
export function diagnosticAttemptFromLocalReceipt(raw: unknown): DiagnosticAttemptCandidate | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  const listedWeak = Array.isArray(value.weakKAs)
    ? value.weakKAs
    : Array.isArray(value.weakAreas)
      ? value.weakAreas
      : null;
  const weakAreas = listedWeak?.filter((entry): entry is string => typeof entry === 'string') ?? null;
  const scores = readKaScores(value.scoresByKA ?? value.scores);
  const score = typeof value.totalScore === 'number' && Number.isFinite(value.totalScore)
    ? value.totalScore
    : typeof value.score === 'number' && Number.isFinite(value.score)
      ? value.score
      : null;
  if (weakAreas === null && score === null && Object.keys(scores).length === 0) return null;
  const quizId = typeof value.quizId === 'string' && value.quizId.trim() ? value.quizId.trim() : 'unknown-quiz';
  const completedAt = typeof value.timestamp === 'string'
    ? value.timestamp
    : typeof value.completedAt === 'string'
      ? value.completedAt
      : '';
  return {
    quizId,
    assessmentMode: value.assessmentMode === 'retest' ? 'retest' : 'initial',
    completedAt,
    score,
    weakAreas: weakAreas ?? Object.entries(scores).filter(([, entry]) => entry < 70).map(([id]) => id),
    pathId: null,
    activityId: null,
    ...(Object.keys(scores).length > 0 ? { scoresByKA: scores } : {}),
  };
}
