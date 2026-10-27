import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { presentTeacherFeedback } from '@/lib/feedback-policy';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.slice('Bearer '.length).trim());
    if (!payload) {
      return NextResponse.json({ ok: false, error: '无效的令牌' }, { status: 401 });
    }
    if (payload.role !== 'TEACHER' && payload.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: '权限不足' }, { status: 403 });
    }

    const requestedLimit = Number(new URL(request.url).searchParams.get('limit') ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requestedLimit)))
      : DEFAULT_LIMIT;

    const rows = await prisma.siteFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        anonymous: true,
        category: true,
        body: true,
        pagePath: true,
        classId: true,
        createdAt: true,
        user: { select: { name: true, username: true, studentId: true } },
      },
    });
    const classIds = [...new Set(rows.flatMap((row) => (row.classId ? [row.classId] : [])))];
    const classes = classIds.length === 0
      ? []
      : await prisma.classGroup.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      });
    const classNames = new Map(classes.map((item) => [item.id, item.name]));
    const items = rows.map((row) => presentTeacherFeedback(
      row,
      row.classId ? classNames.get(row.classId) ?? null : null,
    ));

    return NextResponse.json(
      { ok: true, items },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('读取学生反馈失败', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, error: '读取失败，请稍后重试' }, { status: 500 });
  }
}
