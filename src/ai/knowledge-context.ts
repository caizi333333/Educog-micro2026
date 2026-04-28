// Lightweight in-memory retrieval over the canonical course content so the
// AI tutor can answer with grounded references instead of hallucinating.
// No external embedding model / vector store dependency — pure keyword
// scoring over knowledgePoints + experiment-config. Good enough for ~270
// nodes + 13 experiments, runs server-side per request in <5ms.

import { knowledgePoints, type KnowledgePoint } from '@/lib/knowledge-points';
import { experiments, type ExperimentConfig } from '@/lib/experiment-config';

export type RetrievedContext = {
  knowledgePoints: KnowledgePoint[];
  experiments: ExperimentConfig[];
};

const HAN_RANGE = /\p{Script=Han}/u;

function tokenize(input: string): string[] {
  if (!input) return [];
  const lower = input.toLowerCase();
  // English / digit tokens of length >= 2.
  const englishTokens = lower.match(/[a-z0-9]{2,}/g) ?? [];
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
  return Array.from(new Set([...englishTokens, ...charBigrams]));
}

function scoreText(tokens: string[], text: string, weight: number): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (lower.includes(t)) {
      // longer tokens are more discriminative
      score += weight * (t.length >= 4 ? 3 : t.length >= 3 ? 2 : 1);
    }
  }
  return score;
}

export function retrieveContext(
  question: string,
  opts: { maxKnowledge?: number; maxExperiments?: number } = {},
): RetrievedContext {
  const { maxKnowledge = 6, maxExperiments = 2 } = opts;
  const tokens = tokenize(question);
  if (tokens.length === 0) return { knowledgePoints: [], experiments: [] };

  const kpScored = knowledgePoints
    .map((p) => {
      let score = 0;
      score += scoreText(tokens, p.name, 4); // name matches weigh most
      score += scoreText(tokens, p.description ?? '', 1);
      // chapter / level mild boost
      if (p.level === 1) score *= 1.3;
      else if (p.level === 2) score *= 1.1;
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxKnowledge)
    .map((s) => s.p);

  const expScored = experiments
    .map((e) => {
      let score = 0;
      score += scoreText(tokens, e.title, 4);
      score += scoreText(tokens, e.description ?? '', 1);
      score += scoreText(tokens, e.knowledgePoints.join(' '), 2);
      score += scoreText(tokens, e.objectives.join(' '), 1);
      return { e, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxExperiments)
    .map((s) => s.e);

  return { knowledgePoints: kpScored, experiments: expScored };
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
