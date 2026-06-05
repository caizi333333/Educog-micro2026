import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateQuizPoints } from '@/lib/points-system';
import { checkAchievementsForQuiz } from '@/lib/achievement-checker';
import { getActiveClassIdForUser, normalizeLearningEventInput } from '@/lib/classroom';

const DEDUP_WINDOW_MS = 30_000;

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
    }

    const data = await request.json();
    const { quizId, score, totalQuestions, correctAnswers, timeSpent, answers, weakAreas, scoresByKA, moduleId, chapterId } = data;

    if (score === undefined || score === null) {
      return NextResponse.json({ error: '缺少必填字段: score' }, { status: 400 });
    }

    const numScore = Number(score);
    const numTotal = Number(totalQuestions) || 0;
    const numCorrect = Number(correctAnswers) || 0;
    if (numScore < 0 || numScore > 100) {
      return NextResponse.json({ error: '分数必须在 0-100 之间' }, { status: 400 });
    }
    if (numTotal > 0 && numCorrect > numTotal) {
      return NextResponse.json({ error: '正确题数不能超过总题数' }, { status: 400 });
    }

    const resolvedQuizId = quizId || 'comprehensive-assessment';

    // 防重复提交：同用户同 quizId 30 秒内已提交过则拒绝
    const recentAttempt = await prisma.quizAttempt.findFirst({
      where: {
        userId: payload.userId,
        quizId: resolvedQuizId,
        completedAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recentAttempt) {
      return NextResponse.json(
        { error: '请勿重复提交，请稍后再试', attemptId: recentAttempt.id },
        { status: 429 },
      );
    }

    const points = calculateQuizPoints(score);

    // 核心写入放入事务
    const quizAttempt = await prisma.$transaction(async (tx) => {
      const attempt = await tx.quizAttempt.create({
        data: {
          userId: payload.userId,
          quizId: resolvedQuizId,
          score,
          totalQuestions,
          correctAnswers,
          timeSpent: timeSpent || 0,
          answers: JSON.stringify({ answers, moduleId, chapterId }),
          startedAt: new Date(Date.now() - (timeSpent || 0) * 1000),
          completedAt: new Date(),
        },
      });

      await tx.userActivity.create({
        data: {
          userId: payload.userId,
          action: 'COMPLETE_QUIZ',
          details: JSON.stringify({ quizId, score, weakAreas, scoresByKA }),
        },
      });

      await tx.userPointsTransaction.create({
        data: {
          userId: payload.userId,
          points,
          type: score === 100 ? 'PERFECT_SCORE' : score >= 60 ? 'QUIZ_PASS' : 'COMPLETE_QUIZ',
          description: `完成测验获得${points}积分`,
          metadata: JSON.stringify({ quizId, score, attemptId: attempt.id }),
        },
      });

      await tx.user.update({
        where: { id: payload.userId },
        data: { totalPoints: { increment: points } },
      });

      return attempt;
    });

    // 成就检查（非事务，失败不影响主流程）
    const newAchievements = await checkAchievementsForQuiz(payload.userId, score, quizId);

    // 学习事件记录（非事务，失败不影响主流程）
    try {
      const classId = await getActiveClassIdForUser(payload.userId);
      const learningEvent = normalizeLearningEventInput({
        eventType: 'COMPLETE_QUIZ',
        targetType: 'QUIZ',
        targetId: resolvedQuizId,
        moduleId,
        chapterId,
        quizId: resolvedQuizId,
        duration: timeSpent || 0,
        progress: score,
        metadata: { source: 'quiz-submit-api', action: 'COMPLETE_QUIZ', score, weakAreas, scoresByKA },
      }, resolvedQuizId);

      if (learningEvent) {
        await prisma.learningEvent.create({
          data: { userId: payload.userId, classId, ...learningEvent },
        });
      }
    } catch (eventError) {
      console.error('记录测评行为失败:', eventError);
    }

    // 章节测验 → 触发学习进度更新
    if (moduleId && chapterId) {
      try {
        const learningProgress = await prisma.learningProgress.findUnique({
          where: { userId_moduleId_chapterId: { userId: payload.userId, moduleId, chapterId } },
        });
        if (learningProgress) {
          const response = await fetch(
            `${request.url.replace('/quiz/submit', '/learning-progress')}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: authorization },
              body: JSON.stringify({
                moduleId, chapterId,
                pathId: learningProgress.pathId,
                progress: learningProgress.progress,
                timeSpent: 0,
                action: 'QUIZ_COMPLETED',
              }),
            },
          );
          if (!response.ok) {
            console.error('Failed to update learning progress after quiz completion');
          }
        }
      } catch (error) {
        console.error('Error updating learning progress:', error);
      }
    }

    return NextResponse.json({
      success: true,
      attemptId: quizAttempt.id,
      message: '测评结果已保存',
      newAchievements: newAchievements.length > 0 ? newAchievements : null,
      pointsEarned: points,
      totalPointsEarned: points + newAchievements.reduce((sum, ach) => sum + ach.points, 0),
    });
  } catch (error) {
    console.error('保存测评结果失败:', error);
    return NextResponse.json({
      error: '保存测评结果失败',
      details: error instanceof Error ? error.message : '未知错误',
    }, { status: 500 });
  }
}
