import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getDataProvenance } from '@/lib/env';

// 每题的最新自评状态：用于题目列表上的掌握标记与"待巩固"筛选。
export async function GET(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const payload = await verifyToken(authorization.substring(7));
  if (!payload) {
    return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
  }

  const attempts = await prisma.subjectiveAttempt.findMany({
    where: { userId: payload.userId },
    select: { questionId: true, verdict: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const latest: Record<string, { verdict: string; attempts: number; updatedAt: string }> = {};
  for (const attempt of attempts) {
    const key = String(attempt.questionId);
    if (latest[key]) {
      latest[key]!.attempts += 1;
    } else {
      latest[key] = { verdict: attempt.verdict, attempts: 1, updatedAt: attempt.createdAt.toISOString() };
    }
  }

  return NextResponse.json({
    success: true,
    dataProvenance: getDataProvenance(),
    asOf: new Date().toISOString(),
    data: latest,
  });
}
