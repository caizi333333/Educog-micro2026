export type LearningTaskStepType =
  | 'CHAPTER'
  | 'GRAPH'
  | 'ANIMATION'
  | 'QUIZ'
  | 'REMEDIATION'
  | 'SIMULATION'
  | 'RETEST';

export type LearningTaskStep = {
  stepId: string;
  type: LearningTaskStepType;
  title: string;
  purpose: string;
  completionRule: string;
  href: string;
  targetId: string;
  chapterId?: string;
  moduleId?: string;
  knowledgeNodeId?: string;
  quizId?: string;
  experimentId?: string;
};

export type LessonTaskPreset = {
  topicId: string;
  title: string;
  description: string;
  steps: LearningTaskStep[];
};

export const ADDRESSING_TOPIC_ID = 'addressing-modes';
export const ADDRESSING_QUIZ_ID = 'quiz-ch3-addressing';
/** 固定题集内容版本；新回执必须落盘，旧回执缺失时不得按当前题面反向复现。 */
export const ADDRESSING_QUESTION_SET_VERSION = 'addressing-2026-08-25-v2';
export const ADDRESSING_REMEDIATION_STEP_ID = 'addressing-remediation';
export const ADDRESSING_GRAPH_EVIDENCE_SOURCE = 'addressing-graph-checklist';
export const ADDRESSING_ANIMATION_EVIDENCE_SOURCE = 'addressing-compare';
export const ADDRESSING_GRAPH_ROOT_NODE_ID = '3.1';
export const ADDRESSING_GRAPH_CHILD_NODE_IDS = [
  '3.1.1',
  '3.1.2',
  '3.1.3',
  '3.1.4',
  '3.1.5',
  '3.1.6',
  '3.1.7',
] as const;
export const ADDRESSING_INITIAL_QUESTION_IDS = [4, 49, 95, 24, 23, 115, 116] as const;
export const ADDRESSING_RETEST_QUESTION_IDS = [117, 232, 119, 233, 234, 118, 99] as const;
export const AI_LITERACY_TOPIC_ID = 'ai-literacy';
export const AI_LITERACY_QUIZ_ID = 'quiz-ch10-ai-literacy';
export const AI_LITERACY_QUESTION_IDS = [299, 300, 301, 302, 303] as const;

const TASK_HREF_BASE = 'https://educog.local';
const TASK_ENTRY_PATHS: Record<LearningTaskStepType, readonly string[]> = {
  CHAPTER: ['/'],
  GRAPH: ['/knowledge-graph'],
  ANIMATION: ['/knowledge-graph', '/simulation'],
  QUIZ: ['/quiz'],
  REMEDIATION: ['/weak-nodes'],
  SIMULATION: ['/simulation'],
  RETEST: ['/quiz'],
};

function chapterNumberFromId(chapterId: string | undefined): number | null {
  const match = chapterId?.match(/^ch([1-9]|10)$/i);
  return match ? Number(match[1]) : null;
}

/** 公开课程位于根路由；查询参数保留页面分区与章节语义，锚点负责定位并展开章节。 */
export function buildCourseChapterHref(chapterId?: string): string {
  const chapter = chapterNumberFromId(chapterId);
  return chapter === null
    ? '/?section=chapters'
    : `/?section=chapters&chapter=${chapter}#item-${chapter}`;
}

function normalizeLegacyCourseHref(href: string): string {
  const target = new URL(href, TASK_HREF_BASE);
  if (target.origin !== TASK_HREF_BASE || target.pathname !== '/courses') return href;
  const chapter = target.searchParams.get('chapter');
  return buildCourseChapterHref(chapter && /^(?:[1-9]|10)$/.test(chapter) ? `ch${chapter}` : undefined);
}

