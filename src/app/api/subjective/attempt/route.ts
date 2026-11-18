import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSubjectiveQuestion } from '@/lib/subjective-data';
import { getDataProvenance } from '@/lib/env';

const attemptSchema = z.object({
  questionId: z.number().int().positive(),
  verdict: z.enum(['got', 'review']),
  draft: z.string().max(8000).optional(),
});

// 主观题自评记录：学生翻牌对照评分细则后，自己判定"会做"或"还不熟"。
// 草稿一并落盘，方便日后教师抽查批阅。
export async function POST(request: Request): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const payload = await verifyToken(authorization.substring(7));
  if (!payload) {
    return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
  }

  const rawData: unknown = await request.json().catch((): null => null);
  const parsed = attemptSchema.safeParse(rawData);
  if (!parsed.success) {
    return NextResponse.json({ error: '自评参数格式无效' }, { status: 400 });
  }
  const { questionId, verdict, draft } = parsed.data;
  if (!getSubjectiveQuestion(questionId)) {
    return NextResponse.json({ error: '题目不存在' }, { status: 404 });
  }

  const attempt = await prisma.subjectiveAttempt.create({
    data: {
      userId: payload.userId,
      questionId,
      verdict,
      draft: draft?.trim() || null,
    },
    select: { id: true, questionId: true, verdict: true, createdAt: true },
  });

  return NextResponse.json({
    success: true,
    dataProvenance: getDataProvenance(),
    asOf: new Date().toISOString(),
    attempt,
  });
}
