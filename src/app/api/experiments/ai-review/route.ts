// AI 代码评价端点：对学生已提交/已完成的实验代码按教学 rubric 评分。
// 结果写入 UserExperiment.feedback（若空）与 results.aiReview，带代码哈希幂等——
// 同一份代码重复请求直接返回缓存，不重复计费。

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ZhipuClient, resolveZhipuModel } from '@/ai/model-client';
import { getExperimentConfig } from '@/lib/experiment-config';
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  buildReviewUserPrompt,
  parseCodeReview,
  type AiCodeReview,
} from '@/lib/ai-code-review';

export const maxDuration = 30;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

const REVIEW_EVENT = 'AI_CODE_REVIEW';
const REVIEW_DAILY_LIMIT = Math.max(1, Number(process.env.AI_REVIEW_DAILY_LIMIT) || 6);
const REVIEW_GLOBAL_DAILY_LIMIT = Math.max(1, Number(process.env.AI_REVIEW_GLOBAL_DAILY_LIMIT) || 150);

function beijingDayStart(now = new Date()): Date {
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - 8 * 60 * 60 * 1000);
}

const RequestSchema = z.object({ experimentId: z.string().min(1).max(40) });

function codeHash(code: string): string {
  return createHash('sha256').update(code).digest('hex').slice(0, 16);
}

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
  const { experimentId } = parsed.data;

  const cfg = getExperimentConfig(experimentId);
  if (!cfg) {
    return NextResponse.json({ error: '未知实验' }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const record = await prisma.userExperiment.findUnique({
    where: { userId_experimentId: { userId: auth.userId, experimentId } },
  });
  if (!record || !record.lastCode?.trim()) {
    return NextResponse.json({ error: '尚未提交代码，先完成实验再请求 AI 评价' }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const results = parseResults(record.results);
  const hash = codeHash(record.lastCode);
  const cached = results.aiReview as (AiCodeReview & { codeHash?: string }) | undefined;
  if (cached?.codeHash === hash && Array.isArray(cached.dimensions)) {
    return NextResponse.json({ ...cached, cached: true }, { headers: PRIVATE_HEADERS });
  }

  const dayStart = beijingDayStart();
  const [usedToday, globalToday] = await Promise.all([
    prisma.learningEvent.count({ where: { userId: auth.userId, eventType: REVIEW_EVENT, createdAt: { gte: dayStart } } }),
    prisma.learningEvent.count({ where: { eventType: REVIEW_EVENT, createdAt: { gte: dayStart } } }),
  ]);
  if (usedToday >= REVIEW_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `今日 AI 评价额度已用完（每人每天 ${REVIEW_DAILY_LIMIT} 次）`, quota: { dailyLimit: REVIEW_DAILY_LIMIT, usedToday } },
      { status: 429, headers: { ...PRIVATE_HEADERS, 'Retry-After': '3600' } },
    );
  }
  if (globalToday >= REVIEW_GLOBAL_DAILY_LIMIT) {
    return NextResponse.json(
      { error: '平台今日 AI 评价总量已达上限', quota: { globalDailyLimit: REVIEW_GLOBAL_DAILY_LIMIT } },
      { status: 429, headers: { ...PRIVATE_HEADERS, 'Retry-After': '3600' } },
    );
  }

  try {
    const client = new ZhipuClient(process.env.ZHIPU_API_KEY ?? '');
    const response = await client.chat(
      [
        { role: 'system', content: CODE_REVIEW_SYSTEM_PROMPT },
        { role: 'user', content: buildReviewUserPrompt(cfg.title, cfg.objectives, record.lastCode.slice(0, 24000)) },
      ],
      resolveZhipuModel(),
    );
    const raw = response.choices[0]?.message?.content ?? '';
    const review = parseCodeReview(raw);
    if (!review) {
      return NextResponse.json({ error: 'AI 评价输出格式异常，请稍后重试' }, { status: 502, headers: PRIVATE_HEADERS });
    }

    const stored = { ...review, codeHash: hash };
    const newResults = { ...results, aiReview: stored };
    await prisma.userExperiment.update({
      where: { id: record.id },
      data: {
        results: JSON.stringify(newResults),
        // feedback 为空才写 AI 总评——不覆盖教师已给的评语
        ...(record.feedback ? {} : { feedback: `[AI评价 ${review.overall}分] ${review.summary}` }),
      },
    });
    await prisma.learningEvent.create({
      data: {
        userId: auth.userId,
        eventType: REVIEW_EVENT,
        targetType: 'experiment',
        targetId: experimentId,
        experimentId,
        metadata: JSON.stringify({ model: resolveZhipuModel(), pt: response.usage?.prompt_tokens ?? 0, ct: response.usage?.completion_tokens ?? 0 }),
      },
    });

    return NextResponse.json({ ...stored, cached: false }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json({ error: `AI 评价暂时不可用：${message}` }, { status: 502, headers: PRIVATE_HEADERS });
  }
}