/** 只有确实由当前应用实现的步骤入口才能先写“已打开”回执。 */
export function isExecutableTaskHref(
  step: Pick<LearningTaskStep, 'type' | 'href' | 'targetId'>,
): boolean {
  try {
    const target = new URL(step.href, TASK_HREF_BASE);
    if (target.origin !== TASK_HREF_BASE || !TASK_ENTRY_PATHS[step.type].includes(target.pathname)) {
      return false;
    }
    if (step.type !== 'CHAPTER') return true;
    if (target.searchParams.get('section') !== 'chapters') return false;
    const expectedChapter = chapterNumberFromId(step.targetId);
    if (expectedChapter === null) {
      return !/^ch\d+$/i.test(step.targetId) && target.searchParams.get('chapter') === null;
    }
    return target.searchParams.get('chapter') === String(expectedChapter)
      && (!target.hash || target.hash === `#item-${expectedChapter}` || target.hash === `#chapter-${expectedChapter}`);
  } catch {
    return false;
  }
}

export function getAiLiteracyQuestionIds(): readonly number[] {
  return AI_LITERACY_QUESTION_IDS;
}

/** 将正式课程章节映射到学习模块；无效章节返回 null，避免静默写入错误口径。 */
export function getModuleIdForChapter(chapter: number): string | null {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 10) return null;
  if (chapter <= 3) return 'module-1';
  if (chapter <= 5) return 'module-2';
  if (chapter <= 7) return 'module-3';
  if (chapter <= 9) return 'module-4';
  return 'module-5';
}

export function getAddressingQuestionIds(mode: unknown): readonly number[] {
  return mode === 'retest' ? ADDRESSING_RETEST_QUESTION_IDS : ADDRESSING_INITIAL_QUESTION_IDS;
}

const ADDRESSING_STEPS: LearningTaskStep[] = [
  {
    stepId: 'addressing-graph',
    type: 'GRAPH',
    title: '图谱定位：3.1 寻址方式',
    purpose: '先看清寻址方式与七个子节点的层级和关系。',
    completionRule: '进入 3.1 图谱定位页，核对页面所列七个子节点后，返回任务页确认完成。',
    href: '/knowledge-graph?chapter=3&node=3.1',
    targetId: '3.1',
    chapterId: 'ch3',
    moduleId: 'module-1',
    knowledgeNodeId: '3.1',
  },
  {
    stepId: 'addressing-animation',
    type: 'ANIMATION',
    title: '动画学习：七种寻址方式对比',
    purpose: '借助动态过程区分操作数、地址与寄存器的作用。',
    completionRule: '逐一查看七种寻址方式的地址形成过程并完成对比后，返回任务页确认完成。',
    href: '/knowledge-graph?chapter=3&node=3.1#addressing-compare',
    targetId: 'anim-addressing-modes',
    chapterId: 'ch3',
    moduleId: 'module-1',
    knowledgeNodeId: '3.1',
  },
  {
    stepId: 'addressing-pre-quiz',
    type: 'QUIZ',
    title: '专项测评：寻址方式',
    purpose: '用 3.1 及其子节点题目识别当前掌握情况。',
    completionRule: '提交寻址方式专项测评；得分和薄弱点以服务端记录为准。',
    href: '/quiz?topic=addressing-modes',
    targetId: ADDRESSING_QUIZ_ID,
    chapterId: 'ch3',
    moduleId: 'module-1',
    knowledgeNodeId: '3.1',
    quizId: ADDRESSING_QUIZ_ID,
  },
  {
    stepId: ADDRESSING_REMEDIATION_STEP_ID,
    type: 'REMEDIATION',
    title: '薄弱点补学：3.1 及其子节点',
    purpose: '按服务端测评结果回到对应知识节点补学。',
    completionRule: '查看薄弱节点、推荐资源和解释后，返回任务页确认完成。',
    href: `/weak-nodes?quizId=${ADDRESSING_QUIZ_ID}`,
    targetId: '3.1',
    chapterId: 'ch3',
    moduleId: 'module-1',
    knowledgeNodeId: '3.1',
    quizId: ADDRESSING_QUIZ_ID,
  },
  {
    stepId: 'addressing-exp02',
    type: 'SIMULATION',
    title: '仿真实践：exp02 指令系统实验',
    purpose: '在指令执行和内存变化中验证五种数据寻址方式；相对寻址和位寻址在专项测评中另行检验。',
    completionRule: '无故障运行并形成执行记录，代码覆盖五种规定寻址方式后，由服务端复核完成。',
    href: '/simulation?experiment=exp02',
    targetId: 'exp02',
    chapterId: 'ch3',
    moduleId: 'module-1',
    knowledgeNodeId: '3.1',
    experimentId: 'exp02',
  },
  {
    stepId: 'addressing-retest',
    type: 'RETEST',
    title: '再次测评：检验补学效果',
    purpose: '在补学和实践后复测同一知识范围，形成可比结果。',
    completionRule: '提交再次测评；教师端按同一 quizId 比较首次与最近一次作答结果。',
    href: '/quiz?topic=addressing-modes&mode=retest',
    targetId: ADDRESSING_QUIZ_ID,
    chapterId: 'ch3',
    moduleId: 'module-1',
    knowledgeNodeId: '3.1',
    quizId: ADDRESSING_QUIZ_ID,
  },
];

