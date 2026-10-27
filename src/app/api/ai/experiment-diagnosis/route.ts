// AI 实验诊断端点：读取学生当前仿真状态快照（代码+寄存器+端口+串口+环境），
// 由大模型给出"苏格拉底式"诊断——指出证据、给方向性提示，不直接给答案代码。
// 这是"AI 赋能实验过程"的核心环节：AI 长在实验流程里，而非侧边闲聊。

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ZhipuClient, resolveZhipuModel } from '@/ai/model-client';
import { getExperimentConfig } from '@/lib/experiment-config';
import {
  DIAGNOSIS_SYSTEM_PROMPT,
  experimentBrief,
  parseDiagnosis,
  snapshotText,
} from '@/lib/experiment-diagnosis';

export const maxDuration = 30;
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };

const DIAGNOSIS_EVENT = 'AI_DIAGNOSIS';
// 诊断调用按人按日限额（模型按调用计费），另有全站日总量安全阀；超限 429，前端提示稍后重试。
const DIAG_DAILY_LIMIT = Math.max(1, Number(process.env.AI_DIAG_DAILY_LIMIT) || 10);
const DIAG_GLOBAL_DAILY_LIMIT = Math.max(1, Number(process.env.AI_DIAG_GLOBAL_DAILY_LIMIT) || 300);
const MAX_CODE_LENGTH = 24000;
const MAX_QUESTION_LENGTH = 400;

function beijingDayStart(now = new Date()): Date {
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - 8 * 60 * 60 * 1000);
}

const SnapshotSchema = z.object({
  registers: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  portValues: z.record(z.string(), z.number()).optional(),
  pc: z.number().optional(),
  currentLine: z.number().optional(),
  currentInstruction: z.string().max(200).optional(),
  uartTail: z.string().max(2000).optional(),
  timers: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
  environment: z.record(z.string(), z.unknown()).optional(),
  deviceNotes: z.array(z.string().max(300)).max(12).optional(),
}).strict();

const RequestSchema = z.object({
  experimentId: z.string().min(1).max(40),
  code: z.string().max(MAX_CODE_LENGTH).optional(),
  question: z.string().max(MAX_QUESTION_LENGTH).optional(),
  snapshot: SnapshotSchema,
});

async function checkQuota(userId: string): Promise<NextResponse | null> {
  const dayStart = beijingDayStart();
  const [usedToday, globalToday] = await Promise.all([
    prisma.learningEvent.count({ where: { userId, eventType: DIAGNOSIS_EVENT, createdAt: { gte: dayStart } } }),
    prisma.learningEvent.count({ where: { eventType: DIAGNOSIS_EVENT, createdAt: { gte: dayStart } } }),
  ]);
  if (usedToday >= DIAG_DAILY_LIMIT) {
    return NextResponse.json(
      { error: `今日 AI 诊断额度已用完（每人每天 ${DIAG_DAILY_LIMIT} 次），明日重置`, quota: { dailyLimit: DIAG_DAILY_LIMIT, usedToday } },
      { status: 429, headers: { ...PRIVATE_HEADERS, 'Retry-After': '3600' } },
    );
  }
  if (globalToday >= DIAG_GLOBAL_DAILY_LIMIT) {
    return NextResponse.json(
      { error: '平台今日 AI 诊断总量已达上限，请明日再试或联系任课教师', quota: { globalDailyLimit: DIAG_GLOBAL_DAILY_LIMIT } },
      { status: 429, headers: { ...PRIVATE_HEADERS, 'Retry-After': '3600' } },
    );
  }
  return null;
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
    return NextResponse.json({ error: '请求参数不合法', detail: parsed.error.issues[0]?.message }, { status: 400, headers: PRIVATE_HEADERS });
  }
  const { experimentId, code, question, snapshot } = parsed.data;

  const cfg = getExperimentConfig(experimentId);
  if (!cfg) {
    return NextResponse.json({ error: '未知实验' }, { status: 404, headers: PRIVATE_HEADERS });
  }

  const quotaError = await checkQuota(auth.userId);
  if (quotaError) return quotaError;

  const userContent = [
    `【学生自述】${question?.trim() || '（未填写，直接诊断）'}`,
    `\n【实验信息】\n${experimentBrief(experimentId)}`,
    `\n【仿真状态快照】\n${snapshotText(snapshot)}`,
    code ? `\n【学生当前代码】\n${code.slice(0, MAX_CODE_LENGTH)}` : '',
  ].join('');

  try {
    const client = new ZhipuClient(process.env.ZHIPU_API_KEY ?? '');
    const response = await client.chat(
      [
        { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      resolveZhipuModel(),
    );
    const raw = response.choices[0]?.message?.content ?? '';
    const result = parseDiagnosis(raw);

    await prisma.learningEvent.create({
      data: {
        userId: auth.userId,
        eventType: DIAGNOSIS_EVENT,
        targetType: 'experiment',
        targetId: experimentId,
        experimentId,
        metadata: JSON.stringify({ model: resolveZhipuModel(), pt: response.usage?.prompt_tokens ?? 0, ct: response.usage?.completion_tokens ?? 0 }),
      },
    });

    const usedToday = await prisma.learningEvent.count({
      where: { userId: auth.userId, eventType: DIAGNOSIS_EVENT, createdAt: { gte: beijingDayStart() } },
    });

    return NextResponse.json(
      { ...result, quota: { dailyLimit: DIAG_DAILY_LIMIT, usedToday } },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    return NextResponse.json(
      { error: `AI 诊断暂时不可用：${message}` },
      { status: 502, headers: PRIVATE_HEADERS },
    );
  }
}
