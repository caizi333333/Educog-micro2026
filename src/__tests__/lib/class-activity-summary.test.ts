import {
  buildClassActivity,
  type ClassActivityEventGroup,
  type ClassActivityRosterStudent,
} from '@/lib/learning-presence-shared';

const since = new Date('2026-10-20T10:00:00.000Z');
const asOf = new Date('2026-10-27T10:00:00.000Z');
const window = { since, asOf };

function student(id: string, lastLoginAt: Date | null): ClassActivityRosterStudent {
  return { id, name: id, username: id, studentId: id, lastLoginAt };
}

function event(userId: string, eventType: string, lastAt: Date | null): ClassActivityEventGroup {
  return { userId, eventType, targetId: '3.1#addressing', chapterId: '3', lastAt, durationSeconds: 180, count: 2 };
}

describe('seven-day class activity window', () => {
  it.each([
    ['old login', new Date(since.getTime() - 1), null],
    ['lower boundary', since, since.toISOString()],
    ['recent login', new Date('2026-10-26T08:00:00.000Z'), '2026-10-26T08:00:00.000Z'],
    ['upper boundary', asOf, asOf.toISOString()],
    ['future login', new Date(asOf.getTime() + 1), null],
    ['no login', null, null],
    ['invalid login', new Date(Number.NaN), null],
  ])('handles %s without treating login as learning', (_label, lastLoginAt, expected) => {
    const summary = buildClassActivity([student('login-only', lastLoginAt)], [], window);
    expect(summary).toMatchObject({ studied: 0, notStudied: 1 });
    expect(summary.students[0]).toMatchObject({
      lastActiveAt: expected,
      studied: false,
      durationSeconds: 0,
      quizCompletions: 0,
      recentTargets: [],
    });
  });

  it('uses the latest in-window event when login is old or future', () => {
    const sectionAt = new Date('2026-10-25T10:00:00.000Z');
    const quizAt = new Date('2026-10-26T10:00:00.000Z');
    const summary = buildClassActivity([
      student('old-login', new Date(since.getTime() - 1)),
      student('future-login', new Date(asOf.getTime() + 1)),
      student('quiet', null),
    ], [
      event('old-login', 'SECTION_VISIT', sectionAt),
      event('old-login', 'COMPLETE_QUIZ', quizAt),
      event('future-login', 'SECTION_VISIT', sectionAt),
    ], window);

    expect(summary).toMatchObject({ studied: 2, notStudied: 1 });
    expect(summary.students[0]).toMatchObject({
      id: 'old-login', lastActiveAt: quizAt.toISOString(), studied: true,
      durationSeconds: 180, quizCompletions: 2,
    });
    expect(summary.students[1]).toMatchObject({
      id: 'future-login', lastActiveAt: sectionAt.toISOString(), studied: true,
    });
    expect(summary.students[2]).toMatchObject({ id: 'quiet', studied: false, lastActiveAt: null });
  });

  it('keeps recent login activity newer than a qualifying learning event', () => {
    const summary = buildClassActivity([student('learner', asOf)], [
      event('learner', 'RESOURCE_OPENED', since),
    ], window);
    expect(summary.students[0]).toMatchObject({ studied: true, lastActiveAt: asOf.toISOString(), durationSeconds: 0 });
  });

  it.each(['LOGIN', 'PAGE_VIEW', 'SESSION_HEARTBEAT'])('%s alone remains not studied', (type) => {
    const summary = buildClassActivity([student('visitor', null)], [event('visitor', type, asOf)], window);
    expect(summary.students[0]).toMatchObject({ studied: false, lastActiveAt: asOf.toISOString(), durationSeconds: 0 });
  });

  it('includes both event boundaries and excludes old/future/null event groups', () => {
    const summary = buildClassActivity([
      student('start', null), student('end', null), student('outside', null),
    ], [
      event('start', 'SECTION_VISIT', since),
      event('end', 'COMPLETE_QUIZ', asOf),
      event('outside', 'SECTION_VISIT', new Date(since.getTime() - 1)),
      event('outside', 'COMPLETE_QUIZ', new Date(asOf.getTime() + 1)),
      event('outside', 'RESOURCE_COMPLETED', null),
    ], window);
    expect(summary).toMatchObject({ studied: 2, notStudied: 1 });
    expect(summary.students.map((item) => item.id)).toEqual(['end', 'start', 'outside']);
    expect(summary.students[2]).toMatchObject({
      lastActiveAt: null, studied: false, durationSeconds: 0, quizCompletions: 0, recentTargets: [],
    });
  });
});
