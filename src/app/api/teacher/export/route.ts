import { NextResponse, type NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';
import { OFFICIAL_EXPERIMENT_IDS } from '@/lib/experiment-config';

// ── CSV helpers ──────────────────────────────────────────────
function csvCell(v: string | number | null | undefined): string {
  const raw = String(v ?? '');
  const safe = typeof v === 'string' && /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

type ExportMode = 'management' | 'research';

interface ExportIdentityPolicy {
  mode: ExportMode;
  headers: string[];
  cells: (student: ExportStudent | undefined) => Array<string | null>;
  targetId: (targetType: string, targetId: string) => string;
}

function csvResponse(
  headers: string,
  rows: string[],
  filename: string,
  mode: ExportMode,
): NextResponse {
  const body = '﻿' + [headers, ...rows].join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Export-Mode': mode === 'research' ? 'research-pseudonymized' : 'management-identified',
      'X-Export-Notice': mode === 'research'
        ? 'stable-hmac-pseudonyms; direct-identifiers-removed; timestamps-reduced-to-date'
        : 'direct-identifiers; authorized-teaching-use-only',
    },
  });
}

interface ExportStudent {
  id: string;
  name: string | null;
  studentId: string | null;
  className: string | null;
  classIdentitySeed: string | null;
  lastLoginAt: Date | null;
}

interface ExportRows {
  headers: string;
  rows: string[];
}

interface ResolvedStudents {
  students: ExportStudent[];
  studentIds: string[];
}

function getResearchExportSecret(): string | null {
  const configured = process.env.RESEARCH_EXPORT_SECRET?.trim() ?? '';
  return configured.length >= 32 ? configured : null;
}

