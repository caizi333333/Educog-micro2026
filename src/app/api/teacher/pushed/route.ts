// Reverse view for teachers: "what tasks have I pushed and how are students
// doing on them?". Aggregates UserExperiment + LearningPath rows across the
// students enrolled in classes the teacher manages.
//
// Optional ?classId= narrows to a single class. Without it, the response
// covers every class the teacher (or admin) has access to.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { canManageTeachingData, getAccessibleClassIds } from '@/lib/classroom';
import { experiments as experimentCatalog } from '@/lib/experiment-config';

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.substring(7));
    if (!payload) return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    if (!canManageTeachingData(payload)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const requestedClassId = searchParams.get('classId');
    const accessibleClassIds = await getAccessibleClassIds(payload);

    if (requestedClassId && payload.role !== 'ADMIN' && !accessibleClassIds.includes(requestedClassId)) {
      return NextResponse.json({ error: '无权查看该班级' }, { status: 403 });
    }

    const activeClassIds = requestedClassId ? [requestedClassId] : accessibleClassIds;

    // Resolve student userIds the teacher cares about. Same shape used by
    // /api/teacher/dashboard so the two stay consistent.
    const studentEnrollments = activeClassIds.length === 0
      ? []
      : await prisma.classEnrollment.findMany({
        where: {
          classId: { in: activeClassIds },
          role: 'STUDENT',
          status: 'ACTIVE',
          user: { role: 'STUDENT', status: 'ACTIVE' },
        },
        select: {
          userId: true,
          classId: true,
          user: { select: { id: true, name: true, username: true, studentId: true } },
        },
      });

    const studentIds = Array.from(new Set(studentEnrollments.map((e) => e.userId)));
    const totalStudents = studentIds.length;

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalStudents,
          experiments: [],
          paths: [],
        },
      });
    }

    const [userExperiments, learningPaths] = await Promise.all([
      prisma.userExperiment.findMany({
        where: { userId: { in: studentIds } },
        select: {
          experimentId: true,
          status: true,
          score: true,
          userId: true,
          updatedAt: true,
        },
      }),
      prisma.learningPath.findMany({
        where: { userId: { in: studentIds } },
        select: {
          id: true,
          name: true,
          description: true,
          totalModules: true,
          currentModule: true,
          status: true,
          startedAt: true,
          completedAt: true,
          userId: true,
        },
      }),
    ]);

    const experimentTitleById = new Map<string, { title: string; duration: number }>();
    for (const exp of experimentCatalog) {
      experimentTitleById.set(exp.id, { title: exp.title, duration: exp.duration });
    }

    type ExperimentBucket = {
      experimentId: string;
      title: string;
      duration: number | null;
      assigned: number;
      inProgress: number;
      completed: number;
      avgScore: number | null;
      uniqueStudents: number;
      lastActivityAt: string | null;
    };
    const expBuckets = new Map<string, ExperimentBucket>();
    const expScoreSums = new Map<string, { sum: number; count: number }>();
    const expStudentSets = new Map<string, Set<string>>();

    for (const ue of userExperiments) {
      let bucket = expBuckets.get(ue.experimentId);
      if (!bucket) {
        const meta = experimentTitleById.get(ue.experimentId);
        bucket = {
          experimentId: ue.experimentId,
          title: meta?.title ?? ue.experimentId,
          duration: meta?.duration ?? null,
          assigned: 0,
          inProgress: 0,
          completed: 0,
          avgScore: null,
          uniqueStudents: 0,
          lastActivityAt: null,
        };
        expBuckets.set(ue.experimentId, bucket);
        expStudentSets.set(ue.experimentId, new Set());
      }
      const status = (ue.status || '').toUpperCase();
      if (status === 'ASSIGNED') bucket.assigned++;
      else if (status === 'COMPLETED') bucket.completed++;
      else bucket.inProgress++;
      expStudentSets.get(ue.experimentId)!.add(ue.userId);

      if (typeof ue.score === 'number' && !Number.isNaN(ue.score)) {
        const cur = expScoreSums.get(ue.experimentId) ?? { sum: 0, count: 0 };
        cur.sum += ue.score;
        cur.count++;
        expScoreSums.set(ue.experimentId, cur);
      }

      const ts = ue.updatedAt?.toISOString() ?? null;
      if (ts && (!bucket.lastActivityAt || ts > bucket.lastActivityAt)) {
        bucket.lastActivityAt = ts;
      }
    }
    for (const [id, set] of expStudentSets) {
      const b = expBuckets.get(id)!;
      b.uniqueStudents = set.size;
      const score = expScoreSums.get(id);
      if (score && score.count > 0) {
        b.avgScore = Math.round((score.sum / score.count) * 10) / 10;
      }
    }

    const experiments = Array.from(expBuckets.values()).sort((a, b) => {
      if (a.lastActivityAt && b.lastActivityAt) {
        return b.lastActivityAt.localeCompare(a.lastActivityAt);
      }
      return a.experimentId.localeCompare(b.experimentId);
    });

    type PathBucket = {
      name: string;
      description: string | null;
      totalStudents: number;
      active: number;
      paused: number;
      completed: number;
      avgProgressPct: number;
      latestStartedAt: string | null;
    };
    const pathBuckets = new Map<string, PathBucket & { progressSum: number; progressCount: number }>();

    for (const p of learningPaths) {
      let bucket = pathBuckets.get(p.name);
      if (!bucket) {
        bucket = {
          name: p.name,
          description: p.description,
          totalStudents: 0,
          active: 0,
          paused: 0,
          completed: 0,
          avgProgressPct: 0,
          latestStartedAt: null,
          progressSum: 0,
          progressCount: 0,
        };
        pathBuckets.set(p.name, bucket);
      }
      bucket.totalStudents++;
      const status = (p.status || '').toUpperCase();
      if (status === 'ACTIVE') bucket.active++;
      else if (status === 'PAUSED') bucket.paused++;
      else if (status === 'COMPLETED') bucket.completed++;

      if (p.totalModules > 0) {
        bucket.progressSum += (p.currentModule / p.totalModules) * 100;
        bucket.progressCount++;
      }

      const ts = p.startedAt?.toISOString() ?? null;
      if (ts && (!bucket.latestStartedAt || ts > bucket.latestStartedAt)) {
        bucket.latestStartedAt = ts;
      }
    }

    const paths = Array.from(pathBuckets.values()).map((b) => ({
      name: b.name,
      description: b.description,
      totalStudents: b.totalStudents,
      active: b.active,
      paused: b.paused,
      completed: b.completed,
      avgProgressPct: b.progressCount > 0 ? Math.round(b.progressSum / b.progressCount) : 0,
      latestStartedAt: b.latestStartedAt,
    })).sort((a, b) => {
      if (a.latestStartedAt && b.latestStartedAt) {
        return b.latestStartedAt.localeCompare(a.latestStartedAt);
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      success: true,
      data: { totalStudents, experiments, paths },
    });
  } catch (err) {
    console.error('teacher/pushed GET error:', err);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
