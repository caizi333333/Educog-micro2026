import { prisma } from '@/lib/prisma';

/**
 * 仿真实验准入控制（并发排队）。
 *
 * 申报口径：承诺并发数以内的实验请求即时进入；超过时返回排队提示与位次。
 * 实现：每个在场实验会话写一行心跳记录（DB 持久化，跨 serverless 实例一致），
 * 心跳窗口外视为离场。进入时统计活跃数，满员返回 429+位次，前端轮询重试。
 */

/** 心跳窗口：超过该时长未刷新的会话判为离场（崩溃/关页兜底回收） */
const ACTIVE_WINDOW_MS = 90_000;
/** 承诺并发容量：与申报书"同时在线人数"口径一致，可用环境变量覆盖 */
const MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.SIM_MAX_CONCURRENCY ?? 200) || 200,
);

export type AdmissionResult =
  | { admitted: true; sessionId: string }
  | { admitted: false; position: number; retryAfterSec: number };

function activeThreshold(): Date {
  return new Date(Date.now() - ACTIVE_WINDOW_MS);
}

/** 顺手回收心跳窗口外的陈旧会话，避免表无限增长 */
async function pruneStale(): Promise<void> {
  await prisma.simulationSession.deleteMany({
    where: { lastSeenAt: { lt: activeThreshold() } },
  });
}

export async function admit(userId: string, experimentId: string): Promise<AdmissionResult> {
  await pruneStale();
  // 已有在场会话 → 直接刷新放行（刷新页面/重复进入不重复占位）
  const existing = await prisma.simulationSession.findUnique({
    where: { userId_experimentId: { userId, experimentId } },
  });
  if (existing) {
    await prisma.simulationSession.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    });
    return { admitted: true, sessionId: existing.id };
  }

  const activeCount = await prisma.simulationSession.count({
    where: { lastSeenAt: { gte: activeThreshold() } },
  });
  if (activeCount >= MAX_CONCURRENT) {
    return {
      admitted: false,
      position: activeCount - MAX_CONCURRENT + 1,
      retryAfterSec: 30,
    };
  }

  const session = await prisma.simulationSession.create({
    data: { userId, experimentId },
  });
  return { admitted: true, sessionId: session.id };
}

export async function heartbeat(sessionId: string): Promise<boolean> {
  const updated = await prisma.simulationSession.updateMany({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });
  return updated.count > 0;
}

export async function leave(sessionId: string): Promise<void> {
  await prisma.simulationSession.deleteMany({ where: { id: sessionId } });
}
