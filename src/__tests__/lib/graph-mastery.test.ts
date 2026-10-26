import { computeStep } from '@/components/onboarding/NextStepBanner';
import { COMPREHENSIVE_QUIZ_ID } from '@/lib/diagnostic-attempt';
import {
  buildGraphMastery,
  diagnosticAttemptFromLocalReceipt,
  graphMasteryLabel,
  resolveGraphMasteryFromActivities,
  type GraphPointRef,
} from '@/lib/graph-mastery';

const comprehensiveWeak = [
  '1.1.1', '1.1.2', '1.1.3', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3', '1.3.1', '1.3.2', '1.4.1', '1.4.3',
];

const points: GraphPointRef[] = [
  { id: '1' },
  { id: '1.1', parentId: '1' },
  { id: '1.1.1', parentId: '1.1' },
  { id: '1.1.2', parentId: '1.1' },
  { id: '1.1.3', parentId: '1.1' },
  { id: '1.2', parentId: '1' },
  { id: '1.2.1', parentId: '1.2' },
  { id: '1.2.2', parentId: '1.2' },
  { id: '1.2.3', parentId: '1.2' },
  { id: '1.3', parentId: '1' },
  { id: '1.3.1', parentId: '1.3' },
  { id: '1.3.2', parentId: '1.3' },
  { id: '1.4', parentId: '1' },
  { id: '1.4.1', parentId: '1.4' },
  { id: '1.4.3', parentId: '1.4' },
  { id: '1.4.4', parentId: '1.4' },
  { id: '2' },
  { id: '2.1', parentId: '2' },
  { id: '3' },
  { id: '3.1', parentId: '3' },
  { id: '3.1.6', parentId: '3.1' },
];

function activity(id: string, createdAt: string, details: Record<string, unknown>) {
  return { id, createdAt, details: JSON.stringify(details) };
}

/** Newest quiz is a chapter paper. The comprehensive receipt is older and has no scoresByKA. */
const test0872001Activities = [
  activity('ch1', '2026-10-26T17:03:08.000Z', {
    quizId: 'quiz-ch1',
    assessmentMode: 'initial',
    score: 58.3,
    weakAreas: ['1.2', '1.4.1', '1.4.3', '1.4.4'],
  }),
  activity('comprehensive', '2026-10-26T17:02:53.000Z', {
    quizId: COMPREHENSIVE_QUIZ_ID,
    assessmentMode: 'initial',
    score: 20,
    weakAreas: comprehensiveWeak,
  }),
  activity('retest', '2026-10-26T17:02:40.000Z', {
    quizId: 'quiz-ch3-addressing',
    assessmentMode: 'retest',
    score: 85.7,
    weakAreas: ['3.1.6'],
  }),
  activity('initial-addressing', '2026-10-26T16:40:00.000Z', {
    quizId: 'quiz-ch3-addressing',
    assessmentMode: 'initial',
    score: 57.1,
    weakAreas: ['3.1.4', '3.1.2', '3.1.6'],
  }),
];

