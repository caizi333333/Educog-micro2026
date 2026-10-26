import { STUDY_STREAK_SOURCE, summarizeStudyActivity } from '@/lib/study-activity';

describe('study activity streak', () => {
  const now = new Date('2026-10-26T16:30:00.000Z');

  it('counts an in-progress campus day and keeps the latest access', () => {
    const accessedAt = new Date('2026-10-26T16:30:00.000Z');
    const summary = summarizeStudyActivity([accessedAt], now);

    expect(STUDY_STREAK_SOURCE).toBe('learningProgress.lastAccessAt');
    expect(summary.streakDays).toBe(1);
    expect(summary.lastActiveDate).toEqual(accessedAt);
  });

  it('uses the Shanghai day, so a UTC-yesterday evening is still today on campus', () => {
    const accessedAt = new Date('2026-10-26T16:30:00.000Z');
    const summary = summarizeStudyActivity([accessedAt], new Date('2026-10-26T17:02:53.000Z'));

    expect(summary.streakDays).toBe(1);
    expect(summary.lastActiveDate).toEqual(accessedAt);
  });

  it('keeps yesterday alive and drops a gap older than yesterday', () => {
    const today = new Date('2026-10-26T04:00:00.000Z');
    const yesterday = new Date('2026-10-25T04:00:00.000Z');
    const threeDaysAgo = new Date('2026-10-23T04:00:00.000Z');

    expect(summarizeStudyActivity([yesterday], today).streakDays).toBe(1);
    expect(summarizeStudyActivity([today, yesterday], today).streakDays).toBe(2);
    expect(summarizeStudyActivity([threeDaysAgo], today)).toMatchObject({
      streakDays: 0,
      lastActiveDate: threeDaysAgo,
    });
  });

  it('returns an empty summary when the student has not studied', () => {
    expect(summarizeStudyActivity([null, undefined], now)).toEqual({
      streakDays: 0,
      lastActiveDate: null,
    });
  });
});
