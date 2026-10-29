import { getAllowedRolesForPath } from '@/lib/role-access';
import {
  buildDailyClassPulse,
  DAILY_PULSE_RECENT_LIMIT,
  isDemoRosterAccount,
  officialClassLabel,
  type DailyPulseEvent,
  type DailyPulseRosterRow,
} from '@/lib/daily-class-pulse';

const asOf = new Date('2026-10-28T16:30:00.000Z');
const today = new Date('2026-10-28T16:10:00.000Z');
const yesterday = new Date('2026-10-28T15:30:00.000Z');

const classes = [
  { id: 'c-872-1', name: '0872-001' },
  { id: 'c-872-2', name: ' 0872-002 ' },
  { id: 'c-3084-1', name: '3084-001' },
  { id: 'c-3084-2', name: '3084-002' },
  { id: 'old', name: '机电2401' },
  { id: 'shell', name: '智工2401' },
];

function row(partial: Partial<DailyPulseRosterRow> & Pick<DailyPulseRosterRow, 'classId' | 'userId' | 'username'>): DailyPulseRosterRow {
  return {
    name: partial.name ?? partial.username,
    studentId: partial.studentId ?? partial.username,
    lastLoginAt: partial.lastLoginAt ?? null,
    ...partial,
  };
}

function event(partial: Partial<DailyPulseEvent> & Pick<DailyPulseEvent, 'userId' | 'eventType'>): DailyPulseEvent {
  return {
    classId: partial.classId ?? 'c-872-1',
    lastAt: partial.lastAt ?? today,
    durationSeconds: partial.durationSeconds ?? 0,
    ...partial,
  };
}

