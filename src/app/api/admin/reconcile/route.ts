import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { reconcileAllUsers, reconcileUserPoints } from '@/lib/achievement-reconcile';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: '未授权' }, 401);
    const payload = await verifyToken(authorization.substring(7));
    if (!payload?.userId) return json({ error: '令牌无效' }, 401);
    if (payload.role !== 'ADMIN') return json({ error: '仅管理员可执行数据校准' }, 403);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: '请求内容格式不正确' }, 400);
    const record = body as Record<string, unknown>;
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    if (record.userId !== undefined && (!userId || userId.length > 128)) {
      return json({ error: 'userId 格式不正确' }, 400);
    }

    if (userId) {
      const result = await reconcileUserPoints(userId, payload.userId);
      if (!result.found) return json({ error: '用户不存在或已删除' }, 404);
      return json({ success: true, scope: 'user', result });
    }

    if (record.confirm !== 'RECONCILE_BATCH') {
      return json({
        error: '批量校准必须显式提交 confirm=RECONCILE_BATCH；每次最多处理100名用户',
      }, 400);
    }
    const limit = record.limit === undefined ? 50 : record.limit;
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return json({ error: 'limit 必须是1至100之间的整数' }, 400);
    }
    const cursor = record.cursor === undefined ? undefined : record.cursor;
    if (cursor !== undefined && (typeof cursor !== 'string' || !cursor.trim() || cursor.length > 128)) {
      return json({ error: 'cursor 格式不正确' }, 400);
    }

    const summary = await reconcileAllUsers({
      performedBy: payload.userId,
      limit,
      ...(typeof cursor === 'string' ? { cursor: cursor.trim() } : {}),
    });
    return json({ success: true, scope: 'batch', summary });
  } catch (error) {
    console.error('数据校准失败:', error);
    return json({ error: '数据校准失败' }, 500);
  }
}
