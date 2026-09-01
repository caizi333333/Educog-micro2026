import { prisma } from '@/lib/prisma';
import { ALL_ACHIEVEMENTS, type Achievement } from '@/lib/achievements-v2';

export interface AchievementCheck {
  achievementId: string;
  points: number;
  unlocked: boolean;
}

// Cooldown map: userId → lastCheckTime
const checkCooldown = new Map<string, number>();
const COOLDOWN_MS = 60_000; // 1 minute between checks for same user

export async function checkAndUpdateAchievements(
  userId: string,
  triggeredBy: 'quiz' | 'learning' | 'experiment' | 'daily_check' = 'daily_check'
): Promise<AchievementCheck[]> {
  // Cooldown check
  const now = Date.now();
  const lastCheck = checkCooldown.get(userId) || 0;
  if (now - lastCheck < COOLDOWN_MS) return [];
  checkCooldown.set(userId, now);

  const newAchievements: AchievementCheck[] = [];

  try {
    const [
      learningStats,
      quizStats,
      experimentStats,
      user,
      existingAchievements,
      perfectScores,
      completedModules,
    ] = await Promise.all([
      prisma.learningProgress.aggregate({
        where: { userId },
        _sum: { timeSpent: true },
        _count: { _all: true }
      }),
      prisma.quizAttempt.aggregate({
        where: { userId },
        _avg: { score: true },
        _count: { _all: true }
      }),
      prisma.userExperiment.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { timeSpent: true },
        _count: { _all: true }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { totalPoints: true }
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true }
      }),
      prisma.quizAttempt.count({
        where: { userId, score: 100 }
      }),
      prisma.learningProgress.count({
        where: { userId, status: 'COMPLETED' }
      })
    ]);

    const learningStreak = await calculateLearningStreak(userId);

    const currentValues: Record<string, number> = {
      learning_time: learningStats._sum.timeSpent || 0,
      modules_completed: completedModules,
      learning_streak: learningStreak,
      quizzes_completed: quizStats._count._all || 0,
      perfect_scores: perfectScores,
      quiz_average: quizStats._avg.score || 0,
      experiments_completed: experimentStats._count._all || 0,
      experiment_time: experimentStats._sum.timeSpent || 0,
      total_points: user?.totalPoints || 0,
      achievements_unlocked: existingAchievements.length,
      // V2 criteria types
      code_runs: await prisma.userActivity.count({ where: { userId, action: 'RUN_CODE' } }),
      debug_success: await prisma.userActivity.count({ where: { userId, action: 'DEBUG_SUCCESS' } }),
      daily_streak: learningStreak,
      perfect_quiz: perfectScores,
      speed_completion: await prisma.learningProgress.count({ where: { userId, status: 'COMPLETED', timeSpent: { lt: 300 } } }),
      night_study: 0,
      morning_study: 0,
      questions_answered: quizStats._count._all || 0,
      discussions_started: await prisma.userActivity.count({ where: { userId, action: { contains: 'DISCUSSION' } } }),
      easter_egg_found: await prisma.userActivity.count({ where: { userId, action: 'EASTER_EGG' } }),
      bugs_reported: await prisma.userActivity.count({ where: { userId, action: 'BUG_REPORT' } }),
      continuous_hours: 0,
    };

    const existingSet = new Set(existingAchievements.map(a => a.achievementId));
    const eligibleAchievements = ALL_ACHIEVEMENTS.filter((achievement) => {
      if (existingSet.has(achievement.id)) return false;
      const criteriaType = achievement.criteria.type as string;
      const criteriaTarget = achievement.criteria.target as number;
      if (!Number.isFinite(criteriaTarget) || criteriaTarget <= 0) return false;
      return (currentValues[criteriaType] || 0) >= criteriaTarget;
    });

    newAchievements.push(...await grantAchievementsInTransaction(userId, eligibleAchievements, triggeredBy));

  } catch (error) {
    checkCooldown.delete(userId);
    console.error('Error checking achievements:', error);
  }

  return newAchievements;
}

async function grantAchievementsInTransaction(
  userId: string,
  achievements: Achievement[],
  triggeredBy: string,
): Promise<AchievementCheck[]> {
  if (achievements.length === 0) return [];

  return prisma.$transaction(async (tx) => {
    const inserted = await tx.userAchievement.createManyAndReturn({
      data: achievements.map((achievement) => ({
        userId,
        achievementId: achievement.id,
        name: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        category: achievement.category,
        progress: 100,
        points: achievement.points,
        source: 'SYSTEM',
      })),
      skipDuplicates: true,
      select: { achievementId: true },
    });
    if (inserted.length === 0) return [];

    const insertedIds = new Set(inserted.map((row) => row.achievementId));
    const granted = achievements.filter((achievement) => insertedIds.has(achievement.id));
    const positivePointAchievements = granted.filter((achievement) => achievement.points > 0);
    const totalPoints = positivePointAchievements.reduce((sum, achievement) => sum + achievement.points, 0);

    if (positivePointAchievements.length > 0) {
      await tx.userPointsTransaction.createMany({
        data: positivePointAchievements.map((achievement) => ({
          userId,
          points: achievement.points,
          type: 'ACHIEVEMENT_UNLOCK',
          description: `解锁成就: ${achievement.title}`,
          metadata: JSON.stringify({ achievementId: achievement.id }),
        })),
      });
      await tx.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: totalPoints } },
      });
    }

    await tx.userActivity.createMany({
      data: granted.map((achievement) => ({
        userId,
        action: 'UNLOCK_ACHIEVEMENT',
        details: JSON.stringify({
          achievementId: achievement.id,
          name: achievement.title,
          category: achievement.category,
          triggeredBy,
        }),
      })),
    });

    await tx.achievementAuditLog.createMany({
      data: granted.map((achievement) => ({
        userId,
        achievementId: achievement.id,
        action: 'GRANT',
        newState: JSON.stringify({ points: achievement.points, source: 'SYSTEM', triggeredBy }),
      })),
    });

    return granted.map((achievement) => ({
      achievementId: achievement.id,
      points: achievement.points,
      unlocked: true,
    }));
  });
}

async function calculateLearningStreak(userId: string): Promise<number> {
  const activities = await prisma.userActivity.findMany({
    where: {
      userId,
      action: { in: ['COMPLETE_QUIZ', 'COMPLETE_MODULE', 'COMPLETE_EXPERIMENT', 'UPDATE_PROGRESS'] }
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true }
  });

  if (activities.length === 0) return 0;

  const dates = [...new Set(activities.map(a =>
    new Date(a.createdAt).toDateString()
  ))];

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();

  if (!dates.includes(today) && !dates.includes(yesterday)) {
    return 0;
  }

  let streak = 1;
  const sortedDates = dates.map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

  for (let i = 1; i < sortedDates.length; i++) {
    const diff = (sortedDates[i - 1]?.getTime() ?? 0) - (sortedDates[i]?.getTime() ?? 0);
    const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function checkAchievementsForQuiz(userId: string, _score: number, _quizId: string) {
  return checkAndUpdateAchievements(userId, 'quiz');
}

export async function checkAchievementsForLearning(userId: string, _moduleId: string, _chapterId: string) {
  return checkAndUpdateAchievements(userId, 'learning');
}

export async function checkAchievementsForExperiment(userId: string, _experimentId: string) {
  return checkAndUpdateAchievements(userId, 'experiment');
}

export async function checkDailyAchievements(userId: string) {
  return checkAndUpdateAchievements(userId, 'daily_check');
}

export const checkAllAchievements = checkAndUpdateAchievements;
