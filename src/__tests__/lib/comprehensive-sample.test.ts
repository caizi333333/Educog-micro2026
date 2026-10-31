import { quizQuestions, getComprehensiveQuestions } from '@/lib/quiz-data';
import {
  COMPREHENSIVE_CHAPTER_QUOTAS,
  COMPREHENSIVE_NEW_INTAKE_MIN_ID,
  COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  COMPREHENSIVE_SAMPLE_SEED,
  classifyObjectiveSource,
  comprehensiveQuestionWeight,
  comprehensiveStemFamily,
  isSlideTeachingSource,
  selectComprehensiveQuestions,
  type ComprehensiveSampleQuestion,
} from '@/lib/comprehensive-sample';

/**
 * 发布种子 comprehensive-objective-v2 在当前题库上的卷面。
 * 改种子、排除规则或配额时同步更新，并保持后面的覆盖断言。
 */
const PUBLISHED_SAMPLE_IDS = [
  513, 516, 136, 381, 413, 419, 274, 541, 243, 552, 442, 578, 561, 583, 570, 587, 197, 311, 301, 509,
];

/** v1 只按权重抽，同一换算模板和同一作业数值切片可以重复，也没有定时/地址切片。 */
const OBJECTIVE_V1_SAMPLE_IDS = [
  510, 517, 525, 526, 154, 500, 544, 546, 549, 559, 444, 455, 581, 584, 171, 474, 188, 310, 217, 297,
];

/** 旧规则：按题库顺序每章取前两题。综合卷不得再等于这张表。 */
const LEGACY_PREFIX_IDS = [
  225, 226, 1, 2, 4, 13, 263, 264, 6, 8, 5, 9, 14, 28, 7, 25, 132, 186, 213, 214,
];

const workbookExplanation = '[source: 往年作业册20221127 作业1 单选#1 · P10]\n只用于来源分类，题干不参与抽样。';
const numericExplanation = '[source: 作业5 数值切片 · 同源]\n只用于来源分类，题干不参与抽样。';
const otherTaggedExplanation = '[source: 其他已标注切片]\n只用于来源分类。';

function question(partial: ComprehensiveSampleQuestion): ComprehensiveSampleQuestion {
  return partial;
}

