import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { 
  ACHIEVEMENTS_V2,
  checkAchievementUnlock,
  type AchievementProgress
} from '@/lib/achievements-v2';

// 获取用户成就
export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: '未授权',
        message: '请先登录以查看成就'
      }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ 
        error: '无效的令牌',
        message: '登录已过期，请重新登录'
      }, { status: 401 });
    }

    // 检查用户是否存在
    const userExists = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true }
    });
    
    if (!userExists) {
      return NextResponse.json({ 
        error: '用户不存在',
        message: '用户账户不存在'
      }, { status: 404 });
    }

    // 获取用户的所有成就
    const userAchievements = await prisma.userAchievement.findMany({
      where: {
        userId: payload.userId
      },
      orderBy: {
        unlockedAt: 'desc'
      }
    });

    // 获取用户统计数据用于计算成就进度
    const [
      learningStats, quizStats, experimentStats, user, codeRuns, debugSuccess,
      completedModules, perfectScores,
      discussionsStarted, easterEggFound, bugsReported,
      speedCompletionCount,
      allActivities
    ] = await Promise.all([
      // 学习统计
      prisma.learningProgress.aggregate({
        where: { userId: payload.userId },
        _sum: { timeSpent: true },
        _count: { _all: true }
      }),
      // 测验统计
      prisma.quizAttempt.aggregate({
        where: { userId: payload.userId },
        _avg: { score: true },
        _count: { _all: true }
      }),
      // 实验统计
      prisma.userActivity.aggregate({
        where: {
          userId: payload.userId,
          action: { in: ['COMPLETE_EXPERIMENT', 'START_EXPERIMENT'] }
        },
        _count: { _all: true }
      }),
      // 用户数据
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { totalPoints: true }
      }),
      // 代码运行次数
      prisma.userActivity.count({
        where: {
          userId: payload.userId,
          action: 'RUN_CODE'
        }
      }),
      // 调试成功次数
      prisma.userActivity.count({
        where: {
          userId: payload.userId,
          action: 'DEBUG_SUCCESS'
        }
      }),
      // 完成的模块数
      prisma.learningProgress.count({
        where: {
          userId: payload.userId,
          status: 'COMPLETED'
        }
      }),
      // 满分次数
      prisma.quizAttempt.count({
        where: {
          userId: payload.userId,
          score: 100
        }
      }),
      // 讨论统计
      prisma.userActivity.count({
        where: {
          userId: payload.userId,
          action: { contains: 'DISCUSSION' }
        }
      }),
      // 彩蛋统计
      prisma.userActivity.count({
        where: {
          userId: payload.userId,
          action: 'EASTER_EGG'
        }
      }),
      // bug报告统计
      prisma.userActivity.count({
        where: {
          userId: payload.userId,
          action: 'BUG_REPORT'
        }
      }),
      // 快速完成统计：5分钟内完成的学习模块
      prisma.learningProgress.count({
        where: {
          userId: payload.userId,
          status: 'COMPLETED',
          timeSpent: { lt: 300 }
        }
      }),
      // 所有活动记录（用于计算夜间/晨间学习、连续天数、连续学习时长）
      prisma.userActivity.findMany({
        where: { userId: payload.userId },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' }
      })
    ]);

    // 从活动记录中计算时间相关指标
    let nightStudy = 0;
    let morningStudy = 0;
    let dailyStreak = 0;
    let continuousHours = 0;

    if (allActivities.length > 0) {
      // 按日期收集活动，同时统计夜间/晨间
      const activityDates = new Set<string>();

      for (const activity of allActivities) {
        const date = new Date(activity.createdAt);
        const hour = date.getHours();

        // 夜间学习: 22:00-06:00
        if (hour >= 22 || hour < 6) {
          nightStudy++;
        }
        // 晨间学习: 05:00-09:00
        if (hour >= 5 && hour < 9) {
          morningStudy++;
        }

        // 收集活动日期（YYYY-MM-DD）用于连续天数计算
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        activityDates.add(dateStr);
      }

      // 计算连续学习天数（从最近一天往前数）
      if (activityDates.size > 0) {
        const sortedDates = Array.from(activityDates).sort().reverse();
        let streak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const current = new Date(sortedDates[i - 1]);
          const previous = new Date(sortedDates[i]);
          const diffMs = current.getTime() - previous.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
          } else {
            break;
          }
        }
        dailyStreak = streak;
      }

      // 计算最大连续学习时长（小时）
      // 两次活动间隔 <= 30分钟视为同一学习会话
      const SESSION_GAP_MS = 30 * 60 * 1000;
      let sessionStart = allActivities[0].createdAt.getTime();
      let sessionEnd = sessionStart;
      let maxSessionMs = 0;

      for (let i = 1; i < allActivities.length; i++) {
        const actTime = allActivities[i].createdAt.getTime();
        if (actTime - sessionEnd <= SESSION_GAP_MS) {
          sessionEnd = actTime;
        } else {
          const sessionLen = sessionEnd - sessionStart;
          if (sessionLen > maxSessionMs) {
            maxSessionMs = sessionLen;
          }
          sessionStart = actTime;
          sessionEnd = actTime;
        }
      }
      // 检查最后一个会话
      const lastSessionLen = sessionEnd - sessionStart;
      if (lastSessionLen > maxSessionMs) {
        maxSessionMs = lastSessionLen;
      }
      continuousHours = Math.floor(maxSessionMs / (1000 * 60 * 60));
    }

    // 构建用户统计数据对象，匹配新成就系统的要求
    const userStats = {
      modules_completed: completedModules,
      code_runs: codeRuns,
      debug_success: debugSuccess,
      experiments_completed: experimentStats._count._all || 0,
      daily_streak: dailyStreak,
      perfect_quiz: perfectScores,
      speed_completion: speedCompletionCount,
      night_study: nightStudy,
      morning_study: morningStudy,
      questions_answered: quizStats._count._all || 0,
      discussions_started: discussionsStarted,
      easter_egg_found: easterEggFound,
      bugs_reported: bugsReported,
      continuous_hours: continuousHours
    };

    // 检查ACHIEVEMENTS_V2是否正确导入
    if (!ACHIEVEMENTS_V2 || !Array.isArray(ACHIEVEMENTS_V2)) {
      console.error('ACHIEVEMENTS_V2 not properly imported:', ACHIEVEMENTS_V2);
      throw new Error('Achievement system not initialized');
    }
    
    // 生成成就列表
    const achievementList: Array<{
      id: string;
      achievementId: string;
      name: string;
      description: string;
      icon: string;
      category: string;
      unlocked: boolean;
      isUnlocked: boolean;
      unlockedAt?: Date;
      progress: number;
      progressPercentage: number;
      points: number;
      rarity: string;
    }> = [];
    
    ACHIEVEMENTS_V2.forEach(achievement => {
      const criteriaType = achievement.criteria.type as keyof typeof userStats;
      const currentValue = userStats[criteriaType] || 0;
      const targetValue = achievement.criteria.target as number;
      
      const userAch = userAchievements.find((a: { achievementId: string }) => a.achievementId === achievement.id);
      // 检查数据库中是否已解锁，或者满足解锁条件
      const isUnlocked = userAch ? true : (currentValue >= targetValue);
      
      // 计算进度
      const progress = userAch ? userAch.progress : Math.min((currentValue / targetValue) * 100, 100);
        
        const achievementEntry = {
          id: achievement.id,
          achievementId: achievement.id,
          name: achievement.title,
          description: achievement.description,
          icon: achievement.icon,
          category: achievement.category,
          unlocked: isUnlocked,
          isUnlocked: isUnlocked,
          progress: isUnlocked ? 100 : Math.round(progress),
          progressPercentage: isUnlocked ? 100 : Math.round(progress),
          points: achievement.points,
          rarity: achievement.rarity
        } as any;
        
        if (userAch?.unlockedAt) {
          achievementEntry.unlockedAt = userAch.unlockedAt;
        }
        
        achievementList.push(achievementEntry);
    });

    // 统计信息
    const totalPossibleAchievements = achievementList.length;
    const unlockedCount = achievementList.filter(a => a.unlocked).length;
    const latestUnlocked = achievementList
      .filter(a => a.unlocked && a.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())[0];
    
    const stats = {
      totalAchievements: totalPossibleAchievements,
      unlockedAchievements: unlockedCount,
      completionRate: Math.round((unlockedCount / totalPossibleAchievements) * 100),
      latestAchievement: latestUnlocked ? {
        name: latestUnlocked.name,
        unlockedAt: latestUnlocked.unlockedAt
      } : null,
      totalPoints: user?.totalPoints || 0,
      bronzeBadges: achievementList.filter(a => a.unlocked && a.achievementId.endsWith('_bronze')).length,
      silverBadges: achievementList.filter(a => a.unlocked && a.achievementId.endsWith('_silver')).length,
      goldBadges: achievementList.filter(a => a.unlocked && a.achievementId.endsWith('_gold')).length,
      badges: {
        bronze: achievementList.filter(a => a.unlocked && a.category === 'learning').length,
        silver: achievementList.filter(a => a.unlocked && a.category === 'coding').length,
        gold: achievementList.filter(a => a.unlocked && a.category === 'special').length
      }
    };

    return NextResponse.json({
      success: true,
      achievements: achievementList,
      stats,
      userStats
    });

  } catch (error) {
    console.error('获取成就失败:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown'
    });
    
    // 检查是否是数据库连接错误
    if (error instanceof Error && error.message.includes('Database connection')) {
      return NextResponse.json({ 
        error: '服务器内部错误',
        details: '数据库连接失败'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}

// 解锁成就
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: '未授权',
        message: '请先登录'
      }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    
    if (!payload) {
      return NextResponse.json({ 
        error: '无效的令牌',
        message: '登录已过期，请重新登录'
      }, { status: 401 });
    }

    let data;
    try {
      data = await request.json();
    } catch (error) {
      return NextResponse.json({ 
        error: '请求格式错误',
        message: '无效的JSON格式'
      }, { status: 400 });
    }
    
    const { achievementId, name, description, icon, category, progress } = data;

    // 验证成就ID
    const validAchievement = ACHIEVEMENTS_V2.find(ach => ach.id === achievementId);
    if (!validAchievement) {
      return NextResponse.json(
        { error: 'Invalid achievement ID' },
        { status: 400 }
      );
    }

    // 检查成就是否已存在
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId: payload.userId,
          achievementId: achievementId
        }
      }
    });

    if (existing) {
      // 更新进度
      if (progress !== undefined && progress < 100) {
        const updated = await prisma.userAchievement.update({
          where: { id: existing.id },
          data: { progress }
        });
        return NextResponse.json({
          success: true,
          achievement: updated,
          message: '成就进度已更新'
        });
      }
      
      return NextResponse.json({
        success: false,
        message: '成就已解锁'
      });
    }

    // 创建新成就
    const achievement = await prisma.userAchievement.create({
      data: {
        userId: payload.userId,
        achievementId,
        name: validAchievement.title,
        description: validAchievement.description,
        icon: validAchievement.icon,
        category: validAchievement.category,
        progress: progress || 100
      }
    });

    // 记录活动
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'UNLOCK_ACHIEVEMENT',
        details: JSON.stringify({
          achievementId,
          achievementName: name
        })
      }
    });

    return NextResponse.json({
      success: true,
      achievement,
      message: '恭喜！您解锁了新成就'
    });

  } catch (error) {
    console.error('解锁成就失败:', error);
    
    // 检查是否是数据库连接错误
    if (error instanceof Error && error.message.includes('Database connection')) {
      return NextResponse.json({ 
        error: '服务器内部错误',
        details: '数据库连接失败'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: '服务器内部错误',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}
