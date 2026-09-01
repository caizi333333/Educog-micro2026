// Lightweight in-memory retrieval over the canonical course content so the
// AI tutor can answer with grounded references instead of hallucinating.
// No external embedding model / vector store dependency — pure keyword
// scoring over knowledgePoints + experiment-config. Good enough for the
// current small course corpus and fast enough for synchronous server use.

import { knowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';
import { experiments, type ExperimentConfig } from '@/lib/experiment-config';

export type RetrievedContext = {
  knowledgePoints: KnowledgePoint[];
  experiments: ExperimentConfig[];
};

const HAN_RANGE = /\p{Script=Han}/u;
const QUERY_STOP_TOKENS = new Set([
  '下列', '以下', '关于', '哪个', '哪些', '的是', '不是', '什么', '如何',
  '正确', '错误', '描述', '说法', '可以', '用于', '主要', '作用', '属于',
  '问题', '进行', '实现', '其中', '一个', '的是', '应当', '需要', '采用',
  '表示', '内容', '完成', '必须', '通常', '系统', '单片机', '微控制器',
]);

type WeightedTokens = ReadonlyMap<string, number>;

type QueryParts = {
  stem: string;
  supportingText: string;
  supportingWeight: number;
};

const RETRIEVAL_WEIGHTS = {
  stemToken: 1,
  choiceToken: 0.24,
  codeToken: 0.85,
  aliasToken: 0.9,
  knowledgeName: 4,
  knowledgeDescription: 1,
  exactTechnicalNotation: 80,
  stemNamePhrase: 30,
  choiceNamePhrase: 6,
  aliasNamePhrase: 18,
  level2BestChild: 0.56,
  level2SecondChild: 0.18,
  level1BestChild: 0.12,
  level1SecondChild: 0.04,
} as const;

// These aliases describe stable 8051 vocabulary, register names and common
// classroom phrasing. They intentionally contain no knowledge-point IDs and no
// answer keys: the same expansion is applied to every production query.
const COURSE_TERM_ALIASES: ReadonlyArray<{ pattern: RegExp; expansion: string }> = [
  {
    pattern: /基本架构|基本结构|内部架构/u,
    expansion: 'CPU结构 运算器 控制器 程序计数器 指令寄存器',
  },
  {
    pattern: /下一条.*指令.*地址|指令.*地址.*程序计数/iu,
    expansion: 'CPU结构 程序计数器 PC 程序执行顺序控制',
  },
  {
    pattern: /哈佛结构|冯[·・]?诺依曼|普林斯顿结构|程序空间.*数据空间|程序存储器.*数据存储器/iu,
    expansion: '存储器组织 程序存储器 数据存储器 地址空间',
  },
  {
    pattern: /#[0-9a-f]+h?|立即数/iu,
    expansion: '立即寻址 操作数以#开头',
  },
  {
    pattern: /@a\s*\+\s*(?:dptr|pc)|基址.*变址|变址.*基址/iu,
    expansion: '变址寻址 基址加变址 ROM表格 查表',
  },
  {
    pattern: /\bmovc\b/iu,
    expansion: '程序存储器传送 MOVC 查表 ROM常数',
  },
  {
    pattern: /\bkeil\b|[μµu]vision/iu,
    expansion: 'Keil C51开发环境 工程管理 工程创建 配置 编译调试 程序下载',
  },
  {
    pattern: /_crol_|_cror_|intrins\.h|循环移位函数/iu,
    expansion: 'C51常用库函数 标准库 头文件 循环移位',
  },
  {
    pattern: /中断响应.*(?:压入|压栈|堆栈)|(?:压入|压栈).*中断响应/iu,
    expansion: '中断处理流程 中断响应 断点保存 堆栈 返回地址',
  },
  {
    pattern: /中断源.*(?:几个|数量)|(?:几个|数量).*中断源/iu,
    expansion: '89C51中断系统 中断源 控制寄存器',
  },
  {
    pattern: /定时器中断.*(?:任务|调度|切换)|(?:任务|调度|切换).*定时器中断/iu,
    expansion: '定时器应用 定时中断 周期性任务 实时',
  },
  {
    pattern: /计数脉冲.*(?:内部|外部)|(?:内部|外部).*计数脉冲/iu,
    expansion: '定时器基础 定时器计数器原理 工作原理 内部时钟 外部脉冲',
  },
  {
    pattern: /计数模式|外部引脚\s*t0|外部引脚\s*t1|t0\s*\(p3\.4\)|t1\s*\(p3\.5\)/iu,
    expansion: '计数器应用 外部脉冲计数 T0 T1引脚 外部事件计数',
  },
  {
    pattern: /\b(?:tmod|tcon|th0|tl0|th1|tl1|tr0|tr1|tf0|tf1)\b/iu,
    expansion: '定时器计数器 控制寄存器 工作模式 初值',
  },
  {
    pattern: /\b(?:ie|ip|int0|int1|retii?)\b/iu,
    expansion: '中断系统 中断控制寄存器 中断处理',
  },
  { pattern: /\bscon\b/iu, expansion: '89C51串口 SCON寄存器 串口控制寄存器' },
  { pattern: /\bsbuf\b/iu, expansion: '89C51串口 SBUF寄存器 串口数据缓冲区' },
  { pattern: /\bti\b/iu, expansion: 'SCON寄存器 UART编程 发送数据 发送完成 TI标志' },
  { pattern: /\bri\b/iu, expansion: 'SCON寄存器 UART编程 接收数据 接收完成 RI标志' },
  {
    pattern: /波特率.*单位|单位.*波特率/iu,
    expansion: '通信基础 波特率概念 波特率定义 常用波特率',
  },
  {
    pattern: /温度(?:测量|采集|检测)|ds18b20/iu,
    expansion: '传感器接口 温度传感器 模拟信号采集 数据转换',
  },
  {
    pattern: /软件.*(?:拆分|模块划分|独立模块)|模块耦合|接口定义|独立测试/iu,
    expansion: '软件设计流程 模块划分 接口定义 模块化编程 低耦合 独立测试 联合调试',
  },
  {
    pattern: /功能模块|方案设计|系统架构/iu,
    expansion: '系统设计方法 方案设计 功能模块 软硬件协同设计',
  },
  {
    pattern: /系统调试|软硬件调试|综合.*调试方法/iu,
    expansion: '调试与测试 联合调试 硬件调试 软件调试 问题定位',
  },
  {
    pattern: /tinyml|微型机器学习/iu,
    expansion: '人工智能导论 AI 嵌入式系统 TinyML 微型机器学习 MCU部署推理',
  },
  {
    pattern: /ai.*(?:回答|输出|结论).*(?:处理|核对|验证|引用)|(?:核对|验证).*ai.*(?:回答|输出|结论)/iu,
    expansion: 'AI输出核验与引用 课程资料 数据手册 可运行结果 交叉核验 AI辅助范围',
  },
];

// 实验入口必须由明确的实践主题触发。诸如“基本架构”这类概念问题会在
// 知识节点中命中“程序计数器”，若直接复用全部检索词，容易把“计数器”
// 误配为定时/计数器实验。这里宁可不推荐实验，也不把无关操作引向学生。
const EXPERIMENT_INTENT_TERMS = [
  '寻址', '指令', '查表', '运算',
  '定时器', '计数器', '中断', '串口', '通信',
  'io', '端口', 'led', '流水灯', '数码管', '按键', '消抖',
  '蜂鸣器', '步进电机', '电机', 'pwm', '光照',
  '智能小车', '智慧农业', '温室', '大棚',
] as const;

function hasExplicitExperimentIntent(question: string): boolean {
  const normalized = question.toLowerCase();
  return EXPERIMENT_INTENT_TERMS.some((term) => normalized.includes(term));
}

function normalizeTechnicalText(input: string): string {
  return input.toLowerCase().replace(/[μµ]/gu, 'u');
}

function tokenize(input: string): string[] {
  if (!input) return [];
  const lower = normalizeTechnicalText(input);
  // Preserve notation that carries meaning in 8051 code before extracting
  // ordinary Latin tokens. This keeps #30H, @A+DPTR, P3.4 and _crol_ intact.
  const technicalTokens = lower.match(
    /_[a-z][a-z0-9_]*_|@[a-z0-9]+(?:\s*\+\s*[a-z0-9]+)+|#[0-9a-f]+h?|p[0-3]\.[0-7]|[a-z]+[0-9]+|[a-z]{2,}/g,
  )?.map((token) => token.replace(/\s+/g, '')) ?? [];
  // Chinese: collect contiguous Han runs and emit every 2-char window so
  // multi-char terms like '中断', '定时器', '波特率' all get considered.
  const charBigrams: string[] = [];
  const chars = Array.from(lower);
  let run = '';
  const flush = () => {
    if (run.length >= 2) {
      for (let i = 0; i < run.length - 1; i++) charBigrams.push(run.slice(i, i + 2));
      // also add 3-char windows for terms like '寻址方式', '波特率', '数码管'
      for (let i = 0; i < run.length - 2; i++) charBigrams.push(run.slice(i, i + 3));
    }
    run = '';
  };
  for (const ch of chars) {
    if (HAN_RANGE.test(ch)) run += ch;
    else flush();
  }
  flush();
  // dedupe but preserve order
  return Array.from(new Set([...technicalTokens, ...charBigrams]))
    .filter((token) => !QUERY_STOP_TOKENS.has(token));
}

function splitQuery(question: string): QueryParts {
  const optionMarker = '候选答案：';
  const codeMarker = '待补全代码：';
  const optionIndex = question.indexOf(optionMarker);
  const codeIndex = question.indexOf(codeMarker);
  const markerIndex = [optionIndex, codeIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (markerIndex === undefined) {
    return { stem: question, supportingText: '', supportingWeight: 0 };
  }

  const isCode = markerIndex === codeIndex;
  const marker = isCode ? codeMarker : optionMarker;
  return {
    stem: question.slice(0, markerIndex).trim(),
    supportingText: question.slice(markerIndex + marker.length).trim(),
    // Multiple-choice alternatives are deliberately weak evidence because
    // they contain distractors. A code body remains strong evidence because
    // syntax and register names are the substance of a code question.
    supportingWeight: isCode ? RETRIEVAL_WEIGHTS.codeToken : RETRIEVAL_WEIGHTS.choiceToken,
  };
}

function courseAliasExpansion(question: string): string {
  const normalized = normalizeTechnicalText(question);
  return COURSE_TERM_ALIASES
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ expansion }) => expansion)
    .join(' ');
}

