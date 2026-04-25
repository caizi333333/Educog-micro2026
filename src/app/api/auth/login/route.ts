import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { login } from '@/lib/auth';

type LoginRequestBody = Partial<{
  emailOrUsername: string;
  password: string;
}>;

function setNoStore(response: NextResponse): NextResponse {
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as LoginRequestBody;
    const emailOrUsername = typeof body.emailOrUsername === 'string' ? body.emailOrUsername.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    
    // 验证必填字段
    if (!emailOrUsername || !password) {
      const response = NextResponse.json(
        { error: '邮箱/用户名和密码不能为空' },
        { status: 400 }
      );
      return setNoStore(response);
    }

    // 获取IP和User-Agent
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    // 登录
    const result = await login(emailOrUsername, password, ip, userAgent);

    // 设置cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      accessToken: result.accessToken,
      firstLoginAchievement: result.firstLoginAchievement
    });
    setNoStore(response);

    // accessToken 不设 httpOnly，前端 useEffect 也能读取；middleware 用其判定角色
    response.cookies?.set('accessToken', result.accessToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7天，与 JWT 过期时间一致
    });
    response.cookies?.set('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 // 30天
    });

    return response;
  } catch (error: unknown) {
    // 区分不同类型的错误
    if (error instanceof SyntaxError) {
      // JSON解析错误
      const response = NextResponse.json(
        { error: '请求格式错误' },
        { status: 400 }
      );
      return setNoStore(response);
    }
    
    if (error instanceof Error && error.message.includes('Database connection failed')) {
      // 数据库连接错误
      const response = NextResponse.json(
        { error: '服务器内部错误' },
        { status: 500 }
      );
      return setNoStore(response);
    }
    
    // 其他错误（如认证失败）
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 401 }
    );
    return setNoStore(response);
  }
}
