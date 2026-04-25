import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getActiveClassIdForUser, normalizeLearningEventInput, type LearningEventInput } from '@/lib/classroom';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authorization = request.headers.get('authorization');
    const token = authorization?.startsWith('Bearer ')
      ? authorization.substring(7)
      : typeof body.token === 'string'
        ? body.token
        : '';

    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    const events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
    if (events.length === 0) {
      return NextResponse.json({ error: 'events 不能为空' }, { status: 400 });
    }

    const classId = await getActiveClassIdForUser(payload.userId);
    const normalized = events
      .map((event: LearningEventInput) => normalizeLearningEventInput(event))
      .filter(Boolean)
      .map((event: any) => ({
        userId: payload.userId,
        classId,
        ...event,
      }));

    if (normalized.length === 0) {
      return NextResponse.json({ error: '没有可保存的有效事件' }, { status: 400 });
    }

    await prisma.learningEvent.createMany({ data: normalized });

    return NextResponse.json({
      success: true,
      accepted: normalized.length,
      ignored: events.length - normalized.length,
    });
  } catch (error) {
    console.error('保存学习行为失败:', error);
    return NextResponse.json({ error: '保存学习行为失败' }, { status: 500 });
  }
}
