import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logout, verifyToken } from '@/lib/auth';

function createLogoutResponse(): NextResponse {
  const response = NextResponse.json({
    success: true,
    message: '登出成功'
  });
  response.headers?.set?.('Cache-Control', 'no-store, max-age=0');
  response.cookies?.delete('accessToken');
  response.cookies?.delete('refreshToken');
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
    if (accessToken) {
      const payload = await verifyToken(accessToken);
      if (payload) {
        await logout(payload.userId, refreshToken);
      }
    }

    return createLogoutResponse();
  } catch {
    // 即使服务端会话清理失败，也要清浏览器 cookie，避免用户停在空白受保护页面。
    return createLogoutResponse();
  }
}
