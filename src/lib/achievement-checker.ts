import { prisma } from '@/lib/prisma';
import {
  ACHIEVEMENTS,
  AchievementTier
} from '@/lib/achievement-system';

export interface AchievementCheck {
  achievementId: string;
  tier: AchievementTier;
  points: number;
  unlocked: boolean;
}

// Main function to check and update achievements
export async function checkAndUpdateAchievements(
  userId: string,
  triggeredBy: 'quiz' | 'learning' | 'experiment' | 'daily_check' = 'daily_check'
): Promise<AchievementCheck[]> {
  const newAchievements: AchievementCheck[] = [];

  try {
    const [
      learningStats,
      quizStats,
      experimentStats,
      user,
      existingAchievements,
      perfectScores,
      completedModules
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

    const currentValues = {
      learning_time: learningStats._sum.timeSpent || 0,
      modules_completed: completedModules,
      learning_streak: learningStreak,
      quizzes_completed: quizStats._count._all || 0,
      perfect_scores: perfectScores,
      quiz_average: quizStats._avg.score || 0,
      experiments_completed: experimentStats._count._all || 0,
      experiment_time: experimentStats._sum.timeSpent || 0,
      total_points: user?.totalPoints || 0,
      achievements_unlocked: existingAchievements.length
    };

    for (const [achievementId, definition] of Object.entries(ACHIEVEMENTS)) {
      const currentValue = currentValues[achievementId as keyof typeof currentValues] || 0;

      for (const tier of ['bronze', 'silver', 'gold'] as AchievementTier[]) {
        if (tier === 'platinum' && !definition.tiers[tier]) continue;
        const tierData = definition.tiers[tier];
        if (!tierData) continue;
        const fullAchievementId = `${achievementId}_${tier}`;

        if (currentValue >= (tierData?.threshold ?? 0)) {
          // Fast-path: skip if already unlocked (memory check)
          if (existingAchievements.some(a => a.achievementId === fullAchievementId)) continue;

          // upsert prevents concurrent duplicate grants
          const result = await prisma.userAchievement.upsert({
            where: { userId_achievementId: { userId, achievementId: fullAchievementId } },
            create: {
              userId,
              achievementId: fullAchievementId,
              name: `${definition.name} - ${tier === 'bronze' ? '铜章' : tier === 'silver' ? '银章' : '金章'}`,
              description: tierData.description,
              icon: tier === 'bronze' ? '🥉' : tier === 'silver' ? '🥈' : '🥇',
              category: definition.category,
              progress: 100
            },
            update: {},
          });

          // Only award points if this was a new creation (check by unlockedAt recency)
          const isNew = (Date.now() - result.unlockedAt.getTime()) < 5000;
          if (isNew) {
            await prisma.userPointsTransaction.create({
              data: {
                userId,
                points: tierData.points,
                type: 'ACHIEVEMENT_UNLOCK',
                description: `解锁成就: ${definition.name} - ${tier === 'bronze' ? '铜章' : tier === 'silver' ? '银章' : '金章'}`,
                metadata: JSON.stringify({ achievementId: fullAchievementId, tier })
              }
            });

            await prisma.user.update({
              where: { id: userId },
              data: { totalPoints: { increment: tierData.points } }
            });

            await prisma.userActivity.create({
              data: {
                userId,
                action: 'UNLOCK_ACHIEVEMENT',
                details: JSON.stringify({
                  achievementId: fullAchievementId,
                  name: definition.name,
                  tier,
                  category: definition.category,
                  triggeredBy
                })
              }
            });

            newAchievements.push({
              achievementId: fullAchievementId,
              tier,
              points: tierData.points,
              unlocked: true
            });
          }
        }
      }
    }

    await checkSpecialAchievements(userId, triggeredBy, currentValues, existingAchievements, newAchievements);

  } catch (error) {
    console.error('Error checking achievements:', error);
  }

  return newAchievements;
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

async function grantSpecialAchievement(
  userId: string,
  achievementId: string,
  name: string,
  description: string,
  icon: string,
  existingAchievements: any[],
  newAchievements: AchievementCheck[],
  points: number = 50,
) {
  if (existingAchievements.some(a => a.achievementId === achievementId)) return;

  const result = await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId, achievementId } },
    create: {
      userId,
      achievementId,
      name,
      description,
      icon,
      category: '特殊',
      progress: 100,
    },
    update: {},
  });

  const isNew = (Date.now() - result.unlockedAt.getTime()) < 5000;
  if (isNew) {
    await prisma.userPointsTransaction.create({
      data: {
        userId,
        points,
        type: 'ACHIEVEMENT_UNLOCK',
        description: `解锁成就: ${name}`,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: points } },
    });

    newAchievements.push({
      achievementId,
      tier: 'bronze',
      points,
      unlocked: true,
    });
  }
}

async function checkSpecialAchievements(
  userId: string,
  triggeredBy: string,
  currentValues: any,
  existingAchievements: any[],
  newAchievements: AchievementCheck[]
) {
  if (triggeredBy === 'quiz' && currentValues.quizzes_completed === 1) {
    await grantSpecialAchievement(userId, 'first_quiz_special', '初试身手', '完成第一次测验', '🎯', existingAchievements, newAchievements);
  }

  if (triggeredBy === 'learning' && currentValues.modules_completed === 1) {
    await grantSpecialAchievement(userId, 'first_module_special', '学习起步', '完成第一个学习模块', '📚', existingAchievements, newAchievements);
  }

  if (triggeredBy === 'experiment' && currentValues.experiments_completed === 1) {
    await grantSpecialAchievement(userId, 'first_experiment_special', '实验新手', '完成第一个实验', '🔬', existingAchievements, newAchievements);
  }
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
