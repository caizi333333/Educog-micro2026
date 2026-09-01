/**
 * @deprecated Use `achievements-v2.ts` instead.
 * This module re-exports the unified achievement system for backward compatibility.
 *
 * The tiered definitions have been expanded into flat entries in ACHIEVEMENTS_LEGACY_FLAT
 * and merged into ALL_ACHIEVEMENTS / ACHIEVEMENTS_V2.
 */

export type { Achievement as AchievementDefinition } from '../types/global';

// Legacy tier types kept for backward compatibility
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

// Re-export the unified list under the old name
export { ALL_ACHIEVEMENTS as ACHIEVEMENTS } from './achievements-v2';

// These functions are no longer meaningful with flat achievements
// but kept as no-ops for any remaining importers.
export function getAchievementTier(_achievementId: string, _currentValue: number): AchievementTier | null {
  return null;
}

export function calculateAchievementProgress(_achievementId: string, _currentValue: number): number {
  return 0;
}

export function getNextTierThreshold(_achievementId: string, _currentValue: number): number | null {
  return null;
}
