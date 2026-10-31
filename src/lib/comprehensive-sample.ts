/**
 * 综合测评抽样。
 *
 * 默认卷仍是 20 题：第 1–10 章各 2 题。章练习（`?chapter=`）不走这里。
 *
 * 发布种子 `comprehensive-objective-v2`。v1（`comprehensive-objective-v1`）只按权重抽：
 * 课件 PDF 的 `source` 不在权重里，所以课件例题仍可能入选；同一 BCD/数制换算模板
 * 和同一作业的数值切片也能同时进卷；权重也不能保证定时初值、波特率、地址范围都出现。
 * v2 的题量不变，入选集合变了，所以换种子。同一 Node 主版本、同一题库、同一种子得到同一 id 集合。
 * 拉题和交卷重算同一函数。按日或按用户换卷会拆开进行中的卷，或让同班覆盖对不上。
 *
 * 客观权重仍用现成字段，不读题干措辞：
 * - `type === 'multiple-choice'` 高于填空式代码题；
 * - 解析首行 `[source: 往年作业册…单选…]`、`[source: 作业5/6/7 数值切片…]`；
 * - `id >= 510` 的队尾新题再乘一层。
 *
 * v2 在权重之外还有三条硬规则：
 * 1. 教学 `source` 指向 `course-slides.pdf`（或 `kind === 'slide'`）的课件例题不进池。
 *    网页指导 `kind === 'guide'` 仍可入选。
 *    解析首行以 `[source: 期末客观模拟变体` 开头的题目只供给期末客观模拟，不进综合卷。
 * 2. 全卷每个题干族至多一题。族优先用归一化题干：数字、十六进制字面量和空白去掉后，
 *    同一模板（如「十进制数92/93的BCD码」）并成一族。数制换算的几套模板
 *    （BCD、补码、十进制与二/十六进制互化）再并成 `number-base-conversion`，
 *    避免一卷里同时出现好几道只换了数字的换算。数值切片按解析标签里的「作业6/作业7」
 *    并族。作业5和题干里同时写「初值」与「定时/重装/THx」的旧题并成 `timer-reload`
 *    （当前题库只命中第 6 章的 17、51、78、448、450、452、455），
 *    避免带标签的 TH/TL 再配一道重装初值。
 *    不用 ka：同一 ka 不跨章，而同一换算模板在第 1/3/4 章的 ka 分别是 "1"、"3"、"4"。
 *    「单选#N」每题一个编号，也不能并族。族被占满且该章再无其他题时才放行，以免凑不满配额。
 * 3. 章配额至少为 2、且该章仍有数值切片时，先占 1 个名额给数值切片。
 *    第 6/7/8 章因此各有一道作业5定时、作业6波特率、作业7地址范围。配额表仍是每章 2，合计 20。
 *
 * 每一章单独用 `FNV-1a(seed + "\\0" + chapter)` 起一个 mulberry32，
 * 改某一章的候选不会改写其他章的随机流。题干族全卷共享，章号小的先占族。
 * 接口按章号、题号排序；页面上的作答顺序仍由客户端打乱。
 *
 * 用法：
 * ```ts
 * getComprehensiveQuestions();
 * selectComprehensiveQuestions(quizQuestions, { seed: COMPREHENSIVE_SAMPLE_SEED });
 * ```
 */

export const COMPREHENSIVE_SAMPLE_SEED = 'comprehensive-objective-v2';

/** 未写进配额表的章节用这个默认值。当前表里每一章都是 2。 */
export const COMPREHENSIVE_QUESTIONS_PER_CHAPTER = 2;

/**
 * 章配额。合计 20。某一章要多抽期末客观题时只改这里。
 * 题库里出现表外章节时，按 `COMPREHENSIVE_QUESTIONS_PER_CHAPTER` 纳入，
 * 卷面会多于 20，避免新章被静默丢掉。
 */
export const COMPREHENSIVE_CHAPTER_QUOTAS: Readonly<Record<number, number>> = {
  1: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  2: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  3: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  4: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  5: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  6: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  7: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  8: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  9: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  10: COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
};

/** 改造入库 v1 的起始 id。这个值以上的题是队尾新切片。 */
export const COMPREHENSIVE_NEW_INTAKE_MIN_ID = 510;

