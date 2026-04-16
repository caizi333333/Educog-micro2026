import { NextRequest, NextResponse } from 'next/server';
import { logout, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 获取访问令牌
    const authorization = request.headers.get('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const accessToken = authorization.substring(7);
    
    // 验证令牌
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return NextResponse.json(
        { error: '令牌无效' },
        { status: 401 }
      );
    }
    
    // 获取刷新令牌
    const refreshToken = request.cookies?.get('refreshToken')?.value;

    // 执行登出
    await logout(payload.userId, refreshToken);

    // 清除cookie
    const response = NextResponse.json({
      success: true,
      message: '登出成功'
    });

    // 在测试环境中，cookies可能未定义
    if (response.cookies && response.cookies.delete) {
      response.cookies.delete('refreshToken');
    }

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || '登出失败' },
      { status: 400 }
    );
  }
}