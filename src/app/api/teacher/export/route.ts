import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getAccessibleClassIds } from '@/lib/classroom';

// ── CSV helpers ──────────────────────────────────────────────
function csvCell(v: string | number | null | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(',');
}

function csvResponse(headers: string, rows: string[], filename: string) {
  const body = '﻿' + [headers, ...rows].join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}

// ── Auth + student resolution (shared) ───────────────────────
async function resolveStudents(request: NextRequest) {
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

  const students = payload.role === 'ADMIN' && !requestedClassId && classEnrollments.length === 0
    ? (await prisma.user.findMany({
      where: { role: 'STUDENT', status: 'ACTIVE' },
      select: { id: true, name: true, studentId: true, class: true, lastLoginAt: true },
    })).map(s => ({ ...s, className: s.class }))
    : classEnrollments.map((e: any) => ({
      ...e.user,
      className: e.classGroup?.name || e.user.class,
    }));

  return { students, studentIds: students.map((s: any) => s.id) };
}

// ── Export: student-summary ──────────────────────────────────
async function exportStudentSummary(studentIds: string[], students: any[]) {
  const [loginCounts, learningProgress, quizAttempts, experiments, aiEvents] = await Promise.all([
    prisma.userActivity.groupBy({ by: ['userId'], where: { userId: { in: studentIds }, action: 'LOGIN' }, _count: true }),
    prisma.learningProgress.findMany({ where: { userId: { in: studentIds } }, select: { userId: true, chapterId: true, timeSpent: true } }),
    prisma.quizAttempt.findMany({ where: { userId: { in: studentIds } }, select: { userId: true, quizId: true, score: true } }),
    prisma.userExperiment.findMany({ where: { userId: { in: studentIds } }, select: { userId: true, status: true } }),
    prisma.userActivity.groupBy({ by: ['userId'], where: { userId: { in: studentIds }, action: 'ASK_AI_ASSISTANT' }, _count: true }),
  ]);

  const loginMap = Object.fromEntries(loginCounts.map(r => [r.userId, r._count]));
  const aiMap = Object.fromEntries(aiEvents.map(r => [r.userId, r._count]));

  const timeMap: Record<string, number> = {};
  const chapterSet: Record<string, Set<string>> = {};
  for (const lp of learningProgress) {
    timeMap[lp.userId] = (timeMap[lp.userId] || 0) + (lp.timeSpent || 0);
    if (lp.chapterId) {
      if (!chapterSet[lp.userId]) chapterSet[lp.userId] = new Set();
      chapterSet[lp.userId].add(lp.chapterId);
    }
  }

  const quizMap: Record<string, { sum: number; count: number }> = {};
  const bestScore: Record<string, Record<string, number>> = {};
  for (const qa of quizAttempts) {
    if (!bestScore[qa.userId]) bestScore[qa.userId] = {};
    const prev = bestScore[qa.userId][qa.quizId] || 0;
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
  const headers = csvRow(['姓名', '学号', '班级', '登录次数', '学习总时长(分钟)', '测验平均分', '测验次数', '实验完成数', '实验总数', '知识点覆盖率(%)', 'AI使用次数', '最近活跃']);
  const rows = students.map(s => {
    const q = quizMap[s.id] || { sum: 0, count: 0 };
    const e = expMap[s.id] || { completed: 0, total: 0 };
    const covered = chapterSet[s.id]?.size || 0;
    return csvRow([
      s.name, s.studentId || '', s.className || '',
      loginMap[s.id] || 0,
      Math.round((timeMap[s.id] || 0) / 60),
      q.count > 0 ? Math.round(q.sum / q.count) : 0,
      q.count,
      e.completed, e.total,
      totalChapters > 0 ? Math.round(covered / totalChapters * 100) : 0,
      aiMap[s.id] || 0,
      s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('zh-CN') : '',
    ]);
  });
  return { headers, rows };
}

// ── Export: quiz-detail ──────────────────────────────────────
async function exportQuizDetail(studentIds: string[], students: any[]) {
  const studentMap = Object.fromEntries(students.map((s: any) => [s.id, s]));
  const attempts = await prisma.quizAttempt.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { completedAt: 'desc' },
  });

  const headers = csvRow(['姓名', '学号', '班级', '测验ID', '得分', '总题数', '正确题数', '用时(秒)', '开始时间', '完成时间']);
  const rows = attempts.map(a => {
    const s = studentMap[a.userId] || {};
    return csvRow([
      s.name || '', s.studentId || '', s.className || '',
      a.quizId, a.score, a.totalQuestions, a.correctAnswers, a.timeSpent,
      a.startedAt ? new Date(a.startedAt).toLocaleString('zh-CN') : '',
      a.completedAt ? new Date(a.completedAt).toLocaleString('zh-CN') : '',
    ]);
  });
  return { headers, rows };
}

