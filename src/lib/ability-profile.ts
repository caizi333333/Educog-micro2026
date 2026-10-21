/**
 * 能力画像：将实验完成记录/测验成绩聚合为「岗位能力维度 + L1–L4 等级」。
 * 能力阶梯定义与《AI+虚拟仿真申报_2026/06_响应对照/能力阶梯体系表》一致：
 *   L1 认知与操作 → exp01–exp02
 *   L2 单元功能实现 → exp03–exp09
 *   L3 子系统集成 → proj01–proj03
 *   L4 系统级设计 → proj04（含 24 步赋分）
 * 全部来自落盘数据；无记录的维度返回 null（未形成记录），不虚报为 0。
 */

export const ABILITY_DIMENSIONS = [
  {
    id: 'fundamentals',
    name: '编程基础',
    experiments: ['exp01', 'exp02'],
    jobRef: '固件片段阅读改写、I/O 基本操作',
  },
  {
    id: 'timing',
    name: '定时与中断',
    experiments: ['exp03', 'exp06'],
    jobRef: '采样周期控制、后台周期任务',
  },
  {
    id: 'interaction',
    name: '显示与交互',
    experiments: ['exp04', 'exp05', 'exp07'],
    jobRef: '人机界面、按键与声光提示',
  },
  {
    id: 'controlComm',
    name: '控制与通信',
    experiments: ['exp08', 'exp09'],
    jobRef: '执行机构驱动、上位机联调',
  },
  {
    id: 'systemDesign',
    name: '综合系统设计',
    experiments: ['proj01', 'proj02', 'proj03', 'proj04'],
    jobRef: '多传感器监控系统全链路设计',
  },
] as const;

export type AbilityDimensionId = (typeof ABILITY_DIMENSIONS)[number]['id'];

export const ABILITY_LEVELS = [
  {
    level: 1,
    name: 'L1 认知与操作',
    evidence: '完成 exp01–exp02 中至少 1 项',
    satisfied: (s: AbilityInput) => countCompleted(s, ['exp01', 'exp02']) >= 1,
  },
  {
    level: 2,
    name: 'L2 单元功能实现',
    evidence: '完成 exp03–exp09 中至少 5 项',
    satisfied: (s: AbilityInput) =>
      countCompleted(s, ['exp03', 'exp04', 'exp05', 'exp06', 'exp07', 'exp08', 'exp09']) >= 5,
  },
  {
    level: 3,
    name: 'L3 子系统集成',
    evidence: '完成 proj01–proj03 中至少 2 项',
    satisfied: (s: AbilityInput) => countCompleted(s, ['proj01', 'proj02', 'proj03']) >= 2,
  },
  {
    level: 4,
    name: 'L4 系统级设计',
    evidence: 'proj04 完成且赋分 ≥60',
    satisfied: (s: AbilityInput) => {
      const p4 = s.experiments.find((e) => e.experimentId === 'proj04');
      return p4?.status === 'COMPLETED' && (p4.score ?? 100) >= 60;
    },
  },
] as const;

export interface ExperimentRecord {
  experimentId: string;
  status: string;
  score: number | null;
}

export interface AbilityInput {
  experiments: ExperimentRecord[];
  /** 最近一次测验均分（0–100），无测验记录时为 null */
  quizAverage: number | null;
  /** AI 求助行为计数（过程性指标，不参与维度评分），缺省视为无记录 */
  aiUsage?: { diagnosisCount: number; reviewCount: number };
}

export interface DimensionScore {
  id: AbilityDimensionId;
  name: string;
  jobRef: string;
  /** 0–100；无任何记录时为 null */
  score: number | null;
  completedCount: number;
  totalCount: number;
}

export interface AbilityProfile {
  dimensions: DimensionScore[];
  /** 达成的最高等级（1–4），尚未达 L1 时为 0 */
  level: number;
  levelName: string;
  levelEvidence: string;
  nextLevel: { level: number; name: string; evidence: string } | null;
  completedExperiments: number;
  /** AI 求助行为过程指标：诊断/评价调用次数与自主度；无记录时各字段为 null */
  aiProcess: {
    diagnosisCount: number | null;
    reviewCount: number | null;
    /** 自主度 = 完成实验数 ÷（完成数 + 诊断求助次数），0–100；无数据为 null */
    selfReliance: number | null;
  };
}

function countCompleted(s: AbilityInput, ids: string[]): number {
  return s.experiments.filter(
    (e) => e.status === 'COMPLETED' && (ids as readonly string[]).includes(e.experimentId),
  ).length;
}

/** 单项实验贡献分：COMPLETED 用赋分（缺省 100），进行中 40，其余 0 */
function experimentContribution(e: ExperimentRecord | undefined): number {
  if (!e || e.status === 'NOT_STARTED') return 0;
  if (e.status === 'COMPLETED') return Math.min(100, Math.max(0, e.score ?? 100));
  return 40; // IN_PROGRESS 等：已留痕但未完成
}

const QUIZ_BLEND = 0.2; // 测验权重 20%，实验留痕权重 80%

export function computeAbilityProfile(input: AbilityInput): AbilityProfile {
  const byId = new Map(input.experiments.map((e) => [e.experimentId, e]));

  const dimensions: DimensionScore[] = ABILITY_DIMENSIONS.map((dim) => {
    const records = dim.experiments
      .map((id) => byId.get(id))
      .filter((r): r is ExperimentRecord => r !== undefined && r.status !== 'NOT_STARTED');
    const completedCount = dim.experiments.filter(
      (id) => byId.get(id)?.status === 'COMPLETED',
    ).length;

    if (records.length === 0 && input.quizAverage === null) {
      return { id: dim.id, name: dim.name, jobRef: dim.jobRef, score: null, completedCount, totalCount: dim.experiments.length };
    }

    const expAvg =
      dim.experiments.reduce((sum, id) => sum + experimentContribution(byId.get(id)), 0) /
      dim.experiments.length;
    const score =
      input.quizAverage === null
        ? Math.round(expAvg)
        : Math.round(expAvg * (1 - QUIZ_BLEND) + input.quizAverage * QUIZ_BLEND);
    return { id: dim.id, name: dim.name, jobRef: dim.jobRef, score, completedCount, totalCount: dim.experiments.length };
  });

  const achieved = [...ABILITY_LEVELS].reverse().find((l) => l.satisfied(input));
  const nextLevel = achieved
    ? ABILITY_LEVELS.find((l) => l.level === achieved.level + 1) ?? null
    : ABILITY_LEVELS[0];

  const completedExperiments = input.experiments.filter((e) => e.status === 'COMPLETED').length;
  const ai = input.aiUsage;
  const aiProcess: AbilityProfile['aiProcess'] = ai
    ? {
        diagnosisCount: ai.diagnosisCount,
        reviewCount: ai.reviewCount,
        selfReliance:
          completedExperiments + ai.diagnosisCount > 0
            ? Math.round((completedExperiments / (completedExperiments + ai.diagnosisCount)) * 100)
            : null,
      }
    : { diagnosisCount: null, reviewCount: null, selfReliance: null };

  return {
    dimensions,
    level: achieved?.level ?? 0,
    levelName: achieved?.name ?? '未评级',
    levelEvidence: achieved?.evidence ?? '完成任一 L1 实验后形成等级',
    nextLevel: nextLevel && nextLevel !== achieved
      ? { level: nextLevel.level, name: nextLevel.name, evidence: nextLevel.evidence }
      : null,
    completedExperiments,
    aiProcess,
  };
}
