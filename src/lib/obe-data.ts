// ============================================================================
// OBE 工程教育认证数据定义
// 微控制器原理与应用课程 — 机械类专业（机电方向）
// 基于 2024 版工程教育认证标准
// ============================================================================

import { createHash } from 'node:crypto';
import { experiments } from '@/lib/experiment-config';

const OBE_SEMESTER_PATTERN = /^\d{4}-\d{4}-[12]$/;

export function isValidOBESemester(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!OBE_SEMESTER_PATTERN.test(normalized)) return false;
  const [startYear, endYear] = normalized.split('-').map(Number);
  return endYear === startYear + 1;
}

export type AssessmentType = 'QUIZ' | 'EXPERIMENT' | 'LEARNING_PROGRESS' | 'COMPREHENSIVE';

export interface OBEConfigurationVersionItem {
  id: string;
  version: number;
  updatedAt?: Date | string;
  indicatorPointId?: string;
  indicatorPoint?: {
    id: string;
    updatedAt: Date | string;
    achievementThreshold: number;
  };
  assessmentLinks?: ReadonlyArray<{
    updatedAt: Date | string;
  }>;
}

function revisionTimestamp(value: Date | string | undefined): string {
  if (!value) return '';
  return value instanceof Date ? value.toISOString() : value;
}

export function buildOBEConfigurationRevision(
  objectives: ReadonlyArray<OBEConfigurationVersionItem>,
): string {
  const canonical = objectives
    .map((objective) => JSON.stringify({
      id: objective.id,
      version: objective.version,
      updatedAt: revisionTimestamp(objective.updatedAt),
      indicatorPointId: objective.indicatorPointId ?? objective.indicatorPoint?.id ?? '',
      indicatorUpdatedAt: revisionTimestamp(objective.indicatorPoint?.updatedAt),
      achievementThreshold: objective.indicatorPoint?.achievementThreshold ?? null,
      assessmentLinkUpdates: (objective.assessmentLinks ?? [])
        .map((link) => revisionTimestamp(link.updatedAt))
        .sort(),
    }))
    .sort()
    .join('|');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 20);
}

export function buildOBECalculationScopeRevision(input: {
  configurationRevision: string;
  classId: string | null;
  userId: string | null;
  semester: string | null;
  targetUserIds: ReadonlyArray<string>;
}): string {
  const canonical = JSON.stringify({
    configurationRevision: input.configurationRevision,
    classId: input.classId,
    userId: input.userId,
    semester: input.semester,
    targetUserIds: [...input.targetUserIds].sort(),
  });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 24);
}

const CHAPTER_NAMES: Readonly<Record<number, string>> = {
  1: '单片机概述',
  2: '硬件结构',
  3: '指令系统',
  4: 'C语言编程',
  5: '中断系统',
  6: '定时器/计数器',
  7: '串行通信',
  8: '接口技术',
  9: '系统设计',
  10: '前沿应用',
};

const EXPERIMENT_TITLES = new Map(experiments.map((experiment) => [experiment.id, experiment.title]));

export interface OBEAssessmentResourceOption {
  type: AssessmentType;
  targetId: string;
  chapter: number | null;
  description: string;
}

export const OBE_ASSESSMENT_RESOURCES: ReadonlyArray<OBEAssessmentResourceOption> = [
  ...experiments.map((experiment) => ({
    type: 'EXPERIMENT' as const,
    targetId: experiment.id,
    chapter: null,
    description: experiment.title,
  })),
  ...Object.entries(CHAPTER_NAMES).flatMap(([chapterText, chapterName]) => {
    const chapter = Number(chapterText);
    return [
      {
        type: 'QUIZ' as const,
        targetId: `quiz-ch${chapter}`,
        chapter,
        description: `第${chapter}章 ${chapterName}测评`,
      },
      {
        type: 'COMPREHENSIVE' as const,
        targetId: `quiz-ch${chapter}`,
        chapter,
        description: `第${chapter}章 ${chapterName}综合测评`,
      },
      {
        type: 'LEARNING_PROGRESS' as const,
        targetId: `ch${chapter}`,
        chapter,
        description: `第${chapter}章 ${chapterName}学习进度`,
      },
    ];
  }),
];

export type OBEAssessmentResourceResolution =
  | { valid: true; chapter: number | null; description: string }
  | { valid: false; error: string };