describe('daily class pulse', () => {
  it('labels 0872 as 智工 and leaves 3084 as the class code', () => {
    expect(officialClassLabel('0872-001')).toBe('智工 0872-001');
    expect(officialClassLabel(' 0872-002 ')).toBe('智工 0872-002');
    expect(officialClassLabel('3084-001')).toBe('3084-001');
  });

  it('recognizes TEST, demo_, and 测试- accounts without hiding ordinary names', () => {
    expect(isDemoRosterAccount({ username: ' test0872 ' })).toBe(true);
    expect(isDemoRosterAccount({ username: 'demo_student' })).toBe(true);
    expect(isDemoRosterAccount({ username: 'S100', name: '测试-演示' })).toBe(true);
    expect(isDemoRosterAccount({ username: '测试-01', name: '甲' })).toBe(true);
    expect(isDemoRosterAccount({ username: 'S100', name: '测试员' })).toBe(false);
  });

  it('keeps the page on the teacher and admin route list', () => {
    expect(getAllowedRolesForPath('/teacher/daily')).toEqual(['TEACHER', 'ADMIN']);
    expect(getAllowedRolesForPath('/teacher/daily')?.includes('STUDENT')).toBe(false);
  });

  it('counts Shanghai today for the four official classes and folds demo accounts out', () => {
    const pulse = buildDailyClassPulse({
      asOf,
      viewerSeesAllClasses: true,
      classes,
      roster: [
        row({ classId: 'c-872-1', userId: 'real', username: 'S001', name: '正式甲', lastLoginAt: today }),
        row({ classId: 'c-872-1', userId: 'late', username: 'S002', name: '昨晚登录', lastLoginAt: yesterday }),
        row({ classId: 'c-872-1', userId: 'smoke-a', username: 'TESTA', name: '自测甲', lastLoginAt: today }),
        row({ classId: 'c-872-1', userId: 'smoke-b', username: 'TESTB', name: '自测乙', lastLoginAt: today }),
        row({ classId: 'c-872-1', userId: 'labeled', username: 'S009', name: '测试-演示', lastLoginAt: today }),
        row({ classId: 'c-872-2', userId: 'quiet', username: 'S003', name: '未到', lastLoginAt: null }),
        row({ classId: 'old', userId: 'history', username: 'S2401', name: '往期', lastLoginAt: today }),
        row({ classId: 'c-872-1', userId: 'real', username: 'S001', name: '正式甲', lastLoginAt: yesterday }),
      ],
      events: [
        event({ userId: 'real', eventType: 'SECTION_VISIT', durationSeconds: 90 }),
        event({ userId: 'real', eventType: 'SECTION_VISIT', durationSeconds: 30, lastAt: new Date('2026-10-28T16:20:00.000Z') }),
        event({ userId: 'late', eventType: 'SECTION_VISIT', lastAt: yesterday, durationSeconds: 600 }),
        event({ userId: 'late', eventType: 'COMPLETE_QUIZ', lastAt: today }),
        event({ userId: 'smoke-a', eventType: 'SECTION_VISIT', durationSeconds: 50 }),
        event({ userId: 'history', classId: 'old', eventType: 'SECTION_VISIT', durationSeconds: 999 }),
        event({ userId: 'quiet', classId: 'c-872-2', eventType: 'LOGIN' }),
        event({ userId: 'visitor', classId: 'c-872-2', eventType: 'PAGE_VIEW' }),
      ],
    });

    expect(pulse.dateKey).toBe('2026-10-29');
    expect(pulse.timeZone).toBe('Asia/Shanghai');
    expect(pulse.windowStart).toBe('2026-10-28T16:00:00.000Z');
    expect(pulse.windowEnd).toBe('2026-10-29T16:00:00.000Z');
    expect(pulse.classes.map((classGroup) => classGroup.code)).toEqual(['0872-001', '0872-002', '3084-001', '3084-002']);
    expect(pulse.classes.map((classGroup) => classGroup.label)).toEqual([
      '智工 0872-001',
      '智工 0872-002',
      '3084-001',
      '3084-002',
    ]);

    expect(pulse.classes[0]).toMatchObject({
      availability: 'visible',
      rosterCount: 2,
      loggedInCount: 1,
      studiedCount: 2,
    });
    expect(pulse.classes[0]?.students.map((student) => student.id)).toEqual(['real', 'late']);
    expect(pulse.classes[0]?.students[0]).toMatchObject({
      loggedIn: true,
      studied: true,
      durationSeconds: 120,
      lastStudyAt: '2026-10-28T16:20:00.000Z',
    });
    expect(pulse.classes[0]?.students[1]).toMatchObject({
      id: 'late',
      loggedIn: false,
      studied: true,
      durationSeconds: 0,
    });

    expect(pulse.classes[1]).toMatchObject({
      rosterCount: 1,
      loggedInCount: 1,
      studiedCount: 0,
    });
    expect(pulse.classes[1]?.students[0]).toMatchObject({ id: 'quiet', studied: false, loggedIn: true });
    expect(pulse.classes[2]).toMatchObject({ availability: 'visible', rosterCount: 0, loggedInCount: 0 });
    expect(pulse.classes[3]).toMatchObject({ availability: 'visible', rosterCount: 0 });

    expect(pulse.demo.count).toBe(3);
    expect(pulse.demo.students.map((student) => student.username).sort()).toEqual(['S009', 'TESTA', 'TESTB']);
    expect(pulse.demo.students.every((student) => student.classCode === '0872-001')).toBe(true);
    expect(JSON.stringify(pulse)).not.toContain('往期');
    expect(JSON.stringify(pulse)).not.toContain('智工2401');
  });

  it('marks classes a teacher cannot open as out of scope and classes an admin lacks as missing', () => {
    const roster = [row({ classId: 'c-872-1', userId: 'real', username: 'S001', lastLoginAt: today })];
    const teacher = buildDailyClassPulse({
      asOf,
      viewerSeesAllClasses: false,
      classes: [{ id: 'c-872-1', name: '0872-001' }],
      roster,
      events: [],
    });
    const admin = buildDailyClassPulse({
      asOf,
      viewerSeesAllClasses: true,
      classes: [{ id: 'c-872-1', name: '0872-001' }],
      roster,
      events: [],
    });

    expect(teacher.classes.map((classGroup) => classGroup.availability)).toEqual([
      'visible', 'out-of-scope', 'out-of-scope', 'out-of-scope',
    ]);
    expect(admin.classes.map((classGroup) => classGroup.availability)).toEqual([
      'visible', 'missing', 'missing', 'missing',
    ]);
    expect(teacher.classes[1]).toMatchObject({ rosterCount: 0, students: [] });
  });

  it('caps the recent official list and does not treat login-only events as study', () => {
    const roster = Array.from({ length: DAILY_PULSE_RECENT_LIMIT + 2 }, (_, index) => row({
      classId: 'c-872-1',
      userId: `s${index}`,
      username: `S${index}`,
      lastLoginAt: new Date(today.getTime() + index * 1000),
    }));
    const pulse = buildDailyClassPulse({
      asOf: new Date(today.getTime() + 60_000),
      viewerSeesAllClasses: false,
      classes: [{ id: 'c-872-1', name: '0872-001' }],
      roster,
      events: [event({ userId: 's0', eventType: 'LOGIN', lastAt: today }), event({ userId: 's0', eventType: 'PAGE_VIEW' })],
    });
    expect(pulse.classes[0]).toMatchObject({
      loggedInCount: DAILY_PULSE_RECENT_LIMIT + 2,
      studiedCount: 0,
      omittedActiveCount: 2,
    });
    expect(pulse.classes[0]?.students).toHaveLength(DAILY_PULSE_RECENT_LIMIT);
    expect(pulse.classes[0]?.students[0]?.studied).toBe(false);
  });
});
