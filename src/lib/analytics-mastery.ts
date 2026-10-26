/**
 * Chapter / theme / atom mastery for /analytics.
 *
 * Uses the same diagnostic receipt as 薄弱点 and the knowledge graph
 * ({@link selectDiagnosticAttempt} + {@link buildGraphMastery}). A later
 * chapter quiz does not replace that receipt. Scores roll up only from
 * scored descendants. They never smear sideways onto an unscored sibling,
 * and chapter reading progress stays on the chapter — it is not copied
 * onto every theme.
 */

import {
  parseQuizActivityDetails,
  selectDiagnosticAttempt,
  type DiagnosticAttemptCandidate,
} from '@/lib/diagnostic-attempt';
import {
  graphViewFromAttempt,
  type GraphMasteryBand,
  type GraphNodeMastery,
} from '@/lib/graph-mastery';

export interface AnalyticsKnowledgePoint {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  chapter: number;
}

export interface AnalyticsProgressRow {
  chapterId?: string | null;
  progress?: number | null;
}

export interface AnalyticsActivityRow {
  id?: string | null;
  createdAt?: string | Date | null;
  details?: string | null;
}

export interface AnalyticsMasteryNode {
  id: string;
  name: string;
  mastery: number | null;
  band: GraphMasteryBand | null;
}

export interface AnalyticsThemeMastery extends AnalyticsMasteryNode {
  atoms: AnalyticsMasteryNode[];
}

export interface KnowledgeMasteryItem {
  id: string;
  topic: string;
  mastery: number | null;
  hasRecord: boolean;
  band: GraphMasteryBand | null;
  /** Reading progress for this chapter. Never copied onto themes or atoms. */
  chapterProgress: number | null;
  themes: AnalyticsThemeMastery[];
  /** Theme name → that theme's own score. Null means no stored percent. */
  details: Record<string, number | null>;
}

export interface AnalyticsMasteryReport {
  items: KnowledgeMasteryItem[];
  sourceLabel: string | null;
  attempt: DiagnosticAttemptCandidate | null;
}

function normalizeChapterId(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits ? `ch${digits}` : raw;
}

function activityCreatedAt(value: string | Date | null | undefined): string {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  return typeof value === 'string' ? value : '';
}

function nodeFromMastery(id: string, name: string, mastery: GraphNodeMastery | undefined): AnalyticsMasteryNode {
  return {
    id,
    name,
    mastery: mastery?.score ?? null,
    band: mastery?.band ?? null,
  };
}

/** Student-facing label. A weak atom without a stored percent is not shown as 0% or as untouched. */
export function analyticsMasteryDetail(node: { mastery: number | null; band: GraphMasteryBand | null }): string {
  if (node.mastery !== null && Number.isFinite(node.mastery)) return `${Math.round(node.mastery)}%`;
  if (node.band === 'weak') return '诊断薄弱';
  if (node.band === 'contains-weak') return '含薄弱点';
  return 'N/A · 未形成记录';
}

function chapterProgressById(rows: readonly AnalyticsProgressRow[]): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    if (!row.chapterId || typeof row.progress !== 'number' || !Number.isFinite(row.progress)) continue;
    const chapterId = normalizeChapterId(row.chapterId);
    const bucket = totals.get(chapterId) ?? { sum: 0, count: 0 };
    bucket.sum += Math.max(0, Math.min(100, row.progress));
    bucket.count += 1;
    totals.set(chapterId, bucket);
  }
  const averages = new Map<string, number>();
  for (const [chapterId, bucket] of totals) {
    if (bucket.count > 0) averages.set(chapterId, Math.round(bucket.sum / bucket.count));
  }
  return averages;
}

/**
 * Build the analytics mastery tree.
 *
 * Chapter reading progress is reported on the chapter only. Theme and atom
 * rows come from the diagnostic receipt's per-node scores and weak-atom list.
 */
export function buildAnalyticsKnowledgeMastery(input: {
  points: readonly AnalyticsKnowledgePoint[];
  activities: readonly AnalyticsActivityRow[];
  learningProgress: readonly AnalyticsProgressRow[];
}): AnalyticsMasteryReport {
  const attempts = input.activities.flatMap((activity) => {
    const parsed = parseQuizActivityDetails({
      id: activity.id,
      createdAt: activityCreatedAt(activity.createdAt),
      details: activity.details,
    });
    return parsed ? [parsed] : [];
  });
  const attempt = selectDiagnosticAttempt(attempts);
  const view = graphViewFromAttempt(
    attempt,
    input.points.map((point) => ({ id: point.id, parentId: point.parentId })),
    'canonical',
  );
  const progress = chapterProgressById(input.learningProgress);
  const chapters = input.points
    .filter((point) => point.level === 1)
    .slice()
    .sort((left, right) => left.chapter - right.chapter || left.id.localeCompare(right.id));

  const items = chapters.map((chapter) => {
    const themes = input.points
      .filter((point) => point.level === 2 && point.parentId === chapter.id)
      .map((theme) => {
        const atoms = input.points
          .filter((point) => point.level === 3 && point.parentId === theme.id)
          .map((atom) => nodeFromMastery(atom.id, atom.name, view.masteryById[atom.id]));
        const themeNode = nodeFromMastery(theme.id, theme.name, view.masteryById[theme.id]);
        return { ...themeNode, atoms };
      });
    const chapterNode = nodeFromMastery(chapter.id, chapter.name, view.masteryById[chapter.id]);
    const chapterProgress = progress.get(`ch${chapter.chapter}`) ?? null;
    const hasDiagnostic = chapterNode.band !== null
      || themes.some((theme) => theme.band !== null || theme.atoms.some((atom) => atom.band !== null));
    const details = Object.fromEntries(themes.map((theme) => [theme.name, theme.mastery]));
    return {
      ...chapterNode,
      topic: chapter.name,
      hasRecord: chapterProgress !== null || hasDiagnostic,
      chapterProgress,
      themes,
      details,
    };
  });

  return {
    items,
    sourceLabel: view.sourceLabel,
    attempt,
  };
}
