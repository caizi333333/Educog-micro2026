/**
 * 实验空间对接编排：ticket 落地建会话 + 完成时成绩回传。
 *
 * 数据真实性纪律：
 * - 回传的用户名/时间/成绩/步骤全部来自服务端记录，不读客户端自报数字；
 * - ai_call_count 只统计服务端可核验的 LearningEvent(AI_*) 与诊断信标；
 * - 回传失败不阻塞学生保存，但写入 IlabUploadLog 留痕待补传。
 */
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { randomUUID, createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getJwtSecret, getJwtRefreshSecret } from '@/lib/env';
import { getIlabConfig, isIlabConfigured } from './config';
import {
  exchangeTicket,
  refreshAccessToken,
  uploadExperimentResult,
  normalizeOriginId,
  type IlabResultPayload,
} from './client';
import { buildIlabSteps, buildAiData, type StepEvidence } from './steps';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** ilab 影子账号：实验空间用户名 → 本平台学生账号（不可走表单登录）。 */
async function findOrCreateIlabUser(ilabUsername: string, displayName: string) {
  const safe = ilabUsername.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 40) || 'user';
  const username = `ilab_${safe}`;
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing;
  const hash = createHash('sha256').update(ilabUsername).digest('hex').slice(0, 10);
  const password = await bcrypt.hash(randomUUID(), 10);
  try {
    return await prisma.user.create({
      data: {
        username,
        email: `ilab_${hash}@ilab.local`,
        password,
        name: displayName || `实验空间用户 ${safe}`,
        role: 'STUDENT',
        status: 'ACTIVE',
      },
    });
  } catch {
    // 并发建号：重查一次
    const again = await prisma.user.findUnique({ where: { username } });
    if (again) return again;
    throw new Error('创建实验空间会话用户失败');
  }
}

/**
 * ticket 落地：换 access_token → 影子账号 → 本平台的 accessToken/refreshToken + Session。
 * ticket 两分钟过期，本函数须在进入页内立即完成。
 */
export async function handleIlabEntry(ticket: string): Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
  experimentId: string;
}> {
  const config = getIlabConfig();
  if (!isIlabConfigured(config)) throw new Error('实验空间对接未启用');
  const token = await exchangeTicket(config, ticket);
  const user = await findOrCreateIlabUser(token.username, token.displayName);

  // 与本站登录完全同构：JWT + Session 行 + 30 天会话
  const sessionId = randomUUID();
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sid: sessionId, authVersion: user.authVersion },
    getJwtSecret(),
    { expiresIn: '7d' },
  );
  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh', sid: sessionId, authVersion: user.authVersion },
    getJwtRefreshSecret(),
    { expiresIn: '30d' },
  );
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.ilabSession.create({
    data: {
      sessionId,
      userId: user.id,
      ilabUsername: token.username,
      ilabDisplayName: token.displayName,
      accessToken: token.accessToken,
      tokenExpiresAt: new Date(token.expiresAtMs),
      experimentId: config.experimentId,
    },
  });
  await prisma.userActivity.create({
    data: {
      userId: user.id,
      action: 'ILAB_ENTRY',
      details: JSON.stringify({ ilabUsername: token.username, experimentId: config.experimentId }),
    },
  });

  return { userId: user.id, accessToken, refreshToken, experimentId: config.experimentId };
}

async function refreshIlabTokenIfNeeded(session: {
  id: string;
  accessToken: string;
  tokenExpiresAt: Date;
  refreshCount: number;
}): Promise<string> {
  const config = getIlabConfig();
  if (session.tokenExpiresAt.getTime() > Date.now() + 60_000) return session.accessToken;
  if (session.refreshCount >= 2) throw new Error('实验空间令牌刷新次数已用尽');
  const next = await refreshAccessToken(config, session.accessToken);
  await prisma.ilabSession.update({
    where: { id: session.id },
    data: {
      accessToken: next.accessToken,
      tokenExpiresAt: new Date(next.expiresAtMs),
      refreshCount: { increment: 1 },
    },
  });
  return next.accessToken;
}