describe('knowledge graph diagnostic mastery', () => {
  it('colors the comprehensive weak atoms and stops the first-diagnostic prompt', () => {
    const view = resolveGraphMasteryFromActivities(test0872001Activities, points);

    expect(view.attempt?.quizId).toBe(COMPREHENSIVE_QUIZ_ID);
    expect(view.attempt?.score).toBe(20);
    expect(view.snapshot?.weakKAs).toHaveLength(12);
    expect(view.sourceLabel).toContain('最近一次综合测评');
    expect(view.sourceLabel).toContain('20分');
    expect(computeStep(view.snapshot, false)).toMatchObject({
      kind: 'has-weak',
      title: '你有 12 个薄弱点等着补',
    });
    expect(computeStep(view.snapshot, false).title).not.toBe('先做一次诊断测验');

    expect(view.masteryById['1.1.1']).toEqual({ score: null, band: 'weak' });
    expect(graphMasteryLabel(view.masteryById['1.1.1']!)).toBe('诊断薄弱');
    expect(view.masteryById['1.2']).toEqual({ score: null, band: 'weak' });
    expect(view.masteryById['1']).toEqual({ score: null, band: 'contains-weak' });
    expect(graphMasteryLabel(view.masteryById['1']!)).toBe('含薄弱点');
    expect(view.masteryById['1.4.4']).toBeUndefined();
    expect(view.masteryById['3.1.6']).toBeUndefined();
    expect(view.masteryById['2']).toBeUndefined();
  });

  it('uses stored percents without painting a strong sibling over an unscored weak atom', () => {
    const view = resolveGraphMasteryFromActivities([
      activity('comprehensive', '2026-10-26T17:02:53.000Z', {
        quizId: COMPREHENSIVE_QUIZ_ID,
        assessmentMode: 'initial',
        score: 20,
        weakAreas: ['1.2'],
        scoresByKA: {
          '1.1': { correct: 1, total: 1, score: 100 },
          '2.1': { correct: 0, total: 1, score: 40 },
        },
      }),
      activity('ch1', '2026-10-26T17:03:08.000Z', {
        quizId: 'quiz-ch1',
        assessmentMode: 'initial',
        score: 58.3,
        weakAreas: ['1.4.4'],
        scoresByKA: { '1.4.4': { score: 10 } },
      }),
    ], points);

    expect(view.masteryById['1.1']).toEqual({ score: 100, band: 'strong' });
    expect(view.masteryById['1.2']).toEqual({ score: null, band: 'weak' });
    expect(view.masteryById['1']).toEqual({ score: null, band: 'contains-weak' });
    expect(view.masteryById['2.1']).toEqual({ score: 40, band: 'weak' });
    expect(view.masteryById['2']).toEqual({ score: 40, band: 'weak' });
    expect(graphMasteryLabel(view.masteryById['2']!)).toBe('掌握 40%');
    expect(view.masteryById['1.4.4']).toBeUndefined();
  });

  it('rolls a fully scored weak chapter up to the unit card', () => {
    const mastery = buildGraphMastery(
      points,
      { '1.1.1': { score: 0 }, '1.1.2': { score: 20 }, '1.4.1': { score: 90 } },
      ['1.1.1', '1.1.2'],
    );
    expect(mastery['1.1.1']).toEqual({ score: 0, band: 'weak' });
    expect(mastery['1.4.1']).toEqual({ score: 90, band: 'strong' });
    expect(mastery['1.1']?.band).toBe('weak');
    expect(mastery['1.1']?.score).toBe(10);
    expect(mastery['1']?.band).not.toBe('strong');
  });

  it('treats an empty weak list on a completed receipt as already diagnosed', () => {
    const view = resolveGraphMasteryFromActivities([
      activity('comprehensive', '2026-10-26T17:02:53.000Z', {
        quizId: COMPREHENSIVE_QUIZ_ID,
        assessmentMode: 'initial',
        score: 96,
        weakAreas: [],
        scoresByKA: { '2.1': { score: 96 } },
      }),
    ], points);
    expect(computeStep(view.snapshot, false).kind).toBe('no-experiment');
    expect(view.masteryById['2.1']).toEqual({ score: 96, band: 'strong' });
  });

  it('reads a local quiz receipt when it is the only evidence', () => {
    const attempt = diagnosticAttemptFromLocalReceipt(JSON.stringify({
      quizId: COMPREHENSIVE_QUIZ_ID,
      weakKAs: ['1.1.1'],
      totalScore: 20,
      timestamp: '2026-10-26T17:02:53.000Z',
    }));
    expect(attempt?.weakAreas).toEqual(['1.1.1']);
    expect(attempt?.score).toBe(20);
    expect(diagnosticAttemptFromLocalReceipt('not-json')).toBeNull();
  });
});
