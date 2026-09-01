import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/lib/auth';
import { getLoginCookieOptions } from '@/lib/auth-storage';

const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60;
const BCRYPT_PASSWORD_MAX_BYTES = 72;

function setNoStore(response: NextResponse): NextResponse {
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  return response;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    
    // 验证必填字段
    if (!email || !username || !password) {
      return setNoStore(NextResponse.json(
        { error: '请提供邮箱、用户名和密码' },
        { status: 400 }
      ));
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return setNoStore(NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      ));
    }

    // 验证密码长度
    if (password.length < 6) {
      return setNoStore(NextResponse.json(
        { error: '密码长度至少为6位' },
        { status: 400 }
      ));
    }
    if (Buffer.byteLength(password, 'utf8') > BCRYPT_PASSWORD_MAX_BYTES) {
      return setNoStore(NextResponse.json(
        { error: '密码不能超过72字节' },
        { status: 400 },
      ));
    }

    // 注册用户
    const result = await register({
      email,
      username,
      password,
      name: optionalString(body.name) ?? optionalString(body.displayName),
      studentId: optionalString(body.studentId),
      class: optionalString(body.class),
      grade: optionalString(body.grade),
      major: optionalString(body.major),
      classInviteCode: optionalString(body.classInviteCode),
    });

    // 设置cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      firstLoginAchievement: result.firstLoginAchievement,
      classEnrollment: result.classEnrollment ?? null
    }, { status: 201 });
    setNoStore(response);

    response.cookies?.set?.(
      'accessToken',
      result.accessToken,
      getLoginCookieOptions(true, ACCESS_TOKEN_MAX_AGE),
    );
    response.cookies?.set?.(
      'refreshToken',
      result.refreshToken,
      getLoginCookieOptions(true, REFRESH_TOKEN_MAX_AGE),
    );

    return response;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return setNoStore(NextResponse.json(
        { error: '请求格式错误' },
        { status: 400 },
      ));
    }
    // 只回显 register() 主动抛出的业务校验文案，其余内部错误（数据库连接失败/schema漂移等）
    // 一律返回通用文案，避免把 Prisma 报错细节泄露给客户端。
    const KNOWN_REGISTER_ERRORS = ['邮箱已被注册', '用户名已被使用', '班级邀请码无效或已停用'];
    if (error instanceof Error && KNOWN_REGISTER_ERRORS.includes(error.message)) {
      return setNoStore(NextResponse.json({ error: error.message }, { status: 400 }));
    }
    return setNoStore(NextResponse.json(
      { error: '服务器内部错误，请稍后重试' },
      { status: 500 }
    ));
  }
}
