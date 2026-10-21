// AI 个性化变体任务：模型依据学生薄弱证据（AI 评价低分维度、诊断求助记录、
// 静态诊断错误类型）定向生成进阶任务，实现"AI 出题者"而非仅"AI 评价者"。
// 结果存 UserExperiment.results.variantTask 幂等返回；模型不可用时回退确定性变体池。

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ZhipuClient, resolveZhipuModel } from '@/ai/model-client';
import { getExperimentConfig } from '@/lib/experiment-config';
import { validateAssemblyCode } from '@/lib/syntax-validator';
import {
  VARIANT_TASK_SYSTEM_PROMPT,
  buildVariantUserPrompt,
  parseVariantTask,
  selectFallbackVariant,
  type VariantTask,
  type WeaknessEvidence,
} from '@/lib/variant-task';

export const maxDuration = 30;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

const VARIANT_EVENT = 'AI_VARIANT_TASK';
const VARIANT_DAILY_LIMIT = Math.max(1, Number(process.env.AI_VARIANT_DAILY_LIMIT) || 3);
const VARIANT_GLOBAL_DAILY_LIMIT = Math.max(1, Number(process.env.AI_VARIANT_GLOBAL_DAILY_LIMIT) || 100);

function beijingDayStart(now = new Date()): Date {
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - 8 * 60 * 60 * 1000);
}

const RequestSchema = z.object({
  experimentId: z.string().min(1).max(40),
  refresh: z.boolean().optional(),
});

function parseResults(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '请先登录' }, { status: 401, headers: PRIVATE_HEADERS });
  }
  const auth = await verifyToken(authHeader.substring(7));
  if (!auth) {
    return NextResponse.json({ error: '认证无效或已过期' }, { status: 401, headers: PRIVATE_HEADERS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法 JSON' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '请求参数不合法' }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const { experimentId, refresh } = parsed.data;

  const cfg = getExperimentConfig(experimentId);
  if (!cfg) {
    return NextResponse.json({ error: '未知实验' }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const record = await prisma.userExperiment.findUnique({
    where: { userId_experimentId: { userId: auth.userId, experimentId } },
  });
  const hasSubmission = Boolean(record?.lastCode?.trim());
  const results = parseResults(record?.results ?? null);

  const cached = results.variantTask as (VariantTask & { generatedAt?: string }) | undefined;
  if (!refresh && cached?.title && Array.isArray(cached.requirements)) {
    return NextResponse.json({ ...cached, cached: true }, { headers: PRIVATE_HEADERS });
  }

  const dayStart = beijingDayStart();
  const [usedToday, globalToday, diagnosisCount] = await Promise.all([
    prisma.learningEvent.count({ where: { userId: auth.userId, eventType: VARIANT_EVENT, createdAt: { gte: dayStart } } }),
    prisma.learningEvent.count({ where: { eventType: VARIANT_EVENT, createdAt: { gte: dayStart } } }),
    prisma.learningEvent.count({ where: { userId: auth.userId, eventType: 'AI_DIAGNOSIS', experimentId } }),
  ]);
  if (usedToday >= VARIANT_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `今日变体任务生成额度已用完（每人每天 ${VARIANT_DAILY_LIMIT} 次）`, quota: { dailyLimit: VARIANT_DAILY_LIMIT, usedToday } },
      { status: 429, headers: { ...PRIVATE_HEADERS, 'Retry-After': '3600' } },
    );
  }
  if (globalToday >= VARIANT_GLOBAL_DAILY_LIMIT) {
    return NextResponse.json({ error: '平台今日变体任务生成总量已达上限，请明天再试' }, { status: 503, headers: PRIVATE_HEADERS });
  }

  // 薄弱证据采集：AI 评价低分维度 + 诊断求助次数 + 当前代码静态诊断错误类型
  const aiReview = results.aiReview as { dimensions?: Array<{ name: string; score: number }> } | undefined;
  const staticCheck = record?.lastCode?.trim() ? validateAssemblyCode(record.lastCode) : null;
  const evidence: WeaknessEvidence = {
    reviewDimensions: aiReview?.dimensions,
    diagnosisCount,
    staticErrorKinds: staticCheck ? staticCheck.errors.map((e) => e.message.slice(0, 30)) : [],
    hasSubmission,
  };

  let task: VariantTask;
  let tokenUsage = { pt: 0, ct: 0 };
  try {
    const client = new ZhipuClient(process.env.ZHIPU_API_KEY ?? '');
    const response = await client.chat(
      [
        { role: 'system', content: VARIANT_TASK_SYSTEM_PROMPT },
        { role: 'user', content: buildVariantUserPrompt(cfg.title, evidence) },
      ],
      resolveZhipuModel(),
    );
    tokenUsage = { pt: response.usage?.prompt_tokens ?? 0, ct: response.usage?.completion_tokens ?? 0 };
    task = parseVariantTask(response.choices[0]?.message?.content ?? '')
      ?? selectFallbackVariant(evidence);
  } catch {
    task = selectFallbackVariant(evidence);
  }

  const stored = { ...task, generatedAt: new Date().toISOString() };
  if (record) {
    await prisma.userExperiment.update({
      where: { id: record.id },
      data: { results: JSON.stringify({ ...results, variantTask: stored }) },
    });
  }
  await prisma.learningEvent.create({
    data: {
      userId: auth.userId,
      eventType: VARIANT_EVENT,
      targetType: 'experiment',
      targetId: experimentId,
      experimentId,
      metadata: JSON.stringify({ model: resolveZhipuModel(), pt: tokenUsage.pt, ct: tokenUsage.ct, source: task.source }),
    },
  });

  return NextResponse.json({ ...stored, cached: false }, { headers: PRIVATE_HEADERS });
}
