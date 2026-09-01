import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessStudentData } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';
import { OFFICIAL_EXPERIMENT_IDS } from '@/lib/experiment-config';
import {
  ACHIEVEMENTS_V2
} from '@/lib/achievements-v2';

// In-memory rate limiter: userId → [timestamps]
const rateLimiter = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const window = rateLimiter.get(userId) || [];
  const recent = window.filter(t => now - t < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimiter.set(userId, recent);
  return true;
}

// GET: fetch user achievements (unchanged logic, updated imports)
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

    const userRecord = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, totalPoints: true }
    });

    if (!userRecord) {
      return NextResponse.json({
        error: '用户不存在',
        message: '用户账户不存在'
      }, { status: 404 });
    }
    const user = userRecord;
    const asOf = new Date();

    // 5 次并发查询取代原来 14 次：同一 userId 下按 action/status 分别 count 的查询
    // 合并成单次 findMany，在内存里派生所有统计值。Neon 连接池并发上限较低，
    // 之前 12 条查询挤在一个 Promise.all 里很容易触发 P1001 连接失败。
    const [
      userAchievements, allActivities, allLearningProgress, allQuizAttempts, allExperiments
    ] = await Promise.all([
      prisma.userAchievement.findMany({ where: { userId: payload.userId, unlockedAt: { lte: asOf } }, orderBy: { unlockedAt: 'desc' } }),
      prisma.userActivity.findMany({ where: { userId: payload.userId, createdAt: { lte: asOf } }, select: { action: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
      prisma.learningProgress.findMany({ where: { userId: payload.userId, lastAccessAt: { lte: asOf } }, select: { status: true, timeSpent: true } }),
      prisma.quizAttempt.findMany({ where: { userId: payload.userId, completedAt: { lte: asOf } }, select: { score: true } }),
      prisma.userExperiment.findMany({
        where: {
          userId: payload.userId,
          createdAt: { lte: asOf },
          experimentId: { in: [...OFFICIAL_EXPERIMENT_IDS] },
        },
        select: { experimentId: true, status: true, timeSpent: true },
      }),
    ]);

    const currentAchievementIds = new Set(ACHIEVEMENTS_V2.map((achievement) => achievement.id));
    const matchedUserAchievements = userAchievements.filter((achievement) => currentAchievementIds.has(achievement.achievementId));

    const countByAction = (action: string) => allActivities.filter(a => a.action === action).length;
    const codeRuns = countByAction('RUN_CODE');
    const debugSuccess = countByAction('DEBUG_SUCCESS');
    const discussionsStarted = allActivities.filter(a => a.action.includes('DISCUSSION')).length;
    const easterEggFound = countByAction('EASTER_EGG');
    const bugsReported = countByAction('BUG_REPORT');

    const completedModules = allLearningProgress.filter(p => p.status === 'COMPLETED').length;
    const speedCompletionCount = allLearningProgress.filter(p => p.status === 'COMPLETED' && (p.timeSpent ?? Infinity) < 300).length;
    const learningStats = {
      _sum: { timeSpent: allLearningProgress.reduce((sum, p) => sum + (p.timeSpent || 0), 0) }
    };

    const perfectScores = allQuizAttempts.filter(q => q.score === 100).length;
    const quizStats = {
      _count: { _all: allQuizAttempts.length },
      _avg: { score: allQuizAttempts.length > 0 ? allQuizAttempts.reduce((sum, q) => sum + q.score, 0) / allQuizAttempts.length : 0 }
    };

    let nightStudy = 0;
    let morningStudy = 0;
    let dailyStreak = 0;
    let continuousHours = 0;

    if (allActivities.length > 0) {
      const activityDates = new Set<string>();
      for (const activity of allActivities) {
        const date = new Date(activity.createdAt);
        const hour = date.getHours();
        if (hour >= 22 || hour < 6) nightStudy++;
        if (hour >= 5 && hour < 9) morningStudy++;
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        activityDates.add(dateStr);
      }

      if (activityDates.size > 0) {
        const sortedDates = Array.from(activityDates).sort().reverse();
        let streak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const current = new Date(sortedDates[i - 1]);
          const previous = new Date(sortedDates[i]);
          const diffDays = Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) streak++;
          else break;
        }
        const latest = new Date(`${sortedDates[0]}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysSinceLatest = Math.round((today.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));
        dailyStreak = daysSinceLatest >= 0 && daysSinceLatest <= 1 ? streak : 0;
      }

      const SESSION_GAP_MS = 30 * 60 * 1000;
      let sessionStart = allActivities[0].createdAt.getTime();
      let sessionEnd = sessionStart;
      let maxSessionMs = 0;
      for (let i = 1; i < allActivities.length; i++) {
        const actTime = allActivities[i].createdAt.getTime();
        if (actTime - sessionEnd <= SESSION_GAP_MS) {
          sessionEnd = actTime;
        } else {
          if (sessionEnd - sessionStart > maxSessionMs) maxSessionMs = sessionEnd - sessionStart;
          sessionStart = actTime;
          sessionEnd = actTime;
        }
      }
      if (sessionEnd - sessionStart > maxSessionMs) maxSessionMs = sessionEnd - sessionStart;
      continuousHours = Math.floor(maxSessionMs / (1000 * 60 * 60));
    }

    const userStats = {
      modules_completed: completedModules,
      code_runs: codeRuns,
      debug_success: debugSuccess,
      experiments_completed: allExperiments.filter((experiment) => experiment.status === 'COMPLETED').length,
      daily_streak: dailyStreak,
      perfect_quiz: perfectScores,
      speed_completion: speedCompletionCount,
      night_study: nightStudy,
      morning_study: morningStudy,
      questions_answered: quizStats._count._all || 0,
      discussions_started: discussionsStarted,
      easter_egg_found: easterEggFound,
      bugs_reported: bugsReported,
      continuous_hours: continuousHours,
      learning_time: learningStats._sum.timeSpent || 0,
      quizzes_completed: quizStats._count._all || 0,
      perfect_scores: perfectScores,
      quiz_average: quizStats._avg.score || 0,
      experiment_time: allExperiments.reduce((sum, experiment) => sum + Math.max(0, experiment.timeSpent || 0), 0),
      total_points: user?.totalPoints || 0,
      achievements_unlocked: matchedUserAchievements.length,
    };

    const achievementList: Array<{
      id: string; achievementId: string; name: string; description: string;
      icon: string; category: string; unlocked: boolean; isUnlocked: boolean;
      unlockedAt?: Date; progress: number; progressPercentage: number;
      points: number; rarity: string;
    }> = [];

    ACHIEVEMENTS_V2.forEach(achievement => {
      const criteriaType = achievement.criteria.type as keyof typeof userStats;
      const currentValue = userStats[criteriaType] || 0;
      const targetValue = achievement.criteria.target as number;

      const userAch = matchedUserAchievements.find((a: { achievementId: string }) => a.achievementId === achievement.id);
      const isUnlocked = Boolean(userAch);
      const progress = userAch ? userAch.progress : (targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0);

      const entry: typeof achievementList[number] = {
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
        rarity: achievement.rarity,
      };

      if (userAch?.unlockedAt) entry.unlockedAt = userAch.unlockedAt;
      achievementList.push(entry);
    });

    const totalPossibleAchievements = achievementList.length;
    const unlockedCount = achievementList.filter(a => a.unlocked).length;

    const stats = {
      totalAchievements: totalPossibleAchievements,
      unlockedAchievements: unlockedCount,
      completionRate: totalPossibleAchievements > 0 ? Math.round((unlockedCount / totalPossibleAchievements) * 100) : 0,
      totalPoints: user?.totalPoints || 0,
    };

    return NextResponse.json({
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: asOf.toISOString(),
      sampleSize: {
        achievementRules: totalPossibleAchievements,
        unlockedAchievementRecords: unlockedCount,
        activityRecords: allActivities.length,
        learningProgressRecords: allLearningProgress.length,
        quizAttempts: allQuizAttempts.length,
        experimentRecords: allExperiments.length,
      },
      achievements: achievementList,
      stats,
      userStats
    });

  } catch (error) {
    console.error('获取成就失败:', error);
    return NextResponse.json({
      error: '服务器内部错误'
    }, { status: 500 });
  }
}

// POST: manually grant achievement (teacher/admin only)
export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    // Students cannot manually grant achievements
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({
        error: '权限不足',
        message: '学生不能手动解锁成就，请通过学习活动自动解锁'
      }, { status: 403 });
    }

    // Rate limit
    if (!checkRateLimit(payload.userId)) {
      return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    const achievementId = typeof data.achievementId === 'string' ? data.achievementId.trim() : '';
    const targetUserId = typeof data.targetUserId === 'string' ? data.targetUserId.trim() : '';
    const reason = typeof data.reason === 'string' ? data.reason.trim().slice(0, 500) : '';
    if (!achievementId || !targetUserId) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // Validate achievement ID
    const validAchievement = ACHIEVEMENTS_V2.find(ach => ach.id === achievementId);
    if (!validAchievement) {
      return NextResponse.json({ error: '无效的成就 ID' }, { status: 400 });
    }

    // Verify target user
    const recipient = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true, class: true }
    });
    if (!recipient || recipient.status !== 'ACTIVE' || recipient.role !== 'STUDENT') {
      return NextResponse.json({ error: '用户不存在或未激活' }, { status: 404 });
    }

    // Teacher: can only award students in their own class
    if (payload.role === 'TEACHER' && !(await canAccessStudentData(payload, targetUserId))) {
      return NextResponse.json({ error: '只能授予自己班级的学生' }, { status: 403 });
    }

    // Grant in transaction
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId: targetUserId, achievementId } }
      });
      if (existing) {
        return { alreadyExists: true as const };
      }

      await tx.userAchievement.create({
        data: {
          userId: targetUserId,
          achievementId,
          name: validAchievement.title,
          description: validAchievement.description,
          icon: validAchievement.icon,
          category: validAchievement.category,
          progress: 100,
          points: validAchievement.points,
          source: payload.role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
          awardedBy: payload.userId,
        }
      });

      if (validAchievement.points > 0) {
        await tx.userPointsTransaction.create({
          data: {
            userId: targetUserId,
            points: validAchievement.points,
            type: 'ACHIEVEMENT_UNLOCK',
            description: `手动授予: ${validAchievement.title}`,
            metadata: JSON.stringify({ achievementId, awardedBy: payload.userId })
          }
        });
        await tx.user.update({
          where: { id: targetUserId },
          data: { totalPoints: { increment: validAchievement.points } }
        });
      }

      await tx.userActivity.create({
        data: {
          userId: targetUserId,
          action: 'TEACHER_AWARD_ACHIEVEMENT',
          details: JSON.stringify({
            achievementId,
            awardedBy: payload.userId,
            reason
          })
        }
      });

      await tx.achievementAuditLog.create({
        data: {
          userId: targetUserId,
          achievementId,
          action: 'GRANT',
          performedBy: payload.userId,
          newState: JSON.stringify({ points: validAchievement.points, source: payload.role, reason }),
        }
      });

      return { alreadyExists: false as const };
    });

    if (result.alreadyExists) {
      return NextResponse.json({ success: false, message: '成就已解锁' });
    }

    return NextResponse.json({ success: true, message: '成就已授予' });

  } catch (error) {
    console.error('授予成就失败:', error);
    return NextResponse.json({
      error: '服务器内部错误'
    }, { status: 500 });
  }
}
