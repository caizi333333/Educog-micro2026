import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { getDataProvenance } from '@/lib/env';
import { experiments as experimentCatalog } from '@/lib/experiment-config';

const OFFICIAL_EXPERIMENT_IDS = experimentCatalog.map((experiment) => experiment.id);
const DEMO_ACCOUNT_PREFIX = 'demo_';
const DEMO_ACCOUNT_EXCLUSION = '账号名以 demo_ 开头的专用演示学生不纳入教学分析';

export async function GET(request: NextRequest) {
  try {
    const dataProvenance = getDataProvenance();
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const requestedAsOf = new URL(request.url).searchParams.get('asOf');
    const asOf = requestedAsOf ? new Date(requestedAsOf) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return NextResponse.json({ error: '数据截止时间格式无效' }, { status: 400 });
    }
    const accessibleClassIds = await getAccessibleClassIds(payload);
    const studentEnrollments = accessibleClassIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: {
          classId: { in: accessibleClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          joinedAt: { lte: asOf },
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: { userId: true, user: { select: { username: true } } },
      });

    const enrollmentByStudent = new Map(
      studentEnrollments.map((enrollment) => [enrollment.userId, enrollment.user.username]),
    );
    const enrolledStudentCount = enrollmentByStudent.size;
    const studentIds = [...enrollmentByStudent.entries()]
      .filter(([, username]) => !username.toLowerCase().startsWith(DEMO_ACCOUNT_PREFIX))
      .map(([userId]) => userId);
    const excludedDemoCount = enrolledStudentCount - studentIds.length;
    const scopeBase = {
      asOf: asOf.toISOString(),
      basis: 'ACTIVE_CLASS_ENROLLMENT',
      accessibleClassCount: accessibleClassIds.length,
      enrolledStudentCount,
      includedStudentCount: studentIds.length,
      excludedStudentCount: excludedDemoCount,
      exclusions: excludedDemoCount > 0
        ? [{ code: 'DEMO_ACCOUNT', label: DEMO_ACCOUNT_EXCLUSION, count: excludedDemoCount }]
        : [],
    };
    if (studentIds.length === 0) {
      return NextResponse.json({
        dataProvenance,
        scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN',
        scope: {
          ...scopeBase,
          metricSamples: {
            quizStudents: 0,
            learningTimeStudents: 0,
            experimentStudents: 0,
            repeatedAttemptStudents: 0,
          },
        },
        comparisonType: 'REPEATED_ATTEMPT',
        scoreDistribution: [],
        scoreSummary: { avg: 0, total: 0 },
        experimentCorrelation: [],
        timeCorrelation: [],
        prePostComparison: [],
        chapterMasteryAvg: [],
      });
    }

    const [quizAttempts, experiments, progress] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds }, completedAt: { lte: asOf } },
        select: { userId: true, quizId: true, score: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.userExperiment.findMany({
        where: {
          userId: { in: studentIds },
          experimentId: { in: OFFICIAL_EXPERIMENT_IDS },
          status: 'COMPLETED',
          completedAt: { lte: asOf },
        },
        select: { userId: true },
      }),
      prisma.learningProgress.findMany({
        where: { userId: { in: studentIds }, updatedAt: { lte: asOf } },
        select: { userId: true, chapterId: true, progress: true, timeSpent: true },
      }),
    ]);

    // --- Per-student aggregates ---
    type StudentAgg = { quizBestScores: Map<string, number>; expCompleted: number; totalTime: number; chapterProgress: Map<string, number> };
    const emptyAgg = (): StudentAgg => ({ quizBestScores: new Map(), expCompleted: 0, totalTime: 0, chapterProgress: new Map() });

    const studentMap = new Map<string, StudentAgg>();

    for (const qa of quizAttempts) {
      const s = studentMap.get(qa.userId) || emptyAgg();
      const currentBest = s.quizBestScores.get(qa.quizId);
      if (currentBest === undefined || qa.score > currentBest) s.quizBestScores.set(qa.quizId, qa.score);
      studentMap.set(qa.userId, s);
    }
    for (const exp of experiments) {
      const s = studentMap.get(exp.userId) || emptyAgg();
      s.expCompleted++;
      studentMap.set(exp.userId, s);
    }
    const totalTimeByStudent = new Map<string, number>();
    for (const lp of progress) {
      const s = studentMap.get(lp.userId) || emptyAgg();
      if (lp.chapterId) s.chapterProgress.set(lp.chapterId, lp.progress);
      studentMap.set(lp.userId, s);
      totalTimeByStudent.set(lp.userId, (totalTimeByStudent.get(lp.userId) || 0) + (lp.timeSpent || 0));
    }

    // --- 1. Score Distribution ---
    const allAvgScores: number[] = [];
    for (const [, data] of studentMap) {
      const scores = [...data.quizBestScores.values()];
      if (scores.length > 0) {
        allAvgScores.push(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
      }
    }
    const ranges = [
      { label: '<60', min: 0, max: 59, count: 0 },
      { label: '60-69', min: 60, max: 69, count: 0 },
      { label: '70-79', min: 70, max: 79, count: 0 },
      { label: '80-89', min: 80, max: 89, count: 0 },
      { label: '90-100', min: 90, max: 100, count: 0 },
    ];
    for (const score of allAvgScores) {
      const r = ranges.find((r) => score >= r.min && score <= r.max);
      if (r) r.count++;
    }

    // --- 2. Experiment Completion vs Score (binned) ---
    const expBins = new Map<number, { total: number; scoreSum: number }>();
    for (const [userId, data] of studentMap) {
      const scores = [...data.quizBestScores.values()];
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const bin = data.expCompleted;
      const existing = expBins.get(bin) || { total: 0, scoreSum: 0 };
      existing.total++;
      existing.scoreSum += avg;
      expBins.set(bin, existing);
    }
    const experimentCorrelation = [...expBins.entries()]
      .map(([expCount, { total, scoreSum }]) => ({ experimentsCompleted: expCount, avgScore: Math.round(scoreSum / total), studentCount: total }))
      .sort((a, b) => a.experimentsCompleted - b.experimentsCompleted);

    // --- 3. Time Spent vs Score (binned into ranges) ---
    const timeBins = [
      { label: '<8h', min: 0, max: 28800, total: 0, scoreSum: 0 },
      { label: '8-9h', min: 28800, max: 32400, total: 0, scoreSum: 0 },
      { label: '9-10h', min: 32400, max: 36000, total: 0, scoreSum: 0 },
      { label: '10-11h', min: 36000, max: 39600, total: 0, scoreSum: 0 },
      { label: '>11h', min: 39600, max: Infinity, total: 0, scoreSum: 0 },
    ];
    for (const [userId, data] of studentMap) {
      const scores = [...data.quizBestScores.values()];
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const time = totalTimeByStudent.get(userId) || 0;
      // 没有有效学习时长的学生不能被归入“<8h”组，否则缺失值会被误读为 0 小时。
      if (time <= 0) continue;
      const bin = timeBins.find((b) => time >= b.min && time < b.max);
      if (bin) { bin.total++; bin.scoreSum += avg; }
    }
    const timeCorrelation = timeBins
      .filter((b) => b.total > 0)
      .map((b) => ({ timeRange: b.label, avgScore: Math.round(b.scoreSum / b.total), studentCount: b.total }));

    // --- 4. Repeated-attempt comparison ---
    // 同一 quizId 的首次/最近一次作答只表示重复作答变化，不等同于受控前测/后测。
    const quizSeries = new Map<string, { userId: string; scores: number[] }>();
    for (const qa of quizAttempts) {
      const key = `${qa.userId}:${qa.quizId}`;
      const series = quizSeries.get(key) ?? { userId: qa.userId, scores: [] };
      series.scores.push(qa.score);
      quizSeries.set(key, series);
    }
    const comparableByStudent = new Map<string, { first: number[]; latest: number[] }>();
    for (const series of quizSeries.values()) {
      if (series.scores.length < 2) continue;
      const comparison = comparableByStudent.get(series.userId) ?? { first: [], latest: [] };
      comparison.first.push(series.scores[0]!);
      comparison.latest.push(series.scores[series.scores.length - 1]!);
      comparableByStudent.set(series.userId, comparison);
    }
    // Get student names
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(students.map((s) => [s.id, s.name]));
    const prePostComparison = [...comparableByStudent.entries()]
      .map(([userId, data]) => ({
        name: nameMap.get(userId) || userId,
        firstScore: Math.round(data.first.reduce((sum, score) => sum + score, 0) / data.first.length),
        latestScore: Math.round(data.latest.reduce((sum, score) => sum + score, 0) / data.latest.length),
        comparisonCount: data.first.length,
      }))
      .map((item) => ({ ...item, gain: item.latestScore - item.firstScore }))
      .sort((a, b) => b.gain - a.gain);

    // --- 5. Chapter Mastery Average ---
    const chapterAvg = new Map<string, { total: number; count: number }>();
    for (const [, data] of studentMap) {
      for (const [chapterId, progress] of data.chapterProgress) {
        const existing = chapterAvg.get(chapterId) || { total: 0, count: 0 };
        existing.total += progress;
        existing.count++;
        chapterAvg.set(chapterId, existing);
      }
    }
    const chapterMasteryAvg = [...chapterAvg.entries()]
      .map(([chapterId, { total, count }]) => ({ chapter: chapterId, avgMastery: Math.round(total / count) }))
      .sort((a, b) => a.chapter.localeCompare(b.chapter));

    return NextResponse.json({
      dataProvenance,
      scoreAggregation: 'BEST_SCORE_PER_QUIZ_THEN_STUDENT_MEAN',
      scope: {
        ...scopeBase,
        metricSamples: {
          quizStudents: new Set(quizAttempts.map((attempt) => attempt.userId)).size,
          learningTimeStudents: [...totalTimeByStudent.values()].filter((time) => time > 0).length,
          experimentStudents: new Set(experiments.map((experiment) => experiment.userId)).size,
          repeatedAttemptStudents: comparableByStudent.size,
        },
      },
      comparisonType: 'REPEATED_ATTEMPT',
      scoreDistribution: ranges,
      scoreSummary: { avg: allAvgScores.length > 0 ? Math.round(allAvgScores.reduce((a, b) => a + b, 0) / allAvgScores.length) : 0, total: allAvgScores.length },
      experimentCorrelation,
      timeCorrelation,
      prePostComparison,
      chapterMasteryAvg,
    });
  } catch (error) {
    console.error('learning-gains API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
