import { grantCatalogAchievements, type AchievementCheck } from '@/lib/achievement-checker';
import { getActiveClassIdForUser } from '@/lib/classroom';
import { feedbackMedalIdsForCount } from '@/lib/feedback-medals';
import {
  campusDayStart,
  evaluateFeedbackRateLimit,
  type FeedbackCategory,
} from '@/lib/feedback-policy';
import { prisma } from '@/lib/prisma';

export interface SubmitFeedbackInput {
  userId: string;
  category: FeedbackCategory;
  body: string;
  anonymous: boolean;
  pagePath: string | null;
  userAgent: string | null;
  now?: Date;
}

export type SubmitFeedbackResult =
  | { ok: true; id: string; unlockedAchievements: AchievementCheck[] }
  | { ok: false; status: 429; error: string; retryAfterSeconds: number };

/**
 * Persist one valid student feedback row and award any feedback medals
 * whose count threshold is now met. Rate-limit checks and the insert share
 * one transaction so a rejected burst does not leave a row behind.
 */
export async function submitStudentFeedback(input: SubmitFeedbackInput): Promise<SubmitFeedbackResult> {
  const now = input.now ?? new Date();
  const dayStart = campusDayStart(now);

  return prisma.$transaction(async (tx) => {
    const latest = await tx.siteFeedback.findFirst({
      where: { userId: input.userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const submissionsOnCampusDay = await tx.siteFeedback.count({
      where: { userId: input.userId, createdAt: { gte: dayStart } },
    });
    const decision = evaluateFeedbackRateLimit({
      now,
      latestCreatedAt: latest?.createdAt ?? null,
      submissionsOnCampusDay,
    });
    if (!decision.ok) {
      return {
        ok: false as const,
        status: 429 as const,
        error: decision.error,
        retryAfterSeconds: decision.retryAfterSeconds,
      };
    }

    const classId = await getActiveClassIdForUser(input.userId, null, tx);
    const created = await tx.siteFeedback.create({
      data: {
        userId: input.userId,
        anonymous: input.anonymous,
        category: input.category,
        body: input.body,
        pagePath: input.pagePath,
        userAgent: input.userAgent,
        classId,
      },
      select: { id: true },
    });
    const validCount = await tx.siteFeedback.count({ where: { userId: input.userId } });
    const unlockedAchievements = await grantCatalogAchievements(
      input.userId,
      feedbackMedalIdsForCount(validCount),
      'feedback',
      tx,
    );
    return { ok: true as const, id: created.id, unlockedAchievements };
  });
}
