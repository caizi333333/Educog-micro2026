/**
 * 个性化实验变体任务（AI 出题者）。
 *
 * 设计口径：
 * - 变体任务由模型依据学生的薄弱证据（AI 评价维度低分项/诊断求助记录/静态诊断错误类型）
 *   定向生成，只指向薄弱环节，不复述已完成内容；
 * - 模型不可用时回退到确定性变体池（按薄弱标签匹配），变体本身不虚构；
 * - 生成结果仅为学习建议，不参与实验判定与赋分；
 * - 每人生成的变体不同，客观上抬高互抄成本（防抄袭的间接收益）。
 */

export interface VariantTask {
  title: string;
  scenario: string;
  requirements: string[];
  selfChecks: string[];
  rationale: string;
  targets: string[];
  source: 'generated' | 'fallback';
}

export interface WeaknessEvidence {
  reviewDimensions?: Array<{ name: string; score: number }>;
  diagnosisCount?: number;
  staticErrorKinds?: string[];
  hasSubmission?: boolean;
}

/** 确定性变体池：每个变体绑定它要考察的薄弱标签，供回退按标签匹配。 */
const FALLBACK_VARIANTS: Array<Omit<VariantTask, 'source'> & { tags: string[] }> = [
  {
    tags: ['协议时序', '容错', 'DHT11'],
    title: '容错增强变体：传感器偶发失效',
    scenario: '大棚现场 DHT11 受水汽影响偶发返回校验失败帧，监控终端不允许把坏数据当真实湿度上报。',
    requirements: [
      '在采集流程中校验 DHT11 校验和，失败帧丢弃并计数',
      '连续 3 次读取失败时置传感器故障标志并在遥测帧中体现',
      '正常读取恢复后自动清除故障标志',
    ],
    selfChecks: [
      '人为构造校验和错误的返回值，程序应丢弃而非上报',
      '故障标志置位期间遥测帧仍按周期发出',
      '恢复后遥测帧 humi 字段回到正常范围',
    ],
    rationale: '巩固单总线协议的容错意识——真实工程里传感器失效是常态而非异常。',
    targets: ['DHT11 读取容错', '异常数据处理', '工程鲁棒性'],
  },
  {
    tags: ['协议时序', 'DS18B20'],
    title: '时序精度变体：边界时序容差',
    scenario: '更换一批容差偏大的 DS18B20 器件，其存在脉冲宽度接近协议下限。',
    requirements: [
      '检查 OW_RESET 后存在脉冲检测的采样窗口设计',
      '说明采样点选在脉冲中段的依据',
      '在注释中标注关键延时参数（µs）',
    ],
    selfChecks: [
      '指出复位低脉冲、等待、采样三段延时取值',
      '解释采样过早/过晚各自会导致什么现象',
    ],
    rationale: '把"能跑"的时序升级为"知道为什么能跑"的时序理解。',
    targets: ['1-Wire 复位时序', '时序容差设计'],
  },
  {
    tags: ['覆盖度', '报警'],
    title: '回差控制变体：报警防抖',
    scenario: '温度在阈值 30°C 附近波动导致蜂鸣器频繁通断，现场要求引入回差区间。',
    requirements: [
      '报警置位阈值与解除阈值分离（如 ≥30°C 报警、≤28°C 解除）',
      '用状态标志而非逐次比较驱动蜂鸣器',
      '遥测帧中体现当前报警状态',
    ],
    selfChecks: [
      '温度序列 29→30→29→31→27 的报警输出序列应为 0→1→1→1→0',
      '报警解除不依赖单点采样，而是越过回差下限',
    ],
    rationale: '回差（迟滞）是工控领域抗噪的基本功，也是虚拟→实体迁移时最容易暴露的缺陷。',
    targets: ['阈值报警设计', '控制回差', '状态机思维'],
  },
  {
    tags: ['结构', '规范'],
    title: '工程化变体：遥测帧版本化',
    scenario: '上位机平台升级要求遥测帧带版本与序号字段，便于兼容新旧终端。',
    requirements: [
      '帧格式扩展为 {"ver":1,"seq":n,"temp":x,"humi":y,"alarm":z}',
      'seq 每帧自增、溢出回卷，便于上位机检测丢帧',
      '保留对旧字段的解析兼容说明（注释写明迁移期口径）',
    ],
    selfChecks: [
      '连续帧 seq 单调递增',
      '上位机按 seq 缺口可识别丢帧',
    ],
    rationale: '真实产品迭代中"协议兼容"比"协议正确"更难，提前建立版本意识。',
    targets: ['UART 协议设计', '版本兼容', '工程规范'],
  },
  {
    tags: ['中断', '定时器'],
    title: '调度变体：采集与报警解耦',
    scenario: '加入第二任务（如通风控制）后，单循环轮询导致采集周期抖动超标。',
    requirements: [
      '采集节拍由 T0 中断驱动，报警判定留在主循环',
      '中断内只做置标志，不做耗时操作',
      '说明中断与主循环共享变量的保护方式',
    ],
    selfChecks: [
      '主循环插入 100ms 阻塞任务后，采集周期仍保持 2s±5%',
      '中断服务程序执行时间远小于中断周期',
    ],
    rationale: '中断—主循环解耦是嵌入式实时性的第一道坎。',
    targets: ['中断驱动设计', '实时性保障'],
  },
  {
    tags: ['默认'],
    title: '综合变体：多传感器加权融合',
    scenario: 'DS18B20 与 DHT11 温度读数存在系统偏差，要求上位机看到融合后的温度。',
    requirements: [
      '两路温度读数按固定权重融合（如 0.7×DS18B20+0.3×DHT11）',
      '任一路读取失败时退化为单源并置标志',
      '遥测帧同时上报两路原始值与融合值',
    ],
    selfChecks: [
      '一路失效时融合值等于另一路且标志置位',
      '两路正常时融合值处于两者之间',
    ],
    rationale: '传感器融合是物联网终端进阶技能，顺带训练"失效降级"思维。',
    targets: ['多传感器融合', '降级设计'],
  },
];

