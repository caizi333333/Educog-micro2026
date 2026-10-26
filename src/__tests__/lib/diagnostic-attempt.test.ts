import {
  COMPREHENSIVE_QUIZ_ID,
  describeDiagnosticSource,
  listDiagnosticOptions,
  parseQuizActivityDetails,
  selectDiagnosticAttempt,
  selectExplicitAttempt,
  type DiagnosticAttemptCandidate,
} from '@/lib/diagnostic-attempt';

function attempt(overrides: Partial<DiagnosticAttemptCandidate> & Pick<DiagnosticAttemptCandidate, 'quizId' | 'completedAt'>): DiagnosticAttemptCandidate {
  return {
    assessmentMode: 'initial',
    score: null,
    weakAreas: [],
    pathId: null,
    activityId: null,
    ...overrides,
  };
}

describe('diagnostic attempt selection', () => {
  const comprehensiveWeak = ['1.1.1', '1.1.2', '1.1.3', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3', '1.3.1', '1.3.2', '1.4.1', '1.4.3'];
  const test0872001 = [
    attempt({
      quizId: 'quiz-ch1',
      completedAt: '2026-10-26T17:03:08.000Z',
      score: 58.3,
      weakAreas: ['1.2', '1.4.1', '1.4.3', '1.4.4'],
      activityId: 'ch1',
    }),
    attempt({
      quizId: 'quiz-ch3-addressing',
      assessmentMode: 'retest',
      completedAt: '2026-10-26T17:02:40.000Z',
      score: 85.7,
      weakAreas: ['3.1.6'],
      activityId: 'retest',
    }),
    attempt({
      quizId: COMPREHENSIVE_QUIZ_ID,
      completedAt: '2026-10-26T17:02:53.000Z',
      score: 20,
      weakAreas: comprehensiveWeak,
      activityId: 'comprehensive',
    }),
    attempt({
      quizId: 'quiz-ch3-addressing',
      completedAt: '2026-10-26T16:40:00.000Z',
      score: 57.1,
      weakAreas: ['3.1.4', '3.1.2', '3.1.6'],
      activityId: 'initial-addressing',
    }),
  ];

  it('keeps the latest comprehensive assessment when later quizzes land', () => {
    const chosen = selectDiagnosticAttempt(test0872001);
    expect(chosen?.quizId).toBe(COMPREHENSIVE_QUIZ_ID);
    expect(chosen?.score).toBe(20);
    expect(chosen?.weakAreas).toHaveLength(12);
    expect(describeDiagnosticSource(chosen!, 'canonical')).toContain('2026/10/27 01:02:53');
    expect(describeDiagnosticSource(chosen!, 'canonical')).not.toContain('2026/10/26 10:');
  });

  it('uses the latest initial assessment only when no comprehensive exists', () => {
    const withoutComprehensive = test0872001.filter((item) => item.quizId !== COMPREHENSIVE_QUIZ_ID);
    const chosen = selectDiagnosticAttempt(withoutComprehensive);
    expect(chosen?.quizId).toBe('quiz-ch1');
    expect(chosen?.weakAreas).toEqual(['1.2', '1.4.1', '1.4.3', '1.4.4']);
  });

  it('does not let a retest replace an earlier initial assessment', () => {
    const chosen = selectDiagnosticAttempt([
      test0872001[1]!,
      test0872001[3]!,
    ]);
    expect(chosen?.activityId).toBe('initial-addressing');
    expect(chosen?.weakAreas).toEqual(['3.1.4', '3.1.2', '3.1.6']);
  });

  it('pins an explicit receipt instead of the default rule', () => {
    const chosen = selectExplicitAttempt(test0872001, {
      quizId: 'quiz-ch3-addressing',
      assessmentMode: 'retest',
    });
    expect(chosen?.weakAreas).toEqual(['3.1.6']);
    expect(describeDiagnosticSource(chosen!, 'explicit')).toContain('指定试卷');
  });

  it('lists each quiz and mode once, with the comprehensive row marked default', () => {
    const options = listDiagnosticOptions(test0872001);
    expect(options.map((option) => option.key)).toEqual([
      'comprehensive-assessment|initial',
      'quiz-ch1|initial',
      'quiz-ch3-addressing|initial',
      'quiz-ch3-addressing|retest',
    ]);
    expect(options.filter((option) => option.canonical)).toHaveLength(1);
    expect(options[0]?.canonical).toBe(true);
  });

  it('parses a COMPLETE_QUIZ activity and ignores a broken payload', () => {
    expect(parseQuizActivityDetails({
      id: 'act-1',
      createdAt: '2026-10-26T17:02:53.000Z',
      details: JSON.stringify({
        quizId: COMPREHENSIVE_QUIZ_ID,
        score: 20,
        weakAreas: ['1.2'],
        assessmentMode: 'initial',
      }),
    })).toMatchObject({
      quizId: COMPREHENSIVE_QUIZ_ID,
      score: 20,
      weakAreas: ['1.2'],
      activityId: 'act-1',
    });
    expect(parseQuizActivityDetails({ details: 'not-json' })).toBeNull();
  });
});
