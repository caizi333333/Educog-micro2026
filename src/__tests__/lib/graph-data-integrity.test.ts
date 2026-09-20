import {
  getExplicitSipMappingsForKnowledgePoint,
  ideologicalGraphStats,
  ideologicalNodes,
  sipMappings,
} from '@/lib/ideological-graph';
import {
  getPrerequisiteReason,
  getPointsByLevel,
  knowledgePoints,
  LEGACY_GRAPH_NODE_TARGETS,
  resolveKnowledgeResourceHref,
  COURSE_SLIDE_LINKS,
  COURSE_GUIDE_LINKS,
} from '@/lib/knowledge-points';
import { getModuleIdForChapter } from '@/lib/lesson-tasks';
import {
  getProblemPrimaryKnowledgePointId,
  getProblemRemediationPlan,
  problemGraph,
} from '@/lib/problem-graph';
import { COURSE_CHAPTER_SCHEDULE, COURSE_KA_COUNT_BY_CHAPTER, COURSE_SYLLABUS_TOPICS, COURSE_UNIT_ALIGNMENT } from '@/lib/course-curriculum';
import { getTeachingContent } from '@/lib/teaching-content';
import { createExperimentObservation, collectExperimentObservation, validateExperimentObservation, type ExperimentObservationEvidence } from '@/lib/experiment-config';

