import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getIlabConfig, isIlabConfigured } from '@/lib/ilab/config';
import { ILAB_STEP_CATALOG } from '@/lib/ilab/steps';

const VALID_STEP_IDS = new Set(ILAB_STEP_CATALOG.map((s) => s.id));

const beaconSchema = z.object({
  stepId: z.string().trim().min(1).max(64),
  clientAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * 实验步骤信标：仅当登录用户持有有效 ilab 会话且实验为申报实验时记录。
 * 服务端时间戳为准（createdAt），clientAt 只作参考不入上报。
 */
export async function POST(request: Request): Promise<NextResponse> {
  const config = getIlabConfig();
  if (!isIlabConfigured(config)) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '缺少认证令牌' }, { status: 401 });
  }
  const payload = await verifyToken(authHeader.substring(7));
  if (!payload) {
    return NextResponse.json({ error: '无效的令牌' }, { status: 401 });
  }
  const parsed = beaconSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: '参数格式无效' }, { status: 400 });
  }
  const { stepId } = parsed.data;
  // ai_ 前缀信标（AI 调用计数）与目录内步骤 id 均允许
  if (!VALID_STEP_IDS.has(stepId) && !/^ai_[a-z0-9_]{1,40}$/.test(stepId)) {
    return NextResponse.json({ error: '未知步骤标识' }, { status: 400 });
  }
  const session = await prisma.ilabSession.findFirst({
    where: { userId: payload.userId, experimentId: config.experimentId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
  await prisma.ilabStepEvent.create({
    data: {
      sessionId: session.id,
      userId: payload.userId,
      experimentId: config.experimentId,
      stepId,
      clientAt: parsed.data.clientAt ? new Date(parsed.data.clientAt) : null,
    },
  });
  return NextResponse.json({ ok: true }, { status: 200 });
}
