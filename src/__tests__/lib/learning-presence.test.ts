import {
  buildClassActivity,
  capPresenceDuration,
  decidePresenceWrite,
  PRESENCE_BUCKET_MS,
  presenceBucket,
  presenceEventId,
  shouldSendPresence,
} from '@/lib/learning-presence';
import { resolveLessonVisit, describeLearningTarget, readEmbeddedSection } from '@/lib/classroom-sections';

describe('learning presence quotas', () => {
  const now = Math.floor(1_700_000_000_000 / PRESENCE_BUCKET_MS) * PRESENCE_BUCKET_MS;

  it('keeps one id for a student, target, and 15-minute bucket', () => {
    const bucket = presenceBucket(now);
    expect(presenceBucket(now + PRESENCE_BUCKET_MS - 1000)).toBe(bucket);
    expect(presenceBucket(now + PRESENCE_BUCKET_MS)).toBe(bucket + 1);
    const id = presenceEventId('student-1', 'SECTION_VISIT', 'KNOWLEDGE_POINT', '3.1#addressing', bucket);
    expect(id).toBe(presenceEventId('student-1', 'SECTION_VISIT', 'KNOWLEDGE_POINT', '3.1#addressing', bucket));
    expect(id).not.toBe(presenceEventId('student-2', 'SECTION_VISIT', 'KNOWLEDGE_POINT', '3.1#addressing', bucket));
    expect(id.startsWith('le_')).toBe(true);
  });

  it('inserts the first visit, skips a tight duration rewrite, then updates after the gap', () => {
    const inserted = decidePresenceWrite({
      existing: null,
      incomingDuration: 0,
      incomingMetadata: JSON.stringify({ sectionId: 'addressing' }),
      nowMs: now,
      insertsRemaining: 1,
    });
    expect(inserted.action).toBe('insert');
    if (inserted.action !== 'insert') return;
    expect(inserted.duration).toBe(0);
    expect(inserted.metadata).toContain('addressing');

    const tooSoon = decidePresenceWrite({
      existing: { duration: 0, metadata: inserted.metadata },
      incomingDuration: 120,
      incomingMetadata: null,
      nowMs: now + 30_000,
      insertsRemaining: 0,
    });
    expect(tooSoon).toEqual({ action: 'skip', reason: 'gap' });

    const updated = decidePresenceWrite({
      existing: { duration: 0, metadata: inserted.metadata },
      incomingDuration: 120,
      incomingMetadata: JSON.stringify({ sectionId: 'addressing' }),
      nowMs: now + 120_000,
      insertsRemaining: 0,
    });
    expect(updated).toMatchObject({ action: 'update', duration: 120 });
  });

  it('caps new rows and absurd durations', () => {
    expect(decidePresenceWrite({
      existing: null,
      incomingDuration: 1,
      incomingMetadata: null,
      nowMs: now,
      insertsRemaining: 0,
    })).toEqual({ action: 'skip', reason: 'cap' });
    expect(capPresenceDuration(99999)).toBe(15 * 60 + 45);
    expect(shouldSendPresence({
      eventType: 'SESSION_HEARTBEAT',
      durationSeconds: 10,
      lastSentDuration: null,
      lastSentAtMs: null,
      nowMs: now,
      closing: false,
    })).toBe(false);
    expect(shouldSendPresence({
      eventType: 'SECTION_VISIT',
      durationSeconds: 0,
      lastSentDuration: null,
      lastSentAtMs: null,
      nowMs: now,
      closing: false,
    })).toBe(true);
    expect(shouldSendPresence({
      eventType: 'SECTION_VISIT',
      durationSeconds: 90,
      lastSentDuration: 0,
      lastSentAtMs: now,
      nowMs: now + 30_000,
      closing: false,
    })).toBe(false);
    expect(shouldSendPresence({
      eventType: 'SECTION_VISIT',
      durationSeconds: 90,
      lastSentDuration: 0,
      lastSentAtMs: now,
      nowMs: now + 30_000,
      closing: true,
    })).toBe(true);
    expect(shouldSendPresence({
      eventType: 'SECTION_VISIT',
      durationSeconds: 600,
      lastSentDuration: 0,
      lastSentAtMs: now,
      nowMs: now + 4 * 60 * 1000,
      closing: false,
      minGapMs: 10 * 60 * 1000,
    })).toBe(false);
  });

  it('maps chapter 3–5 courseware anchors onto knowledge points', () => {
    expect(resolveLessonVisit({
      unitId: 3,
      noteFile: 'u3-overview',
      pointId: '3',
      sectionId: 'addressing',
    })).toMatchObject({ targetId: '3.1#addressing', chapterId: '3', knowledgePointId: '3.1' });
    expect(resolveLessonVisit({
      unitId: 5,
      noteFile: 'u5-overview',
      pointId: '5',
      sectionId: 'int-3',
    })).toMatchObject({ targetId: '5.2#int-3', chapterId: '5', knowledgePointId: '5.2' });
    expect(resolveLessonVisit({
      unitId: 5,
      noteFile: 'u5-overview',
      pointId: '5',
      sectionId: 'tmr-hand',
    })).toMatchObject({ targetId: '6.2#tmr-hand', chapterId: '6' });
    expect(resolveLessonVisit({
      unitId: 4,
      noteFile: 'u4-classroom',
      pointId: '3.5',
      sectionId: 'p-quiz',
    })).toMatchObject({ targetId: '3.5#p-quiz', chapterId: '3' });
    expect(describeLearningTarget('3.1#addressing')).toContain('寻址');
  });

  it('reads a same-origin courseware hash or the visible classroom pane', () => {
    expect(readEmbeddedSection({
      contentWindow: { location: { hash: '#int-3' }, document: { querySelector: () => null } },
    })).toBe('int-3');
    expect(readEmbeddedSection({
      contentWindow: { location: { hash: '' }, document: { querySelector: () => ({ id: 'p-quiz' }) } },
    })).toBe('p-quiz');
  });

  it('splits a class into studied and not studied from section visits and quiz completions', () => {
    const summary = buildClassActivity([
      { id: 'studied', name: '已学同学', username: 'TEST0872001', studentId: 'TEST0872001', lastLoginAt: new Date(now) },
      { id: 'quiet', name: '未学同学', username: 'quiet', studentId: 'S002', lastLoginAt: null },
    ], [
      {
        userId: 'studied',
        eventType: 'SECTION_VISIT',
        targetId: '3.1#addressing',
        chapterId: '3',
        lastAt: new Date(now + 60_000),
        durationSeconds: 180,
        count: 1,
      },
      {
        userId: 'studied',
        eventType: 'COMPLETE_QUIZ',
        targetId: 'quiz-ch3',
        chapterId: '3',
        lastAt: new Date(now + 120_000),
        durationSeconds: 40,
        count: 1,
      },
    ]);

    expect(summary.studied).toBe(1);
    expect(summary.notStudied).toBe(1);
    expect(summary.students[0]).toMatchObject({
      id: 'studied',
      studied: true,
      durationSeconds: 180,
      quizCompletions: 1,
    });
    expect(summary.students[1]).toMatchObject({ id: 'quiet', studied: false, lastActiveAt: null });
  });
});
