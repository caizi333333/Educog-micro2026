import { NextRequest, NextResponse } from 'next/server';
import { changePassword, verifyToken } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const payload = await verifyToken(authorization.substring(7));
    if (!payload) {
      return NextResponse.json({ error: '令牌无效' }, { status: 401 });
    }

    const body = await request.json();
    const oldPassword = typeof body.oldPassword === 'string' ? body.oldPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ error: '原密码和新密码不能为空' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: '新密码长度至少为6位' }, { status: 400 });
    }

    await changePassword(payload.userId, oldPassword, newPassword);

    return NextResponse.json({ success: true, message: '密码已修改，请重新登录' });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '修改密码失败' },
      { status: 400 },
    );
  }
}
