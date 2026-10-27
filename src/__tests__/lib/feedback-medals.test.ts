import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { feedbackMedalIdsForCount, listFeedbackMedals, VALID_FEEDBACK_STAT } from '@/lib/feedback-medals';
import {
  campusDayStart,
  evaluateFeedbackRateLimit,
  FEEDBACK_MAX_PER_CAMPUS_DAY,
  FEEDBACK_MIN_INTERVAL_MS,
  parseFeedbackSubmission,
  presentTeacherFeedback,
  resolveFeedbackPagePath,
} from '@/lib/feedback-policy';

const validBody = '测验提交后页面没有回到成绩，我重复试了两次。';

describe('feedback medals', () => {
  it('awards the 1st, 2nd, and 3rd valid feedback and stays open for a later count', () => {
    expect(listFeedbackMedals().map((medal) => [medal.id, medal.criteria.target, medal.title])).toEqual([
      ['feedback_first', 1, '首次反馈'],
      ['feedback_second', 2, '二次反馈'],
      ['feedback_third', 3, '三次反馈'],
    ]);
    expect(ACHIEVEMENTS_V2.filter((medal) => medal.criteria.type === VALID_FEEDBACK_STAT)).toHaveLength(3);
    expect(feedbackMedalIdsForCount(0)).toEqual([]);
    expect(feedbackMedalIdsForCount(1)).toEqual(['feedback_first']);
    expect(feedbackMedalIdsForCount(2)).toEqual(['feedback_first', 'feedback_second']);
    expect(feedbackMedalIdsForCount(3)).toEqual(['feedback_first', 'feedback_second', 'feedback_third']);
    expect(feedbackMedalIdsForCount(9)).toEqual(['feedback_first', 'feedback_second', 'feedback_third']);
  });
});

describe('feedback submission policy', () => {
  it('rejects empty, too-short, and single-character spam', () => {
    expect(parseFeedbackSubmission({ category: 'bug', body: '   ' }).ok).toBe(false);
    expect(parseFeedbackSubmission({ category: 'bug', body: '太短了' }).ok).toBe(false);
    expect(parseFeedbackSubmission({ category: 'bug', body: '啊啊啊啊啊啊啊啊啊啊' }).ok).toBe(false);
    expect(parseFeedbackSubmission({ category: 'nope', body: validBody }).ok).toBe(false);
  });

  it('keeps a named submission unless anonymous is exactly true', () => {
    const named = parseFeedbackSubmission({ category: 'suggestion', body: validBody, anonymous: false, pagePath: '/quiz' });
    const anonymous = parseFeedbackSubmission({ category: 'ux', body: validBody, anonymous: true });
    const stringFlag = parseFeedbackSubmission({ category: 'ux', body: validBody, anonymous: 'true' });
    expect(named).toMatchObject({ ok: true, value: { anonymous: false, pagePath: '/quiz' } });
    expect(anonymous).toMatchObject({ ok: true, value: { anonymous: true, pagePath: null } });
    expect(stringFlag).toMatchObject({ ok: true, value: { anonymous: false } });
  });

  it('keeps the page the student was browsing when that path is safe', () => {
    expect(resolveFeedbackPagePath('/quiz?chapter=2', '/feedback')).toBe('/quiz?chapter=2');
    expect(resolveFeedbackPagePath('https://evil.example/steal', '/simulation')).toBe('/simulation');
    expect(resolveFeedbackPagePath('//evil.example', '/feedback')).toBe('/feedback');
  });

  it('uses the Asia/Shanghai day and blocks bursts plus the daily cap', () => {
    const eveningBeforeMidnight = new Date('2026-10-27T15:30:00.000Z');
    expect(campusDayStart(eveningBeforeMidnight).toISOString()).toBe('2026-10-26T16:00:00.000Z');
    expect(campusDayStart(new Date('2026-10-27T16:30:00.000Z')).toISOString()).toBe('2026-10-27T16:00:00.000Z');

    const tooSoon = evaluateFeedbackRateLimit({
      now: eveningBeforeMidnight,
      latestCreatedAt: new Date(eveningBeforeMidnight.getTime() - FEEDBACK_MIN_INTERVAL_MS + 1000),
      submissionsOnCampusDay: 1,
    });
    expect(tooSoon.ok).toBe(false);
    if (!tooSoon.ok) expect(tooSoon.retryAfterSeconds).toBe(1);

    const dailyCap = evaluateFeedbackRateLimit({
      now: eveningBeforeMidnight,
      latestCreatedAt: new Date(eveningBeforeMidnight.getTime() - FEEDBACK_MIN_INTERVAL_MS),
      submissionsOnCampusDay: FEEDBACK_MAX_PER_CAMPUS_DAY,
    });
    expect(dailyCap.ok).toBe(false);

    const allowed = evaluateFeedbackRateLimit({
      now: eveningBeforeMidnight,
      latestCreatedAt: new Date(eveningBeforeMidnight.getTime() - FEEDBACK_MIN_INTERVAL_MS),
      submissionsOnCampusDay: FEEDBACK_MAX_PER_CAMPUS_DAY - 1,
    });
    expect(allowed).toEqual({ ok: true });
  });
});

describe('teacher feedback redaction', () => {
  const createdAt = new Date('2026-10-27T01:00:00.000Z');

  it('hides the student name and student id when the row is anonymous', () => {
    const view = presentTeacherFeedback({
      id: 'fb-anon',
      anonymous: true,
      category: 'bug',
      body: '仿真页按钮点了没有反应，我换了浏览器还是一样。',
      pagePath: '/simulation',
      classId: 'class-1',
      createdAt,
      user: { name: '张三', username: 'zhangsan', studentId: '20240001' },
    }, '机电 1 班');

    expect(view.displayName).toBe('匿名');
    expect(view.studentName).toBeNull();
    expect(view.studentId).toBeNull();
    expect(view.className).toBe('机电 1 班');
    expect(view).not.toHaveProperty('userId');
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('张三');
    expect(serialized).not.toContain('20240001');
    expect(serialized).not.toContain('zhangsan');
    expect(serialized).not.toContain('userId');
  });

  it('shows the student name and student id for a named submission', () => {
    const view = presentTeacherFeedback({
      id: 'fb-named',
      anonymous: false,
      category: 'suggestion',
      body: '希望成就页能直接跳到还没完成的勋章。',
      pagePath: '/achievements',
      classId: null,
      createdAt,
      user: { name: '李四', username: 'lisi', studentId: '20240002' },
    }, null);

    expect(view.displayName).toBe('李四');
    expect(view.studentName).toBe('李四');
    expect(view.studentId).toBe('20240002');
    expect(view.className).toBe('未分班');
    expect(view).not.toHaveProperty('userId');
  });
});
