import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { Prisma, PracticeCardAttempt } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { verifyToken, type JWTPayload } from '@/lib/auth';
import { requireClassroomApiAccess } from '@/lib/classroom-access';
import {
  getAccessibleClassIds,
  getActiveClassIdForUser,
} from '@/lib/classroom';
import { campusDayBounds } from '@/lib/campus-time';
import { summarizeStudyActivity } from '@/lib/study-activity';
import { getModuleIdForChapter } from '@/lib/lesson-tasks';
import { toPublicQuestion, type Question } from '@/lib/quiz-data';
import {
  chapterProgress,
  csvCell,
  gradePractice,
  practiceBank,
  practiceModes,
  practiceQuestions,
  scheduleReview,
} from '@/lib/practice-cards';

const WRITE_LIMITS: Record<string, number> = {
  answer: 120,
  'challenge/start': 10,
  'challenge/answer': 120,
};
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimiter = new Map<string, number[]>();

function checkWriteRateLimit(userId: string, action: string): boolean {
  const limit = WRITE_LIMITS[action];
  if (!limit) return true;
  const now = Date.now();
  const key = `${userId}:${action}`;
  const recent = (rateLimiter.get(key) ?? []).filter(
    (time) => now - time < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= limit) return false;
  recent.push(now);
  rateLimiter.set(key, recent);
  return true;
}

class PracticeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function requireValue(
  value: unknown,
  message: string,
  status = 400,
): asserts value {
  if (!value) throw new PracticeError(status, message);
}
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export async function practiceLeaderboard(classId: string | null) {
  if (!classId) return [];
  const runs = await prisma.practiceChallenge.findMany({
    where: {
      classId,
      finishedAt: { not: null },
      user: { role: 'STUDENT', status: 'ACTIVE' },
    },
    select: {
      userId: true,
      correctCount: true,
      user: { select: { name: true, username: true } },
    },
    orderBy: [{ correctCount: 'desc' }, { finishedAt: 'asc' }],
  });
  const seen = new Set<string>();
  return runs
    .filter((r) => {
      if (seen.has(r.userId)) return false;
      seen.add(r.userId);
      return true;
    })
    .slice(0, 10)
    .map((r) => ({
      name: r.user.name || r.user.username,
      best: r.correctCount,
    }));
}
function feedback(attempt: PracticeCardAttempt, question: Question) {
  return {
    questionId: question.id,
    answer: attempt.answer,
    correct: attempt.correct,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation || '',
    xp: attempt.xp,
  };
}
async function recordAnswer(
  tx: Prisma.TransactionClient,
  input: {
    payload: JWTPayload;
    classId: string | null;
    question: Question;
    answer: string;
    mode: string;
    requestId: string;
    now: Date;
  },
) {
  const { payload, classId, question, answer, mode, requestId, now } = input;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${payload.userId} FOR UPDATE`;
  const prior = await tx.practiceCardAttempt.findUnique({
    where: { userId_requestId: { userId: payload.userId, requestId } },
  });
  if (prior) {
    requireValue(
      prior.questionId === question.id &&
        prior.answer === answer &&
        prior.mode === mode &&
        prior.classId === classId,
      '提交编号已用于其他答案',
      409,
    );
    return prior;
  }
  const correct = gradePractice(question, answer);
  const { start, end } = campusDayBounds(now);
  const rewarded = await tx.practiceCardAttempt.findFirst({
    where: {
      userId: payload.userId,
      questionId: question.id,
      correct: true,
      createdAt: { gte: start, lt: end },
    },
  });
  const recent = await tx.practiceCardAttempt.findMany({
    where: { userId: payload.userId },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { correct: true },
  });
  const wrongAt = recent.findIndex((a) => !a.correct);
  const combo = (wrongAt === -1 ? recent.length : wrongAt) + 1;
  const xp =
    correct && !rewarded ? 10 + Math.min(Math.floor(combo / 3) * 2, 10) : 0;
  const attempt = await tx.practiceCardAttempt.create({
    data: {
      userId: payload.userId,
      classId,
      questionId: question.id,
      answer,
      correct,
      mode,
      requestId,
      xp,
      createdAt: now,
    },
  });
  const previous = await tx.practiceReviewCard.findUnique({
    where: {
      userId_questionId: { userId: payload.userId, questionId: question.id },
    },
  });
  const schedule = scheduleReview(
    previous?.box ?? null,
    correct,
    mode === 'review',
    now,
  );
  await tx.practiceReviewCard.upsert({
    where: {
      userId_questionId: { userId: payload.userId, questionId: question.id },
    },
    create: { userId: payload.userId, questionId: question.id, ...schedule },
    update: schedule,
  });
  if (payload.role === 'STUDENT') {
    await tx.learningEvent.create({
      data: {
        userId: payload.userId,
        classId,
        eventType: 'PRACTICE_CARD_ANSWER',
        targetType: 'PRACTICE',
        targetId: String(question.id),
        chapterId: String(question.chapter),
        progress: correct ? 100 : 0,
        createdAt: now,
        metadata: JSON.stringify({
          source: 'practice-cards',
          score: correct ? 100 : 0,
        }),
      },
    });
    const moduleId =
      getModuleIdForChapter(question.chapter) || 'practice-cards';
    await tx.learningProgress.upsert({
      where: {
        userId_moduleId_chapterId: {
          userId: payload.userId,
          moduleId,
          chapterId: String(question.chapter),
        },
      },
      create: {
        userId: payload.userId,
        moduleId,
        chapterId: String(question.chapter),
        status: 'IN_PROGRESS',
        lastAccessAt: now,
      },
      update: { lastAccessAt: now },
    });
  }
  return attempt;
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    requireValue(text.length <= 20000, '请求过大');
    const parsed: unknown = JSON.parse(text);
    requireValue(
      parsed && typeof parsed === 'object' && !Array.isArray(parsed),
      '请求格式错误',
    );
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof PracticeError) throw error;
    throw new PracticeError(400, '请求格式错误');
  }
}
async function teacherData(request: Request, payload: JWTPayload) {
  requireValue(
    payload.role === 'TEACHER' || payload.role === 'ADMIN',
    '仅限任课教师或管理员',
    403,
  );
  const ids = await getAccessibleClassIds(payload);
  const classes = await prisma.classGroup.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const params = new URL(request.url).searchParams;
  const classId = params.get('classId') || classes[0]?.id;
  if (!classId)
    return json({
      classes,
      students: [],
      chapters: [],
      missed: [],
      leaderboard: [],
    });
  requireValue(ids.includes(classId), '无权查看该班级', 403);
  const [attempts, roster, leaderboard] = await Promise.all([
    prisma.practiceCardAttempt.findMany({
      where: { classId, user: { role: 'STUDENT' } },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, username: true, studentId: true } },
      },
    }),
    prisma.classEnrollment.findMany({
      where: {
        classId,
        role: 'STUDENT',
        status: 'ACTIVE',
        user: { status: 'ACTIVE' },
      },
      select: {
        userId: true,
        user: { select: { name: true, username: true, studentId: true } },
      },
    }),
    practiceLeaderboard(classId),
  ]);
  const students = roster.map((r) => {
    const rows = attempts.filter((a) => a.userId === r.userId);
    return {
      name: r.user.name || r.user.username,
      studentId: r.user.studentId,
      attempted: new Set(rows.map((a) => a.questionId)).size,
      attempts: rows.length,
      accuracy: rows.length
        ? Math.round((rows.filter((a) => a.correct).length / rows.length) * 100)
        : 0,
      lastActive: rows.at(-1)?.createdAt.toISOString() || null,
    };
  });
  const chapters = chapterProgress([]).map((ch) => {
    const rows = attempts.filter(
      (a) => practiceBank.get(a.questionId)?.chapter === ch.chapter,
    );
    return {
      ...ch,
      attempts: rows.length,
      accuracy: rows.length
        ? Math.round((rows.filter((a) => a.correct).length / rows.length) * 100)
        : 0,
    };
  });
  const missed = practiceQuestions
    .flatMap((q) => {
      const wrong = attempts.filter((a) => a.questionId === q.id && !a.correct);
      if (!wrong.length) return [];
      const counts = new Map<string, number>();
      wrong.forEach((a) =>
        counts.set(a.answer, (counts.get(a.answer) || 0) + 1),
      );
      return [
        {
          questionId: q.id,
          text: q.questionText,
          count: wrong.length,
          commonWrong: [...counts].sort((a, b) => b[1] - a[1])[0][0],
        },
      ];
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const kind = params.get('export');
  if (kind) {
    requireValue(kind === 'attempts' || kind === 'students', '导出类型无效');
    const rows =
      kind === 'students'
        ? [
            ['姓名', '学号', '已练题数', '作答次数', '正确率', '最后活跃(UTC)'],
            ...students.map((s) => [
              s.name,
              s.studentId,
              s.attempted,
              s.attempts,
              s.accuracy,
              s.lastActive,
            ]),
          ]
        : [
            ['姓名', '学号', '题号', '答案', '正确', '模式', '时间(UTC)'],
            ...attempts.map((a) => [
              a.user.name || a.user.username,
              a.user.studentId,
              a.questionId,
              a.answer,
              a.correct,
              a.mode,
              a.createdAt.toISOString(),
            ]),
          ];
    return new Response(
      '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n'),
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="practice-${kind}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      },
    );
  }
  return json({ classes, classId, students, chapters, missed, leaderboard });
}
export async function handlePracticeCards(request: Request): Promise<Response> {
  try {
    const denied = await requireClassroomApiAccess(request);
    if (denied) return denied;
    const payload = await verifyToken(
      request.headers.get('authorization')!.slice(7).trim(),
    );
    requireValue(payload, '未授权', 401);
    const url = new URL(request.url);
    const action = url.pathname.split('/api/practice/cards/')[1];
    if (
      request.method === 'POST' &&
      !checkWriteRateLimit(payload.userId, action)
    ) {
      return json({ error: '请求过于频繁，请稍后再试' }, 429);
    }
    if (action === 'teacher' && request.method === 'GET')
      return await teacherData(request, payload);
    const body = request.method === 'POST' ? await readBody(request) : {};
    const classIds = await getAccessibleClassIds(payload);
    const preferred = body.classId ?? url.searchParams.get('classId');
    requireValue(
      preferred == null ||
        (typeof preferred === 'string' && classIds.includes(preferred)),
      '无权访问该班级',
      403,
    );
    const classId =
      typeof preferred === 'string'
        ? preferred
        : (await getActiveClassIdForUser(payload.userId)) ||
          classIds[0] ||
          null;
    if (request.method === 'GET') {
      if (action === 'leaderboard')
        return json(await practiceLeaderboard(classId));
      if (action === 'me') {
        const now = new Date();
        const { start, end } = campusDayBounds(now);
        const [attempts, cards, profile, user, classes] = await Promise.all([
          prisma.practiceCardAttempt.findMany({
            where: { userId: payload.userId },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.practiceReviewCard.findMany({
            where: { userId: payload.userId, dueAt: { lte: now } },
            select: { questionId: true },
          }),
          prisma.practiceCardProfile.findUnique({
            where: { userId: payload.userId },
          }),
          prisma.user.findUnique({
            where: { id: payload.userId },
            select: { name: true, username: true },
          }),
          prisma.classGroup.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true },
          }),
        ]);
        const latest = new Map(attempts.map((a) => [a.questionId, a]));
        return json({
          name: user?.name || user?.username || '同学',
          classId,
          classes,
          goal: profile?.dailyGoal ?? 20,
          answered: [...latest.keys()],
          today: new Set(
            attempts
              .filter((a) => a.createdAt >= start && a.createdAt < end)
              .map((a) => a.questionId),
          ).size,
          streak: summarizeStudyActivity(
            attempts.map((a) => a.createdAt),
            now,
          ).streakDays,
          xp: attempts.reduce((sum, a) => sum + a.xp, 0),
          chapters: chapterProgress(attempts),
          due: cards
            .filter((c) => practiceBank.has(c.questionId))
            .map((c) => c.questionId),
          wrong: [...latest.values()]
            .filter((a) => !a.correct && practiceBank.has(a.questionId))
            .map((a) => a.questionId),
          leaderboard: await practiceLeaderboard(classId),
          best:
            (
              await prisma.practiceChallenge.aggregate({
                where: {
                  userId: payload.userId,
                  classId,
                  finishedAt: { not: null },
                },
                _max: { correctCount: true },
              })
            )._max.correctCount || 0,
        });
      }
      if (action === 'questions' || action === 'review') {
        const mode =
          action === 'review'
            ? 'review'
            : url.searchParams.get('mode') || 'all';
        requireValue(
          practiceModes.includes(mode as (typeof practiceModes)[number]),
          '练习模式无效',
        );
        let questions = [...practiceQuestions];
        if (mode === 'chapter') {
          const chapter = Number(url.searchParams.get('chapter'));
          requireValue(
            Number.isInteger(chapter) && chapter >= 1 && chapter <= 10,
            '章节无效',
          );
          questions = questions.filter((q) => q.chapter === chapter);
        }
        if (mode === 'random') questions = shuffle(questions).slice(0, 20);
        if (mode === 'review') {
          const due = await prisma.practiceReviewCard.findMany({
            where: { userId: payload.userId, dueAt: { lte: new Date() } },
            orderBy: { dueAt: 'asc' },
          });
          questions = due.flatMap((c) =>
            practiceBank.has(c.questionId)
              ? [practiceBank.get(c.questionId)!]
              : [],
          );
        }
        if (mode === 'wrong') {
          const rows = await prisma.practiceCardAttempt.findMany({
            where: { userId: payload.userId },
            orderBy: { createdAt: 'asc' },
          });
          const latest = new Map(rows.map((a) => [a.questionId, a]));
          questions = questions.filter(
            (q) => latest.get(q.id)?.correct === false,
          );
        }
        if (mode === 'retry') {
          const ids = (url.searchParams.get('ids') || '')
            .split(',')
            .map(Number);
          requireValue(
            ids.length <= 626 && ids.every((id) => practiceBank.has(id)),
            '重练题号无效',
          );
          questions = questions.filter((q) => ids.includes(q.id));
        }
        return json(questions.map(toPublicQuestion));
      }
    }
    if (request.method === 'POST') {
      if (action === 'me') {
        requireValue(
          typeof body.goal === 'number' &&
            Number.isInteger(body.goal) &&
            body.goal >= 5 &&
            body.goal <= 100,
          '每日目标范围为 5–100',
        );
        await prisma.practiceCardProfile.upsert({
          where: { userId: payload.userId },
          create: { userId: payload.userId, dailyGoal: body.goal },
          update: { dailyGoal: body.goal },
        });
        return json({ goal: body.goal });
      }
      if (action === 'answer') {
        const question = practiceBank.get(Number(body.questionId));
        requireValue(question, '题目不存在', 404);
        requireValue(
          typeof body.answer === 'string' && body.answer.length <= 4000,
          '答案无效',
        );
        requireValue(
          typeof body.requestId === 'string' &&
            /^[\w:-]{8,100}$/.test(body.requestId),
          '提交编号无效',
        );
        requireValue(
          typeof body.mode === 'string' &&
            practiceModes.includes(body.mode as (typeof practiceModes)[number]),
          '练习模式无效',
        );
        if (question.type === 'multiple-choice')
          requireValue(
            question.options.includes(body.answer),
            '请选择有效选项',
          );
        const attempt = await prisma.$transaction((tx) =>
          recordAnswer(tx, {
            payload,
            classId,
            question,
            answer: body.answer as string,
            mode: body.mode as string,
            requestId: body.requestId as string,
            now: new Date(),
          }),
        );
        return json(feedback(attempt, question));
      }
      if (action === 'challenge/start') {
        const startedAt = new Date();
        const run = await prisma.practiceChallenge.create({
          data: {
            userId: payload.userId,
            classId,
            questionIds: shuffle(
              practiceQuestions.filter((q) => q.type === 'multiple-choice'),
            ).map((q) => q.id),
            startedAt,
            deadline: new Date(startedAt.getTime() + 60000),
          },
        });
        return json({
          id: run.id,
          deadline: run.deadline,
          seconds: 60,
          questions: run.questionIds.map((id) =>
            toPublicQuestion(practiceBank.get(id)!),
          ),
        });
      }
      if (action === 'challenge/answer' || action === 'challenge/finish') {
        requireValue(
          typeof body.id === 'string' && body.id.length <= 100,
          '挑战编号无效',
        );
        const result = await prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "PracticeChallenge" WHERE "id" = ${body.id as string} FOR UPDATE`;
          const run = await tx.practiceChallenge.findUnique({
            where: { id: body.id as string },
          });
          requireValue(run && run.userId === payload.userId, '挑战不存在', 404);
          requireValue(
            !run.classId || classIds.includes(run.classId),
            '无权访问该班级',
            403,
          );
          const now = new Date();
          if (action === 'challenge/finish') {
            if (!run.finishedAt)
              await tx.practiceChallenge.update({
                where: { id: run.id },
                data: { finishedAt: now },
              });
            return {
              score: run.correctCount,
              total: run.answeredCount,
              classId: run.classId,
            };
          }
          requireValue(
            !run.finishedAt && now < run.deadline,
            '时间到，请查看成绩',
            409,
          );
          requireValue(
            Number.isInteger(body.position) &&
              body.position === run.answeredCount,
            '题目已提交或顺序无效',
            409,
          );
          const question = practiceBank.get(run.questionIds[run.answeredCount]);
          requireValue(
            question && question.type === 'multiple-choice',
            '挑战已完成',
            409,
          );
          requireValue(
            typeof body.answer === 'string' &&
              question.options.includes(body.answer),
            '请选择有效选项',
          );
          const attempt = await recordAnswer(tx, {
            payload,
            classId: run.classId,
            question,
            answer: body.answer,
            mode: 'challenge',
            requestId: `${run.id}:${run.answeredCount}`,
            now,
          });
          await tx.practiceChallenge.update({
            where: { id: run.id },
            data: {
              answeredCount: { increment: 1 },
              correctCount: { increment: attempt.correct ? 1 : 0 },
            },
          });
          return { correct: attempt.correct, xp: attempt.xp };
        });
        if ('score' in result)
          return json({
            ...result,
            leaderboard: await practiceLeaderboard(result.classId ?? null),
            best:
              (
                await prisma.practiceChallenge.aggregate({
                  where: {
                    userId: payload.userId,
                    classId: result.classId ?? null,
                    finishedAt: { not: null },
                  },
                  _max: { correctCount: true },
                })
              )._max.correctCount || 0,
          });
        return json(result);
      }
    }
    return json({ error: '接口不存在' }, 404);
  } catch (error) {
    if (error instanceof PracticeError)
      return json({ error: error.message }, error.status);
    console.error('刷题卡片服务失败:', error);
    return json({ error: '刷题服务暂不可用，请稍后重试' }, 500);
  }
}
