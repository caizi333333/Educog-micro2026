import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.email || !body.username || !body.password) {
      return NextResponse.json(
        { error: '请提供邮箱、用户名和密码' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 验证密码长度
    if (body.password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少为6位' },
        { status: 400 }
      );
    }

    // 注册用户
    const result = await register(body);

    // 设置cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      firstLoginAchievement: result.firstLoginAchievement
    }, { status: 201 });

    // 在测试环境中，cookies可能未定义
    if (response.cookies && response.cookies.set) {
      response.cookies.set('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30天
      });
    }

    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '注册失败' },
      { status: 400 }
    );
  }
}