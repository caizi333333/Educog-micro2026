import { quizQuestions, getComprehensiveQuestions, getFinalObjectiveQuestions } from '@/lib/quiz-data';
import {
  classifyObjectiveSource,
  comprehensiveStemFamily,
  isFinalObjectiveVariantExplanation,
  isSlideTeachingSource,
} from '@/lib/comprehensive-sample';
import {
  FINAL_OBJECTIVE_BLUEPRINT,
  FINAL_OBJECTIVE_CHOICE_COUNT,
  FINAL_OBJECTIVE_JUDGMENT_COUNT,
  FINAL_OBJECTIVE_PAPER_LENGTH,
  FINAL_OBJECTIVE_SAMPLE_SEED,
  FINAL_OBJECTIVE_VARIANT_MARK,
  isJudgmentOptionPair,
  readFinalObjectiveSeatTag,
  selectFinalObjectivePaper,
} from '@/lib/final-objective-sample';

/**
 * 发布种子 final-objective-v1 在当前题库上的卷面。
 * 改种子、蓝图或变体题时同步更新。顺序是蓝图顺序：先单项选择，再判断。
 */
const PUBLISHED_FINAL_OBJECTIVE_IDS = [
  514, 521, 529, 441, 524, 405, 540, 522, 453, 575, 584, 588, 467, 604, 391,
  589, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603,
];

const JUDGMENT_ANSWERS: Record<number, '正确' | '错误'> = {
  589: '正确',
  590: '正确',
  591: '错误',
  592: '错误',
  593: '正确',
  594: '错误',
  595: '正确',
  596: '错误',
  597: '正确',
  598: '错误',
  599: '正确',
  600: '错误',
  601: '正确',
  602: '正确',
  603: '错误',
};