/**
 * 章配额达到默认题量、且池里还有数值切片时，该章先留给数值切片的名额。
 * 发布卷因此在第 6、7、8 章各有一道，合计至少 3 道计算题，而不是只靠权重碰运气。
 */
export const COMPREHENSIVE_NUMERIC_SLICE_RESERVE = 1;

/**
 * 解析首行来源的权重。未标注的旧题仍可入选，但压不过作业单选和数值切片。
 * 未知的 `[source:]` 给中间档，方便以后加切片时不用先改抽样循环。
 */
export const COMPREHENSIVE_SOURCE_WEIGHTS = {
  'numeric-slice': 5,
  'workbook-choice': 4,
  'other-tagged': 2,
  untagged: 1,
} as const;

/** 单选 / 机判为主。代码填空保留入选资格，但权重更低。 */
export const COMPREHENSIVE_TYPE_WEIGHTS = {
  'multiple-choice': 2,
  'code-completion': 1,
} as const;

/** 队尾新题在来源权重和题型权重之外再乘这一层。 */
export const COMPREHENSIVE_NEW_INTAKE_WEIGHT = 2;

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const UINT32_RANGE = 4294967296;
const NUMBER_BASE_CONVERSION_FAMILY = 'number-base-conversion';
const TIMER_RELOAD_FAMILY = 'timer-reload';

export type ObjectiveSourceClass = keyof typeof COMPREHENSIVE_SOURCE_WEIGHTS;

export type ComprehensiveSampleQuestion = {
  id: number;
  chapter: number;
  type: string;
  explanation?: string;
  questionText?: string;
  source?: {
    kind?: string;
    url?: string;
  };
};

export type ComprehensiveSampleOptions = {
  /** 默认 `COMPREHENSIVE_SAMPLE_SEED`。 */
  seed?: string;
  /** 配额表里没有的章节用这个数量。默认 `COMPREHENSIVE_QUESTIONS_PER_CHAPTER`。 */
  questionsPerChapter?: number;
  /**
   * 替换默认章配额。传入空对象时，所有章节都走 `questionsPerChapter`。
   * 不传则使用 `COMPREHENSIVE_CHAPTER_QUOTAS`。
   */
  chapterQuotas?: Readonly<Record<number, number>>;
};

export type ComprehensiveQuestionWeight = {
  sourceClass: ObjectiveSourceClass;
  typeWeight: number;
  intakeWeight: number;
  weight: number;
};

/**
 * 只看解析第一行。题干不参与来源分类，避免抽样绑在某道原题的措辞上。
 */
export function classifyObjectiveSource(explanation: string | undefined): ObjectiveSourceClass {
  const firstLine = explanation?.split('\n', 1)[0] ?? '';
  if (!firstLine.startsWith('[source:')) return 'untagged';
  if (firstLine.includes('数值切片')) return 'numeric-slice';
  if (firstLine.includes('往年作业册') && firstLine.includes('单选')) return 'workbook-choice';
  return 'other-tagged';
}

/**
 * 课件例题：教学出处指向合并课件 PDF，或显式标成 slide。
 * 没有 `source` 的旧题、以及实验网页指导，都不是课件例题。
 */
export function isSlideTeachingSource(
  source: ComprehensiveSampleQuestion['source'],
): boolean {
  if (!source) return false;
  if (source.kind === 'slide') return true;
  return typeof source.url === 'string' && source.url.includes('course-slides.pdf');
}

/**
 * 期末客观模拟变体。只看解析第一行的来源标记，不看题干。
 * 标记写在 `final-objective-sample.ts`，两边必须用同一前缀。
 */
export function isFinalObjectiveVariantExplanation(explanation: string | undefined): boolean {
  const firstLine = explanation?.split('\n', 1)[0] ?? '';
  return firstLine.startsWith('[source: 期末客观模拟变体');
}

/**
 * 章内权重 = 来源 × 题型 × 新题系数。三者都是正整数。
 * 例：新入库数值切片单选 = 5 × 2 × 2 = 20；旧单选 = 1 × 2 × 1 = 2。
 */
