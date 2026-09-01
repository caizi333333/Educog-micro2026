import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { experiments as experimentCatalog } from '@/lib/experiment-config';
import { getDataProvenance } from '@/lib/env';

const OFFICIAL_EXPERIMENT_IDS = experimentCatalog.map((experiment) => experiment.id);
const DEMO_ACCOUNT_PREFIX = 'demo_';
const DEMO_ACCOUNT_EXCLUSION = '账号名以 demo_ 开头的专用演示学生不纳入教学分析';

type ClassSummary = {
  id: string;
  name: string;
  courseName: string | null;
  semester: string | null;
};

type DashboardStudent = {
  id: string;
  name: string;
  username: string;
  studentId: string | null;
  class: string | null;
  lastLoginAt: Date | null;
  classId: string | null;
  classGroup: ClassSummary | null;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const dataProvenance = getDataProvenance();
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
    const requestedAsOf = searchParams.get('asOf');
    const asOf = requestedAsOf ? new Date(requestedAsOf) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: '数据截止时间格式无效' }, { status: 400 });
    }
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
      joinedAt: { lte: asOf },
      ...(activeClassIds.length > 0 ? { classId: { in: activeClassIds } } : {}),
      user: { role: 'STUDENT', status: 'ACTIVE' },
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
    let students: DashboardStudent[];
    if (payload.role === 'ADMIN' && !requestedClassId && classEnrollments.length === 0) {
      const unassignedStudents = await prisma.user.findMany({
        where: { role: 'STUDENT', status: 'ACTIVE' },
        select: { id: true, name: true, username: true, studentId: true, class: true, lastLoginAt: true },
        orderBy: { name: 'asc' },
      });
      students = unassignedStudents.map((student) => ({
        ...student,
        name: student.name ?? student.username,
        classId: null,
        classGroup: null,
      }));
    } else {
      students = classEnrollments.map((enrollment) => ({
        ...enrollment.user,
        name: enrollment.user.name ?? enrollment.user.username,
        class: enrollment.classGroup.name ?? enrollment.user.class,
        classId: enrollment.classId,
        classGroup: enrollment.classGroup,
      }));
    }

    // 同一学生可能加入多个班级。名册人数与分析样本都必须先按 userId 去重。
    const seenIds = new Set<string>();
    const uniqueStudents = students.filter((student) => {
      if (seenIds.has(student.id)) return false;
      seenIds.add(student.id);
      return true;
    });
    const analysisStudents = uniqueStudents.filter(
      (student) => !student.username.toLowerCase().startsWith(DEMO_ACCOUNT_PREFIX),
    );
    const studentIds = analysisStudents.map((student) => student.id);
    const excludedDemoCount = uniqueStudents.length - analysisStudents.length;

    // 生产连接池上限较小；单次看板请求不再同时占用五个连接，
    // 以免教师页和周期/复核接口并发加载时触发 Prisma P2024。
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId: { in: studentIds }, completedAt: { lte: asOf } },
      select: { userId: true, quizId: true, score: true, completedAt: true },
    });
    const experiments = await prisma.userExperiment.findMany({
      where: {
        userId: { in: studentIds },
        experimentId: { in: OFFICIAL_EXPERIMENT_IDS },
        createdAt: { lte: asOf },
        updatedAt: { lte: asOf },
      },
      select: { userId: true, experimentId: true, status: true, score: true },
    });
    const learningProgress = await prisma.learningProgress.findMany({
      where: { userId: { in: studentIds }, updatedAt: { lte: asOf } },
      select: { userId: true, chapterId: true, progress: true, timeSpent: true },
    });
    const activities = await prisma.userActivity.findMany({
      where: {
        userId: { in: studentIds },
        createdAt: {
          gte: new Date(asOf.getTime() - 24 * 60 * 60 * 1000),
          lte: asOf,
        },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const learningEvents = await prisma.learningEvent.findMany({
      where: {
        userId: { in: studentIds },
        createdAt: {
          gte: new Date(asOf.getTime() - 24 * 60 * 60 * 1000),
          lte: asOf,
        },
        ...(requestedClassId ? { classId: requestedClassId } : activeClassIds.length > 0 ? { classId: { in: activeClassIds } } : {}),
      },
      select: { userId: true, eventType: true },
    });

    // 按学生聚合测验分数（按 chapterId / quizId 分组）
    const studentQuizScores: Record<string, Record<string, number>> = {};
    const studentQuizAttemptCount: Record<string, number> = {};
    for (const qa of quizAttempts) {
      if (!studentQuizScores[qa.userId]) studentQuizScores[qa.userId] = {};
      studentQuizAttemptCount[qa.userId] = (studentQuizAttemptCount[qa.userId] ?? 0) + 1;
      const key = qa.quizId;
      // 取最高分
      const scores = studentQuizScores[qa.userId];
      if (!(key in scores) || qa.score > scores[key]) scores[key] = qa.score;
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
    const studentLearningProgressCount: Record<string, number> = {};
    for (const lp of learningProgress) {
      studentLearningProgressCount[lp.userId] = (studentLearningProgressCount[lp.userId] ?? 0) + 1;
      studentTimeSpent[lp.userId] = (studentTimeSpent[lp.userId] ?? 0) + (lp.timeSpent ?? 0);
      if (!lp.chapterId) continue;
      if (!studentChapterMastery[lp.userId]) studentChapterMastery[lp.userId] = {};
      studentChapterMastery[lp.userId][lp.chapterId] = lp.progress;
    }

    // 实验完成统计（每个实验有多少人完成）
    const experimentCompletion: Record<string, number> = {};
    for (const exp of experiments) {
      if (exp.status === 'COMPLETED') {
        experimentCompletion[exp.experimentId] = (experimentCompletion[exp.experimentId] ?? 0) + 1;
      }
    }

    // Filter out test classes (验证测试班, LinkClass_*, DBClass_*)
    const isTestClass = (name?: string | null): boolean =>
      !name || /^(验证测试班|LinkClass_|DBClass_|TestClass_)/.test(name);

    // Build per-student list of class affiliations (exclude test classes)
    const studentClasses: Record<string, { id: string; name: string }[]> = {};
    for (const enrollment of classEnrollments) {
      const uid = enrollment.user.id;
      const cls = enrollment.classGroup;
      if (!isTestClass(cls.name)) {
        if (!studentClasses[uid]) studentClasses[uid] = [];
        if (!studentClasses[uid].some((c) => c.id === cls.id)) {
          studentClasses[uid].push({ id: cls.id, name: cls.name });
        }
      }
    }

    // 构建学生列表
    const studentList = uniqueStudents.map((student) => {
      const quizScores = studentQuizScores[student.id] ?? {};
      const quizValues = Object.values(quizScores);
      const avgQuiz = quizValues.length > 0
        ? Math.round(quizValues.reduce((sum, v) => sum + v, 0) / quizValues.length)
        : 0;

      const expData = studentExperiments[student.id] ?? { completed: 0, total: 0 };
      const chapterMastery = studentChapterMastery[student.id] ?? {};
      const activityCount = learningEvents.filter((event) => event.userId === student.id).length;

      return {
        id: student.id,
        name: student.name,
        studentId: student.studentId,
        class: student.class,
        classId: student.classId,
        classGroup: student.classGroup,
        classes: studentClasses[student.id] ?? [],
        analysisEligible: !student.username.toLowerCase().startsWith(DEMO_ACCOUNT_PREFIX),
        avgQuizScore: avgQuiz,
        quizAttemptCount: studentQuizAttemptCount[student.id] ?? 0,
        experimentsCompleted: expData.completed,
        experimentsTotal: expData.total,
        chapterMastery,
        totalTimeSpent: studentTimeSpent[student.id] ?? 0,
        learningProgressCount: studentLearningProgressCount[student.id] ?? 0,
        activityCount,
        lastActive: student.lastLoginAt,
      };
    });

    // 汇总统计（用去重后的学生数，不是班级注册记录数）
    const totalStudents = uniqueStudents.length;
    const activeToday = new Set([
      ...activities.map((activity) => activity.userId),
      ...learningEvents.map((event) => event.userId),
    ]).size;
    const studentAvgQuizScores = studentList
      .filter((student) => student.analysisEligible && student.quizAttemptCount > 0)
      .map((student) => student.avgQuizScore);
    const avgQuizScore = studentAvgQuizScores.length > 0
      ? Math.round(studentAvgQuizScores.reduce((sum, score) => sum + score, 0) / studentAvgQuizScores.length)
      : 0;

    const allExpCompleted = Object.values(studentExperiments).reduce((s: number, e) => s + e.completed, 0);
    const allExpTotal = Object.values(studentExperiments).reduce((s: number, e) => s + e.total, 0);
    const avgExpCompletion = allExpTotal > 0 ? Math.round(allExpCompleted / allExpTotal * 100) : 0;
    const measuredTimeValues = Object.values(studentTimeSpent).filter((value) => value > 0);
    const totalTimeSpent = measuredTimeValues.reduce((sum, value) => sum + value, 0);

    // 预警学生（有作答且平均分 < 60）— 无作答不按 0 分预警，真实 0 分必须保留。
    const alertStudents = studentList
      .filter((student) => student.analysisEligible && student.quizAttemptCount > 0 && student.avgQuizScore < 60)
      .map((student) => {
        const weakChapters = Object.entries(student.chapterMastery)
          .filter(([, progress]) => progress < 60)
          .map(([chapter, progress]) => ({ chapter, progress }))
          .sort((a, b) => a.progress - b.progress)
          .slice(0, 3);
        return {
          id: student.id,
          name: student.name,
          studentId: student.studentId ?? null,
          avg: student.avgQuizScore,
          quizAttemptCount: student.quizAttemptCount,
          experimentsCompleted: student.experimentsCompleted,
          experimentsTotal: student.experimentsTotal,
          weakChapters,
        };
      });

    // Merge catalog experiments with actual DB experiment completion data
    // Only show experiments from the official catalog — skip test artifacts
    const experimentsForDashboard = experimentCatalog.map((experiment) => ({
      id: experiment.id,
      name: experiment.title,
      completed: experimentCompletion[experiment.id] ?? 0,
    }));

    const classesById = new Map<string, ClassSummary>();
    for (const enrollment of classEnrollments) {
      const classGroup = enrollment.classGroup;
      if (!isTestClass(classGroup.name)) classesById.set(classGroup.id, classGroup);
    }

    const eventActivity = learningEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      dataProvenance,
      scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN',
      scope: {
        asOf: asOf.toISOString(),
        basis: payload.role === 'ADMIN' && !requestedClassId && classEnrollments.length === 0
          ? 'ACTIVE_STUDENT_ACCOUNT'
          : 'ACTIVE_CLASS_ENROLLMENT',
        accessibleClassCount: activeClassIds.length,
        enrolledStudentCount: uniqueStudents.length,
        includedStudentCount: analysisStudents.length,
        excludedStudentCount: excludedDemoCount,
        exclusions: excludedDemoCount > 0
          ? [{ code: 'DEMO_ACCOUNT', label: DEMO_ACCOUNT_EXCLUSION, count: excludedDemoCount }]
          : [],
        metricSamples: {
          quizStudents: Object.keys(studentQuizAttemptCount).length,
          learningTimeStudents: measuredTimeValues.length,
          experimentStudents: new Set(experiments.map((experiment) => experiment.userId)).size,
          repeatedAttemptStudents: 0,
        },
      },
      overview: {
        totalStudents,
        activeToday,
        avgQuizScore,
        avgExpCompletion,
        totalTimeSpent,
        avgTimeSpent: measuredTimeValues.length > 0
          ? Math.round(totalTimeSpent / measuredTimeValues.length)
          : 0,
        quizAttemptCount: quizAttempts.length,
        experimentRecordCount: experiments.length,
        learningProgressCount: learningProgress.length,
      },
      classes: [...classesById.values()],
      students: studentList,
      experiments: experimentsForDashboard,
      experimentCompletion,
      eventActivity,
      alertStudents,
    });
  } catch (error) {
    console.error('Teacher dashboard API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
