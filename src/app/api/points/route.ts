import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { POINTS_CONFIG } from '@/lib/points-system';
import { sanitizeMetadata } from '@/lib/classroom';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimiter = new Map<string, number[]>();

interface AwardReceipt {
  kind: 'MANUAL_POINTS_AWARD';
  requestId: string;
  awardedBy: string;
  targetUserId: string;
  type: string;
  points: number;
  description: string;
  customMetadata: string | null;
}

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 32)}`;
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (rateLimiter.get(userId) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimiter.set(userId, recent);
  return true;
}

function parseAwardReceipt(value: string | null): AwardReceipt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AwardReceipt>;
    return parsed.kind === 'MANUAL_POINTS_AWARD' && typeof parsed.requestId === 'string'
      ? parsed as AwardReceipt
      : null;
  } catch {
    return null;
  }
}

function sameAward(left: AwardReceipt, right: AwardReceipt): boolean {
  return left.requestId === right.requestId
    && left.awardedBy === right.awardedBy
    && left.targetUserId === right.targetUserId
    && left.type === right.type
    && left.points === right.points
    && left.description === right.description
    && left.customMetadata === right.customMetadata;
}

function chinaDayStart(now = new Date()): Date {
  const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    chinaTime.getUTCFullYear(),
    chinaTime.getUTCMonth(),
    chinaTime.getUTCDate(),
  ) - 8 * 60 * 60 * 1000);
}

function safeTransactionMetadata(value: string | null): unknown {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const receipt = parsed as Partial<AwardReceipt>;
      if (receipt.kind === 'MANUAL_POINTS_AWARD') {
        return receipt.customMetadata ? JSON.parse(receipt.customMetadata) : null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

    const payload = await verifyToken(authorization.substring(7));
    if (!payload?.userId) return json({ error: '无效的令牌' }, 401);
    if (payload.role !== 'ADMIN') {
      return json({ error: '权限不足', message: '仅管理员可手动分配积分' }, 403);
    }

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim().toUpperCase() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : '';
    const customMetadata = sanitizeMetadata(body.metadata);

    if (!USER_ID_PATTERN.test(targetUserId)) return json({ error: '目标用户编号格式无效' }, 400);
    if (!REQUEST_ID_PATTERN.test(requestId)) return json({ error: '请求编号格式无效' }, 400);
    if (body.confirm !== 'AWARD_POINTS') {
      return json({ error: '请明确确认本次积分奖励', confirmationRequired: true }, 409);
    }
    if (!description || description.length < 3 || description.length > 200) {
      return json({ error: '奖励原因应为3至200个字符' }, 400);
    }
    if (!(type in POINTS_CONFIG)) return json({ error: '无效的积分类型' }, 400);

    const points = POINTS_CONFIG[type as keyof typeof POINTS_CONFIG];
    const receipt: AwardReceipt = {
      kind: 'MANUAL_POINTS_AWARD',
      requestId,
      awardedBy: payload.userId,
      targetUserId,
      type,
      points,
      description,
      customMetadata,
    };
    const transactionId = stableId('manual_points', `${payload.userId}:${requestId}`);
    const activityId = stableId('manual_points_evt', `${payload.userId}:${requestId}`);

    const existing = await prisma.userPointsTransaction.findUnique({ where: { id: transactionId } });
    if (existing) {
      const existingReceipt = parseAwardReceipt(existing.metadata);
      if (!existingReceipt || !sameAward(existingReceipt, receipt)) {
        return json({ error: '请求编号已用于其他积分操作' }, 409);
      }
      const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { totalPoints: true },
      });
      return json({
        success: true,
        duplicate: true,
        transaction: existing,
        totalPoints: target?.totalPoints ?? null,
        message: '已恢复此前的积分奖励结果，未重复计分',
      });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true, status: true },
    });
    if (!target || target.role !== 'STUDENT' || target.status !== 'ACTIVE') {
      return json({ error: '目标学生不存在或未激活' }, 404);
    }
    if (!checkRateLimit(payload.userId)) return json({ error: '请求过于频繁' }, 429);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const transaction = await tx.userPointsTransaction.create({
          data: {
            id: transactionId,
            userId: targetUserId,
            points,
            type,
            description,
            metadata: JSON.stringify(receipt),
          },
        });
        const updated = await tx.user.updateMany({
          where: { id: targetUserId, role: 'STUDENT', status: 'ACTIVE' },
          data: { totalPoints: { increment: points } },
        });
        if (updated.count !== 1) {
          throw Object.assign(new Error('target state changed'), { code: 'TARGET_INACTIVE' });
        }
        const user = await tx.user.findUnique({
          where: { id: targetUserId },
          select: { totalPoints: true },
        });
        if (!user) throw Object.assign(new Error('target missing'), { code: 'TARGET_INACTIVE' });
        await tx.userActivity.create({
          data: {
            id: activityId,
            userId: targetUserId,
            action: 'EARN_POINTS',
            details: JSON.stringify({
              requestId,
              points,
              type,
              totalPoints: user.totalPoints,
              awardedBy: payload.userId,
              reason: description,
            }),
          },
        });
        return { transaction, totalPoints: user.totalPoints };
      });

      return json({
        success: true,
        duplicate: false,
        transaction: result.transaction,
        totalPoints: result.totalPoints,
        message: `已向目标学生奖励 ${points} 积分`,
      }, 201);
    } catch (error: any) {
      if (error?.code === 'TARGET_INACTIVE') return json({ error: '目标学生状态已变化，请刷新后重试' }, 409);
      if (error?.code !== 'P2002') throw error;
      const raced = await prisma.userPointsTransaction.findUnique({ where: { id: transactionId } });
      const racedReceipt = parseAwardReceipt(raced?.metadata ?? null);
      if (!raced || !racedReceipt || !sameAward(racedReceipt, receipt)) {
        return json({ error: '请求编号已用于其他积分操作' }, 409);
      }
      const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { totalPoints: true } });
      return json({
        success: true,
        duplicate: true,
        transaction: raced,
        totalPoints: user?.totalPoints ?? null,
        message: '已恢复此前的积分奖励结果，未重复计分',
      });
    }
  } catch (error) {
    console.error('奖励积分失败:', error);
    return json({ error: '奖励积分失败' }, 500);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

    const payload = await verifyToken(authorization.substring(7));
    if (!payload?.userId) return json({ error: '无效的令牌' }, 401);

    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const parsedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const [user, transactions, stats, dailyPoints] = await Promise.all([
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { totalPoints: true },
      }),
      prisma.userPointsTransaction.findMany({
        where: { userId: payload.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.userPointsTransaction.groupBy({
        by: ['type'],
        where: { userId: payload.userId },
        _sum: { points: true },
        _count: true,
      }),
      prisma.userPointsTransaction.aggregate({
        where: { userId: payload.userId, createdAt: { gte: chinaDayStart() } },
        _sum: { points: true },
      }),
    ]);

    if (!user) return json({ error: '用户不存在' }, 404);
    return json({
      success: true,
      totalPoints: user.totalPoints,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        metadata: safeTransactionMetadata(transaction.metadata),
      })),
      stats: stats.map((stat) => ({
        type: stat.type,
        totalPoints: stat._sum.points || 0,
        count: stat._count,
      })),
      dailyPoints: dailyPoints._sum.points || 0,
      pagination: { limit, offset, hasMore: transactions.length === limit },
    });
  } catch (error) {
    console.error('获取积分历史失败:', error);
    return json({ error: '获取积分历史失败' }, 500);
  }
}
