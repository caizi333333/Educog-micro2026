/**
 * 期末客观模拟抽样。
 *
 * 和综合测评（`comprehensive-objective-v2`，第 1–10 章各 2 题、共 20 题）分开。
 * 学生从 `/quiz?topic=final-objective` 进入。章练习仍按 `?chapter=` 返回该章全部题目。
 *
 * 卷面对齐 2024 秋 A 卷的客观部分：单项选择 15 + 判断 15。判断在平台上是两选项单选，
 * 选项顺序固定为「正确」「错误」，界面字母因此是 A 正确、B 错误。不包含简答、写指令、
 * 综合编程和作图。芯片口径按 80C51 写新题干。
 *
 * 发布种子 `final-objective-v1`。同一 Node 主版本、同一题库、同一种子得到同一 id 集合。
 * 每个座位用 `FNV-1a(seed + "\\0" + seatId)` 起一个 mulberry32，座位之间不共用随机流；
 * 已抽中的题号和题干族仍全卷共享，所以某一座位的候选变了，可能让后面的座位改抽另一题。
 *
 * 规则：
 * 1. 课件例题（`course-slides.pdf` 或 `kind === 'slide'`）不进池。网页指导可以。
 * 2. 全卷每个题干族至多一题，族的算法与综合测评相同。
 * 3. 判断座位只接受解析首行标了本座位的变体，且选项必须是「正确」「错误」。
 * 4. 带变体标记的题目只进它自己的座位，也不进综合测评。
 * 5. 初值、波特率、地址三个计算座位只接受对应的作业 5/6/7 数值切片。
 *    定时方式座位排除 `timer-reload` 族，避免和初值座位抢同一模板。
 *
 * 用法：
 * ```ts
 * getFinalObjectiveQuestions();
 * selectFinalObjectivePaper(quizQuestions, { seed: FINAL_OBJECTIVE_SAMPLE_SEED });
 * ```
 */

import {
  classifyObjectiveSource,
  comprehensiveQuestionWeight,
  comprehensiveStemFamily,
  isFinalObjectiveVariantExplanation,
  isSlideTeachingSource,
  type ComprehensiveSampleQuestion,
} from '@/lib/comprehensive-sample';

export const FINAL_OBJECTIVE_TOPIC_ID = 'final-objective';
export const FINAL_OBJECTIVE_QUIZ_ID = 'quiz-final-objective';
export const FINAL_OBJECTIVE_SAMPLE_SEED = 'final-objective-v1';

/** 与 `isFinalObjectiveVariantExplanation` 识别的前缀一致。 */
export const FINAL_OBJECTIVE_VARIANT_MARK = '[source: 期末客观模拟变体';

const NUMBER_BASE_FAMILY = 'number-base-conversion';
const TIMER_RELOAD_FAMILY = 'timer-reload';
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const UINT32_RANGE = 4294967296;

export const JUDGMENT_OPTIONS = ['正确', '错误'] as const;

export type FinalObjectiveSection = 'single-choice' | 'judgment';
export type FinalObjectiveHomework = '作业5' | '作业6' | '作业7';

export type FinalObjectiveSeat = {
  id: string;
  section: FinalObjectiveSection;
  /** 考点名称。给学生说明用，不参与匹配。 */
  title: string;
  quota: 1;
  /** `ka === prefix` 或 `ka` 以 `prefix.` 开头。 */
  kaPrefixes?: readonly string[];
  /** 已核对过的题库题号。和 ka 前缀取并集。 */
  bankIds?: readonly number[];
  /** 只接受该作业的数值切片。 */
  numericHomework?: FinalObjectiveHomework;
  structural?: 'number-base' | 'bit-directive';
  /** 只抽带本座位标签的变体。 */
  tagOnly?: boolean;
  /** 这些题干族不进本座位，即使还没被其他座位占用。 */
  excludeFamilies?: readonly string[];
  excludeNumericSlice?: boolean;
};

/**
 * 客观座位。单项选择在前，判断在后，与卷面两大部分一致。
 * 配额每座 1，合计 30。
 */
