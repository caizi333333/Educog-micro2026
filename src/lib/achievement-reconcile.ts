import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface ReconcileResult {
  userId: string;
  found: boolean;
  pointsFixed: boolean;
  pointsDiff: number;
  achievementsChecked: number;
  inconsistencies: string[];
}

export interface ReconcileBatchResult {
  total: number;
  fixed: number;
  details: ReconcileResult[];
  hasMore: boolean;
  nextCursor: string | null;
}

function emptyResult(userId: string): ReconcileResult {
  return {
    userId,
    found: false,
    pointsFixed: false,
    pointsDiff: 0,
    achievementsChecked: 0,
    inconsistencies: [],
  };
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

/**
 * Reconcile one user's cached total against immutable point transactions.
 * The read, correction and audit record share a serializable transaction so a concurrent point award
 * cannot be silently overwritten by an older aggregate snapshot.
 */
export async function reconcileUserPoints(userId: string, performedBy?: string): Promise<ReconcileResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const [user, pointsAgg, achievementCount] = await Promise.all([
          tx.user.findUnique({ where: { id: userId }, select: { totalPoints: true, status: true } }),
          tx.userPointsTransaction.aggregate({ where: { userId }, _sum: { points: true } }),
          tx.userAchievement.count({ where: { userId } }),
        ]);
        if (!user || user.status === 'DELETED') return emptyResult(userId);

        const computedTotal = pointsAgg._sum.points ?? 0;
        const pointsDiff = computedTotal - user.totalPoints;
        const result: ReconcileResult = {
          userId,
          found: true,
          pointsFixed: false,
          pointsDiff,
          achievementsChecked: achievementCount,
          inconsistencies: [],
        };
        if (pointsDiff === 0) return result;

        await tx.user.update({ where: { id: userId }, data: { totalPoints: computedTotal } });
        await tx.achievementAuditLog.create({
          data: {
            userId,
            achievementId: '__RECONCILE_POINTS__',
            action: 'RECALC',
            performedBy: performedBy ?? null,
            previousState: JSON.stringify({ totalPoints: user.totalPoints }),
            newState: JSON.stringify({ totalPoints: computedTotal }),
            reason: `Points drift corrected by ${pointsDiff}: recorded ${user.totalPoints}, transaction sum ${computedTotal}`,
          },
        });
        result.pointsFixed = true;
        result.inconsistencies.push(`totalPoints corrected: ${user.totalPoints} → ${computedTotal}`);
        return result;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 1) throw error;
    }
  }
  throw new Error('积分校准重试失败');
}

/** Process one bounded batch. The caller must explicitly continue with nextCursor. */
export async function reconcileAllUsers(options: {
  performedBy?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<ReconcileBatchResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const rows = await prisma.user.findMany({
    where: { status: { not: 'DELETED' } },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const users = rows.slice(0, limit);
  const details: ReconcileResult[] = [];
  for (const user of users) {
    details.push(await reconcileUserPoints(user.id, options.performedBy));
  }
  return {
    total: details.length,
    fixed: details.filter((item) => item.pointsFixed).length,
    details,
    hasMore,
    nextCursor: hasMore && users.length > 0 ? users[users.length - 1].id : null,
  };
}
