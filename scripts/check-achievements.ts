import { PrismaClient } from '@prisma/client';
import { ALL_ACHIEVEMENTS } from '../src/lib/achievements-v2';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

async function checkAchievements() {
  try {
    const users = await prisma.user.findMany({
      take: 1,
      orderBy: { createdAt: 'desc' }
    });

    if (users.length === 0) {
      console.log('No users found in the database');
      return;
    }

    const user = users[0];
    if (!user) { console.log('User is undefined'); return; }

    console.log(`Checking achievements for user: ${user.email}`);

    const [userAchievements, learningStats, quizStats, experimentStats] = await Promise.all([
      prisma.userAchievement.findMany({ where: { userId: user.id } }),
      prisma.learningProgress.aggregate({ where: { userId: user.id }, _sum: { timeSpent: true }, _count: { _all: true } }),
      prisma.quizAttempt.aggregate({ where: { userId: user.id }, _avg: { score: true }, _count: { _all: true } }),
      prisma.userExperiment.aggregate({ where: { userId: user.id, status: 'COMPLETED' }, _count: { _all: true } }),
    ]);

    const stats: Record<string, number> = {
      learning_time: learningStats._sum.timeSpent || 0,
      modules_completed: learningStats._count._all || 0,
      quizzes_completed: quizStats._count._all || 0,
      quiz_average: quizStats._avg.score || 0,
      experiments_completed: experimentStats._count._all || 0,
      total_points: user.totalPoints || 0,
      achievements_unlocked: userAchievements.length,
    };

    ALL_ACHIEVEMENTS.forEach(achievement => {
      const criteriaType = achievement.criteria.type as string;
      const target = (achievement.criteria.target as number) || 0;
      const value = stats[criteriaType] || 0;
      const hasAch = userAchievements.some(a => a.achievementId === achievement.id);

      if (value >= target) {
        console.log(`- ${achievement.title}: ${hasAch ? '✓ Unlocked' : '✗ Should be unlocked'} (value: ${value}, target: ${target})`);
      }
    });

    console.log(`\nTotal: ${userAchievements.length} unlocked out of ${ALL_ACHIEVEMENTS.length} defined`);

  } catch (error) {
    console.error('Error checking achievements:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAchievements();
