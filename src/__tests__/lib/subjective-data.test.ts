import {
  SUBJECTIVE_QUESTION_COUNT,
  getSubjectiveQuestion,
  subjectiveQuestions,
  toPublicSubjectiveQuestion,
} from '@/lib/subjective-data';

describe('subjective-data（3084 主观题库）', () => {
  it('题量与编号完整：QS01–QS75 共 75 题、id 连续', () => {
    expect(SUBJECTIVE_QUESTION_COUNT).toBe(75);
    expect(subjectiveQuestions.map((q) => q.id)).toEqual(
      Array.from({ length: 75 }, (_, i) => i + 1),
    );
    expect(subjectiveQuestions[0]?.origId).toBe('QS01');
    expect(subjectiveQuestions[74]?.origId).toBe('QS75');
  });

  it('每题必备字段齐全（含参考答案与评分细则）', () => {
    for (const q of subjectiveQuestions) {
      expect(q.questionText.trim().length).toBeGreaterThan(0);
      expect(q.correctAnswer.trim().length).toBeGreaterThan(0);
      expect(q.rubric.trim().length).toBeGreaterThan(0);
      expect(q.points).toBeGreaterThan(0);
      expect(q.chapter).toBeGreaterThanOrEqual(1);
      expect(q.chapter).toBeLessThanOrEqual(11);
    }
  });

  it('toPublicSubjectiveQuestion 剥离答案与评分细则', () => {
    const question = subjectiveQuestions[0]!;
    const publicQuestion = toPublicSubjectiveQuestion(question);
    expect(publicQuestion).not.toHaveProperty('correctAnswer');
    expect(publicQuestion).not.toHaveProperty('rubric');
    expect(publicQuestion.id).toBe(question.id);
    expect(publicQuestion.questionText).toBe(question.questionText);
    // 原对象不被修改
    expect(question.correctAnswer.length).toBeGreaterThan(0);
  });

  it('getSubjectiveQuestion 按 id 取题，越界返回 undefined', () => {
    expect(getSubjectiveQuestion(1)?.origId).toBe('QS01');
    expect(getSubjectiveQuestion(75)?.origId).toBe('QS75');
    expect(getSubjectiveQuestion(0)).toBeUndefined();
    expect(getSubjectiveQuestion(76)).toBeUndefined();
  });
});
