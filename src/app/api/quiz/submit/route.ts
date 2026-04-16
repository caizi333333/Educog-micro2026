import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateQuizPoints } from '@/lib/points-system';
import { checkAchievementsForQuiz } from '@/lib/achievement-checker';

export async function POST(request: Request) {
  try {
    // 验证用户身份
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

    // 保存测验尝试到数据库
    const quizAttempt = await prisma.quizAttempt.create({
      data: {
        userId: payload.userId,
        quizId: quizId || 'comprehensive-assessment',
        score,
        totalQuestions,
        correctAnswers,
        timeSpent: timeSpent || 0,
        answers: JSON.stringify({
          answers,
          moduleId,
          chapterId
        }),
        startedAt: new Date(new Date().getTime() - (timeSpent || 0) * 1000), // 计算开始时间
        completedAt: new Date()
      }
    });

    // 更新用户活动日志
    await prisma.userActivity.create({
      data: {
        userId: payload.userId,
        action: 'COMPLETE_QUIZ',
        details: JSON.stringify({
          quizId,
          score,
          weakAreas,
          scoresByKA
        })
      }
    });

    // 检查并授予成就（使用集中式成就检查器）
    const newAchievements = await checkAchievementsForQuiz(payload.userId, score, quizId);

    // 计算并奖励积分
    const points = calculateQuizPoints(score);
    await prisma.userPointsTransaction.create({
      data: {
        userId: payload.userId,
        points,
        type: score === 100 ? 'PERFECT_SCORE' : score >= 60 ? 'QUIZ_PASS' : 'COMPLETE_QUIZ',
        description: `完成测验获得${points}积分`,
        metadata: JSON.stringify({
          quizId,
          score,
          attemptId: quizAttempt.id
        })
      }
    });

    // 更新用户总积分
    await prisma.user.update({
      where: { id: payload.userId },
      data: {
        totalPoints: {
          increment: points
        }
      }
    });

    // 如果是章节测验，触发学习进度更新
    if (moduleId && chapterId) {
      try {
        // 查找该章节的学习进度
        const learningProgress = await prisma.learningProgress.findUnique({
          where: {
            userId_moduleId_chapterId: {
              userId: payload.userId,
              moduleId: moduleId,
              chapterId: chapterId
            }
          }
        });

        // 如果有学习进度记录，触发一次进度检查更新
        if (learningProgress) {
          const response = await fetch(`${request.url.replace('/quiz/submit', '/learning-progress')}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authorization
            },
            body: JSON.stringify({
              moduleId,
              chapterId,
              pathId: learningProgress.pathId,
              progress: learningProgress.progress,
              timeSpent: 0, // 不增加时间
              action: 'QUIZ_COMPLETED'
            })
          });
          
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
      totalPointsEarned: points + newAchievements.reduce((sum, ach) => sum + ach.points, 0)
    });

  } catch (error) {
    console.error('保存测评结果失败:', error);
    return NextResponse.json({ 
      error: '保存测评结果失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}