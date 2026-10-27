import { createHash } from 'node:crypto';
import { ACHIEVEMENTS_V2 } from '@/lib/achievements-v2';
import { grantCatalogAchievements, type AchievementCheck } from '@/lib/achievement-checker';
import { getActiveClassIdForUser } from '@/lib/classroom';
import { prisma } from '@/lib/prisma';
import { practiceMedalIdsForCount } from '@/lib/practice-medals';
import {
  MATCH_CLEAR_EVENT,
  decideMatchReward,
  findMatchBoard,
  gradeMatch,
  matchClearMessage,
  matchMissMessage,
  type MatchRewardReason,
} from '@/lib/practice-match';

function isUniqueConstraintError(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && (value as { code?: unknown }).code === 'P2002';
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 28)}`;
}

export interface RecordedMatch {
  correct: boolean;
  wrongSlotIds: string[];
  missingSlotIds: string[];
  pointsAwarded: number;
  medal: { id: string; title: string; points: number } | null;
  reason: MatchRewardReason;
  message: string;
  cooldownUntil: string | null;
  totalPoints: number | null;
}

export async function recordMatchAttempt(input: {
  userId: string;
  role: string;
  boardId: string;
  placements: Readonly<Record<string, string>>;
  now: Date;
}): Promise<RecordedMatch | null> {
  const board = findMatchBoard(input.boardId);
  if (!board) return null;
  const grade = gradeMatch(board, input.placements);
  if (!grade.correct) {
    return {
      correct: false,
      wrongSlotIds: grade.wrongSlotIds,
      missingSlotIds: grade.missingSlotIds,
      pointsAwarded: 0,
      medal: null,
      reason: 'incorrect',
      message: matchMissMessage(grade, board),
      cooldownUntil: null,
      totalPoints: null,
    };
  }
  if (input.role !== 'STUDENT') {
    return {
      correct: true,
      wrongSlotIds: [],
      missingSlotIds: [],
      pointsAwarded: 0,
      medal: null,
      reason: 'preview',
      message: matchClearMessage({
        reason: 'preview',
        practicePoints: 0,
        medalTitle: null,
        medalPoints: 0,
        cooldownMinutes: Math.round(board.cooldownMs / 60000),
      }),
      cooldownUntil: null,
      totalPoints: null,
    };
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const [previousClears, latest] = await Promise.all([
        tx.learningEvent.count({
          where: { userId: input.userId, eventType: MATCH_CLEAR_EVENT, targetId: board.id },
        }),
        tx.learningEvent.findFirst({
          where: { userId: input.userId, eventType: MATCH_CLEAR_EVENT, targetId: board.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);
      const decision = decideMatchReward({
        correct: true,
        previousClears,
        lastClearAtMs: latest?.createdAt.getTime() ?? null,
        nowMs: input.now.getTime(),
        cooldownMs: board.cooldownMs,
        firstClearPoints: board.firstClearPoints,
        awardToStudent: true,
      });
      if (!decision.recordEvent) {
        return { decision, practicePointsAwarded: 0, unlocked: [] as AchievementCheck[] };
      }

      const classId = await getActiveClassIdForUser(input.userId, null, tx);
      await tx.learningEvent.create({
        data: {
          ...(decision.reason === 'first_clear'
            ? { id: stableId('pev', `${input.userId}:${board.id}:first`) }
            : {}),
          userId: input.userId,
          classId,
          eventType: MATCH_CLEAR_EVENT,
          targetType: 'PRACTICE',
          targetId: board.id,
          moduleId: board.moduleId,
          chapterId: board.chapterId,
          progress: 100,
          clientTime: input.now,
          metadata: JSON.stringify({
            source: 'lesson-notes',
            sectionId: board.sectionId,
            knowledgePointId: board.knowledgePointId,
            reason: decision.reason,
          }),
        },
      });

      let practicePointsAwarded = 0;
      if (decision.practicePoints > 0) {
        await tx.userPointsTransaction.create({
          data: {
            id: stableId('pt', `${input.userId}:PRACTICE_CLEAR:${board.id}:first`),
            userId: input.userId,
            points: decision.practicePoints,
            type: 'PRACTICE_CLEAR',
            description: `第5章练一练首次对上：${board.title}`,
            metadata: JSON.stringify({ boardId: board.id, rule: 'first-clear-once' }),
          },
        });
        await tx.user.update({
          where: { id: input.userId },
          data: { totalPoints: { increment: decision.practicePoints } },
        });
        practicePointsAwarded = decision.practicePoints;
      }

      const clearCount = previousClears + 1;
      const unlocked = decision.grantMedals
        ? await grantCatalogAchievements(
          input.userId,
          practiceMedalIdsForCount(board.id, clearCount),
          'practice_match',
          tx,
        )
        : [];
      return { decision, practicePointsAwarded, unlocked };
    });

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { totalPoints: true },
    });
    const medalGrant = outcome.unlocked.find((item) => item.achievementId === board.medalId) ?? null;
    const medalDefinition = medalGrant
      ? ACHIEVEMENTS_V2.find((item) => item.id === medalGrant.achievementId) ?? null
      : null;
    const medal = medalGrant
      ? {
        id: medalGrant.achievementId,
        title: medalDefinition?.title ?? medalGrant.achievementId,
        points: medalGrant.points,
      }
      : null;
    const cooldownUntilMs = outcome.decision.cooldownUntilMs;
    return {
      correct: true,
      wrongSlotIds: [],
      missingSlotIds: [],
      pointsAwarded: outcome.practicePointsAwarded + (medal?.points ?? 0),
      medal,
      reason: outcome.decision.reason,
      message: matchClearMessage({
        reason: outcome.decision.reason,
        practicePoints: outcome.practicePointsAwarded,
        medalTitle: medal?.title ?? null,
        medalPoints: medal?.points ?? 0,
        cooldownMinutes: Math.round(board.cooldownMs / 60000),
      }),
      cooldownUntil: cooldownUntilMs == null ? null : new Date(cooldownUntilMs).toISOString(),
      totalPoints: user?.totalPoints ?? null,
    };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return {
      correct: true,
      wrongSlotIds: [],
      missingSlotIds: [],
      pointsAwarded: 0,
      medal: null,
      reason: 'cooldown',
      message: matchClearMessage({
        reason: 'cooldown',
        practicePoints: 0,
        medalTitle: null,
        medalPoints: 0,
        cooldownMinutes: Math.round(board.cooldownMs / 60000),
      }),
      cooldownUntil: null,
      totalPoints: null,
    };
  }
}
