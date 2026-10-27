import { ACHIEVEMENTS_V2, type Achievement } from '@/lib/achievements-v2';

/**
 * Stat key counted from this user's SiteFeedback rows.
 * Catalog medals use the same criteria.type. To add a later medal, append
 * another achievement with this type and the next target. Both the submit
 * path and the daily checker award every matching medal whose target has
 * been reached, and the unique (userId, achievementId) constraint keeps it idempotent.
 */
export const VALID_FEEDBACK_STAT = 'valid_feedbacks';

export function listFeedbackMedals(): Achievement[] {
  return ACHIEVEMENTS_V2
    .filter((achievement) => achievement.criteria.type === VALID_FEEDBACK_STAT)
    .slice()
    .sort((left, right) => Number(left.criteria.target) - Number(right.criteria.target));
}

export function feedbackMedalIdsForCount(validCount: number): string[] {
  if (!Number.isFinite(validCount) || validCount <= 0) return [];
  return listFeedbackMedals()
    .filter((achievement) => validCount >= Number(achievement.criteria.target))
    .map((achievement) => achievement.id);
}
