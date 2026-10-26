/**
 * Shared student study-day rule.
 *
 * streakDays and lastActiveDate both come from learningProgress.lastAccessAt,
 * keyed by the Asia/Shanghai campus day. A chapter does not have to be
 * completed. Today counts, and yesterday still counts when the student has
 * not studied yet today. user/progress, knowledge-graph/progress, user/stats,
 * and the achievement streak use this same summary.
 */
import { campusDateKey, shiftCampusDateKey } from '@/lib/campus-time';

export const STUDY_STREAK_SOURCE = 'learningProgress.lastAccessAt';

export interface StudyActivitySummary {
  streakDays: number;
  lastActiveDate: Date | null;
}

function asInstant(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function summarizeStudyActivity(
  timestamps: Array<Date | string | null | undefined>,
  now: Date = new Date(),
): StudyActivitySummary {
  const instants = timestamps
    .map(asInstant)
    .filter((value): value is Date => value !== null);
  if (instants.length === 0) {
    return { streakDays: 0, lastActiveDate: null };
  }

  let lastActiveDate = instants[0];
  const dateKeys = new Set<string>();
  for (const instant of instants) {
    if (instant.getTime() > lastActiveDate.getTime()) lastActiveDate = instant;
    dateKeys.add(campusDateKey(instant));
  }

  const dates = [...dateKeys].sort((left, right) => right.localeCompare(left));
  const today = campusDateKey(now);
  const yesterday = shiftCampusDateKey(today, -1);
  const newest = dates[0];
  if (!newest || (newest !== today && newest !== yesterday)) {
    return { streakDays: 0, lastActiveDate };
  }

  let streakDays = 1;
  for (let index = 1; index < dates.length; index += 1) {
    const current = dates[index - 1];
    const previous = dates[index];
    if (!current || previous !== shiftCampusDateKey(current, -1)) break;
    streakDays += 1;
  }

  return { streakDays, lastActiveDate };
}
