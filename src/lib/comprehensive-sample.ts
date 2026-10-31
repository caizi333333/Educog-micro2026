/**
 * 综合测评抽样。
 *
 * 默认卷仍是 20 题：第 1–10 章各 2 题，和原先「每章 2 题」的题量相同，
 * 所以一次测评的长度不变。变的是章内怎么选——不再按题库顺序取前两题。
 *
 * 题库没有 topic / tags。客观、可机判的信号用现成字段：
 * - `type === 'multiple-choice'` 高于填空式代码题；
 * - 解析首行 `[source: 往年作业册…单选…]`、`[source: 作业5/6/7 数值切片…]`
 *   是期末客观区已经入库的作业单选和机判切片；
 * - `id >= 510` 是这批队尾新题，在同类里再乘一层。
 * 课件或网页指导上的 `source` 对象只是讲义出处，不参与这层加权。
 *
 * 复现：发布种子 `COMPREHENSIVE_SAMPLE_SEED`，不是日历日，也不是用户 id。
 * 拉题和交卷都会重算同一函数；按日换卷会在北京时间零点把进行中的卷判成缺题
 * （页面进度窗口是 24 小时），按用户换卷会让同班综合测评的知识点覆盖对不上。
 * 换卷时改种子或权重表。同一 Node 主版本、同一题库、同一种子得到同一 id 集合。
 * 接口按章号、题号排序；页面上的作答顺序仍由客户端打乱。
 *
 * 每一章单独用 `FNV-1a(seed + "\\0" + chapter)` 起一个 mulberry32，
 * 所以改某一章的题不会带动其他章重抽。
 *
 * 用法：
 * ```ts
 * getComprehensiveQuestions();
 * selectComprehensiveQuestions(quizQuestions, { seed: COMPREHENSIVE_SAMPLE_SEED });
 * ```
 */

export const COMPREHENSIVE_SAMPLE_SEED = 'comprehensive-objective-v1';

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

export type ObjectiveSourceClass = keyof typeof COMPREHENSIVE_SOURCE_WEIGHTS;

export type ComprehensiveSampleQuestion = {
  id: number;
  chapter: number;
  type: string;
  explanation?: string;
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
 * 只看解析第一行。题干不参与分类，避免抽样绑在某道原题的措辞上。
 */
export function classifyObjectiveSource(explanation: string | undefined): ObjectiveSourceClass {
  const firstLine = explanation?.split('\n', 1)[0] ?? '';
  if (!firstLine.startsWith('[source:')) return 'untagged';
  if (firstLine.includes('数值切片')) return 'numeric-slice';
  if (firstLine.includes('往年作业册') && firstLine.includes('单选')) return 'workbook-choice';
  return 'other-tagged';
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
  const chapters = [...byChapter.keys()].sort((left, right) => left - right);
  for (const chapter of chapters) {
    const listedQuota = quotas[chapter];
    const quota = listedQuota === undefined ? fallbackQuota : positiveInteger(listedQuota);
    const pool = byChapter.get(chapter) ?? [];
    selected.push(...drawWeighted(pool, quota, chapterRandom(seed, chapter)));
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

/**
 * 不放回加权抽取。候选先按题号排序，票段按这个顺序累加，
 * 所以同一权重表和同一随机流得到同一结果。抽出后再按题号排好。
 */
function drawWeighted<T extends ComprehensiveSampleQuestion>(
  pool: readonly T[],
  count: number,
  nextUint32: () => number,
): T[] {
  const remaining = [...pool].sort((left, right) => left.id - right.id);
  const draws = Math.min(count, remaining.length);
  const picked: T[] = [];
  for (let drawIndex = 0; drawIndex < draws; drawIndex += 1) {
    const weights = remaining.map((question) => comprehensiveQuestionWeight(question).weight);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) break;
    let ticket = nextBelow(nextUint32, total);
    let chosenIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index += 1) {
      const weight = weights[index] ?? 0;
      if (ticket < weight) {
        chosenIndex = index;
        break;
      }
      ticket -= weight;
    }
    const chosen = remaining.splice(chosenIndex, 1)[0];
    if (chosen) picked.push(chosen);
  }
  picked.sort((left, right) => left.id - right.id);
  return picked;
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
