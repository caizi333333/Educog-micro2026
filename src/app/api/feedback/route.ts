import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { parseFeedbackSubmission, truncateUserAgent } from '@/lib/feedback-policy';
import { submitStudentFeedback } from '@/lib/site-feedback';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
    }
    const payload = await verifyToken(authorization.slice('Bearer '.length).trim());
    if (!payload) {
      return NextResponse.json({ ok: false, error: '无效的令牌' }, { status: 401 });
    }
    if (payload.role !== 'STUDENT') {
      return NextResponse.json({ ok: false, error: '仅学生可以提交反馈' }, { status: 403 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: '提交内容无效' }, { status: 400 });
    }
    const parsed = parseFeedbackSubmission(raw);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const result = await submitStudentFeedback({
      userId: payload.userId,
      category: parsed.value.category,
      body: parsed.value.body,
      anonymous: parsed.value.anonymous,
      pagePath: parsed.value.pagePath,
      userAgent: truncateUserAgent(request.headers.get('user-agent')),
    });
    if (!result.ok) {
      const response = NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      response.headers.set('Retry-After', String(result.retryAfterSeconds));
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    }
    return NextResponse.json(
      { ok: true, unlockedAchievements: result.unlockedAchievements },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('提交反馈失败', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ ok: false, error: '提交失败，请稍后重试' }, { status: 500 });
  }
}
