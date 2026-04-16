import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS } from '../src/lib/achievement-system';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkAchievements() {
  try {
    // Get a test user (you can modify this to check a specific user)
    const users = await prisma.user.findMany({
      take: 1,
      orderBy: { createdAt: 'desc' }
    });

    if (users.length === 0) {
      console.log('No users found in the database');
      return;
    }

    const user = users[0];
    if (!user) {
      console.log('User is undefined');
      return;
    }
    
    console.log(`Checking achievements for user: ${user.email}`);

    // Check user achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: user.id }
    });

    console.log(`\nUser has ${userAchievements.length} achievements:`);
    userAchievements.forEach(ach => {
      console.log(`- ${ach.achievementId}: ${ach.name} (${ach.category})`);
    });

    // Check user stats
    const [learningStats, quizStats, experimentStats] = await Promise.all([
      prisma.learningProgress.aggregate({
        where: { userId: user.id },
        _sum: { timeSpent: true },
        _count: { _all: true }
      }),
      prisma.quizAttempt.aggregate({
        where: { userId: user.id },
        _avg: { score: true },
        _count: { _all: true }
      }),
      prisma.userExperiment.aggregate({
        where: { userId: user.id, status: 'COMPLETED' },
        _sum: { timeSpent: true },
        _count: { _all: true }
      })
    ]);

    console.log('\nUser Statistics:');
    console.log(`- Learning time: ${learningStats._sum.timeSpent || 0} seconds`);
    console.log(`- Learning modules: ${learningStats._count._all}`);
    console.log(`- Quiz attempts: ${quizStats._count._all}`);
    console.log(`- Quiz average: ${quizStats._avg.score || 0}`);
    console.log(`- Experiments completed: ${experimentStats._count._all}`);
    console.log(`- Experiment time: ${experimentStats._sum.timeSpent || 0} seconds`);
    console.log(`- Total points: ${user.totalPoints}`);

    // Show which achievements should be unlocked based on current stats
    console.log('\nPotential achievements based on current stats:');
    const stats = {
      learning_time: learningStats._sum.timeSpent || 0,
      modules_completed: await prisma.learningProgress.count({
        where: { userId: user.id, status: 'COMPLETED' }
      }),
      quizzes_completed: quizStats._count._all || 0,
      perfect_scores: await prisma.quizAttempt.count({
        where: { userId: user.id, score: 100 }
      }),
      quiz_average: quizStats._avg.score || 0,
      experiments_completed: experimentStats._count._all || 0,
      experiment_time: experimentStats._sum.timeSpent || 0,
      total_points: user.totalPoints || 0,
      achievements_unlocked: userAchievements.length
    };

    Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
      const value = stats[id as keyof typeof stats] || 0;
      const tiers = ['bronze', 'silver', 'gold'] as const;
      
      tiers.forEach(tier => {
        const threshold = achievement.tiers[tier].threshold;
        if (value >= threshold) {
          const achId = `${id}_${tier}`;
          const hasAch = userAchievements.some(a => a.achievementId === achId);
          console.log(`- ${achievement.name} (${tier}): ${hasAch ? '✓ Unlocked' : '✗ Should be unlocked'} (value: ${value}, threshold: ${threshold})`);
        }
      });
    });

  } catch (error) {
    console.error('Error checking achievements:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAchievements();