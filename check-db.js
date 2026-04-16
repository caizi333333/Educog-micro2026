const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('检查数据库连接...');
    
    // 检查用户数量
    const userCount = await prisma.user.count();
    console.log(`用户数量: ${userCount}`);
    
    // 检查成就数量
    const achievementCount = await prisma.userAchievement.count();
    console.log(`用户成就数量: ${achievementCount}`);
    
    // 检查学习进度数量
    const progressCount = await prisma.learningProgress.count();
    console.log(`学习进度记录数量: ${progressCount}`);
    
    // 检查测验尝试数量
    const quizCount = await prisma.quizAttempt.count();
    console.log(`测验尝试数量: ${quizCount}`);
    
    // 如果有用户，显示第一个用户的信息
    if (userCount > 0) {
      const firstUser = await prisma.user.findFirst({
        select: {
          id: true,
          username: true,
          email: true,
          totalPoints: true,
          createdAt: true
        }
      });
      console.log('第一个用户信息:', firstUser);
      
      // 检查该用户的成就
      const userAchievements = await prisma.userAchievement.findMany({
        where: { userId: firstUser.id },
        select: {
          achievementId: true,
          name: true,
          category: true,
          unlockedAt: true
        }
      });
      console.log(`用户 ${firstUser.username} 的成就数量:`, userAchievements.length);
      if (userAchievements.length > 0) {
        console.log('成就列表:', userAchievements);
      }
    }
    
  } catch (error) {
    console.error('数据库查询错误:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();