export const ADDRESSING_TASK_PRESET: LessonTaskPreset = {
  topicId: ADDRESSING_TOPIC_ID,
  title: '3.1 寻址方式专项学习任务',
  description: '按图谱定位、动画学习、专项测评、薄弱点补学、exp02 仿真实践和再次测评依次完成。',
  steps: ADDRESSING_STEPS,
};

export function getLessonTaskPreset(topicId: unknown): LessonTaskPreset | null {
  return topicId === ADDRESSING_TOPIC_ID ? ADDRESSING_TASK_PRESET : null;
}

function isStepType(value: unknown): value is LearningTaskStepType {
  return typeof value === 'string' && [
    'CHAPTER', 'GRAPH', 'ANIMATION', 'QUIZ', 'REMEDIATION', 'SIMULATION', 'RETEST',
  ].includes(value);
}

function safeInternalTaskHref(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const href = value.trim();
  if (!href.startsWith('/') || href.startsWith('//') || /[\u0000-\u001F\u007F]/.test(href)) {
    return fallback;
  }
  try {
    return normalizeLegacyCourseHref(href);
  } catch {
    return fallback;
  }
}

export function parseLearningTaskSteps(value: string | unknown): LearningTaskStep[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap<LearningTaskStep>((raw, index) => {
    if (typeof raw === 'string') {
      const legacyId = raw.trim();
      if (!legacyId) return [];
      const chapterId = /^ch(?:[1-9]|10)$/i.test(legacyId) ? legacyId.toLowerCase() : undefined;
      const moduleId = /^module-[1-9][0-9]*$/i.test(legacyId) ? legacyId.toLowerCase() : undefined;
      return [{
        stepId: `legacy-step-${index + 1}`,
        type: 'CHAPTER' as const,
        title: legacyId,
        purpose: '完成本步骤对应的学习内容。',
        completionRule: '按页面要求完成本步骤。',
        href: buildCourseChapterHref(chapterId),
        targetId: legacyId,
        chapterId,
        moduleId,
      }];
    }
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const moduleId = typeof item.moduleId === 'string' ? item.moduleId : undefined;
    const title = typeof item.title === 'string'
      ? item.title
      : typeof item.name === 'string'
        ? item.name
        : `学习步骤 ${index + 1}`;
    const type = isStepType(item.type) ? item.type : 'CHAPTER';
    const targetId = typeof item.targetId === 'string'
      ? item.targetId
      : typeof item.chapterId === 'string'
        ? item.chapterId
        : moduleId ?? `step-${index + 1}`;
    const chapterId = typeof item.chapterId === 'string'
      ? item.chapterId
      : type === 'CHAPTER' && chapterNumberFromId(targetId) !== null
        ? targetId.toLowerCase()
        : undefined;
    const fallbackHref = buildCourseChapterHref(chapterId);
    const href = safeInternalTaskHref(item.href, fallbackHref);

    return [{
      stepId: typeof item.stepId === 'string' ? item.stepId : `legacy-step-${index + 1}`,
      type,
      title,
      purpose: typeof item.purpose === 'string' ? item.purpose : '完成本步骤对应的学习内容。',
      completionRule: typeof item.completionRule === 'string' ? item.completionRule : '按页面要求完成本步骤。',
      href,
      targetId,
      chapterId,
      moduleId,
      knowledgeNodeId: typeof item.knowledgeNodeId === 'string' ? item.knowledgeNodeId : undefined,
      quizId: typeof item.quizId === 'string' ? item.quizId : undefined,
      experimentId: typeof item.experimentId === 'string' ? item.experimentId : undefined,
    }];
  });
}