function addWeightedTokens(target: Map<string, number>, input: string, weight: number): void {
  for (const token of tokenize(input)) {
    target.set(token, Math.max(target.get(token) ?? 0, weight));
  }
}

function buildWeightedQuery(question: string): {
  tokens: WeightedTokens;
  stem: string;
  supportingText: string;
  aliasText: string;
} {
  const { stem, supportingText, supportingWeight } = splitQuery(question);
  const aliasText = courseAliasExpansion(question);
  const tokens = new Map<string, number>();
  addWeightedTokens(tokens, stem, RETRIEVAL_WEIGHTS.stemToken);
  addWeightedTokens(tokens, supportingText, supportingWeight);
  addWeightedTokens(tokens, aliasText, RETRIEVAL_WEIGHTS.aliasToken);
  return { tokens, stem, supportingText, aliasText };
}

const KNOWLEDGE_TOKEN_IDF = (() => {
  const documentFrequency = new Map<string, number>();
  for (const point of knowledgePoints) {
    const documentTokens = new Set(tokenize(`${point.name} ${point.description ?? ''}`));
    for (const token of documentTokens) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  return new Map([...documentFrequency.entries()].map(([token, count]) => [
    token,
    1 + Math.log((knowledgePoints.length + 1) / (count + 1)),
  ]));
})();

const DIRECT_CHILD_IDS = (() => {
  const result = new Map<string, string[]>();
  for (const point of knowledgePoints) {
    const separator = point.id.lastIndexOf('.');
    if (separator < 0) continue;
    const parentId = point.id.slice(0, separator);
    result.set(parentId, [...(result.get(parentId) ?? []), point.id]);
  }
  return result;
})();

function scoreText(
  tokens: WeightedTokens,
  text: string,
  weight: number,
  tokenWeights?: ReadonlyMap<string, number>,
): number {
  if (!text) return 0;
  const lower = normalizeTechnicalText(text);
  let score = 0;
  for (const [t, queryWeight] of tokens) {
    if (lower.includes(t)) {
      // longer tokens are more discriminative
      const lengthWeight = t.length >= 4 ? 3 : t.length >= 3 ? 2 : 1;
      score += weight * queryWeight * lengthWeight * (tokenWeights?.get(t) ?? 1);
    }
  }
  return score;
}

function scoreTechnicalNotation(tokens: WeightedTokens, text: string): number {
  const normalized = normalizeTechnicalText(text).replace(/\s+/gu, '');
  let score = 0;
  for (const [token, queryWeight] of tokens) {
    if (!/^[@#_]/u.test(token) && !/^p[0-3]\.[0-7]$/u.test(token)) continue;
    if (normalized.includes(token)) {
      score += RETRIEVAL_WEIGHTS.exactTechnicalNotation * queryWeight;
    }
  }
  return score;
}

function normalizedPhrase(input: string): string {
  return normalizeTechnicalText(input).replace(/[\s（）()·・_./\\:：+-]+/gu, '');
}

function phraseMatchBonus(query: string, name: string, weight: number): number {
  const normalizedName = normalizedPhrase(name);
  if (normalizedName.length < 2) return 0;
  return normalizedPhrase(query).includes(normalizedName) ? weight : 0;
}

function addHierarchyEvidence(
  baseScores: ReadonlyMap<string, number>,
  point: KnowledgePoint,
): number {
  const directChildren = (DIRECT_CHILD_IDS.get(point.id) ?? [])
    .map((childId) => baseScores.get(childId) ?? 0)
    .filter((score) => score > 0)
    .sort((a, b) => b - a);

  if (directChildren.length === 0) return 0;
  // One strong child should bring its teaching parent into view; corroborating
  // sibling matches add a smaller bonus without letting broad chapters swamp
  // a precise register or instruction match.
  const first = directChildren[0] ?? 0;
  const second = directChildren[1] ?? 0;
  return point.level === 2
    ? first * RETRIEVAL_WEIGHTS.level2BestChild
      + second * RETRIEVAL_WEIGHTS.level2SecondChild
    : first * RETRIEVAL_WEIGHTS.level1BestChild
      + second * RETRIEVAL_WEIGHTS.level1SecondChild;
}

export function retrieveContext(
  question: string,
  opts: { maxKnowledge?: number; maxExperiments?: number } = {},
): RetrievedContext {
  const { maxKnowledge = 6, maxExperiments = 2 } = opts;
  const query = buildWeightedQuery(question);
  if (query.tokens.size === 0) return { knowledgePoints: [], experiments: [] };

  const baseScores = new Map(knowledgePoints.map((p) => {
    let score = 0;
    score += scoreText(query.tokens, p.name, RETRIEVAL_WEIGHTS.knowledgeName, KNOWLEDGE_TOKEN_IDF);
    score += scoreText(
      query.tokens,
      p.description ?? '',
      RETRIEVAL_WEIGHTS.knowledgeDescription,
      KNOWLEDGE_TOKEN_IDF,
    );
    score += scoreTechnicalNotation(query.tokens, `${p.name} ${p.description ?? ''}`);
    score += phraseMatchBonus(query.stem, p.name, RETRIEVAL_WEIGHTS.stemNamePhrase);
    score += phraseMatchBonus(
      query.supportingText,
      p.name,
      RETRIEVAL_WEIGHTS.choiceNamePhrase,
    );
    score += phraseMatchBonus(query.aliasText, p.name, RETRIEVAL_WEIGHTS.aliasNamePhrase);
    return [p.id, score] as const;
  }));

  const kpScored = knowledgePoints
    .map((p) => {
      const score = (baseScores.get(p.id) ?? 0) + addHierarchyEvidence(baseScores, p);
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => (
      b.score - a.score
      || b.p.level - a.p.level
      || a.p.id.localeCompare(b.p.id, 'en', { numeric: true })
    ));
  const retrievedKnowledgePoints = kpScored.slice(0, maxKnowledge).map(({ p }) => p);

  const expScored = (maxExperiments > 0 && hasExplicitExperimentIntent(question) ? experiments : [])
    .map((e) => {
      let score = 0;
      score += scoreText(query.tokens, e.title, 4);
      score += scoreText(query.tokens, e.description ?? '', 1);
      score += scoreText(query.tokens, e.knowledgePoints.join(' '), 2);
      score += scoreText(query.tokens, e.objectives.join(' '), 1);
      return { e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExperiments)
    .map((s) => s.e);

  return { knowledgePoints: retrievedKnowledgePoints, experiments: expScored };
}

export function formatContextForPrompt(ctx: RetrievedContext): string {
  if (ctx.knowledgePoints.length === 0 && ctx.experiments.length === 0) return '';
  const lines: string[] = [
    '## 课程知识库检索结果（请优先依据这些事实回答；引用时用 [#id] 标注节点编号）',
  ];
  if (ctx.knowledgePoints.length > 0) {
    lines.push('', '### 相关知识点');
    for (const p of ctx.knowledgePoints) {
      lines.push(`- [#${p.id} L${p.level} CH${p.chapter}] ${p.name}：${p.description ?? ''}`);
    }
  }
  if (ctx.experiments.length > 0) {
    lines.push('', '### 相关实验');
    for (const e of ctx.experiments) {
      lines.push(`- [${e.id}] ${e.title}（${e.duration}分钟，${e.difficulty}）`);
      if (e.objectives.length > 0) {
        lines.push(`  目标：${e.objectives.slice(0, 3).join('；')}`);
      }
      if (e.knowledgePoints.length > 0) {
        lines.push(`  涉及知识点：${e.knowledgePoints.slice(0, 4).join('、')}`);
      }
    }
  }
  return lines.join('\n');
}

const CHAPTER_TITLES: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const p of knowledgePoints) {
    if (p.level === 1 && !m[p.chapter]) m[p.chapter] = `第 ${p.chapter} 章：${p.name}`;
  }
  return m;
})();

// Map retrieved knowledge points back to the legacy
// `relevantChapters: { chapter: string; title: string }[]` response shape.
// Preserves order of first appearance, dedupes.
export function chaptersFromContext(ctx: RetrievedContext): { chapter: string; title: string }[] {
  const seen = new Set<number>();
  const out: { chapter: string; title: string }[] = [];
  for (const p of ctx.knowledgePoints) {
    if (seen.has(p.chapter)) continue;
    seen.add(p.chapter);
    out.push({ chapter: String(p.chapter), title: CHAPTER_TITLES[p.chapter] || `第 ${p.chapter} 章` });
  }
  return out;
}
