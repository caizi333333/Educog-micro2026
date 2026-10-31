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
 * 发布种子 final-objective-v2 在当前题库上的卷面。
 * 改种子、蓝图或变体题时同步更新。顺序是蓝图顺序：先单项选择，再判断。
 */
const PUBLISHED_FINAL_OBJECTIVE_IDS = [
  510, 521, 529, 549, 524, 32, 540, 522, 556, 579, 584, 587, 466, 604, 95,
  605, 608, 610, 611, 614, 616, 617, 620, 621, 623, 625,
  589, 592, 593, 594, 595, 596, 598, 599, 600, 601, 602, 603,
];

/** v2 为简答/写指令/综合切片让出的重复判断。题目仍在库里，组卷不再抽。 */
const RETIRED_JUDGMENT_SEAT_IDS = ['judge-reset-psw', 'judge-ram-zones', 'judge-led-polarity'] as const;

const NEW_OBJECTIVE_SEAT_IDS = [
  'choice-sa1-display',
  'choice-sa2-dc',
  'choice-sa3-pwm',
  'choice-sa4-stepper',
  'choice-wi1-swap',
  'choice-wi2-movc',
  'choice-wi3-movx',
  'choice-wi4-arith',
  'choice-ca1-tmod',
  'choice-ca2-reload',
  'choice-ca3-step',
] as const;

const JUDGMENT_ANSWERS: Record<number, '正确' | '错误'> = {
  589: '正确',
  592: '错误',
  593: '正确',
  594: '错误',
  595: '正确',
  596: '错误',
  598: '错误',
  599: '正确',
  600: '错误',
  601: '正确',
  602: '正确',
  603: '错误',
};