// ── Export: activity-log ─────────────────────────────────────
async function exportActivityLog(studentIds: string[], students: any[]) {
  const studentMap = Object.fromEntries(students.map((s: any) => [s.id, s]));
  const events = await prisma.learningEvent.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { createdAt: 'desc' },
  });

  const headers = csvRow(['姓名', '学号', '班级', '事件类型', '目标类型', '目标ID', '时长(秒)', '进度(%)', '记录时间']);
  const rows = events.map(e => {
    const s = studentMap[e.userId] || {};
    return csvRow([
      s.name || '', s.studentId || '', s.className || '',
      e.eventType, e.targetType, e.targetId,
      e.duration || '', e.progress != null ? e.progress : '',
      e.createdAt ? new Date(e.createdAt).toLocaleString('zh-CN') : '',
    ]);
  });
  return { headers, rows };
}

// ── Export: experiment-detail ────────────────────────────────
async function exportExperimentDetail(studentIds: string[], students: any[]) {
  const studentMap = Object.fromEntries(students.map((s: any) => [s.id, s]));
  const experiments = await prisma.userExperiment.findMany({
    where: { userId: { in: studentIds } },
    orderBy: { updatedAt: 'desc' },
  });

  const headers = csvRow(['姓名', '学号', '班级', '实验ID', '状态', '得分', '尝试次数', '用时(秒)', '开始时间', '完成时间']);
  const rows = experiments.map(e => {
    const s = studentMap[e.userId] || {};
    return csvRow([
      s.name || '', s.studentId || '', s.className || '',
      e.experimentId, e.status, e.score != null ? e.score : '',
      e.attempts, e.timeSpent || '',
      e.startedAt ? new Date(e.startedAt).toLocaleString('zh-CN') : '',
      e.completedAt ? new Date(e.completedAt).toLocaleString('zh-CN') : '',
    ]);
  });
  return { headers, rows };
}

// ── Route handler ────────────────────────────────────────────
const EXPORT_TYPES = new Set(['student-summary', 'quiz-detail', 'activity-log', 'experiment-detail']);

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveStudents(request);
    if (!resolved) return NextResponse.json({ error: '未授权或权限不足' }, { status: 401 });

    const { students, studentIds } = resolved;
    if (studentIds.length === 0) {
      return NextResponse.json({ error: '没有可导出的学生数据' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'student-summary';
    if (!EXPORT_TYPES.has(type)) {
      return NextResponse.json({ error: `不支持的导出类型: ${type}` }, { status: 400 });
    }

    const date = new Date().toISOString().slice(0, 10);
    let result: { headers: string; rows: string[] };

    switch (type) {
      case 'student-summary':
        result = await exportStudentSummary(studentIds, students);
        break;
      case 'quiz-detail':
        result = await exportQuizDetail(studentIds, students);
        break;
      case 'activity-log':
        result = await exportActivityLog(studentIds, students);
        break;
      case 'experiment-detail':
        result = await exportExperimentDetail(studentIds, students);
        break;
      default:
        return NextResponse.json({ error: '未知导出类型' }, { status: 400 });
    }

    return csvResponse(result.headers, result.rows, `${type}_${date}.csv`);
  } catch (error) {
    console.error('Teacher export API error:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
