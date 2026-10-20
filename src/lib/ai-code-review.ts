// AI 代码评价的纯逻辑：rubric 提示词、结果解析、评分口径。
// 评价结果作为"AI 辅助评价"入库（feedback/results.aiReview），与教师评价并存、互不覆盖。

export interface AiReviewDimension {
  name: string;
  score: number; // 0-100
  comment: string;
}

export interface AiCodeReview {
  dimensions: AiReviewDimension[];
  overall: number; // 0-100
  summary: string;
  suggestions: string[];
  reviewedAt: string;
}

export const REVIEW_DIMENSIONS = [
  '协议时序正确性',
  '容错与健壮性',
  '功能覆盖度',
  '结构与可读性',
  '工程规范',
] as const;

export const CODE_REVIEW_SYSTEM_PROMPT = `你是"芯智育才"8051单片机课程的 AI 代码评审助教。请按教学 rubric 评审学生提交的汇编实验代码。

评审维度（每项 0-100 分并给一句针对性评语，评语要引用代码中的具体标签/指令/行）：
1. 协议时序正确性：传感器/串口等协议时序是否符合器件规范（如 DS18B20 复位脉宽、DHT11 脉宽解码、串口帧格式）
2. 容错与健壮性：超时保护、校验失败处理、异常传感器读数的防御
3. 功能覆盖度：实验要求的功能点实现了多少（对照实验目标，缺什么说什么）
4. 结构与可读性：标签命名、模块化子程序、注释质量
5. 工程规范：寄存器保护、内存使用规范、中断现场保护

纪律：
- 评语必须基于代码真实内容，禁止编造不存在的代码行；
- 对明显照抄模板未修改的代码，在"功能覆盖度"如实扣分并在建议中说明；
- 用精炼中文，overall 为各维度加权平均（协议0.3/容错0.2/覆盖0.25/结构0.15/规范0.1，四舍五入）。

输出严格 JSON（不要任何额外文字）：
{"dimensions":[{"name":"维度名","score":0-100,"comment":"一句评语"}],"overall":0-100,"summary":"两行内的总体评价","suggestions":["可执行改进建议1","建议2","建议3"]}`;

export function buildReviewUserPrompt(experimentTitle: string, objectives: string[], code: string): string {
  return [
    `【实验】${experimentTitle}`,
    `【实验目标】${objectives.join('；')}`,
    '',
    '【学生提交代码】',
    '```asm',
    code,
    '```',
  ].join('\n');
}

export function parseCodeReview(raw: string): AiCodeReview | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(trimmed) as Partial<AiCodeReview>;
    if (!Array.isArray(parsed.dimensions) || typeof parsed.overall !== 'number') return null;
    const dimensions = parsed.dimensions
      .filter((d): d is AiReviewDimension =>
        typeof d === 'object' && d !== null &&
        typeof (d as AiReviewDimension).name === 'string' &&
        typeof (d as AiReviewDimension).score === 'number' &&
        typeof (d as AiReviewDimension).comment === 'string')
      .map((d) => ({ name: d.name, score: Math.max(0, Math.min(100, Math.round(d.score))), comment: d.comment }))
      .slice(0, 6);
    if (dimensions.length === 0) return null;
    return {
      dimensions,
      overall: Math.max(0, Math.min(100, Math.round(parsed.overall))),
      summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 500) : '',
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 5)
        : [],
      reviewedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
