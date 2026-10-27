import { checkAchievementUnlock, ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { campusDateKey } from '@/lib/campus-time';
import { POINTS_CONFIG } from '@/lib/points-system';
import {
  ADDRESSING_MODE_BOARD,
  INTERRUPT_IE_ENABLE_BOARD,
  INTERRUPT_SOURCE_FLAG_BOARD,
  decideMatchReward,
  matchClearMessage,
} from '@/lib/practice-match';
import {
  PRACTICE_DAILY_MEDAL_ID,
  PRACTICE_DAILY_PARTICIPATION,
  PRACTICE_SAME_BOARD_CLEARS,
  PRACTICE_STREAK_MEDAL_ID,
  practiceMedalIdsForCount,
  summarizePracticeClears,
} from '@/lib/practice-medals';

const INTERRUPT = INTERRUPT_SOURCE_FLAG_BOARD.id;
const ADDRESSING = ADDRESSING_MODE_BOARD.id;
const IE_ENABLES = INTERRUPT_IE_ENABLE_BOARD.id;

/** 15:30Z is still the 26th in Shanghai; 16:30Z is the 27th. */
const SHANGHAI_OCT_26_LATE = new Date('2026-10-26T15:30:00.000Z');
const SHANGHAI_OCT_27_EARLY = new Date('2026-10-26T16:30:00.000Z');

describe('practice match medals', () => {
  it('asks for 连对三次 only after 3 recorded clears of the same board', () => {
    expect(practiceMedalIdsForCount(INTERRUPT, 2, { firstClearOfCampusDay: false })).toEqual([
      'interrupt_source_flags',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT, 3, { firstClearOfCampusDay: false })).toEqual([
      'interrupt_source_flags',
      PRACTICE_STREAK_MEDAL_ID,
    ]);
    expect(practiceMedalIdsForCount(ADDRESSING, 3, { firstClearOfCampusDay: false })).toEqual([
      'addressing_modes',
      PRACTICE_STREAK_MEDAL_ID,
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT, 4, { firstClearOfCampusDay: false })).toContain(PRACTICE_STREAK_MEDAL_ID);
  });

  it('asks for 今天练过了 only on the first recorded clear of the campus day', () => {
    expect(practiceMedalIdsForCount(INTERRUPT, 1, { firstClearOfCampusDay: true })).toEqual([
      'interrupt_source_flags',
      PRACTICE_DAILY_MEDAL_ID,
    ]);
    expect(practiceMedalIdsForCount(ADDRESSING, 1, { firstClearOfCampusDay: false })).toEqual([
      'addressing_modes',
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT, 2, { firstClearOfCampusDay: false })).not.toContain(PRACTICE_DAILY_MEDAL_ID);
  });

  it('counts recorded clears per board and ignores a miss that was never stored', () => {
    const now = SHANGHAI_OCT_27_EARLY;
    const stats = summarizePracticeClears([
      { targetId: INTERRUPT, createdAt: new Date(now.getTime() - 40 * 60 * 1000) },
      { targetId: INTERRUPT, createdAt: new Date(now.getTime() - 20 * 60 * 1000) },
      { targetId: ADDRESSING, createdAt: now },
    ], now);
    expect(stats[`practice_clears:${INTERRUPT}`]).toBe(2);
    expect(stats[`practice_clears:${ADDRESSING}`]).toBe(1);
    expect(stats[PRACTICE_SAME_BOARD_CLEARS]).toBe(2);
    expect(stats[PRACTICE_DAILY_PARTICIPATION]).toBe(1);

    const streak = ACHIEVEMENTS_V2.find((medal) => medal.id === PRACTICE_STREAK_MEDAL_ID);
    expect(checkAchievementUnlock(streak!, stats).unlocked).toBe(false);

    const third = summarizePracticeClears([
      { targetId: ADDRESSING, createdAt: new Date(now.getTime() - 40 * 60 * 1000) },
      { targetId: ADDRESSING, createdAt: new Date(now.getTime() - 20 * 60 * 1000) },
      { targetId: ADDRESSING, createdAt: now },
    ], now);
    expect(third[PRACTICE_SAME_BOARD_CLEARS]).toBe(3);
    expect(checkAchievementUnlock(streak!, third).unlocked).toBe(true);
  });

  it('uses the Asia/Shanghai day, so a clear before midnight does not count as today', () => {
    expect(campusDateKey(SHANGHAI_OCT_26_LATE)).toBe('2026-10-26');
    expect(campusDateKey(SHANGHAI_OCT_27_EARLY)).toBe('2026-10-27');

    const yesterdayOnly = summarizePracticeClears([
      { targetId: INTERRUPT, createdAt: SHANGHAI_OCT_26_LATE },
    ], SHANGHAI_OCT_27_EARLY);
    expect(yesterdayOnly[PRACTICE_DAILY_PARTICIPATION]).toBe(0);
    expect(yesterdayOnly[PRACTICE_SAME_BOARD_CLEARS]).toBe(1);

    const today = summarizePracticeClears([
      { targetId: INTERRUPT, createdAt: SHANGHAI_OCT_26_LATE },
      { targetId: ADDRESSING, createdAt: SHANGHAI_OCT_27_EARLY },
    ], SHANGHAI_OCT_27_EARLY);
    expect(today[PRACTICE_DAILY_PARTICIPATION]).toBe(1);
    expect(today[PRACTICE_SAME_BOARD_CLEARS]).toBe(1);

    const daily = ACHIEVEMENTS_V2.find((medal) => medal.id === PRACTICE_DAILY_MEDAL_ID);
    expect(checkAchievementUnlock(daily!, yesterdayOnly).unlocked).toBe(false);
    expect(checkAchievementUnlock(daily!, today).unlocked).toBe(true);
  });

  it('scores the IE enable board on the shared medal path: a miss and a cooldown add nothing', () => {
    expect(practiceMedalIdsForCount(IE_ENABLES, 1, { firstClearOfCampusDay: true })).toEqual([
      'interrupt_ie_enables',
      PRACTICE_DAILY_MEDAL_ID,
    ]);
    expect(practiceMedalIdsForCount(IE_ENABLES, 1, { firstClearOfCampusDay: false })).toEqual([
      'interrupt_ie_enables',
    ]);
    expect(practiceMedalIdsForCount(IE_ENABLES, 3, { firstClearOfCampusDay: false })).toEqual([
      'interrupt_ie_enables',
      PRACTICE_STREAK_MEDAL_ID,
    ]);
    expect(practiceMedalIdsForCount(INTERRUPT, 1)).toEqual(['interrupt_source_flags']);

    const now = Date.parse('2026-10-27T12:00:00Z');
    expect(decideMatchReward({
      correct: false,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_IE_ENABLE_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'incorrect', practicePoints: 0, recordEvent: false, grantMedals: false });
    expect(decideMatchReward({
      correct: true,
      previousClears: 0,
      lastClearAtMs: null,
      nowMs: now,
      cooldownMs: INTERRUPT_IE_ENABLE_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'first_clear', practicePoints: 15, recordEvent: true, grantMedals: true });
    expect(decideMatchReward({
      correct: true,
      previousClears: 1,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INTERRUPT_IE_ENABLE_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_IE_ENABLE_BOARD.firstClearPoints,
      awardToStudent: true,
    })).toMatchObject({ reason: 'cooldown', practicePoints: 0, recordEvent: false, grantMedals: false });
  });

  it('keeps a cooldown clear from becoming the third recorded clear', () => {
    const now = Date.parse('2026-10-27T04:00:00.000Z');
    const cooled = decideMatchReward({
      correct: true,
      previousClears: 2,
      lastClearAtMs: now - 60_000,
      nowMs: now,
      cooldownMs: INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_SOURCE_FLAG_BOARD.firstClearPoints,
      awardToStudent: true,
    });
    expect(cooled).toMatchObject({ recordEvent: false, grantMedals: false, practicePoints: 0, reason: 'cooldown' });

    const counted = decideMatchReward({
      correct: true,
      previousClears: 2,
      lastClearAtMs: now - INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      nowMs: now,
      cooldownMs: INTERRUPT_SOURCE_FLAG_BOARD.cooldownMs,
      firstClearPoints: INTERRUPT_SOURCE_FLAG_BOARD.firstClearPoints,
      awardToStudent: true,
    });
    expect(counted).toMatchObject({ recordEvent: true, grantMedals: true, practicePoints: 0, reason: 'repeat' });
    expect(practiceMedalIdsForCount(INTERRUPT, 3, { firstClearOfCampusDay: false })).toContain(PRACTICE_STREAK_MEDAL_ID);
  });

  it('names the new medals without paying practice points twice in the copy', () => {
    expect(matchClearMessage({
      reason: 'repeat',
      practicePoints: 0,
      medalTitle: null,
      medalPoints: 0,
      cooldownMinutes: 10,
      medals: [{ title: '连对三次', points: POINTS_CONFIG.PRACTICE_MATCH_STREAK }],
    })).toBe('又对上一次。学习记录已记下，解锁勋章「连对三次」+20。');
    expect(matchClearMessage({
      reason: 'repeat',
      practicePoints: 0,
      medalTitle: null,
      medalPoints: 0,
      cooldownMinutes: 10,
      medals: [],
    })).toBe('又对上一次。学习记录已记下，这道题的首次积分不再发放。');
    expect(matchClearMessage({
      reason: 'first_clear',
      practicePoints: POINTS_CONFIG.PRACTICE_MATCH_CLEAR,
      medalTitle: null,
      medalPoints: 0,
      cooldownMinutes: 10,
      medals: [
        { title: '中断标志对上了', points: 10 },
        { title: '今天练过了', points: POINTS_CONFIG.PRACTICE_MATCH_DAILY },
      ],
    })).toBe('首次对上：+15 积分，解锁勋章「中断标志对上了」+10、「今天练过了」+5。');
  });
});
