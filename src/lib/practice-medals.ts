import { ACHIEVEMENTS_V2, type Achievement } from '@/lib/achievements-v2';
import { campusDateKey } from '@/lib/campus-time';

/**
 * Match medals.
 *
 * Per board: `practice_clears:<board id>` (first clear of that board).
 * Shared, every board:
 * - `practice_same_board_clears` — highest recorded correct-clear count on
 *   any one board. 「连对三次」unlocks at 3. Incorrect attempts are not
 *   events, and a clear inside the 10-minute cooldown is not recorded, so
 *   neither counts. Clears on two boards do not add together.
 * - `practice_daily_participation` — 1 when this Asia/Shanghai calendar day
 *   already has a recorded correct clear of any board. 「今天练过了」is
 *   requested on the first such clear of the day. A later clear the same
 *   day does not request it. The unique (userId, achievementId) row blocks
 *   a second grant on a later day.
 *
 * The daily checker reads `summarizePracticeClears`. It backfills 「连对三次」
 * from history. It backfills 「今天练过了」only when a recorded clear falls
 * on today's campus day, so yesterday's clear does not unlock it tomorrow.
 */
export const PRACTICE_STREAK_CLEARS = 3;
export const PRACTICE_STREAK_MEDAL_ID = 'practice_streak_3';
export const PRACTICE_DAILY_MEDAL_ID = 'practice_daily';
export const PRACTICE_SAME_BOARD_CLEARS = 'practice_same_board_clears';
export const PRACTICE_DAILY_PARTICIPATION = 'practice_daily_participation';

export interface PracticeClearRow {
  targetId: string;
  createdAt: Date;
}

export function practiceClearStat(boardId: string): string {
  return `practice_clears:${boardId}`;
}

export function listPracticeMedals(boardId: string): Achievement[] {
  const stat = practiceClearStat(boardId);
  return ACHIEVEMENTS_V2
    .filter((achievement) => achievement.criteria.type === stat)
    .slice()
    .sort((left, right) => Number(left.criteria.target) - Number(right.criteria.target));
}

/**
 * Medal ids to request after one more recorded clear of `boardId`.
 * `clearCount` includes the clear just stored. Pass `firstClearOfCampusDay`
 * only when no other recorded clear exists on this Asia/Shanghai day.
 * Requesting an owned id again is safe: the unique row does not pay twice.
 */
export function practiceMedalIdsForCount(
  boardId: string,
  clearCount: number,
  options?: { firstClearOfCampusDay?: boolean },
): string[] {
  if (!Number.isFinite(clearCount) || clearCount <= 0) return [];
  const ids = listPracticeMedals(boardId)
    .filter((achievement) => clearCount >= Number(achievement.criteria.target))
    .map((achievement) => achievement.id);
  if (clearCount >= PRACTICE_STREAK_CLEARS) ids.push(PRACTICE_STREAK_MEDAL_ID);
  if (options?.firstClearOfCampusDay) ids.push(PRACTICE_DAILY_MEDAL_ID);
  return ids;
}

export function countPracticeClears(targetIds: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const targetId of targetIds) {
    const key = practiceClearStat(targetId);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function maxSameBoardClears(counts: Record<string, number>): number {
  const values = Object.values(counts);
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/** Stats for the catalog checker. Rows are recorded correct clears only. */
export function summarizePracticeClears(
  rows: readonly PracticeClearRow[],
  now: Date,
): Record<string, number> {
  const counts = countPracticeClears(rows.map((row) => row.targetId));
  const today = campusDateKey(now);
  const practicedToday = rows.some((row) => (
    row.createdAt instanceof Date
    && !Number.isNaN(row.createdAt.getTime())
    && campusDateKey(row.createdAt) === today
  ));
  return {
    ...counts,
    [PRACTICE_SAME_BOARD_CLEARS]: maxSameBoardClears(counts),
    [PRACTICE_DAILY_PARTICIPATION]: practicedToday ? 1 : 0,
  };
}