describe('期末客观模拟蓝图抽样', () => {
  it('座位配额合计 30，单项选择和判断各 15', () => {
    expect(FINAL_OBJECTIVE_BLUEPRINT).toHaveLength(30);
    expect(new Set(FINAL_OBJECTIVE_BLUEPRINT.map((seat) => seat.id)).size).toBe(30);
    expect(FINAL_OBJECTIVE_BLUEPRINT.reduce((sum, seat) => sum + seat.quota, 0)).toBe(30);
    expect(FINAL_OBJECTIVE_PAPER_LENGTH).toBe(30);
    expect(FINAL_OBJECTIVE_CHOICE_COUNT).toBe(15);
    expect(FINAL_OBJECTIVE_JUDGMENT_COUNT).toBe(15);
    expect(FINAL_OBJECTIVE_BLUEPRINT.filter((seat) => seat.section === 'single-choice')).toHaveLength(15);
    expect(FINAL_OBJECTIVE_BLUEPRINT.filter((seat) => seat.section === 'judgment')).toHaveLength(15);
    expect(FINAL_OBJECTIVE_BLUEPRINT.slice(0, 15).every((seat) => seat.section === 'single-choice')).toBe(true);
    expect(FINAL_OBJECTIVE_BLUEPRINT.slice(15).every((seat) => seat.section === 'judgment')).toBe(true);
    expect(isFinalObjectiveVariantExplanation(`${FINAL_OBJECTIVE_VARIANT_MARK} · 判断座位 judge-harvard]`)).toBe(true);
  });

  it('发布种子得到稳定的 30 题，座位齐全，且没有课件例题', () => {
    const paper = selectFinalObjectivePaper(quizQuestions);
    const again = selectFinalObjectivePaper(quizQuestions, { seed: FINAL_OBJECTIVE_SAMPLE_SEED });
    const ids = paper.map((pick) => pick.question.id);
    expect(ids).toEqual(PUBLISHED_FINAL_OBJECTIVE_IDS);
    expect(again.map((pick) => pick.question.id)).toEqual(ids);
    expect(getFinalObjectiveQuestions().map((question) => question.id)).toEqual(ids);
    expect(ids).toHaveLength(FINAL_OBJECTIVE_PAPER_LENGTH);
    expect(new Set(ids).size).toBe(30);
    expect(paper.map((pick) => pick.seat.id)).toEqual(FINAL_OBJECTIVE_BLUEPRINT.map((seat) => seat.id));
    expect(paper.every((pick) => !isSlideTeachingSource(pick.question.source))).toBe(true);
    expect(new Set(paper.map((pick) => comprehensiveStemFamily(pick.question))).size).toBe(30);
    expect(paper.every((pick) => pick.question.type === 'multiple-choice')).toBe(true);

    const choice = paper.filter((pick) => pick.seat.section === 'single-choice');
    const judgment = paper.filter((pick) => pick.seat.section === 'judgment');
    expect(choice).toHaveLength(15);
    expect(judgment).toHaveLength(15);
    expect(choice.every((pick) => pick.question.type === 'multiple-choice' && !isJudgmentOptionPair(pick.question.options))).toBe(true);
    expect(judgment.every((pick) => pick.question.type === 'multiple-choice' && isJudgmentOptionPair(pick.question.options))).toBe(true);
    expect(judgment.every((pick) => pick.question.correctAnswer === '正确' || pick.question.correctAnswer === '错误')).toBe(true);

    for (const pick of judgment) {
      expect(readFinalObjectiveSeatTag(pick.question.explanation)).toEqual({
        kind: 'judgment',
        seatId: pick.seat.id,
      });
      expect(JUDGMENT_ANSWERS[pick.question.id]).toBe(pick.question.correctAnswer);
    }

    const homeworkOf = (seatId: string): string | undefined => {
      const pick = paper.find((item) => item.seat.id === seatId);
      const firstLine = pick?.question.explanation?.split('\n', 1)[0] ?? '';
      return firstLine.match(/作业\d+/)?.[0];
    };
    expect(classifyObjectiveSource(paper.find((pick) => pick.seat.id === 'choice-timer-reload')?.question.explanation)).toBe('numeric-slice');
    expect(classifyObjectiveSource(paper.find((pick) => pick.seat.id === 'choice-baud')?.question.explanation)).toBe('numeric-slice');
    expect(classifyObjectiveSource(paper.find((pick) => pick.seat.id === 'choice-address-range')?.question.explanation)).toBe('numeric-slice');
    expect(homeworkOf('choice-timer-reload')).toBe('作业5');
    expect(homeworkOf('choice-baud')).toBe('作业6');
    expect(homeworkOf('choice-address-range')).toBe('作业7');
    expect(paper.find((pick) => pick.seat.id === 'choice-dac')?.question.id).toBe(604);
    expect(paper.find((pick) => pick.seat.id === 'choice-dac')?.question.correctAnswer).toBe('2.5V');
    expect(5 * 0x80 / 256).toBe(2.5);

    const comprehensiveIds = new Set(getComprehensiveQuestions().map((question) => question.id));
    expect(ids.filter((id) => id >= 589).every((id) => !comprehensiveIds.has(id))).toBe(true);
    expect(getComprehensiveQuestions()).toHaveLength(20);
  });

  it('另一种子换一批单选题，判断变体仍按座位保留', () => {
    const alternate = selectFinalObjectivePaper(quizQuestions, { seed: 'final-objective-v1-alt' });
    expect(alternate.map((pick) => pick.question.id)).not.toEqual(PUBLISHED_FINAL_OBJECTIVE_IDS);
    expect(alternate).toHaveLength(30);
    expect(alternate.every((pick) => !isSlideTeachingSource(pick.question.source))).toBe(true);
    expect(new Set(alternate.map((pick) => comprehensiveStemFamily(pick.question))).size).toBe(30);
    expect(alternate.filter((pick) => pick.seat.section === 'judgment').map((pick) => pick.question.id)).toEqual(
      PUBLISHED_FINAL_OBJECTIVE_IDS.filter((id) => id >= 589 && id <= 603),
    );
    const originalOrder = quizQuestions.map((question) => question.id);
    selectFinalObjectivePaper(quizQuestions);
    expect(quizQuestions.map((question) => question.id)).toEqual(originalOrder);
  });

  it('引用的题库题号都存在，变体标签只指向蓝图座位', () => {
    const byId = new Map(quizQuestions.map((question) => [question.id, question]));
    for (const seat of FINAL_OBJECTIVE_BLUEPRINT) {
      for (const id of seat.bankIds ?? []) {
        const question = byId.get(id);
        expect(question?.type).toBe('multiple-choice');
        expect(question && isSlideTeachingSource(question.source)).toBe(false);
      }
    }
    const seatIds = new Set(FINAL_OBJECTIVE_BLUEPRINT.map((seat) => seat.id));
    const variants = quizQuestions.filter((question) => question.id >= 589);
    expect(variants.map((question) => question.id)).toEqual(Array.from({ length: 16 }, (_, index) => 589 + index));
    for (const question of variants) {
      const tag = readFinalObjectiveSeatTag(question.explanation);
      expect(tag).not.toBeNull();
      expect(seatIds.has(tag!.seatId)).toBe(true);
      expect(question.type).toBe('multiple-choice');
      if (question.type !== 'multiple-choice') continue;
      expect(question.options).toContain(question.correctAnswer);
      if (tag?.kind === 'judgment') expect(isJudgmentOptionPair(question.options)).toBe(true);
    }
  });

  it('题库抽空时明确报出缺题座位，而不是交一张短卷', () => {
    expect(() => selectFinalObjectivePaper([])).toThrow(/choice-dac|judge-harvard|没有可抽题目/);
  });
});
