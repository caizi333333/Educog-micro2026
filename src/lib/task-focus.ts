/**
 * Which active learning path is the student's default next task.
 *
 * Uses the same receipt as 薄弱点 ({@link selectDiagnosticAttempt}):
 * a comprehensive assessment leads. An active path whose quizzes do not
 * include that receipt stays on /tasks and is labeled pinned. It does not
 * become the silent default on the task list, the home next step, or
 * /learning-path.
 *
 * With no comprehensive receipt, an active path that includes the canonical
 * quiz is the default. A path for a different paper is pinned.
 */

import { COMPREHENSIVE_QUIZ_ID, type DiagnosticAttemptCandidate } from '@/lib/diagnostic-attempt';
import { ADDRESSING_QUIZ_ID } from '@/lib/lesson-tasks';

export type TaskAlignment = 'default' | 'pinned';

export interface TaskFocusPath {
  id: string;
  status: string;
  quizIds: readonly string[];
}

export interface TaskFocusDecision {
  /** Active path whose paper matches the canonical receipt, when one exists. */
  defaultPathId: string | null;
  /** Active paths that must be labeled as pinned assignments. */
  pinnedPathIds: string[];
  /** The canonical receipt is the next step because no active path carries it. */
  diagnosticLeads: boolean;
}

export interface RemediationQuizLink {
  text: string;
  href: string;
}

/** Quiz ids declared on a path's steps, in step order, without duplicates. */
export function quizIdsFromSteps(steps: readonly { quizId?: string | null }[]): string[] {
  const quizIds: string[] = [];
  for (const step of steps) {
    const quizId = step.quizId?.trim();
    if (quizId && !quizIds.includes(quizId)) quizIds.push(quizId);
  }
  return quizIds;
}

/**
 * Choose the default next task.
 *
 * `paths` should already be in the order the task list shows (newest first).
 * `canonical` is {@link selectDiagnosticAttempt}, or null when the student
 * has no usable quiz receipt.
 */
export function decideTaskFocus(
  paths: readonly TaskFocusPath[],
  canonical: Pick<DiagnosticAttemptCandidate, 'quizId'> | null,
): TaskFocusDecision {
  const activePaths = paths.filter((path) => path.status === 'ACTIVE');
  if (!canonical) {
    return {
      defaultPathId: activePaths[0]?.id ?? null,
      pinnedPathIds: [],
      diagnosticLeads: false,
    };
  }
  const aligned = activePaths.filter((path) => path.quizIds.includes(canonical.quizId));
  const pinned = activePaths.filter((path) => !path.quizIds.includes(canonical.quizId));
  return {
    defaultPathId: aligned[0]?.id ?? null,
    pinnedPathIds: pinned.map((path) => path.id),
    diagnosticLeads: aligned.length === 0,
  };
}

/**
 * Closing quiz on a remedial plan.
 *
 * A comprehensive receipt stays on the comprehensive paper. A 3.1 atom inside
 * that receipt does not switch the plan to the addressing retest. The
 * addressing retest is used only when the receipt itself is the addressing paper.
 */
export function remediationQuizLink(quizId: string | null | undefined): RemediationQuizLink {
  if (quizId === ADDRESSING_QUIZ_ID) {
    return { text: '再次测评寻址方式', href: '/quiz?topic=addressing-modes&mode=retest' };
  }
  const chapter = quizId ? /^quiz-ch(\d+)$/.exec(quizId) : null;
  if (chapter) {
    return { text: `重测第${chapter[1]}章`, href: `/quiz?chapter=${chapter[1]}` };
  }
  if (quizId === COMPREHENSIVE_QUIZ_ID || !quizId) {
    return { text: '重新测评', href: '/quiz' };
  }
  return { text: '重新测评', href: '/quiz' };
}
