const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestData() {
  try {
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
      console.log('未找到admin用户');
      return;
    }
    
    console.log('创建测试学习数据...');
    
    // 创建学习进度记录
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
    
    console.log('✅ 测试数据创建完成');
    
    // 检查创建的数据
    const learningProgress = await prisma.learningProgress.count({ where: { userId: adminUser.id } });
    const userExperiments = await prisma.userExperiment.count({ where: { userId: adminUser.id } });
    const quizAttempts = await prisma.quizAttempt.count({ where: { userId: adminUser.id } });
    
    console.log(`创建的数据统计:`);
    console.log(`- 学习进度记录: ${learningProgress} 条`);
    console.log(`- 实验记录: ${userExperiments} 条`);
    console.log(`- 测验记录: ${quizAttempts} 条`);
    
  } catch (error) {
    console.error('创建测试数据时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();