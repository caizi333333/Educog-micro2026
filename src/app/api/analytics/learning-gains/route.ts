import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

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

    const studentIds = [...new Set(studentEnrollments.map((e) => e.userId))];
    if (studentIds.length === 0) {
      return NextResponse.json({ scoreDistribution: [], experimentCorrelation: [], timeCorrelation: [], prePostComparison: [], chapterMasteryAvg: [] });
    }

    const [quizAttempts, experiments, progress] = await Promise.all([
      prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, score: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.userExperiment.findMany({
        where: { userId: { in: studentIds }, status: 'COMPLETED' },
        select: { userId: true },
      }),
      prisma.learningProgress.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, chapterId: true, progress: true, timeSpent: true },
      }),
    ]);

    // --- Per-student aggregates ---
    type StudentAgg = { scores: number[]; expCompleted: number; totalTime: number; chapterProgress: Map<string, number> };
    const emptyAgg = (): StudentAgg => ({ scores: [], expCompleted: 0, totalTime: 0, chapterProgress: new Map() });

    const studentMap = new Map<string, StudentAgg>();

    for (const qa of quizAttempts) {
      const s = studentMap.get(qa.userId) || emptyAgg();
      s.scores.push(qa.score);
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
      if (data.scores.length > 0) {
        allAvgScores.push(Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length));
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
      if (data.scores.length === 0) continue;
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
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
      if (data.scores.length === 0) continue;
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const time = totalTimeByStudent.get(userId) || 0;
      const bin = timeBins.find((b) => time >= b.min && time < b.max);
      if (bin) { bin.total++; bin.scoreSum += avg; }
    }
    const timeCorrelation = timeBins
      .filter((b) => b.total > 0)
      .map((b) => ({ timeRange: b.label, avgScore: Math.round(b.scoreSum / b.total), studentCount: b.total }));

    // --- 4. Pre/Post Quiz Comparison ---
    const quizByStudent = new Map<string, { first: number; latest: number }>();
    for (const qa of quizAttempts) {
      const existing = quizByStudent.get(qa.userId);
      if (!existing) {
        quizByStudent.set(qa.userId, { first: qa.score, latest: qa.score });
      } else {
        existing.latest = qa.score;
      }
    }
    // Get student names
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(students.map((s) => [s.id, s.name]));
    const prePostComparison = [...quizByStudent.entries()]
      .filter(([, data]) => Math.abs(data.latest - data.first) > 0.5) // only show students with actual change
      .map(([userId, data]) => ({
        name: nameMap.get(userId) || userId,
        firstScore: Math.round(data.first),
        latestScore: Math.round(data.latest),
        gain: Math.round(data.latest - data.first),
      }))
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
