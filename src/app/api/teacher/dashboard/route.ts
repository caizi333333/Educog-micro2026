import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { experiments as experimentCatalog } from '@/lib/experiment-config';

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

    const { searchParams } = new URL(request.url);
    const requestedClassId = searchParams.get('classId');
    const accessibleClassIds = await getAccessibleClassIds(payload);

    if (requestedClassId && payload.role !== 'ADMIN' && !accessibleClassIds.includes(requestedClassId)) {
      return NextResponse.json({ error: '无权查看该班级' }, { status: 403 });
    }

    const activeClassIds = requestedClassId
      ? [requestedClassId]
      : accessibleClassIds;

    const classEnrollmentWhere = {
      role: 'STUDENT',
      status: 'ACTIVE',
      ...(activeClassIds.length > 0 ? { classId: { in: activeClassIds } } : {}),
      user: { role: 'STUDENT', status: 'ACTIVE', username: { not: { startsWith: 'demo_' } } },
    };

    const classEnrollments = activeClassIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: classEnrollmentWhere,
        include: {
          classGroup: { select: { id: true, name: true, courseName: true, semester: true } },
          user: { select: { id: true, name: true, username: true, studentId: true, class: true, lastLoginAt: true } },
        },
        orderBy: { joinedAt: 'desc' },
      });

    // 兼容没有班级归属的旧数据：管理员仍能看全部；教师只看自己班级。
    const students = payload.role === 'ADMIN' && !requestedClassId && classEnrollments.length === 0
      ? await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE', username: { not: { startsWith: 'demo_' } } },
        select: { id: true, name: true, username: true, studentId: true, class: true, lastLoginAt: true },
        orderBy: { name: 'asc' },
      })
      : classEnrollments.map((enrollment: any) => ({
        ...enrollment.user,
        class: enrollment.classGroup?.name || enrollment.user.class,
        classId: enrollment.classId,
        classGroup: enrollment.classGroup,
      }));

    const studentIds = students.map((s: any) => s.id);

    // 并行查询所有数据
    const [quizAttempts, experiments, learningProgress, activities, learningEvents] = await Promise.all([
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
      prisma.learningEvent.findMany({
        where: {
          userId: { in: studentIds },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          ...(requestedClassId ? { classId: requestedClassId } : activeClassIds.length > 0 ? { classId: { in: activeClassIds } } : {}),
        },
        select: { userId: true, eventType: true },
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
    const studentTimeSpent: Record<string, number> = {};
    for (const lp of learningProgress) {
      studentTimeSpent[lp.userId] = (studentTimeSpent[lp.userId] || 0) + (lp.timeSpent || 0);
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

    // Filter out test classes (验证测试班, LinkClass_*, DBClass_*)
    const isTestClass = (name?: string | null) =>
      !name || /^(验证测试班|LinkClass_|DBClass_|TestClass_)/.test(name);

    // Deduplicate by userId — a student enrolled in multiple classes should appear once
    const seenIds = new Set<string>();
    const uniqueStudents = students.filter((s: any) => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    // Build per-student list of class affiliations (exclude test classes)
    const studentClasses: Record<string, { id: string; name: string }[]> = {};
    for (const enrollment of classEnrollments) {
      const uid = (enrollment as any).user?.id;
      const cls = (enrollment as any).classGroup;
      if (uid && cls && !isTestClass(cls.name)) {
        if (!studentClasses[uid]) studentClasses[uid] = [];
        if (!studentClasses[uid].some((c) => c.id === cls.id)) {
          studentClasses[uid].push({ id: cls.id, name: cls.name });
        }
      }
    }

    // 构建学生列表
    const studentList = uniqueStudents.map((s: any) => {
      const quizScores = studentQuizScores[s.id] || {};
      const quizValues = Object.values(quizScores);
      const avgQuiz = quizValues.length > 0
        ? Math.round(quizValues.reduce((sum, v) => sum + v, 0) / quizValues.length)
        : 0;

      const expData = studentExperiments[s.id] || { completed: 0, total: 0 };
      const chapterMastery = studentChapterMastery[s.id] || {};
      const activityCount = learningEvents.filter((event: any) => event.userId === s.id).length;

      return {
        id: s.id,
        name: s.name,
        studentId: s.studentId,
        class: s.class,
        classId: (s as any).classId || null,
        classGroup: (s as any).classGroup || null,
        classes: studentClasses[s.id] || [],
        avgQuizScore: avgQuiz,
        experimentsCompleted: expData.completed,
        experimentsTotal: expData.total,
        chapterMastery,
        totalTimeSpent: studentTimeSpent[s.id] || 0,
        activityCount,
        lastActive: s.lastLoginAt,
      };
    });

    // 汇总统计（用去重后的学生数，不是班级注册记录数）
    const totalStudents = uniqueStudents.length;
    const activeToday = new Set([
      ...activities.map((activity: any) => activity.userId),
      ...learningEvents.map((event: any) => event.userId),
    ]).size;
    const allQuizScores = Object.values(studentQuizScores).flatMap(s => Object.values(s));
    const avgQuizScore = allQuizScores.length > 0
      ? Math.round(allQuizScores.reduce((s, v) => s + v, 0) / allQuizScores.length)
      : 0;

    const allExpCompleted = Object.values(studentExperiments).reduce((s: number, e) => s + e.completed, 0);
    const allExpTotal = Object.values(studentExperiments).reduce((s: number, e) => s + e.total, 0);
    const avgExpCompletion = allExpTotal > 0 ? Math.round(allExpCompleted / allExpTotal * 100) : 0;
    const totalTimeSpent = Object.values(studentTimeSpent).reduce((sum, value) => sum + value, 0);

    // 预警学生（平均分 < 60）— 含详细薄弱章节
    const alertStudents = studentList
      .filter((s: any) => s.avgQuizScore > 0 && s.avgQuizScore < 60)
      .map((s: any) => {
        const weakChapters = Object.entries(s.chapterMastery || {})
          .filter(([, v]: [string, any]) => v < 60)
          .map(([ch, v]: [string, any]) => ({ chapter: ch, progress: v }))
          .sort((a: any, b: any) => a.progress - b.progress)
          .slice(0, 3);
        return {
          id: s.id,
          name: s.name,
          studentId: s.studentId || null,
          avg: s.avgQuizScore,
          experimentsCompleted: s.experimentsCompleted || 0,
          experimentsTotal: s.experimentsTotal || 0,
          weakChapters,
        };
      });

    // Merge catalog experiments with actual DB experiment completion data
    // Only show experiments from the official catalog — skip test artifacts
    const experimentsForDashboard = experimentCatalog.map((experiment) => ({
      id: experiment.id,
      name: experiment.title,
      completed: experimentCompletion[experiment.id] || 0,
    }));

    return NextResponse.json({
      overview: {
        totalStudents,
        activeToday,
        avgQuizScore,
        avgExpCompletion,
        totalTimeSpent,
        avgTimeSpent: totalStudents > 0 ? Math.round(totalTimeSpent / totalStudents) : 0,
      },
      classes: classEnrollments
        .map((enrollment: any) => enrollment.classGroup)
        .filter(Boolean)
        .filter((cls: any) => !isTestClass(cls.name))
        .filter((item: any, index: number, self: any[]) => self.findIndex((next) => next.id === item.id) === index),
      students: studentList,
      experiments: experimentsForDashboard,
      experimentCompletion,
      eventActivity: learningEvents.reduce((acc: Record<string, number>, event: any) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      }, {}),
      alertStudents,
    });
  } catch (error) {
    console.error('Teacher dashboard API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
