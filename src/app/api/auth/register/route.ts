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
      firstLoginAchievement: result.firstLoginAchievement,
      classEnrollment: result.classEnrollment ?? null
    }, { status: 201 });

    // 在测试环境中，cookies可能未定义
    if (response.cookies && response.cookies.set) {
      response.cookies.set('accessToken', result.accessToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60
      });
      response.cookies.set('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30天
      });
    }

    return response;
  } catch (error: unknown) {
    // 只回显 register() 主动抛出的业务校验文案，其余内部错误（数据库连接失败/schema漂移等）
    // 一律返回通用文案，避免把 Prisma 报错细节泄露给客户端。
    const KNOWN_REGISTER_ERRORS = ['邮箱已被注册', '用户名已被使用', '班级邀请码无效或已停用'];
    if (error instanceof Error && KNOWN_REGISTER_ERRORS.includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
  }
}
