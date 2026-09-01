/**
 * 芯智育才 AI 能力基准。
 *
 * 输入：版本化课程知识点、实验配置、固定生成的 50 个检索问题、
 *       40 个错误代码样例与 8 个正确对照样例。
 * 输出：JSON，包含样本量、口径、Recall@3、MRR、诊断 Precision/Recall/F1、
 *       行号定位准确率和延迟分位数。生成式评测仅在显式传入
 *       --with-deepseek 且已有密钥可用时执行。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { knowledgePoints } from '@/lib/knowledge-points';
import { experiments } from '@/lib/experiment-config';
import { quizQuestions, toPublicQuestion, type PublicQuestion } from '@/lib/quiz-data';
import { formatContextForPrompt, retrieveContext } from '@/ai/knowledge-context';
import { DeepSeekClient } from '@/ai/deepseek-client';
import { SimpleAiClient } from '@/ai/simple-ai-client';
import { looksLikeCCode, runStaticCheck, type DiagnosticResult } from '@/components/ai-assistant/ErrorDiagnostic';

type DiagnosticCategory =
  | 'C_INPUT'
  | 'UNKNOWN_MNEMONIC'
  | 'OPERAND_COUNT'
  | 'UNDEFINED_LABEL'
  | 'DUPLICATE_LABEL'
  | 'INVALID_ORG'
  | 'EMPTY_DATA'
  | 'MISSING_END';

type DiagnosticCase = {
  id: string;
  category: DiagnosticCategory | 'VALID';
  code: string;
  expectedLine?: number;
};

const argv = process.argv.slice(2);
const withDeepSeek = argv.includes('--with-deepseek');
const outIndex = argv.indexOf('--out');
const outputPath = resolve(outIndex >= 0 && argv[outIndex + 1]
  ? argv[outIndex + 1]!
  : 'public/ai-benchmark.json');

type RetrievalCase = {
  id: string;
  sourceQuestionId: number;
  chapter: number;
  question: string;
  expectedId: string;
  expectedName: string;
  requiredFacts: string[];
  prohibitedErrors: string[];
};

function buildRetrievalQuery(question: PublicQuestion): string {
  const supportingText = question.type === 'multiple-choice'
    ? `\n候选答案：${question.options.join('；')}`
    : `\n待补全代码：${question.code}`;
  return `${question.questionText}${supportingText}`;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return Number(sorted[index]!.toFixed(2));
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;
}

function safeCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'UNKNOWN';
  }
}

function safeWorkspaceState(): 'CLEAN' | 'DIRTY' | 'UNKNOWN' {
  try {
    return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() ? 'DIRTY' : 'CLEAN';
  } catch {
    return 'UNKNOWN';
  }
}

const benchmarkSourcePaths = [
  'scripts/ai-benchmark.ts',
  'src/ai/deepseek-client.ts',
  'src/ai/knowledge-context.ts',
  'src/ai/simple-ai-client.ts',
  'src/components/ai-assistant/ErrorDiagnostic.tsx',
  'src/lib/experiment-config.ts',
  'src/lib/knowledge-points.ts',
  'src/lib/quiz-data.ts',
] as const;

async function buildSourceManifest(): Promise<{
  algorithm: 'sha256';
  digest: string;
  files: Array<{ path: string; sha256: string }>;
}> {
  const files = await Promise.all(benchmarkSourcePaths.map(async (path) => {
    const contents = await readFile(resolve(path));
    return {
      path,
      sha256: createHash('sha256').update(contents).digest('hex'),
    };
  }));
  const digest = createHash('sha256')
    .update(files.map(({ path, sha256 }) => `${path}\0${sha256}`).join('\n'))
    .digest('hex');

  return { algorithm: 'sha256', digest, files };
}

function buildRetrievalCases(): RetrievalCase[] {
  const pointById = new Map(knowledgePoints.map((point) => [point.id, point]));
  const result: RetrievalCase[] = [];

  for (let chapter = 1; chapter <= 10; chapter += 1) {
    const candidates = quizQuestions.filter((question) => (
      question.chapter === chapter && pointById.has(question.ka)
    ));
    const selected: typeof candidates = [];
    const selectedQuestionIds = new Set<number>();
    const selectedKnowledgeIds = new Set<string>();

    // 先覆盖不同知识点，再用同章正式题补足到5题。
    for (const question of candidates) {
      if (selectedKnowledgeIds.has(question.ka)) continue;
      selected.push(question);
      selectedQuestionIds.add(question.id);
      selectedKnowledgeIds.add(question.ka);
      if (selected.length === 5) break;
    }
    for (const question of candidates) {
      if (selected.length === 5) break;
      if (selectedQuestionIds.has(question.id)) continue;
      selected.push(question);
      selectedQuestionIds.add(question.id);
    }
    if (selected.length !== 5) {
      throw new Error(`第${chapter}章可用正式题不足5道；当前为${selected.length}道`);
    }

    for (const question of selected) {
      const point = pointById.get(question.ka)!;
      // Query construction receives the public question shape, from which the
      // answer key has already been removed. `correctAnswer` is retained below
      // only as a post-response evaluator for the optional generative run.
      const retrievalQuery = buildRetrievalQuery(toPublicQuestion(question));
      result.push({
        id: `quiz-${question.id}`,
        sourceQuestionId: question.id,
        chapter,
        question: retrievalQuery,
        expectedId: question.ka,
        expectedName: point.name,
        requiredFacts: [question.correctAnswer],
        prohibitedErrors: ['虚构教学成效', '声称模型已微调', '改变测验判定'],
      });
    }
  }

  return result;
}

const categoryCases: Record<DiagnosticCategory, Array<{ code: string; line: number }>> = {
  C_INPUT: [
    { code: '#include <reg51.h>\nvoid main(void) {}', line: 0 },
    { code: 'void main(){ while(1){} }', line: 0 },
    { code: 'unsigned char value;\nvoid main(void) { value=1; }', line: 0 },
    { code: 'sbit LED = P1^0;\nvoid main(void){}', line: 0 },
    { code: 'int add(int a,int b){ return a+b; }', line: 0 },
  ],
  UNKNOWN_MNEMONIC: [
    { code: 'ORG 0000H\nMVO A,#30H\nEND', line: 2 },
    { code: 'ORG 0000H\nMOVE P1,#0FFH\nEND', line: 2 },
    { code: 'ORG 0000H\nADDD A,R0\nEND', line: 2 },
    { code: 'ORG 0000H\nSEBT P1.0\nEND', line: 2 },
    { code: 'ORG 0000H\nJUMP LOOP\nEND', line: 2 },
  ],
  OPERAND_COUNT: [
    { code: 'ORG 0000H\nMOV A\nEND', line: 2 },
    { code: 'ORG 0000H\nCLR\nEND', line: 2 },
    { code: 'ORG 0000H\nRET A\nEND', line: 2 },
    { code: 'ORG 0000H\nCJNE A,#01H\nEND', line: 2 },
    { code: 'ORG 0000H\nNOP A\nEND', line: 2 },
  ],
  UNDEFINED_LABEL: [
    { code: 'ORG 0000H\nSJMP MISSING\nEND', line: 2 },
    { code: 'ORG 0000H\nLCALL HELPER\nEND', line: 2 },
    { code: 'ORG 0000H\nJZ ZERO\nEND', line: 2 },
    { code: 'ORG 0000H\nJB P1.0,NEXT\nEND', line: 2 },
    { code: 'ORG 0000H\nDJNZ R7,LOOP\nEND', line: 2 },
  ],
  DUPLICATE_LABEL: [
    { code: 'A:\nNOP\nA:\nEND', line: 3 },
    { code: 'LOOP:\nNOP\nLOOP:\nEND', line: 3 },
    { code: 'START:\nNOP\nSTART:\nEND', line: 3 },
    { code: 'WAIT:\nNOP\nWAIT:\nEND', line: 3 },
    { code: 'DONE:\nNOP\nDONE:\nEND', line: 3 },
  ],
  INVALID_ORG: [
    { code: 'ORG XYZ\nNOP\nEND', line: 1 },
    { code: 'ORG\nNOP\nEND', line: 1 },
    { code: 'ORG #30H\nNOP\nEND', line: 1 },
    { code: 'ORG 0xZZ\nNOP\nEND', line: 1 },
    { code: 'ORG @R0\nNOP\nEND', line: 1 },
  ],
  EMPTY_DATA: [
    { code: 'TAB: DB\nEND', line: 1 },
    { code: 'TABLE: DW\nEND', line: 1 },
    { code: 'BUFFER: DS\nEND', line: 1 },
    { code: 'ORG 0100H\nDB\nEND', line: 2 },
    { code: 'ORG 0200H\nDW\nEND', line: 2 },
  ],
  MISSING_END: [
    { code: 'ORG 0000H\nNOP', line: 0 },
    { code: 'ORG 0000H\nMOV A,#30H', line: 0 },
    { code: 'ORG 0000H\nCLR P1.0', line: 0 },
    { code: 'ORG 0000H\nINC R0', line: 0 },
    { code: 'ORG 0000H\nRET', line: 0 },
  ],
};

const validControls = [
  'ORG 0000H\nNOP\nEND',
  'ORG 0000H\nMOV A,#30H\nEND',
  'ORG 0000H\nLOOP: INC R0\nSJMP LOOP\nEND',
  'ORG 0000H\nCLR P1.0\nSETB P1.0\nEND',
  'ORG 0000H\nLCALL SUB1\nSJMP DONE\nSUB1: RET\nDONE: NOP\nEND',
  'ORG 0100H\nTAB: DB 3FH,06H\nEND',
  'ORG 0000H\nMOV R7,#10\nWAIT: DJNZ R7,WAIT\nEND',
  'VALUE EQU 30H\nORG 0000H\nMOV A,VALUE\nEND',
];

const diagnosticCases: DiagnosticCase[] = [
  ...Object.entries(categoryCases).flatMap(([category, cases]) => cases.map((item, index) => ({
    id: `${category.toLowerCase()}-${index + 1}`,
    category: category as DiagnosticCategory,
    code: item.code,
    expectedLine: item.line,
  }))),
  ...validControls.map((code, index) => ({ id: `valid-${index + 1}`, category: 'VALID' as const, code })),
];

function diagnosticCategory(result: DiagnosticResult): DiagnosticCategory | null {
  const message = result.message;
  if (/未知助记符/.test(message)) return 'UNKNOWN_MNEMONIC';
  if (/操作数个数不对/.test(message)) return 'OPERAND_COUNT';
  if (/标号 .+ 未定义/.test(message)) return 'UNDEFINED_LABEL';
  if (/标号 .+ 重复定义/.test(message)) return 'DUPLICATE_LABEL';
  if (/ORG 伪指令地址无效/.test(message)) return 'INVALID_ORG';
  if (/(DB|DW|DS) 伪指令缺少数据/.test(message)) return 'EMPTY_DATA';
  if (/缺少 END/.test(message)) return 'MISSING_END';
  return null;
}

async function evaluateGenerative(retrievalCases: RetrievalCase[]) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim() ?? '';
  if (!withDeepSeek) {
    return { status: 'NOT_RUN', reason: '未传入 --with-deepseek；按计划不消耗外部额度。' };
  }
  if (!apiKey) return { status: 'NOT_AVAILABLE', reason: 'DEEPSEEK_API_KEY 未配置。' };

  const client = new DeepSeekClient(apiKey);
  const latencies: number[] = [];
  let requiredFactPass = 0;
  let groundedCitationPass = 0;
  let forbiddenClaimCount = 0;
  let model = 'deepseek-chat';
  const forbidden = /(?:保证(?:完全|百分之百)|真实教学成效已|显著提升了|模型已经微调)/;

  for (const item of retrievalCases) {
    const context = retrieveContext(item.question, { maxKnowledge: 6, maxExperiments: 2 });
    const started = performance.now();
    let response;
    try {
      response = await client.chat([
        {
          role: 'system',
          content: '你是8051课程助教。仅依据给定课程内容回答，引用时使用 [#id]；不能编造教学成效、实测数据或模型训练情况。',
        },
        { role: 'user', content: `${formatContextForPrompt(context)}\n\n问题：${item.question}` },
      ]);
    } catch (error) {
      const rawReason = error instanceof Error ? error.message : '';
      const publicReason = /402|insufficient balance/i.test(rawReason)
        ? '现有生成服务额度不足；未充值，生成式指标不发布。'
        : /401|unauthorized|authentication/i.test(rawReason)
          ? '现有生成服务认证不可用；生成式指标不发布。'
          : '生成服务请求未完成；生成式指标不发布，详见受控运行日志。';
      return {
        status: 'NOT_AVAILABLE',
        reason: publicReason,
        completedCases: latencies.length,
      };
    }
    latencies.push(performance.now() - started);
    model = response.model || model;
    const answer = response.choices[0]?.message?.content ?? '';
    if (item.requiredFacts.every((fact) => answer.includes(fact))) requiredFactPass += 1;
    if (answer.includes(`[#${item.expectedId}]`)) groundedCitationPass += 1;
    if (forbidden.test(answer)) forbiddenClaimCount += 1;
  }
  return {
    status: 'COMPLETED',
    model,
    sampleSize: retrievalCases.length,
    automaticRequiredFactPassRate: percentage(requiredFactPass, retrievalCases.length),
    groundedCitationRate: percentage(groundedCitationPass, retrievalCases.length),
    forbiddenClaimRate: percentage(forbiddenClaimCount, retrievalCases.length),
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    note: '自动规则只能核对指定术语、节点引用和禁止表述，不能替代人工事实审阅。',
  };
}

function evaluateLocalFallback(retrievalCases: RetrievalCase[]) {
  const client = new SimpleAiClient();
  const latencies: number[] = [];
  let triggerSuccess = 0;
  let effectiveCoverage = 0;
  let boundaryPass = 0;
  const caseResults: Array<{
    id: string;
    returnedAnswer: boolean;
    targetNodeCited: boolean;
    targetChapterAligned: boolean;
    boundaryPassed: boolean;
  }> = [];
  const forbidden = /(?:真实教学成效已|显著提升了|模型已经微调|直接修改(?:测验得分|实验完成状态|教师评价))/;

  for (const item of retrievalCases) {
    const context = retrieveContext(item.question, { maxKnowledge: 3, maxExperiments: 1 });
    const started = performance.now();
    const response = client.getLocalFallbackResponse(item.question, formatContextForPrompt(context));
    latencies.push(performance.now() - started);

    const returnedAnswer = response.answer.trim().length > 0;
    const targetNodeCited = response.answer.includes(`[#${item.expectedId}]`);
    const targetChapterAligned = response.relevantChapters.some(
      (chapter) => chapter.chapter === String(item.chapter),
    );
    const boundaryPassed = !forbidden.test(response.answer);
    if (returnedAnswer) triggerSuccess += 1;
    if (returnedAnswer && (targetNodeCited || targetChapterAligned)) effectiveCoverage += 1;
    if (boundaryPassed) boundaryPass += 1;
    caseResults.push({
      id: item.id,
      returnedAnswer,
      targetNodeCited,
      targetChapterAligned,
      boundaryPassed,
    });
  }

  return {
    sampleSize: retrievalCases.length,
    triggerCondition: '固定禁用外部生成调用，直接执行生产环境同一套本地回退函数。',
    triggerSuccessRate: percentage(triggerSuccess, retrievalCases.length),
    effectiveAnswerCoverageRate: percentage(effectiveCoverage, retrievalCases.length),
    boundaryPassRate: percentage(boundaryPass, retrievalCases.length),
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
    caseResults,
    note: '有效回答覆盖指非空回答同时满足目标知识点编号命中或目标章节一致；不等同于开放问答事实正确率。',
  };
}

async function main() {
  const sourceManifest = await buildSourceManifest();
  const retrievalCases = buildRetrievalCases();
  if (retrievalCases.length !== 50) {
    throw new Error(`检索基准必须覆盖10章、每章5题；当前为 ${retrievalCases.length} 题`);
  }

  const retrievalLatencies: number[] = [];
  let recallAt3 = 0;
  let reciprocalRankSum = 0;
  let exactTop1 = 0;
  let knowledgePointHits = 0;
  const retrievalCaseResults: Array<{
    id: string;
    expectedKnowledgePointId: string;
    rank: number | null;
    returnedKnowledgePointIds: string[];
  }> = [];
  for (const item of retrievalCases) {
    const started = performance.now();
    const result = retrieveContext(item.question, { maxKnowledge: 6, maxExperiments: 2 });
    retrievalLatencies.push(performance.now() - started);
    const rank = result.knowledgePoints.findIndex((point) => point.id === item.expectedId) + 1;
    retrievalCaseResults.push({
      id: item.id,
      expectedKnowledgePointId: item.expectedId,
      rank: rank > 0 ? rank : null,
      returnedKnowledgePointIds: result.knowledgePoints.map((point) => point.id),
    });
    if (rank === 1) exactTop1 += 1;
    if (rank > 0 && rank <= 3) recallAt3 += 1;
    if (rank > 0) {
      reciprocalRankSum += 1 / rank;
      knowledgePointHits += 1;
    }
  }

  let truePositive = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let located = 0;
  let falsePositiveControls = 0;
  const coveredCategories = new Set<DiagnosticCategory>();
  const diagnosticLatencies: number[] = [];
  for (const item of diagnosticCases) {
    const started = performance.now();
    const isC = looksLikeCCode(item.code);
    const diagnostics = isC ? [] : runStaticCheck(item.code);
    diagnosticLatencies.push(performance.now() - started);
    const predictions = new Set<DiagnosticCategory>();
    if (isC) predictions.add('C_INPUT');
    for (const diagnostic of diagnostics) {
      const category = diagnosticCategory(diagnostic);
      if (category) predictions.add(category);
    }

    if (item.category === 'VALID') {
      if (predictions.size > 0) {
        falsePositive += predictions.size;
        falsePositiveControls += 1;
      }
      continue;
    }

    if (predictions.has(item.category)) {
      truePositive += 1;
      coveredCategories.add(item.category);
      if (item.category === 'C_INPUT' && item.expectedLine === 0) located += 1;
      else if (diagnostics.some((diagnostic) => diagnosticCategory(diagnostic) === item.category && diagnostic.line === item.expectedLine)) located += 1;
    } else {
      falseNegative += 1;
    }
    for (const prediction of predictions) {
      if (prediction !== item.category) falsePositive += 1;
    }
  }

  const precision = truePositive / Math.max(1, truePositive + falsePositive);
  const recall = truePositive / Math.max(1, truePositive + falseNegative);
  const f1 = (2 * precision * recall) / Math.max(Number.EPSILON, precision + recall);
  const errorCaseCount = diagnosticCases.filter((item) => item.category !== 'VALID').length;

  const report = {
    schemaVersion: 5,
    generatedAt: new Date().toISOString(),
    codeVersion: {
      baseCommit: safeCommit(),
      workspaceState: safeWorkspaceState(),
      runtime: process.version,
      sourceManifest,
      note: 'baseCommit标识基线提交；sourceManifest.digest精确锁定本次评测使用的生产代码与数据文件。',
    },
    deterministic: true,
    formulas: {
      recallAt3: '目标知识点出现在前3个检索结果的题数 / 全部检索题数',
      meanReciprocalRank: '各题首个正确结果排名倒数的平均值',
      knowledgePointHitRate: '目标知识点出现在返回知识点集合中的题数 / 全部检索题数',
      precision: 'TP / (TP + FP)',
      recall: 'TP / (TP + FN)',
      f1: '2 × Precision × Recall / (Precision + Recall)',
      lineLocalizationAccuracy: '错误类型与预期行号均命中的样例数 / 错误样例数',
      fallbackTriggerSuccessRate: '本地回退返回非空回答的样例数 / 全部固定检索题数',
      fallbackEffectiveAnswerCoverageRate: '非空回答且目标知识点编号命中或目标章节一致的样例数 / 全部固定检索题数',
    },
    corpus: {
      knowledgePoints: knowledgePoints.length,
      experiments: experiments.length,
      quizQuestions: quizQuestions.length,
      note: '知识内容为版本化课程数据；未进行模型微调。',
    },
    retrieval: {
      sampleSize: retrievalCases.length,
      coverage: '10章×5道正式题库题；每章优先覆盖不同知识点。',
      queryDesign: '查询只由去除correctAnswer字段后的正式题干、未标注正误的全部选项或待补全代码构成；ka与答案仅在检索结果产生后用于评分，不传入retrieveContext或生成提示。',
      sourceQuestionIds: retrievalCases.map((item) => item.sourceQuestionId),
      caseManifest: retrievalCases.map((item) => ({
        id: item.id,
        chapter: item.chapter,
        sourceQuestionId: item.sourceQuestionId,
        expectedKnowledgePointId: item.expectedId,
        requiredFactCount: item.requiredFacts.length,
        prohibitedErrors: item.prohibitedErrors,
      })),
      recallAt3: percentage(recallAt3, retrievalCases.length),
      meanReciprocalRank: Number((reciprocalRankSum / retrievalCases.length).toFixed(4)),
      exactTop1Rate: percentage(exactTop1, retrievalCases.length),
      knowledgePointHitRate: percentage(knowledgePointHits, retrievalCases.length),
      caseResults: retrievalCaseResults,
      latencyMs: { p50: percentile(retrievalLatencies, 0.5), p95: percentile(retrievalLatencies, 0.95) },
    },
    staticDiagnostic: {
      sampleSize: diagnosticCases.length,
      errorCases: errorCaseCount,
      validControls: validControls.length,
      categories: Object.keys(categoryCases),
      categoryCoverageRate: percentage(coveredCategories.size, Object.keys(categoryCases).length),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      lineLocalizationAccuracy: percentage(located, errorCaseCount),
      falsePositiveControls,
      latencyMs: { p50: percentile(diagnosticLatencies, 0.5), p95: percentile(diagnosticLatencies, 0.95) },
    },
    localFallback: evaluateLocalFallback(retrievalCases),
    generative: await evaluateGenerative(retrievalCases),
    interpretation: {
      retrieval: '反映固定正式题库问题对目标知识点的检索命中，不等同于开放问答正确率。',
      staticDiagnostic: '结果来自确定性规则检查，不归因于DeepSeek。',
      localFallback: '强制禁用外部生成后执行生产同源回退；有效覆盖只表示节点或章节对齐，不等同于开放问答正确率。',
      generative: '只有状态为COMPLETED时才允许发布对应数值。',
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
