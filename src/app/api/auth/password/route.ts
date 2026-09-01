import { NextResponse } from 'next/server';
import { changePassword, verifyToken } from '@/lib/auth';

function json(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ error: '未授权' }, 401);
    }

    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return json({ error: '令牌无效' }, 401);
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ error: '请求内容格式不正确' }, 400);
    }
    const record = body as Record<string, unknown>;
    const oldPassword = typeof record.oldPassword === 'string' ? record.oldPassword : '';
    const newPassword = typeof record.newPassword === 'string' ? record.newPassword : '';

    if (!oldPassword || !newPassword) {
      return json({ error: '原密码和新密码不能为空' }, 400);
    }

    if (newPassword.length < 6) {
      return json({ error: '新密码长度至少为6位' }, 400);
    }
    if (Buffer.byteLength(newPassword, 'utf8') > 72) {
      return json({ error: '新密码不能超过72字节' }, 400);
    }
    if (oldPassword === newPassword) {
      return json({ error: '新密码不能与当前密码相同' }, 400);
    }

    await changePassword(payload.userId, oldPassword, newPassword);

    return json({ success: true, message: '密码已修改，请重新登录' });
  } catch (error) {
    if (error instanceof Error && [
      '原密码错误',
      '新密码不能与当前密码相同',
      '新密码应为6位以上且不超过72字节',
      '密码已发生变化，请重新登录后再试',
    ].includes(error.message)) {
      return json({ error: error.message }, 400);
    }
    if (error instanceof Error && error.message === '用户不存在') return json({ error: error.message }, 404);
    console.error('修改密码失败:', error);
    return json({ error: '修改密码失败，请稍后重试' }, 500);
  }
}
