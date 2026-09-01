import { resolveChapterSelection, type KnowledgePoint } from '@/lib/knowledge-points';
import { mergeKnowledgePointCatalog } from '@/lib/knowledge-source';

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
