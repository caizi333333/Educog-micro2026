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
    // Fetch all user stats in parallel
    const [
      learningStats,
      quizStats,
      experimentStats,
      user,
      existingAchievements,
      perfectScores,
      completedModules
    ] = await Promise.all([
      // Learning statistics
      prisma.learningProgress.aggregate({
        where: { userId },
        _sum: { timeSpent: true },
        _count: { _all: true }
      }),
      
      // Quiz statistics
      prisma.quizAttempt.aggregate({
        where: { userId },
        _avg: { score: true },
        _count: { _all: true }
      }),
      
      // Experiment statistics
      prisma.userExperiment.aggregate({
        where: { userId, status: 'COMPLETED' },
        _sum: { timeSpent: true },
        _count: { _all: true }
      }),
      
      // User data
      prisma.user.findUnique({
        where: { id: userId },
        select: { totalPoints: true }
      }),
      
      // Existing achievements
      prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true }
      }),
      
      // Perfect scores count
      prisma.quizAttempt.count({
        where: { userId, score: 100 }
      }),
      
      // Completed modules count
      prisma.learningProgress.count({
        where: { userId, status: 'COMPLETED' }
      })
    ]);

    // Calculate learning streak
    const learningStreak = await calculateLearningStreak(userId);

    // Current values for all achievements
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

    // Check each achievement
    for (const [achievementId, definition] of Object.entries(ACHIEVEMENTS)) {
      const currentValue = currentValues[achievementId as keyof typeof currentValues] || 0;
      
      // Check each tier
      for (const tier of ['bronze', 'silver', 'gold'] as AchievementTier[]) {
        // Skip platinum tier if not defined in this achievement
        if (tier === 'platinum' && !definition.tiers[tier]) continue;
        const tierData = definition.tiers[tier];
        if (!tierData) continue;
        const fullAchievementId = `${achievementId}_${tier}`;
        
        // Check if this tier is unlocked
        if (currentValue >= (tierData?.threshold ?? 0)) {
          // Check if already exists
          const exists = existingAchievements.some(a => a.achievementId === fullAchievementId);
          
          if (!exists) {
            // Unlock the achievement
            await prisma.userAchievement.create({
              data: {
                userId,
                achievementId: fullAchievementId,
                name: `${definition.name} - ${tier === 'bronze' ? '铜章' : tier === 'silver' ? '银章' : '金章'}`,
                description: tierData.description,
                icon: tier === 'bronze' ? '🥉' : tier === 'silver' ? '🥈' : '🥇',
                category: definition.category,
                progress: 100
              }
            });
            
            // Award points
            await prisma.userPointsTransaction.create({
              data: {
                userId,
                points: tierData.points,
                type: 'ACHIEVEMENT_UNLOCK',
                description: `解锁成就: ${definition.name} - ${tier === 'bronze' ? '铜章' : tier === 'silver' ? '银章' : '金章'}`,
                metadata: JSON.stringify({
                  achievementId: fullAchievementId,
                  tier
                })
              }
            });
            
            // Update user points
            await prisma.user.update({
              where: { id: userId },
              data: {
                totalPoints: { increment: tierData.points }
              }
            });
            
            // Record activity
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
    
    // Special achievements for first-time actions
    await checkSpecialAchievements(userId, triggeredBy, currentValues, existingAchievements, newAchievements);
    
  } catch (error) {
    console.error('Error checking achievements:', error);
  }
  
  return newAchievements;
}

// Calculate learning streak (consecutive days)
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
  
  // Get unique dates
  const dates = [...new Set(activities.map(a => 
    new Date(a.createdAt).toDateString()
  ))];
  
  // Check if today is included
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString();
  
  if (!dates.includes(today) && !dates.includes(yesterday)) {
    return 0; // Streak broken
  }
  
  // Count consecutive days
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

// Check special one-time achievements
async function checkSpecialAchievements(
  userId: string,
  triggeredBy: string,
  currentValues: any,
  existingAchievements: any[],
  newAchievements: AchievementCheck[]
) {
  // First quiz achievement
  if (triggeredBy === 'quiz' && currentValues.quizzes_completed === 1) {
    const achievementId = 'first_quiz_special';
    if (!existingAchievements.some(a => a.achievementId === achievementId)) {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          name: '初试身手',
          description: '完成第一次测验',
          icon: '🎯',
          category: '特殊',
          progress: 100
        }
      });
      
      const points = 50;
      await prisma.userPointsTransaction.create({
        data: {
          userId,
          points,
          type: 'ACHIEVEMENT_UNLOCK',
          description: '解锁成就: 初试身手'
        }
      });
      
      await prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: points } }
      });
      
      newAchievements.push({
        achievementId,
        tier: 'bronze',
        points,
        unlocked: true
      });
    }
  }
  
  // First module achievement
  if (triggeredBy === 'learning' && currentValues.modules_completed === 1) {
    const achievementId = 'first_module_special';
    if (!existingAchievements.some(a => a.achievementId === achievementId)) {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          name: '学习起步',
          description: '完成第一个学习模块',
          icon: '📚',
          category: '特殊',
          progress: 100
        }
      });
      
      const points = 50;
      await prisma.userPointsTransaction.create({
        data: {
          userId,
          points,
          type: 'ACHIEVEMENT_UNLOCK',
          description: '解锁成就: 学习起步'
        }
      });
      
      await prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: points } }
      });
      
      newAchievements.push({
        achievementId,
        tier: 'bronze',
        points,
        unlocked: true
      });
    }
  }
  
  // First experiment achievement
  if (triggeredBy === 'experiment' && currentValues.experiments_completed === 1) {
    const achievementId = 'first_experiment_special';
    if (!existingAchievements.some(a => a.achievementId === achievementId)) {
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId,
          name: '实验新手',
          description: '完成第一个实验',
          icon: '🔬',
          category: '特殊',
          progress: 100
        }
      });
      
      const points = 50;
      await prisma.userPointsTransaction.create({
        data: {
          userId,
          points,
          type: 'ACHIEVEMENT_UNLOCK',
          description: '解锁成就: 实验新手'
        }
      });
      
      await prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: points } }
      });
      
      newAchievements.push({
        achievementId,
        tier: 'bronze',
        points,
        unlocked: true
      });
    }
  }
}

// Check achievements for specific triggers
export async function checkAchievementsForQuiz(userId: string, _score: number, _quizId: string) {
  return checkAndUpdateAchievements(userId, 'quiz');
}

export async function checkAchievementsForLearning(userId: string, _moduleId: string, _chapterId: string) {
  return checkAndUpdateAchievements(userId, 'learning');
}

export async function checkAchievementsForExperiment(userId: string, _experimentId: string) {
  return checkAndUpdateAchievements(userId, 'experiment');
}

// Daily achievement check (for streaks and time-based achievements)
export async function checkDailyAchievements(userId: string) {
  return checkAndUpdateAchievements(userId, 'daily_check');
}

// Export alias for backward compatibility
export const checkAllAchievements = checkAndUpdateAchievements;