export function isManualTaskStep(step: LearningTaskStep): boolean {
  return step.type === 'GRAPH' || step.type === 'ANIMATION' || step.type === 'REMEDIATION' || step.type === 'CHAPTER';
}

/** 图谱、动画和补学必须在内容页显式完成；兼容旧数据的章节步骤进入页面即可确认。 */
export function getTaskEvidenceEventType(step: Pick<LearningTaskStep, 'type'>): 'RESOURCE_OPENED' | 'RESOURCE_COMPLETED' {
  return step.type === 'GRAPH' || step.type === 'ANIMATION' || step.type === 'REMEDIATION'
    ? 'RESOURCE_COMPLETED'
    : 'RESOURCE_OPENED';
}

/**
 * 图谱定位和兼容旧数据的章节步骤都需要可靠记录“成功进入页面”。图谱定位的
 * 完成判定另行要求 RESOURCE_COMPLETED，不能用这里的 RESOURCE_OPENED 代替。
 * 其余步骤有内容完成、交卷或实验提交等独立的服务端判定，打开行为上报短暂失败时不应阻断学习入口。
 */
export function requiresTaskOpenReceiptBeforeNavigation(
  step: Pick<LearningTaskStep, 'type'>,
): boolean {
  return step.type === 'GRAPH' || step.type === 'CHAPTER';
}

export type TaskResourceEvidence = {
  clientEventId: string;
  eventType: 'RESOURCE_OPENED' | 'RESOURCE_COMPLETED';
  targetType: LearningTaskStepType;
  targetId: string;
};

export type TaskNavigationReceipt = TaskResourceEvidence & {
  eventType: 'RESOURCE_OPENED';
  metadata: {
    source: 'tasks-page';
    pathId: string;
    stepId: string;
  };
};

/**
 * 生成从任务页进入内容页的唯一回执。该回执只证明成功打开入口；图谱步骤
 * 仍须在内容页提交独立的 RESOURCE_COMPLETED 凭据，二者不能互相替代。
 */
export function buildTaskNavigationReceipt(
  step: LearningTaskStep,
  pathId: string,
): TaskNavigationReceipt | null {
  const normalizedPathId = pathId.trim();
  if (!normalizedPathId || !isExecutableTaskHref(step)) return null;
  return {
    clientEventId: `resource-open:${normalizedPathId}:${step.stepId}`,
    eventType: 'RESOURCE_OPENED',
    targetType: step.type,
    targetId: step.targetId,
    metadata: {
      source: 'tasks-page',
      pathId: normalizedPathId,
      stepId: step.stepId,
    },
  };
}

function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * 校验“3.1 寻址方式”图谱定位步骤的内容页完成凭据。
 * 必须来自受控清单，并且七个子节点各出现一次；仅进入页面或重复点击某一节点均不算完成。
 */
export function validateAddressingGraphCompletionEvidence(metadata: unknown): string | null {
  const record = metadataRecord(metadata);
  if (!record || record.source !== ADDRESSING_GRAPH_EVIDENCE_SOURCE) {
    return '图谱完成凭据来源无效，请从 3.1 节点核对清单重新确认';
  }
  if (record.rootNodeId !== ADDRESSING_GRAPH_ROOT_NODE_ID) {
    return '图谱完成凭据根节点无效，必须核对 3.1 寻址方式';
  }
  if (!Array.isArray(record.visitedNodeIds) || !record.visitedNodeIds.every((id) => typeof id === 'string')) {
    return '图谱完成凭据缺少已核对子节点清单';
  }
  const visitedNodeIds = record.visitedNodeIds as string[];
  if (new Set(visitedNodeIds).size !== visitedNodeIds.length) {
    return '图谱完成凭据包含重复子节点，不能替代逐项核对';
  }
  const expectedNodeIds = new Set<string>(ADDRESSING_GRAPH_CHILD_NODE_IDS);
  if (visitedNodeIds.length !== expectedNodeIds.size || visitedNodeIds.some((id) => !expectedNodeIds.has(id))) {
    return '图谱完成凭据不完整，必须逐项核对 3.1.1—3.1.7 七个子节点';
  }
  return null;
}

