import { ACHIEVEMENTS_V2, type Achievement } from '@/lib/achievements-v2';

/**
 * One stat per match board: `practice_clears:<board id>`.
 * Append another catalog medal with the same criteria.type and a higher
 * target (for example 3 clears) and both this helper and the daily checker
 * will award it. The unique (userId, achievementId) row blocks a second grant.
 */
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

export function practiceMedalIdsForCount(boardId: string, clearCount: number): string[] {
  if (!Number.isFinite(clearCount) || clearCount <= 0) return [];
  return listPracticeMedals(boardId)
    .filter((achievement) => clearCount >= Number(achievement.criteria.target))
    .map((achievement) => achievement.id);
}

export function countPracticeClears(targetIds: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const targetId of targetIds) {
    const key = practiceClearStat(targetId);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
