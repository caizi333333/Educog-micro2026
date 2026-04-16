import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 获取所有学生
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true, name: true, studentId: true, class: true, lastLoginAt: true },
      orderBy: { name: 'asc' },
    });

    const studentIds = students.map(s => s.id);

    // 并行查询所有数据
    const [quizAttempts, experiments, learningProgress, activities] = await Promise.all([
      // 每个学生的测验记录
      prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, quizId: true, score: true, completedAt: true },
      }),
      // 每个学生的实验记录
      prisma.userExperiment.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, experimentId: true, status: true, score: true },
      }),
      // 学习进度
      prisma.learningProgress.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, chapterId: true, progress: true, timeSpent: true },
      }),
      // 今日活跃（24小时内有活动记录）
      prisma.userActivity.findMany({
        where: {
          userId: { in: studentIds },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    // 按学生聚合测验分数（按 chapterId / quizId 分组）
    const studentQuizScores: Record<string, Record<string, number>> = {};
    for (const qa of quizAttempts) {
      if (!studentQuizScores[qa.userId]) studentQuizScores[qa.userId] = {};
      const key = qa.quizId;
      // 取最高分
      const prev = studentQuizScores[qa.userId][key] || 0;
      if (qa.score > prev) studentQuizScores[qa.userId][key] = qa.score;
    }

    // 按学生聚合实验完成
    const studentExperiments: Record<string, { completed: number; total: number }> = {};
    for (const exp of experiments) {
      if (!studentExperiments[exp.userId]) studentExperiments[exp.userId] = { completed: 0, total: 0 };
      studentExperiments[exp.userId].total++;
      if (exp.status === 'COMPLETED') studentExperiments[exp.userId].completed++;
    }

    // 按学生聚合章节掌握度
    const studentChapterMastery: Record<string, Record<string, number>> = {};
    for (const lp of learningProgress) {
      if (!lp.chapterId) continue;
      if (!studentChapterMastery[lp.userId]) studentChapterMastery[lp.userId] = {};
      studentChapterMastery[lp.userId][lp.chapterId] = lp.progress;
    }

    // 实验完成统计（每个实验有多少人完成）
    const experimentCompletion: Record<string, number> = {};
    for (const exp of experiments) {
      if (exp.status === 'COMPLETED') {
        experimentCompletion[exp.experimentId] = (experimentCompletion[exp.experimentId] || 0) + 1;
      }
    }

    // 构建学生列表
    const studentList = students.map(s => {
      const quizScores = studentQuizScores[s.id] || {};
      const quizValues = Object.values(quizScores);
      const avgQuiz = quizValues.length > 0
        ? Math.round(quizValues.reduce((sum, v) => sum + v, 0) / quizValues.length)
        : 0;

      const expData = studentExperiments[s.id] || { completed: 0, total: 0 };
      const chapterMastery = studentChapterMastery[s.id] || {};

      return {
        id: s.id,
        name: s.name,
        studentId: s.studentId,
        class: s.class,
        avgQuizScore: avgQuiz,
        experimentsCompleted: expData.completed,
        experimentsTotal: expData.total,
        chapterMastery,
        lastActive: s.lastLoginAt,
      };
    });

    // 汇总统计
    const totalStudents = students.length;
    const activeToday = activities.length;
    const allQuizScores = Object.values(studentQuizScores).flatMap(s => Object.values(s));
    const avgQuizScore = allQuizScores.length > 0
      ? Math.round(allQuizScores.reduce((s, v) => s + v, 0) / allQuizScores.length)
      : 0;

    const allExpCompleted = Object.values(studentExperiments).reduce((s, e) => s + e.completed, 0);
    const allExpTotal = Object.values(studentExperiments).reduce((s, e) => s + e.total, 0);
    const avgExpCompletion = allExpTotal > 0 ? Math.round(allExpCompleted / allExpTotal * 100) : 0;

    // 预警学生（平均分 < 60）
    const alertStudents = studentList
      .filter(s => s.avgQuizScore > 0 && s.avgQuizScore < 60)
      .map(s => ({ name: s.name, avg: s.avgQuizScore }));

    return NextResponse.json({
      overview: {
        totalStudents,
        activeToday,
        avgQuizScore,
        avgExpCompletion,
      },
      students: studentList,
      experimentCompletion,
      alertStudents,
    });
  } catch (error) {
    console.error('Teacher dashboard API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
