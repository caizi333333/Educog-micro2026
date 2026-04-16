const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUserStats() {
  try {
    console.log('=== 检查用户统计数据 ===');
    
    // 查找admin用户
    const adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'admin@educog.com' },
          { username: 'admin' }
        ]
      }
    });
    
    if (!adminUser) {
      console.log('❌ 未找到admin用户');
      return;
    }
    
    console.log('✅ 找到admin用户:', {
      id: adminUser.id,
      email: adminUser.email,
      username: adminUser.username
    });
    
    // 检查用户进度数据
    const userProgress = await prisma.userProgress.findUnique({
      where: { userId: adminUser.id }
    });
    
    console.log('\n=== 用户进度数据 ===');
    if (userProgress) {
      console.log('✅ 找到用户进度数据:');
      console.log(JSON.stringify(userProgress, null, 2));
    } else {
      console.log('❌ 未找到用户进度数据');
      
      // 创建默认的用户进度数据
      console.log('\n=== 创建默认进度数据 ===');
      const newProgress = await prisma.userProgress.create({
        data: {
          userId: adminUser.id,
          modulesCompleted: 0,
          totalTimeSpent: 0,
          averageScore: null,
          streakDays: 0,
          lastActiveDate: new Date()
        }
      });
      console.log('✅ 创建了默认进度数据:', newProgress);
    }
    
    // 检查成就数据
    console.log('\n=== 用户成就数据 ===');
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: adminUser.id }
    });
    
    console.log(`找到 ${userAchievements.length} 个用户成就记录:`);
    if (userAchievements.length > 0) {
      userAchievements.forEach(achievement => {
        console.log(`- ${achievement.achievementId} (${achievement.name}): 进度${achievement.progress}%, 解锁时间${achievement.unlockedAt}`);
      });
    } else {
      console.log('❌ 用户还没有任何成就记录');
      
      // 让我们创建一些测试数据来触发成就
      console.log('\n=== 创建测试数据以触发成就 ===');
      
      // 创建一些学习进度记录
      await prisma.learningProgress.create({
        data: {
          userId: adminUser.id,
          moduleId: 'module-01',
          chapterId: 'chapter-01',
          status: 'COMPLETED',
          progress: 100,
          timeSpent: 1800, // 30分钟
          startedAt: new Date(Date.now() - 2000000),
          completedAt: new Date(Date.now() - 1000000),
          lastAccessAt: new Date()
        }
      });
      
      // 创建实验记录
      await prisma.userExperiment.create({
        data: {
          userId: adminUser.id,
          experimentId: 'exp-01',
          status: 'COMPLETED',
          score: 95,
          startedAt: new Date(Date.now() - 1500000),
          completedAt: new Date(Date.now() - 500000),
          timeSpent: 1000,
          attempts: 1,
          lastCode: 'console.log("Hello World");',
          results: JSON.stringify({ success: true, output: 'Hello World' })
        }
      });
      
      // 创建测验记录
      await prisma.quizAttempt.create({
        data: {
          userId: adminUser.id,
          quizId: 'quiz-01',
          score: 100,
          totalQuestions: 10,
          correctAnswers: 10,
          timeSpent: 300,
          answers: JSON.stringify([{question: 1, answer: 'A', correct: true}]),
          startedAt: new Date(Date.now() - 400000),
          completedAt: new Date(Date.now() - 100000)
        }
      });
      
      // 更新用户进度
      await prisma.userProgress.upsert({
        where: { userId: adminUser.id },
        update: {
          modulesCompleted: 1,
          totalTimeSpent: 3100,
          averageScore: 97.5,
          streakDays: 1,
          lastActiveDate: new Date()
        },
        create: {
          userId: adminUser.id,
          modulesCompleted: 1,
          totalTimeSpent: 3100,
          averageScore: 97.5,
          streakDays: 1,
          lastActiveDate: new Date()
        }
      });
      
      console.log('✅ 创建了测试学习数据');
    }
    
    // 检查学习活动数据
    console.log('\n=== 学习活动数据 ===');
    
    // 检查学习进度记录
    const learningProgress = await prisma.learningProgress.findMany({
      where: { userId: adminUser.id }
    });
    console.log(`学习进度记录: ${learningProgress.length} 条`);
    if (learningProgress.length > 0) {
      console.log('最近的学习进度:');
      learningProgress.slice(0, 3).forEach(progress => {
        console.log(`- 模块${progress.moduleId}: ${progress.status}, 进度${progress.progress}%`);
      });
    }
    
    // 检查实验记录
    const userExperiments = await prisma.userExperiment.findMany({
      where: { userId: adminUser.id }
    });
    console.log(`用户实验记录: ${userExperiments.length} 条`);
    if (userExperiments.length > 0) {
      console.log('实验完成情况:');
      userExperiments.forEach(exp => {
        console.log(`- 实验${exp.experimentId}: ${exp.status}, 得分${exp.score || 'N/A'}`);
      });
    }
    
    // 检查测验记录
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId: adminUser.id }
    });
    console.log(`测验尝试记录: ${quizAttempts.length} 条`);
    if (quizAttempts.length > 0) {
      console.log('测验成绩:');
      quizAttempts.slice(0, 3).forEach(quiz => {
        console.log(`- 测验${quiz.quizId}: 得分${quiz.score}, 正确率${Math.round((quiz.correctAnswers/quiz.totalQuestions)*100)}%`);
      });
    }
    
    // 检查积分交易记录
    const pointsTransactions = await prisma.userPointsTransaction.findMany({
      where: { userId: adminUser.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    console.log(`积分交易记录: ${pointsTransactions.length} 条`);
    if (pointsTransactions.length > 0) {
      console.log('最近的积分变化:');
      pointsTransactions.forEach(transaction => {
        console.log(`- ${transaction.type}: ${transaction.points > 0 ? '+' : ''}${transaction.points} (${transaction.description})`);
      });
    }
    
  } catch (error) {
    console.error('检查用户统计数据时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserStats();