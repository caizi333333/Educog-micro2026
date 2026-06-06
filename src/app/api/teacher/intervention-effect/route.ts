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
          role: 'STUDENT', status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE', username: { not: { startsWith: 'demo_' } } },
        },
        select: { userId: true },
      });
    const studentIds = [...new Set(studentEnrollments.map(e => e.userId))];
    if (studentIds.length === 0) {
      return NextResponse.json({ interventions: [], summary: { total: 0, improved: 0, avgGain: 0, improvementRate: 0 } });
    }

    // Find all push-learning-task events for these students
    const pushEvents = await prisma.userActivity.findMany({
      where: {
        userId: { in: studentIds },
        action: 'TEACHER_PUSH_LEARNING_TASK',
      },
      select: { userId: true, createdAt: true, details: true },
      orderBy: { createdAt: 'desc' },
    });

    if (pushEvents.length === 0) {
      return NextResponse.json({ interventions: [], summary: { total: 0, improved: 0, avgGain: 0, improvementRate: 0 } });
    }

    // Get latest push event per student
    const latestPushByStudent = new Map<string, Date>();
    for (const ev of pushEvents) {
      if (!latestPushByStudent.has(ev.userId)) {
        latestPushByStudent.set(ev.userId, ev.createdAt);
      }
    }

    const intervenedIds = [...latestPushByStudent.keys()];

    // Get quiz attempts for these students, split by intervention date
    const quizAttempts = await prisma.quizAttempt.findMany({
      where: { userId: { in: intervenedIds } },
      select: { userId: true, score: true, completedAt: true },
      orderBy: { completedAt: 'asc' },
    });

    // Get student names
    const students = await prisma.user.findMany({
      where: { id: { in: intervenedIds } },
      select: { id: true, name: true, studentId: true },
    });
    const nameMap = new Map(students.map(s => [s.id, s]));

    // Calculate pre/post intervention scores per student
    const interventions: {
      studentId: string; name: string; studentCode: string | null;
      interventionDate: string;
      preAvg: number; postAvg: number; gain: number;
      preCount: number; postCount: number;
    }[] = [];

    for (const [userId, pushDate] of latestPushByStudent) {
      const studentQuizzes = quizAttempts.filter(q => q.userId === userId);
      const preQuizzes = studentQuizzes.filter(q => q.completedAt < pushDate);
      const postQuizzes = studentQuizzes.filter(q => q.completedAt >= pushDate);

      const preAvg = preQuizzes.length > 0
        ? Math.round(preQuizzes.reduce((s, q) => s + q.score, 0) / preQuizzes.length)
        : null;
      const postAvg = postQuizzes.length > 0
        ? Math.round(postQuizzes.reduce((s, q) => s + q.score, 0) / postQuizzes.length)
        : null;

      interventions.push({
        studentId: userId,
        name: nameMap.get(userId)?.name || userId,
        studentCode: nameMap.get(userId)?.studentId || null,
        interventionDate: pushDate.toISOString(),
        preAvg: preAvg ?? 0,
        postAvg: postAvg ?? 0,
        gain: (preAvg !== null && postAvg !== null) ? postAvg - preAvg : 0,
        preCount: preQuizzes.length,
        postCount: postQuizzes.length,
      });
    }

    // Sort by gain descending
    interventions.sort((a, b) => b.gain - a.gain);

    // Summary statistics
    const withBothScores = interventions.filter(i => i.preCount > 0 && i.postCount > 0);
    const improved = withBothScores.filter(i => i.gain > 0).length;
    const avgGain = withBothScores.length > 0
      ? Math.round(withBothScores.reduce((s, i) => s + i.gain, 0) / withBothScores.length)
      : 0;

    return NextResponse.json({
      interventions,
      summary: {
        totalInterventions: pushEvents.length,
        totalStudents: intervenedIds.length,
        withBothScores: withBothScores.length,
        improved,
        improvementRate: withBothScores.length > 0 ? Math.round(improved / withBothScores.length * 100) : 0,
        avgGain,
      },
    });
  } catch (error) {
    console.error('intervention-effect API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
