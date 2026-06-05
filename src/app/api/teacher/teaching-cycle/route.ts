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
      return NextResponse.json({ preClass: {}, inClass: {}, postClass: {} });
    }

    const [assignedExperiments, learningEvents, quizAttempts, progress] = await Promise.all([
      prisma.userExperiment.findMany({
        where: { userId: { in: studentIds }, status: { in: ['ASSIGNED', 'COMPLETED', 'IN_PROGRESS'] } },
        select: { userId: true, experimentId: true, status: true, completedAt: true, startedAt: true },
      }),
      prisma.learningEvent.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, eventType: true, createdAt: true, duration: true },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      }),
      prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, score: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.learningProgress.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, chapterId: true, progress: true },
      }),
    ]);

    // --- Pre-class: assigned experiments ---
    const totalAssigned = assignedExperiments.length;
    const completedAssigned = assignedExperiments.filter((e) => e.status === 'COMPLETED').length;
    const inProgressAssigned = assignedExperiments.filter((e) => e.status === 'IN_PROGRESS').length;
    const notStartedAssigned = assignedExperiments.filter((e) => e.status === 'ASSIGNED').length;

    // Students with at least one assigned experiment
    const studentsWithAssigned = new Set(assignedExperiments.map((e) => e.userId)).size;
    // Students who completed ALL their assigned experiments
    const assignedByStudent = new Map<string, { total: number; completed: number }>();
    for (const e of assignedExperiments) {
      const entry = assignedByStudent.get(e.userId) || { total: 0, completed: 0 };
      entry.total++;
      if (e.status === 'COMPLETED') entry.completed++;
      assignedByStudent.set(e.userId, entry);
    }
    const studentsCompletedAll = [...assignedByStudent.values()].filter((e) => e.completed >= e.total).length;

    // --- In-class: learning events ---
    const eventsByType: Record<string, number> = {};
    const eventsByStudent = new Map<string, number>();
    let totalDuration = 0;
    for (const event of learningEvents) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsByStudent.set(event.userId, (eventsByStudent.get(event.userId) || 0) + 1);
      totalDuration += event.duration || 0;
    }

    // Active students (at least 1 event in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentActiveStudents = new Set(
      learningEvents.filter((e) => e.createdAt >= sevenDaysAgo).map((e) => e.userId),
    ).size;

    // Daily activity for last 7 days
    const dailyActivity: { date: string; events: number; activeStudents: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 24 * 3600 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
      const dayEvents = learningEvents.filter((e) => e.createdAt >= dayStart && e.createdAt < dayEnd);
      dailyActivity.push({
        date: dayStart.toISOString().slice(0, 10),
        events: dayEvents.length,
        activeStudents: new Set(dayEvents.map((e) => e.userId)).size,
      });
    }

    // --- Post-class: quiz mastery progression ---
    // Students with 2+ quizzes: compare first half avg vs second half avg
    const quizzesByStudent = new Map<string, number[]>();
    for (const qa of quizAttempts) {
      const arr = quizzesByStudent.get(qa.userId) || [];
      arr.push(qa.score);
      quizzesByStudent.set(qa.userId, arr);
    }

    let improvedCount = 0;
    let declinedCount = 0;
    let stableCount = 0;
    const avgFirstHalf: number[] = [];
    const avgSecondHalf: number[] = [];

    for (const [, scores] of quizzesByStudent) {
      if (scores.length < 2) continue;
      const mid = Math.floor(scores.length / 2);
      const first = scores.slice(0, mid);
      const second = scores.slice(mid);
      const avgF = first.reduce((a, b) => a + b, 0) / first.length;
      const avgS = second.reduce((a, b) => a + b, 0) / second.length;
      avgFirstHalf.push(avgF);
      avgSecondHalf.push(avgS);
      if (avgS - avgF > 2) improvedCount++;
      else if (avgF - avgS > 2) declinedCount++;
      else stableCount++;
    }

    // Chapter mastery distribution
    const chapterMasteryDist: Record<string, { high: number; medium: number; low: number }> = {};
    for (const lp of progress) {
      if (!lp.chapterId) continue;
      const dist = chapterMasteryDist[lp.chapterId] || { high: 0, medium: 0, low: 0 };
      if (lp.progress >= 80) dist.high++;
      else if (lp.progress >= 50) dist.medium++;
      else dist.low++;
      chapterMasteryDist[lp.chapterId] = dist;
    }

    // Average quiz score by student
    const studentScores: { name: string; avgScore: number }[] = [];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(students.map((s) => [s.id, s.name]));
    for (const [userId, scores] of quizzesByStudent) {
      if (scores.length === 0) continue;
      studentScores.push({
        name: nameMap.get(userId) || userId,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      });
    }
    studentScores.sort((a, b) => b.avgScore - a.avgScore);

    return NextResponse.json({
      preClass: {
        totalAssigned,
        completedAssigned,
        inProgressAssigned,
        notStartedAssigned,
        studentsWithAssigned,
        studentsCompletedAll,
        completionRate: totalAssigned > 0 ? Math.round((completedAssigned / totalAssigned) * 100) : 0,
      },
      inClass: {
        totalEvents: learningEvents.length,
        eventsByType,
        totalDuration,
        avgDurationPerStudent: studentIds.length > 0 ? Math.round(totalDuration / studentIds.length) : 0,
        recentActiveStudents,
        dailyActivity,
        participationRate: studentIds.length > 0 ? Math.round((recentActiveStudents / studentIds.length) * 100) : 0,
      },
      postClass: {
        totalStudents: studentIds.length,
        improvedCount,
        declinedCount,
        stableCount,
        avgFirstHalfScore: avgFirstHalf.length > 0 ? Math.round(avgFirstHalf.reduce((a, b) => a + b, 0) / avgFirstHalf.length) : 0,
        avgSecondHalfScore: avgSecondHalf.length > 0 ? Math.round(avgSecondHalf.reduce((a, b) => a + b, 0) / avgSecondHalf.length) : 0,
        chapterMasteryDist,
        topStudents: studentScores.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('teaching-cycle API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