export const FINAL_OBJECTIVE_BLUEPRINT: readonly FinalObjectiveSeat[] = [
  {
    id: 'choice-number-base',
    section: 'single-choice',
    title: '数制、补码与 BCD',
    quota: 1,
    structural: 'number-base',
  },
  {
    id: 'choice-reset-psw',
    section: 'single-choice',
    title: '复位与 PSW',
    quota: 1,
    bankIds: [75, 262, 521],
  },
  {
    id: 'choice-memory-extend',
    section: 'single-choice',
    title: '存储器扩展',
    quota: 1,
    kaPrefixes: ['2.2.5'],
  },
  {
    id: 'choice-interrupt-entry',
    section: 'single-choice',
    title: '中断入口',
    quota: 1,
    kaPrefixes: ['5.2.4'],
    bankIds: [547, 549],
  },
  {
    id: 'choice-rst',
    section: 'single-choice',
    title: 'RST 复位引脚',
    quota: 1,
    bankIds: [261, 524],
  },
  {
    id: 'choice-stack-sp',
    section: 'single-choice',
    title: '堆栈与 SP',
    quota: 1,
    kaPrefixes: ['3.2.4'],
    bankIds: [32, 138, 541],
  },
  {
    id: 'choice-pseudo-bit',
    section: 'single-choice',
    title: '伪指令 BIT',
    quota: 1,
    structural: 'bit-directive',
  },
  {
    id: 'choice-internal-ram',
    section: 'single-choice',
    title: '内部 RAM 分区',
    quota: 1,
    kaPrefixes: ['2.2.2', '2.2.4'],
    bankIds: [10, 122, 145],
  },
  {
    id: 'choice-timer-mode',
    section: 'single-choice',
    title: '定时器工作方式',
    quota: 1,
    kaPrefixes: ['6.2'],
    excludeFamilies: [TIMER_RELOAD_FAMILY],
    excludeNumericSlice: true,
  },
  {
    id: 'choice-timer-reload',
    section: 'single-choice',
    title: '定时初值计算',
    quota: 1,
    numericHomework: '作业5',
  },
  {
    id: 'choice-baud',
    section: 'single-choice',
    title: '波特率计算',
    quota: 1,
    numericHomework: '作业6',
  },
  {
    id: 'choice-address-range',
    section: 'single-choice',
    title: '地址范围计算',
    quota: 1,
    numericHomework: '作业7',
  },
  {
    id: 'choice-led-polarity',
    section: 'single-choice',
    title: 'LED 与数码管极性',
    quota: 1,
    kaPrefixes: ['8.1.1'],
    bankIds: [387],
  },
  {
    id: 'choice-dac',
    section: 'single-choice',
    title: 'DAC 简单计算',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'choice-addressing',
    section: 'single-choice',
    title: '寻址方式',
    quota: 1,
    kaPrefixes: ['3.1'],
  },
  {
    id: 'judge-harvard',
    section: 'judgment',
    title: '哈佛结构',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-reset-psw',
    section: 'judgment',
    title: '复位后 PSW 与 SP',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-ram-zones',
    section: 'judgment',
    title: '内部 RAM 分区',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-interrupt-entry',
    section: 'judgment',
    title: '中断入口地址',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-rst',
    section: 'judgment',
    title: 'RST 有效电平',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-stack-sp',
    section: 'judgment',
    title: 'PUSH 与 SP',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-bit-directive',
    section: 'judgment',
    title: '伪指令 BIT',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-timer-mode',
    section: 'judgment',
    title: '定时方式 2 重装',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-led-polarity',
    section: 'judgment',
    title: '共阴极数码管极性',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-dac-role',
    section: 'judgment',
    title: 'DAC 的作用',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-opto',
    section: 'judgment',
    title: '光电隔离',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-addressing',
    section: 'judgment',
    title: '立即寻址与直接寻址',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-ret-reti',
    section: 'judgment',
    title: 'RET 与 RETI',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-nesting',
    section: 'judgment',
    title: '中断嵌套',
    quota: 1,
    tagOnly: true,
  },
  {
    id: 'judge-instruction-validity',
    section: 'judgment',
    title: '指令正误',
    quota: 1,
    tagOnly: true,
  },
];

