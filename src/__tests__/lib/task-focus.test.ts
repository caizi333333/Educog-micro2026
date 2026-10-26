import { COMPREHENSIVE_QUIZ_ID } from '@/lib/diagnostic-attempt';
import { ADDRESSING_QUIZ_ID, ADDRESSING_TASK_PRESET } from '@/lib/lesson-tasks';
import { decideTaskFocus, quizIdsFromSteps, remediationQuizLink } from '@/lib/task-focus';

const comprehensiveWeak = [
  '1.1.1', '1.1.2', '1.1.3', '1.2', '1.2.1', '1.2.2', '1.2.3', '1.3', '1.3.1', '1.3.2', '1.4.1', '1.4.3',
];

describe('task focus for TEST0872001', () => {
  const addressingPath = {
    id: 'path-addressing',
    status: 'ACTIVE',
    quizIds: quizIdsFromSteps(ADDRESSING_TASK_PRESET.steps),
  };

  it('does not let a 0/6 addressing path lead when a comprehensive receipt exists', () => {
    const decision = decideTaskFocus([addressingPath], { quizId: COMPREHENSIVE_QUIZ_ID });

    expect(addressingPath.quizIds).toEqual([ADDRESSING_QUIZ_ID]);
    expect(decision.diagnosticLeads).toBe(true);
    expect(decision.defaultPathId).toBeNull();
    expect(decision.pinnedPathIds).toEqual(['path-addressing']);
    expect(comprehensiveWeak).toHaveLength(12);
  });

  it('keeps the addressing path as the default when that paper is the canonical receipt', () => {
    const decision = decideTaskFocus([addressingPath], { quizId: ADDRESSING_QUIZ_ID });

    expect(decision.diagnosticLeads).toBe(false);
    expect(decision.defaultPathId).toBe('path-addressing');
    expect(decision.pinnedPathIds).toEqual([]);
  });

  it('leaves every active path unlabeled when the student has no quiz receipt', () => {
    const decision = decideTaskFocus([addressingPath], null);

    expect(decision.diagnosticLeads).toBe(false);
    expect(decision.defaultPathId).toBe('path-addressing');
    expect(decision.pinnedPathIds).toEqual([]);
  });

  it('keeps a comprehensive plan on the comprehensive paper even if a weak atom is 3.1', () => {
    expect(remediationQuizLink(COMPREHENSIVE_QUIZ_ID)).toEqual({
      text: '重新测评',
      href: '/quiz',
    });
    expect(remediationQuizLink(ADDRESSING_QUIZ_ID).href).toBe('/quiz?topic=addressing-modes&mode=retest');
    expect(remediationQuizLink('quiz-ch1')).toEqual({
      text: '重测第1章',
      href: '/quiz?chapter=1',
    });
  });
});
