import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { admit, heartbeat, leave } from '@/lib/simulation-admission';

/**
 * 仿真实验入场券接口（并发准入控制）。
 * POST {action:'enter', experimentId}  → 200 {admitted:true, sessionId} | 429 {admitted:false, position, retryAfterSec}
 * POST {action:'heartbeat', sessionId} → 200 {admitted:true} | 410 {admitted:false}（会话已回收，需重新 enter）
 * POST {action:'leave', sessionId}     → 200 {}
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  let token = authorization?.startsWith('Bearer ') ? authorization.substring(7) : '';
  // 浏览器端凭证已迁入 httpOnly cookie：拿到的是 'cookie-session' 占位标记，需回退读 cookie。
  if (!token || token === 'cookie-session') {
    token = request.cookies.get('accessToken')?.value ?? '';
  }
  if (!token) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const payload = await verifyToken(token);
  if (!payload?.userId) {
    return NextResponse.json({ error: '令牌无效' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action : '';

  if (action === 'enter') {
    const experimentId = typeof body.experimentId === 'string' ? body.experimentId : 'proj04';
    const result = await admit(payload.userId, experimentId);
    if (!result.admitted) {
      return NextResponse.json(result, {
        status: 429,
        headers: { 'Retry-After': String(result.retryAfterSec) },
      });
    }
    return NextResponse.json(result);
  }

  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId) {
    return NextResponse.json({ error: '缺少 sessionId' }, { status: 400 });
  }

  if (action === 'heartbeat') {
    const alive = await heartbeat(sessionId);
    return alive
      ? NextResponse.json({ admitted: true })
      : NextResponse.json({ admitted: false, expired: true }, { status: 410 });
  }
  if (action === 'leave') {
    await leave(sessionId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: '未知 action' }, { status: 400 });
}