const DIMENSION_TAG_MAP: Array<{ match: RegExp; tags: string[] }> = [
  { match: /协议|时序/i, tags: ['协议时序'] },
  { match: /容错/i, tags: ['容错'] },
  { match: /覆盖/i, tags: ['覆盖度'] },
  { match: /结构/i, tags: ['结构'] },
  { match: /规范/i, tags: ['规范'] },
];

/** 模型不可用时的确定性回退：按薄弱标签选最匹配变体，无证据时给综合变体。 */
export function selectFallbackVariant(evidence: WeaknessEvidence): VariantTask {
  const wantTags = new Set<string>();
  for (const d of evidence.reviewDimensions ?? []) {
    if (d.score < 70) {
      for (const m of DIMENSION_TAG_MAP) {
        if (m.match.test(d.name)) m.tags.forEach((t) => wantTags.add(t));
      }
    }
  }
  let best = FALLBACK_VARIANTS[FALLBACK_VARIANTS.length - 1];
  let bestScore = -1;
  for (const v of FALLBACK_VARIANTS) {
    const score = v.tags.filter((t) => wantTags.has(t)).length;
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return { ...best, source: 'fallback' };
}

export const VARIANT_TASK_SYSTEM_PROMPT = `你是"芯智育才"8051单片机课程的实验出题助教。根据学生已完成实验的薄弱证据，生成一个进阶"变体任务"——不是重复原实验，而是在原实验基础上针对薄弱点加一个真实工程约束。

要求：
- 变体必须落在原实验的技术域内（8051汇编、单总线传感器、UART遥测、阈值报警），不引入新硬件；
- 变体描述一个真实工程场景（器件容差、干扰、协议升级、实时性冲突等），不是教科书习题腔；
- 要求可验证：每条 selfCheck 都应能由学生自己在仿真中观察验证；
- 只出题、不判定，不给参考答案；
- 用精炼中文，严格输出 JSON：
{"title":"变体标题","scenario":"一两句真实场景","requirements":["要求1","要求2","要求3"],"selfChecks":["自查点1","自查点2","自查点3"],"rationale":"一句话说明为何针对该薄弱点出题","targets":["考察点1","考察点2"]}`;

export function buildVariantUserPrompt(experimentTitle: string, evidence: WeaknessEvidence): string {
  const parts: string[] = [`实验项目：${experimentTitle}`];
  if (evidence.hasSubmission) parts.push('学生已提交基线代码（可运行）。');
  if (evidence.reviewDimensions?.length) {
    const weak = evidence.reviewDimensions.filter((d) => d.score < 70);
    const strong = evidence.reviewDimensions.filter((d) => d.score >= 70);
    if (weak.length) parts.push(`AI 评价薄弱维度（<70 分）：${weak.map((d) => `${d.name} ${d.score}`).join('、')}`);
    if (strong.length) parts.push(`已达标维度：${strong.map((d) => d.name).join('、')}（变体不必再考察）`);
  }
  if (evidence.diagnosisCount) parts.push(`实验中使用 AI 诊断求助 ${evidence.diagnosisCount} 次（提示自主排障能力待加强）。`);
  if (evidence.staticErrorKinds?.length) parts.push(`静态诊断曾报：${evidence.staticErrorKinds.join('、')}`);
  if (!evidence.reviewDimensions?.length && !evidence.staticErrorKinds?.length) {
    parts.push('暂无评价数据，请出一个综合性进阶变体（覆盖容错与工程化方向）。');
  }
  parts.push('请生成一个变体任务（JSON）。');
  return parts.join('\n');
}

/** 解析模型输出：容忍 ```json 围栏与首尾杂讯；字段缺失即视为失败走回退。 */
export function parseVariantTask(raw: string): VariantTask | null {
  const text = raw.replace(/```(?:json)?/g, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : [];
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const scenario = typeof parsed.scenario === 'string' ? parsed.scenario.trim() : '';
  const requirements = strArr(parsed.requirements);
  const selfChecks = strArr(parsed.selfChecks);
  if (!title || requirements.length === 0 || selfChecks.length === 0) return null;
  return {
    title: title.slice(0, 60),
    scenario: scenario.slice(0, 300),
    requirements: requirements.slice(0, 5),
    selfChecks: selfChecks.slice(0, 5),
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 200) : '',
    targets: strArr(parsed.targets).slice(0, 5),
    source: 'generated',
  };
}
