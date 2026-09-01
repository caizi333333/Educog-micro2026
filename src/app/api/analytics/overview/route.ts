import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';
import { ALL_ACHIEVEMENTS } from '@/lib/achievements-v2';

const CURRENT_ACHIEVEMENT_IDS = new Set(ALL_ACHIEVEMENTS.map((achievement) => achievement.id));

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });

    const userId = payload.userId;
    const isTeacher = payload.role === 'TEACHER' || payload.role === 'ADMIN';
    const asOf = new Date();

    // Student-facing data (parallel queries)
    const [quizHistory, learningProgress, userStats, experimentStatus] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { userId, completedAt: { lte: asOf } },
        select: { id: true, score: true, totalQuestions: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 50,
      }),
      prisma.learningProgress.findMany({
        where: { userId, lastAccessAt: { lte: asOf } },
        select: { id: true, moduleId: true, chapterId: true, progress: true, timeSpent: true, lastAccessAt: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalPoints: true,
          achievements: {
            where: { unlockedAt: { lte: asOf } },
            select: { achievementId: true },
          },
          _count: { select: { experiments: true, quizAttempts: true, achievements: true, learningPaths: true } },
        },
      }),
      prisma.userExperiment.findMany({
        where: { userId, createdAt: { lte: asOf } },
        select: { experimentId: true, status: true },
      }),
    ]);

    // Computed stats
    const totalTimeSpent = learningProgress.reduce((sum, p) => sum + p.timeSpent, 0);
    const completedModules = learningProgress.filter(p => p.progress >= 100).length;
    const avgQuizScore = quizHistory.length > 0
      ? Math.round(quizHistory.reduce((s, q) => s + q.score, 0) / quizHistory.length)
      : 0;
    const completedExperiments = experimentStatus.filter(e => e.status === 'COMPLETED').length;
    const matchedAchievementCount = new Set(
      (userStats?.achievements ?? [])
        .map((achievement) => achievement.achievementId)
        .filter((achievementId) => CURRENT_ACHIEVEMENT_IDS.has(achievementId)),
    ).size;

    const overview: Record<string, unknown> = {
      quizHistory,
      learningProgress,
      summary: {
        totalPoints: userStats?.totalPoints || 0,
        totalExperiments: userStats?._count.experiments || 0,
        totalQuizzes: userStats?._count.quizAttempts || 0,
        // 仅统计当前成就目录中仍可识别的解锁记录，与成就页口径一致。
        // 历史孤立 achievementId 不再造成分析页与勋章墙数字不一致。
        totalAchievements: matchedAchievementCount,
        completedExperiments,
        completedModules,
        totalTimeSpent: Math.round(totalTimeSpent / 60),
        avgQuizScore,
      },
    };

    // Teacher extra data
    if (isTeacher) {
      const accessibleClassIds = await getAccessibleClassIds(payload);
      const studentEnrollments = accessibleClassIds.length === 0
        ? []
        : await prisma.classEnrollment.findMany({
          where: {
            classId: { in: accessibleClassIds },
            role: 'STUDENT',
            status: 'ACTIVE',
            user: { role: 'STUDENT', status: 'ACTIVE', username: { not: { startsWith: 'demo_' } } },
          },
          select: { userId: true },
        });
      const studentIds = [...new Set(studentEnrollments.map(e => e.userId))];

      if (studentIds.length > 0) {
        const [studentQuiz, studentProgress] = await Promise.all([
          prisma.quizAttempt.findMany({
            where: { userId: { in: studentIds } },
            select: { userId: true, score: true },
          }),
          prisma.learningProgress.findMany({
            where: { userId: { in: studentIds } },
            select: { userId: true, chapterId: true, progress: true },
          }),
        ]);

        const students = await prisma.user.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, name: true, studentId: true },
        });

        // Per-student averages
        const scoreMap = new Map<string, number[]>();
        for (const qa of studentQuiz) {
          const arr = scoreMap.get(qa.userId) || [];
          arr.push(qa.score);
          scoreMap.set(qa.userId, arr);
        }

        const classRanking = students.map(s => {
          const scores = scoreMap.get(s.id) || [];
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { name: s.name, studentId: s.studentId, avgScore: avg };
        }).sort((a, b) => b.avgScore - a.avgScore);

        // Chapter mastery distribution
        const chapterDist: Record<string, { high: number; medium: number; low: number }> = {};
        for (const lp of studentProgress) {
          if (!lp.chapterId) continue;
          const d = chapterDist[lp.chapterId] || { high: 0, medium: 0, low: 0 };
          if (lp.progress >= 80) d.high++;
          else if (lp.progress >= 50) d.medium++;
          else d.low++;
          chapterDist[lp.chapterId] = d;
        }

        overview['teacherData'] = { classRanking, chapterMasteryDist: chapterDist, totalStudents: studentIds.length };
      } else {
        overview['teacherData'] = { classRanking: [], chapterMasteryDist: {}, totalStudents: 0 };
      }
    }

    return NextResponse.json({
      success: true,
      dataProvenance: getDataProvenance(),
      asOf: asOf.toISOString(),
      sampleSize: {
        quizAttempts: quizHistory.length,
        learningProgressRecords: learningProgress.length,
        experimentRecords: experimentStatus.length,
        achievementRecords: matchedAchievementCount,
        achievementRules: ALL_ACHIEVEMENTS.length,
      },
      data: overview,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('analytics/overview error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
