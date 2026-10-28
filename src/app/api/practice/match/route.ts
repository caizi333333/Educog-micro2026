import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { recordMatchAttempt } from '@/lib/practice-match-record';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimiter = new Map<string, number[]>();

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (rateLimiter.get(userId) ?? []).filter((time) => now - time < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) return false;
  recent.push(now);
  rateLimiter.set(userId, recent);
  return true;
}

/** The window lives for the process. Tests clear it so one file can post more than the cap. */
export function resetPracticeMatchRateLimit(): void {
  rateLimiter.clear();
}

function readPlacements(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 20) return null;
  const placements: Record<string, string> = {};
  for (const [slotId, chipId] of entries) {
    if (!/^[\w-]{1,64}$/.test(slotId)) return null;
    if (typeof chipId !== 'string' || !/^[\w-]{1,64}$/.test(chipId)) return null;
    placements[slotId] = chipId;
  }
  return placements;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);

    const payload = await verifyToken(authorization.substring(7));
    if (!payload?.userId) return json({ error: '无效的令牌' }, 401);
    if (!checkRateLimit(payload.userId)) return json({ error: '请求过于频繁，请稍后再试' }, 429);

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body');
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: '请求格式错误' }, 400);
    }

    const boardId = typeof body.boardId === 'string' ? body.boardId.trim() : '';
    if (!/^[\w-]{1,64}$/.test(boardId)) return json({ error: '题目编号无效' }, 400);
    const placements = readPlacements(body.placements);
    if (!placements) return json({ error: '摆放格式无效' }, 400);

    const recorded = await recordMatchAttempt({
      userId: payload.userId,
      role: payload.role,
      boardId,
      placements,
      now: new Date(),
    });
    if (!recorded) return json({ error: '没有这道练一练' }, 404);
    return json(recorded);
  } catch (error) {
    console.error('练一练记分失败:', error);
    return json({ error: '服务器内部错误' }, 500);
  }
}
