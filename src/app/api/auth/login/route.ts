import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证必填字段
    if (!body.emailOrUsername || !body.password) {
      return NextResponse.json(
        { error: '邮箱/用户名和密码不能为空' },
        { status: 400 }
      );
    }

    // 获取IP和User-Agent
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // 登录
    const result = await login(body.emailOrUsername, body.password, ip, userAgent);

    // 设置cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      firstLoginAchievement: result.firstLoginAchievement
    });

    // 在测试环境中，cookies可能未定义
    if (response.cookies && response.cookies.set) {
      // accessToken 不设 httpOnly，前端 useEffect 也能读取；middleware 用其判定角色
      response.cookies.set('accessToken', result.accessToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7天，与 JWT 过期时间一致
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
    // 区分不同类型的错误
    if (error instanceof SyntaxError) {
      // JSON解析错误
      return NextResponse.json(
        { error: '请求格式错误' },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message.includes('Database connection failed')) {
      // 数据库连接错误
      return NextResponse.json(
        { error: '服务器内部错误' },
        { status: 500 }
      );
    }
    
    // 其他错误（如认证失败）
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 401 }
    );
  }
}