export function resolveOBEAssessmentResource(
  assessmentType: string,
  assessmentTargetId: string,
  chapter?: number | null,
): OBEAssessmentResourceResolution {
  const type = assessmentType.trim().toUpperCase();
  const targetId = assessmentTargetId.trim();
  const suppliedChapter = chapter ?? null;

  if (type === 'EXPERIMENT') {
    const title = EXPERIMENT_TITLES.get(targetId);
    if (!title) return { valid: false, error: `实验资源 ${targetId || '（空）'} 不存在` };
    if (suppliedChapter !== null) return { valid: false, error: '实验映射不应设置章节编号' };
    return { valid: true, chapter: null, description: title };
  }

  const chapterPattern = type === 'LEARNING_PROGRESS'
    ? /^ch([1-9]|10)$/
    : /^quiz-ch([1-9]|10)$/;
  const match = chapterPattern.exec(targetId);
  if (!match) {
    const expected = type === 'LEARNING_PROGRESS' ? 'ch1 至 ch10' : 'quiz-ch1 至 quiz-ch10';
    return { valid: false, error: `考核资源编号应使用 ${expected}` };
  }

  const resolvedChapter = Number(match[1]);
  if (!(resolvedChapter in CHAPTER_NAMES)) {
    return { valid: false, error: `章节 ${resolvedChapter} 不存在` };
  }
  if (suppliedChapter !== null && suppliedChapter !== resolvedChapter) {
    return { valid: false, error: `资源编号与章节不一致，应为第 ${resolvedChapter} 章` };
  }

  if (type === 'QUIZ') {
    return {
      valid: true,
      chapter: resolvedChapter,
      description: `第${resolvedChapter}章 ${CHAPTER_NAMES[resolvedChapter]}测评`,
    };
  }
  if (type === 'COMPREHENSIVE') {
    return {
      valid: true,
      chapter: resolvedChapter,
      description: `第${resolvedChapter}章 ${CHAPTER_NAMES[resolvedChapter]}综合测评`,
    };
  }
  if (type === 'LEARNING_PROGRESS') {
    return {
      valid: true,
      chapter: resolvedChapter,
      description: `第${resolvedChapter}章 ${CHAPTER_NAMES[resolvedChapter]}学习进度`,
    };
  }

  return { valid: false, error: '无效的考核类型' };
}

export interface OBEAssessmentLinkDef {
  type: AssessmentType;
  targetId: string;
  weight: number;
  maxScore: number;
  chapter?: number;
  description?: string;
}

export interface OBECourseObjectiveDef {
  code: string;
  name: string;
  description: string;
  indicatorPointCode: string;
  supportWeight: number;
  assessmentLinks: OBEAssessmentLinkDef[];
}

export interface OBEIndicatorPointDef {
  code: string;
  subIndex: number;
  name: string;
  description: string;
  graduationRequirementCode: string;
  threshold: number;
}

export interface OBEGraduationRequirementDef {
  code: string;
  index: number;
  name: string;
  description: string;
}

// ============================================================================
// 11 条毕业要求（2024 版标准）
// ============================================================================

export const GRADUATION_REQUIREMENTS: OBEGraduationRequirementDef[] = [
  { code: 'GR01', index: 1, name: '工程知识', description: '能够将数学、自然科学、计算、工程基础和专业知识用于解决复杂工程问题。' },
  { code: 'GR02', index: 2, name: '问题分析', description: '能够应用数学、自然科学和工程科学的基本原理，识别、表达并通过文献研究分析复杂工程问题，综合考虑可持续发展的要求，以获得有效结论。' },
  { code: 'GR03', index: 3, name: '设计/开发解决方案', description: '能够针对复杂工程问题设计和开发解决方案，设计满足特定需求的系统、单元或工艺流程，体现创新性，并考虑可行性。' },
  { code: 'GR04', index: 4, name: '研究', description: '能够基于科学原理并采用科学方法对复杂工程问题进行研究，包括设计实验、分析与解释数据、并通过信息综合得到合理有效的结论。' },
  { code: 'GR05', index: 5, name: '使用现代工具', description: '能够针对复杂工程问题，开发、选择与使用恰当的技术、资源、现代工程工具和信息技术工具，包括对复杂工程问题的预测与模拟，并能够理解其局限性。' },
  { code: 'GR06', index: 6, name: '工程与可持续发展', description: '能够基于工程相关背景知识，分析和评价工程实践对健康、安全、环境、法律以及经济和社会可持续发展的影响，并理解应承担的责任。' },
  { code: 'GR07', index: 7, name: '工程伦理和职业规范', description: '有工程报国、为民造福的意识，具有人文社会科学素养和社会责任感，能够理解和践行工程伦理。' },
  { code: 'GR08', index: 8, name: '个人与团队', description: '能够在多样化、多学科背景下的团队中承担个体、团队成员以及负责人的角色。' },
  { code: 'GR09', index: 9, name: '沟通', description: '能够就复杂工程问题与业界同行及社会公众进行有效沟通和交流。' },
  { code: 'GR10', index: 10, name: '项目管理', description: '理解并掌握工程管理原理与经济决策方法，并能在多学科环境中应用。' },
  { code: 'GR11', index: 11, name: '终身学习', description: '具有自主学习和终身学习的意识，有不断学习和适应发展的能力。' },
];