describe('期末客观模拟蓝图抽样', () => {
  it('座位配额合计 38，单项选择 26、判断 12', () => {
    expect(FINAL_OBJECTIVE_SAMPLE_SEED).toBe('final-objective-v2');
    expect(FINAL_OBJECTIVE_BLUEPRINT).toHaveLength(38);
    expect(new Set(FINAL_OBJECTIVE_BLUEPRINT.map((seat) => seat.id)).size).toBe(38);
    expect(FINAL_OBJECTIVE_BLUEPRINT.reduce((sum, seat) => sum + seat.quota, 0)).toBe(38);
    expect(FINAL_OBJECTIVE_PAPER_LENGTH).toBe(38);
    expect(FINAL_OBJECTIVE_CHOICE_COUNT).toBe(26);
    expect(FINAL_OBJECTIVE_JUDGMENT_COUNT).toBe(12);
    expect(FINAL_OBJECTIVE_BLUEPRINT.filter((seat) => seat.section === 'single-choice')).toHaveLength(26);
    expect(FINAL_OBJECTIVE_BLUEPRINT.filter((seat) => seat.section === 'judgment')).toHaveLength(12);
    expect(FINAL_OBJECTIVE_BLUEPRINT.slice(0, 26).every((seat) => seat.section === 'single-choice')).toBe(true);
    expect(FINAL_OBJECTIVE_BLUEPRINT.slice(26).every((seat) => seat.section === 'judgment')).toBe(true);
    expect(RETIRED_JUDGMENT_SEAT_IDS.every((seatId) => !FINAL_OBJECTIVE_BLUEPRINT.some((seat) => seat.id === seatId))).toBe(true);
    expect(NEW_OBJECTIVE_SEAT_IDS.every((seatId) => FINAL_OBJECTIVE_BLUEPRINT.some((seat) => seat.id === seatId && seat.tagOnly))).toBe(true);
    expect(isFinalObjectiveVariantExplanation(`${FINAL_OBJECTIVE_VARIANT_MARK} · 判断座位 judge-harvard]`)).toBe(true);
  });

  it('发布种子得到稳定的 38 题，座位齐全，且没有课件例题', () => {
    const paper = selectFinalObjectivePaper(quizQuestions);
    const again = selectFinalObjectivePaper(quizQuestions, { seed: FINAL_OBJECTIVE_SAMPLE_SEED });
    const ids = paper.map((pick) => pick.question.id);
    expect(ids).toEqual(PUBLISHED_FINAL_OBJECTIVE_IDS);
    expect(again.map((pick) => pick.question.id)).toEqual(ids);
    expect(getFinalObjectiveQuestions().map((question) => question.id)).toEqual(ids);
    expect(ids).toHaveLength(FINAL_OBJECTIVE_PAPER_LENGTH);
    expect(new Set(ids).size).toBe(38);
    expect(paper.map((pick) => pick.seat.id)).toEqual(FINAL_OBJECTIVE_BLUEPRINT.map((seat) => seat.id));
    expect(paper.every((pick) => !isSlideTeachingSource(pick.question.source))).toBe(true);
    expect(new Set(paper.map((pick) => comprehensiveStemFamily(pick.question))).size).toBe(38);
    expect(paper.every((pick) => pick.question.type === 'multiple-choice')).toBe(true);

    const choice = paper.filter((pick) => pick.seat.section === 'single-choice');
    const judgment = paper.filter((pick) => pick.seat.section === 'judgment');
    expect(choice).toHaveLength(26);
    expect(judgment).toHaveLength(12);
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
    expect(paper.find((pick) => pick.seat.id === 'choice-sa1-display')?.question.id).toBe(605);
    expect(paper.find((pick) => pick.seat.id === 'choice-wi1-swap')?.question.id).toBe(614);
    expect(paper.find((pick) => pick.seat.id === 'choice-ca1-tmod')?.question.id).toBe(621);
    expect(paper.find((pick) => pick.seat.id === 'choice-ca2-reload')?.question.id).toBe(623);
    expect(paper.find((pick) => pick.seat.id === 'choice-ca3-step')?.question.id).toBe(625);
    expect(ids).not.toContain(590);
    expect(ids).not.toContain(591);
    expect(ids).not.toContain(597);

    const comprehensiveIds = new Set(getComprehensiveQuestions().map((question) => question.id));
    expect(ids.filter((id) => id >= 589).every((id) => !comprehensiveIds.has(id))).toBe(true);
    expect(quizQuestions.filter((question) => question.id >= 605).every((question) => !comprehensiveIds.has(question.id))).toBe(true);
    expect(getComprehensiveQuestions()).toHaveLength(20);
  });

  it('另一种子换一批单选题，只剩一道的判断变体仍按座位保留', () => {
    const alternate = selectFinalObjectivePaper(quizQuestions, { seed: 'final-objective-v2-alt' });
    expect(alternate.map((pick) => pick.question.id)).not.toEqual(PUBLISHED_FINAL_OBJECTIVE_IDS);
    expect(alternate).toHaveLength(38);
    expect(alternate.every((pick) => !isSlideTeachingSource(pick.question.source))).toBe(true);
    expect(new Set(alternate.map((pick) => comprehensiveStemFamily(pick.question))).size).toBe(38);
    expect(alternate.filter((pick) => pick.seat.section === 'judgment').map((pick) => pick.question.id)).toEqual(
      PUBLISHED_FINAL_OBJECTIVE_IDS.slice(FINAL_OBJECTIVE_CHOICE_COUNT),
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
    expect(variants.map((question) => question.id)).toEqual(Array.from({ length: 38 }, (_, index) => 589 + index));
    for (const question of variants) {
      const tag = readFinalObjectiveSeatTag(question.explanation);
      expect(tag).not.toBeNull();
      const retired = RETIRED_JUDGMENT_SEAT_IDS.includes(tag!.seatId as typeof RETIRED_JUDGMENT_SEAT_IDS[number]);
      expect(seatIds.has(tag!.seatId) || retired).toBe(true);
      expect(question.type).toBe('multiple-choice');
      if (question.type !== 'multiple-choice') continue;
      expect(question.options).toContain(question.correctAnswer);
      expect(question.source).toBeUndefined();
      if (tag?.kind === 'judgment') expect(isJudgmentOptionPair(question.options)).toBe(true);
      if (NEW_OBJECTIVE_SEAT_IDS.includes(tag!.seatId as typeof NEW_OBJECTIVE_SEAT_IDS[number])) {
        expect(isJudgmentOptionPair(question.options)).toBe(false);
      }
    }
    for (const seatId of NEW_OBJECTIVE_SEAT_IDS) {
      const pool = variants.filter((question) => readFinalObjectiveSeatTag(question.explanation)?.seatId === seatId);
      expect(pool.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('简答、写指令和综合切片变体的关键结果可以回算', () => {
    const answer = (id: number) => quizQuestions.find((question) => question.id === id)?.correctAnswer;
    const byte = (value: number) => `${value.toString(16).toUpperCase().padStart(2, '0')}H`;
    expect(answer(609)).toBe(`${(2 / 8) * 100}%`);
    expect(answer(614)).toBe('R1=C4H，36H=5AH');
    expect(answer(616)).toBe('4CH');
    expect(answer(618)).toBe('6EH');
    const wrappedDifference = (0x2e - 0x91 + 0x100) & 0xff;
    expect(wrappedDifference).toBe(0x9d);
    expect(answer(619)).toBe(`6DH=${byte(wrappedDifference)}，CY=1`);
    expect(answer(620)).toBe(byte(0x3d + 0x16));
    expect(answer(621)).toBe(byte((1 << 3) | 0b0001));
    expect(answer(622)).toBe(byte(0b0101 << 4));
    const reload = (milliseconds: number) => 65536 - milliseconds * 1000;
    expect(reload(8)).toBe(0xe0c0);
    expect(answer(623)).toBe(`TH1=${byte(reload(8) >> 8)}，TL1=${byte(reload(8) & 0xff)}`);
    expect(reload(15)).toBe(0xc568);
    expect(answer(624)).toBe(`TH0=${byte(reload(15) >> 8)}，TL0=${byte(reload(15) & 0xff)}`);
    expect(['TH0=B1H，TL0=E0H', 'TH0=D8H，TL0=F0H', 'TH0=FCH，TL0=66H']).not.toContain(answer(623));
    expect(['TH0=B1H，TL0=E0H', 'TH0=D8H，TL0=F0H', 'TH0=FCH，TL0=66H']).not.toContain(answer(624));
    expect(answer(625)).toBe(byte(0x01 | 0x02));
    expect(answer(626)).toBe(byte(0x08 | 0x10));
  });

  it('题库抽空或新座位没有变体时明确报出缺题座位，而不是交一张短卷', () => {
    expect(() => selectFinalObjectivePaper([])).toThrow(/choice-dac|没有可抽题目/);
    const withoutNewVariants = quizQuestions.filter((question) => question.id < 605);
    expect(() => selectFinalObjectivePaper(withoutNewVariants)).toThrow(/choice-sa1-display|没有可抽题目/);
  });
});