function collectStepEvidence(
  record: { startedAt: Date | null; completedAt: Date | null; results: string | null },
  beacons: { stepId: string; createdAt: Date }[],
): StepEvidence[] {
  const evidence: StepEvidence[] = beacons.map((b) => ({
    stepId: b.stepId,
    at: b.createdAt.getTime(),
    kind: 'beacon',
  }));
  const results = (() => {
    try {
      return record.results ? (JSON.parse(record.results) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  })();
  const pc = isRecord(results.projectCompletion) ? results.projectCompletion : null;
  const milestones = Array.isArray(pc?.milestones) ? pc.milestones : [];
  for (const m of milestones) {
    if (isRecord(m) && m.confirmed === true && typeof m.confirmedAt === 'string') {
      const at = Date.parse(m.confirmedAt);
      if (Number.isFinite(at) && typeof m.id === 'string') {
        evidence.push({ stepId: `milestone:${m.id}`, at, kind: 'milestone' });
        evidence.push({ stepId: 'milestone_check', at, kind: 'milestone' });
      }
    }
  }
  if (record.completedAt) {
    evidence.push({ stepId: 'report_submit', at: record.completedAt.getTime(), kind: 'system' });
  }
  return evidence;
}

/**
 * 实验完成时回传实验空间。仅在 ILAB_ENABLED 且该用户有 ilab 会话时执行。
 * 返回 true 表示已完成回传（或无需回传），false 表示回传失败已留痕。
 */
export async function maybeUploadToIlab(
  userId: string,
  experimentId: string,
): Promise<boolean> {
  const config = getIlabConfig();
  if (!isIlabConfigured(config) || experimentId !== config.experimentId) return true;

  const session = await prisma.ilabSession.findFirst({
    where: { userId, experimentId },
    orderBy: { createdAt: 'desc' },
  });
  if (!session) return true; // 非实验空间来源用户不回传

  const record = await prisma.userExperiment.findUnique({
    where: { userId_experimentId: { userId, experimentId } },
  });
  if (!record || record.status !== 'COMPLETED') return true;

  const originId = normalizeOriginId(`XZY_${record.id}`);
  // 幂等：已成功回传过的记录不再重复上传（重试入口见 save 路由 COMPLETED 分支）。
  const uploaded = await prisma.ilabUploadLog.findFirst({
    where: { originId, success: true },
    select: { id: true },
  });
  if (uploaded) return true;
  // 实验窗口起点：学生从实验空间进入的时刻（session.createdAt）与本站记录的
  // startedAt 取更早者——快速完成或 startedAt 缺失时窗口也不会退化成 0 秒。
  const windowStart = Math.min(
    record.startedAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    session.createdAt.getTime(),
  );
  const windowEnd = (record.completedAt ?? new Date()).getTime();

  try {
    const beacons = await prisma.ilabStepEvent.findMany({
      where: { userId, experimentId },
      orderBy: { createdAt: 'asc' },
    });
    const evidence = collectStepEvidence(record, beacons);
    const steps = buildIlabSteps(evidence, windowStart, windowEnd);

    // ai_call_count 只数真实模型调用（LearningEvent.AI_*，剔除配额拒绝记录）；
    // ai_* 步骤信标是行为证据，计入 steps[] 但不计入调用次数。
    // token 用量取各次调用落库的 metadata.pt/ct（智谱返回的 usage），无记录按 0。
    const aiEvents = await prisma.learningEvent.findMany({
      where: {
        userId,
        eventType: { startsWith: 'AI', not: { endsWith: '_REJECTED' } },
        createdAt: { gte: new Date(windowStart - 5 * 60_000), lte: new Date(windowEnd + 60_000) },
      },
      select: { eventType: true, metadata: true },
    });
    let aiInputTokens = 0;
    let aiOutputTokens = 0;
    const aiScenarioCounts = new Map<string, number>();
    for (const ev of aiEvents) {
      aiScenarioCounts.set(ev.eventType, (aiScenarioCounts.get(ev.eventType) ?? 0) + 1);
      try {
        const meta = ev.metadata ? (JSON.parse(ev.metadata) as { pt?: number; ct?: number }) : {};
        aiInputTokens += typeof meta.pt === 'number' ? meta.pt : 0;
        aiOutputTokens += typeof meta.ct === 'number' ? meta.ct : 0;
      } catch { /* 元数据非 JSON 的旧记录按 0 计 */ }
    }
    const aiRemark = [...aiScenarioCounts.entries()]
      .map(([t, n]) => `${({ AI_DIAGNOSIS: '仿真诊断', AI_CODE_REVIEW: '代码评价', AI_CHAT: 'AI助教对话', AI_VARIANT_TASK: '变体任务生成' } as Record<string, string>)[t] ?? t}×${n}`)
      .join('、');

    const payload: IlabResultPayload = {
      username: session.ilabUsername,
      title: config.experimentTitle,
      childProjectTitle: '智慧农业大棚监控系统设计',
      status: 1,
      score: Math.min(100, Math.max(0, Math.round(record.score ?? 100))),
      startTime: windowStart,
      endTime: windowEnd,
      timeUsed: Math.round((windowEnd - windowStart) / 1000),
      appid: config.appid,
      originId,
      steps,
      ext_data: { platform: '芯智育才', experiment_id: experimentId },
      ai_data: buildAiData({ aiCallCount: aiEvents.length, aiInputTokens, aiOutputTokens, aiRemark }),
    };

    const token = await refreshIlabTokenIfNeeded(session);
    const reply = await uploadExperimentResult(config, token, payload);
    await prisma.ilabUploadLog.create({
      data: {
        userId,
        sessionId: session.id,
        experimentId,
        originId,
        endpoint: 'data_upload',
        requestJson: JSON.stringify(payload),
        responseCode: reply.code ?? null,
        responseMsg: reply.msg ?? null,
        success: reply.code === 0,
      },
    });
    return reply.code === 0;
  } catch (error) {
    await prisma.ilabUploadLog.create({
      data: {
        userId,
        sessionId: session.id,
        experimentId,
        originId,
        endpoint: 'data_upload',
        requestJson: '',
        responseMsg: error instanceof Error ? error.message.slice(0, 500) : 'unknown',
        success: false,
      },
    });
    return false;
  }
}