// ============================================================================
// 本课程支撑的 12 个指标点
// ============================================================================

export const INDICATOR_POINTS: OBEIndicatorPointDef[] = [
  { code: '1-3', subIndex: 3, name: '运用计算知识和工具', description: '能够运用计算知识和工具辅助解决复杂工程问题', graduationRequirementCode: 'GR01', threshold: 0.65 },
  { code: '2-1', subIndex: 1, name: '识别和判断关键环节', description: '能够识别和判断复杂工程问题的关键环节和参数', graduationRequirementCode: 'GR02', threshold: 0.65 },
  { code: '2-2', subIndex: 2, name: '正确表达工程问题', description: '能够基于科学原理和数学模型方法正确表达复杂工程问题', graduationRequirementCode: 'GR02', threshold: 0.65 },
  { code: '3-1', subIndex: 1, name: '设计解决方案', description: '能够针对复杂工程问题提出解决方案', graduationRequirementCode: 'GR03', threshold: 0.65 },
  { code: '3-2', subIndex: 2, name: '体现创新意识', description: '设计过程中体现创新意识', graduationRequirementCode: 'GR03', threshold: 0.65 },
  { code: '4-1', subIndex: 1, name: '设计实验方案', description: '能够基于科学原理设计实验方案', graduationRequirementCode: 'GR04', threshold: 0.65 },
  { code: '4-2', subIndex: 2, name: '采集和分析数据', description: '能够正确采集、整理和分析实验数据', graduationRequirementCode: 'GR04', threshold: 0.65 },
  { code: '4-3', subIndex: 3, name: '得出有效结论', description: '能够对实验结果进行分析解释并得出合理结论', graduationRequirementCode: 'GR04', threshold: 0.65 },
  { code: '5-1', subIndex: 1, name: '选择和使用现代工具', description: '能够选择和使用恰当的现代工程工具和信息技术工具', graduationRequirementCode: 'GR05', threshold: 0.65 },
  { code: '5-2', subIndex: 2, name: '预测与模拟', description: '能够使用工具对复杂工程问题进行预测与模拟', graduationRequirementCode: 'GR05', threshold: 0.65 },
  { code: '8-1', subIndex: 1, name: '团队协作', description: '能够在团队中承担个体角色并完成任务', graduationRequirementCode: 'GR08', threshold: 0.65 },
  { code: '11-1', subIndex: 1, name: '终身学习', description: '具有自主学习和终身学习的意识，有不断学习和适应发展的能力', graduationRequirementCode: 'GR11', threshold: 0.65 },
];

// ============================================================================
// 5 个课程目标及考核环节映射
// ============================================================================