describe('综合测评加权抽样', () => {
  it('发布卷覆盖 1–10 章、固定 20 题，并抽到队尾新题', () => {
    const selected = getComprehensiveQuestions();
    const ids = selected.map((item) => item.id);
    expect(ids).toEqual(PUBLISHED_SAMPLE_IDS);
    expect(ids).toEqual(selectComprehensiveQuestions(quizQuestions, { seed: COMPREHENSIVE_SAMPLE_SEED }).map((item) => item.id));
    expect(getComprehensiveQuestions().map((item) => item.id)).toEqual(ids);
    expect(ids).not.toEqual(LEGACY_PREFIX_IDS);
    expect(ids).not.toEqual(OBJECTIVE_V1_SAMPLE_IDS);
    expect(selected.every((item) => !isSlideTeachingSource(item.source))).toBe(true);
    expect(new Set(selected.map((item) => comprehensiveStemFamily(item))).size).toBe(20);
    const numeric = selected.filter((item) => classifyObjectiveSource(item.explanation) === 'numeric-slice');
    expect(numeric.map((item) => item.chapter).sort((left, right) => left - right)).toEqual([6, 7, 8]);
    expect(numeric.map((item) => comprehensiveStemFamily(item)).sort()).toEqual([
      'numeric-slice:作业6',
      'numeric-slice:作业7',
      'timer-reload',
    ]);
    expect(selected.filter((item) => comprehensiveStemFamily(item) === 'number-base-conversion')).toHaveLength(1);
    expect(new Set(ids).size).toBe(20);
    expect(selected.filter((item) => item.id >= COMPREHENSIVE_NEW_INTAKE_MIN_ID).length).toBeGreaterThanOrEqual(4);
    expect(ids.some((id) => id >= 575)).toBe(true);

    const quotaByChapter = new Map<number, number>();
    for (const item of selected) {
      quotaByChapter.set(item.chapter, (quotaByChapter.get(item.chapter) ?? 0) + 1);
    }
    expect([...quotaByChapter.keys()].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const count of quotaByChapter.values()) {
      expect(count).toBe(COMPREHENSIVE_QUESTIONS_PER_CHAPTER);
    }
    expect(Object.values(COMPREHENSIVE_CHAPTER_QUOTAS).reduce((sum, quota) => sum + quota, 0)).toBe(20);
    expect(selected.filter((item) => item.type === 'multiple-choice').length).toBeGreaterThanOrEqual(16);
  });

  it('另一种子得到另一张卷，章与章的抽取互不影响', () => {
    const alternate = selectComprehensiveQuestions(quizQuestions, { seed: 'comprehensive-objective-v2-alt' });
    expect(alternate.map((item) => item.id)).not.toEqual(PUBLISHED_SAMPLE_IDS);
    expect(alternate).toHaveLength(20);
    expect(alternate.every((item) => !isSlideTeachingSource(item.source))).toBe(true);
    expect(new Set(alternate.map((item) => comprehensiveStemFamily(item))).size).toBe(20);
    expect(
      alternate
        .filter((item) => classifyObjectiveSource(item.explanation) === 'numeric-slice')
        .map((item) => item.chapter)
        .sort((left, right) => left - right),
    ).toEqual([6, 7, 8]);

    const chapterOne = [
      question({ id: 10, chapter: 1, type: 'multiple-choice' }),
      question({ id: 11, chapter: 1, type: 'code-completion' }),
      question({ id: 510, chapter: 1, type: 'multiple-choice', explanation: workbookExplanation }),
    ];
    const chapterTwo = [
      question({ id: 20, chapter: 2, type: 'multiple-choice' }),
      question({ id: 21, chapter: 2, type: 'multiple-choice' }),
    ];
    const base = [...chapterTwo, ...chapterOne];
    const withExtra = [
      ...base,
      question({ id: 599, chapter: 2, type: 'multiple-choice', explanation: numericExplanation }),
    ];
    const options = { seed: COMPREHENSIVE_SAMPLE_SEED, chapterQuotas: { 1: 2, 2: 2 } };
    const before = selectComprehensiveQuestions(base, options).filter((item) => item.chapter === 1).map((item) => item.id);
    const after = selectComprehensiveQuestions(withExtra, options).filter((item) => item.chapter === 1).map((item) => item.id);
    expect(before).toEqual(after);
    expect(selectComprehensiveQuestions([...base].reverse(), options).map((item) => item.id)).toEqual(
      selectComprehensiveQuestions(base, options).map((item) => item.id),
    );
    const originalOrder = base.map((item) => item.id);
    selectComprehensiveQuestions(base, options);
    expect(base.map((item) => item.id)).toEqual(originalOrder);
  });

  it('来源、题型和队尾 id 的权重大小符合客观区优先', () => {
    expect(classifyObjectiveSource(undefined)).toBe('untagged');
    expect(classifyObjectiveSource('普通解析')).toBe('untagged');
    expect(classifyObjectiveSource(workbookExplanation)).toBe('workbook-choice');
    expect(classifyObjectiveSource(numericExplanation)).toBe('numeric-slice');
    expect(classifyObjectiveSource(otherTaggedExplanation)).toBe('other-tagged');
    expect(classifyObjectiveSource('正文里提到 [source: 数值切片]，但首行不是来源标记')).toBe('untagged');

    const oldChoice = comprehensiveQuestionWeight(question({ id: 1, chapter: 1, type: 'multiple-choice' }));
    const oldCode = comprehensiveQuestionWeight(question({ id: 2, chapter: 1, type: 'code-completion' }));
    const tagged = comprehensiveQuestionWeight(question({
      id: 3, chapter: 1, type: 'multiple-choice', explanation: otherTaggedExplanation,
    }));
    const workbook = comprehensiveQuestionWeight(question({
      id: 510, chapter: 1, type: 'multiple-choice', explanation: workbookExplanation,
    }));
    const numeric = comprehensiveQuestionWeight(question({
      id: 575, chapter: 6, type: 'multiple-choice', explanation: numericExplanation,
    }));
    expect(oldChoice.weight).toBe(2);
    expect(oldCode.weight).toBe(1);
    expect(tagged.weight).toBe(4);
    expect(workbook.weight).toBe(16);
    expect(numeric.weight).toBe(20);
    expect(numeric.weight).toBeGreaterThan(workbook.weight);
    expect(workbook.weight).toBeGreaterThan(tagged.weight);
    expect(tagged.weight).toBeGreaterThan(oldChoice.weight);
    expect(oldChoice.weight).toBeGreaterThan(oldCode.weight);
  });

  it('多次固定种子里，机判切片和作业单选比旧题更常被抽到', () => {
    const pool = [
      question({ id: 1, chapter: 1, type: 'multiple-choice' }),
      question({ id: 2, chapter: 1, type: 'code-completion' }),
      question({ id: 510, chapter: 1, type: 'multiple-choice', explanation: workbookExplanation }),
      question({ id: 575, chapter: 1, type: 'multiple-choice', explanation: numericExplanation }),
    ];
    const counts = { numeric: 0, workbook: 0, older: 0 };
    for (let index = 0; index < 200; index += 1) {
      const [picked] = selectComprehensiveQuestions(pool, {
        seed: `fixture-${index}`,
        chapterQuotas: { 1: 1 },
      });
      if (!picked) throw new Error('empty sample');
      if (picked.id === 575) counts.numeric += 1;
      else if (picked.id === 510) counts.workbook += 1;
      else counts.older += 1;
    }
    expect(counts).toEqual({ numeric: 108, workbook: 73, older: 19 });
    expect(counts.numeric).toBeGreaterThan(counts.workbook);
    expect(counts.workbook).toBeGreaterThan(counts.older);
  });

  it('题量不足配额时全取，配额为 0 或表外章节按规则处理', () => {
    const onlyCode = [
      question({ id: 9, chapter: 9, type: 'code-completion' }),
      question({ id: 10, chapter: 9, type: 'code-completion' }),
    ];
    expect(selectComprehensiveQuestions(onlyCode, { chapterQuotas: { 9: 2 } }).map((item) => item.id)).toEqual([9, 10]);

    const skipped = selectComprehensiveQuestions(
      [question({ id: 4, chapter: 4, type: 'multiple-choice', explanation: workbookExplanation })],
      { chapterQuotas: { 4: 0 } },
    );
    expect(skipped).toEqual([]);

    const extraChapter = selectComprehensiveQuestions([
      question({ id: 1, chapter: 1, type: 'multiple-choice' }),
      question({ id: 11, chapter: 11, type: 'multiple-choice', explanation: numericExplanation }),
    ], { questionsPerChapter: 1, chapterQuotas: {} });
    expect(extraChapter.map((item) => item.id)).toEqual([1, 11]);
  });

  it('课件 PDF 出处不进综合卷，网页指导仍可入选', () => {
    const slide = quizQuestions.find((item) => item.id === 314);
    expect(slide?.source && isSlideTeachingSource(slide.source)).toBe(true);
    expect(quizQuestions.filter((item) => isSlideTeachingSource(item.source)).length).toBeGreaterThan(40);
    expect(getComprehensiveQuestions().some((item) => isSlideTeachingSource(item.source))).toBe(false);

    const slidePractice = question({
      id: 314,
      chapter: 7,
      type: 'multiple-choice',
      questionText: '课件上的并行与串行例题',
      explanation: workbookExplanation,
      source: { url: '/resources/course/course-slides.pdf#page=4' },
    });
    const guidePractice = question({
      id: 444,
      chapter: 7,
      type: 'multiple-choice',
      questionText: '指导里的定时器来源',
      source: { kind: 'guide', url: '/simulation?experiment=exp03&view=guide' },
    });
    const plain = question({ id: 1, chapter: 7, type: 'multiple-choice', questionText: '普通概念题' });
    expect(selectComprehensiveQuestions(
      [slidePractice, guidePractice, plain],
      { chapterQuotas: { 7: 2 }, seed: 'slide-out' },
    ).map((item) => item.id)).toEqual([1, 444]);
    expect(selectComprehensiveQuestions(
      [slidePractice],
      { chapterQuotas: { 7: 2 } },
    )).toEqual([]);
  });

  it('归一化题干把换算模板并成一族，不误伤指令对比和实验补码', () => {
    const familyOf = (id: number) => {
      const found = quizQuestions.find((item) => item.id === id);
      if (!found) throw new Error(`missing ${id}`);
      return comprehensiveStemFamily(found);
    };
    expect(familyOf(510)).toBe('number-base-conversion');
    expect(familyOf(510)).toBe(familyOf(517));
    expect(familyOf(510)).toBe(familyOf(544));
    expect(familyOf(510)).toBe(familyOf(511));
    expect(familyOf(510)).toBe(familyOf(535));
    expect(quizQuestions.find((item) => item.id === 510)?.ka).not.toBe(quizQuestions.find((item) => item.id === 533)?.ka);
    expect(familyOf(510)).toBe(familyOf(533));
    expect(familyOf(154)).not.toBe(familyOf(510));
    expect(familyOf(419)).not.toBe(familyOf(510));
    expect(familyOf(491)).not.toBe(familyOf(510));
    expect(familyOf(27)).not.toBe(familyOf(47));
    expect(familyOf(575)).toBe('timer-reload');
    expect(familyOf(575)).toBe(familyOf(578));
    expect(familyOf(455)).toBe(familyOf(578));
    const untaggedReloadIds = quizQuestions
      .filter((item) => comprehensiveStemFamily(item) === 'timer-reload'
        && classifyObjectiveSource(item.explanation) !== 'numeric-slice')
      .map((item) => item.id);
    expect(untaggedReloadIds).toEqual([17, 51, 78, 448, 450, 452, 455]);
    expect(familyOf(580)).toBe('numeric-slice:作业6');
    expect(familyOf(580)).toBe(familyOf(584));
    expect(familyOf(580)).not.toBe(familyOf(575));
    expect(familyOf(586)).toBe(familyOf(588));
  });

  it('同一题干族在一章和全卷里都不重复，凑不满时才放行', () => {
    const conversion = (id: number, chapter: number) => question({
      id,
      chapter,
      type: 'multiple-choice',
      questionText: `十进制数${id}的BCD码是？`,
      explanation: workbookExplanation,
    });
    const other = (id: number, chapter: number) => question({
      id,
      chapter,
      type: 'multiple-choice',
      questionText: `第${chapter}章独立概念${id}`,
    });
    const withinChapter = selectComprehensiveQuestions(
      [conversion(510, 1), conversion(517, 1), other(1, 1)],
      { chapterQuotas: { 1: 2 }, seed: 'family-chapter' },
    );
    expect(withinChapter).toHaveLength(2);
    expect(withinChapter.filter((item) => comprehensiveStemFamily(item) === 'number-base-conversion')).toHaveLength(1);
    expect(withinChapter.some((item) => item.id === 1)).toBe(true);

    const acrossChapters = selectComprehensiveQuestions(
      [conversion(510, 1), conversion(544, 4), other(4, 4)],
      { chapterQuotas: { 1: 1, 4: 1 }, seed: 'family-paper' },
    );
    expect(acrossChapters.map((item) => item.id)).toEqual([510, 4]);

    const onlyTwins = selectComprehensiveQuestions(
      [conversion(510, 1), conversion(517, 1)],
      { chapterQuotas: { 1: 2 }, seed: 'family-relax' },
    );
    expect(onlyTwins.map((item) => item.id)).toEqual([510, 517]);
  });

  it('章配额至少为 2 时先留一道数值切片，配额为 1 时仍按权重抽', () => {
    const timer = (id: number) => question({
      id,
      chapter: 6,
      type: 'multiple-choice',
      questionText: `定时初值模板${id}`,
      explanation: numericExplanation,
    });
    const concept = (id: number) => question({
      id,
      chapter: 6,
      type: 'multiple-choice',
      questionText: `定时概念${id}`,
    });
    for (let index = 0; index < 20; index += 1) {
      const selected = selectComprehensiveQuestions(
        [timer(575), timer(576), concept(1), concept(2)],
        { seed: `reserve-${index}`, chapterQuotas: { 6: 2 } },
      );
      expect(selected).toHaveLength(2);
      expect(selected.filter((item) => classifyObjectiveSource(item.explanation) === 'numeric-slice')).toHaveLength(1);
      expect(new Set(selected.map((item) => comprehensiveStemFamily(item))).size).toBe(2);
    }

    const singleSlot = selectComprehensiveQuestions(
      [timer(575), concept(1)],
      { seed: 'quota-one', chapterQuotas: { 6: 1 } },
    );
    expect(singleSlot.map((item) => item.id)).toEqual([575]);
  });
});
