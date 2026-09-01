import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { login } from '@/lib/auth';
import { getLoginCookieOptions } from '@/lib/auth-storage';

const LOGIN_ROLES = ['STUDENT', 'TEACHER', 'ADMIN'] as const;
type LoginRole = typeof LOGIN_ROLES[number];
const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;
const AUTH_SERVICE_UNAVAILABLE_CODES = new Set(['P1001', 'P1002', 'P2022', 'P2024']);
const AUTH_SERVICE_UNAVAILABLE_ERROR_NAMES = new Set([
  'PrismaClientInitializationError',
  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientRustPanicError',
]);

function isAuthServiceUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === 'string' && AUTH_SERVICE_UNAVAILABLE_CODES.has(code)) return true;
  const explicitName = 'name' in error ? (error as { name?: unknown }).name : undefined;
  const constructorName = error.constructor?.name;
  return (typeof explicitName === 'string' && AUTH_SERVICE_UNAVAILABLE_ERROR_NAMES.has(explicitName))
    || (typeof constructorName === 'string' && AUTH_SERVICE_UNAVAILABLE_ERROR_NAMES.has(constructorName));
}

function setNoStore(response: NextResponse): NextResponse {
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody: unknown = await request.json();
    if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return setNoStore(NextResponse.json(
        { error: '请求格式错误' },
        { status: 400 },
      ));
    }
    const body = rawBody as Record<string, unknown>;
    const emailOrUsername = typeof body.emailOrUsername === 'string' ? body.emailOrUsername.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const hasExpectedRole = Object.prototype.hasOwnProperty.call(body, 'expectedRole');
    const expectedRole = typeof body.expectedRole === 'string' ? body.expectedRole.trim().toUpperCase() : undefined;
    const hasRememberDevice = Object.prototype.hasOwnProperty.call(body, 'rememberDevice');
    const rememberDevice = hasRememberDevice ? body.rememberDevice : true;
    
    // 验证必填字段
    if (!emailOrUsername || !password) {
      const response = NextResponse.json(
        { error: '邮箱/用户名和密码不能为空' },
        { status: 400 }
      );
      return setNoStore(response);
    }
    if (hasExpectedRole && (!expectedRole || !LOGIN_ROLES.includes(expectedRole as LoginRole))) {
      return setNoStore(NextResponse.json(
        { error: '登录角色参数无效' },
        { status: 400 },
      ));
    }
    if (typeof rememberDevice !== 'boolean') {
      return setNoStore(NextResponse.json(
        { error: '记住设备参数无效' },
        { status: 400 },
      ));
    }

    // 获取IP和User-Agent
    const ip = (
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')?.trim()
      ?? ''
    ).slice(0, 128) || undefined;
    const userAgent = request.headers.get('user-agent') ?? undefined;

    // 登录
    const result = expectedRole
      ? await login(emailOrUsername, password, ip, userAgent, expectedRole as LoginRole)
      : await login(emailOrUsername, password, ip, userAgent);

    // 设置cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      firstLoginAchievement: result.firstLoginAchievement
    });
    setNoStore(response);

    // accessToken 和 refreshToken 都仅由服务端读取，不在 JSON 或浏览器存储中暴露。
    response.cookies?.set(
      'accessToken',
      result.accessToken,
      getLoginCookieOptions(rememberDevice, ACCESS_TOKEN_MAX_AGE),
    );
    response.cookies?.set(
      'refreshToken',
      result.refreshToken,
      getLoginCookieOptions(rememberDevice, REFRESH_TOKEN_MAX_AGE),
    );

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
    const ROLE_MISMATCH_ERROR = '当前账号与所选登录角色不一致，请切换正确的角色或账号';
    const INVALID_CREDENTIALS_ERROR = '账号或密码不正确，或账号已停用';
    const RATE_LIMIT_ERROR = '登录尝试过于频繁，请稍后再试';
    const KNOWN_AUTH_ERRORS = [INVALID_CREDENTIALS_ERROR, ROLE_MISMATCH_ERROR, RATE_LIMIT_ERROR];
    if (error instanceof Error && KNOWN_AUTH_ERRORS.includes(error.message)) {
      const status = error.message === ROLE_MISMATCH_ERROR
        ? 403
        : error.message === RATE_LIMIT_ERROR ? 429 : 401;
      const response = NextResponse.json(
        { error: error.message },
        { status }
      );
      if (status === 429) response.headers.set('Retry-After', '900');
      return setNoStore(response);
    }

    // 数据库不可达、连接池耗尽或结构尚未同步都属于“服务暂不可用”，
    // 不能让评委误以为预留账号或密码错误；同时不向客户端暴露主机名、列名等细节。
    if (isAuthServiceUnavailable(error)) {
      const response = NextResponse.json(
        {
          error: '登录服务暂时不可用，请稍后重试',
          code: 'AUTH_SERVICE_UNAVAILABLE',
        },
        { status: 503 },
      );
      response.headers.set('Retry-After', '30');
      return setNoStore(response);
    }

    const response = NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    );
    return setNoStore(response);
  }
}
