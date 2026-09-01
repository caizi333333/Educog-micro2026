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
} from '@/lib/knowledge-points';
import { getModuleIdForChapter } from '@/lib/lesson-tasks';
import {
  getProblemPrimaryKnowledgePointId,
  getProblemRemediationPlan,
  problemGraph,
} from '@/lib/problem-graph';
import { COURSE_CHAPTER_SCHEDULE, COURSE_KA_COUNT_BY_CHAPTER } from '@/lib/course-curriculum';

const isHierarchicallyRelated = (left: string, right: string): boolean => (
  left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`)
);

describe('three graph data integrity', () => {
  const knowledgeById = new Map(knowledgePoints.map((point) => [point.id, point]));
  const problemIds = new Set(problemGraph.map((node) => node.id));
  const ideologicalById = new Map(ideologicalNodes.map((node) => [node.id, node]));

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