export const FINAL_OBJECTIVE_PAPER_LENGTH = FINAL_OBJECTIVE_BLUEPRINT.reduce(
  (sum, seat) => sum + seat.quota,
  0,
);

export const FINAL_OBJECTIVE_CHOICE_COUNT = FINAL_OBJECTIVE_BLUEPRINT.filter(
  (seat) => seat.section === 'single-choice',
).length;

export const FINAL_OBJECTIVE_JUDGMENT_COUNT = FINAL_OBJECTIVE_BLUEPRINT.filter(
  (seat) => seat.section === 'judgment',
).length;

export type FinalObjectiveSampleQuestion = ComprehensiveSampleQuestion & {
  ka?: string;
  options?: readonly string[];
  correctAnswer?: string;
};

export type FinalObjectivePick<T> = {
  seat: FinalObjectiveSeat;
  question: T;
};

export type FinalObjectiveSampleOptions = {
  /** 默认 `FINAL_OBJECTIVE_SAMPLE_SEED`。 */
  seed?: string;
};

export type FinalObjectiveSeatTag = {
  kind: 'judgment' | 'choice';
  seatId: string;
};

const SEAT_TAG_PATTERN = /^\[source: 期末客观模拟变体 · (判断座位|单选座位) ([a-z0-9-]+)\]$/;

/**
 * 判断题的平台形态：第一项「正确」、第二项「错误」。
 * 学生界面会把这两项标成 A、B。
 */
export function isJudgmentOptionPair(options: readonly string[] | undefined): boolean {
  return Boolean(options
    && options.length === JUDGMENT_OPTIONS.length
    && options.every((option, index) => option === JUDGMENT_OPTIONS[index]));
}

/**
 * 只读解析第一行。没有变体标记时返回 null。
 */
export function readFinalObjectiveSeatTag(explanation: string | undefined): FinalObjectiveSeatTag | null {
  const firstLine = explanation?.split('\n', 1)[0] ?? '';
  const match = SEAT_TAG_PATTERN.exec(firstLine);
  if (!match?.[1] || !match[2]) return null;
  return {
    kind: match[1] === '判断座位' ? 'judgment' : 'choice',
    seatId: match[2],
  };
}

/**
 * 按发布种子抽出期末客观模拟卷。
 * 不修改入参数组。返回顺序是蓝图顺序：先 15 道单项选择，再 15 道判断。
 * 某个座位抽不满时抛出错误，避免静默交一张缺考卷。
 */
export function selectFinalObjectivePaper<T extends FinalObjectiveSampleQuestion>(
  questions: readonly T[],
  options?: FinalObjectiveSampleOptions,
): FinalObjectivePick<T>[] {
  const seed = options?.seed ?? FINAL_OBJECTIVE_SAMPLE_SEED;
  const usedIds = new Set<number>();
  const usedFamilies = new Set<string>();
  const pickedBySeat = new Map<string, T>();
  const drawOrder = [...FINAL_OBJECTIVE_BLUEPRINT].sort(
    (left, right) => seatSpecificity(right) - seatSpecificity(left),
  );

  for (const seat of drawOrder) {
    const random = mulberry32(fnv1a32(`${seed}\0${seat.id}`));
    const strictPool = candidatesForSeat(seat, questions, usedIds, usedFamilies, false);
    const pool = strictPool.length > 0
      ? strictPool
      : candidatesForSeat(seat, questions, usedIds, usedFamilies, true);
    if (pool.length === 0) {
      throw new Error(`期末客观模拟座位 ${seat.id}（${seat.title}）没有可抽题目`);
    }
    const chosen = pickWeighted(pool, random);
    usedIds.add(chosen.id);
    usedFamilies.add(comprehensiveStemFamily(chosen));
    pickedBySeat.set(seat.id, chosen);
  }

  return FINAL_OBJECTIVE_BLUEPRINT.map((seat) => {
    const question = pickedBySeat.get(seat.id);
    if (!question) throw new Error(`期末客观模拟座位 ${seat.id}（${seat.title}）没有可抽题目`);
    return { seat, question };
  });
}

