/**
 * Study points that the ledger already advertised but the study path never wrote.
 *
 * DAILY_LOGIN is once per Asia/Shanghai campus day, from login or from the
 * first accepted study increment that day. TIME_MILESTONE stays 30 points per
 * completed hour of summed learningProgress.timeSpent. Minutes under an hour
 * are recorded as study time and explained; they do not mint a time row.
 */
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { campusDateKey } from '@/lib/campus-time';
import { POINTS_CONFIG } from '@/lib/points-system';

export const STUDY_MILESTONE_SECONDS = 60 * 60;

export interface StudyPointsStatus {
  totalStudySeconds: number;
  dailyLoginPoints: number;
  milestoneSeconds: number;
  pointsPerMilestone: number;
  completedMilestones: number;
  secondsUntilNextMilestone: number;
  note: string;
  dailyLoginAwarded: boolean;
  timeMilestoneAwarded: number;
}

export interface DailyLoginAward {
  awarded: boolean;
  duplicate: boolean;
  points: number;
  dateKey: string;
}

function isUniqueConstraintError(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && (value as { code?: unknown }).code === 'P2002';
}

function studyPointsId(value: string): string {
  return `pt_${createHash('sha256').update(value).digest('hex').slice(0, 28)}`;
}

export function describeStudyPoints(totalStudySeconds: number): StudyPointsStatus {
  const safeSeconds = Number.isFinite(totalStudySeconds) ? Math.max(0, Math.floor(totalStudySeconds)) : 0;
  const completedMilestones = Math.floor(safeSeconds / STUDY_MILESTONE_SECONDS);
  const remainder = safeSeconds % STUDY_MILESTONE_SECONDS;
  const secondsUntilNextMilestone = remainder === 0 && completedMilestones > 0
    ? STUDY_MILESTONE_SECONDS
    : STUDY_MILESTONE_SECONDS - remainder;
  const minutes = Math.floor(safeSeconds / 60);
  const loginPoints = POINTS_CONFIG.DAILY_LOGIN;
  const hourPoints = POINTS_CONFIG.TIME_MILESTONE;
  const remainMinutes = Math.max(1, Math.ceil(secondsUntilNextMilestone / 60));
  const note = completedMilestones === 0
    ? `每日首次登录或学习 +${loginPoints} 分（北京时间，每天一次）。学习时长按满 1 小时 +${hourPoints} 分；当前累计 ${minutes} 分钟，未满 1 小时，时长积分尚未入账。`
    : `每日首次登录或学习 +${loginPoints} 分（北京时间，每天一次）。学习时长已满 ${completedMilestones} 小时，之后每满 1 小时 +${hourPoints} 分，距下一小时还有 ${remainMinutes} 分钟。`;

  return {
    totalStudySeconds: safeSeconds,
    dailyLoginPoints: loginPoints,
    milestoneSeconds: STUDY_MILESTONE_SECONDS,
    pointsPerMilestone: hourPoints,
    completedMilestones,
    secondsUntilNextMilestone,
    note,
    dailyLoginAwarded: false,
    timeMilestoneAwarded: 0,
  };
}

export async function awardDailyLogin(
  userId: string,
  now: Date,
  source: 'login' | 'learning-progress',
): Promise<DailyLoginAward> {
  const dateKey = campusDateKey(now);
  const points = POINTS_CONFIG.DAILY_LOGIN;
  try {
    await prisma.$transaction([
      prisma.userPointsTransaction.create({
        data: {
          id: studyPointsId(`${userId}:DAILY_LOGIN:${dateKey}`),
          userId,
          points,
          type: 'DAILY_LOGIN',
          description: `每日登录或学习（北京时间 ${dateKey}，每天一次）`,
          metadata: JSON.stringify({ dateKey, source, rule: 'once-per-campus-day' }),
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: points } },
      }),
    ]);
    return { awarded: true, duplicate: false, points, dateKey };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { awarded: false, duplicate: true, points: 0, dateKey };
    }
    throw error;
  }
}

export async function awardTimeMilestones(
  userId: string,
  previousTotalSeconds: number,
  nextTotalSeconds: number,
): Promise<number> {
  const previousHours = Math.floor(Math.max(0, previousTotalSeconds) / STUDY_MILESTONE_SECONDS);
  const nextHours = Math.floor(Math.max(0, nextTotalSeconds) / STUDY_MILESTONE_SECONDS);
  if (nextHours <= previousHours) return 0;

  let awarded = 0;
  for (let hour = previousHours + 1; hour <= nextHours; hour += 1) {
    try {
      await prisma.$transaction([
        prisma.userPointsTransaction.create({
          data: {
            id: studyPointsId(`${userId}:TIME_MILESTONE:${hour}`),
            userId,
            points: POINTS_CONFIG.TIME_MILESTONE,
            type: 'TIME_MILESTONE',
            description: `累计学习满 ${hour} 小时`,
            metadata: JSON.stringify({
              hourIndex: hour,
              totalStudySeconds: Math.floor(nextTotalSeconds),
              source: 'learning-progress',
            }),
          },
        }),
        prisma.user.update({
          where: { id: userId },
          data: { totalPoints: { increment: POINTS_CONFIG.TIME_MILESTONE } },
        }),
      ]);
      awarded += POINTS_CONFIG.TIME_MILESTONE;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
  return awarded;
}

export async function recordStudySessionPoints(input: {
  userId: string;
  role: string;
  acceptedTimeIncrement: number;
  now: Date;
}): Promise<StudyPointsStatus> {
  let totalStudySeconds = 0;
  try {
    const summed = await prisma.learningProgress.aggregate({
      where: { userId: input.userId },
      _sum: { timeSpent: true },
    });
    totalStudySeconds = Math.max(0, summed._sum.timeSpent ?? 0);
  } catch (error) {
    console.error('读取累计学习时长失败:', error);
  }

  const status = describeStudyPoints(totalStudySeconds);
  if (input.role !== 'STUDENT' || input.acceptedTimeIncrement <= 0) return status;

  try {
    const daily = await awardDailyLogin(input.userId, input.now, 'learning-progress');
    const previousTotal = Math.max(0, totalStudySeconds - input.acceptedTimeIncrement);
    const timeMilestoneAwarded = await awardTimeMilestones(input.userId, previousTotal, totalStudySeconds);
    return {
      ...status,
      dailyLoginAwarded: daily.awarded,
      timeMilestoneAwarded,
    };
  } catch (error) {
    console.error('学习积分入账失败:', error);
    return status;
  }
}
