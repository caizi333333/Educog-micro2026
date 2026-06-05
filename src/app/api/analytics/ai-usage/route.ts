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
      return NextResponse.json({ summary: {}, usageVsScore: [], weeklyUsage: [] });
    }

    const [aiEvents, quizAttempts] = await Promise.all([
      prisma.learningEvent.findMany({
        where: { userId: { in: studentIds }, eventType: 'AI_CHAT' },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.quizAttempt.findMany({
        where: { userId: { in: studentIds } },
        select: { userId: true, score: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
    ]);

    // Per-student AI usage count
    const aiCountByStudent = new Map<string, number>();
    for (const e of aiEvents) {
      aiCountByStudent.set(e.userId, (aiCountByStudent.get(e.userId) || 0) + 1);
    }

    // Per-student average quiz score
    const scoresByStudent = new Map<string, number[]>();
    for (const qa of quizAttempts) {
      const arr = scoresByStudent.get(qa.userId) || [];
      arr.push(qa.score);
      scoresByStudent.set(qa.userId, arr);
    }

    const totalAiUsers = aiCountByStudent.size;
    const totalAiEvents = aiEvents.length;
    const avgAiPerUser = totalAiUsers > 0 ? Math.round(totalAiEvents / totalAiUsers) : 0;

    // Usage vs score correlation (binned)
    const usageBins = new Map<number, { total: number; scoreSum: number }>();
    for (const userId of studentIds) {
      const scores = scoresByStudent.get(userId);
      if (!scores || scores.length === 0) continue;
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const aiCount = aiCountByStudent.get(userId) || 0;
      const bin = Math.min(aiCount, 20); // cap at 20
      const existing = usageBins.get(bin) || { total: 0, scoreSum: 0 };
      existing.total++;
      existing.scoreSum += avgScore;
      usageBins.set(bin, existing);
    }

    const usageVsScore = [...usageBins.entries()]
      .map(([count, { total, scoreSum }]) => ({ aiUsageCount: count, avgScore: Math.round(scoreSum / total), studentCount: total }))
      .sort((a, b) => a.aiUsageCount - b.aiUsageCount);

    // Non-AI users vs AI users comparison
    const aiUserScores: number[] = [];
    const nonAiUserScores: number[] = [];
    for (const userId of studentIds) {
      const scores = scoresByStudent.get(userId);
      if (!scores || scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (aiCountByStudent.has(userId)) {
        aiUserScores.push(avg);
      } else {
        nonAiUserScores.push(avg);
      }
    }

    const avgAiUserScore = aiUserScores.length > 0 ? Math.round(aiUserScores.reduce((a, b) => a + b, 0) / aiUserScores.length) : 0;
    const avgNonAiUserScore = nonAiUserScores.length > 0 ? Math.round(nonAiUserScores.reduce((a, b) => a + b, 0) / nonAiUserScores.length) : 0;

    // Weekly AI usage trend (last 8 weeks)
    const weeklyUsage: { week: string; aiEvents: number; activeUsers: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(Date.now() - i * 7 * 24 * 3600 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
      const weekEvents = aiEvents.filter((e) => e.createdAt >= weekStart && e.createdAt < weekEnd);
      weeklyUsage.push({
        week: weekStart.toISOString().slice(0, 10),
        aiEvents: weekEvents.length,
        activeUsers: new Set(weekEvents.map((e) => e.userId)).size,
      });
    }

    // Students who improved most after using AI
    const aiImpactStudents: { name: string; aiCount: number; firstScore: number; latestScore: number; gain: number }[] = [];
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(students.map((s) => [s.id, s.name]));

    for (const [userId, aiCount] of aiCountByStudent) {
      const scores = scoresByStudent.get(userId);
      if (!scores || scores.length < 2) continue;
      const first = scores[0];
      const latest = scores[scores.length - 1];
      const gain = latest - first;
      aiImpactStudents.push({
        name: nameMap.get(userId) || userId,
        aiCount,
        firstScore: Math.round(first),
        latestScore: Math.round(latest),
        gain: Math.round(gain),
      });
    }
    aiImpactStudents.sort((a, b) => b.gain - a.gain);

    return NextResponse.json({
      summary: {
        totalAiUsers,
        totalAiEvents,
        avgAiPerUser,
        avgAiUserScore,
        avgNonAiUserScore,
        aiUsageRate: studentIds.length > 0 ? Math.round((totalAiUsers / studentIds.length) * 100) : 0,
        scoreDifference: avgAiUserScore - avgNonAiUserScore,
      },
      usageVsScore,
      weeklyUsage,
      topAiStudents: aiImpactStudents.slice(0, 10),
    });
  } catch (error) {
    console.error('ai-usage API error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