/**
 * 校验寻址方式动画步骤的完成凭据。页面必须逐项展示七种方式；初始渲染、
 * 重复点击同一方式或只进入页面都不能替代完整查看。
 */
export function validateAddressingAnimationCompletionEvidence(metadata: unknown): string | null {
  const record = metadataRecord(metadata);
  if (!record || record.source !== ADDRESSING_ANIMATION_EVIDENCE_SOURCE) {
    return '动画完成凭据来源无效，请从七种寻址方式对比页重新学习';
  }
  if (!Array.isArray(record.visitedModes) || !record.visitedModes.every((id) => typeof id === 'string')) {
    return '动画完成凭据缺少已查看方式清单';
  }
  const visitedModes = record.visitedModes as string[];
  if (new Set(visitedModes).size !== visitedModes.length) {
    return '动画完成凭据包含重复方式，不能替代逐项查看';
  }
  const expectedModes = new Set<string>(ADDRESSING_GRAPH_CHILD_NODE_IDS);
  if (visitedModes.length !== expectedModes.size || visitedModes.some((id) => !expectedModes.has(id))) {
    return '动画完成凭据不完整，必须逐项查看七种寻址方式';
  }
  return null;
}

/** 统一薄弱项编号，供补学页面、事件接口和任务推进使用同一比较口径。 */
export function normalizeRemediationWeakAreas(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const normalized = item.trim();
    return normalized ? [normalized] : [];
  }))].sort();
}

/**
 * 补学完成凭据必须覆盖本次专项测评返回的全部薄弱项；无薄弱项时也需显式确认。
 * 该函数只判断结构和集合一致性，测评记录本身仍由调用方从服务端读取。
 */
export function isValidRemediationCompletionEvidence(
  metadata: unknown,
  authoritativeWeakAreas: unknown,
): boolean {
  const record = metadataRecord(metadata);
  if (!record) return false;
  const expected = normalizeRemediationWeakAreas(authoritativeWeakAreas);
  const reviewed = normalizeRemediationWeakAreas(record.reviewedWeakAreas);
  if (expected.length === 0) {
    return reviewed.length === 0 && record.confirmedNoWeakNodes === true;
  }
  return reviewed.length === expected.length
    && expected.every((weakArea, index) => reviewed[index] === weakArea);
}

/** 从服务端测评活动中读取与任务、资源和阶段均精确匹配的薄弱项。 */
export function getInitialTaskRemediationWeakAreas(
  activityDetails: unknown,
  pathId: string,
  quizId: string,
): string[] | null {
  const record = metadataRecord(activityDetails);
  const weakAreas = record?.weakAreas;
  if (record?.pathId !== pathId
    || record.quizId !== quizId
    || record.assessmentMode !== 'initial'
    || !Array.isArray(weakAreas)) {
    return null;
  }
  return normalizeRemediationWeakAreas(weakAreas);
}

/** 由任务步骤定义生成内容页上报字段，避免前端重复填写时出现类型或资源编号错配。 */
export function buildTaskResourceEvidence(
  step: LearningTaskStep,
  pathId: string,
): TaskResourceEvidence | null {
  const normalizedPathId = pathId.trim();
  if (!normalizedPathId || !isManualTaskStep(step)) return null;
  const eventType = getTaskEvidenceEventType(step);
  const action = eventType === 'RESOURCE_COMPLETED' ? 'resource-complete' : 'resource-open';
  return {
    clientEventId: `${action}:${normalizedPathId}:${step.stepId}`,
    eventType,
    targetType: step.type,
    targetId: step.targetId,
  };
}
