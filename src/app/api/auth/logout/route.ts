import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logout, verifyToken } from '@/lib/auth';
import { getLogoutCookieOptions } from '@/lib/auth-storage';

function createLogoutResponse(): NextResponse {
  const response = NextResponse.json({
    success: true,
    message: '登出成功'
  });
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  response.cookies?.set('accessToken', '', getLogoutCookieOptions());
  response.cookies?.set('refreshToken', '', getLogoutCookieOptions());
  return response;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取访问令牌。优先使用请求头，缺失时回退到 cookie，保证退出登录可以清掉服务端 cookie。
    const authorization = request.headers.get('authorization');
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.substring(7)
      : request.cookies?.get('accessToken')?.value;
    
    const refreshToken = request.cookies?.get('refreshToken')?.value;
    const payload = accessToken ? await verifyToken(accessToken) : null;
    if (payload || refreshToken) {
      await logout(payload?.userId, refreshToken, payload?.sid);
    }

    return createLogoutResponse();
  } catch {
    // 即使服务端会话清理失败，也要清浏览器 cookie，避免用户停在空白受保护页面。
    return createLogoutResponse();
  }
}
