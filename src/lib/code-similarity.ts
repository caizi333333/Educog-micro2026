// 汇编代码相似度检测：指令序列 n-gram shingle + Jaccard。
// 用于实验提交时与同实验他人代码互比，标记高度疑似抄袭（阈值默认 0.8）。
// 确定性算法，不涉及外部模型调用，成本为零。

const LABEL_DEF = /^([A-Z_$][\w$]*):/;
// 直接寻址/转移类指令的目标操作数位置会出现用户自定义标号
const ADDR_MNEMONICS = new Set([
  'SJMP', 'AJMP', 'LJMP', 'ACALL', 'LCALL',
  'JB', 'JNB', 'JBC', 'JZ', 'JNZ', 'JC', 'JNC',
  'DJNZ', 'CJNE', 'JMP',
]);
// 8051 保留字：寄存器/SFR/立即数/间接寻址——这些不是用户标号
const RESERVED = new Set([
  'A', 'B', 'AB', 'C', 'CY', 'DPTR', 'ACC', 'PSW', 'SP', 'DPH', 'DPL', 'PCON',
  'IE', 'IP', 'SCON', 'SBUF', 'TMOD', 'TCON', 'TH0', 'TL0', 'TH1', 'TL1',
  'P0', 'P1', 'P2', 'P3', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7',
  '@R0', '@R1', '@A+DPTR', '@A+PC', '@DPTR',
]);
const IDENT = /^[A-Z_$][\w$]*$/;

function looksLikeLabelOperand(op: string, labels: Set<string>): boolean {
  if (labels.has(op)) return true;
  if (!IDENT.test(op) || RESERVED.has(op)) return false;
  if (op.endsWith('H') && /^[0-9A-F]+H$/.test(op)) return false; // 十六进制立即数/地址
  if (/^\d+$/.test(op)) return false;
  return true;
}

/** 归一化一行汇编：去注释、压空白、大写、操作数去多余空格；空行/纯标签/伪指令可保留(它们也是结构特征) */
export function normalizeAsm(code: string): string[] {
  const cleaned = code
    .split('\n')
    .map((line) => {
      // 去掉 ; 注释与 // 注释（防掉字符串字面量场景在汇编中几乎不出现）
      const noComment = line.replace(/;.*$/, '').replace(/\/\/.*$/, '');
      return noComment.trim().toUpperCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',');
    })
    .filter((line) => line.length > 0);

  // 第一遍收集用户自定义标号名，第二遍统一替换为占位符——
  // 让"换个标签名重命名"式抄袭仍被命中（结构指纹而非标识符指纹）。
  const labels = new Set<string>();
  for (const line of cleaned) {
    const m = LABEL_DEF.exec(line);
    if (m) labels.add(m[1]);
  }
  if (labels.size === 0) return cleaned;

  return cleaned.map((line) => {
    let out = line.replace(LABEL_DEF, 'LBL:');
    const spaceIdx = out.indexOf(' ');
    if (spaceIdx === -1) return out;
    const mnemonic = out.slice(0, spaceIdx);
    if (!ADDR_MNEMONICS.has(mnemonic)) return out;
    const operands = out
      .slice(spaceIdx + 1)
      .split(',')
      .map((op) => (looksLikeLabelOperand(op, labels) ? 'LBL' : op));
    return `${mnemonic} ${operands.join(',')}`;
  });
}

/** 指令序列 n-gram shingle 集合 */
export function shingleSet(lines: string[], n = 5): Set<string> {
  const set = new Set<string>();
  if (lines.length < n) {
    if (lines.length > 0) set.add(lines.join('⏎'));
    return set;
  }
  for (let i = 0; i <= lines.length - n; i++) {
    set.add(lines.slice(i, i + n).join('⏎'));
  }
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface SimilarityHit {
  key: string; // 对方标识（调用方给什么就是什么，如用户 id，不向学生展示明文也可由调用方脱敏）
  similarity: number;
}

export interface SimilarityReport {
  maxSimilarity: number;
  checkedCount: number;
  hits: SimilarityHit[]; // 按相似度降序，最多保留 top5
  flagged: boolean;
  checkedAt: string;
}

export const SIMILARITY_FLAG_THRESHOLD = 0.8;

/**
 * 与一批他人代码互比，返回最高相似度与命中列表。
 * minLines 以下视为代码太短不判（避免空模板互相误报）。
 */
export function compareAgainst(
  code: string,
  others: { key: string; code: string }[],
  opts: { ngram?: number; threshold?: number; minLines?: number; topK?: number } = {},
): SimilarityReport {
  const { ngram = 5, threshold = SIMILARITY_FLAG_THRESHOLD, minLines = 8, topK = 5 } = opts;
  const myLines = normalizeAsm(code);
  const base = {
    checkedCount: 0,
    checkedAt: new Date().toISOString(),
  };
  if (myLines.length < minLines) {
    return { ...base, maxSimilarity: 0, hits: [], flagged: false };
  }
  const mine = shingleSet(myLines, ngram);
  const hits: SimilarityHit[] = [];
  let checked = 0;
  for (const other of others) {
    if (!other.code || other.code === code) continue;
    const theirLines = normalizeAsm(other.code);
    if (theirLines.length < minLines) continue;
    checked++;
    const sim = jaccard(mine, shingleSet(theirLines, ngram));
    if (sim >= 0.3) hits.push({ key: other.key, similarity: Math.round(sim * 1000) / 1000 });
  }
  hits.sort((x, y) => y.similarity - x.similarity);
  const top = hits.slice(0, topK);
  return {
    ...base,
    checkedCount: checked,
    maxSimilarity: top[0]?.similarity ?? 0,
    hits: top,
    flagged: top.length > 0 && top[0].similarity >= threshold,
  };
}
