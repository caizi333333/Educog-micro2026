import { knowledgePoints, resolveChapterSelection, type KnowledgePoint, type KnowledgePointResource } from '@/lib/knowledge-points';
import { fetchKnowledgePoints, invalidateKnowledgeCache, mergeKnowledgePointCatalog } from '@/lib/knowledge-source';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({ prisma: { knowledgeNode: { count: jest.fn(), findMany: jest.fn() } } }));

const points: KnowledgePoint[] = [
  { id: '1', name: '第一章', level: 1, chapter: 1 },
  { id: '1.1', name: '第一章节', level: 2, chapter: 1 },
  { id: '3', name: '第三章', level: 1, chapter: 3 },
  { id: '3.1', name: '寻址方式', level: 2, chapter: 3 },
];

describe('resolveChapterSelection', () => {
  it('preserves a selected point when it belongs to the requested chapter', () => {
    expect(resolveChapterSelection(points, 3, '3.1')).toBe('3.1');
  });

  it('moves an out-of-chapter selection to the requested chapter root', () => {
    expect(resolveChapterSelection(points, 3, '1.1')).toBe('3');
  });

  it('returns an empty selection when the requested chapter has no point', () => {
    expect(resolveChapterSelection(points, 9, '1')).toBe('');
  });
});

describe('mergeKnowledgePointCatalog', () => {
  const mergeResources = (id: string, resources: KnowledgePointResource[], description?: string) => {
    const original = knowledgePoints.find((point) => point.id === id)!;
    return mergeKnowledgePointCatalog([{ ...original, resources, ...(description ? { description } : {}) }])
      .find((point) => point.id === id)!;
  };

  it.each([
    ['3.5', 'ch03-ppt-s5', 'slide', '3.5 控制转移指令 课件', 'course-lab-carry-branch'],
    ['3.6', 'ch03-ppt-s6', 'slide', '3.6 位操作指令 课件', 'course-lab-carry-branch'],
    ['4.2', 'ch04-ppt-s2', 'slide', '4.2 C51数据类型 课件', 'course-lab-c51-basics'],
    ['5.4', 'anim-interrupt-response', 'animation', '中断响应全过程时序动画', 'anim-interrupt-flow'],
  ])('upgrades the identified old placeholder at %s without restoring other removed resources', (id, refId, type, title, replacementRefId) => {
    const merged = mergeResources(id, [{ refId, type: type as KnowledgePointResource['type'], title }]);
    expect(merged.resources).toHaveLength(1);
    expect(merged.resources?.[0].refId).toBe(replacementRefId);
  });

  it('upgrades a matching unlinked slide in place and keeps teacher URLs and unknown entries', () => {
    const custom: KnowledgePointResource = { type: 'slide', refId: 'teacher-reference', title: '教师补充', url: 'https://example.edu/course.pdf' };
    const unknown: KnowledgePointResource = { type: 'document', refId: 'teacher-planned', title: '教师保留的待整理资料' };
    const merged = mergeResources('7.2', [{ type: 'slide', refId: 'ch07-ppt-s2', title: '7.2 89C51串口 课件' }, custom, unknown]);
    expect(merged.resources).toHaveLength(3);
    expect(merged.resources?.[0].url).toBe('/resources/course/course-slides.pdf#page=21');
    expect(merged.resources?.slice(1)).toEqual([custom, unknown]);
  });

  it('preserves explicit URLs and custom placeholder titles even when a legacy ref matches', () => {
    const withUrl: KnowledgePointResource = { type: 'slide', refId: 'ch03-ppt-s5', title: '教师专用讲义', url: 'https://example.edu/custom.pdf' };
    const customTitle: KnowledgePointResource = { type: 'slide', refId: 'ch03-ppt-s5', title: '教师重新规划的资料' };
    expect(mergeResources('3.5', [withUrl]).resources).toEqual([withUrl]);
    expect(mergeResources('3.5', [customTitle]).resources).toEqual([customTitle]);
    expect(mergeResources('3.5', []).resources).toEqual([]);
  });

  it('deduplicates an upgraded placeholder beside its identical replacement but retains a custom URL', () => {
    const source = knowledgePoints.find((point) => point.id === '3.5')!.resources![0];
    const custom = { ...source, url: 'https://example.edu/teacher.pdf' };
    const merged = mergeResources('3.5', [{ type: 'slide', refId: 'ch03-ppt-s5', title: '3.5 控制转移指令 课件' }, source, custom]);
    expect(merged.resources).toEqual([source, custom]);
    const sibling = mergeResources('3.6', [{ type: 'slide', refId: 'ch03-ppt-s6', title: '3.6 位操作指令 课件' }]);
    expect(new Set([merged.resources![0].refId, sibling.resources![0].refId]).size).toBe(1);
  });

  it('retains teacher descriptions and labels the current erratum only beside the matching course document', () => {
    const customDescription = '教师补充的数据类型说明。';
    const merged = mergeResources('4.2', [{ type: 'slide', refId: 'ch04-ppt-s2', title: '4.2 C51数据类型 课件' }], customDescription);
    expect(merged.description).toContain(customDescription);
    expect(merged.description).toContain('课程资料阅读提示：');
    expect(merged.description).toContain('uansigned char应读作unsigned char');
    const custom = mergeResources('4.2', [{ type: 'document', refId: 'course-lab-c51-basics', title: '教师其他文件', url: 'https://example.edu/custom.pdf' }], customDescription);
    expect(custom.description).toBe(customDescription);
  });

  it('keeps null and empty database resource fields empty through the actual read conversion', async () => {
    invalidateKnowledgeCache();
    (prisma.knowledgeNode.count as jest.Mock).mockResolvedValue(2);
    (prisma.knowledgeNode.findMany as jest.Mock).mockResolvedValue(['3.5', '3.6'].map((id, index) => ({
      ...knowledgePoints.find((point) => point.id === id), resources: index === 0 ? null : [],
    })));
    const result = await fetchKnowledgePoints();
    expect(result.source).toBe('db');
    expect(result.points.find((point) => point.id === '3.5')?.resources).toEqual([]);
    expect(result.points.find((point) => point.id === '3.6')?.resources).toEqual([]);
    invalidateKnowledgeCache();
  });

  it('ignores malformed resource entries without dropping valid teacher edits or the database catalog', async () => {
    invalidateKnowledgeCache();
    const custom: KnowledgePointResource = { type: 'document', title: '教师资料', url: 'https://example.edu/teacher.pdf' };
    (prisma.knowledgeNode.count as jest.Mock).mockResolvedValue(1);
    (prisma.knowledgeNode.findMany as jest.Mock).mockResolvedValue([{
      ...knowledgePoints.find((point) => point.id === '3.5'), name: '教师修订标题', resources: [null, [], 'invalid', { type: 'slide' }, custom],
    }]);
    const result = await fetchKnowledgePoints();
    expect(result.source).toBe('db');
    expect(result.points.find((point) => point.id === '3.5')).toMatchObject({ name: '教师修订标题', resources: [custom] });
    invalidateKnowledgeCache();
  });

  it('keeps the complete shipped catalog when the database is only partially seeded', () => {
    const partialDatabase: KnowledgePoint[] = [
      { id: '3.1', name: '寻址方式（教师修订）', level: 2, parentId: '3', chapter: 3 },
    ];

    const merged = mergeKnowledgePointCatalog(partialDatabase);

    expect(merged.length).toBeGreaterThan(partialDatabase.length);
    expect(merged.find((point) => point.id === '3.1')?.name).toBe('寻址方式（教师修订）');
    expect(merged.some((point) => point.id === '10.5')).toBe(true);
  });

  it('ignores database rows whose parent or prerequisite cannot be resolved', () => {
    const invalidDatabase: KnowledgePoint[] = [
      { id: '11.1', name: '孤立节点', level: 2, parentId: '11', chapter: 11, prerequisites: ['99'] },
    ];

    expect(mergeKnowledgePointCatalog(invalidDatabase).some((point) => point.id === '11.1')).toBe(false);
  });
});
