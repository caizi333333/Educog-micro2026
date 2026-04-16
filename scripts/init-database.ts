#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 开始初始化数据库...');
  
  try {
    // 创建默认用户
    const users = [
      {
        email: 'admin@educog.com',
        username: 'admin',
        password: await bcrypt.hash('admin123456', 10),
        name: '系统管理员',
        role: 'ADMIN' as const,
        status: 'ACTIVE' as const
      },
      {
        email: 'teacher@educog.com',
        username: 'teacher',
        password: await bcrypt.hash('teacher123456', 10),
        name: '张老师',
        role: 'TEACHER' as const,
        status: 'ACTIVE' as const,
        teacherId: 'T001',
        department: '计算机科学系',
        title: '副教授'
      },
      {
        email: 'student@educog.com',
        username: 'student',
        password: await bcrypt.hash('student123456', 10),
        name: '李同学',
        role: 'STUDENT' as const,
        status: 'ACTIVE' as const,
        studentId: 'S202301001',
        class: '计科2023-1班',
        grade: '2023级',
        major: '计算机科学与技术'
      },
      {
        email: 'demo1@educog.com',
        username: 'demo1',
        password: await bcrypt.hash('demo123456', 10),
        name: '王小明',
        role: 'STUDENT' as const,
        status: 'ACTIVE' as const,
        studentId: 'S202301002',
        class: '计科2023-1班',
        grade: '2023级',
        major: '计算机科学与技术'
      },
      {
        email: 'demo2@educog.com',
        username: 'demo2',
        password: await bcrypt.hash('demo123456', 10),
        name: '张小红',
        role: 'STUDENT' as const,
        status: 'ACTIVE' as const,
        studentId: 'S202301003',
        class: '计科2023-1班',
        grade: '2023级',
        major: '计算机科学与技术'
      }
    ];

    // 检查用户是否已存在
    for (const userData of users) {
      const existing = await prisma.user.findUnique({
        where: { username: userData.username }
      });
      
      if (!existing) {
        const user = await prisma.user.create({ data: userData });
        console.log(`✅ 创建用户: ${user.username} (${user.role})`);
      } else {
        console.log(`⏭️  用户已存在: ${existing.username}`);
      }
    }

    // 创建一些示例成就
    const achievements = [
      {
        achievementId: 'first_login',
        name: '初次登录',
        description: '完成首次登录',
        icon: '🎯',
        category: '系统'
      },
      {
        achievementId: 'first_quiz',
        name: '初试身手',
        description: '完成第一次测验',
        icon: '📝',
        category: '测验'
      },
      {
        achievementId: 'perfect_score',
        name: '满分达人',
        description: '测验获得满分',
        icon: '💯',
        category: '测验'
      },
      {
        achievementId: 'learning_streak_7',
        name: '学习达人',
        description: '连续7天学习',
        icon: '🔥',
        category: '学习'
      },
      {
        achievementId: 'experiment_master',
        name: '实验大师',
        description: '完成所有实验',
        icon: '🔬',
        category: '实验'
      }
    ];

    // 为演示学生添加一些成就
    const demoStudent = await prisma.user.findUnique({
      where: { username: 'student' }
    });

    if (demoStudent) {
      for (const achievement of achievements.slice(0, 2)) {
        const existing = await prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: {
              userId: demoStudent.id,
              achievementId: achievement.achievementId
            }
          }
        });

        if (!existing) {
          await prisma.userAchievement.create({
            data: {
              userId: demoStudent.id,
              ...achievement
            }
          });
          console.log(`✅ 为用户 ${demoStudent.username} 添加成就: ${achievement.name}`);
        }
      }
    }

    console.log('\n✨ 数据库初始化完成！');
    console.log('\n默认账号信息：');
    console.log('管理员 - username: admin, password: admin123456');
    console.log('教师 - username: teacher, password: teacher123456');
    console.log('学生 - username: student, password: student123456');
    console.log('演示学生1 - username: demo1, password: demo123456');
    console.log('演示学生2 - username: demo2, password: demo123456');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);