export const COURSE_OBJECTIVES: OBECourseObjectiveDef[] = [
  {
    code: 'CO1',
    name: '掌握8051微控制器基本结构与工作原理',
    description: '理解单片机体系结构、存储器组织、I/O端口和时钟系统，建立硬件层面的系统认知',
    indicatorPointCode: '1-3',
    supportWeight: 0.5,
    assessmentLinks: [
      { type: 'QUIZ', targetId: 'quiz-ch1', weight: 0.30, maxScore: 100, chapter: 1, description: '第1章 单片机概述测评' },
      { type: 'QUIZ', targetId: 'quiz-ch2', weight: 0.30, maxScore: 100, chapter: 2, description: '第2章 硬件结构测评' },
      { type: 'EXPERIMENT', targetId: 'exp01', weight: 0.20, maxScore: 100, description: '实验一：基础LED控制实验' },
      { type: 'LEARNING_PROGRESS', targetId: 'ch1', weight: 0.10, maxScore: 100, chapter: 1, description: '第1章 单片机概述学习进度' },
      { type: 'LEARNING_PROGRESS', targetId: 'ch2', weight: 0.10, maxScore: 100, chapter: 2, description: '第2章 硬件结构学习进度' },
    ],
  },
  {
    code: 'CO2',
    name: '具备8051指令系统与程序设计能力',
    description: '掌握寻址方式、指令集、汇编程序设计和C51编程，能够编写基本控制程序',
    indicatorPointCode: '1-3',
    supportWeight: 0.4,
    assessmentLinks: [
      { type: 'QUIZ', targetId: 'quiz-ch3', weight: 0.30, maxScore: 100, chapter: 3, description: '第3章 指令系统测评' },
      { type: 'QUIZ', targetId: 'quiz-ch4', weight: 0.30, maxScore: 100, chapter: 4, description: '第4章 C语言编程测评' },
      { type: 'EXPERIMENT', targetId: 'exp02', weight: 0.40, maxScore: 100, description: '实验二：指令系统实验' },
    ],
  },
  {
    code: 'CO3',
    name: '能够运用中断系统、定时器解决实际工程问题',
    description: '理解中断机制、定时器/计数器原理，能够设计和实现中断驱动和定时控制系统',
    indicatorPointCode: '2-1',
    supportWeight: 0.3,
    assessmentLinks: [
      { type: 'QUIZ', targetId: 'quiz-ch5', weight: 0.25, maxScore: 100, chapter: 5, description: '第5章 中断系统测评' },
      { type: 'QUIZ', targetId: 'quiz-ch6', weight: 0.25, maxScore: 100, chapter: 6, description: '第6章 定时器/计数器测评' },
      { type: 'EXPERIMENT', targetId: 'exp03', weight: 0.20, maxScore: 100, description: '实验三：定时/计数器实验' },
      { type: 'EXPERIMENT', targetId: 'exp06', weight: 0.20, maxScore: 100, description: '实验六：定时器中断与计时功能' },
      { type: 'EXPERIMENT', targetId: 'exp07', weight: 0.10, maxScore: 100, description: '实验七：蜂鸣器音频控制' },
    ],
  },
  {
    code: 'CO4',
    name: '能够设计和实现串行通信与接口应用系统',
    description: '掌握串口通信、系统扩展和接口技术，能够设计综合应用系统',
    indicatorPointCode: '3-2',
    supportWeight: 0.4,
    assessmentLinks: [
      { type: 'QUIZ', targetId: 'quiz-ch7', weight: 0.20, maxScore: 100, chapter: 7, description: '第7章 串行通信测评' },
      { type: 'QUIZ', targetId: 'quiz-ch8', weight: 0.15, maxScore: 100, chapter: 8, description: '第8章 接口技术测评' },
      { type: 'QUIZ', targetId: 'quiz-ch9', weight: 0.15, maxScore: 100, chapter: 9, description: '第9章 系统设计测评' },
      { type: 'EXPERIMENT', targetId: 'exp08', weight: 0.15, maxScore: 100, description: '实验八：步进电机控制实验' },
      { type: 'EXPERIMENT', targetId: 'exp09', weight: 0.15, maxScore: 100, description: '实验九：串口通信实验' },
      { type: 'EXPERIMENT', targetId: 'proj03', weight: 0.10, maxScore: 100, description: '项目三：智能小车运动控制系统设计' },
      { type: 'EXPERIMENT', targetId: 'proj04', weight: 0.10, maxScore: 100, description: '项目四：智慧农业大棚监控系统设计' },
    ],
  },
  {
    code: 'CO5',
    name: '能够使用仿真工具进行微控制器系统设计与调试',
    description: '熟练使用 Keil、Proteus 等工具进行程序开发、仿真验证和系统调试',
    indicatorPointCode: '5-1',
    supportWeight: 0.5,
    assessmentLinks: [
      { type: 'EXPERIMENT', targetId: 'exp01', weight: 0.14, maxScore: 100, description: '实验一：基础LED控制实验' },
      { type: 'EXPERIMENT', targetId: 'exp02', weight: 0.14, maxScore: 100, description: '实验二：指令系统实验' },
      { type: 'EXPERIMENT', targetId: 'exp03', weight: 0.14, maxScore: 100, description: '实验三：定时/计数器实验' },
      { type: 'EXPERIMENT', targetId: 'exp05', weight: 0.15, maxScore: 100, description: '实验五：按键输入与消抖处理' },
      { type: 'EXPERIMENT', targetId: 'exp06', weight: 0.14, maxScore: 100, description: '实验六：定时器中断与计时功能' },
      { type: 'EXPERIMENT', targetId: 'exp08', weight: 0.15, maxScore: 100, description: '实验八：步进电机控制实验' },
      { type: 'EXPERIMENT', targetId: 'exp09', weight: 0.14, maxScore: 100, description: '实验九：串口通信实验' },
    ],
  },
];
