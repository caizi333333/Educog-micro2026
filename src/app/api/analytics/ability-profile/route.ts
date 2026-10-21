import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeAbilityProfile } from '@/lib/ability-profile';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });

    const asOf = new Date();
    const [experiments, quizAgg, diagnosisCount, reviewCount] = await Promise.all([
      prisma.userExperiment.findMany({
        where: { userId: payload.userId, createdAt: { lte: asOf } },
        select: { experimentId: true, status: true, score: true },
      }),
      prisma.quizAttempt.aggregate({
        where: { userId: payload.userId, completedAt: { lte: asOf } },
        _avg: { score: true },
      }),
      prisma.learningEvent.count({ where: { userId: payload.userId, eventType: 'AI_DIAGNOSIS' } }),
      prisma.learningEvent.count({ where: { userId: payload.userId, eventType: 'AI_CODE_REVIEW' } }),
    ]);

    const profile = computeAbilityProfile({
      experiments,
      quizAverage: quizAgg._avg.score === null ? null : Math.round(quizAgg._avg.score),
      aiUsage: { diagnosisCount, reviewCount },
    });

    return NextResponse.json({ ...profile, asOf: asOf.toISOString() });
  } catch (error) {
    console.error('ability-profile 读取失败:', error);
    return NextResponse.json({ error: '服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