export function comprehensiveQuestionWeight(
  question: ComprehensiveSampleQuestion,
): ComprehensiveQuestionWeight {
  const sourceClass = classifyObjectiveSource(question.explanation);
  const sourceWeight = COMPREHENSIVE_SOURCE_WEIGHTS[sourceClass];
  const typeWeight = question.type === 'multiple-choice'
    ? COMPREHENSIVE_TYPE_WEIGHTS['multiple-choice']
    : COMPREHENSIVE_TYPE_WEIGHTS['code-completion'];
  const intakeWeight = question.id >= COMPREHENSIVE_NEW_INTAKE_MIN_ID
    ? COMPREHENSIVE_NEW_INTAKE_WEIGHT
    : 1;
  return {
    sourceClass,
    typeWeight,
    intakeWeight,
    weight: sourceWeight * typeWeight * intakeWeight,
  };
}

/**
 * 全卷去重用的题干族。没有题干时退回题号，避免把缺字段的测试夹具误并成一族。
 */
export function comprehensiveStemFamily(question: ComprehensiveSampleQuestion): string {
  const homework = numericSliceHomework(question.explanation);
  if (homework === '作业5' || isTimerReloadStem(question.questionText)) return TIMER_RELOAD_FAMILY;
  if (homework) return `numeric-slice:${homework}`;
  const text = question.questionText?.trim();
  if (!text) return `id:${question.id}`;
  const skeleton = normalizeQuestionSkeleton(text);
  if (!skeleton) return `id:${question.id}`;
  if (isNumberBaseConversionSkeleton(skeleton)) return NUMBER_BASE_CONVERSION_FAMILY;
  return skeleton;
}

/**
 * 按发布种子（或调用方传入的种子）抽出综合卷。
 * 不修改入参数组。返回顺序是章号、题号，不是抽取顺序。
 */
export function selectComprehensiveQuestions<T extends ComprehensiveSampleQuestion>(
  questions: readonly T[],
  options?: ComprehensiveSampleOptions,
): T[] {
  const seed = options?.seed ?? COMPREHENSIVE_SAMPLE_SEED;
  const quotas = options?.chapterQuotas ?? COMPREHENSIVE_CHAPTER_QUOTAS;
  const fallbackQuota = positiveInteger(
    options?.questionsPerChapter ?? COMPREHENSIVE_QUESTIONS_PER_CHAPTER,
  );
  const byChapter = new Map<number, T[]>();
  for (const question of questions) {
    const group = byChapter.get(question.chapter);
    if (group) group.push(question);
    else byChapter.set(question.chapter, [question]);
  }

  const selected: T[] = [];
  const usedFamilies = new Set<string>();
  const chapters = [...byChapter.keys()].sort((left, right) => left - right);
  for (const chapter of chapters) {
    const listedQuota = quotas[chapter];
    const quota = listedQuota === undefined ? fallbackQuota : positiveInteger(listedQuota);
    const pool = byChapter.get(chapter) ?? [];
    selected.push(...drawChapter(pool, quota, chapterRandom(seed, chapter), usedFamilies));
  }
  selected.sort((left, right) => left.chapter - right.chapter || left.id - right.id);
  return selected;
}

function positiveInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function chapterRandom(seed: string, chapter: number): () => number {
  return mulberry32(fnv1a32(`${seed}\0${chapter}`));
}

function drawChapter<T extends ComprehensiveSampleQuestion>(
  pool: readonly T[],
  quota: number,
  nextUint32: () => number,
  usedFamilies: Set<string>,
): T[] {
  const eligible = pool.filter((question) =>
    !isSlideTeachingSource(question.source)
    && !isFinalObjectiveVariantExplanation(question.explanation),
  );
  const numericPool = eligible.filter(
    (question) => classifyObjectiveSource(question.explanation) === 'numeric-slice',
  );
  const reserve = quota >= COMPREHENSIVE_QUESTIONS_PER_CHAPTER && numericPool.length > 0
    ? Math.min(COMPREHENSIVE_NUMERIC_SLICE_RESERVE, numericPool.length, quota)
    : 0;
  const picked: T[] = [];
  if (reserve > 0) {
    picked.push(...drawWeighted(numericPool, reserve, nextUint32, usedFamilies));
  }
  const pickedIds = new Set(picked.map((question) => question.id));
  const rest = eligible.filter((question) => !pickedIds.has(question.id));
  picked.push(...drawWeighted(rest, quota - picked.length, nextUint32, usedFamilies));
  return picked;
}