function seatSpecificity(seat: FinalObjectiveSeat): number {
  if (seat.tagOnly) return 3;
  if (seat.numericHomework || seat.structural) return 2;
  return 1;
}

function candidatesForSeat<T extends FinalObjectiveSampleQuestion>(
  seat: FinalObjectiveSeat,
  questions: readonly T[],
  usedIds: ReadonlySet<number>,
  usedFamilies: ReadonlySet<string>,
  relaxFamily: boolean,
): T[] {
  return questions.filter((question) => {
    if (usedIds.has(question.id)) return false;
    if (!isMachineGradedChoice(question)) return false;
    if (!seatAccepts(seat, question)) return false;
    if (!relaxFamily && usedFamilies.has(comprehensiveStemFamily(question))) return false;
    return true;
  });
}

function isMachineGradedChoice(question: FinalObjectiveSampleQuestion): boolean {
  return question.type === 'multiple-choice' && !isSlideTeachingSource(question.source);
}

function seatAccepts(seat: FinalObjectiveSeat, question: FinalObjectiveSampleQuestion): boolean {
  const tag = readFinalObjectiveSeatTag(question.explanation);
  if (seat.section === 'judgment' || seat.tagOnly) {
    return tag?.kind === (seat.section === 'judgment' ? 'judgment' : 'choice')
      && tag.seatId === seat.id
      && (seat.section === 'judgment' ? isJudgmentOptionPair(question.options) : !isJudgmentOptionPair(question.options));
  }
  if (isFinalObjectiveVariantExplanation(question.explanation)) return false;
  if (isJudgmentOptionPair(question.options)) return false;
  if ((question.options?.length ?? 0) < 3) return false;
  if (seat.numericHomework) return numericHomeworkOf(question.explanation) === seat.numericHomework;
  if (seat.structural === 'number-base') return comprehensiveStemFamily(question) === NUMBER_BASE_FAMILY;
  if (seat.structural === 'bit-directive') {
    return question.correctAnswer === 'BIT' && Boolean(question.options?.includes('BIT'));
  }
  const byId = seat.bankIds?.includes(question.id) ?? false;
  const byKa = (seat.kaPrefixes ?? []).some((prefix) => matchesKaPrefix(question.ka, prefix));
  if (!byId && !byKa) return false;
  if (seat.excludeNumericSlice && classifyObjectiveSource(question.explanation) === 'numeric-slice') return false;
  if (seat.excludeFamilies?.includes(comprehensiveStemFamily(question))) return false;
  return true;
}

function matchesKaPrefix(ka: string | undefined, prefix: string): boolean {
  if (!ka) return false;
  return ka === prefix || ka.startsWith(`${prefix}.`);
}

function numericHomeworkOf(explanation: string | undefined): string | undefined {
  if (classifyObjectiveSource(explanation) !== 'numeric-slice') return undefined;
  const firstLine = explanation?.split('\n', 1)[0] ?? '';
  return firstLine.match(/作业\d+/)?.[0];
}

function pickWeighted<T extends FinalObjectiveSampleQuestion>(
  pool: readonly T[],
  nextUint32: () => number,
): T {
  const ordered = [...pool].sort((left, right) => left.id - right.id);
  const weights = ordered.map((question) => comprehensiveQuestionWeight(question).weight);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0 || ordered.length === 0) {
    throw new Error('期末客观模拟加权抽题时候选权重为空');
  }
  let ticket = nextBelow(nextUint32, total);
  for (let index = 0; index < ordered.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (ticket < weight) {
      const chosen = ordered[index];
      if (!chosen) break;
      return chosen;
    }
    ticket -= weight;
  }
  const fallback = ordered[ordered.length - 1];
  if (!fallback) throw new Error('期末客观模拟加权抽题时候选为空');
  return fallback;
}

function fnv1a32(text: string): number {
  let state = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    state = Math.imul(state ^ text.charCodeAt(index), FNV_PRIME);
  }
  return state >>> 0;
}

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

function nextBelow(nextUint32: () => number, bound: number): number {
  if (bound <= 1) return 0;
  const limit = Math.floor(UINT32_RANGE / bound) * bound;
  let value = nextUint32();
  while (value >= limit) value = nextUint32();
  return value % bound;
}