const isHierarchicallyRelated = (left: string, right: string): boolean => (
  left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`)
);

describe('three graph data integrity', () => {
  const knowledgeById = new Map(knowledgePoints.map((point) => [point.id, point]));
  const problemIds = new Set(problemGraph.map((node) => node.id));
  const ideologicalById = new Map(ideologicalNodes.map((node) => [node.id, node]));

  it('preserves source chapter numbering and separates extension units from the syllabus', () => {
    expect(COURSE_SYLLABUS_TOPICS.map((topic) => topic.chapterNumber)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10, 11]);
    expect(COURSE_SYLLABUS_TOPICS.reduce((sum, topic) => sum + topic.theoryHours, 0)).toBe(48);
    expect(COURSE_SYLLABUS_TOPICS.find((topic) => topic.chapterNumber === 6)?.platformUnits).toEqual([7]);
    expect(COURSE_SYLLABUS_TOPICS.find((topic) => topic.chapterNumber === 10)?.platformUnits).toEqual([8]);
    expect(COURSE_UNIT_ALIGNMENT[4]).toContain('拓展');
    expect(COURSE_UNIT_ALIGNMENT[10]).toContain('拓展');
  });

  it('links source slide pages by topic without substituting unrelated decks for missing material', () => {
    COURSE_SLIDE_LINKS.forEach((link) => {
      const resource = knowledgeById.get(link.pointId)?.resources?.find((candidate) => candidate.refId === link.refId);
      expect(resource?.url).toBe(`/resources/course/course-slides.pdf#page=${link.page}`);
      expect(Number.isInteger(link.page) && link.page >= 1 && link.page <= 167).toBe(true);
      expect(knowledgeById.get(link.pointId)?.chapter).toBe(link.page <= 77 ? 7 : 8);
    });
    expect(knowledgeById.get('7.2.3')?.resources?.[0]?.url).toContain('#page=45');
    expect(knowledgeById.get('8.5.2')?.resources?.some((resource) => resource.url?.endsWith('#page=145'))).toBe(true);
    expect(knowledgeById.get('8.1')?.resources?.find((resource) => resource.type === 'slide')?.url).toBeUndefined();
    expect(knowledgeById.get('7.4.3')?.resources).toBeUndefined();
  });

  it('opens only the implemented interactive demonstrations', () => {
    const stackResource = knowledgeById.get('3.5')?.resources?.find((resource) => resource.refId === 'anim-jump-stack');
    expect(resolveKnowledgeResourceHref(stackResource!, 3)).toBe('/simulation?experiment=exp05&view=guide&animation=stack-pushpop');
    expect(getTeachingContent('exp05')?.animations?.map((animation) => animation.id)).toContain('stack-pushpop');
    expect(resolveKnowledgeResourceHref({ type: 'animation', title: '中断流程', refId: 'anim-interrupt-flow' }, 5)).toBe('/simulation?experiment=exp06&view=guide&animation=interrupt-flow');
    expect(resolveKnowledgeResourceHref({ type: 'animation', title: '帧格式', refId: 'anim-uart-timing' }, 7)).toBe('/simulation?experiment=exp09&view=guide&animation=uart-frame');
    expect(resolveKnowledgeResourceHref({ type: 'animation', title: '未实现', refId: 'anim-comm-protocols' }, 7)).toBeNull();
  });

  it('attaches real web guides without relabelling them as slides or implemented animations', () => {
    for (const link of COURSE_GUIDE_LINKS) {
      expect(getTeachingContent(link.experimentId)?.theory.length).toBeGreaterThan(0);
      for (const pointId of link.pointIds) {
        const resource = knowledgeById.get(pointId)?.resources?.find((candidate) => candidate.refId === link.refId);
        expect(resource?.type).toBe('document');
        expect(resource?.title).not.toMatch(/课件|PPT|动画/);
        expect(resolveKnowledgeResourceHref(resource!)).toBe(`/simulation?experiment=${link.experimentId}&view=guide`);
      }
    }
    expect(knowledgeById.get('8.3')?.resources?.find((resource) => resource.refId === 'ch08-ppt-s3')?.title).toContain('不含DAC');
    expect(knowledgeById.get('1.1')?.resources?.find((resource) => resource.refId === 'ch01-ppt-s1')?.url).toBeUndefined();
    expect(knowledgeById.get('10.3')?.resources?.find((resource) => resource.refId === 'ch10-ppt-s3')?.url).toBeUndefined();
  });

  it('keeps the classic 8051 interrupt register separate from the 8052 extension', () => {
    for (const id of ['exp03', 'exp06']) {
      const ie = getTeachingContent(id)?.registerReference.find((register) => register.name === 'IE');
      expect(ie?.bits).toEqual(['EA', '—', '—', 'ES', 'ET1', 'EX1', 'ET0', 'EX0']);
    }
  });

  it('keeps source timing and input conditions aligned with the revised car and UART examples', () => {
    const uart = getTeachingContent('exp09')!.theory.find((section) => section.title === 'SCON 寄存器与收发控制')!.content;
    expect(uart).toContain('方式1在停止位开始时置1');
    expect(uart).toContain('不复现逐位物理发送时序');
    const car = getTeachingContent('proj03')!;
    expect(car.stepByStep.find((step) => step.step.includes('配置外部中断'))?.detail).toContain('IT0=IT1=1');
    expect(car.registerReference.find((register) => register.name === 'IP')?.bits).not.toContain('PT2');
    expect(car.commonMistakes.find((item) => item.mistake === '中断服务中长时间延时')?.explanation).toContain(String(1 + 250 * (1 + 250 * 2 + 2) + 2));
    expect(getTeachingContent('exp08')!.stepByStep[0]?.detail).toContain('正反转共用');
    expect(getTeachingContent('proj01')!.stepByStep[3]?.detail).toContain('约1.006s');
  });

  it.each([
    ['1.4', 'ch01-ppt-s4', 'proj01', ['AT89C51 芯片引脚功能', '最小系统电路']],
    ['2.3', 'ch02-ppt-s3', 'exp01', ['8051 并行 I/O 口结构', 'LED 驱动原理']],
    ['3.1', 'ch03-ppt-s1', 'exp02', ['8051 寻址方式']],
    ['6.1', 'ch06-ppt-s1', 'exp03', ['8051 定时器/计数器原理', '定时初值计算']],
    ['6.3', 'ch06-ppt-s3', 'exp06', ['双定时器协同工作']],
    ['8.1', 'ch08-ppt-s1', 'exp04', ['七段数码管原理', '动态扫描技术']],
    ['8.2', 'ch08-ppt-s2', 'exp05', ['四路独立按键与同键确认', '消抖延时的条件与寄存器保护', '实物拓展：4×4矩阵键盘']],
    ['8.4', 'ch08-ppt-s4', 'proj04', ['DS18B20 单总线温度传感器', '单总线通信时序详解']],
  ] as const)('labels the %s webpage as a document and verifies its actual guide topics', (pointId, refId, experimentId, topics) => {
    const resource = knowledgeById.get(pointId)?.resources?.find((item) => item.refId === refId);
    expect(resource?.type).toBe('document');
    expect(resource?.title).not.toMatch(/课件|PPT|动画/);
    expect(resolveKnowledgeResourceHref(resource!)).toBe(`/simulation?experiment=${experimentId}&view=guide`);
    const guide = getTeachingContent(experimentId);
    topics.forEach((title) => {
      expect(guide?.theory.find((section) => section.title === title)?.content.trim()).toBeTruthy();
    });
    if (pointId === '8.4') {
      expect(resource?.title).toContain('模拟输入');
      expect(guide?.projectBrief?.simulationBoundary).toContain('模拟温湿度输入');
    }
  });

  it('keeps the original report exercise and built-in project template explicit', () => {
    const report = knowledgeById.get('5.3')?.resources?.find((resource) => resource.refId === 'ch05-ppt-s3');
    expect(report?.type).toBe('document');
    expect(report?.title).toContain('课程实验报告第9—10页');
    expect(resolveKnowledgeResourceHref(report!)).toBe('/resources/course/microcontroller-lab-report-1-8.pdf#page=9');
    const workflow = knowledgeById.get('9.1')?.resources?.find((resource) => resource.refId === 'doc-dev-workflow');
    expect(workflow?.type).toBe('document');
    expect(workflow?.title).toContain('内置模板');
    expect(resolveKnowledgeResourceHref(workflow!)).toBe('/simulation?experiment=proj04&view=guide');
    const brief = getTeachingContent('proj04')?.projectBrief;
    expect(brief?.evidenceStatus).toContain('暂无真实学生成果材料');
    expect(brief?.milestones.map((milestone) => milestone.id)).toEqual(['requirements', 'interfaces', 'implementation', 'integration', 'review']);
  });

  it('reuses verified report exercises and the existing interrupt animation without inventing resources', () => {
    const branch = knowledgeById.get('3.5')?.resources?.find((resource) => resource.refId === 'course-lab-carry-branch');
    const bit = knowledgeById.get('3.6')?.resources?.find((resource) => resource.refId === 'course-lab-carry-branch');
    expect(branch).toEqual(bit);
    expect(branch?.type).toBe('document');
    expect(resolveKnowledgeResourceHref(branch!)).toBe('/resources/course/microcontroller-lab-report-1-8.pdf#page=3');
    const c51 = knowledgeById.get('4.2')?.resources?.find((resource) => resource.refId === 'course-lab-c51-basics');
    expect(c51?.type).toBe('document');
    expect(resolveKnowledgeResourceHref(c51!)).toBe('/resources/course/microcontroller-lab-report-1-8.pdf#page=11');
    expect(knowledgeById.get('4.2')?.description).toContain('应读作unsigned char');
    const interrupt = knowledgeById.get('5.4')?.resources?.find((resource) => resource.type === 'animation');
    expect(interrupt?.refId).toBe('anim-interrupt-flow');
    expect(resolveKnowledgeResourceHref(interrupt!)).toBe('/simulation?experiment=exp06&view=guide&animation=interrupt-flow');
    expect(getTeachingContent('exp06')?.animations?.map((animation) => animation.id)).toContain('interrupt-flow');
  });

  it('derives every seeded chapter from the formal 10-chapter and 17-week curriculum', () => {
    const roots = getPointsByLevel(1).sort((left, right) => left.chapter - right.chapter);
    const levelTwoCounts = new Map<number, number>();
    getPointsByLevel(2).forEach((point) => {
      levelTwoCounts.set(point.chapter, (levelTwoCounts.get(point.chapter) ?? 0) + 1);
    });

    expect(COURSE_CHAPTER_SCHEDULE).toHaveLength(10);
    expect(COURSE_CHAPTER_SCHEDULE.map((chapter) => chapter.chapterId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `ch${index + 1}`),
    );
    COURSE_CHAPTER_SCHEDULE.forEach((chapter, index) => {
      const chapterNumber = index + 1;
      expect(chapter.name).toBe(`第${chapterNumber}章 ${roots[index]?.name}`);
      expect(chapter.moduleId).toBe(getModuleIdForChapter(chapterNumber));
      expect(COURSE_KA_COUNT_BY_CHAPTER[chapterNumber]).toBe(levelTwoCounts.get(chapterNumber));
    });

    const coveredWeeks = COURSE_CHAPTER_SCHEDULE.flatMap((chapter) => (
      Array.from({ length: chapter.weekEnd - chapter.weekStart + 1 }, (_, index) => chapter.weekStart + index)
    ));
    expect(coveredWeeks).toEqual(Array.from({ length: 17 }, (_, index) => index + 1));
  });

  it('keeps every problem parent and knowledge-point reference resolvable', () => {
    expect(problemIds.size).toBe(problemGraph.length);

    problemGraph.forEach((node) => {
      if (node.parentId) expect(problemIds.has(node.parentId)).toBe(true);
      node.relatedKnowledgePoints.forEach((id) => {
        expect(knowledgeById.has(id)).toBe(true);
      });
    });
  });

  it('routes every visible quiz to a declared topic or chapter assessment, never the comprehensive default', () => {
    const quizResources = knowledgePoints.flatMap((point) => (
      (point.resources ?? [])
        .filter((resource) => resource.type === 'quiz')
        .map((resource) => ({ point, resource, href: resolveKnowledgeResourceHref(resource, point.chapter) }))
    ));

    expect(quizResources).toHaveLength(28);
    quizResources.forEach(({ point, resource, href }) => {
      expect(href).toBeTruthy();
      expect(href).not.toBe('/quiz');
      if (resource.refId === 'quiz-ch3-addressing') expect(href).toBe('/quiz?topic=addressing-modes');
      else if (resource.refId === 'quiz-ch10-ai-literacy') expect(href).toBe('/quiz?topic=ai-literacy');
      else expect(href).toBe(`/quiz?chapter=${point.chapter}`);
    });
  });

  it('keeps every duplicated legacy graph alias explicit and deterministic', () => {
    const pointsByAlias = new Map<string, string[]>();
    knowledgePoints.forEach((point) => {
      if (!point.graphNodeId) return;
      pointsByAlias.set(point.graphNodeId, [...(pointsByAlias.get(point.graphNodeId) ?? []), point.id]);
    });
    const duplicatedAliases = [...pointsByAlias.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([alias]) => alias)
      .sort();

    expect(duplicatedAliases).toEqual(Object.keys(LEGACY_GRAPH_NODE_TARGETS).sort());
    Object.entries(LEGACY_GRAPH_NODE_TARGETS).forEach(([alias, targetId]) => {
      expect(pointsByAlias.get(alias)).toContain(targetId);
      expect(knowledgeById.has(targetId)).toBe(true);
    });
    expect(LEGACY_GRAPH_NODE_TARGETS.addressing_modes).toBe('3.1');
  });

  it('keeps the professional graph hierarchical and prerequisite-safe', () => {
    knowledgePoints.forEach((point) => {
      if (point.level > 1) {
        expect(point.parentId).toBeDefined();
        expect(knowledgeById.has(point.parentId || '')).toBe(true);
      }
      point.prerequisites?.forEach((id) => {
        expect(knowledgeById.has(id)).toBe(true);
        expect(id).not.toBe(point.id);
        expect(getPrerequisiteReason(point.id, id)?.trim()).toBeTruthy();
      });
    });

    const visited = new Set<string>();
    const active = new Set<string>();
    const visit = (id: string): void => {
      if (visited.has(id)) return;
      expect(active.has(id)).toBe(false);
      active.add(id);
      knowledgeById.get(id)?.prerequisites?.forEach(visit);
      active.delete(id);
      visited.add(id);
    };
    knowledgePoints.forEach((point) => visit(point.id));
  });

  it('keeps proj04 duration and implemented-resource claims consistent', () => {
    const projectResources = knowledgePoints.flatMap((point) => (
      (point.resources ?? []).filter((resource) => resource.refId === 'proj04')
    ));

    expect(projectResources).toHaveLength(3);
    projectResources.forEach((resource) => expect(resource.duration).toBe(240));
    expect(knowledgeById.get('7.4.4')?.appliedIn ?? []).not.toContain('proj04');
    expect(knowledgeById.get('8.1.3')?.appliedIn ?? []).not.toContain('proj04');
    expect(knowledgeById.get('8.4.1')?.appliedIn).toContain('proj04');
    expect(knowledgeById.get('8.4.2')?.appliedIn).toContain('proj04');
  });

  it('gives every concrete problem an executable knowledge remediation target', () => {
    problemGraph
      .filter((node) => node.level === 3)
      .forEach((node) => {
        expect(node.solution?.trim()).toBeTruthy();
        expect(node.relatedKnowledgePoints.length).toBeGreaterThan(0);
        const primaryKnowledgePointId = getProblemPrimaryKnowledgePointId(node);
        expect(primaryKnowledgePointId).toBeTruthy();
        expect(node.relatedKnowledgePoints).toContain(primaryKnowledgePointId);
        if (node.relatedKnowledgePoints.length > 1) {
          expect(node.primaryKnowledgePointId).toBe(primaryKnowledgePointId);
        }
        const plan = getProblemRemediationPlan(node);
        expect(plan).not.toBeNull();
        expect(plan?.actions[0]?.knowledgePointId).toBe(primaryKnowledgePointId);
      });
  });

  it('keeps audited problem concepts on their actual course knowledge points', () => {
    const auditedMappings: Record<string, string[]> = {
      'P1.2.1': ['3.1.2', '3.1.4'],
      'P1.2.4': ['3.1.7', '2.2.4'],
      'P1.3.2': ['5.4.2', '5.2.2'],
      'P1.3.3': ['5.3.1', '5.3.2'],
      'P1.3.4': ['5.2.4'],
      'P1.4.3': ['6.1.4'],
      'P1.5.1': ['7.2.3', '6.2.3'],
      'P1.5.3': ['7.2.2'],
      'P1.7.2': ['2.6', '2.6.4'],
      'P1.8.1': ['3.3.5'],
      'P2.1.1': ['4.2.1'],
      'P2.1.2': ['4.2'],
      'P2.1.3': ['4.2.2', '2.2'],
      'P2.1.4': ['4.2.3'],
      'P2.2.1': ['5.4.3', '4.4.1'],
      'P2.2.2': ['4.4.1', '5.2.4'],
      'P2.3.1': ['4.5.1', '2.4.2'],
      'P2.5.1': ['4.4.3'],
      'P2.5.2': ['4.4.3'],
      'P2.5.3': ['4.4.3', '3.4.5'],
      'P2.5.4': ['4.4.3', '3.6.4'],
      'P2.6.3': ['4.2.2', '2.2.1'],
      'P2.9.3': ['7.2.4'],
      'P2.10.2': ['4.3.4'],
      'P2.10.3': ['2.2.2', '4.2.2'],
      'P3.6.1': ['8.3.1', '8.3.2'],
      'P3.6.2': ['8.4.1'],
      'P3.6.3': ['7.4.3', '7.4.4'],
      'P3.6.4': ['8.5', '8.5.1', '8.5.2'],
      'P3.6.5': ['8.6.1', '2.3.5'],
      'P4.1.1': ['9.1.1'],
      'P4.1.3': ['9.1.2', '9.1.4', '9.1.5'],
      'P4.1.5': ['1.4.3', '2.7', '9.1.3'],
      'P4.2.2': ['7.4.3', '7.4.4'],
      'P4.3.1': ['2.7'],
      'P4.3.2': ['2.7', '9.1.3'],
      'P4.3.3': ['2.4.1'],
      'P4.4.1': ['2.5.3'],
      'P4.6.1': ['4.6.3'],
      'P4.6.2': ['4.6.3'],
      'P4.6.3': ['4.6.1', '4.6.2'],
      'P4.6.5': ['4.6.3'],
      'P4.8.1': ['9.2.1'],
      'P4.8.2': ['9.1.4', '4.3'],
      'P4.10.1': ['6.3.3', '9.3.4'],
      'P4.10.3': ['8.3.3', '8.3.4'],
      'P4.10.5': ['6.3.5', '2.4.1', '9.3.4'],
      'P4.10.7': ['8.5.2', '6.3.1'],
    };

    Object.entries(auditedMappings).forEach(([id, expectedKnowledgePoints]) => {
      expect(problemGraph.find((node) => node.id === id)?.relatedKnowledgePoints)
        .toEqual(expectedKnowledgePoints);
    });
  });

  it('marks taxonomy gaps instead of misclassifying them as RISC-V content', () => {
    const taxonomyGapIds = ['P4.4.2', 'P4.4.3', 'P4.4.4', 'P4.9.1', 'P4.9.3', 'P4.10.2'];

    taxonomyGapIds.forEach((id) => {
      const node = problemGraph.find((problem) => problem.id === id);
      expect(node?.taxonomyGapNote?.trim()).toBeTruthy();
      expect(node?.relatedKnowledgePoints.some((knowledgeId) => (
        knowledgeId === '10.3' || knowledgeId.startsWith('10.3.')
      ))).toBe(false);
    });
  });

  it('uses the explicit primary target even when it is not first in the related list', () => {
    const powerProblem = problemGraph.find((node) => node.id === 'P4.3.2');
    expect(powerProblem?.relatedKnowledgePoints[0]).toBe('2.7');
    expect(powerProblem?.primaryKnowledgePointId).toBe('9.1.3');

    const plan = powerProblem ? getProblemRemediationPlan(powerProblem) : null;
    expect(plan?.actions[0]).toMatchObject({
      knowledgePointId: '9.1.3',
      href: '/knowledge-graph?chapter=9&node=9.1.3',
    });
  });

  it('keeps every ideological node aligned with real knowledge points and chapters', () => {
    expect(ideologicalById.size).toBe(ideologicalNodes.length);

    ideologicalNodes.forEach((node) => {
      if (node.parentId) expect(ideologicalById.has(node.parentId)).toBe(true);
      node.relatedKnowledgePoints.forEach((id) => {
        const point = knowledgeById.get(id);
        expect(point).toBeDefined();
        expect(node.relatedChapters).toContain(point?.chapter);
      });
    });
  });

  it('keeps every ideological root chapter coverage equal to its children', () => {
    ideologicalNodes
      .filter((node) => node.level === 1)
      .forEach((root) => {
        const childChapters = ideologicalNodes
          .filter((node) => node.parentId === root.id)
          .flatMap((node) => node.relatedChapters);
        const expectedChapters = [...new Set(childChapters)].sort((left, right) => left - right);

        expect(root.relatedChapters).toEqual(expectedChapters);
      });
  });

  it('maps all 17 teaching weeks to explicit and semantically related nodes', () => {
    expect(sipMappings).toHaveLength(17);
    expect(sipMappings.map((mapping) => mapping.weekRange)).toEqual(
      Array.from({ length: 17 }, (_, index) => `第${index + 1}周`),
    );
    expect(new Set(sipMappings.map((mapping) => mapping.chapter))).toEqual(
      new Set(Array.from({ length: 10 }, (_, index) => index + 1)),
    );

    sipMappings.forEach((mapping) => {
      const point = knowledgeById.get(mapping.knowledgePointId);
      expect(point?.name).toBe(mapping.knowledgePointName);
      expect(point?.chapter).toBe(mapping.chapter);
      expect(mapping.ideologicalNodeIds.length).toBeGreaterThan(0);

      mapping.ideologicalNodeIds.forEach((id) => {
        const ideologicalNode = ideologicalById.get(id);
        expect(ideologicalNode).toBeDefined();
        expect(ideologicalNode?.relatedKnowledgePoints.some((knowledgeId) => (
          isHierarchicallyRelated(knowledgeId, mapping.knowledgePointId)
        ))).toBe(true);
      });
    });
  });

  it('reports graph statistics from the current data instead of legacy claims', () => {
    expect(ideologicalGraphStats.totalCategories).toBe(
      ideologicalNodes.filter((node) => node.level === 1).length,
    );
    expect(ideologicalGraphStats.totalElements).toBe(
      ideologicalNodes.filter((node) => node.level === 2).length,
    );
    expect(ideologicalGraphStats.totalWeeklyMappings).toBe(sipMappings.length);
    expect(ideologicalGraphStats.summary).not.toContain('100%');
  });

  it('keeps the addressing-mode weekly decision specific and inspectable', () => {
    const addressingMapping = sipMappings.find((mapping) => mapping.weekRange === '第3周');

    expect(addressingMapping).toMatchObject({
      knowledgePointId: '3.1',
      knowledgePointName: '寻址方式',
      ideologicalNodeIds: ['S2.1', 'S3.1'],
      ideologicalTheme: '严谨态度与规范意识',
    });
    expect(addressingMapping?.ideologicalContent).toContain('#号');
    expect(addressingMapping?.teachingMethod).toContain('操作数来源');
    expect(addressingMapping?.teachingMethod).toContain('有效地址');
    expect(addressingMapping?.expectedOutcome).toContain('正确选择寻址方式');

    const explicitMappings = getExplicitSipMappingsForKnowledgePoint('3.1');
    expect(explicitMappings).toHaveLength(1);
    expect(explicitMappings[0]?.ideologicalNodeIds).toEqual(['S2.1', 'S3.1']);
    expect(getExplicitSipMappingsForKnowledgePoint('3.1.1')).toEqual(explicitMappings);
  });

  it('turns a concrete addressing problem into an authoritative remediation sequence', () => {
    const addressingProblem = problemGraph.find((node) => node.id === 'P1.2.2');
    expect(addressingProblem).toBeDefined();

    const plan = addressingProblem ? getProblemRemediationPlan(addressingProblem) : null;
    expect(plan?.actions.map((action) => action.id)).toEqual(['review', 'verify', 'practice', 'retest']);
    expect(plan?.actions.map((action) => action.href)).toEqual([
      '/knowledge-graph?chapter=3&node=3.1.1',
      '/quiz?topic=addressing-modes',
      '/simulation?experiment=exp02',
      '/quiz?topic=addressing-modes&mode=retest',
    ]);
    expect(plan?.completionRule).toContain('服务端回执');
    expect(plan?.stateBoundary).toContain('不会静默推进任务');
  });

  it('keeps non-addressing remediation on valid chapter resources', () => {
    const timerProblem = problemGraph.find((node) => node.id === 'P1.4.2');
    expect(timerProblem).toBeDefined();

    const plan = timerProblem ? getProblemRemediationPlan(timerProblem) : null;
    expect(plan?.actions.map((action) => action.href)).toEqual([
      '/knowledge-graph?chapter=6&node=6.1',
      '/quiz?chapter=6',
    ]);
  });
});


