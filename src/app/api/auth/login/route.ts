import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { login } from '@/lib/auth';

// In-memory rate limiter: max 10 attempts per IP per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 min

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

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
    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown';
    if (isRateLimited(clientIp)) {
      return setNoStore(NextResponse.json(
        { error: '登录尝试过于频繁，请15分钟后再试' },
        { status: 429 },
      ));
    }

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
    
    // 只有 login() 主动抛出的认证失败文案才回显给用户，其余（数据库连接失败等内部错误）
    // 一律返回通用文案，避免把 Prisma 报错里的数据库主机名等内部信息泄露给客户端。
    const KNOWN_AUTH_ERRORS = ['用户不存在或账号已被禁用', '密码错误'];
    if (error instanceof Error && KNOWN_AUTH_ERRORS.includes(error.message)) {
      const response = NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
      return setNoStore(response);
    }

    const response = NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
    return setNoStore(response);
  }
}