function researchId(secret: string, namespace: 'student' | 'class', value: string): string {
  const prefix = namespace === 'student' ? 'S' : 'C';
  const digest = createHmac('sha256', secret)
    .update(`${namespace}:${value}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `${prefix}-${digest}`;
}

function createIdentityPolicy(mode: ExportMode, secret: string | null): ExportIdentityPolicy | null {
  if (mode === 'management') {
    return {
      mode,
      headers: ['姓名（仅限教学管理）', '学号（仅限教学管理）', '班级（仅限教学管理）'],
      cells: (student) => [student?.name ?? '', student?.studentId ?? '', student?.className ?? ''],
      targetId: (_targetType, targetId) => targetId,
    };
  }
  if (!secret) return null;
  return {
    mode,
    headers: ['研究编号（稳定不可逆假名）', '班级编号（稳定不可逆假名）'],
    cells: (student) => [
      student ? researchId(secret, 'student', student.id) : '',
      student?.classIdentitySeed || student?.className
        ? researchId(secret, 'class', student.classIdentitySeed || student.className || '')
        : '',
    ],
    targetId: (targetType, targetId) => {
      const normalizedTargetType = targetType.toUpperCase();
      if (normalizedTargetType === 'USER' || normalizedTargetType === 'STUDENT') {
        return researchId(secret, 'student', targetId);
      }
      if (normalizedTargetType === 'CLASS') return researchId(secret, 'class', targetId);
      return targetId;
    },
  };
}

function formatExportDate(value: Date | null | undefined, mode: ExportMode): string {
  if (!value) return '';
  if (mode === 'research') {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  }
  return value.toLocaleString('zh-CN');
}

// ── Auth + student resolution (shared) ───────────────────────
async function resolveStudents(request: NextRequest): Promise<ResolvedStudents | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const payload = await verifyToken(authorization.substring(7));
  if (!payload || (payload.role !== 'TEACHER' && payload.role !== 'ADMIN')) return null;

  const { searchParams } = new URL(request.url);
  const requestedClassId = searchParams.get('classId');
  const accessibleClassIds = await getAccessibleClassIds(payload);

  if (requestedClassId && payload.role !== 'ADMIN' && !accessibleClassIds.includes(requestedClassId)) {
    return null;
  }

  const activeClassIds = requestedClassId ? [requestedClassId] : accessibleClassIds;

  const classEnrollmentWhere = {
    role: 'STUDENT' as const,
    status: 'ACTIVE' as const,
    ...(activeClassIds.length > 0 ? { classId: { in: activeClassIds } } : {}),
    user: { role: 'STUDENT' as const, status: 'ACTIVE' as const },
  };

  const classEnrollments = activeClassIds.length === 0
    ? []
    : await prisma.classEnrollment.findMany({
      where: classEnrollmentWhere,
      include: {
        classGroup: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, studentId: true, class: true, lastLoginAt: true } },
      },
    });

  let students: ExportStudent[];
  if (payload.role === 'ADMIN' && !requestedClassId && classEnrollments.length === 0) {
    students = (await prisma.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true, name: true, studentId: true, class: true, lastLoginAt: true },
    })).map((student) => ({
      id: student.id,
      name: student.name,
      studentId: student.studentId,
      className: student.class,
      classIdentitySeed: null,
      lastLoginAt: student.lastLoginAt,
    }));
  } else {
    const studentById = new Map<string, ExportStudent>();
    for (const enrollment of classEnrollments) {
      const existing = studentById.get(enrollment.user.id);
      const classNames = new Set(
        [existing?.className, enrollment.classGroup.name ?? enrollment.user.class]
          .flatMap((value) => value?.split('；') ?? [])
          .filter((value): value is string => Boolean(value)),
      );
      const classIdentitySeeds = new Set(
        [existing?.classIdentitySeed, enrollment.classGroup.id]
          .flatMap((value) => value?.split('；') ?? [])
          .filter((value): value is string => Boolean(value)),
      );
      studentById.set(enrollment.user.id, {
        id: enrollment.user.id,
        name: enrollment.user.name,
        studentId: enrollment.user.studentId,
        className: classNames.size > 0 ? Array.from(classNames).join('；') : null,
        classIdentitySeed: classIdentitySeeds.size > 0
          ? Array.from(classIdentitySeeds).sort().join('；')
          : null,
        lastLoginAt: enrollment.user.lastLoginAt,
      });
    }
    students = Array.from(studentById.values());
  }

  return { students, studentIds: students.map((student) => student.id) };
}

// ── Export: student-summary ──────────────────────────────────
async function exportStudentSummary(
  studentIds: string[],
  students: ExportStudent[],
  identity: ExportIdentityPolicy,
): Promise<ExportRows> {
  const [loginCounts, learningProgress, quizAttempts, experiments, aiEvents] = await Promise.all([
    prisma.userActivity.groupBy({ by: ['userId'], where: { userId: { in: studentIds }, action: 'LOGIN' }, _count: true }),
    prisma.learningProgress.findMany({ where: { userId: { in: studentIds } }, select: { userId: true, chapterId: true, timeSpent: true } }),
    prisma.quizAttempt.findMany({ where: { userId: { in: studentIds } }, select: { userId: true, quizId: true, score: true } }),
    prisma.userExperiment.findMany({
      where: {
        userId: { in: studentIds },
        experimentId: { in: [...OFFICIAL_EXPERIMENT_IDS] },
      },
      select: { userId: true, status: true },
    }),
    prisma.userActivity.groupBy({ by: ['userId'], where: { userId: { in: studentIds }, action: 'ASK_AI_ASSISTANT' }, _count: true }),
  ]);

  const loginMap = new Map(loginCounts.map((record) => [record.userId, record._count]));
  const aiMap = new Map(aiEvents.map((record) => [record.userId, record._count]));

  const timeMap: Record<string, number> = {};
  const chapterSet: Record<string, Set<string>> = {};
  for (const lp of learningProgress) {
    timeMap[lp.userId] = (timeMap[lp.userId] ?? 0) + (lp.timeSpent ?? 0);
    if (lp.chapterId) {
      if (!chapterSet[lp.userId]) chapterSet[lp.userId] = new Set();
      chapterSet[lp.userId].add(lp.chapterId);
    }
  }

  const quizMap: Record<string, { sum: number; count: number }> = {};
  const bestScore: Record<string, Record<string, number>> = {};
  for (const qa of quizAttempts) {
    if (!bestScore[qa.userId]) bestScore[qa.userId] = {};
    const prev = bestScore[qa.userId][qa.quizId] ?? 0;
    if (qa.score > prev) bestScore[qa.userId][qa.quizId] = qa.score;
  }
  for (const [uid, scores] of Object.entries(bestScore)) {
    const vals = Object.values(scores);
    quizMap[uid] = { sum: vals.reduce((a, b) => a + b, 0), count: vals.length };
  }

  const expMap: Record<string, { completed: number; total: number }> = {};
  for (const exp of experiments) {
    if (!expMap[exp.userId]) expMap[exp.userId] = { completed: 0, total: 0 };
    expMap[exp.userId].total++;
    if (exp.status === 'COMPLETED') expMap[exp.userId].completed++;
  }

  const totalChapters = 10;
  const headers = csvRow([...identity.headers, '登录次数', '学习总时长(分钟)', '测验最高分均值', '计分测验数', '实验完成数', '实验总数', '章节覆盖率(%)', 'AI使用次数', '最近活跃']);
  const rows = students.map((student) => {
    const quiz = quizMap[student.id] ?? { sum: 0, count: 0 };
    const experiment = expMap[student.id] ?? { completed: 0, total: 0 };
    const covered = chapterSet[student.id]?.size ?? 0;
    return csvRow([
      ...identity.cells(student),
      loginMap.get(student.id) ?? 0,
      Math.round((timeMap[student.id] ?? 0) / 60),
      quiz.count > 0 ? Math.round(quiz.sum / quiz.count) : 0,
      quiz.count,
      experiment.completed, experiment.total,
      totalChapters > 0 ? Math.round(covered / totalChapters * 100) : 0,
      aiMap.get(student.id) ?? 0,
      formatExportDate(student.lastLoginAt, identity.mode),
    ]);
  });
  return { headers, rows };
}

// ── Export: quiz-detail ──────────────────────────────────────
async function exportQuizDetail(
  studentIds: string[],
  students: ExportStudent[],
  identity: ExportIdentityPolicy,
): Promise<ExportRows> {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { completedAt: 'desc' },
  });

  const headers = csvRow([...identity.headers, '测验ID', '得分', '总题数', '正确题数', '用时(秒)', '开始时间', '完成时间']);
  const rows = attempts.map((attempt) => {
    const student = studentMap.get(attempt.userId);
    return csvRow([
      ...identity.cells(student),
      attempt.quizId, attempt.score, attempt.totalQuestions, attempt.correctAnswers, attempt.timeSpent,
      formatExportDate(attempt.startedAt, identity.mode),
      formatExportDate(attempt.completedAt, identity.mode),
    ]);
  });
  return { headers, rows };
}

// ── Export: activity-log ─────────────────────────────────────
async function exportActivityLog(
  studentIds: string[],
  students: ExportStudent[],
  identity: ExportIdentityPolicy,
): Promise<ExportRows> {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const events = await prisma.learningEvent.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { createdAt: 'desc' },
  });

  const headers = csvRow([...identity.headers, '事件类型', '目标类型', '目标ID', '时长(秒)', '进度(%)', '记录时间']);
  const rows = events.map((event) => {
    const student = studentMap.get(event.userId);
    return csvRow([
      ...identity.cells(student),
      event.eventType, event.targetType, identity.targetId(event.targetType, event.targetId),
      event.duration ?? '', event.progress ?? '',
      formatExportDate(event.createdAt, identity.mode),
    ]);
  });
  return { headers, rows };
}

// ── Export: experiment-detail ────────────────────────────────
async function exportExperimentDetail(
  studentIds: string[],
  students: ExportStudent[],
  identity: ExportIdentityPolicy,
): Promise<ExportRows> {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const experiments = await prisma.userExperiment.findMany({
    where: {
      userId: { in: studentIds },
      experimentId: { in: [...OFFICIAL_EXPERIMENT_IDS] },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const headers = csvRow([...identity.headers, '实验ID', '状态', '得分', '尝试次数', '用时(秒)', '开始时间', '完成时间']);
  const rows = experiments.map((experiment) => {
    const student = studentMap.get(experiment.userId);
    return csvRow([
      ...identity.cells(student),
      experiment.experimentId, experiment.status, experiment.score ?? '',
      experiment.attempts, experiment.timeSpent ?? '',
      formatExportDate(experiment.startedAt, identity.mode),
      formatExportDate(experiment.completedAt, identity.mode),
    ]);
  });
  return { headers, rows };
}

// ── Route handler ────────────────────────────────────────────
const EXPORT_TYPES = new Set(['student-summary', 'quiz-detail', 'activity-log', 'experiment-detail']);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const resolved = await resolveStudents(request);
    if (!resolved) return NextResponse.json({ error: '未授权或权限不足' }, { status: 403 });

    const { students, studentIds } = resolved;
    if (studentIds.length === 0) {
      return NextResponse.json({ error: '没有可导出的学生数据' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'student-summary';
    if (!EXPORT_TYPES.has(type)) {
      return NextResponse.json({ error: `不支持的导出类型: ${type}` }, { status: 400 });
    }
    const modeRaw = searchParams.get('mode') ?? 'management';
    if (modeRaw !== 'management' && modeRaw !== 'research') {
      return NextResponse.json({ error: '导出模式必须为 management 或 research' }, { status: 400 });
    }
    const mode: ExportMode = modeRaw;
    const identity = createIdentityPolicy(mode, mode === 'research' ? getResearchExportSecret() : null);
    if (!identity) {
      return NextResponse.json({ error: '研究匿名导出尚未配置独立密钥' }, { status: 503 });
    }

    const date = new Date().toISOString().slice(0, 10);
    let result: { headers: string; rows: string[] };

    switch (type) {
      case 'student-summary':
        result = await exportStudentSummary(studentIds, students, identity);
        break;
      case 'quiz-detail':
        result = await exportQuizDetail(studentIds, students, identity);
        break;
      case 'activity-log':
        result = await exportActivityLog(studentIds, students, identity);
        break;
      case 'experiment-detail':
        result = await exportExperimentDetail(studentIds, students, identity);
        break;
      default:
        return NextResponse.json({ error: '未知导出类型' }, { status: 400 });
    }

    const modeLabel = mode === 'research' ? 'research-pseudonymized' : 'management-identified';
    return csvResponse(result.headers, result.rows, `${type}_${modeLabel}_${date}.csv`, mode);
  } catch (error) {
    console.error('Teacher export API error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