describe('experiment run observation contract', () => {
  const readyObservation = (): ExperimentObservationEvidence => ({
    ...createExperimentObservation(), steps: 1000,
    portValues: {
      P0: [0, 1, 0x3f, 0x06],
      P1: [0xfe, 0xfd, 0xfb, 0xf7, 0xef, 0xdf, 0xbf, 0x7f, 0x10, 0x30, 0x20, 0x60],
      P2: [0xe0, 0xd0, 0xb0, 0x70, 0x71, 0x75], P3: [0xff, 0xfe],
    },
    ramValues: { '20': [0xff, 0], '21': [0, 1], '30': [128], '32': [127] },
    adcPwmPairs: [{ adc: 127, duty: 128 }],
    timerOverflows: { T0: 2, T1: 2 }, uartText: 'HELLO WORLD!', buzzerFrequencyHz: 440,
  });

  it.each(['exp01', 'exp03', 'exp04', 'exp05', 'exp06', 'exp07', 'exp08', 'exp09', 'proj01', 'proj02', 'proj03'])(
    '%s requires corresponding output, rather than execution count alone', (id) => {
      expect(validateExperimentObservation(id, readyObservation()).ok).toBe(true);
      expect(validateExperimentObservation(id, { ...createExperimentObservation(), steps: 10000000 }).ok).toBe(false);
      expect(validateExperimentObservation(id, { ...readyObservation(), steps: 1 }).ok).toBe(false);
    },
  );

  it('rejects malformed bytes and does not count duplicate LED patterns as eight outputs', () => {
    const observation = readyObservation();
    expect(validateExperimentObservation('exp01', { ...observation, portValues: { ...observation.portValues, P1: [256] } }).ok).toBe(false);
    expect(validateExperimentObservation('exp01', { ...observation, portValues: { ...observation.portValues, P1: Array(8).fill(0xfe) } }).ok).toBe(false);
    expect(validateExperimentObservation('exp02', observation).ok).toBe(false);
    expect(validateExperimentObservation('proj04', observation).ok).toBe(false);
  });

  it('requires same-sample ADC/PWM values and excludes static boundary duty values', () => {
    const observation = readyObservation();
    for (const adcPwmPairs of [[], [{ adc: 127, duty: 127 }], [{ adc: 255, duty: 0 }], [{ adc: 0, duty: 255 }]]) {
      expect(validateExperimentObservation('proj02', { ...observation, adcPwmPairs }).ok).toBe(false);
    }
    expect(validateExperimentObservation('proj02', { ...observation, portValues: { ...observation.portValues, P2: [0] } }).ok).toBe(false);
  });

  it('collects only executed states, adds actual instruction totals, and keeps paired samples intact', () => {
    const ram = new Uint8Array(128); ram[0x32] = 127; ram[0x30] = 128;
    const state = { portValues: { P0: 127, P1: 254, P2: 1, P3: 255 }, ram, timers: { overflowCount0: 2, overflowCount1: 0 }, uart: { transmitBuffer: 'HELLO WORLD!' }, buzzer: { frequency: 440 } };
    const empty = createExperimentObservation();
    expect(collectExperimentObservation(empty, state, 0)).toBe(empty);
    let observation = collectExperimentObservation(empty, state, 257);
    expect(observation.steps).toBe(257);
    expect(observation.portValues.P1).toEqual([254]);
    expect(observation.adcPwmPairs).toEqual([{ adc: 127, duty: 128 }]);
    ram[0x32] = 255; ram[0x30] = 0;
    observation = collectExperimentObservation(observation, state, 17);
    expect(observation.steps).toBe(274);
    expect(observation.adcPwmPairs).toEqual([{ adc: 127, duty: 128 }, { adc: 255, duty: 0 }]);
    expect(observation.timerOverflows.T0).toBe(2);
    expect(observation.portValues.P1).toEqual([254]);
  });
});