/**
 * 不放回加权抽取。候选先按题号排序，票段按这个顺序累加，
 * 所以同一权重表和同一随机流得到同一结果。
 * 已占用的题干族权重先记 0；若因此无票可抽，再放行重复族，保证配额能凑满。
 */
function drawWeighted<T extends ComprehensiveSampleQuestion>(
  pool: readonly T[],
  count: number,
  nextUint32: () => number,
  usedFamilies: Set<string>,
): T[] {
  const remaining = [...pool].sort((left, right) => left.id - right.id);
  const draws = Math.min(count, remaining.length);
  const picked: T[] = [];
  for (let drawIndex = 0; drawIndex < draws; drawIndex += 1) {
    let weights = familyWeights(remaining, usedFamilies, false);
    let total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) {
      weights = familyWeights(remaining, usedFamilies, true);
      total = weights.reduce((sum, weight) => sum + weight, 0);
      if (total <= 0) break;
    }
    let ticket = nextBelow(nextUint32, total);
    let chosenIndex = -1;
    for (let index = 0; index < remaining.length; index += 1) {
      const weight = weights[index] ?? 0;
      if (weight > 0 && ticket < weight) {
        chosenIndex = index;
        break;
      }
      ticket -= weight;
    }
    if (chosenIndex < 0) break;
    const chosen = remaining.splice(chosenIndex, 1)[0];
    if (!chosen) continue;
    usedFamilies.add(comprehensiveStemFamily(chosen));
    picked.push(chosen);
  }
  picked.sort((left, right) => left.id - right.id);
  return picked;
}

function familyWeights<T extends ComprehensiveSampleQuestion>(
  questions: readonly T[],
  usedFamilies: Set<string>,
  relaxFamily: boolean,
): number[] {
  return questions.map((question) => {
    if (!relaxFamily && usedFamilies.has(comprehensiveStemFamily(question))) return 0;
    return comprehensiveQuestionWeight(question).weight;
  });
}

/** 旧题里和作业5同一类的重装初值。范围已对当前题库核对，只命中第 6 章这 7 道。 */
function isTimerReloadStem(questionText: string | undefined): boolean {
  if (!questionText) return false;
  return /初值/.test(questionText) && /定时|重装|TH0|TL0|THx|TH1/.test(questionText);
}

function numericSliceHomework(explanation: string | undefined): string | undefined {
  if (classifyObjectiveSource(explanation) !== 'numeric-slice') return undefined;
  const firstLine = explanation?.split('\n', 1)[0] ?? '';
  return firstLine.match(/作业\d+/)?.[0] ?? 'untagged';
}

/**
 * 去掉会随换数字而变的部分，留下模板。
 * 十六进制字面量要先于普通数字替换，避免 `2FH` 只吃掉前面的数字。
 */
function normalizeQuestionSkeleton(questionText: string): string {
  return questionText
    .replace(/0x[0-9a-fA-F]+/gi, '#')
    .replace(/[0-9A-Fa-f]{2,}H/g, '#')
    .replace(/[01]{4,}B/g, '#')
    .replace(/\d+(?:\.\d+)?/g, '#')
    .replace(/\s+/g, '')
    .replace(/[，。？?！!、：:；;（）()“”"'‘’`]/g, '');
}

function isNumberBaseConversionSkeleton(skeleton: string): boolean {
  return /^(?:十进制数#的BCD码是|有符号十进制数-#的补码是|将.+转换成(?:二进制|十六进制|十进制)数为)$/.test(skeleton);
}

/** FNV-1a 32 位。参数与练习配对里的稳定乱序一致。 */
function fnv1a32(text: string): number {
  let state = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    state = Math.imul(state ^ text.charCodeAt(index), FNV_PRIME);
  }
  return state >>> 0;
}

/** mulberry32。返回 [0, 2^32) 的整数。 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  };
}

/** 无偏的 [0, bound) 整数。bound 小于 2^32。 */
function nextBelow(nextUint32: () => number, bound: number): number {
  if (bound <= 1) return 0;
  const limit = Math.floor(UINT32_RANGE / bound) * bound;
  let value = nextUint32();
  while (value >= limit) value = nextUint32();
  return value % bound;
}
