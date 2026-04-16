// Points system configuration and utilities

export interface PointsConfig {
  // Learning activities
  COMPLETE_MODULE: number;
  COMPLETE_CHAPTER: number;
  DAILY_LOGIN: number;
  LEARNING_STREAK: number;
  TIME_MILESTONE: number; // Per hour of learning
  
  // Quiz activities
  COMPLETE_QUIZ: number;
  PERFECT_SCORE: number;
  QUIZ_PASS: number; // Score > 60%
  
  // Experiment activities
  COMPLETE_EXPERIMENT: number;
  FIRST_EXPERIMENT: number;
  ALL_EXPERIMENTS: number;
  
  // Achievement bonuses
  UNLOCK_ACHIEVEMENT: number;
  BRONZE_ACHIEVEMENT: number;
  SILVER_ACHIEVEMENT: number;
  GOLD_ACHIEVEMENT: number;
}

export const POINTS_CONFIG: PointsConfig = {
  // Learning activities
  COMPLETE_MODULE: 50,
  COMPLETE_CHAPTER: 20,
  DAILY_LOGIN: 10,
  LEARNING_STREAK: 15, // Per day
  TIME_MILESTONE: 30, // Per hour
  
  // Quiz activities  
  COMPLETE_QUIZ: 25,
  PERFECT_SCORE: 100,
  QUIZ_PASS: 40,
  
  // Experiment activities
  COMPLETE_EXPERIMENT: 75,
  FIRST_EXPERIMENT: 50,
  ALL_EXPERIMENTS: 200,
  
  // Achievement bonuses
  UNLOCK_ACHIEVEMENT: 25,
  BRONZE_ACHIEVEMENT: 50,
  SILVER_ACHIEVEMENT: 100,
  GOLD_ACHIEVEMENT: 200,
};

export interface PointsActivity {
  userId: string;
  points: number;
  type: keyof PointsConfig;
  description: string;
  metadata?: Record<string, any>;
}

// Calculate points for quiz based on score
export function calculateQuizPoints(score: number): number {
  let points = POINTS_CONFIG.COMPLETE_QUIZ;
  
  // Handle invalid scores (negative or over 100)
  const normalizedScore = Math.max(0, Math.min(100, score));
  
  if (normalizedScore === 100 || score > 100) {
    points += POINTS_CONFIG.PERFECT_SCORE;
  } else if (normalizedScore >= 60) {
    points += POINTS_CONFIG.QUIZ_PASS;
  }
  
  return points;
}

// Calculate points for learning time
export function calculateTimePoints(timeSpentSeconds: number, previousTimeSeconds: number): number {
  const previousHours = Math.floor(previousTimeSeconds / 3600);
  const currentHours = Math.floor(timeSpentSeconds / 3600);
  const newHours = currentHours - previousHours;
  
  return newHours * POINTS_CONFIG.TIME_MILESTONE;
}

// Calculate streak bonus
export function calculateStreakBonus(streakDays: number): number {
  // Handle negative streak days
  const normalizedDays = Math.max(0, streakDays);
  // Bonus multiplier increases with streak length
  const multiplier = Math.min(Math.floor(normalizedDays / 7) + 1, 5); // Max 5x
  return POINTS_CONFIG.LEARNING_STREAK * multiplier;
}