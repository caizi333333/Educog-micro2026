import {
  CURRENT_CLASS_CODES,
  CURRENT_SEMESTER,
  filterClassesByTeachingScope,
  filterTeachingRoster,
  isCurrentTermClass,
  isSmokeTestUsername,
  parseTeachingScope,
  shouldCapSmokeTests,
} from '@/lib/current-term';

const CURRENT_CLASSES = CURRENT_CLASS_CODES.map((name, index) => ({
  id: `current-${index}`,
  name,
  semester: CURRENT_SEMESTER,
}));

const LEGACY_CLASSES = [
  { id: 'legacy-2401', name: '机电2401', semester: '2025-2026-1' },
  { id: 'legacy-2402', name: '机电2402', semester: '2025-2026-1' },
  { id: 'shell-2401', name: '智工2401', semester: CURRENT_SEMESTER },
  { id: 'shell-2402', name: '智工2402', semester: null },
];

describe('current term class scope', () => {
  it('treats only the four current class names as this term', () => {
    for (const classGroup of CURRENT_CLASSES) {
      expect(isCurrentTermClass(classGroup)).toBe(true);
    }
    expect(isCurrentTermClass({ name: ' 0872-001 ' })).toBe(true);
    for (const classGroup of LEGACY_CLASSES) {
      expect(isCurrentTermClass(classGroup)).toBe(false);
    }
    const legacyNameWithCurrentSemester = { name: '机电2401', semester: CURRENT_SEMESTER };
    expect(isCurrentTermClass(legacyNameWithCurrentSemester)).toBe(false);
    expect(isCurrentTermClass({ name: '验证测试班' })).toBe(false);
  });

  it('defaults to the current term and lists legacy classes only under history', () => {
    const classes = [...CURRENT_CLASSES, ...LEGACY_CLASSES];

    expect(parseTeachingScope(null)).toBe('current');
    expect(parseTeachingScope('current')).toBe('current');
    expect(parseTeachingScope('history')).toBe('history');
    expect(parseTeachingScope('archive')).toBe('current');

    expect(filterClassesByTeachingScope(classes, 'current').map((classGroup) => classGroup.name))
      .toEqual([...CURRENT_CLASS_CODES]);
    expect(filterClassesByTeachingScope(classes, 'history').map((classGroup) => classGroup.name))
      .toEqual(['机电2401', '机电2402', '智工2401', '智工2402']);
  });

  it('keeps one TEST account per current class and leaves history rosters unchanged', () => {
    const rows = [
      { userId: 'real-1', classId: '0872-001', username: 'S001' },
      { userId: 'test-b', classId: '0872-001', username: 'TESTB' },
      { userId: 'test-a', classId: '0872-001', username: 'testA' },
      { userId: 'real-2', classId: '3084-001', username: 'S002' },
      { userId: 'test-2', classId: '3084-001', username: 'TEST3084' },
      { userId: 'old-test-1', classId: '机电2401', username: 'TEST2401A' },
      { userId: 'old-test-2', classId: '机电2401', username: 'TEST2401B' },
    ];
    const memberOf = (row: typeof rows[number]) => row;

    expect(isSmokeTestUsername(' test0872 ')).toBe(true);
    expect(isSmokeTestUsername('S001')).toBe(false);
    expect(isSmokeTestUsername('demo_student')).toBe(false);
    expect(shouldCapSmokeTests(CURRENT_CLASSES)).toBe(true);
    expect(shouldCapSmokeTests(LEGACY_CLASSES)).toBe(false);
    expect(shouldCapSmokeTests([])).toBe(false);

    const current = filterTeachingRoster(rows.slice(0, 5), memberOf, true);
    expect(current.omittedSmokeTestCount).toBe(1);
    expect(current.rows.map((row) => row.userId)).toEqual(['real-1', 'test-a', 'real-2', 'test-2']);

    const history = filterTeachingRoster(rows.slice(5), memberOf, false);
    expect(history.omittedSmokeTestCount).toBe(0);
    expect(history.rows).toHaveLength(2);
  });
});
