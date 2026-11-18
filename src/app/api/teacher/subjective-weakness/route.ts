import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveTeachingScope } from '@/lib/teaching-scope';
import { isCurrentTermClass } from '@/lib/current-term';
import { isDemoRosterAccount } from '@/lib/daily-class-pulse';
import { getSubjectiveQuestion } from '@/lib/subjective-data';
import { getDataProvenance } from '@/lib/env';

type LatestVerdict = 'got' | 'review';

const WEAK_QUESTION_LIMIT = 15;
const WEAK_STUDENT_LIMIT = 15;

// 教师端大题薄弱看板：按本学期正式班名册聚合主观题"还不熟"自评，
// 让教师看到哪些题、哪些章最卡学生、哪些人最需要帮扶。
export async function GET(request: NextRequest): Promise<NextResponse> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const payload = await verifyToken(authorization.substring(7));
  if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
  if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
    return NextResponse.json({ error: '权限不足' }, { status: 403 });
  }

  const resolvedScope = await resolveTeachingScope(payload, new URLSearchParams('scope=current'));
  if (!resolvedScope.ok) {
    return NextResponse.json({ error: resolvedScope.error }, { status: resolvedScope.status });
  }
  const classes = resolvedScope.value.classes.filter((classGroup) => isCurrentTermClass(classGroup));
  const classIds = classes.map((classGroup) => classGroup.id);

  const enrollments = classIds.length === 0
    ? []
    : await prisma.classEnrollment.findMany({
      where: {
        classId: { in: classIds },
        role: 'STUDENT',
        status: 'ACTIVE',
        user: { role: 'STUDENT', status: 'ACTIVE' },
      },
      select: {
        user: { select: { id: true, name: true, username: true, studentId: true } },
      },
    });

  const roster = enrollments
    .map((enrollment) => enrollment.user)
    .filter((user) => !isDemoRosterAccount(user));
  const userById = new Map(roster.map((user) => [user.id, user]));
  const userIds = [...userById.keys()];

  const attempts = userIds.length === 0
    ? []
    : await prisma.subjectiveAttempt.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, questionId: true, verdict: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

  // 每(学生,题)只取最新一次自评
  const latest = new Map<string, { verdict: LatestVerdict; createdAt: Date }>();
  const attemptCountByUser = new Map<string, number>();
  for (const attempt of attempts) {
    const key = `${attempt.userId}:${attempt.questionId}`;
    if (!latest.has(key)) {
      latest.set(key, { verdict: attempt.verdict as LatestVerdict, createdAt: attempt.createdAt });
    }
    attemptCountByUser.set(attempt.userId, (attemptCountByUser.get(attempt.userId) ?? 0) + 1);
  }

  const questionStats = new Map<number, { review: number; got: number }>();
  const chapterReview = new Map<number, number>();
  const studentReview = new Map<string, { review: number; lastAt: Date }>();
  for (const [key, state] of latest) {
    const [userId, questionIdRaw] = key.split(':');
    const questionId = Number(questionIdRaw);
    const stats = questionStats.get(questionId) ?? { review: 0, got: 0 };
    stats[state.verdict === 'review' ? 'review' : 'got'] += 1;
    questionStats.set(questionId, stats);
    if (state.verdict !== 'review') continue;
    const question = getSubjectiveQuestion(questionId);
    if (question) chapterReview.set(question.chapter, (chapterReview.get(question.chapter) ?? 0) + 1);
    const prev = studentReview.get(userId);
    studentReview.set(userId, {
      review: (prev?.review ?? 0) + 1,
      lastAt: prev && prev.lastAt > state.createdAt ? prev.lastAt : state.createdAt,
    });
  }

  const weakQuestions = [...questionStats.entries()]
    .filter(([, stats]) => stats.review > 0)
    .map(([questionId, stats]) => {
      const question = getSubjectiveQuestion(questionId);
      return {
        questionId,
        origId: question?.origId ?? `QS${questionId}`,
        title: question?.title ?? '',
        type: question?.type ?? '',
        chapter: question?.chapter ?? 0,
        points: question?.points ?? 0,
        reviewCount: stats.review,
        gotCount: stats.got,
      };
    })
    .sort((a, b) => b.reviewCount - a.reviewCount || a.questionId - b.questionId)
    .slice(0, WEAK_QUESTION_LIMIT);

  const byChapter = [...chapterReview.entries()]
    .map(([chapter, reviewCount]) => ({ chapter, reviewCount }))
    .sort((a, b) => a.chapter - b.chapter);

  const weakStudents = [...studentReview.entries()]
    .map(([userId, stat]) => {
      const user = userById.get(userId);
      return {
        userId,
        name: user?.name ?? user?.username ?? userId,
        username: user?.username ?? '',
        studentId: user?.studentId ?? null,
        reviewCount: stat.review,
        attemptCount: attemptCountByUser.get(userId) ?? 0,
        lastActivityAt: stat.lastAt.toISOString(),
      };
    })
    .sort((a, b) => b.reviewCount - a.reviewCount || b.attemptCount - a.attemptCount)
    .slice(0, WEAK_STUDENT_LIMIT);

  const assessedUserIds = new Set(attempts.map((attempt) => attempt.userId));

  return NextResponse.json({
    success: true,
    dataProvenance: getDataProvenance(),
    asOf: new Date().toISOString(),
    totals: {
      rosterCount: roster.length,
      practicedCount: assessedUserIds.size,
      reviewMarkedCount: studentReview.size,
      reviewVerdictCount: [...chapterReview.values()].reduce((sum, count) => sum + count, 0),
    },
    weakQuestions,
    byChapter,
    weakStudents,
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}
